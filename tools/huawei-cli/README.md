# Huawei CLI

已有项目维护的两套独立入口：`bin/huawei-docs` 查询可溯源官方文档；`bin/huawei-dev` 调用设备和 DevEco Code 提取能力。入口自动定位项目附带 Node，无需全局安装。

从仓库根目录执行 `./scripts/install-local.sh`，即可将两个项目 CLI、官方 `devecocli` 和 `hdc`、`hvigorw`、`ohpm`、`codelinter`、`hstack` 批量安装到 `~/.local/bin`。以后在任意目录使用这些短命令；`huawei-tools-install` 重新编译和安装整套工具。命名冲突会在写入前报错，无变化的重复安装不会重建 skill。

skill 仅部署到 `~/.agents/skills`，由 Codex 和 dsh 共享。这七个 skill 的宿主专用副本移到项目 `.trash`；项目源码和其他 skill 不受影响。`HUAWEI_TOOLS_BIN_DIR`、`HUAWEI_SKILLS_DIR` 可显式指定部署位置。

## 官方 DevEco CLI

`bin/devecocli` 直接运行官方 `@deveco/deveco-cli-common@1.3.12`，是新工程开发流程的主入口。启动器使用随附 Node，未显式配置时选择项目内 CLT；用户指定的 `DEVECO_HOME` / `DEVECO_CLI_CLT_PATH` 保持有效。

```bash
./bin/devecocli --help
./bin/devecocli device list --format json
./bin/devecocli docs search 屏幕录制 --format json --limit 5
./bin/devecocli docs update
./bin/devecocli check arkts --help
./bin/devecocli signature --help
./bin/devecocli d2a --output json workflow
./bin/huawei-dev --json upstream
```

官方 `run` 会构建并运行，与项目 `huawei-dev run` 的显式旧 bridge 行为不同。不要自动切换两种实现。官方 CLI 没有全局 `--json`，具体格式参数以子命令帮助为准。离线文档库已更新至 1.3.12；最新官网内容和具体 API 设备限制仍使用 huawei-docs。

官方 `create` 拒绝含空格的项目绝对路径；`check compat` 在当前 CLT 26.0.0.621 上因缺少 apicompat 而不可用。项目创建已在不含空格的临时路径验证，实际工程不擅自改位置。

五个上游 skill 分别提供官方 CLI、ArkUI 开发、DFX 分析、设计稿转 ArkTS、JS 运行时修复。资源固定于 `skills/deveco-upstream.json` 记录的版本；入口模板维护在 `skill-adapters`，`scripts/sync-deveco-skills.mjs` 同步资源并保留原始 `UPSTREAM.md`。源码 checkout 放在 `~/third-party/deveco-code`，要求 v0.2.5；不全局安装 Coding Agent。

## 文档查询

从本工具目录执行：

```bash
./bin/huawei-docs doctor
./bin/huawei-docs --refresh sync index
./bin/huawei-docs catalogs
./bin/huawei-docs documents doccenter-release-notes --contains 2600 --limit 20
./bin/huawei-docs tree doccenter-references --contains AVScreenCapture --documents-only
./bin/huawei-docs search '输入事件注入' --limit 5
./bin/huawei-docs lookup OH_Input_RequestInjection
./bin/huawei-docs read hdc --anchor hdc版本配套表
./bin/huawei-docs --json symbol OH_Input_RequestInjection --version 7.0 --device Phone
./bin/huawei-docs read doccenter-release-notes/overview-2600
./bin/huawei-docs profiles list
./bin/huawei-docs library build
```

主索引来自官网 `getCenterFullCatalogTree`，包含版本、工具、能力、API、测试和最佳实践等分类；详情读取 `getCenterDocument`，正文读取对应 `.md`。站内搜索的旧地址按当前官方目录确定身份；不维护手写路由映射，不在 404 后自动换来源。

使用搜索或目录返回的完整 ID，例如 `doccenter-references/api/capi-oh-input-manager-h`。`read` 支持裸文件名，但同名歧义必须显式指定 ID。`lookup` 同时返回目录、元数据、大纲与出处；大正文用 `read --anchor`，需要完整文件用 `read --out /absolute/path.md`。

默认目标 API 26.0.0；`7.0` 表示同一目标，26.0.1 单独表示 Beta1。文档中的旧格式 `6.1.1(24)` 解析为 API 24，26 起完整比较语义化版本。`search --version` 仅标注目标；函数结论用 `symbol`，其 `requires_verification` 不能视为支持。

缓存位于 `data/huawei-docs`，没有 TTL。最新研究显式用全局 `--refresh`；普通查询复用快照。`doctor` 默认实时检查，`doctor --cached` 会标注缓存模式。`library build` 将缓存正文和目录写成 `docs/huawei-docs` 阅读库，API 子目录与本地相对链接均保留。

所有组合查询使用 `--json`，输出 `{ok,data}` 或 `{ok:false,error}`，失败退出码非零。

## 开发与设备

```bash
./bin/huawei-dev --json doctor
./bin/huawei-dev --json devices
./bin/huawei-dev --json device info --device <target>
./bin/huawei-dev --json device install /path/to/signed.hap --device <target>
./bin/huawei-dev --json device start --bundle com.example.app --ability EntryAbility --device <target>
./bin/huawei-dev --json device ui dump --visible --device <target>
./bin/huawei-dev --json device ui click '设置' --device <target>
./bin/huawei-dev --json log --device <target> --prefix MyApp --lines 200
./bin/huawei-dev --deveco-home /path/DevEco-Studio.app --project /path/app build
./bin/huawei-dev --project /path/app signing status
./bin/huawei-dev --json auth status
./bin/huawei-dev knowledge 'ArkTS 的具体问题'
```

多连接时必须选 target，包括同一手机的 USB 与无线两条连接。`devices` 返回结构化 `id/state/raw`，`device info` 返回实机 API/系统/型号。HDC 优先级为 `HDC_PATH`、显式 Studio 路径或 `DEVECO_HOME`、`HARMONY_SDK_HOME`、项目内官方工具链；显式配置错误直接失败。

`device install/start/ui` 与 `log` 直接走 HDC，不需要 Studio bridge。UI 先观察树再定位，支持文本、hint、id；以子命令帮助为准。`log --clear` 会清空日志。UI 操作后需重新观察页面或业务结果，命令退出成功不等于业务完成。

`create/build/run/check-ets/check-cpp/tools` 使用固定的 DevEco Code 模板或 `@deveco-codegenie/mcp-bridge@1.1.11`，需要完整 DevEco Studio。`run` 不构建；已有签名 HAP 可直接安装启动。不要为这些操作启动原 Coding Agent/TUI。

`signing auto` 复用 Studio Keychain 登录态，通过 HOS 后端生成材料并用 SDK 签署已有 unsigned HAP，不改工程签名配置。`auth/knowledge` 则为独立 OAuth 与 BigSearch；不读其他 Agent 的凭证目录。来源及签名细节见 [提取说明](../../skills/huawei-devtools/references/deveco-code-extraction.md)。

## 维护

`package.json` 中 `build` 为 TypeScript 编译，`check` 为静态检查，`test` 为现有 Vitest。使用项目官方 Node 执行这些工具。修改 skill 源码后运行 `huawei-tools-install`，更新命令和 `~/.agents/skills` 的共享部署。不要直接修改部署副本。
