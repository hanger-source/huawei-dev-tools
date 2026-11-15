# 02 - 生成前端骨架代码、下载图片资源

> CLI 适配：执行本阶段或能力前先读取入口 Skill 根目录的 `references/cli-integration.md`。仅工具与路径按接入约定替换；完整保留本文件的业务步骤、验收、确认和恢复边界。

## 阶段元数据

- id: 02
- title: 02 - 生成前端骨架代码、下载图片资源
- variant: full
- designSource: pixso
- instruction: references/pixso/full/stages/02-generate-skeleton-and-assets.md
- 子 Agent: 无

## 强制阶段入口 Todo 同步

在本阶段执行任何工作前：

1. 读取成功的 `stage-start` 调用返回的 `todoPayloadPath`。
2. 原样调用一次 `todowrite`，传入 `todo-payload.json.todos`，不得修改。
3. 不得翻译、摘要、重建、追加、删除或重排 Todo 项。
4. 不得运行 `status` 来准备本次同步；`stage-start` 已经刷新过 payload。
5. 只有 `todowrite` 成功后，才可以加载所需能力、查看项目文件、修改代码、构建、截图或发送阶段进度回复。

必须始终执行本次同步。不要试图判断 UI 是否已经包含相同的 Todo 列表。在阶段入口完整重放一次列表是有意为之且幂等的。

## 目标

阶段 2 是硬门禁阶段。必须先通过 CLI 调用唯一的 Pixso Engine，以阶段 1 保存的实例解绑 DSL 作为唯一输入，生成 ArkTS/ETS 前端代码、`imageIds` 文件、canonical raw JSON、结果 JSON 和运行 manifest；随后下载资源、集成原项目并编译通过。未通过不得进入阶段 3。

## 必需输入

- 阶段 1 保存的实例解绑 DSL：`<designToArktsRunDir>/source/page.dsl.json`
- `inputs-manifest.json`（阶段 1 产物）
- 开发者提供的本地资源（如有，含对照表）

## 执行步骤

### 生成命令与产物

禁止直接运行或寻找旧 scripts/pixso-arkts 脚本。执行：

```bash
devecocli d2a export arkts-page --project <项目路径> --run <runId> --page-name <PageName> --output json
```

CLI 校验保存的 DSL SHA-256、Engine/runner checksum，调用唯一的 design2arkts-engine，返回真实产物目录。读取 `.ets`、`imageIds.json`、`raw.json`、`result.json` 和 `page.json`；保留 sourceSha256、engine.name、engine.version 与文件哈希。不能手写骨架替代失败结果。

为兼容本 Skill 的原阶段证据与文档恢复输入，把这些真实产物复制到本 run 的 `stage2/generated/`：分别命名为 `<PageName>.ets`、`<PageName>.imageIds.json`、`<PageName>.raw.json`、`<PageName>.result.json`、`<PageName>.manifest.json`。manifest 使用 CLI 原始 page.json，不编造旧脚本的 ok/out/engine 路径。inputs-manifest.json.pages[].dslPath 与 dslSha256 指向 resolve 返回的真实快照。禁止改写快照、导出文件或哈希绕过校验。

Agent 下载、MCP 导出和用户文件复制统一暂存到本 run 的 `acquisition/pixso/stage2-assets/`，资源对照表也保存在 acquisition 下；不得直接写入工程页面或 media，不改写已发布的 source、exports 或 resources。按下文完成真实资源审计，再依次执行 `resources prepare`、审阅 `import page --dry-run` 的计划及 diff、按已有授权执行 `import page --apply --plan <planPath>`；完整命令见“集成到原项目”。之后继续路由接入、历史保护、初次构建与报告步骤。不以工具成功代替审计。

### 路由登记证据

实际完成 CLI 导入、Index/项目路由接入和初次构建后，保存 `stage2/route-registration.json`。它是 Agent 提交的真实接入证据，不是路由索引，Agent 不写共享索引：

```json
{"schemaVersion":1,"projectRootPath":"<CLI metadata.projectRoot>","pageFile":"entry/src/main/ets/pages/DetailPage.ets","componentName":"DetailPage","route":"detail","registrationMode":"index-navigation","registrationFile":"entry/src/main/ets/pages/Index.ets","default":false}
```

