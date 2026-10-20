// Pure day-plan logic: ordering, conflicts, adding targets and straight-line route estimates.

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
 * Moves a flexible stop one place earlier or later in the route, past a timed
 * stop if that's what is next to it. Timed stops stay put: their time sets
 * their place. Cancelled visits go to the end, as the day shows them.
 */
export function moveStop(items: PlanItem[], id: string, direction: -1 | 1): PlanItem[] {
  const route = routeOrder(activeItems(items));
  const index = route.findIndex((i) => i.id === id);
  const to = index + direction;
  if (index < 0 || route[index].mode === 'timed' || to < 0 || to >= route.length) return items;
  [route[index], route[to]] = [route[to], route[index]];
  return [...route, ...items.filter((i) => i.status === 'cancelled')];
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

/**
 * Re-orders flexible stops nearest-first, starting after the last timed stop
 * (or the rep's start point). Timed stops keep their times.
 */
export function suggestOrder(items: PlanItem[], coordsOf: CoordsOf, start: LonLat): PlanItem[] {
  const timed = routeOrder(items).filter((i) => i.mode === 'timed');
  const remaining = items.filter((i) => i.mode !== 'timed' && i.status !== 'cancelled');
  const cancelled = items.filter((i) => i.mode !== 'timed' && i.status === 'cancelled');
  let from = timed.length ? coordsOf(timed[timed.length - 1]) : start;
  const ordered: PlanItem[] = [];
  while (remaining.length) {
    let best = 0;
    remaining.forEach((item, i) => {
      if (haversineKm(from, coordsOf(item)) < haversineKm(from, coordsOf(remaining[best]))) best = i;
    });
    const [next] = remaining.splice(best, 1);
    ordered.push(next);
    from = coordsOf(next);
  }
  return [...timed, ...ordered, ...cancelled];
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

/** Straight-line km for a route in this order, from the start point, counting only the stops that need travel. */
const travel = (route: PlanItem[], coordsOf: CoordsOf, start: LonLat): number => {
  let from = start;
  let total = 0;
  for (const item of route) {
    if (!isOnSite(item)) continue;
    const to = coordsOf(item);
    total += haversineKm(from, to);
    from = to;
  }
  return total;
};

/** The route with a stop put where it adds the least travel, no earlier than `from`. A call or an email goes last. */
function insertCheapest(route: PlanItem[], item: PlanItem, coordsOf: CoordsOf, start: LonLat, from: number): PlanItem[] {
  if (!isOnSite(item)) return [...route, item];
  let best: PlanItem[] | null = null;
  let bestKm = Infinity;
  for (let k = from; k <= route.length; k++) {
    const tried = [...route.slice(0, k), item, ...route.slice(k)];
    const km = travel(tried, coordsOf, start);
    if (km < bestKm - 1e-9) {
      best = tried;
      bestKm = km;
    }
  }
  return best ?? [...route, item];
}

/**
 * Puts newly added "Any time" stops where each adds the least travel, between the
 * fixed visits and after anything that has already happened (`minutesNow`, for today).
 */
export function placeStops(items: PlanItem[], ids: string[], coordsOf: CoordsOf, start: LonLat, minutesNow: number | null = null): PlanItem[] {
  const placing = new Set(ids);
  let route = routeOrder(activeItems(items)).filter((i) => !placing.has(i.id));
  const from = fixedStops(route, minutesNow);
  for (const item of items.filter((i) => placing.has(i.id) && i.status !== 'cancelled')) {
    route = item.mode === 'timed' ? routeOrder([...route, item]) : insertCheapest(route, item, coordsOf, start, from);
  }
  return [...route, ...items.filter((i) => i.status === 'cancelled')];
}

/**
 * The day's "Any time" stops that need travel, each put where it adds the least,
 * farthest first. Visits with a time keep it, calls stay where they are, and
 * nothing moves before a visit that has already happened.
 */
export function bestOrder(items: PlanItem[], coordsOf: CoordsOf, start: LonLat, minutesNow: number | null = null): PlanItem[] {
  const route = routeOrder(activeItems(items));
  const from = fixedStops(route, minutesNow);
  const movable = route.filter((i, n) => n >= from && i.mode !== 'timed' && i.status === 'planned' && isOnSite(i));
  let ordered = route.filter((i) => !movable.includes(i));
  const fixed = fixedStops(ordered, minutesNow);
  const far = [...movable].sort((a, b) => haversineKm(start, coordsOf(b)) - haversineKm(start, coordsOf(a)));
  for (const item of far) ordered = insertCheapest(ordered, item, coordsOf, start, fixed);
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
