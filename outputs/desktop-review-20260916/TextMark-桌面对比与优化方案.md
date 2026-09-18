# TextMark 桌面对比与优化方案

**评审版 1.1 · 2026-09-17 · 状态：已按授权直接实施 A+B，并追加低风险上游语法对齐**

对比对象：Markdown Preview v0.0.58 × TextMark v0.9.7。当前工作区 v0.8.0 单独列为实施基线问题，不混入最新版能力比较。

## 1. 结论与建议

**不建议重写桌面框架，也不建议继续按旧截图机械仿制。** TextMark 最新正式版已具备大部分核心能力，真正的改进重点是数据保护、操作闭环和阅读／编辑一致性，其次才是外观。

1. **先修可靠性**：未保存导航、多窗口监听和菜单分发、搜索后导出内容完整性、编辑态导出／打印。
2. **再补高频交互**：可调宽侧栏、可折叠大纲、编辑态大纲定位、统一查找／替换、源位置级读写切换、Quick Look 焦点。
3. **最后增强体验**：更完整的即时预览编辑、排版微调、跨平台可选文字 PDF、会话恢复。
4. **保留本项目优势**：中文默认、三平台、丰富渲染、现有主题、HTML 资源内嵌、成熟的外部编辑器／LLM 交接；不重复开发。

### 1.1 证据等级与边界

- **S：源码确认**——读取锁定 tag 的实现链路与测试，给出文件行号。静态缺陷表示代码逻辑可推导，不冒充桌面复现。
- **R：发布说明**——通过已连接 GitHub 查询最新 Release、标签提交和默认分支。
- **V：仓库图片观察**——阅读官方主窗口、编辑、工具栏自定图片，以及 TextMark 仓库图片；仅说明视觉风格。
- **T：待实测**——原生窗口／Finder／系统分享／打印对话框／性能和像素表现，需要后续在正式运行环境验证。

**初版调研记录曾未安装或启动两款原生应用；本轮已在 TextMark 工作区完成前端/Rust 全部门禁、Tauri debug no-bundle 构建、验证包启动和浏览器运行时交互验证。** Markdown Preview 仍以锁定 release/tag 源码、main 最新提交和发布说明为参照；其原生窗口/Finder 行为未在本机重复安装实测，因此相关结论继续按 S/R/T 证据等级区分。性能目标仍是验收目标，不冒充实测成绩。

参照 `screenshot-main.png` 画面正文仍显示 `v0.0.14`，说明即使图片位于 v0.0.58 tag 中，也不是最新版功能清单；TextMark `textmark-parity.png` 正文写“双栏”但最新版代码是互斥模式，也不能用图片中的文案判定功能。图片未进行缩放标定，不据此声称 1px 级差异；下文尺寸来自源码，区分原生 pt 与 CSS px。

## 2. 版本与实施基线

| 对象 | 核实结果 | 对方案的影响 |
|---|---|---|
| Markdown Preview 最新正式版 | v0.0.58，2026-09-15 22:01:46（UTC+8）；提交 `8db1b2a5b99229ce16b2af7f1d26ab7f0a27a95f` | 本次参照基线；非 draft、非 prerelease |
| Markdown Preview 默认分支 | `main` HEAD：`5a89a47d71cd01b9c657234865f4c368425dd6ac`（2026-09-16，Fix search highlighting and navigation in edit mode） | 开发分支已领先于 v0.0.58；编辑态搜索高亮／导航是本轮新增对标点 |
| TextMark 最新正式版 | v0.9.7，2026-09-01 15:16:38（UTC+8）；提交 `a83579427c8d598249b8aea85257cc29ab0d6674` | 最新版比较以该 tag 为准 |
| TextMark 远程 main | `9d008716a3a340263800089709141f601a6ee911`，package 0.8.0 | main 并不等于最新发布源码 |
| TextMark 最新版所在分支 | `fix/export-temp-path-v0.8.1` HEAD 为 `a835794…` | 分支名不能代表实际版本，已经承载 0.9.7 |
| 当前工作区 | `/Volumes/My-Data/jason.wa/TextMark-v1`，分支 `optimize/v0.9.7-parity`，基线 `v0.9.7`，含未提交 A+B/B15 与 watcher 修复 | 已直接实施；未提交、未推送、未创建 PR |

**实施结论：已从 v0.9.7 基线在 `optimize/v0.9.7-parity` 直接推进；不执行 reset、不改写历史、不提交、不推送。** 后续只在当前工作树继续验证和修复，不把 `main` 的 0.8.0 版本源混入本轮对标结论。

最新发布内容也不同：参照 0.0.58 主要修全屏主题、侧栏最小宽、图片布局、Quick Look 抢焦点及 HTML template 清洗绕过；TextMark 0.9.7 主要修 Windows 帮助菜单和 CLI PATH。不能按版本数字大小比较成熟度。

