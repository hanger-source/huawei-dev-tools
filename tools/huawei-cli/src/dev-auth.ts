import { execFile } from "node:child_process";
import crypto from "node:crypto";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

// Protocol extracted from deveco-code v0.1.7 (MIT), commit
// 742e15045e4cfddf35d042573258dd7f7d3cfad3. This module is intentionally
// independent from its TUI, Agent runtime and encrypted credential store.
const DEVECO_ORIGIN = "https://cn.devecostudio.huawei.com";
const LOGIN_PATH = "/console/DevEcoIDE/apply";
const TEMP_TOKEN_PATH = "/authrouter/auth/api/temptoken/check";
const JWT_CHECK_PATH = "/authrouter/auth/api/jwToken/check";
const BIG_SEARCH_URL = `${DEVECO_ORIGIN}/codeGenie/bigSearch`;
const LOGIN_SUCCESS_URL = `${DEVECO_ORIGIN}/console/DevEcoCode/loginSuccess`;
const LOGIN_FAILED_URL = `${DEVECO_ORIGIN}/console/DevEcoCode/loginFailed`;
const APP_ID = "1008";
const ACCESS_TOKEN_LIFETIME_MS = 30 * 60 * 1000;
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
const AUTH_PORTS = [10101, 34567, 34568, 34569, 34570];
const execFileAsync = promisify(execFile);

const configDirectory = process.platform === "darwin"
  ? join(homedir(), "Library", "Application Support", "huawei-dev")
  : join(homedir(), ".config", "huawei-dev");
const authPath = join(configDirectory, "auth.enc.json");
const keyPath = join(configDirectory, "auth.key");
const trashDirectory = join(configDirectory, ".trash");

interface AuthRecord {
  accessToken: string;
  jwtToken: string;
  accessExpiresAt: number;
  jwtExpiresAt: number | null;
  userId: string;
  userName: string;
  countryCode: string;
  isRealName: boolean;
}

interface EncryptedRecord {
  version: 1;
  algorithm: "aes-256-gcm";
  ciphertext: string;
  iv: string;
  authTag: string;
}

interface TokenCheckResponse {
  status?: boolean;
  userInfo?: {
    accessToken?: string;
    nationalCode?: string;
    realName?: boolean | string;
  };
}

interface JwtPayload {
  userId?: string;
  userName?: string;
  exp?: number;
}

export interface HuaweiAuthStatus {
  authenticated: boolean;
  configDirectory: string;
  userId?: string;
  userName?: string;
  countryCode?: string;
  isRealName?: boolean;
  accessExpiresAt?: number;
  jwtExpiresAt?: number | null;
}

export interface HuaweiCloudSession {
  accessToken: string;
  userId: string;
  userName: string | null;
  countryCode: string | null;
}

export interface HuaweiKnowledgeResult {
  question: string;
  answer: string;
  endpoint: string;
}

function timestamp(): string {
  return new Date().toISOString().replace(/[.:]/g, "-");
}

async function ensureConfigDirectory(): Promise<void> {
  await mkdir(configDirectory, { recursive: true, mode: 0o700 });
  await chmod(configDirectory, 0o700);
}

async function loadOrCreateKey(): Promise<Buffer> {
  await ensureConfigDirectory();
  try {
    const existing = await readFile(keyPath);
    if (existing.length !== 32) throw new Error(`认证密钥长度异常：${keyPath}`);
    return existing;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code && code !== "ENOENT") throw error;
    const created = crypto.randomBytes(32);
    try {
      await writeFile(keyPath, created, { flag: "wx", mode: 0o600 });
      return created;
    } catch (writeError) {
      if ((writeError as NodeJS.ErrnoException).code !== "EEXIST") throw writeError;
      const raced = await readFile(keyPath);
      if (raced.length !== 32) throw new Error(`认证密钥长度异常：${keyPath}`);
      return raced;
    }
  }
}

