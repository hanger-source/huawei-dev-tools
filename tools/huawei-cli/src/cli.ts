#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve as resolvePath } from "node:path";
import { CENTER_ENDPOINT } from "./doc-center.js";
import { Command, Option } from "commander";
import {
  fetchCatalogTree,
  fetchDocument,
  fetchDocumentContext,
  fetchDocumentInfo,
  fetchNavigationAddress,
  fetchPortal,
  fetchSearchFacets,
  fetchDocumentIndex,
  getCacheStatus,
  rawGet,
  resolveDocument,
  searchDocuments,
  syncCatalogDocuments
} from "./client.js";
import {
  DOCUMENT_ENDPOINTS,
  DOC_PORTAL_URL,

  getVersionProfile,
  SEARCH_ENDPOINT,
  SEARCH_LABEL_ENDPOINTS,
  VERSION_PROFILES
} from "./constants.js";
import {
  evaluateCompatibility,
  extractHuaweiDocLinks,
  extractSection,
  normalizeSymbol,
  parseHeadings,
  parseSectionMetadata
} from "./markdown.js";
import { printError, printResult } from "./output.js";
import { flattenCatalogTree } from "./sources.js";
import { buildMarkdownLibrary, listCachedCatalogIds } from "./library.js";
import type { SearchResult } from "./types.js";

const program = new Command();

program
  .name("huawei-docs")
  .description("提取、索引、搜索和读取华为 HarmonyOS 官方开发文档；统一门户、官方目录、目录、详情和 Markdown。")
  .version("0.5.0", "-V, --cli-version", "输出 huawei-docs 自身版本")
  .option("--json", "输出稳定 JSON envelope")
  .option("--refresh", "显式刷新远端数据；默认永久复用本地已有内容");

function globalOptions(): { json: boolean; refresh: boolean } {
  const opts = program.opts<{ json?: boolean; refresh?: boolean }>();
  return { json: Boolean(opts.json), refresh: Boolean(opts.refresh) };
}

function compact(text: string, max = 220): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function integerOption(value: string, name: string, min: number, max?: number): number {
  if (!/^\d+$/.test(value)) throw new Error(`${name} 必须是整数：${value}`);
  const parsed = Number.parseInt(value, 10);
  if (parsed < min || (max !== undefined && parsed > max)) {
    throw new Error(`${name} 必须在 ${min}-${max ?? "∞"} 之间：${value}`);
  }
  return parsed;
}

function searchResultHuman(result: SearchResult, index: number): string {
  const anchor = result.matchedAnchors[0];
  const lines = [
    `${index + 1}. ${result.name}${anchor ? `  #${anchor.title}` : ""}`,
    `   id: ${result.id}`,
    `   目录: ${result.breadcrumb.join(" > ") || "未知"}`
  ];
  if (result.language) lines.push(`   语言: ${result.language}`);
  const description = result.highlightedDescription || result.description;
  if (description) lines.push(`   摘要: ${compact(description)}`);
  return lines.join("\n");
}

async function materializeCachedMarkdownLibrary() {
  const current = await fetchDocumentIndex();
  const catalogIds = (await listCachedCatalogIds()).filter(id => current.index.catalogs.some(catalog => catalog.id === id));
  if (catalogIds.length === 0) throw new Error("还没有抓取任何 Markdown 正文");
  const sources = await Promise.all(
    catalogIds.map(async (catalogId) => {
      const [tree, navigation] = await Promise.all([
        fetchCatalogTree(catalogId),
        fetchNavigationAddress(catalogId)
      ]);
      return { tree: tree.tree, navigation: navigation.navigation };
    })
  );
  return await buildMarkdownLibrary(sources);
}

