# TextMark v0.10.32 跨平台发布验收报告

## 当前结论（2026-09-29，按所有者最新标准）

- Developer ID、公证票据、Gatekeeper 评估不作为发布门槛；未签名或 ad-hoc 签名应用可由用户在“系统设置 → 隐私与安全性”手动允许打开。Windows/Linux 真机测试不执行，也不作为放行条件。
- 已发布 v0.10.31 的 GitHub Release run `36319119058` 全部成功：质量门、macOS Universal/Quick Look、Windows x64/ARM64 安装器和 Explorer 预览、Linux x64/ARM64 DEB/AppImage/RPM/KDE 预览及最终发布均通过。其 macOS 包按 ad-hoc 身份构建，符合上述策略。
- v0.10.32 已提交为 `ad115cb` 并于 2026-09-29 正式发布。GitHub Release run `36506128410` 全部通过，公开 Release 状态为非草稿、非预发布，共发布 36 项资产；安装器矩阵、Quick Look、updater metadata 和完整资产清单检查均成功。
- **当前验收状态：通过并已发布。** 按要求没有进行 Windows/Linux 用户真机测试；发布流水线的 Windows/Linux 托管 CI runner 已完成包构建与安装/预览/卸载自动化烟测。macOS ad-hoc 包和 Quick Look 注册检查通过；不要求 Developer ID、公证或 Gatekeeper 验收，用户可在“系统设置 → 隐私与安全性”手动允许打开。之前章节中的旧门槛结论均为历史记录，由本节和后续标准调整补记覆盖。
- **2026-09-29 上游对照更新：** Markdown Preview 于 2026-09-28 发布 v0.0.63；本报告中基于 v0.0.62 的对照段落是历史记录。v0.0.63 差异及当前未发布工作树的处理状态见 [UPSTREAM_PARITY_v0.10.32_vs_0.0.63.md](../../docs/UPSTREAM_PARITY_v0.10.32_vs_0.0.63.md)。该工作树后续改动不属于已发布的 v0.10.32。

## 结论

**历史严格门槛下的 macOS 验收记录（非当前放行标准）**：官方 v0.10.31 DMG 为 ad-hoc 签名且未公证，`spctl --assess` 曾拒绝该包；该行为现按所有者标准接受，由用户在系统设置手动允许打开。下表保留当时执行过程和证据。

**Windows：未验证。Linux：未验证。** 本报告仅覆盖本机 macOS 27.0 build 26A428 / Apple Silicon。不能据此放行跨平台正式发布。

**缺陷统计：P0 0、P1 2、P2 1、P3 0。** 只读保存缺陷已在工作树修复并通过桌面回归；v0.10.31 已发布包的 Gatekeeper/公证阻断仍不能由工作树修复追溯消除。Rust GUI 依赖另有一项 P2 上游 unsound 警告，详情见工作树复验补记。

## 候选与设备

| 项目 | 记录 |
|---|---|
| 候选 | v0.10.31，commit `13798fe331d8b66bb14c391bd09fe75b898a2591` |
| arm64 DMG | `TextMark_0.10.31_arm64.dmg`，SHA-256 `bd8fe3be43ec415244789e0f2a7fc4c0f4c54fe1d8857189bc2750caf8cdeb23` |
| universal DMG | `TextMark_0.10.31_universal.dmg`，SHA-256 `1854fdd7ddfcdb41c44264a5ee4ab9799d28a804cfbae639329f6e7ed34fa61d` |
| 签名 | `codesign --verify --deep --strict` 通过；身份为 ad-hoc，没有 TeamIdentifier |
| 公证 | app/Quick Look extension 没有 stapled ticket；DMG `spctl` 拒绝；未绕过 Gatekeeper |
| 设备 | Mac mini Mac16,10，Apple M4，arm64，16 GB RAM |
| 系统/屏幕 | macOS 27.0 (26A428)；3840×2160 @60Hz，系统“看起来像”1920×1080 |
| UI | 简体中文，浅色外观，测试前使用拼音输入法（测试期间临时切换 ABC，结束时已切回） |
| 日期 | 2026-09-27，Asia/Shanghai |

安装包的官方 SHA-256 与发布校验文件相符。候选 app bundle 与机器已有安装目录比对一致。安装/启动步骤未实际执行，因为下载 DMG 未通过 Gatekeeper 评估。

## 场景覆盖

