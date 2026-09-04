export type DeviceType = "desktop" | "mobile" | "tablet";
export type EventName = "page_view" | "engagement" | "click" | "scroll" | "cta_click" | "conversion";

export type DateRange = { from: string; to: string };
export type AnalyticsFilters = {
  source?: string;
  device?: DeviceType;
  pagePath?: string;
};

export type AnalyticsEvent = {
  schemaVersion: 1;
  eventId: string;
  eventName: EventName;
  siteId: string;
  sessionId: string;
  occurredAt: string;
  pagePath: string;
  pageTitle?: string;
  referrer?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  deviceType: DeviceType;
  viewportWidth: number;
  viewportHeight: number;
  documentHeight?: number;
  engagementSeconds?: number;
  coordinateSpace?: "page";
  elementId?: string;
  elementTag?: string;
  elementText?: string;
  normalizedX?: number;
  normalizedY?: number;
  documentY?: number;
  scrollDepth?: number;
  conversionId?: string;
  consent: boolean;
};

export type OverviewSnapshot = {
  measuredUsers: number;
  sessions: number;
  conversions: number;
  conversionRate: number;
  averageEngagementSeconds: number;
  bounceRate: number;
  attributionCoverage: number;
  trend: Array<{ day: string; sessions: number; conversions: number }>;
  sources: AnalyticsTableRow[];
  pages: AnalyticsTableRow[];
  conversionGoals: AnalyticsTableRow[];
  journeys: Array<{ source: string; pages: Array<{ name: string; sessions: number }> }>;
  deviceSegments: AnalyticsTableRow[];
  dataQuality: { lastEventAt?: string; eventCount: number; taggedPages: number; hasConversions: boolean; attributionCoverage: number };
};

export type AnalyticsTableRow = {
  name: string;
  sessions: number;
  outcomes: number;
  rate: number;
};

export type HeatmapPoint = {
  id: string;
  x: number;
  y: number;
  weight: number;
  elementId?: string;
};

export type HeatmapSnapshot = {
  pagePath: string;
  device: DeviceType;
  sampleSize: number;
  screenshotUrl?: string;
  pageHeight: number;
  points: HeatmapPoint[];
  scrollReach: Array<{ depth: number; percentage: number }>;
};

export type SiteAnalysisResult = {
  analyzedAt: string;
  summary: string;
  mainMessage: string;
  target: string;
  strengths: string[];
  trustElements: string[];
  ctas: string[];
  sections: string[];
  recommendations: string[];
  pages?: Array<{ url: string; title: string; summary: string }>;
};

export type CompetitorAnalysisResult = {
  analyzedAt: string;
  common: string[];
  weakness: string[];
  strength: string[];
  opportunity: string[];
  recommendation: string;
  positioning?: Array<{ name: string; x: number; y: number }>;
};

export type SiteMember = { uid: string; email: string; role: "mogcia" | "agency" | "client" };

export type ConversionRule = {
  id: string;
  name: string;
  eventName: string;
  matchType: "event" | "url_exact" | "url_contains" | "selector";
  matchValue: string;
  enabled: boolean;
};

export type SiteSettings = {
  id: string;
  name: string;
  domain: string;
  siteType?: "website" | "landing_page" | "recruit";
  clientName?: string;
  memberRoles?: Record<string, "mogcia" | "agency" | "client">;
  strategy?: {
    audience: string;
    businessType: "BtoB" | "BtoC" | "Both";
    userProblem: string;
    considerationStage: string;
    entryChannels: string[];
    goals: string[];
    siteRole: string;
    expectedJourney: string;
  };
  competitors?: Array<{ id: string; name: string; url: string; siteType: string; note: string }>;
  improvements?: Array<{
    id: string;
    title: string;
    page: string;
    problem: string;
    evidence: string;
    proposal: string;
    priority: "High" | "Medium" | "Low";
    status: "提案" | "承認" | "対応中" | "公開" | "検証";
    createdAt: string;
  }>;
  changeLog?: Array<{ id: string; date: string; title: string; reason: string; result: string }>;
  siteAnalysis?: SiteAnalysisResult;
  competitorAnalysis?: CompetitorAnalysisResult;
  analysisHistory?: SiteAnalysisResult[];
  competitorHistory?: CompetitorAnalysisResult[];
  integrations?: {
    ga4PropertyId?: string;
    searchConsoleProperty?: string;
    googleConnectionStatus?: "not_connected" | "configured" | "connected";
  };
  timezone: string;
  consentMode: "required" | "analytics_only";
  privacyUrl?: string;
  retentionDays?: number;
  excludedIps: string[];
  conversionRules: ConversionRule[];
  ownerUid?: string;
  memberUids?: string[];
};

export type ConnectionState = "mock" | "connecting" | "connected" | "error";