program
  .command("doctor")
  .description("实时检查官方目录、搜索、详情和 Markdown；可显式只检查缓存")
  .option("--cached", "复用缓存；此结果不证明远端当前可用")
  .action(async (options: { cached?: boolean }) => {
    const global = globalOptions();
    global.refresh = !options.cached || global.refresh;
    const started = Date.now();
    const checks: Record<string, unknown> = {
      authRequired: false,
      endpoints: {
        portal: DOC_PORTAL_URL,
        index: CENTER_ENDPOINT,
        search: SEARCH_ENDPOINT,
        searchLabels: SEARCH_LABEL_ENDPOINTS,
        ...DOCUMENT_ENDPOINTS
      },
      cache: await getCacheStatus(),
      profiles: Object.values(VERSION_PROFILES)
    };
    try {
      const [portal, index, catalog, navigation, facets] = await Promise.all([
        fetchPortal({ refresh: global.refresh }),
        fetchDocumentIndex({ refresh: global.refresh }),
        fetchCatalogTree("doccenter-references", { refresh: global.refresh }),
        fetchNavigationAddress("doccenter-references", { refresh: global.refresh }),
        fetchSearchFacets({ refresh: global.refresh })
      ]);
      checks.portal = {
        ok: true,
        entries: portal.portal.entryCount,
        cached: portal.cached
      };
      checks.index = {
        ok: true,
        documents: index.index.documentCount,
        catalogs: index.index.catalogs.length,
        cached: index.cached
      };
      checks.catalog = {
        ok: true,
        id: catalog.tree.catalogName,
        roots: catalog.tree.catalogTreeList.length,
        cached: catalog.cached
      };
      checks.navigation = { ok: true, ...navigation.navigation, cached: navigation.cached };
      checks.searchFacets = {
        ok: true,
        versions: facets.facets.versions.length,
        contents: facets.facets.contents.length,
        exclusions: facets.facets.exclusions.length,
        cached: facets.cached
      };
      const search = await searchDocuments("OH_Input_InjectTouchEvent", {
        limit: 1,
        refresh: global.refresh
      });
      checks.search = { ok: true, total: search.total, cached: search.cached };
      const first = search.results[0];
      if (!first) throw new Error("搜索接口返回空结果");
      const [document, info] = await Promise.all([
        fetchDocument(first.id, { refresh: global.refresh }),
        fetchDocumentInfo(first.id, { refresh: global.refresh })
      ]);
      checks.markdown = {
        ok: true,
        id: document.id,
        bytes: Buffer.byteLength(document.markdown),
        cached: document.cached
      };
      checks.documentInfo = {
        ok: true,
        id: first.id,
        anchors: info.info.anchorList.length,
        cached: info.cached
      };
      checks.cache = await getCacheStatus();
      printResult(
        { healthy: true, mode: global.refresh ? "live" : "cached", elapsedMs: Date.now() - started, checks },
        {
          json: global.json,
          human: () =>
            [
              global.refresh ? "huawei-docs 在线检查通过" : "huawei-docs 缓存检查通过（未验证远端）",
              `门户：正常（${portal.portal.entryCount} 个精选入口）`,
              `全量索引：正常（${index.index.documentCount} 篇 / ${index.index.catalogs.length} 个 catalog）`,
              `目录树：正常（${catalog.tree.title} / ${catalog.tree.catalogTreeList.length} 个根节点）`,
              `搜索筛选：正常（${facets.facets.versions.length} 个版本标签 / ${facets.facets.contents.length} 个内容标签）`,
              `搜索：正常（${search.total} 条匹配）`,
              `详情：正常（${info.info.anchorList.length} 个锚点）`,
              `Markdown：正常（${Buffer.byteLength(document.markdown)} bytes）`,
              `认证：不需要`,
              `本地库：${(checks.cache as { path: string }).path}（默认永久复用，--refresh 才覆盖）`
            ].join("\n")
        }
      );
    } catch (error) {
      checks.failure = error instanceof Error ? error.message : String(error);
      printResult(
        { healthy: false, mode: global.refresh ? "live" : "cached", elapsedMs: Date.now() - started, checks },
        {
          json: global.json,
          human: () => `huawei-docs 检查失败：${String(checks.failure)}`
        }
      );
      process.exitCode = 1;
    }
  });

