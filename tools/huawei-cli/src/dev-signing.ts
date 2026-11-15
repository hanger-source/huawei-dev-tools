import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { access, chmod, mkdir, readFile, readdir, realpath, rename, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { getHuaweiAuthStatus, getHuaweiCloudSession } from "./dev-auth.js";

const execFileAsync = promisify(execFile);
const studioLoginService = "LoginPlugin";
const studioLoginAccount = "jwtToken";
const signingPasswordService = "huawei-dev-signing";
const agcBaseUrl = "https://connect-api.cloud.huawei.com";
const devecoLoginBaseUrl = "https://cn.devecostudio.huawei.com";

interface StudioSession {
  accessToken: string;
  userId: string;
  userName: string | null;
  countryCode: string | null;
}

interface TeamInfo {
  id: string;
  name: string;
}

interface DeviceInfo {
  id: string;
  udid: string;
  deviceName?: string;
  deviceType?: number;
}

interface CertificateInfo {
  id: string;
  certName: string;
  certObjectId: string;
}

interface SigningMaterial {
  prefix: string;
  storeFile: string;
  csrFile: string;
  certFile: string;
  profileFile: string;
  password: string;
}

export interface SigningStatusOptions {
  project: string;
  hdc: string;
}

export interface AutoSigningOptions extends SigningStatusOptions {
  devecoHome: string;
  input?: string;
  output?: string;
  device?: string;
  teamId?: string;
  configName?: string;
}

export interface AutoSigningResult {
  project: string;
  bundleName: string;
  input: string;
  output: string;
  device: { target: string; udid: string; type: string };
  team: TeamInfo;
  material: Omit<SigningMaterial, "password">;
  reusedMaterial: boolean;
  certificateCreated: boolean;
  deviceRegistered: boolean;
  profileCreated: boolean;
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(() => true).catch(() => false);
}

function compactTimestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
}

async function archiveFile(path: string): Promise<string | null> {
  if (!await exists(path)) return null;
  const trash = join(dirname(path), ".trash", compactTimestamp());
  await mkdir(trash, { recursive: true, mode: 0o700 });
  const destination = join(trash, basename(path));
  await rename(path, destination);
  return destination;
}

async function runFile(file: string, args: string[], secret?: string): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFileAsync(file, args, {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      timeout: 120_000
    });
  } catch (error) {
    const value = error as { message?: string; stdout?: string; stderr?: string };
    const raw = [value.message, value.stderr, value.stdout].filter(Boolean).join("\n");
    throw new Error(secret ? raw.split(secret).join("[redacted]") : raw);
  }
}

async function signingExecutable(toolHome: string, executable: "java" | "keytool"): Promise<string> {
  const candidates = [
    join(toolHome, "jbr", "Contents", "Home", "bin", executable),
    join(toolHome, "jbr", "bin", executable),
    join("/usr/bin", executable)
  ];
  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }
  throw new Error(`未找到 ${executable}；请安装 JDK，或传入包含 jbr 的 DevEco Studio 路径`);
}

async function keychainHas(service: string, account: string): Promise<boolean> {
  try {
    await runFile("security", ["find-generic-password", "-s", service, "-a", account]);
    return true;
  } catch {
    return false;
  }
}

async function readKeychainPassword(service: string, account: string): Promise<string | null> {
  try {
    const result = await runFile("security", ["find-generic-password", "-s", service, "-a", account, "-w"]);
    return result.stdout.trim() || null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("could not be found")) return null;
    throw new Error(`读取 macOS Keychain 失败：${message}`);
  }
}

async function storeKeychainPassword(service: string, account: string, password: string): Promise<void> {
  await runFile("security", [
    "add-generic-password", "-U",
    "-s", service,
    "-a", account,
    "-w", password
  ], password);
}

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("DevEco Studio Keychain 中的 jwtToken 格式无效");
  const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - normalized.length % 4) % 4);
  return JSON.parse(Buffer.from(normalized + padding, "base64").toString("utf8")) as Record<string, unknown>;
}

