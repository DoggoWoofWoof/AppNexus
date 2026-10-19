// The planner flows, ported from the prototype's tests/flows.test.js: cancel →
// fill from Targets, booking and rescheduling, and logging a planned visit.

import { describe, expect, test } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { bookingRoute, parseDays, suggestSlots } from '@/lib/booking';
import { getEntity } from '@/lib/data';
import { addDays, fromIso, isoDate, startOfDay } from '@/lib/format';
import { DEFAULT_FILTERS } from '@/lib/search';
import { useWorkspace, WorkspaceProvider } from '@/lib/store';
import type { Entity, Workspace } from '@/lib/types';
import { bookingError, bookVisit, buildContext, cancelVisit, fillSlot, findItem, freshWorkspace, noteError } from '@/lib/workspace';

const today = startOfDay(new Date(2026, 9, 19));
const todayIso = isoDate(today);
const entity = (id: string) => getEntity(id) as Entity;
const replacementRows = (ws: Workspace) => buildContext(ws, today).search({ ...DEFAULT_FILTERS, sort: 'distance', planned: 'unplanned' });

const cancelMaya = () => cancelVisit(freshWorkspace(today), todayIso, 'v-maya', 'HCP unavailable', todayIso);

describe('cancel → fill from Targets', () => {
  test('cancelling a timed visit frees its slot, nearest to that site, without anyone planned or the person who cancelled', () => {
    const ws = cancelMaya();
    expect(findItem(ws, todayIso, 'v-maya')).toMatchObject({ status: 'cancelled', cancelReason: 'HCP unavailable' });
    expect(ws.replacement).toMatchObject({ day: todayIso, time: '10:00', siteId: 'msw', targetId: 'maya' });
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
    const pick = replacementRows(ws)[0].entity;
    const next = fillSlot(ws, pick.id);
    const added = next.plans[todayIso].find((i) => i.targetId === pick.id);
    expect(added).toMatchObject({ time: '10:00', mode: 'timed', booking: 'requested', via: bookingRoute(pick).label });
    expect(next.replacement).toBeNull();
    expect(findItem(next, todayIso, 'v-jordan')?.time).toBe('14:00');
  });

  test('a flexible visit cancels without freeing a slot', () => {
    const ws = cancelVisit(freshWorkspace(today), todayIso, 'v-alex', 'Other', todayIso);
    expect(findItem(ws, todayIso, 'v-alex')?.status).toBe('cancelled');
    expect(ws.replacement).toBeNull();
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
    const ws = freshWorkspace(today);
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
    const ws = freshWorkspace(today);
    expect(bookingError(ws, { targetId: 'jordan', slot: { day: todayIso, time: '16:30', siteId: 'msm' }, confirmed: false })).toMatch(/already in your plan/);
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
  async function renderStore() {
    const wrapper = ({ children }: { children: ReactNode }) => <WorkspaceProvider today={today}>{children}</WorkspaceProvider>;
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

    await act(() => store.current.fillSlot('okafor'));
    expect(store.current.ws.plans[todayIso].some((i) => i.targetId === 'okafor')).toBe(true);
    expect(store.current.notice).toMatchObject({ message: 'Dr. Daniel Okafor added at 10:00 · not confirmed yet', canUndo: true });

    await act(() => store.current.undo());
    expect(store.current.ws.plans[todayIso].some((i) => i.targetId === 'okafor')).toBe(false);
    expect(store.current.ws.replacement?.time).toBe('10:00');
  });
});
