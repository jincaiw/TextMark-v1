# TextMark 桌面 UI 对标实施方案与计划

- **项目**：TextMark-v1
- **参照应用**：本机 `/Applications/Markdown Preview.app`
- **参照版本**：Markdown Preview `v0.0.60`，发布tag解引用提交 `0022426b59af68e0a9e45191be2de66c5fb102bd`；复核main `d4a033aaf0d31028175a4f6195602fe2a2ed5134`（相关五个顶部/分栏源码文件diff为空；不再混称tag/main）（本轮公开仓库 API 与固定提交源码复核）
- **TextMark 基线**：本轮交付目标 `v0.10.8`（`v0.10.7` 已提交并建标签发布）；上游 Toolbar、Sidebar、Inspector 和编辑焦点行为按当前核验基线记录。
- **v0.10.8 收口（2026-09-25）**：按用户顶部反馈第 4 条消除文件名重复渲染。核验固定基线源码 `DocumentWindowController+Sidebar.swift:13` 与 `SidebarViewController.swift:137–144`：上游工具栏不含文档名，文件名由原生窗口标题与侧栏 `TitleItem`（`secondaryLabelColor`）承载。据此删除 `Toolbar.tsx` 的 `.toolbar-document-context` / `.toolbar-document-name` 及 `fileName` prop，并清理 `App.css` 三处相关规则；侧栏标题样式（`--muted`、12px、600）已与上游次级标签色意义一致，未再改动。同时修复 `scripts/capture-ui.mjs` customizer 场景就绪条件：`[role="dialog"]` 会先命中始终存在于 DOM 的外观浮层（`.appearance-popover`，关闭时不可见），改用 `.toolbar-customizer` 后本地 preview/edit/customizer/dark/窄窗五场景均为 `failures=[]`，与 CI 日志中的超时一致可复现、可归因。门禁：前端 46 文件/420 项、TypeScript、ESLint、format:check、diff-check 通过。

- **v0.10.7 收口**：用户于 2026-09-24 确认 macOS 原生验收通过：系统默认与已安装第三方编辑器打开 Markdown、原生标题栏/Toolbar、系统打印面板及打印/取消恢复均通过。浏览器/CDP 证据仍仅代表 WebView DOM 行为，不替代上述原生验收。自动化门禁：前端 46 文件/420 项、TypeScript、ESLint、format:check、Rust fmt/test 23项/Clippy 通过；生产 Vite 构建在 `/tmp` 隔离目录成功。产品变更、测试、本账本与随附验收证据已提交至 `main` 并创建 `v0.10.7` 标签触发跨平台发布；AppKit 像素级对齐仍为独立证据边界。
- **文档版本**：实施方案 `v1.4`
- **B2修订**：首位侧栏配置项随实际侧栏宽度跟随，空间不足/收起/自定义移位回退紧凑排列；标题约束在弹性区域内。浏览器验证通过；2026-09-24 用户确认 macOS 原生窗口/Toolbar 验收通过。
- **C1修订**：顶部 aA 浮层复用已有设置状态；外观循环、7个预设、缩放档位与设置页入口完成浏览器验证。全量前端门禁通过；桌面debug构建曾被 `safe-delete` 对 `dist/assets` 的批量清理保护拦截，未删除产物或绕过保护；用户于 2026-09-24 确认原生外观及打印验收通过。
- **B1修订**：Find/Formatting移入标签下内容覆盖层；修复实际cm-theme-light包装层高度链；完成三种宽度双标签编辑+查找显隐往返验证。
- **C1修订（2026-09-23）**：新增 ToolbarAppearance 外观浮层，含缩放、系统/浅色/深色循环、7个主题预设及自定义设置入口；新增受控交互与键盘关闭测试，1440/780浅色及1440深色浏览器场景通过。Chromium媒体模拟不等于原生OS明暗验收。
- **本轮修订**：以 v0.0.60 源码替代历史截图作为结构事实；撤回顶部已完全对齐、自定义语义未改变及双标签已验收的推断。优先布局/UI，尺寸距离次之。

- **T06 收口（2026-09-23）**：默认 Toolbar 已将 Inspector/Share/Edit 拆为独立可排序项；旧 v5 默认与 v7 复合默认识别迁移到新默认，其他自定义配置保持原数组。全量 Vitest 单 worker 46文件/416项、TypeScript、ESLint、format:check 与 diff-check通过；原生 NSToolbar 定制行为尚未实机复验。
- **T11 书签差异核验（2026-09-23）**：TextMark `src` 中没有 bookmark/Bookmarks/书签能力。固定上游提交 `d4a033a` 的 Sidebar 仅包含 TOC 与 Project Navigator，未发现书签面板或书签模型。故本轮不以该基线为由新增书签功能；已更正 U03/F03、P1 工作区草案、T11 与验收条目中的书签差异描述。
- **T11 面板专项补验（2026-09-23）**：扩充 `scripts/capture-ui.mjs` 三个 workspace-panels 场景，覆盖真实 CDP 指针拖动、左右面板最大宽度 clamp、localStorage 写入、刷新后 310/360px 宽度恢复。键盘/开合/最小值场景 17 项、拖动与最大值场景 7 项、刷新恢复场景 6 项均全部通过（`failures=[]`）；证据为 `workspace-panels-extended-1440.png/.json`、`workspace-panels-drag-1440.png/.json`、`workspace-panels-persistence-1440.png/.json`。这些是 Chromium/WebView DOM 事件证据，不等于 AppKit 原生分隔器行为。

- **上游基线更新（2026-09-25）**：上游已发布 `v0.0.61`（tag `377c394`，2026-09-24T10:12Z），本账本下方 v0.0.60 表仍按固定提交 `d4a033a` 作为已验证事实基线记录历史实施。v0.0.61 相对 v0.0.60 变更 44 个文件，其中与顶部/工作区直接相关的是 `DocumentWindowController+Toolbar.swift`（+21/−8）、`FormattingBar.swift`（+772/−20）、`Find.swift`（−62）、`MainSplitViewController.swift`（+102/−60）、`EditorHTML.swift`、主题与设置文件。已完成的 v0.10.7 与本版新增的 #438「侧栏控件保持位于侧栏之上」方向一致（sidebarTrackingSeparator 在全部受支持系统统一使用，不再按 macOS 26 分支）；v0.0.61 的其余新增项（macOS 26 浮动格式控件、代码块复制/换行控件、主题记忆自身外观与阅读设置、模式切换文本重叠与 ⌘S 读模式保存等）尚未在 TextMark 逐项对标，列为下一批次输入，不在 v0.10.7 中宣称已对齐。

## 本轮再评估：v0.0.60 顶部优先实施账本