async function requestJson(
  url: string,
  init: RequestInit,
  operation: string
): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "User-Agent": "Chrome/49.0.2623.75",
      "accept-language": "zh-CN",
      ...(init.method === "GET" ? { "Accept-Encoding": "identity" } : {}),
      ...(init.headers || {})
    },
    signal: AbortSignal.timeout(30_000)
  });
  const text = await response.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(`${operation} 返回非 JSON（HTTP ${response.status}）：${text.slice(0, 500)}`);
    }
  }
  if (!response.ok) {
    throw new Error(`${operation} 失败（HTTP ${response.status}）：${JSON.stringify(data).slice(0, 1000)}`);
  }
  const ret = data.ret && typeof data.ret === "object" ? data.ret as Record<string, unknown> : null;
  const code = typeof data.code === "number" ? data.code : typeof ret?.code === "number" ? ret.code : 0;
  if (code !== 0) {
    throw new Error(`${operation} 失败（code=${code}）：${JSON.stringify(data).slice(0, 1000)}`);
  }
  return data;
}

async function studioSession(): Promise<StudioSession> {
  const independent = await getHuaweiAuthStatus();
  if (independent.authenticated) {
    return getHuaweiCloudSession();
  }
  const jwt = await readKeychainPassword(studioLoginService, studioLoginAccount);
  if (!jwt) {
    throw new Error("尚未登录华为开发者服务；请先执行 huawei-dev auth login，或在 DevEco Studio 登录华为账号");
  }
  const payload = decodeJwtPayload(jwt);
  const response = await requestJson(`${devecoLoginBaseUrl}/authrouter/auth/api/jwToken/check`, {
    method: "GET",
    headers: { jwtToken: jwt, refresh: "true" }
  }, "换取 DevEco accessToken");
  if (response.status !== true || !response.userInfo || typeof response.userInfo !== "object") {
    throw new Error(`DevEco Studio 登录态已失效：${JSON.stringify(response).slice(0, 1000)}`);
  }
  const userInfo = response.userInfo as Record<string, unknown>;
  const accessToken = String(userInfo.accessToken || "");
  const userId = String(payload.userId || "");
  if (!accessToken || !userId) throw new Error("DevEco 登录响应缺少 accessToken 或 userId");
  return {
    accessToken,
    userId,
    userName: typeof payload.userName === "string" ? payload.userName : null,
    countryCode: typeof userInfo.nationalCode === "string" ? userInfo.nationalCode : null
  };
}

function cloudHeaders(session: StudioSession, teamId?: string): Record<string, string> {
  return {
    uid: session.userId,
    oauth2Token: session.accessToken,
    ...(teamId ? { teamId } : {})
  };
}

async function listTeams(session: StudioSession): Promise<TeamInfo[]> {
  const data = await requestJson(`${agcBaseUrl}/api/ups/user-permission-service/v1/user-team-list`, {
    method: "GET",
    headers: cloudHeaders(session)
  }, "查询开发团队");
  const teams = Array.isArray(data.teams) ? data.teams : [];
  return teams.map((team) => {
    const item = team as Record<string, unknown>;
    return { id: String(item.id || ""), name: String(item.name || "") };
  }).filter((team) => team.id);
}

async function selectTeam(session: StudioSession, requested?: string): Promise<TeamInfo> {
  const teams = await listTeams(session);
  if (!teams.length) throw new Error("当前华为账号没有可用于自动签名的开发团队");
  if (!requested) return teams[0];
  const selected = teams.find((team) => team.id === requested);
  if (!selected) throw new Error(`指定 teamId 不属于当前账号：${requested}`);
  return selected;
}

async function runHdc(hdc: string, args: string[]): Promise<string> {
  const result = await runFile(hdc, args);
  return `${result.stdout}\n${result.stderr}`.trim();
}

