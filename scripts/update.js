'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const RULES={QLD:{rsi:[48,42,36],gap:[-10,-18,-26]},TQQQ:{rsi:[43,36,31],gap:[-18,-32,-45]}};
const round=(x,n=2)=>Number(x.toFixed(n));
function sma(v,n){return v.length>=n?v.slice(-n).reduce((a,b)=>a+b,0)/n:null}
// Wilder RSI on completed weekly bars (14 weekly changes).
function rsiWilder(closes,period=14){
 if(closes.length<period+1)return null;
 let gain=0,loss=0;
 for(let i=1;i<=period;i++){let d=closes[i]-closes[i-1];gain+=Math.max(d,0);loss+=Math.max(-d,0)}
 gain/=period;loss/=period;
 for(let i=period+1;i<closes.length;i++){const d=closes[i]-closes[i-1];gain=(gain*(period-1)+Math.max(d,0))/period;loss=(loss*(period-1)+Math.max(-d,0))/period}
 return loss===0?(gain===0?50:100):100-100/(1+gain/loss);
}
function weekKey(ms){ // US exchange calendar week (Monday) in America/New_York
 const d=new Date(ms); const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
 const v=Object.fromEntries(parts.map(p=>[p.type,p.value]));const utc=new Date(Date.UTC(+v.year,+v.month-1,+v.day));const dow=utc.getUTCDay();utc.setUTCDate(utc.getUTCDate()-(dow+6)%7);return utc.toISOString().slice(0,10);
}
function isCurrentWeek(lastTimestamp){return weekKey(lastTimestamp)===weekKey(Date.now())}
function score(rsi,gap,rules){let level=0,by=[];for(let i=0;i<3;i++){if(rsi!==null&&rsi<=rules.rsi[i]){level=i+1;by.push(`RSI ${i+1}차`)}if(gap!==null&&gap<=rules.gap[i]){level=Math.max(level,i+1);by.push(`괴리율 ${i+1}차`)}}return {level,by};}
function calc(symbol,raw){
 const data=raw.chart?.result?.[0];if(!data)throw Error(raw.chart?.error?.description||'시세 응답에 데이터가 없습니다.');
 const ts=data.timestamp||[];const quotes=data.indicators?.quote?.[0]||{};const rows=ts.map((t,i)=>({time:t*1000,close:quotes.close?.[i]})).filter(x=>Number.isFinite(x.close)&&x.close>0);
 if(rows.length<220)throw Error('200일선 및 주봉 RSI 계산을 위한 가격 데이터가 부족합니다.');
 const closes=rows.map(x=>x.close);const ma=sma(closes,200);const last=rows.at(-1);const gap=(last.close/ma-1)*100;
 const weeks=[];for(const row of rows){const key=weekKey(row.time);if(weeks.length&&weeks.at(-1).week===key){weeks[weeks.length-1]={week:key,close:row.close}}else weeks.push({week:key,close:row.close})}
 const completeWeeks=isCurrentWeek(last.time)?weeks.slice(0,-1):weeks;
 const confirmedRsi=rsiWilder(completeWeeks.map(x=>x.close));
 const provisionalRsi=rsiWilder(weeks.map(x=>x.close));
 const rules=RULES[symbol];const confirmed=score(confirmedRsi,gap,rules);const provisional=score(provisionalRsi,gap,rules);
 const next=confirmed.level<3?confirmed.level:2;
 const nextGap=rules.gap[next];const target=ma*(1+nextGap/100);
 return {symbol,price:round(last.close),asOf:new Date(last.time).toISOString(),updatedAt:new Date().toISOString(),sma200:round(ma),gap:round(gap),rsi14:confirmedRsi===null?null:round(confirmedRsi),rsi14Provisional:provisionalRsi===null?null:round(provisionalRsi),signal:confirmed,provisionalSignal:provisional,next:{level:next+1,rsiThreshold:rules.rsi[next],gapThreshold:nextGap,priceAtCurrentSma:round(target),priceChangePct:round((target/last.close-1)*100)},rules,weeklyRsiConfirmedThrough:completeWeeks.at(-1)?.week||null,weeklyRsiProvisional:isCurrentWeek(last.time),priceIsIntraday:!!data.meta?.regularMarketTime&&last.time/1000>=data.meta.regularMarketTime-86400,history:rows.slice(-240).map(r=>({date:new Date(r.time).toISOString().slice(0,10),close:round(r.close)})),note:'괴리율과 종가는 최신 제공 데이터 기준이며, 주봉 RSI는 완료된 주봉만 사용. 데이터 제공사 지연 가능.'};
}
async function yahoo(symbol){let errors=[];for(const host of ['query1.finance.yahoo.com','query2.finance.yahoo.com']){
 const url=`https://${host}/v8/finance/chart/${symbol}?range=3y&interval=1d&includePrePost=false`;
 try{const res=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 ETF-Signal-Dashboard/1.0','Accept':'application/json'},signal:AbortSignal.timeout(9000)});if(!res.ok)throw Error(`HTTP ${res.status}`);return await res.json()}catch(e){errors.push(`${host}: ${e.message}`)}
 }throw Error('시세 제공처 접속 실패: '+errors.join(' / '));}
async function main(){
 const results=await Promise.all(['QLD','TQQQ'].map(async symbol=>{
  try {return {ok:true,data:calc(symbol,await yahoo(symbol))}}
  catch(e){return {ok:false,symbol,error:e.message}}
 }));
 const file=path.join(__dirname,'../docs/data/signals.json');
 const success=results.filter(x=>x.ok).length;
 if(!success)throw Error('두 종목 모두 조회 실패: '+results.map(x=>x.error).join(' / '));
 // On a partial failure, preserve a previously fetched successful ticker but clearly mark it stale.
 let old={};try{old=JSON.parse(await fs.readFile(file,'utf8'))}catch{}
 for(const item of results){if(item.ok)continue;
  const prior=old.results?.find(x=>x.ok&&x.data?.symbol===item.symbol);
  if(prior){item.stale=true;item.previousData=prior.data;}
 }
 const out={serverTime:new Date().toISOString(),results};
 await fs.writeFile(file,JSON.stringify(out,null,2)+'\n');
 console.log('수집 완료:',results.map(x=>x.symbol||x.data.symbol).join(', '),success+'/2');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={calc,score,rsiWilder};