| 模块 | 用例 / 操作 | 预期与实际 | 状态 | 证据 |
|---|---|---|---|---|
| 候选身份 | 比对 tag、commit、DMG 哈希及 app bundle | tag/commit/哈希匹配；预装 app 与 universal 候选 bundle/CDHash 一致 | 通过（身份核验） | release assets、SHA256SUMS、本地 `diff -qr` / codesign 记录 |
| 下载安装与首次启动 | 对官方 DMG 做 Gatekeeper 评估；不绕过系统拦截 | app/DMG ad-hoc 签名，无公证票据；`spctl` 拒绝，因此未安装/首次启动候选 DMG | **失败 P1** | 官方 DMG 和 app 的签名/公证核验结果 |
| 多语言/文件路径 | 通过真实打开对话框打开临时夹具；中文、空格、嵌套相对图路径 | 窗口标题、侧栏路径与文档内容正常 | 通过（已测子集） | `/private/var/folders/rd/08pgs8m95832jrvj12f6ktz40000gp/T/textmark-macos-acceptance-v0.10.31/` |
| 预览渲染 | 查看 YAML 元数据、标题、段落、样式、任务清单、表格、引用、代码、KaTeX、Mermaid、相对图片 | 上述内容均在 UI 中有对应渲染；表格边框连续；代码区提供图标复制；Mermaid 控件可访问；含危险属性的 HTML 样例只显示破图占位，没有观察到脚本弹窗 | 通过（已测子集） | 临时目录 `01-editor-fixture.png`、`02-editor-narrow.png`；UI AX 树记录 |
| 编辑模式与窄窗口 | 切换编辑模式，窗口 980×640，检查工具栏及长文本布局 | 工具栏换行到第二行；搜索条控件未重叠/裁切；源码编辑器可显示夹具内容 | 通过（已测子集） | `02-editor-narrow.png`、`03-search-wrap.png` |
| 搜索/替换 | 搜索 `Acceptance`、循环下一项、展开替换、全部替换 3 项后撤销 | 计数为 3，下一项可循环；全部替换反馈“已替换 3 项”；撤销恢复原内容，未保存 | 通过（已测子集） | `03-search-state.png`、`03-search-next.png`、`03-search-wrap.png`；运行时 AX 观察 |
| 只读文件与保存错误 | chmod 只读临时 Markdown；编辑后保存；再在修复构建中重复 | **旧候选**曾把只读文件替换并显示“已保存”；修复后显示明确的只读错误、保留未保存标记且磁盘内容不变 | 修复后通过；旧候选失败 P1 | 临时只读样例哈希前后核对；修复构建 UI 可见错误提示 |
| 多窗口/用户数据 | 只在临时夹具操作；替换后撤销、关闭验收标签 | 未对真实文档执行写操作；夹具与图片哈希与基线一致 | 通过（数据边界） | 下方数据复核 |
| 外观、缩放及主题 | 当前浅色、窄窗口已观察；深色切换动作后系统菜单仍显示“自动” | 深色主题未能通过可见 UI 确认切换；高缩放/全屏/外接显示器未测 | 未验证 |
| 导出、PDF 和打印 | 菜单项已查看；未得到可确认的保存面板/导出文件 | 无法确认输出内容、长文分页、图片/公式/Mermaid 完整性 | 未验证 |
| Finder / Quick Look | 检查签名和 extension plist；未在 Finder Quick Look 中实际预览候选文件 | 包内扩展存在不代表 Launch Services 实际注册或预览通过 | 未验证 |
| 更新/升级/回滚 | 未连接生产更新通道，不执行升级 | 没有候选专用安全更新通道 | 未验证 |
| 数据异常/恢复 | 未模拟磁盘满、崩溃、强制退出、损坏偏好设置、外置卷断开或文件冲突 | 未覆盖 | 未验证 |
| 性能/长时间稳定性 | 未做大文档、多窗口长时间运行或资源采样 | 未覆盖 | 未验证 |
| 安全/权限 | 当前只验证危险 HTML 样例未触发可见脚本执行；未做完整沙箱、越权路径、依赖漏洞和日志审查 | 未覆盖 | 未验证 |
| Windows / Linux | 无实际设备 | 不以 macOS 结果推断其他平台 | 未验证 |

## 缺陷及修复

### P1：只读 Markdown 可被原子保存覆盖

