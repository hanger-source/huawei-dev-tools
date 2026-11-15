来源 MCP 的实际获取目录统一使用当前 run 的 acquisition 子目录，禁止提前写 source；安全审查后通过 resolve 独占发布。

### 来源 MCP 准备（Pixso / Figma）

根据用户指定和设计链接确定来源；以下 `<来源>` 替换为 `pixso` 或 `figma`。两者共用服务发现、配置和连接流程，工具名、参数及返回数据按各自真实接口填写。

1. 执行 `devecocli d2a mcp sources --project <项目根目录> --output json`，查看 `source` 与本次来源一致的服务。已有服务时复用；多项候选根据用户指定或项目默认选择，仍不明确才询问。使用 `--mcp <服务名>` 明确本次选择。查询报错时先处理配置错误，不把报错当作没有配置。
2. 没有对应来源服务时，先检查当前 Agent 已连接的真实 Pixso/Figma MCP。若可直接获取真实数据，保存文件并用 resolve --input，不必额外配置 CLI。需要 CLI 自行获取 URL 时，检查可读取的服务配置或接口文档，确定 stdio 命令/参数或 HTTP 地址、身份验证、工具名及返回结构；只询问仍缺少的信息，交互授权由用户完成，Agent 负责填写绑定，不要求用户编写 JSON。
3. 按真实接口编写服务绑定：以服务名为键，包含 `source`（`"pixso"` 或 `"figma"`）、`transport` 和所需绑定（获取输入用 snapshot，独立识别网关可仅含 componentRecognition）。`snapshot` 指定 `tool`、`arguments`、`kind`（json/text/file），需要提取返回字段时加 JSON Pointer `pointer`。参数中的 `${url}` 替换为设计链接，`${workspaceRoot}` 替换为 CLI 临时工作目录，设计链接还可提供 `${fileKey}`、`${nodeId}`；文件结果必须位于该目录内。凭据通过 `env` 或 `headerEnv` 引用 CLI 可读取的环境变量名，不把密钥写入绑定文件或对话。若实际服务的返回方式无法用当前绑定表达，说明需要适配的差异，不编造字段或假装配置已完成。
4. 项目还没有 `source-services.json` 时，执行 `devecocli d2a mcp configure --project <项目根目录> --file <绑定文件> --output json`。如果文件已存在但缺少对应服务条目，读取当前选用的 `.deveco/design2arkts/` 或 `.deveco/d2a/` 下的文件，保留其余条目后补入配置；configure 不支持覆盖，不通过删除原文件来重建。再次执行 sources 检查配置可读取；保存和列出成功只证明本地配置已写入，不证明服务可连接。
5. 执行 `devecocli d2a resolve --project <项目根目录> --run <runId> --source <来源> --url <设计链接> --mcp <服务名> --output json`，由 CLI 连接服务并获取快照。只有调用成功并返回 runId，才报告已保存输入；生成兼容性和资源完整性留待后续检查。失败时区分连接、身份验证、工具参数或结果解析问题，依据真实错误修正，不反复盲目重试。若暂无可用服务，但用户已有真实设计数据，可改用 `--source <来源> --input <文件>` 保存本地输入：Pixso 使用设计 JSON，Figma 使用 JSX；不通过改扩展名或来源标签转换数据。

## 生成页面

- Pixso：`d2a export arkts-page --run <runId> --page-name EntryPage --output json`。使用输出的 `.ets` 和原始 `imageIds.json`；Agent 从真实来源补齐资源或复制用户资源时，只写本 run 的 `acquisition/pixso/stage2-assets/`，精确匹配 imageId 并审计 10 MiB 和真实 PNG。通过 `resources prepare --assets <暂存目录> [--mapping <对照表>]` 保存独立资源 manifest，审阅 `import page --dry-run` 的计划及 diff 后，按授权执行 `import page --apply --plan <planPath>`，由 CLI 写工程；不直接向工程 media 复制。来源服务的 `--fetch` 获取由 CLI 管理内部临时目录，同样经过资源审计和导入计划。不重新 resolve 或改写快照，不能用空图冒充；导入后图片修改使用 [资源修订](resource-revisions.md)。
- Figma：没有确定性 ArkTS codegen。读取已验证的 JSX 和参考截图，结合 [布局映射](capabilities/hmos-d2a-react-to-arkui/references/arkui-basic-mapping.md) 与 [常见问题](capabilities/hmos-d2a-react-to-arkui/references/arkui-common-issues.md) 进行 Agent 转换。必须区分实际看过的图片和只读过的文本。保留布局、文字、图片关系，使用响应式容器，核对目标项目的 SDK 与 ArkTS 语法。按 Full/Fast 方案采用规则继续实现，不得声称 CLI 已完成确定性 Figma 转换。使用 `d2a export arkts-page --run <runId> --page-name EntryPage --input <生成的.ets> --image-ids <JSON数组文件>` 暂存 Agent 产物；imageIds 为代码引用的 media 名称，资源按 `<名称>.png` 放在 resolve 时提供的 assets 目录。CLI 标注 producer=agent，只验证结构名、资源声明和文件一致性，不保证 ArkTS 可编译。

