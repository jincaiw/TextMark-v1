# TextMark v0.5.0 — 第二轮深检对标与实施方案

> 对标对象：`pluk-inc/markdown-preview` **origin/main 最新提交** `827eff0`（= v0.0.47 标签 `e364421b` + 2 个新提交）。
> 当前基线：TextMark v0.4.0（已发布）。
> 本轮重点：桌面 UI、自定义工具栏等逐项深检。状态：**已实施完成**（阶段 1-4 全部落地，回归通过；Quick Look 已实现并本地编译通过，签名/发布走 CI Release gate）。

---

## 1. 上游基线变更（v0.0.47 之后）

| 提交 | 内容 | TextMark 现状 | 结论 |
| --- | --- | --- | --- |
| `24c2ed6` #278 | 删除线要求双波浪线 `~~`（单 `~` 不再渲染为删除线） | markdown-it 默认规则即只认 `~~`（实测 `~~x~~`→`<s>`、`~x~`→原文） | **已一致**，仅需补 parity 测试用例 |
| `827eff0` #273 | Quick Look 原生文本选择 + 光标反馈 | `platform/macos/quicklook/PreviewViewController.swift` 未含该行为 | **差距**（macOS Release gate） |

## 2. 桌面 UI 逐项深检结论

以下逐项对照上游源码（`FindBar.swift`、`DocumentWindowController.swift` 工具栏/上下文菜单、`EditorViewController.swift` 格式栏、`AppDelegate.swift`）与 TextMark v0.4.0 实现。

### 2.1 查找栏（FindBar）— 差距 3 处

| 上游 | TextMark v0.4.0 | 处置 |
| --- | --- | --- |
| `Match:` 标签 + **Contains / Begins With 两个 toggle 按钮**（`AXToggle` 子角色，重复点击当前项为 no-op） | `<select>` 下拉（含/开头为） | 改为 `Match:` 标签 + 两个 toggle 按钮 |
| 右侧 **Done 按钮**（关闭查找栏） | X 图标按钮（无文案） | 改为 Done 按钮（完成） |
| 无匹配显示 **Not found / 未找到** | 显示 "0 of 0 / 第 0 项，共 0 项" | 无匹配时显示"未找到" |

已一致项：`X of N` 计数、prev/next chevron、Enter/Shift+Enter 循环、当前匹配黄色脉冲（`.search-match.active` scale-pulse ✓）、区分大小写、KaTeX MathML/按钮/SVG 过滤。

### 2.2 工具栏搜索框窄窗折叠 — 差距 1 处

上游（0.0.6）：空间不足时搜索框**折叠为放大镜图标按钮**（点击仍可搜索）。TextMark v0.4.0：`≤920px` 时 `.document-search { display: none }` 直接消失。→ 改为折叠为图标按钮；同时 `≤700px` 时 `.open-with` 被隐藏与上游（AppKit 溢出菜单保留全部项）不符，纳入检查。

### 2.3 Open Actions 合并菜单 — 差距 3 处

| 上游 | TextMark v0.4.0 | 处置 |
| --- | --- | --- |
| 每个 App 项带 16px 应用图标 | 无图标 | 检测到应用时展示图标（Rust 返回图标数据或前端字母徽标兜底） |
| 默认目标带勾选态（记住上次选择，LLM 优先） | 无勾选态 | 默认项加 ✓ |
| 空态：`No document open`（未打开文稿）/ `No apps available`（没有可用的 App） | 无空态文案 | 补空态禁用项 |

### 2.4 项目导航器上下文菜单 — 差距 1 处（新功能）

上游文件右键菜单含：**Open with External Editor**（用默认编辑器打开，图标 `arrow.up.right.square`）+ **Open As** 子菜单（全部编辑器，16px 图标 + 默认勾选；无编辑器时禁用项"没有可用的编辑器"）。TextMark v0.4.0 的右键菜单只有 打开/新标签/新窗口/显示/拷贝路径/拷贝内容。→ 补两项（`src/components/Sidebar.tsx` + `openWith` 复用）。

### 2.5 自定义工具栏 — 已基本一致，2 处微差

| 项 | 结论 |
| --- | --- |
| 默认序 `[flexibleSpace, sidebar, navigation, flexibleSpace, openActions, space, zoom, inspector, share, edit, search]` | ✓ 已一致（`sidebarTrackingSeparator` 为 macOS 原生跟踪分隔符，跨平台跳过，记入台账） |
| 可自定集合（+ openWith/openInLLM/print/exportPDF/export/copy） | ✓ 已一致（v0.4.0） |
| 拖拽增删/排序/重置/显示模式（仅图标·图标与文字） | ✓ 已一致 |
| Copy 项点击后**图标闪 checkmark 1.2s** | TextMark 用 toast"已拷贝"→ 改为工具栏 Copy 图标短暂切换为 ✓ |
| Edit 项 tooltip 随状态切换（编辑文稿 ↔ 停止编辑并返回预览） | TextMark 固定 → 动态 tooltip |

### 2.6 菜单状态指示 — 差距 1 处

上游 View ▸ Appearance/Content Width 子菜单与侧栏下拉均带勾选态（当前值 ✓）。TextMark 为普通项无状态。→ 菜单重建时按当前设置加"✓ "前缀（Tauri 动态 CheckMenuItem 成本高，采用文本勾选前缀，跨平台一致）。

