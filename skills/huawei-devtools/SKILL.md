---
name: huawei-devtools
description: 使用项目维护的 huawei-dev CLI 获取结构化设备 API/HDC/HiLog/uitest 信息、调用 Studio HOS 调试签名和独立 BigSearch，或显式使用既有 bridge 工具。新工程的官方开发流程使用 deveco-cli skill。
---

# Huawei DevTools

新工程的创建、构建、检查、运行、官方签名与 DevEco Testing 优先使用已部署的 deveco-cli skill，版本为 1.3.12。本 skill 负责下述独立维护的接口，不在官方命令失败时自动切换过来。

已有独立 CLI，直接调用本 skill 的 `scripts/huawei-dev`。以下 `$SKILL_DIR` 指本 SKILL.md 所在目录：

```bash
HUAWEI_DEV="$SKILL_DIR/scripts/huawei-dev"
"$HUAWEI_DEV" --json doctor
```

日常也可直接运行 PATH 中的 `huawei-dev`。源码位于 huawei-dev-tools 的 `tools/huawei-cli`，skill 唯一源码为该项目的 `skills/huawei-devtools`。`huawei-tools-install` 统一部署到 `~/.agents/skills`，供 Codex 与 dsh 共享，不依赖 `~/projects` 固定路径或全局 Node。

## 工具边界

| 工作 | 入口 | 依赖 |
|---|---|---|
| 确认 SDK/HDC/设备 | `doctor`、`devices`、`device info` | 项目 Command Line Tools |
| 检查官方发行通道 | `upstream` | 只读访问 npm 官方源 |
| 安装、启动现有 HAP | `device install`、`device start` | HDC；不需要 bridge |
| UI 树、定位与操作 | `device ui dump/wait/click/input/fling` | 设备 uitest；不需要 bridge |
| 读取日志 | `log` | HDC |
| 创建、检查、构建、运行 | `create`、`check-ets`、`check-cpp`、`build`、`run` | 完整 DevEco Studio |
| 调试签名 | `signing status/auto` | SDK/JDK、Studio 登录态、真机 |
| 云端知识查询 | `auth status/login/logout`、`knowledge` | 独立华为 OAuth |
| 查看 bridge schema | `tools` | 完整 Studio |

API/权限/设备限制用 huawei-docs 的官方段落核验。DevEco Code 提取来源、版本、许可证及认证后端见 [references/deveco-code-extraction.md](references/deveco-code-extraction.md)。不需要重新安装或启动 `@deveco/deveco-code` 的 Agent/TUI。

## 设备工作流

```bash
"$HUAWEI_DEV" --json devices
"$HUAWEI_DEV" --json device info --device <target>
"$HUAWEI_DEV" --json device install /path/to/signed.hap --device <target>
"$HUAWEI_DEV" --json device start --bundle com.example.app --ability EntryAbility --device <target>
"$HUAWEI_DEV" --json log --device <target> --prefix MyApp --lines 200
```

多条连接时显式传 `--device`，同一手机的 USB 与无线连接也算两个 target。只选择 Connected；Offline/未授权时处理连接原因，不盲目重启服务、IDE或重新构建。`device info` 返回设备报告的 API，与 `doctor` 中宿主 SDK 分开理解。

HDC 按 `HDC_PATH`、`--deveco-home`/`DEVECO_HOME`、`HARMONY_SDK_HOME`、项目内官方工具链选择。显式路径无效就修正路径；不要悄悄换另一套 SDK。需要完整 Studio 时传全局 `--deveco-home /path/DevEco-Studio.app`。

`device install` 默认替换已有应用；`log --clear` 会清空日志，只在用户需要清空时使用。`doctor` 不读取账号凭证；它报告工具和连接事实，不证明应用业务流程已经成功。

## UI 操作

```bash
"$HUAWEI_DEV" --json device ui dump --device <target> --visible
"$HUAWEI_DEV" --json device ui wait '设置' --device <target>
"$HUAWEI_DEV" --json device ui click '设置' --device <target>
"$HUAWEI_DEV" --json device ui input '搜索' '关键词' --attribute hint --device <target>
"$HUAWEI_DEV" --json device ui fling up --device <target>
```

先查看当前 UI 树，再使用实际出现的文本、hint 或 id 定位；参数与等待时间以 `device ui <操作> --help` 为准。操作后重新观察结果，不能只凭注入命令退出成功判定业务完成。这条链是调试态 uitest，不等于普通手机应用获得 Input Kit 全局注入权限。

## 工程与签名

`create --parent /path/to/projects --app-name HelloHarmony` 从所选 Studio 的 SDK 元数据读取 API；非空目标会失败，不自动清空。工程名必须满足 `^[A-Za-z][A-Za-z0-9_]{0,127}$`，用户未指定英文名时先让用户选择。

```bash
"$HUAWEI_DEV" --json --project /path/to/app check-ets entry/src/main/ets/pages/Index.ets
"$HUAWEI_DEV" --json --project /path/to/app check-cpp entry/src/main/cpp/main.cpp
"$HUAWEI_DEV" --json --project /path/to/app build --module entry@default --mode debug
"$HUAWEI_DEV" --json --project /path/to/app signing status
"$HUAWEI_DEV" --json --project /path/to/app signing auto --input /path/to/unsigned.hap --device <target>
```

`build` 默认增量；`run` 通过 bridge 安装启动已有产物，不构建。已有签名产物直接用 `device install/start`。C/C++ 问题用 `check-cpp`，不改写成 ArkTS 来检查。

签名前读取 huawei-docs skill 的 `references/hap-debug-signing.md`。`signing auto` 复用 Studio Keychain 登录态，生成并核验 debug Profile 后用 SDK 签署已有 unsigned HAP，不修改工程签名配置。macOS 可能弹出 Keychain 授权。最终以目标真机安装与启动结果为准，签名成功不等于应用行为成功。

## BigSearch

```bash
"$HUAWEI_DEV" --json auth status
"$HUAWEI_DEV" auth login
"$HUAWEI_DEV" --json knowledge 'ArkTS 的具体问题'
```

先查授权状态，需要时再登录。`auth` 是 DevEco Code BigSearch 的独立 OAuth，和 `signing auto` 使用的 Studio 登录态不同。凭证不输出、不手工读取密文来排查普通失败。BigSearch 用来获得开发线索，API 版本、设备和权限仍查官方文档。
