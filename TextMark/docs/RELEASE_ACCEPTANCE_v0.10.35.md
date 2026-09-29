# TextMark v0.10.35 发布验收

日期：2026-09-29。验收对象为 TextMark v0.10.35，标签提交 `bda0432e45fc0bd3a542cf3c75ae9a1499e1e326`。GitHub Actions 发布运行 [36521119679](https://github.com/jincaiw/TextMark-v1/actions/runs/36521119679) 全部成功；正式 Release [v0.10.35](https://github.com/jincaiw/TextMark-v1/releases/tag/v0.10.35) 为非草稿、非预发布，共 36 项资产。

## 验收结论

**✅ 可以正式发布。** 正式 Release 已发布，质量门、各平台构建及安装包烟测全部成功；已将正式 Universal DMG 安装到本机并验证启动。

| 项目 | 结果 | 说明 |
| --- | --- | --- |
| 架构与代码 | PASS | 修正中英文 What's New 文案并增加回归测试；严格 Clippy 通过。 |
| 功能 | PASS | 首次启动与帮助菜单打开的更新说明介绍当前发布所含功能；前端 508 项测试通过。 |
| UI/UX | PASS | 本机安装正式 Universal DMG 并启动，首次启动弹窗正确显示长文档目录跳转、工具栏查找的双语说明。 |
| 跨平台兼容 | PASS（CI） | Windows x64/ARM64、Linux x64/ARM64、Fedora x64/ARM64 与 macOS Universal 2 发布作业通过。未进行 Windows/Linux 真机验证。 |
| 安装升级 | PASS（CI） | macOS DMG 与 Quick Look 注册检查、Windows MSI/NSIS 安装/预览/卸载、Linux DEB/RPM 安装烟测通过。 |
| 数据可靠性 | PASS | 本版本仅调整版本更新说明 UI，不修改文稿内容、保存或导出逻辑。 |
| 性能与稳定性 | PASS | 前端 508 项、Rust 27 项测试通过；构建、平台 smoke 均成功。 |
| 安全 | PASS | npm 高危级别审计、cargo-audit 均通过；资产带 SHA256 校验清单和 SBOM。 |
| 发布产物 | PASS | package、Cargo、Tauri 版本一致为 0.10.35；36 项资产。`latest.json` 版本为 0.10.35，18 个平台条目均含下载 URL 和 updater 签名。 |

## 验证详情

- 前端：508 项通过（55 个测试文件），含中文和英文 What's New 内容断言。
- Rust：27 项通过；`cargo clippy --all-targets --all-features -- -D warnings` 通过。
- `npm run lint`、`npm run format:check`、`npm run build`、`npm run check:bundle` 通过。
- `npm audit --omit=dev --audit-level=high` 与 `cargo audit` 通过。
- GitHub Actions 发布质量门、macOS、Windows x64/ARM64、Ubuntu 22.04 x64/ARM64、Fedora 40 x64/ARM64 和正式发布作业全部成功。
- 本机下载的 Universal DMG SHA-256 与正式发布 `SHA256SUMS.txt` 一致；已安装至 `/Applications/TextMark.app`，Bundle ID 为 `app.textmark.desktop`，版本为 0.10.35，启动正常并显示本次更新文案。
- Windows/Linux 检查运行于 CI 主机，不代表用户真机验证；未进行 Windows/Linux 真机测试。
- macOS 使用 ad-hoc 签名；按项目标准，不要求 Developer ID、公证或 Gatekeeper 验收。

## 变更摘要

What's New 的中英文内容现在与 v0.10.34 的实际交付匹配：长文档编辑模式目录导航、工具栏内查找、快捷键查找完整操作。更新弹窗提供对应的中英文文案和测试覆盖。
