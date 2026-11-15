export const DOC_ORIGIN = "https://developer.huawei.com";
export const DOC_BASE = `${DOC_ORIGIN}/consumer/cn/doc/`;
export const DOC_PORTAL_URL = DOC_BASE;
export const DOC_SITEMAP_URL =
  `${DOC_ORIGIN}/consumer/cn/sitemap/doc/sitemap1.xml`;

export const SEARCH_ENDPOINT =
  "https://svc-drcn.developer.huawei.com/community/servlet/consumer/partnerSearchService/servlet/celia/search";

const SEARCH_LABEL_BASE =
  "https://svc-drcn.developer.huawei.com/community/servlet/consumer/partnerCommunityService/v1/servlet/searchLabel";

export const SEARCH_LABEL_ENDPOINTS = {
  versions: `${SEARCH_LABEL_BASE}/getGlobalVersionLabel`,
  contents: `${SEARCH_LABEL_BASE}/getGlobalContentLabel`,
  exclusions: `${SEARCH_LABEL_BASE}/getLabelExclusion`
} as const;

export const DOCUMENT_PORTAL_ENDPOINT =
  "https://svc-drcn.developer.huawei.com/community/servlet/consumer/cn/documentPortal";

export const DOCUMENT_ENDPOINTS = {
  catalogTree: `${DOCUMENT_PORTAL_ENDPOINT}/getCatalogTree`,
  documentById: `${DOCUMENT_PORTAL_ENDPOINT}/getDocumentById`,
  navigationAddress: `${DOCUMENT_PORTAL_ENDPOINT}/getNavigationAddress`
} as const;

export const SEARCH_CATEGORY_LIST = [1, 3, 4, 8, 10, 11, 12, 13, 15, 16, 19];

export const HARMONYOS_CORE_CATALOGS = [
  "harmonyos-guides",
  "harmonyos-references",
  "harmonyos-releases",
  "harmonyos-faqs",
  "best-practices"
] as const;

export interface VersionProfile {
  id: string;
  name: string;
  apiMin: number | string;
  apiMax: number | string;
  releases: Array<{ name: string; api: number | string }>;
  evidence: string[];
}

export const VERSION_PROFILES: Record<string, VersionProfile> = {
  "26.0.0": {
    id: "26.0.0", name: "HarmonyOS API 26.0.0", apiMin: "26.0.0", apiMax: "26.0.0",
    releases: [{ name: "HarmonyOS SDK 26.0.0 Release", api: "26.0.0" }],
    evidence: [`${DOC_BASE}doccenter-release-notes/overview-2600`]
  },
  "26.0.1": {
    id: "26.0.1", name: "HarmonyOS API 26.0.1 Beta1", apiMin: "26.0.1", apiMax: "26.0.1",
    releases: [{ name: "HarmonyOS SDK 26.0.1 Beta1", api: "26.0.1" }],
    evidence: [`${DOC_BASE}doccenter-release-notes/overview-2601`]
  },
  "6": {
    id: "6",
    name: "HarmonyOS 6",
    apiMin: 20,
    apiMax: 24,
    releases: [
      { name: "HarmonyOS 6.0.0", api: 20 },
      { name: "HarmonyOS 6.0.1", api: 21 },
      { name: "HarmonyOS 6.0.2", api: 22 },
      { name: "HarmonyOS 6.1.0", api: 23 },
      { name: "HarmonyOS 6.1.1", api: 24 }
    ],
    evidence: [
      "https://developer.huawei.com/consumer/cn/doc/harmonyos-releases/overview-600",
      "https://developer.huawei.com/consumer/cn/doc/harmonyos-releases/overview-601",
      "https://developer.huawei.com/consumer/cn/doc/harmonyos-releases/overview-602",
      "https://developer.huawei.com/consumer/cn/doc/harmonyos-releases/overview-610",
      "https://developer.huawei.com/consumer/cn/doc/harmonyos-releases/overview-611"
    ]
  },
  "6.1.0": {
    id: "6.1.0",
    name: "HarmonyOS 6.1.0",
    apiMin: 23,
    apiMax: 23,
    releases: [
      { name: "HarmonyOS 6.1.0", api: 23 }
    ],
    evidence: [
      "https://developer.huawei.com/consumer/cn/doc/harmonyos-releases/overview-610"
    ]
  },
  "6.1": {
    id: "6.1",
    name: "HarmonyOS 6.1",
    apiMin: 23,
    apiMax: 24,
    releases: [
      { name: "HarmonyOS 6.1.0", api: 23 },
      { name: "HarmonyOS 6.1.1", api: 24 }
    ],
    evidence: [
      "https://developer.huawei.com/consumer/cn/doc/harmonyos-releases/overview-610",
      "https://developer.huawei.com/consumer/cn/doc/harmonyos-releases/overview-611"
    ]
  },
  "6.1.1": {
    id: "6.1.1",
    name: "HarmonyOS 6.1.1",
    apiMin: 24,
    apiMax: 24,
    releases: [
      { name: "HarmonyOS 6.1.1", api: 24 }
    ],
    evidence: [
      "https://developer.huawei.com/consumer/cn/doc/harmonyos-releases/overview-611"
    ]
  }
};

export function getVersionProfile(input = "26.0.0"): VersionProfile {
  const normalized = input.trim().toLowerCase().replace(/^harmonyos[-_ ]?/, "");
  const exact = /^(?:api[-_ ]?)?(\d{2}(?:\.\d+\.\d+)?)$/.exec(normalized);
  const api = exact ? (exact[1].includes(".") || Number(exact[1]) < 26 ? exact[1] : `${exact[1]}.0.0`) : normalized;
  const key = ["7", "7.0", "7.0.0"].includes(normalized) ? "26.0.0" : api;
  const profile = VERSION_PROFILES[key];
  if (!profile && exact && ((Number(exact[1]) >= 10 && Number(exact[1]) <= 24) || Number(exact[1].split(".")[0]) >= 26)) {
    return { id: api, name: `HarmonyOS API ${api}`, apiMin: api, apiMax: api,
      releases: [], evidence: [] };
  }
  if (!profile) {
    throw new Error(
      `未知版本画像 ${input}。当前支持：${Object.keys(VERSION_PROFILES).join(", ")}`
    );
  }
  return profile;
}
