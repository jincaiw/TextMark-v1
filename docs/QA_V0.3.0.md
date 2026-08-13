# TextMark 0.3.0 release QA

Date: 2026-08-14. Frozen baseline: `pluk-inc/markdown-preview@v0.0.47` (`e364421b76df9f650012a270e4b5b6c9d799323f`).

## Local release gates

| Gate | Result |
| --- | --- |
| TypeScript and Vite production build | Pass |
| Vitest | Pass; 17 files, 165 tests |
| Rust tests | Pass; 7 tests |
| Rust Clippy | Pass; all targets/features, warnings denied |
| Preview bundle budget | Pass; main + Worker 257 KiB gzip, native preview 66 KiB gzip |
| Performance fixtures | Pass; 1 MiB cold parse < 1.5 s and 250 KiB warm parse < 250 ms |
| JavaScript dependency audit | Pass; 0 production or development vulnerabilities |
| RustSec dependency audit | Pass; 0 vulnerabilities. The Linux GTK3/WebKit stack reports 17 transitive informational warnings (unmaintained/unsound); these are tracked upstream and do not fail RustSec's vulnerability gate |
| Native desktop E2E | Pass locally on macOS; 5 end-to-end scenarios |
| Swift source/type and plist validation | Pass with installed command-line tools |
| Git diff whitespace validation | Pass |

The desktop E2E opens a real launch-path document and verifies Chinese first run, Worker/Tauri runtime, immediate English/Chinese switching, persisted toolbar customization, find modes, Inspector/frontmatter, disclosure-state preservation, tasks, source-aware table actions, Rust save, external-write conflict reload, rename following, deletion recovery and file recreation.

## Native release gates

| Platform | Required evidence before publishing |
| --- | --- |
| macOS 12+ | Xcode unit/host tests, Universal 2 app + Quick Look extension, mounted-DMG bundle/version/registration smoke |
| Windows 10/11 x64 + ARM64 | C++ preview tests, out-of-process WebView2 host smoke, MSI and NSIS install/COM/architecture/uninstall tests, portable ZIP launchers |
| Ubuntu 22.04/24.04 x64 + ARM64 | AppImage portable smoke; DEB MIME, thumbnailer, aliases, thumbnail output and uninstall cleanup |
| Fedora 40+ x64 + ARM64 | RPM MIME/thumbnail output, KDE 6 KIO plugin host test, package architecture and uninstall cleanup |

The release workflow publishes `v0.3.0` as a formal, latest, non-prerelease release only after every matrix entry above succeeds and the complete asset/updater-signature inventory passes. Fedora 40 validation uses Fedora's immutable archive repositories because the frozen minimum target is end-of-life; newer Fedora compatibility remains covered by the same ABI-independent package path.

## Visual QA

Five captures were inspected at 1440 × 900 (preview, edit, toolbar customization, dark) and 760 × 760 (narrow). The reference layout, 820 px document measure, typography, chrome spacing, palette, sidebar hierarchy and responsive overflow behavior pass. Native title-bar/menu regions and font rasterization are platform-owned. Intentional additions are document tabs, history controls, Inspector and platform-specific window controls. The detailed mismatch ledger is in [`VISUAL_SPEC.md`](VISUAL_SPEC.md).

## Traceability

All 139 test functions in the frozen upstream package are mapped one-to-one in [`UPSTREAM_TEST_MATRIX_V0.3.0.md`](UPSTREAM_TEST_MATRIX_V0.3.0.md). AppKit/WKWebView-only mechanisms are explicitly marked architecture-equivalent; stronger sanitization and single-quoted Quick Look image support are marked as improvements rather than silently described as identical.