async function connectedDevice(hdc: string, requested?: string): Promise<{ target: string; udid: string; type: string }> {
  const listing = await runHdc(hdc, ["list", "targets", "-v"]);
  const lines = listing.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const connected = lines.filter((line) => /\bConnected\b/i.test(line));
  const selected = requested
    ? connected.find((line) => line.split(/\s+/)[0] === requested)
    : connected[0];
  if (!selected) throw new Error(requested ? `设备未连接：${requested}` : "没有已连接的 HarmonyOS 设备，无法生成调试 Profile");
  const target = selected.split(/\s+/)[0];
  const udidOutput = await runHdc(hdc, ["-c", "-t", target, "shell", "bm", "get", "-u"]);
  const udid = udidOutput.match(/[A-Za-z0-9]{64}/)?.[0];
  if (!udid) throw new Error(`无法从设备读取 64 位 UDID：${udidOutput.slice(0, 500)}`);
  const typeOutput = await runHdc(hdc, ["-c", "-t", target, "shell", "getprop", "hw_sc.build.os.devicetype"]);
  const type = typeOutput.split(/\r?\n/).map((line) => line.trim()).find((line) => /^(phone|tv|wearable|liteWearable|router)$/.test(line)) || "phone";
  return { target, udid, type };
}

function deviceTypeCode(type: string): string {
  return ({ liteWearable: "1", wearable: "2", phone: "4", tv: "8", router: "9" } as Record<string, string>)[type] || "4";
}

async function listDevices(session: StudioSession, teamId: string): Promise<DeviceInfo[]> {
  const query = new URLSearchParams({ encodeFlag: "0", start: "1", pageSize: "100" });
  const data = await requestJson(`${agcBaseUrl}/api/cps/device-manage/v1/device/list?${query}`, {
    method: "GET",
    headers: cloudHeaders(session, teamId)
  }, "查询调试设备");
  return (Array.isArray(data.list) ? data.list : []).map((value) => value as DeviceInfo).filter((item) => item.id && item.udid);
}

async function ensureDevice(
  session: StudioSession,
  teamId: string,
  device: { udid: string; type: string }
): Promise<{ devices: DeviceInfo[]; registered: boolean }> {
  let devices = await listDevices(session, teamId);
  let registered = false;
  if (!devices.some((item) => item.udid === device.udid)) {
    await requestJson(`${agcBaseUrl}/api/cps/device-manage/v1/device/add`, {
      method: "POST",
      headers: { ...cloudHeaders(session, teamId), "content-type": "application/json" },
      body: JSON.stringify({
        deviceName: `huawei_dev_${Date.now()}`,
        udid: device.udid,
        deviceType: deviceTypeCode(device.type)
      })
    }, "注册调试设备");
    registered = true;
    devices = await listDevices(session, teamId);
  }
  if (!devices.some((item) => item.udid === device.udid)) throw new Error("设备注册后仍未出现在 AGC 设备列表中");
  return { devices, registered };
}

function passwordAccount(project: string): string {
  return createHash("sha256").update(project).digest("hex");
}

