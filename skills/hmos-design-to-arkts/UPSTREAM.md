---
name: hmos-design2arkts
description: 处理 Pixso 或 Figma 设计稿转 HarmonyOS ArkTS 代码的任务。当用户使用 `$hmos-design2arkts` 或 `$hmos-d2a`、提供 Pixso/Figma 链接、Pixso 客户端选中节点、设计稿 DSL/截图/本地资源，或要求把 UI 设计稿转换为 ArkTS 时，必须使用本 skill。
---

# hmos-design2arkts（别名 hmos-d2a）

按需入口 `devecocli d2a workflow --output json` 返回本文件及 CLI 接入约定的位置，无需安装专用 Skill。`<designToArktsSkillRoot>` 使用返回的 `skillRoot`（显式安装时可使用实际安装根目录）；所有阶段与能力资源按下文规则读取，产物不写入 Skill 目录。

## 独立能力入口

用户只要求视觉校准、HDS 迁移、Figma JSX 转换或页面方案设计时，可分别调用 `devecocli d2a scoring-workflow`、`arkui2hds`、`react-to-arkui`、`solution-design`，可直接传入参考图、页面或 JSX 等本能力所需输入，无需预先创建 run；通过 `--help` 查看参数。读取返回的 `invocationPath`、`integrationPath` 和 `instructionPath`，由当前 Agent 按独立模式执行；`ready-for-agent` 仅表示入口准备完成。这些调用不进入下文的完整工作流预检或 Controller 初始化，仍遵守输入真实性和导入写入保护。完整设计转代码任务继续使用下文流程。

## 需求预检与澄清

任务开始时，必须先对用户输入进行需求预检。预检与必要澄清完成前，不得选择、读取或执行任一 workflow。

已能判定设计来源时，先按 [MCP 依赖检查](references/mcp-dependency.md) 检查当前宿主 Agent 或 CLI 的来源入口。依赖缺失时先给出连接引导，暂停页面功能等需求澄清和工作流初始化；Pixso 完全本地输入按该文档记录豁免。

预检原则：只问无法通过探索项目目录或读取设计稿自行发现的信息；能自己查到的不问用户。必须同步一次性向用户提出所有未明确项的澄清问题，不得逐条分次询问。

预检项：设计来源、目标页面/节点、项目路径、功能描述。设计来源只分为 `pixso` 和 `figma`；Pixso 链接、Pixso 选中节点及开发者提供 Pixso DSL 都属于 `pixso`，带 file key 与 `node-id` 的 Figma URL 属于 `figma`。详细字段映射见 `references/requirement-clarification.md`。

预检完成后必须生成需求澄清文档，由阶段 1 写入运行目录的 `requirement-clarification.json`。

## 选择工作流

先选择设计来源：Figma `design/file` URL 且含 file key 与 `node-id` → `figma`；Pixso 链接、Pixso 选中节点或开发者提供 Pixso DSL → `pixso`。同时提供两种来源、来源无法识别或 Figma 缺少 `node-id` 时先一次性澄清，不得猜测。当前不支持在同一个 run 中混合来源。

1. 用户同时传入 `--fast --full`：参数冲突，停止，提示"请输入 `--fast` 或 `--full`"。
2. 用户仅输入 `--fast`：使用 Fast variant。
3. 用户仅输入 `--full`：使用 Full variant。
4. 用户未指定时，读取项目 D2A 配置的 defaultVariant；配置不存在时采用 fast，并说明本次选择。不读取 DevEco 专属日志来推断其余 Agent 的模式。

选择后由 `workflow-state.json.designSource` 和 `.variant` 共同锁定，恢复时不得重新识别来源或切换 catalog。

variant 确定后、创建 run 和执行 Controller init 前，确认来源依赖检查已通过或适用本地输入豁免。阶段 1 再复核并将真实结果写入 `inputs-manifest.json.mcpDependencyCheck`。工具或绑定存在不代表已连接，获取成功以实际调用结果为准。

## CLI 适配与运行目录

