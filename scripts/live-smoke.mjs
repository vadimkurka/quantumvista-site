import { buildOpportunities, businessSignal, daysAgoDate, permitSignal } from '../src/core.js';
import { fetchSocrataRows, getDatasetFields, pickField } from '../src/socrata.js';

const datasets = {
  businesses: '6rrh-rzua',
  permitsIssued: 'pi9x-tg5x',
  permitsSubmitted: 'gwh9-jnip',
};

const since = daysAgoDate(30);
const summaries = [];
const signals = [];

for (const [name, id] of Object.entries(datasets)) {
  const fields = await getDatasetFields(id);
  const dateField = name === 'businesses'
    ? pickField(fields, ['location_start_date', 'start_date'])
    : name === 'permitsSubmitted'
      ? pickField(fields, ['submitted_date', 'submit_date', 'application_date'])
      : pickField(fields, ['issue_date', 'issued_date']);

  if (!fields.has(dateField)) throw new Error(`${name}: expected date field not found. First fields: ${[...fields].slice(0,30).join(', ')}`);

  const suffix = name === 'businesses' ? 'T00:00:00.000' : '';
  const rows = await fetchSocrataRows(id, {
    where: `${dateField} >= '${since}${suffix}'`,
    order: `${dateField} DESC`,
    maxRows: 100,
    pageSize: 100,
  });
  if (!rows.length) throw new Error(`${name}: zero live rows in last 30 days`);

  const parsed = name === 'businesses'
    ? rows.map(businessSignal)
    : rows.map((row) => permitSignal(row, name === 'permitsSubmitted' ? 'submitted' : 'issued'));
  const withAddress = parsed.filter((x) => x.addressKey);
  if (!withAddress.length) throw new Error(`${name}: rows fetched, but parser produced zero usable addresses. Sample keys: ${Object.keys(rows[0] || {}).join(', ')}`);
  signals.push(...parsed);
  summaries.push({ name, id, dateField, rows: rows.length, usableAddresses: withAddress.length, sampleDate: parsed[0]?.eventDate, sampleAddress: parsed[0]?.address });
}

const opportunities = buildOpportunities(signals, { minScore: 0 });
if (!opportunities.length) throw new Error('Live sources parsed, but zero opportunities were produced');

console.log(JSON.stringify({ ok: true, since, sources: summaries, opportunities: opportunities.length, top: opportunities.slice(0,5).map(x => ({ score:x.opportunityScore, type:x.signalTypes, business:x.businessName || x.dbaName, address:x.address, vertical:x.vertical })) }, null, 2));