## 3. 参照桌面设计解析

### 3.1 信息架构

参照采用 **AppKit 文档窗口 + WKWebView 正文 + CodeMirror 即时预览编辑**。左侧目录／文件导航，中间正文，右侧可选 Inspector；阅读与编辑叠放切换，不是默认双栏。

- 默认内容窗 1100×720 pt，侧栏可拖宽 230–400 pt，Inspector 270–500 pt，中栏最小 420 pt；侧栏和 Inspector 初始均折叠，布局可恢复。
- 正文列 820 CSS px，14px 字号、1.5 行高，内边距上32／左右40／下48px。克制的正文版心是阅读感的重要来源。
- 工具栏原生分组；macOS 26 上侧栏控件随侧栏分隔线布局，较旧系统采用另一套排列，不能用同一 CSS 模拟所有原生行为。
- 最新默认工具栏有主题入口、信息、分享、编辑和搜索；打印、导出、置顶等为可定制项。README 老图中的默认项不代表最新默认项。
- 搜索条独立占36pt；编辑时增加格式栏；标题、选中状态和文档内容形成三级层次，而非引入常驻大状态栏。

### 3.2 关键交互原则

- 原生目录树折叠、真实鼠标命中与键盘行为；文件夹整行可展开，而不只点击小箭头。
- 编辑是“非活动语法弱化／隐藏、活动范围显露源码”的即时预览，有表格部件、图片及 Mermaid 相关编辑实现。
- 切换模式保留草稿，**切到预览不等于保存**；离开脏文档必须通过保存／取消／放弃流程。
- 主题不仅作用于正文，还覆盖窗口 chrome、格式／搜索行和全屏工具栏；9个主题不是全部深色，亦有字体／排版取向。
- Quick Look 是 Finder 的客体：加载不能抢键盘焦点；点击正文后才进行选择复制，Copy按钮仍可直接复制源码。
- LLM 是外部客户端交接，不是内置聊天或云推理。共享传递 Markdown 正文，而非仅传文件 URL。

### 3.3 不应盲目照搬的地方

参照也有边界：编辑态查找链路仍指向阅读控制器，不能当作完美实现；未确认持久会话／草稿崩溃恢复；HTML 导出不保证所有本地资源自包含。其全屏主题适配含私有 AppKit selector，不建议移植到 TextMark。它仅支持 macOS 15+，不能替代 TextMark 的跨平台能力。

## 4. UI 布局逐项对比

以下 TextMark 一律指 **v0.9.7**。证据编号在第10节给出，链接固定 tag。

| ID | 对比项 | Markdown Preview 0.0.58 | TextMark 0.9.7 | 结论／建议 | 依据 |
|---|---|---|---|---|---|
| U01 | 桌面外壳 | 原生 AppKit、原生工具栏与标签 | Tauri系统窗口 + React工具栏／标签 | 保留Tauri；增强原生行为，不重写Swift | S：M1、T1 |
| U02 | 工具栏组织 | 侧栏随分隔线布局；主题为默认入口 | 52px高；打开组、缩放组、信息／分享／编辑组、搜索 | 已高度接近；增加排版快捷入口，优化窄窗溢出，不推倒重排 | S：M2、T2 |
| U03 | 窗口默认尺寸 | 1100×720pt | 1440×900；macOS最小760×520，其他配置980×640 | 不为仿制强改默认大小；增加紧凑宽度验收 | S：M1、T1 |
| U04 | 左侧栏 | 230–400pt可拖宽，默认折叠并恢复 | 默认显示；300px，≤1180px变250px；没有用户拖宽 | 新增可调宽与持久化；默认260px作为拟议值，保留手动隐藏 | S：M1、T2 |
| U05 | Inspector | 270–500pt可调，默认隐藏 | 292px固定，默认隐藏；文档／属性两页 | 内容覆盖已接近；增加调宽，避免双栏挤压正文 | S：M1、T2、T5 |
| U06 | 版心与字体 | 正文820px、14px／1.5 | 正文820px、15px／1.52，已有全宽和字号控制 | 基础版心无需重做；保留中文15px默认，新增行高与边距调节 | S：M3、T2 |
| U07 | 阅读／编辑布局 | 单区域切换；编辑器即时预览较完整 | 单区域切换；标题／行样式、代码和本地图片装饰 | 不是“缺编辑器”，而是即时预览不完整；分阶段补齐 | S：M4、T3 |
| U08 | 大纲视觉 | 真正的层级NSOutlineView，可折叠 | flat map + 缩进；子级箭头只是图标，没有折叠状态 | 新增真正的折叠和树键盘导航 | S：M5、T4 |
| U09 | 查找／格式栏 | 查找条+按模式出现格式条 | 同样具备；搜索条独立 | 不新增重复搜索框；统一后端匹配与焦点 | S：M6、T3 |
| U10 | 状态反馈 | 原生文档状态、保存流程 | 标签dirty标记、标题状态、toast；编辑状态仅小点，行列藏在aria-label | 增加紧凑可见“已修改／保存中／行列”，阅读模式默认不占栏 | S：M7、T3 |
| U11 | 主题 | 9主题、字体和阅读布局控制，覆盖全屏chrome | 7预设+自定义颜色+4类字体+系统/浅/深 | 不按数量追平；优先颜色一致性和排版快捷设置 | S：M8、T6 |
| U12 | 工具栏定制与溢出 | 原生自定面板、布局持久化 | 已可拖放、重排、显示标签、迁移设置；溢出只为部分简单项提供菜单替身 | 补齐复合组折叠后的可达性，保留定制与迁移 | S：M2、T2、T6 |