program
  .command("portal")
  .description("读取文档中心首页嵌入的官方 CMS 导航：版本、领域、分组和精选入口")
  .option("--contains <text>", "只保留标题、说明或 URL 包含关键词的入口")
  .action(async (options: { contains?: string }) => {
    const global = globalOptions();
    const result = await fetchPortal({ refresh: global.refresh });
    const query = options.contains?.trim().toLowerCase();
    const versions = result.portal.versions
      .map((version) => ({
        ...version,
        domains: version.domains
          .map((domain) => ({
            ...domain,
            groups: domain.groups
              .map((group) => ({
                ...group,
                entries: query
                  ? group.entries.filter((entry) =>
                      [entry.title, entry.description, entry.url]
                        .join("\n")
                        .toLowerCase()
                        .includes(query)
                    )
                  : group.entries
              }))
              .filter((group) => group.entries.length > 0)
          }))
          .filter((domain) => domain.groups.length > 0)
      }))
      .filter((version) => version.domains.length > 0);
    const entryCount = versions.reduce(
      (total, version) =>
        total +
        version.domains.reduce(
          (domainTotal, domain) =>
            domainTotal + domain.groups.reduce((groupTotal, group) => groupTotal + group.entries.length, 0),
          0
        ),
      0
    );
    const data = { ...result.portal, versions, entryCount, cached: result.cached, path: result.path };
    printResult(data, {
      json: global.json,
      human: () =>
        [
          `${data.title}（${entryCount} 个入口${result.cached ? "，本地" : "，刚抓取"}）`,
          data.description,
          "",
          ...versions.flatMap((version) => [
            `# ${version.label}`,
            ...version.domains.flatMap((domain) => [
              `## ${domain.title}`,
              ...domain.groups.flatMap((group) => [
                `### ${group.title}`,
                ...group.entries.map(
                  (entry) => `- ${entry.title}${entry.id ? `\n  id: ${entry.id}` : `\n  url: ${entry.url}`}`
                )
              ])
            ])
          ])
        ].join("\n")
    });
  });

program
  .command("catalogs")
  .description("从华为官方文档中心索引 列出全部文档 catalog 及文档数量")
  .option("--contains <text>", "按 catalog 名过滤")
  .option("--limit <number>", "最多返回多少个 catalog", "100")
  .action(async (options: { contains?: string; limit: string }) => {
    const global = globalOptions();
    const result = await fetchDocumentIndex({ refresh: global.refresh });
    const query = options.contains?.toLowerCase();
    const limit = integerOption(options.limit, "--limit", 1);
    const catalogs = result.index.catalogs
      .filter((catalog) => !query || catalog.id.toLowerCase().includes(query))
      .slice(0, limit);
    printResult(
      {
        source: result.index.source,
        fetchedAt: result.index.fetchedAt,
        documentCount: result.index.documentCount,
        totalCatalogs: result.index.catalogs.length,
        catalogs,
        cached: result.cached,
        path: result.path
      },
      {
        json: global.json,
        human: () =>
          [
            `官方文档中心索引：${result.index.documentCount} 篇 / ${result.index.catalogs.length} 个 catalog`,
            ...catalogs.map(
              (catalog) =>
                `${catalog.id}\t${catalog.documentCount} 篇${catalog.lastModified ? `\t更新 ${catalog.lastModified}` : ""}`
            )
          ].join("\n")
      }
    );
  });

program
  .command("documents")
  .description("从官方文档中心索引 分页列出一个 catalog 的全部稳定文档 ID；不依赖目录树接口")
  .argument("<catalog>", "catalog ID，例如 doccenter-references")
  .option("--contains <text>", "按文档 ID 或 URL 过滤")
  .option("--offset <number>", "跳过前多少篇", "0")
  .option("--limit <number>", "最多返回多少篇", "100")
  .action(
    async (
      catalogId: string,
      options: { contains?: string; offset: string; limit: string }
    ) => {
      const global = globalOptions();
      const result = await fetchDocumentIndex({ refresh: global.refresh });
      const query = options.contains?.trim().toLowerCase();
      const offset = integerOption(options.offset, "--offset", 0);
      const limit = integerOption(options.limit, "--limit", 1);
      const allDocuments = result.index.documents.filter(
        (document) =>
          document.catalogId === catalogId &&
          (!query || `${document.id}\n${document.url}`.toLowerCase().includes(query))
      );
      if (!result.index.catalogs.some((catalog) => catalog.id === catalogId)) {
        throw new Error(`index 中没有 catalog：${catalogId}`);
      }
      const documents = allDocuments.slice(offset, offset + limit);
      printResult(
        {
          catalogId,
          total: allDocuments.length,
          offset,
          limit,
          documents,
          cached: result.cached,
          path: result.path
        },
        {
          json: global.json,
          human: () =>
            [
              `${catalogId}：${allDocuments.length} 篇，当前 ${offset + 1}-${offset + documents.length}`,
              ...documents.map(
                (document) =>
                  `${document.id}${document.lastModified ? `\t更新 ${document.lastModified}` : ""}`
              )
            ].join("\n")
        }
      );
    }
  );

