---
name: hmos-design-to-arkts
description: 将 Pixso、Figma 设计稿、导出的 DSL、截图及资源转换为 HarmonyOS ArkTS 页面。包含官方 DevEco CLI 1.3.12 的设计转换、组件参考与视觉校准资源；用于鸿蒙设计还原，不用于一般网站生成。
---

# 设计稿转 ArkTS

参考和脚本固定来自官方 DevEco CLI `1.3.12` 的设计引擎资源。当前宿主通过本 skill 的 `scripts/devecocli` 调用同版本 CLI，不启动另一套 Coding Agent。

先确认设计来源、目标页面/节点、工程路径、功能要求和设备 API；先从现有工程与用户提供的设计内容查清，只有影响实现且无法查到的信息才向用户询问。复用用户已经指定的设计工具连接，不自动切换来源或安装服务。

## 设计输入

- Figma / Pixso：检查当前宿主实际可用的对应工具，并验证目标节点可读；不要因为工具名称存在就假定具备文件权限。
- 用户提供的 DSL、截图与本地资源：直接检查输入完整性，不要求额外配置 MCP。
- 缺少必须的连接时说明具体缺口；用户已授权配置时执行对应配置，否则保持问题在具体连接上，不重装其他 Agent。

来源约束按需查 [需求字段](references/requirement-clarification.md)、[MCP 依赖](references/mcp-dependency.md) 和 [CLI 接入约定](references/cli-integration.md)。使用当前宿主可用的连接能力。当前引擎仅声明 Pixso/Figma 来源；用户指定其他来源时先查官方当前支持范围，不把其他来源的数据冒充它们。

## 完整交付

默认目标是完整页面、交互与实机验证。按现有项目的导航、状态 owner、模块和命名边界实现；不要为了先展示结果制造空壳页面或双轨状态。

官方 CLI 的转换能力先查 `scripts/devecocli design2arkts --help`；完整流程从 `d2a --output json workflow` 返回的 `instructionPath`、`integrationPath` 和 `skillRoot` 开始，按 CLI 当前资源执行。需要设计理解、组件映射、逻辑补全或视觉校准时，从 [能力注册表](UPSTREAM.md) 找到对应 `INSTRUCTIONS.md`，只读本轮所需能力；能力内相对路径以该能力目录为根。

当前宿主不读取 DevEco Code 的日志来判断模式，不依赖原宿主 `todowrite` 工具，也不自动启动子 Agent。执行前显式确认本轮目标与产物，用当前任务状态记录推进。上游 Controller 的目录、产物与输入契约可查 [运行契约](references/runtime-contract.md)；不要运行只适用于原宿主的编排来替代实际工作。

写 ArkTS 时使用 hmos-arkui-develop-skill 的 API/规则卡片，新增接口再用 huawei-docs 核验 API 和设备限制。生产改动整轮完成后，先 `check arkts` 和 `build`，再在目标设备上比较实际页面、设计参照和交互结果。

视觉比较使用相同窗口尺寸、缩放与状态，记录具体差异再修正。屏幕截图、节点文本或操作命令成功不能单独证明交互闭环。外部设计服务不可访问、素材缺失或设备能力不足时，保留已完成产物并报告未完成部分，不能给出还原已通过的结论。