pageFile 和 registrationFile 必须为工程根目录下的规范相对路径，使用 / 分隔；不得使用绝对路径、空路径段、.、..、反斜线、冒号或 NUL。Controller 拒绝不合规路径，不替 Agent 猜测或改写路径。registrationMode 也可为 route-table、existing-router 或 pages-profile，使用真实注册文件；pages-profile 的 route 为 profile 中的页面路径。目标必须为导出的 @Component，不含 @Entry。修改已有默认页必须有用户明确授权并记录 defaultChangeAuthorized=true；没有历史页面时可按原第一次模板页规则登记 default。Controller 在阶段 2 验收时核对页面、实际路由及历史冲突，通过后按 Gate→共享索引→状态顺序登记；重放不得重复插入或改变身份。后续阶段不得移除已登记页面、组件或路由。

### 下载图片资源

读取每个 `.imageIds.json` 和运行 manifest 的 `imageIds`。两者不一致时以 `.imageIds.json` 为准并记录差异，不改写原始 imageIds 或导出文件。以下复制、下载、导出和异常重试都只写本 run 的 `acquisition/pixso/stage2-assets/`，不得使用工程 media 目录作下载或暂存目录。对每个 id：

1. 优先检查开发者提供主要资源是否可通过该 id 精确匹配：先查 `imageId -> localPath` 对照表，再查文件名等于 `imageId` 或规范化后等于 `imageId` 的本地文件。
2. 如果开发者已声明本地资源为主要来源，但按路径、文件名和对照表第一次找不到该 `imageId`，必须暂停并让用户确认或修正路径；用户确认后只允许再查一次，仍找不到时结束工作流。
3. 已匹配的用户资源必须再次检查文件大小和类型；单文件超过 10MB（10485760 字节，10 MiB）时不得复制或交给 resources prepare，必须阻塞并提示具体 `imageId`、路径和大小。
4. 已通过大小和类型检查的用户资源复制到本 run 的 `acquisition/pixso/stage2-assets/`，保留原始 `imageId` 的精确映射及来源路径，并记录 `sourcePriority: "developer-provided-primary"`。工程资源名由 CLI 按导出记录生成，不在此步骤写入目标模块。
5. 未匹配的 id 通过 Pixso MCP 导出对应图片，保存到本 run 的 `acquisition/pixso/stage2-assets/` 并检查文件大小和类型；单文件超过 10MB 时不得交给 resources prepare，必须尝试重新导出较小版本或阻塞。
6. 如果图片下载/导出失败且已确认原因是 Pixso 本地 MCP 不可用、未连接、鉴权失败或无法完成调用，必须立即写入 `<designToArktsRunDir>/stage2/asset-security-report.json` 和结束原因，告知用户需要恢复 Pixso MCP 后重新执行，并停止工作流；不得继续尝试截图裁剪、占位图、相似图、手写 SVG 或其它替代链路。
7. 如果 Pixso MCP 已确认可用但单个图片导出失败，agent 才允许继续尝试实例解绑 DSL 和 `.raw.json` 中的 image fill、exportSettings、svgGuidInfo、componentId/pathString、可解析 URL 或其它资源线索自行下载/导出；通过 URL 补齐时仍必须检查 10MB 大小限制。
8. 完成下载、导出或复制后，必须执行 imageId 对应性审计：每个必需 `imageId` 都必须有唯一对应的实际文件。Agent 获取时读取 acquisition 暂存文件；CLI `--fetch` 时读取返回 manifest 指向的已保存资源，不使用工程 media 替代。文件必须存在、可读、为真实 PNG、大小不超过 10MB，且 `image-assets-manifest.json` 中的 `imageId`、`localPath`、`matchedBy` 和 `source` 必须与实际审计文件对应。
9. 对应性审计发现缺失、文件不可读、类型不可识别、同一文件错误绑定多个非同源 `imageId`、manifest 路径和实际文件不一致、或资源内容明显不是该 `imageId` 对应图片时，必须只针对异常 `imageId` 再下载/导出一次，并记录 `retryReason` 和 `attemptedSources`。
10. 二次下载后必须重新执行对应性审计；仍失败时，写入 `<designToArktsRunDir>/stage2/asset-security-report.json`、列出失败 `imageId`、尝试过的来源和失败原因，然后结束工作流。
11. Pixso Engine 生成的代码统一使用 `pixso_` 前缀引用图片资源；工程文件名以 resources prepare 返回 manifest 的 `name` 为准，例如 `imageId` 中的 `:` 转为 `_`。不得自行更换前缀、修改原始 imageIds 或用模糊匹配替代精确映射。

