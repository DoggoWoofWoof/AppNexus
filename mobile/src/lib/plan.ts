// Pure day-plan logic: ordering, conflicts, adding targets, and the day with a time
// and a drive for every stop, from straight-line distances.

import { fromMinutes, haversineKm, toMinutes, uid } from './format';
import type { Entity, LonLat, OrgData, PlanItem, VisitType } from './types';

export const VISIT_TYPES: VisitType[] = ['In-person visit', 'Phone call', 'Video call', 'Meeting', 'Email'];
export const DURATIONS = [15, 30, 45, 60, 90];

type Target = Pick<Entity, 'id' | 'kind'>;
type CoordsOf = (item: PlanItem) => LonLat;

/** Items that are still part of the day (not cancelled). */
export const activeItems = (items: PlanItem[] = []): PlanItem[] => items.filter((i) => i.status !== 'cancelled');

const startOf = (item: PlanItem): number => toMinutes(item.time ?? '00:00');

/**
 * Route order: timed stops by start time. A flexible ("Any time") stop stays
 * after the latest timed stop the rep put before it, or at the start of the
 * day, so it can sit between fixed appointments. A plan already in route
 * order comes back as it is.
 */
export function routeOrder(items: PlanItem[] = []): PlanItem[] {
  const lead: PlanItem[] = [];
  const timed: PlanItem[] = [];
  const after = new Map<string, PlanItem[]>();
  let anchor: PlanItem | null = null;
  for (const item of items) {
    if (item.mode === 'timed') {
      timed.push(item);
      after.set(item.id, []);
      if (!anchor || startOf(item) >= startOf(anchor)) anchor = item;
    } else (anchor ? after.get(anchor.id)! : lead).push(item);
  }
  timed.sort((a, b) => startOf(a) - startOf(b));
  return [...lead, ...timed.flatMap((t) => [t, ...after.get(t.id)!])];
}

/** Pairs of timed items whose time windows overlap, as [earlier, later]. */
export function conflicts(items: PlanItem[] = []): [PlanItem, PlanItem][] {
  const timed = activeItems(items)
    .filter((i) => i.mode === 'timed' && i.time)
    .sort((a, b) => startOf(a) - startOf(b));
  const out: [PlanItem, PlanItem][] = [];
  for (let i = 0; i < timed.length; i++) {
    const end = startOf(timed[i]) + timed[i].duration;
    for (let j = i + 1; j < timed.length && startOf(timed[j]) < end; j++) out.push([timed[i], timed[j]]);
  }
  return out;
}

export const endTime = (item: PlanItem): string => fromMinutes(startOf(item) + item.duration);

/** When the working day is over: an "Any time" stop not logged by then is flagged, and the phone reminds the rep. */
export const END_OF_DAY = '17:30';

/**
 * Whether a planned visit should have been logged by now: one with a fixed time
 * once it's over, an "Any time" stop from the end of the day.
 */
export function notLogged(item: PlanItem, minutesNow: number): boolean {
  if (item.status !== 'planned') return false;
  return minutesNow >= (item.mode === 'timed' && item.time ? startOf(item) + item.duration : toMinutes(END_OF_DAY));
}

/** A new plan item for a target; flexible by default so nothing is double-booked. */
export function newItem(target: Target, siteId: string): PlanItem {
  return {
    id: uid('v'),
    targetId: target.id,
    siteId,
    mode: 'flexible',
    time: null,
    duration: target.kind === 'hco' ? 45 : 30,
    type: target.kind === 'hco' ? 'Meeting' : 'In-person visit',
    goal: '',
    status: 'planned',
    isNew: true,
  };
}

/** Adds targets that are not already planned (and active) for the day. */
export function addTargets(items: PlanItem[], targets: Target[], siteFor: (t: Target) => Pick<OrgData, 'id'>): PlanItem[] {
  const planned = new Set(activeItems(items).map((i) => i.targetId));
  const additions = targets.filter((t) => !planned.has(t.id)).map((t) => newItem(t, siteFor(t).id));
  return [...items, ...additions];
}

/**
 * Gives a flexible stop a start time. It goes to the end of the list, where it
 * can't pick up the flexible stops after it, and routeOrder puts it at its time.
 */
export function timeStop(items: PlanItem[], id: string, time: string): PlanItem[] {
  const item = items.find((i) => i.id === id);
  if (!item) return items;
  return [...items.filter((i) => i.id !== id), { ...item, mode: 'timed', time }];
}

/** Whether the visit needs the rep to travel. */
export const isOnSite = (item: PlanItem): boolean => item.type === 'In-person visit' || item.type === 'Meeting';

/**
 * How many stops at the start of the route stay where they are when stops are
 * placed or reordered: up to the last one logged, or, today, the last one whose
 * time has started. Nothing is put before a visit that has already happened.
 */
