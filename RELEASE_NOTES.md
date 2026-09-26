# TextMark v0.10.25

TextMark 0.10.25 fixes footnote navigation in the preview and prevents standalone HTML exports from being clipped to the app window.

TextMark 0.10.25 修复预览内脚注跳转异常，并解决导出 HTML 被应用窗口高度截断的问题。

## Highlights / 主要更新

- 脚注：片段跳转和回跳只滚动预览区域，保留浏览器历史定位，不再连带移动窗口/页面外层。
- HTML 导出：移除应用窗口的固定视口与隐藏溢出约束，导出文件可正常滚动浏览完整长文档。
- 验证：新增片段导航与导出完整性回归覆盖；前端测试、Rust 测试、构建、lint、格式检查和包体预算通过。

---

# TextMark v0.10.24

TextMark 0.10.24 fixes document-title overlap in narrow desktop toolbars and improves sidebar control layout reliability.

TextMark 0.10.24 修复窄窗口桌面工具栏中文稿标题与操作按钮重叠的问题，并提升侧边栏控件布局稳定性。

## Highlights / 主要更新

- 工具栏：文稿标题限制在自定义弹性空间内，窗口变窄时自动省略，不再覆盖侧栏或首个工具栏操作。
- 侧边栏：回归检查确认大纲/文件模式切换会正确恢复侧栏，显隐开关状态同步。
- 验证：工具栏组件测试、生产构建与 lint 通过。

---

# TextMark v0.10.23

TextMark 0.10.23 improves Edit Mode navigation, toolbar layout, external editor discovery, and direct PDF output.

TextMark 0.10.23 优化编辑模式的导航与工具栏布局，扩充外部编辑器发现，并改进应用内 PDF 导出路径。

## Highlights / 主要更新

- 编辑模式：格式工具栏收敛为悬浮胶囊布局，窄窗口查找/替换控件保持可见；查找定位只滚动编辑器内容，不再带动整个页面上移。
- 文件导航：默认折叠目录，并跳过 macOS 应用包、框架及文稿包，避免侧栏被包内文件淹没。
- 外部编辑器：增加 MarkEdit、Mellow、Taio 的应用发现；macOS 仍按系统 Markdown/纯文本编辑角色筛选可用应用。
- 打印/PDF：打印操作统一使用 TextMark 内置 PDF 导出及保存流程，不再打开系统打印面板。
- 验证：格式、lint、生产构建、433 项前端测试和 Rust 单元测试通过。

---

# TextMark v0.10.22

TextMark 0.10.22 improves sidebar state retention, editor launching, narrow-window find and replace, and direct PDF export.

TextMark 0.10.22 优化侧栏状态保留、外部编辑器启动、窄窗口查找与替换，并改为应用内直接生成 PDF 文件。

## Highlights / 主要更新

- 侧栏：隐藏和切换大纲/文件模式时保留目录展开与标题折叠状态。
- 外部编辑器：macOS“系统默认编辑器”改为调用系统文本编辑器；补充 VS Code Insiders、VSCodium、Fleet、IntelliJ IDEA、MarkText、MacDown 和 Emacs。
- 查找：上一个/下一个命中控件在窄窗口仍保持可见；替换行默认折叠、按需打开；匹配导航只滚动预览区域，避免带动整个窗口。
- 导出：PDF 由应用内生成并保存，不再调起系统打印机/打印面板；导出窗口使用 PDF 文件语义。
- 验证：前端构建通过，433 项单元测试通过，Rust 检查通过；桌面 WDIO 冒烟仍受 macOS 原生工具栏不可见于 DOM 的既有选择器限制。

---

# TextMark v0.10.21

TextMark 0.10.21 improves keyboard shortcut routing so formatting commands work predictably without hijacking text fields or repeating while a shortcut is held.

TextMark 0.10.21 优化快捷键路由：格式快捷键不会抢占查找等文本输入框，按住组合键也不会重复触发文稿操作。

## Highlights / 主要更新

- 快捷键：编辑和预览共用格式菜单快捷键；焦点位于输入框时保留输入控件自身操作，原生菜单快捷键也遵循相同规则。
- 操作体验：修复按住组合键时重复执行文稿操作的问题；新增快捷键路由回归测试。

---

# TextMark v0.10.20

TextMark 0.10.20 improves document search at narrow widths, closes table borders cleanly, strengthens nested quote styling, and preserves the active theme in HTML and PNG exports. Toolbar customization also uses distinct icons for similar actions.

TextMark 0.10.20 优化窄窗口查找布局、表格边框衔接和嵌套引用显示；HTML 与 PNG 导出保留当前主题，并区分自定义工具栏中相似操作的图标。

## Highlights / 主要更新

- 查找与替换：按实际工具区宽度自适应分组，避免半屏窗口下控件折叠或散落。
- Markdown 渲染：表格四角和外边框连贯，引用层级更清晰；frontmatter 表格保持原有紧凑样式。
- 导出：HTML 文件保留文档主题变量，PNG 保留屏幕当前配色；macOS PDF 继续走原生矢量打印流程。
- 自定义工具栏：为打开、搜索、导出等相近项目提供易区分的图标。

---

# TextMark v0.10.19
TextMark 0.10.19 completes another desktop-toolbar parity pass against Markdown Preview 0.0.62: the document title sits in the same left-center toolbar lane, in-document search stays visible as a native-width field, and toolbar customization uses a compact five-column palette.

TextMark 0.10.19 对照 Markdown Preview 0.0.62 完成新一轮桌面工具栏对齐：文稿标题定位到相同的中左工具栏区域，文稿内搜索改为常驻原生宽度输入框，自定义工具栏采用紧凑的五列项目板。

## Highlights / 主要更新

- 顶部工具栏：文稿名按上游工具栏标题区域对齐，默认显示完整文稿内搜索框。
- 自定义工具栏：面板宽高与五列项目布局贴近 macOS 原生自定义面板，保留拖放排序与恢复默认操作。

---

---

# TextMark v0.10.18
TextMark 0.10.18 centers the document name within the customizable toolbar's flexible space, matching Markdown Preview's placement between the leading and trailing toolbar groups. The macOS native overlay title is hidden to prevent a second, left-aligned title.

TextMark 0.10.18 将文稿名居中放入自定义工具栏弹性空隙，对齐 Markdown Preview 中位于前后工具组之间的标题位置；同时隐藏 macOS 覆盖式标题栏中的系统标题，避免左侧出现重复标题。

## Highlights / 主要更新

- 顶部区域：文稿标题随弹性空位动态居中，工具栏自定义布局变化时同步定位。
- 原生标题：保留窗口标题供系统窗口列表、文稿切换及未保存状态使用，隐藏覆盖式标题栏的左对齐显示。

---

# TextMark v0.10.17

TextMark 0.10.17 uses macOS's native centered window title for the open document, matching Markdown Preview's title-bar behavior and removing the misplaced duplicate title from the web toolbar.

TextMark 0.10.17 改用 macOS 原生窗口标题居中显示当前文稿名，对齐 Markdown Preview 的标题栏行为，并移除位置错误的网页工具栏重复标题。

