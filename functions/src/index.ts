import { initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { defineSecret, defineString } from "firebase-functions/params";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import OpenAI from "openai";

initializeApp();
const db = getFirestore();
const region = "asia-northeast1";
const openAiKey = defineSecret("OPENAI_API_KEY");
const openAiModel = defineString("OPENAI_MODEL", { default: "gpt-5.6-luna" });

type DeviceType = "desktop" | "mobile" | "tablet";
type DateRange = { from: string; to: string };
type IncomingEvent = {
  schemaVersion: 1;
  eventId: string;
  eventName: "page_view" | "click" | "scroll" | "cta_click" | "conversion";
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

function requireString(value: unknown, name: string, max = 200): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(`Invalid ${name}`);
  }
  return value.trim();
}

function cleanOptional(value: unknown, max = 200): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim().slice(0, max);
  return cleaned || undefined;
}

function cleanEvent(raw: unknown, expectedSiteId: string): IncomingEvent {
  if (!raw || typeof raw !== "object") throw new Error("Invalid event");
  const value = raw as Record<string, unknown>;
  const eventNames = ["page_view", "click", "scroll", "cta_click", "conversion"];
  const deviceTypes = ["desktop", "mobile", "tablet"];
  const eventName = requireString(value.eventName, "eventName", 32);
  const deviceType = requireString(value.deviceType, "deviceType", 16);
  const occurredAt = requireString(value.occurredAt, "occurredAt", 40);
  const date = new Date(occurredAt);
  if (!eventNames.includes(eventName) || !deviceTypes.includes(deviceType) || Number.isNaN(date.valueOf())) throw new Error("Invalid event fields");
  if (Math.abs(Date.now() - date.valueOf()) > 7 * 24 * 60 * 60 * 1000) throw new Error("Event timestamp out of range");
  if (requireString(value.siteId, "siteId", 80) !== expectedSiteId || value.consent !== true) throw new Error("Invalid site or consent");

  const number = (input: unknown, min: number, max: number) =>
    typeof input === "number" && Number.isFinite(input) && input >= min && input <= max ? input : undefined;

  return {
    schemaVersion: 1,
    eventId: requireString(value.eventId, "eventId", 80),
    eventName: eventName as IncomingEvent["eventName"],
    siteId: expectedSiteId,
    sessionId: requireString(value.sessionId, "sessionId", 80),
    occurredAt,
    pagePath: requireString(value.pagePath, "pagePath", 500),
    pageTitle: cleanOptional(value.pageTitle, 120),
    referrer: cleanOptional(value.referrer, 500),
    source: cleanOptional(value.source, 120),
    medium: cleanOptional(value.medium, 120),
    campaign: cleanOptional(value.campaign, 120),
    deviceType: deviceType as DeviceType,
    viewportWidth: number(value.viewportWidth, 1, 10000) ?? 0,
    viewportHeight: number(value.viewportHeight, 1, 10000) ?? 0,
    elementId: cleanOptional(value.elementId, 120),
    elementTag: cleanOptional(value.elementTag, 40),
    elementText: cleanOptional(value.elementText, 80),
    normalizedX: number(value.normalizedX, 0, 1),
    normalizedY: number(value.normalizedY, 0, 1),
    documentY: number(value.documentY, 0, 1000000),
    scrollDepth: number(value.scrollDepth, 0, 100),
    conversionId: cleanOptional(value.conversionId, 120),
    consent: true,
  };
}

function normalizeHost(input: string): string {
  try { return new URL(input.includes("://") ? input : `https://${input}`).hostname.toLowerCase(); }
  catch { return ""; }
}

function setCors(res: { set(field: string, value: string): unknown }, origin?: string) {
  if (origin) res.set("Access-Control-Allow-Origin", origin);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Access-Control-Max-Age", "3600");
}

