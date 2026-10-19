// Small, dependency-free helpers for escaping, dates and numbers.

export const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Tagged template that escapes interpolations unless they are wrapped with raw(). */
export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((value, i) => {
    out += render(value) + strings[i + 1];
  });
  return new Raw(out);
}

class Raw {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

export const raw = (value) => new Raw(String(value ?? ''));

function render(value) {
  if (value == null || value === false) return '';
  if (value instanceof Raw) return value.value;
  if (Array.isArray(value)) return value.map(render).join('');
  return esc(value);
}

// ---- Dates -------------------------------------------------------------

const DAY = 86400000;

/** Local midnight for the demo's "today". Tests may pass a fixed date. */
export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export const isoDate = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const fromIso = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (date, days) => new Date(startOfDay(date).getTime() + days * DAY);

export const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);

export function formatDate(date, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Intl.DateTimeFormat('en-GB', opts).format(typeof date === 'string' ? fromIso(date) : date);
}

/** "Today", "Tomorrow", "Yesterday", "In 3 days", "12 days ago". */
export function relativeDay(iso, today) {
  const diff = daysBetween(today, fromIso(iso));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  if (diff < -1 && diff > -60) return `${-diff} days ago`;
  return formatDate(iso, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Minutes since midnight for "HH:MM". */
export const toMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

export const fromMinutes = (mins) =>
  `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

/** The last `count` calendar quarters that have fully ended before `today`. */
export function lastQuarters(today, count = 8) {
  let year = today.getFullYear();
  let q = Math.floor(today.getMonth() / 3); // current quarter index (0-3) is still open
  const out = [];
  for (let i = 0; i < count; i++) {
    q -= 1;
    if (q < 0) { q = 3; year -= 1; }
    out.unshift(`Q${q + 1} ${String(year).slice(2)}`);
  }
  return out;
}

// ---- Numbers -----------------------------------------------------------

export const formatNumber = (n) => new Intl.NumberFormat('en-US').format(Math.round(n));

export const formatPct = (n, digits = 0) => `${n > 0 ? '+' : ''}${n.toFixed(digits)}%`;

export const sum = (values) => values.reduce((a, b) => a + b, 0);

/** Year-over-year change of the last four quarters versus the four before. */
export function yoy(series) {
  const recent = sum(series.slice(-4));
  const prior = sum(series.slice(-8, -4));
  return prior ? ((recent - prior) / prior) * 100 : 0;
}

/** Straight-line distance in km between [lon, lat] pairs. */
export function haversineKm([lon1, lat1], [lon2, lat2]) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export const formatKm = (km) => (km < 0.1 ? 'Under 0.1 km' : `${km.toFixed(1)} km`);

export const initials = (name) =>
  name.replace(/^Dr\.\s*/, '').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

export const uid = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