## Highlights / 主要更新

- macOS 顶部区域：显示原生居中文稿名；文稿切换、重命名和未保存状态仍由窗口标题实时更新。
- 自定义工具栏：保留原有项目拖放与顺序设置，标题不再挤占或覆盖可用工具项。

---

# TextMark v0.10.16

TextMark 0.10.16 aligns the macOS document title with the upstream toolbar's flexible spacing so it no longer covers toolbar actions.

TextMark 0.10.16 调整 macOS 文稿标题的位置，使其随工具栏弹性空隙排列，避免遮挡工具栏操作。

## Highlights / 主要更新

- 顶部工具栏：文稿名放入导航与右侧工具项之间的弹性空隙；用户自定义布局移除弹性空隙后仍保留标题，并给操作区留出空间。
- 验证：Toolbar 测试通过（23 项），TypeScript/Vite 生产构建通过，Prettier 与 `git diff --check` 通过。

---

# TextMark v0.10.15

TextMark 0.10.15 fixes a macOS title-bar regression found during desktop verification: the native title is hidden while the centered document title and traffic lights remain visible.

TextMark 0.10.15 修复桌面实测发现的 macOS 标题栏回归：隐藏原生标题，同时保留居中文稿名和交通灯控件。

## Highlights / 主要更新

- macOS 顶部区域：避免系统标题与工具栏文稿名重复或遮挡；已在本机重建候选版并通过窗口截图验证。

---

# TextMark v0.10.14

TextMark 0.10.14 refines the macOS desktop chrome to match Markdown Preview's toolbar and tab layout more closely, and updates the toolbar customization palette to use a compact native-style sheet.

TextMark 0.10.14 进一步对齐 Markdown Preview 的 macOS 桌面顶部区域与标签布局，并将工具栏自定义面板调整为紧凑的原生风格浮层。

## Highlights / 主要更新

- 顶部区域：隐藏叠加式标题栏中的系统标题，避免文件名与交通灯控件重叠；在工具栏中居中显示当前文稿名。
- 标签栏：macOS 始终显示文稿标签行，提供当前标签关闭和新建标签入口；非 macOS 平台保持原有显示规则。
- 工具栏定制：收敛为上游风格的图标网格与图标托盘，已添加项目禁用重复添加，保留拖拽排序及移出删除。
- 自动更新：沿用已验证的稳定版 GitHub 更新端点与 Minisign 公钥；本版本附带签名更新包及最新清单。
- 验证：生产构建、48 个前端测试文件/434 项测试、ESLint、Prettier、Rust 格式检查与单元测试、bundle 预算检查通过。

---

# TextMark v0.10.13

TextMark 0.10.13 aligns the default desktop toolbar spacing with Markdown Preview 0.0.62 and migrates the previous default layout automatically.

TextMark 0.10.13 对齐 Markdown Preview 0.0.62 的默认桌面工具栏间距，并自动迁移旧版默认布局。

## Highlights / 主要更新

- 工具栏布局：在“主题与设置”和“简介”之间补上上游默认的小间隔；升级时只迁移此前的默认布局，保留用户自定义顺序。
- 更新器核查：确认已安装 v0.10.8 与当前发布清单使用相同的更新端点和签名公钥，v0.10.12 提供受签名保护的 macOS 通用更新包。

---

# TextMark v0.10.12

TextMark 0.10.12 brings project document search closer to Markdown Preview's floating desktop palette, improves large-project responsiveness, and completes keyboard result navigation.

TextMark 0.10.12 进一步对齐 Markdown Preview 的桌面浮动搜索面板，提升大型项目搜索响应，并补齐结果键盘导航。

## Highlights / 主要更新

- 搜索面板：宽度收敛至 480px、输入字号调整至 20px、圆角与浮动层级贴近上游；移除全屏暗色遮罩，空查询保持紧凑搜索条。
- 大型项目：通过 Web Worker 在后台完成项目文稿排序，仅为前 30 条结果生成高亮位置；快速键入时旧结果不会抢先响应 Enter。
- 键盘操作：支持方向键、Home、End、PageUp、PageDown，以及当前标签、新标签和独立窗口打开。
- 验证：前端 48 个测试文件、432 项通过；lint、格式检查、生产构建通过；Playwright 桌面/窄窗组件预览和搜索键盘操作通过。

---

# TextMark v0.10.11

TextMark 0.10.11 refines project document search to match Markdown Preview's fuzzy ranking and compact initial search panel. Results now use the best subsequence alignment for ranking and highlights, and the result list stays collapsed until a query is entered.

TextMark 0.10.11 进一步对齐 Markdown Preview 的项目文稿搜索排序和紧凑初始面板。搜索结果依据最佳子序列匹配排序并高亮；输入查询前保持结果列表收起。

## Highlights / 主要更新

- 搜索排序与高亮：使用动态规划为模糊匹配选择更合适的连续片段和词边界，排序与高亮位置保持一致。
- 紧凑搜索面板：空查询时仅显示搜索框；输入查询后再展示结果和操作提示。
- 验证：前端 48 个测试文件、429 项测试通过；ESLint、格式检查和生产构建通过。

---

# TextMark v0.10.10

TextMark 0.10.10 aligns project document search with Markdown Preview: filename queries only match filenames, and queries containing `/` search relative project paths with matching characters highlighted in the path.

TextMark 0.10.10 对齐 Markdown Preview 的项目文稿搜索行为：不含 `/` 的查询只匹配文件名，包含 `/` 时按项目相对路径搜索，并在路径中标出匹配字符。

## Highlights / 主要更新

- 搜索文稿：修复目录名造成的错误命中；路径查询会在相对路径中匹配和高亮。
- 验证：新增回归覆盖目录误匹配和路径模糊匹配；前端 47 个测试文件、425 项测试通过。

---

# TextMark v0.10.9

TextMark 0.10.9 aligns more closely with Markdown Preview 0.0.62. Search Markdown and text documents in the open project by filename, open results in the current tab, a new tab, or a separate window, and work with code blocks through persistent language, copy, and wrapping controls in both reading and editing views.

TextMark 0.10.9 进一步对齐 Markdown Preview 0.0.62。现在可按文件名搜索当前项目中的 Markdown 文稿，并在当前标签、新标签或独立窗口打开结果；阅读与编辑模式的代码块卡片均提供语言、复制和换行操作。

## Highlights / 主要更新

- 项目文稿搜索：使用 ⇧⌘O 打开模糊文件名搜索；回车在当前标签打开，⌘回车新建标签，⌥回车新建窗口；文件菜单和可定制工具栏也提供入口。
- 代码块卡片：阅读态展示语言名称及复制、换行控件；编辑态围栏卡片支持独立滚动/换行、语言编辑和复制代码正文。
- 桌面工具栏：进一步收紧前进/后退控件的尺寸，保留系统标题栏及跨平台工具栏结构。
- 兼容性：保留 v0.10.8 的编辑搜索、文档位置恢复、工具栏自定义和多文档工作流；Mermaid 使用 11.16.1。

