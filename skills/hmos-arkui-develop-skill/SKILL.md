---
name: hmos-arkui-develop-skill
description: HarmonyOS ArkTS/ArkUI 编码参考，用于编写或修改 .ets 文件、组件、布局、导航、状态管理和动画，或定位 ArkTS 语法及组件参数错误。包含官方 DevEco CLI 随包的 API 卡片与约束索引。
---

# ArkTS / ArkUI 开发

API 卡片与规则来自官方 DevEco CLI 1.3.12。先确认目标设备 API 和工程使用的状态管理模型，再按当前改动查参考，不预读全库。

- [API 索引](references/quick-apis/_index.md)：查组件、方法和参数签名。
- [约束索引](references/quick-rules/_index.md)：查 ArkTS 语法、导入、组件结构、状态与渲染限制。
- [官方编码说明](UPSTREAM.md)：需要判断高频错误时按相关章节查阅。

写 List/Grid/Scroll 同时查布局与渲染规则；写 Navigation 查路由规则；写 V1/V2 状态查对应装饰器规则；弹窗、手势、动画查各自 API 卡片。使用 `rg` 在相应文件定位，不整读大型卡片文件。

随包参考是编写代码的线索；涉及设备范围、权限、精确起始 API 或新增能力，使用 huawei-docs 的当前官方段落核验。不能把某个 SDK 参考中存在接口当成实机支持。

一轮生产改动完整后，从工程目录调用 deveco-cli 的 `check arkts`，修复编译诊断后再 `build`，并验证实际页面或用户流程。命令入口是 deveco-cli skill 的 `scripts/devecocli`；本 skill 也提供同名脚本。不要每编辑一行就重跑全部检查。

遵循当前项目已有命名、owner 和错误边界，不为了满足通用示例添加默认值、兼容层或新状态。测试以真实用户行为与编译器不能证明的边界为准。
