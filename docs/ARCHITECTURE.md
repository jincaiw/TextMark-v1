# TextMark architecture

TextMark replaces the original AppKit-only application with a portable Tauri 2 shell and a React/TypeScript workspace.

## Boundaries

- `src-tauri/`: trusted filesystem boundary, package metadata, native dialogs and bundle targets.
- `src/workers/render.worker.ts`: off-main-thread Markdown parsing and source-map generation.
- `src/lib/sanitize.ts`: the main-thread HTML trust boundary used before DOM insertion and export.
- `src/hooks/useDocument.ts`: multi-session document lifecycle, native watcher reconciliation, atomic-save conflicts, history and browser development fallback.
- `src/components/`: independent application surfaces for the toolbar, project tree, editor, preview and status bar.

The webview cannot read arbitrary local files. Relative image references are sent to `read_local_asset`, which canonicalizes the path, requires it to remain inside the opened project (or the current document directory for a standalone file), resolves symlinks before the boundary check, restricts file types and enforces an 8 MB limit. The result is returned as a data URL. This replaces the original application's temporary read-only entitlement for `/`.

## Rendering

1. Markdown-it parses CommonMark/GFM-style Markdown.
2. KaTeX renders dollar-delimited math.
3. Highlight.js highlights a deliberately small language allow-list.
4. A dedicated Worker emits HTML plus outline, table, task and source-range metadata.
5. DOMPurify removes scripts, frames, forms, style injection and event handlers on the main thread.
6. Mermaid is dynamically imported only when the source contains a Mermaid fence, then its SVG is sanitized again.
7. The preview owns its incremental DOM subtree. It preserves disclosure/Mermaid state, source coordinates and editable table nodes while React applies only the latest render sequence.

Optional KaTeX, Mermaid, syntax highlighting, CodeMirror and Sentry chunks are excluded from the initial preview path. The bundle gate caps the combined preview bootstrap and render Worker at 300 KiB gzip.

## Platform packaging

Tauri builds the same core for:

- Windows: x64/ARM64 MSI, NSIS and portable ZIP
- Linux: AppImage, DEB and RPM
- macOS: Universal 2 app bundle, DMG and updater archive

Platform-specific adapters reuse the offline `preview.html` renderer without becoming dependencies of the editor core:

- macOS packages a Universal 2 Quick Look app extension, with Xcode host tests for Chinese Markdown, appearance migration and guarded relative images.
- Windows packages architecture-matched COM preview-handler DLLs with WebView2, MSI/NSIS registration tests and an out-of-process host smoke test.
- Linux packages a Freedesktop thumbnailer/MIME/desktop action for DEB/RPM and a KDE 6 `KIO::ThumbnailCreator` plugin in RPM. AppImage stays portable and does not modify host configuration.

The formal release job depends on every native build, install, host, registration and uninstall test. A successfully compiled installer alone is not a release pass.
