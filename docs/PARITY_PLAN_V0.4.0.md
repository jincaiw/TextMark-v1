# TextMark v0.4.0 — 对标与实施方案

> 对标对象：`pluk-inc/markdown-preview` v0.0.47（commit `e364421b`，2026-08-08，macOS AppKit/Swift）。
> 当前基线：TextMark v0.3.0（Tauri 2 + React/TS + Rust，跨 Windows/Linux/macOS）。
> 状态：**已实施完成**（阶段1-3 全部落地并回归通过）。菜单/工具栏/检查器/快捷键/措辞/导出/默认处理程序/Install CLI 均已实现；Quick Look/Explorer Preview/Linux 缩略图保持既有 Release gate。逐项明细见 `DESKTOP_UI_PARITY_V0.4.0.md`。

---

## 1. 对标结论（Benchmark）

| 维度 | 结论 |
| --- | --- |
| 功能特性 | 主体功能已在 v0.3.0 达成对齐（渲染、编辑模式、Mermaid、KaTeX、目录、检查器、搜索、Open With、Open in LLM、缩放、可自定工具栏、分享=复制源、导出 PDF/HTML/PNG、后退/前进、窗口标签、表格编辑、RTL、YAML/TOML frontmatter、Quick Look/Explorer Preview/缩略图等）。见 `PARITY_V0.0.47.md`。 |
| 跨平台 | 已满足（Tauri 2：Windows x64/ARM64 MSI/NSIS/便携 ZIP；Linux x64/ARM64 AppImage/DEB/RPM；macOS Universal 2 app/DMG）。 |
| 多语言 | 已具备 en + zh-CN，默认 zh-CN（符合"默认中文"要求）。 |
| **桌面 UI/UX** | **仍存在可量化差距**，集中在：原生菜单结构、工具栏项目集合、检查器分页、简体中文措辞、键盘快捷键、默认处理程序/CLI 安装入口。这是本轮的重点。 |

**结论**：功能面已"全量覆盖"，但"全部一致"在**桌面 UI 与使用体验**层面尚未完全达标——尤其是 macOS 原生菜单（Format/Go 菜单、Appearance/Content Width 子菜单、App 菜单里的 Install CLI/崩溃报告开关）与工具栏项目集合/措辞仍与上游有差异。

---

## 2. 差距清单（Gap Ledger）

### A. 原生菜单结构（高优先级）

上游菜单为：`App / File / Edit / View / Format / Go / Window / Help`。当前 `build_menu`（`src-tauri/src/lib.rs`）只有 `App / File / Edit / View / Window / Help`，且多个子项缺失。

| 菜单 | 上游存在、当前缺失 | 处置 |
| --- | --- | --- |
| **Format（格式）** | Body、Heading 1/2/3、Bold、Italic、Strikethrough、Inline Code、Link、Bulleted List、Numbered List、Checklist、Block Quote | 新增 `format-*` 菜单项 + 快捷键，经 `menu-command` 事件驱动 `format()` |
| **Go（前往）** | Up、Down、Page Up、Page Down、Previous Item、Next Item、Top of Document、Bottom of Document | 新增 `go-*` 菜单项，映射到预览滚动/前后匹配 |
| File（文件） | New Tab(⌘T)、Open Recent、Close(⌘W)、Revert to Saved、Export…、Export as PDF… | 补 `new-tab`、`close-tab`、`revert`、`export`（面板）、`export-pdf`；Open Recent 需 Rust 最近记录 |
| View（显示） | Show Toolbar、Appearance(自动/浅色/深色)、Content Width(标准/全宽)、Table of Contents(⌃⌘2)、Project Navigator(⌃⌘3) | 补 `show-toolbar`、`appearance-*`、`width-*`、`sidebar-outline`、`sidebar-files` 子菜单/项 |
| App/Edit | Install CLI…、Send Anonymous Crash Reports（开关）、Paste and Match Style、Delete、Find Next(⌘G)/Find Previous(⌘⇧G) | 补 `install-cli`、`crash-reports`、`find-next`/`find-prev` |

**要点**：`Format`/`Go` 菜单是上游"桌面使用体验"的核心组成，必须补齐；快捷键使用上游 0.0.40 对齐后的 macOS 标准（`⌥⌘1/2/3` 标题、`⌥⌘0` 正文、`⇧⌘M` 行内代码、`⌃⌘1/2/3` 侧栏/目录/项目导航、`⌘L` 侧栏）。

### B. 工具栏项目集合（高优先级）

