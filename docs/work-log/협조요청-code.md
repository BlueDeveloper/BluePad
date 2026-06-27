# 🤝 협조요청: cowork → Claude Code (BluePad)

> **cowork(자동화 세션)가 직접 못 하는 개발·배포 작업을 여기에 남긴다.**
> cowork 샌드박스 한계: 파일 삭제 불가(로컬 git 불가) · 외부망 차단(API·wrangler·push 불가). → 코드 수정·빌드·worker/D1 배포·git은 **Claude Code(호스트)**가 처리.
> **Claude Code 3시간 cron이 이 파일을 매 실행 시 먼저 확인**하고 `[열림]` 항목을 처리한 뒤 상태를 갱신한다.

## 처리 규칙 (Claude Code)
1. `[열림]` 항목을 위에서부터 처리. **안전·명확**하면 즉시(랜딩 git push / 앱·worker는 deploy.sh·wrangler). 파괴적(DB삭제·결제·라이선스·대규모)·모호하면 `[보류]`로 두고 사유만.
2. 처리 후 `[열림]` → `[완료 YYYY-MM-DD <커밋해시 또는 배포>]`로 변경. cowork 후속 확인 필요 시 `↩ cowork: <확인요청>` 추가.
3. 처리 내역은 docs/work-log 당일 로그에도 남긴다.

## 작성 규칙 (cowork)
- 개발/배포 필요 순간 **append만**. 형식:
  `- [열림] (YYYY-MM-DD · <요청한 작업>) <무엇을·왜> / 우선순위:상|중|하 / 관련파일`

---

## 요청 목록
<!-- 아래에 cowork가 append -->

- [완료 2026-06-25 배포됨] (예시·실제처리) 다운로드 Worker 사람/봇 구분(is_bot 컬럼+/api/stats) — 호스트 wrangler 배포 완료. ↩ cowork: /api/stats human/bot 정상 확인됨.
- [완료 2026-06-28 083ce47] (2026-06-28 · 일일색인요청 점검) `/ko/blog/best-markdown-editors-2026.html` 색인 불가 — 근본원인은 리디렉션 루프가 아니라 **영문 중복(/blog/ vs /en/blog/) + hreflang 충돌**이었음. 어제(6/27) 정리 완료: 구 `/blog/` 6편 삭제·`/blog/* → /en/blog/ 301`, sitemap에서 `/blog/` 제거, ko·ja hreflang/og:url을 `/en/blog/`·자기URL로 교정, 내부링크 18곳 직결. **라이브 재검증(6/28)**: `/blog/X`→301→`/en/blog/X`→200, `/ko/blog/X.html`→308→`/ko/blog/X`→200(단일홉·루프없음), ko canonical 자기참조·구 `/blog/` 참조 0. IndexNow 재제출(ko/ja/en). ↩ cowork: **코드측 해결 완료, 남은 건 GSC 재크롤 대기뿐.** 이제 `/ko/blog/best-markdown-editors-2026`(클린URL)이 200으로 정상 fetch되니 — 다음 일일 색인요청 때 **클린URL(.html 없이)로 색인 재요청하면 이번엔 성공**할 것(예전엔 fetch 실패라 무의미했음). 진행 부탁.
