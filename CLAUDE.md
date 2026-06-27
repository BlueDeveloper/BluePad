## 필수 참조 전략 (부서 정본 — 작업 전 숙지)

> 이 프로젝트는 [전문가세션 조직](C:\BLUE\Project\blue\전문가세션\CLAUDE.md)의 개발자 세션이다. 아래 부서 정본을 **무조건 참조**하여 작업하고, 공통에서 벗어난 결정은 `docs\차별점\차별점-<날짜>.md`에 부서 태그로 기록한다.
>
> **명령어 "보고서 작성"** → 이번 세션에서 공통 정본을 벗어난 결정·전략을 오늘 날짜로 `docs\차별점\차별점-<YYYY-MM-DD>.md`에 양식(`docs\차별점\차별점-템플릿.md`)대로 기록해 책임자 세션에 보고한다.

- 기획: [`전문가세션\기획\전략\기획-전략-정본.md`](C:\BLUE\Project\blue\전문가세션\기획\전략\기획-전략-정본.md)
- 디자인(UI/UX): [`전문가세션\디자인\전략\디자인-전략-정본.md`](C:\BLUE\Project\blue\전문가세션\디자인\전략\디자인-전략-정본.md)
- 마케팅·SEO: [`전문가세션\마케팅\전략\마케팅-전략-정본.md`](C:\BLUE\Project\blue\전문가세션\마케팅\전략\마케팅-전략-정본.md)
- 데이터분석·측정: [`전문가세션\데이터분석\전략\데이터분석-전략-정본.md`](C:\BLUE\Project\blue\전문가세션\데이터분석\전략\데이터분석-전략-정본.md)
- 인프라·배포: [`전문가세션\인프라\전략\인프라-전략-정본.md`](C:\BLUE\Project\blue\전문가세션\인프라\전략\인프라-전략-정본.md)
- 보안: [`전문가세션\보안\전략\보안-전략-정본.md`](C:\BLUE\Project\blue\전문가세션\보안\전략\보안-전략-정본.md)
- 품질(QA): [`전문가세션\품질\전략\품질-전략-정본.md`](C:\BLUE\Project\blue\전문가세션\품질\전략\품질-전략-정본.md)

---

# BluePad — 프로젝트 컨텍스트 가이드

> **최종 업데이트**: 2026-05-25
> **글로벌 인프라 참조**: [INFRASTRUCTURE_GLOBAL_REFERENCE.md](C:\Users\bluee\.claude\INFRASTRUCTURE_GLOBAL_REFERENCE.md)

---

## ⚡ 세션 시작 즉시 실행 (자동 트리거 — 사용자 지시 불필요)

세션이 `C:\BLUE\Project\blue\SAAS\BluePad` 경로에서 시작되면 다음 cron을 점검·등록한다. **`CronList`로 이미 등록된 id를 먼저 확인하고 없는 것만 신규 등록**. 한 줄 리포트 자동 출력은 하지 않는다(2026-05-21 사용자 명시 비활성화).

### 1. 3시간 주기(정각) 신규 블로그 글 자동 푸시 + work-log 검토·개선

```
cron: "0 */3 * * *"   # Memoria와 동일하게 정각 (2026-06-27 변경, 기존 41분 → 정각)
recurring: true
prompt: 트리거 메모리 [[blog-autopush-cron]] (`feedback_blog_autopush_cron.md`) 의 prompt 본문 그대로
```

- **(A) 블로그 자동 배포**: `landing/{en,ko,ja}/blog/`·`landing/blog/`·`landing/sitemap.xml`의 신규/변경(완결된 `</html>`)만 한글 커밋 후 `git push`(Pages 자동 배포). 앱코드·worker·docs는 건드리지 않음.
- **(B) work-log 검토·개선** (2026-06-27 추가): `docs/work-log/` 문서(특히 코워크/타 세션 작성 최신본)를 읽어 미해결 이슈·개선 제안을 파악 → 명확·안전하면 자동 처리(앱·worker는 deploy.sh/wrangler, 랜딩은 git push), 판단 필요/파괴적(DB삭제·결제·라이선스·대규모)은 보고만.
- tsc 사전검증은 BluePad 랜딩이 정적 HTML이라 해당 없음(Memoria는 `npx tsc --noEmit` 수행 — 구조 차이).

