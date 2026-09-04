import { doc, getDoc, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirebaseServices } from "@/lib/firebase/client";
import type { AnalyticsProvider } from "./provider";
import type { CompetitorAnalysisResult, HeatmapSnapshot, OverviewSnapshot, SiteAnalysisResult, SiteMember, SiteSettings } from "./types";

export const firebaseAnalyticsProvider: AnalyticsProvider = {
  async getOverview(siteId, range) {
    const { functions } = getFirebaseServices();
    const result = await httpsCallable<{ siteId: string; range: typeof range }, OverviewSnapshot>(functions, "getOverview")({ siteId, range });
    return result.data;
  },
  async getHeatmap(siteId, range, filters) {
    const { functions } = getFirebaseServices();
    const result = await httpsCallable<{ siteId: string; range: typeof range; filters: typeof filters }, HeatmapSnapshot>(functions, "getHeatmap")({ siteId, range, filters });
    return result.data;
  },
  async getSiteSettings(siteId) {
    const { db } = getFirebaseServices();
    const snapshot = await getDoc(doc(db, "sites", siteId));
    if (!snapshot.exists()) throw new Error("サイト設定が見つかりません");
    return { id: snapshot.id, ...snapshot.data() } as SiteSettings;
  },
  async saveSiteSettings(settings) {
    const { db } = getFirebaseServices();
    await setDoc(doc(db, "sites", settings.id), settings, { merge: true });
  },
  async testConnection(siteId) {
    const { functions } = getFirebaseServices();
    const result = await httpsCallable<{ siteId: string }, { ok: boolean; receivedAt?: string; message: string }>(functions, "testMeasurement")({ siteId });
    return result.data;
  },
  async getAiInsight(siteId, range, question) {
    const { functions } = getFirebaseServices();
    const result = await httpsCallable<{ siteId: string; range: typeof range; question: string }, { answer: string; usage?: unknown }>(functions, "getAiInsight")({ siteId, range, question });
    return result.data;
  },
  async analyzeSite(siteId) {
    const { functions } = getFirebaseServices();
    const result = await httpsCallable<{ siteId: string }, SiteAnalysisResult>(functions, "analyzeSite")({ siteId });
    return result.data;
  },
  async analyzeCompetitors(siteId) {
    const { functions } = getFirebaseServices();
    const result = await httpsCallable<{ siteId: string }, CompetitorAnalysisResult>(functions, "analyzeCompetitors")({ siteId });
    return result.data;
  },
  async getSiteMembers(siteId) {
    const { functions } = getFirebaseServices();
    const result = await httpsCallable<{ siteId: string }, { members: SiteMember[] }>(functions, "getSiteMembers")({ siteId });
    return result.data.members;
  },
  async setSiteMember(siteId, email, role) {
    const { functions } = getFirebaseServices();
    const result = await httpsCallable<{ siteId: string; email: string; role: SiteMember["role"] }, { members: SiteMember[] }>(functions, "setSiteMember")({ siteId, email, role });
    return result.data.members;
  },
};
