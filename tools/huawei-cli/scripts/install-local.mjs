#!/usr/bin/env node

import { access, chmod, cp, lstat, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  process.stdout.write("用法：node scripts/install-local.mjs\n更新项目 CLI 启动脚本并部署 Codex skills。\n可用 HUAWEI_DOCS_BIN_DIR 和 HUAWEI_CODEX_SKILLS_DIR 显式指定目标目录。\n");
  process.exit(0);
}
if (process.argv.length > 2) throw new Error(`未知参数：${process.argv.slice(2).join(" ")}`);

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const workspaceRoot = resolve(projectRoot, "../..");
const nodeExecutable = join(workspaceRoot, "official", "command-line-tools", "tool", "node", "bin", "node");
const projectBinDirectory = fileURLToPath(new URL("../bin/", import.meta.url));
const binDirectory = process.env.HUAWEI_DOCS_BIN_DIR || projectBinDirectory;
const commands = [
  { name: "huawei-docs", entry: fileURLToPath(new URL("../dist/cli.js", import.meta.url)) },
  { name: "huawei-dev", entry: fileURLToPath(new URL("../dist/dev-cli.js", import.meta.url)) },
  { name: "devecocli", entry: fileURLToPath(new URL("../node_modules/@deveco/deveco-cli-common/dist/cli.js", import.meta.url)) }
];

function wrapper(directory, command) {
  const relativeNode = relative(directory, nodeExecutable);
  const clt = relative(directory, join(workspaceRoot, "official", "command-line-tools"));
  const environment = command.name === "devecocli"
    ? `export PATH="$SCRIPT_DIR/${dirname(relativeNode)}:$PATH"\nif [ -z "\${DEVECO_HOME:-}" ] && [ -z "\${DEVECO_CLI_CLT_PATH:-}" ]; then\n  DEVECO_CLI_CLT_PATH=$(CDPATH='' cd -- "$SCRIPT_DIR/${clt}" && pwd)\n  export DEVECO_CLI_CLT_PATH\nfi\n`
    : "";
  return `#!/bin/sh\nset -eu\nSCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)\n${environment}exec "$SCRIPT_DIR/${relativeNode}" "$SCRIPT_DIR/${relative(directory, command.entry)}" "$@"\n`;
}

for (const command of commands) {
  const target = join(binDirectory, command.name);
  await access(command.entry);
  await access(nodeExecutable);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, wrapper(dirname(target), command), { mode: 0o755 });
  await chmod(target, 0o755);
  process.stdout.write(`${command.name} 已安装为物理启动脚本：${target}\n`);
}

const skillsDirectory = process.env.HUAWEI_CODEX_SKILLS_DIR || join(homedir(), ".codex", "skills");
const skills = ["huawei-docs", "huawei-devtools", "deveco-cli", "hmos-arkui-develop-skill", "hmos-dfx-analyzer", "hmos-design-to-arkts", "hmos-runtime-fix-skill"];
await mkdir(skillsDirectory, { recursive: true });

async function pathExists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    if (code === "ENOENT") return false;
    throw error;
  }
}

for (const name of skills) {
  const source = join(workspaceRoot, "skills", name);
  const target = join(skillsDirectory, name);
  await access(join(source, "SKILL.md"));

  if (await pathExists(target)) {
    const trashDirectory = join(skillsDirectory, ".trash", new Date().toISOString().replaceAll(":", "-"));
    await mkdir(trashDirectory, { recursive: true });
    await rename(target, join(trashDirectory, name));
  }

  await cp(source, target, { recursive: true, errorOnExist: true });
  const commandName = name === "huawei-docs" ? "huawei-docs" : name === "huawei-devtools" ? "huawei-dev" : "devecocli";
  const command = commands.find(command => command.name === commandName);
  const launcher = join(target, "scripts", command.name);
  const launcherDirectory = dirname(launcher);
  await mkdir(launcherDirectory, { recursive: true });
  await writeFile(launcher, wrapper(launcherDirectory, command), { mode: 0o755 });
  await chmod(launcher, 0o755);
  await readFile(join(target, "SKILL.md"), "utf8");
  process.stdout.write(`${name} skill 已物理部署：${target}\n`);
}

const pathEntries = (process.env.PATH || "").split(":");
if (!pathEntries.includes(binDirectory)) {
  process.stderr.write(`提示：项目内直接运行 ${join(binDirectory, "huawei-docs")} 或 ${join(binDirectory, "huawei-dev")}，也可把 ${binDirectory} 加入当前 shell 的 PATH。\n`);
}
