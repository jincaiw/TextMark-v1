# TextMark parity ledger

Reference: `pluk-inc/markdown-preview` tag `v0.0.47`, commit `e364421b76df9f650012a270e4b5b6c9d799323f` (2026-08-08).

Status meanings: **Complete** is implemented and covered locally; **CI** needs its native runner; **Planned** is intentionally not claimed as shipped.

| Area | Reference behavior | TextMark v0.2.0 | Evidence |
| --- | --- | --- | --- |
| Shell | Preview-first window, sidebar, toolbar, light/dark | Complete | React visual smoke and screenshot ledger |
| Localization | English and Simplified Chinese | Complete | `i18n.test.ts`, component tests |
| Toolbar | Persistent add/remove/reorder and default set | Complete | `ToolbarCustomizer`, settings v2 migration |
| Documents | Open files/folders and multiple document surfaces | Complete | multi-select open, document tabs, single-instance forwarding |
| Saves | Dirty state, external edits and atomic editor saves | Complete | revision conflict dialog, atomic Rust writer |
| Navigation | Outline, project tree, relative Markdown links | Complete | renderer and platform tests |
| History | Back/forward with scroll restoration | Complete | per-tab navigation entries, toolbar/keyboard controls and restored scroll offsets |
| Markdown | CommonMark/GFM, anchors, TOC, tasks, alerts and footnotes | Complete | renderer tests |
| Frontmatter | YAML/TOML extraction and inspector rendering | Complete | renderer tests |
| Layout fidelity | RTL, long inline code, tables and deep lists | Complete | renderer/CSS fixtures; visual QA required per platform |
| Math | dollar, canonical LaTeX and fenced delimiters; copy source | Complete | renderer tests and delegated copy |
| Highlighting | shell aliases, HCL and Terraform | Complete | dedicated HCL grammar test |
| Mermaid | offline render, theme, zoom HUD, fit and enlarged view | Complete | lazy renderer and browser smoke |
| Mermaid native window | Resizable OS-level secondary window | Partial | isolated Tauri webview window with 25–400% zoom and fit control; native multi-window automation remains a platform CI gate |
| Editing | Formatting, undo/redo, line wrapping and spelling | Complete | CodeMirror and shortcut layer |
| List indentation | Tab and Shift-Tab | Complete | CodeMirror command map |
| Table editing | Direct cells, add/delete/duplicate rows and columns | Complete | table tests and preview delegation |
| Table range selection | Rectangular drag selection and block copy | Complete | pointer rectangle selection and TSV clipboard export |
| Search | Contains/Begins With, case, count and traversal | Complete | component test and preview matcher |
| Inspector | dates, size, word/character/line/heading/link/image counts | Complete | localized inspector |
| Open With | Discover installed editors and remember target | Complete | Rust discovery command and settings |
| AI handoff | Codex, Claude and ChatGPT with clipboard fallback | Complete | discovered app menu and URL fallback |
| Zoom | 50–300% discrete stops and keyboard/paging controls | Complete | shared stop list and keyboard handler |
| Export | print/PDF, self-contained HTML and continuous 2× PNG | Complete | lazy export module |
| CLI | multi-path launch and existing-instance forwarding | Complete | startup list and `open-paths` event |
| CLI aliases | `textmark`, `tm`, `text-mark` installed aliases | CI | package scripts validated in installer jobs |
| Updater | signed update metadata, download/install/restart | Complete | Tauri updater; keys stored outside repository |
| Crash reporting | explicit opt-in and unavailable without DSN | Complete | settings gate; no SDK initializes without DSN |
| macOS Quick Look | shared offline renderer and relative assets | CI | native extension target required on macOS runner |
| Windows Explorer preview | x64/ARM64 registered preview handler | CI | architecture-specific packaging job required |
| Linux preview | MIME, thumbnailer and quick-preview action | CI | DEB/RPM install smoke required |

The release gate must never convert **CI** or **Planned** rows to **Complete** solely because an installer built. Each requires its named native-host test.