| 差距 | 上游 | 当前 | 处置 |
| --- | --- | --- | --- |
| Open With / Open in LLM 拆分 | `openWith` 与 `openInLLM` 为两个可自定项；默认 `openActions` 合并菜单且 **AI 应用在前** | 单一 `openWith` 下拉，编辑器在前、LLM 在后 | 拆为 `openWith` + `openInLlm` 两个 `ToolbarItem`；默认合并菜单中 "AI Apps" 段排在 "Editors" 前 |
| Export 拆项 | `exportPDF`（导出 PDF）与 `exportDocument`（导出… 面板）两个独立项 | 单一 `export`（HTML）+ 打印走 PDF | 新增 `exportPdf` 项；`export` 改为"导出…"面板（Format: PDF/HTML） |
| 缩放步进 | Safari 式离散档（50→300%） | 键盘用离散档，但**工具栏 ±10** 与键盘不一致 | 工具栏缩放改用同一 `nextZoom` 离散档 |
| 默认工具栏 | `[flexibleSpace, sidebarMenu, sidebarSeparator, navigation, flexibleSpace, openActions, space, zoom, inspector, share, edit, search]` | `[flexibleSpace, sidebar, navigation, flexibleSpace, openWith, space, zoom, inspector, share, edit, search]` | 默认项改用 `openActions`（合并）+ 独立 `openWith`/`openInLlm` 可入自定义面板 |

涉及文件：`src/types/index.ts`（`ToolbarItem`）、`src/lib/settings.ts`（`DEFAULT_TOOLBAR`/`TOOLBAR_ITEMS`）、`src/components/Toolbar.tsx`、`src/components/ToolbarCustomizer.tsx`。

### C. 检查器分页（中优先级）

上游 Inspector 为 **Document / Properties 双页签**（原生分段控件，SF Symbol `doc`/`info` 图标；无 frontmatter 时 Properties 显示 "No frontmatter" 占位）。当前为**单列平铺**。

处置：将 `Inspector.tsx` 重构为两页签（Document：文件名/类型/大小/字数/字符/行/标题/链接/图像/修改日期；Properties：frontmatter 键值或占位）。

### D. 简体中文措辞对齐（中优先级）

以下当前 `zh-CN` 与上游 `zh-Hans.lproj` 措辞不一致，需对齐（"全部一致"）：

| 键 | 上游 | 当前 |
| --- | --- | --- |
| Normal | 标准 | 正常 |
| Words | 单词数 | 字词 |
| Open in LLM | 在 LLM 中打开 | 在 AI 应用中打开 |
| Project Navigator | 项目导航器 | 项目导航 |
| Copy / Copied / Copy source | 拷贝 / 已拷贝 / 将 Markdown 源文本拷贝到剪贴板 | 复制 / 已复制 / 复制源文件 |
| Sidebar | 边栏 | 侧栏 |
| No frontmatter | 无前置元数据 | 无 Frontmatter |
| Frontmatter | （Properties 页签语境） | Frontmatter |
| Get Info | 显示简介 | 简介 / 显示简介（混合） |
| Show in Finder | 在"访达"中显示 | 在文件管理器中显示 |
| Begins With | 开头为 | 开头匹配 |

说明：跨平台下 "在'访达'中显示" 需按平台取值（macOS=访达 / Windows=资源管理器 / Linux=文件管理器），措辞仍对齐上游语义。

涉及文件：`src/lib/i18n.ts`（zh 字典）。

### E. 键盘快捷键补齐（中优先级）

上游已对齐 macOS 标准：`⌥⌘1/2/3` 标题、`⌥⌘0` 正文、`⇧⌘M` 行内代码、`⌘K` 链接、`⌃⌘1/2/3` 侧栏/目录/项目导航、`⌘L` 侧栏、`⌘E` 编辑、`⌘S` 保存、`⌘F`/`⌘G`/`⌘⇧G` 查找、`⌘+`/`⌘−`/`⌘0` 缩放、`⌘T` 新标签、`⌘W` 关闭标签、`⌘[`/`⌘]` 后退/前进。

当前 `App.tsx` 已有部分（⌘E/⌘L/⌘S/⌘F/⌘G/⌘+/-/0/⌘[/⌘]），缺：标题/正文/行内代码快捷键、`⌃⌘1/2/3`、`⌘T`、`⌘W`。补齐到 `keydown` 处理器与 Rust 菜单加速键。

### F. 默认处理程序 + CLI 安装（中优先级）

| 差距 | 上游 | 当前 | 处置 |
| --- | --- | --- | --- |
| 默认 .md 处理程序 | 首次启动主动询问注册 | 仅安装器注册关联，无应用内提示 | 首次启动弹窗询问"设为默认 Markdown 打开方式"（Rust 实现注册，三平台） |
| Install CLI… 菜单 | App 菜单安装 `mdp`/`md-preview`/`markdown-preview` | 仅随包/安装器提供 `textmark`/`tm`/`text-mark` | 新增 `install-cli` 菜单：Linux/macOS 写软链或 PATH 脚本；Windows 写 `.cmd` |

### G. 导出面板（低/中优先级）

上游：File ▸ Export…（面板，Format: PDF/HTML）+ File ▸ Export as PDF…；PDF 与阅读态预览一致（浅/深色、820px 版心、页边距）。当前：导出 HTML/PNG 按钮 + 打印→PDF。

