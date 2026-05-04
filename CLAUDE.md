# BluePad — 프로젝트 컨텍스트 가이드

> **최종 업데이트**: 2026-05-03
> **글로벌 인프라 참조**: [INFRASTRUCTURE_GLOBAL_REFERENCE.md](C:\Users\bluee\.claude\INFRASTRUCTURE_GLOBAL_REFERENCE.md)

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
| bluepad-checkout | https://bluepad-checkout.blueehdwp.workers.dev | PayPal 결제 → 라이선스 키 발급 |

### Cloudflare 리소스
| 리소스 | ID/이름 |
|--------|---------|
| D1 Database | `6e9776a9-f68a-45b9-b3f7-00cbd6bda70c` (bluepad-licenses) |
| R2 Bucket | bluepad-downloads |
| Pages (랜딩) | bluepad.work에 연결 |
| Zone ID | `027e709c72befdd4cd39c8ede1a9df8a` |

### 환경변수/시크릿 (Workers)
- `ADMIN_SECRET` — 관리자 API 인증용
- `DOWNLOAD_KEY` — 다운로드 잠금 키 (Worker 시크릿)
- `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET` — PayPal Live API 키

### 분석/SEO
- Microsoft Clarity ID: `wkokfmayny`
- Naver 인증 메타: `9b479417f022befdffd0b837c015469b604758d3`
- Google Search Console: URL 접두어 방식으로 등록
- sitemap: https://bluepad.work/sitemap.xml (35개 URL)

---

## 3. 앱 아키텍처

### 주요 컴포넌트
```
src/
├── App.tsx              — 메인 상태 관리, 다이얼로그 제어
├── hooks/
│   ├── useFileManager.ts — 멀티탭 관리 (ref 기반 stale closure 방지)
│   └── useLicense.ts     — 라이선스 + 14일 트라이얼 시스템
├── components/
│   ├── TabBar.tsx        — 드래그앤드롭 탭 리오더
│   ├── MenuBar.tsx       — 전체 메뉴 (i18n, Pro 게이팅)
│   ├── StatusBar.tsx     — Free/Pro 뱃지, 트라이얼 카운트다운
│   ├── LicenseDialog.tsx — 라이선스 입력/활성화
│   ├── AboutDialog.tsx   — 앱 정보 + OSS 목록
│   ├── ProGate.tsx       — Pro 업그레이드 프롬프트
│   ├── InputDialog.tsx   — 커스텀 input (prompt 대체)
│   └── AlertDialog.tsx   — 커스텀 alert 대체
├── i18n/
│   ├── ko.ts, en.ts, ja.ts — ~125개 번역 키
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
- **키 형식**: `BPP-XXXXXXXX-XXXXXXXX-XXXXXXXX` (Worker에서 crypto.getRandomValues로 생성)

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
- **가격**: 미정 (checkout Worker에서 설정)

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
3. 통신판매업 신고번호: (신고 후 기재)
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
- 빌드: `npm run tauri build`
- 산출물: `src-tauri/target/release/bundle/msi/BluePad_*.msi`
- R2 업로드: `wrangler r2 object put bluepad-downloads/BluePad-latest.msi --file=<path>`

### 코드 서명
- **서비스**: SignPath Foundation (무료, OSS/개인 개발자용)
- **상태**: 신청 완료, 승인 대기 (1~2주)
- **승인 후 작업**:
  1. GitHub Actions 워크플로우 구축 (빌드 → SignPath 서명 → R2 업로드)
  2. 다운로드 잠금 해제 (DOWNLOAD_KEY 제거)
  3. SmartScreen 경고 해소

### 다운로드 보안
- 현재 잠금: `?key=<DOWNLOAD_KEY>` 없으면 403
- 코드 서명 완료 후 잠금 해제 예정

---

## 7. 관리자 기능

### 관리자 대시보드 (bluepad.work/admin/)
- 비밀번호 로그인 (ADMIN_SECRET)
- 다운로드 건수 확인
- 라이선스 목록 조회 (이메일, 키, 디바이스, 상태)
- 라이선스 비활성화 (환불 시)

### API 엔드포인트
```
POST /validate     — 라이선스 검증 (앱에서 호출)
POST /deactivate   — 라이선스 비활성화 (앱에서 호출)
POST /admin/generate   — 라이선스 수동 생성
POST /admin/deactivate — 관리자 비활성화
GET  /admin/licenses   — 전체 라이선스 목록
```

---

## 8. 대기 중 항목 (2026-05-03 기준)

| 항목 | 담당 | 예상 시점 |
|------|------|-----------|
| SignPath 코드 서명 승인 | 외부 | 1~2주 |
| PayPal 은행 인증 (소액 입금 확인) | 사용자 | 수일 내 |
| ~~통신판매업 신고~~ | 완료 | 2026-05-04 |
| GitHub Actions 서명 파이프라인 | Claude | SignPath 승인 후 |
| 다운로드 잠금 해제 | Claude | 서명 완료 후 |
| 실결제 테스트 | 사용자 | PayPal 인증 후 |

---

## 9. 빌드 & 개발

```bash
# 개발 서버
npm run dev

# Tauri 개발 (앱 실행)
npm run tauri dev

# 프로덕션 빌드 (MSI 생성)
npm run tauri build

# R2 업로드
wrangler r2 object put bluepad-downloads/BluePad-latest.msi --file=src-tauri/target/release/bundle/msi/BluePad_0.1.0_x64_en-US.msi

# Worker 배포 (각 Worker 디렉토리에서)
wrangler deploy
```

---

## 10. 주의사항 & 트러블슈팅

- **HTML 내보내기**: URL.createObjectURL + a.click()은 Tauri WebView 크래시 유발 → Tauri native save dialog 사용
- **prompt()/alert()**: "tauri.localhost" 표시됨 → 커스텀 InputDialog/AlertDialog 사용
- **탭 상태 관리**: useFileManager에서 ref 패턴 필수 (stale closure 방지)
- **빌드 전**: 기존 BluePad.exe 프로세스 종료 필요 (OS error 5)
- **Worker 배포**: 반드시 wrangler CLI 사용 (MCP 도구는 다른 계정으로 배포될 수 있음)
- **D1 테이블**: `wrangler d1 execute --remote` 로 생성해야 함 (MCP는 로컬에만 생성)
