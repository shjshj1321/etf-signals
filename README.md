# QLD · TQQQ 매수 신호판 (GitHub Pages 단독)

**별도 서버·Netlify·API 키 없이 GitHub Pages + GitHub Actions로 운영**하는 정적 웹앱입니다.

## 설치 (GitHub 웹사이트에서만 가능)

1. GitHub에서 **New repository** → 이름 예: `etf-signals` → **Public** → **Create repository**.
2. 이 ZIP의 `etf-github-pages` 폴더 **안에 있는 내용 전체** (`docs`, `scripts`, `.github`, `README.md`)를 저장소 최상위에 업로드합니다. **중요:** `.github/workflows/update.yml` 경로가 정확해야 합니다. GitHub 웹 업로드에서 숨김 폴더가 누락되면 폴더 구조를 유지해 업로드하거나 GitHub 웹에서 해당 경로로 파일을 만드세요.
3. 저장소 **Settings → Actions → General → Workflow permissions**에서 **Read and write permissions** 선택 후 Save. 조직 정책에 따라 불가능할 수도 있습니다.
4. 저장소 **Actions → ETF signal data update → Run workflow → Run workflow** 클릭. 작업이 성공하면 `docs/data/signals.json`이 갱신됩니다.
5. 저장소 **Settings → Pages → Build and deployment → Source: Deploy from a branch** 선택, **Branch: main**, **Folder: /docs** 선택 후 Save.
6. 몇 분 뒤 `https://<GitHub사용자명>.github.io/etf-signals/` 접속. 실제 주소는 Settings → Pages에 표시됩니다.

## 갱신 주기와 제한

- GitHub Actions는 **화~토 한국시간 23:30**에 실행을 시도합니다. 미국 증시 마감 이후를 목표로 했으며 **휴장일에도 실행**될 수 있습니다.
- 예약 실행은 지연되거나 누락될 수 있고, GitHub Pages 반영도 지연될 수 있습니다. 급하면 Actions에서 **Run workflow**를 수동 실행하세요.
- Yahoo Finance의 **비공식** 일봉 차트 엔드포인트 사용. 차단/접속 제한 시 갱신 실패할 수 있습니다. 시세는 실시간이 아니며 투자 실행용 호가가 아닙니다.
- **주봉 RSI(14)**: Wilder 방식, 미국 동부 기준 주간 종가. 이번 주가 끝나기 전에는 지난 완료 주의 RSI만 확정치로 사용합니다. 괴리율은 마지막 수집 일봉 기준입니다.
- **200일 이동평균**: 최근 200개 거래일 종가 단순 평균. 괴리율=(최근 종가/200일선-1)*100.
- **매수 신호**: RSI와 괴리율 중 하나라도 단계 기준을 충족하면 해당 단계, 더 높은 단계를 우선 표시.
- 공개 영상의 RSI 기간과 실제 운용 시 추가 조건은 확인되지 않았습니다. 이 앱은 공개 임계값에 **RSI(14)를 가정**한 독립적 재현입니다.
- 원본 데이터는 분할/배당 조정 전 `close` 기준이며, ETF 가격 이력의 분할 처리 방식에 따라 지표가 달라질 수 있습니다. 실제 매매 전에 검증이 필요합니다.

## 파일 구성

- `docs/index.html`, `docs/style.css`, `docs/app.js`: GitHub Pages 화면
- `docs/data/signals.json`: Actions가 갱신하는 시세/지표 JSON
- `scripts/update.js`: Yahoo 일봉 조회 및 신호 계산
- `.github/workflows/update.yml`: 예약/수동 실행

## 문제 해결

- 페이지에 '아직 데이터가 수집되지 않았습니다' → Actions에서 Run workflow 실행.
- Actions에서 `HTTP 429`/`403` → Yahoo에서 GitHub 서버의 요청을 제한할 수 있습니다. 잠시 후 재시도하거나 정식 시세 API로 변경해야 합니다.
- `git push` 권한 오류 → Settings → Actions → General → Workflow permissions 확인. 브랜치 보호 규칙도 확인.
- 웹페이지 404 → Pages에서 `main` + `/docs` 확인하고 배포 완료까지 기다리세요.

이 앱은 정보 확인용이며 매수·매도 권유가 아닙니다.
