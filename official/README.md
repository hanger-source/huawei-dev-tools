# 华为官方发行物

本目录只保存华为发布的原始工具和安装介质。

| 路径 | 内容 | 版本/用途 |
|---|---|---|
| `command-line-tools/` | 解压后的 Command Line Tools、HarmonyOS/OpenHarmony SDK、Node、hvigor、ohpm、签名工具和当前 HDC | 26.0.0.621，API 26 Beta2 |
| `installers/deveco-studio-26.0.0.621-aarch64.dmg` | DevEco Studio macOS arm64 安装介质 | 26.0.0.621 |

Command Line Tools 保持完整发行结构，其中的 HDC 3.2.0e 是本目录唯一 HDC。`emulator`、
`Previewer`、两套不同来源的 LLVM 等组件不是重复副本，不能按文件名相似直接裁掉。
DevEco Studio 仅保留 DMG，不同时保留外层下载 ZIP。

## 重新下载

轻量压缩包不包含上面两个大目录/文件。华为下载链接可能要求登录并生成临时 CDN 地址，
因此只记录稳定的官方下载页，不保存会失效的 CDN URL。

### Command Line Tools 26.0.0.621

- 官方下载页：<https://developer.huawei.com/consumer/cn/download/command-line-tools-for-hmos>
- 官方使用说明：<https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-commandline-get>
- 选择：macOS ARM64
- 文件名：`commandline-tools-mac-arm64-26.0.0.621.zip`
- 文件大小：`2053599964` 字节
- SHA-256：`c5e71750eda7de50e906a22547d7844e7f60aaabed45cb5fa9a75944bc5cdb23`
- 解压后位置：`~/projects/huawei-dev-tools/official/command-line-tools`

```bash
shasum -a 256 ~/Downloads/commandline-tools-mac-arm64-26.0.0.621.zip
unzip -q ~/Downloads/commandline-tools-mac-arm64-26.0.0.621.zip \
  -d ~/projects/huawei-dev-tools/official
~/projects/huawei-dev-tools/official/command-line-tools/bin/hvigorw --version
~/projects/huawei-dev-tools/official/command-line-tools/sdk/default/openharmony/toolchains/hdc -v
```

### DevEco Studio 26.0.0.621

- 官方下载页：<https://developer.huawei.com/consumer/cn/deveco-studio>
- 选择：macOS ARM
- 下载文件名：`devecostudio-mac-arm-26.0.0.621.zip`
- 下载文件大小：`3974652786` 字节
- 下载文件 SHA-256：`8bfeee5aa9b4368b1405302467fddcf2ea80f676179233977b9f1e80e1c01550`
- ZIP 内安装介质：`deveco-studio-26.0.0.621-aarch64.dmg`
- DMG 位置：`~/projects/huawei-dev-tools/official/installers/deveco-studio-26.0.0.621-aarch64.dmg`

```bash
shasum -a 256 ~/Downloads/devecostudio-mac-arm-26.0.0.621.zip
mkdir -p ~/projects/huawei-dev-tools/official/installers
ditto -x -k ~/Downloads/devecostudio-mac-arm-26.0.0.621.zip \
  ~/projects/huawei-dev-tools/official/installers
```

如果 ZIP 解压后额外包含一层同名目录，只把其中的 DMG 物理移动到 `official/installers/`；
不要创建指向 `Downloads` 的符号链接。
