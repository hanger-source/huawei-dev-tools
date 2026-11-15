import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { cacheRoot } from "./cache.js";
import { DOC_BASE } from "./constants.js";
import { parseHuaweiDocumentUrl, splitDocumentId } from "./sources.js";
import type { CatalogNode, CatalogTree, NavigationAddress } from "./types.js";

export interface MarkdownLibraryCatalogSource {
  tree: CatalogTree;
  navigation: NavigationAddress;
}

export interface MarkdownLibraryDocument {
  id: string;
  catalogId: string;
  documentId: string;
  sourcePath: string;
  outputPath: string;
  bytes: number;
}

export interface MarkdownLibraryCatalogResult {
  id: string;
  title: string;
  localDocuments: number;
  catalogDocuments: number;
  indexPath: string;
}

export interface MarkdownLibraryResult {
  root: string;
  indexPath: string;
  documents: MarkdownLibraryDocument[];
  catalogs: MarkdownLibraryCatalogResult[];
}

export function markdownLibraryRoot(): string {
  return (
    process.env.HUAWEI_DOCS_LIBRARY_DIR ||
    fileURLToPath(new URL("../docs/huawei-docs/", import.meta.url))
  );
}

function ensureSafeFileName(value: string, label: string): void {
  if (!value || value === "." || value === ".." || /[\\/\0]/.test(value)) {
    throw new Error(`${label} 不能作为 Markdown 文件名：${value}`);
  }
}

export async function listCachedCatalogIds(): Promise<string[]> {
  const documentsRoot = join(cacheRoot(), "documents");
  let entries;
  try {
    entries = await readdir(documentsRoot, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function listCachedDocuments(catalogId: string): Promise<MarkdownLibraryDocument[]> {
  ensureSafeFileName(catalogId, "catalog ID");
  const sourceRoot = join(cacheRoot(), "documents", catalogId);
  const files: string[] = [];
  async function visit(directory: string, prefix = "") {
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name === "api") await visit(join(directory, entry.name), "api/");
      if (entry.isFile() && entry.name.endsWith(".md")) files.push(`${prefix}${entry.name}`);
    }
  }
  await visit(sourceRoot);
  return files.map((file) => {
      const documentId = file.slice(0, -3);
      splitDocumentId(`${catalogId}/${documentId}`);
      const outputPath = join(markdownLibraryRoot(), catalogId, `${documentId}.md`);
      return {
        id: `${catalogId}/${documentId}`,
        catalogId,
        documentId,
        sourcePath: join(sourceRoot, file),
        outputPath,
        bytes: 0
      };
    })
    .sort((left, right) => left.documentId.localeCompare(right.documentId));
}

export function rewriteOfficialDocumentLinks(
  markdown: string,
  currentOutputPath: string,
  localPaths: ReadonlyMap<string, string>
): string {
  const pattern = /\[([^\]]+)]\((https:\/\/developer\.huawei\.com\/consumer\/cn\/doc\/[^)\s]+)\)/g;
  return markdown.replace(pattern, (whole, label: string, rawUrl: string) => {
    let identity;
    let anchor = "";
    try {
      const parsed = new URL(rawUrl);
      anchor = parsed.hash;
      identity = parseHuaweiDocumentUrl(parsed.toString());
    } catch {
      return whole;
    }
    const target = localPaths.get(identity.id);
    if (!target) return whole;
    const local = relative(dirname(currentOutputPath), target).replaceAll("\\", "/");
    return `[${label}](${local}${anchor})`;
  });
}

function cleanTitle(value: string): string {
  return value.replace(/[\r\n]+/g, " ").replace(/([\[\]])/g, "\\$1").trim();
}

function flattenDocumentIds(node: CatalogNode): Array<string | null> {
  return [node.relateDocument || null, ...(node.children || []).flatMap(flattenDocumentIds)];
}

function renderCatalogNode(
  catalogId: string,
  node: CatalogNode,
  depth: number,
  localIds: ReadonlySet<string>
): string[] {
  const indent = "  ".repeat(depth);
  const title = cleanTitle(node.nodeName) || "未命名节点";
  const documentId = node.relateDocument || null;
  const id = documentId ? `${catalogId}/${documentId}` : null;
  let item = `${indent}- ${title}`;
  if (id && documentId) {
    const href = localIds.has(id)
      ? `${documentId}.md`
      : `${DOC_BASE}${catalogId}/${documentId}`;
    item = `${indent}- [${title}](${href})${localIds.has(id) ? "" : "（官网）"}`;
  }
  return [
    item,
    ...(node.children || []).flatMap((child) => renderCatalogNode(catalogId, child, depth + 1, localIds))
  ];
}