> ⛔ **운영 모니터링(`7 9 */5 * *`)·SEO 메일 점검(`23 */5 * * *`) cron은 자동 등록하지 않는다** (2026-06-27 사용자 지시). 필요 시 사용자가 "cron 등록해" 등으로 명시 요청할 때만 등록한다. 출력 형식 메모리([[feedback_session_monitoring]], [[seo-cron]])는 수동 호출용으로 보존.

> ⚠ **session-only 한계**: `durable: true` 명시해도 디스크 미저장 → 본 세션 종료 시 cron 사라짐 → 다음 세션 시작 시 자동 재등록 필요. 본 트리거가 영구 자동화의 핵심.
> ⚠ 7일 후 자동 만료. 매 세션 점검 시 만료 직전이면 새로 등록.

---

## 📒 작업 로그 (세션 시작 시 최신본 필독)

- 위치: [`docs/work-log/YYYY-MM-DD.md`](docs/work-log/) — 작업 내역 + 미해결 이슈
- **작업 시작 시 최신 work-log를 읽어 미해결 이슈를 먼저 파악**한 뒤 작업한다. (규칙: 글로벌 메모리 [[작업 로그 및 이슈 기록 규칙]])
- 최신: `docs/work-log/2026-06-06.md` (v1.14.9~1.15.2 배포 + 미해결 이슈 목록)

---

## 1. 프로젝트 개요

- **제품명**: BluePad
- **카테고리**: 상용 마크다운 에디터 (Typora 대안)
- **기술 스택**: Tauri v2 (Rust + WebView) + React + TypeScript + Vite + Milkdown (ProseMirror)
- **타겟 플랫폼**: Windows (MSI 설치파일)
- **수익 모델**: Freemium (Free + Pro 라이선스, 14일 트라이얼)
- **브랜드**: BRP (BlueRedPolarity) / 비알피
- **도메인**: bluepad.work

---

## 2. 인프라 & 배포

### Cloudflare Workers (3개)
| Worker | URL | 용도 |
|--------|-----|------|
| bluepad-license-api | https://bluepad-license-api.blueehdwp.workers.dev | 라이선스 검증/생성/비활성화 |
| bluepad-download | https://bluepad-download.blueehdwp.workers.dev | MSI 파일 서빙 + 다운로드 카운트 |
| bluepad-checkout | https://bluepad.work/buy (route, /buy*만) | Paddle 결제 → 라이선스 키 발급 |

### Cloudflare 리소스
| 리소스 | ID/이름 |
|--------|---------|
| D1 Database | `6e9776a9-f68a-45b9-b3f7-00cbd6bda70c` (bluepad-licenses) |
| R2 Bucket | bluepad-downloads |
| Pages (랜딩) | bluepad.work에 연결 |
| Zone ID | `027e709c72befdd4cd39c8ede1a9df8a` |

### 환경변수/시크릿 (Workers)
- `ADMIN_SECRET` — 관리자 API 인증용
- `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET` — PayPal Live API 키
- ~~`DOWNLOAD_KEY`~~ — 다운로드 잠금 해제 완료 (2026-05-08 제거됨)

### 분석/SEO
- Microsoft Clarity ID: `wkokfmayny`
- **Google Analytics 4 측정 ID: `G-3PRY6YKV05`** (속성 `bluepad.work`, 웹 스트림 `15125433851`, 계정 BRP_archive, 시간대 KST·통화 USD — 2026-06-21 도입, 전 랜딩 페이지 `<head>` 삽입, admin 제외). GA4 API는 서비스계정 불가 → 본인 Gmail OAuth Desktop+ADC만 가능. 상세: 글로벌 메모리 [[ga4-clarity-api]]
- Naver 인증 메타: `9b479417f022befdffd0b837c015469b604758d3`
- Google Search Console: **도메인 속성**(`sc-domain:bluepad.work`)으로 등록
- sitemap: https://bluepad.work/sitemap.xml (42개 URL — 2026-05-21 root `/` 제거)
- **SC API 자동 조회**: 본인 ADC(`secrets/login-google.ps1` 재인증 1회 + `webmasters.readonly` scope 포함)로 색인 상태·검색 쿼리·sitemap 상태 호출 가능. 상세 사용법은 글로벌 메모리 [[reference_ga4_clarity_setup]] (`Search Console API 빠른 시작` 섹션). BluePad siteUrl 인코딩: `sc-domain%3Abluepad.work` (도메인 속성)