**拟议布局原则：** 左侧“目录｜文件”分段切换，中间保持820px阅读版心，右侧检查器按需出现；缩小窗口优先将检查器转浮层，再折叠侧栏，保持正文可读。左260px、右292px、顶部52px均为初始设计值，最终以中文、英文和三平台实拍确认，不宣称与参照像素一致。

## 5. 交互体验逐项对比

| ID | 对比项 | 参照 | TextMark 最新版 | 判定与建议 | 依据 |
|---|---|---|---|---|---|
| I01 | 未保存导航 | 统一离开保护；保存／放弃／取消 | 已保护“重开已有标签”，但同标签文件导航和前后退仍读盘替换、清dirty | **P0静态高风险**：统一保护所有入口 | S：M7、T7 |
| I02 | 原生关闭／退出 | windowShouldClose进入草稿保护 | 标签关闭有确认；仅DOM beforeunload，未发现原生CloseRequested接线 | **P0保护缺口**；是否出现系统提示仍需三平台实测 | S：M7、T8 |
| I03 | 外部变更与多窗口 | 每文档窗口维护状态／watcher | 单文档冲突、改名、删除处理已有；Rust watcher却是全局单槽 | **P0**：窗口级监听和事件隔离，不能把单窗已通过当多窗通过 | S：M7、T9 |
| I04 | 原生菜单分发 | AppKit responder chain定位目标 | `app.emit(menu-command)`，各文档窗口监听无焦点目标过滤 | **P0静态风险**：只给目标窗口发送，双窗验证 | S：T9 |
| I05 | 读写切换定位 | 携带源位置anchor | 用scrollFraction；大图、表格改变高度后比例不等于同一段 | P1：源位置+块内偏移定位，比例仅作回退 | S：M1、T3 |
| I06 | 编辑态大纲 | 编辑／阅读控制器有源位置联动 | 点击只调用 `document.getElementById(id)`；编辑态预览已卸载 | P1：接入CodeMirror行号定位，不能仅修改大纲样式 | S：M1、T3、T4 |
| I07 | 查找／替换 | contains／beginsWith；编辑态链路也有局限 | 预览DOM高亮计数；EditorPane未接应用FindBar；无统一替换 | P1新增“统一搜索与编辑替换”，属于独立增强，不称参照完全领先 | S：M6、T3 |
| I08 | 自动保存 | 默认关，输入后延迟，冲突保护 | 已有，默认关；仅活动文档随内容变化重设计时 | 不重复新增；补后台dirty标签策略和清晰“暂停／冲突”状态 | S：M7、T7、T6 |
| I09 | 文件树 | 文件夹整行展开、原生树交互 | 已整行展开、文件右键打开／新标签／新窗口等 | 保留已有；补树语义、方向键和扩展状态恢复 | S：M5、T4 |
| I10 | 图片工作流 | 粘贴到同级专用目录，事务重命名 | 已粘贴／内联预览／事务重命名 | 不新增同名功能；补图片对齐与异步粘贴选区回归 | S：M9、T3 |
| I11 | 文件拖放 | README说明拖到App图标／系统文件打开 | 未见应用窗口内文件／目录drop接收链 | P2补窗口拖放；不混同工具栏拖放或图片粘贴 | R/S：M0、T3 |
| I12 | Quick Look焦点 | 0.0.58明确禁止加载抢焦点 | 完成渲染后仍调用 `makeFirstResponder(webView)` | **P1高度相关缺口**：改为用户点击后聚焦，必须用Finder验收 | S：M10、T10 |
| I13 | 快捷键与可访问性 | 原生菜单、树、对话框 | 自定义快捷键和部分焦点管理已有；树／标签键盘漫游不完整 | P1补键盘闭环；不要仅靠title视作可访问性完成 | S：M5、T4、T8 |
| I14 | 更新与等待反馈 | Sparkle系统更新体验 | 已有更新机制；下载回调为空，前端progress仅0 | P2增加实际进度／重试／错误原因，不宣称更新机制缺失 | S：T11 |

