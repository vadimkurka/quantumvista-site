import { Actor } from 'apify';
import { buildOpportunities, businessSignal, daysAheadDate, daysAgoDate, permitSignal } from './core.js';
import { fetchSocrataRows, getDatasetFields, pickField } from './socrata.js';

const DATASETS = {
    businesses: '6rrh-rzua',
    permitsIssued: 'pi9x-tg5x',
    permitsSubmitted: 'gwh9-jnip',
};

await Actor.init();

try {
    const input = (await Actor.getInput()) ?? {};
    const {
        daysBack = 30,
        daysAhead = 90,
        maxResults = 250,
        maxRecordsPerSource = 3000,
        minScore = 35,
        verticals = [],
        zipCodes = [],
        keywords = [],
        includeBusinessRegistrations = true,
        includeSubmittedPermits = true,
        includeIssuedPermits = true,
        includeResidential = false,
        onlyMultiSignal = false,
        includeRaw = false,
    } = input;

    const since = daysAgoDate(daysBack);
    const businessUntil = daysAheadDate(daysAhead);
    const sourceCap = Math.max(1, Math.min(Number(maxRecordsPerSource) || 3000, 10000));
    Actor.log.info('Starting OpenSoon LA', { since, businessUntil, maxResults, minScore, sourceCap });

    const tasks = [];

    if (includeBusinessRegistrations) {
        tasks.push((async () => {
            const fields = await getDatasetFields(DATASETS.businesses);
            const dateField = pickField(fields, ['location_start_date', 'start_date']);
            const cityClause = fields.has('council_district') ? ' AND council_district > 0' : '';
            const rows = await fetchSocrataRows(DATASETS.businesses, {
                where: `${dateField} >= '${since}T00:00:00.000' AND ${dateField} <= '${businessUntil}T23:59:59.999'${cityClause}`,
                order: `${dateField} DESC`,
                maxRows: sourceCap,
            });
            Actor.log.info(`Business registry/start-date signals fetched: ${rows.length}`);
            return rows.map(businessSignal);
        })());
    }

    if (includeSubmittedPermits) {
        tasks.push((async () => {
            const fields = await getDatasetFields(DATASETS.permitsSubmitted);
            const dateField = pickField(fields, ['submitted_date', 'submit_date', 'application_date']);
            const rows = await fetchSocrataRows(DATASETS.permitsSubmitted, {
                where: `${dateField} >= '${since}'`,
                order: `${dateField} DESC`,
                maxRows: sourceCap,
            });
            Actor.log.info(`Submitted permits fetched: ${rows.length}`);
            return rows.map((row) => permitSignal(row, 'submitted'));
        })());
    }

    if (includeIssuedPermits) {
        tasks.push((async () => {
            const fields = await getDatasetFields(DATASETS.permitsIssued);
            const dateField = pickField(fields, ['issue_date', 'issued_date']);
            const rows = await fetchSocrataRows(DATASETS.permitsIssued, {
                where: `${dateField} >= '${since}'`,
                order: `${dateField} DESC`,
                maxRows: sourceCap,
            });
            Actor.log.info(`Issued permits fetched: ${rows.length}`);
            return rows.map((row) => permitSignal(row, 'issued'));
        })());
    }

    const settled = await Promise.allSettled(tasks);
    const errors = settled.filter((item) => item.status === 'rejected').map((item) => String(item.reason));
    const signals = settled.filter((item) => item.status === 'fulfilled').flatMap((item) => item.value);

    if (!signals.length && errors.length) {
        throw new Error(`All selected data sources failed: ${errors.join(' | ')}`);
    }
    if (errors.length) Actor.log.warning('Some data sources failed; continuing with partial results', { errors });

    const opportunities = buildOpportunities(signals, {
        includeResidential,
        minScore,
        verticals,
        zipCodes,
        keywords,
        onlyMultiSignal,
        includeRaw,
    }).slice(0, Math.max(1, Math.min(Number(maxResults) || 250, 5000)));

    const pricingInfo = Actor.getChargingManager().getPricingInfo();
    const delivered = [];

    if (pricingInfo.isPayPerEvent) {
        for (const opportunity of opportunities) {
            const charge = await Actor.charge({ eventName: 'result-item' });
            if ((charge.chargedCount ?? 0) < 1) {
                Actor.log.info('Result charge limit reached; stopping before unpaid output', {
                    computed: opportunities.length,
                    delivered: delivered.length,
                });
                break;
            }
            await Actor.pushData(opportunity);
            delivered.push(opportunity);
            if (charge.eventChargeLimitReached) break;
        }
    } else if (opportunities.length) {
        await Actor.pushData(opportunities);
        delivered.push(...opportunities);
    }

    const summary = {
        generatedAt: new Date().toISOString(),
        since,
        businessStartHorizon: businessUntil,
        signalsRead: signals.length,
        opportunitiesComputed: opportunities.length,
        opportunitiesReturned: delivered.length,
        independentCrossSourceMatches: delivered.filter((item) => item.sourceFamilies?.length >= 2).length,
        futureBusinessStarts: delivered.filter((item) => item.futureBusinessStart).length,
        highConfidence: delivered.filter((item) => item.confidence === 'high').length,
        mediumConfidence: delivered.filter((item) => item.confidence === 'medium').length,
        payPerEventEnabled: pricingInfo.isPayPerEvent,
        chargeEvent: pricingInfo.isPayPerEvent ? 'result-item' : null,
        sourceErrors: errors,
        datasets: DATASETS,
        note: 'Signals come from public City of Los Angeles datasets. Results indicate opportunity, not confirmed opening dates or buyer intent.',
    };
    await Actor.setValue('OUTPUT', summary);
    Actor.log.info('Finished', summary);
} finally {
    await Actor.exit();
}
