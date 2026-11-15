---
name: deveco-cli
description: 使用华为官方 DevEco CLI 开发 HarmonyOS 应用：工程创建、构建运行、ArkTS 检查、签名、模拟器、UI 调测、设备测试、离线文档及设计稿转 ArkTS。不启动 DevEco Code Coding Agent；仅在鸿蒙开发任务中使用。
---

# DevEco CLI

本 skill 接入官方 `@deveco/deveco-cli-common@1.3.12`，保留其全部开发命令与随包资源。使用本 skill 目录的 `scripts/devecocli`，不依赖全局 npm 安装：

```bash
DEVECO_CLI="$SKILL_DIR/scripts/devecocli"
"$DEVECO_CLI" --version
"$DEVECO_CLI" --help
```

`$SKILL_DIR` 是本 SKILL.md 所在目录。入口使用 huawei-dev-tools 随附 Node；未指定 Studio 或 CLT 时选择该项目的 `official/command-line-tools`。显式设置 `DEVECO_HOME` 或 `DEVECO_CLI_CLT_PATH` 可选择其他工具链；路径有空格必须保留引号。不要自动执行 `update` 改动固定依赖，也不要初始化所有 Agent 或修改 MCP 配置来完成普通开发任务。

## 按任务调用

| 任务 | 命令入口 |
|---|---|
| 创建工程 | `create --app-name <name> --project-path <path> --api-level <level>` |
| ArkTS 编译诊断 / 代码检查 | `check arkts` / `check lint` |
| 构建 | `build`；参数以 `build --help` 为准 |
| 构建并运行 | `run`；已有产物不需重建时先查 `run --help` |
| 设备与模拟器 | `device list --format json` / `emulator list --format json` |
| UI 调测 | `ui --help`；先查布局，再按现场节点操作 |
| 调试签名 | `auth status`、`signature --help` |
| 性能、稳定性、内存泄漏检测 | `testing --help`；需要 DevEco Testing 客户端 |
| API 升级差异扫描 | `check compat versions`、`check compat --help` |
| 离线鸿蒙文档 | `docs search <关键词> --format json --limit 5`、`docs read <id>` |
| 设计稿转 ArkTS | `design2arkts --help`；按实际设计来源确认所需连接 |
| Skills 查询 | `skills --help`；本地随包 skills 已在当前宿主部署 |

工程命令在目标工程目录执行。全局没有 `--json`；各子命令是否支持结构化输出、选项名称，以帮助为准。`run` 会构建并运行，不沿用旧 huawei-dev 的“只安装已有产物”语义。创建工程显式选择设备实际 API，不依赖模板默认值。

需要详细参数、平台差异或命令约束时，先看对应 `--help`，再按章节查 [官方随包说明](UPSTREAM.md)。不要为一个子命令加载全部说明。写 `.ets` 时使用 hmos-arkui-develop-skill；故障日志分析使用 hmos-dfx-analyzer，已明确的 JS 异常修复使用 hmos-runtime-fix-skill。

## 文档、权限与失败

官方 CLI 的 `docs` 是版本随包的本地知识库，适合快速搜索。查最新文档、具体函数起始 API、Phone 与 PC 差异、权限限制，用 huawei-docs 的实时官方正文和 `symbol --version <API>` 核验；两种来源要标明。

登录、签名和部分在线功能有账号、区域或工具链要求。先读状态和原始错误，满足具体前提后继续，不自动换身份、换版本或加兼容路径。命令行工具可支持哪些动作，以当前组件与命令的实际结果为准；不要把存在命令当成已经验证功能。

设备操作遵循用户当前任务授权。构建、签名、安装、启动、业务结果分别验证；清数据、卸载、重置模拟器等动作按真实影响判断，不能为排错自动执行。认证状态与凭证只由官方工具管理，不打印 token。

已有的 `huawei-dev` 仍提供结构化设备信息、精确文本 UI 操作、Studio HOS 调试签名和旧 bridge 的显式调用；新开发流程优先使用本官方 CLI，不能在官方命令失败后自动改走另一套实现。

本机已验证：官方 `create` 拒绝绝对路径中的空格，相对路径解析后也受影响。不要去掉引号、建 symlink 或悄悄换项目位置；说明限制后与用户确定实际目标路径。`check compat` 要求 Studio ≥26.0.0.810 或 CLT ≥26.0.1；当前项目 CLT 26.0.0.621 缺少 apicompat。