CLI 资源输入必须为真实 PNG，不能仅把 JPG、WebP、SVG 等文件改为 `.png` 扩展名。非 PNG 来源需要转换时，保留原件，只在 acquisition 工作副本上明确转换并记录来源和转换后路径，重新检查大小、PNG 内容和 imageId 对应关系；原始资源超过 10MB 时仍按上文阻塞，不借转换或压缩规避限制。

开发者提供本地资源时的限制：

- `developer-provided-primary` 资源只允许 `matchedBy: "mapping-table" | "exact-id-filename" | "normalized-id-filename"`。
- 节点名称、语义、尺寸相近、人工判断或模糊文件名不得作为直接命中依据；只能作为 `designGeometry`、`responsiveHints` 或审计备注。
- 对照表可为 JSON、CSV 或 Markdown 表格，但必须能明确解析出 `imageId` 和 `localPath` 两列；`localPath` 必须是可读文件路径或相对资源根目录的可解析路径。
- 对照表中存在重复 `imageId`、路径不存在、路径指向目录或无法识别文件类型时，该 id 判为缺失资源。
- 对照表指向路径第一次找不到图片时，必须先让用户确认或修正；确认后仍找不到时结束工作流。
- 对照表指向的图片文件超过 10MB 时，该 id 判为不合规资源；不得复制、压缩后静默替换或继续后续阶段，除非用户提供合规文件或 Pixso MCP 可重新导出合规版本。

用户原始对照表中的 localPath 用于查找来源文件。交给 CLI `--mapping` 的对照表另存于 acquisition：JSON 使用 `{"原始imageId":"暂存图片.png"}` 对象，CSV/Markdown 使用 imageId、localPath 两列；所有值都必须指向 `--assets` 目录内的真实 PNG 相对路径，不传用户原始绝对路径，不使用越界路径或符号链接。保留原始对照表和来源路径供审计，不覆盖用户文件。

写入 `<designToArktsRunDir>/stage2/asset-security-report.json`，记录所有已匹配、已导出、已下载和已复制资源的大小和类型校验结果。任何 `sizeCheck=fail` 都必须阻塞阶段 2。

禁止：

- 用截图裁剪、占位图、相似图标或手写 SVG 静默替代。
- 只下载一部分资源就继续后续阶段。
- 要求用户手动运行 Pixso 插件或手动导图。

### 生成资源 manifest

写入 `<designToArktsRunDir>/stage2/image-assets-manifest.json`：

```json
{
  "pages": [],
  "assets": [
    {
      "imageId": "",
      "localPath": "",
      "source": "developer-provided-primary | pixso-mcp-export | dsl-resource-url | dsl-export-settings",
      "sourcePriority": "",
      "matchedBy": "mapping-table | exact-id-filename | normalized-id-filename | pixso-mcp | dsl-url | dsl-export-settings",
      "mappingTablePath": "",
      "fileSizeBytes": 0,
      "maxFileSizeBytes": 10485760,
      "sizeCheck": "pass | fail",
      "downloadCheck": "pass | fail | not-needed",
      "correspondenceCheck": "pass | fail",
      "retryCount": 0,
      "retryReason": "",
      "attemptedSources": [],
      "designGeometry": {},
      "responsiveHints": {},
      "usedBy": []
    }
  ],
  "missingAssets": []
}
```

