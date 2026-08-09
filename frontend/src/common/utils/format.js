/**
 * Tenant-aware formatting for money, numbers, dates and percentages.
 *
 * The app previously mixed locales in a way that was a correctness bug, not just
 * a polish issue: the student dashboard rendered dates with
 * `toLocaleDateString('en-PK')` while currency was formatted `en-IN` with a `₹`
 * symbol, and other screens hardcoded `₹${n.toLocaleString()}` with no
 * Intl formatting at all.
 *
 * Locale and currency now derive from the school profile (cached at login by
 * AppLayout), with a sensible fallback, so a single school renders consistently
 * and a non-INR tenant is not silently shown rupees.
 */

const DEFAULTS = { locale: 'en-IN', currency: 'INR' };

/** Reads the cached school profile written by AppLayout. */
function tenantConfig() {
  try {
    const cached = localStorage.getItem('cached_school_profile');
    if (!cached) return DEFAULTS;
    const profile = JSON.parse(cached);
    return {
      locale: profile?.locale || profile?.country_locale || DEFAULTS.locale,
      currency: profile?.currency || profile?.currency_code || DEFAULTS.currency,
    };
  } catch {
    return DEFAULTS;
  }
}

/** ₹25,000 — no decimals, because school fees are whole units in practice. */
export function formatCurrency(value, { maximumFractionDigits = 0, ...options } = {}) {
  const { locale, currency } = tenantConfig();
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits,
      ...options,
    }).format(n);
  } catch {
    return `${currencySymbol()}${n.toLocaleString()}`;
  }
}

/** Just the symbol, for input prefixes. */
export function currencySymbol() {
  const { locale, currency } = tenantConfig();
  try {
    return (
      new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 })
        .formatToParts(0)
        .find((p) => p.type === 'currency')?.value ?? '₹'
    );
  } catch {
    return '₹';
  }
}

/** 1,240 */
export function formatNumber(value, options = {}) {
  const { locale } = tenantConfig();
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat(locale, options).format(n);
  } catch {
    return String(n);
  }
}

/** 82% */
export function formatPercent(value, { maximumFractionDigits = 0 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${formatNumber(n, { maximumFractionDigits })}%`;
}

/** YYYY-MM-DD in Local Timezone (preserves local midnight boundary without UTC shift) */
export function getLocalDateString(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** 13 Jul 2026 */
export function formatShortDate(dateInput) {
  const { locale } = tenantConfig();
  if (!dateInput) return '—';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return getLocalDateString(d);
  }
}

/** Monday, 13 July 2026 */
export function formatLongDate(dateInput) {
  const { locale } = tenantConfig();
  if (!dateInput) return '—';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return d.toLocaleDateString(locale, {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch {
    return getLocalDateString(d);
  }
}

/** 13 Jul 2026, 09:14 */
export function formatDateTime(dateInput) {
  const { locale } = tenantConfig();
  if (!dateInput) return '—';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return d.toLocaleString(locale, {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return d.toISOString();
  }
}
