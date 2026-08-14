# TextMark v0.4.0 — 桌面 UI 逐项对标明细

> 状态：**已实施**。本文档为 v0.4.0 桌面 UI 对齐的唯一真源；各节所列菜单/工具栏/检查器/快捷键/措辞均已落地，Rust `build_menu` 与 `src/` 组件逐项对应。

> 依据 `pluk-inc/markdown-preview@v0.0.47` 源码逐项核对：`AppDelegate.swift`（菜单）、`DocumentWindowController.swift`（工具栏）、`MainMenu.xib` + `*.lproj/MainMenu.strings`、`*.lproj/Localizable.strings`、`InspectorView.swift`、`EditorViewController.swift`（格式化栏）。
> 本文件是 v0.4.0 实施的唯一真源（source of truth），实现后逐项勾验。

---

## 1. 菜单（Menu）

上游顶栏顺序：`App(仅 macOS) → File → Edit → View → Format → Go → Window → Help`。

### 1.1 Format（格式）— 当前缺失，需新增

| 项 | 命令 | 快捷键 | en | zh-CN |
| --- | --- | --- | --- | --- |
| Body | h0 | ⌥⌘0 | Body | 正文 |
| Heading 1 | h1 | ⌥⌘1 | Heading 1 | 标题 1 |
| Heading 2 | h2 | ⌥⌘2 | Heading 2 | 标题 2 |
| Heading 3 | h3 | ⌥⌘3 | Heading 3 | 标题 3 |
| — | — | — | — | — |
| Bold | bold | ⌘B | Bold | 粗体 |
| Italic | italic | ⌘I | Italic | 斜体 |
| Strikethrough | strikethrough | ⇧⌘X | Strikethrough | 删除线 |
| Inline Code | code | ⇧⌘M | Inline Code | 行内代码 |
| Link | link | ⌘K | Link | 链接 |
| — | — | — | — | — |
| Bulleted List | bulletList | ⇧⌘7 | Bulleted List | 项目符号列表 |
| Numbered List | orderedList | ⇧⌘9 | Numbered List | 编号列表 |
| Checklist | taskList | ⇧⌘L | Checklist | 任务列表 |
| Block Quote | quote | ⌘' | Block Quote | 引用 |

> 菜单命令直接复用现有 `FormatCommand`（`h0..h3/bold/italic/strikethrough/code/link/bulletList/orderedList/taskList/quote`）。

### 1.2 Go（前往）— 当前缺失，需新增

| 项 | 动作 | 快捷键 | en | zh-CN |
| --- | --- | --- | --- | --- |
| Up | scrollLineUp | ↑ | Up | 向上 |
| Down | scrollLineDown | ↓ | Down | 向下 |
| Page Up | scrollPageUp | PageUp | Page Up | 上一页 |
| Page Down | scrollPageDown | PageDown | Page Down | 下一页 |
| — | — | — | — | — |
| Previous Item | 上一个标题 | ⌥↑ | Previous Item | 上一项 |
| Next Item | 下一个标题 | ⌥↓ | Next Item | 下一项 |
| — | — | — | — | — |
| Top of Document | 文首 | ⌘↑ | Top of Document | 文稿开头 |
| Bottom of Document | 文末 | ⌘↓ | Bottom of Document | 文稿结尾 |

> 上游 `Previous/Next Item` = 跳到上/下一个标题（`mdScrollPreviousHeading`/`mdScrollNextHeading`），对应 TextMark 目录中的前/后标题跳转。

### 1.3 View（显示）— 补齐子项

最终顺序（上游运行时组装）：**Appearance(外观) → Content Width(内容宽度) → Show Toolbar → Customize Toolbar… → Toggle Sidebar(⌘L) → Hide Sidebar(⌃⌘1) → Table of Contents(⌃⌘2) → Project Navigator(⌃⌘3) → [sep] → Actual Size(⌘0)/Zoom In(⌘+)/Zoom Out(⌘−) → Toggle Edit Mode(⌘E) → [sep] → Enter Full Screen**。

