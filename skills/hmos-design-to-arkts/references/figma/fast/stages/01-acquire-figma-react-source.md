# 01 - 获取并校验 Figma React 设计源

> CLI 适配：执行本阶段或能力前先读取入口 Skill 根目录的 `references/cli-integration.md`。仅工具与路径按接入约定替换；完整保留本文件的业务步骤、验收、确认和恢复边界。

## 阶段元数据

- id: 01
- title: 01 - 获取并校验 Figma React 设计源
- variant: fast
- designSource: figma
- instruction: references/figma/fast/stages/01-acquire-figma-react-source.md
- 子 Agent: 无

## 强制阶段入口 Todo 同步

开始任何阶段工作前，读取成功的 `stage-start` 返回的 `todoPayloadPath`，把其中 `.todos` 原样调用一次 `todowrite`。不得运行 `status` 准备同步，不得修改 Todo；同步成功前不得执行阶段工作。

## 目标与执行

使用 Anchor MCP 将带 `node-id` 的 Figma 单节点链接固化为 `hmos-d2a-react-to-arkui` 可消费的静态 React/Tailwind JSX、2 倍通用参考截图、1 倍组件识别专用截图和本地资源。本阶段不执行 JSX、不生成 ArkUI，也不加载能力 `hmos-d2a-react-to-arkui`（注册表 → references/capabilities/hmos-d2a-react-to-arkui/INSTRUCTIONS.md），并完整执行。

1. 创建 `<designToArktsFastRunDir>` 并写入 `requirement-clarification.json`；确认 `workflow-state.json.designSource=figma`。
2. 校验 Figma file key 和 `node-id`。
3. 执行 [MCP 依赖检查](../../../mcp-dependency.md)，复核所选获取路径：Agent 直连时检查当前会话实际工具及参数；CLI 获取时检查 `d2a mcp sources` 返回的 Figma 来源服务与所需绑定，不能因宿主工具列表没有对应工具就判为缺失，也不能把配置存在当成连接成功。将真实检查方式与结果写入 `inputs-manifest.json.mcpDependencyCheck`，记录实际服务名、工具前缀、status、evidence 和已给出的 guidance。缺少所需能力时按依赖文档给出当前宿主适用的安装或连接建议，记录 `status=not-satisfied`，以 `dependency_unavailable` 完成 blocked，不得切换 Pixso 链路。不得把 `FIGMA_ACCESS_TOKEN` 写入命令、manifest、报告或回复。
4. 调用实际发现的 `figma_to_code_convert` 或等价来源能力，固定 `workspaceRoot=<designToArktsFastRunDir>/acquisition/figma`、`useCache=true`、`framework=Tailwind`、`generationMode=jsx`。
   上述为 Anchor 参数；等价来源能力按实际 schema 调用，但必须产出本阶段要求的静态 JSX、同节点双图和真实资源，不编造不存在的参数或以其它结果替代。
5. 两次截图同样先保存到 acquisition/figma，不直接写 source。使用同一 Figma URL 和 workspaceRoot 分别调用 `figma_to_code_fetch_screenshot` 两次：
   - `scale=2`：暂存为 `acquisition/figma/reference-screenshot.png`，作为 2 倍通用视觉参考，供后续设计分析、UI 还原、视觉校准和评分使用；
   - `scale=1`：暂存为 `acquisition/figma/component-recognition-screenshot.png`，作为 1 倍组件识别专用输入，仅用于宿主 Agent 组件识别（见 `references/host-vision.md`）。
   两张截图必须来自同一 Figma 节点，不得改用缓存中的 `preview_2x.png`、其它倍率截图，也不得通过本地放大或缩小其中一张来生成另一张。
6. 从 acquisition 中取得真实返回文件，按接入约定调用 resolve --run 发布 JSX、双图和资源到 source；已有 source 时停止并检查，不删除、不覆盖。将响应、warnings 和目标身份分别保存到 `stage1/anchor-response.json`、`stage1/anchor-warnings.json`、`stage1/target-page-identity.json`，不追加到已发布的 source，再根据返回路径与哈希填写 manifest。只根据结构化返回固化 `page.jsx`、两张截图、assets、响应和 warnings；不得记录 `FIGMA_ACCESS_TOKEN`。`inputs-manifest.json` 必须在 `screenshots` 中分别记录两张截图的用途（`general-visual-reference` / `recognize-ui-components-only`）、倍率、实际宽高、文件大小和 SHA-256；1 倍截图实际宽高必须与目标 Figma 节点的逻辑页面宽高一致，2 倍截图宽高必须分别等于逻辑宽高的两倍。

