# TextMark v0.5.2

TextMark 0.5.2 fixes the toolbar and export regressions reported after 0.5.1: dropdown menus were clipped and invisible, the sidebar control could slide under the macOS traffic lights, narrow windows crowded the top bar, PNG/PDF exports rendered blank, and the toolbar customizer is now rebuilt pixel-aligned with the upstream AppKit customization sheet. Default Chinese and cross-platform support are unchanged.

TextMark 0.5.2 修复 0.5.1 后的顶栏与导出问题：下拉菜单被裁剪不可见、边栏控件可能与 macOS 交通灯重叠、窄窗顶栏拥挤、PNG/PDF 导出空白；自定义工具栏面板已按上游 AppKit 定制页像素级重做。默认中文、三平台不变。

## Highlights / 主要更新

- 修复工具栏下拉（边栏/打开方式/更多）被 `overflow:hidden` 裁剪导致"点击没反应"的问题。
- macOS 工具栏左侧预留 92px 交通灯安全区，边栏图标不再与关闭/最小化按钮重叠。
- 边栏下拉补齐三项：隐藏边栏 / 大纲 / 文件夹（对应上游 Hide Sidebar / Outline / Folders）。
- 溢出测量修正（先全显再测 + 同步隐藏），窄窗下自动把放不下的项收进"更多"菜单；搜索框 ≤1180px 折叠为图标。
- 导出 PNG/PDF 修复空白：回归活体节点渲染，暗色模式临时切浅色渲染后自动还原；PDF 多页切片保持。
- 自定义工具栏面板像素级对标上游：可用项目卡片区（图标+名称、点击/拖入添加）、当前工具栏行（拖拽排序、拖出/×移除）、显示模式（仅图标/图标与文字）、恢复默认、完成；工具栏命中区 36×32、图标 17px/1.7 描边、组内 2px/组间 8px 间距、hover 浅灰 bezel。

## Trust notice / 安全提示

Same as v0.5.1. 同 v0.5.1。

---

# TextMark v0.5.1

TextMark 0.5.1 fixes the desktop issues reported after 0.5.0: menu clicks firing multiple times (and toggle actions appearing dead), broken export/print, squeezed toolbar layout, missing zoom shortcut, English save dialogs, toolbar icon styling, and the outline/folder naming. It defaults to Simplified Chinese and stays cross-platform.

TextMark 0.5.1 修复 0.5.0 后的桌面问题：菜单点击多次触发/切换无效、导出打印无反应、顶栏挤占、缩放快捷键缺失、保存对话框英文、工具栏图标样式、大纲/文件夹命名。默认中文、三平台不变。

## Highlights / 主要更新

- 修复菜单事件监听器泄漏（一次性订阅），"切换编辑模式/边栏/显示工具栏/显示简介/崩溃报告"单击生效，存储/存储为 不再多次弹窗。
- 导出 HTML/PNG 走原生保存对话框 + Rust 安全写盘；导出 PDF 生成多页 PDF；打印在 macOS 生成 PDF 预览并打开（WKWebView 不支持 window.print()），Windows/Linux 仍走原生打印。
- 顶栏加入 AppKit 式溢出管理：窗口缩小时自动把放不下的项收进"更多"菜单，标题/窗口控制不再挤占。
- 菜单"放大"快捷键修复（`CmdOrCtrl++`），macOS 菜单正确显示 ⌘+/⌘−/⌘0。
- macOS 应用包加入 zh-Hans 本地化（lproj + CFBundleLocalizations），原生打开/保存对话框显示中文。
- 工具栏/格式栏重做为上游 Preview 风格：裸图标、悬停才显示底色、组内紧凑间距 + 细分隔线。
- 中文"目录→大纲、项目导航器→文件夹"，英文同步 "Outline / Folders"。

## Trust notice / 安全提示

Same as v0.5.0. 同 v0.5.0。

---

# TextMark v0.5.0

TextMark 0.5 completes the second-round desktop UI/UX deep-check against the latest Markdown Preview `main` (v0.0.47 + #278 double-tilde strikethrough + #273 Quick Look cursor feedback). Default Chinese and cross-platform (Windows/Linux/macOS) are unchanged.

TextMark 0.5 完成第二轮桌面 UI/UX 深检对齐（对标最新 Markdown Preview `main`：v0.0.47 + #278 删除线双波浪线 + #273 Quick Look 光标反馈）。默认中文、三平台不变。

## Highlights / 主要更新

- 查找栏对齐上游：`Match:` 标签 + **包含 / 开头为** 两个 toggle 按钮、**完成** 按钮、"未找到"状态（保留 X of N 计数、脉冲高亮、Enter 循环）。
- 工具栏：窄窗搜索框**折叠为放大镜图标**；Open Actions 菜单带应用字母徽标 + 默认勾选 + 空态文案；Copy 项点击后图标 **✓ 反馈 1.2s**；Edit 项 tooltip 随状态切换。
- 项目导航器右键新增 **使用外部编辑器打开** + **打开方式** 子菜单。
- 菜单：外观/内容宽度/边栏三态显示当前值勾选（`refresh_menu`）；新增 **打开最近使用**（`record_recent_file` + 清除菜单）；OS 窗口标题改为文件名（— 已编辑）。
- 预览支持轨道板捏合 / ⌘ 滚轮离散缩放。
- Open in LLM 超 12,000 字符时改走"拷贝全文 + 打开应用"回退并提示。
- 导出为 PDF 保持阅读预览的浅/深色与 820px 版心（区别于纸张式"打印…"）。
- macOS Quick Look 新增原生文本选择与光标区域反馈（iBeam/链接手型，ViewBridge 光标桥接）。
- 新增删除线 parity 测试（`~~` 渲染删除线、`~` 保留字面）。

## Trust notice / 安全提示

Same as v0.4.0 — no Apple Developer ID notarization or Windows Authenticode; verify `SHA256SUMS.txt`. 同 v0.4.0 —— 未使用 Apple 公证/Authenticode；请核对 `SHA256SUMS.txt`。

---

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
