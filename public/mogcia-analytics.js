(function () {
  "use strict";

  var script = document.currentScript;
  if (!script || window.MogciaAnalytics) return;

  var config = {
    siteId: script.dataset.siteId || "",
    endpoint: script.dataset.endpoint || "/api/collect",
    consentMode: script.dataset.consentMode || "required",
    debug: script.dataset.debug === "true",
  };
  if (!config.siteId) return;

  var STORAGE_KEY = "mogcia_session_id";
  var CONSENT_KEY = "mogcia_analytics_consent";
  var queue = [];
  var scrollSent = {};
  var flushTimer;
  var sessionId = getSessionId();

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
  function hasConsent() {
    return config.consentMode === "analytics_only" || localStorage.getItem(CONSENT_KEY) === "granted";
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
      sessionId: sessionId,
      occurredAt: new Date().toISOString(),
      pagePath: location.pathname,
      referrer: safeReferrer(),
      source: attr.source,
      medium: attr.medium,
      campaign: attr.campaign,
      deviceType: deviceType(),
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
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
      normalizedX: rect.width ? Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) : undefined,
      normalizedY: rect.height ? Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) : undefined,
      documentY: Math.round(event.clientY + scrollY),
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
    localStorage.setItem(CONSENT_KEY, value ? "granted" : "denied");
    if (value) track("page_view");
    else queue.length = 0;
  }

  document.addEventListener("click", onClick, { capture: true, passive: true });
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("pagehide", flush);
  window.MogciaAnalytics = { track: track, flush: flush, consent: consent, version: "1.0.0" };
  track("page_view");
})();