开始流程前必须读取 [CLI 接入约定](references/cli-integration.md)。该文件只适配工具、路径和宿主能力，不跳过任何阶段、确认、验收、能力调用或恢复步骤。再执行 `devecocli d2a doctor --project <项目路径> --output json`。

执行 `devecocli d2a run create --project <项目路径> --source pixso|figma --variant fast|full --output json`，记录返回的 runId 和 runDirectory。run.json 只保存工具产物归属；本 Skill 的 scripts/workflow.mjs 独占 workflow-state.json，不存在 CLI 阶段状态机。

- 两种 variant 默认运行目录为 `.deveco/design2arkts/runs/<UUID>/`；`.deveco/d2a/` 或旧 `.deveco/design2arkui/` 按 CLI 的选择复用，以返回的 runDirectory 为准。阶段与能力文件中的 designToArktsRunDir/designToArktsFastRunDir/designToArktsFullRunDir 占位符全部替换为返回的同一个 runDirectory。
- Pixso 阶段 2 必须提交真实 route-registration 证据并由 Controller 验收登记；Figma 保持原登记时机。流程路由索引为该数据目录下 `skill-run-index-full.json` 或 `skill-run-index-fast.json`，由 Controller 管理。CLI 的 import-history.json 独立记录成功导入的文件归属，保护跨来源和 variant 的页面与资源。
- Pixso Engine 只由 CLI 的 `export arkts-page` 执行。Figma 使用真实可用的来源 MCP 和完整 react-to-arkui 能力，不能声称有确定性 Figma codegen。

## Controller 操作

Controller 脚本：`<designToArktsSkillRoot>/scripts/workflow.mjs`。五种操作：

| 操作 | 命令 | 作用 |
|---|---|---|
| init | `--mode init --source pixso\|figma --variant full\|fast --run-dir <runDir>` | 锁定来源和 variant，初始化状态和 Todo；省略 source 仅为兼容旧调用，默认 pixso |
| status | `--mode status --run-dir <runDir>` | 查看状态、重建 Todo、恢复入口 |
| stage-start | `--mode stage-start --run-dir <runDir> --stage <N>` | 校验后返回当前阶段 instructionPath |
| confirm | `--mode confirm --run-dir <runDir> --stage <N> --decision request\|accepted\|revision-requested` | 管理用户确认状态 |
| stage-complete | `--mode stage-complete --run-dir <runDir> --stage <N> --result passed\|blocked [--reason-code <code>]` | 校验、生成 Gate、推进状态和 Todo |

详细协议见 `references/runtime-contract.md`。

## design-doc.md 缺失自动恢复

当任意 Controller 调用返回 `nextRequiredAction=regenerate_design_doc` 或 `nextRequiredAction=resume_design_generation` 时：

