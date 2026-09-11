# OpenSoon LA — Early B2B Opportunity Radar

OpenSoon LA finds early business-development opportunities in the City of Los Angeles from fresh public records.

Instead of returning a raw permit dump or a generic business directory, it combines and ranks signals from official City datasets, filters obvious residential noise, classifies likely business verticals, and suggests vendor needs.

## What it can surface

- recently active business-registry/location-start records;
- registered business start dates up to a configurable number of days in the future;
- recently submitted building permits;
- recently issued building permits;
- addresses where independent business-registry and permit signals overlap;
- likely commercial verticals such as restaurants, retail, beauty/wellness, fitness, medical/dental, hospitality, and professional offices.

## Data sources

OpenSoon LA uses public City of Los Angeles Open Data datasets:

- Active Businesses — dataset `6rrh-rzua`;
- Building Permits Issued — dataset `pi9x-tg5x`;
- Building Permits Submitted — dataset `gwh9-jnip`.

No private consumer database is used.

## Input

Useful controls include:

- `daysBack` — how far back to search;
- `daysAhead` — future registered business-start horizon, default 90 days;
- `verticals` — optional business-category filter;
- `zipCodes` — optional LA ZIP filters;
- `keywords` — optional text filters;
- `minScore` — minimum opportunity score from 0–100;
- `onlyMultiSignal` — require an independent business-registry + permit match;
- `maxResults` — cap output size;
- `includeResidential` — include residential permit signals (off by default).

## Output

Each dataset item can include:

- opportunity score (0–100);
- confidence (`low`, `medium`, or `high`);
- score reasons;
- signal types and independent source families;
- latest signal date;
- business/DBA name when available;
- business vertical;
- address and ZIP;
- industry/NAICS when available;
- permit valuation and evidence;
- likely vendor needs.

### Confidence model

A submitted permit and an issued permit are two lifecycle stages of the same source family. They are **not** treated as two independent confirmations.

`high` confidence is reserved for strong opportunities where both of these independent source families match the same normalized address:

1. City business registry/start-date data;
2. City building-permit data.

This keeps the scoring from overstating confidence.

## Example output

```json
{
  "opportunityScore": 87,
  "confidence": "high",
  "sourceFamilies": ["business_registry", "building_permit"],
  "signalTypes": ["new_business_registration", "building_permit_submitted"],
  "businessName": "Example Business LLC",
  "vertical": "restaurant_food",
  "address": "100 EXAMPLE ST",
  "zipCode": "90012",
  "futureBusinessStart": true,
  "vendorNeeds": ["POS/payments", "online ordering", "payroll", "commercial cleaning", "signage"]
}
```

The example above is illustrative; it is not a real business record.

## Pay-per-event support

For Apify Pay Per Event, use the built-in synthetic event:

- `apify-default-dataset-item` — one ranked opportunity written to the Actor's default dataset.

Apify automatically charges this event for default-dataset items when the event is enabled in the Actor's monetization settings. No second custom per-result charge is implemented in the source, which avoids duplicate billing.

Pricing is configured in Apify Console and is not hardcoded in the source. A small `apify-actor-start` charge can also be used if needed to cover fixed run costs.

## Reliability

The repository includes automated checks for:

- address normalization;
- commercial vertical classification;
- independent-source confidence logic;
- future business-start handling;
- residential filtering;
- syntax validity;
- Docker image build;
- live connectivity and parsing against the current LA Open Data APIs.

## Limitations

Public records can be delayed, incomplete, amended, or inaccurate. A future location start date or building permit is an opportunity signal, not proof that a business will open on a particular date or purchase a service.

OpenSoon LA does not promise buyer intent, contact information, or sales outcomes.