export function fixedStops(route: PlanItem[], minutesNow: number | null): number {
  let fixed = 0;
  route.forEach((item, i) => {
    const started = minutesNow != null && item.mode === 'timed' && item.time != null && startOf(item) <= minutesNow;
    if (item.status !== 'planned' || started) fixed = i + 1;
  });
  return fixed;
}

/** When the working day starts: "Any time" stops go no earlier. */
export const DAY_START = '08:00';

/**
 * About how many minutes it takes to drive from one place to another in the
 * city: 5 to park and walk in, and 4 a km, rounded up to 5. Distances are
 * straight lines, not roads, so it's a guess. Nothing within the same building.
 */
export const travelMinutes = (km: number): number => (km < 0.05 ? 0 : Math.ceil((5 + km * 4) / 5) * 5);

/** A stop in the day: when it is, and the drive to it from the last place the rep was. */
export interface Stop {
  item: PlanItem;
  /** Minutes since midnight. */
  start: number;
  end: number;
  /** Minutes and straight-line km to get there; 0 for a call or the same building. */
  travel: number;
  km: number;
  /** An "Any time" stop put outside their usual times, as none were left. */
  outside: boolean;
  /** An "Any time" stop that ends after the working day. */
  late: boolean;
}

/** Two visits with a time that overlap, or without time to get from one to the other. */
export interface Clash {
  kind: 'overlap' | 'travel';
  earlier: PlanItem;
  later: PlanItem;
  /** Minutes needed to get there, and free between them. */
  need: number;
  free: number;
}

export interface ScheduleOptions {
  coordsOf: CoordsOf;
  /** Where the day starts. */
  start: LonLat;
  /** Their usual times that day as [from, to] minutes, [] when they have none, null when it doesn't matter. */
  windowsOf?: (item: PlanItem) => [number, number][] | null;
  /** Today, minutes since midnight: a stop still to do goes no earlier. */
  now?: number | null;
}

/**
 * The day with a time for every stop, in time order. Visits with a time are at
 * their time. Each "Any time" stop, in the day's order, goes at the first time
 * after the stop before it and the drive there, and only where it still leaves
 * time to get to the next visit with a time; if it can't, that visit comes first.
 * It waits for their usual times when that still leaves time, and otherwise goes
 * as early as it can, said to be outside them, so the day keeps the rep's order.
 * So the app never puts a stop where it clashes. Visits with a time can still clash with each other, by overlapping or
 * by leaving too little time to get between them, and `clashes` says which.
 */
export function scheduleDay(items: PlanItem[], { coordsOf, start, windowsOf = () => null, now = null }: ScheduleOptions): { stops: Stop[]; clashes: Clash[] } {
  const dayStart = toMinutes(DAY_START);
  const dayEnd = toMinutes(END_OF_DAY);
  const route = routeOrder(activeItems(items));
  const hasTime = (i: PlanItem) => i.mode === 'timed' && !!i.time;
  const timed = route.filter(hasTime);
  const stops: Stop[] = [];
  const clashes: Clash[] = [];
  let last: Stop | null = null;
  let here = start;
  const kmTo = (from: LonLat, item: PlanItem) => (isOnSite(item) ? haversineKm(from, coordsOf(item)) : 0);
  const put = (item: PlanItem, at: number, km: number, outside = false) => {
    const stop: Stop = { item, start: at, end: at + item.duration, travel: travelMinutes(km), km, outside, late: !hasTime(item) && at + item.duration > dayEnd };
    stops.push(stop);
    if (!last || stop.end >= last.end) last = stop;
    if (isOnSite(item)) here = coordsOf(item);
  };
  const putTimed = (item: PlanItem) => {
    const at = startOf(item);
    const km = kmTo(here, item);
    const need = travelMinutes(km);
    if (last && last.end + need > at) {
      clashes.push({ kind: last.end > at ? 'overlap' : 'travel', earlier: last.item, later: item, need, free: Math.max(0, at - last.end) });
    }
    put(item, at, km);
  };
  const putAnyTime = (item: PlanItem) => {
    for (;;) {
      const km = kmTo(here, item);
      const soonest = item.status === 'planned' && now != null && now < dayEnd ? Math.ceil(now / 5) * 5 : 0;
      const at = Math.max(dayStart, last?.end ?? 0, soonest) + travelMinutes(km);
      const windows = windowsOf(item);
      const usual = windows?.map(([a, b]) => ({ at: Math.max(at, a), to: b })).find((w) => w.at + item.duration <= w.to)?.at;
      const next = timed.find((t) => !stops.some((s) => s.item === t));
      const after = isOnSite(item) ? coordsOf(item) : here;
      const fits = (t: number) => !next || t + item.duration + travelMinutes(kmTo(after, next)) <= startOf(next);
      if (fits(usual ?? at)) return put(item, usual ?? at, km, usual == null && windows != null);
      if (fits(at)) return put(item, at, km, true);
      putTimed(next!);
    }
  };
  for (const item of route) {
    if (stops.some((s) => s.item === item)) continue;
    if (hasTime(item)) putTimed(item);
    else putAnyTime(item);
  }
  return { stops: [...stops].sort((a, b) => a.start - b.start), clashes };
}

