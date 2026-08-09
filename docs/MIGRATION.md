# Migration status

TextMark is a Tauri/React/Rust cross-platform implementation based on the MIT-licensed behavior of Markdown Preview. The authoritative, testable status is maintained in [`PARITY_V0.0.47.md`](PARITY_V0.0.47.md).

The previous v0.1.0 table used “Implemented” for configuration placeholders such as native preview extensions, updater signing and toolbar persistence. Those claims have been removed. A feature is now complete only when the behavior exists and its required local or native-host test passes.

v0.2.0 migrates settings from `textmark.settings.v1` to a validated `textmark.settings.v2` schema. Locale, theme, content width, zoom, editor font size and valid toolbar items are retained; unknown toolbar identifiers are discarded.
