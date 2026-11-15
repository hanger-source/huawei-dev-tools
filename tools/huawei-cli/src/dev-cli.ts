#!/usr/bin/env node

import { execFile } from "node:child_process";
import { access, mkdir, realpath, readFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Command } from "commander";
import type { McpBridge } from "@deveco-codegenie/mcp-bridge";
import {
  getHuaweiAuthStatus,
  loginHuawei,
  logoutHuawei,
  queryHuaweiKnowledge
} from "./dev-auth.js";
import { autoSignHarmonyHap, getSigningStatus } from "./dev-signing.js";
import {
  clickUiControl,
  dumpUiLayout,
  flingUi,
  inputUiText,
  installHap,
  listDeviceTargets,
  readDeviceInfo,
  selectDeviceTarget,
  startAbility,
  waitForHttpJson,
  waitForUiControl
} from "./dev-device.js";

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const commandLineHome = resolve(projectRoot, "../../official/command-line-tools");
const defaultLogDirectory = join(projectRoot, "data", "huawei-dev", "logs");

interface GlobalOptions {
  json?: boolean;
  project?: string;
  devecoHome?: string;
}

const program = new Command();
program
  .name("huawei-dev")
  .description("独立调用 DevEco/HarmonyOS 构建、真机、HDC 和静态检查能力；不启动 DevEco Code Agent。")
  .version("0.5.0")
  .option("--json", "输出稳定 JSON envelope")
  .option("--project <path>", "HarmonyOS 工程根目录", process.cwd())
  .option("--deveco-home <path>", "DevEco Studio.app 或 Contents 路径；也可用 DEVECO_HOME");

function options(): Required<Pick<GlobalOptions, "json" | "project">> & Pick<GlobalOptions, "devecoHome"> {
  const value = program.opts<GlobalOptions>();
  return {
    json: Boolean(value.json),
    project: resolve(value.project || process.cwd()),
    devecoHome: value.devecoHome
  };
}

