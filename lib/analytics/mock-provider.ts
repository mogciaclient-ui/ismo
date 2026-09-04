import type { AnalyticsProvider } from "./provider";
import type { DeviceType, HeatmapPoint, SiteSettings } from "./types";

const points: HeatmapPoint[] = [
  { id: "p1", x: 18, y: 31, weight: 0.98, elementId: "hero-contact" },
  { id: "p2", x: 22, y: 34, weight: 0.82, elementId: "hero-contact" },
  { id: "p3", x: 74, y: 19, weight: 0.66, elementId: "global-nav-works" },
  { id: "p4", x: 63, y: 55, weight: 0.52, elementId: "service-card" },
  { id: "p5", x: 47, y: 73, weight: 0.37, elementId: "works-more" },
];

let settings: SiteSettings = {
  id: "mogcia-demo",
  name: "MOGCIA Corporate Site",
  domain: "mogcia.jp",
  timezone: "Asia/Tokyo",
  consentMode: "required",
  privacyUrl: "https://www.mogcia.net/privacy-policy",
  retentionDays: 395,
  excludedIps: [],
  conversionRules: [
    { id: "contact", name: "問い合わせ完了", eventName: "contact_submit", matchType: "url_contains", matchValue: "/contact/thanks", enabled: true },
    { id: "line", name: "LINE追加", eventName: "line_add", matchType: "url_contains", matchValue: "lin.ee", enabled: true },
    { id: "phone", name: "電話タップ", eventName: "phone_click", matchType: "url_contains", matchValue: "tel:", enabled: true },
  ],
};

export const mockAnalyticsProvider: AnalyticsProvider = {
  async getOverview() {
    return { measuredUsers: 8421, sessions: 10284, conversions: 126, conversionRate: 1.23, averageEngagementSeconds: 138, bounceRate: 42.8, attributionCoverage: 86.4, trend: [], sources: [], pages: [], conversionGoals: [], journeys: [] };
  },
  async getHeatmap(_siteId, _range, filters) {
    return { pagePath: filters.pagePath ?? "/", device: (filters.device ?? "mobile") as DeviceType, sampleSize: 2184, pageHeight: 1280, points, scrollReach: [{ depth: 25, percentage: 91 }, { depth: 50, percentage: 68 }, { depth: 75, percentage: 42 }, { depth: 90, percentage: 21 }] };
  },
  async getSiteSettings() { return structuredClone(settings); },
  async saveSiteSettings(next) { settings = structuredClone(next); await new Promise(resolve => setTimeout(resolve, 500)); },
  async testConnection() { await new Promise(resolve => setTimeout(resolve, 650)); return { ok: true, receivedAt: new Date().toISOString(), message: "テストイベントを受信しました" }; },
  async getAiInsight(_siteId, _range, question) {
    await new Promise(resolve => setTimeout(resolve, 450));
    return { answer: `「${question}」について、現在はデモモードです。Firebaseを設定すると実データをもとに分析します。` };
  },
};