---

# TextMark v0.10.8

TextMark 0.10.8 keeps the document name in one place per window and repairs the browser acceptance scenario that had been timing out since the alignment capture script was rewritten.

TextMark 0.10.8 让窗口内文件名只保留一处，并修复自对标截图脚本重写后一直超时的浏览器验收场景。

## Highlights / 主要更新

- 顶部区域：移除工具栏里重复的文档名。文件名改由原生窗口标题与侧栏标题承载，与参照应用的分层一致，顶部不再出现两段同样的文件名。
- 验收脚本：`scripts/capture-ui.mjs` 的 customizer 场景改用 `.toolbar-customizer` 作为就绪条件；此前 `[role="dialog"]` 会先命中外观浮层，导致场景必然超时。preview / edit / customizer / dark / 窄窗五个场景现均为 `failures=[]`。
- 门禁：前端 46 个测试文件、420 项测试，TypeScript、ESLint、格式检查、Rust 格式/测试/Clippy，以及导出回归校验均通过。

---

# TextMark v0.10.7

TextMark 0.10.7 refines the desktop toolbar and document workspace against the latest Markdown Preview reference, improves editor and preview position handoff, and makes the default external-editor action safely fall back to the system handler.

TextMark 0.10.7 继续对标最新版 Markdown Preview 优化桌面工具栏与文档工作区，改进编辑器和预览位置交接，并修复默认外部编辑器目标安全回退到系统处理器。

## Highlights / 主要更新

- 工具栏：支持自定义顺序和紧凑溢出布局，收敛重复的侧边栏模式入口，并增加外观快捷面板。
- 文档工作区：查找与格式工具改为内容覆盖层；改进编辑、预览和标签切换时的位置恢复。
- 外部打开：系统默认、未知或不可用默认目标均安全路由；补充 macOS 应用映射与非法输入回归测试。
- 验收：前端 46 个测试文件、420 项测试，TypeScript、ESLint、格式检查、Rust 格式/测试/Clippy 均通过；macOS 原生窗口、打印和编辑器启动验收由用户实机确认。

---

# TextMark v0.10.6

TextMark 0.10.6 updates the Windows Explorer preview workflow to `NuGet/setup-nuget@v3`, removing the GitHub Actions Node.js 20 runtime deprecation warning while keeping the Windows x64/ARM64 preview builds unchanged.

TextMark 0.10.6 将 Windows Explorer Preview 工作流升级至 `NuGet/setup-nuget@v3`，消除 GitHub Actions 的 Node.js 20 运行时弃用警告，同时保持 Windows x64/ARM64 预览构建行为不变。

## Highlights / 主要更新

- CI 与 Release 工作流统一使用支持 Node.js 24 的 `NuGet/setup-nuget@v3`。
- 不改变 Explorer Preview 编译、安装、宿主测试和发布资产结构。
- 继续覆盖 Windows x64 与 ARM64 构建。

---

# TextMark v0.10.5

TextMark 0.10.5 makes PDF export guarantees explicit across desktop targets: macOS native printing and browser printing preserve selectable text and vector graphics, while Windows/Linux desktop export remains a reliable rasterized PDF fallback.

TextMark 0.10.5 明确跨平台 PDF 导出能力边界：macOS 原生打印和浏览器打印保留可选文字及矢量图形；Windows/Linux 桌面端继续提供可靠的栅格化 PDF 回退，不宣称可选文字矢量等价能力。

## Highlights / 主要更新

- PDF capability contract：新增可检测的文本可选性与矢量图形保证。
- 跨平台边界：非 macOS Tauri 的 jsPDF 路径明确标记为 rasterized，避免误导用户。
- 回归保障：覆盖原生打印、浏览器打印与桌面栅格回退三条契约分支。

---

# TextMark v0.10.4

TextMark 0.10.4 clarifies desktop drag-and-drop behavior: it opens the first unique dropped file or folder, reports ignored additional paths, and gives explicit feedback when a drop contains no usable path.

TextMark 0.10.4 明确桌面拖放行为：打开第一个唯一的文件或文件夹，提示被忽略的额外路径，并在拖放内容不包含可用路径时给出明确反馈。

## Highlights / 主要更新

- Finder/桌面拖放：支持空路径过滤和重复路径去重。
- 多路径拖放：保留首个可用路径并明确提示额外路径未打开，避免静默失败。
- 错误反馈：空拖放或无可用路径时显示中英文提示。
- 回归保障：新增拖放路径策略测试，保留目录和文件的现有打开流程。

---

# TextMark v0.10.3

TextMark 0.10.3 improves session window geometry recovery across multiple monitors by recording monitor metadata, preserving legacy snapshots, and safely clamping restored windows into an available work area.

TextMark 0.10.3 改进多显示器场景下的会话窗口几何恢复：记录显示器元数据、兼容旧会话快照，并将恢复窗口安全限制在可用工作区内。

## Highlights / 主要更新

- 多显示器恢复：保存显示器位置、工作区、缩放比例和名称信息。
- 安全回退：原显示器不可用时回退到主显示器，并防止窗口恢复到屏幕外或小于可用尺寸。
- 兼容性：旧版本仅含 `x/y/width/height` 的会话快照继续可读取。
- 回归保障：新增负坐标、超大窗口、显示器回退和旧快照兼容测试。

---

# TextMark v0.10.2

TextMark 0.10.2 aligns the desktop toolbar and top-area interactions more closely with the latest Markdown Preview reference, while preserving cross-platform automation compatibility and release verification.

TextMark 0.10.2 进一步对齐最新版 Markdown Preview 的桌面 Toolbar、顶部布局与交互体验，同时保留跨平台自动化兼容性并完成发布验证。

## Highlights / 主要更新

- 顶部桌面 UI：重排 Sidebar、文件夹/大纲入口、历史导航、文档标题、Open Actions、Zoom、Inspector、Share、Edit、Search 和 More 的信息架构。
- 顶部交互：补齐固定侧栏入口、后退/前进操作、搜索图标态与展开态、窄窗口溢出，以及原有 E2E 选择器兼容。
- 编辑体验：收敛 Formatting Toolbar、文档标签页和 Tauri 拖拽区域的尺寸与布局，覆盖阅读态、编辑态、深色主题和窄窗口。
- 回归保障：修正跨平台原生窗口尺寸断言，避免把 macOS 可用桌面区域、Retina 缩放和窗口装饰差异误判为产品故障；CI 全部通过。

---

# TextMark v0.10.0

TextMark 0.10.0 completes the Markdown Preview desktop parity pass and adds native GitHub project links plus separate Apple Silicon and Universal macOS DMG assets.

TextMark 0.10.0 完成本轮 Markdown Preview 桌面对标，并新增原生 GitHub 项目入口以及 Apple Silicon 与 Universal macOS DMG 产物。

## Highlights / 主要更新

