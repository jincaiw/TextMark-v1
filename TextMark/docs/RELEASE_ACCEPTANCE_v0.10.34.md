# TextMark v0.10.34 发布验收

日期：2026-09-29。验收对象为 TextMark v0.10.34，标签提交 `72f1b65e7db06bf9f2f92fc88078a3e2b08f7176`。GitHub Actions 发布运行 [36518871390](https://github.com/jincaiw/TextMark-v1/actions/runs/36518871390) 全部成功；正式 Release [v0.10.34](https://github.com/jincaiw/TextMark-v1/releases/tag/v0.10.34) 为非草稿、非预发布，共 36 项资产。

## 验收结论

**✅ 可以正式发布。** 正式 Release 已发布，所有发布质量门与平台打包/包检查通过。

| 项目 | 结果 | 说明 |
| --- | --- | --- |
| 架构与代码 | PASS | 变更集中在编辑器长文档目录滚动与工具栏查找交互；严格 Clippy 通过。 |
| 功能 | PASS | 长文档目录目标滚动并保留光标；工具栏查找复用工具栏输入框，快捷键查找仍保留完整操作栏。完整前端 507 项测试通过。 |
| UI/UX | PASS | macOS 桌面实机确认工具栏搜索框无重复查询框且正常聚焦；编辑模式目录可滚动到视口。 |
| 跨平台兼容 | PASS（CI） | 发布 CI 完成 Windows x64/ARM64、Linux x64/ARM64、Fedora x64/ARM64 与 macOS Universal 2 构建及对应包烟测。未进行 Windows/Linux 真机验证。 |
| 安装升级 | PASS（CI） | Windows MSI/NSIS、Linux DEB/RPM、macOS DMG 安装/注册检查通过；本机没有声称完成额外硬件上的全流程升级验收。 |
| 数据可靠性 | PASS | E2E 目录跳转验证滚动变化且编辑光标位置不变；测试文档未发生内容修改。Rust 27 项测试通过。 |
| 性能与稳定性 | PASS | 前端、Rust、macOS 桌面 E2E 测试通过；本次变更未改动文档渲染与持久化主流程。 |
| 安全 | PASS | npm 高危级别审计、Rust cargo-audit 均通过；资产包含 SHA256 校验和与 CycloneDX SBOM。 |
| 发布产物 | PASS | package、Cargo、Tauri 版本均为 0.10.34；Release 36 项资产。`latest.json` 版本为 0.10.34，18 个平台键均包含下载 URL 和 updater 签名。 |

## 验证详情

- 前端：507 项通过（55 个测试文件）。
- macOS 桌面 E2E：26 项通过；Release CI 另通过 Universal/ARM64 DMG 与 Quick Look 注册检查。
- Rust：27 项通过；`cargo clippy --all-targets --all-features -- -D warnings` 通过。
- `npm run build`、`npm run check:bundle`、Lint、格式检查通过；bundle 预算为 main + worker 312 KiB、native preview 71 KiB gzip。
- `npm audit --omit=dev --audit-level=high` 与 `cargo audit` 通过。
- GitHub Actions 的发布质量门、macOS、Windows x64/ARM64、Ubuntu 22.04 x64/ARM64、Fedora 40 x64/ARM64 与最终发布作业全部成功。
- Windows/Linux 的验证为发布 CI 主机上的构建与包烟测，不代表在用户真机上的验证；本机未执行 Windows/Linux 真机测试。
- macOS 使用 ad-hoc 签名。按项目标准，不要求 Apple Developer ID、公证或 Gatekeeper 验收；遇到系统拦截可在“系统设置 → 隐私与安全性”允许打开。

## 本次变更摘要

1. CodeMirror 虚拟化下，点击目录跳转到离屏标题时使用行块几何滚动，不移动插入光标。
2. 工具栏搜索输入框保持在工具栏中，避免与查找栏重复显示；聚焦稳定并在工具栏溢出时保持可见。
3. 搜索焦点的回归测试显式推进模拟动画帧，消除 CI/jsdom 中依赖时序的断言失败。
