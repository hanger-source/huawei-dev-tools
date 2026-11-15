export interface SearchRequest {
  keyWord: string;
  searchFilterParams: {
    language: string;
    categoryList: number[];
  };
  pipelineParams: {
    whetherToCorrect: number;
    whetherToSynonym: number;
    scene: number;
  };
  pageIndex: number;
  pageSize: number;
}

export interface AnchorInfo {
  anchorId: string;
  title: string;
}

export interface RawSearchResult {
  url: string;
  name: string;
  anchorHighlightInfo?: string;
  metaData: {
    objectID: string;
    restrictFlag?: string;
    description?: string;
    timestamp?: string;
    forumId?: string;
    em_title?: string;
    em_desc?: string;
    name?: string;
    type?: number;
    ext?: {
      anchorList?: string;
      docCodeLanguage?: string;
      domain?: string;
      kitName?: string;
      nodeNames?: string[];
      catalogName?: string;
      updateTime?: string;
      [key: string]: unknown;
    };
  };
}

export interface RawSearchResponse {
  code: number;
  message?: string;
  totalCount?: number;
  resultList?: RawSearchResult[];
}

export interface SearchFacetLabel {
  labelId: string;
  labelLevel: number;
  labelValue: string;
  labelName: string;
  onlineStatus: number;
  childLableList: SearchFacetLabel[];
}

export interface SearchFacetExclusion {
  labelType: string;
  labelValue: string;
  exclusiveLabelType: string;
  exclusiveLabelValue: string;
}

export interface SearchFacetResponse<T> {
  code: number | string;
  message?: string;
  resultList?: T[];
  totalCount?: number;
}

export interface SearchFacets {
  source: Record<"versions" | "contents" | "exclusions", string>;
  fetchedAt: string;
  versions: SearchFacetLabel[];
  contents: SearchFacetLabel[];
  exclusions: SearchFacetExclusion[];
}

export interface SearchResult {
  id: string;
  catalogId: string;
  documentId: string;
  objectId: string;
  name: string;
  url: string;
  description: string;
  highlightedDescription: string;
  language: string | null;
  domain: string | null;
  catalog: string | null;
  kit: string | null;
  breadcrumb: string[];
  updatedAt: string | null;
  matchedAnchors: AnchorInfo[];
  anchors: AnchorInfo[];
}

export interface DocumentResolution {
  id: string;
  url: string;
  via: "url" | "id" | "index-id" | "search";
  query: string | null;
  name: string | null;
  breadcrumb: string[];
  matchedAnchor: AnchorInfo | null;
}

export interface PortalEntry {
  title: string;
  description: string;
  enabled: boolean;
  url: string;
  id: string | null;
  catalogId: string | null;
  documentId: string | null;
}

export interface PortalGroup {
  title: string;
  entries: PortalEntry[];
}

export interface PortalDomain {
  title: string;
  groups: PortalGroup[];
}

export interface PortalVersion {
  label: string;
  domains: PortalDomain[];
}

export interface PortalSnapshot {
  source: string;
  fetchedAt: string;
  title: string;
  description: string;
  versions: PortalVersion[];
  entryCount: number;
}

export interface SitemapDocument {
  id: string;
  catalogId: string;
  documentId: string;
  url: string;
  lastModified: string | null;
}

export interface CatalogSummary {
  id: string;
  documentCount: number;
  firstDocumentId: string | null;
  lastModified: string | null;
}

export interface DocumentIndex {
  source: string;
  fetchedAt: string;
  documentCount: number;
  catalogs: CatalogSummary[];
  documents: SitemapDocument[];
}

export interface CatalogNode {
  children?: CatalogNode[];
  nodeId: string;
  nodeName: string;
  parent?: string;
  catalogIndex?: number;
  isLeaf?: boolean;
  relateDocument?: string;
  businessTypeNo?: string;
  released?: number;
  [key: string]: unknown;
}

export interface CatalogTree {
  catalogName: string;
  title: string;
  tag?: string;
  domain?: string;
  businessType?: string;
  navigationAddress?: string;
  versionLabelList?: string[];
  displayLabels?: Array<Record<string, unknown>>;
  catalogTreeList: CatalogNode[];
  [key: string]: unknown;
}

export interface FlatCatalogNode {
  nodeId: string;
  title: string;
  depth: number;
  path: string[];
  documentId: string | null;
  id: string | null;
  url: string | null;
  isLeaf: boolean;
}

export interface DocumentInfo {
  docId: string;
  title: string;
  fileName: string;
  catalogName: string;
  lang: string;
  domain: string;
  businessName: string;
  businessType: string;
  businessTypeName: string;
  serviceType: string;
  version: string;
  versionLabels?: string[];
  deviceVersion?: string;
  platform?: number;
  tag?: string;
  status?: string;
  updatedDate?: string;
  displayUpdateTime?: string;
  keywords?: string;
  navigationAddress?: string;
  anchorList: Array<AnchorInfo & Record<string, unknown>>;
  content?: { type?: string; content?: string };
  [key: string]: unknown;
}

export interface NavigationAddress {
  catalogName: string;
  navigationAddress: string;
}

export interface ApiResponse<T> {
  code: number | string;
  message?: string;
  value?: T;
}

export interface SyncResult {
  catalogId: string;
  requested: number;
  downloaded: number;
  reused: number;
  failed: Array<{ id: string; error: string }>;
  documents: Array<{ id: string; path: string; cached: boolean; bytes: number }>;
}

export interface Heading {
  level: number;
  title: string;
  anchor: string;
  line: number;
}

export interface SectionMetadata {
  sinceVersion: string | null;
  sinceVersionRaw: string | null;
  systemCapability: string | null;
  permissions: string[];
  restrictedPermission: boolean;
  deviceBehavior: string[];
  laterVersionNotes: Array<{ version: string; text: string }>;
}

export type DeviceStatus = "supported" | "unsupported" | "unknown";

export interface CompatibilityVerdict {
  profile: string;
  apiRange: { min: number | string; max: number | string };
  device: string;
  introducedInProfile: boolean | null;
  deviceStatus: DeviceStatus;
  verdict: "supported" | "unsupported" | "requires_verification";
  reasons: string[];
}
