import { buildOpportunities, businessSignal, daysAheadDate, daysAgoDate, permitSignal } from '../src/core.js';
import { fetchSocrataRows, getDatasetFields, pickField } from '../src/socrata.js';

const datasets = {
  businesses: '6rrh-rzua',
  permitsIssued: 'pi9x-tg5x',
  permitsSubmitted: 'gwh9-jnip',
};

const since = daysAgoDate(30);
const businessUntil = daysAheadDate(90);
const summaries = [];
const signals = [];

for (const [name, id] of Object.entries(datasets)) {
  const fields = await getDatasetFields(id);
  const dateField = name === 'businesses'
    ? pickField(fields, ['location_start_date', 'start_date'])
    : name === 'permitsSubmitted'
      ? pickField(fields, ['submitted_date', 'submit_date', 'application_date'])
      : pickField(fields, ['issue_date', 'issued_date']);

  if (!fields.has(dateField)) throw new Error(`${name}: expected date field not found. First fields: ${[...fields].slice(0, 30).join(', ')}`);

  let where;
  if (name === 'businesses') {
    const cityClause = fields.has('council_district') ? ' AND council_district > 0' : '';
    where = `${dateField} >= '${since}T00:00:00.000' AND ${dateField} <= '${businessUntil}T23:59:59.999'${cityClause}`;
  } else {
    where = `${dateField} >= '${since}'`;
  }

  const rows = await fetchSocrataRows(id, {
    where,
    order: `${dateField} DESC`,
    maxRows: 1000,
    pageSize: 500,
  });
  if (!rows.length) throw new Error(`${name}: zero live rows in selected window`);

  const parsed = name === 'businesses'
    ? rows.map(businessSignal)
    : rows.map((row) => permitSignal(row, name === 'permitsSubmitted' ? 'submitted' : 'issued'));
  const withAddress = parsed.filter((x) => x.addressKey);
  if (!withAddress.length) throw new Error(`${name}: rows fetched, but parser produced zero usable addresses. Sample keys: ${Object.keys(rows[0] || {}).join(', ')}`);

  signals.push(...parsed);
  summaries.push({
    name,
    id,
    dateField,
    rows: rows.length,
    usableAddresses: withAddress.length,
    sampleDate: parsed[0]?.eventDate,
    sampleAddress: parsed[0]?.address,
  });
}

const opportunities = buildOpportunities(signals, { minScore: 0 });
if (!opportunities.length) throw new Error('Live sources parsed, but zero opportunities were produced');

const independent = opportunities.filter((x) => x.sourceFamilies?.length >= 2);
const futureStarts = opportunities.filter((x) => x.futureBusinessStart);
const summarize = (x) => ({
  score: x.opportunityScore,
  confidence: x.confidence,
  sourceFamilies: x.sourceFamilies,
  signalTypes: x.signalTypes,
  business: x.businessName || x.dbaName,
  address: x.address,
  vertical: x.vertical,
  futureBusinessStart: x.futureBusinessStart,
});

console.log(JSON.stringify({
  ok: true,
  since,
  businessUntil,
  sources: summaries,
  opportunities: opportunities.length,
  independentCrossSourceMatches: independent.length,
  futureBusinessStarts: futureStarts.length,
  top: opportunities.slice(0, 5).map(summarize),
  topIndependent: independent.slice(0, 10).map(summarize),
}, null, 2));
