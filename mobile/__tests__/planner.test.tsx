// The planner flows, ported from the prototype's tests/flows.test.js: cancel →
// fill from Targets, booking and rescheduling, and logging a planned visit. Then
// changing a visit, and adding several people from Targets.
// The sample day is Monday 19 October 2026.

import { describe, expect, test } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { availability, bookingRoute, inOnDay, parseDays, suggestSlots, usualTimes } from '@/lib/booking';
import { getEntity } from '@/lib/data';
import { addDays, fromIso, isoDate, startOfDay } from '@/lib/format';
import { DEFAULT_FILTERS } from '@/lib/search';
import { useWorkspace, WorkspaceProvider } from '@/lib/store';
import type { Entity, Workspace } from '@/lib/types';
import {
  addPeople,
  bookingError,
  bookVisit,
  buildContext,
  cancelVisit,
  changeStop,
  chooseSlot,
  fillSlot,
  fillingSlot,
  findItem,
  leaveFree,
  moveStop,
  noteError,
  placeOf,
  removeVisit,
  restoreVisit,
  sampleWorkspace,
  setVisitTime,
  visitTimeError,
} from '@/lib/workspace';

const today = startOfDay(new Date(2026, 9, 19));
const todayIso = isoDate(today);
const tomorrowIso = isoDate(addDays(today, 1));
const entity = (id: string) => getEntity(id) as Entity;
const replacementRows = (ws: Workspace) => buildContext(ws, today).search({ ...DEFAULT_FILTERS, sort: 'distance', planned: 'unplanned' });
const dayIds = (ws: Workspace, day = todayIso) => buildContext(ws, today).dayPlan(day).map((i) => i.id);

const cancelMaya = (ws = sampleWorkspace(today)) => cancelVisit(ws, todayIso, 'v-maya', 'HCP unavailable', todayIso);
const cancelBoth = () => cancelVisit(cancelMaya(), todayIso, 'v-jordan', 'HCP unavailable', todayIso);

describe('cancel → fill from Targets', () => {
  test('cancelling a timed visit frees its slot, nearest to that site, without anyone planned or the person who cancelled', () => {
    const ws = cancelMaya();
    expect(findItem(ws, todayIso, 'v-maya')).toMatchObject({ status: 'cancelled', cancelReason: 'HCP unavailable' });
    expect(ws.freeSlots).toEqual([expect.objectContaining({ day: todayIso, time: '10:00', siteId: 'msw', targetId: 'maya', itemId: 'v-maya' })]);
    expect(fillingSlot(ws)?.itemId).toBe('v-maya');
    const rows = replacementRows(ws);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => !r.planned)).toBe(true);
    expect(rows.some((r) => r.entity.id === 'maya')).toBe(false);
    const km = rows.map((r) => r.distance);
    expect(km).toEqual([...km].sort((a, b) => a - b));
    // Nor is she suggested again under Who to see.
    expect(buildContext(ws, today).suggestions(todayIso, 50).some((s) => s.entity.id === 'maya')).toBe(false);
  });

  test('filling the slot adds a requested visit at that time and leaves the rest of the day alone', () => {
    const ws = cancelMaya();
    const ctx = buildContext(ws, today);
    const pick = replacementRows(ws).find((r) => ctx.fitsSlot(r.entity)?.ok)!.entity;
    const next = fillSlot(ws, 'v-maya', pick.id);
    const added = next.plans[todayIso].find((i) => i.targetId === pick.id);
    expect(added).toMatchObject({ time: '10:00', mode: 'timed', booking: 'requested', via: bookingRoute(pick).label });
    expect(next.freeSlots).toEqual([]);
    expect(findItem(next, todayIso, 'v-jordan')?.time).toBe('14:00');
  });

  test('a visit whose time has already come cancels without offering its slot', () => {
    const at = (h: number, m: number) => new Date(2026, 9, 19, h, m);
    const late = cancelVisit(sampleWorkspace(today), todayIso, 'v-maya', 'Other', todayIso, at(10, 0));
    expect(findItem(late, todayIso, 'v-maya')?.status).toBe('cancelled');
    expect(late.freeSlots).toEqual([]);
    expect(cancelVisit(sampleWorkspace(today), todayIso, 'v-maya', 'Other', todayIso, at(9, 59)).freeSlots[0]?.time).toBe('10:00');
  });

  test('putting a cancelled visit back stops offering its slot', () => {
    const ws = restoreVisit(cancelMaya(), todayIso, 'v-maya');
    expect(findItem(ws, todayIso, 'v-maya')).toMatchObject({ status: 'planned', time: '10:00' });
    expect(findItem(ws, todayIso, 'v-maya')?.cancelReason).toBeUndefined();
    expect(ws.freeSlots).toEqual([]);
  });

  test('a flexible visit cancels without freeing a slot', () => {
    const ws = cancelVisit(sampleWorkspace(today), todayIso, 'v-alex', 'Other', todayIso);
    expect(findItem(ws, todayIso, 'v-alex')?.status).toBe('cancelled');
    expect(ws.freeSlots).toEqual([]);
  });
});

