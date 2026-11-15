# DevEco Code 提取边界

## 官方 CLI 与 skill 来源

常规开发主入口是官方 DevEco CLI 1.3.12（macOS/Linux 实现包 `@deveco/deveco-cli-common`）。官方 CLI、ArkUI、DFX 与设计还原资源使用该版本；JS 运行时修复资源来自 DevEco Code v0.2.5 / `b56e1b8d69dcc300b55fdb06d1470351fb75cdd8`。来源和入口哈希见项目 `skills/deveco-upstream.json`。

项目 skill 入口适配 Codex 的路径、工具与任务流程，上游正文和脚本保留。`customize-deveco` 面向原 Agent 自身配置，不在 Codex 中启用。官方 CLI 的文档库是离线来源；huawei-docs 的官网查询与函数级判定独立负责最新证据。

## 独立 huawei-dev 封装来源

- 仓库：`https://gitcode.com/openharmony-sig/deveco-code.git`
- Tag：`v0.1.7`
- Commit：`742e15045e4cfddf35d042573258dd7f7d3cfad3`
- 本地只读参考：`~/third-party/deveco-code`
- npm 外壳：`@deveco/deveco-code@0.1.7`
- N-API bridge：`@deveco-codegenie/mcp-bridge@1.1.11`

## 截图能力映射

| DevEco Code 展示项 | 实际实现 | 独立 Huawei 提取 |
|---|---|---|
| `create` | `deveco-create-project` skill 的模板与脚本 | `huawei-dev create` |
| `check` | `check_ets_files` / `check_cpp_files` | `check-ets` / `check-cpp` |
| `build` | bridge `build_project` | `build` |
| `run` | bridge `start_app` | `run` |
| `log` | TypeScript HDC 包装 | 直接 HDC 的 `devices` / `log` |
| `knowledge` | OAuth + `arkts_knowledge_search` | `auth` / `knowledge` |

bridge 的 UI 工具未直接包装；独立 CLI 已通过公开 HDC/uitest 提供 `device ui dump/wait/click/input/fling`，以及 `device install/start/info`。这些入口不依赖完整 Studio，也不启动原 Coding Agent。

## 没有提取的内容

- 133 MB 的 `@deveco/deveco-code-darwin-arm64` 聚合可执行文件。
- DevEco Code 的 TUI、模型 provider、session、Agent prompts 和强制 SDD 工作流。
- `arkts-grammar-standards`、`arkts-error-fixes`、`arkts-runtime-fix`、`customize-deveco`
  等面向其 Agent 的长提示；本 skill 只保存可执行能力的选择规则。
- 模板中的 `AGENT.md` 阅读限制。
- N-API bridge 二进制副本；它由固定 npm 依赖提供，便于审计实际版本。

## 许可

DevEco Code 仓库声明 MIT。`deveco-create-project/scripts/*.mjs` 自身带 Huawei Device
Co., Ltd. 的 Apache-2.0 文件头，提取后继续保留；模板来源与许可证记录在
`vendor/deveco-create-project/NOTICE.md`。N-API bridge 包没有在自身 package metadata 中明确声明
许可证，因此不复制其二进制，只以固定 npm 包依赖使用。

## BigSearch 认证链

`knowledge` 不是 bridge 工具。原实现向
`https://cn.devecostudio.huawei.com/codeGenie/bigSearch` POST `{question}`，并把 DevEco Code
OAuth access token 放进 `Authorization` header。独立实现保留以下最小链路：

1. 打开 `/console/DevEcoIDE/apply`，`appid=1008`，回调只监听 `127.0.0.1`。
2. 用临时 token 换 JWT。
3. 用 JWT 获取或刷新 30 分钟 access token，并核验中国站账号。
4. AES-256-GCM 加密保存独立凭证，文件权限 `0600`。
5. `auth logout` 把认证文件移入同目录 `.trash`，不直接删除。

这条链与 DevEco Studio 登录状态分离，也不借用 DevEco Code 的凭证目录。

## HarmonyOS HOS 自动签名来源

签名不是 DevEco Code 截图中六个 Tool 之一，也不由 N-API bridge 暴露。独立实现来自已安装
DevEco Studio 26.0.0.621 的真实 HOS 工程管理后端：

- JAR：`Contents/plugins/harmony/lib/hos-project-mgmt-26.0.0.621.jar`
- 主链：`HosAutoSigningService` → `AutoSigningHandleService` →
  `AutoSigningConfigsService` / `RequestAdapter`
- 登录链：`HiAiLoginService`、`RefreshTokenService`、`TeamUtils`、`HttpClient`
- 本地材料：`AutoGenerateKeyCSRUtil`、`CommonUtil`、`LocalStoreUtil`
- 签名器：SDK `openharmony/toolchains/lib/hap-sign-tool.jar`

Studio JWT 位于 macOS Keychain 的 `LoginPlugin/jwtToken`。CLI 只把它送到
`/authrouter/auth/api/jwToken/check`，使用 `refresh:true` 换取新的 access token；不会输出或另存
JWT。AGC 请求使用 Studio 相同的 `uid`、`oauth2Token`、`teamId` header。`refresh:false` 即使
返回 `status:true`，也可能给出已被 AGC 淘汰的旧票，表现为团队接口 HTTP 401 和
`getTokenInfo return null`。

签名后端入口固定为 `https://connect-api.cloud.huawei.com`，主要调用：

1. `/api/ups/user-permission-service/v1/user-team-list` 查询团队。
2. `/api/cps/harmony-cert-manage/v1/cert/{list,add,delete}` 管理自动调试证书。
3. `/api/cps/device-manage/v1/device/{list,add}` 核对并注册 HDC 真机 UDID。
4. `/api/cps/provision-manage/v1/ide/test/provision/add` 生成调试 Profile。
5. `/api/amis/app-manage/v1/objects/url/reapply` 换取证书对象下载地址。
6. `hap-sign-tool.jar sign-app` 直接签署 unsigned HAP。

IDE Profile 接口的成功响应可以只有 `provisionFileUrl`，没有 `id`；Studio 对空 id 的删除也是
明确 no-op。复用已有 Profile 前，CLI 用 `verify-profile` 检查 `type=debug`、bundle name、当前
设备 UDID 和有效期，不能只凭 `.p12/.csr/.cer/.p7b` 四个文件存在就判定可复用。
