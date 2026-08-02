# TextMark architecture

TextMark replaces the original AppKit-only application with a portable Tauri 2 shell and a React/TypeScript workspace.

## Boundaries

- `src-tauri/`: trusted filesystem boundary, package metadata, native dialogs and bundle targets.
- `src/lib/markdown.ts`: deterministic Markdown-to-sanitized-HTML pipeline.
- `src/hooks/useDocument.ts`: document lifecycle and browser development fallback.
- `src/components/`: independent application surfaces for the toolbar, project tree, editor, preview and status bar.

The webview cannot read arbitrary local files. Relative image references are sent to `read_local_asset`, which canonicalizes the path, requires it to remain inside the current document directory, restricts file types and enforces an 8 MB limit. The result is returned as a data URL. This replaces the original application's temporary read-only entitlement for `/`.

## Rendering

1. Markdown-it parses CommonMark/GFM-style Markdown.
2. KaTeX renders dollar-delimited math.
3. Highlight.js highlights a deliberately small language allow-list.
4. DOMPurify removes scripts, frames, forms, style injection and event handlers.
5. Mermaid is dynamically imported only when the source contains a Mermaid fence, then its SVG is sanitized again.
6. React defers preview rendering so typing remains responsive.

## Platform packaging

Tauri builds the same core for:

- Windows: MSI and NSIS
- Linux: AppImage, DEB and RPM
- macOS: app bundle and DMG

Platform-specific integrations such as macOS Quick Look or Windows Explorer preview handlers should live in separate adapter packages. They must not be dependencies of the editor core.
