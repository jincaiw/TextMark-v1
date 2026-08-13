# Migration status

TextMark is a Tauri/React/Rust cross-platform implementation based on the MIT-licensed behavior of Markdown Preview. The authoritative, testable status is maintained in [`PARITY_V0.0.47.md`](PARITY_V0.0.47.md).

The previous v0.1.0 table used “Implemented” for configuration placeholders such as native preview extensions, updater signing and toolbar persistence. Those claims have been removed. A feature is now complete only when the behavior exists and its required local or native-host test passes.

v0.3.0 migrates settings from `textmark.settings.v1`/`v2` to a validated `textmark.settings.v3` schema. Locale, theme, content width, zoom, editor font size, update channel and valid toolbar items are retained; unknown toolbar identifiers are discarded. macOS Quick Look reads the same shared v3 preferences and falls back to v2 only when v3 is absent.

The renderer now returns a typed result containing sanitized HTML input, outline, frontmatter, source ranges, stable table-cell coordinates, task indices and optional-renderer requirements. The desktop preview, export path and system-preview hosts all consume this shared offline contract.

File watching no longer treats every filesystem notification as a generic reload. Atomic replacement keeps the original path, clean renames follow the destination, dirty renames/deletes require an explicit bilingual choice, and deletion can be recovered by Save As or recreating the original file.
