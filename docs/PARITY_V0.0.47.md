# TextMark parity ledger

Reference: `pluk-inc/markdown-preview` tag `v0.0.47`, commit `e364421b76df9f650012a270e4b5b6c9d799323f` (2026-08-08).

Status meanings: **Complete** is implemented and covered locally; **Release gate** is implemented but must pass its named native runner before v0.3.0 can be published.

| Area | Reference behavior | TextMark v0.3.0 | Evidence |
| --- | --- | --- | --- |
| Shell | Preview-first window, sidebar, toolbar, light/dark | Complete | five-state visual smoke and screenshot ledger |
| Menus | File/Edit/View/Format/Go/Window/Help with macOS-standard shortcuts (⌥⌘1-3, ⇧⌘M, ⌃⌘1-3, ⌘L, ⌘T/⌘W), checked state for Appearance/Content Width/sidebar panes, Open Recent | Complete | Rust `build_menu`, `refresh_menu`, `record_recent_file`, keyboard layer |
| Localization | English and Simplified Chinese | Complete | `i18n.test.ts`, component tests |
| Toolbar | Persistent add/remove/reorder, split Open With / Open in LLM, Export PDF item, Safari-style discrete zoom, app icons + default checkmark, copy ✓ feedback, search collapse-to-icon | Complete | `ToolbarCustomizer`, settings v4 migration |
| Documents | Open files/folders and multiple document surfaces | Complete | multi-select open, document tabs, single-instance forwarding |
| Saves | Dirty state, external edits and atomic editor saves | Complete | atomic Rust writer; real write/rename/delete/recreate E2E |
| Navigation | Outline, project tree, relative Markdown links | Complete | renderer and platform tests |
| History | Back/forward with scroll restoration | Complete | per-tab navigation entries, toolbar/keyboard controls and restored scroll offsets |
| Markdown | CommonMark/GFM, anchors, TOC, tasks, alerts and footnotes | Complete | renderer tests |
| Frontmatter | YAML/TOML extraction and inspector rendering | Complete | renderer tests |
| Layout fidelity | RTL, long inline code, tables and deep lists | Complete | renderer/style fixtures and five-state visual QA |
| Math | dollar, canonical LaTeX and fenced delimiters; copy source | Complete | renderer tests and delegated copy |
| Highlighting | shell aliases, HCL and Terraform | Complete | dedicated HCL grammar test |
| Mermaid | offline render, theme, zoom HUD, fit and enlarged view | Complete | lazy renderer and browser smoke |
| Mermaid native window | Resizable OS-level secondary window | Complete | isolated Tauri window with pan, pointer zoom, fit, reset and sanitized SVG |
| Editing | Formatting, undo/redo, line wrapping and spelling | Complete | CodeMirror and shortcut layer |
| List indentation | Tab and Shift-Tab | Complete | CodeMirror command map |
| Table editing | Direct headers/cells, add/delete/duplicate rows and columns | Complete | source-coordinate tests, delegated accessibility and native E2E |
| Table range selection | Rectangular drag selection and block copy | Complete | pointer rectangle selection and TSV clipboard export |
| Search | Contains/Begins With toggles (`Match:` label), Done button, Not found, case, count and traversal | Complete | component test and preview matcher |
| Inspector | Document/Properties tabs, file metadata and word/character/line/heading/link/image counts | Complete | localized tabbed inspector |
| Open With | Discover installed editors, remember target, Open With / Open As project context menu | Complete | Rust discovery command, context submenu and settings |
| AI handoff | Codex, Claude and ChatGPT with 12k-char clipboard fallback | Complete | discovered app menu and URL fallback |
| Zoom | 50–300% discrete stops, keyboard/paging controls, trackpad pinch and ⌘-wheel | Complete | shared stop list, keyboard handler and gesture/wheel layer |
| Export | Export… panel (PDF/HTML/PNG), Export as PDF…, print/PDF, self-contained HTML and continuous 2× PNG | Complete | export dialog, export/style tests and lazy export module |
| Default handler | Offer to register as the default `.md` opener on first launch | Complete | first-run prompt, `set_default_handler` command |
| Install CLI | App-menu CLI installer (`textmark`/`tm`/`text-mark`) | Complete | `install_cli` command (symlink on Unix, `.cmd` on Windows) |
| CLI | files/folders, multi-path, `--new-window`, existing-instance forwarding | Complete | Rust parser tests, startup list and `open-paths` event |
| CLI aliases | `textmark`, `tm`, `text-mark` installed aliases | Release gate | DEB/RPM install/uninstall and Windows portable tests |
| Updater | signed update metadata, download/install/restart | Complete | Tauri updater; keys stored outside repository |
| Crash reporting | explicit opt-in and unavailable without DSN | Complete | settings gate; no SDK initializes without DSN |
| macOS Quick Look | shared offline renderer, appearance, relative assets, native text selection and cursor feedback | Release gate | Universal extension, Xcode tests and mounted-DMG registration smoke |
| Windows Explorer preview | x64/ARM64 registered preview handler | Release gate | C++ tests, host smoke, architecture/COM/install/uninstall assertions |
| Linux preview | MIME, thumbnailer, quick-preview action and KDE 6 plugin | Release gate | native x64/ARM64 DEB/RPM/AppImage and KDE host tests |

The exhaustive one-to-one evidence for the upstream test package is in [`UPSTREAM_TEST_MATRIX_V0.3.0.md`](UPSTREAM_TEST_MATRIX_V0.3.0.md). A release-gated row becomes publishable only when its native host test passes; merely producing an installer is insufficient.
