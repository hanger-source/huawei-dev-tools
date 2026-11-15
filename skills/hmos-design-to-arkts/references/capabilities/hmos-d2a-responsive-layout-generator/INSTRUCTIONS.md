# 能力：hmos-d2a-responsive-layout-generator

> CLI 适配：执行本阶段或能力前先读取入口 Skill 根目录的 `references/cli-integration.md`。仅工具与路径按接入约定替换；完整保留本文件的业务步骤、验收、确认和恢复边界。

> design-to-arkts 工作流阶段 5 专用步骤：将绝对位置 DSL 转为响应式布局 DSL。仅由 design-to-arkts 工作流显式调度，不响应独立请求。

## 概述

- **输入**：嵌套树 DSL（`page` + `ui.children[]` 递归，节点带 `meta.bbox` 绝对位置）
- **输出**：在同一嵌套树上为每个节点生成 `responsive` 配置与断点策略，写入阶段 5 设计文档的组件树结构图（内嵌 `layoutStrategy` + `responsive`），不产出独立 DSL 文件
- **前置**：输入 DSL 包含容器尺寸与组件绝对位置

完整字段定义见 [references/dsl-schema.md](references/dsl-schema.md)。

## 执行模式

- 一次性执行全部步骤，不在中间步骤等待用户确认
- 步骤 2.5 的不确定事项向用户确认；确认后按结论继续，不回退

## 步骤定义

### 步骤1：解析输入嵌套树DSL

- 递归遍历 `ui.children[]`，为每个节点确定唯一 id（无 id 时按"深度-序号"生成，如 `L1-2`），收集 `meta.bbox` 与父子层级
- 输出：扁平化组件列表（供布局分析）、原始嵌套树（供输出重组）、id ↔ 树路径映射

### 步骤2：分析组件位置关系

- 输出 4 类关系分析：水平/垂直对齐、间距分布、网格结构、重叠区域
- 识别阈值见 [references/rules.md](references/rules.md)

### 步骤2.5：不确定事项确认

- 触发：布局推断置信度 < 0.8，或存在多种等效方案
- 向用户确认 3 类问题：布局模式（网格还是线性）、断点参数（列数/间距/显隐）、小屏方向（row 还是 column）

### 步骤3：推断布局策略

- 为每个容器节点（根节点及含 children 的节点）推断布局类型（flex / grid / stack / mixed）、对齐与间距
- DSL 模板见 [references/patterns.md](references/patterns.md)

### 步骤4：生成响应式布局DSL

- 按步骤 3 的策略为嵌套树上每个节点生成 `responsive` 配置
- 组件数 ≥ 8 时分块生成：先在上下文中生成骨架（metadata、page、layoutStrategy、breakpoints，`ui.children` 为空数组），再逐块生成、按 id 回填；每块 ≤ 7 个组件，细则见 [references/chunks.md](references/chunks.md)

### 步骤5：断点适配优化

- 按断点为节点补充 `breakpointOverrides`（按 id 精确指定）
- 断点值与适配规则见 [references/breakpoints.md](references/breakpoints.md)

### 步骤6：写入设计文档

- 将最终组件树结构图（内嵌 `layoutStrategy` + `responsive`）与响应式布局策略写入阶段 5 设计文档

## 硬约束

- 保留输入的原始字段（`children[]`、`meta.bbox`、`content`、`src`、`styles` 等），只增不改
- 百分比值用字符串（`"100%"`），固定值用数字（`48`）
- 组件 id 全局唯一；断点名称只用 xs / sm / md / lg / xl
- 组件的断点调整通过 `breakpointOverrides` 按节点 id 指定，不做整表覆盖
- 断点区间以 [references/breakpoints.md](references/breakpoints.md) 为唯一来源
- componentName 使用标准 ArkUI 类型名称，属性名使用 camelCase

## 参考文件

| 文件 | 用途 |
|------|------|
| [references/dsl-schema.md](references/dsl-schema.md) | 输入/输出 DSL 字段定义（唯一形状来源） |
| [references/rules.md](references/rules.md) | 布局识别阈值与边界情况 |
| [references/patterns.md](references/patterns.md) | 4 种布局 DSL 模板与最小示例 |
| [references/breakpoints.md](references/breakpoints.md) | 断点值、方向切换与网格列数（唯一断点来源） |
| [references/chunks.md](references/chunks.md) | 分块生成与回填约束 |

## 检查清单

- [ ] 组件位置关系分析完成，边界情况已按 rules.md 处理
- [ ] 每个容器节点有 layoutStrategy，每个叶子节点有 responsive
- [ ] 断点配置覆盖目标断点，取值为官方区间（320/600/840/1440）
- [ ] 原始字段无丢失，id 无重复，输出 JSON 可解析
- [ ] 组件树结构图已写入阶段 5 设计文档

## 错误处理

- 输入缺失必需字段（page / width / height / ui / children）或 JSON 不可解析：停止执行，报告具体缺失项
- 分块生成失败（截断/格式错误）：仅重新生成该块，不影响已完成分块
