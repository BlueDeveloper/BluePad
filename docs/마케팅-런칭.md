# BluePad — 글로벌 런칭 마케팅 자료

> 영문 SEO 보강 + JSON-LD 정리(가짜 rating 제거) 완료 후 사용.
> 작성일: 2026-05-13. 본인이 복사해서 각 채널에 사용.

---

## Product Hunt 런칭

### 카피 (영문 / 본인이 PH에 직접 등록)

**Tagline (60 chars max)**
```
A fast, distraction-free Markdown editor for Windows
```

**Description**
```
BluePad is a lightweight, distraction-free Markdown editor designed
specifically for Windows. Built with Tauri (Rust) instead of Electron,
it starts in under a second and uses minimal memory.

Features:
• WYSIWYG Markdown editing (powered by Milkdown / ProseMirror)
• Multi-tab support — keep multiple documents open
• 4 dark themes, focus mode for deep work
• Mermaid diagrams + KaTeX math
• HTML / PDF export (Pro)
• 14-day free trial of Pro features, no signup required
• Multi-language UI (English / Korean / Japanese)

Free tier: 3 tabs, 1 theme.
Pro lifetime license: $10.99 one-time (unlocks everything, 3 devices).

I built BluePad because I wanted something between bloated all-in-one
note apps and basic text editors — a writing tool that respects my
attention and my CPU.

Made with ❤️ by an indie developer. Feedback welcome!
```

**Topics**: Productivity, Writing, Developer Tools, Open Source (선택사항)

**Maker comment (첫 댓글)**
```
Hi everyone! 👋

I'm the solo developer behind BluePad. I switched from Typora last year
and missed the simplicity, so I built my own.

Honest tradeoffs:
✅ Fast startup (~0.8s on my laptop)
✅ Tiny memory footprint (~80MB vs Electron apps 200-500MB)
✅ Native Windows feel
❌ Windows only for now (Linux beta builds available on request)
❌ No mobile sync (it's a local-first editor)
❌ Not signed by a CA yet (so SmartScreen will warn — click "More info"
   → "Run anyway"). Will get an OV cert once revenue justifies it.

Happy to answer any questions! 🙏
```

### 런칭 팁

- **타이밍**: 화/수/목 UTC 00:01에 포스트 (미국 자정 = 한국 오전 9시)
- **준비물**: 4-5장 스크린샷 (PC에서 BluePad 사용 장면), GIF 1개(빠른 시연), 로고 (이미 있음)
- **친구 끌어오기**: 출시 직후 1시간 내 upvote 5개 모으면 알고리즘 상승

---

## Reddit 포스트

### 적합한 서브레딧 (런칭 채널)

| 서브 | 멤버 | 포스트 톤 | 빈도 제한 |
|------|------|----------|----------|
| **r/markdown** | 21K | 직접 홍보 OK ("I made") | 1회 |
| **r/SideProject** | 250K | indie maker 환영 | 1회 |
| **r/InternetIsBeautiful** | 17M | wow factor 필요 | 1회 |
| **r/coolgithubprojects** | 70K | GitHub 링크 위주 | 1회 |
| **r/selfhosted** | 380K | "local-first" 강조 | 1회 |
| **r/productivity** | 1.5M | 자가 홍보 엄격 | 가치 제공 필수 |
| r/programming | 4M | self-promotion 비추 | ❌ |

### 포스트 템플릿 (r/markdown용)

**제목**: I built a fast, native Markdown editor for Windows after getting tired of Electron apps

**본문**:
```
Hi r/markdown,

I've been writing in Markdown for years and bounced between Typora,
Obsidian, and various web editors. Most felt either too heavy
(2GB RAM for a text editor?) or too feature-bloated.

So I built BluePad — a small Windows-only Markdown editor:

→ https://bluepad.work

Tech stack: Tauri (Rust) + React + Milkdown (ProseMirror)
- ~0.8s cold start
- ~80MB RAM
- ~6MB installer
- WYSIWYG mode that doesn't lag on long documents

Free version has 3 tabs and 1 theme. Pro ($10.99 lifetime) adds
unlimited tabs, 4 themes, focus mode, and HTML/PDF export. 14-day
trial of all Pro features without signup.

Honest disclaimers:
- Windows only right now (Linux .AppImage available on request)
- Not code-signed yet, so SmartScreen will complain. Click "More info"
  → "Run anyway". I'll get an OV cert once revenue justifies it.
- Solo dev project. I'm one person, response time varies.

Source on GitHub: https://github.com/BlueDeveloper/BluePad
(closed-source build but happy to clarify any concerns)

Genuinely curious what features you all wish a Markdown editor had.
The biggest non-obvious request from beta users was Mermaid diagrams,
which I added in 1.5.

Happy to answer questions!
```

### r/SideProject용 변형

**제목**: I quit my evening Netflix habit and built a Markdown editor instead — $10.99 one-time, 14-day free trial

(자조적 톤, indie maker 친화적)

### 주의사항

- ⚠️ 같은 URL을 24시간 내 여러 서브에 동시에 포스팅하면 spam-filter 걸림. **하루 1-2개 서브** 분산
- ⚠️ 댓글 자가 답변 금지(자신의 다른 계정으로 upvote) — 영구밴 위험
- ✅ 댓글 비판/질문엔 정직하게 답변 — "Made with ❤️" 식 자뻑보다 솔직한 트레이드오프 인정이 더 잘 먹힘

---

## AI 검색 노출 (GPT/Claude/Perplexity)

이미 GPTBot, ClaudeBot, Applebot이 사이트 크롤링 중입니다. AI가 BluePad를 추천하려면 충분한 콘텐츠 필요:

### 우선 작성할 영문 블로그 (각 1500+ words, AI hallucination 최소화)

1. "BluePad vs Typora vs Obsidian: which is right for you?"
2. "How to set up a distraction-free writing environment on Windows"
3. "Why I built BluePad instead of using Notion"
4. "Mermaid diagrams in Markdown: a practical guide"
5. "Markdown shortcut cheat sheet for Windows"

각 글은:
- Comparison table 포함 (구조화 데이터 풍부)
- 실제 코드/screenshot
- BluePad CTA는 마지막에만 (글 자체가 가치 있어야 AI가 인용)

### Schema.org Article 추가

기존 블로그 페이지에 `Article` JSON-LD가 있는지 점검 → 없으면 추가:
```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "...",
  "author": { ... },
  "datePublished": "...",
  "image": "...",
  "publisher": { ... }
}
```

---

## 측정 지표 (런칭 후 1주일)

| 지표 | 측정처 | 목표 |
|------|--------|------|
| Product Hunt upvote | PH 페이지 | 50+ (Top 20 of the day) |
| 사이트 방문 | Microsoft Clarity | +500 unique/day 동안 |
| 다운로드 | admin → downloads | +30 사람 (봇 제외) |
| GitHub star | github.com/BlueDeveloper/BluePad | +20 |
| 결제 전환 | admin → 결제 | 2-3건 (1% 가정) |
| SEO 색인 | GSC | 색인 ≥ 30 페이지 |

지표 미달이어도 데이터 → 다음 출시 개선 인사이트.
