---
name: hmos-dfx-analyzer
description: 分析 HarmonyOS 应用崩溃、冻屏、ANR 与白屏，使用 DevEco CLI 故障识别和官方专项分析参考。适用于 faultlog、CppCrash、JSCrash、AppFreeze；普通编译错误、HiLog 流水、内存泄漏和常规性能问题使用对应开发或测试工具。
---

# HarmonyOS 故障分析

识别脚本和专项参考来自官方 DevEco CLI 1.3.12。当前会话直接完成分析，不自动启动子 Agent。先确认目标应用、设备、故障时间和现有证据；保留原始日志，避免采集无关进程或时间段。

## 选择证据入口

- 已有单份 faultlog：调用本 skill 的 `scripts/devecocli log --crash --path <文件> --format json`。
- 已有采样栈：使用 `log --stack --path <文件> --format json`。
- 粘贴日志：使用本 skill 自带 `scripts/identify_fault_log.py --help` 确定 stdin 参数后识别。
- 只有症状：先看 `devecocli log --help` 确认采集能力，按故障时间和包名取证。白屏也可能是进程仍存活的 UI 问题，不直接当作崩溃。

使用工具的结构化识别结果选择专项分析；识别失败时报告具体错误并修复输入或工具前提，不自动换另一条路径掩盖失败。未知故障与范围外输入应保留为未知，不能猜定类型。

## 按类型读取参考

- C++ 崩溃：[cppcrash](references/cppcrash/analyzer.md)
- JS 崩溃：[jscrash](references/jscrash/analyzer.md)
- 冻屏/ANR：[appfreeze](references/appfreeze/analyzer.md)
- 白屏：[white-screen](references/white-screen/analyzer.md)

只读取命中的专项参考以及它直接需要的脚本/资源。需要报告格式或证据配对细节时，按章节查看 [官方分析说明](UPSTREAM.md)。原文中的原宿主子 Agent 编排与自动切换路径不作为当前宿主的执行规则。

结论区分日志直接证明的事实、代码对应关系、尚待验证的推断。修复后重走触发路径；一次未复现不能证明偶发问题消失。报告写到当前项目已有输出目录，或用户指定位置，不上传原始日志。
