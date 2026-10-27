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

/**
 * Local midnight `days` calendar days on. Counted by the calendar, not in steps of
 * 24 hours: the day the clocks go back has 25, and 24 hours after its midnight is
 * still that day.
 */
export const addDays = (date: Date, days: number): Date => {
  const d = startOfDay(date);
  d.setDate(d.getDate() + days);
  return d;
};

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

/** A day mid-sentence: "today", "tomorrow", its weekday in the coming week ("Friday"), or else "Thu, 29 Oct". */
export function dayInWords(iso: string, today: Date): string {
  const diff = daysBetween(today, fromIso(iso));
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  return diff > 1 && diff < 7 ? formatDate(iso, { weekday: 'long' }) : formatDate(iso);
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

/** Minutes since midnight on a clock. */
export const minutesOfDay = (date: Date): number => date.getHours() * 60 + date.getMinutes();

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

/** A change in percent as words, as the trend arrow reads aloud: "up 12%", "down 3%", or "0%" under 1% either way. */
export function changeWords(n: number): string {
  const pct = Math.round(n);
  return pct >= 1 ? `up ${pct}%` : pct <= -1 ? `down ${-pct}%` : '0%';
}

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

/** Minutes as "55 min" or "1 h 25 min". */
export const formatMinutes = (mins: number): string => (mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h${mins % 60 ? ` ${mins % 60} min` : ''}`);

export const formatKm = (km: number): string => (km < 0.1 ? 'Under 0.1 km' : `${km.toFixed(1)} km`);

export const initials = (name: string): string =>
  name.replace(/^Dr\.\s*/, '').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

export const uid = (prefix = 'id'): string => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** Abbreviations whose full stop doesn't end a sentence, as in "Dr. Lee" or "mix vs. peers". */
const ABBREVIATION = /\b(?:Dr|Mr|Mrs|Ms|St|vs|e\.g|i\.e)\.$/;

/** The first sentence of a text. */
export function firstSentence(text: string): string {
  const end = /[.!?](?=\s|$)/g;
  for (let m = end.exec(text); m; m = end.exec(text)) {
    const upTo = text.slice(0, m.index + 1);
    if (!ABBREVIATION.test(upTo)) return upTo.trim();
  }
  return text.trim();
}

/** The sentences in a text, keeping "Dr. Lee" and the like in one piece. */
export function sentencesOf(text: string): string[] {
  const out: string[] = [];
  for (let rest = text.trim(); rest; ) {
    const first = firstSentence(rest);
    out.push(first);
    rest = rest.slice(first.length).trim();
  }
  return out;
}

/** Text as a sentence: with a full stop, unless it ends in one, a question mark or an exclamation mark. */
export const sentence = (text: string): string => (/[.!?]$/.test(text) ? text : `${text}.`);

export const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

const wordsOf = (text: string) => text.toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();

/** Two lines say the same thing, whatever the case, spacing or full stop. */
export const samePoint = (a: string, b: string): boolean => wordsOf(a) === wordsOf(b);

/** A text says something already, word for word, whatever the case, spacing or full stops. */
export function says(text: string, part: string): boolean {
  const words = wordsOf(part);
  return !!words && ` ${wordsOf(text)} `.includes(` ${words} `);
}

/** "A", "A and B", or "A, B and C". */
export const listJoin = (items: string[]): string => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);
