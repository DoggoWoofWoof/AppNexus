// The day as it goes: when a visit is due a log, the next working day, logging
// covering the visits it was, moves and cancels freeing their times, filling a
// freed time only when it still can be, visits from earlier in the week never
// logged, someone seen outside the plan, changing and moving a stop, the visits
// not done once the day is over, Undo after a note, and the app moving on to the
// new day at midnight.
// The sample day is Tuesday 20 October 2026.

import { describe, expect, jest, test } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { availability, siteOnDay } from '@/lib/booking';
import { allEntities, getEntity } from '@/lib/data';
import { addDays, isoDate, startOfDay } from '@/lib/format';
import { fixedStops, notLogged } from '@/lib/plan';
import { useWorkspace, WorkspaceProvider } from '@/lib/store';
import type { PlanItem, Workspace } from '@/lib/types';
import {
  addPeople,
  bookVisit,
  buildContext,
  cancelVisit,
  changeStop,
  fillingSlot,
  fillSlot,
  fillSlotError,
  findItem,
  moveToDay,
  moveToDayError,
  noteRecords,
  sampleWorkspace,
  setVisitTime,
  visitsLogged,
  withRecords,
  type NoteDraft,
} from '@/lib/workspace';

const today = startOfDay(new Date(2026, 9, 20));
const todayIso = isoDate(today);
const wedIso = isoDate(addDays(today, 1));
const at = (h: number, m: number) => new Date(2026, 9, 20, h, m);
const sample = () => sampleWorkspace(today);
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
    expect(ctxOf(sample()).planDays()).toEqual([
      { iso: todayIso, label: 'Today' },
      { iso: wedIso, label: 'Tomorrow' },
    ]);
    const friday = startOfDay(new Date(2026, 9, 23));
    const ctx = buildContext(sampleWorkspace(friday), friday);
    expect(ctx.planDays()[1]).toEqual({ iso: '2026-10-26', label: 'Monday' });
    // The weekday in the coming week, and the date after that.
    expect([ctx.dayWord('2026-10-23'), ctx.dayWord('2026-10-26'), ctx.dayWord('2026-10-28'), ctx.dayWord('2026-10-30')]).toEqual([
      'today',
      'Monday',
      'Wednesday',
      'Fri 30 Oct',
    ]);
    expect(ctxOf(sample()).dayWord(wedIso)).toBe('tomorrow');
  });

  test('suggestions for it are people in that day, and wait for anyone planned or seen today', () => {
    const ctx = ctxOf(sample());
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
    const ws = visitsLogged(sample(), note({ outcome: 'Attempted', visit: { day: todayIso, id: 'v-maya' } }));
    expect(findItem(ws, todayIso, 'v-maya')).toMatchObject({ status: 'done', outcome: 'Attempted' });
  });

  test('a note of the same kind for someone planned that day, but not a call for a visit', () => {
    expect(status(visitsLogged(sample(), note({})), 'v-maya')).toBe('done');
    expect(status(visitsLogged(sample(), note({ type: 'Phone call' })), 'v-maya')).toBe('planned');
    // A message isn't a visit.
    expect(status(visitsLogged(sample(), note({ outcome: 'Left message' })), 'v-maya')).toBe('planned');
    // Nor does a note for another day count.
    expect(status(visitsLogged(sample(), note({ date: isoDate(addDays(today, -1)) })), 'v-maya')).toBe('planned');
  });

  test('a meeting at an account covers the doctors ticked as there', () => {
    const ws = visitsLogged(sample(), note({ targetId: 'msh', type: 'Meeting', attendees: ['maya', 'alex'] }));
    expect(status(ws, 'v-maya')).toBe('done');
    // Alex was planned as a phone call, which being in the room doesn't cover.
    expect(status(ws, 'v-alex')).toBe('planned');
  });
});

describe('a moved or cancelled visit frees its time', () => {
  const moveJordan = (ws: Workspace, day: string, time: string, now = at(8, 0)) =>
    bookVisit(ws, { targetId: 'jordan', slot: { day, time, siteId: 'msm' }, confirmed: true, from: { day: todayIso, id: 'v-jordan' } }, todayIso, now);

  test('moving a visit offers its old time, saying it moved', () => {
    const ws = moveJordan(sample(), wedIso, '09:00');
    expect(ctxOf(ws).freeSlotsOn(todayIso)).toEqual([expect.objectContaining({ time: '14:00', targetId: 'jordan', moved: true })]);
    // Today stays on the day it was showing.
    expect(ws.selection.day).toBe(sample().selection.day);
  });

  test('not when the new time takes the old one, nor once the old time has gone', () => {
    expect(moveJordan(sample(), todayIso, '14:15').freeSlots).toEqual([]);
    expect(moveJordan(sample(), wedIso, '09:00', at(14, 5)).freeSlots).toEqual([]);
  });

  test('Today leaves out a freed time once it has gone or something else is there', () => {
    const ws = cancelVisit(sample(), todayIso, 'v-maya', 'Clinic ran late', todayIso, at(8, 0));
    expect(ctxOf(ws).freeSlotsOn(todayIso, at(9, 0)).map((s) => s.time)).toEqual(['10:00']);
    expect(ctxOf(ws).freeSlotsOn(todayIso, at(10, 0))).toEqual([]);
    expect(ctxOf(setVisitTime(ws, todayIso, 'v-alex', '10:00')).freeSlotsOn(todayIso, at(9, 0))).toEqual([]);
  });
});

