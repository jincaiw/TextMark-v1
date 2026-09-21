# TextMark 桌面 UI 对标实施方案与计划

- **项目**：TextMark-v1
- **参照应用**：本机 `/Applications/Markdown Preview.app`
- **参照版本**：Markdown Preview `0.0.58`，Build `62`
- **TextMark 基线**：当前已发布能力 `v0.10.2`；对标结论基于此前 `v0.9.7` 代码审查、`v0.9.8` 实施结果及本机 UI 调研
- **文档版本**：实施方案 `v1.0`
- **编制日期**：2026-09-18
- **当前状态**：v0.10.2 已正式发布；P0–P5、B11–B14 代码与当前环境可验证项已完成，剩余为跨平台实机与像素级证据边界

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

**当前文档状态：v0.10.2 已正式发布。P0–P5 桌面 UI、菜单入口、ARM64 DMG 基础能力及顶部区域第一批对齐已落地；B11–B14 代码与当前环境可验证项已完成。剩余为跨平台实机与像素级证据边界，不阻塞本版本发布。**

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

结论：当前代码级发布前门禁已全部通过；工作树仍保持未提交、未推送、未合并、未发布。真实 GitHub Actions 发布、stable/beta updater 线上验证、跨平台 PDF 实机证据、多显示器几何恢复和同尺寸原生窗口像素对齐仍不应由本地门禁结果替代。

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
