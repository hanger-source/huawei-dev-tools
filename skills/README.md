# Codex skills 源码

这里维护两个项目 skill（`huawei-docs`、`huawei-devtools`）和五个接入后的官方 skill（`deveco-cli`、`hmos-arkui-develop-skill`、`hmos-dfx-analyzer`、`hmos-design-to-arkts`、`hmos-runtime-fix-skill`）。

官方参考与脚本固定来自 `@deveco/deveco-cli-common@1.3.12`，运行时修复资源来自 DevEco Code v0.2.5。宿主入口维护在 `tools/huawei-cli/skill-adapters`；运行 `scripts/sync-deveco-skills.mjs` 生成五个 skill，保留上游原文及来源哈希。不要直接编辑生成副本的入口。

`~/.codex/skills/` 下的对应目录是 Codex 发现机制要求的物理
部署副本，不是源码目录，也不是符号链接。修改后从 `tools/huawei-cli` 运行：

```bash
pnpm run install-local
```