async function saveAuth(record: AuthRecord): Promise<void> {
  const key = await loadOrCreateKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(record), "utf8"), cipher.final()]);
  const encrypted: EncryptedRecord = {
    version: 1,
    algorithm: "aes-256-gcm",
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64")
  };
  const temporary = `${authPath}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(encrypted, null, 2), { mode: 0o600 });
  await rename(temporary, authPath);
  await chmod(authPath, 0o600);
}

async function loadAuth(): Promise<AuthRecord | null> {
  try {
    const raw = await readFile(authPath, "utf8");
    const key = await loadOrCreateKey();
    const encrypted = JSON.parse(raw) as Partial<EncryptedRecord>;
    if (
      encrypted.version !== 1 ||
      encrypted.algorithm !== "aes-256-gcm" ||
      typeof encrypted.ciphertext !== "string" ||
      typeof encrypted.iv !== "string" ||
      typeof encrypted.authTag !== "string"
    ) {
      throw new Error(`无法识别认证文件格式：${authPath}`);
    }
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(encrypted.iv, "base64"));
    decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
      decipher.final()
    ]).toString("utf8");
    return JSON.parse(plaintext) as AuthRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function parseJwt(token: string): JwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("华为认证服务返回了无效 JWT");
  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
  return JSON.parse(Buffer.from(base64, "base64").toString("utf8")) as JwtPayload;
}

async function fetchText(url: string, init: RequestInit = {}): Promise<string> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "User-Agent": "huawei-dev/0.1",
      "Accept-Language": "zh-CN",
      ...init.headers
    },
    signal: AbortSignal.timeout(20_000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`华为服务请求失败：HTTP ${response.status} ${text.slice(0, 300)}`);
  if (/^\s*<!doctype|^\s*<html/i.test(text)) throw new Error("华为服务返回了 HTML，可能被网关或登录页拦截");
  return text;
}

async function checkJwt(jwtToken: string, refresh: boolean): Promise<TokenCheckResponse> {
  const text = await fetchText(`${DEVECO_ORIGIN}${JWT_CHECK_PATH}`, {
    headers: { refresh: String(refresh), jwtToken }
  });
  const result = JSON.parse(text) as TokenCheckResponse;
  if (!result.status || !result.userInfo?.accessToken) throw new Error("华为 JWT 已失效，请重新执行 auth login");
  if ((result.userInfo.nationalCode || "").trim().toUpperCase() !== "CN") {
    throw new Error("DevEco Code 云服务目前只接受中国区华为开发者账号");
  }
  return result;
}

async function exchangeTempToken(tempToken: string): Promise<string> {
  const url = new URL(`${DEVECO_ORIGIN}${TEMP_TOKEN_PATH}`);
  url.searchParams.set("tempToken", tempToken.split("&")[0]);
  url.searchParams.set("site", "CN");
  url.searchParams.set("version", "1.0.0");
  url.searchParams.set("appid", APP_ID);
  const jwtToken = (await fetchText(url.href)).trim();
  parseJwt(jwtToken);
  return jwtToken;
}

function collectBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString("utf8");
      if (body.length > 64 * 1024) request.destroy(new Error("登录回调内容过大"));
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function redirect(response: ServerResponse, location: string): void {
  response.writeHead(302, { Location: location });
  response.end();
}

async function listenOnAvailablePort(
  clientSecret: string
): Promise<{ port: number; callback: Promise<string>; close: () => Promise<void> }> {
  for (const port of AUTH_PORTS) {
    const server = http.createServer();
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", () => {
          server.off("error", reject);
          resolve();
        });
      });
      const callback = new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("等待华为登录回调超时")), LOGIN_TIMEOUT_MS);
        server.on("request", async (request, response) => {
          try {
            const url = new URL(request.url || "/", `http://127.0.0.1:${port}`);
            if (url.pathname !== "/callback") {
              response.writeHead(404);
              response.end("Not Found");
              return;
            }
            const body = request.method === "POST" ? await collectBody(request) : "";
            const params = body ? new URLSearchParams(body) : url.searchParams;
            const code = params.get("code") || "";
            const expected = Buffer.from(clientSecret);
            const actual = Buffer.from(code);
            if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
              response.writeHead(403);
              response.end("Invalid callback code");
              return;
            }
            if (["true", "access_denied"].includes(params.get("quit") || "")) {
              clearTimeout(timeout);
              redirect(response, LOGIN_FAILED_URL);
              reject(new Error("用户取消了华为账号授权"));
              return;
            }
            const tempToken = params.get("tempToken");
            const siteId = params.get("siteId");
            if (!tempToken || siteId !== "1") {
              clearTimeout(timeout);
              redirect(response, LOGIN_FAILED_URL);
              reject(new Error("登录回调缺少令牌，或账号不属于中国站"));
              return;
            }
            clearTimeout(timeout);
            redirect(response, LOGIN_SUCCESS_URL);
            resolve(tempToken);
          } catch (error) {
            clearTimeout(timeout);
            response.writeHead(500);
            response.end("Login callback failed");
            reject(error);
          }
        });
      });
      return {
        port,
        callback,
        close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
      };
    } catch (error) {
      server.close();
      if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
    }
  }
  throw new Error(`华为登录回调端口均被占用：${AUTH_PORTS.join(", ")}`);
}

async function openBrowser(url: string): Promise<void> {
  if (process.platform !== "darwin") throw new Error(`请在浏览器打开：${url}`);
  await execFileAsync("/usr/bin/open", [url]);
}

