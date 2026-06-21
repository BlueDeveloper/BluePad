# BluePad 마케팅 / SEO 이관 문서 (코워크 인계용)

> **작성**: 2026-06-21 · **대상**: 마케팅/SEO를 이어받을 코워크 세션
> **범위**: BluePad(bluepad.work) 중심. 표준 레퍼런스로 **Archive(bdarchive.site)** = GEO/블로그/GA4 운영 표준, **Memoria** = i18n-ready 표준을 인용.
> **인계 사유**: GA4 도입 및 이후 마케팅/SEO 실행을 코워크가 담당. 이 문서 하나로 현황·계정·반복작업·백로그를 모두 파악 가능하게 작성.

---

## 0. TL;DR — 지금 바로 할 일

| 우선 | 작업 | 비고 |
|---|---|---|
| 🔴 1 | **GA4 도입** (측정 ID 발급 → 3개 언어+블로그 삽입 → 배포) | 아래 §4. 현재 BluePad는 Clarity만 있고 GA4 없음 |
| 🟡 2 | 블로그 콘텐츠 확충 (Archive는 21+편, BluePad는 7주제) | 아래 §6 백로그 |
| 🟢 3 | 주간 분석 자동화 이관 (Archive `weekly_report.py` 패턴) | GA4 도입 이후 |

---

## 1. 제품·도메인 한 줄 정의

- **제품**: BluePad — Tauri(Rust) 기반 경량 마크다운 에디터. **Typora 대안**, Windows/Linux, **일회성 결제 Pro($10.99, 구독 아님)** + 14일 체험.
- **도메인**: https://bluepad.work (Cloudflare Pages, 랜딩 정적 HTML)
- **타겟 키워드 축**: `마크다운 에디터`, `Typora 무료 대안`, `WYSIWYG markdown`, `focus mode writing`, `lightweight note app`
- **언어**: ko / en / ja (3개, hreflang 완비 — Archive보다 앞섬)

---

## 2. 현재 상태 스냅샷 (2026-06-21 기준)

### ✅ 갖춰진 것
| 항목 | 값 / 위치 |
|---|---|
| Microsoft Clarity | ID `wkokfmayny` (모든 페이지 `<head>`) |
| Naver 사이트 인증 | `9b479417f022befdffd0b837c015469b604758d3` |
| Google Search Console | **도메인 속성** `sc-domain:bluepad.work` |
| sitemap | `landing/sitemap.xml` (**정적 파일, 45 URL**, deploy.sh가 갱신) |
| robots.txt | `landing/robots.txt` — **AI봇(GPTBot·ClaudeBot·PerplexityBot·Google-Extended 등) 명시 허용** (2026-06-21 추가) |
| llms.txt | `landing/llms.txt` — **AI 검색(GEO) 인덱스** (2026-06-21 신규) |
| 구조화 데이터 | 메인: `SoftwareApplication` + **`FAQPage`**(2026-06-21 추가, 보이는 FAQ 섹션 동반) / 블로그: `BlogPosting` |
| 블로그 | 7주제 × 3언어 = **21편** (`landing/{en,ko,ja}/blog/`) |
| IndexNow | 키 `52cbe3af562eb1c50d5dfb86fc922388` (`landing/<키>.txt`), **deploy.sh 8/8단계가 자동 제출** — Archive엔 없는 강점 |
| 배포 | landing 변경은 **git push → Cloudflare Pages 자동 빌드**. 앱 릴리스는 `scripts/deploy.sh` |

### ⏳ 비어 있는 것 (= 인계 후 채울 것)
- **GA4 미설치** (유입·전환·검색어 측정 불가 — 현재 Clarity는 히트맵/세션리플레이만)
- 블로그 발행 동력 정체 (Archive 대비 양 부족)
- BreadcrumbList 구조화 데이터 없음
- 주간 분석 자동 리포트 없음 (Archive엔 있음)

> ⚠️ **사이트맵 방식 차이 주의**: Archive는 `next-sitemap` 자동 생성이지만, **BluePad는 정적 `sitemap.xml`을 손/`deploy.sh`로 관리**한다. 블로그 글을 추가하면 **sitemap.xml에 `<url>` 수동 추가**가 필요하다(자동 아님).

