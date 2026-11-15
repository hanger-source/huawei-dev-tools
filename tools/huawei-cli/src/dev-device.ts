import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface DeviceContext {
  hdc: string;
  device?: string;
}

export interface DeviceTarget {
  id: string;
  state: string;
  raw: string;
}

export interface UiAttributes {
  text?: string;
  originalText?: string;
  hint?: string;
  description?: string;
  bounds?: string;
  clickable?: string;
  enabled?: string;
  visible?: string;
  id?: string;
  type?: string;
  bundleName?: string;
  abilityName?: string;
  [key: string]: unknown;
}

export interface UiControlMatch {
  attributes: UiAttributes;
  center: { x: number; y: number };
}

export type UiLocatorAttribute = "text" | "hint" | "id" | "any";

export interface UiControlOptions {
  timeoutMs?: number;
  clickable?: boolean;
  attribute?: UiLocatorAttribute;
}

interface UiNode {
  attributes?: UiAttributes;
  children?: UiNode[];
}

async function runFile(file: string, args: string[], timeout = 30000): Promise<string> {
  try {
    const result = await execFileAsync(file, args, {
      encoding: "utf8",
      timeout,
      maxBuffer: 32 * 1024 * 1024
    });
    return `${result.stdout}\n${result.stderr}`.trim();
  } catch (error) {
    const detail = error && typeof error === "object"
      ? `${"stdout" in error ? String(error.stdout || "") : ""}\n${"stderr" in error ? String(error.stderr || "") : ""}`.trim()
      : "";
    throw new Error(detail || (error instanceof Error ? error.message : String(error)));
  }
}

function targetArgs(device?: string): string[] {
  return device ? ["-t", device] : [];
}

export async function listDeviceTargets(hdc: string): Promise<DeviceTarget[]> {
  const output = await runFile(hdc, ["list", "targets", "-v"]);
  return output.split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && line !== "[Empty]")
    .map((line) => {
      const fields = line.split(/\s+/);
      return { id: fields[0], state: fields.find((field) => /^(Connected|Offline)$/i.test(field)) || "unknown", raw: line };
    });
}

export async function selectDeviceTarget(hdc: string, requested?: string): Promise<string> {
  const targets = await listDeviceTargets(hdc);
  if (requested) {
    const found = targets.find((target) => target.id === requested);
    if (!found) throw new Error(`设备未连接：${requested}`);
    if (!/^Connected$/i.test(found.state)) throw new Error(`设备不可用：${requested}，状态 ${found.state}`);
    return found.id;
  }
  const connected = targets.filter((target) => /^Connected$/i.test(target.state));
  if (connected.length !== 1) throw new Error(`无法唯一确定设备：${connected.map((target) => target.id).join(", ") || "无"}`);
  return connected[0].id;
}

export async function runDeviceShell(context: DeviceContext, command: string, timeout = 30000): Promise<string> {
  return runFile(context.hdc, [...targetArgs(context.device), "shell", command], timeout);
}

export async function readDeviceInfo(context: DeviceContext) {
  const fields = {
    apiVersion: "const.ohos.apiversion",
    softwareVersion: "const.product.software.version",
    model: "const.product.model"
  };
  const values = await Promise.all(Object.entries(fields).map(async ([name, key]) =>
    [name, await runDeviceShell(context, `param get ${key}`, 10000)]));
  return { device: context.device, ...Object.fromEntries(values) };
}

export async function installHap(context: DeviceContext, hapPath: string, replace = true): Promise<string> {
  return runFile(context.hdc, [
    ...targetArgs(context.device),
    "install",
    ...(replace ? ["-r"] : []),
    resolve(hapPath)
  ], 60000);
}

export async function startAbility(
  context: DeviceContext,
  ability: { bundle: string; ability: string; module?: string; wait?: boolean }
): Promise<string> {
  const command = [
    "aa", "start",
    "-a", shellQuote(ability.ability),
    "-b", shellQuote(ability.bundle),
    ...(ability.module ? ["-m", shellQuote(ability.module)] : []),
    ...(ability.wait === false ? [] : ["-W"])
  ].join(" ");
  return runDeviceShell(context, command, 30000);
}