describe('who a free slot is offered to', () => {
  test('only people on site that day and inside their usual times; everyone else says when they are', () => {
    // Monday 10:00 for half an hour.
    const at10 = (id: string) => availability(entity(id), todayIso, '10:00', 30);
    expect(at10('kenji')).toEqual({ ok: true, siteId: 'msh' });
    expect(at10('hannah')).toEqual({ ok: true, siteId: 'kidney' });
    expect(at10('okafor')).toEqual({ ok: false, why: 'Usually Mon–Thu 15:00–17:00' });
    expect(at10('maya')).toEqual({ ok: false, why: 'Usually Tue/Thu 07:30–08:30' });
    expect(at10('jordan')).toEqual({ ok: false, why: 'Usually weekdays 14:00–17:00' });
    // In the window, but the visit would run past its end.
    expect(availability(entity('kenji'), todayIso, '10:45', 30).ok).toBe(false);
    // Inside a usual time on a day they aren't on site.
    const wednesday = isoDate(addDays(today, 2));
    expect(availability(entity('priya'), wednesday, '12:30', 30).ok).toBe(false);
    expect(availability(entity('sam'), wednesday, '13:00', 30)).toEqual({ ok: true, siteId: 'msh' });
    // Accounts keep office hours, and so does a doctor whose own times aren't known.
    expect(usualTimes(entity('msw'))).toBe('Office hours weekdays 09:00–17:00');
    expect(usualTimes(entity('hannah'))).toBe('Office hours weekdays 09:00–17:00');
  });

  test('Targets asks the same question of each row, and nobody else can be put in the slot', () => {
    const ws = cancelMaya();
    const ctx = buildContext(ws, today);
    expect(ctx.fitsSlot(entity('kenji'))?.ok).toBe(true);
    expect(ctx.fitsSlot(entity('okafor'))?.ok).toBe(false);
    expect(fillSlot(ws, 'v-maya', 'okafor')).toBe(ws);
    // Nor someone already in the day's plan, nor a slot that isn't free.
    expect(fillSlot(ws, 'v-maya', 'jordan')).toBe(ws);
    expect(fillSlot(ws, 'v-jordan', 'kenji')).toBe(ws);
    // Nothing is being filled until a visit is cancelled.
    expect(buildContext(sampleWorkspace(today), today).fitsSlot(entity('kenji'))).toBeNull();
  });

  test('distances while filling are to where each person works that day', () => {
    // Dr. Watanabe is at Mount Sinai Hospital every weekday; Dr. Patel's 10:00 was at Mount Sinai West.
    const row = replacementRows(cancelMaya()).find((r) => r.entity.id === 'kenji')!;
    expect(row.distance).toBeGreaterThan(3);
  });
});

