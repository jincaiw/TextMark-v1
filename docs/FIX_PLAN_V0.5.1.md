# TextMark v0.5.1 — 8 项问题评估与实施方案

> 状态：**已实施完成**（阶段 1-4 全部落地并回归通过；打印/导出 PDF 采用 jsPDF 栅格 PDF 方案，见正文 1.2 说明）。

---

## 1. 逐项根因评估

### 1.1 菜单"切换编辑模式"及多项菜单点击无效（问题 1、2）

**根因：`menu-command` 事件监听器泄漏（竞态）**。`src/App.tsx` 的监听 `useEffect` 依赖数组含 `documents`（`useDocument` 每次渲染都返回新对象），因此**每次渲染都重新订阅**；而代码是：

```ts
let unlisten: (() => void) | undefined;
void listen<string>("menu-command", handler).then((dispose) => { unlisten = dispose; });
return () => unlisten?.();
```

当 `listen()` 的 Promise 尚未 resolve 时发生下一次渲染，cleanup 拿不到 `unlisten`（还是 `undefined`）→ **旧监听器泄漏**。使用时间越久、渲染越多，累积的监听器越多；一次菜单点击会触发 N 次回调：

- **toggle 类命令**（切换编辑模式 / 边栏 / 显示工具栏 / 显示简介 / 崩溃报告开关）连续触发两次 → 净效果为零 → **"点击不起作用"**；
- **save / save-as / new-tab** 等触发多次 → **保存对话框多次弹出**（问题 6 主因）。

证据：`src/App.tsx:217-220`；同模式还存在于 `src/hooks/useDocument.ts:163`（disk-change）、`:269`（open-paths）。

**修复**：三处 `listen` 全部改为"一次性订阅 + `disposed` 标志 + ref 读取最新状态"模式；对 save 类命令再加 `busy` 防重入。

### 1.2 导出 PDF/PNG/HTML、打印无反应（问题 5）

**根因 A**：`src/lib/export.ts:7-14` 用 `<a download>` + `link.click()` 触发下载——Tauri 桌面 webview（macOS WKWebView 无下载委托，WebView2/WebKitGTK 亦不可靠）会静默忽略 → HTML/PNG 导出点击后无任何反应。

**根因 B**：`window.print()` 在 macOS WKWebView 不支持 → "打印…"与"导出为 PDF…"无反应（`src/App.tsx:214`、`:231`）。

**修复**：
- HTML/PNG：改为"前端生成字节 → 原生保存对话框（`@tauri-apps/plugin-dialog` save）→ 新增 Rust 命令 `save_export_bytes(path, bytes)` 写盘"（沿用已有的安全写路径）。
- 打印 / 导出 PDF：接入 `tauri-plugin-printer`（跨平台原生打印；导出 PDF 保留 v0.5.0 的"预览一致"样式，打印保留纸张样式）。实施时核实插件 API（`printHtml` / 打印到 PDF），如插件在 macOS 受限则回退方案：jsPDF+html-to-image 栅格 PDF（见决策点）。

### 1.3 菜单"放大"不显示快捷键（问题 3）

**根因：accelerator 字符串写错**。Rust 菜单中放大项是 `"CmdOrCtrl+Plus"`。muda 解析器（`muda-0.19.3/src/accelerator.rs` `parse_key`/`split_key_and_modifiers`，及其测试 `("Ctrl++", ..., Character("+"))`）证实：**'+' 键必须写作 `"CmdOrCtrl++"`**；`"Plus"` 会被解析成 4 字符的 `Character("Plus")` → 快捷键无效且菜单不显示。

**修复**：放大 accelerator 改为 `"CmdOrCtrl++"`。已逐一核对其余 accelerator（`Comma/Quote/-/Alt+Up/CmdOrCtrl+Up/Shift+7/9/L/M/X` 等）均正常；实施时在 macOS 实机核对菜单显示。

### 1.4 窗口缩小后顶栏挤占、布局乱（问题 4）

**根因**：`.native-actions` 内所有按钮 `flex: 0 0 auto` 不收缩，且**没有溢出管理**；居中标题 `position:absolute; z-index:-1` 与按钮区域视觉重叠；macOS 最小宽 760px 时总宽超出可用空间 → 相互挤占/错乱（`src/App.css` 58-80、384-404 的媒体查询只做了粗粒度隐藏）。

**修复**：
- 用 `ResizeObserver` 实现 AppKit 式**工具栏溢出管理**：放不下的项按固定优先级自动收入"更多"菜单（搜索框仍折叠为图标，不消失）；
- `flexibleSpace` 在窄窗自动塌缩；标题区改为安全占位 + 截断（不再与按钮重叠）；
- macOS（traffic lights 18,20）与 Windows/Linux（右上角窗口按钮 150px 预留）留出控制区安全间距；
- CSS 收紧间距、统一 min-width。