---

## 3. 앱 아키텍처

### 주요 컴포넌트
```
src/
├── App.tsx              — 메인 상태 관리, 다이얼로그 제어
├── hooks/
│   ├── useFileManager.ts — 멀티탭 관리 (ref 기반 stale closure 방지)
│   ├── useLicense.ts     — 라이선스 + 14일 트라이얼 시스템
│   └── useUpdater.ts     — 자동 업데이트 체크/다운로드/설치
├── components/
│   ├── TabBar.tsx        — 드래그앤드롭 탭 리오더
│   ├── MenuBar.tsx       — 전체 메뉴 (i18n, Pro 게이팅, 업데이트 확인)
│   ├── StatusBar.tsx     — Free/Pro 뱃지, 트라이얼 카운트다운
│   ├── LicenseDialog.tsx — 라이선스 입력/활성화
│   ├── UpdateDialog.tsx  — 업데이트 확인/다운로드/설치 다이얼로그
│   ├── AboutDialog.tsx   — 앱 정보 + OSS 목록 (동적 버전 표시)
│   ├── ProGate.tsx       — Pro 업그레이드 프롬프트
│   ├── InputDialog.tsx   — 커스텀 input (prompt 대체)
│   └── AlertDialog.tsx   — 커스텀 alert 대체
├── i18n/
│   ├── ko.ts, en.ts, ja.ts — ~140개 번역 키
│   └── index.ts          — React Context 기반 i18n
└── styles/global.css     — 전체 스타일 (다크 테마 4종)
```

### Tauri (Rust) 커맨드
- `get_cli_file_path` — CLI에서 파일 경로 전달
- `get_hostname` — 디바이스 ID 생성용 호스트명

### 라이선스 시스템 상세
- **디바이스 ID**: SHA-256(hostname + random seed), `bp-h-` 프리픽스, localStorage 캐시
- **서버 검증**: Worker API로 activate/validate/deactivate
- **오프라인 유예**: 30일 grace period (마지막 검증 타임스탬프 기반)
- **트라이얼**: 14일, localStorage `bluepad_trial_start` 기반
- **키 형식**: `BP-XXXX-XXXX-XXXX-XXXX` (Worker에서 crypto.getRandomValues로 생성)

### Pro vs Free 기능 구분
| 기능 | Free | Pro |
|------|------|-----|
| 기본 편집 | O | O |
| 자동 저장 | O | O |
| Mermaid/KaTeX | O | O |
| 탭 수 | 3개 | 무제한 |
| 테마 | 1개 | 4개 |
| 집중 모드 | X | O |
| HTML/PDF 내보내기 | X | O |

---

## 4. 랜딩 & SEO

### 구조
```
landing/
├── index.html           — 언어 자동 감지 리다이렉트
├── ko/index.html        — 한국어 랜딩 (Pretendard, 다크 테마)
├── en/index.html        — 영어 랜딩 (Inter)
├── ja/index.html        — 일본어 랜딩 (Inter)
├── blog/                — 6개 기사 × 3언어 + index (21페이지)
├── legal/
│   ├── privacy.html     — 개인정보처리방침
│   ├── eula.html        — 최종사용자 라이선스 계약
│   └── opensource.html  — OSS 고지
├── admin/index.html     — 관리자 대시보드 (비밀번호 인증)
└── sitemap.xml          — 35개 URL
```