program
  .command("tree")
  .description("读取 documentPortal/getCatalogTree 的真实目录层级和 relateDocument")
  .argument("<catalog>", "catalog ID，例如 doccenter-references")
  .option("--contains <text>", "按节点路径或文档 ID 过滤")
  .option("--max-depth <number>", "最大目录深度", "99")
  .option("--limit <number>", "最多返回多少个节点", "300")
  .option("--documents-only", "只返回挂载了文档的节点")
  .action(
    async (
      catalogId: string,
      options: { contains?: string; maxDepth: string; limit: string; documentsOnly?: boolean }
    ) => {
      const global = globalOptions();
      const [catalog, navigation] = await Promise.all([
        fetchCatalogTree(catalogId, { refresh: global.refresh }),
        fetchNavigationAddress(catalogId, { refresh: global.refresh })
      ]);
      const query = options.contains?.toLowerCase();
      const maxDepth = integerOption(options.maxDepth, "--max-depth", 0);
      const limit = integerOption(options.limit, "--limit", 1);
      const allNodes = flattenCatalogTree(catalogId, catalog.tree.catalogTreeList);
      const nodes = allNodes
        .filter((node) => node.depth <= maxDepth)
        .filter((node) => !options.documentsOnly || Boolean(node.id))
        .filter(
          (node) =>
            !query ||
            node.path.join(" > ").toLowerCase().includes(query) ||
            Boolean(node.id?.toLowerCase().includes(query))
        )
        .slice(0, limit);
      const documentCount = new Set(allNodes.map((node) => node.id).filter(Boolean)).size;
      printResult(
        {
          catalog: {
            id: catalog.tree.catalogName,
            title: catalog.tree.title,
            tag: catalog.tree.tag,
            domain: catalog.tree.domain,
            versionLabelList: catalog.tree.versionLabelList,
            navigationAddress: navigation.navigation.navigationAddress
          },
          nodeCount: allNodes.length,
          documentCount,
          nodes,
          cached: catalog.cached && navigation.cached,
          paths: { tree: catalog.path, navigation: navigation.path }
        },
        {
          json: global.json,
          human: () =>
            [
              `${catalog.tree.title}（${allNodes.length} 个节点 / ${documentCount} 篇文档）`,
              `导航：${navigation.navigation.navigationAddress}`,
              ...nodes.map(
                (node) =>
                  `${"  ".repeat(node.depth)}- ${node.title}${node.id ? `\n${"  ".repeat(node.depth + 1)}id: ${node.id}` : ""}`
              )
            ].join("\n")
        }
      );
    }
  );

program
  .command("info")
  .description("读取 documentPortal/getDocumentById 的文档元数据、锚点、版本和设备标签")
  .argument("<id>", "文档 ID；也接受搜索词、函数名或 URL")
  .option("--include-html", "包含接口返回的原始 HTML 正文；默认省略以控制输出")
  .action(async (input: string, options: { includeHtml?: boolean }) => {
    const global = globalOptions();
    const resolved = await resolveDocument(input, { refresh: global.refresh });
    const result = await fetchDocumentInfo(resolved.id, { refresh: global.refresh });
    const { content, ...metadata } = result.info;
    const data = {
      id: resolved.id,
      url: resolved.url,
      ...metadata,
      content: options.includeHtml ? content : undefined,
      contentChars: content?.content?.length || 0,
      cached: result.cached,
      path: result.path
    };
    printResult(data, {
      json: global.json,
      human: () =>
        [
          `${result.info.title}`,
          `id: ${resolved.id}`,
          `catalog: ${result.info.catalogName}`,
          `业务：${result.info.businessName} / ${result.info.businessTypeName}`,
          `版本：${result.info.version || "未标注"}`,
          `设备标签：${result.info.deviceVersion || "未标注"}`,
          `锚点：${result.info.anchorList.length}`,
          ...result.info.anchorList.map((anchor) => `- ${anchor.title}  #${anchor.anchorId}`)
        ].join("\n")
    });
  });

