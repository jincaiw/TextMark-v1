# TextMark architecture

TextMark replaces the original AppKit-only application with a portable Tauri 2 shell and a React/TypeScript workspace.

## Boundaries

- `src-tauri/`: trusted filesystem boundary, package metadata, native dialogs and bundle targets.
- `src/workers/render.worker.ts`: off-main-thread Markdown parsing and source-map generation.
- `src/lib/sanitize.ts`: the main-thread HTML trust boundary used before DOM insertion and export.
- `src/hooks/useDocument.ts`: multi-session document lifecycle, atomic-save conflicts, history and browser development fallback.
- `src/components/`: independent application surfaces for the toolbar, project tree, editor, preview and status bar.

The webview cannot read arbitrary local files. Relative image references are sent to `read_local_asset`, which canonicalizes the path, requires it to remain inside the opened project (or the current document directory for a standalone file), resolves symlinks before the boundary check, restricts file types and enforces an 8 MB limit. The result is returned as a data URL. This replaces the original application's temporary read-only entitlement for `/`.

## Rendering

1. Markdown-it parses CommonMark/GFM-style Markdown.
2. KaTeX renders dollar-delimited math.
3. Highlight.js highlights a deliberately small language allow-list.
4. A dedicated Worker emits HTML plus outline, table, task and source-range metadata.
5. DOMPurify removes scripts, frames, forms, style injection and event handlers on the main thread.
6. Mermaid is dynamically imported only when the source contains a Mermaid fence, then its SVG is sanitized again.
7. React applies the latest render sequence inside a transition, so stale Worker results cannot replace newer edits.

## Platform packaging

Tauri builds the same core for:

- Windows: x64/ARM64 MSI, NSIS and portable ZIP
- Linux: AppImage, DEB and RPM
- macOS: Universal 2 app bundle, DMG and updater archive

Platform-specific integrations such as macOS Quick Look or Windows Explorer preview handlers live in separate adapter packages and must not become dependencies of the editor core. Their status is intentionally tracked separately in the parity ledger until native-host verification is green.
