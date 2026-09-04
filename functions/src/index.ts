import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import OpenAI from "openai";
import { lookup } from "node:dns/promises";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

initializeApp();
const db = getFirestore();
const region = "asia-northeast1";
const openAiKey = defineSecret("OPENAI_API_KEY");
const googleOAuthClientId = defineSecret("GOOGLE_OAUTH_CLIENT_ID");
const googleOAuthClientSecret = defineSecret("GOOGLE_OAUTH_CLIENT_SECRET");
const googleTokenEncryptionKey = defineSecret("GOOGLE_TOKEN_ENCRYPTION_KEY");
const openAiModel = "gpt-5.6-luna";
const googleScopes = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
];

function googleRedirectUri() {
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "ismo-67b86";
  return `https://${region}-${projectId}.cloudfunctions.net/googleOAuthCallback`;
}

function encryptSecret(value: string) {
  const key = createHash("sha256").update(googleTokenEncryptionKey.value()).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") };
}

function decryptSecret(value: { ciphertext: string; iv: string; tag: string }) {
  const key = createHash("sha256").update(googleTokenEncryptionKey.value()).digest();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(value.iv, "base64"));
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

type DeviceType = "desktop" | "mobile" | "tablet";
type DateRange = { from: string; to: string };
type IncomingEvent = {
  schemaVersion: 1;
  eventId: string;
  eventName: "page_view" | "engagement" | "click" | "scroll" | "cta_click" | "conversion";
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
  const eventNames = ["page_view", "engagement", "click", "scroll", "cta_click", "conversion"];
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
    documentHeight: number(value.documentHeight, 1, 1000000),
    engagementSeconds: number(value.engagementSeconds, 0, 86400),
    coordinateSpace: value.coordinateSpace === "page" ? "page" : undefined,
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
    const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody.toString("utf8") : "";
    const body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : Buffer.isBuffer(req.body)
        ? JSON.parse(req.body.toString("utf8"))
        : req.body && typeof req.body === "object" && !ArrayBuffer.isView(req.body)
          ? req.body
          : JSON.parse(rawBody);
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
    const retentionDays = Math.min(730, Math.max(30, Number(site.retentionDays ?? 395)));
    const expiresAt = Timestamp.fromMillis(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
    const batch = db.batch();
    for (const event of cleaned) {
      const ref = db.doc(`sites/${siteId}/events/${event.eventId}`);
      const storedEvent = Object.fromEntries(Object.entries(event).filter(([, value]) => value !== undefined));
      batch.set(ref, { ...storedEvent, occurredAt: Timestamp.fromDate(new Date(event.occurredAt)), receivedAt: FieldValue.serverTimestamp(), expiresAt });
    }
    await batch.commit();
    res.status(202).json({ accepted: cleaned.length });
  } catch (error) {
    logger.warn(`Rejected analytics batch: ${error instanceof Error ? error.message : "Unknown error"}`);
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
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return { ...data, occurredAt: data.occurredAt instanceof Timestamp ? data.occurredAt.toDate().toISOString() : String(data.occurredAt) } as IncomingEvent;
  });
}