- **复现**：对临时 Markdown 设只读权限，进入编辑模式输入一个字符并保存。
- **旧候选实际**：`write_text_file` 用 `AtomicWriteFile` 创建新文件并原子替换目标。父目录可写时，这会绕过目标文件自己的只读位；UI 显示“已保存”，磁盘内容确实被替换。
- **修复**：保存现有文档前检查目标文件只读权限，并用 `OpenOptions::write(true)` 探测目标本身是否允许写入；即使“强制覆盖”也拒绝越过 OS 只读保护。前端保留 dirty 状态并提示“文件只读；更改尚未保存，可另存为”。
- 同一保护也用于 HTML/PNG/PDF 导出目标；导出时出现明确的目标只读提示，避免导出覆盖只读文件。
- **回归**：新增 Rust 原生测试检查只读文件内容不被替换；在修复构建中重复真实 UI 保存，出现清晰错误且哈希保持基线。测试后撤销内存编辑，临时文件最终哈希为 `9c1ad6b9c308a45699cc72a691b40b86c53bc78b2f81a3ad05d92af9b6cb7c59`。

### P1：发布 DMG 无法通过 Gatekeeper

- **复现**：对 v0.10.31 官方 app/DMG 执行 `codesign --verify --deep --strict`、检查 codesign identity、`spctl --assess` 和 stapler 状态。
- **实际**：仅 ad-hoc 签名；无 Developer ID 团队身份和公证票据；Gatekeeper 拒绝。
- **影响**：普通用户通过下载 DMG 安装/启动的路径不受支持；Quick Look 扩展的持久注册同样不能据此证明。
- **本地修复**：更新 `.github/workflows/release.yml`，要求 Developer ID 证书、签名身份及 Apple 公证凭据齐全；临时 keychain 导入证书；正式构建签名后对两个 DMG 公证并 stapling；包验收强制检查票据、Developer ID、Gatekeeper 和 PlugInKit 注册。临时 keychain 在 job 结束时恢复原有 keychain 搜索列表并删除。`platform/macos/build-quicklook.sh` 仅在普通 CI 允许 ad-hoc 测试构建，正式发布有 Developer ID 身份约束。
- **阻碍/回归**：本机没有 Developer ID Application 证书，GitHub 仓库当前也未配置本次工作流要求的 `APPLE_CERTIFICATE`、`APPLE_CERTIFICATE_PASSWORD`、`APPLE_SIGNING_IDENTITY`、`APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID` 等 Apple 分发秘密；因此无法生成并实测公证候选。本地严格验收现在会拒绝 ad-hoc 包，避免发布门禁假通过。发布 job 在添加凭据前应失败关闭。

## 数据复核与清理

在临时夹具中操作搜索替换，执行撤销；未保存该文档。夹具及相对图片、只读样例的最终哈希与初始记录一致：

- `acceptance-fixture.md`: `600c5f33d009d016f0839fe938dda2ac589e7aaee097e2f05d3af2f637e512b6`
- `测试项目/图片/sample.png`: `801f24391f3e19107bcd42869fa634f70b1e9328a6b3ea15df63f2ee1b266dd9`
- `只读 (readonly).md`: `9c1ad6b9c308a45699cc72a691b40b86c53bc78b2f81a3ad05d92af9b6cb7c59`

验收临时窗口已关闭；真实文档没有写入。两个只读 DMG 卷均已弹出；原始 UI 截屏和测试夹具留在本机临时目录，不纳入仓库（桌面截图包含非本验收窗口内容）。未安装候选 DMG，因此没有系统安装残留；Quick Look 注册没有由本次验收改动。

## 构建/门禁验证

