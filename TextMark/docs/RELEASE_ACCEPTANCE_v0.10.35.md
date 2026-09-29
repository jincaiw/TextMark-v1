# TextMark v0.10.35 发布验收

验收对象：TextMark v0.10.35。该版本修正首次启动 What's New 弹窗显示旧版说明的问题。发布 CI 与 GitHub Release 结果待完成后补录。

## 验收摘要

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| 更新内容弹窗 | PASS | 中英文均介绍 v0.10.34 实际交付的长文档目录跳转和工具栏查找改进。 |
| 前端测试 | PASS | 508 项通过；包含中英文更新弹窗文案回归测试。 |
| Lint/格式/构建/包体预算 | PASS | 本机验证通过。 |
| Rust 与依赖安全 | 待发布 CI | cargo test、Clippy、cargo audit 与 npm audit。 |
| 跨平台发布产物 | 待发布 CI | 无 Windows/Linux 真机验证；平台包检查运行于发布 CI。 |
| 发布资产与 updater metadata | 待发布 CI | macOS ad-hoc 签名符合标准；无需 Developer ID、公证或 Gatekeeper 验收。 |

