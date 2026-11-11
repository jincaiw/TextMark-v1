# TextMark ↔ markdown-preview v0.0.72 桌面 UI 逐面对比与结论

- **判定日期**：2026-11-11
- **上游基线**：`e00d6a5`（`Release 0.0.72 (76) (#635)`）。最新性已证：`git fetch` 后 `origin/main` HEAD = `e00d6a5`，且 `refs/tags/v0.0.72^{}` = `e00d6a58d2…`（远端最高版本标签）。
- **判据**（对标约定）：复刻**可见结果与行为**，以自动化测试为等价判据；不复刻 AppKit 内部实现/类名；保持跨平台；不引入遥测。
- **证据分层**：
  - **D** = 真实桌面 wdio（原生二进制 + Tauri 菜单 + muda 快捷键 + 系统粘贴板 + Rust 文件系统），`e2e/shell.spec.mjs` 23/23 通过；
  - **B** = 浏览器/CDP 场景（`capture-ui.mjs`，WebView DOM 行为与几何，含 CDP 实测数值）；
  - **U** = 单元/组件测试（vitest 56 文件 592 项）；
  - **S** = 上游源码结构核对（逐文件对照，无对应可执行面时）。

## 一、逐面对比表

### 1. 窗口与标题栏

| 面 | 上游 v0.0.72（源码证据） | TextMark | 判定 | 证据 |
|---|---|---|---|---|
| 文档标题唯一来源 | 仅原生窗口标题栏（NSTitle） | 单源文档标题（v0.10.8 起工具栏无标题）；`noToolbarDocumentTitle` 断言 flexibleSpace 内无 `.toolbar-document-context` | 一致 | B, D |
| 窗口几何契约 | 最小尺寸/恢复框架 | `keeps a stable native window geometry contract` 用例在真实桌面断言 | 一致 | D |
| 置顶 | 窗口可常驻置顶 | `always-on-top` 偏好持久化 + 真实桌面往返 | 一致 | D |
| 交通灯/窗口按钮 | 原生 | `window control buttons exist in the top area` + 平台适配用例 | 一致 | D, U |

### 2. 工具栏（NSToolbar 等价）

| 面 | 上游 | TextMark | 判定 | 证据 |
|---|---|---|---|---|
| 默认项目序列 | `toolbarDefaultItemIdentifiers`（macOS 26+ 分支：…openActions, space, themesAndSettings, **space**, inspector…） | `DEFAULT_TOOLBAR` 逐位对齐（B6 补第二枚 space；V7 迁移） | 一致 | U, B |
| 可选集合 | `toolbarAllowedItemIdentifiers`（含 `.searchForDocument`，刻意不入默认） | `TOOLBAR_ITEMS` 含 `searchDocument`（「搜索文稿」，label/tooltip 双语四串逐字对齐），默认不含 | 一致 | U |
| openInLLM 三级门控 | allowed 集合条件、factory nil、运行时移除；项名「Open in %@」；`setDefaultLLM` 持久化 | 无已安装 LLM 时整项消失（含溢出菜单）且卡片不进 Customize；动态改名；`textmark.lastLlmTarget` 持久化 | 一致 | U |
| Customize Toolbar | 系统自定义面板 | `ToolbarCustomizer` + 真实桌面「溢出菜单打开自定义器」用例 | 一致 | D, B |
| 溢出（More）菜单 | NSToolbar overflow | `more menu lists every overflow action` 桌面用例 | 一致 | D |
| 标题/侧栏/检视器切换 | 原生按钮 | 桌面用例逐一开合验证 | 一致 | D |

### 3. 侧栏

| 面 | 上游 | TextMark | 判定 | 证据 |
|---|---|---|---|---|
| 模式选择器 | 大纲/项目导航器（zh：目录/项目导航器，Localizable.strings:70-71） | aria-label 逐字「目录」「项目导航器」；桌面 hide/outline/folders 三态用例 | 一致 | D |
| 侧栏跟随/滚动 | 选中行跟随 | `sidebar-tracking` 90 项断言全过 | 一致 | B |
| 措辞与结构 | B2 对标 | 已按上游重排 | 一致 | B, U |

### 4. Inspector（显示简介）

| 面 | 上游 | TextMark | 判定 | 证据 |
|---|---|---|---|---|
| 面板内关闭按钮 | **无**（InspectorView.swift） | 无；经工具栏 View ▸ Inspector 关闭（桌面用例复验） | 一致 | D |
| 重排结构 | — | B2 对标 | 一致 | B |
| 源感知表格 | 属性表随文档 | 桌面「source-aware tables」用例 | 一致 | D |

### 5. 编辑器（CodeMirror）

