[자동화 작업 — 72시간 주기 · 헤드리스 Sonnet 실행] BluePad 레포(C:\BLUE\Project\blue\SAAS\BluePad)에서 아래를 순서대로 수행하고, 마지막에 한국어 1~2줄로만 보고한다.

0. ★협조요청 우선 처리: docs/work-log/협조요청-code.md 를 연다. `[열림]` 항목이 있으면 규칙대로 처리 — 안전·명확하면 즉시(랜딩 git push / 앱·worker는 deploy.sh·wrangler), 파괴적(DB삭제·결제·라이선스·대규모)·모호하면 `[보류]`로 두고 사유만. 처리 후 `[열림]`→`[완료 YYYY-MM-DD <커밋해시/배포>]`로 바꾸고 cowork 확인 필요 시 "↩ cowork: <확인요청>" 추가. 이 파일은 docs지만 협조요청 처리 목적이므로 상태 갱신 커밋 허용.

A) 블로그 자동 배포:
1. `git status --porcelain` 로 워킹트리 확인. .git/*.lock 있고 실행 중 git 프로세스 없으면 stale 락 제거 후 진행.
2. 블로그 관련 변경만 대상: landing/en/blog/, landing/ko/blog/, landing/ja/blog/, landing/blog/, landing/sitemap.xml. (앱코드/worker/docs는 건드리지 않음)
3. 신규/수정 .html 은 `</html>` 포함(완결)일 때만 커밋. 미완성 드래프트는 스킵·보고만.
4. 대상 파일만 git add 후 한글 커밋("블로그 글 자동 배포: <파일명>") + Co-Authored-By/Claude-Session 푸터.
5. 미푸시 커밋 있거나 방금 커밋했으면 `git push` (Pages 자동 빌드).
6. 신규 글 URL HTTP 200 가볍게 확인. (선택) IndexNow 제출(키 52cbe3af562eb1c50d5dfb86fc922388).

B) work-log 검토 + 개선:
7. docs/work-log/ 문서(특히 코워크/타 세션 작성 최신본)를 읽어 미해결 이슈·개선 제안 파악 → 명확·안전하면 자동 처리(앱·worker는 deploy.sh/wrangler, 랜딩은 git push), 판단 필요/파괴적(DB삭제·결제·라이선스·대규모)은 보고만.

블로그 발행 규칙(필수): 영문 글은 landing/en/blog/에만(구 /blog/ 삭제·301). canonical·og:url·mainEntityOfPage는 자기 URL, ko/ja의 hreflang en·x-default는 /en/blog/. sitemap 새 <url>은 </urlset> 앞에 삽입(append 금지), 닫는태그 1개·클린URL(.html 없이).

wrangler 필요 시(앱/worker 배포) 글로벌 규칙대로 CLOUDFLARE_API_TOKEN/ACCOUNT_ID(blueehdwp 계정) 설정 후 실행.

C) 보고(필수, 마지막 한 줄):
8. 한국어 1~2줄 + 항상 마지막에 "다음 점검: <시각>". 협조요청·블로그·개선 모두 없으면 "협조요청/신규 블로그/개선 없음 — 다음 점검: <시각>" 한 줄만.
- 시각 계산(tzdata 없음 → 시스템 date가 이미 KST이므로 그대로):
  `date -d "+3 days" +'%m-%d %H:%M KST (≈72h 후)'`

커밋 범위(허용): ① 블로그 경로(landing/{en,ko,ja}/blog/, landing/blog/, landing/sitemap.xml) ② docs/work-log/협조요청-code.md(상태 갱신) ③ docs/work-log/*.md(코워크가 남긴 미푸시 로그 일괄 커밋 허용). **그 외(앱코드·worker·기타 docs·시크릿)는 자동 커밋 금지.** 불확실하면 커밋 말고 보고만.