const sync = program.command("sync").description("显式同步官方索引、目录或 Markdown；已有内容默认复用");
sync
  .command("index")
  .description("同步文档中心 CMS 导航、官方文档中心索引 和搜索筛选元数据")
  .action(async () => {
    const global = globalOptions();
    const [portal, index, facets] = await Promise.all([
      fetchPortal({ refresh: global.refresh }),
      fetchDocumentIndex({ refresh: global.refresh }),
      fetchSearchFacets({ refresh: global.refresh })
    ]);
    const data = {
      portal: { entries: portal.portal.entryCount, cached: portal.cached, path: portal.path },
      index: {
        documents: index.index.documentCount,
        catalogs: index.index.catalogs.length,
        cached: index.cached,
        path: index.path
      },
      searchFacets: {
        versions: facets.facets.versions.length,
        contents: facets.facets.contents.length,
        exclusions: facets.facets.exclusions.length,
        cached: facets.cached,
        path: facets.path
      }
    };
    printResult(data, {
      json: global.json,
      human: () =>
        [
          `门户：${data.portal.entries} 个入口（${data.portal.cached ? "复用" : "下载"}）`,
          `索引：${data.index.documents} 篇 / ${data.index.catalogs} 个 catalog（${data.index.cached ? "复用" : "下载"}）`,
          `搜索筛选：${data.searchFacets.versions} 个版本标签 / ${data.searchFacets.contents} 个内容标签 / ${data.searchFacets.exclusions} 条排斥规则（${data.searchFacets.cached ? "复用" : "下载"}）`
        ].join("\n")
    });
  });

sync
  .command("catalog")
  .description("同步一个 catalog 的目录、导航和 Markdown；默认最多 100 篇，--all 才同步全部")
  .argument("<catalog>", "catalog ID，例如 doccenter-references")
  .option("--limit <number>", "未指定 --all 时最多同步多少篇", "100")
  .option("--all", "同步该 catalog 在 index 中的全部文档")
  .option("--concurrency <number>", "并发下载数，1-16", "4")
  .action(
    async (
      catalogId: string,
      options: { limit: string; all?: boolean; concurrency: string }
    ) => {
      const global = globalOptions();
      const [tree, navigation, documents] = await Promise.all([
        fetchCatalogTree(catalogId, { refresh: global.refresh }),
        fetchNavigationAddress(catalogId, { refresh: global.refresh }),
        syncCatalogDocuments(catalogId, {
          limit: options.all ? undefined : integerOption(options.limit, "--limit", 1),
          concurrency: integerOption(options.concurrency, "--concurrency", 1, 16),
          refresh: global.refresh
        })
      ]);
      const library = await materializeCachedMarkdownLibrary();
      const data = {
        catalog: { id: catalogId, title: tree.tree.title, path: tree.path, cached: tree.cached },
        navigation: { ...navigation.navigation, path: navigation.path, cached: navigation.cached },
        documents,
        library: {
          root: library.root,
          indexPath: library.indexPath,
          documents: library.documents.length
        }
      };
      printResult(data, {
        json: global.json,
        human: () =>
          [
            `${tree.tree.title} / ${catalogId}`,
            `目录：${tree.cached ? "复用" : "下载"}`,
            `Markdown：请求 ${documents.requested}，下载 ${documents.downloaded}，复用 ${documents.reused}，失败 ${documents.failed.length}`,
            `阅读库：${library.indexPath}（${library.documents.length} 篇纯 Markdown）`,
            ...documents.failed.map((failure) => `- ${failure.id}: ${failure.error}`)
          ].join("\n")
      });
      if (documents.failed.length > 0) process.exitCode = 1;
    }
  );

const library = program.command("library").description("生成项目内可直接阅读和跳转的纯 Markdown 文档库");

library
  .command("build")
  .description("把已抓取正文按官方 catalog 物化到 docs/huawei-docs，并生成目录和本地链接")
  .action(async () => {
    const global = globalOptions();
    const result = await materializeCachedMarkdownLibrary();
    printResult(result, {
      json: global.json,
      human: () =>
        [
          `Markdown 文档库：${result.indexPath}`,
          `正文：${result.documents.length} 篇`,
          ...result.catalogs.map(
            (catalog) =>
              `- ${catalog.title}：本地 ${catalog.localDocuments} / 官方目录 ${catalog.catalogDocuments} 篇`
          )
        ].join("\n")
    });
  });

program
  .command("facets")
  .description("读取搜索页真实使用的版本、内容标签和标签排斥规则")
  .action(async () => {
    const global = globalOptions();
    const result = await fetchSearchFacets({ refresh: global.refresh });
    printResult(
      { ...result.facets, cached: result.cached, path: result.path },
      {
        json: global.json,
        human: () =>
          [
            `搜索版本标签（${result.facets.versions.length}）`,
            ...result.facets.versions.map(
              (label) => `- ${label.labelName}\t${label.labelValue}\t${label.onlineStatus === 1 ? "在线" : "离线"}`
            ),
            "",
            `搜索内容标签（${result.facets.contents.length}）`,
            ...result.facets.contents.map(
              (label) => `- ${label.labelName}\t${label.labelValue}\t${label.onlineStatus === 1 ? "在线" : "离线"}`
            ),
            "",
            `标签排斥规则：${result.facets.exclusions.length} 条`
          ].join("\n")
      }
    );
  });

