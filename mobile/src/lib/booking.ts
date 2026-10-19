// Booking: when someone can be seen and how to reach them, after the prototype's
// demo/js/booking.js. Pure functions over the sample data. Filling a cancelled
// slot uses Targets' own search, sorted nearest to the cancelled site.

import { fromIso, fromMinutes, toMinutes } from './format';
import type { Entity, PlanItem, TimeWindow } from './types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Weekdays (0 is Sunday) named in text like "Mon, Wed, Thu", "Mon–Fri" or "Tue & Thu". */
export function parseDays(text = ''): Set<number> {
  const out = new Set<number>();
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
export function siteOnDay(entity: Entity, weekday: number): string | null {
  if (entity.kind === 'hco') return weekday >= 1 && weekday <= 5 ? entity.id : null;
  const here = entity.affiliations.filter((a) => parseDays(a.days).has(weekday)).sort((a, b) => b.share - a.share);
  return here[0]?.orgId ?? null;
}

const OFFICE_HOURS: TimeWindow = { days: 'Mon–Fri', from: '09:00', to: '17:00' };

/** The times they prefer to be seen; office hours when nothing is recorded. */
export const windowsFor = (entity: Entity): TimeWindow[] =>
  entity.kind === 'hcp' && entity.contact.windows?.length ? entity.contact.windows : [OFFICE_HOURS];

/** Timed visits on a day's plan that overlap a window, ignoring `except` (the visit being moved). */
export const clashesWith = (items: PlanItem[] = [], time: string, duration: number, except?: string): PlanItem[] =>
  items.filter(
    (i) =>
      i.id !== except &&
      i.status !== 'cancelled' &&
      i.mode === 'timed' &&
      i.time &&
      toMinutes(time) < toMinutes(i.time) + i.duration &&
      toMinutes(i.time) < toMinutes(time) + duration,
  );

export interface Slot {
  day: string;
  time: string;
  siteId: string;
}

/**
 * The next times they can be seen: on a day they're on site, inside a
 * preferred time, and clear of the rep's other timed visits. One slot per
 * preferred time per day keeps the choices spread across the week.
 */
export function suggestSlots(
  entity: Entity,
  {
    days,
    plans,
    duration = 30,
    earliest,
    except,
    count = 4,
  }: {
    days: string[];
    plans: Record<string, PlanItem[]>;
    duration?: number;
    /** Nothing before this time on this day, such as earlier today. */
    earliest?: { day: string; minutes: number };
    except?: string;
    count?: number;
  },
): Slot[] {
  const out: Slot[] = [];
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
export function bookingRoute(entity: Entity): { label: string; value: string; kind: 'phone number' | 'email address' } {
  if (entity.kind === 'hco') return { label: `${entity.name} main line`, value: entity.phone, kind: 'phone number' };
  const c = entity.contact;
  if (c.assistant) return { label: c.assistant, value: c.phone, kind: 'phone number' };
  if (/email/i.test(c.preferred ?? '')) return { label: 'Email', value: c.email, kind: 'email address' };
  return { label: 'Office phone', value: c.phone, kind: 'phone number' };
}