describe('more than one free slot', () => {
  test('a second cancel keeps the first slot, soonest first, and Targets fills the newest', () => {
    const ws = cancelBoth();
    expect(ws.freeSlots.map((s) => s.time)).toEqual(['10:00', '14:00']);
    expect(fillingSlot(ws)?.itemId).toBe('v-jordan');
    expect(buildContext(ws, today).freeSlotsOn(todayIso)).toHaveLength(2);
    expect(buildContext(ws, today).freeSlotsOn(tomorrowIso)).toHaveLength(0);
  });

  test('filling, leaving or putting back one slot leaves the others offered', () => {
    const ws = cancelBoth();
    // Dr. Cohen keeps office hours, so 14:00 suits her.
    const filled = fillSlot(ws, 'v-jordan', 'hannah');
    expect(findItem(filled, todayIso, filled.plans[todayIso][filled.plans[todayIso].length - 1].id)).toMatchObject({ targetId: 'hannah', time: '14:00' });
    expect(filled.freeSlots.map((s) => s.itemId)).toEqual(['v-maya']);
    // Targets moves on to the one that's left.
    expect(fillingSlot(filled)?.itemId).toBe('v-maya');

    expect(leaveFree(ws, 'v-maya').freeSlots.map((s) => s.itemId)).toEqual(['v-jordan']);
    expect(restoreVisit(ws, todayIso, 'v-jordan').freeSlots.map((s) => s.itemId)).toEqual(['v-maya']);
  });

  test('the rep can choose which slot to fill; it has to be one that is free', () => {
    const ws = chooseSlot(cancelBoth(), 'v-maya');
    expect(fillingSlot(ws)?.time).toBe('10:00');
    expect(buildContext(ws, today).filling?.time).toBe('10:00');
    expect(chooseSlot(ws, 'v-alex')).toBe(ws);
    // A slot on another day isn't filled from the day being shown.
    expect(fillingSlot({ ...ws, selection: { ...ws.selection, day: tomorrowIso } })).toBeNull();
  });
});

