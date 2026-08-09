# TextMark

TextMark is a fast, secure, cross-platform Markdown reader and editor for Windows, Linux and macOS.

It is the portable successor to `pluk-inc/markdown-preview`. The original AppKit application has been restructured around a Tauri 2 native shell, a React/TypeScript interface and a small Rust filesystem boundary.

## TextMark 0.2

- Preview-first native desktop UI matching Markdown Preview
- In-place Edit Mode with headings, emphasis, lists, checklist, quote, code and link formatting
- Multiple document tabs, per-tab navigation history and restored scroll positions
- File/folder opening, atomic conflict-safe saving, external-change detection, project navigation and launch-by-path
- Document outline, inspector, frontmatter metadata and in-document search
- Mermaid diagrams with popup, KaTeX math, footnotes, alerts, tasks, tables, `[TOC]` and highlighted code
- Interactive task checkboxes, direct table cells, rectangular table selection, row/column actions and code/source copying
- Open With, Open in LLM, print/PDF and system sharing workflows
- Sanitized raw HTML
- Guarded relative-image loading without full-filesystem webview access
- Dark, light and system appearance, content width and 50–300% zoom
- Windows x64/ARM64 MSI, NSIS and portable ZIP; Linux x64/ARM64 AppImage/DEB/RPM; macOS Universal 2 app/DMG
- Signed in-app updater metadata, SHA-256 checksums and CycloneDX SBOM release assets

The first run is always Simplified Chinese. Choose English in Preferences at any time; the setting is persisted locally.

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
docs/PARITY_V0.0.47.md Frozen parity and native verification ledger
```

## License

MIT. See `THIRD_PARTY_NOTICES.md` for the Markdown Preview attribution and dependency notice.
