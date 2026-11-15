# Huawei Dev Tools

HarmonyOS 官方工具链、独立 CLI 和 Codex skills 的统一目录。所有入口使用物理文件，不创建符号链接。

| 目录 | 内容 |
|---|---|
| `official/` | 原始 Command Line Tools、SDK、HDC、Studio 安装介质 |
| `tools/huawei-cli/` | 文档查询 CLI `huawei-docs` 与开发 CLI `huawei-dev` |
| `tools/huawei-cli/bin/devecocli` | 华为官方 DevEco CLI 1.3.12，独立于 Coding Agent |
| `tools/scrcpy-client/` | scrcpy 宿主端构建入口 |
| `skills/` | 项目维护的两个 skill，以及五个从官方包/源码同步并接入 Codex 的 skill |

## 统一安装

在本目录运行一次：

```bash
./scripts/install-local.sh
```

安装器编译 CLI，将 `huawei-docs`、`huawei-dev`、`devecocli`、`hdc`、`hvigorw`、`ohpm`、`codelinter`、`hstack` 和 `huawei-tools-install` 的物理启动脚本安装到 `~/.local/bin`。该目录需要在 PATH 中；本机已配置。脚本定位本项目的官方工具和 Node，不复制 SDK，也不创建符号链接。

七个 skill 仅部署到 `~/.agents/skills`，由 Codex 和 dsh 共享；项目 `skills/` 是源码。安装器把这七个 skill 在 `.codex/skills`、`.dsh/skills` 中的重复部署移到项目 `.trash`，不处理其他 skill。无变化的重复安装直接复用共享副本；同名的非本项目命令会使安装在写入前停止。

后续在任意目录执行 `huawei-tools-install` 即可重新编译和安装。项目迁移后，从新目录重新运行 `./scripts/install-local.sh`。

## 直接使用

在本目录执行；目录可位于任意磁盘，启动脚本使用随附 Node：

```bash
huawei-docs doctor
huawei-docs search '屏幕录制' --limit 5
huawei-docs --json symbol OH_Input_RequestInjection --version 7.0 --device Phone
huawei-dev doctor
huawei-dev devices
huawei-dev device info --device <target>
devecocli --version
devecocli docs search 屏幕录制 --format json --limit 5
hdc list targets
```

`huawei-docs` 使用官方文档中心目录、搜索、详情与 Markdown。默认研究 API 26.0.0，支持 `7.0` 系统名、精确 API 和 6.x 画像；设备支持与权限必须看具体段落。`doctor` 默认实时联网，`doctor --cached` 明确只验证本地快照。查最新时用全局 `--refresh`，普通查询复用已有缓存。

`huawei-dev` 的 HDC、设备信息、日志、安装启动和 uitest UI 操作不依赖完整 IDE。提取自 DevEco Code 的 bridge 构建/检查/运行及工程创建需要完整 Studio，通过 `--deveco-home` 指定。`signing auto` 使用 Studio 登录态；`knowledge` 使用独立 OAuth，二者不混用。

常规开发流程使用官方 `devecocli`：支持 CLT/Studio、ArkTS 检查、签名、模拟器、UI、DevEco Testing 和设计稿转 ArkTS。启动器默认定位本项目 CLT，保留显式 `DEVECO_HOME` / `DEVECO_CLI_CLT_PATH` 配置。其 `run` 会构建并运行，参数和 JSON 格式以官方子命令帮助为准。

`devecocli docs` 使用官方本地知识库；`huawei-docs` 查询实时官网正文并核验目标 API。五个上游 skill 为 `deveco-cli`、`hmos-arkui-develop-skill`、`hmos-dfx-analyzer`、`hmos-design-to-arkts`、`hmos-runtime-fix-skill`。前四个资源来自官方 CLI 1.3.12，运行时修复来自 DevEco Code v0.2.5。入口适配当前宿主，原始说明保留在各自 `UPSTREAM.md`；来源与哈希见 `skills/deveco-upstream.json`。

## 维护与部署

修改 `tools/huawei-cli/src` 与 `skills/` 源码后，从本目录执行：

```bash
./official/command-line-tools/tool/node/bin/node tools/huawei-cli/node_modules/typescript/bin/tsc -p tools/huawei-cli/tsconfig.json
./official/command-line-tools/tool/node/bin/node tools/huawei-cli/scripts/sync-deveco-skills.mjs
./official/command-line-tools/tool/node/bin/node tools/huawei-cli/scripts/install-local.mjs
```

同步上游 skill 需要 `~/third-party/deveco-code` 的 v0.2.5 checkout（可用 `DEVECO_CODE_SOURCE` 显式指定）；普通安装部署直接使用项目已有 skill，不需要该源码库。

安装器同时更新项目内入口、`~/.local/bin` 命令和 `~/.agents/skills` 共享副本；每个 skill 自带定位工具路径的启动脚本，不依赖宿主专用安装目录。可用 `HUAWEI_TOOLS_BIN_DIR`、`HUAWEI_SKILLS_DIR` 显式选择目标目录；默认安装使用上述共享位置。

`huawei-dev upstream` 只读检查官方 CLI 与 Coding Agent 的 `latest`、`stable` 等发行通道。升级时显式固定 npm 依赖版本、检查 skill 接入约束，再同步和部署；不对所有 Agent 执行全局初始化。官方 CLI 的 macOS/Linux 实现包为 `@deveco/deveco-cli-common`，项目直接依赖该实现，避免跨平台外壳的可选依赖安装缺口。

详细命令见 [CLI 使用说明](tools/huawei-cli/README.md)，官方版本及重新下载见 [官方发行物](official/README.md)。本地官方 SDK 为 26.0.0 Beta2 / 26.0.0.32，HDC 为 3.2.0e；CLI 默认研究正式版文档不代表本地 SDK 已升级。

## 轻量包

`scripts/package-lite.sh` 包含工具、skill 和 CLI 本地依赖，排除 `official/command-line-tools/` 与 Studio DMG。解压后按 `official/README.md` 补齐官方发行物，并运行安装器。

官方 CLI 的 `create` 当前拒绝含空格的项目绝对路径；本目录含 `Lexar SSD`，创建工程需选定符合官方限制的实际路径。`check compat` 需要更高版本 Studio/CLT，项目当前 CLT 缺少 apicompat。其他命令按自身所需组件判断。
