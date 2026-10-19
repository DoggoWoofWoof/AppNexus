// Pure day-plan logic: ordering, conflicts, adding targets and straight-line route estimates.

import { fromMinutes, haversineKm, toMinutes, uid } from './format.js';

export const VISIT_TYPES = ['In-person visit', 'Phone call', 'Video call', 'Meeting', 'Email'];
export const DURATIONS = [15, 30, 45, 60, 90];

/** Items that are still part of the day (not cancelled). */
export const activeItems = (items = []) => items.filter((i) => i.status !== 'cancelled');

/**
 * Route order: timed stops by start time, then flexible stops in the order
 * the rep arranged them.
 */
export function routeOrder(items = []) {
  const timed = items.filter((i) => i.mode === 'timed').sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
  const flexible = items.filter((i) => i.mode !== 'timed');
  return [...timed, ...flexible];
}

/** Pairs of timed items whose time windows overlap, as [earlier, later]. */
export function conflicts(items = []) {
  const timed = activeItems(items)
    .filter((i) => i.mode === 'timed' && i.time)
    .sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
  const out = [];
  for (let i = 0; i < timed.length; i++) {
    const end = toMinutes(timed[i].time) + timed[i].duration;
    for (let j = i + 1; j < timed.length && toMinutes(timed[j].time) < end; j++) out.push([timed[i], timed[j]]);
  }
  return out;
}

export const endTime = (item) => fromMinutes(toMinutes(item.time) + item.duration);

/** A new plan item for a target; flexible by default so nothing is double-booked. */
export function newItem(target, siteId) {
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
export function addTargets(items, targets, siteFor) {
  const planned = new Set(activeItems(items).map((i) => i.targetId));
  const additions = targets.filter((t) => !planned.has(t.id)).map((t) => newItem(t, siteFor(t).id));
  return [...items, ...additions];
}

/** Moves a flexible item up or down within the flexible group. */
export function moveFlexible(items, id, direction) {
  const flexible = items.filter((i) => i.mode !== 'timed');
  const index = flexible.findIndex((i) => i.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= flexible.length) return items;
  [flexible[index], flexible[target]] = [flexible[target], flexible[index]];
  return [...items.filter((i) => i.mode === 'timed'), ...flexible];
}

/**
 * Re-orders flexible stops nearest-first, starting after the last timed stop
 * (or the rep's start point). Timed stops keep their times.
 */
export function suggestOrder(items, coordsOf, start) {
  const timed = routeOrder(items).filter((i) => i.mode === 'timed');
  const remaining = items.filter((i) => i.mode !== 'timed' && i.status !== 'cancelled');
  const cancelled = items.filter((i) => i.mode !== 'timed' && i.status === 'cancelled');
  let from = timed.length ? coordsOf(timed[timed.length - 1]) : start;
  const ordered = [];
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

/** Total straight-line distance of the route, in km, from the start point. */
export function routeDistance(items, coordsOf, start) {
  let from = start;
  let total = 0;
  for (const item of routeOrder(activeItems(items)).filter(isOnSite)) {
    const to = coordsOf(item);
    total += haversineKm(from, to);
    from = to;
  }
  return total;
}

/** Whether the visit needs the rep to travel. */
export const isOnSite = (item) => item.type === 'In-person visit' || item.type === 'Meeting';
