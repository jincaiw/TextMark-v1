# TextMark

TextMark is a fast, secure, cross-platform Markdown reader and editor for Windows, Linux and macOS.

It is the portable successor to `pluk-inc/markdown-preview`. The original AppKit application has been restructured around a Tauri 2 native shell, a React/TypeScript interface and a small Rust filesystem boundary.

## Included

- Preview-first native desktop UI matching Markdown Preview
- In-place Edit Mode with headings, emphasis, lists, checklist, quote, code and link formatting
- File/folder opening, saving, file watching, project navigation and launch-by-path
- Document outline, inspector, frontmatter metadata and in-document search
- Mermaid diagrams with popup, KaTeX math, footnotes, alerts, tasks, tables, `[TOC]` and highlighted code
- Interactive task checkboxes, table row/column actions and code/source copying
- Open With, Open in LLM, print/PDF and system sharing workflows
- Sanitized raw HTML
- Guarded relative-image loading without full-filesystem webview access
- Dark, light and system appearance, content width and 50–300% zoom
- Windows MSI/NSIS, Linux AppImage/DEB/RPM and macOS app/DMG bundle configuration

## Development

Requirements: Node.js 22+, Rust 1.85+ and the [Tauri system prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform.

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
docs/MIGRATION.md    Original feature migration matrix
```

## License

MIT
