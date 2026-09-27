# TextMark v0.10.25 正式发布验收报告

- 验收日期：2026-09-27（Asia/Shanghai）
- 验收对象：`v0.10.25`，Git tag / HEAD `35cf285d146c8712ead9a3cf3b008c691747eb45`
- 发布状态：GitHub 正式 Release，非预发布；发布流水线 `36256345116` 全部成功。
- 本机环境：macOS 27.0，Apple Silicon arm64；Node.js 26.8.2、npm 11.19.1、Rust 1.96.1。
- 方法：当前检出代码的构建、单元/静态质量与依赖扫描；查询对应 tag 的 GitHub Release、构建工作流和跨平台安装烟测。没有把其他提交的 CI 结果当作本 tag 实测。

## 验收结论

# ⚠️ 修复后可以发布

当前版本核心质量门、可下载资产清单和流水线内的多平台包烟测通过；没有发现 P0。正式商业发布验收仍有 2 个 P1：Windows 安装包没有 Authenticode 签名，macOS 为 ad-hoc 签名且未 Apple 公证；此外发布流水线没有验证完整升级、用户数据保留、卸载后重装恢复流程。此结论表示**当前版本尚不具备本次要求的完整正式发布条件**。

## 问题统计

- P0：0
- P1：2
- P2：2

### P1

1. **平台信任与首次安装门槛**：正式安装包未使用 Windows Authenticode；macOS 仅 ad-hoc 签名，未 Developer ID 签名/公证。安装指南也确认 SmartScreen/Gatekeeper 警告。Minisign 更新包签名和 SHA-256 校验是有效的更新/完整性保护，但不能代替操作系统代码签名、公证或信誉评估。对商业用户属于明确的安装信任与支持成本风险。证据：`INSTALL.md`、`.github/workflows/release.yml` 使用 `APPLE_SIGNING_IDENTITY: '-'`，GitHub 发布工作流通过。
2. **升级/重装及数据保留缺少实测**：release workflow 成功执行 Windows MSI/NSIS 安装、预览和卸载，Ubuntu/Fedora 包安装与卸载，以及 macOS DMG/Quick Look 烟测；但未覆盖“旧版本升级到 0.10.25 → 使用/重启 → 偏好设置和最近文件保留 → 卸载 → 重装”的整条场景，尤其没有跨 Windows/macOS/Linux 验证用户数据保留策略。因此安装升级/数据可靠性不能判 PASS。

### P2

1. **开发依赖安全告警**：完整 `npm audit` 报告 11 项高危，集中在仅开发/测试使用的 WebdriverIO/`deepmerge-ts` 与 `js-yaml` 依赖链；生产依赖扫描 `npm audit --omit=dev --audit-level=high` 为 0 漏洞。当前证据未显示这些开发依赖进入生产运行包；应升级并消除 CI/开发工具链告警。
2. **README 版本/功能数据陈旧**：README 仍写 `TextMark 0.9`、上游 `v0.0.51` 和旧测试数量，并称“v0.9.7 binaries”。与当前 v0.10.25 release 不符，容易使用户误判支持基线和安装信任说明；不影响运行，可在下一次文档更新修复。

## 验收结果

