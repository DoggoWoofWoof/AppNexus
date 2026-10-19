// The rep's workspace: plans, notes and follow-ups, and the questions screens
// ask of it. For now it is the sample, seeded relative to today and kept on the
// phone (lib/persist.ts); sync comes with the real services.

import { availability, bookingRoute, clashesWith, siteOnDay, suggestSlots, type Availability, type Slot } from './booking';
import { allEntities, getEntity, getOrg, lastInteraction, priorityOf, signalsFor, siteFor } from './data';
import { seedWorkspace } from './data/seed';
import { addDays, daysBetween, formatDate, fromIso, haversineKm, isoDate, toMinutes, uid } from './format';
import { activeItems, addTargets, moveStop, routeOrder, suggestOrder, timeStop } from './plan';
import { DEFAULT_PREFS, startPoint } from './prefs';
import { searchTargets, type Filters, type SearchContext } from './search';
import type { Entity, FollowUp, FreeSlot, Interaction, PlanItem, SavedReport, Signal, VisitType, Workspace } from './types';

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
    freeSlots: [],
    saved: [],
    prefs: DEFAULT_PREFS,
  };
}

export const haystack = (e: Entity): string =>
  (e.kind === 'hcp'
    ? [e.name, e.specialty, e.npi, ...e.affiliations.map((a) => getOrg(a.orgId)?.name ?? '')]
    : [e.name, e.type, e.typeDetail, e.address, e.city]
  ).join(' ');

