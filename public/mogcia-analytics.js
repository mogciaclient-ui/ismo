(function () {
  "use strict";

  var script = document.currentScript;
  if (!script || window.MogciaAnalytics) return;

  var config = {
    siteId: script.dataset.siteId || "",
    endpoint: script.dataset.endpoint || "/api/collect",
    consentMode: script.dataset.consentMode || "required",
    privacyUrl: script.dataset.privacyUrl || "",
    debug: script.dataset.debug === "true",
  };
  if (!config.siteId) return;

  var STORAGE_KEY = "mogcia_session_id";
  var CONSENT_KEY = "mogcia_analytics_consent";
  var queue = [];
  var scrollSent = {};
  var flushTimer;
  var sessionId;
  var consentBanner;
  var pageStartedAt = Date.now();
  var lastPath = location.pathname;

  function uuid() {
    return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
  function getSessionId() {
    try {
      var stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) return stored;
      var id = uuid();
      sessionStorage.setItem(STORAGE_KEY, id);
      return id;
    } catch (_) { return uuid(); }
  }
  function consentState() {
    try { return localStorage.getItem(CONSENT_KEY); }
    catch (_) { return null; }
  }
  function hasConsent() {
    return config.consentMode === "analytics_only" || consentState() === "granted";
  }
  function deviceType() {
    return innerWidth < 768 ? "mobile" : innerWidth < 1100 ? "tablet" : "desktop";
  }
  function attribution() {
    var p = new URLSearchParams(location.search);
    var ref = document.referrer;
    var source = p.get("utm_source") || (ref ? new URL(ref).hostname : "direct");
    return { source: source, medium: p.get("utm_medium") || undefined, campaign: p.get("utm_campaign") || undefined };
  }
  function safeReferrer() {
    if (!document.referrer) return undefined;
    try { var url = new URL(document.referrer); return url.origin + url.pathname; }
    catch (_) { return undefined; }
  }
  function base(eventName) {
    var attr = attribution();
    return {
      schemaVersion: 1,
      eventId: uuid(),
      eventName: eventName,
      siteId: config.siteId,
      sessionId: sessionId || (sessionId = getSessionId()),
      occurredAt: new Date().toISOString(),
      pagePath: location.pathname,
      referrer: safeReferrer(),
      source: attr.source,
      medium: attr.medium,
      campaign: attr.campaign,
      deviceType: deviceType(),
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      documentHeight: Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0),
      consent: true,
    };
  }
  function track(eventName, properties) {
    if (!hasConsent()) return false;
    queue.push(Object.assign(base(eventName), properties || {}));
    if (config.debug) console.info("[MOGCIA]", queue[queue.length - 1]);
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 1200);
    if (queue.length >= 10) flush();
    return true;
  }
  function flush() {
    if (!queue.length) return;
    var batch = queue.splice(0, 20);
    var body = JSON.stringify({ schemaVersion: 1, events: batch });
    if (!navigator.sendBeacon || !navigator.sendBeacon(config.endpoint, new Blob([body], { type: "application/json" }))) {
      fetch(config.endpoint, { method: "POST", body: body, headers: { "content-type": "application/json" }, keepalive: true, credentials: "omit" }).catch(function () { queue.unshift.apply(queue, batch); });
    }
  }
  function onClick(event) {
    var element = event.target && event.target.closest ? event.target.closest("a,button,[data-mogcia-event]") : null;
    if (!element) return;
    var rect = element.getBoundingClientRect();
    var eventName = element.dataset.mogciaEvent ? "cta_click" : "click";
    track(eventName, {
      elementId: element.dataset.mogciaId || element.id || undefined,
      elementTag: element.tagName.toLowerCase(),
      normalizedX: innerWidth ? Math.max(0, Math.min(1, event.clientX / innerWidth)) : undefined,
      normalizedY: rect.height ? Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) : undefined,
      documentY: Math.round(event.clientY + scrollY),
      coordinateSpace: "page",
      elementText: (element.getAttribute("aria-label") || element.textContent || "").trim().slice(0, 80) || undefined,
      conversionId: element.dataset.mogciaEvent || undefined,
    });
  }
  function onScroll() {
    var height = Math.max(document.documentElement.scrollHeight - innerHeight, 1);
    var depth = Math.round((scrollY / height) * 100);
    [25, 50, 75, 90].forEach(function (mark) {
      if (depth >= mark && !scrollSent[mark]) { scrollSent[mark] = true; track("scroll", { scrollDepth: mark }); }
    });
  }
  function consent(value) {
    try { localStorage.setItem(CONSENT_KEY, value ? "granted" : "denied"); }
    catch (_) { /* Continue with the current-page choice when storage is unavailable. */ }
    if (consentBanner) { consentBanner.remove(); consentBanner = null; }
    if (value) track("page_view");
    else queue.length = 0;
  }
  function trackEngagement() {
    if (!hasConsent()) return;
    var seconds = Math.min(86400, Math.round((Date.now() - pageStartedAt) / 1000));
    if (seconds > 0) track("engagement", { engagementSeconds: seconds });
  }
  function routeChanged() {
    if (location.pathname === lastPath) return;
    trackEngagement();
    lastPath = location.pathname;
    pageStartedAt = Date.now();
    scrollSent = {};
    track("page_view");
  }
  ["pushState", "replaceState"].forEach(function (method) {
    var original = history[method];
    history[method] = function () { var result = original.apply(this, arguments); setTimeout(routeChanged, 0); return result; };
  });
  function showConsent(force) {
    if (config.consentMode !== "required" || consentBanner || (!force && consentState() !== null)) return;
    var host = document.createElement("div");
    host.id = "mogcia-consent";
    host.setAttribute("role", "dialog");
    host.setAttribute("aria-label", "アクセス解析の設定");
    host.style.cssText = "position:fixed;z-index:2147483647;left:16px;right:16px;bottom:16px;display:flex;justify-content:center;pointer-events:none";
    var panel = document.createElement("div");
    panel.style.cssText = "box-sizing:border-box;display:flex;align-items:center;gap:20px;width:min(720px,100%);padding:18px 20px;border:1px solid #dedcd4;border-radius:14px;background:#fff;color:#242422;box-shadow:0 16px 50px rgba(0,0,0,.16);font:13px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans JP',sans-serif;pointer-events:auto";
    var copy = document.createElement("div");
    copy.style.cssText = "flex:1;min-width:0";
    var title = document.createElement("strong");
    title.textContent = "アクセス解析について";
    title.style.cssText = "display:block;margin-bottom:3px;font-size:14px";
    var description = document.createElement("span");
    description.textContent = "サイト改善のため、個人を特定しない形で閲覧状況を計測します。";
    copy.appendChild(title);
    copy.appendChild(description);
    if (config.privacyUrl) {
      var privacy = document.createElement("a");
      privacy.href = config.privacyUrl;
      privacy.textContent = " 詳細を見る";
      privacy.style.cssText = "color:#4d681d;text-decoration:underline;white-space:nowrap";
      copy.appendChild(privacy);
    }
    var actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px;flex:none";
    var deny = document.createElement("button");
    deny.type = "button";
    deny.textContent = "拒否する";
    deny.setAttribute("data-mogcia-consent", "deny");
    deny.style.cssText = "padding:10px 14px;border:1px solid #d8d6ce;border-radius:8px;background:#fff;color:#555;font:inherit;cursor:pointer";
    deny.addEventListener("click", function () { consent(false); });
    var accept = document.createElement("button");
    accept.type = "button";
    accept.textContent = "許可する";
    accept.setAttribute("data-mogcia-consent", "accept");
    accept.style.cssText = "padding:10px 16px;border:1px solid #242422;border-radius:8px;background:#242422;color:#fff;font:inherit;font-weight:700;cursor:pointer";
    accept.addEventListener("click", function () { consent(true); });
    actions.appendChild(deny);
    actions.appendChild(accept);
    panel.appendChild(copy);
    panel.appendChild(actions);
    host.appendChild(panel);
    document.body.appendChild(host);
    consentBanner = host;
    if (matchMedia("(max-width: 600px)").matches) {
      panel.style.cssText += ";align-items:stretch;flex-direction:column;gap:14px";
      actions.style.cssText += ";width:100%";
      deny.style.cssText += ";flex:1";
      accept.style.cssText += ";flex:1";
    }
  }

  document.addEventListener("click", onClick, { capture: true, passive: true });
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("popstate", routeChanged);
  addEventListener("pagehide", function () { trackEngagement(); flush(); });
  window.MogciaAnalytics = { track: track, flush: flush, consent: consent, showConsent: function () { showConsent(true); }, version: "1.2.0" };
  track("page_view");
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { showConsent(false); }, { once: true });
  else showConsent(false);
})();
