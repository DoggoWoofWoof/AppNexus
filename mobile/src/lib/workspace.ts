// The rep's workspace: plans, notes and follow-ups, and the questions screens
// ask of it. For now it is the sample, seeded relative to today and held in
// memory; on-device storage and sync come with the real services.

import { allEntities, getOrg, lastInteraction, priorityOf, signalsFor, siteFor } from './data';
import { REP, seedWorkspace } from './data/seed';
import { addDays, daysBetween, fromIso, haversineKm, isoDate } from './format';
import { activeItems, routeOrder } from './plan';
import { searchTargets, type Filters, type SearchContext } from './search';
import type { Entity, PlanItem, Signal, Workspace } from './types';

/** Same version as the prototype's saved workspace, so the shapes stay in step. */
export const WORKSPACE_VERSION = 2;

export function freshWorkspace(today: Date): Workspace {
  return {
    version: WORKSPACE_VERSION,
    seededOn: isoDate(today),
    // Untouched sample workspaces are re-seeded each day so the sample plan stays current.
    pristine: true,
    ...seedWorkspace(today),
    selection: { day: isoDate(today), ids: [] },
  };
}

export const haystack = (e: Entity): string =>
  (e.kind === 'hcp'
    ? [e.name, e.specialty, e.npi, ...e.affiliations.map((a) => getOrg(a.orgId)?.name ?? '')]
    : [e.name, e.type, e.typeDetail, e.address, e.city]
  ).join(' ');

/** Everything screens derive from the workspace for a given day. */
export function buildContext(ws: Workspace, today: Date) {
  const todayIso = isoDate(today);
  const tomorrowIso = isoDate(addDays(today, 1));
  const entities = allEntities();
  const signalCache = new Map<string, Signal[]>();
  const signals = (e: Entity): Signal[] => {
    if (!signalCache.has(e.id)) signalCache.set(e.id, signalsFor(e, ws, today));
    return signalCache.get(e.id)!;
  };
  const planItemFor = (id: string, day: string): PlanItem | null =>
    activeItems(ws.plans[day]).find((i) => i.targetId === id) ?? null;

  const searchContext: SearchContext = {
    signals,
    distance: (e) => haversineKm(REP.start.coords, siteFor(e).coords),
    planned: (e) => planItemFor(e.id, ws.selection.day),
    priority: (e) => priorityOf(e, ws, today),
    haystack,
  };

  return {
    ws,
    today,
    todayIso,
    signals,
    planItemFor,
    planDays: () => [
      { iso: todayIso, label: 'Today' },
      { iso: tomorrowIso, label: 'Tomorrow' },
    ],
    /** The day's visits in route order, cancelled ones last. */
    dayPlan: (day: string): PlanItem[] => {
      const items = ws.plans[day] ?? [];
      return [...routeOrder(activeItems(items)), ...items.filter((i) => i.status === 'cancelled')];
    },
    lastInteraction: (id: string) => lastInteraction(id, ws),
    search: (f: Filters) => searchTargets(entities, f, searchContext),
    /** Unplanned targets most worth seeing on a day. */
    suggestions: (day: string, count: number) => {
      const planned = new Set(activeItems(ws.plans[day]).map((i) => i.targetId));
      return entities
        .filter((e) => !planned.has(e.id) && (e.kind === 'hcp' || (e.type !== 'Health system' && e.assigned)))
        .map((entity) => ({ entity, signals: signals(entity), priority: priorityOf(entity, ws, today) }))
        .sort((a, b) => b.priority - a.priority)
        .slice(0, count);
    },
    /** Open follow-ups, soonest due first, with how many days overdue (negative when upcoming). */
    openFollowUps: () =>
      ws.followUps
        .filter((f) => !f.done)
        .sort((a, b) => a.due.localeCompare(b.due))
        .map((f) => ({ ...f, overdueBy: daysBetween(fromIso(f.due), today) })),
  };
}

export type Context = ReturnType<typeof buildContext>;