program
  .command("search")
  .description("用自然语言、类名、函数名搜索华为文档站")
  .argument("<query>", "搜索词，例如 输入事件注入 或 OH_Input_InjectTouchEvent")
  .option("--page <number>", "页码", "1")
  .option("--limit <number>", "每页结果数，1-50", "15")
  .addOption(new Option("--kind <kind>", "结果类别").choices(["all", "api", "guide"]).default("all"))
  .option("--version <profile>", "版本画像，仅标注研究上下文；函数级判定请用 symbol", "26.0.0")
  .action(async (query: string, options: { page: string; limit: string; kind: "all" | "api" | "guide"; version: string }) => {
    const global = globalOptions();
    const profile = getVersionProfile(options.version);
    const response = await searchDocuments(query, {
      page: integerOption(options.page, "--page", 1),
      limit: integerOption(options.limit, "--limit", 1, 50),
      kind: options.kind,
      refresh: global.refresh
    });
    printResult(
      { ...response, profile },
      {
        json: global.json,
        human: () =>
          [
            `站内共 ${response.total} 条混合结果；本页返回 ${response.returnedDocuments} 篇官方文档；当前研究画像：${profile.name}（API ${profile.apiMin}-${profile.apiMax}）`,
            response.discardedNonDocuments
              ? `本页另有 ${response.discardedNonDocuments} 条问答/示例等非文档结果，未混入文档 ID。`
              : "本页结果均可解析为官方文档 ID。",
            "注意：search 只做发现，设备/版本函数级结论请用 symbol。",
            "",
            ...response.results.map(searchResultHuman)
          ].join("\n")
      }
    );
  });

program
  .command("lookup")
  .description("把搜索、门户、官方目录、真实目录、详情、锚点和 Markdown 合成一个文档上下文")
  .argument("<input>", "自然语言、符号名、文档 ID 或官方 URL")
  .option("--anchor <anchor>", "显式定位 Markdown 锚点；符号搜索会自动采用精确匹配锚点")
  .option("--max-headings <number>", "最多返回多少个 Markdown 标题", "80")
  .option("--include-content", "内联目标锚点的 Markdown 内容；默认只返回位置和长度")
  .action(
    async (
      input: string,
      options: { anchor?: string; maxHeadings: string; includeContent?: boolean }
    ) => {
      const global = globalOptions();
      const data = await fetchDocumentContext(input, {
        refresh: global.refresh,
        anchor: options.anchor,
        maxHeadings: integerOption(options.maxHeadings, "--max-headings", 1, 500),
        includeContent: Boolean(options.includeContent)
      });
      printResult(data, {
        json: global.json,
        human: () => {
          const document = data.document as {
            id: string;
            url: string;
            title: string;
            metadata: { version?: string; deviceVersion?: string; anchorList?: unknown[] };
          };
          const catalog = data.catalog as {
            title: string;
            navigationAddress: string;
            node: { path?: string[] } | null;
          };
          const discovery = data.discovery as { portalPlacements: unknown[] };
          const markdown = data.markdown as { totalHeadings: number; totalChars: number; path: string };
          const section = data.section as
            | { title: string; anchor: string; startLine: number; endLine: number; content?: string }
            | null;
          return [
            document.title,
            `id: ${document.id}`,
            `url: ${document.url}`,
            `官方目录：${catalog.node?.path?.join(" > ") || "目录树未挂载该文档"}`,
            `catalog: ${catalog.title}`,
            `站内导航：${catalog.navigationAddress}`,
            `门户精选：${discovery.portalPlacements.length ? `${discovery.portalPlacements.length} 处` : "否"}`,
            `版本：${document.metadata.version || "未标注"}`,
            `设备标签：${document.metadata.deviceVersion || "未标注"}`,
            `详情锚点：${document.metadata.anchorList?.length || 0}`,
            `Markdown：${markdown.totalHeadings} 个标题 / ${markdown.totalChars} chars`,
            `本地正文：${markdown.path}`,
            ...(section
              ? [
                  `定位段落：${section.title} #${section.anchor}（${section.startLine}-${section.endLine} 行）`,
                  ...(section.content ? ["", section.content] : [])
                ]
              : [])
          ].join("\n");
        }
      });
    }
  );

