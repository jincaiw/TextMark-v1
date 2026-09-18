# TextMark 桌面 UI 对标实施方案与计划

- **项目**：TextMark-v1
- **参照应用**：本机 `/Applications/Markdown Preview.app`
- **参照版本**：Markdown Preview `0.0.58`，Build `62`
- **TextMark 基线**：当前已发布能力 `v0.9.8`；对标结论基于此前 `v0.9.7` 代码审查、`v0.9.8` 实施结果及本机 UI 调研
- **文档版本**：实施方案 `v1.0`
- **编制日期**：2026-09-18
- **当前状态**：待用户确认，确认前不修改业务代码、不修改发布配置

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
- 左侧默认工作区：Files、Search、Bookmarks；
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
| U03 | 左侧栏 | 文件/搜索/书签工作区 | 文件导航与大纲关系较紧 | 引入统一工作区切换 | P0/P1 |
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
| F03 | 书签 | 左侧独立工作区 | 不突出或未形成独立面板 | 先实现文档/位置级书签模型 | P1 |
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
   - 中央区域：`minmax(0, 1fr)`；
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
文件
搜索
书签
大纲
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
9. 书签先采用本地文档/位置级模型，不引入云同步。

### 主要代码落点

```text
src/components/Sidebar.tsx
src/components/Inspector.tsx
src/components/Outline.tsx
src/components/FindBar.tsx
src/components/Search*
src/components/Bookmarks*
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

- 文件、搜索、书签、大纲面板职责清晰；
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
4. 是否采用“左侧文件/搜索/书签/大纲，右侧大纲/属性/标签/出链/反向链接”的工作区结构；
5. 是否将 `rch64.dmg` 统一解释为 `arm64.dmg`，构建 target 使用 `aarch64-apple-darwin`；
6. 是否在 P4 增加项目主页、GitHub Releases 和 Issues 三个菜单入口。

**当前文档状态：待确认。确认后进入 P0，实施过程中按本计划自动化推进、持续验证并在每个阶段完成后汇报结果。**