| 项 | 快捷键 | 动作 | en | zh-CN |
| --- | --- | --- | --- | --- |
| Appearance ▸ Automatic/Light/Dark | — | 主题（勾选态） | Appearance / Automatic / Light / Dark | 外观 / 自动 / 浅色 / 深色 |
| Content Width ▸ Normal/Full Width | — | 版心（勾选态） | Content Width / Normal / Full Width | 内容宽度 / 标准 / 全宽 |
| Show Toolbar | — | 显示工具栏 | Show Toolbar | 显示工具栏 |
| Customize Toolbar… | — | 自定 | Customize Toolbar… | 自定工具栏… |
| Toggle Sidebar | ⌘L | 切侧栏 | Toggle Sidebar | 切换边栏 |
| Hide Sidebar | ⌃⌘1 | 隐藏侧栏（勾选态=隐藏） | Hide Sidebar | 隐藏边栏 |
| Table of Contents | ⌃⌘2 | 目录（勾选态） | Table of Contents | 目录 |
| Project Navigator | ⌃⌘3 | 项目导航（勾选态） | Project Navigator | 项目导航器 |
| Actual Size / Zoom In / Zoom Out | ⌘0 / ⌘+ / ⌘− | 缩放 | … | 实际大小 / 放大 / 缩小 |
| Toggle Edit Mode | ⌘E | 编辑 | Toggle Edit Mode | 切换编辑模式 |
| Enter Full Screen | ⌃⌘F | 全屏 | Enter Full Screen | 进入全屏幕 |

### 1.4 File（文件）— 补齐子项

| 项 | 快捷键 | en | zh-CN |
| --- | --- | --- | --- |
| New Tab | ⌘T | New Tab | 新建标签页 |
| Open… | ⌘O | Open… | 打开… |
| Open Recent ▸ … | — | Open Recent | 打开最近 |
| Close | ⌘W | Close | 关闭 |
| Save… | ⌘S | Save… | 存储…（对齐上游 zh-Hans 用"存储"，见 §5） |
| Save As… | ⇧⌘S | Save As… | 另存为… |
| Revert to Saved | — | Revert to Saved | 恢复为已存储 |
| Export… | — | Export… | 导出… |
| Export as PDF… | — | Export as PDF… | 导出为 PDF… |
| Share | — | Share | 共享 |
| Print… | ⌘P | Print… | 打印… |

### 1.5 Edit（编辑）— 补齐子项

上游含：Undo(⌘Z)、Redo(⇧⌘Z)、Cut(⌘X)、Copy(⌘C)、Paste(⌘V)、Paste and Match Style(⌥⇧⌘V)、Delete、Select All(⌘A)、Find 子菜单（Find…⌘F / Find and Replace… / Find Next⌘G / Find Previous⇧⌘G / Use Selection for Find / Jump to Selection）。TextMark 精简为：Undo/Redo/Cut/Copy/Paste/Paste and Match Style/Delete/Select All/Find…/Find Next/Find Previous/Toggle Edit Mode/Preferences。

### 1.6 App（macOS）— 补齐子项

About → Check for Updates… → **Install CLI…** → **Send Anonymous Crash Reports(勾选)** → Preferences(⌘,) → Services → Hide/Hide Others/Show All → Quit。Windows/Linux 将 Install CLI 与崩溃报告开关放 Help/设置 等价位置。

---

## 2. 工具栏（Toolbar）

### 2.1 默认集合（上游）

```
[flexibleSpace, sidebarMenu, sidebarTrackingSeparator, navigation,
 flexibleSpace, openActions, space, zoom, inspector, share, edit, search]
```

### 2.2 可自定集合（上游 allowed）

`sidebarMenu, sidebarTrackingSeparator, navigation, flexibleSpace, space, openActions, openWith, openInLLM, edit, inspector, share, search, print, exportPDF, exportDocument, copy, zoom`

（`openInLLM` 仅在检测到 LLM 应用时出现。）

### 2.3 项元数据（label / palette / tooltip）

| 项 | en label | tooltip | zh-CN label |
| --- | --- | --- | --- |
| sidebarMenu | Sidebar | Sidebar options | 边栏 |
| navigation | Navigation | Back and Forward | 导航 |
| openActions | Open | Open document in another app | 打开 |
| openWith | Open With | Open in another editor | 打开方式 |
| openInLLM | Open in LLM | Open document in an LLM app | 在 LLM 中打开 |
| edit | Edit | Edit document / Stop editing and return to preview | 编辑 |
| inspector | Inspector | Show the inspector | 检查器（palette: 显示简介） |
| share | Share | Share document | 共享 |
| search | Search | Search in Document | 搜索 |
| print | Print | Print document | 打印 |
| exportPDF | Export PDF | Export document as PDF | 导出 PDF |
| exportDocument | Export | Export document | 导出 |
| copy | Copy | Copy Markdown source to clipboard | 拷贝 |
| zoom | Zoom | Zoom Out / Zoom In | 缩放 |

