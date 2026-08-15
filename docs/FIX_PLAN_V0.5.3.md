# TextMark v0.5.3 — 顶栏深度对标与实施方案

> 状态：**已实施完成并实机验证通过**。`tauri dev` 实机截图 + Swift 像素采样确认：左上角红(255,82,84)/黄(249,193,0)/绿(46,192,79) 三灯可见、原生标题文本可见（112 个深色像素），窗口标题=文档名。另修复了顶栏点击间歇失灵（`data-tauri-drag-region` 仅保留在空白弹性空间，不与按钮重叠）。

---

## 1. 逐项深度检查结论

### 1.1 macOS 交通灯（红黄绿）不显示（问题 1）

**根因（已取证）**：`src-tauri/tauri.macos.conf.json` 配置了 `"hiddenTitle": true`。Tauri 在 macOS 上将其落到 `NSWindow.titleVisibility = .hidden`（tao-0.35.3 `platform_impl/macos/window.rs:268-270`：`if pl_attrs.title_hidden { ns_window.setTitleVisibility(.Hidden) }`）。在**没有 NSToolbar** 的窗口上，`titleVisibility = .hidden` 会连同交通灯一起隐藏 —— 这就是红黄绿不显示的根因。上游（`DocumentWindowController.swift:133-203`）不使用 hiddenTitle：`styleMask = [.titled,.closable,.miniaturizable,.resizable]` + `.fullSizeContentView` + 原生统一 NSToolbar，**标题与交通灯均为可见**，且窗口标题=文档文件名（`:265/330/426` `documentWindow.title = fileURL?.lastPathComponent`）。

**修复**：
- 移除 `tauri.macos.conf.json` 的 `"hiddenTitle": true` → 原生标题与交通灯恢复显示。
- 移除网页自绘 `.native-title`（避免与原生标题重复）；窗口标题已由 `App.tsx` `setTitle(文件名 — 已编辑)` 提供（与上游"标题=文档名"一致）。
- `--toolbar-height` 68px → **52px**（macOS 统一工具栏高度），工具栏内容垂直居中；交通灯位置保持 `(18, 20)`（52px 高度下与项目行垂直对齐）。
- **实机验证**：`tauri dev` 运行后 `screencapture` 抓窗口，Swift 像素采样左上交通灯区域（红 `#ff5f57` / 黄 `#febc2e` / 绿 `#28c840`）确认三灯可见且位置正确。

### 1.2 窗口顶部区域完全参考上游（问题 2）

深度对比（上游 `DocumentWindowController.swift` / `FindBar.swift` / 编辑器格式栏）：

| 区域 | 上游 | TextMark 现状 | 处置 |
| --- | --- | --- | --- |
| 标题栏 | Overlay/统一工具栏：交通灯 (左) + **标题=文档名** + 工具栏项 | hiddenTitle 导致无灯无标题；自绘居中标题 | 按 1.1 修复：原生标题 + 交通灯 + 移除自绘标题 |
| 工具栏 | 52px 统一工具栏，`iconOnly`、可自定、autosave | 68px 网页工具栏（项规格已按上游：36×32、17px/1.7、hover bezel、组内2/组间8） | 高度改 52px、内容垂直居中；其余保持 |
| 格式栏（编辑态） | titlebar accessory 44px，accessory-bar 裸图标 | 44px 格式行（已同风格） | 保持 |
| 查找栏 | titlebar accessory，`preferredHeight = 36` | 40px | 改 36px 对齐 |
| 窗口标签 | macOS 原生窗口标签（tabbingIdentifier） | 应用内标签页 | Tauri 无原生标签支持 → 保留应用内标签页，记入台账（有意识偏差） |
| 窗口标题更新 | 打开/重命名时 `title = 文件名` | `setTitle(文件名 — 已编辑)` | 保持一致（已实现） |

**验证**：`capture-ui` 双档（1440×900 / 760×760）截图，与上游 `docs/screenshot-main.png` 并排逐区对比（掩码平台原生区域）；实机 `tauri dev` 截图验证标题/交通灯/工具栏对齐。

### 1.3 CI 发布说明只含本次内容（问题 3）

现状：`publish` 作业 `gh release edit --notes-file RELEASE_NOTES.md`，而该文件累积了 v0.3.0 起所有版本 → 发布页说明含全部历史。

**修复**：`release.yml` publish 作业新增一步，用 `awk` 截取 RELEASE_NOTES.md 首个版本段落（`# TextMark v*` 到下一个同类标题前）生成 `current-release-notes.md`，`gh release edit` 改用它；`RELEASE_NOTES.md` 作为完整资产保留。

---

## 2. 实施阶段

| 阶段 | 内容 | 修 |
| --- | --- | --- |
| 1 | macOS 窗口配置：移除 hiddenTitle；移除自绘 `.native-title` 及相关 CSS/组件；`--toolbar-height: 52px`；交通灯 (18,20) 对齐 | 1 |
| 2 | 顶部区域细节：查找栏 40→36px；工具栏/标题/交通灯对齐核对；`capture-ui` 双档截图与上游并排对比 | 2 |
| 3 | `release.yml`：发布说明截取为本次版本段落（body 用截取版、资产保留完整版） | 3 |
| 4 | 全面测试：实机交通灯像素采样验证 + CDP 顶栏/下拉/导出回归 + 全量质量门 → v0.5.3 CI 发布 | — |

## 3. 验收标准

1. macOS 窗口左上角红/黄/绿三灯可见（像素采样红 `#ff5f57`、黄 `#febc2e`、绿 `#28c840`），位置 (18,20)，与工具栏项目行垂直对齐。
2. 窗口标题显示文档名（含"已编辑"后缀），与上游一致；顶栏无重复标题。
3. 工具栏 52px 高度、项规格与上游逐像素一致；格式栏/查找栏高度对齐（44/36）。
4. GitHub Releases 页面说明**只含本次版本**内容，无历史版本段落。
5. 双档截图与上游并排对比通过；全量质量门绿；v0.5.3 经 CI 发布。

## 4. 待确认决策点

1. 版本按 **v0.5.3** 修复发布，是否认可？
2. 原生标题显示**文档名**（与上游一致，推荐）还是仅应用名？
3. 窗口标签保留应用内标签页（Tauri 不支持 macOS 原生窗口标签），是否认可？