处置：新增 Export 面板（PDF/HTML 二选一）；`Export as PDF…` 独立项；验证 PDF 输出与预览版式一致（复用打印 CSS 路径）。

### H. 细节保真（低优先级，验证为主）

以下上游行为已具备实现，本轮以**验证/回归**为主，不新增功能：任务列表内联复选框、表格行/列全量操作、RTL、长行内代码换行、标题空行后 4px 紧凑间距（`App.css` 已含 `.md-source-blank-line + h1..h6`）、shell/hcl/terraform 高亮、YAML frontmatter 面板、Mermaid 全宽/缩放 HUD/独立窗口。

---

## 3. 分阶段实施

### 阶段 1 — 菜单与快捷键（桌面 UI 骨架）
1. `src-tauri/src/lib.rs`：扩展 `build_menu`，新增 Format / Go 菜单、File 补项（New Tab/Close/Revert/Export/Export as PDF/Open Recent）、View 补项（Show Toolbar/Appearance/Content Width/Table of Contents/Project Navigator）、App/Edit 补项（Install CLI/崩溃报告开关/Paste and Match Style/Delete/Find Next/Prev）。
2. `src/App.tsx`：`menu-command` 事件新增 `format-*`/`go-*`/`new-tab`/`close-tab`/`revert`/`export-pdf`/`appearance-*`/`width-*`/`sidebar-outline`/`sidebar-files`/`install-cli`/`crash-reports` 分支；补齐 `keydown` 快捷键（标题/正文/行内代码/⌃⌘1/2/3/⌘T/⌘W）。
3. `src/lib/i18n.ts` + `build_menu`：新增菜单项双语措辞（对齐上游 zh-Hans）。

### 阶段 2 — 工具栏与检查器
4. `src/types/index.ts`：`ToolbarItem` 增 `openInLlm`、`exportPdf`（及 `openActions` 默认合并项）。
5. `src/lib/settings.ts`：`DEFAULT_TOOLBAR` 对齐上游默认序；迁移 v3→v4 设置。
6. `src/components/Toolbar.tsx` / `ToolbarCustomizer.tsx`：拆分 Open With / Open in LLM、新增导出 PDF 项、AI 应用段前置、缩放改离散档。
7. `src/components/Inspector.tsx`：重构为 Document/Properties 双页签。

### 阶段 3 — 本地化与细节
8. `src/lib/i18n.ts`：按 D 节对齐 zh-CN 措辞；补充新增菜单/工具栏项翻译。
9. `src/lib/platform.ts` + `src-tauri`：实现"设为默认打开方式"首次提示与 `install-cli`（三平台）。
10. 导出面板与 `Export as PDF…`。

### 阶段 4 — 验证与发布门槛
11. 更新 `docs/PARITY_V0.0.47.md` 差异台账、`VISUAL_SPEC.md` 视觉台账、`UPSTREAM_TEST_MATRIX` 增补菜单/工具栏/检查器用例。
12. 回归：`npm test`、`npm run build`、`cargo test`、`cargo clippy -- -D warnings`；三平台原生包冒烟（Quick Look/Explorer Preview/缩略图 保持 Release gate）。

---

## 4. 验收标准（Acceptance）

1. **菜单**：三平台原生菜单包含 `Format` 与 `Go`，App/File/Edit/View 子项与上游一一对应（macOS 上对比上游 `MainMenu.xib`，Windows/Linux 用等价菜单，加速键一致）。
2. **工具栏**：默认序、可自定项集合、Open With/Open in LLM 拆分、导出 PDF 独立项、离散缩放与上游一致；AI 应用段在合并菜单中居前。
3. **检查器**：Document/Properties 双页签，空 Properties 显示"无前置元数据"。
4. **本地化**：zh-CN 默认，所有可见文案与上游 `zh-Hans.lproj` 对齐（跨平台平台术语除外）；en 完整。
5. **快捷键**：`⌥⌘1/2/3`、`⌥⌘0`、`⇧⌘M`、`⌃⌘1/2/3`、`⌘L`、`⌘T`、`⌘W` 等在编辑/预览态均生效。
6. **默认处理程序/CLI**：首次启动可询问设为默认；`Install CLI…` 三平台可用。
7. **回归零失败**：本地测试 + 三平台原生包冒烟通过。

---

## 5. 待确认决策点

1. **多语言范围**：仅 en + zh-CN（严格对标上游双语），还是扩展更多语言？默认 zh-CN 保持不变。
2. **措辞对齐力度**：是否严格采用上游 zh-Hans 措辞（拷贝/单词数/标准/在 LLM 中打开/无前置元数据…），即使个别当前措辞更"现代"？
3. **版本号**：本轮按 v0.4.0 规划，是否认可？
4. **"全部一致"边界**：是否以"功能 + 桌面 UI/UX 全对齐上游，并叠加跨平台/多语言/默认中文"为验收口径（即允许平台差异：如 macOS 访达 vs Windows 资源管理器、窗口控制按钮位置）？