- 桌面 UI：完成默认工作区几何、侧栏工作区、Inspector 面板、文档上下文标题、标签页键盘操作和 Markdown 正文显示细节对齐。
- 原生菜单：新增 GitHub 项目主页、Releases 和报告问题入口，并保持当前焦点窗口定向。
- macOS 发布：同时提供 `TextMark_<版本>_arm64.dmg` 与 `TextMark_<版本>_universal.dmg`；软件内更新继续使用签名 Universal `.app.tar.gz`。
- 回归保障：40 个前端测试文件、340 项 Vitest 测试、15 项 Rust 测试，以及 TypeScript、ESLint、格式、Rust 格式和 DMG/Quick Look smoke 验证通过。

---

# TextMark v0.9.9

TextMark 0.9.9 adds signed in-app updates with stable and beta channels, real download progress, guarded installation and automatic relaunch, while preserving the v0.9.8 desktop parity improvements.

TextMark 0.9.9 增加带签名的软件内更新能力，支持稳定版与测试版通道、真实下载进度、受保护的安装流程和自动重启，并保留 v0.9.8 的桌面对标改进。

## Highlights / 主要更新

- 自动更新：设置中可选择稳定版或测试版通道，可开启启动后自动检查更新。
- 下载体验：安装更新时显示真实下载进度，检查、下载和安装失败分别反馈；防止重复检查和重复安装。
- 安全校验：更新通道白名单、公钥签名资产校验、`latest.json` 与 `.sig` 内容一致性验证。
- 发布流程：正式 Release 与 beta 通道均刷新 `latest.json`；更新私钥只使用 CI Secret，不进入仓库。
- macOS 发布：同时提供 Universal DMG 与 `TextMark_<版本>_arm64.dmg` 原生 Apple Silicon DMG；软件内更新仍使用签名的 Universal `.app.tar.gz`，不引用 DMG。

---

# TextMark v0.9.8

TextMark 0.9.8 completes the next desktop parity pass against Markdown Preview: it adds `.mdx` document recognition and upstream-style `==highlight==` rendering, strengthens atomic-save file watching across windows, preserves reading position and cursor state across edit/preview transitions, and adds three-choice protection for dirty-tab closing and history navigation.

TextMark 0.9.8 完成本轮对 Markdown Preview 的桌面对标：新增 `.mdx` 文档识别与上游风格的 `==高亮==` 渲染，强化多窗口原子保存文件监听，完善编辑/阅读切换时的阅读位置与光标交接，并为脏文档关闭和历史导航增加三选项保护。

## Highlights / 主要更新

- 桌面布局：侧栏与 Inspector 支持拖动调宽并持久化，大纲支持折叠、源码行跳转，标签页支持键盘导航。
- 编辑体验：查找、替换、全部替换统一编辑态与阅读态语义；全部替换使用单次撤销；编辑器标题样式与预览对齐。
- 可靠性：导出与打印等待预览水合并恢复原模式、滚动和光标；watcher 按窗口隔离并兼容原子保存替换；脏文档关闭、标签关闭与历史导航均支持存储并执行／放弃／取消。
- Markdown：支持 `.mdx` 作为纯 Markdown 文档打开；支持 `==highlight==` 行内高亮，代码和未闭合标记保持字面量。
- 回归保障：39 个前端测试文件、333 项 Vitest 测试与 14 项 Rust 测试通过；类型检查、ESLint、格式检查、Rust 格式和桌面 debug 构建通过。Quick Look appex 与 watcher 双窗口闭环仍受本机工具链/桌面沙箱限制，详见实施结果。

## Trust notice / 安全提示

Same as v0.9.7. 同 v0.9.7。

---

# TextMark v0.9.7

TextMark 0.9.7 repairs Windows Help menu actions. About TextMark now opens the in-app About page, Check for Updates opens Settings and starts a check, and Install CLI now adds its user-level command shims to PATH (new terminals pick them up automatically).

TextMark 0.9.7 修复 Windows 帮助菜单功能：“关于 TextMark”现在打开应用内关于页，“检查更新”会打开设置并开始检查，“安装命令行工具”会将用户级命令脚本加入 PATH（重新打开终端后可直接使用）。

---

# TextMark v0.9.6

TextMark 0.9.6 fixes a Windows WebView2 compatibility issue that could leave Settings blank. On Windows, Settings now opens reliably inside the already-loaded main window, so Settings and update-related menu actions do not depend on creating a second WebView. macOS and Linux continue to use their dedicated Settings window.

TextMark 0.9.6 修复 Windows WebView2 兼容性问题：部分环境中设置窗口可能显示为空白。Windows 现改为在已经加载的主窗口内稳定打开设置，因此“设置”和更新相关菜单不会再依赖创建第二个 WebView。macOS 与 Linux 保持独立设置窗口。

## Highlights / 主要更新

- Windows 菜单稳定性：设置、检查更新等入口使用主窗口内面板，避免二级 WebView 资源尚未就绪导致的空白窗口。
- 回归保障：新增 Windows 设置窗口策略测试；前端 289 项测试、Rust 原生测试、生产构建、静态检查、格式检查和包体预算通过。

## Trust notice / 安全提示

Same as v0.9.5. 同 v0.9.5。

---

# TextMark v0.9.5

TextMark 0.9.5 makes external editing and AI handoffs dependable. The configurable default external editor is now preserved until changed in Settings, and a direct “Open in Default Editor” action works consistently from the toolbar. System-default opening remains safe for saved documents, while unsaved drafts explain that they must be saved first. Codex, Claude and ChatGPT are available in both native and browser surfaces, and the native application catalog now recognises popular editors including Windsurf, Trae, Obsidian, Typora and Notepad++.

TextMark 0.9.5 改善外部编辑与 AI 交接体验。可配置的默认外部编辑器现在只会在设置中被修改，工具栏新增稳定的“使用默认编辑器打开”入口。系统默认方式仅用于已保存文档；未保存草稿会明确提示先保存。Codex、Claude 和 ChatGPT 在原生与浏览器界面均可使用，原生应用目录还新增识别 Windsurf、Trae、Obsidian、Typora、Notepad++ 等常用编辑器。

## Highlights / 主要更新

- 默认外部编辑器：设置项更名为“默认外部编辑器”；手动选择其他打开方式不再改写该偏好，工具栏和文件夹菜单都遵循它。
- 系统默认打开：已保存 Markdown 通过操作系统默认关联打开；未保存文档会显示清晰提示。Linux 默认关联仅覆盖 Markdown MIME 类型，不再影响纯文本文件。
- AI 与编辑器：Codex、Claude、ChatGPT 可直接交接或安全回退到复制；新增 Windsurf、Trae、Notepad++、Obsidian、Typora 的发现与启动支持。
- 回归保障：前端交互、原生应用目录、Markdown 与设置测试，生产构建及静态检查通过。

## Trust notice / 安全提示

Same as v0.9.4. 同 v0.9.4。

---

# TextMark v0.9.4

TextMark 0.9.4 makes installation choices clearer and restores complete table grids. Every release now ships a dedicated, bilingual installation guide that recommends the right package for each operating system and architecture, explains checksum verification, first launch, updates and uninstall, and makes the portable-versus-integrated trade-off explicit. Markdown tables now draw vertical as well as horizontal grid lines in preview and export layouts.

