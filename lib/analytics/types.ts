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
  timezone: string;
  consentMode: "required" | "analytics_only";
  excludedIps: string[];
  conversionRules: ConversionRule[];
  ownerUid?: string;
  memberUids?: string[];
};

export type ConnectionState = "mock" | "connecting" | "connected" | "error";
