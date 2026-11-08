import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Exchange rates for entering foreign-currency transactions.
 *
 * Source: "Currency-api" / exchange-api by fawazahmed0 — listed under *Currency Exchange* in the
 * public-apis catalog (github.com/public-apis/public-apis). Free, no API key, no rate limits,
 * 200+ currencies including the Mauritian Rupee.
 *
 *   https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@{date}/v1/currencies/{from}.json
 *   https://{date}.currency-api.pages.dev/v1/currencies/{from}.json      ← fallback mirror
 *
 * Privacy: a request contains only a currency code and a date — never any amounts or personal data.
 *
 * Offline-first: every rate that is fetched is cached on the device. Past dates never change, so
 * they are cached forever; "latest" is refreshed after 12 hours. If the network is down the last
 * known rate is reused (flagged "stale"); if there is none the caller asks the user for a rate.
 */

const CACHE_KEY        = 'fx_cache_v1';
const LATEST_TTL_MS    = 12 * 60 * 60 * 1000;
const TIMEOUT_MS       = 8000;
const MAX_CACHE_ENTRIES = 300;
// The API's daily history starts here; earlier dates fall back to the latest rate.
export const FIRST_HISTORY_DATE = '2024-03-02';

export class RateUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.code = 'RATE_UNAVAILABLE';
  }
}

const urlsFor = (from, tag) => [
  `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${tag}/v1/currencies/${from}.json`,
  `https://${tag}.currency-api.pages.dev/v1/currencies/${from}.json`,
];

async function fetchJson(url, fetchImpl, timeoutMs) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetchImpl(url, controller ? { signal: controller.signal } : undefined);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Try the CDN, then the mirror. Returns { rate, date } or throws.
async function fetchPair(from, to, tag, deps) {
  let lastError = null;
  for (const url of urlsFor(from, tag)) {
    try {
      const json = await fetchJson(url, deps.fetchImpl, deps.timeoutMs);
      const rate = json?.[from]?.[to];
      if (typeof rate === 'number' && rate > 0 && Number.isFinite(rate)) {
        return { rate, date: json.date || null };
      }
      lastError = new Error('Currency not in response');
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error('All sources failed');
}

async function loadCache(storage) {
  try {
    const raw = await storage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

async function saveCache(storage, cache) {
  try {
    const keys = Object.keys(cache);
    if (keys.length > MAX_CACHE_ENTRIES) {
      keys.sort((a, b) => (cache[a].at || 0) - (cache[b].at || 0))
        .slice(0, keys.length - MAX_CACHE_ENTRIES)
        .forEach(k => delete cache[k]);
    }
    await storage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) { /* cache is a nicety, never fatal */ }
}

function localTodayISO(now) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * How many `to` units one `from` unit is worth on `date`.
 *
 * @returns {{ rate:number, source:'live'|'cache'|'stale', date:string|null, approximate:boolean }}
 *   approximate = true when the requested date had no data and the latest rate was used instead.
 * @throws RateUnavailableError when there is no network AND nothing cached.
 */
export async function getRate({ from, to, date = null, now = Date.now(), deps = {} }) {
  const d = {
    fetchImpl: deps.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null),
    storage:   deps.storage   || AsyncStorage,
    timeoutMs: deps.timeoutMs || TIMEOUT_MS,
  };
  const f = String(from || '').toLowerCase();
  const t = String(to   || '').toLowerCase();
  if (!f || !t) throw new RateUnavailableError('Missing currency');
  if (f === t) return { rate: 1, source: 'live', date: null, approximate: false };

  const today      = localTodayISO(now);
  const wantsPast  = !!date && date < today;
  const hasHistory = wantsPast && date >= FIRST_HISTORY_DATE;
  const primaryTag = hasHistory ? date : 'latest';
  // A past date older than the API's history can only be answered with the latest rate
  let approximate  = wantsPast && !hasHistory;

  const cache = await loadCache(d.storage);
  const keyFor = tag => `${f}>${t}@${tag}`;

  async function attempt(tag, markApprox) {
    const key = keyFor(tag);
    const hit = cache[key];
    const fresh = hit && (tag !== 'latest' || now - hit.at < LATEST_TTL_MS);
    if (fresh) return { rate: hit.rate, source: 'cache', date: hit.date, approximate: markApprox };
    if (!d.fetchImpl) throw new Error('No fetch available');
    try {
      const got = await fetchPair(f, t, tag, d);
      cache[key] = { rate: got.rate, date: got.date, at: now };
      await saveCache(d.storage, cache);
      return { rate: got.rate, source: 'live', date: got.date, approximate: markApprox };
    } catch (e) {
      if (hit) return { rate: hit.rate, source: 'stale', date: hit.date, approximate: markApprox };
      throw e;
    }
  }

  try {
    return await attempt(primaryTag, approximate);
  } catch (e) {
    // The exact date failed (not published / offline): fall back to the latest known rate
    if (primaryTag !== 'latest') {
      try {
        return await attempt('latest', true);
      } catch (e2) { /* fall through */ }
    }
    throw new RateUnavailableError('No exchange rate available');
  }
}

// Convert an amount, rounded to 2 decimals (money)
export function convertAmount(amount, rate) {
  return Math.round(amount * rate * 100) / 100;
}

// "1 EUR = 52.8366 MUR" — FX-style precision that adapts to tiny / large rates
export function formatRate(from, to, rate) {
  const digits = rate >= 100 ? 2 : rate >= 1 ? 4 : 6;
  const text = Number(rate.toFixed(digits)).toString();
  return `1 ${from} = ${text} ${to}`;
}
