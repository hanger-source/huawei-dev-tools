import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { cacheRoot, readThroughText } from "../src/cache.js";
import {
  buildCatalogTreeRequest,
  buildDocumentInfoRequest,
  buildNavigationRequest,
  buildSearchRequest,
  findBestSearchAnchor
} from "../src/client.js";
import {
  findCatalogDocumentNode,
  findPortalDocumentPlacements,
  findSitemapDocumentsByBareId,
  flattenCatalogTree,
  parseHuaweiDocumentUrl,
  parsePortalHtml,
  parseSitemapXml,
  splitDocumentId
} from "../src/sources.js";

const originalCacheDir = process.env.HUAWEI_DOCS_CACHE_DIR;

afterEach(() => {
  if (originalCacheDir === undefined) delete process.env.HUAWEI_DOCS_CACHE_DIR;
  else process.env.HUAWEI_DOCS_CACHE_DIR = originalCacheDir;
});

describe("official source contracts", () => {
  it("normalizes document ids and official URLs", () => {
    expect(parseHuaweiDocumentUrl("https://developer.huawei.com/consumer/cn/doc/doccenter-references/api/capi-oh-input-manager-h/"))
      .toMatchObject({ catalogId: "doccenter-references", documentId: "api/capi-oh-input-manager-h",
        url: "https://developer.huawei.com/consumer/cn/doc/doccenter-references/api/capi-oh-input-manager-h" });
    expect(splitDocumentId("/harmonyos-references/capi-native-avscreen-capture-h.md")).toEqual({
      id: "harmonyos-references/capi-native-avscreen-capture-h",
      catalogId: "harmonyos-references",
      documentId: "capi-native-avscreen-capture-h"
    });
    expect(
      parseHuaweiDocumentUrl(
        "https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/application-dev-guide?x=1#top"
      )
    ).toMatchObject({
      id: "harmonyos-guides/application-dev-guide",
      url: "https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/application-dev-guide"
    });
  });

  it("parses the document-center CMS payload embedded in the initial HTML", () => {
    const payload = {
      children: [
        {
          vueAppComponentRawValue: {
            layout: {
              floortitle: { value: "文档中心" },
              floordescription: { value: "官方精选入口" }
            },
            version: {
              rawValue: [
                {
                  label: { value: "HarmonyOS 5.0及以上" },
                  list: {
                    rawValue: [
                      {
                        title1: { value: "HarmonyOS SDK" },
                        list: {
                          rawValue: [
                            {
                              title2: { value: "热点推荐" },
                              list: {
                                rawValue: [
                                  {
                                    title: { value: "应用开发导读" },
                                    desc: { value: "从这里开始" },
                                    abled: { value: true },
                                    linked: {
                                      href: "https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/application-dev-guide"
                                    }
                                  }
                                ]
                              }
                            }
                          ]
                        }
                      }
                    ]
                  }
                }
              ]
            }
          }
        }
      ]
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
    const portal = parsePortalHtml(`<script>var binaryString = atob("${encoded}");</script>`, "now");

    expect(portal).toMatchObject({
      fetchedAt: "now",
      title: "文档中心",
      description: "官方精选入口",
      entryCount: 1
    });
    expect(portal.versions[0].domains[0].groups[0].entries[0]).toMatchObject({
      title: "应用开发导读",
      enabled: true,
      id: "harmonyos-guides/application-dev-guide"
    });
  });

  it("builds a complete catalog/document index from the official sitemap", () => {
    const sitemap = parseSitemapXml(
      `<?xml version="1.0"?><urlset>
        <url><loc>https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/alpha</loc><lastmod>2026-01-01</lastmod></url>
        <url><loc>https://developer.huawei.com/consumer/cn/doc/harmonyos-references/beta</loc><lastmod>2026-02-01</lastmod></url>
        <url><loc>https://example.com/not-huawei</loc></url>
      </urlset>`,
      "now"
    );

    expect(sitemap.documentCount).toBe(2);
    expect(sitemap.catalogs.map((catalog) => catalog.id)).toEqual([
      "harmonyos-guides",
      "harmonyos-references"
    ]);
    expect(sitemap.documents[1].id).toBe("harmonyos-references/beta");
    expect(findSitemapDocumentsByBareId(sitemap, "beta")).toEqual([
      expect.objectContaining({ id: "harmonyos-references/beta" })
    ]);
    expect(findSitemapDocumentsByBareId(sitemap, "missing")).toEqual([]);
  });

  it("flattens API directory nodes into jumpable document ids", () => {
    const nodes = flattenCatalogTree("harmonyos-references", [
      {
        nodeId: "root",
        nodeName: "媒体",
        children: [
          {
            nodeId: "capture",
            nodeName: "屏幕采集",
            isLeaf: true,
            relateDocument: "capi-native-avscreen-capture-h"
          }
        ]
      }
    ]);

    expect(nodes[1]).toMatchObject({
      depth: 1,
      path: ["媒体", "屏幕采集"],
      id: "harmonyos-references/capi-native-avscreen-capture-h",
      url: "https://developer.huawei.com/consumer/cn/doc/harmonyos-references/capi-native-avscreen-capture-h"
    });
    expect(
      findCatalogDocumentNode(
        "harmonyos-references",
        [
          {
            nodeId: "root",
            nodeName: "媒体",
            children: [
              {
                nodeId: "capture",
                nodeName: "屏幕采集",
                isLeaf: true,
                relateDocument: "capi-native-avscreen-capture-h"
              }
            ]
          }
        ],
        "capi-native-avscreen-capture-h"
      )
    ).toMatchObject({ path: ["媒体", "屏幕采集"] });
  });

  it("locates a document in the curated portal taxonomy", () => {
    const portal = {
      source: "portal",
      fetchedAt: "now",
      title: "文档中心",
      description: "",
      entryCount: 1,
      versions: [
        {
          label: "HarmonyOS 5.0及以上",
          domains: [
            {
              title: "HarmonyOS SDK",
              groups: [
                {
                  title: "媒体",
                  entries: [
                    {
                      title: "Media Kit",
                      description: "媒体能力",
                      enabled: true,
                      url: "https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/media-kit-intro",
                      id: "harmonyos-guides/media-kit-intro",
                      catalogId: "harmonyos-guides",
                      documentId: "media-kit-intro"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };

    expect(findPortalDocumentPlacements(portal, "harmonyos-guides/media-kit-intro")).toEqual([
      {
        version: "HarmonyOS 5.0及以上",
        domain: "HarmonyOS SDK",
        group: "媒体",
        title: "Media Kit",
        description: "媒体能力"
      }
    ]);
  });

  it("matches browser-captured POST request bodies exactly", () => {
    expect(buildSearchRequest("OH_AVScreenCapture_StartScreenCaptureWithSurface")).toEqual({
      keyWord: "OH_AVScreenCapture_StartScreenCaptureWithSurface",
      searchFilterParams: {
        language: "zh",
        categoryList: [1, 3, 4, 8, 10, 11, 12, 13, 15, 16, 19]
      },
      pipelineParams: { whetherToCorrect: 1, whetherToSynonym: 1, scene: 0 },
      pageIndex: 1,
      pageSize: 15
    });
    expect(buildCatalogTreeRequest("harmonyos-references")).toEqual({
      language: "cn",
      catalogName: "harmonyos-references",
      objectId: "x"
    });
    expect(buildDocumentInfoRequest("harmonyos-references/capi-native-avscreen-capture-h")).toEqual({
      objectId: "capi-native-avscreen-capture-h",
      version: "",
      catalogName: "harmonyos-references",
      language: "cn"
    });
    expect(buildNavigationRequest("harmonyos-references")).toEqual({
      catalogName: "harmonyos-references",
      lang: "cn"
    });
  });

  it("prefers an exact symbol anchor over a shorter contains match", () => {
    const short = {
      anchorId: "oh_avscreencapture_startscreencapture",
      title: "OH_AVScreenCapture_StartScreenCapture()"
    };
    const exact = {
      anchorId: "oh_avscreencapture_startscreencapturewithsurface",
      title: "OH_AVScreenCapture_StartScreenCaptureWithSurface()"
    };
    expect(
      findBestSearchAnchor(
        {
          id: "harmonyos-references/capi-native-avscreen-capture-h",
          catalogId: "harmonyos-references",
          documentId: "capi-native-avscreen-capture-h",
          objectId: "capi-native-avscreen-capture-h",
          name: "native_avscreen_capture.h",
          url: "https://developer.huawei.com/consumer/cn/doc/harmonyos-references/capi-native-avscreen-capture-h",
          description: "",
          highlightedDescription: "",
          language: "C/C++",
          domain: "HarmonyOS",
          catalog: "API参考",
          kit: "Media Kit",
          breadcrumb: [],
          updatedAt: null,
          matchedAnchors: [short, exact],
          anchors: [short, exact]
        },
        "OH_AVScreenCapture_StartScreenCaptureWithSurface"
      )
    ).toEqual(exact);
  });
});

describe("persistent local library", () => {
  it("stores the default library inside the standalone project", () => {
    delete process.env.HUAWEI_DOCS_CACHE_DIR;
    expect(cacheRoot()).toBe(fileURLToPath(new URL("../data/huawei-docs/", import.meta.url)));
  });

  it("reuses an existing file until refresh is explicit", async () => {
    process.env.HUAWEI_DOCS_CACHE_DIR = await mkdtemp(join(tmpdir(), "huawei-docs-cache-test-"));
    const loader = vi.fn(async () => "first");
    const segments = ["documents", "catalog", "document.md"];

    const first = await readThroughText(segments, false, loader);
    const reused = await readThroughText(segments, false, loader);
    const refreshed = await readThroughText(segments, true, async () => "second");

    expect(first.cached).toBe(false);
    expect(reused).toMatchObject({ value: "first", cached: true, path: first.path });
    expect(refreshed).toMatchObject({ value: "second", cached: false, path: first.path });
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