`missingAssets` 非空、`<designToArktsRunDir>/stage2/asset-security-report.json` 缺失、任一必需图片超过 10MB、任一资源安全校验失败、任一必需图片对应性审计失败或异常 `imageId` 二次下载失败时，不得进入集成编译；若失败来自必需图片，必须结束工作流。只有该资源被确认为非必需且有设计文档前置证据时才可继续；阶段 2 尚未有设计文档时默认按必需处理。

### 集成到原项目

必须通过受保护的 CLI 计划把阶段 2 生成的页面和已审计资源集成到原项目：

1. 执行资源准备，`--assets` 指向本 run 的 acquisition 暂存目录；必要时用 `--mapping <对照表>` 指向精确映射。读取返回的 manifestPath，核对 CLI 保存的资源、imageIds、名称、大小和 SHA-256，不手写或改写已发布的资源 manifest。

   ```bash
   devecocli d2a resources prepare --project <项目路径> --run <runId> --page-name <PageName> --assets <runDirectory>/acquisition/pixso/stage2-assets/ --output json
   ```

   显式配置来源服务的 imageExport 时，也可将 `--assets`/`--mapping` 替换为 `--fetch --url <设计链接> [--mcp <服务名>]`。该模式由 CLI 在内部临时目录获取并发布资源；仍须完成上述精确对应、大小、PNG 和安全审计，不会写入工程。

2. 生成导入计划，审阅返回的 planPath 和 diff，确认目标模块、页面文件、全部资源及历史冲突。页面和资源目标目录由计划决定，例如 `entry/src/main/ets/pages/` 和 `entry/src/main/resources/base/media/`；Agent 不向这些目录复制文件。

   ```bash
   devecocli d2a import page --project <项目路径> --run <runId> --module <目标模块> --page-name <PageName> --dry-run --output json
   ```

3. 在用户已有授权范围和原确认规则下，应用刚审阅的 planPath。apply 只传项目、run 与计划，不重新指定 module 或 page-name；CLI 重验归属、文件身份、哈希及目标基线后写入工程。计划过期或发生冲突时重新生成并审阅，不改计划、哈希或历史记录强行继续。

   ```bash
   devecocli d2a import page --project <项目路径> --run <runId> --apply --plan <planPath> --output json
   ```

4. CLI 导入成功后，继续更新真实路由配置，如 `main_pages.json`、`router`、`Navigation/NavDestination`、集中路由表或项目现有配置；import 不自动接入路由。第一次导入后的图片修正改走 [资源修订](../../../resource-revisions.md)，页面代码修改改走 [页面代码修订](../../../page-revisions.md)，不直接覆盖工程文件。

同时保留以下工程接入要求：

- 使用标准 ArkUI `Navigation` 承载页面路由时，必须在所属组件中声明可观察的 `NavPathStack` 并传入构造调用，例如 `@State navStack: NavPathStack = new NavPathStack()` 与 `Navigation(this.navStack) { ... }`。禁止生成 `Navigation() { ... }`；该无参数写法可能导致内容不渲染。若本页面不需要路由能力，直接使用 `Column`、`Stack` 等容器。HDS 自有导航组件按其实际 API，不套用标准 ArkUI 构造签名。
- 再次执行工作流时，必须先对照 `.deveco/design2arkts/skill-run-index-full.json` 和当前工程源码，确认新页面文件名、组件名、路由名、资源名不会覆盖上一轮已生成页面；发生冲突时必须生成新的稳定名称或让用户确认，不得静默覆盖。
- 集成报告必须记录本次新增、修改的页面文件、路由配置和资源文件，并标明是否与历史运行产物存在关系；不得把上一轮页面误判为本轮产物。
- 如果生成的目标页面代码含 `@Entry`，必须移除其启动入口身份，保留并导出可被 `Index.ets` 引用的 `@Component`；应用唯一启动 `@Entry` 保持在 `Index.ets`。
- 阶段 2 允许先完成目标页面接入和构建；阶段 3/4/5/6 必须落地固定启动链路 `EntryAbility → pages/Index 稳定导航壳 → 已注册页面`。无既有首页时第一次生成页可作为默认页；后续生成页只追加注册，不得自动取代原默认页。不得把模板 Hello World 内容作为最终结果，也不得绕过 Index 直接启动目标页面。
- 过滤 mock-only 系统 UI：状态栏、系统手势条、设备外壳不得作为应用自绘元素保留。

