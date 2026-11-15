import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildMarkdownLibrary, rewriteOfficialDocumentLinks } from "../src/library.js";

describe("Markdown library", () => {
  it("rewrites links only when the target document is available locally", () => {
    const current = "/project/docs/huawei-docs/harmonyos-guides/source.md";
    const localPaths = new Map([
      [
        "harmonyos-references/capi-native-avscreen-capture-h",
        "/project/docs/huawei-docs/harmonyos-references/capi-native-avscreen-capture-h.md"
      ]
    ]);
    const markdown = [
      "[本地](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/capi-native-avscreen-capture-h#start)",
      "[远端](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/not-downloaded)"
    ].join("\n");

    expect(rewriteOfficialDocumentLinks(markdown, current, localPaths)).toBe(
      [
        "[本地](../harmonyos-references/capi-native-avscreen-capture-h.md#start)",
        "[远端](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/not-downloaded)"
      ].join("\n")
    );
  });

  it("builds a readable Markdown-only library with navigable indexes", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "huawei-docs-library-"));
    const cacheRoot = join(fixtureRoot, "data");
    const libraryRoot = join(fixtureRoot, "docs");
    const previousCacheRoot = process.env.HUAWEI_DOCS_CACHE_DIR;
    const previousLibraryRoot = process.env.HUAWEI_DOCS_LIBRARY_DIR;
    process.env.HUAWEI_DOCS_CACHE_DIR = cacheRoot;
    process.env.HUAWEI_DOCS_LIBRARY_DIR = libraryRoot;

    try {
      const sourceDirectory = join(cacheRoot, "documents", "harmonyos-guides");
      await mkdir(sourceDirectory, { recursive: true });
      await writeFile(
        join(sourceDirectory, "captured.md"),
        [
          "# 已抓取正文",
          "",
          "这是华为官方 Markdown 正文。",
          "",
          "[已抓取](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/captured#section)",
          "[未抓取](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/remote-only)"
        ].join("\n"),
        "utf8"
      );

      const result = await buildMarkdownLibrary([
        {
          tree: {
            catalogName: "harmonyos-guides",
            title: "指南",
            catalogTreeList: [
              {
                nodeId: "root",
                nodeName: "录屏",
                children: [
                  {
                    nodeId: "captured",
                    nodeName: "已抓取",
                    relateDocument: "captured",
                    children: []
                  },
                  {
                    nodeId: "remote-only",
                    nodeName: "未抓取",
                    relateDocument: "remote-only",
                    children: []
                  }
                ]
              }
            ]
          },
          navigation: {
            catalogName: "harmonyos-guides",
            navigationAddress: "/harmonyos-guides"
          }
        }
      ]);

      const rootEntries = await readdir(libraryRoot, { recursive: true });
      expect(rootEntries.filter((path) => path.includes(".")).every((path) => path.endsWith(".md"))).toBe(true);
      expect(result.documents).toHaveLength(1);

      const rootIndex = await readFile(join(libraryRoot, "README.md"), "utf8");
      expect(rootIndex).toContain("# 华为 HarmonyOS 开发文档本地库");
      expect(rootIndex).toContain("[指南](harmonyos-guides/README.md)");

      const catalogIndex = await readFile(join(libraryRoot, "harmonyos-guides", "README.md"), "utf8");
      expect(catalogIndex).toContain("[已抓取](captured.md)");
      expect(catalogIndex).toContain(
        "[未抓取](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/remote-only)（官网）"
      );

      const document = await readFile(join(libraryRoot, "harmonyos-guides", "captured.md"), "utf8");
      expect(document).toContain("# 已抓取正文");
      expect(document).toContain("这是华为官方 Markdown 正文。");
      expect(document).toContain("[已抓取](captured.md#section)");
      expect(document).toContain(
        "[未抓取](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/remote-only)"
      );
      expect(() => JSON.parse(document)).toThrow();
    } finally {
      if (previousCacheRoot === undefined) delete process.env.HUAWEI_DOCS_CACHE_DIR;
      else process.env.HUAWEI_DOCS_CACHE_DIR = previousCacheRoot;
      if (previousLibraryRoot === undefined) delete process.env.HUAWEI_DOCS_LIBRARY_DIR;
      else process.env.HUAWEI_DOCS_LIBRARY_DIR = previousLibraryRoot;
    }
  });
});
