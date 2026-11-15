import { DOC_BASE, DOCUMENT_PORTAL_ENDPOINT } from "./constants.js";
import { readThroughJson } from "./cache.js";
import type { CatalogNode, CatalogTree, DocumentInfo, DocumentIndex } from "./types.js";
import { flattenCatalogTree, splitDocumentId } from "./sources.js";

export const CENTER_ENDPOINT = `${DOCUMENT_PORTAL_ENDPOINT}/getCenterFullCatalogTree`;
interface CenterNode {
  nodeName: string;
  nodeAlias?: string;
  hasApi?: number;
  children?: CenterNode[];
  catalogTreeList?: CatalogNode[];
}
interface CenterCatalog { centerNodeList: CenterNode[]; fetchedAt: string }

async function post<T>(operation: string, body: unknown): Promise<T> {
  const response = await fetch(`${DOCUMENT_PORTAL_ENDPOINT}/${operation}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`${operation}: HTTP ${response.status}`);
  const result = await response.json() as { code: number | string; message?: string; value?: T };
  if (String(result.code) !== "0" || !result.value) throw new Error(`${operation}: ${result.message || result.code}`);
  return result.value;
}

export async function fetchCenter(options: { refresh?: boolean } = {}) {
  return readThroughJson<CenterCatalog>(["indexes", "doc-center.json"], Boolean(options.refresh), async () => ({
    ...await post<CenterCatalog>("getCenterFullCatalogTree", { centerPrefix: "doccenter", language: "cn" }),
    fetchedAt: new Date().toISOString()
  }));
}

export async function centerTrees(options: { refresh?: boolean } = {}) {
  const result = await fetchCenter(options);
  const trees: CatalogTree[] = result.value.centerNodeList.flatMap(root => (root.children || []).map(node => {
    if (!node.nodeAlias || !node.catalogTreeList) throw new Error(`官方目录缺少别名或目录树：${node.nodeName}`);
    const api = node.hasApi === 1;
    const qualify = (item: CatalogNode): CatalogNode => ({ ...item,
      relateDocument: item.relateDocument ? `${api ? "api/" : ""}${item.relateDocument}` : undefined,
      children: item.children?.map(qualify)
    });
    return { catalogName: `doccenter-${node.nodeAlias}`, title: `${root.nodeName} / ${node.nodeName}`,
      catalogTreeList: node.catalogTreeList.map(qualify) };
  }));
  return { trees, cached: result.cached, path: result.path, fetchedAt: result.value.fetchedAt };
}

export async function fetchCenterIndex(options: { refresh?: boolean } = {}) {
  const { trees, cached, path, fetchedAt } = await centerTrees(options);
  const documents = trees.flatMap(tree => flattenCatalogTree(tree.catalogName, tree.catalogTreeList)
    .filter(node => node.id).map(node => {
      const identity = splitDocumentId(node.id!);
      return { ...identity, url: `${DOC_BASE}${identity.id}`, lastModified: null };
    }));
  const unique = [...new Map(documents.map(doc => [doc.id, doc])).values()];
  const index: DocumentIndex = { source: CENTER_ENDPOINT, fetchedAt,
    documentCount: unique.length, documents: unique,
    catalogs: trees.map(tree => ({ id: tree.catalogName,
      documentCount: unique.filter(doc => doc.catalogId === tree.catalogName).length,
      firstDocumentId: unique.find(doc => doc.catalogId === tree.catalogName)?.documentId || null,
      lastModified: null })) };
  return { index, cached, path };
}

export async function centerDocumentInfo(input: string, options: { refresh?: boolean } = {}) {
  const identity = splitDocumentId(input);
  if (!identity.catalogId.startsWith("doccenter-")) throw new Error(`请使用官网当前 doccenter 文档 ID：${input}；可通过 search 或 documents 发现`);
  const result = await readThroughJson<DocumentInfo>(["metadata", identity.catalogId, ...`${identity.documentId}.json`.split("/")],
    Boolean(options.refresh), async () => {
      const info = await post<DocumentInfo>("getCenterDocument", { centerPrefix: "doccenter", language: "cn",
        level2NodeAlias: identity.catalogId.slice("doccenter-".length),
        isApi: identity.documentId.startsWith("api/") ? 1 : 0,
        fileName: identity.documentId.split("/").at(-1) });
      return { ...info, catalogName: identity.catalogId };
    });
  return { info: result.value, cached: result.cached, path: result.path };
}