TextMark 0.9.4 改善安装选择体验，并恢复完整表格网格线。每个发布版本现在都会附带独立的双语安装指南，按系统与架构推荐正确安装包，说明校验、首次启动、更新与卸载，并清晰标注便携版和系统集成版的差异。Markdown 表格现在在预览和导出布局中同时显示纵向与横向边框。

## Highlights / 主要更新

- 安装体验：新增 `INSTALL.md`，覆盖 Windows、macOS、Linux 的下载选择、SHA-256 校验、安装、更新与卸载；该指南会作为发布资产上传并纳入校验清单。
- 表格：单元格使用完整边框，恢复列之间及表格外侧的纵向边线；桌面和窄屏布局一致。
- 回归保障：安装发布流程测试、Markdown 表格测试、生产构建及桌面/窄屏视觉检查通过。

## Trust notice / 安全提示

Same as v0.9.3. 同 v0.9.3。

---

# TextMark v0.9.3

TextMark 0.9.3 adds standard Emoji shortcode rendering and substantially broadens code-block highlighting. SQL, Docker Compose YAML, Dockerfile and a curated set of common programming and configuration languages render with syntax-aware colours on demand. Tables now use the full available document width and gain an isolated horizontal scroll surface when their content is wider than the page; print and export retain page-fitting layout. The release keeps the complete standard Emoji shortcode map, including `:smile:`, while preserving literal code and ordinary emoticon text.

TextMark 0.9.3 新增标准 Emoji 短代码渲染，并大幅扩展代码块语法高亮。SQL、Docker Compose YAML、Dockerfile 以及一组常见编程与配置语言会按需加载并以语法颜色显示。表格现在占满文档可用宽度；内容超宽时仅表格区域横向滚动，打印和导出仍会自动适应页面。该版本保留完整的标准 Emoji 短代码表（包括 `:smile:`），同时保持代码中的字面文本和普通颜文字不被替换。

## Highlights / 主要更新

- Emoji：支持完整标准 `:shortcode:` 表，例如 `:smile:`、`:rocket:`；不支持自定义图片 Emoji，不替换 `:-)` 等普通文本。
- 代码高亮：新增 SQL、Docker Compose、Dockerfile、Go、Java、Kotlin、C/C++、C#、PHP、Ruby、PowerShell、GraphQL、Nginx、Diff 等，并支持 `py`、`sh`、`zsh`、`yml` 等常见别名。
- 表格：短表铺满正文区域；长表维持页面不横向溢出，并在表格内部提供横向滚动。PDF、PNG、HTML 导出使用一致的页面适配规则。
- 回归保障：285 项前端测试、类型构建、静态检查、格式检查、包体预算、导出回归及桌面/窄屏视觉检查通过。

## Trust notice / 安全提示

Same as v0.9.2. 同 v0.9.2。

---

# TextMark v0.9.2

TextMark 0.9.2 makes document exports more dependable and gives exported pages a cleaner, more consistent appearance. PNG export now captures through Blob output, adapts safely to browser canvas limits, and retries at a lower scale when needed. PDF export uses balanced A4 margins, crisp lossless page slices and page numbers; macOS continues to use the native vector-capable Save as PDF workflow. Markdown presentation now also covers keyboard shortcuts, disclosure blocks, footnotes, strong text and strikethrough, with a dedicated syntax regression suite for the supported CommonMark, GFM and TextMark extensions.

TextMark 0.9.2 提升了文档导出的可靠性，并使导出页面拥有更干净、一致的版式。PNG 导出现在通过 Blob 生成，会安全适应浏览器画布限制，并在必要时以较低倍率重试。PDF 导出采用均衡的 A4 页边距、清晰的无损分页切片与页码；macOS 仍使用可保留矢量内容的原生“存储为 PDF”流程。Markdown 展示新增键盘快捷键、折叠块、脚注、加粗和删除线样式，并为已支持的 CommonMark、GFM 和 TextMark 扩展建立了专门的语法回归测试。

## Highlights / 主要更新

- PNG 导出：改用 Blob 输出并根据单边与总像素限制自适应缩放，避免超大文档在 WebKit 或 Chromium 中导出失败。
- PDF 与打印：统一浅色打印色板、A4 页边距、分页规则、表头重复与页码，减少截断、色彩偏差和页面拥挤。
- Markdown 展示：补齐 `kbd`、`details`、脚注、粗体与删除线的屏幕和打印样式；完整语法测试覆盖核心 Markdown、GFM、数学公式、Mermaid 与安全 HTML。
- 回归保障：282 项前端测试、格式检查、静态检查、生产构建以及真实浏览器 PNG/PDF 导出与视觉检查均通过。

## Trust notice / 安全提示

Same as v0.9.1. 同 v0.9.1。

---

# TextMark v0.9.1

TextMark 0.9.1 completes the follow-up verification pass against Markdown Preview v0.0.51 and fixes export, formula, Mermaid, sharing and macOS editor-integration edge cases. KaTeX selections now copy as usable Markdown source, Mermaid node labels remain visible in secure HTML/PDF/PNG output, and block equations no longer consume the following heading. macOS now uses the native sharing panel and filters Open With choices through the system editor role. The release also adds end-to-end coverage for preferences persistence, toolbar customization, image paste, export output and large documents.

TextMark 0.9.1 完成针对 Markdown Preview v0.0.51 的后续验收，并修复导出、公式、Mermaid、分享及 macOS 编辑器集成边界问题。KaTeX 选区复制现在会生成可直接使用的 Markdown 源码；Mermaid 节点标签在安全的 HTML/PDF/PNG 输出中保持可见；块级公式不会再吞掉后续标题。macOS 现使用原生系统分享面板，并通过系统编辑器角色筛选“打开方式”应用。本版本还新增偏好设置持久化、工具栏自定、图片粘贴、导出结果及大文档的端到端覆盖。

## Highlights / 主要更新

- 公式与图表：KaTeX 复制保留 `$…$` / `$$…$$`；安全转换 Mermaid `foreignObject` 标签为 SVG 文本，移除脚本和事件属性，同时保证标签可读。
- 导出可靠性：修复 PDF 中 Alert 图标异常放大与块级公式后的标题解析；HTML、PNG、PDF 导出增加 CSP、资源、主题恢复、签名、尺寸与视觉回归检查。
- macOS 工作流：Share 调用原生系统分享面板；Open With 依据 LaunchServices 编辑器角色筛选已安装应用，跨平台继续安全回退。
- 回归保障：280 项前端测试、13 项 Rust 测试、21 项桌面端流程、完整 Markdown 语法文档及浏览器视觉验收均通过；构建、静态检查、包体积预算与安全审计通过。

## Trust notice / 安全提示

Same as v0.9.0. 同 v0.9.0。

---

# TextMark v0.9.0

