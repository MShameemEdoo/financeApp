// Format currency amount
// 1234.5 → "1,234.50", 1200 → "1,200", 12.345 → "12.35"
// (done by hand: no dependence on Intl support in the JS engine)
export function formatNumber(n) {
  const rounded = Math.round(Math.abs(Number(n) || 0) * 100) / 100;
  const hasFraction = Math.abs(rounded - Math.trunc(rounded)) > 0.0001;
  const [int, frac] = rounded.toFixed(hasFraction ? 2 : 0).split('.');
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (frac ? `.${frac}` : '');
}

// Symbols sit against the number ("$12", "€5"); codes/words get a space ("Rs 12", "MUR 12")
function joinCurrency(label, text) {
  const isSymbol = label.length <= 1 || /[$€£¥₹₺₽₴₩₫₱₪₦฿৳]$/.test(label);
  return isSymbol ? `${label}${text}` : `${label} ${text}`;
}

// formatCurrency(1234.5, 'Rs')            → "Rs 1,234.50"
// formatCurrency(-50, 'Rs', { sign:true }) → "−Rs 50"
// { compact:true } shortens millions ("Rs 1.3M") for tight spots such as chart labels.
export function formatCurrency(amount, currency = 'Rs', opts = {}) {
  const { compact = false, sign = false } = opts;
  const abs = Math.abs(Number(amount) || 0);
  const text = compact && abs >= 1_000_000 ? `${(abs / 1_000_000).toFixed(1)}M` : formatNumber(abs);
  const body = joinCurrency(currency, text);
  if (!sign) return body;
  if (amount < 0) return `−${body}`;
  return amount > 0 ? `+${body}` : body;
}

// Parse 'YYYY-MM-DD' as a LOCAL date (new Date('YYYY-MM-DD') is UTC and can
// land on the previous day in negative-offset timezones). Full ISO strings
// fall through to the normal Date parser.
export function parseLocalDate(str) {
  if (str instanceof Date) return str;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || '');
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(str);
}

