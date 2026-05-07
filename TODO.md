# BluePad TODO

## 구현 완료

* [x] WYSIWYG 마크다운 편집 (Milkdown)

* [x] 파일 열기 / 저장 / 다른이름저장

* [x] CLI 인수로 파일 열기 (.md 연결 프로그램)

* [x] 메뉴바 (파일/편집/보기)

* [x] 포맷 툴바 (Bold, Italic, 취소선, 제목, 목록, 인용, 코드, 표, 링크)

* [x] 개요 사이드바 (TOC, 제목 클릭 이동)

* [x] 소스 모드 토글 (Ctrl+/)

* [x] 집중 모드 (F11, ESC 해제, 상단 호버 해제바)

* [x] HTML 내보내기

* [x] GFM (표, 체크리스트, 취소선)

* [x] 글자수 / 단어수 / 줄수 상태바

* [x] 키보드 단축키 (Ctrl+N/O/S/Shift+S/F/H/=/-/0)

* [x] 토글 버튼 (소스/파일트리/개요/집중)

* [x] 찾기 / 바꾸기 (Ctrl+F, Ctrl+H)

* [x] 이미지 붙여넣기 (클립보드 Ctrl+V)

* [x] 이미지 드래그 & 드롭

* [x] LaTeX 수식 ($inline$, $block$)

* [x] Mermaid 다이어그램

* [x] 코드 구문 강조 (Prism, refractor)

* [x] 파일 트리 사이드바 (폴더 열기, 하위 파일 탐색)

* [x] 최근 파일 목록 (메뉴 > 파일)

* [x] 자동 저장 (30초 간격, 토글 가능)

* [x] 글꼴 크기 조절 (Ctrl+=/-/0)

## 중요 (편의성)

* [x] 다중 파일 형식 지원 (txt/json/yaml)
  * [x] .txt/.log → SourceEditor(기존 textarea) 활용

  * [x] .json → CodeMirror 6 통합 + 구문 강조 + `JSON.stringify` 자동 정렬

  * [x] .yaml/.yml → CodeMirror 6 통합 + 구문 강조 + `js-yaml` 자동 정렬

  * [x] Tab 인터페이스에 fileType 필드 추가, 확장자 기반 에디터 분기

  * [x] tauri.conf.json 파일 연결 + 열기/저장 다이얼로그 필터 확장

  * [x] 메뉴에 "자동 정렬(Format)" 항목 추가 (json/yaml 전용, Ctrl+Shift+F)

* [ ] PDF 내보내기 (인쇄 다이얼로그 또는 직접 생성)

* [ ] 타자기 모드 (현재 줄 항상 화면 중앙)

* [ ] YAML Front Matter 표시

* [ ] 각주 지원 (\[^1])

* [ ] 목차 자동 생성 (\[toc] 지시어)

* [ ] 다크 테마 + 테마 전환 (라이트/다크)

* [ ] 커스텀 테마/CSS 불러오기

* [ ] 인쇄 기능 (Ctrl+P)

## 부가 (있으면 좋은)

* [ ] 스마트 따옴표/대시 (" → "", -- → —)

* [ ] 이모지 자동완성 (:smile: → 😄)

* [ ] 위첨자/아래첨자 (^sup^, ~~sub~~)

* [ ] 하이라이트 (==강조==)

* [ ] Word/EPUB 내보내기 (Pandoc 기반)

* [ ] 설정 다이얼로그 (환경설정 UI)

* [ ] 창 항상 위에 (Always on top)

* [ ] 선택 영역 글자수 (드래그 시 별도 카운트)

* [ ] 읽기 시간 추정

* [ ] URL 스킴 / 딥링크

* [x] 다국어 지원 (i18n) — 한/영/일 완료

* [x] 자동 업데이트 체크 — Tauri updater plugin + Worker

* [x] 탭 / 멀티 윈도우 — 멀티탭 완료

* [ ] 전용 앱 아이콘 디자인

