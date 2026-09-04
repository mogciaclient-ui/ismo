import type { AnalyticsFilters, CompetitorAnalysisResult, DateRange, HeatmapSnapshot, OverviewSnapshot, SiteAnalysisResult, SiteMember, SiteSettings } from "./types";

export interface AnalyticsProvider {
  getOverview(siteId: string, range: DateRange): Promise<OverviewSnapshot>;
  getHeatmap(siteId: string, range: DateRange, filters: AnalyticsFilters): Promise<HeatmapSnapshot>;
  getSiteSettings(siteId: string): Promise<SiteSettings>;
  saveSiteSettings(settings: SiteSettings): Promise<void>;
  testConnection(siteId: string): Promise<{ ok: boolean; receivedAt?: string; message: string }>;
  getAiInsight(siteId: string, range: DateRange, question: string): Promise<{ answer: string; usage?: unknown }>;
  analyzeSite(siteId: string): Promise<SiteAnalysisResult>;
  analyzeCompetitors(siteId: string): Promise<CompetitorAnalysisResult>;
  getSiteMembers(siteId: string): Promise<SiteMember[]>;
  setSiteMember(siteId: string, email: string, role: SiteMember["role"]): Promise<SiteMember[]>;
}