// Date -> 'YYYY-MM-DD' using LOCAL calendar values
export function toISODate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── Unique-name helpers (accounts, categories, budgets) ──────────────────────
// Names are compared ignoring case, surrounding spaces and repeated spaces,
// so "Cash", " cash " and "CASH" all count as the same name.
export function normalizeName(str) {
  return (str || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

// Is `name` already used by another item in `items`?
//  excludeId: the item being edited (so it doesn't clash with itself)
//  getName:   how to read an item's name (budgets use customName)
export function isNameTaken(items, name, excludeId = null, getName = i => i.name) {
  const target = normalizeName(name);
  if (!target) return false;
  return items.some(i => i.id !== excludeId && normalizeName(getName(i)) === target);
}

// Newest first by transaction date, then by creation time
export function sortTransactions(transactions) {
  return [...transactions].sort((a, b) => {
    const da = toISODate(parseLocalDate(a.date));
    const db = toISODate(parseLocalDate(b.date));
    if (da !== db) return da < db ? 1 : -1;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
}

// Format date to readable string
export function formatDate(dateStr) {
  const date = parseLocalDate(dateStr);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(date, now)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export function formatShortDate(dateStr) {
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

// "Today", "Yesterday" or "Oct 12" (adds the year when it isn't this year)
export function relativeDateLabel(dateStr, now = new Date()) {
  const date = parseLocalDate(dateStr);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, now)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export function yesterdayISO(now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return toISODate(d);
}

// Net of a list of transactions: income − expenses. Transfers are not income or spending.
export function netOf(transactions) {
  return transactions.reduce((sum, t) => {
    if (t.type === 'income')  return sum + t.amount;
    if (t.type === 'expense') return sum - t.amount;
    return sum;
  }, 0);
}

export function formatTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function formatMonthYear(date = new Date()) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function formatShortMonth(date = new Date()) {
  return date.toLocaleDateString('en-US', { month: 'short' });
}

function isSameDay(a, b) {
  return a.getDate() === b.getDate()
    && a.getMonth() === b.getMonth()
    && a.getFullYear() === b.getFullYear();
}

// Group transactions by date label
export function groupByDate(transactions) {
  const groups = {};
  sortTransactions(transactions).forEach(tx => {
    const label = formatDate(tx.date);
    if (!groups[label]) groups[label] = [];
    groups[label].push(tx);
  });
  return Object.entries(groups).map(([date, items]) => ({ date, items, net: netOf(items) }));
}

// Get month transactions
export function getMonthTransactions(transactions, date = new Date()) {
  return transactions.filter(t => {
    const d = parseLocalDate(t.date);
    return d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
  });
}

// ── Month helpers ─────────────────────────────────────────────────────────────
// A "month key" is a 'YYYY-MM' string (local time), e.g. '2026-09'.
export function monthKeyOf(dateOrStr) {
  return toISODate(parseLocalDate(dateOrStr)).slice(0, 7);
}

export function parseMonthKey(key) {
  const [y, m] = key.split('-').map(Number);
  return { year: y, month: m - 1 };           // month is 0-11
}

export function monthKeyToDate(key) {
  const { year, month } = parseMonthKey(key);
  return new Date(year, month, 1);
}

export function shiftMonthKey(key, delta) {
  const { year, month } = parseMonthKey(key);
  return monthKeyOf(new Date(year, month + delta, 1));
}

export function startOfMonthISO(key) {
  return `${key}-01`;
}

export function endOfMonthISO(key) {
  const { year, month } = parseMonthKey(key);
  return toISODate(new Date(year, month + 1, 0));
}

export function daysInMonthKey(key) {
  const { year, month } = parseMonthKey(key);
  return new Date(year, month + 1, 0).getDate();
}

export function formatMonthKey(key) {
  return formatMonthYear(monthKeyToDate(key));
}

// ── Tracking-period helpers ───────────────────────────────────────────────────
// The user can choose which day of the month a tracking period starts on
// (default 1 = calendar months). With start day 25, one period runs Oct 25 → Nov 24.
// A period is identified by the 'YYYY-MM' of the month it STARTS in.
// Start day is limited to 1–28 so the cut-off date exists in every month.
export const MAX_START_DAY = 28;

export function clampStartDay(n) {
  const d = Math.round(Number(n));
  if (!Number.isFinite(d)) return 1;
  return Math.min(Math.max(d, 1), MAX_START_DAY);
}

// Which period does a date fall in?  (startDay 1 → just its calendar month)
export function periodKeyOfDate(dateOrStr, startDay = 1) {
  const d = parseLocalDate(dateOrStr);
  const key = toISODate(d).slice(0, 7);
  return d.getDate() >= startDay ? key : shiftMonthKey(key, -1);
}

export function periodStartISO(key, startDay = 1) {
  return `${key}-${String(startDay).padStart(2, '0')}`;
}

// Last day of the period = the day before the next period starts
export function periodEndISO(key, startDay = 1) {
  if (startDay <= 1) return endOfMonthISO(key);
  return `${shiftMonthKey(key, 1)}-${String(startDay - 1).padStart(2, '0')}`;
}

// Whole days from a to b (DST-safe: uses UTC midnights)
export function daysBetweenISO(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export function daysInPeriod(key, startDay = 1) {
  return daysBetweenISO(periodStartISO(key, startDay), periodEndISO(key, startDay)) + 1;
}

// Transactions whose date falls inside the period
export function getPeriodTransactions(transactions, key, startDay = 1) {
  const start = periodStartISO(key, startDay);
  const end   = periodEndISO(key, startDay);
  return transactions.filter(t => {
    const d = txDateISO(t);
    return d >= start && d <= end;
  });
}

const shortMD = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// "October 2026" for calendar months, "Sep 25 – Oct 24, 2026" for custom start days
export function formatPeriod(key, startDay = 1) {
  if (startDay <= 1) return formatMonthKey(key);
  const s = parseLocalDate(periodStartISO(key, startDay));
  const e = parseLocalDate(periodEndISO(key, startDay));
  return s.getFullYear() === e.getFullYear()
    ? `${shortMD(s)} – ${shortMD(e)}, ${e.getFullYear()}`
    : `${shortMD(s)}, ${s.getFullYear()} – ${shortMD(e)}, ${e.getFullYear()}`;
}

// Two-line version for the month switcher: { main, sub }
export function formatPeriodParts(key, startDay = 1) {
  if (startDay <= 1) return { main: formatMonthKey(key), sub: null };
  const s = parseLocalDate(periodStartISO(key, startDay));
  const e = parseLocalDate(periodEndISO(key, startDay));
  return {
    main: `${shortMD(s)} – ${shortMD(e)}`,
    sub: s.getFullYear() === e.getFullYear() ? String(e.getFullYear()) : `${s.getFullYear()} – ${e.getFullYear()}`,
  };
}

// 1 → "1st", 22 → "22nd", 25 → "25th"
export function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th'}`;
}

// 'YYYY-MM-DD' of a transaction (handles full ISO strings too)
export function txDateISO(tx) {
  return toISODate(parseLocalDate(tx.date));
}

// Compute category spending totals for a set of transactions
export function spendingByCategory(transactions) {
  const map = {};
  transactions.filter(t => t.type === 'expense').forEach(t => {
    map[t.category] = (map[t.category] || 0) + t.amount;
  });
  return map;
}

// Last 6 months (oldest first), ending at `endKey` ('YYYY-MM'), default = this month
export function getLast6Months(endKey = monthKeyOf(new Date())) {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const key = shiftMonthKey(endKey, -i);
    const d = monthKeyToDate(key);
    months.push({
      key,
      label: formatShortMonth(d),
      month: d.getMonth(),
      year: d.getFullYear(),
    });
  }
  return months;
}

// Generate unique id
export function genId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// Today's ISO date string
export function todayISO() {
  return toISODate(new Date());
}