TextMark 0.9.0 completes another deep parity pass against the latest Markdown Preview while making editing and desktop workflows substantially more robust. The editor now loads language support for fenced code blocks on demand, renders pasted local images inline, and renames pasted-image files transactionally when their Markdown paths change. New-document and folder deep-link flows are safer, dirty tabs are never silently replaced, seven built-in appearance themes are available from a dedicated settings pane, and the renderer and deep-link lifecycle have been split into focused modules for easier maintenance. Default Chinese and full Windows, Linux, and macOS support remain unchanged.

TextMark 0.9.0 完成新一轮对最新版 Markdown Preview 的深度对标，并显著增强编辑与桌面工作流的可靠性。编辑器现可按需加载围栏代码块的语言支持、在源码中内联预览粘贴的本地图片，并在 Markdown 图片路径变化时以事务方式安全重命名文件；新建文档与文件夹深链接流程更加稳健，未保存标签不会被静默替换；设置新增独立外观页与七套内置主题；渲染器和深链接生命周期也拆分为职责清晰的模块，便于后续维护。默认中文及 Windows、Linux、macOS 三平台支持保持不变。

## Highlights / 主要更新

- 编辑器与代码块：围栏识别覆盖反引号/波浪线、缩进、长围栏及嵌套边界；CodeMirror 语言包按需加载，保持主编辑器包轻量，并补齐对应装饰与回归测试。
- 图片工作流：粘贴图片可直接在编辑器中预览；修改自动生成的图片路径时，原生端采用预检、冲突保护与回滚机制完成文件重命名，避免覆盖或半完成状态。
- 文档与窗口：新增可靠的新建文档入口和文件夹深链接处理；打开目标文档时优先复用合适窗口，同时保护含未保存内容的现有标签；工具栏空白区恢复原生窗口拖动。
- 外观设置：新增独立外观页、七套内置主题、跟随系统模式与一键恢复默认；关于页从应用元数据动态读取版本号。
- 架构与性能：Markdown 渲染、深链接监听从主应用组件拆分为独立 hooks；代码语言数据拆包加载，主编辑器资源体积显著下降。
- 回归保障：259 项前端测试、13 项 Rust 测试、20 项原生端到端测试及完整 Markdown 语法文档显示测试通过；类型检查、代码规范、格式、Clippy、生产构建、包体预算与生产依赖安全审计均通过。

## Trust notice / 安全提示

Same as v0.8.2. 同 v0.8.2。

---

# TextMark v0.8.2

TextMark 0.8.2 completes the latest Markdown Preview parity improvements and adds a full-document rendering regression suite. Rendering now follows CommonMark soft-break semantics, preserves safe GFM table alignment, produces stable Chinese anchors, keeps long code lines horizontally scrollable, and prevents literal HTML-looking task text from truncating the remainder of a document. The release also includes auto-save, multi-document tabs, custom themes, image paste and rename workflows, deep-link handoff, and related desktop reliability improvements.

TextMark 0.8.2 完成最新 Markdown Preview 对标改进，并新增整篇 Markdown 文档渲染回归测试。渲染现遵循 CommonMark 软换行语义，安全保留 GFM 表格对齐，生成稳定的中文锚点，超长代码行支持横向滚动，并修复任务项中的字面 HTML 样式文本可能截断后续内容的问题。本版本还包含自动保存、多文档标签、自定义主题、图片粘贴与重命名、深链接交接及相关桌面端可靠性改进。

## Highlights / 主要更新

- Markdown 渲染：修复软换行、中文标题锚点、表格对齐和超长代码块横向滚动；保留脚本、事件属性与 iframe 的安全过滤。
- 文档完整性：任务列表不再重复注入未转义源码，含字面 `<script>` 的任务项不会吞掉后续内容与脚注。
- 编辑与工作流：增加自动保存、多文档标签、主题自定义、图片粘贴/重命名，以及外部编辑器和 LLM 深链接支持。
- 回归保障：将完整 Markdown 语法文档接入原生桌面端端到端测试；248 项前端测试、Rust 测试、Clippy、构建与端到端套件均通过。

## Trust notice / 安全提示

Same as v0.8.1. 同 v0.8.1。

---

# TextMark v0.8.1

TextMark 0.8.1 fixes a native print fallback reliability issue: repeated or concurrent exports now receive unique, sanitized temporary filenames, preventing one PDF export from replacing another. A Rust regression test covers uniqueness and extension sanitization. Default Chinese and cross-platform support are unchanged.

TextMark 0.8.1 修复原生打印回退流程的可靠性问题：重复或并发导出现在会获得唯一且已清洗的临时文件名，避免一个 PDF 导出覆盖另一个。新增 Rust 回归测试，覆盖路径唯一性与扩展名清洗。默认中文与跨平台支持不变。

## Highlights / 主要更新

- 导出可靠性：macOS 原生打印回退的临时 PDF 文件名加入高精度时间戳与进程内序列号；保留扩展名白名单清洗和 `pdf` 默认值。
- 回归保障：新增 `temporary_export_paths_are_unique_and_sanitize_extensions` Rust 单元测试。

## Trust notice / 安全提示

Same as v0.8.0. 同 v0.8.0。

---

# TextMark v0.8.0

TextMark 0.8.0 completes the current Markdown Preview `main` parity pass (v0.0.49 plus its sidebar-selection fix). Output actions now wait for Mermaid, fonts and images before capture; macOS Print and Export as PDF use the native vector-capable Save as PDF workflow; Always on Top correctly yields while the window is full screen; settings are a dedicated, lightweight native window with General, Privacy and About panes; and the source editor gains Markdown-aware formatting toggles and visible syntax decorations. Quick Look adds immediate Command-A/Command-C selection and a Copy Markdown action. Default Chinese and cross-platform support are unchanged.

TextMark 0.8.0 完成本轮对 Markdown Preview `main`（v0.0.49 及侧边栏选择修复）的对标。所有输出操作会在 Mermaid、字体与图片完成后再捕获；macOS 的打印与导出 PDF 使用保留矢量内容的原生“存储为 PDF”流程；窗口全屏时置顶会正确让出；设置改为轻量、独立的原生窗口，包含通用、隐私与关于分页；源码编辑器新增 Markdown 感知的格式切换和可见语法装饰。Quick Look 支持立即 Command-A/Command-C 选择与“拷贝 Markdown”操作。默认中文与跨平台支持不变。

## Highlights / 主要更新

- 输出可靠性：HTML、PNG、PDF 与打印统一等待预览水合，确保 Mermaid、Web 字体和图片准备完成；PDF 多页切片按实际 A4 几何计算。
- 原生 PDF：macOS 打印与“导出 PDF”改走 Wry 系统打印面板，可通过“存储为 PDF”保留可选择文字及矢量图；旧 WebKit 接口失败时保留安全回退。
- 视觉对齐：压缩连续空行的末行、修正标题前间距与列表圆点尺寸/偏移，补齐浅色打印合同。
- 编辑体验：格式工具栏改为幂等切换（加粗、斜体、删除线、代码、链接、标题、列表、任务、引用）；CodeMirror 仅装饰可视区域，显示 frontmatter、围栏、引用、列表、任务及内联格式。
- 设置：独立 Settings WebView 提供通用/隐私/关于三页、更新通道与自动检查；v1–v4 设置自动迁移至 v5，独立窗口不再启动文档 I/O、文件监听或 Markdown Worker。
- 窗口与菜单：全屏时自动暂停置顶、退出全屏恢复；“新标签”与上游一致地打开文件选择器，另保留“新建空白文稿”。
- Quick Look：原生预览支持 Command-A/Command-C、文本选择与“拷贝 Markdown”按钮；Release CI 继续负责 Xcode host 验证。