program
  .command("resolve")
  .description("把搜索词、函数名、文档 ID 或 URL 解析为稳定文档 ID")
  .argument("<input>", "搜索词、函数名、文档 ID 或 URL")
  .action(async (input: string) => {
    const global = globalOptions();
    const resolved = await resolveDocument(input, { refresh: global.refresh });
    printResult(resolved, {
      json: global.json,
      human: () => `${resolved.id}\n${resolved.url}\n解析方式：${resolved.via}`
    });
  });

program
  .command("read")
  .description("读取搜索得到的文档 ID；可按锚点或函数名截取单个段落")
  .argument("<id>", "search 返回的 id；也接受函数名或 URL 作为逃生输入")
  .option("--anchor <anchor>", "只读取该锚点/函数段落")
  .option("--max-chars <number>", "JSON 内联正文上限；完整正文用 --out", "50000")
  .option("--out <path>", "把完整 Markdown 或段落写入文件")
  .action(async (input: string, options: { anchor?: string; maxChars: string; out?: string }) => {
    const global = globalOptions();
    const resolved = await resolveDocument(input, { refresh: global.refresh });
    const document = await fetchDocument(resolved.id, { refresh: global.refresh });
    const section = options.anchor ? extractSection(document.markdown, options.anchor) : null;
    if (options.anchor && !section) throw new Error(`文档中没有找到锚点或函数：${options.anchor}`);
    const content = section?.content || document.markdown;
    let outputPath: string | null = null;
    if (options.out) {
      outputPath = resolvePath(options.out);
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, content, "utf8");
    }
    const maxChars = integerOption(options.maxChars, "--max-chars", 1000);
    const truncated = content.length > maxChars;
    const inlineContent = truncated ? content.slice(0, maxChars) : content;
    printResult(
      {
        id: document.id,
        url: document.url,
        markdownUrl: document.markdownUrl,
        cached: document.cached,
        section,
        content: inlineContent,
        truncated,
        totalChars: content.length,
        outputPath
      },
      {
        json: global.json,
        human: () =>
          outputPath
            ? `已写入 ${outputPath}（${content.length} chars）`
            : content
      }
    );
  });

program
  .command("outline")
  .description("读取文档标题层级和可跳转锚点")
  .argument("<id>", "search 返回的 id，也接受搜索词或函数名")
  .option("--max-depth <number>", "最大标题深度", "6")
  .action(async (input: string, options: { maxDepth: string }) => {
    const global = globalOptions();
    const resolved = await resolveDocument(input, { refresh: global.refresh });
    const document = await fetchDocument(resolved.id, { refresh: global.refresh });
    const depth = integerOption(options.maxDepth, "--max-depth", 1, 6);
    const headings = parseHeadings(document.markdown).filter((heading) => heading.level <= depth);
    printResult(
      { id: document.id, url: document.url, headings },
      {
        json: global.json,
        human: () =>
          headings
            .map(
              (heading) =>
                `${"  ".repeat(Math.max(0, heading.level - 1))}- ${heading.title}  #${heading.anchor}  (line ${heading.line})`
            )
            .join("\n")
      }
    );
  });

