---
name: huawei-docs
description: 用本地 huawei-docs CLI 检索、读取和核验华为 HarmonyOS 官方开发文档，判断具体 API 的起始版本、设备限制、系统能力及权限。用于 HarmonyOS 7 / API 26、SDK 版本变化、C API、ArkTS API 和调试签名文档研究。
---

# Huawei Docs

查询工具已经实现，直接使用本 skill 的 `scripts/huawei-docs`。以下 `$SKILL_DIR` 指本 SKILL.md 所在目录；路径含空格时必须保留引号：

```bash
HUAWEI_DOCS="$SKILL_DIR/scripts/huawei-docs"
"$HUAWEI_DOCS" --help
```

源码在 huawei-dev-tools 的 `tools/huawei-cli`，skill 源码在该项目的 `skills/huawei-docs`；Codex 中的副本由 `install-local.mjs` 物理部署，启动脚本指向同一套工具。不要重新创建查询 CLI 或全局入口。

## 按问题选择入口

- 找接口、Kit、开发指南：`search '<问题或符号>' --limit 5`。
- 已知文档：`read <id> --anchor <函数或标题>`；先看结构用 `outline <id>`。
- 要目录、元数据和出处一起看：`lookup <问题或id>`；大正文另用 `read`。
- 判断具体函数在设备上是否可用：`symbol <函数> --version <API版本> --device Phone`。
- 看版本变化：`documents doccenter-release-notes --contains 2600 --limit 20`，然后读取具体版本说明。
- 全站分类：`catalogs`；分类内枚举用 `documents <catalog>`，层级导航用 `tree <catalog>`。
- 排查查询失败：`doctor` 实时检查；`doctor --cached` 只验证已有快照，不能证明远端在线。

首次研究或用户要求查最新时运行 `--refresh sync index`；最新问题的搜索、正文也加 `--refresh`。普通重复查询复用缓存，缓存没有自动过期。不要每次加载 skill 都跑全套检查或全库下载。

## 版本与证据

- 默认目标是 API `26.0.0`。`--version 7.0` 按官方对应关系表示同一目标；`26.0.1` 是独立的 Beta 画像，不能当成所有 7.0 设备都具备的能力。
- 实机 API 优先通过 huawei-devtools 的 `device info --device <id>` 读取。系统展示名、宿主 SDK 和设备 API 是不同事实。
- `6.1.1` 表示 API 24；`6.1` 表示 API 23–24；`6` 表示 API 20–24。文档起始版本 `6.1.1(24)` 按括号中的 24 判断；26 起比较完整语义化版本。
- `search` 的版本参数仅标注研究目标，不是函数级过滤。结论用 `symbol` 返回的 `compatibility.verdict`、`reasons`、`metadata` 和 `source`。
- `requires_verification` 表示证据不足；版本满足不代表权限已获批或设备已支持。输入注入尤其要核对 Phone 与 PC/2in1 的差异。
- 搜索混合总数包含问答/示例，文档数量看 `returnedDocuments`。

## 官方来源与阅读库

主目录来自官网 `getCenterFullCatalogTree`，详情来自 `getCenterDocument`，正文来自官方 `.md`。搜索仍可能返回旧地址，CLI 按官方目录确定当前文档身份，不猜目录映射。常用 ID：

```text
doccenter-capabilities/hdc
doccenter-references/api/capi-oh-input-manager-h
doccenter-references/api/capi-native-avscreen-capture-h
doccenter-release-notes/overview-2600
```

使用搜索/目录返回的完整 ID，不手拼旧 `harmonyos-guides` 或 `harmonyos-references` 地址。同名文档歧义时显式选择完整 ID。官方目录以外的文档可使用官网实际可访问的完整 URL。

内部响应位于工具的 `data/huawei-docs`；`library build` 将已抓取正文生成到 `docs/huawei-docs`，从其 `README.md` 阅读，支持 API 子目录和本地链接。不要把 JSON 缓存当作交付文档。

脚本组合调用加全局 `--json`，解析 `{ok,data}` 或 `{ok:false,error}`；全局 `--refresh`、`--json` 放子命令前，目标 `--version` 放 `search`/`symbol` 后。

```bash
"$HUAWEI_DOCS" --refresh --json symbol OH_Input_RequestInjection --version 7.0 --device Phone
"$HUAWEI_DOCS" read hdc --anchor hdc版本配套表
"$HUAWEI_DOCS" read doccenter-release-notes/overview-2600
```

涉及 HAP 签名、证书或 Profile 时，读取 [references/hap-debug-signing.md](references/hap-debug-signing.md)。工程创建、构建、签名执行和设备操作使用 huawei-devtools；BigSearch 是另一条云端知识链，不代替官方 API 证据。