### 2.7 其他桌面细节

| 项 | 现状 | 处置 |
| --- | --- | --- |
| OS 窗口标题 | 固定 `TextMark` | 改为 `文件名 — 已编辑/Edited`（`App.tsx` setTitle） |
| 轨道板捏合缩放（0.0.29，50–300% 离散档） | 无 | 预览加 `wheel`+ctrl 与捏合（gesture）处理，复用 `nextZoomStep` |
| Open in LLM 深链长度限制（12,000 字符 + 拷贝并打开回退） | 始终全量拷贝+scheme | 超长时走"拷贝内容 + 打开 App"回退提示 |
| Share 工具栏项（上游=系统共享面板，Copy 得源文本） | `navigator.share` 桌面不可用→仅拷贝回退 | 方案二选一：接入 Tauri 系统共享插件，或维持拷贝回退并记台账 |
| Open Recent（文件菜单） | 无 | 新增：Rust 记录最近文件 + 动态重建菜单（`refresh_recent_menu`） |
| New Tab 行为 | 新建空"未命名.md" | 上游为"无未命名概念，弹文件选择以标签打开"→ 决策点 |
| 打印面板 Font Size（磅）选项 | 无（CSS 打印） | 记台账；打印面板属浏览器原生，跨平台等价实现成本高 |
| PDF 导出与预览一致（0.0.44） | 已有 print CSS | 校验浅/深色、820px 版心、页边距一致性，缺口补 |
| 原生 macOS 窗口标签 + 系统"首选标签"偏好 | 应用内标签页 | 跨平台记台账（有意识偏差） |
| Quick Look 文本选择/光标反馈（#273） | 无 | 更新 `platform/macos/quicklook/PreviewViewController.swift`（Release gate） |

## 3. 功能面已核对一致项（仅补回归）

删除线双波浪线（实测 ✓）、GFM 表格/任务/脚注、KaTeX（含 `\(\)`/`\[\]`、copy-tex）、Mermaid（离线、暗色主题、HUD 缩放、**全宽切换 ↔**、独立窗口）、YAML/TOML frontmatter 面板、RTL、长行内代码换行、标题空行后 4px 间距、表格编辑/矩形选择/行列入操作、目录/项目导航、后退/前进、⌘L/⌘E/⌥⌘1-3/⇧⌘M/⌃⌘1-3 等快捷键、默认中文 + en。

## 4. 分阶段实施

### 阶段 1 — 查找与工具栏微调（高）
1. `FindBar.tsx`：`Match:` 标签 + Contains/Begins With toggle 按钮 + Done 按钮 + "未找到"状态。
2. `App.css` + `Toolbar.tsx`：搜索框窄窗折叠为图标按钮（点击展开查找栏）。
3. `Toolbar.tsx`：Open Actions 菜单图标（应用可用时）、默认勾选、空态文案；Copy 图标 ✓ 反馈 1.2s；Edit tooltip 随状态切换。
4. `Sidebar.tsx`：项目导航器右键补"使用外部编辑器打开 + 打开方式子菜单"。

### 阶段 2 — 菜单与标题（高）
5. `src-tauri/src/lib.rs`：菜单状态勾选前缀（外观/内容宽度/边栏三态）随重建刷新；新增 `recent_files` 状态 + File ▸ Open Recent 动态子菜单 + `refresh_recent_menu` 命令；`read_text_file` 记录最近文件。
6. `App.tsx`：OS 窗口标题 = 文件名（— 已编辑）；`open-recent-*` 菜单分发。

### 阶段 3 — 体验项（中）
7. 预览捏合/⌘滚轮缩放（离散档）。
8. Open in LLM 12k 字符限制 + 回退。
9. 打印/PDF 导出与预览一致性校验补丁。

### 阶段 4 — 平台与发布门槛（中/Release gate）
10. macOS Quick Look 文本选择 + 光标反馈（#273）。
11. `markdown.parity.test.ts` 补删除线单/双波浪线用例；台账更新（`DESKTOP_UI_PARITY`、`PARITY`、`RELEASE_NOTES`）。
12. 三平台回归 + 发布门槛验证。

## 5. 验收标准

1. 查找栏与上游逐项一致（Match: 标签、双 toggle、Done、未找到、脉冲高亮）。
2. 窄窗搜索折叠为图标按钮；Open Actions 含图标/勾选/空态。
3. 右键菜单含"使用外部编辑器打开/打开方式"。
4. 窗口标题=文件名；外观/内容宽度菜单显示当前值。
5. 删除线 parity 测试覆盖 `~~` 与 `~`；Quick Look 文本可选（macOS）。
6. 全部质量门（`npm test`、`build`、`check:bundle`、`cargo test/clippy/audit`）通过。

## 6. 待确认决策点

1. **New Tab**：维持"新建空白文稿"（跨平台编辑器惯例）还是对齐上游"弹文件选择以标签打开"？
2. **Share 项**：接入系统共享面板（各平台需插件/原生桥接）还是维持"拷贝源文本"回退？
3. **本轮范围**：是否包含 macOS Quick Look #273（需 Xcode 真机验证，Release gate）？
4. 版本号按 **v0.5.0** 规划，是否认可？
