// The day as it goes: when a visit is due a log, the next working day, logging
// covering the visits it was, moves and cancels freeing their times, filling a
// freed time only when it still can be, visits from earlier in the week never
// logged, and the app moving on to the new day at midnight.
// The sample day is Tuesday 20 October 2026.

import { describe, expect, jest, test } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { availability, siteOnDay } from '@/lib/booking';
import { allEntities, getEntity } from '@/lib/data';
import { addDays, isoDate, startOfDay } from '@/lib/format';
import { notLogged } from '@/lib/plan';
import { useWorkspace, WorkspaceProvider } from '@/lib/store';
import type { PlanItem, Workspace } from '@/lib/types';
import { bookVisit, buildContext, cancelVisit, fillSlot, fillSlotError, findItem, freshWorkspace, setVisitTime, visitsLogged, type NoteDraft } from '@/lib/workspace';

const today = startOfDay(new Date(2026, 9, 20));
const todayIso = isoDate(today);
const wedIso = isoDate(addDays(today, 1));
const at = (h: number, m: number) => new Date(2026, 9, 20, h, m);
const fresh = () => freshWorkspace(today);
const ctxOf = (ws: Workspace) => buildContext(ws, today);
const status = (ws: Workspace, id: string, day = todayIso) => findItem(ws, day, id)?.status;
const note = (patch: Partial<NoteDraft>): NoteDraft => ({ targetId: 'maya', type: 'In-person visit', outcome: 'Met', date: todayIso, note: '', ...patch });

describe('a visit due a log', () => {
  const visit = (extra: Partial<PlanItem>): PlanItem => ({
    id: 'v',
    targetId: 'maya',
    siteId: 'msh',
    mode: 'timed',
    time: '10:00',
    duration: 30,
    type: 'In-person visit',
    goal: '',
    status: 'planned',
    ...extra,
  });

  test('one with a time once it has ended; an "Any time" one from 17:30; a logged one never', () => {
    expect(notLogged(visit({}), 10 * 60 + 29)).toBe(false);
    expect(notLogged(visit({}), 10 * 60 + 30)).toBe(true);
    expect(notLogged(visit({ mode: 'flexible', time: null }), 17 * 60 + 29)).toBe(false);
    expect(notLogged(visit({ mode: 'flexible', time: null }), 17 * 60 + 30)).toBe(true);
    expect(notLogged(visit({ status: 'done' }), 23 * 60)).toBe(false);
    expect(notLogged(visit({ status: 'cancelled' }), 23 * 60)).toBe(false);
  });
});

describe('the next working day', () => {
  test('is tomorrow from Monday to Thursday, and Monday from a Friday', () => {
    expect(ctxOf(fresh()).planDays()).toEqual([
      { iso: todayIso, label: 'Today' },
      { iso: wedIso, label: 'Tomorrow' },
    ]);
    const friday = startOfDay(new Date(2026, 9, 23));
    const ctx = buildContext(freshWorkspace(friday), friday);
    expect(ctx.planDays()[1]).toEqual({ iso: '2026-10-26', label: 'Monday' });
    expect([ctx.dayWord('2026-10-23'), ctx.dayWord('2026-10-26'), ctx.dayWord('2026-10-28')]).toEqual(['today', 'Monday', 'Wed 28 Oct']);
    expect(ctxOf(fresh()).dayWord(wedIso)).toBe('tomorrow');
  });

  test('suggestions for it are people in that day, and wait for anyone planned or seen today', () => {
    const ctx = ctxOf(fresh());
    const picks = ctx.suggestions(wedIso, 50);
    expect(picks.length).toBeGreaterThan(0);
    expect(picks.every((s) => siteOnDay(s.entity, 3))).toBe(true);
    for (const plannedToday of ['maya', 'jordan', 'alex']) expect(picks.some((s) => s.entity.id === plannedToday)).toBe(false);
    // Today's own suggestions are people in today.
    expect(ctx.suggestions(todayIso, 50).every((s) => siteOnDay(s.entity, 2))).toBe(true);
  });
});

describe('logging covers the visits it was', () => {
  test('the visit it was logged from, with what happened', () => {
    const ws = visitsLogged(fresh(), note({ outcome: 'Attempted', visit: { day: todayIso, id: 'v-maya' } }));
    expect(findItem(ws, todayIso, 'v-maya')).toMatchObject({ status: 'done', outcome: 'Attempted' });
  });

  test('a note of the same kind for someone planned that day, but not a call for a visit', () => {
    expect(status(visitsLogged(fresh(), note({})), 'v-maya')).toBe('done');
    expect(status(visitsLogged(fresh(), note({ type: 'Phone call' })), 'v-maya')).toBe('planned');
    // A message isn't a visit.
    expect(status(visitsLogged(fresh(), note({ outcome: 'Left message' })), 'v-maya')).toBe('planned');
    // Nor does a note for another day count.
    expect(status(visitsLogged(fresh(), note({ date: isoDate(addDays(today, -1)) })), 'v-maya')).toBe('planned');
  });

  test('a meeting at an account covers the doctors ticked as there', () => {
    const ws = visitsLogged(fresh(), note({ targetId: 'msh', type: 'Meeting', attendees: ['maya', 'alex'] }));
    expect(status(ws, 'v-maya')).toBe('done');
    // Alex was planned as a phone call, which being in the room doesn't cover.
    expect(status(ws, 'v-alex')).toBe('planned');
  });
});

