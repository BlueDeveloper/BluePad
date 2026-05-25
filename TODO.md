# BluePad TODO

## 구현 완료

### 에디터 핵심

* [x] WYSIWYG 마크다운 편집 (Milkdown)

* [x] 소스 모드 토글 (Ctrl+/)

* [x] 파일 열기 / 저장 / 다른이름저장

* [x] CLI 인수로 파일 열기 (.md 연결 프로그램)

* [x] 멀티탭 — 드래그 정렬, Ctrl+Tab 전환, 앱 재시작 시 복원

* [x] 메뉴바 (파일/편집/보기/설정)

* [x] 포맷 툴바 (Bold, Italic, 취소선, 제목, 목록, 인용, 코드, 표, 링크)

* [x] 찾기 / 바꾸기 (Ctrl+F, Ctrl+H)

* [x] 자동 저장 (30초 간격, 토글 가능)

* [x] 글꼴 크기 조절 (Ctrl+=/-/0)

* [x] 집중 모드 (F11, Pro)

* [x] 항상 위에 (Always on Top)

* [x] 탭 닫기: 저장하고 닫기 / 닫기

### 마크다운 기능

* [x] GFM (표, 체크리스트, 취소선)

* [x] LaTeX 수식 ($inline$, $block$)

* [x] Mermaid 다이어그램

* [x] 코드 구문 강조 (Prism, 17종 토큰)

* [x] YAML Front Matter 표시

* [x] \[toc] 목차 자동 생성

* [x] 하이라이트 CSS (<mark> 태그)

* [x] 이미지 붙여넣기 (Ctrl+V) + 드래그 & 드롭

### 다중 파일 형식

* [x] .md/.markdown/.mdx → Milkdown (WYSIWYG)

* [x] .json/.jsonc → CodeMirror 6 + 구문 강조 + 자동 정렬 (Ctrl+Shift+F)

* [x] .yaml/.yml → CodeMirror 6 + 구문 강조 + 자동 정렬

* [x] .txt/.log → SourceEditor (textarea)

### UI / UX

* [x] 5가지 테마 (Classic, Dark 무료 / BRP Blue, Red, Polarity Pro)

* [x] 다국어 (한/영/일, 148개 키)

* [x] 파일 트리 사이드바 (폴더 열기, 재시작 시 유지)

* [x] 개요 사이드바 (TOC, 제목 클릭 이동)

* [x] 토글 버튼 (소스/파일트리/개요/집중)

* [x] 글자수 / 단어수 / 줄수 상태바

* [x] 선택 영역 글자수 (드래그 시 실시간 표시)

* [x] 읽기 시간 추정 (\~N분)

* [x] 최근 파일 목록 (메뉴 > 파일)

* [x] UI 상태 유지 (소스모드, 사이드바, 파일트리, 자동저장, 테마, 언어, 글꼴)

### 내보내기

* [x] HTML 내보내기 (Pro)

* [x] PDF 내보내기 — 인쇄 다이얼로그 (Pro)

### 라이선스 & 결제

* [x] 14일 트라이얼

* [x] 라이선스 활성화/비활성화 (최대 3기기)

* [x] PayPal 결제 → 라이선스 자동 발급

* [x] 결제 보안 (리플레이 방지, 금액 검증, 결제 기록)

* [x] 환불 프로세스 (orderId → license 매칭)

### 자동 업데이트

* [x] Tauri updater plugin + Worker

* [x] What's New 다이얼로그 (업데이트 후)

### 인프라

* [x] Cloudflare Workers 3개 (license-api, download, checkout)

* [x] D1 테이블 7개 (licenses, activations, trials, payments, downloads, support\_tickets, error\_logs)

* [x] R2 MSI 호스팅 + update.json

* [x] Cloudflare Pages 랜딩 자동 배포

* [x] 배포 자동화 (deploy.sh — 9단계)

* [x] D1 백업 스크립트 (backup-d1.sh)

* [x] 에러 모니터링 (error\_logs + 관리자 조회)

* [x] 업타임 헬스체크 (6시간 Cron)

* [x] IndexNow 자동 제출 (Bing/Naver/Yandex)

### 랜딩 & SEO

* [x] 다국어 랜딩 (ko/en/ja)

* [x] 블로그 6개 x 4언어 (번역 진행 중)

* [x] 릴리즈 노트 페이지 (/changelog/)

* [x] FAQ / 도움말 (/help/)

* [x] 피드백 페이지 (/feedback/)

* [x] 문의/환불 (/support/)

* [x] 관리자 대시보드 (/admin/) — 라이선스, 트라이얼, 결제, 환불, 에러 로그, 티켓 답변

* [x] SmartScreen 안내