describe('changing a visit', () => {
  test('giving an "Any time" stop a time checks it, then puts it in time order without booking anything', () => {
    const ws = sampleWorkspace(today);
    const noon = new Date(2026, 9, 19, 12, 0);
    expect(visitTimeError(ws, todayIso, 'v-alex', '14:10', noon)).toBe('Clashes with Dr. Jordan Lee at 14:00.');
    expect(visitTimeError(ws, todayIso, 'v-alex', '9.30', noon)).toMatch(/24-hour/);
    expect(visitTimeError(ws, todayIso, 'v-alex', '11:00', noon)).toMatch(/has gone/);
    expect(visitTimeError(ws, tomorrowIso, 'v-alex', '16:00', noon)).toMatch(/no longer planned/);
    expect(visitTimeError(ws, todayIso, 'v-alex', '12:30', noon)).toBeNull();

    const timed = setVisitTime(ws, todayIso, 'v-alex', '08:30');
    expect(findItem(timed, todayIso, 'v-alex')).toMatchObject({ mode: 'timed', time: '08:30' });
    expect(findItem(timed, todayIso, 'v-alex')?.booking).toBeUndefined();
    expect(dayIds(timed)).toEqual(['v-alex', 'v-maya', 'v-jordan']);
  });

  test('a stop can be taken out of the plan, but a logged one stays', () => {
    const ws = sampleWorkspace(today);
    expect(dayIds(removeVisit(ws, todayIso, 'v-alex'))).toEqual(['v-maya', 'v-jordan']);
    const logged = { ...ws, plans: { ...ws.plans, [todayIso]: ws.plans[todayIso].map((i) => (i.id === 'v-maya' ? { ...i, status: 'done' as const } : i)) } };
    expect(removeVisit(logged, todayIso, 'v-maya')).toBe(logged);
  });

  // Dr. Watanabe, Dr. Patel at 10:00, Dr. Lee at 14:00, Dr. Cohen, then the call to Dr. Morgan.
  const fuller = () => addPeople(sampleWorkspace(today), todayIso, ['kenji', 'hannah']);
  const idOf = (ws: Workspace, targetId: string) => ws.plans[todayIso].find((i) => i.targetId === targetId)!.id;
  const order = (ws: Workspace, now?: Date) => buildContext(ws, today).dayPlan(todayIso, now).map((i) => i.targetId);

  test('an "Any time" stop dragged to the top is the next one', () => {
    const ws = fuller();
    expect(order(ws)).toEqual(['kenji', 'maya', 'jordan', 'hannah', 'alex']);
    const next = moveStop(ws, todayIso, idOf(ws, 'hannah'), 0);
    // Dr. Watanabe no longer fits before Dr. Patel's 10:00, so comes after it.
    expect(order(next)).toEqual(['hannah', 'maya', 'kenji', 'jordan', 'alex']);
    expect(placeOf(next, todayIso, idOf(ws, 'hannah'))).toEqual({ first: true, next: true, after: null });
    // One that's next already, or has a time, stays where it is.
    expect(moveStop(ws, todayIso, idOf(ws, 'kenji'), 0)).toBe(ws);
    expect(moveStop(ws, todayIso, 'v-maya', 0)).toBe(ws);
  });

  test('later in the day it goes after the visits that have started, or after a visit with a time it can’t fit before', () => {
    const ws = fuller();
    const eleven = new Date(2026, 9, 19, 11, 0);
    const late = moveStop(ws, todayIso, idOf(ws, 'hannah'), 0, eleven);
    expect(order(late, eleven).slice(0, 2)).toEqual(['maya', 'hannah']);
    expect(placeOf(late, todayIso, idOf(ws, 'hannah'), eleven)?.first).toBe(true);
    // At 09:40 there's no time before Dr. Patel's 10:00, so Dr. Cohen comes straight after it.
    const soon = new Date(2026, 9, 19, 9, 40);
    const tight = moveStop(ws, todayIso, idOf(ws, 'hannah'), 0, soon);
    expect(order(tight, soon).slice(0, 2)).toEqual(['maya', 'hannah']);
    expect(placeOf(tight, todayIso, idOf(ws, 'hannah'), soon)).toMatchObject({ first: false, after: { id: 'v-maya' } });
  });

  test('a stop dragged to a place goes there, even outside their usual times, which the day then says', () => {
    const ws = fuller();
    const next = moveStop(ws, todayIso, idOf(ws, 'kenji'), 2);
    expect(order(next)).toEqual(['maya', 'jordan', 'kenji', 'hannah', 'alex']);
    // Dr. Watanabe is usually in on Monday mornings only.
    expect(buildContext(next, today).daySchedule(todayIso).stops.find((s) => s.item.targetId === 'kenji')?.outside).toBe(true);
  });

  test('a visit can become a phone call, or take longer, and the day’s times follow', () => {
    const ws = fuller();
    const stop = (w: Workspace, targetId: string) => buildContext(w, today).daySchedule(todayIso).stops.find((s) => s.item.targetId === targetId)!;
    expect(stop(ws, 'kenji').travel).toBeGreaterThan(0);
    const call = changeStop(ws, todayIso, idOf(ws, 'kenji'), { type: 'Phone call' });
    expect(stop(call, 'kenji').travel).toBe(0);
    const longer = changeStop(ws, todayIso, 'v-jordan', { duration: 60 });
    expect(stop(longer, 'hannah').start - stop(ws, 'hannah').start).toBe(30);
  });
});

describe('adding several people from Targets', () => {
  test('puts each where it adds the least driving in their usual times, skipping anyone already planned', () => {
    const ws = sampleWorkspace(today);
    const next = addPeople(ws, todayIso, ['kenji', 'jordan', 'hannah', 'kenji', 'nobody']);
    const plan = buildContext(next, today).dayPlan(todayIso);
    // Dr. Watanabe fits before the 10:00 and Dr. Cohen after Dr. Lee's 14:00; the call
    // to Dr. Morgan stays in his usual 16:00–17:30, so it comes last.
    expect(plan.map((i) => i.targetId)).toEqual(['kenji', 'maya', 'jordan', 'hannah', 'alex']);
    expect(plan.filter((i) => i.targetId === 'kenji' || i.targetId === 'hannah').every((i) => i.mode === 'flexible' && i.status === 'planned')).toBe(true);
    expect(addPeople(ws, todayIso, ['nobody'])).toBe(ws);
  });
});