## 6. 功能覆盖逐项对比

| ID | 功能 | 参照 | TextMark 0.9.7 | 优化结论 | 依据 |
|---|---|---|---|---|---|
| F01 | 核心Markdown | swift-markdown、GFM、锚点、链接 | Markdown-it、GFM、脚注、提示块、任务、TOC、RTL等 | 已有，保持语法与安全回归 | S：M3、T12 |
| F02 | Mermaid／数学／代码 | 离线Mermaid、KaTeX、公式源码复制 | 已有上述能力；公式选区转TeX、代码语言按需加载 | 不重复开发；编辑部件与渲染对齐是差距 | S：M4、T3、T12 |
| F03 | 表格 | 预览改单元格／行列；编辑态另有表格部件 | 预览可修改表格并回写；编辑态主要仍源码 | P2补编辑态部件；保留源码可撤销 | S：M4、M7、T3 |
| F04 | 图片 | 读写图片对齐、粘贴和改名 | 粘贴／改名已有；装饰图片是按钮widget | P1核查行内／独立／引用式图片段距，不直接照抄上游CSS | S：M9、T3 |
| F05 | HTML／PNG／PDF | 三种都支持；原生WebView打印；HTML资源可移植性不保证 | 三种都支持；HTML内嵌资源；macOS原生PDF，其他平台正文栅格PDF | 覆盖已有；优先完整性，后续增强跨平台可选文字PDF | S：M11、T13 |
| F06 | 搜索后导出 | 本次未确认同类缺陷 | HTML删除整个mark；PNG／栅格PDF过滤mark节点，导致正文命中字丢失 | **P0明确代码缺陷**，不是“去高亮” | S：T13 |
| F07 | 编辑态导出／打印 | 阅读WebView保留；未实测所有导出草稿时效 | 预览卸载；HTML／PNG／非macOSPDF找不到正文直接返回；macOS当前窗打印待测 | P0建立独立、基于当前缓冲区的导出／打印文档树 | S：M1、T3、T13 |
| F08 | Open With | 系统发现editor角色、记忆选择 | 已有macOS角色筛选，增加多种跨平台编辑器 | 保留；为dirty正文交接明确保存/复制策略 | S：M12、T14 |
| F09 | LLM交接 | Codex／Claude／ChatGPT，长内容回退 | 同样已有三客户端与复制回退 | 不是待新增AI；只补“当前缓冲区还是磁盘版本”提示 | S：M12、T14 |
| F10 | 系统分享 | 原生Share传源码 | macOS已原生分享；其他环境分享/复制回退 | 不再把原生Share列缺失；仅回归兼容性 | S：M12、T14 |
| F11 | CLI与URL scheme | mdp等CLI、md-preview://file/ | textmark／tm／text-mark、textmark://file/；冷/热启动已有 | 不新增；v0.9.7 Windows PATH修复也不重复做 | S/R：T15、R2 |
| F12 | 文件类型／默认关联 | 含mdx、txt，按 Markdown 打开但不编译 JSX | 已支持更多 Markdown 扩展；本轮补齐 `.mdx`（浏览器文件选择、Tauri 原生过滤、CLI 启动校验），仍按纯 Markdown 文本读取，不执行 JSX | **已实施**：`.mdx` 进入统一 Markdown 文档闭环；默认关联仍提供系统引导 | S：M0、T1、T15 |
| F13 | 标签／会话恢复 | 原生标签，默认不开；未确认持久草稿恢复 | 多文档标签，默认新窗口；未确认崩溃恢复 | P2独立增强会话和草稿恢复，不能称“补齐参照已有” | S：M13、T7 |
| F14 | 三平台与系统预览 | macOS15+、Quick Look | macOS12+配置、Windows、Linux；Quick Look、Windows预览处理器、KDE缩略图 | 保留差异化；Linux缩略图不等于交互预览；需真实宿主验收 | S：T1、T16 |
| F15 | 隐私与安全 | 可关闭崩溃／使用统计；0.0.58修template绕过 | 崩溃报告默认关；DOMPurify/CSP/资源边界已有 | 不引入使用统计；对上游恶意样例建立本项目负向测试，不武断宣称同漏洞 | S：M0、M3、T6、T12 |
| F16 | 自动化测试 | 有单元测试；README仍说明UI手测 | 有前端/Rust/E2E/截图和导出验证脚本；本轮继续补 `.mdx` 与 `==highlight==` 回归 | 不按测试数量判优；以语义闭环和真实桌面证据为准 | S：T17 |