describe('filling a freed time', () => {
  const cancelled = () => cancelVisit(sample(), todayIso, 'v-maya', 'Clinic ran late', todayIso, at(8, 0));

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
    const ws = sample();
    expect(ctxOf(ws).unloggedBefore().map(({ day, item }) => [day, item.id])).toEqual([['2026-10-15', 'v-raman-past']]);
    const older = { ...ws, plans: { ...ws.plans, '2026-10-12': [{ ...ws.plans['2026-10-15'][0], id: 'v-too-old' }] } };
    expect(ctxOf(older).unloggedBefore().map(({ item }) => item.id)).toEqual(['v-raman-past']);
    expect(ctxOf(cancelVisit(ws, '2026-10-15', 'v-raman-past', 'Didn’t happen', todayIso)).unloggedBefore()).toEqual([]);
    expect(ctxOf(visitsLogged(ws, note({ targetId: 'priya', date: '2026-10-15', visit: { day: '2026-10-15', id: 'v-raman-past' } }))).unloggedBefore()).toEqual([]);
  });
});

describe('seen outside the plan', () => {
  const noted = (ws: Workspace, patch: Partial<NoteDraft>) => withRecords(ws, { interactions: [noteRecords(note(patch)).interaction] });

  test('a note counts as logged today, met over not in, and a meeting at an account for the doctors there', () => {
    expect(ctxOf(sample()).loggedToday('okafor')).toBeNull();
    let ws = noted(sample(), { targetId: 'okafor', outcome: 'Attempted' });
    expect(ctxOf(ws).loggedToday('okafor')).toEqual({ met: false, type: 'In-person visit' });
    ws = noted(ws, { targetId: 'okafor', type: 'Phone call', outcome: 'Met' });
    expect(ctxOf(ws).loggedToday('okafor')).toEqual({ met: true, type: 'Phone call' });
    ws = noted(ws, { targetId: 'msh', type: 'Meeting', outcome: 'Met', attendees: ['sam'] });
    expect(ctxOf(ws).loggedToday('sam')).toEqual({ met: true, type: 'In-person visit' });
  });

  test('a visit logged before its time doesn’t hold the stops before it in place', () => {
    const [maya, alex] = ['v-maya', 'v-alex'].map((id) => findItem(sample(), todayIso, id)!);
    const route = [alex, { ...maya, status: 'done' as const }];
    expect(fixedStops(route, 9 * 60)).toBe(0);
    expect(fixedStops(route, 10 * 60)).toBe(2);
  });

  test('an "Any time" visit logged now shows after the stops already done', () => {
    const ws = addPeople(sample(), todayIso, ['kenji'], at(7, 0));
    const kenji = ws.plans[todayIso].find((i) => i.targetId === 'kenji')!;
    const logged = visitsLogged(ws, note({ targetId: 'kenji', visit: { day: todayIso, id: kenji.id } }), at(11, 30));
    const order = ctxOf(logged).dayPlan(todayIso, at(11, 30)).map((i) => i.targetId);
    expect(order.indexOf('kenji')).toBeGreaterThan(order.indexOf('maya'));
    expect(order.indexOf('kenji')).toBeLessThan(order.indexOf('jordan'));
  });
});

describe('changing and moving a stop', () => {
  test('a call made a visit in person goes where they work that day', () => {
    const alex = getEntity('alex')!;
    const there = siteOnDay(alex, today.getDay());
    const away = ['msh', 'msm', 'msw'].find((s) => s !== there)!;
    const ws = { ...sample(), plans: { [todayIso]: sample().plans[todayIso].map((i) => (i.id === 'v-alex' ? { ...i, siteId: away } : i)) } };
    expect(findItem(changeStop(ws, todayIso, 'v-alex', { type: 'In-person visit' }), todayIso, 'v-alex')?.siteId).toBe(there);
  });

  test('a time the rep set moves to another day as Any time; a booked visit moves with Change the time', () => {
    const ws = setVisitTime(sample(), todayIso, 'v-alex', '11:00');
    expect(moveToDay(ws, todayIso, 'v-alex', wedIso).plans[wedIso]?.find((i) => i.targetId === 'alex')).toMatchObject({ mode: 'flexible', time: null });
    expect(moveToDayError(sample(), todayIso, 'v-maya', wedIso)).toBe('A booked visit moves with Change the time.');
  });

  test('Targets stops filling a freed time once it has gone', () => {
    const ws = cancelVisit(sample(), todayIso, 'v-maya', 'HCP unavailable', todayIso, at(8, 0));
    expect(fillingSlot(ws, at(9, 0))?.itemId).toBe('v-maya');
    expect(fillingSlot(ws, at(10, 15))).toBeNull();
  });

  test('too tight says the drive is from the last place visited, not a call in between', () => {
    // A call at 10:30, after Dr. Patel's 10:00, then Dr. Lee across town at 10:45.
    const ws = setVisitTime(setVisitTime(sample(), todayIso, 'v-alex', '10:30'), todayIso, 'v-jordan', '10:45');
    const clash = ctxOf(ws).daySchedule(todayIso).clashes.find((c) => c.later.id === 'v-jordan');
    expect(clash).toMatchObject({ kind: 'travel', earlier: { id: 'v-alex' }, from: { id: 'v-maya' } });
  });

  test('Saved has a Summary for anyone asked about, then anyone still to see today or next', () => {
    const ids = ctxOf(sample())
      .summaryPeople(['kenji', 'maya'])
      .map((e) => e.id);
    expect(ids.slice(0, 2)).toEqual(['kenji', 'maya']);
    expect([...ids].sort()).toEqual(['alex', 'jordan', 'kenji', 'maya']);
  });
});

