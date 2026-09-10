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
    return { measuredUsers: 8421, sessions: 10284, conversions: 126, conversionRate: 1.23, averageEngagementSeconds: 138, bounceRate: 42.8, attributionCoverage: 86.4, trend: [], sources: [], pages: [], conversionGoals: [], journeys: [], deviceSegments: [{ name: "mobile", sessions: 6800, outcomes: 78, rate: 1.15 }, { name: "desktop", sessions: 3484, outcomes: 48, rate: 1.38 }], audienceSegments: [{ source: "instagram", device: "mobile", sessions: 2860, outcomes: 42, rate: 1.47, topPages: [{ name: "/service", sessions: 1640 }, { name: "/price", sessions: 980 }, { name: "/contact", sessions: 420 }] }, { source: "tiktok", device: "mobile", sessions: 2210, outcomes: 31, rate: 1.4, topPages: [{ name: "/lp", sessions: 1880 }, { name: "/price", sessions: 740 }] }, { source: "google", device: "desktop", sessions: 1940, outcomes: 36, rate: 1.86, topPages: [{ name: "/", sessions: 1400 }, { name: "/case", sessions: 760 }] }], dataQuality: { lastEventAt: new Date().toISOString(), eventCount: 18240, taggedPages: 12, hasConversions: true, attributionCoverage: 86.4 } };
  },
  async getHeatmap(_siteId, _range, filters) {
    return { pagePath: filters.pagePath ?? "/", device: (filters.device ?? "mobile") as DeviceType, sampleSize: 2184, pageHeight: 5200, points, scrollReach: [{ depth: 25, percentage: 91 }, { depth: 50, percentage: 68 }, { depth: 75, percentage: 42 }, { depth: 90, percentage: 21 }] };
  },
  async getSiteSettings() { return structuredClone(settings); },
  async saveSiteSettings(next) { settings = structuredClone(next); await new Promise(resolve => setTimeout(resolve, 500)); },
  async testConnection() { await new Promise(resolve => setTimeout(resolve, 650)); return { ok: true, receivedAt: new Date().toISOString(), message: "テストイベントを受信しました" }; },
  async getAiInsight(_siteId, _range, question) {
    await new Promise(resolve => setTimeout(resolve, 450));
    return { answer: `「${question}」について、現在はデモモードです。Firebaseを設定すると実データをもとに分析します。` };
  },
  async analyzeSite() {
    return { analyzedAt: new Date().toISOString(), summary: "サイトの主要な訴求と導線を整理しました。", mainMessage: "戦略から実行まで一気通貫で支援", target: "事業改善を進めたい企業", strengths: ["一気通貫の支援"], trustElements: ["企業情報", "導入事例"], ctas: ["お問い合わせ"], sections: ["FV", "Service", "Case Study", "CTA"], recommendations: ["ターゲット別の導線を明確にする"] };
  },
  async analyzeCompetitors() {
    return { analyzedAt: new Date().toISOString(), common: ["伴走支援"], weakness: ["定量実績の提示"], strength: ["幅広い実行範囲"], opportunity: ["複数施策を一つのデータで改善"], recommendation: "支援範囲の広さを、具体的な成果と結びつけて訴求しましょう。" };
  },
  async getSiteMembers() { return [{ uid: "demo-owner", email: "owner@example.com", role: "mogcia" as const }]; },
  async setSiteMember(_siteId, email, role) { return [{ uid: "demo-owner", email: "owner@example.com", role: "mogcia" as const }, { uid: crypto.randomUUID(), email, role }]; },
  async getGoogleIntegration() { return { connected: false, ga4PropertyId: "", searchConsoleProperty: "", redirectUri: "https://example.invalid/googleOAuthCallback" }; },
  async startGoogleOAuth() { throw new Error("Firebase接続後に利用できます"); },
  async listGoogleResources() { return { properties: [], searchConsoleSites: [] }; },
  async saveGoogleResources() {},
  async getGooglePerformance() { return { ga4: null, searchConsole: null }; },
  async disconnectGoogleIntegration() {},
  async runAiMentionMonitor(_siteId, queries) {
    return { checkedAt: new Date().toISOString(), mentionRate: 50, queries: queries.map((query, index) => ({ query, mentioned: index % 2 === 0, answer: "デモモードのWeb検索結果です。Firebase接続時は実際の検索結果を記録します。", competitors: [], sources: [{ title: "デモ引用元", url: "https://example.com", isOwnSite: false }] })) };
  },
  async runRenewalDiagnosis() {
    return { analyzedAt: new Date().toISOString(), level: "部分改修" as const, score: 68, summary: "全面的に作り直すより、成果につながっているページを残しながら、訴求と導線を部分的に改修する段階です。", reasons: [{ title: "サイトの役割とのずれ", evidence: "問い合わせ獲得に対してCTAと事例への導線が不足しています。" }, { title: "残せる資産がある", evidence: "検索流入と閲覧実績のあるページを確認できています。" }], keep: ["検索流入のある既存ページ", "現在のサービス説明"], fix: ["ファーストビューの訴求", "問い合わせまでの導線"], add: ["実績・事例", "料金や相談方法の説明"], priorityPages: [{ page: "TOP", reason: "役割と主要CTAを明確にする", priority: "High" as const }, { page: "サービス", reason: "事例と問い合わせへの導線を追加する", priority: "Medium" as const }], requirements: [{ category: "設計", items: ["主目的を問い合わせ獲得に設定", "SNS流入向けの導線を用意"] }, { category: "計測", items: ["主要CTAをコンバージョン登録"] }], dataNotes: ["デモモードの診断結果です。"] };
  },
};
