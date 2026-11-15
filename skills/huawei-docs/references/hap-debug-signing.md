# HAP 调试签名

用于 HarmonyOS 应用的本地调试签名、DevEco Studio 下载、真机安装。目标是先确定签名分支和所需材料，再做一次可观察的登录、下载、签名和安装；不要靠重复打开页面、固定等待或更换近似材料碰运气。

## 先收集事实

在打开登录页或创建 AGC 应用前，确认：

- 项目的 `bundleName`、目标 SDK/API、`build-profile.json5` 当前签名配置和待安装 HAP 路径。
- 真机型号、系统/API、连接状态和 UDID。
- 项目使用的权限与 API 是否含受限 ACL。
- 本机已有 DevEco Studio 的版本；根据目标 SDK 的官方配套说明选择版本，不把官网“最新版本”等同于项目所需版本。

先用 `huawei-docs lookup ide-signing`、`read doccenter-deveco-studio/ide-signing` 及目标 API/权限文档核验当前规则。搜索命中只是入口，签名分支以官方签名文档、权限等级和设备范围为准。

## 先判定签名分支

普通单设备调试、公开权限、开发者本人连接真机时，优先走 DevEco Studio 自动签名：

1. 打开项目的 `File > Project Structure > Project > Signing Configs`。
2. 勾选 `Automatically generate signature`。
3. 未在 AGC 注册应用时，不勾选 `Associate with registered application`。
4. 只在 DevEco 要求授权时完成一次华为账号登录。

自动签名会生成相互匹配的密钥、CSR、证书和 Profile，并回写构建配置。不要先手工生成 `.p12/.csr/.cer/.p7b`，也不要因为未签名 HAP 安装失败就立即进入手工流程。

只有以下条件成立时才走手工签名：跨多台测试设备、离线构建、团队共享既定密钥、自动签名不支持的受限 ACL/能力，或用户明确要求手工材料。手工流程的材料顺序是：

1. 生成 `.p12` 与 `.csr`。
2. 在 AGC 创建与 `bundleName` 精确一致的应用。
3. 上传 CSR，取得调试 `.cer`。
4. 注册目标设备 UDID。
5. 为该应用、证书和设备生成调试 `.p7b` Profile。
6. 在 Signing Configs 中同时配置匹配的 `.p12/.cer/.p7b`，算法使用官方要求的 `SHA256withECDSA`。

任一材料的应用、密钥或设备范围不匹配时，停止并修正材料来源；不要交叉替换证书和 Profile 反复安装。

## 登录和下载要一次完成

浏览器登录是正常步骤，不是禁区。效率约束如下：

- 先从官方文档确定 DevEco Studio 的目标版本、平台和架构，再打开下载中心。
- 复用已经登录且未 discarded 的明确标签页；已有 `tabId` 时直接取得该 tab，不要每一步重新枚举或改用 active tab 猜目标。
- 如果旧 tab 已 discarded 或文档未提交，开一个新的官方页面并只继续这一个 tab；不要反复尝试唤醒旧 tab。
- 页面操作前先读取一次 DOM/可访问性事实，精确定位“版本 + macOS/Windows + ARM/x86”控件。导航或下载监听必须先注册，再点击；用事件结果判断完成，不使用固定 sleep。
- 遇到验证码、二次验证或用户账号确认时，请用户在当前 tab 完成；完成后继续复用同一个 tab，不重新登录。
- 点击下载前记录官网展示的版本、文件名、大小和校验值；下载完成后按官网值校验。官网没有公开校验值时如实记录，不自己假设。

## 构建、安装和验收

1. 自动签名完成后重新构建，确认产物不是 `*-unsigned.hap`，并记录实际产物路径。
2. 安装前确认仍是同一目标设备；用项目现有 HDC 工具执行安装，不另外复制一套 SDK。
3. 将“构建成功”“签名材料生成”“HAP 安装成功”“应用真机行为通过”视为四个独立证据，不用前一个替代后一个。
4. 安装错误若仍指向 PKCS7、证书链、Profile 或设备范围，回到签名材料核对；不要重新下载 IDE或随机重签。
5. 真机安装成功后再验证项目的业务链路。签名完成不等于网络、P2P、VPN 或其他运行时能力已经成立。

## 官方文档入口

- 自动/手工签名总入口：`doccenter-deveco-studio/ide-signing`
- 创建 AGC 应用：`app/agc-help-create-app-0000002247955506`
- 申请调试证书：`app/agc-help-debug-cert-0000002283256797`
- 注册调试设备：`app/agc-help-add-device-0000002283189937`
- 申请调试 Profile：`app/agc-help-debug-profile-0000002248181278`