- `git diff --check`：通过。
- `bash -n platform/macos/build-quicklook.sh platform/macos/test-package.sh`：通过。
- `actionlint .github/workflows/release.yml`：通过（含内嵌 ShellCheck 检查）。同时修正了重试变量未使用和生成校验和时同一管道读写文件的检查问题。
- 使用修订后的 `platform/macos/test-package.sh` 对官方 universal DMG 复测：在挂载前因无 stapled ticket 失败退出，未更改系统安装状态。
- `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer TEXTMARK_SKIP_WEB_BUILD=1 platform/macos/build-quicklook.sh`：通过。Xcode 26.6；Universal Quick Look extension 构建成功；native XCTest 全部通过，包括中文 Markdown/本地图片渲染和资源预算场景。测试日志：`platform/macos/.derived-data/Logs/Test/Test-TextMarkQuickLook-2026.09.27_21-26-27-+0800.xcresult`。
- 修复构建的真实桌面只读回归：使用独立 `app.textmark.desktop.e2e` 窗口加载临时只读夹具，输入后按 `Cmd+S`；收到具体权限提示，标题/标签显示未保存状态，磁盘 SHA-256 未变化。撤销后退出了隔离测试进程。
- 新增只读 HTML 导出目标拒绝覆盖的 Rust 回归测试；保存和导出的只读检查都在后端强制执行。
- `npm run build:e2e` 的不打包调试应用编译成功。额外尝试生成 app bundle 时，bundle 本身成功生成，但 Tauri 命令最终因本机未提供 `TAURI_SIGNING_PRIVATE_KEY` 而返回非零；未发布/上传该产物。
- 当前机器没有 Developer ID 证书和公证账户凭据，真实签名、公证、Gatekeeper 安装及 Quick Look Finder 流程尚未复测。

## 最终放行判断

- **macOS v0.10.31 候选：不通过（P1）。** 本地修复只能防止未来发布门禁误放行，不能回溯改变已发布包的签名状态。
- **Windows/Linux：未验证。**
- **跨平台正式发布：尚无完整验收证据。** 待补齐 Apple Developer ID / notarization 凭据，构建新的签名公证候选，并从隔离安装流程重新执行本报告未验证项。

## 2026-09-28 工作树复验补记

以下结果来自 `v0.10.31` 的未发布工作树，不代表已发布安装包已更新：