## 7. 具体优化任务与优先级

P0＝内容／数据完整性和实施前置；P1＝高频核心体验；P2＝增强和专项兼容。规模 S/M/L 仅表示改动范围小／中／跨模块，不是工期承诺。B00–B10 已落地；B15 为本轮追加并已落地的 P1/S 对标项；B11–B14 仍按边界未启动。

| 编号 | 优先级／规模 | 具体改动与代码落点 | 预期效果与验收标准 |
|---|---|---|---|
| B00 | P0／S | 核对v0.9.7与main分叉，从tag建优化分支；核对package/Cargo/Tauri版本；不直接覆盖本地 | 所有后续修复基于0.9.7；保留0.8.x以来已有修复；版本源一致 |
| B01 | P0／L | `useDocument.ts`统一leaveDocument守卫；接入导航、相对链接、文件树、标签关闭、窗口关闭、退出；Rust+前端原生关闭握手；保存成功后才离开，取消不变更历史 | 逐入口验证保存／放弃／取消；双dirty标签逐一处理；失败/冲突/取消不丢文本、不清dirty |
| B02 | P0／L | `lib.rs` WatchState改按窗口注册或引用计数共享watch；事件携window label；菜单定向emit；销毁释放；深链接／第二实例明确目标 | 两窗不同目录同时修改均收到一次；A窗菜单不操作B；关闭A不切断B监听；重复打开不广播创建多份 |
| B03 | P0／M | `export.ts`解包mark而非删正文，栅格清除样式不过滤节点；同步修改export.test的断言 | 搜索开／关导出HTML文本相同；PNG/栅格PDF命中文字可见；嵌套链接、中文、重复命中保持完整 |
| B04 | P0／L | `App.tsx`导出不依赖可见PreviewPane；建立常驻打印树／导出渲染宿主，源自当前buffer；等待公式/图表/图片稳定；超时和失败显式提示 | 阅读／编辑态导出同一草稿一致；macOS原生打印无空白；不打印工具栏/标签；导出后模式、光标、滚动不变 |
| B05 | P1／M | Quick Look移除加载抢firstResponder，保留点击正文交互和Copy；`markdown.ts`、预览、导出宿主补上游清洗/图片案例 | Finder方向键继续切文件，Space关闭；点击后Cmd+A/C正常；恶意HTML不执行；图片行内/引用式/链接式布局回归 |
| B06 | P1／M | `App.css`、Sidebar、Inspector加入拖动分隔条和键盘调宽；settings宽度/显示状态迁移；按正文最小宽自适应；Toolbar溢出补齐复合操作 | 左栏拟230–400px、默认260；右栏拟270–500px；重启恢复；760/980/1100/1440宽下无溢出且所有操作可达 |
| B07 | P1／M | Sidebar构建真正heading tree，折叠集合按文档维护；tree/treeitem、aria-expanded及方向键；编辑态点击调用EditorPane定位 | 箭头确实折叠；父子标题不丢；编辑/阅读均定位正确；文件树键盘展开/打开；不移动或删除隐藏文档 |
| B08 | P1／L | `FindBar`＋EditorPane统一查询状态和命令；编辑查找采用CodeMirror文档位置，支持替换/全部替换及撤销；阅读查找区分渲染文本范围 | 中英文、大小写、跨行/格式边界、有/无结果、Next/Previous一致；切模式保留query；一次撤销可还原全部替换 |
| B09 | P1／M | 用标题/块source range + 块内偏移替代单一scrollFraction；EditorPane暴露定位句柄；切换等待布局稳定 | 同一标题/段落在读写切换后仍在视口；异步图片、长表、Mermaid不跳到错误章节；无法映射才比例回退 |
| B10 | P1／M | Toolbar增加“外观”可定制项；复用7主题/4字体；设置增加行高与水平边距；顶部保持52px；编辑态紧凑显示dirty/保存/行列 | 常用外观≤2次点击；中文15px默认不回退；主题覆盖工具栏/搜索/格式行；不把9主题数量当目标 |
| B15 | P1／S | 对齐上游 main/v0.0.58 的 `.mdx` 纯 Markdown 打开和 `==highlight==` 行内高亮；扩展浏览器选择器、Tauri 原生扩展名判定、MarkdownIt 安全 inline rule、主题样式与回归测试 | `.mdx` 可从文件选择器、CLI、桌面启动链进入；高亮不影响代码 span、未闭合标记保持文本；不编译或执行 JSX；上游新语法进入阅读／导出一致链路；已取得浏览器真实编辑→阅读 `<mark>` 证据 |
| B11 | P2／L | EditorMarkdownDecorations分模块增加非活动语法弱化、任务/表格/数学/Mermaid部件；保留源码入口；从选区/语法树驱动 | 输入光标稳定，中文IME不破坏；表格/任务修改可撤销；活动区显露源码；代码字面量不误装饰；不是另起富文本模型 |
| B12 | P2／M | 明确外部编辑器/LLM使用buffer或磁盘；dirty时“保存后打开／复制当前内容／取消”；增加窗口文件/目录drop；更新事件带bytes/total | 不把旧文件交给外部应用而误报成功；drop只打开不移动；更新有真实进度或不定进度和错误重试 |
| B13 | P2／L | 跨平台PDF能力探针：优先系统WebView矢量打印；不可用保留栅格并标注；统一纸张/页边距/长表策略 | Windows/Linux正文可选文字目标单独验收；中文字体正确，图表不丢；未通过探针不承诺所有端原生等价 |
| B14 | P2／L | 会话/草稿恢复独立设计：窗口/标签/选区/阅读位置与草稿分存、原子写入；恢复前核对磁盘revision；用户可关闭和清除 | 异常退出后可恢复草稿且不自动覆盖磁盘；冲突需选择；本地存储，不新增云同步或遥测 |