/**
 * How good the day's order is, lower being better: the minutes driving, and an
 * hour more for each "Any time" stop outside their usual times or after the
 * working day. Minutes aren't rounded here, so two orders rarely tie.
 */
export function dayCost(items: PlanItem[], options: ScheduleOptions): number {
  return scheduleDay(items, options).stops.reduce((sum, s) => sum + (s.travel ? 5 + s.km * 4 : 0) + (s.outside ? 60 : 0) + (s.late ? 60 : 0), 0);
}

/** The route with a stop put where the day costs least, no earlier than `from`. Among equal places a visit goes first, a call last. */
function insertBest(route: PlanItem[], item: PlanItem, cost: (route: PlanItem[]) => number, from: number): PlanItem[] {
  const places = Array.from({ length: route.length - from + 1 }, (_, n) => from + n);
  if (!isOnSite(item)) places.reverse();
  let best = [...route, item];
  let bestCost = Infinity;
  for (const k of places) {
    const tried = [...route.slice(0, k), item, ...route.slice(k)];
    const c = cost(tried);
    if (c < bestCost - 1e-9) {
      best = tried;
      bestCost = c;
    }
  }
  return best;
}

/**
 * Puts newly added "Any time" stops where the day costs least (`dayCost`): the
 * least driving, in their usual times, between the visits with a time and after
 * anything that has already happened (`minutesNow`, for today).
 */
export function placeStops(
  items: PlanItem[],
  ids: string[],
  coordsOf: CoordsOf,
  start: LonLat,
  minutesNow: number | null = null,
  windowsOf: ScheduleOptions['windowsOf'] = () => null,
): PlanItem[] {
  const placing = new Set(ids);
  const cost = (route: PlanItem[]) => dayCost(route, { coordsOf, start, windowsOf, now: minutesNow });
  let route = routeOrder(activeItems(items)).filter((i) => !placing.has(i.id));
  const from = fixedStops(route, minutesNow);
  for (const item of items.filter((i) => placing.has(i.id) && i.status !== 'cancelled')) {
    route = item.mode === 'timed' ? routeOrder([...route, item]) : insertBest(route, item, cost, from);
  }
  return [...route, ...items.filter((i) => i.status === 'cancelled')];
}

/**
 * The day's "Any time" stops that need travel in the order that costs least
 * (`dayCost`): each put in its best place, farthest first, then moved while a
 * better place helps. Visits with a time keep it, calls stay where they are, and
 * nothing moves before a visit that has already happened. When that saves less
 * than a minute the day comes back as it is.
 */
export function bestOrder(
  items: PlanItem[],
  coordsOf: CoordsOf,
  start: LonLat,
  minutesNow: number | null = null,
  windowsOf: ScheduleOptions['windowsOf'] = () => null,
): PlanItem[] {
  const cost = (route: PlanItem[]) => dayCost(route, { coordsOf, start, windowsOf, now: minutesNow });
  const route = routeOrder(activeItems(items));
  const from = fixedStops(route, minutesNow);
  const movable = route.filter((i, n) => n >= from && i.mode !== 'timed' && i.status === 'planned' && isOnSite(i));
  let ordered = route.filter((i) => !movable.includes(i));
  const fixed = fixedStops(ordered, minutesNow);
  const far = [...movable].sort((a, b) => haversineKm(start, coordsOf(b)) - haversineKm(start, coordsOf(a)));
  for (const item of far) ordered = insertBest(ordered, item, cost, fixed);
  for (let round = 0; round < movable.length; round++) {
    const before = cost(ordered);
    for (const item of movable) {
      const moved = insertBest(ordered.filter((i) => i !== item), item, cost, fixed);
      if (cost(moved) < cost(ordered) - 1e-9) ordered = moved;
    }
    if (cost(ordered) > before - 1e-9) break;
  }
  if (cost(ordered) > cost(route) - 1) return items;
  return [...ordered, ...items.filter((i) => i.status === 'cancelled')];
}

/** Total straight-line distance of the route, in km, from the start point. */
export function routeDistance(items: PlanItem[], coordsOf: CoordsOf, start: LonLat): number {
  let from = start;
  let total = 0;
  for (const item of routeOrder(activeItems(items)).filter(isOnSite)) {
    const to = coordsOf(item);
    total += haversineKm(from, to);
    from = to;
  }
  return total;
}