## Trust notice / 安全提示

Same as v0.7.0. 同 v0.7.0。

---

# TextMark v0.7.0

TextMark 0.7.0 completes a desktop UI layout deep-check against the latest Markdown Preview `main`: the editor now measures like the preview (40px gutters, a 740px centered column, 1.52 line height) and renders source headings at the preview's typographic scale; switching between edit and preview hands the reading position over instead of restarting at the top; the find bar follows the upstream two-stack layout; Windows/Linux toolbars no longer reserve dead space for window controls; the sidebar rows and section header match the upstream source list; and the formatting toolbar aligns with the editor column even when the sidebar or inspector is open. Default Chinese and cross-platform support are unchanged.

TextMark 0.7.0 完成对标最新 Markdown Preview `main` 的桌面 UI 布局深检：编辑器与预览度量逐像素一致（40px 页边距、740px 居中内容列、1.52 行高），源码标题按预览音阶渲染；编辑/预览切换时交接阅读位置而非回到顶部；查找栏对齐上游左右双栈布局；Windows/Linux 工具栏不再为窗口按钮预留死空间；侧边栏行高与节标题对齐上游源列表；格式工具栏在侧栏/检查器打开时仍与编辑列对齐。默认中文、三平台不变。

## Highlights / 主要更新

- 编辑器/预览度量对齐：`cm-scroller` 40px 内边距 + `cm-content` 740px 居中列 + 32/0/48 页边距 + 1.52 行高，与预览列逐像素一致；`content-full` 同步；移除死变量 `--editor-zoom`。
- 编辑器标题样式：新增 `editorHeadings` ViewPlugin，源码标题按预览小三度音阶渲染（`cm-md-h1…h6`，H1 700/其余 600，`heading-after-blank` 紧凑 4px）；语法树判定覆盖 ATX/Setext/引用内标题，围栏/行内代码内不误判，setext 下划线行不放大。
- 编辑↔预览滚动交接：切换模式时按滚动 fraction 双向恢复阅读位置（预览→编辑、编辑→预览），同模式调用不跳滚动；新增 `scrollFraction` 钳制辅助。
- 查找栏对齐上游左右双栈：左组（输入 + Match: + 包含/开头为），右组（计数 + 区分大小写 + 上/下一个 + 完成）。
- Windows/Linux 工具栏 150px 预留仅浏览器回退模式保留（`data-runtime=browser`），Tauri 运行时消除死空间；macOS 92px 交通灯预留不变。
- 侧边栏对齐上游：大纲/文件树行高统一 30px，节标题 12px semibold + secondary 色，标题行 52→40px。
- 格式工具栏移入工作区列并随列宽居中（`calc((100% - 820px)/2)`），侧栏/检查器打开时控件与编辑列精确对齐。
- 小修：hr 间距两处统一为 12px 上距（对齐上游 0.0.48）；zoom 按钮圆角统一；清理 `.document-actions` 6 条死 CSS。
- 新增 9 项单元测试（editorHeadings 6 + scrollFraction 3），全部 200 项通过；WebDriver e2e 顶栏/查找/模式矩阵通过。

## Trust notice / 安全提示

Same as v0.6.0. 同 v0.6.0。

---

# TextMark v0.6.0

TextMark 0.6.0 aligns with the latest Markdown Preview `main` (v0.0.48/v0.0.49): Always on Top keeps the window in front (⌃⌘T on macOS or the toolbar pin), Open in LLM hands the document to Codex/Claude with file and folder context through their deep links (with a copy-and-open fallback for long documents), Settings gains a preview text-size (Aa) picker and a default Open With target, and Mermaid popup windows are titled from the nearest heading. Typography follows the upstream minor-third heading scale (only H1 is weight 700), completed tasks render struck through and muted, and list bullets are drawn as larger circles. Default Chinese and cross-platform support are unchanged.

TextMark 0.6.0 对齐最新 Markdown Preview `main`（v0.0.48/v0.0.49）：Always on Top 让预览窗口置顶（macOS ⌃⌘T 或工具栏图钉）；在 LLM 中打开改为通过深链接把文件与文件夹上下文交给 Codex/Claude（长文档自动回退「拷贝全文+打开」）；设置新增预览文字大小（Aa）与默认打开方式；Mermaid 独立窗口标题跟随最近标题。排版采用上游小三度标题音阶（仅 H1 为 700 字重），已完成任务显示删除线与弱化，列表圆点放大为圆环。默认中文、三平台不变。

## Highlights / 主要更新

- Always on Top（对齐上游 0.0.48）：View 菜单「窗口置顶」+ macOS ⌃⌘T 加速键 + 菜单勾选状态实时同步；工具栏新增可自定义置顶项（图钉图标、激活态）；会话级不持久化，与上游一致。
- Open in LLM 深链接与上下文（对齐上游 0.0.49）：Codex 使用 `codex://new?prompt=<路径提示词>&path=<文件夹>`；Claude 使用 `claude://code/new?q=<内嵌文档>&folder=<文件夹>`（≤12,000 字符，超长自动回退「拷贝全文+打开」）；未保存文档安全回退；ChatGPT 维持原行为（上游为 macOS 专有事件，跨平台不可复刻）；工具栏 LLM 菜单记忆并勾选上次选择。
- 设置窗口：新增预览文字大小 Aa 三档（小 90 / 中 100 / 大 125，映射既有缩放档位，非档位时不显示选中）；新增「默认打开方式」下拉（列出已安装编辑器，写入 `defaultOpenTarget`）。
- Mermaid 独立窗口：标题跟随文档中最近的标题（清洗/截断 120 字符），无标题时回退「图表窗口 / Diagram Window」。
- 排版对齐上游 0.0.48：六档标题改用小三度音阶（1.802/1.602/1.424/1.266/1.125/1em），仅 H1 使用 700 字重、其余 600，h6 移除次要色；已完成任务 `- [x]` 勾选后即时删除线+弱化（`:has`）；列表圆点放大为 0.2em 圆环（透明 marker + `::before`，兼容 RTL）。
- 新增 8 项单元测试（LLM 深链接构造/边界/回退 7 项 + 设置归一化 1 项），全部 191 项测试通过；`cargo clippy -D warnings` 通过。

## Trust notice / 安全提示

Same as v0.5.6. 同 v0.5.6。

---

# TextMark v0.5.6