1. 即使命令退出码为 1，也必须读取 stdout 中的结构化 JSON。
2. 两种恢复动作都必须先校验 `recovery.recoveryInvocationId` 存在且非空；缺失时阻塞，不得自行生成替代 ID。
3. 加载 `recovery.instructionPath` 指向的恢复指令（`references/design-doc-auto-recovery.md`），按 `recovery.strategy` 分流。
4. 不询问用户，不结束当前工作流。禁止入口 Agent 创建、覆盖或编辑 `<runDir>/design-doc-recovery-request.json`；该文件只能由 Controller 写入。
5. `regenerate_design_doc`（`strategy=restore_document`，仅文档丢失、权威输入完整）：按恢复指令以 `recovery.recoveryInvocationId` 调用 `hmos-d2a-solution-design` 的 `restore_missing_design_doc` 修复模式，只写回当前 Run 的 `design-doc.md` 和 ledger。
6. `resume_design_generation`（生成流程被遗漏）：Pixso 恢复当前阶段 5 指令（`recovery.stageInstructionPath`）中的方案设计子流程，不调用阶段 5 的 Controller 命令、不修改 workflow state 和 Gate。Figma 读取 Controller payload 中的 `recovery.operation=restore_design_artifacts` 和 `recovery.stopAfterDesign=true`，调用 `hmos-d2a-react-to-arkui`（`recovery.runStatePath`）时必须转换为：`operation=restore_design_artifacts`、`stop_after_design=true`、`recovery_invocation_id=<recovery.recoveryInvocationId>`；不得把 `stopAfterDesign` 作为能力参数原样传入。Figma 的 design-only 恢复由 React-to-ArkUI 负责组件树并保持 run state 原 phase，不得传 `resumePhase=analyzing`，不进入实现、构建或路由修改。两者都必须以成功调用并完成 `hmos-d2a-solution-design` 为继续条件。
7. 校验 `design-doc.md` 已恢复且内容合法，并确认恢复指令列出的只读产物未被修改。
8. 成功后只能按 `recovery.retry` 重试原 Controller 操作，不询问用户是否继续，不得自行决定阶段跳转或改做其余 Controller 操作。
9. 同一次恢复最多自动执行一次恢复子流程；恢复失败或重试后仍返回 `design_doc_invalid` 时，停止自动循环并报告真实阻塞。
10. Controller 返回 `design_stage_evidence_incomplete` 时不提供可执行恢复动作：上游证据或 checkpoint 不足、阶段已越过安全恢复点，或旧 Run 方案证据不完整。按真实阻塞报告，不得手写文档或回退阶段。Pixso Full 阶段 5 已完成且用户确认过的组件树缺失时固定返回该错误，不得补造组件树。
11. Controller 返回 `design_doc_recovery_unverified` 时立即停止：不得重新生成 recoveryInvocationId、不得修改 `design-doc-recovery-request.json`、不得伪造 ledger 记录，按真实阻塞报告并交还用户。

`design-doc.md` 的唯一写入者是 `hmos-d2a-solution-design`：入口 Agent、Controller、`hmos-d2a-react-to-arkui` 和其余任何能力都不得手写、补造或重写该文件。该规则优先于普通错误处理：非零退出码不得先触发停止或向用户报告，必须先检查 stdout 中的 `nextRequiredAction`。这两个动作只适用于 Figma Fast 与 Pixso Full/Fast；Figma Full 的确认快照错误（`confirmation_snapshot_invalid`）仍走 revision 与重新确认语义。

## 按阶段加载规则

- 选定来源和 variant 后读取 `references/runtime-contract.md` 及 Controller 选中的 catalog。Pixso catalog 位于 `references/pixso/stage-catalog-*.json`，Figma catalog 位于 `references/figma/stage-catalog-*.json`。
- 执行 `stage-start` 前不得读取任何阶段文件。
- 正常执行时，只读取成功的 `stage-start` 输出的 `instructionPath` 指向的当前阶段文件。
- 恢复例外：`status` 返回 `nextRequiredAction=resume_confirmation` 时，只恢复原确认问题；返回 `nextRequiredAction=resume_confirmed_stage` 时，只依据阶段内部 checkpoint 继续确认后的余下实现。两种情况都可以读取该次 `status` 返回的当前阶段 `instructionPath`，但不得视为新的阶段入口，不得再次调用阶段入口 `todowrite`，不得重新生成已完成产物。
- 不得预读后续阶段、另一 variant 或另一设计来源的阶段文件。
- 摘要不一致时（controller 返回 `workflow_digest_mismatch`）必须停止并重新初始化。

## Todo 同步规则

- `stage-start` 成功后，读取其 `instructionPath`。阶段 reference 的第一项动作必须读取 `todoPayloadPath` 指向的 JSON 文件，将文件中的 `.todos` 原样提交给 `todowrite`；同步成功前不得执行任何阶段工作。
- 普通 `stage-complete --result passed` 后不得调用 `todowrite`；立即对新的 `currentStage` 执行 `stage-start`，由下一阶段入口同步 Todo。
- 最终 `stage-complete --result passed` 后没有下一阶段，必须按最终阶段 reference 将全量 completed payload 提交给 `todowrite`，再输出最终回复。
- 不判断 Todo UI 是否已经更新。每个阶段入口固定调用一次，重复提交同一完整列表视为安全的幂等重放。
- `init` 后不要单独调用 `todowrite`，否则会与阶段 1 入口重复。
- `status` 返回什么动作就按什么动作分流，不能无条件执行 `stage-start`：
  - `stage_complete` → 读取 `completionResult`，`passed` 时调用 `stage-complete --result passed`，`blocked` 时调用 `stage-complete --result blocked --reason-code <reasonCode>`（当前阶段有 pending Gate 或已确认时）
  - `running` → `stage_start`
  - `completed` → 读取 `todoPayloadPath` → `todowrite` → 最终回复
  - `blocked` → 报告并解决 `blockedReasonCode`，不得静默恢复 `running`
  - `awaiting_confirmation` → 恢复原确认问题，不重新执行阶段入口 Todo 同步

