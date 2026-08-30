# TextMark v0.9.1 — Markdown Preview 最新版对标实施与验收

> 核对日期：2026-08-30
> 上游：`pluk-inc/markdown-preview` v0.0.51（tag `8fcd203`），`main` `ce48ef9`
> 状态：本轮推荐项已实施并完成本机回归；发布仍按 CI 的多平台签名与安装包门槛执行。

## 本轮落地

| 范围 | 实施结果 |
| --- | --- |
| 公式复制 | 预览中的 KaTeX 复制同时保留富文本 HTML，并将纯文本恢复为 `$…$` / `$$…$$`；覆盖完整与局部选择。 |
| Open With | macOS 使用 LaunchServices 编辑器角色筛选已安装应用，避免把仅查看类应用列为编辑器；保留跨平台回退。 |
| 系统分享 | macOS 接入原生 `NSSharingServicePicker`；Web、测试环境和不支持的平台使用复制 Markdown 源文回退。 |
| HTML / PNG / PDF | 增加真实浏览器导出回归、签名/尺寸/CSP/资源/主题恢复检查，并在 CI 上传失败证据。 |
| Mermaid | 导出前将 `foreignObject` 标签安全转换为 SVG 文本，再执行 SVG 清洗；标签可见且脚本、事件属性被移除。 |
| Markdown / KaTeX | 修复块级公式结束符吞掉后续换行、导致下一标题不能解析的问题。 |
| 导出样式 | 修复 GitHub Alert 图标在 PDF 中异常放大；补齐打印与独立预览样式。 |
| 偏好设置 | 增加自动保存、标签页、窗口置顶的原生持久化端到端验证。 |
| 图片粘贴 | 使用真实 PNG 验证粘贴、落盘、相对链接和预览显示。 |
| 大文档性能 | 增加 1,200 节、超过 150k 字符的确定性渲染性能门槛。 |

## 对标结论

TextMark 保留上游的预览优先交互、编辑模式、目录与检查器、搜索、工具栏自定、Open With、Open in LLM、分享、打印与三种导出、KaTeX、Mermaid、表格编辑、任务项、frontmatter、RTL、Quick Look / Explorer Preview / Linux 缩略图等用户可见能力。跨平台实现不机械复制 AppKit 内部结构，而以相同可见结果和自动化测试作为等价标准。

以下差异为有意识的产品边界：

- TextMark 继续提供 Windows、Linux 与 macOS 三平台，而上游以 macOS AppKit 为主。
- 原生窗口标签、系统打印面板的内部控件等由各平台宿主决定；TextMark 对齐行为结果而非 AppKit 私有实现。
- 不引入上游分析遥测；这是隐私与跨平台一致性的明确选择，不视为功能缺失。

## 本轮验收证据

- 前端单元/组件/性能：33 个测试文件，280 项通过。
- Rust 原生层：13 项通过；Clippy `-D warnings` 通过。
- 桌面端主流程：21 项通过。
- 用户语法文档：75 个标题、15 张表格、38 个任务项、6 个提示块、8 个公式、3 张 Mermaid 图成功渲染。
- 导出：HTML 无脚本与内联事件；PNG/PDF 文件签名、尺寸、CSP、主题恢复均通过；PDF 为 A4 两页回归样例且无 JavaScript。
- 质量门：ESLint、Prettier、TypeScript/Vite 构建、包体积预算、生产依赖审计、`git diff --check` 全部通过。

## 发布门槛

合并或发布前仍需由 CI 在 Windows、Linux、macOS 分别完成安装包、平台集成、签名、更新清单和 Release 资产验证。macOS 系统分享面板属于系统 UI，本轮已完成编译与命令边界验证；发布候选包应再做一次人工弹窗冒烟检查。
