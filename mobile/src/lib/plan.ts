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
