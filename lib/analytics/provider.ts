import type { AnalyticsFilters, DateRange, HeatmapSnapshot, OverviewSnapshot, SiteSettings } from "./types";

export interface AnalyticsProvider {
  getOverview(siteId: string, range: DateRange): Promise<OverviewSnapshot>;
  getHeatmap(siteId: string, range: DateRange, filters: AnalyticsFilters): Promise<HeatmapSnapshot>;
  getSiteSettings(siteId: string): Promise<SiteSettings>;
  saveSiteSettings(settings: SiteSettings): Promise<void>;
  testConnection(siteId: string): Promise<{ ok: boolean; receivedAt?: string; message: string }>;
  getAiInsight(siteId: string, range: DateRange, question: string): Promise<{ answer: string; usage?: unknown }>;
}