### 7.1 推荐实施批次

> 实施更新：原 A+B（B00–B10）已完成；本轮在不扩大到 C/D 的前提下，追加 B15（P1/S）作为直接对标上游最新语法的低风险补齐项。B15 不执行 JSX、不引入新依赖、不改变 Tauri 外壳。

| 批次 | 内容 | 依赖／放行条件 | 交付 |
|---|---|---|---|
| A：可靠性 | B00 → B01/B02/B03 → B04；B05可并行源码测试 | 确认基线后开始；所有数据丢失/内容缺失回归通过才进入大UI改动 | 独立小提交、失败→通过的回归、双窗/导出/Finder证据 |
| B：布局与导航 | B06、B07、B09、B10；B08在B01后推进 | 保留用户工具栏配置；三平台分开核验标题栏行为 | 同文档、同逻辑窗口尺寸截图；键盘流程；中英文/主题覆盖 |
| C：编辑增强 | B11；B12可拆小任务穿插 | 源位置映射、编辑查找稳定；一次只交付一类widget | IME/撤销/大文档基准；语法fixture |
| D：可选专项 | B13、B14 | 各自技术验证与单独确认后实施 | PDF兼容矩阵；草稿恢复与冲突演练 |

**建议本轮只批准 A+B 为必做范围；C按组件逐项确认，D保留为后续。** 不预先指定发布版本号、不创建Issue、不提交/推送，避免未经确认扩大范围。

## 8. 验收与实施边界

### 8.1 共用验收矩阵

- **平台**：macOS原生窗口+Finder；Windows原生窗口+WebView2+Explorer；Linux窗口+对应预览宿主。浏览器只验前端布局，不替代原生。
- **UI场景**：阅读、编辑、查找、Inspector、工具栏自定；中文/英文；浅/深/自定义；760px仅用于允许该最小宽的macOS配置，其他平台使用其实际最小宽。
- **文档**：空文档、中文长标题、相对路径图片、引用式图片、行内图、宽表、长代码、公式、Mermaid、frontmatter、混合HTML、未保存草稿、磁盘冲突。
- **数据保护**：记录操作前buffer/revision；导航或取消后逐字比对，不以“对话框出现”替代数据验收。
- **导出**：先断言文字完整，再看样式；搜索高亮只可改变视觉，不得改变正文。可选择文字仅检验矢量路径，不能要求栅格正文通过文本提取。
- **性能目标**：先在同机建立0.9.7基线；普通编辑延迟p95拟≤50ms，250KiB文档常用操作不出现>100ms长任务；1MiB压力样例分别计解析与DOM阶段。目标未达时先报告，不用重复输入命中缓存冒充性能结果。
- **视觉证据**：使用同一fixture、相同逻辑窗宽及缩放；原生截图用系统元素校准。比较栏目宽和对齐时同时保留源码/计算样式，历史README图只作风格参考。

### 8.2 本轮不做

- 不修改业务代码、平台配置、依赖、分支或历史计划；不发布版本、不创建PR。
- 不重写Tauri为AppKit，不引入Electron，也不追求不同平台完全相同的系统标题栏。
- 不新增内置AI聊天、账户／云同步／遥测，不把已有外部LLM交接改成上传正文。
- 不将双栏编辑器作为默认方向；这不是参照当前默认行为，且会扩大信息密度和映射成本。
- 不为了模仿加入私有AppKit selector，不以换配色掩盖交互缺陷。

## 9. 待确认决策