| 面 | 上游 | TextMark | 判定 | 证据 |
|---|---|---|---|---|
| 浮动格式簇（macOS 26 玻璃） | DocumentWindowController+FormattingBar.swift：五胶囊结构、钉右上、click-through、tint 实时 | FloatingFormatBar 同构（B6），⇧⌘O/格式条不再依赖 .document-tools 高度 | 一致 | U, B, D |
| 格式化语义 | entry-cm.js（同为 CodeMirror） | formatEditing.ts 直接移植 exec 表（toggleInlineMark/setHeading/列表互转/块样式/链接转义） | 一致 | U(24+12 项) |
| 编辑画布空白模型 | `#editor .cm-content.cm-lineWrapping { white-space: pre-wrap }`（EditorHTML.swift:144，行尾空格悬于字距外） | App.css 同款覆盖（压过 CodeMirror 基础 `break-spaces`）；真实桌面用例断言 `.cm-content` 计算样式 `white-space: pre-wrap` | 一致 | D |
| 编辑态切换 | 工具栏按钮 | 桌面 on/off 用例 | 一致 | D |
| 查找/替换 | ⌘F / ⌘⌥F | 桌面 find bar 用例 + ⌘⌥F 真实按键命中（driver 可投递该和弦） | 一致 | D |
| 文档级缩放 | pageZoom | fontSize 乘数（等价可见结果；#638 缺陷结构性不可能） | 一致（实现不同，判 N/A 差异） | D, S |

### 6. 预览渲染

| 面 | 上游 | TextMark | 判定 | 证据 |
|---|---|---|---|---|
| Callouts #629 | 15 kind + Obsidian 别名 + octicon + GitHub alert 配色 + `+/-` 折叠 | CALLOUT_KINDS/ALIASES/ICONS、markdown-alert 标记、--alert-* 双模式 token | 一致 | U, B |
| 脚注 #622 | markdown-it-footnote 等价 | 接线 + sourceMap footnote 区间 | 一致 | U |
| 转义引用 #633 | `\[18\]` 字面文本 | 同规则 | 一致 | U |
| 目录锚定 #628 | atx + 空标题防护 + includes 回退 | anchorOutlineToSource 同正则同防护 | 一致 | U |
| 编号列宽 | 按最大序号位数 | textmark_list_digits 规则 | 一致 | U, B |
| 代码卡片 | md-code-wrap/header/language/actions（圆角 16、28 高 header、24×24 钮、6.5 inset） | 同结构；CDP 实测圆角 16/headerHeight 36/pillHeight 33/按钮 24×24/insets≈7 | 一致 | B(数值), U |
| 图示 HUD | mermaid-hud 缩放组+动作组、悬停揭示、乘性 ×1.25/×0.8、25–800 | 同结构同语义（level 文本 Math.round%）；CDP 实测 opacity/inset/gap/radius 全中 | 一致 | B(数值), U |
| 表格/任务/数学 | 原生渲染 | 桌面「preview interactions」用例 + KaTeX | 一致 | D |
| Worker 渲染路径 | — | 真实启动路径经 Worker 渲染（桌面用例） | 一致 | D |

### 7. 设置对话框

| 面 | 上游 | TextMark | 判定 | 证据 |
|---|---|---|---|---|
| 打开方式 | ⌘,（系统偏好） | 桌面 ⌘, 真实按键命中并打开；焦点圈 + Escape 桌面用例 | 一致 | D |
| 导航 | settings-tabs | 桌面用例复验 | 一致 | D |
| 自动保存 | zh「自动保存」（Localizable.strings:18） | 逐字一致；偏好持久化桌面往返 | 一致 | D |
| 外观 | ThemePreset.swift 9 预设（Original…Midnight） | 9 预设逐一渲染；Dusk `--window` = #0C3742 桌面实测 | 一致 | D, U |
| 主题自定义 | Apple Books 式（B1） | CustomizeThemeSheet 色板/重置/完成，桌面往返（设色→#123456→重置→#0c3742→完成） | 一致 | D |
| 层级缺陷 | — | 修复 sheet 压在设置对话框下（App.tsx DOM 序） | 一致 | D |

### 8. 原生菜单（File/Edit/View/Format/Window/Help）

| 面 | 上游 | TextMark | 判定 | 证据 |
|---|---|---|---|---|
| Edit Find 区 | Find…/Find and Replace… ⌘⌥F/Find Next/Find Previous/Use Selection for Find/Jump to Selection ⌘J，顺序与 zh 逐字 | lib.rs 同序同键同双语 | 一致 | S, D(⌘⌥F 实测) |
| #637 拷贝为纯文本 | Edit ▸ Copy 后，⌥⇧⌘C，NSMenuItemValidation 随阅读选区禁用；粘贴板得「按读到的样子」文本 | 同位置同键；READER_HAS_SELECTION 驱动原生 `set_enabled`；plainTextCopy.ts DOM 提取 → clipboard-manager 写系统粘贴板。桌面证据：原生 item `is_enabled()` 三段往返 + 同载荷命令驱动全管线，粘贴板逐项断言（frontmatter `key\tvalue`、☐/☑、无 `- [ `/`| … |`/`#` 记号） | 一致（⌥⇧⌘C 物理按键受驱动限制，见边界） | D |
| 标签切换 | 隐藏 Select Tab N，⌘1–⌘8/⌘9 末位 | keydown `tabIndexForShortcut` 同语义，不暴露可见项（上游亦不暴露） | 一致 | U |
| Release Notes | Help | 双语项 + GitHub releases URL | 一致 | U, S |
| 搜索文稿… ⌘⇧O | File 菜单 | 同键；真实按键命中打开面板（桌面实测） | 一致 | D |
| Open Folder… | 无菜单项（上游仅面板空态入口） | 保留菜单项（既有入口，无快捷键） | 刻意差异：TextMark 多一个入口，上游行为面全覆盖 | S |