function output(data: unknown, human: string): void {
  if (options().json) {
    process.stdout.write(`${JSON.stringify({ ok: true, data }, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${human}\n`);
}

function fail(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  if (options().json) {
    process.stdout.write(`${JSON.stringify({ ok: false, error: { code: "HUAWEI_DEV_ERROR", message } }, null, 2)}\n`);
  } else {
    process.stderr.write(`错误：${message}\n`);
  }
  process.exitCode = 1;
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(() => true).catch(() => false);
}

function normalizeDevEcoHome(path: string): string {
  const absolute = resolve(path);
  if (basename(absolute).endsWith(".app")) return join(absolute, "Contents");
  return absolute;
}

async function resolveDevEcoHome(explicit?: string): Promise<string> {
  const candidates = [
    explicit,
    process.env.DEVECO_HOME,
    "/Applications/DevEco-Studio.app",
    "/Volumes/DevEco-Studio/DevEco-Studio.app"
  ].filter((item): item is string => Boolean(item?.trim()));

  for (const candidate of candidates) {
    const home = normalizeDevEcoHome(candidate);
    if (await exists(join(home, "tools", "node", "bin", "node")) && await exists(join(home, "sdk", "default"))) {
      return realpath(home);
    }
  }
  throw new Error("未找到完整 DevEco Studio。请传 --deveco-home 或设置 DEVECO_HOME；bridge 构建/运行不能只用 Command Line Tools。");
}

async function resolveSigningHome(explicit?: string): Promise<string> {
  const home = normalizeDevEcoHome(explicit || process.env.DEVECO_HOME || commandLineHome);
  await access(join(home, "sdk", "default", "openharmony", "toolchains", "lib", "hap-sign-tool.jar"));
  return realpath(home);
}

async function resolveHdc(devecoHome?: string): Promise<string> {
  const explicit = process.env.HDC_PATH?.trim();
  if (explicit) return realpath(explicit);
  const home = devecoHome || process.env.DEVECO_HOME;
  if (home) return realpath(join(normalizeDevEcoHome(home), "sdk", "default", "openharmony", "toolchains", "hdc"));
  const sdkHome = process.env.HARMONY_SDK_HOME?.trim();
  return realpath(join(sdkHome ? resolve(sdkHome) : join(commandLineHome, "sdk", "default"), "openharmony", "toolchains", "hdc"));
}

function parseJson(text: string, label: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} 返回了非 JSON 内容：${text.slice(0, 500)}`);
  }
}

function positiveInteger(value: string, label: string): number {
  if (!/^\d+$/.test(value)) throw new Error(`${label} 必须是正整数`);
  const parsed = Number.parseInt(value, 10);
  if (parsed < 1) throw new Error(`${label} 必须是正整数`);
  return parsed;
}

async function withBridge<T>(run: (bridge: McpBridge) => Promise<T>): Promise<T> {
  const global = options();
  const home = await resolveDevEcoHome(global.devecoHome);
  await access(global.project);
  await mkdir(defaultLogDirectory, { recursive: true });
  const imported = await import("@deveco-codegenie/mcp-bridge");
  const bridge = imported.default;
  await bridge.init(defaultLogDirectory, global.project, home, null, null, null);
  try {
    return await run(bridge);
  } finally {
    await bridge.stop();
  }
}

async function callBridge(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  return withBridge(async (bridge) => parseJson(await bridge.callTool(toolName, JSON.stringify(args)), toolName));
}

async function projectFiles(files: string[]): Promise<string[]> {
  const root = await realpath(options().project);
  return Promise.all(files.map(async (file) => {
    const path = isAbsolute(file) ? resolve(file) : resolve(root, file);
    const actual = await realpath(path);
    const outside = relative(root, actual).startsWith("..") || isAbsolute(relative(root, actual));
    if (outside) throw new Error(`文件不在工程目录内：${file}`);
    return actual;
  }));
}

program
  .command("doctor")
  .description("检查实际使用的 SDK、HDC 和设备；不需要完整 Studio，不读取账号凭证")
  .action(async () => {
    try {
      const hdc = await resolveHdc(options().devecoHome);
      const home = await resolveSigningHome(options().devecoHome);
      const sdkPath = join(home, "sdk", "default", "sdk-pkg.json");
      const sdk = JSON.parse(await readFile(sdkPath, "utf8")).data;
      const [version, devices] = await Promise.all([
        execFileAsync(hdc, ["-v"], { encoding: "utf8", timeout: 10000 }),
        listDeviceTargets(hdc)
      ]);
      output({ hdc: { path: hdc, version: version.stdout.trim() }, sdk: { ...sdk, metadataPath: sdkPath }, devices,
        commands: { commandLineTools: ["devices", "device info/install/start/ui", "log", "signing"],
          bridgeRequires: "完整 DevEco Studio：build/run/check-ets/check-cpp" } },
        `HDC：${version.stdout.trim()}\n路径：${hdc}\nSDK：${sdk.displayName} / ${sdk.releaseType} / ${sdk.version}\n设备：${devices.length}\n构建与静态检查需要完整 DevEco Studio。`);
    } catch (error) { fail(error); }
  });

program
  .command("upstream")
  .description("只读检查官方 DevEco CLI / Coding Agent 发行通道，不自动更新安装")
  .action(async () => {
    try {
      const installed = JSON.parse(await readFile(join(projectRoot, "node_modules", "@deveco", "deveco-cli-common", "package.json"), "utf8"));
      const packages = await Promise.all(["@deveco/deveco-cli", "@deveco/deveco-code", "@deveco-codegenie/mcp-bridge"].map(async name => {
        const source = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
        const response = await fetch(source, { signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
        const metadata = await response.json() as { "dist-tags": Record<string, string>; time: Record<string, string> };
        return { name, tags: metadata["dist-tags"], latestPublishedAt: metadata.time[metadata["dist-tags"].latest], source };
      }));
      output({ installedCli: installed.version, packages }, `本地官方 CLI：${installed.version}\n${packages.map(pkg => `${pkg.name}：${JSON.stringify(pkg.tags)}`).join("\n")}`);
    } catch (error) { fail(error); }
  });

program
  .command("tools")
  .description("列出独立 N-API bridge 实际提供的工具和 JSON Schema")
  .action(async () => {
    try {
      const data = await withBridge(async (bridge) => parseJson(bridge.listTools(), "listTools"));
      output(data, JSON.stringify(data, null, 2));
    } catch (error) {
      fail(error);
    }
  });

const auth = program.command("auth").description("管理华为 DevEco Code 云服务 OAuth；与 DevEco Studio 登录状态相互独立");

auth
  .command("login")
  .description("在浏览器完成华为账号授权，并加密保存独立凭证")
  .action(async () => {
    try {
      const data = await loginHuawei();
      output(data, `华为云服务已登录：${data.userName || data.userId || "未知用户"}`);
    } catch (error) {
      fail(error);
    }
  });

auth
  .command("status")
  .description("查看独立凭证状态，不输出令牌")
  .action(async () => {
    try {
      const data = await getHuaweiAuthStatus();
      output(data, data.authenticated
        ? `已登录：${data.userName || data.userId || "未知用户"}（${data.countryCode || "未知区域"}）`
        : "尚未登录华为 DevEco Code 云服务");
    } catch (error) {
      fail(error);
    }
  });

auth
  .command("logout")
  .description("退出独立登录；凭证移入认证目录的 .trash，可恢复")
  .action(async () => {
    try {
      const data = await logoutHuawei();
      output(data, data.movedTo ? `已退出；旧凭证移至 ${data.movedTo}` : "当前没有登录凭证");
    } catch (error) {
      fail(error);
    }
  });

program
  .command("knowledge")
  .description("查询华为 DevEco Code BigSearch 云端知识库；需要先 auth login")
  .argument("<question>", "ArkTS、ArkUI、HarmonyOS 或 DevEco 问题")
  .action(async (question: string) => {
    try {
      const data = await queryHuaweiKnowledge(question);
      output(data, data.answer);
    } catch (error) {
      fail(error);
    }
  });

program
  .command("create")
  .description("用内置 Stage 模型模板创建 ArkTS 工程，并从 DevEco SDK 解析 API 版本")
  .requiredOption("--parent <path>", "新工程父目录")
  .requiredOption("--app-name <name>", "ASCII 工程名，^[A-Za-z][A-Za-z0-9_]{0,127}$")
  .option("--bundle-name <name>", "Bundle ID；默认 com.example.<小写工程名>")
  .option("--api-level <number>", "API Level；默认读取 DevEco default SDK")
  .action(async (command: { parent: string; appName: string; bundleName?: string; apiLevel?: string }) => {
    try {
      const global = options();
      const home = await resolveDevEcoHome(global.devecoHome);
      const script = join(projectRoot, "vendor", "deveco-create-project", "scripts", "copy-template.mjs");
      await access(script);
      const args = [
        script,
        "--project-path", resolve(command.parent),
        "--app-name", command.appName,
        ...(command.bundleName ? ["--bundle-name", command.bundleName] : []),
        ...(command.apiLevel ? ["--api-level", command.apiLevel] : [])
      ];
      try {
        const result = await execFileAsync(process.execPath, args, {
          encoding: "utf8",
          env: { ...process.env, DEVECO_HOME: home },
          maxBuffer: 4 * 1024 * 1024
        });
        const data = parseJson(result.stdout, "create");
        output(data, JSON.stringify(data, null, 2));
      } catch (error) {
        const stderr = error && typeof error === "object" && "stderr" in error
          ? String((error as { stderr?: unknown }).stderr || "").trim()
          : "";
        throw new Error(stderr || (error instanceof Error ? error.message : String(error)));
      }
    } catch (error) {
      fail(error);
    }
  });

program
  .command("build")
  .description("调用 build_project；默认增量 debug 构建")
  .option("--module <module>", "模块和 target，例如 entry@default")
  .option("--product <product>", "Product 名称")
  .option("--mode <mode>", "buildModeSet 名称", "debug")
  .option("--clean", "显式执行 clean 后构建")
  .option("--log-path <path>", "构建日志目录")
  .action(async (command: { module?: string; product?: string; mode: string; clean?: boolean; logPath?: string }) => {
    try {
      const data = await callBridge("build_project", {
        build_mode: command.mode,
        clean: Boolean(command.clean),
        ...(command.module ? { module: command.module } : {}),
        ...(command.product ? { product: command.product } : {}),
        ...(command.logPath ? { log_path: resolve(command.logPath) } : {})
      });
      output(data, JSON.stringify(data, null, 2));
    } catch (error) {
      fail(error);
    }
  });

program
  .command("run")
  .description("调用 start_app；只安装并启动已有产物，不主动构建")
  .option("--device <id>", "真机/模拟器名称或序列号")
  .option("--module <module>", "模块名", "entry")
  .option("--target <target>", "target 名", "default")
  .option("--ability <ability>", "Ability 名", "EntryAbility")
  .action(async (command: { device?: string; module: string; target: string; ability: string }) => {
    try {
      const data = await callBridge("start_app", {
        ...(command.device ? { hvd: command.device } : {}),
        module: command.module,
        target: command.target,
        ability: command.ability
      });
      output(data, JSON.stringify(data, null, 2));
    } catch (error) {
      fail(error);
    }
  });

for (const command of [
  { name: "check-ets", tool: "check_ets_files", description: "使用 DevEco ArkTS-Check 检查 .ets 文件" },
  { name: "check-cpp", tool: "check_cpp_files", description: "使用 DevEco clangd 检查 C/C++ 文件" }
]) {
  program
    .command(command.name)
    .description(command.description)
    .argument("<files...>", "工程内文件")
    .action(async (files: string[]) => {
      try {
        const data = await callBridge(command.tool, { files: await projectFiles(files) });
        output(data, JSON.stringify(data, null, 2));
      } catch (error) {
        fail(error);
      }
    });
}

program
  .command("devices")
  .description("直接调用公开 hdc 列出设备，不经过 N-API bridge")
  .action(async () => {
    try {
      const hdc = await resolveHdc(options().devecoHome);
      const devices = await listDeviceTargets(hdc);
      output({ hdc, devices }, devices.length ? devices.map(device => device.raw).join("\n") : "没有已连接设备");
    } catch (error) {
      fail(error);
    }
  });

const deviceTools = program.command("device").description("可组合的 HDC、Ability、UI 和 HTTP 真机原子能力");

deviceTools.command("info")
  .description("读取目标设备报告的 API、系统版本和型号；不根据系统名称猜 API")
  .option("--device <id>", "HDC target id；多连接时必填")
  .action(async (command: { device?: string }) => {
    try {
      const hdc = await resolveHdc(options().devecoHome);
      const device = await selectDeviceTarget(hdc, command.device);
      const info = await readDeviceInfo({ hdc, device });
      output(info, JSON.stringify(info, null, 2));
    } catch (error) { fail(error); }
  });

deviceTools
  .command("install")
  .description("安装 HAP；默认替换已有应用")
  .argument("<hap>", "HAP 文件")
  .option("--device <id>", "HDC target id")
  .option("--no-replace", "不传 -r")
  .action(async (hap: string, command: { device?: string; replace: boolean }) => {
    try {
      const hdc = await resolveHdc(options().devecoHome);
      const device = await selectDeviceTarget(hdc, command.device);
      const result = await installHap({ hdc, device }, hap, command.replace);
      output({ device, hap: resolve(hap), replace: command.replace, result }, result);
    } catch (error) {
      fail(error);
    }
  });

deviceTools
  .command("start")
  .description("启动指定 UIAbility")
  .requiredOption("--bundle <name>", "Bundle 名")
  .requiredOption("--ability <name>", "Ability 名")
  .option("--module <name>", "Module 名")
  .option("--device <id>", "HDC target id")
  .option("--no-wait", "不传 -W")
  .action(async (command: { bundle: string; ability: string; module?: string; device?: string; wait: boolean }) => {
    try {
      const hdc = await resolveHdc(options().devecoHome);
      const device = await selectDeviceTarget(hdc, command.device);
      const result = await startAbility({ hdc, device }, {
        bundle: command.bundle,
        ability: command.ability,
        module: command.module,
        wait: command.wait
      });
      output({ device, ...command, result }, result);
    } catch (error) {
      fail(error);
    }
  });

const uiTools = deviceTools.command("ui").description("基于 uitest UI 树的原子操作；按文本定位，不写死坐标");

uiTools
  .command("dump")
  .description("拉取并解析当前 UI 树")
  .option("--device <id>", "HDC target id")
  .option("--visible", "只输出可见且有文本的节点")
  .action(async (command: { device?: string; visible?: boolean }) => {
    try {
      const hdc = await resolveHdc(options().devecoHome);
      const device = await selectDeviceTarget(hdc, command.device);
      const all = await dumpUiLayout({ hdc, device });
      const controls = command.visible
        ? all.filter((item) => item.visible !== "false" && (item.text || item.description))
        : all;
      output({ device, count: controls.length, controls }, JSON.stringify(controls, null, 2));
    } catch (error) {
      fail(error);
    }
  });

for (const operation of ["wait", "click"] as const) {
  uiTools
    .command(operation)
    .description(operation === "wait" ? "等待指定文本的可点击控件出现" : "等待并点击指定文本控件")
    .argument("<text>", "控件完整文本")
    .option("--device <id>", "HDC target id")
    .option("--timeout-ms <number>", "等待超时毫秒", "30000")
    .option("--any-node", "允许匹配非 clickable 文本节点，由其父容器承接点击")
    .action(async (text: string, command: { device?: string; timeoutMs: string; anyNode?: boolean }) => {
      try {
        const hdc = await resolveHdc(options().devecoHome);
        const device = await selectDeviceTarget(hdc, command.device);
        const timeoutMs = positiveInteger(command.timeoutMs, "--timeout-ms");
        const clickable = command.anyNode ? false : undefined;
        const match = operation === "click"
          ? await clickUiControl({ hdc, device }, text, { timeoutMs, clickable })
          : await waitForUiControl({ hdc, device }, text, { timeoutMs, clickable });
        output({ device, text, ...match }, `${text} @ ${match.center.x},${match.center.y}`);
      } catch (error) {
        fail(error);
      }
    });
}

uiTools
  .command("input")
  .description("定位输入控件并输入文本；可按 text、hint 或 id 匹配")
  .argument("<value>", "要输入的文本")
  .requiredOption("--into <locator>", "目标控件的 text、hint 或 id")
  .option("--by <attribute>", "定位属性：text、hint、id 或 any", "any")
  .option("--device <id>", "HDC target id")
  .option("--timeout-ms <number>", "等待超时毫秒", "30000")
  .option("--any-node", "允许匹配非 clickable 节点")
  .action(async (value: string, command: {
    into: string;
    by: "text" | "hint" | "id" | "any";
    device?: string;
    timeoutMs: string;
    anyNode?: boolean;
  }) => {
    try {
      if (!["text", "hint", "id", "any"].includes(command.by)) {
        throw new Error(`--by 仅支持 text、hint、id 或 any：${command.by}`);
      }
      const hdc = await resolveHdc(options().devecoHome);
      const device = await selectDeviceTarget(hdc, command.device);
      const timeoutMs = positiveInteger(command.timeoutMs, "--timeout-ms");
      const match = await inputUiText({ hdc, device }, command.into, value, {
        timeoutMs,
        clickable: command.anyNode ? false : undefined,
        attribute: command.by
      });
      output({ device, value, locator: command.into, ...match }, `${command.into} <- ${value}`);
    } catch (error) {
      fail(error);
    }
  });

uiTools
  .command("fling")
  .description("按方向执行页面快速滚动")
  .argument("<direction>", "方向：left、right、up 或 down")
  .option("--count <number>", "滚动次数", "1")
  .option("--device <id>", "HDC target id")
  .action(async (direction: "left" | "right" | "up" | "down", command: {
    count: string;
    device?: string;
  }) => {
    try {
      if (!["left", "right", "up", "down"].includes(direction)) {
        throw new Error(`direction 仅支持 left、right、up 或 down：${direction}`);
      }
      const hdc = await resolveHdc(options().devecoHome);
      const device = await selectDeviceTarget(hdc, command.device);
      const count = positiveInteger(command.count, "--count");
      await flingUi({ hdc, device }, direction, count);
      output({ device, direction, count }, `${direction} x ${count}`);
    } catch (error) {
      fail(error);
    }
  });

deviceTools
  .command("http-wait")
  .description("轮询 HTTP 端点，直到返回 JSON")
  .argument("<url>", "HTTP URL")
  .option("--timeout-ms <number>", "等待超时毫秒", "30000")
  .option("--interval-ms <number>", "轮询间隔毫秒", "500")
  .action(async (url: string, command: { timeoutMs: string; intervalMs: string }) => {
    try {
      const timeoutMs = positiveInteger(command.timeoutMs, "--timeout-ms");
      const intervalMs = positiveInteger(command.intervalMs, "--interval-ms");
      const data = await waitForHttpJson(url, { timeoutMs, intervalMs });
      output({ url, response: data }, JSON.stringify(data, null, 2));
    } catch (error) {
      fail(error);
    }
  });

const signing = program.command("signing").description("使用 huawei-dev 或 DevEco Studio 登录态生成 HarmonyOS 调试签名并签署 HAP");

signing
  .command("status")
  .description("只读检查登录态、真机、签名材料和未签名 HAP")
  .action(async () => {
    try {
      const global = options();
      const hdc = await resolveHdc(global.devecoHome);
      const data = await getSigningStatus({ project: global.project, hdc });
      output(data, JSON.stringify(data, null, 2));
    } catch (error) {
      fail(error);
    }
  });

signing
  .command("auto")
  .description("按官方 HOS 签名链生成证书/Profile，并签署现有 unsigned HAP")
  .option("--input <path>", "待签名 HAP；默认选工程内最新的 *-unsigned.hap")
  .option("--output <path>", "签名 HAP 输出路径；默认把 -unsigned.hap 替换为 -signed.hap")
  .option("--device <id>", "用于调试 Profile 的 HDC target id；默认选首个 Connected 设备")
  .option("--team-id <id>", "开发团队 ID；默认选账号返回的首个团队")
  .option("--config-name <name>", "签名配置名，用于材料文件前缀", "default")
  .action(async (command: { input?: string; output?: string; device?: string; teamId?: string; configName: string }) => {
    try {
      const global = options();
      const devecoHome = await resolveSigningHome(global.devecoHome);
      const hdc = await resolveHdc(global.devecoHome);
      const data = await autoSignHarmonyHap({
        project: global.project,
        devecoHome,
        hdc,
        input: command.input,
        output: command.output,
        device: command.device,
        teamId: command.teamId,
        configName: command.configName
      });
      output(data, `签名完成：${data.output}`);
    } catch (error) {
      fail(error);
    }
  });

program
  .command("log")
  .description("直接读取或显式清空真机 hilog，不经过 N-API bridge")
  .option("--device <id>", "HDC target id")
  .option("--prefix <text>", "只保留包含该文本的行", "")
  .option("--lines <number>", "最多返回最后多少行", "2000")
  .option("--clear", "显式清空设备 hilog buffer")
  .action(async (command: { device?: string; prefix: string; lines: string; clear?: boolean }) => {
    try {
      if (!/^\d+$/.test(command.lines)) throw new Error("--lines 必须是 1-5000 的整数");
      const lines = Number.parseInt(command.lines, 10);
      if (lines < 1 || lines > 5000) throw new Error("--lines 必须是 1-5000 的整数");
      const hdc = await resolveHdc(options().devecoHome);
      const device = await selectDeviceTarget(hdc, command.device);
      const target = ["-t", device];
      const args = command.clear ? [...target, "shell", "hilog", "-r"] : [...target, "shell", "hilog", "-x"];
      const result = await execFileAsync(hdc, args, {
        encoding: "utf8",
        timeout: 30000,
        maxBuffer: 64 * 1024 * 1024
      });
      if (command.clear) {
        output({ hdc, device, cleared: true }, "设备 hilog buffer 已清空");
        return;
      }
      const selected = result.stdout
        .split(/\r?\n/)
        .filter((line) => !command.prefix || line.includes(command.prefix))
        .slice(-lines);
      output({ hdc, device, prefix: command.prefix, lineCount: selected.length, lines: selected }, selected.join("\n"));
    } catch (error) {
      fail(error);
    }
  });

await program.parseAsync(process.argv);
