#!/usr/bin/env node
import { access, chmod, cp, lstat, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  process.stdout.write("用法：./scripts/install-local.sh 或 huawei-tools-install\n批量安装 CLI 与 SDK 命令到 ~/.local/bin，skills 统一安装到 ~/.agents/skills。\n可用 HUAWEI_TOOLS_BIN_DIR、HUAWEI_SKILLS_DIR 指定安装目录。\n同名非本项目命令会阻止安装；旧宿主副本移入项目 .trash。\n");
  process.exit(0);
}
if (process.argv.length > 2) throw new Error(`未知参数：${process.argv.slice(2).join(" ")}`);
const toolRoot = fileURLToPath(new URL("../", import.meta.url));
const root = resolve(toolRoot, "../..");
const clt = join(root, "official", "command-line-tools");
const node = join(clt, "tool", "node", "bin", "node");
const projectBin = join(toolRoot, "bin");
const userBin = resolve(process.env.HUAWEI_TOOLS_BIN_DIR || join(homedir(), ".local", "bin"));
const skillsDirectory = resolve(process.env.HUAWEI_SKILLS_DIR || join(homedir(), ".agents", "skills"));
const marker = "# Managed by huawei-dev-tools";
const commands = [
  { name: "huawei-docs", entry: join(toolRoot, "dist", "cli.js"), node: true },
  { name: "huawei-dev", entry: join(toolRoot, "dist", "dev-cli.js"), node: true },
  { name: "devecocli", entry: join(toolRoot, "node_modules", "@deveco", "deveco-cli-common", "dist", "cli.js"), node: true },
  { name: "hdc", entry: join(clt, "sdk", "default", "openharmony", "toolchains", "hdc") },
  ...["hvigorw", "ohpm", "codelinter", "hstack"].map(name => ({ name, entry: join(clt, "bin", name) })),
  { name: "huawei-tools-install", entry: join(root, "scripts", "install-local.sh") }
];
const skills = ["huawei-docs", "huawei-devtools", "deveco-cli", "hmos-arkui-develop-skill", "hmos-dfx-analyzer", "hmos-design-to-arkts", "hmos-runtime-fix-skill"];
const backupRoot = join(root, ".trash", "local-install", `${new Date().toISOString().replaceAll(":", "-")}-${process.pid}`);
async function exists(path) {
  try { await lstat(path); return true; }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
}
function wrapper(directory, command) {
  const executable = command.node ? `"$SCRIPT_DIR/${relative(directory, node)}" ` : "";
  const environment = command.name === "devecocli"
    ? `export PATH="$SCRIPT_DIR/${relative(directory, dirname(node))}:$PATH"\nif [ -z "\${DEVECO_HOME:-}" ] && [ -z "\${DEVECO_CLI_CLT_PATH:-}" ]; then\n  DEVECO_CLI_CLT_PATH=$(CDPATH='' cd -- "$SCRIPT_DIR/${relative(directory, clt)}" && pwd)\n  export DEVECO_CLI_CLT_PATH\nfi\n` : "";
  return `#!/bin/sh\n${marker}\nset -eu\nSCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)\n${environment}exec ${executable}"$SCRIPT_DIR/${relative(directory, command.entry)}" "$@"\n`;
}
async function installCommand(target, command) {
  const content = wrapper(dirname(target), command);
  if (await exists(target) && await readFile(target, "utf8") === content) {
    await chmod(target, 0o755);
    return;
  }
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, { mode: 0o755 });
  await chmod(target, 0o755);
}
async function archive(path, group, name) {
  const target = join(backupRoot, group, name);
  await mkdir(dirname(target), { recursive: true });
  await rename(path, target);
  process.stdout.write(`已备份：${path} → ${target}\n`);
}
const ignored = new Set([".DS_Store", "__pycache__"]);
async function files(directory, prefix = "") {
  const result = [];
  for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) result.push(...await files(directory, path));
    else if (entry.isFile()) result.push(path);
    else throw new Error(`skill 中不支持符号链接或特殊文件：${join(directory, path)}`);
  }
  return result.sort();
}
async function skillUnchanged(source, target, command) {
  if (!await exists(target) || (await lstat(target)).isSymbolicLink()) return false;
  const expectedFiles = await files(source);
  if (JSON.stringify(expectedFiles) !== JSON.stringify(await files(target))) return false;
  for (const path of expectedFiles) {
    const expected = path === join("scripts", command.name) ? Buffer.from(wrapper(join(target, "scripts"), command)) : await readFile(join(source, path));
    if (!expected.equals(await readFile(join(target, path)))) return false;
  }
  return true;
}
// 写入前检查全部依赖和命名冲突。
await access(node);
if (skillsDirectory === join(root, "skills")) throw new Error("安装目录不能是项目 skill 源码目录");
for (const command of commands) {
  await access(command.entry);
  const target = join(userBin, command.name);
  if (userBin !== projectBin && await exists(target)) {
    const info = await lstat(target);
    if (!info.isFile() || !(await readFile(target, "utf8")).startsWith(`#!/bin/sh\n${marker}\n`)) {
      throw new Error(`同名命令不是本项目管理的入口，请先处理冲突：${target}`);
    }
  }
}
for (const name of skills) await access(join(root, "skills", name, "SKILL.md"));
for (const directory of new Set([projectBin, userBin])) {
  for (const command of commands) await installCommand(join(directory, command.name), command);
  process.stdout.write(`已安装 ${commands.length} 个命令：${directory}\n`);
}
await mkdir(skillsDirectory, { recursive: true });
for (const name of skills) {
  const source = join(root, "skills", name);
  const target = join(skillsDirectory, name);
  const commandName = name === "huawei-docs" ? "huawei-docs" : name === "huawei-devtools" ? "huawei-dev" : "devecocli";
  const command = commands.find(command => command.name === commandName);
  if (await skillUnchanged(source, target, command)) {
    await chmod(join(target, "scripts", command.name), 0o755);
    process.stdout.write(`skill 未变化：${name}\n`);
    continue;
  }
  if (await exists(target)) await archive(target, "shared", name);
  await cp(source, target, { recursive: true, errorOnExist: true, filter: path => !ignored.has(path.split(/[\\/]/).at(-1)) });
  await installCommand(join(target, "scripts", command.name), command);
  process.stdout.write(`已部署共享 skill：${name}\n`);
}
// 只归并本项目的七个 skill，其他宿主配置和其余 skill 保持原样。
for (const host of [".codex", ".dsh"]) {
  for (const name of skills) {
    const duplicate = join(homedir(), host, "skills", name);
    if (duplicate !== join(skillsDirectory, name) && await exists(duplicate)) await archive(duplicate, host.slice(1), name);
  }
}
process.stdout.write(`共享 skills：${skillsDirectory}\n命令：${commands.map(command => command.name).join(", ")}\n`);
if (!(process.env.PATH || "").split(":").includes(userBin)) process.stderr.write(`请把 ${userBin} 加入 PATH。\n`);
