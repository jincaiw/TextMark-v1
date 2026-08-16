# TextMark v0.5.4 — 交通灯与顶部点击根治方案

> 状态：**已实施并通过发布包实机验证**。
> 实施记录：移除 `tabbingIdentifier` + 启动零阻塞（后台预热最近文件缓存）+ macOS 清除残留 `NSWindowTabbingShoudShowTabBarKey-*` 偏好 + 顶栏点击矩阵 e2e（16/16 绿）+ 发布说明润色。实机验证：LaunchServices 启动 3 秒出窗（此前可挂起数分钟）、AX 无标签栏、激活后红/黄/绿三灯像素可见、`--new-window` 双窗口不合并、AX 真实点击生效。
> 对应请求 4 项：① macOS 交通灯不显示；② 窗口顶部按钮点击无效；③ CI 发布说明只含本次版本；④ 先深度检查、输出方案、待确认后实施。

---

## 1. 深度检查结论（已实机取证）

### 1.1 交通灯不显示（问题 1）—— 真因：`tabbingIdentifier` 触发 macOS 原生标签栏

v0.5.3 曾移除 `hiddenTitle`，但**发布版（CI 构建的 v0.5.3 universal app）实测仍无交通灯**。本轮逐层取证后定位到与 hiddenTitle 无关的第二根因：

| 证据 | 结论 |
| --- | --- |
| `defaults read app.textmark.desktop` 含 `NSWindowTabbingShoudShowTabBarKey-app.textmark.desktop.documents = 1` | macOS 持久化了"标签栏可见"状态（按 tabbingIdentifier 存储，一旦出现即被记住） |
| 发布版窗口 AX 树存在 `AXTabGroup`（1440×28，可见）＋窗口按钮被压缩为 12×14 且位于窗口外上方 | 原生标签栏在恢复显示，交通灯被标签栏布局抑制/顶出可视区 |
| 本地未走 LaunchServices 的裸二进制启动（无状态恢复）→ 无 AXTabGroup、按钮 16×16 正常、像素采样红/黄/绿三灯可见 | 同一份源码/配置，差异只在"标签栏是否被恢复" |
| `tauri-utils` 文档原文：*"If the tabbing identifier is not set, automatic tabbing will be disabled."* | 配置了 `tabbingIdentifier` 才启用原生标签合并/标签栏 |

**因果链**：`tauri.macos.conf.json` 配置了 `tabbingIdentifier` → 窗口可原生标签化 → 某次多窗口（文档窗口/图表窗口/Cmd+T）触发合并或标签栏显示 → macOS 将 `NSWindowTabbingShoudShowTabBarKey-… = 1` 写入应用偏好 → 之后**每次 LaunchServices 启动都恢复标签栏** → 标签栏下交通灯不显示（且覆盖工具栏顶部约 28px，见 1.2）。

> v0.5.3 发布说明中"交通灯已恢复"的结论有误：当时只在 dev/裸启动路径验证，未走 LaunchServices 状态恢复路径。

### 1.2 顶部按钮点击无效（问题 2）—— 三因叠加

1. **原生标签栏覆盖**（主因）：标签栏占据窗口顶部 28px（工具栏总高 52px），点击落在原生标签栏而非工具栏按钮 → "顶部所有按钮点击没反应"。
2. **旧版 drag-region**：v0.5.2 及以前 `data-tauri-drag-region` 覆盖整个工具栏吞掉点击 —— v0.5.3 已修复（仅保留在空白弹性空间/空格项上），**保留现状**。
3. **启动阻塞**（新发现，见 1.3）：窗口迟迟不出现，表现为"点了没反应/应用没起来"。

### 1.3 新发现：启动阻塞 —— setup() 在主线程做阻塞 I/O

`sample` 实锤：LaunchServices 启动时主线程卡死在
`didFinishLaunching → tauri::setup → build_menu → load_recent_files → fs::read_to_string → open()`
（Group Container `group.app.textmark.desktop/recent.json`）。容器再供给（provisioning）期间该 `open()` 可阻塞数十秒甚至分钟级（实测一次 2 分钟以上仍未返回，窗口 0×0、AppleEvent 全部超时）。裸二进制启动时容器已热，仅 20ms，故此前未暴露。

**修复**：启动时菜单**不再**同步读最近文件 —— `build_menu` 增加 `recent_files: &[String]` 参数，`setup` 传入空切片（零 I/O）；后台线程预热内存缓存后回主线程重建菜单。

### 1.4 发布说明（问题 3）—— 已验证已修复

v0.5.3 的 GitHub release body 实测只含 v0.5.3 一节（publish 作业 awk 截取首段已生效）。v0.5.4 保留该机制，仅做一处润色：awk 输出末尾去掉分隔线 `---`。

---

## 2. 实施方案

### 2.1 `src-tauri/tauri.macos.conf.json` —— 移除 `tabbingIdentifier`

删除 windows[0] 中的 `"tabbingIdentifier": "app.textmark.desktop.documents"`。
（应用使用自有应用内标签页；上游无原生标签。tauri-utils 文档：不设置即禁用自动标签化。）