### 1.5 保存对话框多次弹出且为英文（问题 6）

- **多次弹出**：同 1.1 监听器泄漏（一次点击触发多次 `saveFile`/`saveAs`）。修 1.1 后消除；再为 save 加 busy 防重入。
- **英文显示**：macOS 原生 NSSavePanel 跟随 App Bundle 本地化；TextMark 的 macOS 包未含 `zh-Hans.lproj` → 显示英文。
  **修复**：新增 `zh-Hans.lproj/InfoPlist.strings`（含 Save/Cancel/Replace 等）+ 自定义 Info.plist（`CFBundleDevelopmentRegion=zh-Hans`、`CFBundleLocalizations=[zh-Hans,en]`）经 `bundle.macOS.info-plist` 合并（tauri-utils `MacConfig.info_plist` 已确认支持），并通过 `bundle.resources` 打入 bundle。
  Windows/Linux 原生对话框跟随**系统**语言（rfd 无法按应用覆盖）——处理方式见决策点 2。

### 1.6 工具栏图标不好看、间距（问题 7）

**根因**：现样式为"灰底 + 阴影圆角胶囊"（`.toolbar-item-button{background:var(--surface);box-shadow:...}`），与上游 Preview 式工具栏（**裸图标、hover 才显示 bezel、组内 2px 紧凑间距、组间 8px 分隔、26/36px 固定命中区、accessory-bar 风格**）不一致。

**修复**：重做工具栏与格式栏 CSS：默认无底色、hover 出现浅色 bezel；lucide 图标统一 17px / 1.7px 描边（符合 VISUAL_SPEC）；按钮固定 36px 宽、组间加 1px 细分隔线；自定义工具栏的"空格 / 弹性空间"间距项保持可调并修复其在窄窗下的渲染。

### 1.7 命名修改（问题 8）

zh-CN：**目录 → 大纲**、**项目导航器 → 文件夹**。改动点：`src/lib/i18n.ts`（`tableOfContents`/`projectNavigator`）+ `src-tauri/src/lib.rs` `build_menu` 的 zh 文案（sidebar-outline/sidebar-files）+ 侧栏/下拉等所有引用。英文是否同步改名见决策点 1。

---

## 2. 实施阶段

| 阶段 | 内容 | 修复问题 |
| --- | --- | --- |
| 1 | 事件可靠性：三处 listen 一次性订阅 + disposed 修复；save/saveAs busy 防重入 | 1、2、6A |
| 2 | 导出/打印：`save_export_bytes` 命令 + 导出走原生保存对话框；接入 `tauri-plugin-printer`（打印 + 导出 PDF） | 5 |
| 3 | 顶栏：ResizeObserver 溢出管理 + 标题安全区 + 平台控制区 + CSS 收紧 | 4 |
| 4a | accelerator `CmdOrCtrl++` 修复（实机核对菜单快捷键显示） | 3 |
| 4b | macOS zh-Hans 本地化（lproj + info-plist 合并） | 6B |
| 4c | 工具栏/格式栏样式重做（裸图标/hover bezel/分隔/间距） | 7 |
| 4d | zh 命名：大纲 / 文件夹 | 8 |
| 5 | 全量回归（tsc/vitest/build/bundle/cargo test/clippy + `tauri dev` 手动逐项验证 + macOS 打包验证 lproj）→ 版本 0.5.1 → CI 发布 | — |

## 3. 验收标准

1. 菜单单击"切换编辑模式"恰好切换一次；边栏/显示工具栏/简介/崩溃开关同理。
2. 存储/存储为 仅弹出一个保存对话框；macOS 上对话框为中文（存储/取消/替换）。
3. 导出 HTML/PNG/PDF 均弹出保存对话框并成功写盘；打印打开系统打印面板。
4. 菜单"放大"显示 ⌘+（缩小 ⌘−、实际大小 ⌘0）。
5. 窗口缩到最小宽（macOS 760px）顶栏无挤占、无重叠，溢出项进"更多"菜单。
6. 工具栏/格式栏与上游同风格（裸图标 + hover bezel + 分隔 + 紧凑间距）；自定义工具栏间距项可用。
7. zh-CN 界面显示"大纲""文件夹"。
8. 质量门全绿；v0.5.1 经 CI 发布。

## 4. 待确认决策点

1. **英文语言下是否同步改名**（Table of Contents → Outline、Project Navigator → Folders），还是仅改中文？
2. **Windows/Linux 原生保存对话框语言**：跟随系统（推荐，改动小）；还是自绘中文对话框（强制中文，工作量大）？
3. **PDF/打印技术方案**：`tauri-plugin-printer`（推荐，原生打印+PDF）还是 jsPDF 栅格 PDF（无新原生依赖，但 PDF 为图片型不可选字）？
4. 版本按 **v0.5.1** 修复发布，是否认可？