- 版本核对：GitHub 最新正式版本仍为 TextMark `v0.10.31`（2026-09-27 发布）；对照项目 Markdown Preview 最新版为 `v0.0.62`（2026-09-25 发布）。当前工作树还没有新的正式版本。
- 前端：53 个测试文件、492 项测试通过；ESLint、Prettier、生产构建通过。
- 最新复验：新增表格键盘进入源码的 E2E 断言触发一处 ESLint 全局变量报错；改用 `window.KeyboardEvent` 后，ESLint、`npm run build:e2e`、`e2e/markdown-syntax.spec.mjs`（2 项）及 `git diff --check` 全部通过。
- 表格编辑边界复验：修复 CRLF 文档中 Tab/Shift-Tab 单元格偏移逐行漂移，以及末尾 Tab 新增行后首单元格光标偏移/换行格式不匹配；新增 LF、CRLF 导航回归用例。全量前端测试 53 文件、492 项通过；`npm run build`、ESLint、Prettier、`e2e/markdown-syntax.spec.mjs`（2 项）及 `git diff --check` 通过。
- 原生：Rust 27 项测试通过；Clippy 全目标检查通过；macOS 调试应用构建通过。
- 桌面回归：使用 `MARKDOWN_RENDERING_TEST.md` 执行 2 项 WDIO E2E，通过。覆盖预览中的上标、下标、插入文本与脚注，以及编辑模式的 ATX 标题前缀折叠/光标编辑恢复、标题正文与段落左边缘对齐（误差 ≤1 px）、Setext H1/H2 样式与下划线源码恢复、`[TOC]` 目录呈现与源码恢复、表格点击和键盘聚焦进入对应源码、粗体/斜体/删除线/行内代码/高亮/上标/下标/插入文本、硬换行反斜杠的非编辑态隐藏与光标处源码恢复；单元测试另覆盖目录点击跳转、标题编辑后的目录更新、表格单元格源码映射、三种行内语义格式、删除线代码/转义边界，以及硬换行反斜杠与偶数反斜杠/行内代码边界。代码块保持字面标记。
- 导出：同一完整测试文档成功生成 HTML、PNG、PDF；PNG 为 1800×25452，HTML 含 34 个标题、3 张表格、10 个任务项、5 个公式及 3 个 Mermaid 图。文档刻意引用的两张不存在图片在 HTML 中保留对应 alt 文本；这属于测试样例，不是导出缺图回归。
- 发布质量门：`npm run test:exports` 通过，HTML 安全校验通过，PNG/PDF 文件头与尺寸通过；bundle 预算通过（main+worker 312 KiB、native preview 71 KiB gzip）；`npm audit --omit=dev --audit-level=high` 为 0 漏洞；`actionlint`、发布包版本门禁脚本静态检查通过。
- Rust 依赖审计：`cargo audit` 无已知可利用 CVE，但报告 7 个已允许的 advisory 警告：6 个未维护传递依赖，以及 `glib 0.18.5` 的 `RUSTSEC-2024-0429` unsound iterator 实现。`glib 0.18.5` 由 Tauri/Wry 的 Linux GTK/WebKit 图形栈引入；该问题只影响特定 `VariantStrIter` 调用路径，TextMark 业务代码未直接调用该 API。GTK 0.18 依赖线尚不能安全地单独替换为 glib 0.20；需跟随 Tauri/Wry 上游升级并在 Linux 构建中复验，作为 P2 跟踪项。
- GitHub Actions 发布状态：仓库只配置了 Tauri updater 密钥，没有 Apple Developer ID / notarization 凭据；发布工作流会在 macOS 打包前失败关闭。本机 `/Applications/TextMark.app` 的签名仍为 ad-hoc，`spctl -a -vv` 返回 rejected。
- 2026-09-28 复查 GitHub 仓库 Secrets：`gh auth status` 显示当前已登录且具有 `repo`、`workflow` 权限；`gh secret list` 仍只列出 `TAURI_SIGNING_PRIVATE_KEY` 与 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`，未见 Apple Developer ID 或公证所需 Secret。该检查仅确认 Secret 名称，不读取 Secret 值。

**复验结论仍为不放行正式发布。** 当前工作树的功能与导出回归通过，但没有生成、签名、公证并通过 Gatekeeper 的新 macOS 候选；Windows/Linux 发行包及安装升级路径也未在目标系统验证。当前补丁未提交或发布。

## 2026-09-28 编辑模式对照补记（Markdown Preview v0.0.62）

本轮使用相同的 `MARKDOWN_RENDERING_TEST.md`，在本机运行 Markdown Preview 官方 v0.0.62 与 TextMark v0.10.31 桌面应用，实际查看编辑模式顶部工具栏、元数据、目录、标题层级、引用与正文。上游当前正式发布说明见 [Markdown Preview v0.0.62](https://github.com/pluk-inc/markdown-preview/releases/tag/v0.0.62)。本报告曾把仓库存在的 v0.0.63 标签误当成最新正式发布版；2026-09-29 已重新核实 GitHub 最新正式发布版及本机安装版均为 v0.0.62。此次真机对照统一为深色外观、同一测试文档、编辑模式和目录边栏，窗口内容区起始位置一致；比较结构与交互，不将 macOS 原生控件的绘制差异计为回归。

### 对照发现与本轮处理

- **元数据块**：上游把 YAML 元数据包裹在独立底板内；TextMark 原先仅着色边界与值，视觉分组不足。现为元数据首行、值行、结束行统一底色，并对首尾行加圆角和垂直留白；增加桌面 E2E 检查首尾圆角、元数据背景一致性。
- **任务列表键盘操作**：TextMark 工作树支持编辑态 Enter 延续未完成任务项，以及空任务项 Enter 退出并保留空白分隔行，编号任务会递增序号；单测和桌面 E2E 覆盖。上游仓库的 v0.0.63 标签不等于最新正式发布版，本报告不将该标签上的源码改动作为已发布 v0.0.62 的验收基准。
- **顶部操作栏差距与处理**：同一测试文档的真实桌面截图及 AX 树显示，上游默认操作栏包含“按名称搜索文稿”、复制 Markdown 和导出；TextMark 之前将复制和导出留在“更多”菜单，也未把按名称搜索文稿放在默认栏。本轮将 `documentSearch`、`copy`、`export` 按上游位置加入默认顺序（文档名后、打开菜单前，以及外观设置后按复制、简介、共享、导出、编辑、文内搜索排列）。偏好 schema 升至 v9，旧 v8 默认工具栏会自动迁移；用户已自定义的顺序不变。
- **文稿搜索对照**：Markdown Preview v0.0.62 发布说明强调当前项目内按文件名检索、精确/前缀优先、键盘选择，并支持当前标签、新标签和新窗口打开。TextMark 的 `ProjectDocumentSearch` 已用 Worker 执行模糊排名，提供匹配高亮、上下/Home/End/PageUp/PageDown 选择，Return/Cmd+Return/Option+Return 对应三种打开方式；组件测试覆盖这些关键操作。TextMark 菜单将 `Cmd/Ctrl+Shift+O` 绑定到搜索文稿；真机复查确认默认工具栏入口可见、面板能正常打开并关闭。
- **仍有显示/功能差异**：TextMark 编辑态将 `[TOC]` 转为可编辑状态下的目录预览；上游编辑态直接展示 `[TOC]` 源码。这是目前确认的编辑模式语义差异，TextMark 采用预览以便直接检查目录效果。2026-09-29 同条件真机复查中，工具栏、标签栏、编辑格式栏、目录侧栏以及引用/提示块布局均已对齐；未发现新的遮挡、截断或控件缺失。此处比较的是 Markdown Preview 与 TextMark 的同文档深色编辑界面，而不是像素级复制 AppKit 控件。
- **严格换行阅读设置**：TextMark 提供可选严格软换行偏好，默认关闭并保留 CommonMark 软换行；启用后普通换行按 `<br>` 显示。该设置贯通工作线程渲染及复用预览渲染结果的 HTML/PDF 导出。这是 TextMark 当前额外提供的阅读选项，不作为 Markdown Preview v0.0.62 的对齐项。

### 本轮回归结果

- 前端完整单测：54 个文件、500 项通过（含严格换行渲染、偏好迁移和设置控件交互覆盖）。
- 编辑器装饰与任务列表定向测试：56 项通过。
- macOS E2E：`e2e/markdown-syntax.spec.mjs` 两项通过，含任务项 Enter 行为、脚注/数学/流程图与引用的编辑态行为，以及本轮新增的元数据底板视觉属性断言。
- ESLint、Prettier、生产构建、E2E 调试构建及 `git diff --check` 通过。严格换行设置完成真实桌面验收：在隔离配置目录内通过设置 UI 开启，退出并重启后确认复选框仍为开启；使用临时文档验证普通软换行关闭时显示为同一段行内文本、开启时呈现为两行。测试完成后已将隔离偏好恢复为关闭；原始 `MARKDOWN_RENDERING_TEST.md` 未修改。独立图表预览只展示单个 Mermaid SVG，不参与 Markdown 软换行解析，该阅读设置不适用于该窗口。
- 工具栏默认布局修订后，macOS 桌面 shell E2E 全部 25 项通过，涵盖默认“搜索文稿/拷贝/导出”按钮可见、搜索面板可开关、工具栏其余点击矩阵及自定义排序/持久化；半屏布局 E2E 3 项通过，验证窄窗口下工具栏项目有序、搜索可达并通过溢出菜单收纳。
- 此次仅构建和运行工作树调试应用，没有修改原始测试文档，也没有提交或发布。

### 仍未满足发布条件

- 正式发布需 Developer ID 签名与 Apple 公证凭据；GitHub Secrets 目前未配置。无凭据时工作流按设计失败关闭。
- Windows、Linux 安装/升级、目标系统兼容性及干净环境安装尚未实测。
- 相同主题/尺寸下更广范围（深色模式、多个半屏宽度、不同 DPI）截图量化仍未完成；导出等验收范围也见上表。

因此，本轮修复通过回归，但不是正式发布验收通过；工作树批次继续保留，未提交、未发布。

## 2026-09-29 继续复验补记

- 复查 macOS 发布工作流时发现清理步骤使用 `mapfile`，但 GitHub macOS runner 自带 Bash 3.2 不支持该命令，可能使失败路径无法恢复 keychain 搜索列表。已改用 Bash 3.2 支持的数组追加与逐行读取；该步骤仍只恢复工作流执行前记录的 keychain 列表，再删除临时 keychain。
- 使用本机 `/bin/bash` 3.2.57 验证相同数组恢复语法；`actionlint .github/workflows/release.yml`、macOS 脚本 `bash -n` 和 `git diff --check` 均通过。
- 重新运行 `npm run test:exports`：HTML、PNG、PDF 导出和夹具完整性检查通过；覆盖 6 个标题、2 张表格、2 个任务项、1 个提示块、2 个公式及 Mermaid 图。PNG 为 1800×4082，HTML 安全检查通过，浏览器失败与资源请求失败均为 0。
- `npm run lint` 与 `npm run format:check` 通过。
- 全量复验发现设置迁移测试仍断言旧 schema v8；已同步到当前 v9，并重跑通过：Vitest 54 个文件、501 项；Rust 27 项；Clippy 全目标检查；生产构建；`npm run build:e2e`；`npm run test:exports`；ESLint、Prettier、actionlint 和 `git diff --check`。
- 桌面 E2E 的 shell、Markdown 编辑语法及布局几何三组分别通过。三份规格同时传入 WDIO 时会启动并行应用进程，布局组和另外两组共享默认临时配置目录，布局断言曾失败；改用仓库配置的 `TEXTMARK_LAYOUT_GEOMETRY=1 npm run test:e2e` 单独运行后布局 3 项全部通过。该并行调用不作为通过证据。
- 再次核验 GitHub Release 仍为 v0.10.31；仓库仅配置 Tauri updater 两项 Secret，没有 Developer ID / notarization Secret。当前 macOS 候选无法通过公证与 Gatekeeper 发布门禁，故不提升版本、不创建 Release。
- 最新对照基准：查阅 GitHub `/releases/latest` 并检查 `/Applications/Markdown Preview.app` 的 `CFBundleShortVersionString` 与 `CFBundleVersion`，分别确认最新正式版/已安装版为 0.0.62/66；仓库虽有 v0.0.63 标签，但不能据此当作正式发布版。本轮在同一 `MARKDOWN_RENDERING_TEST.md`、深色编辑模式、目录侧栏下真实查看 TextMark 0.10.31：标题栏与工具栏、文稿标签、格式工具栏、目录结构及引用/提示块的布局和控件均正常；对照中未发现新的遮挡、截断或缺失。已恢复 TextMark 测试前的文件夹侧栏模式。
- 核对 v0.0.62 发布说明中的项目文稿搜索后，确认 TextMark 实现了快捷键 `Cmd/Ctrl+Shift+O`、Worker 模糊搜索、键盘结果选择和 Return/Cmd+Return/Option+Return 三种打开方式；组件测试覆盖关键交互。真机确认工具栏入口可见，搜索面板能打开和关闭。
- 为 Linux 包实测启动了本机 OrbStack daemon，但从 Docker Hub 拉取 `node:24-bookworm` 与 `ubuntu:22.04` 均在配置层校验时报大小不匹配（Docker/镜像传输错误），没有容器启动或项目构建结果。本机运行时现状不构成产品构建失败证据；Linux 安装包仍须由可工作的 Linux runner 验证。
- 跨平台验收复查：发布工作流包含 Windows x64/ARM64 的 MSI、NSIS 安装/卸载及 Explorer 预览烟测，也包含 Linux x64/ARM64 的 DEB、AppImage、RPM 安装/卸载与缩略图烟测；共享 CI 另有 macOS、Windows、Linux 矩阵。当前工作树改动尚未在这些目标 runner 执行。本机虽装有 `x86_64-pc-windows-msvc` Rust target，但缺少 MSVC C 编译器/Windows SDK，`cargo check` 在编译 `ring` 原生 C 代码时因找不到 `assert.h` 失败；本机 OrbStack daemon 可运行，但 Docker Hub 镜像拉取失败。该结果是本机工具链限制，不代表 Windows 应用代码失败；Windows/Linux 安装升级仍属未验证，不能据此放行。
- 继续加固设置迁移测试，验证 schema v4–v9 的自定义工具栏顺序均可保留；定向测试 18 项通过。bundle 大小门禁通过：main+worker 313 KiB、native preview 71 KiB gzip。
- 此次未使用 Apple 分发凭据、未签名/公证/上传或安装候选包；macOS Gatekeeper P1 与 Windows/Linux 安装升级验收缺口仍然存在，正式发布结论不变：不放行。未提交、未发布。

## 2026-09-29 Ubuntu ARM64 包验收补记

- 使用 `public.ecr.aws/ubuntu/ubuntu:22.04` 的 Linux ARM64 容器，在干净源码归档中复跑发行质量门。归档禁用了 macOS xattr/AppleDouble 元数据；首次试跑遇到的 `._*` 测试文件和缺少 CA 根证书均为容器准备问题，修正归档和容器依赖后，项目验证正式通过。
- Vitest 54 个测试文件、501 项通过；ESLint、Prettier 检查、TypeScript/Vite 生产构建、bundle 预算检查及生产依赖 `npm audit --omit=dev --audit-level=high` 通过（0 个生产漏洞）。
- Ubuntu 22.04 ARM64 上 Rust 26 项单测通过、Clippy 全目标检查通过；Tauri release 构建成功生成 `TextMark_0.10.31_arm64.deb`。`platform/linux/test-package.sh deb` 实测安装、命令别名/MIME/缩略图器注册、CLI PNG 缩略图生成和卸载，全部通过。
- 这是 Ubuntu 22.04 ARM64 容器中的 DEB 安装生命周期烟测，不代表 Ubuntu 桌面会话/Wayland/X11 图形启动、AppImage/RPM、Linux x64 或其他发行版已验收；Windows 安装升级仍未在 Windows runner 实测。macOS Developer ID 签名、公证和 Gatekeeper 阻塞也仍在。因此正式跨平台发布仍不放行，未提交/发布版本。

## 2026-09-29 验收标准调整、x64 补测与 v0.10.32 候选

按项目所有者本轮明确的发布标准，本节覆盖并取代本报告之前将 Developer ID/公证/Gatekeeper 和 Windows/Linux 实机验收列为发布阻断项的判断：

- macOS 允许 ad-hoc 签名包。用户从“系统设置 → 隐私与安全性”确认后仍可打开运行；Developer ID、公证票据与 Gatekeeper 放行不作为本项目发布前置条件。发布工作流现改为 Apple 分发凭据可选：凭据齐全时签名/公证；凭据未配置时构建 ad-hoc 包，并在打包烟测中跳过公证和 Gatekeeper 断言，保留 bundle/签名结构、CLI 缩略图和 Quick Look 注册检查。
- 不要求 Windows/Linux 真机验证。容器构建与包安装脚本只报告为容器烟测，不宣称目标桌面环境实机验收。
- Ubuntu 22.04 x64/amd64 容器补测成功：Tauri release 构建生成 `TextMark_0.10.31_amd64.deb`；安装、命令别名/MIME/缩略图器注册、CLI PNG 缩略图生成、卸载脚本通过。该结果与 ARM64 DEB 容器烟测合并记录；本轮未在真实 Linux 桌面会话测试窗口启动，也未测 AppImage/RPM/KDE 插件或发行版差异。
- Ubuntu 22.04 x64/amd64 容器补测成功：Tauri release 构建生成 `TextMark_0.10.31_amd64.deb`；安装、命令别名/MIME/缩略图器注册、CLI PNG 缩略图生成、卸载脚本通过。该结果与 ARM64 DEB 烟测合并记录；本轮未在真实 Linux 桌面会话测试窗口启动，也未测 AppImage/RPM/KDE 插件或发行版差异。
- `v0.10.32` 已公开发布，Release 页面为 https://github.com/jincaiw/TextMark-v1/releases/tag/v0.10.32 。36 项资产包含 macOS ARM64/Universal DMG、Universal updater archive、Windows x64/ARM64 MSI/NSIS/portable ZIP、Linux x64/ARM64 DEB/AppImage、Fedora x64/ARM64 RPM、updater manifest、SBOM、安装说明、发布说明和 SHA-256 校验清单。
- Release CI 的 Windows x64/ARM64、Ubuntu x64/ARM64、Fedora x64/ARM64 包矩阵全部成功；包含 MSI/NSIS 安装与卸载、Explorer 预览，DEB/AppImage 安装与便携模式、RPM/KDE 缩略图，以及 macOS Quick Look 注册烟测。这些是托管 runner 自动测试记录，不作为用户 Windows/Linux 真机测试的表述。


### 严格换行偏好补充验证

- 新偏好存入配置 v8，旧配置迁移时默认为关闭，不覆盖现有配置字段；设置 UI 的中英文标签均已添加。
- Markdown 渲染器按 `strictLineBreaks` 复用两个 renderer 实例，渲染缓存包含该偏好维度；Worker 请求、主线程回退都传递相同值。
- 新增测试分别验证默认 CommonMark 软换行、启用后生成 `<br>`、偏好迁移与设置控件点击回调。真实桌面设置窗口已完成开关、进程重启持久化及普通软换行视觉验证；独立图表预览窗口同步仍待验收。
- 本轮前端基线结果：54 个测试文件、500 项通过；本次顶部工具栏改动后的定向设置单测 11 项通过，`npm run build:e2e`、ESLint、Prettier、桌面 shell E2E 25 项、窄窗口布局 E2E 3 项及 `git diff --check` 均通过。