export function flattenUiLayout(value: unknown, result: UiAttributes[] = []): UiAttributes[] {
  if (!value || typeof value !== "object") return result;
  if (Array.isArray(value)) {
    for (const child of value) flattenUiLayout(child, result);
    return result;
  }
  const node = value as UiNode;
  if (node.attributes) result.push(node.attributes);
  for (const child of node.children || []) flattenUiLayout(child, result);
  return result;
}

export function controlCenter(bounds: string): { x: number; y: number } {
  const match = /^\[(-?\d+),(-?\d+)]\[(-?\d+),(-?\d+)]$/.exec(bounds);
  if (!match) throw new Error(`无法解析控件坐标：${bounds}`);
  return {
    x: Math.round((Number(match[1]) + Number(match[3])) / 2),
    y: Math.round((Number(match[2]) + Number(match[4])) / 2)
  };
}

function isUsableUiControl(item: UiAttributes): boolean {
  if (typeof item.bounds !== "string") return false;
  try {
    const center = controlCenter(item.bounds);
    return center.x >= 0 && center.y >= 0;
  } catch {
    return false;
  }
}

export async function dumpUiLayout(context: DeviceContext): Promise<UiAttributes[]> {
  const identity = `${process.pid}-${Date.now()}`;
  const remote = `/data/local/tmp/huawei-dev-ui-${identity}.json`;
  const local = join(tmpdir(), `huawei-dev-ui-${identity}.json`);
  await runDeviceShell(context, `uitest dumpLayout -p ${remote} -i`, 15000);
  await runFile(context.hdc, [...targetArgs(context.device), "file", "recv", remote, local], 15000);
  return flattenUiLayout(JSON.parse(await readFile(local, "utf8")));
}

export async function waitForUiControl(
  context: DeviceContext,
  locator: string,
  options: UiControlOptions = {}
): Promise<UiControlMatch> {
  const timeoutMs = options.timeoutMs ?? 30000;
  const deadline = Date.now() + timeoutMs;
  let attributes: UiAttributes[] = [];
  while (Date.now() < deadline) {
    attributes = await dumpUiLayout(context);
    const attribute = options.attribute ?? "text";
    const found = attributes.find((item) =>
      (attribute === "any"
        ? item.text === locator || item.hint === locator || item.id === locator
        : item[attribute] === locator) &&
      item.visible !== "false" &&
      (options.clickable === false || item.clickable === "true") &&
      isUsableUiControl(item)
    );
    if (found) return { attributes: found, center: controlCenter(found.bounds as string) };
    await new Promise((resolveWait) => setTimeout(resolveWait, 1000));
  }
  const visible = attributes.filter((item) => item.visible !== "false" && item.text)
    .map((item) => item.text).slice(0, 30);
  throw new Error(`等待控件“${locator}”超时，当前可见文本：${JSON.stringify(visible)}`);
}

export async function clickUiControl(
  context: DeviceContext,
  locator: string,
  options: UiControlOptions = {}
): Promise<UiControlMatch> {
  const match = await waitForUiControl(context, locator, options);
  await runDeviceShell(context, `uitest uiInput click ${match.center.x} ${match.center.y}`, 15000);
  return match;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export async function inputUiText(
  context: DeviceContext,
  locator: string,
  value: string,
  options: UiControlOptions = {}
): Promise<UiControlMatch> {
  const match = await waitForUiControl(context, locator, options);
  await runDeviceShell(
    context,
    `uitest uiInput inputText ${match.center.x} ${match.center.y} ${shellQuote(value)}`,
    15000
  );
  return match;
}

export async function flingUi(
  context: DeviceContext,
  direction: "left" | "right" | "up" | "down",
  count = 1
): Promise<void> {
  const directionCode = { left: 0, right: 1, up: 2, down: 3 }[direction];
  for (let index = 0; index < count; index += 1) {
    await runDeviceShell(context, `uitest uiInput dircFling ${directionCode}`, 15000);
  }
}

export async function waitForHttpJson<T = unknown>(
  url: string,
  options: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 30000;
  const intervalMs = options.intervalMs ?? 500;
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const remaining = Math.max(1, deadline - Date.now());
      const response = await fetch(url, { signal: AbortSignal.timeout(Math.min(5000, remaining)) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json() as T;
    } catch (error) {
      lastError = error;
      await new Promise((resolveWait) => setTimeout(resolveWait, intervalMs));
    }
  }
  throw new Error(`等待 HTTP JSON 超时：${url}；最后错误：${lastError instanceof Error ? lastError.message : String(lastError)}`);
}
