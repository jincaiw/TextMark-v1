# TextMark 0.2.0 release QA

Date: 2026-08-09. Baseline: `pluk-inc/markdown-preview@v0.0.47`.

## Local release gates

| Gate | Result |
| --- | --- |
| TypeScript and Vite production build | Pass; main application bootstrap 27.39 KB gzip plus React 57.17 KB gzip |
| Vitest | Pass; 6 files, 20 tests |
| Rust tests | Pass; 5 tests |
| Rust Clippy | Pass with all targets/features and warnings denied |
| Dependency audit | Pass; 0 vulnerabilities |
| Native production shell | Pass; optimized Tauri executable built without E2E feature |
| Native embedded WebDriver | Pass on local macOS; Chinese first run, Worker render, live English switch, toolbar customization and edit mode |
| Updater channels | Stable endpoint and opt-in beta endpoint are selected in the Rust trust boundary; both require the embedded public-key signature |
| Performance fixture | Pass; 1 MB Markdown render remains below the 1.5 s gate |

## Visual comparison

- Viewport: 1970 × 1280, matching the upstream main-window reference scale.
- Main chrome: toolbar height, traffic lights, centered filename, sidebar, search field, document measure and hierarchy match the accepted reference skeleton.
- Chinese default: verified before any locale mutation.
- Toolbar customization: verified at the same viewport; modal spacing, palette, draggable current toolbar, reset and primary Done action remain legible.
- Browser console/page errors: 0 in the visual run.
- Intentional deviations: history arrows were added beside the platform window controls; Windows/Linux use native trailing rectangular controls; TextMark adds tabs and Inspector surfaces.

## Native CI gates

The GitHub workflows run the same embedded WebDriver suite on macOS, Windows and Linux, compile x64/ARM64 targets, and publish only after all release bundles finish. Explorer Preview Handler, Quick Look and KDE ThumbnailCreator remain individually marked `CI` in the parity ledger until their native host tests exist; no release note claims these adapters as complete.