TextMark 0.5.6 ships the full desktop UI audit: a complete design-token system, dialog accessibility (Escape close, focus trap), a single theme source of truth, a centralized platform adapter, and an ESLint/Prettier toolchain enforced in CI. Cross-platform window-control layout is verified automatically (unit + WebDriver platform-adapter tests) without needing physical Windows/Linux machines. Default Chinese and cross-platform support are unchanged.

TextMark 0.5.6 发布桌面 UI 全面审计成果：完整 Design Tokens 体系、对话框无障碍（Esc 关闭、焦点陷阱）、主题单一数据源、平台适配器集中化，并在 CI 中强制 ESLint/Prettier。跨平台窗口控件布局已通过单元测试 + WebDriver 平台模拟自动验证，无需真实 Win/Linux 机器。默认中文、三平台不变。

## Highlights / 主要更新

- Design Tokens：建立颜色/间距/圆角/字号/图标/控件高度/阴影完整 Token 体系（`--space-*`、`--radius-*`、`--text-*`、`--shadow-*`、语义色等），替换 App.css 中 30+ 处硬编码颜色与混用圆角/字号，视觉等价、圆角归一到 6/8/12/16 阶梯。
- 对话框无障碍：新增 `useDialogAccessibility`（打开自动聚焦、Tab 焦点循环、Esc 关闭、关闭后还原焦点），接入设置/导出/自定义工具栏；首次启动"设为默认"提示支持 Esc；查找框补回可见焦点环。
- 主题与平台：`useTheme` 改为受控单一数据源（跟随系统/浅色/深色）；平台判断（Windows/Linux/macOS、Tauri/浏览器）集中到 `platform.ts` 适配器。
- 代码清理：移除未挂载的死组件 StatusBar/BrandMark。
- 工程化：新增 ESLint（flat config，Babel 解析 TS，适配 TypeScript 7 原生编译器无编译器 API 的限制）与 Prettier（semi:false、单引号、printWidth 140），`npm run lint` / `format:check` 纳入 CI 门禁。
- 跨平台自动验证：新增 `detectPlatform/detectRuntime/isMacos` 单元测试（9 项）；e2e 新增平台适配断言——macOS 窗口控件居左、Windows/Linux 控件右上且关闭按钮居右、浏览器回退可见性。

## Trust notice / 安全提示

Same as v0.5.5. 同 v0.5.5。

---

# TextMark v0.5.5

TextMark 0.5.5 guarantees the macOS traffic lights: the app now re-applies the visible title and the close/minimize/zoom buttons at runtime (and disables automatic window tabbing), so the red/yellow/green controls show on every build and launch path, including binaries linked against older macOS SDKs. The macOS CI build also moves to the macOS 26 runner to match the verified build environment. Default Chinese and cross-platform support are unchanged.

TextMark 0.5.5 彻底保证 macOS 交通灯显示：应用运行时强制恢复可见标题与关闭/最小化/缩放按钮（并禁用自动窗口标签化），无论构建环境与启动方式，红黄绿三灯均显示；macOS CI 构建改用 macOS 26 runner，与已验证的构建环境一致。默认中文、三平台不变。

## Highlights / 主要更新

- 交通灯运行时兜底：setup 与启动后各强制一次 `NSWindow.titleVisibility = visible`、三个标准窗口按钮 `setHidden(false)`/`setEnabled(true)`，并 `setAllowsAutomaticWindowTabbing(false)` —— 旧 SDK 链接的二进制在 LaunchServices 启动下曾出现交通灯被抑制，现在无论构建 SDK 如何都保证可见。
- macOS CI：`runs-on: macos-15` → `macos-26`（Xcode 26 工具链，与实机验证环境一致）。
- 沿用 v0.5.4：移除原生标签化（`tabbingIdentifier`）、启动零阻塞（最近文件后台预热）、顶栏点击矩阵 e2e、发布说明只含本次版本。

## Trust notice / 安全提示

Same as v0.5.4. 同 v0.5.4。

---

# TextMark v0.5.4

TextMark 0.5.4 fixes the root cause of the still-missing macOS traffic lights and dead top-area clicks, removes a startup hang, and polishes the release notes. Default Chinese and cross-platform support are unchanged.

TextMark 0.5.4 根治 macOS 交通灯仍不显示与顶部点击失效问题，消除启动卡顿，并润色发布说明。默认中文、三平台不变。

## Highlights / 主要更新

- macOS 交通灯彻底修复：根因是 `tabbingIdentifier` 启用了原生窗口标签化 —— 标签栏一旦出现过，macOS 就会持久化"显示标签栏"（`NSWindowTabbingShoudShowTabBarKey`）并在每次启动时恢复，标签栏下交通灯被抑制、工具栏顶部被覆盖。v0.5.4 移除 `tabbingIdentifier`（不再启用自动标签化），并在启动时清除历史残留的标签栏偏好。
- 顶部按钮点击彻底修复：移除原生标签栏后不再有原生层覆盖工具栏；`data-tauri-drag-region` 仍只保留在空白弹性空间/空格项上；新增 WebDriver 顶栏点击全量矩阵（边栏/打开方式/缩放/搜索/编辑/简介/共享/更多菜单/自定义/设置/查找栏逐一断言）。
- 启动卡顿修复：菜单初始化不再在主线程同步读取"最近使用"（Group Container 再供给期间该 I/O 可阻塞数十秒，导致窗口迟迟不出现）；改为后台线程预热缓存后回主线程重建菜单，启动零阻塞。
- 发布说明润色：publish 作业截取本次版本段落后去除末尾分隔线。

## Trust notice / 安全提示

Same as v0.5.3. 同 v0.5.3。

---

# TextMark v0.5.3

TextMark 0.5.3 restores the macOS traffic lights (red/yellow/green window controls) and native window title, fully aligns the top area with upstream Markdown Preview, fixes intermittent toolbar clicks, and makes GitHub release notes show only the current release. Default Chinese and cross-platform support are unchanged.

TextMark 0.5.3 恢复 macOS 红黄绿交通灯与原生窗口标题，顶部区域完全对齐上游 Markdown Preview，修复顶栏点击间歇失灵，并让 GitHub 发布说明只含本次版本。默认中文、三平台不变。

## Highlights / 主要更新

- macOS 交通灯恢复显示：移除 `hiddenTitle`（此前将 `NSWindow.titleVisibility` 设为 `.hidden` 导致无工具栏窗口连交通灯一并隐藏）；窗口标题显示文档名（含"已编辑"后缀），移除网页自绘居中标题避免重复。
- 顶部区域对齐上游：工具栏高度 68→52px（macOS 统一工具栏高度，与交通灯垂直对齐）；查找栏 40→36px；原生标题 + 交通灯 + 工具栏项同栏。
- 顶栏点击间歇失灵修复：`data-tauri-drag-region` 仅保留在空白弹性空间/空格项上，不再覆盖按钮/下拉，点击稳定生效。
- CI 发布说明：publish 作业截取 RELEASE_NOTES.md 本次版本段落作为发布说明，不再累积历史版本。

## Trust notice / 安全提示

Same as v0.5.2. 同 v0.5.2。

---

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