### 2.2 `src-tauri/src/lib.rs` —— 启动零阻塞 + 清除历史标签栏偏好

1. **撤销临时诊断代码**（本轮的 `TM-DIAG` eprintln 与为诊断引入的 `Manager` import）。
2. **`build_menu(app, locale, state, recent_files: &[String])`**：最近文件改为入参；`setup` 传 `&[]`，`refresh_menu` 传缓存内容。
3. **内存缓存**：`static RECENT_FILES: Mutex<Option<Vec<String>>>`；`load_recent_files()` 读缓存（未初始化则读盘并回填）；`record_recent_file` / `clear_recent_files` 同步更新缓存。
4. **后台预热**：`setup` 中 `std::thread::spawn` 预热缓存 → `app_handle.run_on_main_thread` 用缓存重建菜单并 `set_menu`（与现有 `refresh_menu` 命令共用同一重建函数）。
5. **清除 macOS 残留标签栏偏好**（belt-and-braces，直接修复用户机器上已持久化的污染状态）：`setup` 中（仅 macOS）经 `objc2-foundation`（tauri 既有传递依赖，加入直接依赖，版本沿用 Cargo.lock 已锁版本）调用 `NSUserDefaults.standardUserDefaults.removeObjectForKey("NSWindowTabbingShoudShowTabBarKey-app.textmark.desktop.documents")`。

### 2.3 `e2e/` —— 顶栏点击全量回归（问题 2 验证）

新增 `e2e/toolbar-clicks.spec.mjs`，用 WebDriver 逐一点击并断言状态变化：
导航（后退/前进）、边栏切换＋下拉三项（隐藏边栏/大纲/文件夹）、打开/打开方式/在 AI 中打开 下拉、缩放±（% 标签变化）、搜索（查找栏出现）、编辑模式切换、复制（闪烁反馈）、更多菜单全部条目、自定义工具栏面板（开关/恢复默认/完成）、设置对话框、查找栏（下一个/上一个/关闭）。
（原生文件对话框无法由 WebDriver 驱动：以"菜单打开 + 应用状态变化"为断言口径；打开文件等对话框路径保持现有 e2e 覆盖。）

### 2.4 `RELEASE_NOTES.md` + 工作流润色（问题 3）

- v0.5.4 段如实记录：交通灯真因（原生标签栏恢复）、顶部点击、启动阻塞修复。
- release.yml 的 awk 步骤：截取首段后去掉末尾 `---` 行（`sed '/^---$/d'` 兜底）。

### 2.5 版本与台账

- `package.json` / `tauri.conf.json` 版本 → 0.5.4；`docs/DESKTOP_UI_PARITY_V0.4.0.md` 台账更新：原生标签从"有意识偏差（tabbingIdentifier）"改为"不支持原生标签（tabbingIdentifier 已移除）"。
- `createUpdaterArtifacts` 保持 `true`（本轮诊断中已恢复）。

---

## 3. 测试方案（发布前全量）

1. **本地质量门禁**：`npx tsc --noEmit`；`npm test`；`npm run build`；`npm run check:bundle`；`cargo test`；`cargo clippy --all-targets --all-features -- -D warnings`；`npm audit --omit=dev --audit-level=high`；`cargo audit`。
2. **e2e**：`npm run build:e2e` + `npm run test:e2e`（含新增点击矩阵）。
3. **发布包实机验证（关键，复现用户环境）**：
   - 用本地密钥构建 release bundle（`TAURI_SIGNING_PRIVATE_KEY` 本地生成），`open`（LaunchServices 路径）启动；
   - 断言①：启动 ≤5 秒窗口出现（AX 可读、不再 0×0 挂起）；
   - 断言②：AX 树无 `AXTabGroup`；窗口按钮 16×16 位于预期位置；
   - 断言③：激活后 `screencapture` + 像素采样红/黄/绿三灯可见；
   - 断言④：在预置 `NSWindowTabbingShoudShowTabBarKey-…=1` 的偏好状态下启动，标签栏不出现（验证 2.2-5 兜底生效）；
   - 断言⑤：多窗口（打开文档窗口 + 图表窗口）不合并为原生标签；
   - 断言⑥：顶部工具栏按钮区域可点击（AX/坐标点击验证 + e2e 矩阵）。
4. **三平台差异检查**：Windows/Linux 侧不受本轮变更影响（tabbingIdentifier 为 macOS 专属），跑一遍构建级验证（CI verify 门禁覆盖）。
5. **发布说明核对**：确认 v0.5.4 release body 只含本次内容。

## 4. 发布

推送 `v0.5.4` tag → CI（verify 门禁 + 6 平台打包 + publish）→ 发布后人工核验 release 页面与 macOS 资产。

## 5. 风险与回退

- 移除 tabbingIdentifier 后若个别场景仍需窗口归组：不做原生标签，应用内标签页已覆盖需求（上游同）。
- objc2-foundation 直接依赖仅为删一条偏好键；若评审不接受，可去掉 2.2-5（断言④改为仅验证"移除标识后旧键不再生效"）。
- 启动零阻塞重构仅动菜单构建数据流，不改菜单项/事件 id，前端零改动。
