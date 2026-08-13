# TextMark v0.3.0

TextMark 0.3 completes the full cross-platform implementation of the frozen Markdown Preview `v0.0.47` parity baseline. It defaults to Simplified Chinese and can switch to English immediately and persistently.

TextMark 0.3 完成了对冻结 Markdown Preview `v0.0.47` 基线的跨平台全量实现。首次启动默认简体中文，可即时切换 English 并持久保存。

## Highlights / 主要更新

- Native file watching with correct atomic replacement, rename, deletion and dirty-conflict recovery.
- Incremental Worker rendering that preserves disclosure and Mermaid state; stable task, footnote and table source coordinates.
- Editable table headers/cells, rectangular selection and complete row/column operations in the shared undo history.
- Self-contained HTML with inlined local resources, light print/PDF output and continuous 2× PNG export.
- macOS Universal 2 Quick Look extension, Windows x64/ARM64 Explorer Preview Handler, Freedesktop thumbnails/actions and KDE 6 thumbnail support.
- Windows x64/ARM64 MSI, NSIS and portable ZIP (including `textmark`, `tm` and `text-mark` launchers); Linux x64/ARM64 AppImage, DEB and RPM; macOS Universal 2 DMG and updater archive.
- Formal non-prerelease publishing is blocked until every native host, installer, registration, uninstall, architecture and signed-updater gate passes.
- Signed Tauri updater metadata, SHA-256 checksums and CycloneDX SBOM.
- Separate stable and opt-in `textmark-beta` signed update channels.

## Trust notice / 安全提示

This release does not use Apple Developer ID notarization or Windows Authenticode. macOS may show a Gatekeeper warning and Windows may show SmartScreen. The macOS app uses ad-hoc runtime signing. Verify downloads with `SHA256SUMS.txt` before opening them.

此版本未使用 Apple Developer ID 公证或 Windows Authenticode。macOS 可能显示 Gatekeeper 提示，Windows 可能显示 SmartScreen 提示；macOS 应用采用 ad-hoc 运行签名。请在打开安装包前使用 `SHA256SUMS.txt` 核对文件。

Updater artifacts remain independently signed and are rejected by TextMark if their updater signature is invalid.

应用内更新产物使用独立签名；签名无效时 TextMark 会拒绝安装更新。
