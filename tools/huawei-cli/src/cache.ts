import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface CachedValue<T> {
  value: T;
  cached: boolean;
  path: string;
}

export function cacheRoot(): string {
  return (
    process.env.HUAWEI_DOCS_CACHE_DIR ||
    fileURLToPath(new URL("../data/huawei-docs/", import.meta.url))
  );
}

function assertSafeSegment(segment: string): void {
  if (!segment || segment === "." || segment === ".." || /[\\/\0]/.test(segment)) {
    throw new Error(`非法缓存路径片段：${segment}`);
  }
}

export function cachePath(...segments: string[]): string {
  segments.forEach(assertSafeSegment);
  return join(cacheRoot(), ...segments);
}

export async function readCachedText(...segments: string[]): Promise<string | null> {
  try {
    return await readFile(cachePath(...segments), "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw error;
  }
}

export async function writeCachedText(value: string, ...segments: string[]): Promise<string> {
  const path = cachePath(...segments);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
  return path;
}

export async function readThroughText(
  segments: string[],
  refresh: boolean,
  load: () => Promise<string>
): Promise<CachedValue<string>> {
  if (!refresh) {
    const cached = await readCachedText(...segments);
    if (cached !== null) {
      return { value: cached, cached: true, path: cachePath(...segments) };
    }
  }

  const value = await load();
  const path = await writeCachedText(value, ...segments);
  return { value, cached: false, path };
}

export async function readThroughJson<T>(
  segments: string[],
  refresh: boolean,
  load: () => Promise<T>
): Promise<CachedValue<T>> {
  const result = await readThroughText(segments, refresh, async () =>
    JSON.stringify(await load())
  );
  return {
    value: JSON.parse(result.value) as T,
    cached: result.cached,
    path: result.path
  };
}

export async function isCached(...segments: string[]): Promise<boolean> {
  try {
    await stat(cachePath(...segments));
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return false;
    throw error;
  }
}

export async function getCacheStatus(): Promise<{
  path: string;
  exists: boolean;
  policy: "persistent-until-refresh";
}> {
  const path = cacheRoot();
  try {
    await stat(path);
    return { path, exists: true, policy: "persistent-until-refresh" };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { path, exists: false, policy: "persistent-until-refresh" };
    }
    throw error;
  }
}
