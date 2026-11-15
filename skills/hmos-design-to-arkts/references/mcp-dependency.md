# 来源 MCP 依赖检查

本文件适配上游 Pixso/Figma 的来源依赖检查。适用于 DevEco Code、Claude Code、Codex 等宿主；来源 MCP 用于获取设计输入，与 D2A 对外提供 MCP 工具无关。

## 检查时机

1. 用户输入已能确定来源后、页面功能等需求澄清之前，检查来源入口。依赖缺失时先给出连接或授权引导，暂停需求澄清、创建 run 和 Controller init；不要先下载设计内容。
2. variant 确定后、初始化前确认检查结论仍适用。阶段 1 复核，将实际渠道和证据写入 `inputs-manifest.json.mcpDependencyCheck`，再获取设计输入。

依赖检查由 Agent 按 Skill 执行；CLI 的 doctor、sources 或 Controller init 不会自动完成它。来源无法判定时，只先确认检查所必需的来源信息。

## 判定方法

复用当前可用渠道，无需同时配置两套连接。工具名称和前缀以实际服务为准，不能只凭名称包含某段文字就认定全部能力齐备。

1. **宿主 Agent 已连接来源 MCP。** 查看实际工具列表、说明和参数。Pixso 需要真实设计 JSON、参考截图和流程所需资源导出能力；常见工具名包括 `get_node_dsl`、`get_screenshot`、`get_export_image`。Figma 需要当前流程要求的 JSX、1x 组件识别图、2x 参考图及资源线索；Anchor 常见工具名为 `figma_to_code_convert`、`figma_to_code_fetch_screenshot`，其余真实服务具备相同输出能力也可使用。不能因前缀不同或不是 Anchor 就拒绝，也不能把只有截图的工具当成完整来源。
2. **CLI 自行获取 URL。** 执行 `devecocli d2a mcp sources --project <项目根目录> --output json`，选择与来源匹配的服务；结合实际工具接口和已保存的绑定确认 `snapshot` 与阶段所需截图、资源能力。只提供 `componentRecognition` 的网关不能代替来源服务。宿主会话工具列表中没有该服务，不代表 CLI 渠道不可用。
3. **Pixso 完全本地输入。** 用户提供真实 DSL、截图和所需本地资源，且本流程不调用 MCP 时，记录 `not-applicable`。如果后续仍需 MCP 导出资源，先补齐依赖，不能继续沿用豁免。

`satisfied` 表示有符合当前流程的来源入口。工具出现在会话中或 sources 能列出配置，只证明入口存在，不证明目标文件可访问、身份验证有效或连接成功。阶段 1 必须根据真实调用结果验证获取；身份验证、权限、网络、参数或输出格式失败时如实阻塞，不能伪造输入或用占位图片继续。

## 缺少依赖时

说明缺少的能力与可选连接方式，附对应官方来源。默认提供引导；用户已要求配置时，Agent 在该授权范围内填写宿主配置或 CLI 来源绑定，交互登录授权由用户完成。不要求用户编写 JSON，也不索取密钥正文。

- **Pixso 本地：** 按 [本地 MCP 官方文档](https://pixso.cn/developer/zh/mcp/local-mcp.html) 安装并登录支持 MCP 的客户端，打开设计文件，开启本地 MCP。文档示例地址为 `http://127.0.0.1:3667/mcp`，实际端口以客户端显示为准；使用时保持客户端和目标文件可用。
- **Pixso 远程：** 按 [远程 MCP 官方文档](https://pixso.cn/developer/zh/mcp/remote-mcp.html) 连接 `https://pixso.cn/mcp` 并完成身份验证。需要访问令牌时，通过环境变量引用；CLI HTTP 绑定使用 `headerEnv`，键名按服务真实身份验证协议填写，不能把宿主配置的环境变量语法直接当作 CLI 密钥值。
- **Figma：** 可复用宿主已有且满足输出要求的 Figma 服务。需要 Anchor 时参考 [anchor-d2c-mcp 源码与安装文档](https://gitcode.com/OpenHarmonyToolkitsPlaza/anchor-d2c-mcp)，按文档提供 `FIGMA_ACCESS_TOKEN` 环境变量。其 stdio 启动方式为 `npx -y anchor-d2c-mcp@latest stdio`；已安装时可用 `anchor-d2c-mcp stdio`。采用哪种方式由用户已有安装与配置决定，不擅自全局安装。Windows 上这些命令由 `.cmd` shim 提供，绑定按上述写法填写，启动无需额外配置。

宿主 Agent 直连时，使用该宿主实际支持的 MCP 设置。`deveco mcp add`、`deveco mcp auth` 和 `deveco.json` 只属于 DevEco Code，不应在 Codex、Claude Code 或通用 CLI 流程中照搬。需要 CLI 直接调用时，按 [来源工具](source-tools.md) 配置 `transport`、真实工具参数及结果映射，再执行 `d2a mcp configure`；该命令保存来源绑定，不安装来源服务、不完成 OAuth，也不向 Agent 注册 D2A MCP 工具。

连接配置完成后，按宿主要求重连或重启并重新检查。遇到身份验证无效、文件无权限、目标不存在或限流，依据真实错误给出修复引导；不要把这些情况统一当成没有安装 MCP。已有完整本地输入的工具使用边界见 [来源工具](source-tools.md)，不能用改扩展名或来源标签的方式绕过完整 Skill 的要求。

## 阶段 1 证据

写入运行目录下 `inputs-manifest.json.mcpDependencyCheck`：

- `satisfied`：来源入口满足要求，可继续实际获取。
- `not-satisfied`：记录缺项和已给出的引导；已进入阶段 1 时通过 Controller 报告 `blocked`，reason-code 为 `dependency_unavailable`，不手写 Gate。入口检查失败、尚无 run 时直接报告，不为记录失败创建 run。
- `not-applicable`：仅用于上述 Pixso 完全本地输入。

`requiredMcpServers`、`requiredToolPrefixes` 记录真实名称；CLI 渠道没有宿主工具前缀时填空数组。`evidence` 记录实际检查渠道、工具或服务绑定，不填写未检查的数量，不把配置可读取写成连接成功。示例仅展示字段结构，值必须来自实际观察：

```json
{
  "mcpDependencyCheck": {
    "designSource": "figma",
    "requiredMcpServers": ["实际服务名"],
    "requiredToolPrefixes": [],
    "status": "satisfied",
    "evidence": {
      "channel": "cli-binding",
      "serviceName": "实际服务名",
      "snapshotTool": "实际快照工具名",
      "connection": "not-checked"
    },
    "guidance": ""
  }
}
```

Agent 直连可记录 `channel: "agent-tools"`、`inspectedToolCount` 和 `foundToolNames`；Pixso 本地输入记录 `channel: "local-input"` 与已检查的输入文件。实际获取结果单独按阶段要求落盘，失败不能把原先的入口检查当成获取成功证据。
