// Booking: when someone can be seen and how to reach them. Pure functions over
// the sample data, so tests run without a DOM. Filling a cancelled slot uses
// Targets' own search, sorted nearest to the cancelled site.

import { fromIso, fromMinutes, toMinutes } from './format.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Weekdays (0 is Sunday) named in text like "Mon, Wed, Thu", "Mon–Fri" or "Tue & Thu". */
export function parseDays(text = '') {
  const out = new Set();
  for (const part of text.split(/,|&/)) {
    const [a, b] = part.split(/[–-]/).map((s) => WEEKDAYS.indexOf(s.trim().slice(0, 3)));
    if (a < 0) continue;
    if (b == null || b < 0) {
      out.add(a);
      continue;
    }
    for (let d = a; ; d = (d + 1) % 7) {
      out.add(d);
      if (d === b) break;
    }
  }
  return out;
}

/** Where someone works on a weekday (their busiest site if several), or null when they're not in. */
export function siteOnDay(entity, weekday) {
  if (entity.kind === 'hco') return weekday >= 1 && weekday <= 5 ? entity.id : null;
  const here = entity.affiliations.filter((a) => parseDays(a.days).has(weekday)).sort((a, b) => b.share - a.share);
  return here[0]?.orgId ?? null;
}

const OFFICE_HOURS = { days: 'Mon–Fri', from: '09:00', to: '17:00' };

/** The times they prefer to be seen; office hours when nothing is recorded. */
export const windowsFor = (entity) => (entity.contact?.windows?.length ? entity.contact.windows : [OFFICE_HOURS]);

/** Whether a visit starting at `time` fits inside one of their preferred times. */
export function inWindow(entity, weekday, time, duration = 30) {
  const start = toMinutes(time);
  return windowsFor(entity).some((w) => parseDays(w.days).has(weekday) && start >= toMinutes(w.from) && start + duration <= toMinutes(w.to));
}

/** Timed visits that overlap a window on a day's plan. */
export const clashesWith = (items = [], time, duration, except) => items.filter((i) =>
  i.id !== except && i.status !== 'cancelled' && i.mode === 'timed' && i.time &&
  toMinutes(time) < toMinutes(i.time) + i.duration && toMinutes(i.time) < toMinutes(time) + duration);

/**
 * The next times they can be seen: on a day they're on site, inside a
 * preferred time, and clear of the rep's other timed visits. One slot per
 * preferred time per day keeps the choices spread across the week.
 */
export function suggestSlots(entity, { days, plans, duration = 30, earliest, except, count = 4 }) {
  const out = [];
  for (const day of days) {
    const weekday = fromIso(day).getDay();
    const siteId = siteOnDay(entity, weekday);
    if (!siteId) continue;
    for (const w of windowsFor(entity)) {
      if (!parseDays(w.days).has(weekday)) continue;
      for (let m = toMinutes(w.from); m + duration <= toMinutes(w.to); m += 15) {
        if (earliest && day === earliest.day && m < earliest.minutes) continue;
        if (clashesWith(plans[day], fromMinutes(m), duration, except).length) continue;
        out.push({ day, time: fromMinutes(m), siteId });
        break;
      }
    }
  }
  return out.slice(0, count);
}

/** Who to contact to book them, most direct first. */
export function bookingRoute(entity) {
  if (entity.kind === 'hco') return { label: `${entity.name} main line`, value: entity.phone, kind: 'phone number' };
  const c = entity.contact;
  if (c.assistant) return { label: c.assistant, value: c.phone, kind: 'phone number' };
  if (/email/i.test(c.preferred || '')) return { label: 'Email', value: c.email, kind: 'email address' };
  return { label: 'Office phone', value: c.phone, kind: 'phone number' };
}