### 编译通过

发现并执行项目构建/类型检查命令。优先级：

1. 用户指定命令。
2. 阶段 1/项目 README/CI/HVigor/ohpm 配置。
3. DevEco/HarmonyOS 项目可识别默认命令。

写入：

- `<designToArktsRunDir>/stage2/stage2-build-command.json`
- `<designToArktsRunDir>/stage2/stage2-build-report.md`
- `<designToArktsRunDir>/stage2/integration-report.md`

## 必需产物

- `<designToArktsRunDir>/stage2/generated/<PageName>.ets`
- `<designToArktsRunDir>/stage2/generated/<PageName>.imageIds.json`
- `<designToArktsRunDir>/stage2/generated/<PageName>.raw.json`
- `<designToArktsRunDir>/stage2/generated/<PageName>.result.json`
- `<designToArktsRunDir>/stage2/generated/<PageName>.manifest.json`
- `<designToArktsRunDir>/stage2/image-assets-manifest.json`
- `<designToArktsRunDir>/stage2/asset-security-report.json`
- `<designToArktsRunDir>/stage2/integration-report.md`
- `<designToArktsRunDir>/stage2/stage2-build-command.json`
- `<designToArktsRunDir>/stage2/stage2-build-report.md`

## 完成条件

### 通过条件

- 生成代码已集成进原项目。
- 资源路径真实可读。
- 路由或入口已接入。
- 编译/类型检查通过。
- 若编译失败，必须在阶段 2 修复，不得进入阶段 3。

### 阻塞或失败条件

- 脚本失败时不得手写骨架替代，不得切换到任何其它入口脚本。
- CLI 返回失败，或 page.json 的归属、产物可读性、sourceSha256 或文件哈希校验不通过。
- 资源安全校验失败：任何 `sizeCheck=fail` 都必须阻塞阶段 2。
- `missingAssets` 非空、必需图片对应性审计失败或异常 `imageId` 二次下载失败时不得进入集成编译；若失败来自必需图片，必须结束工作流。
- 编译失败必须在阶段 2 修复，不得进入阶段 3。

满足全部完成条件后，调用：

```text
workflow.mjs --mode stage-complete --run-dir <runDir> --stage 2 --result passed
```

无法继续时，调用：

```text
workflow.mjs --mode stage-complete --run-dir <runDir> --stage 2 --result blocked --reason-code <stable_reason_code>
```

Gate 由 Controller 自动生成。不得自行创建、修改或覆盖 stage gate。

### 允许返工范围

保持当前 `currentStage` 不变，可以修正前序阶段产生的实现或业务产物，然后重新执行当前阶段检查。不得直接修改 `workflow-state.json`，也不得重新调用旧阶段的 `stage-start`。
## 禁止事项

- 禁止搜索脚本。若任一固定路径缺失，报告安装不完整并停止。
- 禁止使用已废弃的 `--full` 或 `--occurrence` 参数。
- 禁止自行拼装、包装或修改阶段 1 保存的 DSL 后再传入脚本。
- 禁止因 DSL 缺失而手写骨架或跳过脚本。
- 脚本失败时不得手写骨架替代，不得切换到任何其它入口脚本。
- 禁止用截图裁剪、占位图、相似图标或手写 SVG 静默替代。
- 禁止只下载一部分资源就继续后续阶段。
- 禁止要求用户手动运行 Pixso 插件或手动导图。
- 对照表指向的图片文件超过 10MB 时，不得复制、压缩后静默替换或继续后续阶段。
- 禁止生成 `Navigation() { ... }` 无参数写法。
- 不得静默覆盖上一轮已生成页面。
- 不得把上一轮页面误判为本轮产物。
- 不得把模板 Hello World 内容作为最终结果，也不得绕过 Index 直接启动目标页面。
- 状态栏、系统手势条、设备外壳不得作为应用自绘元素保留。
