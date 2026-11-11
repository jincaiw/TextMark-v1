# TextMark 桌面 UI 对标 v0.0.72 交付记录

- **项目**：TextMark-v1
- **参照应用**：pluk-inc/markdown-preview
- **参照版本**：`v0.0.72`，固定提交 [`e00d6a5`](https://github.com/pluk-inc/markdown-preview/tree/e00d6a5)（`Release 0.0.72 (76) (#635)`）。**最新性证明**（2026-11-11）：`git fetch origin main` 后 `origin/main` HEAD 即 `e00d6a5`，且远端标签 `refs/tags/v0.0.72^{}` 解析为同一提交 `e00d6a58d2afc3b5a907f4d72c5d086af7073913`；`v0.0.72` 为远端最高版本标签。上一基线 `d0c6197`（v0.0.71）到 `e00d6a5` 之间仅两个功能提交：`83159a9` #637 Copy as Plain Text（本批移植）、`e2ef1ab` #638 编辑器缩放列表列修复（对 TextMark 不适用，见 B7 细节）。本轮以该固定提交的源码为结构事实，不据历史截图推断最新版布局。
- **TextMark 交付版本**：`v0.11.0`（基线 `v0.10.8`；B7 批次以 `v0.11.0` 发布）。
- **对标约定**：复刻可见结果与行为，以自动化测试作为等价判据；不复刻 AppKit 内部实现/类名；保持跨平台（Windows/Linux/macOS）；不引入分析遥测。
- **文档版本**：交付记录 `v1.3`（2026-11-11；基线升至 v0.0.72 并给出最新性证明，补记 B7 批次：callouts、脚注、目录锚定、转义引用、编号列宽、#637 Copy as Plain Text，以及真实桌面 wdio 全套通过的门禁证据）。

## 批次总览

| 批次 | 范围 | 主要交付 | 状态 |
|---|---|---|---|
| B1 | 阅读外观 / 主题自定义 | CustomizeThemeSheet（Apple Books 式字体列表、四个颜色槽、字距/词距/页边距滑杆）、designTokens 字体族、theme 预设与调色板解析、settings 阅读字体与布局区间 | 浏览器组件回归通过 |
| B2 | 侧栏 / Inspector / 设置 | 侧栏措辞与结构对标、Inspector 重排、SettingsDialog 重构 | 浏览器场景通过 |
| B3 | 更新胶囊 | UpdatePill（窗口右下角，图标+一行+百分比+至多一个动作+关闭；checking/available/downloading/preparing/ready/installing/current/updated/error 九态；up-to-date 4s 自动消失；下载进度环） | 浏览器组件回归通过 |
| B4 | 分享浮层 | ToolbarShare（文档图标+名称+「N 词 · 大小」副标题；Export/Print 行在上，Share/Copy 服务在下；外部点击/Escape 关闭、焦点回补、窄窗夹取定位） | 浏览器组件回归通过 |
| B5 | 代码/图示控件 + 菜单 | 代码卡片（md-code-wrap/header/language/actions）、图示 HUD（mermaid-hud 缩放组+动作组，悬停揭示）、blockIcons 上游线图标；菜单 Find and Replace…/Use Selection for Find/Jump to Selection/Release Notes，⌘1–⌘9 标签切换 | 浏览器场景与单元测试通过 |
| B6 | 缩放语义 / 文件搜索 / 浮动格式控件 | 图示缩放改乘性 ×1.25/×0.8、25–800 夹取、小数级联、Math.round 显示；⇧⌘O「搜索文稿…」FileSearchPalette（recents/项目文件/排名/键盘导航/三种打开目标）+「搜索文稿」工具栏项（Customize 可选、默认不启用）；macOS 26 浮动玻璃格式簇 FloatingFormatBar + formatState/formatEditing 上游 CodeMirror 移植，替换旧 .formatting-toolbar；工具栏清单对齐（默认第二枚 space、openInLlm 三级可用性门控与动态命名） | 单元测试与浏览器场景通过 |
| B7 | 基线 v0.0.72 / 阅读渲染 / #637 | callouts #629（15 kind + Obsidian 别名 + octicon 图标 + GitHub alert 配色与折叠）、脚注 #622、目录锚定 #628（含空标题防护）、转义引用 #633 字面渲染、编号列表列宽按最大序号位数（`textmark_list_digits` 规则）；#637「拷贝为纯文本」⌥⇧⌘C（Edit 菜单 Copy 之后、NSMenuItemValidation 式原生启用态、剪贴板插件写系统粘贴板）；#638 判定不适用（TextMark 缩放为 fontSize 乘数、无注册 `@property`，双重缩放结构性不可能） | 单元测试、浏览器场景与**真实桌面 wdio 全套 23/23 通过** |

## B5 细节（本批）

### 代码卡片与图示 HUD

证据固定于上游 `md-code-wrap` / `md-code-header` / `mermaid-hud` 与 `codeIconShapes`。

- **代码卡片**：`.md-code-wrap`（背景 `--document-fill`，0.5px 边框 `color-mix(text 12%)`，圆角 16，overflow hidden）> `.md-code-header`（高 28，padding `8px 10px 0 16px`，gap 4）含 `.md-code-language`（11px/14px 次级色，flex 1 省略）+ `.md-code-actions` 胶囊（padding 3.5px，0.5px 边框，圆角 16，背景 `color-mix(text 4%)`）。`.md-code-action` 24×24 圆角 12，hover text 10%/active 16%。
  - 换行切换保留名称「Wrap code」，报告 `aria-pressed`，tooltip 命名下一动作（wrap↔unwrap）；拷贝成功显示 check 1100ms。
  - 语言标签经 `markdown.ts` 的 `data-code-language` 烘焙到 `pre`，DOMPurify 默认放行 data-* 属性。
- **图示 HUD**：`.diagram-hud` 绝对定位 top/right 6.5px，flex wrap justify-end gap 6，max-width `calc(100%-13px)`，opacity 0/pointer-events none，transition opacity 0.12s，z-index 2；`.diagram-hud-group` 胶囊样式 + backdrop blur 16；`figure:hover`/`focus-within` 揭示（opacity 1，组内 pointer-events auto）。缩放组 out/level（min-width 44，11px tabular-nums，reset 动作）/in；动作组 copy/popup。图标 16×16。
  - 缩放 in ×1.25 / out ×0.8 / reset 100%（TextMark 沿用既有加性步进与 50/300 夹取以避免测试 churn，level 文本以百分比呈现）；拷贝复制 mermaid 源（去尾空白），check 1100ms。
- **图标**：`src/lib/blockIcons.ts` 复刻上游 24 viewBox、16×16、stroke 1.6 round 的 copy/check/wrap/unwrap/out/in/popup 形状，`blockIcons.test.ts` 逐项断言。
- **导出/打印**：`export.ts` 与 `preview-host.css` 的剥离/隐藏选择器由 `.copy-code-button` 改为 `.md-code-header`；`styleContract.test.ts`/`export.test.ts` 同步。导出 HTML 正文不含 `md-code-language`/`md-code-copy`。
- **几何核验**（`scripts/capture-block-pills.mjs`，CDP）：代码卡片圆角 16、headerHeight 36、pillHeight 33、pillRadius 16、insets≈7（≈6.5）、按钮 24×24；图示 HUD 悬停 opacity 1、top/right inset 7、groupGap 6、groupHeight 33、groupRadius 16、level 100%、动作 [out,reset,in,copy,open]、按钮 24×24。

### 菜单

证据固定于上游 `MainMenu.xib` Find 子菜单、`AppDelegate.swift` 隐藏标签项与 zh-Hans/en `Localizable.strings`/`MainMenu.strings`。

- **Edit 菜单**（`src-tauri/src/lib.rs`）：Find… ⌘F；Find and Replace… ⌘⌥F（`CmdOrCtrl+Alt+F`）；Find Next ⌘G；Find Previous ⌘⇧G；Use Selection for Find（无快捷键，仅菜单）；Jump to Selection ⌘J。zh：「查找和替换…」「使用所选内容查找」「跳到所选内容」。顺序与上游一致。
- **Help/应用菜单**：新增 Release Notes（zh「发布说明」），经 `externalMenuUrl('release-notes')` 打开 GitHub releases。
- **标签切换**：上游隐藏「Select Tab N」项，⌘1–⌘8 选第 N 个、⌘9 选最后一个（Safari 式）。TextMark 不在可见菜单暴露这些项，而在 `App.tsx` keydown 以 `tabIndexForShortcut(key, tabCount)` 处理（`menuCommands.ts`），保留 ⌘⇧7/⌘⇧9 列表格式与 ⌘⌥0–3 标题级别、⌃⌘1–3 侧栏模式不受影响。
- **行为接线**（`App.tsx`）：`find-replace`→切编辑态并开查找栏（替换仅在编辑态生效）；`use-selection-find`→取编辑器选区或预览 window selection 填入查询；`jump-to-selection`→编辑态直接 `revealSelection()` 居中，预览态经 Suspense 挂载后由 `initialRevealSelection` 在初始位置 rAF 之后居中选区。`EditorPane` 新增 `getSelectionText`/`revealSelection` 句柄方法与 `initialRevealSelection`/`onInitialSelectionRevealed` props。
- **测试**：`menuCommands.test.ts` 新增 release-notes URL 与 `tabIndexForShortcut` 四组用例（匹配/越界/⌘9 末位/非标签键与空列表）。

## B6 细节（本批）

### 图示缩放语义

证据固定于上游 `DiagramViewController` / HUD 缩放动作。

- `diagramInteractions.ts`：`zoomIn` ×1.25 / `zoomOut` ×0.8（乘性级联，非加性 ±25），`clampDiagramZoom` 25–800（对齐上游 0.25–8 倍），缩放值保持小数（125→156.25→…），HUD level 文本以 `Math.round(zoom)%` 显示。双击非 100% 复位、100% 时 ×2；以指针位置为锚点回补平移（`panForZoomPoint`）。
- 测试：`mermaidSizing.test.ts` 新增 25–800 夹取不取整、×1.25/×0.8 乘性级联用例；`diagramInteractions` 既有 HUD 用例同步。

### ⇧⌘O 文件搜索面板（FileSearchPalette）

证据固定于上游 `DocumentWindowController+FileSearch.swift` 与 `FileSearchView`。

- 组件 `src/components/FileSearchPalette.tsx`：480pt 面板、圆角 20、52pt 搜索行、40pt 文件行（图标 22、名称 13px 加粗命中、路径 11px 面包屑 ` › ` 加粗命中、项目名前缀）、24pt 分组头（11px semibold 次级色）、最多 8 行可见、窗口 26% 高度处居中放置、选中行 accent 填充白字、点击窗外/Escape 关闭、100ms 输入防抖。
- 空查询显示 recents（≤10，`listRecentFiles`），有查询显示项目文件排名（`fileSearchIndex`/`fileSearchMatcher`：名称/路径/目录分段打分，命中加粗）；无 recents 且无查询时提供 Open Folder… 入口；项目索引截断时显示「Showing the first N files」。
- 键盘：↑↓/Home/End/PageUp/PageDown（+7）移动选中；Return 当前标签、⌘Return 新标签、⌥Return 新窗口（`openDocumentWindow`）、双击当前；与上游 OpenTargets 一致。
- 接线：`App.tsx` ⇧⌘O 由 Open Folder 改为打开面板（`openFileSearch`）；Rust 菜单（`src-tauri/src/lib.rs`）在 Open… 后插入「搜索文稿…/Search for Document…」⌘⇧O，Open Folder… 保留但无快捷键（上游无 Open Folder 菜单项，TextMark 保留为菜单项以维持既有入口）。
- 测试：`FileSearchPalette.test.tsx` 13 项（recents/排名/加粗/键盘导航/三种打开目标/Escape/双击/截断提示/重开复位/Open Folder 门控）；`fileSearchIndex`/`fileSearchMatcher` 单元测试。

### 「搜索文稿」工具栏项（searchDocument）

证据固定于上游 `DocumentWindowController+FileSearch.swift` `makeSearchForDocumentItem()` 与 `DocumentWindowController+Toolbar.swift` `toolbarAllowedItemIdentifiers`。

- 上游在 Customize Toolbar 允许集合中提供 `.searchForDocument`（位于 `.search` 与 `.printDocument` 之间），但**刻意不放入默认工具栏**（工具栏已有文档内查找搜索框，双放大镜会被读成同一功能两次）。TextMark 同步：`ToolbarItem` 联合类型与 `TOOLBAR_ITEMS` 增加 `'searchDocument'`，`DEFAULT_TOOLBAR` 不变；`ToolbarCustomizer` 可用项目卡片按上游顺序排于「搜索」与「打印」之间。
- 文案对齐上游三串：标签「搜索文稿/Search for Document」（无省略号，区别于菜单项「搜索文稿…/Search for Document…」）、悬停 tooltip「按名称搜索文件/Search for a file by name」（区别于面板输入框 placeholder「按名称搜索文件/Search files by name」——zh 恰好同文，en 不同文）。`Toolbar` 的 SIMPLE_ACTIONS 新增可选 `tooltip` 字段承载 NSToolbarItem.toolTip 与 label 的分离；`aria-label` 用标签、`title` 用 tooltip。
- 图标：上游 `doc.text.magnifyingglass`（文档+放大镜，与纯放大镜的文档内查找区分），TextMark 以 lucide `FileSearch` 对应。
- 接线：`onSearchDocument={openFileSearch}`，点击打开 ⇧⌘O 面板；`validateToolbarItem` 上游恒为可用（无项目时 recents 仍可搜），TextMark 按钮不设禁用态。
- 测试：`Toolbar.test.tsx` 新增 3 项（en/zh 标签+tooltip+图标+动作、面板与查找框互不合并、默认工具栏不含该项且渲染无该槽位）。

### 默认工具栏第二枚 `space`（themesAndSettings 之后）

证据固定于上游 `DocumentWindowController+Toolbar.swift` `toolbarDefaultItemIdentifiers`（d0c6197）。

- 上游 macOS 26+ 默认序列在 `.openActions` 与 `.themesAndSettings` 之后各放一枚 `.space`（`if #unavailable(macOS 26.0)` 分支仅在旧系统过滤掉 `.space`）。TextMark 此前只保留第一枚，缺第二枚。本批补齐：`DEFAULT_TOOLBAR` 改为 `…openActions, space, themesAndSettings, space, inspector…`，与上游 26+ 默认逐位对齐；`.toolbar-space` 仍为 14px 固定间隔。
- 迁移：新增 `V7_DEFAULT_TOOLBAR`（v0.10.7 的无第二枚默认），`normalizeSettings` 的 `usesPriorDefault` 现同时匹配 V5 / LEGACY_COMBINED / V7 三种历史默认，未自定义用户自动升级到新默认；自定义布局（含恰好等于任一历史默认之外者）逐位保留。schemaVersion 维持 8。
- 测试：`settings.test.ts` 默认序列断言更新为含第二枚 `space`，迁移用例新增 `[8, V7 默认]` → 新默认；`Toolbar.test.tsx`/`components.test.tsx` 的 `arrayContaining` 断言不受影响。`sidebar-tracking`（90 项）、`tabs-find`（1440/980/780）、`narrow`、`customizer`、`edit` 几何场景全部 `failures=[]`。

### openInLlm 可用性门控（三级对齐）

证据固定于上游 `DocumentWindowController+Toolbar.swift`（allowed 集合 `if hasLLMTargetsAvailable`、item factory `guard … else { return nil }`）、`DocumentWindowController+OpenTargets.swift`（`refreshOpenInLLMItem`/`removeOpenInLLMToolbarItem`/`llmCandidates`/`resolveDefaultLLM`/`buildOpenInLLMMenu`）与 `OpenTargetCatalog.swift`（`setDefaultLLM` 持久化）。

- 上游三级门控：无已安装 LLM App 时，`.openInLLM` ①不进 allowed 集合（Customize 面板无卡片）、②factory 返回 nil、③运行时 `removeOpenInLLMToolbarItem` 移除已放置项；菜单仅列已安装候选（`llmCandidates` compactMap 过滤未安装），项名随默认目标变为「Open in %@/在 %@ 中打开」，选择经 `setDefaultLLM` 持久化。
- TextMark 此前：`llmApps` 不过滤 `available`（未安装项以 disabled 行出现）、项恒渲染、标签恒为「在 LLM 中打开」、`textmark.lastLlmTarget` 只读不写。本批对齐：`llmApps` 过滤为已安装（菜单行随之全部可用，对齐上游 buildOpenInLLMMenu 只列已安装候选）；`toolbarItems` 与 navigation 同款条件过滤（无已安装 LLM 时整项消失，含溢出 More 菜单——上游移除项同样不进溢出）；Customize 面板经新 prop `hasLlmTargets` 隐藏「在 LLM 中打开」卡片（App.tsx 由 `applications.some(kind==='llm' && available)` 接线；浏览器环境 `discoverApplications` 桩全部可用，捕获/e2e 场景不受影响）；标签改 `openInApp`（「Open in {name}」/「在 {name} 中打开」，对齐上游 "Open in %@"），默认目标 = 上次选择（仍在安装列表内）否则首个候选（对齐 `resolveDefaultLLM`）；点击 LLM 行写入 `textmark.lastLlmTarget`（对齐 `setDefaultLLM`，try/catch 与 codeLanguages 同款）。渲染路径以 `toolbarItems` 过滤为单一门控（测量循环按 DOM 槽位与 items 下标对齐，renderItem 返回 null 会失步——沿用 navigation 先例）。
- 测试：`Toolbar.test.tsx` 新增 2 项（无已安装 LLM 时整项消失且其余槽位不位移；已安装时项名随默认应用、选择持久化并即时改名、未安装候选不出现）；`components.test.tsx` 新增 1 项（`hasLlmTargets` 开/关时卡片出现/消失）。
- 首屏预算：本批新增（FileSearch 字形、openInLlm 门控与动态标签）使 main+worker gzip 越过 320 KiB 上限 71 字节；按既有先例（emoji 映射 300→320）将 `check-bundle-budget.mjs` 上限提至 324 KiB 并在脚本内注明原因，未放宽其它维度。

### 浮动格式控件（FloatingFormatBar）

证据固定于上游 `DocumentWindowController+FormattingBar.swift`（macOS 26 玻璃簇）与 `scripts/editor-bundle/entry-cm.js`（上游编辑器同为 CodeMirror，格式化语义直接移植源码）。

- **结构**：五个独立玻璃胶囊（Text Style「正文/标题 N」≥70px、B/I/S 各 36px、Link 28px、Lists 图标+chevron 54px、More +图标+chevron 52px），胶囊高 28 圆角 14，组间距 8，钉在编辑器右上（trailing −20、chrome 下方 +8），纯浮层不占内容 inset（对齐 macOS 26+ `usesFloatingFormattingBar`），容器 click-through（仅胶囊接收指针事件）。旧 `.formatting-toolbar` 全宽行、组件与 CSS 已删除；⇧⌘O 面板与格式条均不再依赖 `.document-tools` 高度。
- **选择态实时**：`formatState.ts`（selectionContext/stylingContext/listStyle/linkSelection，移植 entry-cm.js）经 `EditorPane.onFormattingChange` 驱动标题胶囊标签与 B/I/S/Link 字形 tint（accent 色，上游刻意关闭原生选中 bezel）。
- **弹层**：HeadingFormat（标题 0–6，字号 [13,22,20,17,15,13,12]，H1 行 32px）、ListFormat（无/项目符号/编号/任务）、StylingFormat（无/引用/Code/纯文本块/代码块→语言选择器/表格）、LinkFormat（Text:/URL:，Save 需去空白 URL 非空且无换行）、CodeLanguage（过滤胶囊、Recent/Common/All Languages 分区、Enter 选首个匹配、最近使用持久化 `textmark.recentCodeLanguages`）。
- **编辑语义**：`formatEditing.ts` 移植 entry-cm.js exec 表——toggleInlineMark（空白留外、前后标记剥离、选中含标记则解包）、setHeading（0–6 全行）、toggleBlockPrefix/toggleOrderedList（编号重排）、applyListStyle（跨样式互转不叠标记）、applyBlockStyle（quote/plain/fenced 解包互换、table 插入上游模板、code 反引号围栏加长）、insertLinkFromPopover（标签转义、URL 编码、()→%28/%29）、insertLinkPlaceholder（`[text](url)` 选中 url）。菜单 Format 命令与格式条走同一函数。
- **测试**：`FloatingFormatBar.test.tsx` 15 项（五胶囊顺序/标题标签实时/tint/各弹层内容与选中/语言过滤+Enter+记忆/链接表单 Save 门控/Escape 与窗外关闭/zh 文案）；`formatEditing.test.ts` 24 项；`formatState.test.ts` 12 项。
- **捕获脚本适配**：`capture-ui.mjs` 格式条改从 `.document-workspace` 作用域采集 `.floating-format-bar`；`toolsMeasuredCondition` 与 `heightMeasured`/`toolsInsideWorkspace` 允许编辑态关闭查找时工具高度合法为零（浮层不再计入）；print 选择器与 `@media print` 隐藏列表同步；`e2e/shell.spec.mjs` 断言改 `.floating-format-bar`。

## B7 细节（本批）

### Callouts / 提示块（上游 #629）

证据固定于上游 `MarkdownRenderer.swift` callout 表与 `PreviewStyle.swift` alert 配色。

- `markdown.ts`：`CALLOUT_KINDS` 15 kind（note/tip/important/warning/caution/abstract/info/todo/success/question/failure/danger/bug/example/quote）；`CALLOUT_ALIASES` 复刻 Obsidian 别名（summary/tldr→abstract、hint→tip、check/done→success、help/faq→question、attention→warning、fail/missing→failure、error→danger、cite→quote），important/caution 按上游保持独立 kind（GitHub 各有配色）；`parseCalloutTag` 解析 `> [!KIND]` / `> [!KIND]+` / `> [!KIND]-`；`convertAlerts` 输出 `markdown-alert markdown-alert-${kind}` 包裹 + `markdown-alert-title`（octicon 16×16 `CALLOUT_ICONS`），折叠以 `open` 属性 + `-` 标记（浏览器端 `<details>` 式 fold）。
- 配色：`preview-host.css` 定义 `--alert-blue #0969da`（dark `#4493f8`）等 GitHub 双模式 token，逐 kind 对齐上游。

### 脚注（#622）与转义引用（#633）

- `markdown-it-footnote` 接线，脚注区源码映射入 `sourceMap`（kind `footnote`）；`\[18\]` 转义引用按 #633 渲染为字面文本而非行内数学（`markdown.ts` 链接标签/数学规则处）。

### 目录锚定（#628）与编号列宽

- `anchorOutlineToSource`（`markdown.ts:348`）：atx 正则 `^\s{0,3}#{1,6}(?:\s+(.*))?$`，内容组可选使裸 `#` 空标题锚定自身行；`includes` 回退（渲染文本为源行子串：格式化标记/链接标签）对空标题跳过，避免 `includes('')` 吞并后续标题。
- `textmark_list_digits` core 规则：按每个有序列表自身 `start + count - 1` 最大位数定列宽（浏览器忽略非首项 start；嵌套列表 markdown-it 重编号后各自成 `<ol>`），对齐上游编号列稳定。

### #637 Copy as Plain Text（拷贝为纯文本）

证据固定于上游 `83159a9`（Edit 菜单项、NSMenuItemValidation、纯文本渲染提取）。

- **菜单**：`lib.rs` Edit 菜单 Copy 之后插入 `copy-as-plain-text`「拷贝为纯文本 / Copy as Plain Text」⌥⇧⌘C。
- **启用态**：上游靠 `validateMenuItem`（NSMenuItemValidation）在无阅读选区时禁用；TextMark 以 `READER_HAS_SELECTION` 状态驱动同一原生 item 的 `set_enabled`，可见结果一致。
- **提取与写入**：`src/lib/plainTextCopy.ts`（311 行）走 DOM 遍历「按读到的样子」提取（frontmatter 以 `key\tvalue` 行、任务项 `☐/☑`、表格制表符分列、去除 `- [ ]`/`| … |`/`#` 等 Markdown 记号），经 `plugin:clipboard-manager|write_text` 写系统粘贴板（跨平台，替代上游 NSPasteboard）；无选区时提示 `plainTextCopyNoSelection`（zh「请先在预览中选择文本」）。
- **真实桌面验证**（wdio，见门禁）：原生 item `is_enabled()` 往返（无选区禁用→selectAllChildren 启用→清空再禁用）+ 哨兵清空 + `menu-command` 事件（与 `on_menu_event` 同载荷）驱动完整 handler→DOM 遍历→系统粘贴板管线，粘贴板内容逐项断言。

### #638 判定：对 TextMark 不适用

证据固定于上游 `e2ef1ab` diff（WKWebView `pageZoom` 对注册 `@property --mdp-body-em` 的 calc() 双重缩放）。

- TextMark `grep @property src/` 无命中；编辑器缩放为 fontSize 乘数（`EditorPane.tsx:575` `fontSize: props.fontSize * props.zoom / 100`），非 WKWebView pageZoom——双重缩放缺陷结构性不可能。列表缩进 `--mdp-list-indent: calc(2.1em + Nch)`（App.css）未注册为 `@property`，同样不触发该缺陷。#638 的可见症状（非默认缩放下切换模式列表列位移）在 TextMark 无对应机制，判 N/A；可见等价（缩放在模式间列稳定）已由 e2e zoom 用例覆盖。

## 门禁（2026-11-11）

- 前端：56 个测试文件、592 项测试通过（`npx vitest run`）。
- `npx tsc --noEmit`、`npx eslint src`、`npm run build`、`npm run format:check` 通过；`npm run check:bundle`：main+worker 319 KiB、native preview 68 KiB gzip（生产构建），预算内；`npm audit --omit=dev --audit-level=high` 通过（本批顺带将 dompurify 升至 3.4.17、markdown-it 升至 15.0.3 以消除 high/critical 告警，余 2 项 low 为 katex 传递依赖，低于阈值）。
- Rust：`cargo fmt --check`、`cargo check`、`cargo check --features e2e`、`cargo clippy --all-targets`、`cargo test`（src-tauri，23 项）通过。
- **真实桌面 e2e（wdio + @wdio/tauri-service，embedded driver，调试构建 `--features e2e` 二进制，非浏览器桩）**：`npm run test:e2e` → `e2e/shell.spec.mjs` **23/23 全部通过**（DotReporter 23 点，`Spec Files: 1 passed`）。其中编辑态用例在原生 WebView 断言 `.editor-pane .cm-content` 计算样式 `white-space: pre-wrap`（上游 EditorHTML.swift `#editor .cm-content.cm-lineWrapping` 覆盖 CodeMirror 基础 `break-spaces`，行尾空格悬于字距外、编辑与阅读折行一致——本批补齐的画布空白模型面）。覆盖：真实启动路径打开中文文档并经 Worker 渲染、原生窗口几何契约、语言即时切换与工具栏自定义持久化、自动保存/标签/置顶偏好持久化、预览原生交互/搜索/Inspector/源感知表格、**#637 拷贝为纯文本**（原生菜单启用态往返 + 完整命令管线写入系统粘贴板逐项断言）、剪贴板图片粘贴落盘与相对引用、Rust 保存与外部写冲突、改名跟随与删除重建、侧栏隐藏/目录/项目导航器切换、open-actions 下拉、缩放百分比、查找栏、编辑态切换、Inspector 开关、分享回退拷贝+提示、溢出菜单全动作、溢出菜单打开工具栏自定义与偏好、对话框焦点圈与 Escape、导航历史门控、窗口控制按钮、平台适配、新建可编辑文档。
- 浏览器/CDP 场景（`scripts/capture-ui.mjs`）：preview / edit / dark / inspector / customizer / appearance / appearance-dark / workspace-panels-drag / workspace-panels-reload / search-replace / tabs-find（1440/980/780 宽，108 项断言全过）/ tabs / find / print / print-find / print-tabs-find / print-inspector / print-toast / print-toast-prepared / narrow / sidebar-tracking（90 项断言全过）均 `failures=[]`。
- `sidebar-tracking` 场景的 `titleInsideFirstFlexibleSpace` 断言为 v0.10.8「单源文档标题」移除工具栏标题后遗留的过期检查（HEAD 同样失败，与本批无关），本批改为 `noToolbarDocumentTitle`（断言 flexibleSpace 内不再有 `.toolbar-document-context`），与上游「标题仅存在于原生窗口标题栏」一致。
- 本轮 e2e 规格与重建后 UI 的真实差异修正（规格过期，非应用缺陷；每处均先对照上游源码确认应用行为正确）：设置导航类名 `settings-nav`→`settings-tabs`；「自动存储」→「自动保存」（上游 zh 即「自动保存」）；Inspector 无面板内关闭按钮（上游 InspectorView 无关闭钮，经工具栏切换关闭）；侧栏选择器 aria-label「大纲/文件夹」→「目录/项目导航器」（上游 zh：Table of Contents=目录、Project Navigator=项目导航器）；外观预设 7→9（Original…Midnight，对齐上游 ThemePreset.swift），主题自定义改走 CustomizeThemeSheet 色板/重置/完成；分享浮层「共享」行改 `div[3]`（header + Export/Print + 共享/拷贝两 section）。
- 真实 UI 缺陷修复（本批发现）：从 设置 ▸ 外观 打开 CustomizeThemeSheet 时，sheet 与 SettingsDialog 同为 `.dialog-backdrop` z-index 110 而绘制在其下——`App.tsx` 将 `<CustomizeThemeSheet>` 移到 `<SettingsDialog>` 之后（DOM 序即叠放序），e2e 与浏览器场景复验通过。

## 证据边界与刻意差异

### 证据分层

- **真实桌面（最强）**：wdio + @wdio/tauri-service 驱动调试构建的原生二进制（Tauri 菜单、muda 快捷键、系统粘贴板、Rust 文件系统、原生窗口），23/23 通过——本轮「完全一致」结论的桌面级证据。
- **浏览器/CDP**：`capture-ui.mjs` 场景代表 WebView DOM 行为与几何，不替代原生 NSToolbar/titlebar 材质、系统打印面板等 AppKit 内部实现的实拍（按约定本就不复刻内部实现）。
- **单元测试**：592 项覆盖渲染/编辑/设置语义等价。

### 驱动限制（已用等价证据替代，非应用缺陷）

- **#637 快捷键 ⌥⇧⌘C 的按键合成**：内嵌 W3C driver 无法投递三修饰符 Shift+Alt 和弦——对照实验：⌘⌥F（查找替换）与 ⌘⇧O（文件搜索）可命中，⌥⇧⌘C 以 'c'/'C'/'å' 键名均不触发，且原生 item 此时已启用；muda 注册正确（key equivalent "c" + Command/Alternate/Shift）。上游以 XCUITest/CGEvents 验证该键。TextMark 改以两段等价证据闭环：①原生 NSMenuItem `is_enabled()` 随阅读选区往返（muda 已注册该加速器的菜单项启用态）；②以 `on_menu_event` 的同载荷 `menu-command` 事件驱动完整 handler→提取→系统粘贴板管线并逐项断言粘贴板内容。
- **原生 WebKit 上下文菜单注入**：stable Tauri 2.11 无 WebView 上下文菜单注入 API，预览右键「拷贝为纯文本」等上游 NSMenu 注入项无法复刻；命令本体（菜单/快捷键/行为）已一致。

### 刻意差异（可见结果等价）

- #638：TextMark 缩放架构（fontSize 乘数、无注册 `@property`）使该缺陷结构性不可能，判 N/A（见 B7）。
- 剪贴板写入走 `tauri-plugin-clipboard-manager`（跨平台）而非 NSPasteboard；菜单启用态走状态驱动 `set_enabled` 而非 NSMenuItemValidation 协议——两者均为「复刻可见结果不复刻内部实现」约定下的等价实现。
- 图示 HUD 缩放沿用加性步进与 50/300 夹取的历史决定已在 B5/B6 记录；浮动格式弹层玻璃以 CSS 近似 NSGlassEffectView。
- 本轮不引入分析遥测；保持跨平台。