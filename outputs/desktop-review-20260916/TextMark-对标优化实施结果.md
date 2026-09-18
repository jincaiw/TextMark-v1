# TextMark 桌面对标优化 · 实施结果

- 分支：`optimize/v0.9.7-parity` → `main`
- 基线：`v0.9.7`（a835794），参照 `pluk-inc/markdown-preview v0.0.58`
- 发布版本：`v0.9.8`
- 日期：2026-09-16 起，2026-09-18 完成上游 main 对标、watcher 原子保存兼容与运行时验证；2026-09-17 完成版本准备与发布前门禁
- 本轮 watcher 验证包已重建，源二进制与 `/tmp/TextMarkVerify.app` hash 一致；尝试双实例启动时，LaunchServices 进程可见，但直接执行路径受 macOS sandbox extension 限制，未取得可靠的双窗口 UI 证据；测试进程已清理
- 状态：A+B（B00–B10）前端与 Rust 全部门禁已通过；本轮追加 B15（`.mdx` 支持与 `==highlight==`）并完成定向测试；版本源已统一至 0.9.8，发布前完整门禁已通过。watcher 代码已修正为按窗口保存、按目录监听以兼容原子替换，但桌面双窗口 B→B 仍未取得闭环运行时证据

## 一、验证结果

| 项目 | 命令 | 结果 |
| --- | --- | --- |
| 类型检查 | `tsc --noEmit` | 通过（v0.9.8） |
| 单元测试 | `vitest run` | 39 个文件 / 333 项全部通过 |
| 生产构建 | `npm run build` | 通过（v0.9.8） |
| Lint | `eslint .` | 通过（无输出） |
| 格式 | `npm run format:check` | 通过 |
| Rust 格式 | `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | 通过 |
| Rust 编译/测试 | `cargo test --manifest-path src-tauri/Cargo.toml --all-targets` | 14 passed / 0 failed |
| npm 生产依赖审计 | `npm audit --omit=dev --audit-level=high` | 0 vulnerabilities |
| Rust 依赖审计 | `cd src-tauri && cargo audit` | 中高风险漏洞 0；7 条既有 unmaintained/unsound 警告 |
| Rust TLS 修复 | `cargo update -p rustls --precise 0.23.45` | `rustls` 0.23.43 → 0.23.45，`rustls-webpki` 0.103.13 → 0.103.15 |
| 桌面打包 | `npm run build` + `tauri build --debug --no-bundle` | 通过，最新产物 47,459,976 字节 |
| 产物校验 | `shasum -a 256` | `e826fede3615a15f1f44755adce5eea0d07fac11bca9102b90aa7af35b0f1d87`（源与 `.app` 内两份一致） |
| 桌面启动 | `open -n /tmp/TextMarkVerify.app` | 进程存活（pid 31543），`lsappinfo` 显示 bundle `/private/tmp/TextMarkVerify.app`、`type="Foreground"`、`Version="0.9.7"`、launch→checkin 0.326s |
| 桌面渲染 | `textmark --thumbnail README.md out.png` | 输出 `PNG image data, 512 x 512`，内容为 README 正文 |
| 产物含修复校验 | `grep` 检查 `dist/assets/*` | `.editor-pane .cm-theme{height:100%}` 存在；旧窗口事件 `textmark-preview-hydrated` 已消失；`onInitialPositionApplied` 存在于 main / EditorPane 两个 chunk |
| 浏览器实测 | agent-browser + Vite dev (127.0.0.1:5199) | 见第四、五节 |

依赖安装此前连续两次因 npm Arborist 报错 `Cannot read properties of null (reading 'edgesOut')` 失败，
改用 `npm install --legacy-peer-deps` 后成功；安装副作用改动了 `package-lock.json`，已还原。

### 工具链与环境说明

- 本机 `cargo` 位于 `~/.cargo/bin`（1.96.1），不在默认 `PATH` 中，脚本内需显式 `export PATH="$HOME/.cargo/bin:$PATH"`。
- macOS 打包需加 `--no-bundle`：`bundle.macOS.files.PlugIns/TextMarkQuickLook.appex` 指向未构建的产物，
  常规打包会因 `does not exist` 失败。该字段被 `src/platform-packaging.test.ts` 断言存在，因此不动配置，
  改用 `--no-bundle`；产出的可执行文件用最小 `.app` 包装器（`/tmp/TextMarkVerify.app`）启动。
- `open --args <file>` 不会把参数透传给进程（经 LaunchServices 启动时参数丢失），
  验证启动参数需直接执行二进制文件。

## 一之二、B00–B14 任务账本（对齐方案第 7 节权威清单）

方案第 7.1 节建议「本轮只批准 A+B 为必做范围」（A＝B00→B01/B02/B03→B04，B＝B06/B07/B08/B09/B10），
C（B11/B12）按组件逐项确认、D（B13/B14）另批。本轮实际推进与状态如下：

| 编号 | 优先级／规模 | 本轮状态 | 主要落地位置 | 证据等级 |
| --- | --- | --- | --- | --- |
| B00 | P0／S | **完成** | 分支 `optimize/v0.9.7-parity`（自 `v0.9.7`／a835794），版本源已核对 | 分支与版本一致 |
| B01 | P0／L | **已实施**，部分运行时验证 | `src/hooks/useDocument.ts`、`src/App.tsx`、`src/components/UnsavedCloseDialog.tsx` | 交互单测覆盖三按钮回调与无路径置灰；浏览器端脏文档流程可用；双 dirty 标签逐一处理未做人工遍历 |
| B02 | P0／L | **已实施**，菜单运行时通过；watcher 待闭环 | `src-tauri/src/lib.rs` | 菜单已人工确认按焦点窗口定向；watcher 以窗口 label 保存、窗口销毁 remove，目录监听兼容原子保存；Rust 14/14 通过，但本轮桌面 B→B 未取得可靠更新证据（第七节 1、2） |
| B03 | P0／M | **已实施**，单测覆盖 | `src/lib/export.ts`、`src/lib/export.test.ts` | 解包 `mark` 而非删正文；搜索开／关导出正文一致 |
| B04 | P0／L | **已实施**，实测通过 | `src/App.tsx`、`src/lib/previewHydration.ts`、`src/components/PreviewPane.tsx` | 阅读／编辑态导出逐字节一致；导出后模式、滚动、光标不变；打印媒体下正文保留、chrome 隐藏（第三轮实测） |
| B05 | P1／M | **已实施**，源码级 | `platform/macos/quicklook/PreviewViewController.swift`、`src/lib/markdown.ts` | appex 未构建，未实机验证（第七节 3） |
| B06 | P1／M | **已实施**，实测通过 | `src/components/PanelResizer.tsx`、`src/App.css`、`src/lib/settings.ts` | 拖动 260→358px；键盘 338px、`aria-valuenow` 同步；宽度持久化 |
| B07 | P1／M | **已实施**，实测通过 | `src/components/Sidebar.tsx`、`src/types/index.ts`、`src/lib/markdown.ts`、`src/components/EditorPane.tsx` | 折叠后可见行 6→1、`aria-expanded` 翻转；编辑态点击跳源码行 |
| B08 | P1／L | **已实施**，实测通过 | `src/lib/search.ts`、`src/components/FindBar.tsx`、`src/components/EditorPane.tsx`（D1／D2 修复） | 计数「第 1 项，共 3 项」、环绕替换、**一次撤销完全还原全部替换**（第三轮实测） |
| B09 | P1／M | **已实施**，实测通过 | `src/lib/readingPosition.ts`、`src/App.tsx`、`src/components/EditorPane.tsx`、`src/App.css`（D5／D6／D7 修复） | 去程 1200px→1491px；回程 2236px／`Line 31`；往返收敛 |
| B10 | P1／M | **已实施**，实测通过 | `src/components/AppearanceSettings.tsx`、`src/components/ToolbarCustomizer.tsx`、`src/lib/designTokens.ts`、`src/lib/settings.ts` | 行高／边距改 2／72 → 预览与编辑器 30px／72px；reload 后持久化；v6→v7 迁移回填默认 |
| B11 | P2／L | **未做**（C 批） | — | 本轮工作树无对应改动 |
| B12 | P2／L | **未做**（C 批） | — | `src/lib/llmHandoff.ts` 为既有功能，本轮未改 |
| B13 | P2／L | **未做**（D 批） | — | 跨平台 PDF 探针未实施 |
| B14 | P2／L | **未做**（D 批） | — | 会话／草稿恢复未实施 |
| B15 | P1／S | **完成** | `src/constants.ts`、`src/hooks/useDocument.ts`、`src-tauri/src/lib.rs`、`src/lib/markdown.ts`、`src/App.css`、Markdown 回归测试 | `.mdx` 进入浏览器/Tauri/CLI 文档识别闭环；`==highlight==` 阅读渲染与样式完成；不执行 JSX；定向测试通过 |

账本口径说明：

- **A+B 必做范围（B00–B10）全部落地**，其中 B04、B06、B07、B08、B09、B10 取得真实运行证据；
  B01 有交互单测，B02 的菜单定向取得人工运行证据，但 watcher 双窗口仍未闭环，B05 仍为编译期／源码级证据（受本机权限与打包条件限制）。
- **C／D 批（B11–B14）按方案建议未启动**，工作树中无对应改动；B15 是本轮追加的独立 P1/S 对标项，不改变 C/D 边界。
- 账本外另做了两项清单未列、但同属 P1 的小改动：文档标签键盘导航（`DocumentTabs.tsx`，左右／Home／End）
  与文件树 `aria-expanded`／`aria-level`（`Sidebar.tsx`）。

## 二、P0 可靠性

| 编号 | 内容 | 落地位置 | 状态 |
| --- | --- | --- | --- |
| P0-1 | 菜单事件定向到焦点窗口，无焦点窗口时退回广播 | `src-tauri/src/lib.rs` | 已改，编译通过；双窗口人工验收通过 |
| P0-2 | 文件 watcher 按窗口隔离，窗口销毁时清理 | `src-tauri/src/lib.rs` | 已改，按窗口 label 保存并在销毁时 remove；目录监听兼容原子保存；B→B 运行时证据仍不足 |
| P0-3 | 脏文档导航、前进／后退离开确认 | `src/hooks/useDocument.ts` | 已改 |
| P0-4 | 原生窗口关闭拦截未保存文档，提供存储并关闭／放弃／取消 | `src/App.tsx`、`src/components/UnsavedCloseDialog.tsx` | 已改，交互单测覆盖 |
| P0-5 | 搜索高亮导出时保留正文（解包而非删除） | `src/lib/export.ts` | 已改，单测覆盖 |
| P0-6 | 编辑态导出／打印先切预览再执行，结束后恢复 | `src/App.tsx` | 已改 |
| P0-7 | Quick Look 不再抢 Finder 键盘焦点 | `platform/macos/quicklook/PreviewViewController.swift` | 已改，源码级确认；appex 未构建，未实机验证 |

## 三、P1 布局与导航

| 编号 | 内容 | 落地位置 | 状态 |
| --- | --- | --- | --- |
| P1-1 | 侧栏／Inspector 可拖动、可调宽、可持久化 | `src/components/PanelResizer.tsx`、`src/App.tsx`、`src/App.css` | 已改，浏览器实测通过 |
| P1-2 | 大纲真实折叠（含展开控件、ARIA、子项隐藏） | `src/components/Sidebar.tsx`、`src/App.css` | 已改，浏览器实测通过 |
| P1-3 | 大纲带源码行号，编辑态点击跳源码行 | `src/types/index.ts`、`src/lib/markdown.ts`、`src/components/EditorPane.tsx`、`src/App.tsx` | 已改，单测覆盖 |
| P1-4 | 查找栏增加替换／全部替换 | `src/components/FindBar.tsx`、`src/components/EditorPane.tsx`、`src/lib/i18n.ts` | 已改，**浏览器实测发现两处缺陷并修复**，见第五节 |
| P1-5 | 标签页键盘导航（左右／Home／End） | `src/components/DocumentTabs.tsx` | 已改 |
| P1-6 | 文件树目录 `aria-expanded`、`aria-level` | `src/components/Sidebar.tsx` | 已改 |
| P1-7 | 双向读写切换按标题锚点还原位置 | `src/lib/readingPosition.ts`、`src/App.tsx`、`src/components/EditorPane.tsx`、`src/App.css` | 已改，单测覆盖；**运行时一度完全失效，第二轮实测定位并修复（见 D5／D6），修复后双向收敛** |

## 四、浏览器端实测记录

在 `vite dev`（`127.0.0.1:5199`）上用 CDP 驱动 Chromium 逐项操作，均为真实交互后读取 DOM 状态所得：

| 验证项 | 操作 | 实测结果 |
| --- | --- | --- |
| 侧栏调宽 | 拖动分隔器 | 260px → 358px |
| 侧栏键盘调宽 | 聚焦分隔器后 `Shift+ArrowLeft` | 358px → 338px，`aria-valuenow` 同步 |
| 大纲折叠 | 点击展开控件 | 可见行 6 → 1，`aria-expanded` 由 true → false |
| 查找栏 | 打开查找 | 渲染出「查找」「替换为」输入框与「替换」「全部替换」按钮 |
| 编辑模式 | `Cmd+E` | `.app-shell` 含 `mode-edit`，`.cm-content` 存在 |
| 替换（单次） | 输出下方第五节 |
| 全部替换 | 点击「全部替换」 | `TextMark` 归零、`TMark` 3 处，提示「已替换 2 项」，计数标签转为「未找到」 |
| 行高／左右页边距 | 设置内改 2 / 72 | token `2 / 72px / 32px 72px 48px / 30px`，预览与编辑器行高均 30px、左内边距 72px；reload 后持久化 |
| 默认排版 token | 不改设置读 DOM | `1.52 / 40px / 32px 40px 48px / 22.8px`，与上游冻结值一致 |
| 旧配置迁移 | 只存 v6 的 profile 启动 | 迁移到 v7 并回填默认，保留 dark / serif / 18 |
| 编辑态导出 HTML | 编辑态点「导出 HTML…」 | `.markdown-body` 含渲染 SVG、无 Mermaid 源码，导出后回到 `mode-edit` |
| 导出正文一致性 | 阅读态 vs 编辑态各导出一次 | 归一化 Mermaid 实例 id 后 sha256 相同（见 D4） |
| 读写位置交接（去程） | 编辑态滚到 1200px → 阅读态 | 阅读态 `scrollTop 1491`（修复前恒为顶部 32） |
| 读写位置交接（回程） | 阅读态 → 编辑态 | `scrollTop 2236`、光标 `Line 31, column 1`，再往返一次完全一致 |
| 导出后不打扰 | 编辑态（2236 / Line 31）导出 HTML | 模式、`scrollTop`、光标全部不变 |

## 五、本轮实测发现并修复的缺陷

这两个缺陷是**只能在真实运行中暴露**的：静态阅读代码时两处逻辑都「看起来对」。

### D1 · 编辑态查找计数恒为「未找到」，导致上一处／下一处不可用

- 现象：切到编辑态后输入查找词，计数标签显示「未找到」，两个导航按钮因 `disabled={!props.count}` 被禁用。
- 根因：匹配计数只由 `PreviewPane` 通过 `onSearchCount` 上报，而编辑态下 `PreviewPane` 已卸载 → 计数恒为 0；
  `editorRef.current.find()` 从未被 `App` 调用，编辑态的查找栏与编辑器实际上没有连线。
- 修复：把查找状态（`searchQuery` / `searchIndex` / `matchCase` / `searchMode`）同时传给 `EditorPane`，
  由编辑器用源码计算匹配数并上报，并按 `searchIndex` 定位到第 N 个匹配（只改选区不抢焦点，避免打断输入）。

### D2 · 「替换」在光标不在匹配处时静默失败

- 现象：输入 `TextMark` → 替换为 `TMark` → 点「替换」，源码无任何变化，也没有任何提示。
- 根因：单次替换用 `source.indexOf(query, selection.to)` 从光标之后查找；光标在文末（或任何匹配之后）时返回 −1，
  函数直接 `return 0`，调用方 `if (replaced)` 不成立，于是完全静默。
- 修复：改为按匹配偏移量取「光标处或之后的第一个匹配」，越界则环绕回文首——与已有 `find()` 的环绕语义一致。

### 修复后的实测证据

| 步骤 | 修复前 | 修复后 |
| --- | --- | --- |
| 编辑态输入 `TextMark` | 计数「未找到」、导航按钮禁用 | 计数「第 1 项，共 3 项」、按钮可用 |
| 点「下一处」 | 无反应 | 计数转「第 2 项」，编辑器渲染出匹配选区（`.cm-selectionBackground` 1 个） |
| 光标置于文末，点「替换」 | 2 处 `TextMark` 不变，无提示 | 2 → 1，`TMark` 0 → 1，提示「已替换 1 项」 |
| 点「全部替换」 | — | 提示「已替换 2 项」，`TextMark` 归零、`TMark` 3 处 |

### 相应代码与测试

- 新增 `src/lib/search.ts`：匹配核心（`buildSearchPattern` / `searchMatchOffsets` / `orderedMatchesFrom` /
  `selectionMatches` / `replaceAllMatches`），把「编辑态按源码匹配」与「预览态按渲染文本匹配」收敛到同一套语义，
  避免两处各自实现 `beginsWith` 的 `\b` 前缀而产生漂移。
- 新增 `src/lib/search.test.ts`：13 项，覆盖大小写、`beginsWith` 词边界、正则字面量、空查询、环绕顺序、全量替换。
- `src/components/EditorPane.tsx`：`replace` 签名改为 `(query, replacement, { matchCase, all, mode })`；
  新增查找状态 props、计数 effect 与定位 effect。
- `src/components/PreviewPane.tsx`：改用共享的 `buildSearchPattern`，删除本地重复的 `escapeRegExp`。
- `src/components/components.test.tsx`：新增关闭对话框交互用例（点击三个按钮断言回调、无路径时「存储并关闭」置灰），
  补上原先只有静态 HTML 断言、没有点击断言的缺口。

## 五之二、第二轮实测发现并修复的缺陷（D3–D6）

第二轮专门验收 B04「阅读／编辑态导出同一草稿一致；导出后模式、光标、滚动不变」，
结果在这条链上又挖出四个缺陷，全部为**真实运行暴露、静态读代码看不出来**类。

### D3 · 编辑态导出完成后停在预览态

- 现象：编辑态点「导出 HTML」，导出结束后界面停在 `mode-preview`，`.cm-content` 消失，用户被丢在阅读态。
- 根因：`switchViewMode` 的 `if (mode === viewMode) return` 读的是**渲染期闭包快照**。导出流程在同一个闭包里
  先切到 preview、再切回 edit，此时快照仍是 `'edit'`，回程判断直接 return。同一根因同时影响打印与导出 PDF。
- 修复：改为实时 ref（`viewModeRef.current`）判断。
- 实测：导出后回到 `mode-edit`、`.cm-content` 存在。

### D4 · 编辑态导出丢 Mermaid 渲染结果（导出正文不一致）

- 现象：阅读态导出的正文含渲染后的 SVG（`bodyLen 21216`），编辑态导出只剩 Mermaid **源码**
  （`bodyLen 4865`，正文里出现 `Diagram Code const platforms = [...]`），两侧导出内容不一致。
- 根因（两处叠加）：
  1. `waitForPreviewHydration` 第一句 `if (hydratedPreviewKeyRef.current === key) return`。`previewRenderKey`
     由「文档 id : 路径 : 渲染后 HTML」构成，**在编辑态与阅读态之间是不变的**；而 `PreviewPane` 只在
     `viewMode !== 'edit'` 时挂载。只要本次会话进过一次阅读态，ref 就等于该 key，于是从编辑态导出时等待被
     **立刻短路**，克隆到的是刚挂载、图表还没渲染的 DOM。
  2. `PreviewPane` 那个大 `useLayoutEffect` 的依赖里含 `props.onHydrated`，而它是 App 的内联函数，
     **每次父组件渲染都是新引用** → 每次渲染都 cleanup（`cancelled = true`，丢弃正在进行的 `mermaid.render`
     结果）并重跑整段 morphdom，把「刚挂载就被打断」放大成常态。
- 修复：
  1. 把水合语义收敛为可测模块 `src/lib/previewHydration.ts`：门禁只回答「**当前在场**的面板是否为该 render key
     报告过就绪」，并在进入／离开阅读态的两个边界上都失效（替换原先散落在 App 里的一个 ref + 窗口事件）。
     该模块同时把「挂载即未就绪」设为显式语义，并保留 8 秒兜底超时。
  2. `PreviewPane` 通过 ref 读取 `onHydrated`（并移出依赖），父组件重渲染不再打断图表渲染。
  3. 输出动作的水合监听改为**在切换到预览之前**挂上（新增 `beginPreviewOutput`），并在同一个 helper 里合并了
     原先三处重复的「切预览 → 等一帧 → 等水合」；否则模块缓存已热时 Mermaid 可能在一帧内完成，监听挂晚了
     会错过事件、白等 8 秒超时。
- 实测：阅读态与编辑态导出的 HTML **归一化 Mermaid 实例 id 后逐字节一致**（sha256 同为
  `0cd87ea8fc8c2d35fb7a25908c01b711eace1c46206d2d49e0eda1da72d71e7a`，1567755 字符，`<svg` 存在、
  无 `Diagram Code` 源码泄漏）；PDF 路径上两份导出除 `CreationDate` 与 `/ID` 外逐字节相同。

### D5 · 编辑器从不使用自己的滚动容器，位置读取全为 0

- 现象：编辑态把源码滚到中部后切到阅读态，阅读态**永远落在顶部**（实测 `scrollTop 32`）。
- 根因：`@uiw/react-codemirror` 在 `.editor-page` 与 `.cm-editor` 之间插入了一个 `div.cm-theme` 包装层，
  该层**没有高度**（实测 3109.69px，而 `.editor-page` 是 481px）→ `height: 100%` 链断裂 →`.cm-editor`
  长到内容高度，真正滚动的是外层 `.editor-pane`，CodeMirror 自己的 `.cm-scroller` `scrollTop` 恒为 0。
  于是 `getTopLine()` 恒返回第 1 行、`getScrollFraction()` 恒返回 0，**编辑→阅读的位置交接事实上是死代码**；
  同时 `scrollHeight == clientHeight`，CM 的视口虚拟化被关闭（长文档整篇常驻渲染）。
- 修复：`src/App.css` 补 `.editor-pane .cm-theme { height: 100% }`。
- 实测：`.cm-theme` 3109.69px → 481px，滚动容器转移到 `.cm-scroller`（3110 / 481）；
  编辑态滚到 1200px 后切阅读态，阅读态落在 **1491px**（修复前恒为顶部 32px）。

### D6 · 待恢复的阅读位置在编辑器挂载前被清空

- 现象：D5 修复后，阅读态 → 编辑态的回程仍在顶部（`scrollTop 0`，光标 `Line 1`）。
- 根因：App 用「下一拍就清空」的 effect 清 `pendingEditorLine` / `pendingScrollFraction`，
  但 `EditorPane` 是 `lazy` 挂载（跨 Suspense 边界，mount 晚于该 effect）。对照预览侧——
  `PreviewPane` 是静态导入、与模式切换同一个 commit 挂载，所以**只有编辑侧失效**。
  同一个文件里，`initialFormat` / `onInitialFormatApplied` 早已为这个问题立过模式。
- 修复：新增 `onInitialPositionApplied`，由编辑器在真正应用位置后回报，App 据此清空待恢复值；
  同时把原先「行」与「滚动比例」两个各自为政的 effect 合并为一个（优先级显式：能用的源码行优先，
  否则退回滚动比例），并把光标随视口一起落到目标行——否则会出现「视口在文档中部、光标孤立在第 1 行」。
- 实测：编辑态 1200px → 阅读态 1491px → 编辑态 `scrollTop 2236`、光标 `Line 31, column 1`，再往返一次结果完全一致（收敛）。

### D7 · 光标行内位置随模式切换丢失（D6 的延伸）

- 现象：模式往返或导出后，光标回到「目标行的第 1 列」，行内的行／列位置丢失。
- 根因：光标属于编辑器自身状态，而编辑器每次模式切换都重新挂载；`App` 侧虽有 `cursor` 状态，
  却没有纳入交接，恢复只讨论了「视口到哪一行」。
- 处理：把判定抽成纯函数 `caretForReturnToEditor(anchorLine, exit)`：
  - **只在回程锚点行 == 离场时编辑器视口顶行时才逐字还原**（说明读者没有移动）；
  - 锚点变了则**让阅读位置胜出**，光标落到锚点行第 1 列——读者确实读过别处，期待光标跟过去。
  两条语义互斥且都符合直觉，不必引入「相近阈值」之类的启发式判断。
- 实测：编辑态 `Line 26, column 2` → 模式往返 → `Line 26, column 2`（逐字一致）；
  导出 HTML 后同样 `Line 26, column 2`；把阅读态滚到 809px 再回编辑态 → `Line 29, column 1`（锚点胜出）。

### 相应代码与测试

- 新增 `src/lib/previewHydration.ts` + `src/lib/previewHydration.test.ts`（6 项）：其中一项专门断言
  「面板离开后，它先前的报告不得再满足等待」，即 D4 的回归守卫。
- `src/App.tsx`：新增 `beginPreviewOutput`；`waitForPreviewHydration` 改由门禁模块提供；
  `clearPendingEditorPosition` 取代原先两个「下一拍清空」effect。
- `src/components/PreviewPane.tsx`：`onHydrated` 走 ref，移出 effect 依赖。
- `src/components/EditorPane.tsx`：`onInitialPositionApplied` 回报；位置恢复 effect 合并；
  光标随视口落到目标行。
- `src/App.css`：`.editor-pane .cm-theme { height: 100% }`。

### B04 验收实测汇总

| 验收项 | 修复前 | 修复后 |
| --- | --- | --- |
| 阅读／编辑态导出正文一致 | 编辑态导出丢图表（`bodyLen 4865` vs `21216`） | 归一化实例 id 后逐字节一致 |
| 导出后模式不变 | 停在 `mode-preview` | `mode-edit` |
| 导出后滚动不变 | 滚动与光标一起被重置 | `scrollTop 2236` → `2236` |
| 导出后光标不变 | `Line 25` → `Line 1` | `Line 26, column 2` → 逐字一致 |
| 「读者移动过」的情形 | — | 阅读态滚到 809px 后回编辑态 → `Line 29, column 1`（阅读锚点胜出，不还原旧光标） |

## 五之三、第三轮实测发现与验证（D8 · 打印路径 · 撤销语义）

第三轮专攻「能拿到真证据但前两轮没做」的三项：打印路径的运行时行为、打印样式的完整性、B08 的撤销语义。

### D8 · 打印时文档标签栏未被隐藏

- 现象：`@media print` 的隐藏列表只覆盖 `.native-toolbar`／`.native-sidebar`／`.inspector-panel`／
  `.formatting-toolbar`／`.find-bar`／`.toast`，**漏了 `.document-tabs`**。
- 条件性：标签栏仅在 `sessions.length >= 2` 时渲染，因此单文档场景下不出现——这也是它前两轮一直没被看见的原因。
- 修复：`src/App.css` 的打印隐藏列表补入 `.document-tabs`。
- 实测（本轮新增，真实运行证据）：用 CDP `Emulation.setEmulatedMedia` 把媒体切到 `print` 后读 `computed display`，
  再切回 `screen` 复读，两个文档已打开（`.document-tabs` 在场）：

| 元素 | print 媒体 | screen 媒体 |
| --- | --- | --- |
| `.markdown-body`（正文） | `block` — **保留** | `block` |
| `.document-tabs`（标签栏） | `none` — **已隐藏** | `flex` |
| `.native-toolbar` | `none` | `flex` |
| `.native-sidebar` | `none` | `grid` |
| `.formatting-toolbar` | `none` | `flex` |

即：正文保留、全部 chrome 隐藏，B04「不打印工具栏／标签」这条验收项现在是**运行时成立**的，不再只是代码级判断。

### 打印路径的运行时验证

系统打印面板无法自动化，改用「替换 `window.print` 为探针 + 走真实 UI 入口」的办法，从编辑态经
`details.more-menu` 的「打印」项触发，读取打印瞬间的 DOM 快照：

| 观察点 | 打印瞬间 | 打印结束后 |
| --- | --- | --- |
| 应用模式 | `mode-preview`（先切预览再打印，符合 B04 设计） | 回到 `mode-edit` |
| Mermaid 渲染 | `mermaidRendered: 1`（图表已渲染，非源码） | — |
| 正文长度 | `bodyLen 21296` | — |
| `data-export-pdf` | 打印流程置位 | 还原为 `null` |
| 编辑器 | — | `.cm-content` 存在 |

即 D3 的修复在 print 路径上同样生效：打印不会把用户留在预览态，也不会清掉编辑器。

### B08 · 一次撤销可还原全部替换

- 验收标准原文：「一次撤销可还原全部替换」。
- 实测：编辑态执行「全部替换」（`TextMark` → `TMark`）后，聚焦 `.cm-content` 按**一次** `Meta+Z`，
  再切到阅读态读 `.markdown-body.textContent` 全文计数：`{"textmark": 3, "tmark": 0}` —— 全部还原。
- 原理：批量替换走**单个 CodeMirror 事务**
  （`view.dispatch({ changes: { from: 0, to: source.length, insert: outcome.contents } })`），
  因此撤销栈上只有一步；不需要额外把「全部替换」包成原子操作。

### 第三轮重建后的产物校验

本轮改动落在 `src/constants.ts`、`src/hooks/useDocument.ts`、`src-tauri/src/lib.rs`、`src/lib/markdown.ts` 与 `src/App.css`，按约定重新执行 `npm run build`、`tauri build --debug --no-bundle` 并重装：

- 本轮最新 sha256 `e826fede3615a15f1f44755adce5eea0d07fac11bca9102b90aa7af35b0f1d87`（源与 `.app` 内两份一致）。
- 产物内校验：`.document-tabs` 出现在 `main-*.css` 的 `@media print` 隐藏选择器串中；
  `.cm-theme{height:100%}`、`textmark_highlight` 与 `.mdx` 均进入 `main-*.js/css`；`initialCursor` 仍存在于 main／EditorPane 两个 chunk。
- 启动新实例 pid 15113，`type="Foreground"`、`Version="0.9.7"`。

> 环境坑：对 47MB 的 debug 二进制做 `cmp` 源／目标校验会被沙箱以 SIGKILL 终止（exit 137），
> 改用 `shasum -a 256` 分别计算比对即可，结论等价。

## 六、关键技术决策

1. **大纲行号不能直接用 `token.map`**：文档在渲染前会做数学归一化（`$$…$$`、LaTeX 分隔符转换），
   归一化后的行号会漂移。实测 `'$$\nx^2\n$$\n\n## Diagram'` 中 `token.map` 给出第 3 行，真实源码行是第 5 行。
   因此改为渲染后用 `anchorOutlineToSource()` 按标题文本回锚原始源码，同时支持 ATX 与 Setext 标题。
2. **读写切换用标题锚点而非像素比例**：新增 `readingPosition.ts`，把阅读位置表达为
   「在第 N 个标题块内，向第 N+1 个块前进了多少」，再换算成源码行；无标题时退回滚动比例。
3. **编辑态导出采用临时切换到预览**：保证导出拿到的是完整渲染树，并在 `finally` 中恢复原模式。
4. **读写切换双向对称**：预览→编辑用「标题块 + 块内进度」换算源码行；编辑→预览用
   `EditorView.lineBlockAtHeight` 取视口顶行，在下一帧把源码行换算成预览滚动偏移
   （预览尚未挂载，必须等一帧）。两侧都保留了无标题时退回滚动比例的兜底。
5. **关闭保护用自绘对话框替代 `window.confirm`**：原生 `confirm` 只有「确定／取消」，
   无法提供保存。新建 `UnsavedCloseDialog` 提供存储并关闭／放弃／取消，并用 `documentsRef`
   让关闭事件订阅保持稳定依赖。
6. **查找语义单一来源**：匹配规则只在 `src/lib/search.ts` 定义一次，编辑态与预览态共用，
   防止「计数说 3 处、替换只改到 2 处」这类两侧漂移。
7. **菜单定向不用 `get_focused_window()`**：该方法被 `#[cfg(feature = "unstable")]` 门控，
   改为 `app.webview_windows().into_values().find(|w| w.is_focused().unwrap_or(false))`，
   无焦点窗口时回退 `app.emit`，行为在稳定特性集下即可用。

## 六之二、本轮上游 main 对标补齐（B15）

已核实上游 `pluk-inc/markdown-preview`：正式 release 仍为 `v0.0.58`（2026-09-15），默认分支 `main` 已推进到 `5a89a47d71cd01b9c657234865f4c368425dd6ac`（2026-09-16，`Fix search highlighting and navigation in edit mode (#404)`）。本轮未把开发分支未发布代码冒充 release，但将已明确、低风险且不执行 JSX 的语法差异直接补齐：

- `.mdx`：加入 `MARKDOWN_EXTENSIONS`、浏览器 `<input accept>`、Tauri 原生 `is_markdown`，覆盖桌面启动、文件选择器和 CLI 路径；读取内容仍走 Markdown 文本渲染，不编译或执行 JSX。
- `==highlight==`：在 MarkdownIt inline 规则中加入保守的 `==...==` → `<mark>...</mark>` 转换；代码 span 保持字面量，未闭合标记保持普通文本；增加主题样式和 parity 回归测试。
- watcher 收口：目录监听下同目录原子保存事件现在会触发一次“可能影响当前文档”的延迟重读，再由 revision 比较抑制无变化更新；新增 `eventMayAffectDocument` 与 3 项测试。该修复提高了 B→B 兼容原子替换的机会，但仍不把未完成的双窗口桌面闭环写成通过。
- 高频交互收口：标签页关闭现在先显示 `UnsavedCloseDialog`，支持存储并关闭、放弃、取消；无路径 dirty 文档禁止“存储并关闭”；保存成功后才关闭。原生窗口关闭路径保持不变。
- 历史导航也已升级为同一三按钮保护：前进/后退遇到 dirty 文档时先等待存储、放弃或取消；保存失败/冲突或取消不会改变历史；放弃或保存成功后才执行导航。组件测试 13 项、TypeScript、ESLint、格式检查和 `git diff --check` 通过。
- 验证：定向 Markdown 测试 75 项、watcher 测试 8 项、完整 Vitest 39 文件 / 333 项、TypeScript、ESLint、格式检查、Rust fmt 与 14 项 Rust 测试均通过。

## 七、需要关注的问题

1. **多窗口菜单定向已取得运行时证据**：Rust 实现按 `webview_windows()` 查找当前聚焦窗口，
   找到时只向该窗口 emit，全部失焦时才回退 app-wide 广播；用户人工确认窗口 A/B 操作均未串窗，
   `cargo test --all-targets`（14/14）与编译通过。
2. **watcher 双窗口仍未闭环**：`WatchState` 以窗口 label 保存 watcher，`WindowEvent::Destroyed` 按同一 label remove；
   目录监听已恢复为兼容原子替换的实现，临时 `/tmp` 诊断日志也已删除。源码、Rust 14/14 测试、最终构建均通过，
   但桌面双窗口复测中 B→B 未取得可靠更新证据，不能宣称 watcher 隔离已完成。验证期间曾发现未重新构建前端嵌入资源会产生空白窗口，
   已通过重新执行 `tauri build --debug --no-bundle` 排除旧二进制混淆；临时文件仍为 `Downloads/TextMark-watcher-A.md` 与 `Downloads/TextMark-watcher-B.md`，未删除。
3. **Quick Look 焦点行为未实机验证**：Swift 侧保留 `acceptsFirstResponder` 与 Cmd+A/C 处理，未调用
   `makeFirstResponder(self.webView)`，Finder 方向键路径未被主动拦截；但本机只有 CommandLineTools，
   没有完整 Xcode/Quick Look appex 构建链，无法装载实测，仍属源码级确认。
4. **桌面端截图证据有限**：本轮可枚举 WindowServer 窗口并取得部分窗口截图，但 TextMark 验证窗口在重建／重启期间出现空白，
   且 `screencapture` 对已销毁窗口会返回 `could not create image from window`；因此截图不作为 watcher 成功证据，
   仍以源码、测试、构建 hash 与实际窗口注册证据为准。
5. **布局的全屏桌面视觉已复核，窄窗口仍待确认**：取得真实 TextMark 桌面截图（`/Applications/TextMark.app`，
   `Version 0.9.7`，前台 pid `93567`）。双文档标签栏、左侧栏、编辑/阅读工具栏、查找栏均正常显示，
   全屏宽度下未见明显溢出、遮挡或空白窗口；侧栏分隔器、查找栏替换控件、大纲折叠行在窄窗口下仍需人工缩窄窗口确认。
   当前 dev server 已停止（5199 返回 502），本轮未新增窄宽度浏览器证据，避免把不可复现的静态判断写成实测结论。
6. **人工验收已通过**：用户确认 macOS 原生打印正文正常，工具栏、侧栏、文档标签栏均未进入打印内容；
   双窗口菜单操作分别只影响当前聚焦窗口，未发生串窗。
7. **大纲折叠状态未持久化**：已按文档分别记录（同一标题 id 在不同文档间互不影响），但仅存于会话内。
8. **光标只在「读者没移动」时逐字还原**：`caretForReturnToEditor` 要求回程锚点行 == 离场时视口顶行。
   若读者在阅读态移动过，光标改为跟随阅读位置（列归 1）。这是刻意取舍，不是缺口。
9. **macOS 原生打印面板已人工验收**：D3 的修复已通过真实 Cmd+P 验证，打印正文正常，工具栏、侧栏、文档标签栏未出现；
   打印样式也已用 CDP 模拟 `print` 媒体逐元素量过。
10. **`.cm-scroller` 接管滚动后的连带影响未做窄窗口视觉复核**：D5 让 CodeMirror 恢复自身滚动与视口虚拟化，
   全屏截图未见明显滚动条或留白异常；窄窗口下仍需人工看一眼。
11. **B15 已完成并取得浏览器运行时证据**：Vite 开发版真实进入编辑态、输入 `==对标高亮==`、切回阅读态后，DOM 出现 `<mark>`，无须用户介入；本轮未额外打开真实磁盘 `.mdx` 文件逐项点击验证文件选择器视觉，因此不把该项写成完整原生桌面 UI 证据。
12. **发布边界**：本轮已按用户最新要求进入提交、合并与发布流程；版本源统一为 `0.9.8`。Quick Look appex、watcher 双窗口闭环、窄窗口视觉仍保留各自证据边界，未将源码级或受环境限制的结果写成完整实机通过。
