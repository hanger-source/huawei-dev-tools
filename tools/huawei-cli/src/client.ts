import { createHash } from "node:crypto";
import { CENTER_ENDPOINT, centerDocumentInfo, centerTrees, fetchCenterIndex } from "./doc-center.js";
import {
  getCacheStatus,
  isCached,
  readThroughJson,
  readThroughText
} from "./cache.js";
import {
  DOC_BASE,
  DOC_ORIGIN,
  DOC_PORTAL_URL,
  DOCUMENT_ENDPOINTS,
  DOCUMENT_PORTAL_ENDPOINT,
  SEARCH_CATEGORY_LIST,
  SEARCH_ENDPOINT,
  SEARCH_LABEL_ENDPOINTS
} from "./constants.js";
import { extractSection, normalizeSymbol, parseHeadings } from "./markdown.js";
import {
  findCatalogDocumentNode,
  findPortalDocumentPlacements,
  findSitemapDocumentsByBareId,
  parseHuaweiDocumentUrl,
  parsePortalHtml,
  splitDocumentId
} from "./sources.js";
import type {
  AnchorInfo,
  ApiResponse,
  CatalogTree,
  DocumentResolution,
  DocumentInfo,
  NavigationAddress,
  PortalSnapshot,
  RawSearchResponse,
  RawSearchResult,
  SearchFacetExclusion,
  SearchFacetLabel,
  SearchFacetResponse,
  SearchFacets,
  SearchRequest,
  SearchResult,
  DocumentIndex,
  SyncResult
} from "./types.js";

