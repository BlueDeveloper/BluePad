# BluePad

**A fast, lightweight Markdown editor for Windows.**

[Download](https://bluepad.work) · [Changelog](https://bluepad.work/changelog/) · [Help & FAQ](https://bluepad.work/help/)

---

## Features

- **WYSIWYG + Source Mode** — Rich editing with live preview, toggle with `Ctrl+/`
- **Multi-Tab** — Manage multiple documents, tabs restore on restart
- **5 Themes** — Classic, Dark (free), BRP Blue, Red, Polarity (Pro)
- **JSON / YAML Editing** — Syntax highlighting + auto-format (`Ctrl+Shift+F`)
- **Focus Mode** — Distraction-free writing (Pro)
- **Find & Replace** — `Ctrl+F` / `Ctrl+H`
- **LaTeX Math** — KaTeX rendering ($inline$, $$block$$)
- **Mermaid Diagrams** — Flowcharts, sequence diagrams in code blocks
- **Code Syntax Highlighting** — 200+ languages via Prism
- **File Tree** — Browse and open files from a folder sidebar
- **Always on Top** — Pin window above all others
- **Auto-Save** — Every 30 seconds, all settings persist across restarts
- **3 Languages** — Korean, English, Japanese
- **Auto-Update** — Built-in update checker

## Download

**[bluepad.work](https://bluepad.work)** — Windows 10+, ~7MB, free

## Free vs Pro

| Feature | Free | Pro ($10.99) |
|---------|:----:|:----:|
| Tabs | 3 | Unlimited |
| Themes | Classic + Dark | All 5 |
| Focus Mode | - | O |
| HTML/PDF Export | - | O |
| JSON/YAML Editing | O | O |
| Auto-Save | O | O |
| Find & Replace | O | O |
| LaTeX / Mermaid | O | O |

14-day free trial included.

## Tech Stack

- **Desktop**: [Tauri v2](https://tauri.app) (Rust + WebView)
- **Frontend**: React 18 + TypeScript + Vite
- **Editor**: [Milkdown](https://milkdown.dev) (ProseMirror) + [CodeMirror 6](https://codemirror.net)
- **Backend**: Cloudflare Workers + D1 + R2
- **Landing**: Cloudflare Pages

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New file |
| `Ctrl+O` | Open |
| `Ctrl+S` | Save |
| `Ctrl+Shift+S` | Save As |
| `Ctrl+W` | Close tab |
| `Ctrl+Tab` | Next tab |
| `Ctrl+/` | Toggle source mode |
| `Ctrl+F` | Find |
| `Ctrl+H` | Replace |
| `Ctrl+Shift+F` | Format JSON/YAML |
| `Ctrl+=/-/0` | Font size |
| `F11` | Focus mode (Pro) |

## Changelog

See [bluepad.work/changelog](https://bluepad.work/changelog/) for full release notes.

### v1.8.0 (2026-05-08)
- Dark theme (free)
- JSON/YAML editing with syntax highlighting
- Always on Top
- Selection character count & reading time
- YAML Front Matter display
- [toc] auto-generation
- Tab & UI state persistence across restarts
- Payment security fixes
- Admin dashboard: payments, refund, error logs

### v1.0.0 (2026-05-02)
- Initial release

## Links

- **Website**: [bluepad.work](https://bluepad.work)
- **Help & FAQ**: [bluepad.work/help](https://bluepad.work/help/)
- **Support**: [bluepad.work/support](https://bluepad.work/support/)
- **Feedback**: [bluepad.work/feedback](https://bluepad.work/feedback/)

## License

Proprietary. See [EULA](https://bluepad.work/legal/eula).

---

Made by **BRP (BlueRedPolarity)**