describe('booking', () => {
  test('suggests times inside the person’s own windows and avoids clashes', () => {
    const days = Array.from({ length: 14 }, (_, n) => isoDate(addDays(today, n + 1)));
    const slots = suggestSlots(entity('maya'), { days, plans: {}, count: 10 });
    expect(slots.length).toBeGreaterThan(0);
    for (const s of slots) {
      expect(parseDays('Tue, Thu').has(fromIso(s.day).getDay())).toBe(true);
      expect(s.time >= '07:30' && s.time < '08:30').toBe(true);
    }
    const first = slots[0];
    const busy = { [first.day]: [{ id: 'x', targetId: 'sam', siteId: 'msw', mode: 'timed' as const, time: first.time, duration: 30, type: 'In-person visit' as const, goal: '', status: 'planned' as const }] };
    const moved = suggestSlots(entity('maya'), { days, plans: busy, count: 1 })[0];
    expect(moved.day).toBe(first.day);
    expect(moved.time >= '08:00').toBe(true);

    expect(bookingRoute(entity('maya')).label).toBe('Rosa Diaz, scheduler');
    expect(bookingRoute(entity('jordan')).label).toBe('Email');
    expect(bookingRoute(entity('msw')).label).toMatch(/main line$/);
  });

  test('rescheduling checks for clashes, then moves the visit and keeps its goal', () => {
    const ws = sampleWorkspace(today);
    const from = { day: todayIso, id: 'v-maya' };
    expect(bookingError(ws, { targetId: 'maya', slot: { day: todayIso, time: '14:10', siteId: 'msw' }, confirmed: false, from })).toMatch(/^Clashes with .+ at 14:00\.$/);
    expect(bookingError(ws, { targetId: 'maya', slot: { day: todayIso, time: '9.30', siteId: 'msw' }, confirmed: false, from })).toMatch(/24-hour/);
    expect(bookingError(ws, { targetId: 'maya', slot: null, confirmed: false })).toBe('Choose a time.');

    const draft = { targetId: 'maya', slot: { day: todayIso, time: '16:00', siteId: 'msw' }, confirmed: true, from };
    expect(bookingError(ws, draft)).toBeNull();
    const next = bookVisit(ws, draft);
    expect(findItem(next, todayIso, 'v-maya')).toBeNull();
    const moved = next.plans[todayIso].find((i) => i.targetId === 'maya');
    expect(moved).toMatchObject({ time: '16:00', booking: 'confirmed', goal: 'Bring the procedure mix vs. peers report.' });
  });

  test('someone already planned that day can’t be booked twice', () => {
    const ws = sampleWorkspace(today);
    expect(bookingError(ws, { targetId: 'jordan', slot: { day: todayIso, time: '16:30', siteId: 'msm' }, confirmed: false })).toMatch(/already in your plan/);
  });
});

describe('adding several at once', () => {
  test('puts each person in an empty day once, at no fixed time', () => {
    const tomorrow = isoDate(addDays(today, 1));
    const ws = sampleWorkspace(today);
    const ids = buildContext(ws, today).suggestions(tomorrow, 5).map((s) => s.entity.id);
    const next = addPeople(ws, tomorrow, [...ids, ids[0], 'nobody']);
    const plan = next.plans[tomorrow];
    expect(plan.map((i) => i.targetId).sort()).toEqual([...ids].sort());
    expect(plan.every((i) => i.status === 'planned' && i.mode === 'flexible')).toBe(true);
    expect(next.pristine).toBe(false);
    expect(addPeople(ws, tomorrow, ['nobody'])).toBe(ws);
  });
});

describe('logging a planned visit', () => {
  test('needs an outcome; nothing is assumed', () => {
    const draft = { targetId: 'maya', type: 'In-person visit' as const, outcome: '', date: todayIso, note: '' };
    expect(noteError(draft, todayIso)?.field).toBe('outcome');
    expect(noteError({ ...draft, outcome: 'Attempted' }, todayIso)).toBeNull();
  });
});

