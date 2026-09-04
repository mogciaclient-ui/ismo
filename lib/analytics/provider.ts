import type { AnalyticsFilters, CompetitorAnalysisResult, DateRange, GoogleIntegrationStatus, GooglePerformance, GoogleResources, HeatmapSnapshot, OverviewSnapshot, SiteAnalysisResult, SiteMember, SiteSettings } from "./types";

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
  getGoogleIntegration(siteId: string): Promise<GoogleIntegrationStatus>;
  startGoogleOAuth(siteId: string): Promise<{ authorizationUrl: string; redirectUri: string }>;
  listGoogleResources(siteId: string): Promise<GoogleResources>;
  saveGoogleResources(siteId: string, ga4PropertyId: string, searchConsoleProperty: string): Promise<void>;
  getGooglePerformance(siteId: string, range: DateRange): Promise<GooglePerformance>;
  disconnectGoogleIntegration(siteId: string): Promise<void>;
}