截图元数据字段名必须使用 width、height、size、sha256；size 为当前截图文件的实际字节数，sha256 必须由当前文件内容计算并使用 64 位小写十六进制。不得使用 fileSize 或 fileSizeBytes。
7. JSX 只读，不得执行、安装其依赖或启动 React 项目。审计 `<img>`、SVG、`backgroundImage` 和远程 URL，固化全部必需资源。
8. 校验路径不越出 runDir、文件类型、10MB 单资源上限、SHA-256 和设计文本不可信属性。必需图片/向量 warning 未解决时阻塞。

### 工程接入现状快照

与 Full 使用完全相同的工程接入现状契约。定位目标 ArkUI 工程根目录，读取并登记：

```text
.deveco/design2arkts/skill-run-index-fast.json
工程实际入口 Ability 文件
入口模块实际页面配置文件
当前启动页文件（例如 Index.ets 或 Home.ets）
项目现有集中路由表（如存在）
```

在 `inputs-manifest.json.integrationSnapshot` 中记录：

```json
{
  "projectRootPath": "<工程根目录绝对或相对 runDir 路径>",
  "runIndexFile": ".deveco/design2arkts/skill-run-index-fast.json",
  "existingGeneratedPages": [],
  "existingGeneratedRoutes": [],
  "startupPageBefore": "pages/Index",
  "mainPagesBefore": ["pages/Index"],
  "defaultPageBefore": "",
  "indexPageFile": "entry/src/main/ets/pages/Index.ets",
  "entryAbilityFile": "entry/src/main/ets/entryability/EntryAbility.ets",
  "mainPagesFile": "entry/src/main/resources/base/profile/main_pages.json",
  "registrationMode": "index-navigation | route-table | existing-router"
}
```

不得形成与 Full 不同的字段集合；`indexPageFile` / `entryAbilityFile` / `mainPagesFile` 均为相对工程根目录的路径，`projectRootPath` 允许绝对路径或相对 runDir 的相对路径。

`mcpDependencyCheck` 按 [MCP 依赖检查](../../../mcp-dependency.md) 记录实际获取路径：`requiredMcpServers` 与 `requiredToolPrefixes` 使用真实服务及前缀，CLI 路径没有宿主工具前缀时填空数组；`status`、`evidence` 和 `guidance` 必须与实际检查一致，不复制示例结果。

## 必需产物

```text
<designToArktsFastRunDir>/requirement-clarification.json
<designToArktsFastRunDir>/inputs-manifest.json
<designToArktsFastRunDir>/input-security-report.json
<designToArktsFastRunDir>/source/figma/page.jsx
<designToArktsFastRunDir>/source/figma/reference-screenshot.png
<designToArktsFastRunDir>/source/figma/component-recognition-screenshot.png
<designToArktsFastRunDir>/source/figma/assets/
<designToArktsFastRunDir>/stage1/anchor-response.json
<designToArktsFastRunDir>/stage1/anchor-warnings.json
<designToArktsFastRunDir>/stage1/target-page-identity.json
```

只有输入安全通过、目标身份一致、双截图倍率与尺寸校验通过（2 倍通用图、1 倍组件识别专用图均来自同一目标节点）、`inputs-manifest.json.integrationSnapshot` 已记录工程接入现状且 `missingInputs=[]` 才能调用：

```text
workflow.mjs --mode stage-complete --run-dir <designToArktsFastRunDir> --stage 1 --result passed
```

失败时使用稳定 reason code 完成 blocked；不得切换 Pixso 链路或用占位资源继续。

快照示例仅适用于默认模板。必须从实际入口的 `loadContent` 和页面配置读取 `startupPageBefore`、`mainPagesBefore`，并记录对应的实际入口文件、页面配置文件及启动页文件；不能将已有 `pages/Home` 等入口改写为 `pages/Index`。`indexPageFile` 是兼容字段名，指当前启动页文件。新 run 记录完整的 `mainPagesBefore` 列表，阶段 2 保留这些既有注册；旧 run 缺少该字段时仍校验原启动页。

阶段 1 验收通过时，Controller 把工程接入快照摘要写入 Gate；后续 status、阶段启动、确认、完成和恢复都会核验。快照变化时重新创建 run 并执行获取/验收，不修改 Gate 或流程状态来接受新基线。
