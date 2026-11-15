# scrcpy 客户端包装工具

这里仅保存我们维护的 scrcpy 宿主端构建入口，不复制官方 SDK 或 HDC：

- `build-scrcpy-client.sh`：构建 scrcpy 4.1 macOS 客户端，不构建设备端 server。
- 默认源码工程是 `~/projects/scrcpy`。
- 如需使用其他源码目录，显式设置 `SCRCPY_PROJECT_ROOT`。

统一使用 Command Line Tools 自带的 HDC 3.2.0e：
`official/command-line-tools/sdk/default/openharmony/toolchains/hdc`。

```sh
./build-scrcpy-client.sh
../../official/command-line-tools/sdk/default/openharmony/toolchains/hdc -v
```