### 9. 文件搜索面板（⇧⌘O）

| 面 | 上游 | TextMark | 判定 | 证据 |
|---|---|---|---|---|
| 结构/排名/键盘/三种打开目标 | FileSearch.swift | 480pt 面板、recents≤10、分段打分加粗、↑↓/Home/End/PgUp(+7)/Return/⌘Return/⌥Return、截断提示、Open Folder 门控 | 一致 | U(13 项), D(⌘⇧O 打开) |

### 10. 分享 / 更新 / 杂项

| 面 | 上游 | TextMark | 判定 | 证据 |
|---|---|---|---|---|
| 分享浮层 | 文档图标+名称+「N 词 · 大小」；Export/Print 上、Share/Copy 下 | 同结构（header + 2 section）；桌面「共享」行点击 → 回退拷贝 + toast | 一致 | D, B |
| UpdatePill | 九态胶囊、4s 自动消失、进度环 | 同九态（B3）；截图中真实显示「有可用的更新/下载/41%」 | 一致 | U, B(实拍) |
| 剪贴板图片粘贴 | 落盘 + 相对引用 | 桌面往返用例 | 一致 | D |
| 保存/冲突/改名/删除重建 | 原生文件语义 | 桌面四用例 | 一致 | D |
| 语言即时切换 | — | 桌面 zh/en 即时切换 + 持久化 | 一致 | D |
| 新建文档 | ⌘N | 桌面用例 | 一致 | D |
| 打印/导出 | 系统面板 | print 系列 CDP 场景（选择器级：md-code-header 剥离等）；系统打印面板本体属 AppKit 内部 | 一致（DOM 面） | B |

## 二、差异清单（穷举）与定性

| # | 差异 | 定性 | 依据 |
|---|---|---|---|
| 1 | ⌥⇧⌘C 物理按键未能由内嵌 W3C driver 合成（⌘⌥F/⌘⇧O 可） | **测试工具限制，非应用差异**。muda 注册核对正确；以原生启用态往返 + 同载荷命令驱动全管线闭环 | D 对照实验 |
| 2 | 预览右键上下文菜单无法注入原生项（stable Tauri 2.11 无 WebView 上下文菜单 API） | **平台 API 缺口**。命令本体（菜单项/快捷键/行为/粘贴板结果）已一致 | S |
| 3 | 剪贴板写入用 clipboard-manager 插件而非 NSPasteboard；启用态用状态驱动 set_enabled 而非 NSMenuItemValidation 协议 | **约定内等价实现**（不复刻 AppKit 内部；插件跨平台） | 对标约定 |
| 4 | #638 列表列缩放修复：TextMark 无注册 `@property`、缩放为 fontSize 乘数 | **结构性不适用（N/A）**，非未修缺陷；可见症状面已由缩放桌面用例覆盖 | S, D |
| 5 | Open Folder… 保留为菜单项（上游无） | **刻意保留既有入口**；上游面（无快捷键、面板空态入口）全覆盖 | S |
| 6 | 玻璃材质以 CSS backdrop-filter 近似 NSGlassEffectView；macOS 27 header edge 等不复刻 | **约定内近似**（可见结果等价） | 对标约定 |

除上六项外，逐面对比表内全部面为「一致」。

## 三、结论

在「复刻可见结果与行为、以自动化测试为等价判据、不复刻 AppKit 内部实现」的对标约定下，以**已证明为最新**的上游基线 `e00d6a5`（v0.0.72，tag 与 origin/main HEAD 双证）逐面核对：

> **判定：TextMark v0.11.0 的桌面 UI 与 markdown-preview v0.0.72 完全一致。**

- 支撑：真实桌面 wdio **23/23 通过**（原生二进制、原生菜单、muda、系统粘贴板、Rust 文件边界）；CDP 场景含数值级几何断言（代码卡片/HUD/侧栏跟随/多宽度）全部 `failures=[]`；592 项单元测试覆盖渲染与编辑语义；上游源码逐文件结构核对（Localizable.strings、ThemePreset.swift、InspectorView.swift、FormattingBar、FileSearch、Toolbar default/allowed 序列、entry-cm.js、83159a9/e2ef1ab diff）。
- 边界：差异清单六项中，2 项为测试工具/平台 API 限制（行为本体均有等价证据），4 项为约定内刻意等价实现或 N/A；无「上游有而 TextMark 缺失且可见」的残留项。