export const collect = onRequest({ region, cors: false, maxInstances: 20, timeoutSeconds: 15 }, async (req, res) => {
  if (req.method === "OPTIONS") {
    setCors(res, req.get("origin"));
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  if (Number(req.get("content-length") ?? 0) > 64_000) { res.status(413).json({ error: "Payload too large" }); return; }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const events = Array.isArray(body?.events) ? body.events : [];
    if (body?.schemaVersion !== 1 || events.length < 1 || events.length > 20) throw new Error("Invalid batch");
    const siteId = requireString(events[0]?.siteId, "siteId", 80);
    const siteSnapshot = await db.doc(`sites/${siteId}`).get();
    if (!siteSnapshot.exists) { res.status(404).json({ error: "Unknown site" }); return; }
    const site = siteSnapshot.data() ?? {};
    const requestOrigin = req.get("origin") ?? "";
    const allowedHost = normalizeHost(String(site.domain ?? ""));
    if (!requestOrigin || normalizeHost(requestOrigin) !== allowedHost) { res.status(403).json({ error: "Origin not allowed" }); return; }
    setCors(res, requestOrigin);

    const cleaned = events.map((event: unknown) => applyConversionRules(cleanEvent(event, siteId), site.conversionRules));
    const batch = db.batch();
    for (const event of cleaned) {
      const ref = db.doc(`sites/${siteId}/events/${event.eventId}`);
      batch.set(ref, { ...event, occurredAt: Timestamp.fromDate(new Date(event.occurredAt)), receivedAt: FieldValue.serverTimestamp() });
    }
    await batch.commit();
    res.status(202).json({ accepted: cleaned.length });
  } catch (error) {
    logger.warn("Rejected analytics batch", { message: error instanceof Error ? error.message : "Unknown error" });
    res.status(400).json({ error: "Invalid analytics payload" });
  }
});

async function requireSiteAccess(auth: { uid: string } | undefined, siteId: string) {
  if (!auth) throw new HttpsError("unauthenticated", "ログインが必要です");
  const snapshot = await db.doc(`sites/${siteId}`).get();
  if (!snapshot.exists) throw new HttpsError("not-found", "サイト設定が見つかりません");
  const site = snapshot.data() ?? {};
  const isMember = Array.isArray(site.memberUids) && site.memberUids.includes(auth.uid);
  if (site.ownerUid !== auth.uid && !isMember) {
    throw new HttpsError("permission-denied", "このサイトへのアクセス権がありません");
  }
  return site;
}

