// Small, dependency-free helpers for dates and numbers.

import type { LonLat } from './types';

const DAY = 86400000;

/** Local midnight. Tests may pass a fixed date. */
export function startOfDay(date: Date | number = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export const isoDate = (date: Date | number): string => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const fromIso = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (date: Date, days: number): Date => new Date(startOfDay(date).getTime() + days * DAY);

export const daysBetween = (a: Date, b: Date): number => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY);

export function formatDate(date: Date | string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
  return new Intl.DateTimeFormat('en-GB', opts).format(typeof date === 'string' ? fromIso(date) : date);
}

/** "Today", "Tomorrow", "Yesterday", "In 3 days", "12 days ago". */
export function relativeDay(iso: string, today: Date): string {
  const diff = daysBetween(today, fromIso(iso));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  if (diff < -1 && diff > -60) return `${-diff} days ago`;
  return formatDate(iso, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** relativeDay mid-sentence: "due today", "due in 3 days", but "due 26 Oct 2026". */
export function relativeDayLower(iso: string, today: Date): string {
  const day = relativeDay(iso, today);
  return /\d{4}$/.test(day) ? day : day.toLowerCase();
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Minutes since midnight for "HH:MM". */
export const toMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

export const fromMinutes = (mins: number): string =>
  `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

/** The last `count` calendar quarters that have fully ended before `today`. */
export function lastQuarters(today: Date, count = 8): string[] {
  let year = today.getFullYear();
  let q = Math.floor(today.getMonth() / 3); // the current quarter is still open
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    q -= 1;
    if (q < 0) { q = 3; year -= 1; }
    out.unshift(`Q${q + 1} ${String(year).slice(2)}`);
  }
  return out;
}

export const formatNumber = (n: number): string => new Intl.NumberFormat('en-US').format(Math.round(n));

export const formatPct = (n: number, digits = 0): string => `${n > 0 ? '+' : ''}${n.toFixed(digits)}%`;

export const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);

/** Year-over-year change of the last four quarters versus the four before. */
export function yoy(series: number[]): number {
  const recent = sum(series.slice(-4));
  const prior = sum(series.slice(-8, -4));
  return prior ? ((recent - prior) / prior) * 100 : 0;
}

/** Straight-line distance in km between [lon, lat] pairs. */
export function haversineKm([lon1, lat1]: LonLat, [lon2, lat2]: LonLat): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export const formatKm = (km: number): string => (km < 0.1 ? 'Under 0.1 km' : `${km.toFixed(1)} km`);

export const initials = (name: string): string =>
  name.replace(/^Dr\.\s*/, '').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

export const uid = (prefix = 'id'): string => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