const DEFAULT_TIMEOUT_MS = 20_000;

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function fetchText(url: string, init: RequestInit = {}): Promise<string> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    headers: {
      accept: "text/markdown,text/plain,application/json;q=0.9,*/*;q=0.5",
      "user-agent": "huawei-docs/0.2 (+local research tool)",
      ...init.headers
    }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}: ${url}`);
  return await response.text();
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const text = await fetchText(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: DOC_ORIGIN,
      referer: DOC_BASE
    },
    body: JSON.stringify(body)
  });
  return JSON.parse(text) as T;
}

function apiValue<T>(response: ApiResponse<T>, operation: string): T {
  const code = String(response.code);
  if (code !== "0" && code !== "00000") {
    throw new Error(`${operation}失败：${response.message || `code=${code}`}`);
  }
  if (response.value === undefined) throw new Error(`${operation}响应缺少 value`);
  return response.value;
}

function apiResultList<T>(response: SearchFacetResponse<T>, operation: string): T[] {
  const code = String(response.code);
  if (code !== "0" && code !== "00000") {
    throw new Error(`${operation}失败：${response.message || `code=${code}`}`);
  }
  return response.resultList || [];
}

function stripMarkup(value = ""): string {
  return value
    .replace(/<\/?em>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAnchors(raw?: string): AnchorInfo[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is AnchorInfo =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as AnchorInfo).anchorId === "string" &&
        typeof (item as AnchorInfo).title === "string"
    );
  } catch {
    return [];
  }
}

export function documentIdFromUrl(input: string): string {
  return parseHuaweiDocumentUrl(input).id;
}

export function canonicalUrlFromId(input: string): string {
  if (/^https?:\/\//i.test(input)) return parseHuaweiDocumentUrl(input).url;
  return `${DOC_BASE}${splitDocumentId(input).id}`;
}

function mapSearchResult(raw: RawSearchResult, query: string): SearchResult | null {
  let identity: ReturnType<typeof parseHuaweiDocumentUrl>;
  try {
    identity = parseHuaweiDocumentUrl(raw.url);
  } catch {
    return null;
  }
  const anchors = parseAnchors(raw.metaData.ext?.anchorList);
  const normalizedQuery = normalizeSymbol(query);
  const matchedAnchors = anchors.filter((anchor) => {
    const title = normalizeSymbol(anchor.title);
    return title.includes(normalizedQuery) || normalizedQuery.includes(title);
  });
  const ext = raw.metaData.ext;
  const breadcrumb = [ext?.domain, ext?.catalogName, ext?.kitName, ...(ext?.nodeNames || [])]
    .filter((item): item is string => Boolean(item))
    .filter((item, index, values) => values.indexOf(item) === index);

  return {
    id: identity.id,
    catalogId: identity.catalogId,
    documentId: identity.documentId,
    objectId: raw.metaData.objectID,
    name: raw.name,
    url: identity.url,
    description: stripMarkup(raw.metaData.description),
    highlightedDescription: stripMarkup(raw.metaData.em_desc),
    language: ext?.docCodeLanguage || null,
    domain: ext?.domain || null,
    catalog: ext?.catalogName || null,
    kit: ext?.kitName || null,
    breadcrumb,
    updatedAt: ext?.updateTime || raw.metaData.timestamp || null,
    matchedAnchors,
    anchors
  };
}

export function findBestSearchAnchor(result: SearchResult, query: string): AnchorInfo | null {
  const normalizedQuery = normalizeSymbol(query);
  return (
    result.anchors.find((anchor) => normalizeSymbol(anchor.title) === normalizedQuery) ||
    result.matchedAnchors[0] ||
    null
  );
}

export interface SearchOptions {
  page?: number;
  limit?: number;
  language?: string;
  kind?: "all" | "api" | "guide";
  refresh?: boolean;
}

export interface SearchResponse {
  query: string;
  page: number;
  limit: number;
  total: number;
  returnedDocuments: number;
  discardedNonDocuments: number;
  results: SearchResult[];
  source: string;
  cached: boolean;
  cachePath: string;
}

export function buildSearchRequest(
  query: string,
  options: Pick<SearchOptions, "page" | "limit" | "language"> = {}
): SearchRequest {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(50, Math.max(1, options.limit || 15));
  return {
    keyWord: query,
    searchFilterParams: {
      language: options.language || "zh",
      categoryList: SEARCH_CATEGORY_LIST
    },
    pipelineParams: { whetherToCorrect: 1, whetherToSynonym: 1, scene: 0 },
    pageIndex: page,
    pageSize: limit
  };
}

export async function searchDocuments(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  if (!query.trim()) throw new Error("搜索词不能为空");
  const request = buildSearchRequest(query, options);
  const cacheKey = `${hash(JSON.stringify(request))}.json`;
  const response = await readThroughText(["search", cacheKey], Boolean(options.refresh), () =>
    fetchText(SEARCH_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: DOC_ORIGIN,
        referer: DOC_BASE
      },
      body: JSON.stringify(request)
    })
  );

  const raw = JSON.parse(response.value) as RawSearchResponse;
  if (raw.code !== 0) {
    throw new Error(`华为文档搜索失败：${raw.message || `code=${raw.code}`}`);
  }
  const rawResults = raw.resultList || [];
  const documentResults = rawResults
    .map((item) => mapSearchResult(item, query))
    .filter((item): item is SearchResult => item !== null);
  const { index } = await fetchCenterIndex();
  for (const item of documentResults) {
    const leaf = item.documentId.split("/").at(-1);
    const matches = index.documents.filter(doc => doc.documentId.split("/").at(-1) === leaf);
    if (matches.length > 1) throw new Error(`官方目录中同名文档有歧义：${leaf}；请通过 documents 指定完整 ID`);
    if (matches.length === 1) Object.assign(item, matches[0]);
  }
  let results = documentResults;
  if (options.kind === "api") results = results.filter((item) => item.catalog?.includes("API"));
  if (options.kind === "guide") results = results.filter((item) => item.catalog?.includes("指南"));

  return {
    query,
    page: request.pageIndex,
    limit: request.pageSize,
    total: raw.totalCount || 0,
    returnedDocuments: results.length,
    discardedNonDocuments: rawResults.length - documentResults.length,
    results,
    source: SEARCH_ENDPOINT,
    cached: response.cached,
    cachePath: response.path
  };
}

export async function fetchSearchFacets(
  options: { refresh?: boolean } = {}
): Promise<{ facets: SearchFacets; cached: boolean; path: string }> {
  const result = await readThroughJson(
    ["indexes", "search-facets.json"],
    Boolean(options.refresh),
    async () => {
      const [versions, contents, exclusions] = await Promise.all([
        postJson<SearchFacetResponse<SearchFacetLabel>>(SEARCH_LABEL_ENDPOINTS.versions, {}),
        postJson<SearchFacetResponse<SearchFacetLabel>>(SEARCH_LABEL_ENDPOINTS.contents, {}),
        postJson<SearchFacetResponse<SearchFacetExclusion>>(SEARCH_LABEL_ENDPOINTS.exclusions, {})
      ]);
      return {
        source: SEARCH_LABEL_ENDPOINTS,
        fetchedAt: new Date().toISOString(),
        versions: apiResultList(versions, "读取搜索版本标签"),
        contents: apiResultList(contents, "读取搜索内容标签"),
        exclusions: apiResultList(exclusions, "读取搜索排斥规则")
      } satisfies SearchFacets;
    }
  );
  return { facets: result.value, cached: result.cached, path: result.path };
}

export interface DocumentResponse {
  id: string;
  catalogId: string;
  documentId: string;
  url: string;
  markdownUrl: string;
  markdown: string;
  cached: boolean;
  path: string;
}

export async function fetchDocument(
  input: string,
  options: { refresh?: boolean } = {}
): Promise<DocumentResponse> {
  const url = canonicalUrlFromId(input);
  const identity = parseHuaweiDocumentUrl(url);
  const markdownUrl = `${url}.md`;
  const result = await readThroughText(
    ["documents", identity.catalogId, ...`${identity.documentId}.md`.split("/")],
    Boolean(options.refresh),
    () => fetchText(markdownUrl)
  );
  return {
    ...identity,
    markdownUrl,
    markdown: result.value,
    cached: result.cached,
    path: result.path
  };
}

export async function fetchPortal(
  options: { refresh?: boolean } = {}
): Promise<{ portal: PortalSnapshot; cached: boolean; path: string }> {
  const result = await readThroughJson(
    ["indexes", "portal.json"],
    Boolean(options.refresh),
    async () => parsePortalHtml(await fetchText(DOC_PORTAL_URL))
  );
  return { portal: result.value, cached: result.cached, path: result.path };
}

export async function fetchDocumentIndex(
  options: { refresh?: boolean } = {}
): Promise<{ index: DocumentIndex; cached: boolean; path: string }> {
  return fetchCenterIndex(options);
}

export function buildCatalogTreeRequest(catalogId: string): {
  language: "cn";
  catalogName: string;
  objectId: "x";
} {
  if (!catalogId.trim() || /[\\/\0]/.test(catalogId)) throw new Error(`非法 catalog：${catalogId}`);
  return { language: "cn", catalogName: catalogId, objectId: "x" };
}

export async function fetchCatalogTree(
  catalogId: string,
  options: { refresh?: boolean } = {}
): Promise<{ tree: CatalogTree; cached: boolean; path: string }> {
  if (catalogId.startsWith("doccenter-")) {
    const result = await centerTrees(options);
    const tree = result.trees.find(item => item.catalogName === catalogId);
    if (!tree) throw new Error(`官方目录不存在：${catalogId}`);
    return { tree, cached: result.cached, path: result.path };
  }
  const request = buildCatalogTreeRequest(catalogId);
  const result = await readThroughJson(
    ["catalogs", `${catalogId}.json`],
    Boolean(options.refresh),
    async () =>
      apiValue(
        await postJson<ApiResponse<CatalogTree>>(DOCUMENT_ENDPOINTS.catalogTree, request),
        `读取目录 ${catalogId}`
      )
  );
  return { tree: result.value, cached: result.cached, path: result.path };
}

export function buildDocumentInfoRequest(input: string): {
  objectId: string;
  version: "";
  catalogName: string;
  language: "cn";
} {
  const identity = splitDocumentId(input);
  return {
    objectId: identity.documentId,
    version: "",
    catalogName: identity.catalogId,
    language: "cn"
  };
}

export async function fetchDocumentInfo(
  input: string,
  options: { refresh?: boolean } = {}
): Promise<{ info: DocumentInfo; cached: boolean; path: string }> {
  if (input.startsWith("doccenter-")) return centerDocumentInfo(input, options);
  const identity = splitDocumentId(input);
  const request = buildDocumentInfoRequest(identity.id);
  const result = await readThroughJson(
    ["metadata", identity.catalogId, `${identity.documentId}.json`],
    Boolean(options.refresh),
    async () =>
      apiValue(
        await postJson<ApiResponse<DocumentInfo>>(DOCUMENT_ENDPOINTS.documentById, request),
        `读取文档详情 ${identity.id}`
      )
  );
  return { info: result.value, cached: result.cached, path: result.path };
}

export function buildNavigationRequest(catalogId: string): {
  catalogName: string;
  lang: "cn";
} {
  if (!catalogId.trim() || /[\\/\0]/.test(catalogId)) throw new Error(`非法 catalog：${catalogId}`);
  return { catalogName: catalogId, lang: "cn" };
}

export async function fetchNavigationAddress(
  catalogId: string,
  options: { refresh?: boolean } = {}
): Promise<{ navigation: NavigationAddress; cached: boolean; path: string }> {
  if (catalogId.startsWith("doccenter-")) {
    const result = await fetchCatalogTree(catalogId, options);
    return { navigation: { catalogName: catalogId, navigationAddress: `/${catalogId}` }, cached: result.cached, path: result.path };
  }
  const request = buildNavigationRequest(catalogId);
  const result = await readThroughJson(
    ["navigation", `${catalogId}.json`],
    Boolean(options.refresh),
    async () =>
      apiValue(
        await postJson<ApiResponse<NavigationAddress>>(DOCUMENT_ENDPOINTS.navigationAddress, request),
        `读取导航地址 ${catalogId}`
      )
  );
  return { navigation: result.value, cached: result.cached, path: result.path };
}

export async function resolveDocument(
  input: string,
  options: { refresh?: boolean } = {}
): Promise<DocumentResolution> {
  if (/^https?:\/\//i.test(input)) {
    const identity = parseHuaweiDocumentUrl(input);
    return {
      id: identity.id,
      url: identity.url,
      via: "url",
      query: null,
      name: null,
      breadcrumb: [],
      matchedAnchor: null
    };
  }
  if (input.includes("/")) {
    const identity = splitDocumentId(input);
    return {
      id: identity.id,
      url: `${DOC_BASE}${identity.id}`,
      via: "id",
      query: null,
      name: null,
      breadcrumb: [],
      matchedAnchor: null
    };
  }

  if (/^[A-Za-z0-9._-]+$/.test(input)) {
    const { index } = await fetchDocumentIndex({ refresh: options.refresh });
    const matches = findSitemapDocumentsByBareId(index, input);
    if (matches.length === 1) {
      const selected = matches[0];
      return {
        id: selected.id,
        url: selected.url,
        via: "index-id",
        query: null,
        name: null,
        breadcrumb: [],
        matchedAnchor: null
      };
    }
    if (matches.length > 1) {
      throw new Error(
        `裸文档 ID 存在多个 catalog，请改用完整 ID：${matches.map((item) => item.id).join(", ")}`
      );
    }
  }

  const result = await searchDocuments(input, { limit: 10, refresh: options.refresh });
  const exact = result.results.find(
    (item) =>
      item.documentId === input ||
      item.name.toLowerCase() === input.toLowerCase() ||
      item.matchedAnchors.some((anchor) => normalizeSymbol(anchor.title) === normalizeSymbol(input))
  );
  const selected = exact || result.results[0];
  if (!selected) throw new Error(`没有找到文档或符号：${input}`);
  return {
    id: selected.id,
    url: selected.url,
    via: "search",
    query: input,
    name: selected.name,
    breadcrumb: selected.breadcrumb,
    matchedAnchor: findBestSearchAnchor(selected, input)
  };
}

export async function fetchDocumentContext(
  input: string,
  options: { refresh?: boolean; anchor?: string; maxHeadings?: number; includeContent?: boolean } = {}
): Promise<Record<string, unknown>> {
  const resolved = await resolveDocument(input, { refresh: options.refresh });
  const identity = splitDocumentId(resolved.id);
  const [portal, index, catalog, navigation, detail, document] = await Promise.all([
    fetchPortal({ refresh: options.refresh }),
    fetchDocumentIndex({ refresh: options.refresh }),
    fetchCatalogTree(identity.catalogId, { refresh: options.refresh }),
    fetchNavigationAddress(identity.catalogId, { refresh: options.refresh }),
    fetchDocumentInfo(identity.id, { refresh: options.refresh }),
    fetchDocument(identity.id, { refresh: options.refresh })
  ]);

  const catalogNode = findCatalogDocumentNode(
    identity.catalogId,
    catalog.tree.catalogTreeList,
    identity.documentId
  );
  const indexDocument =
    index.index.documents.find((item) => item.id === identity.id) || null;
  const portalPlacements = findPortalDocumentPlacements(portal.portal, identity.id);
  const headings = parseHeadings(document.markdown).slice(0, options.maxHeadings || 80);
  const requestedAnchor = options.anchor || resolved.matchedAnchor?.anchorId || null;
  const extracted = requestedAnchor ? extractSection(document.markdown, requestedAnchor) : null;
  if (options.anchor && !extracted) {
    throw new Error(`文档中没有找到锚点或函数：${options.anchor}`);
  }
  const { content, ...metadata } = detail.info;

  return {
    input,
    resolution: resolved,
    document: {
      id: identity.id,
      url: resolved.url,
      markdownUrl: document.markdownUrl,
      title: detail.info.title,
      metadata,
      contentChars: content?.content?.length || 0
    },
    discovery: {
      portalPlacements,
      index: indexDocument
    },
    catalog: {
      id: catalog.tree.catalogName,
      title: catalog.tree.title,
      domain: catalog.tree.domain || null,
      tag: catalog.tree.tag || null,
      versionLabelList: catalog.tree.versionLabelList || [],
      navigationAddress: navigation.navigation.navigationAddress,
      node: catalogNode
    },
    markdown: {
      headings,
      totalHeadings: parseHeadings(document.markdown).length,
      totalChars: document.markdown.length,
      path: document.path,
      cached: document.cached
    },
    section: extracted
      ? {
          ...extracted,
          content: options.includeContent ? extracted.content : undefined,
          contentChars: extracted.content.length
        }
      : null,
    cache: {
      portal: portal.cached,
      index: index.cached,
      catalog: catalog.cached,
      navigation: navigation.cached,
      detail: detail.cached,
      markdown: document.cached
    },
    sources: {
      portal: portal.portal.source,
      index: index.index.source,
      catalogTree: identity.catalogId.startsWith("doccenter-") ? CENTER_ENDPOINT : DOCUMENT_ENDPOINTS.catalogTree,
      navigation: identity.catalogId.startsWith("doccenter-") ? CENTER_ENDPOINT : DOCUMENT_ENDPOINTS.navigationAddress,
      detail: identity.catalogId.startsWith("doccenter-") ? `${DOCUMENT_PORTAL_ENDPOINT}/getCenterDocument` : DOCUMENT_ENDPOINTS.documentById,
      markdown: document.markdownUrl,
      search: resolved.via === "search" ? SEARCH_ENDPOINT : null
    }
  };
}

export async function syncCatalogDocuments(
  catalogId: string,
  options: { limit?: number; concurrency?: number; refresh?: boolean } = {}
): Promise<SyncResult> {
  const index = await fetchDocumentIndex({ refresh: options.refresh });
  const all = index.index.documents.filter((document) => document.catalogId === catalogId);
  if (all.length === 0) throw new Error(`index 中没有 catalog：${catalogId}`);
  const selected = options.limit === undefined ? all : all.slice(0, Math.max(0, options.limit));
  const concurrency = Math.min(16, Math.max(1, options.concurrency || 4));
  const documents: SyncResult["documents"] = [];
  const failed: SyncResult["failed"] = [];
  let cursor = 0;

  const worker = async () => {
    while (cursor < selected.length) {
      const current = selected[cursor];
      cursor += 1;
      try {
        const document = await fetchDocument(current.id, { refresh: options.refresh });
        documents.push({
          id: document.id,
          path: document.path,
          cached: document.cached,
          bytes: Buffer.byteLength(document.markdown)
        });
      } catch (error) {
        failed.push({
          id: current.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, selected.length) }, () => worker()));
  documents.sort((left, right) => left.id.localeCompare(right.id));

  return {
    catalogId,
    requested: selected.length,
    downloaded: documents.filter((document) => !document.cached).length,
    reused: documents.filter((document) => document.cached).length,
    failed,
    documents
  };
}

export async function documentCacheStatus(input: string): Promise<boolean> {
  const identity = splitDocumentId(input);
  return await isCached("documents", identity.catalogId, ...`${identity.documentId}.md`.split("/"));
}

export async function rawGet(
  target: string
): Promise<{ url: string; contentType: string; body: string }> {
  const url = new URL(target, DOC_BASE);
  if (url.hostname !== "developer.huawei.com" && url.hostname !== "svc-drcn.developer.huawei.com") {
    throw new Error("request get 仅允许访问华为开发文档域名");
  }
  const response = await fetch(url, {
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    headers: { "user-agent": "huawei-docs/0.2 (+local research tool)" }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}: ${url}`);
  return {
    url: url.toString(),
    contentType: response.headers.get("content-type") || "",
    body: await response.text()
  };
}

export { getCacheStatus };
