# MOGCIA measurement contract

## Install

```html
<script
  defer
  src="https://analytics.mogcia.jp/mogcia-analytics.js"
  data-site-id="YOUR_SITE_ID"
  data-endpoint="https://asia-northeast1-YOUR_PROJECT.cloudfunctions.net/collect"
  data-consent-mode="required"
></script>
```

Consent must be granted by the host site's consent manager:

```js
window.MogciaAnalytics?.consent(true);
```

## Mark stable elements and conversions

```html
<a
  href="https://lin.ee/example"
  data-mogcia-id="hero-line-cta"
  data-mogcia-event="line_add"
>LINEで相談する</a>
```

Never place email addresses, names, form values, free-form input, or other personal data in event properties. The collector should reject oversized payloads, unknown origins, missing consent, and unsupported schema versions.

## Expected Firebase callable functions

- `getOverview({ siteId, range })`
- `getHeatmap({ siteId, range, filters })`
- `testMeasurement({ siteId })`

Site configuration is stored at `sites/{siteId}`. Raw events should be sent from the collector to BigQuery or another event store; Firestore should hold settings and pre-aggregated dashboard documents.

## AI analyst secrets

The AI analyst must be called from a trusted server environment or Firebase Function. Never expose an AI provider key through a `NEXT_PUBLIC_` variable or call the provider directly from the dashboard browser.

For local server-side development:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=your_server_side_key
OPENAI_MODEL=gpt-5.6-luna
```

For production Firebase Functions, store `OPENAI_API_KEY` in the Functions secret manager and expose only an authenticated callable function such as `getAiInsight({ siteId, range, question })` to the dashboard.