### 디자인
- Linear.app / Raycast.com 영감
- 다크 배경(#09090b) + 모노크롬 + 블루 액센트(#155dfc)
- 한국어: Pretendard / 영문·일문: Inter

---

## 5. 결제 & 법적 사항 ⚠️ 중요

### 결제 시스템
- **결제 수단**: PayPal (Direct / REST API, Live 환경)
- **사유**: Stripe는 한국 간이과세자 미지원
- **흐름**: 랜딩 "Pro 구매" → checkout Worker → PayPal 승인 → 결제 캡처 → 라이선스 키 자동 발급 → 성공 페이지에 키 표시
- **가격**: $10.99 USD (checkout Worker `PRODUCT_PRICE` 변수)
- **PayPal 결제**: 계좌 완전 인증 없이도 결제 수신 가능 (PayPal 정책상 제한 금액 이하)

### 환불 정책 (반드시 준수)
- **전자상거래법 기준**: 디지털 콘텐츠는 청약철회 예외 가능하나, **구매 전 명시적 고지 + 동의** 필요
- **권장**: EULA/구매 페이지에 "디지털 상품 특성상 활성화 후 환불 불가" 명시
- **PayPal 분쟁**: PayPal은 자체 구매자 보호 정책으로 강제 환불(chargeback) 가능 — 이 경우 라이선스 비활성화 처리 필요
- **환불 프로세스**: 관리자 대시보드에서 라이선스 비활성화 → PayPal 대시보드에서 수동 환불

### 법적 준수 사항
| 항목 | 상태 | 비고 |
|------|------|------|
| 사업자등록 | 완료 | 511-32-01572 (간이과세자) |
| 통신판매업 신고 | 완료 | 2026-05-04 신고 완료 |
| 개인정보처리방침 | 완료 | /legal/privacy.html |
| EULA | 완료 | /legal/eula.html |
| OSS 고지 | 완료 | /legal/opensource.html (9개 라이브러리) |
| 전자상거래법 표시의무 | 부분 완료 | 사업자정보 랜딩 footer에 표시 |

### 전자상거래법 필수 표시 사항
온라인 판매 시 다음 정보를 구매 페이지에 반드시 표시:
1. 상호 및 대표자명: 비알피(BlueRedPolarity) / 윤동제
2. 사업자등록번호: 511-32-01572
3. 통신판매업 신고번호: (신고 완료, 승인 후 기재)
4. 주소, 전화번호, 이메일
5. 청약철회/환불 조건
6. 재화의 내용, 가격, 배송(해당없음)

### 세금 처리
- 간이과세자: 연매출 8,000만원 미만 시 부가세 간이신고
- PayPal 수입: 외화 입금 → 원화 환전 시 환율 적용
- 매출 신고: 종합소득세 신고 시 PayPal 매출 포함

---

## 6. 설치파일 & 코드 서명

### MSI 빌드
- WiX 기반 (Tauri 내장)
- 커스텀 이미지: `src-tauri/wix-banner.bmp`, `src-tauri/wix-dialog.bmp`
- 산출물: `src-tauri/target/release/bundle/msi/BluePad_*.msi` + `.msi.sig`
- R2 업로드: `wrangler r2 object put bluepad-downloads/BluePad-latest.msi --file=<path>`

```bash
# 프로덕션 빌드 — deploy.sh 사용 권장
./scripts/deploy.sh <version> "<release notes>"

# 수동 빌드 시 (~/.bluepad-deploy-env에서 환경변수 로드)
source ~/.bluepad-deploy-env
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/bluepad.key)" TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$SIGNING_KEY_PASSWORD" npm run tauri build -- --bundles msi
```

- **서명 키 위치**: `~/.tauri/bluepad.key` (private), `.key.pub` (public)
- **배포 환경변수**: `~/.bluepad-deploy-env` (CF 토큰, 서명 비밀번호 — 레포 외부)
- **주의**: `--bundles msi` 플래그 필수 (없으면 incremental 빌드 시 .sig 생략됨)

### 자동 업데이트 시스템
- **Tauri v2 updater plugin** 사용 (Tauri 자체 서명 — Windows Authenticode와 별개)
- **엔드포인트**: `https://bluepad-download.blueehdwp.workers.dev/update.json`
- **흐름**: 앱 설정 > 업데이트 확인 → Worker에서 update.json 조회 → R2에서 MSI 다운로드 → 설치 → 재시작
- **업데이트 후 알림**: localStorage 버전 비교로 "What's New" 다이얼로그 표시
- **버전 주입**: `vite.config.ts`에서 `tauri.conf.json`의 version을 `__APP_VERSION__`으로 주입
- **update.json 형식**:
  ```json
  {
    "version": "1.x.x",
    "notes": "릴리스 노트",
    "pub_date": "2026-05-04T00:00:00Z",
    "platforms": {
      "windows-x86_64": {
        "signature": "<.sig 파일 내용>",
        "url": "https://bluepad-download.blueehdwp.workers.dev/update/download/"
      }
    }
  }
  ```

### Windows 코드 서명 (Authenticode)
- **현재 결정**: 코드 서명 없이 운영 (Typora도 초기 수년간 미서명 운영)
- **SmartScreen 대응**: 랜딩 페이지에 설치 안내 텍스트로 대응
- **향후 옵션 (선택)**: Sectigo OV, Microsoft Store, Azure Trusted Signing

### 다운로드
- **현재 상태**: 잠금 해제 완료 — `/download/<filename>` 퍼블릭 접근 가능
- **현재 버전**: `1.8.0` (2026-05-07 릴리즈)
- **다운로드 수**: 43건 (2026-05-08 기준)

---

## 7. 관리자 기능

### 관리자 대시보드 (bluepad.work/admin/)
- 비밀번호 로그인 (ADMIN_SECRET)
- 다운로드 건수 + 내역 (개별 기록, 국가, IP)
- 라이선스 목록 조회 (이메일, 키, 디바이스, 상태)
- 라이선스 비활성화 (환불 시)
- 체험 사용자 목록 + 트라이얼 일수 조정
- 결제 내역 + 환불 처리
- 에러 로그 (KST 시간 표시)
- 문의 티켓 + 이메일 답변

### API 엔드포인트 (bluepad-license-api)
```
POST /api/validate            — 라이선스 검증 (앱에서 호출)
POST /api/deactivate          — 라이선스 비활성화 (앱에서 호출)
POST /api/trial               — 트라이얼 등록/조회 (앱에서 호출)
POST /api/support             — 문의 티켓 제출
POST /api/admin/generate      — 라이선스 수동 생성
POST /api/admin/deactivate    — 관리자 라이선스 비활성화
GET  /api/admin/licenses      — 전체 라이선스 목록
GET  /api/admin/trials        — 체험 사용자 목록
GET  /api/admin/payments      — 결제 내역
POST /api/admin/refund        — 환불 처리 (라이선스 비활성화)
GET  /api/admin/errors        — 에러 로그 (실제 worker 에러)
GET  /api/admin/webhook-events — Paddle webhook 이벤트 audit (?severity=info|warn|critical&type=&limit=)
GET  /api/admin/downloads     — 다운로드 내역
POST /api/admin/trial/adjust  — 트라이얼 일수 조정
POST /api/admin/reply         — 티켓 이메일 답변
```

---

## 8. 현황 & 대기 항목 (2026-05-08 기준)

### 현재 운영 상태
| 항목 | 상태 |
|------|------|
| 다운로드 | ✅ 공개 (잠금 해제 완료) |
| 결제 (PayPal) | ✅ 작동 (계좌 완전 인증 전에도 수신 가능) |
| 코드 서명 | ⚠️ 없음 (SmartScreen 경고 — 운영 방침으로 수용) |
| 통신판매업 신고 | ⏳ 신고 완료, 승인 대기 |
| 총 다운로드 | 43건 |
| 총 결제 | 0건 |

### 외부 대기
| 항목 | 상태 | 비고 |
|------|------|------|
| 통신판매업 신고 승인 | 대기 중 | 2026-05-04 신고 완료 |

### 선택적 개선 (할 일)
- 블로그 추가 작성 (SEO 강화)
- 앱 기능 추가 (TODO.md 참조)
- Google Ads / 마케팅 캠페인
- 통신판매업 신고번호 발급 후 랜딩 footer에 추가

---

## 9. 빌드 & 개발

```bash
# 개발 서버
npm run dev

# Tauri 개발 (앱 실행)
npm run tauri dev

# 프로덕션 배포 (버전업 + 빌드 + R2 업로드 + 커밋 자동화)
./scripts/deploy.sh <version> "<release notes>"

# R2 업로드
wrangler r2 object put bluepad-downloads/BluePad-latest.msi --file=src-tauri/target/release/bundle/msi/BluePad_1.0.0_x64_en-US.msi

# Worker 배포 (각 Worker 디렉토리에서)
wrangler deploy
```

### 배포 원칙 (필수)
- **MSI 배포 시 반드시 버전을 올린다** (1.0.0 → 1.1.0 등)
- 동일 버전으로 R2에 덮어쓰면 기존 사용자가 업데이트를 받을 수 없음
- 버전은 `src-tauri/tauri.conf.json`의 `version` 필드에서 관리 (package.json과 동기화)
- **deploy.sh 하나로 전체 배포 자동화** — 수동 단계 없음

### 버전 업데이트 배포 절차 (deploy.sh 자동화)
`./scripts/deploy.sh <version> "<release notes>"` 실행 시:
1. 버전 변경 (tauri.conf.json + package.json)
2. MSI 빌드 (서명 포함)
3. R2 업로드 (MSI + update.json)
4. 랜딩 다운로드 URL 치환 (34개 파일)
5. 릴리즈 노트 자동 추가 (/changelog/ 페이지)
6. git 커밋 & 푸시
7. 다운로드/update.json 검증
8. IndexNow 제출 (Bing/Naver/Yandex 색인)
9. GitHub Release 생성

---

## 10. 주의사항 & 트러블슈팅

- **HTML 내보내기**: URL.createObjectURL + a.click()은 Tauri WebView 크래시 유발 → Tauri native save dialog 사용
- **prompt()/alert()**: "tauri.localhost" 표시됨 → 커스텀 InputDialog/AlertDialog 사용
- **탭 상태 관리**: useFileManager에서 ref 패턴 필수 (stale closure 방지)
- **빌드 전**: 기존 BluePad.exe 프로세스 종료 필요 (OS error 5)
- **Worker 배포**: 반드시 wrangler CLI 사용 (MCP 도구는 다른 계정으로 배포될 수 있음)
- **D1 테이블**: `wrangler d1 execute --remote` 로 생성해야 함 (MCP는 로컬에만 생성)

---

## 11. 할루시네이션 방지 작업 원칙

### 법률/규정 관련
- **법조항 인용 금지**: 구체적 조항번호(예: "시행령 제29조 제2항")는 반드시 웹 검색으로 확인 후 인용
- **법적 의무/면제 판단**: "업계 표준", "일반적으로" 등 모호한 표현 사용 금지 → 검증된 출처 기반으로만 답변
- **불확실하면 "확실하지 않다"고 먼저 고지** → 검색 후 답변

### 외부 서비스/제품 관련
- **타사 제품 정보**: Typora, Notion 등 타 제품의 소스 공개 여부, 라이선스 모델 등은 추측 금지 → 검색 확인
- **가격/요금**: 코드 서명 인증서 가격 등 시시각각 변하는 정보는 반드시 최신 검색
- **자격 요건**: SignPath, Certum 등 서비스 이용 자격(OSS 전용 여부 등)은 공식 문서 확인 필수

### 기술 관련
- **라이브러리 API**: Milkdown, Tauri 등 플러그인/API 사용법은 공식 문서 또는 context7 조회 후 답변
- **빌드/배포 명령어**: 실제 실행해본 적 없는 옵션/플래그는 문서 확인 후 제안
- **에러 원인 추측**: "아마 ~일 것이다" 식의 추측보다 실제 로그/코드 확인 우선

### 작업 프로세스
1. 사실 여부가 불확실한 정보 → **먼저 "확인 필요" 고지**
2. WebSearch 또는 context7로 검증
3. 출처와 함께 답변 제공
4. 검증 불가능한 경우 → "확인하지 못했다"고 명시