function javaBase64UrlWithPadding(input: string): string {
  return createHash("sha256").update(input).digest("base64").replace(/\+/g, "-").replace(/\//g, "_");
}

async function materialForProject(project: string, configName = "default"): Promise<Omit<SigningMaterial, "password">> {
  const actual = await realpath(project);
  const config = configName ? `${configName}_` : "";
  const prefix = join(process.env.HOME || dirname(actual), ".ohos", "config", `${config}${basename(actual)}_${javaBase64UrlWithPadding(actual)}`);
  return {
    prefix,
    storeFile: `${prefix}.p12`,
    csrFile: `${prefix}.csr`,
    certFile: `${prefix}.cer`,
    profileFile: `${prefix}.p7b`
  };
}

async function prepareKeyPair(project: string, devecoHome: string, configName: string): Promise<SigningMaterial> {
  const paths = await materialForProject(project, configName);
  await mkdir(dirname(paths.prefix), { recursive: true, mode: 0o700 });
  await chmod(dirname(paths.prefix), 0o700);
  const account = passwordAccount(await realpath(project));
  let password = await readKeychainPassword(signingPasswordService, account);
  const hasStore = await exists(paths.storeFile);
  const hasCsr = await exists(paths.csrFile);
  if (password && hasStore && hasCsr) return { ...paths, password };

  for (const path of [paths.storeFile, paths.csrFile, paths.certFile, paths.profileFile]) await archiveFile(path);
  password = randomBytes(18).toString("base64url");
  const keytool = await signingExecutable(devecoHome, "keytool");
  await runFile(keytool, [
    "-genkeypair",
    "-alias", "debugKey",
    "-keyalg", "EC",
    "-sigalg", "SHA256withECDSA",
    "-groupname", "secp256r1",
    "-dname", "CN=DebugKey,OU=,O=,L=,ST=,C=",
    "-keypass", password,
    "-validity", String(25 * 365),
    "-keystore", paths.storeFile,
    "-storepass", password,
    "-storetype", "pkcs12"
  ], password);
  await runFile(keytool, [
    "-certreq",
    "-alias", "debugKey",
    "-sigalg", "SHA256withECDSA",
    "-keypass", password,
    "-keystore", paths.storeFile,
    "-storepass", password,
    "-storetype", "pkcs12",
    "-file", paths.csrFile
  ], password);
  await chmod(paths.storeFile, 0o600);
  await chmod(paths.csrFile, 0o600);
  await storeKeychainPassword(signingPasswordService, account, password);
  return { ...paths, password };
}

async function listCertificates(session: StudioSession, teamId: string): Promise<CertificateInfo[]> {
  const data = await requestJson(`${agcBaseUrl}/api/cps/harmony-cert-manage/v1/cert/list`, {
    method: "POST",
    headers: { ...cloudHeaders(session, teamId), "content-type": "application/json" },
    body: "{}"
  }, "查询调试证书");
  return (Array.isArray(data.certList) ? data.certList : []).map((item) => item as CertificateInfo).filter((item) => item.id && item.certObjectId);
}

async function deleteCertificate(session: StudioSession, teamId: string, id: string): Promise<void> {
  await requestJson(`${agcBaseUrl}/api/cps/harmony-cert-manage/v1/cert/delete`, {
    method: "DELETE",
    headers: { ...cloudHeaders(session, teamId), "content-type": "application/json" },
    body: JSON.stringify({ certIds: [id] })
  }, "删除同名自动调试证书");
}

async function createCertificate(
  session: StudioSession,
  teamId: string,
  csrFile: string
): Promise<CertificateInfo> {
  const certName = `auto_debug_${teamId}.cer`;
  const existing = (await listCertificates(session, teamId)).find((item) => item.certName === certName);
  if (existing) await deleteCertificate(session, teamId, existing.id);
  const csr = (await readFile(csrFile, "utf8")).trim();
  await requestJson(`${agcBaseUrl}/api/cps/harmony-cert-manage/v1/cert/add`, {
    method: "POST",
    headers: { ...cloudHeaders(session, teamId), "content-type": "application/json" },
    body: JSON.stringify({ csr, certName, certType: "1" })
  }, "申请 HarmonyOS 调试证书");
  const created = (await listCertificates(session, teamId)).find((item) => item.certName === certName);
  if (!created) throw new Error("证书申请成功后未在 AGC 证书列表中找到对应记录");
  return created;
}

async function downloadObject(session: StudioSession, teamId: string, objectId: string, destination: string): Promise<void> {
  const data = await requestJson(`${agcBaseUrl}/api/amis/app-manage/v1/objects/url/reapply`, {
    method: "POST",
    headers: { ...cloudHeaders(session, teamId), "content-type": "application/json" },
    body: JSON.stringify({ sourceUrls: objectId })
  }, "申请签名材料下载地址");
  const urls = Array.isArray(data.urlsInfo) ? data.urlsInfo as Array<Record<string, unknown>> : [];
  const url = String(urls[0]?.newUrl || "");
  if (!url) throw new Error("签名材料下载响应中缺少 newUrl");
  await downloadFile(url, destination);
}

async function downloadFile(url: string, destination: string): Promise<void> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`下载签名材料失败（HTTP ${response.status}）`);
  await archiveFile(destination);
  await writeFile(destination, Buffer.from(await response.arrayBuffer()), { mode: 0o600 });
  await chmod(destination, 0o600);
}

