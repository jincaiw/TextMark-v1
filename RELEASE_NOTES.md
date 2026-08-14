# TextMark v0.4.0

TextMark 0.4 closes the desktop UI/UX parity gap with Markdown Preview `v0.0.47`: the native menu now matches upstream (File/Edit/View/**Format**/**Go**/Window/Help), the toolbar splits Open With / Open in LLM and adds Export PDF with Safari-style discrete zoom, the inspector gains Document/Properties tabs, and Simplified Chinese wording is aligned to the upstream `zh-Hans` strings. It still defaults to Simplified Chinese and stays cross-platform (Windows/Linux/macOS).

TextMark 0.4 补齐了对 Markdown Preview `v0.0.47` 的桌面 UI/UX 对齐：原生菜单与上游一致（文件/编辑/显示/**格式**/**前往**/窗口/帮助），工具栏拆分“打开方式/在 LLM 中打开”并新增“导出 PDF”，缩放采用 Safari 式离散档，检查器改为“文稿/属性”双页签，简体中文措辞对齐上游 zh-Hans。默认中文、三平台（Windows/Linux/macOS）不变。

## Highlights / 主要更新

- 原生菜单补全：新增 **格式（Format）** 与 **前往（Go）** 菜单，File/View/App/Edit 补齐（新建标签页、关闭、复原到已存储、导出…、导出为 PDF…、外观、内容宽度、目录、项目导航器、Install CLI、崩溃报告开关、查找下一个/上一个）。
- macOS 标准快捷键：`⌥⌘0/1/2/3` 正文/标题、`⇧⌘M` 行内代码、`⇧⌘X` 删除线、`⇧⌘7/9/L` 列表、`⌃⌘1/2/3` 侧栏/目录/项目导航、`⌘T`/`⌘W` 标签。
- 工具栏：拆分 **打开方式（Open With）** 与 **在 LLM 中打开（Open in LLM）**，默认合并“打开”菜单（AI 应用在前）；新增 **导出 PDF** 项；缩放改用 Safari 式离散档。
- 检查器改为 **文稿 / 属性** 双页签（无 frontmatter 时显示“无前置元数据”）。
- 导出：新增 **导出…** 面板（PDF/HTML/PNG）与 **导出为 PDF…**。
- 首次启动询问设为默认 `.md` 打开方式；App 菜单新增 **安装命令行工具…**（`textmark`/`tm`/`text-mark`）。
- 简体中文措辞对齐上游 `zh-Hans`（标准/单词数/拷贝/边栏/在 LLM 中打开/无前置元数据/项目导航器等）。
- 设置 schema v3→v4：旧 `openWith` 自动迁移为合并的 `openActions`，保留既有布局。

## Trust notice / 安全提示

Same as v0.3.0 — no Apple Developer ID notarization or Windows Authenticode; verify `SHA256SUMS.txt`.

同 v0.3.0 —— 未使用 Apple Developer ID 公证或 Windows Authenticode；请核对 `SHA256SUMS.txt`。

---

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
