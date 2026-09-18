# TextMark-v1 · 项目长期笔记

## 当前工作线

对标 `pluk-inc/markdown-preview v0.0.58` 的桌面优化，分支 `optimize/v0.9.7-parity`
（基线 `v0.9.7` / a835794）。方案文档与交付文档均在 `outputs/desktop-review-20260916/`：

- `TextMark-桌面对比与优化方案.md` —— 第 7 节是 B00–B14 的**权威任务清单**，第 8.2 节是边界
  （不改业务代码/平台配置/依赖/分支；不发布版本、不创建 PR）。
- `TextMark-对标优化实施结果.md` —— 实施账本，含 B00–B14 状态表与 D1–D8 缺陷记录。

范围口径：**A+B 必做（B00–B10）已全部落地；C/D 批（B11–B14）未启动**，工作树无对应改动。

## 改完 src/ 后的桌面验证流程（必走）

1. 门禁：`./node_modules/.bin/tsc --noEmit` → `vitest run` → `eslint .` → `npm run format:check`。
   注意 `prettier --check .` 会误报 `platform/*.wix.xml` 等，只认 `npm run format:check`。
2. 构建：`export PATH="$HOME/.cargo/bin:$PATH"` 后 `npm run tauri build -- --debug --no-bundle`
   （必须 `--no-bundle`，QuickLook appex 未构建会失败）。
3. 安装：`/bin/cp` 到 `/tmp/TextMarkVerify.app/Contents/MacOS/textmark` → **`shasum -a 256` 分别比对**
   （`cmp` 在 47MB 二进制上会被沙箱 SIGKILL）→ `codesign --force --sign -`。
4. 重启：`kill <旧pid>` → `pgrep -f` 确认归零 → `open -n` → 看 `lsappinfo` 的 **checkin time 是否刷新**
   （旧实例没退干净时 `open -n` 不会起新实例）。

## 已解决的深层缺陷（复用价值高）

- **D5 滚动归属**：`@uiw/react-codemirror` 插入的 `div.cm-theme` 无高度 → `height:100%` 链断裂 →
  `.cm-scroller` `scrollTop` 恒 0。修复 `.editor-pane .cm-theme { height: 100% }`。
- **D4 就绪门禁**：renderKey 在编辑/阅读间不变，跨卸载复用 ref 会短路等待；
  不稳定回调（`props.onHydrated` 内联函数）进 effect 依赖会每次渲染 cleanup 掉进行中的 mermaid 渲染。
  已抽成 `src/lib/previewHydration.ts`。
- **D6 跨 lazy/Suspense 的状态交接**：父组件「下一拍清空」effect 会早于 lazy 子组件 mount，
  必须改由子组件回报（`onInitialPositionApplied`）。
- **D3 React 闭包快照**：`if (mode === viewMode) return` 读渲染期快照，同一流程内「先切 A 再切回 B」时回程变 no-op。
- **D8 打印隐藏列表漏条件渲染元素**：`.document-tabs` 只在双文档时渲染，所以长期没被发现。

方法论已沉淀为 user-level skills：`webview-view-state-handoff`、`webview-native-print`、
`workbuddy-env-quirks`（环境坑）。

## 仓库卫生

查找／替换类实测会在 `README.md` 上做替换，测完必须确认工作区干净：
`git diff --stat -- README.md` 为空、`grep -c "TMark" README.md` = 0。
所有改动至今**未提交、未推送**（用户未要求）。
