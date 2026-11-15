# 能力：hmos-d2a-arkui2hds

> CLI 适配：直接输入独立调用先读取返回的 `integrationPath`；工作流及 `--run` 调用先读取入口 Skill 根目录的 `references/cli-integration.md`。仅工具与路径按接入约定替换；完整保留本文件的业务步骤、验收、确认和恢复边界。

> 将 ArkUI 基础组件或自定义组件替换为 HDS 组件。可由 design-to-arkts 工作流调度，也可通过 `devecocli d2a arkui2hds` 单独调用。

本能力帮助外部应用将ArkUI基础组件或自定义组件替换为HDS（UI Design Kit）组件。

## 独立调用

直接提供本能力所需文件，不要求 D2A run：

```bash
devecocli d2a arkui2hds --project <工程> --page <已有ETS> --output json
```

返回 `inputMode=direct` 时，按[直接输入协议](../../standalone-capabilities.md)对应能力小节和本文件的业务步骤执行；不执行下面的 `--run` 分支，不补造来源截图、导入记录、Controller 或阶段上下文。`integrationPath` 指向直接输入协议。已有 D2A 页面仍使用返回的受保护修订策略。

以下兼容分支**仅适用于显式传入 `--run`**：

```bash
devecocli d2a arkui2hds --project <项目> --run <runId> --page-name <页面名> --output json
```

命令校验 run 输入、已导入页面及文件摘要后，返回 `status=ready-for-agent` 的指引上下文。当前 Agent 读取 `inputs.page` 指定的页面，执行下文的组件识别、接入方式选择、替换和检查；命令本身不调用模型或修改工程。

- 将工作副本、方案和报告保存到返回的 `workDirectory`。先确认当前 SDK、工程依赖支持目标 HDS 组件；不确定的属性按下文规则核对，不以替换完成代替编译成功。
- 不要求重新提供设计链接或来源 MCP，不重新获取来源或初始化 Controller，不补造前序 Gate、确认或 ledger。独立入口仅接受无 Controller 或已完成 Controller 的 run；进行中、阻塞或等待确认的完整流程应从原阶段恢复。完整流程调度本能力时，仍遵守原阶段的确认、验收和记录。
- 在工作副本完成转换，再按 [页面修订](../../page-revisions.md) 保存候选、审阅 dry-run 并在授权范围内 apply；图片修订遵守 [资源修订](../../resource-revisions.md)。修订命令使用原 `runId`，不先改工程文件再补写哈希，不把独立调用目录当成新的 run。
- 替换仅覆盖用户选定页面和组件，保持原通用布局属性、图片名称及行为。目标需要新增资源、改动其余页面或调整工程依赖时，明确这些不属于页面修订计划，不能把它们混入受保护页面的写入操作。
- 返回实际替换的组件、候选与写入计划路径、检查及构建结果、未支持项。候选尚未应用或构建未运行时如实说明；不改写原 Controller 或把独立结果记为总流程阶段通过。

## 目录