证据固定于 [d4a033a](https://github.com/pluk-inc/markdown-preview/tree/d4a033aaf0d31028175a4f6195602fe2a2ed5134)。`docs/screenshot-main.png` 图中徽标为 v0.0.14；编辑截图仍显示旧缩放按钮。两图只用于历史风格参考，不能据此证明最新版布局。远端发布时间与当前会话注入日期存在跨日差异，本轮以实际查询的版本/提交为准，不倒推发布日期。

| ID | 上游事实与证据 | TextMark 改前问题 | 实施与验收 | 状态 |
|---|---|---|---|---|
| T01 | Toolbar.swift:44–75：macOS 26+ 模式选择→弹性空间→侧栏开关→跟随分隔线→导航→弹性空间→Open→外观→Inspector/Share/Edit→Search | 固定开关+文件下拉、无分栏跟随区域 | A批双模式按钮；B2首位侧栏跟随，开关靠分隔线；真实鼠标调宽与收起重开通过 | 浏览器与用户确认的 macOS 原生验收通过 |
| T02 | Sidebar.swift:24–65：大纲/文件两按钮、单选、隐藏时均未选；选择模式会打开侧栏 | 图标与箭头竖排、模式状态不可见 | 替换下拉为直接按钮，aria-pressed 与真实状态一致；隐藏后选择自动展开 | 第一批 |
| T03 | Toolbar.swift:181–186：无前后历史隐藏导航 | 固定显示且忽略自定义删除 | 依据历史和配置渲染；导航删除、排序、间隔不再被过滤 | 第一批 |
| T04 | Toolbar.swift:397–418：textformat.size 外观按钮，弹出字号/外观/主题 | 齿轮下拉，只有缩放与设置 | aA 浮层提供字号、system/light/dark循环、7主题预设、自定义设置入口；受控组件、设置持久化与窄窗几何已验证 | C1浏览器验证与用户确认的 macOS 原生验收通过 |
| T05 | Find.swift:11–26：NSSearchToolbarItem，preferredWidth=320 | gap 测量8与CSS4不符，宽屏也隐藏；窄屏 input 不可见 | 稳定宽度预算、读取计算样式、搜索可聚焦；980/1440 默认入口可见；窄窗溢出可返回 | 第一批 |
| T06 | Toolbar.swift:77–103：侧栏/导航/空白可定制，Inspector/Share/Edit可独立移动 | 4类配置被丢弃、复合动作溢出无法访问；默认仍合并三动作 | 保留自定义数组顺序、空白及溢出入口；独立 Inspector/Share/Edit 默认项；旧复合默认迁移到新版，非默认自定义布局原样保留；现代 schema 不误迁移 openWith | 浏览器组件回归与设置迁移测试通过；用户确认 macOS 原生 Toolbar 验收通过 |
| T07 | Find.swift:89–93：查找覆盖层不在 tabs 上方、不重排 tabs | FindBar 位于 Toolbar 与 tabs 之间 | B1移入文档工作区且不重排内容；本轮以真实 CodeMirror 文档验证非空查询计数、Begins With 模式、导航控件、单次替换及全部替换 | 浏览器交互已验证；用户确认原生窗口/打印通过，但未单独报告原生查找交互 |
| T08 | 原生文档标签+格式覆盖层 | 没有双标签截图却曾标完成 | A批双标签；B1三种宽度双标签+查找+编辑实际组合回归通过 | 浏览器组合场景已验证；原生窗口/打印通过，未单独确认双标签行为 |
| T09 | AppKit 原生窗口控制与侧栏 titlebar 区域 | 浏览器模拟红绿灯又加92px原生预留 | 按 runtime 分离预留；用户确认原生标题栏/Toolbar验收通过；像素级逐点校准未作为本轮验收项 | 原生交互验收通过；像素级对齐另列
| T10 | #416 自动明暗外观同步；#415 编辑焦点 | 历史已有焦点修复，未重验系统外观切换 | C1已验证 Chromium `prefers-color-scheme` 模拟与 system/light/dark设置循环；用户确认 macOS 原生窗口/打印验收通过；单独的系统主题切换覆盖不在该确认中 | 浏览器验证通过；原生主题单项未确认 |
| T11 | 三栏桌面工作区、导航/Inspector 各面板 | 已有能力不能继续按旧表认定缺失 | 浏览器专项覆盖三栏开合、Inspector tab 切换、分隔器键盘 1px/10px、鼠标拖动、最小/最大值 clamp、宽度持久化与刷新恢复；固定上游 Sidebar 只证实 TOC/Project Navigator，两端均未证实书签面板 | DOM/浏览器交互与宽度恢复已验；AppKit 原生焦点/分隔器仍待验，书签不纳入本轮差异 |

### 导出回归验收（2026-09-23）

- 使用固定 fixture `e2e/fixtures/export-regression.md` 运行 `scripts/verify-exports.mjs`，输出隔离在 `/tmp/textmark-export-qa-20260923`，未写入仓库。
- HTML/PNG/PDF 均成功生成；PNG 签名正确、尺寸 1800×4116，PDF `%PDF-` 签名、353269 bytes。渲染包含 6 个标题、2 张表、2 个任务项、1 个 alert、2 个公式和 1 个 Mermaid 图；导出 HTML 有 CSP、无脚本/屏幕控件/缺失图片。主题状态恢复，网络请求失败和浏览器异常均为 0。
- 源码复核 `src/App.css` 的 `@media print`：明确隐藏 `.native-toolbar`、`.native-sidebar`、`.document-tabs`、`.inspector-panel`、`.formatting-toolbar`、`.find-bar` 和 toast；解除根容器/预览滚动高度限制，设置 A4 与分页避免规则。此项是 print CSS 静态契约核对，不代表浏览器打印渲染或原生打印实测。
- **打印媒体浏览器验收（2026-09-23）**：`scripts/capture-ui.mjs` 通过 CDP 切换 Chromium print media，核验界面隐藏、文档内容布局并以 `Page.printToPDF` 生成 PDF。默认预览、Inspector 打开、Find 打开、双标签+编辑器+Find 打开场景均报告 `failures=[]`。双标签场景中 tabs/格式栏/Find 隐藏、编辑正文可布局（954字符），PDF 2页。另在真实页面根节点挂载 Toast 后验证 `.toast` 的打印计算样式为 `display:none`，预览正文796字符/1440×1258.7 CSS px，PDF 193,802 bytes/2页，`failures=[]`。证据：`print-media-1440.*`、`print-inspector-1440.*`、`print-find-1440.*`、`print-tabs-find-1440.*`、`print-toast-1440.*`（PNG/JSON/PDF）。初次扩展验收发现编辑态无 `.markdown-body`，脚本已改为兼容检测 `.cm-content`；并将打印验收路由统一为 `print*` 场景，避免 fixture 错误断言。最终各场景通过，format、TypeScript 和 diff-check 通过。证据仅代表 Chromium print-media / PDF，不等同 macOS 原生打印面板或实体打印验收。
- **原生打印验收边界（2026-09-23复核）**：Tauri 路径最终调用 Rust `window.print()`（`src-tauri/src/lib.rs::print_current_window`），会打开系统打印面板；CDP/浏览器脚本不能可靠自动化该系统面板，也不能代替实纸输出。本机当前无 TextMark GUI 进程；仅有 `/Applications/TextMark.app`（2026-09-22安装）与 `/tmp/TextMarkVerify.app`（2026-09-21验证包），都不能证明包含当前未提交源码，因此不拿旧二进制冒充本轮验收。待能安全构建当前工作树且启动本轮二进制后，需人工完成：在预览态与编辑态各打开一次打印面板；确认预览/编辑正文、表格/图示存在且工具栏、Tabs、Inspector、Find、Toast 不出现在预览纸张；检查 A4 分页、页边距、缩放和取消/关闭后应用仍可操作；至少另存一份 PDF 并核对页数/首末页。该手工项目未完成前保持“原生打印待验”，不阻断已通过的 Chromium print-media 结论。

### 原生窗口及当前源码浏览器复核（2026-09-24）

- 前一轮 `tauri dev` 已完成 Rust 编译，屏幕截图曾确认 TextMark 原生窗口显示 README 预览和侧栏；但该 `target/debug/textmark` 进程现已退出。本机仍有当前源码 Vite 开发服务器 `http://127.0.0.1:1420/`，首页返回 HTTP 200。
- 用 `scripts/capture-ui.mjs` 对当前源码默认预览场景运行 Chromium CDP 验收，报告 `ready=true`、`scenarioReady=true`、标题 `README.md`、语言 `zh-CN`、主题 `light`、`failures=[]`；1440×900 几何断言通过：搜索入口可见、侧栏模式控件并排、无横向溢出、主要 Toolbar 槽无重叠。报告输出 `/tmp/textmark-current-preview.png`，仅用于本轮浏览器验证，不等价原生 AppKit 实拍。
- 首次脚本启动没有匹配到 Chrome page target；显式指定 Chrome 可执行路径后复跑通过。系统打印面板、原生 NSToolbar/titlebar、macOS 系统外观切换仍未实机验收。
- **打印调用链源码核验**：Tauri 2.11.5 `WebviewWindow::print()` 委托 `Webview::print()`；该 API 注释说明系统对话框在 macOS Wry 支持。tauri-runtime-wry 2.11.4 的 dispatcher 把 `WebviewMessage::Print` 送入事件循环，处理分支对目标 WebView 调用 `webview.print()`；`send_user_message` 在主线程直接派发、非主线程经 event-loop proxy 投递。Wry 0.55.1 macOS 实现调用 `WKWebView.printOperationWithPrintInfo:`，创建 `NSPrintOperation`，设置 `canSpawnSeparateThread` 并用 `runOperationModalForWindow` 显示系统打印面板。这个源码链确认线程/平台调用路径，不代表本机实际打印结果。
- 前端门禁 TypeScript、Vitest 46文件/416项、ESLint、format:check 与 `git diff --check` 通过。工作树仍含混合改动，未逐项核定发布范围，故不提交、推送或发布；桌面构建仍受 dist/assets 批量删除安全保护约束，不绕过。
- **当前工作树原生启动复验（2026-09-24）**：通过 Tauri CLI 临时配置把前端 `outDir` 与 `frontendDist` 指向 `/tmp/textmark-native-verify-dist`，`tsc + vite build` 和 macOS debug `--no-bundle` 构建均成功，仓库 `dist/assets` 未清理/覆盖。将新构建的 `src-tauri/target/debug/textmark` 复制到 `/tmp/TextMarkCurrent.app` 后分别比对 SHA-256 一致（`4d9b10d79de7fb5228d08c9ccf344cc996712dfedd86b93d02eaee996f9561cd`），ad-hoc 签名有效。LaunchServices 记录该 bundle 为前台应用（PID 68160，check-in `2026-09-24 08:22:43`），同 PID 的 WebKit GPU、WebContent、Networking 子进程存在；用户提供截图确认当前窗口展示 README 预览/编辑分栏及应用菜单，启动和主界面显示通过。该截图未显示打印面板，且受 TCC `-10004` 阻止的 System Events 快捷键尝试没有触发 ⌘P。因此系统打印面板、预览/编辑态打印、取消恢复、NSToolbar/titlebar 与原生系统外观仍待人工交互验收；WebKit/LaunchServices 存活不证明这些交互正确。仓库原 `target/debug/bundle/macos/TextMark.app` 二进制哈希与本轮不同，未复用作新代码证据。其后并行运行 Rust clippy/test 时，Cargo 重新编译并覆盖了 `target/debug/textmark`；当前磁盘上该路径与仍在运行进程已加载的 bundle 副本哈希不同，因此启动时 hash 比对仍可证明启动副本来源，但不可再拿被覆盖后的 target 路径 hash 代称运行进程的映像。Rust `cargo fmt --check`、clippy `-D warnings`、Rust 21 项测试均通过；仓库 `dist/assets` 仍完整（9.1 MB）。

- **当前源码组合回归（2026-09-24）**：复用现存 Vite `http://127.0.0.1:1420/` 并显式指定 Chrome，对 `tabs-find` 与 `workspace-panels` 场景复验，均 `ready=true`、`scenarioReady=true`、`failures=[]`。前者确认双标签编辑、查找和格式栏处于文档工作区，开/关/重开 Find 后 tabs、侧栏、工作区、编辑器、真实 `.cm-scroller` 与 `scrollTop=200` 几何/滚动不变，Find 焦点正确；后者确认三栏开合、Inspector tab 切换、键盘步进和最小宽度 clamp、关闭重开。截图 `/tmp/textmark-current-tabs-find.png`、`/tmp/textmark-current-panels.png`，仅当前源码 Chromium 回归证据，不替代原生 AppKit。

- **追加当前源码组合验收（2026-09-24）**：同一 Vite 源码对 `appearance`、`sidebar-tracking`（980×900）、`print-tabs-find` 场景复跑。三份报告均 `failures=[]`：外观浮层确认缩放/自动外观/7个预设/自定义入口均在视口内，system/light/dark 状态切换与颜色变量一致；窄窗测试确认侧栏跟随分隔线、展开/收起/恢复和无横向溢出；双标签编辑+查找打印媒体下 Tabs/Find/格式工具隐藏、正文 954 字符存在，PDF 2 页（73,723 bytes）。截图和PDF位于 `/tmp/textmark-current-appearance.png`、`/tmp/textmark-current-sidebar.png`、`/tmp/textmark-current-tabs-print.png/.pdf`。打印仍是 Chromium PDF，非系统原生打印。

### T11 面板键盘交互浏览器验收（2026-09-23）

- 新增 `scripts/capture-ui.mjs workspace-panels` 场景，以真实页面状态打开/关闭 Inspector、切换其 tab，并分别聚焦左右 `role=separator` 分隔器验证方向、1px/Shift+10px 增减、最小宽度 clamp 及 localStorage 更新。
- 1440×900 三栏最终状态：侧栏 230px、中央工作区 928px、Inspector 270px；所有断言通过（`failures=[]`）。浏览器合成键盘事件证明 WebView DOM 路径，不等于原生窗口/menu 键盘行为验收。
- 证据：`workspace-panels-1440.png/.json`，追加 `workspace-panels-extended-1440.png/.json`、`workspace-panels-drag-1440.png/.json`、`workspace-panels-persistence-1440.png/.json`。扩展断言覆盖键盘 1px/10px、最小宽度、真实指针拖动 +50/+60px、最大宽度 clamp（侧栏400px/Inspector500px）、localStorage 写入及刷新后310/360px恢复；17+7+6项断言全部通过，`failures=[]`。本次无须改产品逻辑；仅补强验收脚本。DOM/CDP 事件不等同 AppKit 原生交互；面板滚动位置保持与原生标题栏/菜单焦点仍待单独实测。

**分批顺序**：A 顶部可证实结构/交互缺陷 → B 侧栏跟随、标题区域、Tabs/Find/Formatting 层级 → C 主题浮层、工作区各面板与键盘操作 → D 原生多状态视觉验收与尺寸微调。

### C1 批执行结果（顶部外观浮层）

- 新增 `ToolbarAppearance.tsx`，顶部 aA 菜单提供缩放档位、系统/浅色/深色循环、7个主题预设和自定义外观入口；状态沿用现有 `theme`、`themePreset`、`zoom` 与设置页，不另建持久化模型。
- 主题与缩放操作受控：回调由现有设置写入路径处理，浮层保持打开；自定义入口先关闭浮层再打开外观设置页。Escape 关闭并恢复 summary 焦点、外部点击关闭、监听器卸载、缩放反馈两秒回收均有组件测试。
- 浏览器真实鼠标/CDP验收：1440×900浅色、780×640窄窗浅色、1440×900深色三场景均 `failures=[]`。7个主题卡片呈三列（3/3/1），浮层、控件在视口内；缩放100→110持久化；主题选取、system/light/dark循环、reload持久化、设置页入口、Escape/外部点击均通过。
- Chromium `prefers-color-scheme` 模拟验证 system 模式 light→dark→light 的 Web CSS 响应；该证据不是 macOS 原生外观切换证据。窄窗浏览器可见布局通过，不代表最窄原生窗口或原生 toolbar 锚点已验。
- 新增 `ToolbarAppearance.test.tsx` 21项；与 Toolbar 定向测试合计39项通过。TypeScript、相关 ESLint、`format:check`、`git diff --check`通过；本批尚未重跑全量 Vitest、桌面 debug 构建、WDIO或原生OS主题切换。
- 新增截图及同名 JSON：`top-c1-appearance-1440`、`top-c1-appearance-780`、`top-c1-appearance-dark-1440`。**当批历史状态**：当时尚未提交、未推送、未发布。

### B2 批执行结果（侧栏跟随与标题边界）

- 复核固定上游 Toolbar.swift:44–75：macOS 26+ 侧栏模式位于 titlebar 区域左侧，toggle 在右侧 tracking separator 前；旧系统无跟随区。本轮实现 WebView 中的结构对应，不宣称复刻 AppKit。
- Toolbar 新增受控 sidebarWidth；只增强配置数组首位 sidebar，不排序、不补回已删除项。跟随区域右边界对准正文 6px divider 中心，模式按钮居左、toggle 居右；sidebar 收起、移位、视口≤700、图标文字占宽不足时，先释放跟随留白再执行原有 overflow。
- 标题 max-width 受所在 flexibleSpace 约束，修复窄窗 vw 宽度可能越出宿主；仍是第一个弹性项内居中，不将“绝对窗口居中”或“原生标题锚点一致”当结论。没有弹性项时沿用不渲染标题的定制语义。
- 真实 CDP 鼠标拖动240→320→400px、关闭→模式重开、1440→780→1440，90项专项断言通过：跟随右边界分别243/323/403px，分隔中心误差均0px，toggle右缘距中心11px，重开保持400px。780下标题宿主宽74px且文字仍在其内。
- 980px三组持久化自定义配置：侧栏移位、删除、图标+文字；顺序/重复间隔保留，删除后不补回。图标+文字宽度不足时回退紧凑布局。另验980双标签编辑+Find（108项专项断言）、Inspector、深色。共7组top-b2-*.png/json，全部failures=[]；人工检查跟随、图标文字与编辑组合截图。
- Toolbar新增4项回归，合计18项；全量45文件/391项、TypeScript、ESLint、format:check、git diff --check通过；普通debug no-bundle构建成功。README未被改写。
- 边界（当批记录）：未安装重启原生验证包、未新跑WDIO；该阶段的原生标题锚点、系统主题切换、原生查找/替换、实际导出打印当时仍待验。后续验收结论见本文档开头更新；**当批历史状态**为未提交、未推送、未发布。

### B1 批执行结果（顶部内容层级）

- App.tsx 将 FindBar 从根布局移入 DocumentTools，与 FormattingToolbar 顺排覆盖在正文上方；去掉根36px行与工作区40px行，标签/侧栏/编辑器外框不再因查找显隐移动。
- 新增 DocumentTools.tsx，用 ResizeObserver 测量真实高度并写入局部CSS变量。窄列允许查找按钮换行，不裁掉完成/替换入口；格式条横向可滚动。预览留白放在文章外伪元素，编辑正文增加padding并向CodeMirror注册scrollMargins；打印隐藏工具和伪元素，未新增导出正文空白。
- 实测暴露旧`.cm-theme`规则不命中`.cm-theme-light`，修复为editor-page直属cm-theme前缀包装层。改前980宽编辑器高1243、内部maxScroll=0；改后视口554、maxScroll=689，真实滚动恢复。
- 1440/980/780三个宽度真实双标签+README编辑+查找打开→关闭→再打开：标签/侧栏/workspace/编辑器/scroller rect不变，scrollTop均维持200，查找输入保持焦点。工具高度在980为40→79→40→79，在780换行为114px。断言要求非零可滚动位置，避免0→0假通过。
- 另测980预览查找、1440编辑、显式深色，共6组截图与JSON均failures=[]。查找/格式条全部交互控件在正文列可达；截图发现半透明格式条透出正文，已改不透明底色并重拍三组组合状态。
- 新增DocumentTools组件7项测试，全量45文件/387项通过；TypeScript、ESLint、format:check、git diff --check、最终debug no-bundle构建通过。
- 尚未覆盖：查找非空命中的模式往返/替换后回归、系统明暗切换、真实导出/打印、新原生窗口验收。B1仅闭合覆盖层布局与空查询显隐稳定性，不宣称编辑状态交接全量闭合。B2侧栏跟随/标题、C主题浮层、D原生同状态实拍仍待做。

### A 批执行结果

- 已替换 Sidebar 下拉为大纲/文件双按钮；导航仅在有历史且配置包含该项时出现；aA 替代外观齿轮。
- 已撤销四列固定分区：采用窗口控件 + 独立剩余宽度轨道，轨道内部按配置有序渲染，弹性空间承载标题。恢复 sidebar/navigation 删除排序、重复 space/flexibleSpace；不宣称标题相对整个窗口居中。
- Overflow 按计算 gap/padding 测量，固定间隔14px生效，弹性间隔先缩；复合动作保留More访问入口。新增可键盘访问的搜索按钮；窄屏不再强行display:none输入框。
- v4及以后schema保留独立openWith，不再被误迁移成openActions。浏览器红绿灯与原生92px预留不再重复。
- 新增 Toolbar.test.tsx 14 项；设置迁移新增1项；全量44文件/380项通过，TypeScript、ESLint、format:check、git diff --check通过；普通debug no-bundle桌面构建通过。
- 8组实际浏览器截图：1440预览/编辑/深色/Inspector/定制器、980预览/Find/真实双标签编辑。全部场景就绪、worker渲染、搜索可见、控件同行、无主要slot重叠与页面横溢出；双标签数量=2、编辑器可见。对应top-v0060-*.png/.json。
- 验收边界：定制器截图仅证明打开，删除/排序/宽度恢复与溢出回调由14项组件测试覆盖（模拟布局）；未做真实窗口拖放定制与缩放往返。普通构建未安装/重启验证包，未新跑WDIO，未取得v0.0.60原生同状态实拍。系统自动明暗切换未测；截图仅显式深色。
- B/C/D仍未完成：侧栏跟随分区、标题锚点、Find移至标签下内容覆盖层、完整主题浮层、原生视觉对照。侧栏内部仍有模式切换入口，与新顶部入口重复，下一批统一评估后收口。历史9.28的固定导航/过滤结构项方案由本节取代。

**第一批验收**：默认1440/980搜索可见；侧栏双按钮同排且点击生效；无历史不显示导航；自定义删除/顺序/固定和弹性间隔生效；小窗隐藏项在More可达且放大恢复；双标签编辑状态真实出现；深色、Inspector、Find场景无遮挡。测试不能替代最新版原生实拍，未覆盖项必须保持待验。所有批次均不提交、推送、发布。
- **编制日期**：2026-09-22
- **历史状态（2026-09-24前）**：v0.10.6 已正式发布；随后继续收口编辑/阅读位置交接、标签切换恢复和 Find Bar 焦点竞争。v0.10.7 候选的验收与发布状态见本文档开头的更新记录。

---

## 1. 目标与实施原则

### 1.1 总体目标

在不重写 Tauri 外壳、不引入 Electron、不牺牲跨平台能力的前提下，使 TextMark 的桌面工作区在以下方面直接对齐 Markdown Preview：

1. 主窗口分栏关系；
2. Toolbar 信息架构与控件密度；
3. 左侧工作区和右侧 Inspector 的层级；
4. 标签页、编辑/阅读切换、搜索和导航的操作闭环；
5. Markdown 文档的版心、字号、行高、间距和组件显示效果；
6. macOS 帮助菜单中的项目、发布和反馈入口；
7. 后续发布流程中的 macOS Apple Silicon / ARM64 DMG。

### 1.2 实施顺序

严格按照以下顺序推进：

```text
P0 桌面 UI 骨架
  → P1 工作区与侧栏
  → P2 高频交互
  → P3 Markdown 显示与主题
  → P4 菜单外部入口
  → P5 ARM64 DMG 发布能力
```

不得在 P0 未通过桌面验收前大规模修改 Markdown 渲染；不得把 P5 发布配置与 P0 UI 改动混在同一批次。

### 1.3 产品边界

保留 TextMark 当前产品定位：

- 阅读优先；
- 单区域编辑/阅读切换；
- Tauri + React + Rust；
- 中文默认体验；
- 跨 macOS、Windows、Linux；
- 本地文件优先；
- 不新增内置 AI 聊天、云同步、账户体系或遥测。

不机械照搬 Markdown Preview 的 Canvas、Graph、Sync、复杂模板系统等扩展功能。

---

## 2. 已确认的对标基线

### 2.1 Markdown Preview v0.0.58

本机已确认：

- Bundle ID：`doc.md-preview`；
- 最低 macOS：`15.0`；
- 原生 `NSWindow`、`NSToolbar`、`NSSplitViewController`、`WKWebView`；
- 主窗口默认逻辑结构约为：
  - 左侧栏：`240px`；
  - 中央内容区：`960px`；
  - 右侧栏：`270px`；
- 左侧默认工作区：固定上游证据为 Outline、Files 两种 Sidebar 模式；Search 为独立 Find 工具，不将其误写成左侧面板。
- 右侧默认工作区：Backlinks、Outgoing links、Tags、All properties、Outline；
- 右侧栏默认折叠；
- Toolbar 使用原生分组和弹性空间；
- 菜单覆盖新建、打开、最近文件、保存、另存为、导出、PDF、打印、查找、替换、显示、缩放和检查更新。

### 2.2 TextMark 当前基线

TextMark 已经具备并应保留的能力：

- Toolbar、左侧栏、中央内容区、Inspector；
- 标签页和多文档；
- 编辑/阅读模式；
- 搜索、替换、全部替换及一次撤销；
- 侧栏/Inspector 调宽和持久化；
- 大纲折叠和编辑态源码行定位；
- 读写模式滚动位置与光标交接；
- 未保存文档三按钮保护；
- 导出、打印、Mermaid、KaTeX、图片和主题；
- `.mdx` 纯 Markdown 打开；
- `==highlight==` 行内高亮；
- stable/beta 自动更新链路。

因此，本计划重点不是重复开发已有能力，而是调整桌面工作区结构、补齐面板组织和统一显示细节。

---

## 3. 详细差异与处理结论

| ID | 对比项 | Markdown Preview | TextMark 当前 | 处理结论 | 优先级 |
|---|---|---|---|---|---|
| U01 | 桌面外壳 | 原生 macOS 工作区 | Tauri 系统窗口 + React 工作区 | 保留 Tauri，调整 React 工作区表达 | P0 |
| U02 | Toolbar | 原生分组、留白克制 | 控件较多，分组边界不够明显 | 重排区域、压缩低频入口、补窄窗溢出 | P0 |
| U03 | 左侧栏 | 固定上游 v0.0.60 为大纲/文件两种模式 | TextMark 提供文件导航与大纲；左侧查找入口属于另一交互 | 对齐大纲/文件切换，不把未见于该上游基线的书签面板作为对标缺口 | P0/P1 |
| U04 | 右侧栏 | 反向链接/出链/标签/属性/大纲 | Inspector 偏属性和辅助信息 | 改为面板型 Inspector | P1 |
| U05 | 默认尺寸 | 左约240、右约270 | 左260、右292 | 采用对标默认值，同时保留用户持久化宽度 | P0 |
| U06 | 文档版心 | 稳定阅读列，留白明确 | 已有版心，但页面感偏强 | 调整最大宽度、内边距和空白比例 | P3 |
| U07 | 标签页 | 原生文档工作区 | 已有标签页 | 只调整视觉、未保存状态和溢出 | P1/P2 |
| U08 | 编辑/阅读 | 单区域切换 | 已有单区域切换 | 保留架构，统一入口和状态反馈 | P2 |
| U09 | 搜索/替换 | 独立查找条 | 已有统一查找/替换能力 | 保留逻辑，调整入口和视觉 | P2 |
| U10 | 大纲 | 层级树和键盘操作 | 已实现折叠和源码定位 | 对齐面板位置、键盘反馈和视觉 | P1/P2 |
| U11 | 主题 | 主题覆盖窗口和阅读布局 | 已有主题、字体、边距和行高 | 补齐 chrome 一致性，不追求主题数量 | P3 |
| F01 | 文件操作 | 新建、打开、最近、保存、导出、打印 | 基本覆盖 | 保留，补菜单一致性 | P2/P4 |
| F02 | 文档关系 | Backlinks、Outgoing links、Tags | 尚未形成完整工作区 | 分阶段补齐 | P1 |
| F03 | 书签 | 固定上游 v0.0.60 Sidebar/ProjectNavigator 中未发现书签面板或模型 | TextMark `src` 中也未发现书签功能 | 非本轮上游对标范围；若产品未来需要，另立需求评估 | 不纳入本轮 |
| F04 | Markdown 渲染 | 阅读排版克制 | 功能覆盖较完整 | UI 骨架稳定后逐项调整 | P3 |
| F05 | 外部入口 | 检查更新、帮助体系 | 已有检查更新 | 增加项目主页、Releases、Issues | P4 |
| F06 | ARM64 DMG | 不属于 UI 对标 | 尚未提供独立 ARM64 DMG | 独立修改发布流水线 | P5 |

### 3.1 已有能力，不重复开发

以下项目已有可靠实现，不作为本轮重新设计对象：

- 未保存文档保护；
- 编辑/阅读滚动位置交接；
- 光标恢复；
- 搜索统一匹配语义；
- 全部替换一次撤销；
- 编辑态导出和打印恢复；
- Mermaid/KaTeX 基础渲染；
- `.mdx` 与 `==highlight==`；
- 主题、行高和边距持久化；
- 自动更新基础链路。

后续只在新 UI 改动触及这些路径时执行回归验证，不重新实现。

---

## 4. 分阶段实施计划

## 阶段 P0：桌面 UI 骨架对齐

### 目标

先让 TextMark 的主窗口结构、默认分栏和 Toolbar 组织方式接近 Markdown Preview。

### 实施内容

1. 调整默认布局参数：
   - Toolbar：保持约 `52px`；
   - 左侧栏：默认约 `240px`；
   - 右侧栏：默认约 `270px`；
   - 中央区域：桌面窗口 `minmax(420px, 1fr)`；窄窗口断点下改为单列 `minmax(0, 1fr)`，避免横向溢出；
2. 保留已保存的用户宽度，不覆盖既有设置；
3. 为左、右面板设置合理最小/最大宽度；
4. 重排 Toolbar 为三个区域：
   - 左侧：侧栏和导航；
   - 中间：当前文档上下文；
   - 右侧：打开、外观、Inspector、分享/导出、编辑/阅读、搜索；
5. 统一按钮高度、间距、图标尺寸、分隔线和弹性空间；
6. 窄窗口时优先隐藏低频控件，不遮挡编辑、搜索和文件操作；
7. 调整标签页容器，使其成为中央工作区的一部分；
8. 不改变 Markdown 渲染语义和已有状态管理协议。

### 主要代码落点

```text
src/App.css
src/App.tsx
src/components/Toolbar.tsx
src/components/DocumentTabs.tsx
src/components/PanelResizer.tsx
```

### 放行条件

- 工作树变更仅限 P0 相关文件；
- TypeScript、Vitest、ESLint、格式检查通过；
- 默认宽屏和窄窗口均无遮挡；
- 编辑/阅读、搜索、标签页和 Inspector 状态不丢失。

### 交付物

- P0 UI 实现；
- 宽屏/窄屏截图；
- Toolbar 操作清单；
- 回归测试结果；
- 需要调整的差异清单。

---

## 阶段 P1：左右工作区和 Inspector 对齐

### 目标

将侧栏从单一内容辅助栏升级为清晰的工作区导航。

### 左侧工作区

建议顺序：

```text
文件 / 大纲（对应固定上游 Sidebar 的两种模式）
搜索（TextMark 当前独立查找入口，不声称与上游侧栏面板一致）
```

### 右侧工作区

建议顺序：

```text
大纲
属性
标签
出链
反向链接
```

### 实施内容

1. 建立统一面板类型和面板切换状态；
2. 面板状态按窗口/工作区持久化；
3. 当前文档切换时刷新面板数据；
4. 处理无文档、无结果、无关系的空状态；
5. 右侧 Inspector 默认折叠；
6. 保留左右栏调宽和键盘调宽；
7. 切换面板不得重置文档滚动位置、编辑器光标和 dirty 状态；
8. 文件树、大纲、搜索均补齐键盘焦点和可访问性反馈；
9. 书签不是固定上游 v0.0.60 已证实的面板，本轮不作为对标实施项；如列入产品规划，需另行确认需求与数据模型。

### 主要代码落点

```text
src/components/Sidebar.tsx
src/components/Inspector.tsx
src/components/Outline.tsx
src/components/FindBar.tsx
src/components/Search*
src/components/ProjectNavigator*
src/App.tsx
src/App.css
src/lib/settings.ts
```

### 放行条件

- 左侧面板职责不再混杂；
- Inspector 可在当前文档上下文中切换；
- 标签页切换后面板数据准确；
- 应用重启后面板状态、宽度和折叠状态恢复；
- 无结果状态不会出现空白或错误信息。

---

## 阶段 P2：高频交互和文档工作流对齐

### 目标

对齐用户最常用的打开、导航、编辑、搜索和文档切换流程。

### 实施内容

1. 统一 Toolbar、菜单和快捷键入口；
2. 优化编辑/阅读按钮的当前状态反馈；
3. 统一文档标题、路径和未保存标记；
4. 优化标签页关闭按钮、dirty 状态和溢出行为；
5. 优化搜索条和替换条的显示时机；
6. 保留现有编辑态查找、替换和一次撤销语义；
7. 补齐窄窗口 Toolbar 的低频功能收纳；
8. 验证历史导航、文件树导航和文档标签关闭的三按钮保护；
9. 验证多窗口菜单不会串窗；
10. 在可用条件下完成 watcher 双窗口运行闭环验证。

### 放行条件

- 所有离开 dirty 文档的入口均有一致保护；
- 取消操作不改变文档、历史和 dirty 状态；
- 菜单只作用于焦点窗口；
- 编辑/阅读切换后位置、光标和查询条件符合预期；
- 窄窗口下所有核心操作仍可达。

---

## 阶段 P3：Markdown 显示与主题细节对齐

### 目标

在桌面 UI 骨架稳定后，逐项统一阅读体验和 Markdown 元素显示。

### 实施内容

按以下顺序实施：

1. 文档最大宽度和水平内边距；
2. 正文默认字号与行高；
3. 标题层级和上下间距；
4. 列表缩进和任务列表；
5. 引用块边框、背景和内边距；
6. 代码块、行内代码和语法高亮；
7. 表格边框、表头、单元格内边距和横向滚动；
8. 图片最大宽度、圆角、行内/独立图片间距；
9. Mermaid 容器、加载态和错误态；
10. KaTeX 字号、溢出和暗色主题；
11. `==highlight==` 在浅色/深色主题下的颜色；
12. MDX 文档显示；
13. 打印和导出样式一致性。

### 固定回归样本

必须使用同一份 Markdown fixture，包含：

```text
标题层级
中文长段落
有序/无序列表
任务列表
引用
行内代码
多行代码
表格
图片
链接
Mermaid
KaTeX
==highlight==
MDX 纯 Markdown 内容
```

### 放行条件

- 屏幕阅读与编辑预览内容一致；
- 搜索高亮不改变导出正文；
- 图片、表格、公式和图表不越界；
- 深色主题下文字和控件对比度足够；
- 打印/HTML/PDF 输出不带 Toolbar、标签页和侧栏；
- 中文、英文和窄窗口均完成视觉复核。

---

## 阶段 P4：菜单和 GitHub 外部入口

### 目标

补齐用户指定的 GitHub Releases 跳转，并统一帮助菜单结构。

### 建议菜单

```text
TextMark 帮助
检查更新…
GitHub 项目主页
GitHub Releases
报告问题
安装命令行工具…
```

### 链接

```text
项目主页： https://github.com/jincaiw/TextMark-v1
版本发布： https://github.com/jincaiw/TextMark-v1/releases
问题反馈： https://github.com/jincaiw/TextMark-v1/issues
```

### 主要代码落点

```text
src-tauri/src/lib.rs
src-tauri/src/error.rs（如需错误映射）
Rust 菜单契约测试
```

### 验收

- 中文和英文菜单均可见；
- 默认浏览器能打开正确 URL；
- 不阻塞应用主窗口；
- 打开失败时显示明确反馈；
- 不影响检查更新和命令行工具安装。

---

## 阶段 P5：macOS ARM64 DMG 发布支持

### 目标

后续发布版本同时提供 Universal 和 Apple Silicon / ARM64 DMG。

### 命名决策建议

用户此前提出的 `rch64.dmg` 按 macOS 约定解释为 `aarch64/arm64.dmg`。

建议：

- 构建 target：`aarch64-apple-darwin`；
- 面向用户的资产名：`TextMark_<version>_arm64.dmg`；
- 保留：`TextMark_<version>_universal.dmg`；
- updater 仍使用 `.app.tar.gz`，DMG 仅用于手动下载安装；
- `latest.json` 不直接引用 DMG。

### 主要代码落点

```text
.github/workflows/release.yml
scripts/create-latest-json.mjs
scripts/verify-release-assets.mjs
src/platform-packaging.test.ts
RELEASE_NOTES.md
```

### 验收

- `aarch64-apple-darwin` 构建成功；
- ARM64 DMG 可安装启动；
- Universal DMG 继续可用；
- Release 同时包含两类 DMG；
- updater 仍引用签名 `.app.tar.gz`；
- 资产命名、签名、平台键和 manifest 检查全部通过；
- 发布说明明确下载建议。

---

## 5. 自动化实施与持续监控机制

用户要求实施过程中优先自动化、自主推进和持续监控。实施时采用以下闭环：

```text
读取现状
  → 建立单批次目标
  → 修改最小范围
  → 自动门禁
  → 构建验证
  → 启动应用
  → 自动化交互/截图
  → 结果比对
  → 修复或放行
  → 记录实施结果
  → 进入下一批次
```

### 5.1 每批次开始前

自动执行：

```bash
git status --short --branch
git diff --stat
```

确认：

- 当前分支和基线；
- 是否存在上一批次未解决的改动；
- 是否有用户未授权的发布、推送或分支操作；
- 当前批次涉及文件是否与计划一致。

### 5.2 每次代码修改后

至少执行：

```bash
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vitest run
./node_modules/.bin/eslint .
npm run format:check
```

涉及 Rust 或 Tauri 时追加：

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --all-targets
```

### 5.3 每个 UI 批次完成后

自动或半自动完成：

1. 启动 Vite/Tauri 验证实例；
2. 设置固定逻辑窗口尺寸；
3. 读取计算样式和可访问性属性；
4. 驱动 Toolbar、侧栏、Inspector、标签页、搜索和编辑/阅读切换；
5. 保存截图和关键 DOM/状态快照；
6. 对比上一版结果；
7. 发现问题时暂停进入下一批次，先修复当前批次。

截图规则：

- 使用相同逻辑窗口尺寸；
- Retina 截图先换算 1×；
- 不凭缩略图判断 1px 差异；
- 同时保留截图、计算样式和源码依据；
- 只把可复现结果写为“通过”。

### 5.4 每批次放行规则

只有满足以下条件才进入下一阶段：

- 自动门禁全部通过；
- 当前阶段的核心交互实测通过；
- 未出现新的数据丢失、状态丢失或窗口串扰；
- 截图和计算样式与目标一致或差异已有明确解释；
- 工作树改动与当前阶段范围一致；
- 结果已写入实施账本和项目记忆。

遇到以下情况必须暂停并重新评估：

- 构建产物与源码 hash 不一致；
- 编辑/阅读状态交接回退；
- 多窗口事件串扰；
- 搜索高亮影响导出正文；
- 窄窗口出现核心控件不可达；
- 需要修改依赖、平台配置、发布版本或远程仓库；
- 发现参照应用的实际行为与既有结论不一致。

---

## 6. 验收矩阵

### 6.1 窗口与布局

| 场景 | 验收内容 |
|---|---|
| 宽屏 | Toolbar、左栏、正文、右栏层级清晰，无异常空白 |
| 中等窗口 | 右栏可折叠，正文保持可读宽度 |
| 窄窗口 | 低频 Toolbar 项目收纳，核心操作仍可达 |
| 重启 | 面板宽度、显示状态、当前工作区按设置恢复 |
| 深色主题 | chrome、侧栏、Inspector、正文和搜索条颜色一致 |
| 中英文 | 文案变长时不溢出、不遮挡 |

### 6.2 工作区与交互

- 文件/大纲模式职责清晰，搜索保持独立入口；
- Inspector 面板切换不影响文档滚动和光标；
- 标签页键盘导航有效；
- dirty 文档离开时保存、放弃、取消语义一致；
- 菜单只作用于焦点窗口；
- 编辑/阅读往返位置和光标符合既定规则；
- 搜索、替换、全部替换计数和结果一致。

### 6.3 显示与导出

- 标题、段落、列表、引用、代码块、表格和图片排版稳定；
- Mermaid 和 KaTeX 正常显示；
- 高亮语法不污染代码和导出正文；
- HTML、PNG、PDF、打印均隐藏应用 chrome；
- 编辑态导出使用当前缓冲区内容；
- 搜索高亮开关不改变正文文字。

### 6.4 发布

- ARM64 DMG 构建、安装和启动；
- Universal DMG 保持可用；
- updater manifest 使用签名 archive；
- 发布资产命名、签名和平台键全部通过检查。

---

## 7. 变更拆分与提交建议

建议每个阶段独立提交：

```text
1. refactor(ui): align desktop workspace geometry
2. refactor(toolbar): align macOS toolbar hierarchy
3. feat(workspace): add sidebar workspaces and inspector panels
4. polish(interaction): align document workflow and narrow-window behavior
5. polish(markdown): align document typography and rendering details
6. feat(menu): add project and releases links
7. build(macOS): publish Apple Silicon ARM64 DMG
```

在用户确认前：

- 不提交；
- 不推送；
- 不合并；
- 不创建 PR；
- 不修改发布版本号；
- 不修改远程仓库设置。

---

## 8. 风险与控制措施

| 风险 | 控制措施 |
|---|---|
| UI 重构影响已有滚动/光标交接 | P0 只改布局和样式，保留状态协议；每批次执行往返回归 |
| 面板增多导致中央正文过窄 | 右栏默认折叠；设置最小正文宽度；窄窗转浮层/折叠 |
| 搜索或高亮污染导出 | 固定正文一致性测试；导出前后比较文本内容 |
| 多窗口事件串扰 | 按窗口 label 定向；双窗口菜单和 watcher 单独验收 |
| 原生 macOS 行为无法完全由 CSS 模拟 | 保留 Tauri 原生窗口；只对齐可控的 Web UI 层 |
| Retina 截图误判尺寸 | 统一逻辑尺寸，结合计算样式，不凭目测改 1px |
| ARM64 DMG 影响 updater | DMG 与 `.app.tar.gz` 分离；manifest 只引用 updater archive |
| 参照版本更新造成结论漂移 | 固定使用本机 v0.0.58 和已记录的资源证据，新增证据单独记录 |

---

## 9. 本次实施决策请求

开始修改代码前，请确认以下范围：

1. 是否批准先实施 **P0 桌面 UI 骨架对齐**；
2. 是否批准 P0 通过后继续实施 **P1 工作区和 Inspector 对齐**；
3. 是否采用左侧默认约 `240px`、右侧默认约 `270px`，同时保留用户已保存宽度；
4. 左侧按已核实上游采用文件/大纲模式；搜索和右侧 Inspector 面板作为 TextMark 自身工作区结构分别评估；
5. 是否将 `rch64.dmg` 统一解释为 `arm64.dmg`，构建 target 使用 `aarch64-apple-darwin`；
6. 是否在 P4 增加项目主页、GitHub Releases 和 Issues 三个菜单入口。

**历史状态（2026-09-19）：v0.10.2 已正式发布。** 本文后续章节继续记录各批次的历史实施证据；当前 v0.10.7 发布状态以文首收口记录和 GitHub Release 状态为准。

### 9.1 当前实施账本（2026-09-19）

| 阶段/批次 | 状态 | 已取得证据 | 当前缺口 |
|---|---|---|---|
| P0–P5 | 已完成 | UI/菜单/发布能力代码已落地，shell E2E 已覆盖主要桌面交互 | v0.10.2 已正式发布；剩余为跨平台实机与像素级证据补强 |
| B11 | 部分完成 | 语法装饰纯函数与回归测试通过；真实 Markdown 语法夹具已稳定通过，覆盖表格、任务列表、数学、提示框、Mermaid、危险 HTML 过滤、图片、换行和长代码块；图片使用 alt/source 契约、表格使用 renderer-owned class 契约 | IME、运行时截图、大文档性能 |
| B12 | 部分完成 | 外部写冲突、文件拖放入口、外部应用交接契约已覆盖；shell E2E 22 项通过 | Finder/桌面真实拖放、真实外部应用启动、多窗口拖放 |
| B13 | 部分完成 | macOS PDF 能力探针与导出边界已明确 | Windows/Linux 实机可选文字证据 |
| B14 | 代码与单测完成，实机证据收口中 | session-v1 原子快照、窗口几何、secondary 恢复、pending queue、草稿/选区恢复；Vitest 43 文件/360 项，Rust 20 项，shell E2E 22 项；多文档标签 E2E 已通过；secondary 创建、快照写入和关闭清理 E2E 已通过 | 跨进程重启后的多文档 UI 恢复、多显示器几何 |

### 9.2 下一批次：B14-M1 异常退出恢复验收

在不改变产品语义和发布配置的前提下，优先新增独立的 macOS Tauri E2E 验证批次：

1. 使用隔离的 `TEXTMARK_E2E_CONFIG_DIR` 和临时 Markdown fixture；
2. 打开至少两个文档，写入 dirty 草稿并等待 `session-v1.json` 稳定落盘；
3. 通过现有进程控制能力结束旧实例，确认旧 PID 已归零；
4. 无显式启动路径重新启动，验证文档列表、活动标签、workspace、窗口几何和草稿恢复入口；
5. 正常关闭后确认当前窗口快照被清理，避免把“正常关闭”和“异常退出保留”混为同一语义；
6. 若当前 WebDriver/Tauri 服务无法安全重启同一进程，则保留代码契约与人工可复现实验记录，不绕过 macOS TCC 或签名控制。

**当前结果（2026-09-19）**：已新增 `scripts/verify-session-recovery.mjs`，使用隔离配置目录启动真实 Tauri debug 进程；单文档会话快照落盘、`SIGKILL` 后重启仍保留 `session-v1.json` 的探针已通过。期间发现并修复普通 debug 构建未启用 `e2e` feature 时无法读取 `TEXTMARK_E2E_CONFIG_DIR` 的缺口，并处理 macOS `/var` 与 `/private/var` 路径别名。异常退出快照持久化已通过；新增独立 `e2e/session-cleanup.spec.mjs`，通过真实 WebDriver 点击窗口关闭按钮，确认 `close-request` 流程完成 `saveSession(true)`，且 `session-v1.json` 被移除。新增 `e2e/session-recovery.spec.mjs`，通过真实 Tauri pending queue 注入第二个文档，已验证两个文档标签、活动标签和 `session-v1.json` 文档顺序/`activeIndex=1`；该 E2E 已通过。此前的 SIGTERM 进程探针仍保留为边界证据，未将进程终止误报为 UI 关闭清理。跨进程重启后的多文档 UI 恢复、草稿对话框、secondary 窗口和窗口几何仍需完整验收；进程级探针继续只承诺单文档异常退出快照保留。尝试新增 secondary 窗口真实 E2E 时，窗口创建和文档显示成功，但隔离 `session-v1.json` 未出现 secondary 快照，等待超时；定位到几何查询在新窗口原生 surface 尚未完成挂载时可能拒绝，已增加 `currentWindowGeometry()` 容错并将保存使用的活动标签改为 ref 读取，前端门禁通过；secondary 真实 E2E 尚未重新通过，仍不宣称生命周期已闭合。

**放行条件**：异常退出场景取得可重复证据；若环境限制导致无法完成，必须明确记录阻塞点，不将单元测试替代为跨进程实机通过。

### 9.3 B14-M2 secondary 窗口生命周期验收结果（2026-09-19）

本轮通过真实 Tauri WebDriver 场景验证：

1. 通过原生命令创建 secondary 窗口，并确认文档内容在新窗口显示；
2. 确认 secondary 窗口快照写入隔离配置目录的 `session-v1.json`；
3. 确认点击 secondary Toolbar 关闭按钮后，对应快照从 manifest 清理；
4. 修复关闭入口：Toolbar 不再绕过 React 关闭保护，统一转入 `requestClose`；
5. 增加基于当前 native window label 的显式清理命令，并保留 `Destroyed` 事件兜底清理，避免 debounce 保存竞态重新写回快照。

验证结果：

```text
Spec Files: 1 passed, 1 total
TextMark secondary session lifecycle: passed
```

当前仍未闭合：跨进程重启后的多文档 UI 恢复、多显示器几何恢复。

补充复验（2026-09-20）：

- 将 secondary E2E 的文档断言和 manifest 匹配从固定的 `recovery-b.md` 改为读取实际传入 fixture 的文件名与一级标题，避免测试夹具之间发生隐式耦合。使用 `/tmp/secondary-a.md` 独立夹具重新执行，结果为 `build:e2e：通过`、`secondary-session.spec.mjs：1 passed`。
- 修复 shell E2E 对设置文件路径的假设：测试此前固定读取默认临时目录，和 `TEXTMARK_E2E_CONFIG_DIR` 隔离配置不一致，导致设置持久化场景超时；现在测试与运行时共用隔离配置目录。修复后 shell 回归结果为 `22 tests passed`。

### 9.4 B11-B13 当前环境验证结果（2026-09-19）

- **B11**：使用临时 Markdown 语法夹具完成真实 macOS Tauri E2E 运行验收；frontmatter、Setext/ATX 标题、表格、任务列表、脚注、数学、提示框、3 个 Mermaid 图、危险 HTML 过滤、软/硬换行和长代码块均可到达。已将不稳定的图片 `naturalWidth` 断言改为 alt/source 契约、表格 computed style 断言改为 renderer-owned `md-table-align-*` class 契约；E2E `1 spec passed`，定向单测 44/44 继续通过。
- **B12**：既有 shell E2E 22 项和 LLM/外部应用交接纯函数测试继续通过；当前环境未宣称 Finder 真实拖放、真实外部应用启动和多窗口拖放已闭合。
- **B13**：`pdfCapability` 3 项定向测试通过，明确 macOS Tauri + print API 使用 `native-vector`，浏览器使用 `browser-vector`，其他 Tauri 平台保留 `raster-fallback`；Windows/Linux 实机可选文本 PDF 仍未取得证据。

本轮 B11-B13 不修改产品实现，仅补充真实运行验收与测试夹具契约；临时夹具位于 `/tmp`，未进入仓库。

### 9.5 桌面 UI 宽度基线对齐（2026-09-20）

根据 `pluk-inc/markdown-preview` 当前 main 源码重新核对布局基线：

- 参照窗口 setup 后约 `1100×720`；左侧栏 `230–400px`，中心区最小 `420px`，右侧 Inspector `270–500px`，默认 Inspector 折叠；
- 参照阅读页面宽 `900px`，文章列宽 `820px`，左右内边距各 `40px`，正文字号 `15px`、行高约 `1.5`；
- TextMark 原有左右栏默认值和 min/max 已匹配，但中心列此前是 `minmax(0, 1fr)`，阅读/编辑外框也误用 `820px`；
- 本轮将中心列统一为 `minmax(420px, 1fr)`，新增 `900px` 页面宽度 token，保留 `820px` 正文内容列和 `40px` 内边距；编辑态、阅读态和 preview host 统一使用该页面宽度；
- `styleContract` 增加 `900px` 页面宽度契约；TypeScript、定向 Vitest 和格式检查通过。

继续复核 Toolbar 与窄窗口规则：参照默认 toolbar 顺序已保留为 flexible space、sidebar、navigation、flexible space、open actions、space、zoom、document actions、search；同时修正 `max-width:700px` 时中心区不应继续强制 420px，改为所有面板组合单列 `minmax(0,1fr)`，避免小屏横向溢出。

### 9.6 Toolbar 控件密度对齐（2026-09-20）

参照源码中普通 Toolbar 按钮约 `26px` 高、组内间距约 `2px`、组间间距约 `8px`。本轮将 TextMark 普通按钮、导航按钮、侧栏按钮、Toolbar 分组、搜索框统一收敛到 `26px` 高；普通图标按钮宽度从 `36px` 收敛到 `26px`，文档操作组保留边框分组，搜索框仍保留 `160–240px` 的弹性宽度。该调整仅影响 Chrome 密度，不改变操作顺序和状态协议。

定向验证：TypeScript、`styleContract` 6 项、组件测试 15 项通过；本轮完整门禁已复跑并通过：Vitest 43 文件/360 项、ESLint、format:check、git diff --check。

### 9.7 标签页与面板标题区节奏对齐（2026-09-20）

- 文档标签栏顶部 padding 从 `5px` 收敛到 `4px`，关闭按钮由 `25px` 收敛到 `24px`，保留标签主体 `30px`；
- Sidebar 标题区从 `40px` 收敛到 `38px`，标题内边距同步收紧；Outline 行高继续保持参照值 `30px`；
- Inspector 顶部区域从 `52px` 收敛到 `48px`，内容起始 padding 从 `14px` 收敛到 `12px`；
- 这些调整只改变桌面 Chrome 的垂直节奏，不修改标签关闭、键盘导航、面板切换和会话状态逻辑。

定向验证：TypeScript、组件测试 15 项、styleContract 6 项通过；本轮完整门禁已复跑并通过：Vitest 43 文件/360 项、ESLint、format:check、git diff --check。

### 9.8 桌面布局几何契约验收（2026-09-20）

新增 `e2e/layout-geometry.spec.mjs`，通过真实 Tauri WebDriver 读取计算布局值，覆盖：

- Toolbar 高度 `52px`；
- Sidebar 默认宽度 `240px`；
- Outline 行高 `30px`；
- 阅读页宽度不超过 `900px`，页面 padding 为 `32/40/48px`；
- Inspector token 为 `270px`；
- `--document-page-width` 在运行时为 `900px`；
- 单文档时标签栏不渲染，编辑态默认不挂载编辑页。

验证结果：

```text
build:e2e：通过
layout-geometry.spec.mjs：2 passed
Prettier：通过
ESLint：通过
 git diff --check：通过
```

该契约验证的是 WebView 实际计算布局，不等价于 macOS 原生 titlebar/红绿灯像素截图；原生窗口部分仍需同屏实拍校准。

#### 9.9 原生窗口同屏证据（2026-09-17）

本轮在同一台 macOS、同一 Retina 显示器上，以窗口级截图分别采集了 TextMark 与 Markdown Preview：

- 两张整屏截图均为 `3840×2160`；通过 macOS 红绿灯约 `24px` 的截图像素尺寸，按固定 `12pt` 逻辑尺寸标定为 `2× Retina`。
- CoreGraphics 窗口枚举得到 TextMark 窗口边界约 `1440×901` 逻辑像素，Markdown Preview 当前窗口约 `960×969` 逻辑像素；两者当前不是同尺寸状态，不能直接进行像素级差异结论。
- 窗口级截图裁剪结果分别为 `2880×1802` 与 `1920×1938`，与上述逻辑边界的 `2×` 关系一致，证明截图采集链路有效。
- TextMark 当前原生窗口的 WebView 内容从顶部即开始绘制自有 toolbar，并通过 `92px` 左内缩为 macOS 交通灯预留位置；Tauri 原生装饰本身不显示 WebView 绘制的交通灯。
- Markdown Preview 的系统 toolbar、左侧栏和文档内容均由原生窗口统一承载；当前截图显示其左栏约 `268px`（截图像素，约 `134` 逻辑像素）且窗口宽度约 `960` 逻辑像素，不能将该已保存窗口状态直接与方案中的 `230–400px` 目标范围混为一谈。

结论：本轮已完成原生窗口截图链路和 Retina 标定，但由于两个应用窗口尺寸、文档、保存布局状态不同，尚不足以支持“完全一致”或 titlebar 像素级修正。当前不改 titlebar CSS；后续先建立同尺寸窗口、同一文档和同一面板状态的采集夹具，再测量边界。

#### 9.9.1 启动参数复验结果（2026-09-21）

- `/Applications/TextMark.app` 实际仍为旧 `0.9.7` 二进制，不能作为当前工作树 `0.10.0` 的运行证据；当前工作树已单独构建调试二进制，且前端门禁通过。
- 使用当前构建包和 `/tmp/textmark-parity/parity-fixture.md` 重测后，TextMark 原生窗口仍显示默认 `README.md`，而 Markdown Preview 显示 `parity-fixture.md`；因此“同一文档”条件仍未满足。
- 源码链路已确认：`useDocument` 的 `readStartupRequest()` 仅解析进程参数；macOS 通过 Finder/`open` 传入文件时需要处理 Tauri 2 `RunEvent::Opened`。本轮仅完成 API 与构建链路核对，未将未经运行时验证的事件接入作为完成结论。
- 当前仍不修改 `trafficLightPosition`、`titleBarStyle`、原生 Toolbar 或 CSS 几何；待启动事件闭环后，重新统一窗口尺寸和面板状态，再采集像素证据。
- 后续复验中，当前构建包的 `RunEvent::Opened` 处理已通过 Rust 构建与 Clippy，但使用 `open -n` 时窗口仍为空白，尚未形成文件事件成功驱动前端载入的运行时证据；需继续检查事件时机、监听注册、事件目标和启动包资源完整性。

### 9.10 发布前完整门禁收口（2026-09-17）

本轮先修复 Rust Clippy 唯一阻塞：将 secondary 窗口 `CloseRequested` 事件中的嵌套 `if` 合并为带条件的 `if let`，不改变关闭清理语义。

门禁结果：

```text
cargo fmt -- --check                         通过
cargo clippy --all-targets --all-features    通过（-D warnings）
cargo test --all-targets                      20 passed / 0 failed
TypeScript                                  通过
Vitest                                      43 个文件 / 360 项通过
ESLint                                      通过
format:check                                通过
npm run build                               通过
npm run check:bundle                         通过
git diff --check                             通过
npm audit --omit=dev --audit-level=high      0 vulnerabilities
npm run build:e2e                            通过
```

结论（当批记录，2026-09 当时状态）：该批代码级发布前门禁已全部通过；当时工作树仍保持未提交、未推送、未合并、未发布。后续交付以文档开头 v0.10.7 收口为准；真实 GitHub Actions 发布、stable/beta updater 线上验证、跨平台 PDF 实机证据、多显示器几何恢复和同尺寸原生窗口像素对齐仍不应由本地门禁结果替代。

### 9.11 B14 与桌面几何证据复验（2026-09-17）

在发布前门禁通过后，继续使用隔离临时 fixture 复验，不修改产品语义：

```text
session-recovery.spec.mjs：1 passed
secondary-session.spec.mjs：1 passed
layout-geometry.spec.mjs：2 passed
verify-session-recovery.mjs：B14 abnormal-exit persistence passed
```

复验覆盖：

- 多文档标签顺序、活动标签和 `session-v1.json` 的 `activeIndex=1`；
- secondary 窗口创建、快照写入和关闭清理；
- Toolbar、Sidebar、Outline、阅读页宽度/内边距和 Inspector token 的真实 WebView 几何；
- 进程级 `SIGKILL` 后 session manifest 保留，并可被下一次启动读取。

这些证据仍不等价于跨显示器/不同缩放比例的窗口几何恢复，也不等价于原生 titlebar、红绿灯和系统 Toolbar 的同尺寸像素级对齐；相关事项继续保留为未闭合证据，不以当前 E2E 结果宣称“完全一致”。

### 9.12 updater 线上与运行时复验（2026-09-20）

针对此前“检查更新失败”问题，本轮按四段链路逐项复核：

1. Rust updater 插件已注册，`updater:default` capability 已启用；
2. `tauri.conf.json` 中 updater 公钥与线上 `v0.10.0/latest.json` 的签名 key 标识一致：`2469FE8B4EC994E8`；
3. 稳定 release `v0.10.0` 已公开 `latest.json`，版本为 `0.10.0`，包含 macOS、Windows、Linux 的完整 updater platform 条目；
4. Universal macOS updater archive、`.sig`、ARM64 DMG 和 Universal DMG 均存在；beta 通道 `textmark-beta/latest.json` 也已存在。

线上 manifest 关键结果：

```text
stable latest.json：存在
version：0.10.0
platform entries：18
macOS universal updater archive：存在
macOS ARM64 DMG：存在
macOS Universal DMG：存在
beta latest.json：存在
```

新增 `e2e/updater-runtime.spec.mjs` 和 `TEXTMARK_UPDATER_RUNTIME=1` 路由，通过真实 Tauri/Rust 命令调用稳定通道检查：

```text
UPDATER_RESULT=null
updater-runtime.spec.mjs：1 passed
```

当前安装的 `/Applications/TextMark.app` 版本为 `0.10.0`，因此 `null` 表示线上稳定版本已是当前版本，不是失败。更新器发布契约测试 15 项通过，新增探针已通过 Prettier 和 ESLint。

### 9.13 Quick Look 版本一致性修复（2026-09-20）

继续复核本机 Quick Look 链路时发现，`platform/macos/quicklook/Info.plist` 仍固定写入历史版本 `0.3.0`，而 `test-package.sh` 也按 `0.3.0` 校验。这不会阻塞当前 XCTest，但会使正式 `0.10.0` DMG 的 Quick Look 扩展版本元数据与主应用不一致。

已修复：

- `build-quicklook.sh` 从根目录 `package.json` 读取当前版本，并将 `MARKETING_VERSION`、`CURRENT_PROJECT_VERSION` 传给 Xcode 构建与测试；
- Quick Look `Info.plist` 改为使用 `$(MARKETING_VERSION)` 和 `$(CURRENT_PROJECT_VERSION)`；
- `test-package.sh` 版本断言同步为 `0.10.0`；
- 保留 ad-hoc 签名策略，不改变正式发布签名流程。

复验结果：

```text
BUILD SUCCEEDED
XCTest：7 tests passed / 0 failures
CFBundleShortVersionString：0.10.0
CFBundleVersion：0.10.0
架构：x86_64 arm64
发布契约测试：15 passed
```

### 9.14 最新收口门禁复验（2026-09-20）

继续复核 Quick Look 版本注入、更新器运行时探针和 DMG 版本断言后，发现 `test-package.sh` 仍将扩展版本硬编码为 `0.10.0`。已将其改为读取挂载应用的 `CFBundleShortVersionString`，再与 Quick Look 扩展版本比较，避免下一个版本重复修改 smoke 脚本。

### 9.15 stable/beta 发布资产最终复核（2026-09-20）

在不修改线上 Release 的前提下，通过 GitHub Release 元数据复核已发布资产：

```text
v0.10.0：draft=false，prerelease=false，36 个资产
textmark-beta：draft=false，prerelease=true，latest.json 存在
stable latest.json：存在，版本 0.10.0
ARM64 DMG：TextMark_0.10.0_arm64.dmg，存在
Universal DMG：TextMark_0.10.0_universal.dmg，存在
Universal updater archive：TextMark_0.10.0_universal.app.tar.gz，存在
updater signature：TextMark_0.10.0_universal.app.tar.gz.sig，存在
Quick Look：CFBundleShortVersionString=0.10.0，CFBundleVersion=0.10.0
```

该复核确认发布资产命名、stable/beta manifest 和本机 Quick Look 版本引用一致；不等价于重新执行完整 GitHub Actions 发布流程，也不覆盖跨平台 PDF、跨显示器几何、Finder 拖放或原生 titlebar 像素级证据。

最新门禁：

```text
Quick Look BUILD：成功
Quick Look XCTest：7 passed / 0 failed
TypeScript：通过
Vitest：43 个文件 / 360 项通过
ESLint：通过
format:check：通过
Rust fmt：通过
Rust Clippy -D warnings：通过
Rust tests：20 passed / 0 failed
生产构建：通过
bundle budget：通过
git diff --check：通过
npm audit：0 vulnerabilities
发布契约测试：15 passed
```

当前工作树仍未提交、未推送、未合并、未发布。代码级门禁已收口；本轮继续复验了 PDF capability/export 定向测试 10 项、异常退出会话清单保留探针和多文档标签恢复 E2E（1 passed）。这些结果分别证明 PDF 能力分支、异常退出 manifest 保留和同进程多文档标签恢复，不等价于跨进程重启后 UI 多文档恢复闭环。2026-09-21 曾通过两阶段真实重启验收确认主窗口恢复失败：第一阶段双文档 manifest 写入成功，第二阶段无启动参数重启后进入默认 README。根因是主窗口关闭流程调用 `saveSession(true)` 并删除 `main` 快照；已改为主窗口关闭时保存 `saveSession(false)`，保留可恢复的 main 快照，非主窗口继续由生命周期清理。修复后两次真实 `session-recovery.spec.mjs` 均通过，第二次无启动参数恢复双文档和活动标签；`sessionRestore.test.ts` 5 项、TypeScript、ESLint、format:check、git diff --check 通过。原有正常关闭测试的语义已同步为主窗口保留恢复快照，最终正常关闭 E2E 通过且 manifest 状态为 `preserved`。本轮定向恢复/PDF 测试共 15 项通过，TypeScript、ESLint、format:check、git diff --check 通过。2026-09-21 继续复跑完整门禁：Vitest 43 文件/360 项、Rust cargo test 20 项、bundle budget（main+worker 304 KiB gzip、native preview 71 KiB gzip）、生产 no-bundle 构建及运行时依赖审计均通过；`npm audit --omit=dev` 为 0 high/critical。稳定版 `v0.10.0` 与 beta 渠道线上资产已复核，包含 Universal DMG、ARM64 DMG、Universal updater 包及 stable/beta `latest.json`。通过 LaunchServices 运行中打开 `parity-fixture.md` 已验证 `RunEvent::Opened → single-instance → open-paths → drain → processOpenPaths` 的实际文档切换，窗口标题变为 `parity-fixture.md`。冷启动传参仍因 macOS LaunchServices 参数转发差异显示默认 README，已记录为启动参数验证边界；不据此修改产品布局。v0.10.1 已完成正式发布收口：GitHub Actions run `35582167499` 全部成功；`v0.10.1` 为 `draft=false`、`prerelease=false`，于 2026-09-21 09:39:55Z 发布，标签指向 `16919d8`；`main` 与 `origin/main` 同步。stable 与 beta `latest.json` 均可在线获取，版本均为 `0.10.1`，包含 18 个平台键、签名和下载 URL；Release 已包含 Universal/ARM64 DMG、Universal updater archive 及签名、Windows ARM64/x64 安装包与 portable、Linux/Fedora 多架构资产、SHA256、SBOM、INSTALL、RELEASE_NOTES 和 THIRD_PARTY_NOTICES。当前工作树仅有本地 `.workbuddy/memory/2026-09-21.md` 改动。剩余事项不再阻塞本次发布，属于后续证据补强：跨平台 PDF、多显示器几何、Finder 拖放和原生 titlebar 像素级对标。

## 9.16 第一批顶部区域对齐实施（2026-09-21）

### 目标与证据边界

本批次针对最新版 `pluk-inc/markdown-preview`（main，Release 0.0.59，提交 `c0681c0670fd457ecb6c65d69aa32daf0e5f8d5`）和本机顶部截图，先对齐可由 React/Tauri 控制的 Chrome，不宣称替代 AppKit 原生 `NSToolbar`、`NSWindow` tab group 或 macOS titlebar 的像素级行为。上游没有独立 path bar，因此本批次不新增 path bar；React tabs 暂保留，避免为视觉对齐引入跨平台窗口模型重写。

### 已实施的 UI 调整

| 项 | 处理 | 验收口径 |
|---|---|---|
| Toolbar 背景与边界 | chrome 背景和底边使用低对比度 `color-mix`，减少 Web 横条感 | 与 tabs、formatting row 共享轻量边界 |
| 文档标题 | 标题区域改为 toolbar 中央绝对定位、居中、最大宽度 `min(34vw, 360px)`，避免随两侧动作数量漂移 | 文件名稳定显示并以省略号截断 |
| 搜索入口 | 默认收敛为 26px 图标按钮，聚焦或已有查询时展开为 140–220px 输入框 | 不占用固定宽度，窄窗核心入口仍可达 |
| 工具栏图标 | 普通 toolbar 图标收敛至 16px；组间 gap 收敛至 4px | 普通按钮维持 26px 控件基线 |
| Formatting Toolbar | heading 控件显式命名并固定 76px；图标 15px；内容区高度由 44px 收敛至 40px | 顺序保持 Heading、粗体、斜体、删除线、列表、引用、代码、链接 |
| Document Tabs | tab 容器加入拖拽区域标记；背景/边界与 toolbar 低对比融合；顶部 padding 收敛至 3px | 保留关闭、dirty、键盘导航与多文档条件渲染 |

### 功能保持与未改动项

- 默认 toolbar 顺序保持上游信息架构：sidebar、navigation、open actions、zoom、document actions、search；低频文件、保存、打印、导出、设置继续进入 More。
- Open、Inspector、Share、Edit、Search、Zoom、Back/Forward、Sidebar 和 More 的既有回调与可访问名称未改动。
- 不改变会话、滚动位置、编辑/阅读交接、窗口恢复和更新器实现。

### 下一步验证计划

1. 运行 TypeScript、Vitest、ESLint、format:check；
2. 构建当前 macOS 验证包，读取 Toolbar、tabs、formatting row 的真实计算尺寸；
3. 在固定逻辑窗口尺寸下采集宽屏、窄窗和编辑态截图；
4. 逐项检查文档标题位置、按钮顺序、搜索展开、More 溢出、侧栏/Inspector 和拖拽区域；
5. 只有通过代码门禁和运行时证据后，才进入提交、推送和新版本发布决策。

### 9.20 v0.10.4 Finder/桌面拖放语义收口（2026-09-22）

继续检查剩余任务后，补齐拖放事件的可解释行为：

- 新增 `partitionDroppedPaths`，过滤空路径并对重复路径去重；
- 多路径拖放时打开第一个唯一可用路径，并通过中英文 notice 明确提示其余路径被忽略；
- 空拖放或全部为空路径时给出明确的中英文提示，不再静默无响应；
- 保留现有文件/目录解析、当前窗口打开策略和权限错误处理链路；
- 新增路径分区策略回归测试。

定向验证：

```text
TypeScript：通过
Vitest documentPresentation/platform：16 passed
ESLint：通过
Prettier：通过
```

该改动闭合的是拖放输入策略和用户反馈；Finder 真实手势、权限弹窗、桌面焦点和 WindowServer 行为仍需 macOS 实机验收。

### 9.19 v0.10.3 多显示器会话几何恢复实施（2026-09-21）

针对剩余任务审查中确认的真实代码缺口，本轮实现多显示器窗口几何恢复：

- `SessionWindowGeometry` 新增可选显示器快照，记录显示器名称、物理位置、工作区、尺寸和缩放比例；
- 当前窗口保存时通过 Tauri `currentMonitor()` 读取显示器信息；
- 恢复时优先匹配保存的显示器，显示器不可用则回退到主显示器，再回退到当前显示器；
- 恢复前将窗口尺寸限制在 `640×480` 至目标工作区范围内，并将窗口坐标裁剪到可见工作区；
- 保留旧版本仅含 `x/y/width/height` 的会话快照读取能力；
- 新增负坐标、大窗口裁剪和 Rust 旧几何快照兼容测试。

定向验证：

```text
TypeScript：通过
Vitest platform/sessionRestore：18 passed
Rust cargo test：21 passed
ESLint：通过
Prettier：通过
git diff --check：通过
```

该实现闭合的是窗口几何数据模型和安全回退逻辑；真实双显示器拔插、不同 Retina 缩放和 WindowServer 级截图仍需 macOS 实机验证，不将单元测试等同于实机证据。

### 9.18 v0.10.2 顶部 UI 对齐版本发布收口（2026-09-21）

顶部区域第一批对齐改动已完成版本发布：

```text
版本：v0.10.2
提交：0f8f160 chore(release): prepare v0.10.2
发布工作流：35612476507
发布结果：success
```

本轮同步更新：

- `package.json`、`package-lock.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`、`src-tauri/tauri.conf.json` 版本为 `0.10.2`；
- `RELEASE_NOTES.md` 增加顶部 Toolbar、布局、搜索、Sidebar、Formatting Toolbar、标签页和跨平台 E2E 兼容说明；
- 推送 `main` 并创建、推送 `v0.10.2` 标签；
- Release 首轮 Linux ARM64 AppImage 的 `linuxdeploy` 构建出现偶发失败，重试失败作业后全量通过，未修改产品代码；
- 正式 Release 已为 `draft=false`、`prerelease=false`，stable/beta `latest.json` 均为 `0.10.2`，包含 18 个平台键；
- 已核验 macOS ARM64 DMG、Universal DMG、Universal updater archive、Windows ARM64/x64、Linux/Fedora 多架构资产及签名文件、SHA256、SBOM 和发布文档。

结论：顶部 UI 第一批实现已完成代码、测试、CI、发布和 updater 资产闭环；原生 NSToolbar、NSWindow tab group、Finder 拖放、跨显示器几何和 titlebar 像素级对齐仍属于后续证据补强，不以本版本发布结果宣称完全一致。

### 9.17 顶部区域截图复核与结构收口（2026-09-21）

本轮使用固定浏览器逻辑窗口采集并复核：

```text
宽屏预览：1440×900
宽屏编辑：1440×900
窄窗口预览：980×640
深色主题预览：1440×900
```

四组截图均满足：

```text
ready=true
renderer=worker
failures=[]
```

根据参照截图进一步收口：

- Sidebar 开关和文件夹/大纲选择入口前置到 Toolbar 左侧，靠近 macOS 交通灯；
- 默认 Toolbar 保留 `sidebar → navigation → flexibleSpace → openActions → zoom → documentActions → search` 的信息架构；
- 当用户自定义 Toolbar 已包含 `sidebar` 时，不重复渲染前置 Sidebar 入口；
- 保留中央文档名稳定定位和窄窗口搜索收缩规则；
- 保留 More 菜单、Open、Inspector、Share、Edit、Zoom 和导航功能；
- 不添加上游不存在的独立 path bar，不修改 Markdown 内容区和会话状态协议。

本轮新增/调整代码：

```text
src/components/Toolbar.tsx
src/lib/settings.ts
src/App.css
```

定向门禁：

```text
TypeScript：通过
ESLint：通过
format:check：通过
组件/设置/样式测试：26 项通过
git diff --check：通过
```

当前状态：顶部区域第一批代码和浏览器截图验证已完成，并已随 `v0.10.2` 提交、推送和正式发布；macOS 原生窗口实拍、原生 NSToolbar 行为、Finder 拖放和原生 titlebar 像素级对齐仍属于独立证据边界，不宣称已完全闭合。

### 9.22 v0.10.6 Toolbar 与 Sidebar 第二批对齐（2026-09-22）

本轮继续对照最新版 Markdown Preview `v0.0.59 / main@719f2dd`，将上游默认 Toolbar 中的统一外观/设置入口落到 TextMark，同时保持 TextMark 原有跨平台设置能力和旧 Toolbar 配置迁移兼容。

实施内容：

- 新增 `themesAndSettings` Toolbar item，并加入 `ToolbarItem` 类型、默认配置、Toolbar 定制器和中英文文案；
- 弹出入口提供当前缩放比例、缩小、放大和偏好设置，避免把缩放和外观设置分散到多个低可发现入口；
- 保留 `zoom` 作为用户自定义 Toolbar item，旧用户配置不会被强制重写；
- 文件树行高从 `30px` 收紧为 `24px`，图标调整为 `14px`，大纲行仍保持约 `30px`，对齐上游文件导航与大纲的不同密度；
- 新增 Toolbar 弹出区域样式和恢复默认测试断言。

本轮验证：

```text
TypeScript：通过
aVitest：43 个文件 / 364 项通过
ESLint：通过
format:check：通过
生产构建：通过
bundle budget：通过，main+worker 305 KiB，native preview 71 KiB gzip
Rust fmt：通过
Rust clippy -D warnings：通过
Rust test：21 项通过
浏览器截图：预览、深色、编辑三组均 ready=true、renderer=worker、failures=[]
```

截图观察：

- 预览态 Toolbar 保持左侧 Sidebar、导航、中央标题和右侧操作的稳定布局；
- 编辑态 Formatting Toolbar 正常显示，文本编辑区和预览内容未出现空白帧；
- 深色场景脚本现在会写入真实 v7 设置并重新加载页面，验证实际主题派生链；截图确认背景、文字、Toolbar、Sidebar 和表格均切换为深色；
- 已通过真实浏览器交互打开 `themesAndSettings`，确认弹出菜单包含缩小、100%、放大和偏好设置按钮；菜单截图已保存；
- 弹出菜单在当前 WebView 中靠近右上 Toolbar，未宣称与原生 NSToolbar 的 WindowServer 级位置完全一致；
- 浏览器截图不用于宣称原生 NSToolbar、titlebar、红绿灯或 WindowServer 像素级一致。

补充交互证据：

- 窄窗口 `980×640` 截图满足 `ready=true`、`renderer=worker`、`failures=[]`；Toolbar 右侧项目能够收缩到 More 菜单，中央标题和 Sidebar 不发生重叠；
- Toolbar 定制器截图满足同样的渲染条件，弹窗显示“可用项目”“当前工具栏”“恢复默认”“显示”和“完成”，确认 `themesAndSettings` 已进入可用项目列表；
- 真实浏览器交互切换 Sidebar“大纲/文件夹”成功，两个 tab 的 `aria-selected` 状态正确；无工作区时文件夹模式显示“打开文件夹…”空状态；
- 复核上游实现后确认当前 TextMark 已有 Markdown 扩展名筛选、workspace watcher 和导航失败不提前改变选中状态；上游级懒加载树、系统文件图标和每个已加载目录独立 watcher 暂列后续增强，不为追求表面一致性贸然扩大本轮改动；
- 进一步收紧右键菜单语义：目录节点现在只显示位置、复制路径和复制内容，文件专属的打开文件、新标签、新窗口和外部编辑器操作不再出现在目录菜单中；目录行也可直接唤起上下文菜单；新增回归测试覆盖该契约。

本批完整门禁已补齐：

```text
Vitest：43 个文件 / 365 项通过
TypeScript：通过
ESLint：通过
format:check：通过
生产构建：通过
bundle budget：通过，main+worker 305 KiB，native preview 71 KiB gzip
Rust fmt：通过
Rust clippy -D warnings：通过
Rust test：21 项通过
npm audit --omit=dev --audit-level=high：0 vulnerabilities
```

当前状态（2026-09-25）：Toolbar/Sidebar 第二批已完成代码、门禁和交互证据验证，已随 `v0.10.7` 提交至 `main` 并创建标签发布；原生 NSToolbar/titlebar 像素级证据仍独立保留。

### 9.25 顶部 Toolbar 第二批几何收口（2026-09-22）

用户复核指出顶部区域仍存在明显视觉差距。本轮先扩展 `scripts/capture-ui.mjs`，输出 Toolbar 分区、标题区域、右侧动作组、More 入口、标签栏/Formatting Bar 和关键按钮中心点的运行时几何及计算样式，避免继续凭缩略图目测调整。

实施：

- 将 `.native-toolbar` 从弹性行改为四列网格：窗口保留区、固定左侧控件、中央标题区、右侧动作组；
- 中央标题由绝对定位改为第三列 `justify-self: center`，右侧动作组改为第四列 `justify-content: flex-end`，使按钮密集区稳定靠右并避免挤压中央标题；
- 保留 macOS 浏览器模拟红绿灯的 `92px` 左侧预留；该预留属于浏览器/Tauri titlebar 差异处理，不作为原生 NSToolbar 像素证据；
- 保留窄窗口的 Toolbar 溢出逻辑和 More 菜单，未修改 Toolbar 默认顺序、交互回调或会话逻辑。

量化证据：

| 场景 | Toolbar | 中央标题区 | 右侧动作组 | More |
|---|---:|---:|---:|---:|
| 1440×900 | 1440×52 | x=470.5, w=360 | x=1091, w=339 | x=1398, w=32 |
| 980×640 | 980×52 | x=269.5, w=294 | x=625, w=343 | x=936, w=32 |

两组截图均 `ready=true`、`renderer=worker`、`failures=[]`。Toolbar 高度继续保持 `52px`；宽屏右侧操作组从标题区右侧稳定收口到窗口右缘，窄屏 More 入口固定在 `x=936`，未出现标题与右侧动作重叠。

本轮验证：TypeScript、ESLint、format:check、Vitest 43 个文件/365 项、生产构建、bundle budget、Rust fmt、Rust clippy `-D warnings`、Rust test、npm audit（0 vulnerabilities）和 git diff --check 均通过。原生窗口实拍尚未完成，也未提交、推送或发布。

结论边界：该批次只闭合浏览器/WebView 可控的 Toolbar 分区几何；macOS 原生 NSToolbar、titlebar、红绿灯真实位置和 WindowServer 像素级一致性仍需同尺寸原生实拍证据，不能由本轮浏览器截图替代。

### 9.26 编辑态 Formatting Bar 与源码列对齐（2026-09-22）

继续复核编辑态截图后确认，Formatting Bar 的主要缺口不是高度，而是工具组相对源码列的水平锚点：宽窗口下工具组应与编辑内容列对齐，窄窗口下应回退到固定 `40px` 内边距，避免工具按钮贴近 Sidebar 分隔线或在窄窗口发生截断。

本轮调整：

- Formatting Bar 保持 `40px` 高度、`15px` 图标和现有分组分隔线，不修改格式命令与焦点语义；
- 宽窗口下将左右内边距从 `max(12px, calc((100% - 820px) / 2))` 收敛为 `max(40px, calc((100% - 820px) / 2 + 40px))`，使工具组与编辑器源码列的 `40px` 内容内边距保持同一水平节奏；
- 窄窗口下实际回退为 `40px`，与 `.cm-scroller` 的 `padding-inline` 一致；
- 扩展 `capture-ui.mjs` 几何输出，加入 `.document-shell`、`.document-workspace`、`.editor-pane` 和 `.cm-content`，用于验证 Toolbar、Formatting Bar、编辑区和源码列的边界关系。

验证结果：

| 场景 | Formatting Bar | 编辑区 | 源码列 |
|---|---:|---:|---:|
| 1440×900 | x=246, w=1194, h=40，padding=227px | x=246, w=1194 | x=473, w=740 |
| 980×640 | x=246, w=734, h=40，padding=40px | x=246, w=734 | x=286, w=654 |

编辑态宽屏、窄屏均 `ready=true`、`renderer=worker`、`failures=[]`；TypeScript、ESLint、format:check 和顶部组件定向测试 27 项通过。随后重新构建 E2E 验证包并运行 `TEXTMARK_LAYOUT_GEOMETRY=1 npm run test:e2e`，布局几何 E2E 1 项通过。首次直接运行因旧验证包提前退出失败，重建 E2E 包后复跑通过；原生窗口像素级证据仍未宣称闭合。

### 9.27 顶部批次最终回归（2026-09-22）

在 Formatting Bar 对齐改动后完成最终回归：

```text
TypeScript：通过
ESLint：通过
format:check：通过
Vitest：43 个文件 / 365 项通过
生产构建：通过
bundle budget：通过
Rust fmt：通过
Rust clippy -D warnings：通过
Rust test：通过
npm audit --omit=dev --audit-level=high：0 vulnerabilities
git diff --check：通过
```

原生 debug 无 bundle 构建通过。布局几何 E2E 首次直接运行因旧 E2E 验证包提前退出，随后执行 `npm run build:e2e` 重建并复跑 `TEXTMARK_LAYOUT_GEOMETRY=1 npm run test:e2e`，最终 1 个 spec 通过。当前累计改动仍未提交、推送或发布。

### 9.28 顶部区域信息架构优先收口（2026-09-22）

根据复核意见，本轮将“布局和 UI 结构”置于尺寸/距离微调之前，重点修正顶部区域的控件归属和视觉分组：

- Sidebar 模式入口与 Back/Forward 导航统一放入左侧 leading cluster，形成“窗口控制 → Sidebar → 导航”的连续结构；
- 从可配置 Toolbar 的测量/渲染流中排除 `sidebar`、`navigation`、`flexibleSpace`、`space` 等结构性 item，避免它们继续被当作右侧普通动作或产生隐形弹性空白；
- 中央文档标题继续保持独立、稳定的居中区域；
- 右侧动作统一归入 trailing cluster，增加与中央标题之间的分隔边界，保留外观/设置、文档动作和 More 的功能层级；
- 文档动作组取消厚重的分段外框，改为独立图标动作加轻量间距，更接近上游 Toolbar 的视觉层级；
- 保持 `52px` Toolbar 高度、窄窗口溢出和所有回调语义不变，尺寸细节暂不作为本轮主目标。

本轮浏览器验证：宽屏 `1440×900`、窄屏 `980×640` 均 `ready=true`、`renderer=worker`、`failures=[]`；顶部结构定向测试 27 项、完整前端门禁、生产构建、bundle、Rust fmt/clippy/test、npm audit 0 vulnerabilities 和布局几何 E2E 通过。原生 NSToolbar/titlebar 仍需独立实拍证据。

### 9.22 编辑初始焦点与 readiness 专项复核（2026-09-22）

对照上游最新提交 `719f2ddc1db679bfc9feb7df2abbc2032c446481` 的 `MainSplitViewController`、`EditorViewController` 和 `EditorHTML`，确认上游的关键语义是：编辑器 DOM ready 与源码滚动锚点分别就绪后，先应用滚动位置，待一帧显示周期完成后再揭示编辑器，最后才执行 autofocus；不能由父层在 Suspense/lazy 挂载后的固定 timeout 中抢焦点。

本轮实施：

- `EditorPane` 新增 `initialFocus`，由编辑器实例在 CodeMirror 已创建且初始位置已安排到下一帧后调用 `view.focus()`；
- 移除 `App.tsx` 中 `setTimeout(() => editorRef.current?.focus(), 0)`，避免首次编辑时与 Suspense 挂载、Toolbar/Find Bar 焦点竞争；
- 初始行锚点仍优先于滚动比例，选区/光标仍按既定“未移动则精确恢复、移动后锚点胜出”规则处理；
- `onInitialPositionApplied` 改为在同一帧位置消费和 focus 之后回报，父层再清除 pending 状态；
- 上游图像 readiness 语义与 TextMark 的 preview hydration gate 对照复核：TextMark 已等待字体、图片 decode、Mermaid 完成后再报告 hydration，且在编辑/阅读两端切换时使旧报告失效。

专项验证：

```text
上游基线：v0.0.59 tag / main@719f2ddc1db679bfc9feb7df2abbc2032c446481
编辑截图：1440×900，ready=true，renderer=worker，failures=[]
编辑截图 htmlBytes=0：符合编辑态卸载预览 DOM 的现有实现，不代表渲染失败
TypeScript：通过
Vitest：43 个文件 / 365 项通过
ESLint：通过
format:check：通过
生产构建：通过
bundle budget：通过
Rust fmt：通过
Rust clippy -D warnings：通过
Rust test：21 项通过
npm audit --omit=dev --audit-level=high：0 vulnerabilities
```

证据边界：浏览器截图确认编辑器可见、初始编辑流程无运行时异常，但无法替代原生 WebKit/AppKit 的 first responder、overlay alpha 交叉淡入和 WindowServer 级焦点证据；当前仍不宣称原生焦点行为与上游完全像素/事件级一致。

### 9.23 编辑标签切换与焦点竞争专项修复（2026-09-21/22）

继续审查编辑/阅读状态交接后，确认有三处可验证的剩余风险：

- 从预览进入编辑时，原有 `documents.document.editorState` effect 同时监听 `viewMode`，可能在模式切换后的下一次提交中覆盖刚由预览锚点计算出的 `pendingEditorLine`、选区和光标；
- 编辑态切换文档标签时，若只调用 `documents.activate`，新标签的 `editorState` 不会作为待恢复输入明确交给 lazy `EditorPane`，上一文档的 `editorExitRef` 也可能影响下一文档；
- `initialFormat` 的完成回调是父组件每次 render 都会重建的函数，若进入 effect 依赖会使格式化 effect 在无关重渲染时重新执行。

本轮最小修复：

- `App.tsx` 新增 `activateDocumentTab`：按目标 session 的 `editorState` 显式设置行号、滚动比例、选区和光标，切换文档时清除上一文档的 `editorExit` 快照；
- 恢复 session editor state 的 effect 改为仅响应 `documents.activeId`，不再响应 `viewMode`，并为没有保存状态的文档清理旧 pending 值；
- `EditorPane` 以 ref 保存 `onInitialFormatApplied`，将其移出格式化 effect 依赖，避免父层重渲染重复消费同一个格式命令；
- 编辑器 `initialFocus` 在 Find Bar 打开时关闭，保证搜索输入框保持权威焦点，避免 Formatting Bar/Find Bar 与 lazy 编辑器初始 autofocus 竞争。

验证结果：

```text
TypeScript：通过
ESLint：通过
定向 Vitest：2 个文件 / 22 项通过
全量 Vitest：43 个文件 / 365 项通过
format:check：通过
前端门禁：未引入新增失败
```

当前仍未宣称原生 first responder、WebKit overlay 淡入和 WindowServer 级焦点证据闭合；本轮修复仅收口了浏览器/WebView 可验证的状态交接和焦点竞争语义。

### 9.24 编辑器滚动容器与预览往返收敛验证（2026-09-22）

继续按“先确认谁在滚”原则复核编辑器高度链：`.editor-pane`、`.editor-page`、`.cm-theme`、`.cm-editor` 均有明确的 `height: 100%` / `min-height: 0` 约束，CodeMirror 的 `.cm-scroller` 继续作为编辑器内部滚动容器；此前补入的 `.editor-pane .cm-theme { height: 100% }` 未被后续样式覆盖。

浏览器验证结果：

```text
编辑模式截图：1440×900，ready=true，renderer=worker，failures=[]，htmlBytes=0（符合编辑态预览卸载语义）
预览模式截图：1440×900，ready=true，renderer=worker，failures=[]，htmlBytes=21296
```

本轮新增证据文件：

- `outputs/desktop-review-20260918/editor-scroll-verify-1440x900.png`
- `outputs/desktop-review-20260918/preview-scroll-verify-1440x900.png`

结论：当前代码层已确认滚动所有权和异步预览位置恢复路径没有新增缺口；预览返回位置会在 hydration 完成后再按当前 heading anchor 计算，避免 Mermaid/图片/字体布局变化覆盖恢复结果。原生窗口和 AppKit first responder 仍不在本轮浏览器证据范围内。

### 9.21 v0.10.5 跨平台 PDF 导出能力收口（2026-09-21）

继续检查剩余任务后，确认 PDF 导出路径已经具备“可导出 PDF”的跨平台实现，但不同运行时的输出保证并不相同。本轮不引入未经验证的平台专用打印引擎，而是把 capability 和输出契约显式化：

- macOS Tauri 且存在 `window.print()` 时使用原生 WebView 打印，保证可选文字和矢量图形；
- 非 Tauri 浏览器使用浏览器打印，保证可选文字和矢量图形；
- Windows/Linux Tauri 使用现有 `html-to-image` + `jsPDF` 分页栅格路径，保证可生成 PDF，但明确标记为 `rasterized`，不宣称可搜索文字或矢量图形等价能力；
- 新增 `pdfExportContract()`，统一返回 `capability`、文本保证和矢量图形保证，新增三条契约分支测试；
- 更新 v0.10.5 版本文件和发布说明，避免 UI 或帮助文案误导用户。

门禁结果：

```text
TypeScript：通过
Vitest：43 文件 / 364 项通过
ESLint：通过
format:check：通过
git diff --check：通过
生产构建：通过
bundle budget：通过
```

当前结论：跨平台“可导出 PDF”已闭合；跨平台“所有平台均输出可选文字矢量 PDF”仍未承诺，需未来为 Windows/Linux 引入并实测平台专用打印或统一 HTML-to-PDF 引擎后再升级契约。