export const getOverview = onCall({ region, enforceAppCheck: true }, async request => {
  const siteId = requireString(request.data?.siteId, "siteId", 80);
  const site = await requireSiteAccess(request.auth, siteId);
  const events = await loadEvents(siteId, request.data?.range);
  const pageViews = events.filter(event => event.eventName === "page_view");
  const sessions = new Set(events.map(event => event.sessionId));
  const conversions = events.filter(event => event.eventName === "conversion" || Boolean(event.conversionId)).length;
  const attributed = new Set(events.filter(event => event.source && event.source !== "direct").map(event => event.sessionId));
  const engagementBySession = new Map<string, number>();
  for (const event of events) engagementBySession.set(event.sessionId, Math.max(engagementBySession.get(event.sessionId) ?? 0, Number(event.engagementSeconds ?? 0)));
  const table = (keyOf: (event: IncomingEvent) => string) => {
    const groups = new Map<string, { sessions: Set<string>; outcomes: number }>();
    for (const event of events) {
      const key = keyOf(event);
      if (!key) continue;
      const group = groups.get(key) ?? { sessions: new Set<string>(), outcomes: 0 };
      group.sessions.add(event.sessionId);
      if (event.eventName === "conversion" || Boolean(event.conversionId)) group.outcomes += 1;
      groups.set(key, group);
    }
    return Array.from(groups, ([name, group]) => ({ name, sessions: group.sessions.size, outcomes: group.outcomes, rate: group.sessions.size ? Number((group.outcomes / group.sessions.size * 100).toFixed(2)) : 0 }))
      .sort((a, b) => b.sessions - a.sessions).slice(0, 10);
  };
  const trendMap = new Map<string, { sessions: Set<string>; conversions: number }>();
  for (const event of events) {
    const day = event.occurredAt.slice(0, 10);
    const row = trendMap.get(day) ?? { sessions: new Set<string>(), conversions: 0 };
    row.sessions.add(event.sessionId);
    if (event.eventName === "conversion" || event.conversionId) row.conversions += 1;
    trendMap.set(day, row);
  }
  const conversionEvents = events.filter(event => event.eventName === "conversion" || Boolean(event.conversionId));
  const conversionNames = new Map<string, string>((Array.isArray(site.conversionRules) ? site.conversionRules : []).flatMap((rule: unknown) => {
    if (!rule || typeof rule !== "object") return [];
    const value = rule as Record<string, unknown>;
    return typeof value.id === "string" && typeof value.name === "string" ? [[value.id, value.name] as [string, string]] : [];
  }));
  const conversionGroups = new Map<string, { sessions: Set<string>; outcomes: number }>();
  for (const event of conversionEvents) {
    const rawKey = event.conversionId ?? "conversion";
    const key = conversionNames.get(rawKey) ?? rawKey;
    const group = conversionGroups.get(key) ?? { sessions: new Set<string>(), outcomes: 0 };
    group.sessions.add(event.sessionId); group.outcomes += 1; conversionGroups.set(key, group);
  }
  const journeySources = Array.from(new Set(pageViews.map(event => event.source || "direct"))).slice(0, 8);
  const journeys = journeySources.map(source => {
    const sourceViews = pageViews.filter(event => (event.source || "direct") === source);
    const sessionsByPage = new Map<string, Set<string>>();
    for (const event of sourceViews) {
      const set = sessionsByPage.get(event.pagePath) ?? new Set<string>(); set.add(event.sessionId); sessionsByPage.set(event.pagePath, set);
    }
    return { source, pages: Array.from(sessionsByPage, ([name, set]) => ({ name, sessions: set.size })).sort((a, b) => b.sessions - a.sessions).slice(0, 5) };
  }).sort((a, b) => (b.pages[0]?.sessions ?? 0) - (a.pages[0]?.sessions ?? 0));
  return {
    measuredUsers: sessions.size,
    sessions: sessions.size,
    conversions,
    conversionRate: sessions.size ? Number(((conversions / sessions.size) * 100).toFixed(2)) : 0,
    averageEngagementSeconds: sessions.size ? Math.round(Array.from(engagementBySession.values()).reduce((sum, value) => sum + value, 0) / sessions.size) : 0,
    bounceRate: sessions.size ? Number(((Array.from(sessions).filter(id => pageViews.filter(event => event.sessionId === id).length <= 1).length / sessions.size) * 100).toFixed(1)) : 0,
    attributionCoverage: sessions.size ? Number(((attributed.size / sessions.size) * 100).toFixed(1)) : 0,
    trend: Array.from(trendMap, ([day, row]) => ({ day, sessions: row.sessions.size, conversions: row.conversions })).sort((a, b) => a.day.localeCompare(b.day)),
    sources: table(event => event.source || "direct"),
    pages: table(event => event.pagePath),
    conversionGoals: Array.from(conversionGroups, ([name, group]) => ({ name, sessions: group.sessions.size, outcomes: group.outcomes, rate: group.sessions.size ? Number((group.outcomes / group.sessions.size * 100).toFixed(2)) : 0 })).sort((a, b) => b.outcomes - a.outcomes),
    journeys,
    deviceSegments: table(event => event.deviceType),
    dataQuality: {
      lastEventAt: events.map(event => event.occurredAt).sort().at(-1),
      eventCount: events.length,
      taggedPages: new Set(pageViews.map(event => event.pagePath)).size,
      hasConversions: conversions > 0,
      attributionCoverage: sessions.size ? Number(((attributed.size / sessions.size) * 100).toFixed(1)) : 0,
    },
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
  const clicks = events.filter(event => event.coordinateSpace === "page" && typeof event.normalizedX === "number" && typeof event.documentY === "number");
  const scrolls = events.filter(event => typeof event.scrollDepth === "number");
  return {
    pagePath: filters.pagePath ?? "/",
    device: filters.device ?? "mobile",
    sampleSize: sessions.size,
    pageHeight: Math.max(1, ...clicks.map(event => Number(event.documentHeight ?? 0)), ...clicks.map(event => Number(event.documentY ?? 0) + Number(event.viewportHeight ?? 0))),
    points: clicks.slice(0, 2000).map(event => ({
      id: event.eventId,
      x: Number(event.normalizedX) * 100,
      y: Math.min(100, Number(event.documentY) / Math.max(1, Number(event.documentHeight ?? (Number(event.documentY) + Number(event.viewportHeight)))) * 100),
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

async function siteMembers(site: Record<string, unknown>) {
  const uids = Array.isArray(site.memberUids) ? site.memberUids.filter((uid): uid is string => typeof uid === "string").slice(0, 100) : [];
  const result = uids.length ? await getAuth().getUsers(uids.map(uid => ({ uid }))) : { users: [] };
  const roles = site.memberRoles && typeof site.memberRoles === "object" ? site.memberRoles as Record<string, string> : {};
  return result.users.map(user => ({ uid: user.uid, email: user.email ?? "", role: user.uid === site.ownerUid ? "mogcia" : roles[user.uid] === "agency" ? "agency" : "client" }));
}

export const getSiteMembers = onCall({ region, enforceAppCheck: true }, async request => {
  const siteId = requireString(request.data?.siteId, "siteId", 80);
  const site = await requireSiteAccess(request.auth, siteId);
  if (site.ownerUid !== request.auth!.uid) throw new HttpsError("permission-denied", "MOGCIA権限が必要です");
  return { members: await siteMembers(site) };
});

export const setSiteMember = onCall({ region, enforceAppCheck: true }, async request => {
  const siteId = requireString(request.data?.siteId, "siteId", 80);
  const email = requireString(request.data?.email, "email", 320).toLowerCase();
  const role = requireString(request.data?.role, "role", 20);
  if (!["agency", "client"].includes(role)) throw new HttpsError("invalid-argument", "権限が不正です");
  const site = await requireSiteAccess(request.auth, siteId);
  if (site.ownerUid !== request.auth!.uid) throw new HttpsError("permission-denied", "MOGCIA権限が必要です");
  let user;
  try { user = await getAuth().getUserByEmail(email); }
  catch { throw new HttpsError("not-found", "Firebase Authenticationに登録済みのユーザーが見つかりません"); }
  const memberUids = Array.from(new Set([...(Array.isArray(site.memberUids) ? site.memberUids : []), user.uid]));
  const memberRoles = { ...(site.memberRoles ?? {}), [user.uid]: role };
  await db.doc(`sites/${siteId}`).set({ memberUids, memberRoles, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { members: await siteMembers({ ...site, memberUids, memberRoles }) };
});

type EncryptedValue = { ciphertext: string; iv: string; tag: string };

async function googleToken(siteId: string) {
  const ref = db.doc(`sites/${siteId}/privateIntegrations/google`);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new HttpsError("failed-precondition", "Googleアカウントが未接続です");
  const stored = snapshot.data() ?? {};
  if (!stored.refreshToken?.ciphertext) throw new HttpsError("failed-precondition", "Googleの再認証が必要です");
  const body = new URLSearchParams({
    client_id: googleOAuthClientId.value(),
    client_secret: googleOAuthClientSecret.value(),
    refresh_token: decryptSecret(stored.refreshToken as EncryptedValue),
    grant_type: "refresh_token",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(15_000) });
  const result = await response.json() as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !result.access_token) {
    logger.warn("Google token refresh failed", { siteId, status: response.status, error: result.error });
    throw new HttpsError("failed-precondition", "Googleの再認証が必要です");
  }
  return result.access_token;
}

async function googleJson(url: string, accessToken: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json", ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(20_000) });
  const result = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    logger.warn("Google API request failed", { endpoint: new URL(url).hostname, status: response.status });
    throw new HttpsError("failed-precondition", "Google APIからデータを取得できませんでした。権限とAPI設定を確認してください");
  }
  return result;
}

export const startGoogleOAuth = onCall({ region, enforceAppCheck: true, secrets: [googleOAuthClientId] }, async request => {
  const siteId = requireString(request.data?.siteId, "siteId", 80);
  const site = await requireSiteAccess(request.auth, siteId);
  if (site.ownerUid !== request.auth!.uid) throw new HttpsError("permission-denied", "MOGCIA権限が必要です");
  const state = randomBytes(32).toString("base64url");
  await db.doc(`googleOAuthStates/${state}`).set({ siteId, uid: request.auth!.uid, expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60 * 1000), createdAt: FieldValue.serverTimestamp() });
  const query = new URLSearchParams({
    client_id: googleOAuthClientId.value(),
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    scope: googleScopes.join(" "),
    state,
  });
  return { authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${query}`, redirectUri: googleRedirectUri() };
});

export const googleOAuthCallback = onRequest({ region, secrets: [googleOAuthClientId, googleOAuthClientSecret, googleTokenEncryptionKey], timeoutSeconds: 30 }, async (req, res) => {
  const fail = (reason: string) => res.redirect(302, `https://ismo-data.app/?google=error&reason=${encodeURIComponent(reason)}`);
  try {
    const state = requireString(req.query.state, "state", 200);
    const code = requireString(req.query.code, "code", 4000);
    const stateRef = db.doc(`googleOAuthStates/${state}`);
    const stateSnapshot = await stateRef.get();
    const saved = stateSnapshot.data();
    if (!stateSnapshot.exists || !(saved?.expiresAt instanceof Timestamp) || saved.expiresAt.toMillis() < Date.now()) return void fail("state_expired");
    await stateRef.delete();
    const body = new URLSearchParams({ client_id: googleOAuthClientId.value(), client_secret: googleOAuthClientSecret.value(), code, grant_type: "authorization_code", redirect_uri: googleRedirectUri() });
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(15_000) });
    const tokens = await tokenResponse.json() as { refresh_token?: string; scope?: string; error?: string };
    if (!tokenResponse.ok || !tokens.refresh_token) {
      logger.warn("Google OAuth exchange failed", { status: tokenResponse.status, error: tokens.error });
      return void fail(tokens.refresh_token ? "token_exchange" : "refresh_token_missing");
    }
    const siteId = requireString(saved.siteId, "siteId", 80);
    await db.doc(`sites/${siteId}/privateIntegrations/google`).set({ refreshToken: encryptSecret(tokens.refresh_token), scopes: tokens.scope?.split(" ") ?? googleScopes, connectedByUid: saved.uid, connectedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    await db.doc(`sites/${siteId}`).set({ integrations: { googleConnectionStatus: "connected" }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    res.redirect(302, "https://ismo-data.app/?google=connected");
  } catch (error) {
    logger.error("Google OAuth callback failed", { detail: error instanceof Error ? error.message : "unknown" });
    fail("callback_failed");
  }
});

export const getGoogleIntegration = onCall({ region, enforceAppCheck: true }, async request => {
  const siteId = requireString(request.data?.siteId, "siteId", 80);
  const site = await requireSiteAccess(request.auth, siteId);
  const token = await db.doc(`sites/${siteId}/privateIntegrations/google`).get();
  return { connected: token.exists, connectedAt: token.data()?.connectedAt?.toDate?.().toISOString(), ga4PropertyId: site.integrations?.ga4PropertyId ?? "", searchConsoleProperty: site.integrations?.searchConsoleProperty ?? "", redirectUri: googleRedirectUri() };
});

export const listGoogleResources = onCall({ region, enforceAppCheck: true, secrets: [googleOAuthClientId, googleOAuthClientSecret, googleTokenEncryptionKey], timeoutSeconds: 45 }, async request => {
  const siteId = requireString(request.data?.siteId, "siteId", 80);
  await requireSiteAccess(request.auth, siteId);
  const accessToken = await googleToken(siteId);
  const [analytics, search] = await Promise.all([
    googleJson("https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200", accessToken),
    googleJson("https://www.googleapis.com/webmasters/v3/sites", accessToken),
  ]);
  const properties = ((analytics.accountSummaries as Array<Record<string, unknown>> | undefined) ?? []).flatMap(account => ((account.propertySummaries as Array<Record<string, unknown>> | undefined) ?? []).map(property => ({ id: String(property.property ?? "").replace("properties/", ""), name: String(property.displayName ?? property.property ?? "") }))).filter(item => item.id);
  const searchConsoleSites = ((search.siteEntry as Array<Record<string, unknown>> | undefined) ?? []).map(site => ({ url: String(site.siteUrl ?? ""), permission: String(site.permissionLevel ?? "") })).filter(item => item.url);
  return { properties, searchConsoleSites };
});

export const saveGoogleResources = onCall({ region, enforceAppCheck: true }, async request => {
  const siteId = requireString(request.data?.siteId, "siteId", 80);
  const site = await requireSiteAccess(request.auth, siteId);
  if (site.ownerUid !== request.auth!.uid) throw new HttpsError("permission-denied", "MOGCIA権限が必要です");
  const ga4PropertyId = cleanOptional(request.data?.ga4PropertyId, 80) ?? "";
  const searchConsoleProperty = cleanOptional(request.data?.searchConsoleProperty, 500) ?? "";
  await db.doc(`sites/${siteId}`).set({ integrations: { googleConnectionStatus: "connected", ga4PropertyId, searchConsoleProperty }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true };
});

export const getGooglePerformance = onCall({ region, enforceAppCheck: true, secrets: [googleOAuthClientId, googleOAuthClientSecret, googleTokenEncryptionKey], timeoutSeconds: 45 }, async request => {
  const siteId = requireString(request.data?.siteId, "siteId", 80);
  const site = await requireSiteAccess(request.auth, siteId);
  const range = request.data?.range as Partial<DateRange> | undefined;
  parseRange(range);
  const from = requireString(range?.from, "from", 10);
  const to = requireString(range?.to, "to", 10);
  const accessToken = await googleToken(siteId);
  const ga4PropertyId = cleanOptional(site.integrations?.ga4PropertyId, 80);
  const searchConsoleProperty = cleanOptional(site.integrations?.searchConsoleProperty, 500);
  const ga4 = ga4PropertyId ? await googleJson(`https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(ga4PropertyId)}:runReport`, accessToken, { method: "POST", body: JSON.stringify({ dateRanges: [{ startDate: from, endDate: to }], dimensions: [{ name: "sessionDefaultChannelGroup" }], metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" }], limit: 20 }) }) : null;
  const search = searchConsoleProperty ? await googleJson(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(searchConsoleProperty)}/searchAnalytics/query`, accessToken, { method: "POST", body: JSON.stringify({ startDate: from, endDate: to, dimensions: ["query"], rowLimit: 10 }) }) : null;
  const gaRows = ((ga4?.rows as Array<Record<string, unknown>> | undefined) ?? []).map(row => ({
    channel: String((row.dimensionValues as Array<{ value?: string }> | undefined)?.[0]?.value ?? "Unknown"),
    activeUsers: Number((row.metricValues as Array<{ value?: string }> | undefined)?.[0]?.value ?? 0),
    sessions: Number((row.metricValues as Array<{ value?: string }> | undefined)?.[1]?.value ?? 0),
    views: Number((row.metricValues as Array<{ value?: string }> | undefined)?.[2]?.value ?? 0),
  }));
  const searchRows = ((search?.rows as Array<Record<string, unknown>> | undefined) ?? []).map(row => ({ query: String((row.keys as string[] | undefined)?.[0] ?? ""), clicks: Number(row.clicks ?? 0), impressions: Number(row.impressions ?? 0), ctr: Number((Number(row.ctr ?? 0) * 100).toFixed(2)), position: Number(Number(row.position ?? 0).toFixed(1)) }));
  return { ga4: ga4PropertyId ? { propertyId: ga4PropertyId, rows: gaRows } : null, searchConsole: searchConsoleProperty ? { property: searchConsoleProperty, rows: searchRows } : null };
});

export const disconnectGoogleIntegration = onCall({ region, enforceAppCheck: true }, async request => {
  const siteId = requireString(request.data?.siteId, "siteId", 80);
  const site = await requireSiteAccess(request.auth, siteId);
  if (site.ownerUid !== request.auth!.uid) throw new HttpsError("permission-denied", "MOGCIA権限が必要です");
  await db.doc(`sites/${siteId}/privateIntegrations/google`).delete();
  await db.doc(`sites/${siteId}`).set({ integrations: { googleConnectionStatus: "not_connected", ga4PropertyId: "", searchConsoleProperty: "" }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true };
});

async function publicSiteUrl(value: string) {
  const source = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(source);
  const host = url.hostname.toLowerCase();
  if (!["http:", "https:"].includes(url.protocol) || host === "localhost" || host.endsWith(".local") || /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    throw new HttpsError("invalid-argument", "公開サイトのURLを指定してください");
  }
  const addresses = await lookup(host, { all: true });
  if (!addresses.length || addresses.some(({ address }) => /^(127\.|10\.|192\.168\.|169\.254\.|0\.|::1$|fc|fd|fe80)/i.test(address) || /^172\.(1[6-9]|2\d|3[01])\./.test(address))) {
    throw new HttpsError("invalid-argument", "公開サイトのURLを指定してください");
  }
  return url;
}

async function pageDocument(value: string) {
  let url = await publicSiteUrl(value);
  let response: Response | undefined;
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(12_000), headers: { "user-agent": "ismo-site-analysis/1.0" } });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get("location");
    if (!location || redirects === 5) throw new HttpsError("failed-precondition", "サイトのリダイレクトを解決できませんでした");
    url = await publicSiteUrl(new URL(location, url).toString());
  }
  if (!response) throw new HttpsError("failed-precondition", "サイトを取得できませんでした");
  if (!response.ok || !(response.headers.get("content-type") ?? "").includes("text/html")) throw new HttpsError("failed-precondition", `${url.hostname}を取得できませんでした`);
  const html = (await response.text()).slice(0, 250_000);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ?? url.pathname;
  const links = Array.from(html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi), match => {
    try { return new URL(match[1], url).toString(); } catch { return ""; }
  }).filter(link => link && new URL(link).origin === url.origin);
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().slice(0, 45_000);
  return { url: url.toString(), title, text, links: Array.from(new Set(links)) };
}

async function pageText(value: string) { return (await pageDocument(value)).text; }

async function crawlSite(value: string, limit = 12) {
  const first = await pageDocument(value);
  const queue = [...first.links];
  const pages = [first];
  const visited = new Set([first.url]);
  while (queue.length && pages.length < limit) {
    const next = queue.shift()!;
    if (visited.has(next)) continue;
    visited.add(next);
    try {
      const page = await pageDocument(next);
      pages.push(page);
      for (const link of page.links) if (!visited.has(link) && queue.length < 80) queue.push(link);
    } catch (error) { logger.debug(`Skipped crawl page ${next}: ${error instanceof Error ? error.message : "unknown"}`); }
  }
  return pages.map(page => ({ url: page.url, title: page.title, text: page.text.slice(0, 9000) }));
}

function structuredJson(text: string) {
  try { return JSON.parse(text.replace(/^```json\s*|\s*```$/g, "")); }
  catch { throw new HttpsError("internal", "AI分析結果を整形できませんでした"); }
}

export const analyzeSite = onCall({ region, enforceAppCheck: true, secrets: [openAiKey], timeoutSeconds: 90, maxInstances: 5 }, async request => {
  try {
    const siteId = requireString(request.data?.siteId, "siteId", 80);
    const site = await requireSiteAccess(request.auth, siteId);
    if (site.ownerUid !== request.auth!.uid) throw new HttpsError("permission-denied", "MOGCIA権限が必要です");
    const pages = await crawlSite(requireString(site.domain, "domain", 500));
    const client = new OpenAI({ apiKey: openAiKey.value() });
    const response = await client.responses.create({ model: openAiModel, reasoning: { effort: "low" }, text: { format: { type: "json_object" }, verbosity: "low" }, max_output_tokens: 3000, input: [
      { role: "system", content: "Webサイトの公開文言だけを根拠に分析します。JSONだけを返し、書かれていない事実を作らないでください。" },
      { role: "user", content: `Strategy: ${JSON.stringify(site.strategy ?? {})}\nCrawled pages: ${JSON.stringify(pages)}\nJSON schema: {"summary":"string","mainMessage":"string","target":"string","strengths":["string"],"trustElements":["string"],"ctas":["string"],"sections":["FV|Problem|Solution|Service|Feature|Price|Case Study|FAQ|CTA"],"recommendations":["string"],"pages":[{"url":"string","title":"string","summary":"string"}]}` },
    ] });
    if (!response.output_text.trim()) throw new Error(`OpenAI returned no text (${response.status})`);
    const result = { analyzedAt: new Date().toISOString(), ...structuredJson(response.output_text) };
    const history = Array.isArray(site.analysisHistory) ? site.analysisHistory.slice(0, 9) : [];
    await db.doc(`sites/${siteId}`).set({ siteAnalysis: result, analysisHistory: [result, ...history], updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return result;
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    const detail = error instanceof Error ? error.message : "Unknown error";
    logger.error("analyzeSite failed", { detail });
    throw new HttpsError("internal", "サイト分析に失敗しました。しばらくしてから再度お試しください");
  }
});

export const analyzeCompetitors = onCall({ region, enforceAppCheck: true, secrets: [openAiKey], timeoutSeconds: 120, maxInstances: 3 }, async request => {
  const siteId = requireString(request.data?.siteId, "siteId", 80);
  const site = await requireSiteAccess(request.auth, siteId);
  if (site.ownerUid !== request.auth!.uid) throw new HttpsError("permission-denied", "MOGCIA権限が必要です");
  const competitors = Array.isArray(site.competitors) ? site.competitors.slice(0, 5) : [];
  if (!competitors.length) throw new HttpsError("failed-precondition", "競合サイトを1件以上登録してください");
  const pages = await Promise.all([{ name: "自社", url: site.domain }, ...competitors.map((item: Record<string, unknown>) => ({ name: String(item.name ?? "競合"), url: String(item.url ?? "") }))].map(async item => ({ name: item.name, text: await pageText(item.url) })));
  const client = new OpenAI({ apiKey: openAiKey.value() });
  const response = await client.responses.create({ model: openAiModel, reasoning: { effort: "low" }, text: { format: { type: "json_object" }, verbosity: "low" }, max_output_tokens: 3000, input: [
    { role: "system", content: "自社と競合の公開Webサイトを比較します。事実と推論を混同せず、JSONだけを返してください。競合が触れていないことだけで市場機会と断定しないでください。" },
    { role: "user", content: `Strategy: ${JSON.stringify(site.strategy ?? {})}\nPages: ${JSON.stringify(pages)}\nJSON schema: {"common":["string"],"weakness":["string"],"strength":["string"],"opportunity":["string"],"recommendation":"string","positioning":[{"name":"string","x":0-100,"y":0-100}]}` },
  ] });
  const result = { analyzedAt: new Date().toISOString(), ...structuredJson(response.output_text) };
  const history = Array.isArray(site.competitorHistory) ? site.competitorHistory.slice(0, 9) : [];
  await db.doc(`sites/${siteId}`).set({ competitorAnalysis: result, competitorHistory: [result, ...history], updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return result;
});

export const getAiInsight = onCall({ region, enforceAppCheck: true, secrets: [openAiKey], timeoutSeconds: 60, maxInstances: 10 }, async request => {
  const siteId = requireString(request.data?.siteId, "siteId", 80);
  const question = requireString(request.data?.question, "question", 500);
  await requireSiteAccess(request.auth, siteId);
  const quotaId = `${request.auth!.uid}_${new Date().toISOString().slice(0, 10)}`;
  await db.runTransaction(async transaction => {
    const ref = db.doc(`sites/${siteId}/aiUsage/${quotaId}`);
    const snapshot = await transaction.get(ref);
    const count = Number(snapshot.data()?.count ?? 0);
    if (count >= 20) throw new HttpsError("resource-exhausted", "AI分析は1日20回までです");
    transaction.set(ref, { count: count + 1, uid: request.auth!.uid, day: new Date().toISOString().slice(0, 10), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
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
    model: openAiModel,
    max_output_tokens: 700,
    input: [
      { role: "system", content: "あなたはWeb解析担当です。提供された集計値だけを根拠に、日本語で簡潔に回答してください。個人の推測、存在しない比較値、断定的な因果関係を作らないでください。回答は現状、根拠、推奨アクションの順にしてください。" },
      { role: "user", content: `質問: ${question}\n集計値: ${JSON.stringify(summary)}` },
    ],
  });
  return { answer: response.output_text, usage: response.usage ?? null };
});