function applyConversionRules(event: IncomingEvent, rules: unknown): IncomingEvent {
  if (event.conversionId || !Array.isArray(rules)) return event;
  const match = rules.find(raw => {
    if (!raw || typeof raw !== "object") return false;
    const rule = raw as Record<string, unknown>;
    if (rule.enabled !== true || typeof rule.id !== "string" || typeof rule.matchValue !== "string") return false;
    if (rule.matchType === "url_exact") return event.pagePath === rule.matchValue;
    if (rule.matchType === "url_contains") return event.pagePath.includes(rule.matchValue);
    if (rule.matchType === "event") return event.eventName === rule.matchValue || event.eventName === rule.eventName;
    if (rule.matchType === "selector") return event.elementId === rule.matchValue.replace(/^#/, "");
    return false;
  }) as Record<string, unknown> | undefined;
  return match ? { ...event, conversionId: String(match.id) } : event;
}

function parseRange(input: unknown): { from: Timestamp; to: Timestamp } {
  const range = input as Partial<DateRange> | undefined;
  const fromDate = new Date(`${range?.from ?? ""}T00:00:00.000Z`);
  const toDate = new Date(`${range?.to ?? ""}T23:59:59.999Z`);
  if (Number.isNaN(fromDate.valueOf()) || Number.isNaN(toDate.valueOf()) || fromDate > toDate) throw new HttpsError("invalid-argument", "期間が不正です");
  if (toDate.valueOf() - fromDate.valueOf() > 93 * 24 * 60 * 60 * 1000) throw new HttpsError("invalid-argument", "期間は93日以内にしてください");
  return { from: Timestamp.fromDate(fromDate), to: Timestamp.fromDate(toDate) };
}

async function loadEvents(siteId: string, input: unknown, limit = 50_000) {
  const range = parseRange(input);
  const snapshot = await db.collection(`sites/${siteId}/events`)
    .where("occurredAt", ">=", range.from).where("occurredAt", "<=", range.to).limit(limit).get();
  return snapshot.docs.map(doc => doc.data() as IncomingEvent);
}

export const getOverview = onCall({ region, enforceAppCheck: true }, async request => {
  const siteId = requireString(request.data?.siteId, "siteId", 80);
  await requireSiteAccess(request.auth, siteId);
  const events = await loadEvents(siteId, request.data?.range);
  const pageViews = events.filter(event => event.eventName === "page_view");
  const sessions = new Set(events.map(event => event.sessionId));
  const conversions = events.filter(event => event.eventName === "conversion" || Boolean(event.conversionId)).length;
  const attributed = new Set(events.filter(event => event.source && event.source !== "direct").map(event => event.sessionId));
  return {
    measuredUsers: sessions.size,
    sessions: sessions.size,
    conversions,
    conversionRate: sessions.size ? Number(((conversions / sessions.size) * 100).toFixed(2)) : 0,
    averageEngagementSeconds: 0,
    bounceRate: sessions.size ? Number(((Array.from(sessions).filter(id => pageViews.filter(event => event.sessionId === id).length <= 1).length / sessions.size) * 100).toFixed(1)) : 0,
    attributionCoverage: sessions.size ? Number(((attributed.size / sessions.size) * 100).toFixed(1)) : 0,
  };
});

export const getHeatmap = onCall({ region, enforceAppCheck: true }, async request => {
  const siteId = requireString(request.data?.siteId, "siteId", 80);
  await requireSiteAccess(request.auth, siteId);
  let events = await loadEvents(siteId, request.data?.range);
  const filters = request.data?.filters ?? {};
  if (filters.device) events = events.filter(event => event.deviceType === filters.device);
  if (filters.pagePath) events = events.filter(event => event.pagePath === filters.pagePath);
  if (filters.source) events = events.filter(event => event.source === filters.source);
  const sessions = new Set(events.map(event => event.sessionId));
  const clicks = events.filter(event => typeof event.normalizedX === "number" && typeof event.documentY === "number");
  const scrolls = events.filter(event => typeof event.scrollDepth === "number");
  return {
    pagePath: filters.pagePath ?? "/",
    device: filters.device ?? "mobile",
    sampleSize: sessions.size,
    pageHeight: Math.max(1280, ...clicks.map(event => Number(event.documentY ?? 0) + Number(event.viewportHeight ?? 0))),
    points: clicks.slice(0, 2000).map(event => ({
      id: event.eventId,
      x: Number(event.normalizedX) * 100,
      y: Number(event.documentY),
      weight: 0.6,
      elementId: event.elementId,
    })),
    scrollReach: [25, 50, 75, 90].map(depth => ({
      depth,
      percentage: sessions.size ? Number((new Set(scrolls.filter(event => Number(event.scrollDepth) >= depth).map(event => event.sessionId)).size / sessions.size * 100).toFixed(1)) : 0,
    })),
  };
});

export const testMeasurement = onCall({ region, enforceAppCheck: true }, async request => {
  const siteId = requireString(request.data?.siteId, "siteId", 80);
  await requireSiteAccess(request.auth, siteId);
  const latest = await db.collection(`sites/${siteId}/events`).orderBy("receivedAt", "desc").limit(1).get();
  const data = latest.docs[0]?.data();
  return latest.empty
    ? { ok: false, message: "まだイベントを受信していません" }
    : { ok: true, receivedAt: data?.receivedAt?.toDate?.().toISOString(), message: "イベントを受信しました" };
});

export const getAiInsight = onCall({ region, enforceAppCheck: true, secrets: [openAiKey], timeoutSeconds: 60, maxInstances: 10 }, async request => {
  const siteId = requireString(request.data?.siteId, "siteId", 80);
  const question = requireString(request.data?.question, "question", 500);
  await requireSiteAccess(request.auth, siteId);
  const events = await loadEvents(siteId, request.data?.range, 20_000);
  const sessions = new Set(events.map(event => event.sessionId));
  const summary = {
    sessions: sessions.size,
    pageViews: events.filter(event => event.eventName === "page_view").length,
    conversions: events.filter(event => event.eventName === "conversion" || Boolean(event.conversionId)).length,
    sources: Object.entries(events.reduce<Record<string, number>>((acc, event) => {
      const key = event.source ?? "unknown"; acc[key] = (acc[key] ?? 0) + 1; return acc;
    }, {})).sort((a, b) => b[1] - a[1]).slice(0, 10),
  };
  const client = new OpenAI({ apiKey: openAiKey.value() });
  const response = await client.responses.create({
    model: openAiModel.value(),
    max_output_tokens: 700,
    input: [
      { role: "system", content: "あなたはWeb解析担当です。提供された集計値だけを根拠に、日本語で簡潔に回答してください。個人の推測、存在しない比較値、断定的な因果関係を作らないでください。回答は現状、根拠、推奨アクションの順にしてください。" },
      { role: "user", content: `質問: ${question}\n集計値: ${JSON.stringify(summary)}` },
    ],
  });
  return { answer: response.output_text, usage: response.usage ?? null };
});