function renderCatalogIndex(
  source: MarkdownLibraryCatalogSource,
  localDocuments: MarkdownLibraryDocument[],
  localIds: ReadonlySet<string>
): { markdown: string; catalogDocuments: number } {
  const catalogId = source.tree.catalogName;
  const treeLines = source.tree.catalogTreeList.flatMap((node) =>
    renderCatalogNode(catalogId, node, 0, localIds)
  );
  const catalogDocuments = new Set(
    source.tree.catalogTreeList
      .flatMap((node) => flattenDocumentIds(node))
      .filter((value): value is string => Boolean(value))
  ).size;
  const navigation = source.navigation.navigationAddress
    ? `https://developer.huawei.com/consumer/cn/doc${source.navigation.navigationAddress}`
    : DOC_BASE;
  const markdown = [
    `# ${cleanTitle(source.tree.title || catalogId)}`,
    "",
    `> 华为官方目录：[在线入口](${navigation}) · 本地 Markdown：${localDocuments.length} 篇 · 目录文档：${catalogDocuments} 篇`,
    "",
    "未抓取的条目仍指向官网，并标记“官网”；抓取后重新执行 `huawei-docs library build`，链接会自动切换成本地 Markdown。",
    "",
    "## 官方目录",
    "",
    ...treeLines,
    ""
  ].join("\n");
  return { markdown, catalogDocuments };
}

function renderRootIndex(catalogs: MarkdownLibraryCatalogResult[], documentCount: number): string {
  return [
    "# 华为 HarmonyOS 开发文档本地库",
    "",
    `这里是可直接阅读和跳转的 Markdown 文档，共 ${documentCount} 篇。工具内部的搜索索引和接口响应保存在 \`data/huawei-docs\`，不属于阅读入口。`,
    "",
    "## 目录",
    "",
    ...catalogs.map(
      (catalog) =>
        `- [${cleanTitle(catalog.title)}](${catalog.id}/README.md)：本地 ${catalog.localDocuments} / 官方目录 ${catalog.catalogDocuments} 篇`
    ),
    ""
  ].join("\n");
}

export async function buildMarkdownLibrary(
  sources: MarkdownLibraryCatalogSource[]
): Promise<MarkdownLibraryResult> {
  if (sources.length === 0) throw new Error("没有已抓取的 catalog，无法生成 Markdown 文档库");
  const catalogIds = sources.map((source) => source.tree.catalogName);
  const documents = (await Promise.all(catalogIds.map(listCachedDocuments))).flat();
  const localPaths = new Map(documents.map((document) => [document.id, document.outputPath]));
  const localIds = new Set(localPaths.keys());

  await mkdir(markdownLibraryRoot(), { recursive: true });
  for (const document of documents) {
    const raw = await readFile(document.sourcePath, "utf8");
    const body = rewriteOfficialDocumentLinks(raw, document.outputPath, localPaths).trimEnd();
    const sourceUrl = `${DOC_BASE}${document.id}`;
    const rendered = [
      "<!-- 由 huawei-docs 从华为官方 Markdown 生成；请勿直接编辑。 -->",
      "",
      `[← ${document.catalogId} 目录](${relative(dirname(document.outputPath), join(markdownLibraryRoot(), document.catalogId, "README.md"))}) · [官方原文](${sourceUrl})`,
      "",
      body,
      ""
    ].join("\n");
    await mkdir(dirname(document.outputPath), { recursive: true });
    await writeFile(document.outputPath, rendered, "utf8");
    document.bytes = Buffer.byteLength(rendered);
  }

  const catalogs: MarkdownLibraryCatalogResult[] = [];
  for (const source of sources) {
    const id = source.tree.catalogName;
    const localDocuments = documents.filter((document) => document.catalogId === id);
    const rendered = renderCatalogIndex(source, localDocuments, localIds);
    const indexPath = join(markdownLibraryRoot(), id, "README.md");
    await mkdir(dirname(indexPath), { recursive: true });
    await writeFile(indexPath, rendered.markdown, "utf8");
    catalogs.push({
      id,
      title: source.tree.title || id,
      localDocuments: localDocuments.length,
      catalogDocuments: rendered.catalogDocuments,
      indexPath
    });
  }
  catalogs.sort((left, right) => left.title.localeCompare(right.title, "zh-CN"));

  const indexPath = join(markdownLibraryRoot(), "README.md");
  await writeFile(indexPath, renderRootIndex(catalogs, documents.length), "utf8");
  return { root: markdownLibraryRoot(), indexPath, documents, catalogs };
}