| 项目 | 结果 | 主要问题 / 证据 |
| --- | --- | --- |
| 架构 | PASS | Tauri 2 / React+TS / Rust 文件边界清晰；Markdown Worker 与主线程 DOMPurify 清洗分层；相对资源限制项目根目录、类型和 8 MiB；文件写入使用原子写和 revision 冲突保护。代码评审未发现明显密钥。 |
| 功能 | PASS（自动化范围） | 当前代码 49 个前端测试文件、436 项通过；Rust 24 项通过。包含 Markdown、工具栏/设置、搜索、导出、存储、更新、冲突、删除恢复、会话恢复等。没有逐个手工操作所有功能。 |
| UI/UX | FAIL（现场目视未完成） | 当前 Mac 锁屏，CUA 无法访问原生窗口；不把仓库截图、旧 CI 截图或其他版本结果冒充 v0.10.25 现场 UI 验收。release tag 没有附带对本 tag 的视觉截图验收证据。 |
| 跨平台兼容 | PASS（CI 烟测范围） | v0.10.25 release job 的 Windows x64/ARM64、Linux x64/ARM64、macOS Universal/ARM64 构建/包烟测均成功；不是对所有 Windows 10/11 DPI、Wayland/X11 桌面组合的实机认证。 |
| 安装升级 | FAIL | Windows MSI/NSIS 与 Linux 包的安装/卸载烟测通过；macOS DMG/Quick Look 烟测通过。版本升级、重装和偏好/用户数据保留整条生命周期未在当前 tag 验收。签名/公证缺失见 P1。 |
| 数据可靠性 | FAIL（所需故障注入未完成） | 原子保存、外部修改冲突、删除恢复、草稿/会话恢复有测试；本次未模拟磁盘满、进程强杀、配置 JSON 损坏、文件系统只读或数据库锁定。 |
| 性能 | FAIL（运行时性能未实测） | 当前生产构建和 gzip 包体预算通过（main+worker 309 KiB、原生 preview 70 KiB）；没有测冷启动、峰值内存、超大文档、多窗口长时运行的真实数据。 |
| 稳定性 | FAIL（长稳/异常注入未完成） | 436 前端测试、24 Rust 测试、发布 CI 质量门通过；不能据此声称已完成长时间运行/崩溃注入测试。 |
| 安全 | FAIL（发布信任项） | 生产 npm audit 0 高危；release CI 的 RustSec audit 成功；源码模式扫描未找到常见密钥/token。安装二进制未平台签名/公证为 P1；完整 npm audit 有 11 个仅开发工具依赖高危告警为 P2。 |
| 发布产物 | PASS（清单/流水线） | `package.json`、Cargo、Tauri 配置、tag 均为 0.10.25；release 非 draft/prerelease；发布流水线成功生成 `latest.json`、签名更新资产、校验和与 SBOM。Windows/macOS 操作系统级代码信任认证仍不通过。 |

## 实际验证记录

### 本机当前检出 `35cf285`

| 检查 | 结果 |
| --- | --- |
| `npm test -- --run` | 49 个测试文件、436 项通过 |
| `npm run build` | TypeScript 检查和 Vite 生产构建通过 |
| `npm run check:bundle` | 通过；main+worker 309 KiB gzip，native preview 70 KiB gzip |
| `npm run lint` | 通过 |
| `npm run format:check` | 通过 |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 24 项通过 |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` | 通过 |
| `npm audit --omit=dev --audit-level=high` | 0 vulnerabilities |
| `npm audit --audit-level=high` | 失败：11 个高危，限开发/测试依赖链 |
| 常见凭据模式扫描（Git 跟踪文件） | 未发现匹配；此为模式扫描，不等于凭据专用扫描器证明 |
| 原生桌面现场操作 | 未执行：Mac 锁屏且自动解锁失败 |

### 线上发布记录

- Release：[`v0.10.25`](https://github.com/jincaiw/TextMark-v1/releases/tag/v0.10.25)，2026-09-26 发布，正式 release。
- 工作流：[`Release TextMark`](https://github.com/jincaiw/TextMark-v1/actions/runs/36256345116)，Release quality gates、Windows x64/ARM64 安装与卸载烟测、Linux x64/ARM64 包烟测、Fedora RPM/KDE 烟测、macOS DMG/Quick Look 烟测、资产清单与发布全部成功。
- 最新 `main` 分支完整三平台 CI 成功提交是 `678b19ba`（2026-09-24），不是验收 tag `35cf285d`；未将其跨平台 E2E 结果算作当前 release commit 的 E2E 通过。
- README/INSTALL 明示 Windows 无 Authenticode、macOS 无公证；Tauri 更新器使用 Minisign 签名和 HTTPS manifest，更新资产清单和 SHA-256 文件已生成。

## 需要完成后方可解除 P1

1. 配置正式 Windows 代码签名证书与 macOS Developer ID / 公证凭据，对发布产物签名、公证并在干净机器检查 SmartScreen/Gatekeeper 首次启动。
2. 增加并执行 0.10.25 旧版本升级测试：设置及会话数据保持、正常重启恢复、卸载后按产品策略保留或清理数据、重装后行为正确；至少覆盖各平台安装渠道。
3. 解锁验收 Mac 后，现场启动正式安装版，补做桌面 UI/窗口缩放、深浅色、文件关联、查找/编辑/导出主路径的目视和操作验收；这不会取代前两项发布门槛。

## 最终回答

**当前 v0.10.25 是否具备正式发布条件：否。** 核心自动化与当前发布流水线表现合格，但 Windows/macOS 的平台签名/公证和完整升级/数据保留实测仍未满足正式发布要求。本版本目前已在 GitHub 作为正式 Release 发布；本报告结论针对其是否满足本次更严格的商业发布验收标准。