### 2.4 Open Actions 合并菜单行为

- 无文档：禁用项「No document open / 未打开文稿」。
- 无可用 App：禁用项「No apps available / 没有可用的 App」。
- 段序：**「AI Apps / AI 应用」在前**，「Editors / 编辑器」在后；每段带 16px 应用图标；默认目标带勾选态。
- 主按钮点击 = 首选目标（LLM 优先于编辑器；记住上次选择）。

### 2.5 缩放

工具栏缩放必须走 Safari 式离散档（当前键盘用的 `ZOOM_STOPS`），**不能用 ±10**。

---

## 3. 检查器（Inspector）

上游为 **Document / Properties 双页签**（原生分段控件 + SF Symbol `doc`/`info`）。

- **Document**：File Name、Document Type(Markdown Document)、File Size、Words、Characters、Lines、Headings、Links、Images、Modified。
- **Properties**：frontmatter 键值；无 frontmatter 时整页占位「No frontmatter / 无前置元数据」。

---

## 4. 键盘快捷键汇总（编辑/预览态）

| 组合 | 动作 |
| --- | --- |
| ⌘E | 切换编辑模式 |
| ⌘S / ⇧⌘S | 保存 / 另存为 |
| ⌘O / ⇧⌘O | 打开文件 / 文件夹 |
| ⌘T / ⌘W | 新建标签 / 关闭标签 |
| ⌘F / ⌘G / ⇧⌘G | 查找 / 下一个 / 上一个 |
| ⌘L | 切换侧栏 |
| ⌃⌘1 / ⌃⌘2 / ⌃⌘3 | 隐藏侧栏 / 目录 / 项目导航 |
| ⌥⌘0 / ⌥⌘1 / ⌥⌘2 / ⌥⌘3 | 正文 / 标题1 / 标题2 / 标题3 |
| ⌘B / ⌘I / ⇧⌘X / ⇧⌘M / ⌘K | 粗体 / 斜体 / 删除线 / 行内代码 / 链接 |
| ⇧⌘7 / ⇧⌘9 / ⇧⌘L / ⌘' | 列表 / 编号 / 任务 / 引用 |
| ⌘+ / ⌘− / ⌘0 | 放大 / 缩小 / 实际大小 |
| ⌘[ / ⌘] | 后退 / 前进 |
| ⌘, | 偏好设置 |

---

## 5. 简体中文措辞对齐表（`i18n.ts`）

| 键 | 上游 zh-Hans | 当前 | 改后 |
| --- | --- | --- | --- |
| normal | 标准 | 正常 | 标准 |
| words | 单词数 | 字词 | 单词数 |
| openInLlm | 在 LLM 中打开 | 在 AI 应用中打开 | 在 LLM 中打开 |
| projectNavigator | 项目导航器 | 项目导航 | 项目导航器 |
| copy / copied / copySource | 拷贝 / 已拷贝 / 将 Markdown 源文本拷贝到剪贴板 | 复制 / 已复制 / 复制源文件 | 拷贝 / 已拷贝 / 将 Markdown 源文本拷贝到剪贴板 |
| sidebar | 边栏 | 侧栏 | 边栏 |
| noFrontmatter | 无前置元数据 | 无 Frontmatter | 无前置元数据 |
| frontmatter | （属性页语境） | Frontmatter | 属性（页签名 Properties=属性） |
| getInfo | 显示简介 | 简介/显示简介(混) | 显示简介 |
| beginsWith | 开头为 | 开头匹配 | 开头为 |
| save | 存储 | 保存 | 存储 |
| saveAs | 另存为… | 另存为… | 另存为…（不变） |
| find | 查找 | 查找 | 查找 |
| showInFinder | 在"访达"中显示 | 在文件管理器中显示 | 平台化：访达/资源管理器/文件管理器 |

> 平台术语（访达/资源管理器/文件管理器）随 OS 取值，语义对齐上游。

---

## 6. 桌面外观（chrome/layout）

已见 `VISUAL_SPEC.md`（68px 主工具栏 / 44px 格式行 / 40px 查找行 / 侧栏 300px / 检查器 292px / 820px 版心 / `#0a84ff` 强调 / 浅色纯白页 / 深色 `#202124`）。v0.4.0 保持该视觉基线，仅按本文件调整菜单/工具栏/检查器/措辞/快捷键，不改变版式令牌。