function authStatusFromRecord(record: AuthRecord): HuaweiAuthStatus {
  return {
    authenticated: true,
    configDirectory,
    userId: record.userId,
    userName: record.userName,
    countryCode: record.countryCode,
    isRealName: record.isRealName,
    accessExpiresAt: record.accessExpiresAt,
    jwtExpiresAt: record.jwtExpiresAt
  };
}

export async function loginHuawei(): Promise<HuaweiAuthStatus> {
  const clientSecret = crypto.randomUUID().replace(/-/g, "");
  const listener = await listenOnAvailablePort(clientSecret);
  try {
    const loginUrl = new URL(`${DEVECO_ORIGIN}${LOGIN_PATH}`);
    loginUrl.searchParams.set("port", String(listener.port));
    loginUrl.searchParams.set("appid", APP_ID);
    loginUrl.searchParams.set("code", clientSecret);
    await openBrowser(loginUrl.href);
    const tempToken = await listener.callback;
    const jwtToken = await exchangeTempToken(tempToken);
    const checked = await checkJwt(jwtToken, false);
    const jwt = parseJwt(jwtToken);
    const record: AuthRecord = {
      accessToken: checked.userInfo!.accessToken!,
      jwtToken,
      accessExpiresAt: Date.now() + ACCESS_TOKEN_LIFETIME_MS,
      jwtExpiresAt: typeof jwt.exp === "number" ? jwt.exp * 1000 : null,
      userId: jwt.userId || "",
      userName: jwt.userName || "",
      countryCode: (checked.userInfo!.nationalCode || "CN").trim().toUpperCase(),
      isRealName: String(checked.userInfo!.realName) === "true"
    };
    await saveAuth(record);
    return authStatusFromRecord(record);
  } finally {
    await listener.close();
  }
}

export async function getHuaweiAuthStatus(): Promise<HuaweiAuthStatus> {
  const record = await loadAuth();
  return record ? authStatusFromRecord(record) : { authenticated: false, configDirectory };
}

export async function logoutHuawei(): Promise<{ authenticated: false; movedTo: string | null }> {
  try {
    await readFile(authPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { authenticated: false, movedTo: null };
    throw error;
  }
  await mkdir(trashDirectory, { recursive: true, mode: 0o700 });
  const destination = join(trashDirectory, `${timestamp()}-auth.enc.json`);
  await rename(authPath, destination);
  return { authenticated: false, movedTo: destination };
}

async function ensureAccessToken(): Promise<string> {
  const record = await loadAuth();
  if (!record) throw new Error("尚未登录。请先执行 huawei-dev auth login");
  if (Date.now() < record.accessExpiresAt) return record.accessToken;
  if (record.jwtExpiresAt && Date.now() >= record.jwtExpiresAt) {
    throw new Error("华为登录已过期。请重新执行 huawei-dev auth login");
  }
  const checked = await checkJwt(record.jwtToken, true);
  record.accessToken = checked.userInfo!.accessToken!;
  record.accessExpiresAt = Date.now() + ACCESS_TOKEN_LIFETIME_MS;
  record.isRealName = String(checked.userInfo!.realName) === "true";
  await saveAuth(record);
  return record.accessToken;
}

export async function getHuaweiCloudSession(): Promise<HuaweiCloudSession> {
  const accessToken = await ensureAccessToken();
  const record = await loadAuth();
  if (!record) throw new Error("尚未登录。请先执行 huawei-dev auth login");
  return {
    accessToken,
    userId: record.userId,
    userName: record.userName || null,
    countryCode: record.countryCode || null
  };
}

export async function queryHuaweiKnowledge(question: string): Promise<HuaweiKnowledgeResult> {
  const normalized = question.trim();
  if (!normalized) throw new Error("knowledge question 不能为空");
  const accessToken = await ensureAccessToken();
  const text = await fetchText(BIG_SEARCH_URL, {
    method: "POST",
    headers: {
      Authorization: accessToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ question: normalized })
  });
  const data = JSON.parse(text) as {
    code?: number;
    body?: { answer?: { prompt?: string } };
    error_code?: number;
    error_msg?: string;
  };
  if (data.error_code === 4016) throw new Error("华为访问令牌失效。请重新执行 huawei-dev auth login");
  if (data.error_code) throw new Error(`华为知识库错误 ${data.error_code}：${data.error_msg || "未知错误"}`);
  if (data.code !== 200) throw new Error(`华为知识库返回未知状态：${data.code ?? "无 code"}`);
  const prompt = data.body?.answer?.prompt || "";
  const marker = "【检索信息】：";
  const answer = (prompt.includes(marker) ? prompt.slice(prompt.indexOf(marker) + marker.length) : prompt).trim();
  if (!answer) throw new Error("华为知识库没有返回答案");
  return { question: normalized, answer: answer.slice(0, 5 * 1024), endpoint: BIG_SEARCH_URL };
}

export const huaweiAuthPaths = { configDirectory, authPath, keyPath } as const;