- [适用场景](#适用场景)
- [快速开始](#快速开始)
- [重要原则](#重要原则)
- [详细参考](#详细参考)

## 适用场景

| 生态伙伴实现方式 | 目标场景 | 场景详情 | 预估开发者场景比例 | 支持方案 |
| ---------------- | --------- | -------- | ------------------ | -------- |
| ArkUI实现 | 组件平替 | 原本使用的标准Toolbar、Tabs、Navigation等组件平替HDS组件 | 20% | 识别代码仓目标界面的代码，将标准组件替换HDS组件并补充相关属性支持 |
| ArkUI实现 | 重构替换 | 自定义实现Toolbar、Tabs和Navigation等组件重构后使用HDS组件替换 | 80% | 识别代码仓目标界面的代码，将原组件实现进行提取重构，并支持通过开关切换使用HDS组件 |
| RN实现 | 重构替换 | 使用Web实现的效果移除并替换为ArkTS的方式重新实现 | 待确认 | 不支持（将原本的Web实现替换为ArkTS实现会破坏代码跨平台效果） |

## 快速开始

### 基本流程

1. 识别目标界面中的组件（标准组件或自定义实现）
2. 选择接入方式（组件平替或重构替换）
3. 替换为对应的 HDS 组件
4. 配置 6.1 新特性（必配项见「重要原则」，divider 为推荐默认）
5. 调整样式以匹配设计规范

## 重要原则

### 不随意添加属性

在将基础组件替换为HDS组件时，必须严格遵循以下原则：

1. **严格按照示例添加属性**
   - 不凭空捏造属性名称或参数
   - 不基于经验推测属性的存在

2. **只配置必须的 HDS 特有属性**
   - **HdsTabs**：必配 `.barOverlap(true)`（悬浮前提）与 `.barFloatingStyle({ systemMaterialEffect: { materialType: hdsMaterial.MaterialType.IMMERSIVE, materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE } })`（systemMaterialEffect 嵌套于 barFloatingStyle 内）；推荐默认 `.divider({ mode: DividerMode.FOLLOW_SCROLL, style: { strokeWidth: 0.5, color: 0x1A000000 } })`（strokeWidth 与 color 只能写在 style 内，见下方反例）
   - **HdsNavigation / HdsNavDestination**：titleBar style 必配 `scrollEffectOpts.scrollEffectType: ScrollEffectType.IMMERSIVE_GRADIENT_BLUR` 与 `systemMaterialEffect`（style 直下属性，与 HdsTabs 的嵌套位置不同）
   - 其余属性保持和原版一致的配置即可
   - 不确定的属性宁可不要添加

3. **避免类型错误**
   - 很多属性需要特定类型（如 LengthMetrics、ColorMetrics），不能直接使用 number 或 string
   - 如果添加属性后出现类型错误，说明该属性可能配置有误或不应添加
   - 删除不确认的属性，而不是尝试"修复"它

4. **核心原则**
   - **不轻易添加没根据的属性**
   - 本来能运行的代码切换后不应该直接编译报错
   - 切换组件后保持代码可编译、可运行是第一优先级

**反例（真实编译报错，出现即删除该属性，不要尝试修复）：**

```typescript
// ❌ strokeWidth/color 不能写在 divider 顶层
//    报错：'strokeWidth' does not exist in type 'HdsDividerStyle'
.divider({ mode: DividerMode.FOLLOW_SCROLL, strokeWidth: 1, color: '#E5E5E5' })
// ✅ 只能嵌套在 style 内
.divider({ mode: DividerMode.FOLLOW_SCROLL, style: { strokeWidth: 0.5, color: 0x1A000000 } })

// ❌ barFloatingStyle 不存在 floatingType/borderWidth/borderColor/borderRadius/backgroundColor
//    报错：'floatingType' does not exist in type 'HdsTabsFloatingStyle'
.barFloatingStyle({ floatingType: 1, borderWidth: 1, /* ... */ })
// ✅ 只保留官方示例出现过的 systemMaterialEffect（及 barBottomMargin/barSideMargin/gradientMask）
```

### 通用属性保持不变

在将基础组件替换为HDS组件时，必须遵循以下原则：

1. **通用属性保持原有配置不变**
   - 基础组件的通用属性（如 width、height、backgroundColor、padding、margin 等）在替换为 HDS 组件后，必须保持原有的参数配置不变
   - 这些通用属性不是 HDS 特有属性，不应在替换过程中被修改

2. **HDS 特有属性需要新增配置**
   - 仅对 HDS 特有的属性（如 barFloatingStyle、systemMaterialEffect、divider 等）进行新增配置
   - 不应修改已有的通用属性配置

3. **示例**
   ```typescript
   // 原代码
   Tabs({ index: this.currentIndex }) {
     // ...
   }
   .width('100%')        // 通用属性，保持不变
   .height('100%')       // 通用属性，保持不变
   .barPosition(BarPosition.End)  // 通用属性，保持不变；悬浮页签栏仅在 `barPosition(BarPosition.End)` 且 `vertical(false)` 时生效

   // 替换后
   HdsTabs({ index: this.currentIndex, controller: this.tabsController }) {
     // ...
   }
   .width('100%')        // 保持原有配置不变
   .height('100%')       // 保持原有配置不变
   .barPosition(BarPosition.End)  // 保持原有配置不变
   // 新增 HDS 特有属性（严格按照官方文档示例）
   .barOverlap(true)
   .divider({ mode: DividerMode.FOLLOW_SCROLL, style: { strokeWidth: 0.5, color: 0x1A000000 } })
   .barFloatingStyle({ /* 完整形态见 references/components.md 的 HdsTabs「悬浮页签栏与材质效果完整形态」 */ })
   ```

## 详细参考

- **HDS 组件清单、替换映射与组件级配置示例**（含 6.1 新特性、可选属性与枚举取值）：见 [components.md](references/components.md)
- **接入方式与完整前后示例**（平替/重构两种方式）：见 [migration-patterns.md](references/migration-patterns.md)
- 防虚构反例已内联在本文「重要原则」节；HdsTabs 悬浮/材质完整形态见 references/components.md 的 HdsTabs「悬浮页签栏与材质效果完整形态」
