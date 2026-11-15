import { DOC_BASE, DOC_ORIGIN, DOC_PORTAL_URL, DOC_SITEMAP_URL } from "./constants.js";
import type {
  CatalogNode,
  CatalogSummary,
  FlatCatalogNode,
  PortalDomain,
  PortalEntry,
  PortalGroup,
  PortalSnapshot,
  SitemapDocument,
  DocumentIndex
} from "./types.js";

function textValue(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const raw = (value as { value?: unknown }).value;
  return typeof raw === "string" ? raw.trim() : "";
}

function optionValue(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return Boolean((value as { value?: unknown }).value);
}

function listValue(value: unknown): unknown[] {
  if (!value || typeof value !== "object") return [];
  const raw = (value as { rawValue?: unknown }).rawValue;
  return Array.isArray(raw) ? raw : [];
}

export function splitDocumentId(input: string): {
  id: string;
  catalogId: string;
  documentId: string;
} {
  const clean = input.replace(/^\/+|\/+$/g, "").replace(/\.md$/, "");
  const parts = clean.split("/");
  if (parts.length < 2 || parts.some((part) => !part || part === "." || part === ".." || /[\\\0?#%]/.test(part))) {
    throw new Error(`文档 ID 必须是 <catalog>/<document> 或 <catalog>/api/<document>：${input}`);
  }
  if (parts.length > 2 && (parts.length !== 3 || parts[1] !== "api")) throw new Error(`非法文档层级：${input}`);
  return { id: clean, catalogId: parts[0], documentId: parts.slice(1).join("/") };
}

export function parseHuaweiDocumentUrl(input: string): {
  id: string;
  catalogId: string;
  documentId: string;
  url: string;
} {
  const url = new URL(input, DOC_BASE);
  if (url.origin !== DOC_ORIGIN || !url.pathname.startsWith("/consumer/cn/doc/")) {
    throw new Error(`不是华为开发文档地址：${input}`);
  }
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/$/, "").replace(/\.md$/, "");
  const identity = splitDocumentId(url.pathname.split("/doc/")[1]);
  return { ...identity, url: url.toString() };
}

function normalizePortalEntry(value: unknown): PortalEntry | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const linked = item.linked;
  if (!linked || typeof linked !== "object") return null;
  const href = (linked as { href?: unknown }).href;
  if (typeof href !== "string" || !href) return null;

  let identity: ReturnType<typeof parseHuaweiDocumentUrl> | null = null;
  try {
    identity = parseHuaweiDocumentUrl(href);
  } catch {
    identity = null;
  }

  return {
    title: textValue(item.title),
    description: textValue(item.desc),
    enabled: optionValue(item.abled),
    url: href,
    id: identity?.id || null,
    catalogId: identity?.catalogId || null,
    documentId: identity?.documentId || null
  };
}

