#!/usr/bin/env node
import { cp, mkdir, readFile, rename, stat, writeFile, chmod } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  process.stdout.write("用法：node scripts/sync-deveco-skills.mjs\n从已安装的固定版本官方 CLI 和 DevEco Code v0.2.5 同步 skill 资源。\n可用 DEVECO_CODE_SOURCE 指定源码 checkout；宿主入口模板来自 skill-adapters。\n");
  process.exit(0);
}
if (process.argv.length > 2) throw new Error(`未知参数：${process.argv.slice(2).join(" ")}`);

const toolRoot = fileURLToPath(new URL("../", import.meta.url));
const root = resolve(toolRoot, "../..");
const upstream = join(toolRoot, "node_modules/@deveco/deveco-cli-common");
const pkg = JSON.parse(await readFile(join(upstream, "package.json"), "utf8"));
if (pkg.version !== "1.3.12") throw new Error(`需要核验 skill 接入规则：发现上游 ${pkg.version}`);
const codeRoot = process.env.DEVECO_CODE_SOURCE || join(homedir(), "third-party", "deveco-code");
const codeCommit = "b56e1b8d69dcc300b55fdb06d1470351fb75cdd8";
if (execFileSync("git", ["-C", codeRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim() !== codeCommit) {
  throw new Error("DevEco Code skill 来源必须为已核验的 v0.2.5；请设置 DEVECO_CODE_SOURCE 指向对应 checkout");
}
const codeNames = new Set(["hmos-runtime-fix-skill"]);
const names = ["deveco-cli", "hmos-arkui-develop-skill", "hmos-dfx-analyzer", "hmos-design-to-arkts", ...codeNames];
const adapters = join(toolRoot, "skill-adapters");
const records = [];
for (const name of names) {
  const source = codeNames.has(name)
    ? join(codeRoot, "packages", "opencode", "resources", "skills", name)
    : name === "hmos-design-to-arkts" ? join(upstream, "dist", "design2arkts-engine", "resources", "skill")
    : join(upstream, "skills", name);
  const target = join(root, "skills", name);
  const original = await readFile(join(source, "SKILL.md"), "utf8");
  const adapter = await readFile(join(adapters, `${name}.md`), "utf8");
  const present = await stat(target).then(() => true, error => {
    if (error.code === "ENOENT") return false;
    throw error;
  });
  if (present) {
    const trash = join(root, ".trash", `deveco-skills-${Date.now()}`);
    await mkdir(trash, { recursive: true });
    await rename(target, join(trash, name));
  }
  await cp(source, target, { recursive: true, errorOnExist: true });
  await mkdir(join(target, "references"), { recursive: true });
  await writeFile(join(target, "UPSTREAM.md"), original);
  if (codeNames.has(name)) await cp(join(codeRoot, "LICENSE"), join(target, "LICENSE"));
  await writeFile(join(target, "SKILL.md"), adapter);
  await mkdir(join(target, "scripts"), { recursive: true });
  const launcher = join(target, "scripts", "devecocli");
  await writeFile(launcher, '#!/bin/sh\nset -eu\nSCRIPT_DIR=$(CDPATH=\'\' cd -- "$(dirname -- "$0")" && pwd)\nexec "$SCRIPT_DIR/../../../tools/huawei-cli/bin/devecocli" "$@"\n', { mode: 0o755 });
  await chmod(launcher, 0o755);
  const sourceVersion = codeNames.has(name) ? "DevEco Code v0.2.5" : `${pkg.name}@${pkg.version}`;
  records.push({ name, source: sourceVersion, upstreamSkillSha256: createHash("sha256").update(original).digest("hex") });
  process.stdout.write(`${name} ← ${sourceVersion}\n`);
}
await writeFile(join(root, "skills", "deveco-upstream.json"), JSON.stringify({
  package: pkg.name, version: pkg.version,
  registry: `https://registry.npmjs.org/${pkg.name}/${pkg.version}`,
  sourceTag: "latest/v1.3.12", sourceCommit: "48dd33612c53bfd18541f09b9491389f017f3cba", skills: records,
  code: { repository: "https://gitcode.com/openharmony-sig/deveco-code.git", tag: "v0.2.5", commit: codeCommit }
}, null, 2) + "\n");