## 用户确认规则

- catalog 中 `requiresConfirmation=true` 的阶段需要用户确认。
- Pixso Full 仅阶段 5 需要确认；Figma Full 仅阶段 2 需要确认；Fast 均不确认。
- Agent 不得直接修改 `workflow-state.json`。确认状态由 Controller 通过 `confirm --decision` 管理。
- 生成并校验待确认产物后、向用户展示确认问题前，调用 `confirm --decision request`。Controller 将状态设为 `awaiting_confirmation` 并返回 `await_user_confirmation`，然后展示已有产物和固定确认选项并等待用户选择。
- Pixso Full 用户确认后，`accepted` 返回 `stage_complete`，直接完成阶段。Figma Full 阶段 2 的确认发生在实现之前，catalog 使用 `confirmationContinuesStage=true`；`accepted` 返回 `resume_confirmed_stage`，必须在不重新 `stage-start`、不重复 Todo 的情况下继续 `hmos-d2a-react-to-arkui` 实现和初次构建，全部完成后才能 `stage-complete`。
- 用户要求修订时，调用 `confirm --decision revision-requested`，Controller 恢复 `running`、保持 `currentStage` 不变，返回 `stage_start`；随后重新 `stage-start` 当前阶段。
- 组件树不正确时停留修订，不得跳过确认。

## 跨流程禁止事项

- Pixso 沿用阶段指令的 `Index.ets` 稳定启动壳；Figma 保留阶段 1 实际读取的启动页、入口 Ability 和页面配置（例如 `pages/Index` 或 `pages/Home`），不得强制迁移到 Index。新页面使用独立文件和可导出的 `@Component`，按项目现有导航或路由机制注册；不得新增竞争性启动 `@Entry`、绕过原启动入口，或静默覆盖、切换默认页。Figma 阶段 1 通过后由 Controller 锁定工程接入快照，不得修改快照或 Gate 消除校验错误。
- 标准 ArkUI `Navigation` 必须持有并传入 `NavPathStack`（`Navigation(this.navStack)`）；禁止无参数 `Navigation()`；不需要路由时用 `Column`/`Stack`。
- `blocked` 状态不得静默改回 `running`；blocked 通过 `stage-complete --result blocked --reason-code <code>` 由 Controller 设置 `blocked` 状态。Agent 不得自行创建、修改或覆盖 stage gate。
- 不得批量完成、预写或跳过后续 gate。
- Agent 不创建 Gate。Gate 由 Controller 根据 `stage-complete --result` 自动生成。
- 纠错与删除边界（约束入口 Agent 与所有子 Agent）：本条仅在写错路径或产物异常的纠错场景适用——此时只允许删除或覆盖本 run 目录内本工作流自建的产物；严禁对工程根目录、模块源码目录及 run 目录之外的任何既有文件（含代码文件）执行删除、递归删除或重建，不得以"修正写错路径"为由扩大删除范围；任何删除命令执行前必须核对目标路径位于 `<runDir>` 内或属于明确的本次自建产物清单。正常阶段按各阶段产物清单修改源码不受本条限制；子 Agent 的写入与删除范围由各阶段模板的边界条款约束。

## 能力注册表

调度语义：阶段指令或独立子命令要求"加载能力 X"时，读取 X 的 INSTRUCTIONS.md 全文并按对应调用模式执行；不经 skill 工具（本 skill 是系统内唯一 d2a 身份）。完整工作流执行前按 ledger 规则记录调用条目：ledger 文件整体为 JSON 数组、每项一条调用记录（也可用 `{"invocations": [...]}` 包裹，禁止 `entries` 等其余包裹键）；条目 JSON 键固定为 "capability"、值为能力名（Controller 兼容读取旧 "skill"/"skillName"），不得改用其余字段名。独立调用使用命令返回的工作目录及能力内的记录约定，不回填完整工作流 ledger 或 Gate。