---

## 3. 계정·접근·자동화 (인수인계 핵심)

| 자원 | 값 / 접근법 |
|---|---|
| Cloudflare 계정 | **blueehdwp@gmail.com 고정** (전역 규칙). 토큰/계정ID는 글로벌 `CLAUDE.md` 참조 |
| Cloudflare Zone ID | `027e709c72befdd4cd39c8ede1a9df8a` |
| D1 (운영 데이터) | `bluepad-licenses` (`6e9776a9-f68a-45b9-b3f7-00cbd6bda70c`) — 다운로드/트라이얼/결제 |
| Search Console API | 본인 ADC(`gcloud auth application-default`)로 호출. scope에 `webmasters.readonly` 포함. 인코딩 siteUrl: `sc-domain:bluepad.work` |
| GA4 / Clarity API | 셋업 가이드 글로벌 메모리 [[ga4-clarity-api]] (`reference_ga4_clarity_setup.md`). **GA4는 본인 Gmail OAuth Desktop Client + ADC**로만 호출 가능(서비스계정 거부됨) |
| IndexNow | 키 위 §2. `api.indexnow.org/indexnow` POST |

### 반복 운영 자동화 (cron — 세션 시작 시 재등록 필요, session-only)
1. **SEO 메일 점검** `23 */5 * * *` (5h) — Gmail의 `from:sc-noreply@google.com` → SC API 진단 → landing 자동 패치 → git push → IndexNow. 규칙: 메모리 [[seo-cron]] (`feedback_seo_mail_check.md`)에 prompt 본문 전체 보관.
2. **5일 주기 운영 모니터링** `7 9 */5 * *` — D1 결제/라이선스/트라이얼/다운로드. 출력형식: 메모리 [[모니터링 출력 형식]] (`feedback_session_monitoring.md`).

> ⚠️ **다운로드 수치 오판 금지**: US 데이터센터·IP당 1회·OS불일치 UA·트라이얼 0 패턴은 **봇 스캐너**다. 실유입으로 보고하지 말 것. 상세: [[download-scanner-signature]].

---

## 4. 진행 중 작업 — GA4 도입 (코워크 담당)

BluePad는 GA4가 없다. Archive(`G-9R933EXKXN`, `components/Analytics.tsx`)와 동일 수준으로 맞춘다.

**단계:**
1. analytics.google.com에서 **bluepad.work용 GA4 속성 생성** → **측정 ID `G-XXXXXXXXXX`** 확보. (계정: blueehdwp@gmail.com 권장 — SC/Clarity와 동일 소유)
2. gtag 스니펫을 **Clarity 스니펫 바로 옆 `<head>`** 에 삽입. 삽입 대상:
   - `landing/ko/index.html`, `landing/en/index.html`, `landing/ja/index.html`
   - 블로그 21편(`landing/{en,ko,ja}/blog/*.html`) + 블로그 인덱스 3개
   - `download/`, `changelog/`, `support/`, `help/`, `feedback/`, `legal/*` (전 페이지 일관 삽입 권장)
   - ⚠️ `admin/` 은 **제외** (관리자 페이지 — Archive도 `/dashboard` 제외 원칙)
3. (정적 HTML이라 컴포넌트화 불가 → sed 일괄 치환 권장) 예:
   ```bash
   # <head> 내 Clarity 스니펫 앞에 gtag 삽입 — 패턴 확인 후 실행
   grep -rl 'clarity.ms/tag' landing --include=*.html
   ```
4. 배포: `git add landing && git commit && git push` → Pages 자동 빌드.
5. 검증: 라이브에서 `curl -s https://bluepad.work/ko/ | grep gtag`, GA4 실시간 보고서에 자기 방문 잡히는지 확인.
6. **측정 ID는 메모리 [[ga4-clarity-api]] 또는 BluePad `CLAUDE.md` §2에 기록**(Clarity ID 옆).

> GA4 도입 후에야 §2의 "봇 스파이크 vs 실유입"을 referrer/source 데이터로 끊을 수 있다 — 도입의 1차 효용.

---

## 5. 따라야 할 표준 레퍼런스

