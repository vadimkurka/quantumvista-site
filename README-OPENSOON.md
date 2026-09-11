# OpenSoon LA

OpenSoon LA is an Apify Actor release candidate for early Los Angeles B2B opportunity discovery.

## What it does

It reads official City of Los Angeles public datasets for:

- active business registry/location start dates (`6rrh-rzua`), including future registered start dates within a configurable horizon;
- building permits issued (`pi9x-tg5x`);
- building permits submitted (`gwh9-jnip`).

It normalizes addresses, filters obvious residential permit noise, classifies commercial verticals, ranks opportunities from 0–100, and suggests likely vendor needs.

High confidence is reserved for independent source families: a business-registry signal and a building-permit signal at the same normalized address. Submitted + issued stages of the same permit are not treated as two independent confirmations.

## Validation

GitHub Actions runs:

1. unit tests;
2. syntax checks;
3. live smoke tests against the current LA Open Data APIs.

The September 11, 2026 live smoke test successfully parsed 115 business signals, 1,000 issued permits, and 1,000 submitted permits, producing 763 ranked opportunities, 34 future business-start signals, and 1 exact independent business+permit match in that sampled window.

## Run locally

```bash
npm install
npm test
npm run live-smoke
npm start
```

For local Actor execution, use the Apify CLI/runtime and provide input through the standard Actor input store.

## Deployment boundary

The repository is ready to import/build as an Apify Actor from its root. Publishing it into an Apify account still requires an authenticated Apify connection (GitHub import in Apify or an `APIFY_TOKEN`). No Apify credential is stored in this repository.

## Commercial validation

Landing page: `opensoon-la.html`

Stripe early-access offer: $9 one-time. The landing page remains on the feature branch until the Actor has an authenticated Apify deployment path, so the paid offer is not intentionally exposed on the production site before delivery is ready.

Do not treat public-record signals as proof of opening dates, purchase intent, or sales outcomes.
