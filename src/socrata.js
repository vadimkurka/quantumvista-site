const BASE = 'https://data.lacity.org';
const DEFAULT_PAGE_SIZE = 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url, { attempts = 4 } = {}) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const headers = {
                Accept: 'application/json',
                'User-Agent': 'OpenSoon-LA-Apify/0.1',
            };
            if (process.env.SOCRATA_APP_TOKEN) headers['X-App-Token'] = process.env.SOCRATA_APP_TOKEN;

            const response = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
            if (response.ok) return await response.json();

            const body = await response.text();
            if ((response.status === 429 || response.status >= 500) && attempt < attempts) {
                await sleep(500 * 2 ** (attempt - 1));
                continue;
            }
            throw new Error(`Socrata HTTP ${response.status}: ${body.slice(0, 500)}`);
        } catch (error) {
            lastError = error;
            if (attempt < attempts) {
                await sleep(500 * 2 ** (attempt - 1));
                continue;
            }
        }
    }
    throw lastError;
}

export async function getDatasetFields(datasetId) {
    const metadata = await fetchJson(`${BASE}/api/views/${encodeURIComponent(datasetId)}`);
    return new Set((metadata.columns || []).map((column) => column.fieldName).filter(Boolean));
}

export function pickField(fields, candidates) {
    for (const candidate of candidates) {
        if (fields.has(candidate)) return candidate;
    }
    return candidates[0];
}

export async function fetchSocrataRows(datasetId, {
    where,
    order,
    select,
    maxRows = 3000,
    pageSize = DEFAULT_PAGE_SIZE,
} = {}) {
    const rows = [];
    let offset = 0;
    const limit = Math.max(1, Math.min(pageSize, 50000));

    while (rows.length < maxRows) {
        const params = new URLSearchParams();
        params.set('$limit', String(Math.min(limit, maxRows - rows.length)));
        params.set('$offset', String(offset));
        if (where) params.set('$where', where);
        if (order) params.set('$order', order);
        if (select) params.set('$select', select);

        const url = `${BASE}/resource/${encodeURIComponent(datasetId)}.json?${params.toString()}`;
        const page = await fetchJson(url);
        if (!Array.isArray(page)) throw new Error(`Unexpected Socrata response for ${datasetId}`);

        rows.push(...page);
        if (page.length < limit) break;
        offset += page.length;
    }
    return rows.slice(0, maxRows);
}