describe('once the day is over', () => {
  // Dr. Raman is in on Tuesdays but not on Wednesdays; Dr. Watanabe is in every weekday.
  const thuIso = isoDate(addDays(today, 2));
  const evening = (ws: Workspace) => addPeople(ws, todayIso, ['priya', 'kenji']);
  const moves = (ws: Workspace, now = at(18, 0)) => ctxOf(ws).notDoneToday(now)?.moves.map((m) => `${m.item.targetId} ${m.to}`) ?? [];

  test('from 17:30, the visits not logged that can move, each to the next day they can be seen', () => {
    const ws = evening(sample());
    expect(ctxOf(ws).notDoneToday(at(17, 29))).toBeNull();
    // Dr. Patel's and Dr. Lee's visits were booked, so they stay to be logged.
    expect(moves(ws, at(17, 30)).sort()).toEqual([`alex ${wedIso}`, `kenji ${wedIso}`, `priya ${thuIso}`]);
    expect(ctxOf(ws).notDoneToday(at(17, 30))?.to).toBe(wedIso);
    // Not one logged, nor one at a time still to come this evening until it's over.
    expect(moves(visitsLogged(ws, note({ targetId: 'kenji' })))).not.toContain(`kenji ${wedIso}`);
    const late = setVisitTime(ws, todayIso, 'v-alex', '18:00');
    expect(moves(late, at(18, 10))).not.toContain(`alex ${wedIso}`);
    expect(moves(late, at(18, 15))).toContain(`alex ${wedIso}`);
  });

  async function renderEvening() {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <WorkspaceProvider today={today} now={() => at(18, 0)} initial={sampleWorkspace(today)}>
        {children}
      </WorkspaceProvider>
    );
    const { result } = await renderHook(() => useWorkspace(), { wrapper });
    return result;
  }

  test('Move them to tomorrow moves them all with one Undo, and says where any went instead', async () => {
    const store = await renderEvening();
    const on = (id: string) => [todayIso, wedIso, thuIso].filter((d) => store.current.planItemFor(id, d));
    await act(() => store.current.setWorkspace(evening));
    await act(() => store.current.moveNotDone());
    expect(store.current.notice).toMatchObject({ message: '3 visits moved to tomorrow · Dr. Raman to Thursday, when they’re in', canUndo: true });
    expect(['alex', 'kenji', 'priya', 'maya', 'jordan'].map(on)).toEqual([[wedIso], [wedIso], [thuIso], [todayIso], [todayIso]]);
    // They go as "Any time", and nothing is left to move.
    expect(store.current.planItemFor('priya', thuIso)).toMatchObject({ mode: 'flexible', time: null });
    expect(store.current.notDoneToday(at(18, 0))).toBeNull();
    await act(() => store.current.undo());
    expect(['alex', 'kenji', 'priya'].map(on)).toEqual([[todayIso], [todayIso], [todayIso]]);
  });

  test('one visit is said by name', async () => {
    const store = await renderEvening();
    await act(() => store.current.moveNotDone());
    expect(store.current.notice?.message).toBe('Dr. Alex Morgan moved to tomorrow');
  });
});

describe('Undo after a note', () => {
  test('goes, so it can’t take the note back with the change before it', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <WorkspaceProvider today={today} now={() => at(8, 0)} initial={sampleWorkspace(today)}>
        {children}
      </WorkspaceProvider>
    );
    const { result } = await renderHook(() => useWorkspace(), { wrapper });
    await act(() => {
      result.current.cancelVisit(todayIso, 'v-alex', 'HCP unavailable');
    });
    expect(result.current.notice?.canUndo).toBe(true);
    await act(() => {
      result.current.addNote({ targetId: 'okafor', type: 'Phone call', outcome: 'Met', date: todayIso, note: 'Wants the trial data' });
    });
    expect(result.current.notice).toMatchObject({ message: 'Note saved', canUndo: false });
    await act(() => result.current.undo());
    expect(status(result.current.ws, 'v-alex')).toBe('cancelled');
    expect(result.current.ws.interactions.some((i) => i.note === 'Wants the trial data')).toBe(true);
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