async function createProfile(
  session: StudioSession,
  teamId: string,
  bundleName: string,
  certId: string,
  deviceIds: string[]
): Promise<{ downloadUrl: string; id: string | null }> {
  const provisionName = `huawei_dev_${createHash("sha256").update(`${bundleName}:${Date.now()}`).digest("hex").slice(0, 24)}`;
  const data = await requestJson(`${agcBaseUrl}/api/cps/provision-manage/v1/ide/test/provision/add`, {
    method: "POST",
    headers: { ...cloudHeaders(session, teamId), "content-type": "application/json" },
    body: JSON.stringify({
      certList: [certId],
      packageName: bundleName,
      deviceList: deviceIds,
      provisionName,
      aclPermissionList: []
    })
  }, "生成 HarmonyOS 调试 Profile");
  const downloadUrl = String(data.provisionFileUrl || "");
  const id = data.id ? String(data.id) : null;
  if (!downloadUrl) throw new Error(`Profile 响应缺少 provisionFileUrl：${JSON.stringify(data).slice(0, 1000)}`);
  return { downloadUrl, id };
}

async function deleteProfile(session: StudioSession, teamId: string, id: string | null): Promise<void> {
  if (!id) return;
  await requestJson(`${agcBaseUrl}/api/cps/provision-manage/v1/provision/delete?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { ...cloudHeaders(session, teamId), "content-type": "application/json" },
    body: "{}"
  }, "清理临时调试 Profile");
}

async function bundleNameFromProject(project: string): Promise<string> {
  const appPath = join(project, "AppScope", "app.json5");
  const source = await readFile(appPath, "utf8");
  const value = source.match(/["']bundleName["']\s*:\s*["']([^"']+)["']/)?.[1];
  if (!value) throw new Error(`无法从 ${appPath} 解析 bundleName`);
  return value;
}

async function unsignedHaps(root: string): Promise<string[]> {
  const found: Array<{ path: string; mtime: number }> = [];
  async function walk(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && [".git", ".hvigor", "node_modules", ".trash"].includes(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && /-unsigned\.hap$/i.test(entry.name)) found.push({ path, mtime: (await stat(path)).mtimeMs });
    }
  }
  await walk(root);
  return found.sort((a, b) => b.mtime - a.mtime).map((item) => item.path);
}

async function resolveInput(project: string, explicit?: string): Promise<string> {
  if (explicit) {
    const input = resolve(project, explicit);
    await access(input);
    return realpath(input);
  }
  const inputs = await unsignedHaps(project);
  if (!inputs.length) throw new Error("工程中没有找到 *-unsigned.hap；请先构建或传 --input");
  return inputs[0];
}

function signedOutput(input: string, explicit?: string): string {
  if (explicit) return resolve(explicit);
  if (/-unsigned\.hap$/i.test(input)) return input.replace(/-unsigned\.hap$/i, "-signed.hap");
  return join(dirname(input), `${basename(input, extname(input))}-signed.hap`);
}

async function signHap(devecoHome: string, material: SigningMaterial, input: string, output: string): Promise<void> {
  await archiveFile(output);
  const java = await signingExecutable(devecoHome, "java");
  const tool = join(devecoHome, "sdk", "default", "openharmony", "toolchains", "lib", "hap-sign-tool.jar");
  await runFile(java, [
    "-jar", tool,
    "sign-app",
    "-mode", "localSign",
    "-keyAlias", "debugKey",
    "-keyPwd", material.password,
    "-appCertFile", material.certFile,
    "-profileFile", material.profileFile,
    "-inFile", input,
    "-signAlg", "SHA256withECDSA",
    "-keystoreFile", material.storeFile,
    "-keystorePwd", material.password,
    "-outFile", output,
    "-signCode", "1"
  ], material.password);
  await access(output);
}

async function profileAllowsDevice(
  devecoHome: string,
  profileFile: string,
  bundleName: string,
  udid: string
): Promise<boolean> {
  try {
    const java = await signingExecutable(devecoHome, "java");
    const tool = join(devecoHome, "sdk", "default", "openharmony", "toolchains", "lib", "hap-sign-tool.jar");
    const result = await runFile(java, ["-jar", tool, "verify-profile", "-inFile", profileFile]);
    const match = result.stdout.match(/INFO - (\{[\s\S]*\})\r?\n[^\n]*INFO - verify-profile success/);
    if (!match) return false;
    const verification = JSON.parse(match[1]) as Record<string, unknown>;
    if (verification.verifiedPassed !== true || !verification.content || typeof verification.content !== "object") return false;
    const content = verification.content as Record<string, unknown>;
    const bundleInfo = content["bundle-info"] as Record<string, unknown> | undefined;
    const debugInfo = content["debug-info"] as Record<string, unknown> | undefined;
    const validity = content.validity as Record<string, unknown> | undefined;
    const deviceIds = Array.isArray(debugInfo?.["device-ids"])
      ? debugInfo["device-ids"].map((value) => String(value))
      : [];
    const now = Math.floor(Date.now() / 1000);
    const notBefore = Number(validity?.["not-before"] || 0);
    const notAfter = Number(validity?.["not-after"] || 0);
    return content.type === "debug"
      && bundleInfo?.["bundle-name"] === bundleName
      && deviceIds.includes(udid)
      && notBefore <= now
      && now < notAfter;
  } catch {
    return false;
  }
}

export async function getSigningStatus(options: SigningStatusOptions): Promise<Record<string, unknown>> {
  const project = await realpath(options.project);
  const paths = await materialForProject(project, "default");
  const targetOutput = await runHdc(options.hdc, ["list", "targets", "-v"]).catch(() => "");
  const independentAuth = await getHuaweiAuthStatus();
  return {
    project,
    huaweiDevAuth: independentAuth.authenticated,
    studioLoginInKeychain: await keychainHas(studioLoginService, studioLoginAccount),
    signingPasswordInKeychain: await keychainHas(signingPasswordService, passwordAccount(project)),
    connectedTargets: targetOutput.split(/\r?\n/).map((line) => line.trim()).filter((line) => /\bConnected\b/i.test(line)),
    material: {
      ...paths,
      exists: {
        storeFile: await exists(paths.storeFile),
        csrFile: await exists(paths.csrFile),
        certFile: await exists(paths.certFile),
        profileFile: await exists(paths.profileFile)
      }
    },
    unsignedHaps: await unsignedHaps(project)
  };
}

export async function autoSignHarmonyHap(options: AutoSigningOptions): Promise<AutoSigningResult> {
  const project = await realpath(options.project);
  const input = await resolveInput(project, options.input);
  const output = signedOutput(input, options.output ? resolve(project, options.output) : undefined);
  const bundleName = await bundleNameFromProject(project);
  const device = await connectedDevice(options.hdc, options.device);
  const configName = options.configName ?? "default";
  const paths = await materialForProject(project, configName);
  const account = passwordAccount(project);
  const existingPassword = await readKeychainPassword(signingPasswordService, account);
  const complete = Boolean(existingPassword) && await Promise.all([
    exists(paths.storeFile), exists(paths.csrFile), exists(paths.certFile), exists(paths.profileFile)
  ]).then((values) => values.every(Boolean));

  const reusable = complete && existingPassword
    ? await profileAllowsDevice(options.devecoHome, paths.profileFile, bundleName, device.udid)
    : false;

  if (reusable && existingPassword) {
    const material = { ...paths, password: existingPassword };
    await signHap(options.devecoHome, material, input, output);
    return {
      project, bundleName, input, output, device,
      team: { id: "local-material", name: "复用现有签名材料" },
      material: paths,
      reusedMaterial: true,
      certificateCreated: false,
      deviceRegistered: false,
      profileCreated: false
    };
  }

  const session = await studioSession();
  const team = await selectTeam(session, options.teamId);
  const material = await prepareKeyPair(project, options.devecoHome, configName);
  const certificate = await createCertificate(session, team.id, material.csrFile);
  await downloadObject(session, team.id, certificate.certObjectId, material.certFile);
  const registeredDevice = await ensureDevice(session, team.id, device);
  const profile = await createProfile(session, team.id, bundleName, certificate.id, registeredDevice.devices.map((item) => item.id));
  try {
    await downloadFile(profile.downloadUrl, material.profileFile);
  } finally {
    await deleteProfile(session, team.id, profile.id);
  }
  await signHap(options.devecoHome, material, input, output);
  return {
    project, bundleName, input, output, device, team,
    material: paths,
    reusedMaterial: false,
    certificateCreated: true,
    deviceRegistered: registeredDevice.registered,
    profileCreated: true
  };
}