describe('a moved or cancelled visit frees its time', () => {
  const moveJordan = (ws: Workspace, day: string, time: string, now = at(8, 0)) =>
    bookVisit(ws, { targetId: 'jordan', slot: { day, time, siteId: 'msm' }, confirmed: true, from: { day: todayIso, id: 'v-jordan' } }, todayIso, now);

  test('moving a visit offers its old time, saying it moved', () => {
    const ws = moveJordan(fresh(), wedIso, '09:00');
    expect(ctxOf(ws).freeSlotsOn(todayIso)).toEqual([expect.objectContaining({ time: '14:00', targetId: 'jordan', moved: true })]);
    // Today stays on the day it was showing.
    expect(ws.selection.day).toBe(fresh().selection.day);
  });

  test('not when the new time takes the old one, nor once the old time has gone', () => {
    expect(moveJordan(fresh(), todayIso, '14:15').freeSlots).toEqual([]);
    expect(moveJordan(fresh(), wedIso, '09:00', at(14, 5)).freeSlots).toEqual([]);
  });

  test('Today leaves out a freed time once it has gone or something else is there', () => {
    const ws = cancelVisit(fresh(), todayIso, 'v-maya', 'Clinic ran late', todayIso, at(8, 0));
    expect(ctxOf(ws).freeSlotsOn(todayIso, at(9, 0)).map((s) => s.time)).toEqual(['10:00']);
    expect(ctxOf(ws).freeSlotsOn(todayIso, at(10, 0))).toEqual([]);
    expect(ctxOf(setVisitTime(ws, todayIso, 'v-alex', '10:00')).freeSlotsOn(todayIso, at(9, 0))).toEqual([]);
  });
});

describe('filling a freed time', () => {
  const cancelled = () => cancelVisit(fresh(), todayIso, 'v-maya', 'Clinic ran late', todayIso, at(8, 0));

  test('says why someone can’t go in it, and leaves the plan as it was', () => {
    const ws = cancelled();
    expect(fillSlotError(ws, 'v-maya', 'jordan', at(8, 0))).toBe('Dr. Jordan Lee is already in your plan that day.');
    expect(fillSlotError(ws, 'v-maya', 'jordan', at(10, 5))).toBe('10:00 has gone. Choose a later time.');
    expect(fillSlotError(setVisitTime(ws, todayIso, 'v-alex', '10:00'), 'v-maya', 'okafor', at(8, 0))).toBe('10:00 is taken now, by Dr. Alex Morgan.');
    const away = allEntities().find((e) => e.kind === 'hcp' && !availability(e, todayIso, '10:00', 30).ok && !['maya', 'jordan', 'alex'].includes(e.id));
    expect(away).toBeTruthy();
    expect(fillSlotError(ws, 'v-maya', away!.id, at(8, 0))).toMatch(new RegExp(`^${away!.name.replace('.', '\\.')} isn’t usually free then\\. `));
    expect(fillSlot(ws, 'v-maya', 'jordan', at(8, 0))).toBe(ws);
  });

  test('someone free then goes in it', () => {
    const ws = cancelled();
    const free = allEntities().find((e) => e.kind === 'hcp' && availability(e, todayIso, '10:00', 30).ok && !['maya', 'jordan', 'alex'].includes(e.id));
    expect(free).toBeTruthy();
    expect(fillSlotError(ws, 'v-maya', free!.id, at(8, 0))).toBeNull();
    const filled = fillSlot(ws, 'v-maya', free!.id, at(8, 0));
    expect(filled.plans[todayIso].find((i) => i.targetId === free!.id)).toMatchObject({ time: '10:00', status: 'planned', booking: 'requested' });
  });
});

describe('visits from earlier in the week never logged', () => {
  test('are listed until logged or said not to have happened, back seven days', () => {
    const ws = fresh();
    expect(ctxOf(ws).unloggedBefore().map(({ day, item }) => [day, item.id])).toEqual([['2026-10-15', 'v-raman-past']]);
    const older = { ...ws, plans: { ...ws.plans, '2026-10-12': [{ ...ws.plans['2026-10-15'][0], id: 'v-too-old' }] } };
    expect(ctxOf(older).unloggedBefore().map(({ item }) => item.id)).toEqual(['v-raman-past']);
    expect(ctxOf(cancelVisit(ws, '2026-10-15', 'v-raman-past', 'Didn’t happen', todayIso)).unloggedBefore()).toEqual([]);
    expect(ctxOf(visitsLogged(ws, note({ targetId: 'priya', date: '2026-10-15', visit: { day: '2026-10-15', id: 'v-raman-past' } }))).unloggedBefore()).toEqual([]);
  });
});

describe('at midnight', () => {
  test('the app moves on to the new day, keeping the rep’s work', async () => {
    jest.useFakeTimers();
    try {
      let clock = new Date(2026, 9, 20, 23, 59);
      const wrapper = ({ children }: { children: ReactNode }) => <WorkspaceProvider now={() => clock}>{children}</WorkspaceProvider>;
      const { result } = await renderHook(() => useWorkspace(), { wrapper });
      expect(result.current.todayIso).toBe(todayIso);
      await act(() => {
        result.current.addNote({ targetId: 'okafor', type: 'Phone call', outcome: 'Met', date: todayIso, note: 'Asked for the trial summary' });
      });
      clock = new Date(2026, 9, 21, 0, 1);
      await act(() => {
        jest.advanceTimersByTime(2 * 60_000);
      });
      expect(result.current.todayIso).toBe(wedIso);
      expect(result.current.planDays()[0]).toEqual({ iso: wedIso, label: 'Today' });
      expect(result.current.ws.interactions.some((i) => i.note === 'Asked for the trial summary')).toBe(true);
      // Undo can't reach back across the day.
      expect(result.current.notice).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