program
  .command("symbol")
  .description("按 C/ArkTS API 名直接定位函数段落，并按目标 HarmonyOS 版本和设备判定")
  .argument("<name>", "函数、类型或 API 名，例如 OH_Input_InjectTouchEvent")
  .option("--version <profile>", "版本画像", "26.0.0")
  .option("--device <device>", "目标设备", "Phone")
  .option("--candidates <number>", "最多检查多少篇搜索结果", "8")
  .action(async (name: string, options: { version: string; device: string; candidates: string }) => {
    const global = globalOptions();
    const profile = getVersionProfile(options.version);
    const search = await searchDocuments(name, {
      limit: integerOption(options.candidates, "--candidates", 1, 20),
      refresh: global.refresh
    });
    const normalized = normalizeSymbol(name);
    let selected:
      | {
          result: SearchResult;
          anchor: string;
          section: NonNullable<ReturnType<typeof extractSection>>;
          document: Awaited<ReturnType<typeof fetchDocument>>;
        }
      | undefined;

    for (const result of search.results) {
      const exactAnchor = result.anchors.find(
        (anchor) => normalizeSymbol(anchor.title) === normalized
      );
      if (!exactAnchor && result !== search.results[0]) continue;
      const document = await fetchDocument(result.id, { refresh: global.refresh });
      const section = extractSection(document.markdown, exactAnchor?.anchorId || name);
      if (section) {
        selected = {
          result,
          anchor: exactAnchor?.anchorId || section.anchor,
          section,
          document
        };
        break;
      }
    }

    if (!selected) throw new Error(`没有在搜索结果中定位到符号段落：${name}`);

    const metadata = parseSectionMetadata(selected.section.content, profile.apiMax);
    const compatibility = evaluateCompatibility(
      selected.section.content,
      metadata,
      profile,
      options.device
    );
    const data = {
      name,
      id: selected.document.id,
      url: `${selected.document.url}#${selected.anchor}`,
      breadcrumb: selected.result.breadcrumb,
      language: selected.result.language,
      section: selected.section,
      metadata,
      compatibility,
      source: selected.document.markdownUrl,
      cached: selected.document.cached
    };

    printResult(data, {
      json: global.json,
      human: () =>
        [
          `${selected.section.title}`,
          `文档：${data.id}`,
          `目录：${data.breadcrumb.join(" > ")}`,
          `目标：${profile.name} / ${options.device}`,
          `判定：${compatibility.verdict}`,
          ...compatibility.reasons.map((reason) => `- ${reason}`),
          metadata.permissions.length ? `权限：${metadata.permissions.join(", ")}` : "权限：文档段落未声明",
          metadata.deviceBehavior.length
            ? `设备差异：${metadata.deviceBehavior.join("；")}`
            : "设备差异：文档段落未声明",
          metadata.laterVersionNotes.length
            ? `晚于目标版本的说明：${metadata.laterVersionNotes.map((item) => `API ${item.version}: ${item.text}`).join("；")}`
            : "晚于目标版本的说明：无",
          "",
          selected.section.content
        ].join("\n")
    });
  });

program
  .command("links")
  .description("列出文档正文中的华为官方关联文档链接")
  .argument("<id>", "search 返回的 id，也接受搜索词或函数名")
  .option("--limit <number>", "最多返回多少条", "100")
  .action(async (input: string, options: { limit: string }) => {
    const global = globalOptions();
    const resolved = await resolveDocument(input, { refresh: global.refresh });
    const document = await fetchDocument(resolved.id, { refresh: global.refresh });
    const links = extractHuaweiDocLinks(document.markdown).slice(
      0,
      integerOption(options.limit, "--limit", 1)
    );
    printResult(
      { id: document.id, links },
      {
        json: global.json,
        human: () => links.map((link) => `${link.text}\n  id: ${link.id}${link.anchor ? `#${link.anchor}` : ""}`).join("\n")
      }
    );
  });

const profiles = program.command("profiles").description("查看内置 HarmonyOS 版本画像");
profiles
  .command("list")
  .description("列出版本到 API 范围的映射及官方证据")
  .action(() => {
    const global = globalOptions();
    const values = Object.values(VERSION_PROFILES);
    printResult(values, {
      json: global.json,
      human: () =>
        values
          .map(
            (profile) =>
              `${profile.name}: API ${profile.apiMin}-${profile.apiMax}\n${profile.releases
                .map((release) => `  - ${release.name}: API ${release.api}`)
                .join("\n")}\n证据：\n${profile.evidence.map((url) => `  - ${url}`).join("\n")}`
          )
          .join("\n\n")
    });
  });

const cache = program.command("cache").description("查看本地只读缓存状态");
cache
  .command("status")
  .description("显示缓存目录；本工具不会自动删除缓存")
  .action(async () => {
    const global = globalOptions();
    const status = await getCacheStatus();
    printResult(status, {
      json: global.json,
      human: () => `${status.path}\n${status.exists ? "已创建" : "尚未创建"}`
    });
  });

const request = program.command("request").description("只读原始请求逃生口；正常研究优先使用 search/read/symbol");
request
  .command("get")
  .description("GET 华为开发文档域名；不支持写请求")
  .argument("<target>", "华为开发文档 URL 或相对路径")
  .option("--max-chars <number>", "内联正文上限", "50000")
  .action(async (target: string, options: { maxChars: string }) => {
    const global = globalOptions();
    const response = await rawGet(target);
    const maxChars = integerOption(options.maxChars, "--max-chars", 1000);
    const truncated = response.body.length > maxChars;
    const data = {
      ...response,
      body: truncated ? response.body.slice(0, maxChars) : response.body,
      truncated,
      totalChars: response.body.length
    };
    printResult(data, {
      json: global.json,
      human: () => data.body
    });
  });

program.parseAsync().catch((error) => {
  printError(error, globalOptions().json);
  process.exitCode = 1;
});
