# TextMark v0.10.33 发布验收

日期：2026-09-29。验收对象为 TextMark v0.10.33；GitHub Release run [36513062204](https://github.com/jincaiw/TextMark-v1/actions/runs/36513062204) 全部成功，正式发布地址为 [v0.10.33](https://github.com/jincaiw/TextMark-v1/releases/tag/v0.10.33)。

## 结论

**✅ 可以正式发布。** P0：0；P1：0；P2：2（尚未做 TextMark 与上游的冷启动/热打开耗时基准；Cargo audit 有 7 条已允许的上游依赖警告，其中含 GTK `glib 0.18.5` unsound 提示。未发现影响当前 macOS 本机运行的证据；托管 CI 仍执行发布审计）。

按软件所有者的既定标准，不做 Windows/Linux 真机验收；Developer ID、公证和 Gatekeeper 不作为放行条件。macOS 包使用 ad-hoc 签名，用户可在“系统设置 → 隐私与安全性”允许打开。Windows/Linux 的构建和包烟测交由托管发布 CI，不记为真机验证。

## 验收结果

| 项目 | 结果 | 主要检查 / 限制 |
| --- | --- | --- |
| 架构 | PASS | Markdown Worker、按需加载渲染器、数据原子写入和异常恢复路径；全量前端检查通过 |
| 功能 | PASS | 任务列表只读、搜索结果路径、更新说明、目录定位；前端 506 项通过 |
| UI/UX | PASS | 使用 `MARKDOWN_RENDERING_TEST.md` 对比同半屏、深色、编辑模式和目录侧栏；修复目录跳转抢焦点；桌面 Shell E2E 26 项通过。平台原生工具栏不宣称逐像素相同 |
| 跨平台兼容 | N/A（真机） | 无 Windows/Linux 真机；托管 CI 的 Windows x64/ARM64、Linux x64/ARM64、Fedora x64/ARM64 构建和包烟测全部通过 |
| 安装升级 | PASS（流水线） | Windows MSI/NSIS 安装、预览与卸载烟测通过；签名 updater `latest.json` 已生成并通过完整架构/包清单校验。本机未对正式通道执行真实升级 |
| 数据可靠性 | PASS | Rust 27 项覆盖只读保存/导出、原子写入和冲突；导出夹具检查完整 |
| 性能 | PASS（P2 观察项） | Worker 异步解析；未测冷/热启动时间、长期资源曲线或与上游的性能差值 |
| 稳定性 | PASS | 前端与 Rust 回归、macOS E2E、导出回归通过 |
| 安全 | PASS（P2） | 生产依赖 `npm audit --omit=dev --audit-level=high` 为 0 漏洞；Cargo audit 7 条允许的上游告警；导出 CSP、脚本和内联事件检查通过 |
| 发布产物 | PASS | package、Cargo、Tauri 版本统一为 0.10.33；正式非预发布 Release 已发布，共 36 项资产，包含签名 updater metadata、SHA256 和 SBOM |

## 本地验证记录

- Vitest：55 个文件、506 项通过。
- macOS 桌面 Shell E2E：26 项通过，包含目录导航保留编辑光标回归。
- Rust：27 项通过；`cargo fmt` 和 Clippy 全目标检查通过。
- ESLint、Prettier、TypeScript/Vite 生产构建、包体预算通过（main+worker 312 KiB gzip，native preview 71 KiB gzip）。
- HTML/PNG/PDF 导出通过：6 个标题、2 张表格、2 个只读任务项、1 个提示块、2 个公式、1 个 Mermaid 图；CSP 检查通过，无脚本、无内联事件、无失败请求。
- `npm audit --omit=dev --audit-level=high`：0 漏洞；`cargo audit -f src-tauri/Cargo.lock` 退出成功，列出仓库策略中允许的 7 条上游 unmaintained/unsound 警告。
- GitHub Release run `36513062204` 全部成功：质量门、macOS Universal/Quick Look、Windows x64/ARM64 安装/预览/卸载、Linux x64/ARM64 DEB/AppImage、Fedora x64/ARM64 RPM/KDE 预览，以及最终资产清单/updater metadata/SBOM/SHA256 校验和正式发布。
- 已从正式 Release 下载核验 `latest.json`：版本为 `0.10.33`，平台更新条目包含 URL 与签名；Release 当前为非草稿、非预发布，共 36 项资产。

## 上游对照和修复

对照基准为 Markdown Preview v0.0.63。桌面截图和辅助功能状态检查使用同一 `MARKDOWN_RENDERING_TEST.md`、目录侧栏、编辑模式、深色外观和半屏窗口。发现 TextMark 原先点击目录会移动编辑光标，造成语法标记暴露；现在只滚动到目标标题，保留光标和编辑模式显示。测试后将上游外观恢复为“自动”。

详细对照记录：[UPSTREAM_PARITY_v0.10.32_vs_0.0.63.md](../../docs/UPSTREAM_PARITY_v0.10.32_vs_0.0.63.md)。
