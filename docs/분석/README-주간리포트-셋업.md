# BluePad 주간 분석 리포트 — 셋업 가이드

> 작성 2026-06-22 · Archive `weekly_report.py` 이식판
> 스크립트: `scripts/analytics/weekly_report.py` · 러너: `scripts/analytics/run_weekly_report.ps1`
> 출력: `docs/분석/YYYY-Www.md` (매주 월요일 자동 생성)

## 무엇을 하나
매주 지난 한 주(월~일)의 데이터를 모아 마크다운 리포트를 만든다.
- **Cloudflare**: PV/UV/요청/위협 차단 (일별 + 4주 추세)
- **GA4(G-3PRY6YKV05)**: 인기 페이지, 유입 채널, **전환 이벤트(file_download·purchase)**
- **Search Console**: 상위 검색어(클릭·노출·CTR·평균순위)
- **Clarity**: (토큰 있으면) 최근 3일 UX
- **LLM 인사이트**: Claude가 "이번 주 한 줄 + 인사이트 3~5 + 다음 주 액션"을 자동 작성

## 일회성 셋업 (사용자 PC, 1회만)

대부분 Archive 주간리포트와 **자격증명을 공유**한다. Archive 리포트가 이미 돌고 있으면 1·2·4는 끝나 있을 가능성이 높다.

1. **Python 패키지**
   ```powershell
   pip install google-analytics-data google-auth anthropic
   ```
2. **GA4/GSC 인증 (ADC)** — Archive와 동일 Google 계정(blueehdwp). GA4 속성만 다르고 인증은 공유.
   - 검색어(Search Console)까지 받으려면 ADC scope에 `webmasters.readonly` 포함 필요:
   ```powershell
   gcloud auth application-default login --scopes=openid,https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/webmasters.readonly
   ```
   - (검색어 불필요하면 `--skip-gsc`로 실행, 인증 재발급 생략 가능)
3. **Cloudflare 토큰**: `C:\Users\bluee\.claude\projects\C--BLUE-Project-blue\secrets\cloudflare-token.txt`
   - **이 토큰이 BluePad Zone(`027e709c72befdd4cd39c8ede1a9df8a`)도 읽을 수 있어야 한다.** Archive Zone 전용이면 계정 단위(모든 Zone Analytics:Read) 토큰으로 교체 권장.
4. **Anthropic 키**: 같은 secrets 폴더 `anthropic-key.txt` (Archive와 공유).

## 동작 확인 (셋업 후 1회)
```powershell
cd C:\BLUE\Project\blue\SAAS\BluePad\scripts\analytics
python weekly_report.py --dry-run            # 저장 없이 출력만
python weekly_report.py --week 2026-W25      # 특정 주차 저장
```
- 데이터가 비면 정상(런칭 초기 트래픽 적음). 에러는 `docs\분석\.cron.log` 확인.

## 영구 스케줄 등록 (cron 영속화 — OS Task Scheduler)
세션 cron과 달리 OS 스케줄러는 영구적이다. PowerShell(관리자)에서 **1회 실행**:
```powershell
schtasks /Create /TN "BluePad-WeeklyReport" /SC WEEKLY /D MON /ST 00:05 ^
  /TR "powershell -NoProfile -ExecutionPolicy Bypass -File \"C:\BLUE\Project\blue\SAAS\BluePad\scripts\analytics\run_weekly_report.ps1\"" /F
```
- 매주 월요일 00:05에 지난 주 리포트를 `docs/분석/`에 생성.
- 확인: `schtasks /Query /TN "BluePad-WeeklyReport"` · 즉시 테스트: `schtasks /Run /TN "BluePad-WeeklyReport"`

## 주의
- GA4 API는 서비스계정 불가 → 본인 Gmail OAuth + ADC만. (`run_weekly_report.ps1`이 GOOGLE_APPLICATION_CREDENTIALS 제거로 ADC 강제)
- Clarity 토큰 미발급 상태면 자동 건너뜀(`--skip-clarity` 불필요).
- 코워크(이 도구) 환경에서는 위 자격증명에 접근 불가 → **리포트 생성은 사용자 PC에서 실행**된다.
