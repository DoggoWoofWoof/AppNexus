// Booking: when someone can be seen and how to reach them, after the prototype's
// demo/js/booking.js. Pure functions over the sample data. Filling a cancelled
// slot uses Targets' own search, sorted nearest to the cancelled site, and is
// only offered to people who are usually there at that time (`availability`).

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

/** "weekdays" for Mon–Fri, "Mon–Thu" for a longer run, otherwise "Tue/Thu". */
function dayWords(text: string): string {
  const days = [...parseDays(text)].sort((a, b) => a - b);
  if (days.join() === '1,2,3,4,5') return 'weekdays';
  const run = days.length > 2 && days.every((d, i) => !i || d === days[i - 1] + 1);
  return run ? `${WEEKDAYS[days[0]]}–${WEEKDAYS[days[days.length - 1]]}` : days.map((d) => WEEKDAYS[d]).join('/');
}

/** When they can usually be seen, such as "Usually Tue/Thu 07:30–08:30". */
export const usualTimes = (entity: Entity): string =>
  `Usually ${windowsFor(entity)
    .map((w) => `${dayWords(w.days)} ${w.from}–${w.to}`)
    .join(' or ')}`;

/** Their usual times on a weekday, such as "07:30–08:30", or "" when they have none that day. */
export const hoursOn = (entity: Entity, weekday: number): string =>
  windowsFor(entity)
    .filter((w) => parseDays(w.days).has(weekday))
    .map((w) => `${w.from}–${w.to}`)
    .join(', ');

const WEEKDAY_NAMES = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

/**
 * Whether someone works that weekday, for Targets: their usual times then, or
 * "Not in on Tuesdays". It goes by their usual days only; nobody can tell from
 * here whether they've gone home.
 */
export function inOnDay(entity: Entity, day: string): { ok: true; hours: string } | { ok: false; why: string } {
  const weekday = fromIso(day).getDay();
  if (!siteOnDay(entity, weekday)) return { ok: false, why: `Not in on ${WEEKDAY_NAMES[weekday]}` };
  return { ok: true, hours: hoursOn(entity, weekday) };
}

/** Where they can be seen at a time, or why not: they need to be on site that day and inside one of their usual times. */
export type Availability = { ok: true; siteId: string } | { ok: false; why: string };

export function availability(entity: Entity, day: string, time: string, duration: number): Availability {
  const weekday = fromIso(day).getDay();
  const siteId = siteOnDay(entity, weekday);
  const start = toMinutes(time);
  const inWindow = windowsFor(entity).some(
    (w) => parseDays(w.days).has(weekday) && toMinutes(w.from) <= start && start + duration <= toMinutes(w.to),
  );
  return siteId && inWindow ? { ok: true, siteId } : { ok: false, why: usualTimes(entity) };
}

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

/** A half hour on a day in the time sheet, and whether it can be chosen. */
export interface GridRow {
  time: string;
  /** Inside their usual times, on a day they're in when the visit is in person. */
  usual: boolean;
  /** Another of the rep's visits is then, for a visit this long. */
  taken: boolean;
  /** Already gone, or too soon, today. */
  past: boolean;
  /** Free, but too close to a visit with a time somewhere else to drive between them. */
  tight: boolean;
}

/**
 * One day's times for choosing one: every half hour from 08:00 to 18:00,
 * stretched to fit their usual times and the rep's visits, with the visits that
 * day. A time is taken when it overlaps a visit with a time, and tight when it
 * leaves too little time to drive from the visit before or to the one after
 * (`travelTo`, minutes from this visit's place to another's). `pick` is the first
 * free time in their usual hours, or else the first free time.
 */
export function dayGrid(
  entity: Entity,
  {
    day,
    plan = [],
    duration,
    onSite,
    earliest = 0,
    except,
    travelTo = () => 0,
  }: { day: string; plan: PlanItem[] | undefined; duration: number; onSite: boolean; earliest?: number; except?: string; travelTo?: (item: PlanItem) => number },
): { from: number; to: number; rows: GridRow[]; visits: PlanItem[]; anyTime: PlanItem[]; pick: string | null } {
  const weekday = fromIso(day).getDay();
  const inToday = !onSite || !!siteOnDay(entity, weekday);
  const windows = windowsFor(entity).filter((w) => parseDays(w.days).has(weekday));
  const live = plan.filter((i) => i.id !== except && i.status !== 'cancelled');
  const visits = live.filter((i) => i.mode === 'timed' && i.time).sort((a, b) => a.time!.localeCompare(b.time!));
  const anyTime = live.filter((i) => i.mode !== 'timed' || !i.time);
  const starts = [8 * 60, ...windows.map((w) => toMinutes(w.from)), ...visits.map((i) => toMinutes(i.time!))];
  const ends = [18 * 60, ...windows.map((w) => toMinutes(w.to)), ...visits.map((i) => toMinutes(i.time!) + i.duration)];
  const from = Math.floor(Math.min(...starts) / 60) * 60;
  const to = Math.ceil(Math.max(...ends) / 60) * 60;
  const endOf = (i: PlanItem) => toMinutes(i.time!) + i.duration;
  const tight = (m: number) => {
    const before = visits.filter((v) => endOf(v) <= m).sort((a, b) => endOf(b) - endOf(a))[0];
    const after = visits.find((v) => toMinutes(v.time!) >= m + duration);
    return (!!before && m - endOf(before) < travelTo(before)) || (!!after && toMinutes(after.time!) - (m + duration) < travelTo(after));
  };
  const rows: GridRow[] = [];
  for (let m = from; m + 30 <= to; m += 30) {
    const time = fromMinutes(m);
    rows.push({
      time,
      usual: inToday && windows.some((w) => toMinutes(w.from) <= m && m + duration <= toMinutes(w.to)),
      taken: clashesWith(plan, time, duration, except).length > 0,
      past: m < earliest,
      tight: tight(m),
    });
  }
  const open = rows.filter((r) => !r.taken && !r.past && !r.tight);
  const pick = (open.find((r) => r.usual) ?? open[0])?.time ?? null;
  return { from, to, rows, visits, anyTime, pick };
}

/** Who to contact to book them, most direct first. */
export function bookingRoute(entity: Entity): { label: string; value: string; kind: 'phone number' | 'email address' } {
  if (entity.kind === 'hco') return { label: `${entity.name} main line`, value: entity.phone, kind: 'phone number' };
  const c = entity.contact;
  if (c.assistant) return { label: c.assistant, value: c.phone, kind: 'phone number' };
  if (/email/i.test(c.preferred ?? '')) return { label: 'Email', value: c.email, kind: 'email address' };
  return { label: 'Office phone', value: c.phone, kind: 'phone number' };
}