export function parsePortalHtml(html: string, fetchedAt = new Date().toISOString()): PortalSnapshot {
  const match = /var\s+binaryString\s*=\s*atob\("([A-Za-z0-9+/=]+)"\)/.exec(html);
  if (!match) throw new Error("文档中心首页未找到 CMS JSON payload");
  const payload = JSON.parse(Buffer.from(match[1], "base64").toString("utf8")) as {
    children?: Array<{ vueAppComponentRawValue?: Record<string, unknown> }>;
  };
  const component = payload.children?.[0]?.vueAppComponentRawValue;
  if (!component) throw new Error("文档中心 CMS payload 缺少主组件数据");

  const layout = (component.layout || {}) as Record<string, unknown>;
  const versions = listValue(component.version).map((versionValue) => {
    const version = versionValue as Record<string, unknown>;
    const domains: PortalDomain[] = listValue(version.list).map((domainValue) => {
      const domain = domainValue as Record<string, unknown>;
      const groups: PortalGroup[] = listValue(domain.list).map((groupValue) => {
        const group = groupValue as Record<string, unknown>;
        const entries = listValue(group.list)
          .map(normalizePortalEntry)
          .filter((entry): entry is PortalEntry => entry !== null);
        return { title: textValue(group.title2), entries };
      });
      return { title: textValue(domain.title1), groups };
    });
    return { label: textValue(version.label), domains };
  });
  const entryCount = versions.reduce(
    (versionTotal, version) =>
      versionTotal +
      version.domains.reduce(
        (domainTotal, domain) =>
          domainTotal + domain.groups.reduce((groupTotal, group) => groupTotal + group.entries.length, 0),
        0
      ),
    0
  );

  return {
    source: DOC_PORTAL_URL,
    fetchedAt,
    title: textValue(layout.floortitle),
    description: textValue(layout.floordescription),
    versions,
    entryCount
  };
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function parseSitemapXml(xml: string, fetchedAt = new Date().toISOString()): DocumentIndex {
  const documents: SitemapDocument[] = [];
  for (const block of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = /<loc>([\s\S]*?)<\/loc>/.exec(block[1]);
    if (!loc) continue;
    const rawUrl = decodeXmlText(loc[1].trim());
    let identity: ReturnType<typeof parseHuaweiDocumentUrl>;
    try {
      identity = parseHuaweiDocumentUrl(rawUrl);
    } catch {
      continue;
    }
    const lastModified = /<lastmod>([\s\S]*?)<\/lastmod>/.exec(block[1])?.[1]?.trim() || null;
    documents.push({
      id: identity.id,
      catalogId: identity.catalogId,
      documentId: identity.documentId,
      url: identity.url,
      lastModified
    });
  }

  const grouped = new Map<string, SitemapDocument[]>();
  for (const document of documents) {
    const items = grouped.get(document.catalogId) || [];
    items.push(document);
    grouped.set(document.catalogId, items);
  }
  const catalogs: CatalogSummary[] = [...grouped.entries()]
    .map(([id, items]) => ({
      id,
      documentCount: items.length,
      firstDocumentId: items[0]?.documentId || null,
      lastModified:
        items.map((item) => item.lastModified).filter((value): value is string => Boolean(value)).sort().at(-1) || null
    }))
    .sort((left, right) => right.documentCount - left.documentCount || left.id.localeCompare(right.id));

  return {
    source: DOC_SITEMAP_URL,
    fetchedAt,
    documentCount: documents.length,
    catalogs,
    documents
  };
}

export function findSitemapDocumentsByBareId(
  sitemap: DocumentIndex,
  documentId: string
): SitemapDocument[] {
  return sitemap.documents.filter((document) => document.documentId.split("/").at(-1) === documentId);
}

export function flattenCatalogTree(catalogId: string, roots: CatalogNode[]): FlatCatalogNode[] {
  const nodes: FlatCatalogNode[] = [];
  const visit = (node: CatalogNode, depth: number, parents: string[]) => {
    const path = [...parents, node.nodeName];
    const documentId = node.relateDocument || null;
    const id = documentId ? `${catalogId}/${documentId}` : null;
    nodes.push({
      nodeId: node.nodeId,
      title: node.nodeName,
      depth,
      path,
      documentId,
      id,
      url: id ? `${DOC_BASE}${id}` : null,
      isLeaf: Boolean(node.isLeaf)
    });
    for (const child of node.children || []) visit(child, depth + 1, path);
  };
  for (const root of roots) visit(root, 0, []);
  return nodes;
}

export function findCatalogDocumentNode(
  catalogId: string,
  roots: CatalogNode[],
  documentId: string
): FlatCatalogNode | null {
  return (
    flattenCatalogTree(catalogId, roots).find((node) => node.documentId === documentId) || null
  );
}

export function findPortalDocumentPlacements(
  portal: PortalSnapshot,
  id: string
): Array<{
  version: string;
  domain: string;
  group: string;
  title: string;
  description: string;
}> {
  return portal.versions.flatMap((version) =>
    version.domains.flatMap((domain) =>
      domain.groups.flatMap((group) =>
        group.entries
          .filter((entry) => entry.id === id)
          .map((entry) => ({
            version: version.label,
            domain: domain.title,
            group: group.title,
            title: entry.title,
            description: entry.description
          }))
      )
    )
  );
}
