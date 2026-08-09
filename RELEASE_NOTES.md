# TextMark v0.2.0

TextMark 0.2 is the first stable cross-platform release built from the frozen Markdown Preview parity baseline. It defaults to Simplified Chinese and can switch to English at runtime.

TextMark 0.2 是基于冻结 Markdown Preview 对标基线完成的首个跨平台正式版。首次启动默认简体中文，可在设置中即时切换 English。

## Highlights / 主要更新

- Multi-document tabs, folder navigation, dirty-state protection, atomic saves and external-change conflict handling.
- Worker-based offline Markdown rendering with GFM, TOC, alerts, footnotes, KaTeX, Mermaid, frontmatter and source-aware table editing.
- Customizable persistent toolbar, inspector, advanced find, 50–300% zoom, dark/light/system appearance and bilingual native menus.
- Print/PDF, self-contained HTML and 2× PNG export.
- Windows x64/ARM64 MSI, NSIS and portable ZIP; Linux x64/ARM64 AppImage, DEB and RPM; macOS Universal 2 DMG and updater archive.
- Signed Tauri updater metadata, SHA-256 checksums and CycloneDX SBOM.
- Separate stable and opt-in `textmark-beta` signed update channels.

## Trust notice / 安全提示

This release does not use Apple Developer ID notarization or Windows Authenticode. macOS may show a Gatekeeper warning and Windows may show SmartScreen. The macOS app uses ad-hoc runtime signing. Verify downloads with `SHA256SUMS.txt` before opening them.

此版本未使用 Apple Developer ID 公证或 Windows Authenticode。macOS 可能显示 Gatekeeper 提示，Windows 可能显示 SmartScreen 提示；macOS 应用采用 ad-hoc 运行签名。请在打开安装包前使用 `SHA256SUMS.txt` 核对文件。

Updater artifacts remain independently signed and are rejected by TextMark if their updater signature is invalid.

应用内更新产物使用独立签名；签名无效时 TextMark 会拒绝安装更新。