1. **基线**：是否同意从 **v0.9.7** 创建优化分支，而不是从当前0.8.0/main直接实现？主线合并策略在祖先关系检查后单独确认。
2. **范围**：是否同意 **A可靠性 + B布局/导航** 为必做，C分步，D另批？
3. **产品形态**：是否继续“阅读优先、单区域读写切换”，保留Tauri和中文15px默认？
4. **侧栏方案**：是否采用“左栏默认260px、可调230–400；右栏292px、可调270–500；宽度/显示状态记忆”，而不是机械复制参照默认折叠？

以上全部是**待确认建议**。确认后才开始B00及业务实施。

## 10. 可追溯证据索引

固定标签链接用于复查，避免默认分支后续变化污染结论。T=TextMark，M=Markdown Preview。

### 发布与版本

- R1：[Markdown Preview v0.0.58 Release](https://github.com/pluk-inc/markdown-preview/releases/tag/v0.0.58)。
- R2：[TextMark v0.9.7 Release](https://github.com/jincaiw/TextMark-v1/releases/tag/v0.9.7)。
- R3：[TextMark发布提交 a835794](https://github.com/jincaiw/TextMark-v1/commit/a83579427c8d598249b8aea85257cc29ab0d6674)、[main提交9d00871](https://github.com/jincaiw/TextMark-v1/commit/9d008716a3a340263800089709141f601a6ee911)。

### 参照实现

- M0：[README（tag）](https://github.com/pluk-inc/markdown-preview/blob/v0.0.58/README.md)、[CHANGELOG:5–22](https://github.com/pluk-inc/markdown-preview/blob/v0.0.58/CHANGELOG.md#L5)；仓库图片 `docs/screenshot-main.png`、`screenshot-edit-mode.png`、`screenshot-toolbar-customize.png`。
- M1：[MainSplitViewController:56–69、259–283、290–503](https://github.com/pluk-inc/markdown-preview/blob/v0.0.58/md-preview/Document/MainSplitViewController.swift#L56)；[DocumentWindowController:181–223](https://github.com/pluk-inc/markdown-preview/blob/v0.0.58/md-preview/Document/DocumentWindowController.swift#L181)。
- M2：[工具栏默认与可定制项:44–103](https://github.com/pluk-inc/markdown-preview/blob/v0.0.58/md-preview/Document/DocumentWindowController%2BToolbar.swift#L44)。
- M3：[MarkdownHTML:160–181、410–428](https://github.com/pluk-inc/markdown-preview/blob/v0.0.58/md-preview/Rendering/MarkdownHTML.swift#L160)。
- M4：[EditorViewController:9–49](https://github.com/pluk-inc/markdown-preview/blob/v0.0.58/md-preview/Features/Editor/EditorViewController.swift#L9)；[编辑器部件:633–679、2182–2239](https://github.com/pluk-inc/markdown-preview/blob/v0.0.58/scripts/editor-bundle/entry-cm.js#L633)。
- M5：[SidebarViewController:10–149](https://github.com/pluk-inc/markdown-preview/blob/v0.0.58/md-preview/Features/Sidebar/SidebarViewController.swift#L10)；[ProjectNavigatorView:27–48](https://github.com/pluk-inc/markdown-preview/blob/v0.0.58/md-preview/Features/Sidebar/ProjectNavigatorView.swift#L27)。
- M6：[查找转发:134–139](https://github.com/pluk-inc/markdown-preview/blob/v0.0.58/md-preview/Document/MainSplitViewController.swift#L134)；[FindBar:12](https://github.com/pluk-inc/markdown-preview/blob/v0.0.58/md-preview/Features/Find/FindBar.swift#L12)。
- M7：[EditSession:12–197、224–355、464–519、555–819](https://github.com/pluk-inc/markdown-preview/blob/v0.0.58/md-preview/Document/DocumentWindowController%2BEditSession.swift#L12)；[Autosave:19–55](https://github.com/pluk-inc/markdown-preview/blob/v0.0.58/md-preview/Document/DocumentWindowController%2BAutosave.swift#L19)。
- M8：[ThemePreset:104–153](https://github.com/pluk-inc/markdown-preview/blob/v0.0.58/md-preview/Theme/ThemePreset.swift#L104)；[ReaderLayoutSetting:18–74](https://github.com/pluk-inc/markdown-preview/blob/v0.0.58/md-preview/Rendering/ReaderLayoutSetting.swift#L18)；[FullscreenToolbarTheme:4–108](https://github.com/pluk-inc/markdown-preview/blob/v0.0.58/md-preview/Theme/FullscreenToolbarTheme.swift#L4)。
- M9：[ImageHandling:9–82、147–278](https://github.com/pluk-inc/markdown-preview/blob/v0.0.58/md-preview/Document/DocumentWindowController%2BImageHandling.swift#L9)；[图片样式:864–884](https://github.com/pluk-inc/markdown-preview/blob/v0.0.58/md-preview/Rendering/MarkdownHTML%2BStylesheet.swift#L864)。
- M10：[QuickLookFirstResponderPolicy:8–37](https://github.com/pluk-inc/markdown-preview/blob/v0.0.58/quick-look/QuickLookFirstResponderPolicy.swift#L8)。
- M11：[PDFExport:18–78、749–832、960–1054](https://github.com/pluk-inc/markdown-preview/blob/v0.0.58/md-preview/Rendering/MarkdownWebView%2BPDFExport.swift#L18)。
- M12：[OpenTargets:316–470](https://github.com/pluk-inc/markdown-preview/blob/v0.0.58/md-preview/Document/DocumentWindowController%2BOpenTargets.swift#L316)；[OpenTargetCatalog:84–112](https://github.com/pluk-inc/markdown-preview/blob/v0.0.58/md-preview/Features/OpenWith/OpenTargetCatalog.swift#L84)。
- M13：[TabOpeningPolicy:21–55](https://github.com/pluk-inc/markdown-preview/blob/v0.0.58/md-preview/Preferences/TabOpeningPolicy.swift#L21)；[MarkdownDocument:22–33](https://github.com/pluk-inc/markdown-preview/blob/v0.0.58/md-preview/Document/MarkdownDocument.swift#L22)。

### TextMark实现

- T1：[tauri.conf:15–27、54–71](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/src-tauri/tauri.conf.json#L15)；[macOS配置:8–29](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/src-tauri/tauri.macos.conf.json#L8)。
- T2：[App.css:79–81、754–760](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/src/App.css#L79)；[Toolbar:155–190、300–338、366–448](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/src/components/Toolbar.tsx#L155)。
- T3：[App:244–250、862–915](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/src/App.tsx#L862)；[EditorPane:138–224、253–294](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/src/components/EditorPane.tsx#L138)；[editorMarkdownDecorations:78–123](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/src/lib/editorMarkdownDecorations.ts#L78)。
- T4：[Sidebar:15–50、101–119、142–205](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/src/components/Sidebar.tsx#L15)。
- T5：[Inspector:39–115](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/src/components/Inspector.tsx#L39)。
- T6：[settings:34–79、85–134](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/src/lib/settings.ts#L34)。
- T7：[useDocument:149–165、219–302、324–389、481–524、641–675](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/src/hooks/useDocument.ts#L324)。
- T8：[App:529–535、748–754](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/src/App.tsx#L748)；[Toolbar关闭入口:377–382](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/src/components/Toolbar.tsx#L377)。
- T9：[lib.rs:220、340–379、2023–2030、2082–2085](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/src-tauri/src/lib.rs#L340)。
- T10：[Quick Look加载后抢焦点:544–548](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/platform/macos/quicklook/PreviewViewController.swift#L544)。
- T11：[更新安装:1709](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/src-tauri/src/lib.rs#L1709)；[useUpdater:31–39](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/src/hooks/useUpdater.ts#L31)。
- T12：[markdown.ts](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/src/lib/markdown.ts)；[copyTex:17–49](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/src/lib/copyTex.ts#L17)；[PreviewPane查找:288–325](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/src/components/PreviewPane.tsx#L288)。
- T13：[export:23–27、115–122、232–237、273–324](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/src/lib/export.ts#L23)；[App导出打印:370–455](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/src/App.tsx#L370)；[测试漏正文断言:25–42](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/src/lib/export.test.ts#L25)。
- T14：[App分享:307–327](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/src/App.tsx#L307)；[llmHandoff:48–81](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/src/lib/llmHandoff.ts#L48)。
- T15：[deepLink:7–38](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/src/lib/deepLink.ts#L7)；[useTextmarkDeepLinks:13–24](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/src/hooks/useTextmarkDeepLinks.ts#L13)；[lib.rs CLI:1815–1892、默认关联:1927–1935](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/src-tauri/src/lib.rs#L1815)。
- T16：[platform目录](https://github.com/jincaiw/TextMark-v1/tree/v0.9.7/platform)，包含三平台预览和打包代码；不等同本轮宿主实测通过。
- T17：[e2e/shell.spec.mjs](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/e2e/shell.spec.mjs)、[CI工作流](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/.github/workflows/ci.yml)、[发布历史](https://github.com/jincaiw/TextMark-v1/blob/v0.9.7/RELEASE_NOTES.md)。历史测试通过数字为发布方记录，本轮未复跑。

---

**本次交付：42项逐项对比（UI 12 / 交互14 / 功能16），补充 `main` 最新提交 `5a89a47` 与 v0.0.58 的关系；B00–B10 已实施，B15 已追加并实施，B11–B14 仍按边界未启动。**
