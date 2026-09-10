(function () {
  "use strict";

  var script = document.currentScript;
  if (!script || window.MogciaAnalytics) return;

  var config = {
    siteId: script.dataset.siteId || "",
    endpoint: script.dataset.endpoint || "/api/collect",
    consentMode: script.dataset.consentMode || "required",
    privacyUrl: script.dataset.privacyUrl || "",
    brandUrl: script.dataset.brandUrl || "https://www.ismo-data.com/",
    brandLogo: script.dataset.brandLogo || new URL("/ismo-symbol.png", script.src).toString(),
    dashboardOrigin: script.dataset.dashboardOrigin || "https://ismo-data.app",
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
  var previewResizeObserver;
  var previewMutationObserver;
  var previewHeightTimer;
  var attentionBands = Array(20).fill(0);
  var attentionTimer;

  function dashboardOrigin() {
    var allowed = [config.dashboardOrigin];
    if (config.debug) allowed.push("http://localhost:3000", "http://127.0.0.1:3000");
    try {
      var parentOrigin = new URL(document.referrer).origin;
      return allowed.indexOf(parentOrigin) >= 0 ? parentOrigin : null;
    } catch (_) { return null; }
  }
  function currentDocumentHeight() {
    var body = document.body;
    var root = document.documentElement;
    return Math.max(
      root ? root.scrollHeight : 0,
      root ? root.offsetHeight : 0,
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0,
      innerHeight
    );
  }
  function sendPreviewMetrics() {
    if (window.parent === window) return;
    var targetOrigin = dashboardOrigin();
    if (!targetOrigin) return;
    window.parent.postMessage({
      type: "ismo:page-metrics",
      version: 1,
      siteId: config.siteId,
      pagePath: location.pathname,
      documentHeight: currentDocumentHeight(),
      viewportWidth: innerWidth,
    }, targetOrigin);
  }
  function schedulePreviewMetrics() {
    clearTimeout(previewHeightTimer);
    previewHeightTimer = setTimeout(sendPreviewMetrics, 80);
  }
  function observePreviewHeight() {
    if (window.parent === window || !dashboardOrigin()) return;
    sendPreviewMetrics();
    if (typeof ResizeObserver !== "undefined") {
      previewResizeObserver = new ResizeObserver(schedulePreviewMetrics);
      previewResizeObserver.observe(document.documentElement);
      if (document.body) previewResizeObserver.observe(document.body);
    } else if (typeof MutationObserver !== "undefined") {
      previewMutationObserver = new MutationObserver(schedulePreviewMetrics);
      previewMutationObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    }
    addEventListener("load", schedulePreviewMetrics, { once: true });
    addEventListener("resize", schedulePreviewMetrics, { passive: true });
  }

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
    var allowedEvents = ["page_view", "engagement", "click", "scroll", "cta_click", "conversion"];
    if (allowedEvents.indexOf(eventName) === -1) {
      properties = Object.assign({ conversionId: eventName }, properties || {});
      eventName = "cta_click";
    }
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
    if (!navigator.sendBeacon || !navigator.sendBeacon(config.endpoint, new Blob([body], { type: "text/plain;charset=UTF-8" }))) {
      fetch(config.endpoint, { method: "POST", body: body, headers: { "content-type": "text/plain;charset=UTF-8" }, keepalive: true, credentials: "omit" }).catch(function () { queue.unshift.apply(queue, batch); });
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
    if (seconds > 0) track("engagement", { engagementSeconds: seconds, attentionBands: attentionBands.slice() });
  }
  function sampleAttention() {
    if (!hasConsent() || document.visibilityState !== "visible") return;
    var documentHeight = currentDocumentHeight();
    if (!documentHeight) return;
    var first = Math.max(0, Math.min(19, Math.floor(scrollY / documentHeight * 20)));
    var last = Math.max(first, Math.min(19, Math.floor((scrollY + innerHeight - 1) / documentHeight * 20)));
    var share = 1 / (last - first + 1);
    for (var index = first; index <= last; index += 1) attentionBands[index] += share;
  }
  function routeChanged() {
    if (location.pathname === lastPath) return;
    trackEngagement();
    lastPath = location.pathname;
    pageStartedAt = Date.now();
    scrollSent = {};
    attentionBands = Array(20).fill(0);
    track("page_view");
    schedulePreviewMetrics();
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
    panel.style.cssText = "box-sizing:border-box;display:flex;align-items:center;gap:22px;width:min(760px,100%);padding:20px 22px;border:1px solid #ffd5dd;border-radius:16px;background:#fff;color:#24242a;box-shadow:0 18px 55px rgba(35,35,42,.18);font:13px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans JP',sans-serif;pointer-events:auto";
    var copy = document.createElement("div");
    copy.style.cssText = "flex:1;min-width:0";
    var brand = document.createElement("a");
    brand.href = config.brandUrl;
    brand.target = "_blank";
    brand.rel = "noopener noreferrer";
    brand.setAttribute("aria-label", "ismo.とは");
    brand.style.cssText = "display:inline-flex;align-items:center;gap:7px;margin-bottom:7px;color:#74747d;font-size:9px;font-weight:700;letter-spacing:.08em;text-decoration:none";
    var mark = document.createElement("img");
    mark.src = config.brandLogo;
    mark.alt = "";
    mark.width = 20;
    mark.height = 20;
    mark.style.cssText = "display:block;width:20px;height:20px;object-fit:contain";
    var brandText = document.createElement("span");
    brandText.textContent = "POWERED BY ismo.";
    brand.appendChild(mark);
    brand.appendChild(brandText);
    var title = document.createElement("strong");
    title.textContent = "アクセス解析について";
    title.style.cssText = "display:block;margin-bottom:4px;font-size:15px;letter-spacing:-.02em";
    var description = document.createElement("span");
    description.textContent = "このサイトでは、より良い体験づくりのため、個人を特定しない形で閲覧状況を計測します。";
    description.style.cssText = "color:#66666f;font-size:12px";
    copy.appendChild(brand);
    copy.appendChild(title);
    copy.appendChild(description);
    if (config.privacyUrl) {
      var privacy = document.createElement("a");
      privacy.href = config.privacyUrl;
      privacy.textContent = " プライバシーの詳細";
      privacy.style.cssText = "color:#bd3f58;font-size:11px;text-decoration:underline;text-underline-offset:2px;white-space:nowrap";
      copy.appendChild(privacy);
    }
    var actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px;flex:none";
    var deny = document.createElement("button");
    deny.type = "button";
    deny.textContent = "拒否する";
    deny.setAttribute("data-mogcia-consent", "deny");
    deny.style.cssText = "padding:10px 14px;border:1px solid #dedee3;border-radius:9px;background:#fff;color:#66666f;font:inherit;font-size:12px;cursor:pointer";
    deny.addEventListener("click", function () { consent(false); });
    var accept = document.createElement("button");
    accept.type = "button";
    accept.textContent = "許可する";
    accept.setAttribute("data-mogcia-consent", "accept");
    accept.style.cssText = "padding:10px 17px;border:1px solid #29292f;border-radius:9px;background:#29292f;color:#fff;font:inherit;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 6px 16px rgba(35,35,42,.15)";
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
  attentionTimer = setInterval(sampleAttention, 1000);
  addEventListener("pagehide", function () {
    trackEngagement();
    flush();
    if (previewResizeObserver) previewResizeObserver.disconnect();
    if (previewMutationObserver) previewMutationObserver.disconnect();
    clearInterval(attentionTimer);
  });
  window.MogciaAnalytics = { track: track, flush: flush, consent: consent, showConsent: function () { showConsent(true); }, version: "1.4.0" };
  track("page_view");
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { showConsent(false); observePreviewHeight(); }, { once: true });
  else { showConsent(false); observePreviewHeight(); }
})();