* [x] 법적 표시사항 (footer, privacy, eula, opensource)

* [x] robots.txt + sitemap.xml (40개 URL)

* [x] JSON-LD 구조화 데이터 (SoftwareApplication)

* [x] Microsoft Clarity

* [x] Google Search Console + Naver 인증

* [x] GitHub README.md

### 고객 소통

* [x] 문의 티켓 시스템 (DB 저장 + 이메일 알림)

* [x] 관리자 티켓 답변 (MailChannels 이메일 발송)

* [x] 피드백 수집 (카테고리 + 만족도 + 의견)

***

## 미구현 (향후)

### 중요

* [ ] PDF 직접 생성 (현재는 인쇄 다이얼로그)

* [ ] 타자기 모드 (현재 줄 항상 화면 중앙)

* [ ] 각주 지원 (\[^1]) — Milkdown 커스텀 플러그인 필요

* [ ] 커스텀 테마/CSS 불러오기

* [ ] 마크다운 → 일반 텍스트 복사 (Ctrl+Shift+C, 선택 영역의 마크업 제거 후 클립보드)

### 작가용 기능 묶음

#### 1차 (Pro 가치 강화)

* [ ] 집중 모드 강화 — 하이라이트 모드 (현재 문장만 선명, 나머지 흐림)

* [ ] 글쓰기 통계 패널 — 일일/주간/월간 단어 목표, 진행률 바, 마감일 카운트다운

* [ ] 글쓰기 히트맵 (GitHub contribution 스타일, localStorage 기반)

* [ ] NaNoWriMo 모드 (50K 단어 / 30일 챌린지)

* [ ] 챕터 아웃라인 사이드바 (H1/H2 드래그 재배치)

* [ ] 한글 맞춤법 검사 (hanspell 또는 부산대 검사기 API)

* [ ] 영문 문법 검사 (LanguageTool 오픈소스)

* [ ] 문장 분석 — 긴 문장/수동태/부사 남용 경고 (Hemingway 스타일)

* [ ] 동의어·유의어 사전

* [ ] 스프린트 모드 (15분 글쓰기, 멈추면 알람)

* [ ] 사운드 효과 (타자기, 빗소리 — 무료 lo-fi)

#### 2차 (장편 작가용 / 구조)

* [ ] 시놉시스 카드 (Scrivener Corkboard 스타일)

* [ ] 인물·장소 위키 노트 (작품 내 참조)

* [ ] 프로젝트 단위 관리 (현재 단일 파일 → 폴더/프로젝트)

* [ ] 시제·인칭 일관성 경고

* [ ] EPUB 내보내기 (Pandoc)

* [ ] DOCX 내보내기 (Pandoc)

#### 3차 (AI Studio 티어 신설)

* [ ] AI BYOK 통합 (Claude/OpenAI API key 사용자 입력)

* [ ] 문장 다듬기 (간결/풍부/톤 변경)

* [ ] 다음 문장 자동 완성 (Cursor 스타일)

* [ ] 캐릭터·장 시놉시스 생성

* [ ] 일관성 체크 (캐릭터 묘사·시제·설정)

* [ ] 번역 (한↔영↔일)

* [ ] 작가 본인 스타일 톤 학습

* [ ] 자체 구독 모델 (Paddle 정기결제 + Worker 프록시)

#### 4차 (협업·백업)

* [ ] 자동 클라우드 백업 (Dropbox/Drive/iCloud)

* [ ] Git 스타일 버전 히스토리

* [ ] 시간별 자동 스냅샷

* [ ] 읽기 전용 공유 링크

* [ ] 베타 리더 댓글/리뷰 모드

* [ ] 변경 추적 (track changes)

* [ ] 직접 발행 — WordPress/Ghost/Medium/Tistory/브런치 API

#### 장르 특화 (선택)

* [ ] 시나리오 모드 (Fountain 문법)

* [ ] 시 작법 (음절/운율 카운터)

* [ ] 학술 (인용/각주 강화)

### 부가

* [ ] 스마트 따옴표/대시 (" → "", -- → —)

* [ ] 이모지 자동완성 (:smile:)

* [ ] 위첨자/아래첨자

* [ ] Word/EPUB 내보내기 (Pandoc)

* [ ] 설정 다이얼로그 UI

* [ ] URL 스킴 / 딥링크

* [ ] 전용 앱 아이콘 디자인

* [ ] 모바일 네비게이션 햄버거 메뉴

* [ ] 뉴스레터 구독

* [ ] 코드 서명 (수익 발생 후 유료 인증서)

* [ ] 음성 받아쓰기

* [ ] 손글씨 입력 (펜 태블릿)

* [ ] 매크로/스니펫