路径解析约定：能力 INSTRUCTIONS.md 内的相对路径（如 references/、scripts/、assets/）相对于该能力目录（即 `references/capabilities/<能力名>/`）解析，不相对于入口 skill 根目录。能力目录路径见下表「指令路径」列的目录部分。

子 Agent 模板约定：模板由主 Agent 实例化后作为 task prompt 发送——先把模板中的输入名、`<designToArktsSkillRoot>` 与 `<designToArktsRunDir>` 等占位符替换为实际值；模板内 `references/…` 路径相对本次使用的 skillRoot。

| 能力名（= ledger 键值） | 职责 | 指令路径 | 关键脚本 | 调用约束 |
|---|---|---|---|---|
| hmos-d2a-react-to-arkui | Figma 阶段2 React→ArkUI 转换 | references/capabilities/hmos-d2a-react-to-arkui/INSTRUCTIONS.md | — | Figma 流程或独立 react-to-arkui；内部需加载 solution-design |
| hmos-d2a-solution-design | 设计方案 design-doc.md（唯一写入者） | references/capabilities/hmos-d2a-solution-design/INSTRUCTIONS.md | — | Pixso 阶段5 / Figma 经 react-to-arkui / 独立 solution-design |
| hmos-d2a-ui-reconstruction-score | 单轮还原度评分 | references/capabilities/hmos-d2a-ui-reconstruction-score/INSTRUCTIONS.md | scripts/ui_score.py | 仅被 scoring-workflow 调用 |
| hmos-d2a-arkui-scoring-workflow | 多轮视觉校准评分循环 | references/capabilities/hmos-d2a-arkui-scoring-workflow/INSTRUCTIONS.md | — | 视觉校准阶段或独立 scoring-workflow |
| hmos-d2a-repo-understand | 仓库结构理解 | references/capabilities/hmos-d2a-repo-understand/INSTRUCTIONS.md | — | Pixso 阶段3 |
| hmos-d2a-arkts-logic-completer | 交互逻辑补全 | references/capabilities/hmos-d2a-arkts-logic-completer/INSTRUCTIONS.md | — | Pixso/Figma 阶段7(Full)/3(Fast) |
| hmos-d2a-arkui2hds | HDS 材质迁移 | references/capabilities/hmos-d2a-arkui2hds/INSTRUCTIONS.md | — | Figma 阶段4 / Pixso 阶段8（质量构建）或独立 arkui2hds |
| hmos-d2a-responsive-layout-generator | 响应式布局生成 | references/capabilities/hmos-d2a-responsive-layout-generator/INSTRUCTIONS.md | — | Pixso 阶段5 条件加载 |

## 关键引用

- 运行时契约：`references/runtime-contract.md`
- design-doc.md 缺失自动恢复：`references/design-doc-auto-recovery.md`
- Pixso Full catalog：`references/pixso/stage-catalog-full.json`
- Pixso Fast catalog：`references/pixso/stage-catalog-fast.json`
- Pixso Full 阶段目录：`references/pixso/full/stages/`
- Pixso Fast 阶段目录：`references/pixso/fast/stages/`
- Figma Full catalog：`references/figma/stage-catalog-full.json`
- Figma Fast catalog：`references/figma/stage-catalog-fast.json`
- Figma 阶段目录：`references/figma/full/stages/`、`references/figma/fast/stages/`
- 需求澄清文档规范：`references/requirement-clarification.md`
- MCP 依赖检查指引：`references/mcp-dependency.md`

## 私有 Skill

`d2a register --skill <目录> --replace hmos-design2arkts` 或 `--before/--after resolve|export|preview|inspect|import` 保存项目级扩展。通过 `d2a registry --output json` 读取顺序与已保存的 Skill 路径；执行阶段前后按相应记录读取 Skill。替换入口时加载已注册的替代 Skill。注册只保存并声明 Agent 步骤，不在 CLI 内运行私有脚本。