### A. Archive (bdarchive.site) = GEO·블로그·측정 표준
- **llms.txt 포맷**: 제목 → 1~2문장 요약 → 핵심 페이지 → 대표 블로그 3~5 → 연락처. (BluePad llms.txt는 이미 이 포맷)
- **robots.txt AI봇 허용**: GPTBot/OAI-SearchBot/ChatGPT-User/ClaudeBot/Claude-Web/PerplexityBot/Google-Extended. (BluePad 적용 완료)
- **블로그 키워드 전략**: H1=검색 질문형, H2/H3=세부 질문, 본문=표·리스트(AI 추출 용이). 카테고리로 롱테일 커버.
- **주간 분석 자동화**: `scripts/analytics/weekly_report.py` (+ `run_weekly_report.ps1`, Task Scheduler 월요일). Cloudflare+GA4+Clarity 통합 → `docs/분석/YYYY-Www.md`, Claude로 인사이트 생성. **BluePad 이식 후보**(GA4 도입 후).
- **운영 문서 구조**: `docs/검색최적화/`, `docs/작업지시-GEO-*`, `docs/분석/`. 참고만.

### B. Memoria = i18n-ready / 글로벌 안전 표준
- 글로벌 표준 문서: `C:\Users\bluee\.claude\I18N_READY_STANDARD.md` (시간대/locale/country/currency, Intl 포맷, Paddle MoR 결제).
- BluePad는 ko/en/ja hreflang은 이미 충족. **결제는 PayPal(한국↔한국 이슈로 Paddle 병행 — 메모리 [[project_paddle_setup]])** 상태이므로, 마케팅 카피의 통화/가격 표기는 Memoria 표준(USD 명시, 구독 아님 강조)을 따른다.

---

## 6. 보완 백로그 (이번 세션 분석에서 도출)

| 우선 | 항목 | 근거 |
|---|---|---|
| 🔴 | GA4 도입 | §4. 유일한 측정 공백 |
| 🟡 | 블로그 확충: Typora 비교 심화, "Tauri vs Electron 에디터", "마크다운 PDF 변환", 일/영 롱테일 | Archive 21+편 대비 빈약 |
| 🟡 | 신규 블로그 추가 시 **sitemap.xml `<url>` 수동 추가** 누락 방지 체크리스트화 | 정적 sitemap 한계 |
| 🟢 | BreadcrumbList 구조화 데이터(블로그/다운로드) | 리치결과 보강 |
| 🟢 | 주간 분석 리포트 자동화 이식 | Archive 표준 |
| 🟢 | OG 이미지 언어별 분리 검토(현재 공용 og-image.png) | 공유 CTR |

---

## 7. 함정 / 주의 (할루시네이션 방지)

- **검증 후 단정**: 이번 세션에서 서브에이전트가 "한글 블로그 1편 누락"이라 보고했으나 **실제 파일은 존재**했다(오판). 파일 주장은 반드시 `ls`/읽기로 확인 후 보고.
- **FAQ 구조화 데이터는 보이는 콘텐츠 동반 필수**: FAQPage JSON-LD만 넣으면 Google 가이드라인 위반. BluePad는 보이는 FAQ 섹션 + schema를 함께 넣었다(§2). 새 schema 추가 시 동일 원칙.
- **랜딩 배포 = git push**(Pages). `wrangler pages deploy` 안 씀. 앱 MSI만 `deploy.sh`.
- **Cloudflare는 blueehdwp 계정 고정**. 다른 계정/ MCP 도구로 배포 금지(전역 규칙).
- **sitemap은 정적**: 자동 생성 아님. 블로그/페이지 추가 시 손으로 `<url>` 추가.

---

## 관련 메모리 (글로벌 자동 로드)
- [[ga4-clarity-api]] — GA4/Clarity/Search Console API 셋업 (측정 ID 종류 혼동 주의 포함)
- [[seo-cron]] — 5h SEO 메일 점검 cron 본문
- [[모니터링 출력 형식]] — 운영 모니터링 출력 규칙
- [[download-scanner-signature]] — 봇 다운로드 스파이크 식별
- [[project_paddle_setup]] — 결제(PayPal+Paddle) 구성
