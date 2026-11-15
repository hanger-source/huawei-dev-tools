import type {
  CompatibilityVerdict,
  DeviceStatus,
  Heading,
  SectionMetadata
} from "./types.js";
import { compareApiVersions, parseApiVersion } from "./api-version.js";
import type { VersionProfile } from "./constants.js";

export function normalizeSymbol(value: string): string {
  return value
    .trim()
    .replace(/`/g, "")
    .replace(/\(.*\)$/, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function toHuaweiAnchor(title: string): string {
  const clean = title
    .trim()
    .replace(/`/g, "")
    .replace(/\(.*\)$/, "")
    .toLowerCase();

  return clean
    .replace(/\s+/g, "-")
    .replace(/[^\p{Letter}\p{Number}_\-\u3400-\u9fff]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function parseHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  const anchorCounts = new Map<string, number>();
  const lines = markdown.split(/\r?\n/);
  let inFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const title = match[2].replace(/\s+#+$/, "").trim();
    const baseAnchor = toHuaweiAnchor(title);
    const duplicateIndex = anchorCounts.get(baseAnchor) || 0;
    anchorCounts.set(baseAnchor, duplicateIndex + 1);
    headings.push({
      level: match[1].length,
      title,
      anchor: duplicateIndex === 0 ? baseAnchor : `${baseAnchor}-${duplicateIndex}`,
      line: index + 1
    });
  }

  return headings;
}

export interface ExtractedSection {
  title: string;
  anchor: string;
  level: number;
  startLine: number;
  endLine: number;
  content: string;
}

export function extractSection(markdown: string, selector: string): ExtractedSection | null {
  const headings = parseHeadings(markdown);
  const normalized = normalizeSymbol(selector.replace(/^#/, ""));
  const anchor = selector.replace(/^#/, "").toLowerCase();

  const selectedIndex = headings.findIndex(
    (heading) =>
      heading.anchor === anchor ||
      normalizeSymbol(heading.title) === normalized ||
      normalizeSymbol(heading.anchor) === normalized
  );
  if (selectedIndex < 0) return null;

  const selected = headings[selectedIndex];
  const next = headings
    .slice(selectedIndex + 1)
    .find((heading) => heading.level <= selected.level);
  const lines = markdown.split(/\r?\n/);
  const endLine = next ? next.line - 1 : lines.length;

  return {
    title: selected.title,
    anchor: selected.anchor,
    level: selected.level,
    startLine: selected.line,
    endLine,
    content: lines.slice(selected.line - 1, endLine).join("\n").trim()
  };
}

function firstMatch(content: string, pattern: RegExp): string | null {
  const match = pattern.exec(content);
  return match?.[1]?.trim() || null;
}

export function parseSectionMetadata(content: string, apiMax: number | string): SectionMetadata {
  content = content.replace(/\*\*/g, "");
  const sinceVersionRaw = firstMatch(content, /起始版本[：:]\s*([^\n]+)/);
  const systemCapability = firstMatch(content, /系统能力[：:]\s*([^\n]+)/);
  const permissions = [...content.matchAll(/需要权限[：:]\s*([^\n]+)/g)]
    .flatMap((match) => match[1].split(/[、,，]/))
    .map((value) => value.trim())
    .filter(Boolean);
  const deviceBehavior = [...content.matchAll(/设备行为差异[：:]\s*([^\n]+)/g)].map(
    (match) => match[1].trim()
  );

  const laterVersionNotes: Array<{ version: string; text: string }> = [];
  for (const paragraph of content.split(/\n\s*\n/)) {
    const matches = [
      ...paragraph.matchAll(/(?:从)?API\s*(?:version|版本)?\s*(\d+(?:\.\d+\.\d+)?)/gi)
    ];
    for (const match of matches) {
      const version = match[1];
      if (compareApiVersions(version, apiMax) > 0) {
        laterVersionNotes.push({ version, text: paragraph.replace(/\s+/g, " ").trim() });
        break;
      }
    }
  }

  return {
    sinceVersion: parseApiVersion(sinceVersionRaw),
    sinceVersionRaw,
    systemCapability,
    permissions: [...new Set(permissions)],
    restrictedPermission: /受限权限/.test(content),
    deviceBehavior,
    laterVersionNotes
  };
}

function evaluateDeviceStatus(device: string, content: string): DeviceStatus {
  if (device.toLowerCase() !== "phone") return "unknown";

  const unsupportedPatterns = [
    /仅在\s*PC\/2in1\s*设备[上中]?(?:可)?(?:生效|正常调用)/,
    /在PC\/2in1设备中可正常调用[\s\S]{0,80}其他设备上调用无效果/,
    /其他设备上(?:返回(?:201|801)错误码|调用无效果)/
  ];
  if (unsupportedPatterns.some((pattern) => pattern.test(content))) return "unsupported";

  const supportedPatterns = [
    /在Phone设备[^。]*(?:正常调用|生效|支持)/,
    /在Phone、PC\/2in1、Tablet设备中可正常调用/,
    /Phone\/Tablet[^。]*支持/
  ];
  if (supportedPatterns.some((pattern) => pattern.test(content))) return "supported";

  return "unknown";
}

export function evaluateCompatibility(
  content: string,
  metadata: SectionMetadata,
  profile: VersionProfile,
  device: string
): CompatibilityVerdict {
  const reasons: string[] = [];
  const introducedInProfile =
    metadata.sinceVersion === null ? null : compareApiVersions(metadata.sinceVersion, profile.apiMax) <= 0;
  const deviceStatus = evaluateDeviceStatus(device, content);

  if (introducedInProfile === false) {
    reasons.push(`接口起始 API ${metadata.sinceVersion}，晚于 ${profile.name} 的 API ${profile.apiMax}`);
  } else if (introducedInProfile === true) {
    reasons.push(`接口起始 API ${metadata.sinceVersion}，位于 ${profile.name} API 上限内`);
  } else {
    reasons.push("文档段落未给出可解析的起始版本");
  }

  if (deviceStatus === "unsupported") {
    reasons.push(`官方设备行为差异明确排除 ${device}`);
  } else if (deviceStatus === "supported") {
    reasons.push(`官方设备行为差异明确包含 ${device}`);
  } else {
    reasons.push(`文档段落未明确证明 ${device} 可用，需真机或函数级设备标签验证`);
  }

  let verdict: CompatibilityVerdict["verdict"] = "requires_verification";
  if (introducedInProfile === false || deviceStatus === "unsupported") verdict = "unsupported";
  else if (introducedInProfile === true && deviceStatus === "supported") verdict = "supported";

  return {
    profile: profile.name,
    apiRange: { min: profile.apiMin, max: profile.apiMax },
    device,
    introducedInProfile,
    deviceStatus,
    verdict,
    reasons
  };
}

export interface MarkdownLink {
  text: string;
  url: string;
  id: string | null;
  anchor: string | null;
}

export function extractHuaweiDocLinks(markdown: string): MarkdownLink[] {
  const links: MarkdownLink[] = [];
  const seen = new Set<string>();
  const pattern = /\[([^\]]+)]\((https:\/\/developer\.huawei\.com\/consumer\/cn\/doc\/[^)]+)\)/g;

  for (const match of markdown.matchAll(pattern)) {
    const url = match[2].replace(/\.md(?=#|$)/, "");
    if (seen.has(url)) continue;
    seen.add(url);
    const parsed = new URL(url);
    links.push({
      text: match[1],
      url,
      id: parsed.pathname.split("/doc/")[1] || null,
      anchor: parsed.hash ? parsed.hash.slice(1) : null
    });
  }
  return links;
}