## 导入与验证

第一次导入后，原交互补全、质量检查、HDS 和视觉校准中的页面代码修改必须先读取 [页面代码修订](references/page-revisions.md)：在 run 工作副本上修改，export arkts-page --revise 保存候选，import page --dry-run --page-revision 审阅后 apply。不要直接改工程 ETS、覆盖原导出或改历史哈希。原阶段、确认、ledger 和 Gate 不变。

先 `d2a import page --run <runId> --dry-run --module <模块名> [--page-name EntryPage] --output json`，向用户展示写入计划和 diff；获得用户对该计划的授权后再执行 `d2a import page --run <runId> --apply --plan <plan.json>`。不得绕过过期计划检查或擅自改写哈希。

### 导入后接入与验证

用户要求接入项目并验证时，apply 成功后继续下面的步骤；只要求导出产物时，不扩展为修改路由或部署。这些步骤由 Agent 组织执行，import 命令本身只写计划中的页面和资源。

1. **识别页面入口。** 读取目标模块的 `module.json5`、现有页面和路由实现，确认新页面的打开方式。沿用项目已有机制：使用 `pages` profile 时检查页面列表，使用 Navigation 或自定义路由时按现有注册方式接入。不要仅因模板使用 `main_pages.json` 就假定所有项目相同。
2. **接入目标页面。** 按用户需求补充页面注册和可达的跳转入口，核对生成页面的组件声明、导出方式和图片引用是否符合当前项目。新增页面时保留现有启动页；用户要求替换首页时才调整启动入口。接入改动发生在项目文件中，不修改运行快照、导出记录或哈希来绕过校验；后续重新导入需重新生成并审阅计划。
3. **静态检查。** 在目标项目根目录，完成一轮修改后执行 `devecocli check arkts <本次修改的.ets文件...>`，再用 `devecocli check lint <页面文件或相关目录>` 检查规范。读取实际错误并修正与本次页面相关的问题，有修改后重跑受影响的检查。区分页面错误与既有项目问题；工具链缺失等环境错误不能记为检查通过。
4. **构建并运行。** 用 `devecocli device list` 确认设备，依据项目实际可运行模块和启动 Ability 执行 `devecocli run --module <可运行模块> --device <名称或序列号>`，需要时加 `--ability`。run 默认包含构建，不必先重复 build。多设备且目标不明确时先让用户选择。没有可用设备时可执行 `devecocli build` 验证构建，并报告设备运行未完成。构建或启动失败时根据输出定位问题；同一阻塞没有新信息时报告原因，不盲目重复运行。
5. **打开页面并对照。** 应用启动后，通过现有可用的 UI 操作能力进入目标页面；无法操作时请用户打开，并确认当前画面确实是新页面。执行 `devecocli d2a preview --run <runId> --mode device --device <名称或序列号>` 保存截图，再实际查看截图和参考设计，比较布局、文字、图片、间距及明显溢出。preview 不构建、不导航、不自动评分；run 的启动冒烟结果也不证明目标页面或设计还原正确。缺少参考图或图像查看能力时，明确视觉对照未完成，不虚构相似度。
6. **修正与最终校验。** 页面代码使用 [页面代码修订](references/page-revisions.md) 的候选和计划/apply；图片修正必须先读取 [资源修订](references/resource-revisions.md)，使用 resources prepare --revise 和 import page --dry-run --resource-revision，再 apply；禁止直接覆盖已导入的页面或图片。仅重跑受影响的检查，重新构建运行、截图核对。最终执行 `devecocli d2a verify --project <项目路径> --run <runId> --output json`，读取并保存实际结果；完整性失败不能报告完整通过，不得手改清单、历史或哈希消除失败。
7. **汇报证据与遗留项。** 列出接入的页面及入口、静态检查、构建/运行、完整性校验结果、实际打开的页面和截图路径，以及已观察到的设计差异。区分已通过、失败和未执行的项目。没有实际执行的步骤不得报告为通过。