/** Newest first; notes logged on the same day keep the order they were written in. */
export const newestFirst = (a: Interaction, b: Interaction): number =>
  b.date.localeCompare(a.date) || (b.createdAt ?? 0) - (a.createdAt ?? 0);

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

  // While a free slot is being filled, distances are from that visit's site to
  // where each person works that day, and the person who cancelled isn't offered back.
  const filling = fillingSlot(ws);
  const fillDay = filling ? fromIso(filling.day).getDay() : 0;
  const start = startPoint(ws);
  const origin = (filling && getOrg(filling.siteId)?.coords) || start.coords;
  const where = (e: Entity) => (filling ? siteFor(e, siteOnDay(e, fillDay) ?? undefined) : siteFor(e));
  const pool = filling ? entities.filter((e) => e.id !== filling.targetId) : entities;
  const searchContext: SearchContext = {
    signals,
    distance: (e) => haversineKm(origin, where(e).coords),
    planned: (e) => planItemFor(e.id, ws.selection.day),
    priority: (e) => priorityOf(e, ws, today),
    haystack,
  };

  // Today and the next four working days: the days the rep plans and books.
  const bookingDays: string[] = [];
  for (let d = today; bookingDays.length < 5; d = addDays(d, 1)) {
    if (!bookingDays.length || (d.getDay() !== 0 && d.getDay() !== 6)) bookingDays.push(isoDate(d));
  }

  return {
    ws,
    today,
    todayIso,
    /** Where the day starts, chosen on the You page: Today's map, distances, Pick 5 and Ask's "Who is near" start here. */
    start,
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
    /** The next planned visit to a target, today or later. */
    nextVisit: (id: string): { item: PlanItem; day: string } | null => {
      for (const day of Object.keys(ws.plans).filter((d) => d >= todayIso).sort()) {
        const item = routeOrder(ws.plans[day]).find((i) => i.targetId === id && i.status === 'planned');
        if (item) return { item, day };
      }
      return null;
    },
    lastInteraction: (id: string) => lastInteraction(id, ws),
    /** Notes about a target or that it attended, newest first. */
    interactionsFor: (id: string): Interaction[] =>
      ws.interactions.filter((i) => !i.deleted && (i.targetId === id || i.attendees.includes(id))).sort(newestFirst),
    /** A target's follow-ups, soonest due first. */
    followUpsFor: (id: string): FollowUp[] =>
      ws.followUps.filter((f) => f.targetId === id).sort((a, b) => a.due.localeCompare(b.due)),
    search: (f: Filters) => searchTargets(pool, f, searchContext),
    /** Times freed by cancelled visits on a day, soonest first. */
    freeSlotsOn: (day: string): FreeSlot[] => ws.freeSlots.filter((s) => s.day === day),
    /** The free slot Targets is filling, if any. */
    filling,
    /** Whether someone can be seen in the slot being filled, and where; null when nothing is being filled. */
    fitsSlot: (e: Entity): Availability | null => (filling ? availability(e, filling.day, filling.time, filling.duration) : null),
    bookingDays,
    /**
     * Times to offer when booking someone, skipping days they're already planned
     * (apart from `from`, the visit being moved) and the next half hour.
     */
    slotsFor: (entity: Entity, from: PlanItem | null = null, now = new Date()): Slot[] =>
      suggestSlots(entity, {
        days: bookingDays.filter((d) => !activeItems(ws.plans[d]).some((i) => i.targetId === entity.id && i.id !== from?.id)),
        plans: ws.plans,
        duration: from?.duration ?? defaultDuration(entity),
        earliest: { day: todayIso, minutes: now.getHours() * 60 + now.getMinutes() + 30 },
        except: from?.id,
      }),
    /** Targets most worth seeing on a day, leaving out anyone in that day's plan, even if they cancelled. */
    suggestions: (day: string, count: number) => {
      const planned = new Set((ws.plans[day] ?? []).map((i) => i.targetId));
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

// ---- Notes and follow-ups -------------------------------------------------
// The rules match the prototype's note and follow-up sheets (demo/js/actions.js).

export const OUTCOMES = ['Met', 'Attempted', 'Sent', 'Left message'];

/** What the Add note form collects. */
export interface NoteDraft {
  targetId: string;
  type: VisitType;
  outcome: string;
  /** The day it happened: today or earlier. */
  date: string;
  note: string;
  /** Doctors who were there too, for a meeting at an account. */
  attendees?: string[];
  /** People met who are not in the book, such as an account's executives. */
  contacts?: string[];
  /** A follow-up to create with the note. */
  followUp?: { text: string; due: string } | null;
  /** The planned visit this note logs; saving marks it done. */
  visit?: { day: string; id: string };
}

/** What the New follow-up form collects. */
export interface FollowUpDraft {
  targetId: string;
  text: string;
  due: string;
}

export interface DraftError {
  field: 'targetId' | 'outcome' | 'date' | 'followText' | 'followDue' | 'text' | 'due';
  message: string;
}

const isDay = (iso: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(iso) && isoDate(fromIso(iso)) === iso;

/** Why a note can't be saved yet, or null when it can. */
export function noteError(d: NoteDraft, todayIso: string): DraftError | null {
  if (!getEntity(d.targetId)) return { field: 'targetId', message: 'Choose who this was with.' };
  // Nothing is assumed: a visit that didn't happen shouldn't be logged as met.
  if (!d.outcome) return { field: 'outcome', message: 'Choose what happened, even if it was only a message.' };
  if (!isDay(d.date) || d.date > todayIso) return { field: 'date', message: 'Use today or an earlier date.' };
  if (d.followUp && !d.followUp.text.trim()) return { field: 'followText', message: 'Say what needs to happen, or untick “Create a follow-up”.' };
  if (d.followUp && !isDay(d.followUp.due)) return { field: 'followDue', message: 'Choose when it’s due.' };
  return null;
}

/** Why a follow-up can't be saved yet, or null when it can. */
export function followUpError(d: FollowUpDraft): DraftError | null {
  if (!getEntity(d.targetId)) return { field: 'targetId', message: 'Choose who the follow-up is for.' };
  if (!d.text.trim()) return { field: 'text', message: 'Say what needs to happen.' };
  if (!isDay(d.due)) return { field: 'due', message: 'Choose when it’s due.' };
  return null;
}

/** The records a valid note becomes: the interaction, and its follow-up if one was asked for. */
export function noteRecords(d: NoteDraft, now = Date.now()): { interaction: Interaction; followUp: FollowUp | null } {
  const isHcp = getEntity(d.targetId)?.kind === 'hcp';
  const interaction: Interaction = {
    id: uid('i'),
    targetId: d.targetId,
    attendees: isHcp ? [d.targetId] : (d.attendees ?? []),
    contacts: d.contacts ?? [],
    date: d.date,
    type: d.type,
    outcome: d.outcome,
    author: 'You',
    note: d.note.trim(),
    local: true,
    createdAt: now,
  };
  const followUp = d.followUp
    ? { ...followUpRecord({ targetId: d.targetId, ...d.followUp }), interactionId: interaction.id }
    : null;
  return { interaction, followUp };
}

export function followUpRecord(d: FollowUpDraft): FollowUp {
  return { id: uid('f'), targetId: d.targetId, text: d.text.trim(), due: d.due, done: false, local: true };
}

/** Ticks a follow-up off. */
export const completeFollowUp = (ws: Workspace, id: string, todayIso: string): Workspace => ({
  ...ws,
  pristine: false,
  followUps: ws.followUps.map((f) => (f.id === id ? { ...f, done: true, doneOn: todayIso } : f)),
});

/** Adds records to the workspace. It is no longer the untouched sample, so it won't be re-seeded. */
export function withRecords(ws: Workspace, add: { interactions?: Interaction[]; followUps?: FollowUp[] }): Workspace {
  return {
    ...ws,
    pristine: false,
    // Newest first, so notes written in the same millisecond still sort in the order they were written.
    interactions: [...(add.interactions ?? []), ...ws.interactions],
    followUps: [...ws.followUps, ...(add.followUps ?? [])],
  };
}

// ---- The day plan: add, arrange, cancel, fill and book ----------------------
// The rules match the prototype's visit and booking actions (demo/js/actions.js).

const TIME_24 = /^([01]\d|2[0-3]):[0-5]\d$/;

const defaultDuration = (e: Pick<Entity, 'kind'>): number => (e.kind === 'hco' ? 45 : 30);
const visitType = (e: Pick<Entity, 'kind'>): VisitType => (e.kind === 'hco' ? 'Meeting' : 'In-person visit');

const changed = (ws: Workspace, patch: Partial<Workspace>): Workspace => ({ ...ws, ...patch, pristine: false });

const withItem = (ws: Workspace, day: string, id: string, change: (item: PlanItem) => PlanItem): Workspace =>
  changed(ws, { plans: { ...ws.plans, [day]: (ws.plans[day] ?? []).map((i) => (i.id === id ? change(i) : i)) } });

export const findItem = (ws: Workspace, day: string, id: string): PlanItem | null =>
  (ws.plans[day] ?? []).find((i) => i.id === id) ?? null;

const withPlan = (ws: Workspace, day: string, change: (items: PlanItem[]) => PlanItem[]): Workspace =>
  changed(ws, { plans: { ...ws.plans, [day]: change(ws.plans[day] ?? []) } });

/**
 * Adds people to a day's plan at no fixed time, after the stops already there,
 * in the order given. Anyone already in that day's plan is left as they are.
 */
export function addPeople(ws: Workspace, day: string, targetIds: string[]): Workspace {
  const targets = [...new Set(targetIds)].map(getEntity).filter((t): t is Entity => !!t);
  if (!targets.length) return ws;
  const weekday = fromIso(day).getDay();
  const byId = new Map(targets.map((t) => [t.id, t]));
  return withPlan(ws, day, (items) => addTargets(items, targets, (t) => ({ id: siteOnDay(byId.get(t.id)!, weekday) ?? siteFor(byId.get(t.id)!).id })));
}

/** Adds someone to a day's plan at no fixed time, unless they're already in it. */
export const addToPlan = (ws: Workspace, day: string, targetId: string): Workspace => addPeople(ws, day, [targetId]);

/** Adds several people to a day at no fixed time, then puts the day's untimed stops nearest first. */
export function addAllToPlan(ws: Workspace, day: string, targetIds: string[]): Workspace {
  const next = addPeople(ws, day, targetIds);
  if (next === ws) return ws;
  const coordsOf = (i: PlanItem) => (getOrg(i.siteId) ?? siteFor(getEntity(i.targetId)!)).coords;
  return withPlan(next, day, (items) => suggestOrder(items, coordsOf, startPoint(ws).coords));
}

/** Moves a flexible stop one place earlier or later in the day. */
export const moveVisit = (ws: Workspace, day: string, id: string, direction: -1 | 1): Workspace =>
  withPlan(ws, day, (items) => moveStop(items, id, direction));

/** Why a flexible stop can't go at a time, or null when it can. A time that has already gone today can't be chosen. */
export function visitTimeError(ws: Workspace, day: string, id: string, time: string, now?: Date): string | null {
  const item = findItem(ws, day, id);
  if (!item || item.status !== 'planned') return 'That visit is no longer planned.';
  if (!TIME_24.test(time)) return 'Use a 24-hour time, such as 14:30.';
  if (now && fromIso(day).getTime() + toMinutes(time) * 60_000 <= now.getTime()) return 'That time has gone. Choose a later one.';
  const clash = clashesWith(ws.plans[day], time, item.duration, id)[0];
  return clash ? `Clashes with ${getEntity(clash.targetId)?.name} at ${clash.time}.` : null;
}

/** Gives a flexible stop a start time; the day then puts it in time order. It's the rep's own time, so nothing is booked. */
export const setVisitTime = (ws: Workspace, day: string, id: string, time: string): Workspace =>
  withPlan(ws, day, (items) => timeStop(items, id, time));

/** Takes a stop out of the day's plan. A logged visit stays, as the record of what happened. */
export function removeVisit(ws: Workspace, day: string, id: string): Workspace {
  const item = findItem(ws, day, id);
  if (!item || item.status === 'done') return ws;
  return withPlan(ws, day, (items) => items.filter((i) => i.id !== id));
}

/**
 * Cancels a visit. A timed visit that hasn't started yet frees its slot, which is
 * then offered to someone nearby; a time that has already gone can't be filled.
 */
export function cancelVisit(ws: Workspace, day: string, id: string, reason: string, todayIso: string, now?: Date): Workspace {
  const item = findItem(ws, day, id);
  const target = item && getEntity(item.targetId);
  if (!item || !target) return ws;
  const next = withItem(ws, day, id, (i) => ({ ...i, status: 'cancelled', cancelReason: reason }));
  if (item.mode !== 'timed' || !item.time || day < todayIso) return next;
  if (now && fromIso(day).getTime() + toMinutes(item.time) * 60_000 <= now.getTime()) return next;
  const slot: FreeSlot = { day, time: item.time, duration: item.duration, siteId: siteFor(target, item.siteId).id, name: target.name, targetId: target.id, itemId: id };
  return {
    ...next,
    // Targets fills the newest free slot first; the others wait in the list.
    selection: { ...next.selection, day, slot: id },
    freeSlots: [...next.freeSlots.filter((s) => s.itemId !== id), slot].sort((a, b) => a.day.localeCompare(b.day) || a.time.localeCompare(b.time)),
  };
}

/** Puts a cancelled visit back, and stops offering its slot to anyone else. */
export function restoreVisit(ws: Workspace, day: string, id: string): Workspace {
  const next = withItem(ws, day, id, ({ cancelReason: _reason, ...i }) => ({ ...i, status: 'planned' }));
  return leaveFree(next, id);
}

/** Leaves a free slot free, so it's no longer offered. Slots are known by the cancelled visit's id. */
export const leaveFree = (ws: Workspace, slotId: string): Workspace => ({ ...ws, freeSlots: ws.freeSlots.filter((s) => s.itemId !== slotId) });

/** The free slot Targets fills: the one chosen on the day shown, or that day's first. */
export function fillingSlot(ws: Workspace): FreeSlot | null {
  const onDay = ws.freeSlots.filter((s) => s.day === ws.selection.day);
  return onDay.find((s) => s.itemId === ws.selection.slot) ?? onDay[0] ?? null;
}

/** Chooses which free slot Targets fills, and shows its day. */
export function chooseSlot(ws: Workspace, slotId: string): Workspace {
  const slot = ws.freeSlots.find((s) => s.itemId === slotId);
  return slot ? { ...ws, selection: { ...ws.selection, day: slot.day, slot: slotId } } : ws;
}

/**
 * Puts someone in a free slot as a requested visit, booked through their usual
 * route. Only someone usually on site and seeing people then, and not already
 * in that day's plan, can go in it.
 */
export function fillSlot(ws: Workspace, slotId: string, targetId: string): Workspace {
  const slot = ws.freeSlots.find((s) => s.itemId === slotId);
  const entity = getEntity(targetId);
  if (!slot || !entity || activeItems(ws.plans[slot.day]).some((i) => i.targetId === targetId)) return ws;
  const fit = availability(entity, slot.day, slot.time, slot.duration);
  if (!fit.ok) return ws;
  const item: PlanItem = {
    id: uid('v'),
    targetId,
    siteId: fit.siteId,
    mode: 'timed',
    time: slot.time,
    duration: slot.duration,
    type: visitType(entity),
    goal: '',
    status: 'planned',
    booking: 'requested',
    via: bookingRoute(entity).label,
  };
  return changed(withPlan(ws, slot.day, (items) => [...items, item]), { freeSlots: ws.freeSlots.filter((s) => s !== slot) });
}

/** What the Book a time form collects. */
export interface BookingDraft {
  targetId: string;
  slot: Slot | null;
  /** They've already agreed to the time. */
  confirmed: boolean;
  /** The visit being moved, when rescheduling. */
  from?: { day: string; id: string };
}

/** Why a booking can't be saved yet, or null when it can. */
export function bookingError(ws: Workspace, d: BookingDraft): string | null {
  const target = getEntity(d.targetId);
  if (!target) return 'Choose who to book.';
  if (!d.slot) return 'Choose a time.';
  if (!TIME_24.test(d.slot.time)) return 'Use a 24-hour time, such as 14:30.';
  const from = d.from ? findItem(ws, d.from.day, d.from.id) : null;
  if (activeItems(ws.plans[d.slot.day]).some((i) => i.targetId === target.id && i.id !== from?.id)) {
    return `${target.name} is already in your plan on ${formatDate(d.slot.day)}.`;
  }
  const clash = clashesWith(ws.plans[d.slot.day], d.slot.time, from?.duration ?? defaultDuration(target), from?.id)[0];
  return clash ? `Clashes with ${getEntity(clash.targetId)?.name} at ${clash.time}.` : null;
}

/** Adds the booked time to the plan. A rescheduled visit moves there and keeps its type and goal. */
export function bookVisit(ws: Workspace, d: BookingDraft): Workspace {
  const target = getEntity(d.targetId);
  if (!target || !d.slot) return ws;
  const from = d.from ? findItem(ws, d.from.day, d.from.id) : null;
  const item: PlanItem = {
    id: uid('v'),
    targetId: target.id,
    siteId: d.slot.siteId,
    mode: 'timed',
    time: d.slot.time,
    duration: from?.duration ?? defaultDuration(target),
    type: from?.type ?? visitType(target),
    goal: from?.goal ?? '',
    status: 'planned',
    booking: d.confirmed ? 'confirmed' : 'requested',
    via: bookingRoute(target).label,
    // The week's summary says it moved; a visit moved twice keeps where it started.
    ...(d.from && from?.status === 'planned' ? { movedFrom: from.movedFrom ?? { day: d.from.day, time: from.time } } : {}),
  };
  const plans = { ...ws.plans };
  if (d.from && from?.status === 'planned') plans[d.from.day] = plans[d.from.day].filter((i) => i.id !== from.id);
  plans[d.slot.day] = [...(plans[d.slot.day] ?? []), item];
  return changed(ws, { plans });
}

/** The office has agreed to the time. */
export const confirmBooking = (ws: Workspace, day: string, id: string): Workspace =>
  withItem(ws, day, id, (i) => ({ ...i, booking: 'confirmed' }));

// ---- Saved reports --------------------------------------------------------

export const saveReport = (ws: Workspace, report: SavedReport): Workspace => changed(ws, { saved: [report, ...ws.saved] });

export const removeSaved = (ws: Workspace, id: string): Workspace => changed(ws, { saved: ws.saved.filter((r) => r.id !== id) });

/** A logged visit is done. */
export const visitDone = (ws: Workspace, day: string, id: string): Workspace =>
  withItem(ws, day, id, (i) => ({ ...i, status: 'done' }));
