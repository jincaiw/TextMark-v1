# TextMark 桌面 UI 对标 v0.0.71 交付记录

- **项目**：TextMark-v1
- **参照应用**：pluk-inc/markdown-preview
- **参照版本**：`v0.0.71`（`Version.xcconfig:6` `MARKETING_VERSION = 0.0.71`），固定提交 [`d0c6197`](https://github.com/pluk-inc/markdown-preview/tree/d0c6197142d3f40fb00f8e58b7cef1788970171f)（`fix (math): show escaped citations like \[18\] as text instead of display math (#633)`）。本轮以该固定提交的源码为结构事实，不据历史截图推断最新版布局。
- **TextMark 交付版本**：`v0.10.9`（基线 `v0.10.8`）。
- **对标约定**：复刻可见结果与行为，以自动化测试作为等价判据；不复刻 AppKit 内部实现/类名；保持跨平台（Windows/Linux/macOS）；不引入分析遥测。
- **文档版本**：交付记录 `v1.0`（2026-11-09）。

## 批次总览

| 批次 | 范围 | 主要交付 | 状态 |
|---|---|---|---|
| B1 | 阅读外观 / 主题自定义 | CustomizeThemeSheet（Apple Books 式字体列表、四个颜色槽、字距/词距/页边距滑杆）、designTokens 字体族、theme 预设与调色板解析、settings 阅读字体与布局区间 | 浏览器组件回归通过 |
| B2 | 侧栏 / Inspector / 设置 | 侧栏措辞与结构对标、Inspector 重排、SettingsDialog 重构 | 浏览器场景通过 |
| B3 | 更新胶囊 | UpdatePill（窗口右下角，图标+一行+百分比+至多一个动作+关闭；checking/available/downloading/preparing/ready/installing/current/updated/error 九态；up-to-date 4s 自动消失；下载进度环） | 浏览器组件回归通过 |
| B4 | 分享浮层 | ToolbarShare（文档图标+名称+「N 词 · 大小」副标题；Export/Print 行在上，Share/Copy 服务在下；外部点击/Escape 关闭、焦点回补、窄窗夹取定位） | 浏览器组件回归通过 |
| B5 | 代码/图示控件 + 菜单 | 代码卡片（md-code-wrap/header/language/actions）、图示 HUD（mermaid-hud 缩放组+动作组，悬停揭示）、blockIcons 上游线图标；菜单 Find and Replace…/Use Selection for Find/Jump to Selection/Release Notes，⌘1–⌘9 标签切换 | 浏览器场景与单元测试通过 |

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

## 门禁（2026-11-09）

- 前端：48 个测试文件、471 项测试通过（`npx vitest run`）。
- `npx tsc --noEmit`、`npx eslint src`、`npm run build` 通过。
- Rust：`cargo check`（src-tauri）通过。
- 浏览器/CDP 场景（`scripts/capture-ui.mjs`，1440×900）：preview / edit / dark / inspector / customizer / appearance / appearance-dark / workspace-panels-drag / workspace-panels-reload / search-replace / tabs-find / tabs / find 共 13 场景均 `failures=[]`。

## 证据边界与未纳入项

- 浏览器/CDP 证据仅代表 WebView DOM 行为与几何，不替代 macOS 原生 AppKit 实拍、原生 NSToolbar/titlebar、系统打印面板与原生菜单交互的实机验收。原生菜单项（lib.rs）经 `cargo check` 与命令接线核对，未在本轮以原生菜单点击逐一实机复验。
- 图示缩放沿用 TextMark 既有加性步进（+25/−25）与 50/300 夹取，level 以百分比呈现；与上游 ×1.25/×0.8、0.25–8 夹取在数值语义上不完全相同，列为已知差异（避免既有交互测试 churn），不影响 HUD 视觉与控件结构对齐。
- **未纳入（下一批次输入）**：上游 ⇧⌘O「Search for Document…」文件搜索面板（含 recents）为独立大功能，TextMark 当前 ⇧⌘O 为 Open Folder，本轮未改动；上游 v0.0.61+ 的 macOS 26 浮动格式控件等亦未逐项对标。
- 本轮不引入分析遥测；保持跨平台。