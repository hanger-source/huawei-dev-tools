---
name: hmos-runtime-fix-skill
description: 修复已有具体日志或堆栈的 HarmonyOS ArkTS/JavaScript 运行时崩溃，包括 TypeError、ReferenceError、BusinessError 等。使用 DevEco Code v0.2.5 的解析脚本与错误模式参考；未知类型故障先用 hmos-dfx-analyzer 分诊。
---

# ArkTS / JavaScript 运行时故障修复

解析脚本和模式参考固定来自 DevEco Code `v0.2.5`。当前宿主直接分析，不启动原 Coding Agent。先从用户日志、堆栈、明确的触发页面或设备 faultlog 取得具体锚点，再定位代码；不要仅凭“白屏”或“闪退”猜根因。

先确认工程 `AppScope/app.json5` 的准确 bundleName，以及用户指定的目标设备。已有日志足以判断时直接使用；缺证据时通过本 skill 的 `scripts/devecocli log --help` 确定采集方式，限定应用、设备和故障时间。不自动清日志或重装应用。

## 解析与模式匹配

从 [官方解析说明](UPSTREAM.md) 查当前输入对应的私有脚本，先看脚本帮助。Node 使用本项目随附运行时；需要让脚本调用 `devecocli` 时，把本 skill 的 `scripts` 目录加入本次命令的 PATH，命令优先级仍由明确路径决定。

- 日志文件：`scripts/parse-jscrash-log.mjs --log-file <path> --bundle-name <name> --include-text`。
- 日志文本：`scripts/jscrash-report.mjs --log-text <text> --bundle-name <name> --include-text`；长日志优先保存到项目已有临时日志目录再按文件解析。
- 按输出的 `status`、`error_type`、`error_message`、`suspected_file`、`top_stack` 定位。解析失败或无 crash signature 时保留未知，明确还缺什么证据，不自动切换采集路径。

先看 [故障模式索引](reference/fault-mode-library.md)，再按错误类型读取对应的 `reference/*_patterns.md`。模式只帮助形成可证伪的解释，不代替当前代码和运行证据。

修复明确的失败链，保留有效诊断日志，不用重试、延时、兼容逻辑或默认值隐藏不清楚的状态。整轮改动后先编译/静态检查，再重走实际触发流程；对偶发问题保留输入和日志并提高复现率。只有实际行为证据成立后才能报告已修复。