describe('store', () => {
  async function renderStore(clock = new Date(2026, 9, 19, 8, 0)) {
    // Eight in the morning unless said, before any of the day's visits.
    const wrapper = ({ children }: { children: ReactNode }) => (
      <WorkspaceProvider today={today} now={() => clock} initial={sampleWorkspace(today)}>
        {children}
      </WorkspaceProvider>
    );
    const { result } = await renderHook(() => useWorkspace(), { wrapper });
    return result;
  }

  test('logging a visit from the plan marks it done', async () => {
    const store = await renderStore();
    await act(() => {
      store.current.addNote({ targetId: 'maya', type: 'In-person visit', outcome: 'Met', date: todayIso, note: 'Agreed next steps', visit: { day: todayIso, id: 'v-maya' } });
    });
    expect(findItem(store.current.ws, todayIso, 'v-maya')?.status).toBe('done');
  });

  test('cancel, fill and Undo', async () => {
    const store = await renderStore();
    let freed = false;
    await act(() => {
      freed = store.current.cancelVisit(todayIso, 'v-maya', 'HCP unavailable');
    });
    expect(freed).toBe(true);
    expect(store.current.notice?.message).toBe('Visit cancelled · 10:00 is free');

    // Dr. Okafor isn't usually seeing people at 10:00, so nothing happens.
    await act(() => store.current.fillSlot('v-maya', 'okafor'));
    expect(store.current.ws.plans[todayIso].some((i) => i.targetId === 'okafor')).toBe(false);

    await act(() => store.current.fillSlot('v-maya', 'kenji'));
    expect(store.current.ws.plans[todayIso].some((i) => i.targetId === 'kenji')).toBe(true);
    expect(store.current.notice).toMatchObject({ message: 'Dr. Kenji Watanabe added today at 10:00 · not confirmed yet', canUndo: true });

    await act(() => store.current.undo());
    expect(store.current.ws.plans[todayIso].some((i) => i.targetId === 'kenji')).toBe(false);
    expect(store.current.ws.freeSlots[0]?.time).toBe('10:00');
  });

  test('Change visit: setting a time and taking a stop out can be undone', async () => {
    const store = await renderStore();
    const ids = () => store.current.dayPlan(todayIso).map((i) => i.id);

    // Before eight, and clashing, are refused with a reason.
    let error: string | null = null;
    await act(() => {
      error = store.current.setStopTime(todayIso, 'v-alex', '07:30');
    });
    expect(error).toMatch(/has gone/);
    await act(() => {
      error = store.current.setStopTime(todayIso, 'v-alex', '16:00');
    });
    expect(error).toBeNull();
    expect(store.current.notice).toMatchObject({ message: 'Dr. Alex Morgan at 16:00 today', canUndo: true });
    expect(findItem(store.current.ws, todayIso, 'v-alex')).toMatchObject({ mode: 'timed', time: '16:00' });
    await act(() => store.current.undo());
    expect(findItem(store.current.ws, todayIso, 'v-alex')?.mode).toBe('flexible');

    await act(() => store.current.removeStop(todayIso, 'v-alex'));
    expect(ids()).toEqual(['v-maya', 'v-jordan']);
    expect(store.current.notice).toMatchObject({ message: 'Dr. Alex Morgan taken out of the plan', canUndo: true });
    await act(() => store.current.undo());
    expect(ids()).toEqual(['v-maya', 'v-jordan', 'v-alex']);
  });

  test('Change visit: putting a stop next, making it a call and making it longer can each be undone', async () => {
    const store = await renderStore();
    const ids = () => store.current.dayPlan(todayIso).map((i) => i.id);
    await act(() => store.current.moveStop(todayIso, 'v-alex', 0));
    expect(ids()).toEqual(['v-alex', 'v-maya', 'v-jordan']);
    expect(store.current.notice).toMatchObject({ message: 'Dr. Alex Morgan is next', canUndo: true });
    await act(() => store.current.undo());
    expect(ids()).toEqual(['v-maya', 'v-jordan', 'v-alex']);

    await act(() => store.current.changeStop(todayIso, 'v-maya', { type: 'Phone call' }));
    expect(store.current.notice?.message).toBe('Dr. Maya Patel is now a phone call');
    await act(() => store.current.undo());
    expect(findItem(store.current.ws, todayIso, 'v-maya')?.type).toBe('In-person visit');

    await act(() => store.current.changeStop(todayIso, 'v-maya', { duration: 45 }));
    expect(store.current.notice?.message).toBe('Dr. Maya Patel now takes 45 min');
    expect(findItem(store.current.ws, todayIso, 'v-maya')?.duration).toBe(45);
  });

  test('several people picked on Targets go in with one toast and one Undo', async () => {
    const store = await renderStore();
    await act(() => store.current.addPeople(['kenji', 'hannah', 'jordan'], todayIso));
    // Each goes where it adds the least driving; Dr. Lee was already planned.
    expect(store.current.dayPlan(todayIso).map((i) => i.targetId)).toEqual(['kenji', 'maya', 'jordan', 'hannah', 'alex']);
    expect(store.current.notice).toMatchObject({ message: '2 visits added today', canUndo: true });
    await act(() => store.current.undo());
    expect(store.current.dayPlan(todayIso)).toHaveLength(3);

    // Dr. Watanabe sees people on Mondays only, so the message says Tuesday isn't one of their usual days.
    await act(() => store.current.addPeople(['kenji'], tomorrowIso));
    expect(store.current.notice?.message).toBe('Dr. Kenji Watanabe added tomorrow · not their usual time');
  });

  test('after 17:30 an add to today goes on the next working day, with Today instead', async () => {
    const store = await renderStore(new Date(2026, 9, 19, 18, 0));
    const planned = (id: string) => [todayIso, tomorrowIso].filter((d) => store.current.planItemFor(id, d));
    expect(store.current.addingTo(todayIso)).toBe(tomorrowIso);
    await act(() => store.current.addToPlan('kenji'));
    expect(planned('kenji')).toEqual([tomorrowIso]);
    // Today and Targets show the day they went on.
    expect(store.current.ws.selection.day).toBe(tomorrowIso);
    // Tuesday isn't one of Dr. Watanabe's usual days, so the message says so too.
    expect(store.current.notice).toMatchObject({ message: 'Today’s over: Dr. Kenji Watanabe added tomorrow · not their usual time', canUndo: true, action: { label: 'Today instead' } });

    await act(() => store.current.notice?.action?.run());
    expect(planned('kenji')).toEqual([todayIso]);
    expect(store.current.ws.selection.day).toBe(todayIso);
    expect(store.current.notice?.message).toMatch(/^Dr\. Kenji Watanabe added today/);
    expect(store.current.notice?.action).toBeUndefined();
    // Today stays the rep's choice for the evening.
    expect(store.current.addingTo(todayIso)).toBe(todayIso);
    await act(() => store.current.addToPlan('hannah'));
    expect(planned('hannah')).toEqual([todayIso]);
    await act(() => store.current.undo());
    expect(planned('hannah')).toEqual([]);
    expect(planned('kenji')).toEqual([todayIso]);
  });

  test('Undo after Today instead goes back to before the add', async () => {
    const store = await renderStore(new Date(2026, 9, 19, 18, 0));
    await act(() => store.current.addPeople(['kenji', 'hannah'], todayIso));
    expect(store.current.notice?.message).toBe('Today’s over: 2 visits added tomorrow');
    await act(() => store.current.notice?.action?.run());
    expect(store.current.planItemFor('kenji', todayIso)).not.toBeNull();
    await act(() => store.current.undo());
    expect(['kenji', 'hannah'].flatMap((id) => [todayIso, tomorrowIso].map((d) => store.current.planItemFor(id, d))).every((i) => i === null)).toBe(true);
  });

  test('someone added on a day they aren’t in is said so, with a day they are in instead', async () => {
    const store = await renderStore();
    const wedIso = isoDate(addDays(today, 2));
    const thuIso = isoDate(addDays(today, 3));
    // Dr. Raman works Monday, Tuesday, Thursday and Friday.
    await act(() => store.current.addToPlan('priya', wedIso));
    expect(store.current.notice).toMatchObject({
      message: 'Dr. Priya Raman added on Wednesday, but they’re not in on Wednesdays',
      action: { label: 'Thursday instead' },
    });
    const item = store.current.planItemFor('priya', wedIso)!;
    expect(store.current.timeWarning(item, wedIso, true)).toBe('Not in on Wednesdays · try Thursday');
    expect(store.current.moveDayFor(item, wedIso)).toBe(thuIso);

    await act(() => store.current.notice?.action?.run());
    expect(store.current.planItemFor('priya', wedIso)).toBeNull();
    expect(store.current.planItemFor('priya', thuIso)).not.toBeNull();
    expect(store.current.notice?.message).toBe('Dr. Priya Raman added on Thursday');
    // The day shown stays as it was.
    expect(store.current.ws.selection.day).toBe(todayIso);
    await act(() => store.current.undo());
    expect([wedIso, thuIso].map((d) => store.current.planItemFor('priya', d))).toEqual([null, null]);

    await act(() => store.current.addPeople(['priya', 'kenji'], wedIso));
    expect(store.current.notice).toMatchObject({ message: '2 visits added on Wednesday · 1 is not in on Wednesdays', action: undefined });
  });

  test('a stop at a time that doesn’t suit them says when does', async () => {
    const store = await renderStore();
    const wedIso = isoDate(addDays(today, 2));
    // A time the rep set outside Dr. Watanabe's Monday mornings.
    await act(() => store.current.addToPlan('kenji', todayIso));
    const kenji = store.current.planItemFor('kenji', todayIso)!;
    await act(() => {
      store.current.setStopTime(todayIso, kenji.id, '15:00');
    });
    expect(store.current.timeWarning(store.current.planItemFor('kenji', todayIso)!, todayIso, false)).toBe('Not their usual time · usually 08:00–11:00');
    // A visit booked with them was agreed, so it's fine.
    expect(store.current.timeWarning(findItem(store.current.ws, todayIso, 'v-maya')!, todayIso, false)).toBeNull();
    // A call can be made on a day they aren't in.
    await act(() => store.current.addToPlan('priya', wedIso, 'Phone call'));
    expect(store.current.timeWarning(store.current.planItemFor('priya', wedIso)!, wedIso, false)).toBeNull();
  });

  test('an account is spoken of as a place: office hours, and closed rather than not in', async () => {
    const store = await renderStore();
    // A meeting the rep set before Mount Sinai Hospital's offices open.
    await act(() => store.current.addToPlan('msh', todayIso));
    const msh = store.current.planItemFor('msh', todayIso)!;
    await act(() => {
      store.current.setStopTime(todayIso, msh.id, '08:30');
    });
    expect(store.current.timeWarning(store.current.planItemFor('msh', todayIso)!, todayIso, false)).toBe('Outside office hours · 09:00–17:00');
    // Its offices are closed at the weekend.
    const saturday = isoDate(addDays(today, 5));
    expect(inOnDay(entity('msh'), saturday)).toEqual({ ok: false, why: 'Closed on Saturdays' });
    await act(() => store.current.addToPlan('harlem', saturday));
    expect(store.current.notice?.message).toBe('Mount Sinai Harlem Health Center added on Saturday, but it’s closed on Saturdays');
  });

  test('two cancels give two free slots, each filled or left on its own', async () => {
    const store = await renderStore();
    await act(() => {
      store.current.cancelVisit(todayIso, 'v-maya', 'HCP unavailable');
    });
    await act(() => {
      store.current.cancelVisit(todayIso, 'v-jordan', 'HCP unavailable');
    });
    expect(store.current.freeSlotsOn(todayIso).map((s) => s.time)).toEqual(['10:00', '14:00']);
    expect(store.current.filling?.time).toBe('14:00');

    await act(() => store.current.chooseSlot('v-maya'));
    expect(store.current.filling?.time).toBe('10:00');
    await act(() => store.current.leaveFree('v-maya'));
    expect(store.current.filling?.time).toBe('14:00');
    await act(() => store.current.fillSlot('v-jordan', 'hannah'));
    expect(store.current.freeSlotsOn(todayIso)).toEqual([]);
    expect(store.current.filling).toBeNull();
  });
});
