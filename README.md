# TextMark

TextMark is a fast, secure, cross-platform Markdown reader and editor for Windows, Linux and macOS.

It is the portable successor to `pluk-inc/markdown-preview`. The original AppKit application has been restructured around a Tauri 2 native shell, a React/TypeScript interface and a small Rust filesystem boundary.

## TextMark 0.9

- Preview-first native desktop UI matching Markdown Preview
- In-place Edit Mode with headings, emphasis, lists, checklist, quote, code and link formatting
- Multiple document tabs, per-tab navigation history and restored scroll positions
- File/folder opening, atomic conflict-safe saving, native file watching, rename/delete recovery, project navigation and launch-by-path
- Document outline, inspector, frontmatter metadata and in-document search
- Mermaid diagrams with popup, KaTeX math, footnotes, alerts, tasks, tables, `[TOC]` and highlighted code
- Interactive task checkboxes, editable table headers/cells, rectangular table selection, row/column actions and code/source copying
- Open With, Open in LLM, print/PDF and system sharing workflows
- Sanitized raw HTML
- Guarded relative-image loading without full-filesystem webview access
- Dark, light and system appearance, content width and 50–300% zoom
- macOS Quick Look, Windows Explorer Preview Handler, Freedesktop thumbnails/desktop action and KDE 6 thumbnail integration
- Windows x64/ARM64 MSI, NSIS and portable ZIP; Linux x64/ARM64 AppImage/DEB/RPM; macOS Universal 2 app/DMG
- Signed in-app updater metadata, SHA-256 checksums and CycloneDX SBOM release assets
- Traceable parity against the current upstream `v0.0.51` / `main` baseline, with 280 frontend and 13 Rust tests

The first run is always Simplified Chinese. Choose English in Preferences at any time; the setting is persisted locally.

Supported documents: `.md`, `.markdown`, `.mdown`, `.mkd`, `.mkdn`, `.mdwn`, `.mdtxt`, `.mdtext`, `.rmd` and `.txt`.

## Desktop and command line

Download the installer or portable archive for your architecture from [GitHub Releases](https://github.com/jincaiw/TextMark-v1/releases). Windows installers register Explorer Preview and file associations; DEB/RPM install standard MIME and thumbnail integration; the macOS DMG includes Quick Look. AppImage and Windows portable ZIP remain self-contained.

DEB/RPM expose `textmark`, `tm` and `text-mark` on `PATH`; the Windows portable archive and macOS app bundle include the same launchers beside the application. They accept files, folders and multiple paths; add `--new-window` when each requested document should open separately.

```sh
textmark README.md docs/
tm --new-window one.md two.md
```

The v0.9.1 binaries are updater-signed but do not use Apple Developer ID notarization or Windows Authenticode. Review the release trust notice and verify `SHA256SUMS.txt` when installing.

## Development

Requirements: Node.js 24, Rust 1.88 and the [Tauri system prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform.

```sh
npm install --include=dev
npm run test
npm run tauri dev
```

Build the desktop bundle for the current platform:

```sh
npm run tauri build
```

Run the complete local quality set:

```sh
npm test -- --run
npm run build
npm run check:bundle
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
```

The web interface can also be inspected without Tauri:

```sh
npm run dev
```

Browser mode supports editing, previewing, opening individual files and downloading saves. Folder browsing and guarded local assets require the desktop shell.

## Structure

```text
src/                 React application and Markdown pipeline
src-tauri/           Rust commands and desktop bundle configuration
docs/ARCHITECTURE.md Security and module boundaries
docs/PARITY_AUDIT_V0.9.0.md Current upstream parity implementation and QA ledger
docs/PARITY_V0.0.47.md Historical parity and native verification ledger
docs/UPSTREAM_TEST_MATRIX_V0.3.0.md Historical one-to-one upstream behavior mapping
```

## License

MIT. See `THIRD_PARTY_NOTICES.md` for the Markdown Preview attribution and dependency notice.
