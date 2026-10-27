// Changing the day: putting new stops where they add the least driving, Best order,
// who to see instead after a cancel or "Not in" (and the filters Targets opens
// with), moving a visit to the next day, whether a doctor is in that day, and the
// day view for choosing a time. The sample day is Monday 19 October 2026.

import { describe, expect, test } from '@jest/globals';

import { availability, dayGrid, inOnDay } from '@/lib/booking';
import { getEntity } from '@/lib/data';
import { addDays, isoDate, startOfDay } from '@/lib/format';
import { bestOrder, placeStops, scheduleDay } from '@/lib/plan';
import { activeFilterCount, insteadFilters } from '@/lib/search';
import type { Entity, LonLat, PlanItem } from '@/lib/types';
import { addPeople, buildContext, moveStop, moveToDay, moveToDayError, orderBest, sampleWorkspace, stopNumber } from '@/lib/workspace';

const today = startOfDay(new Date(2026, 9, 19));
const todayIso = isoDate(today);
const tomorrowIso = isoDate(addDays(today, 1));
const entity = (id: string) => getEntity(id) as Entity;

// Stops along one road east of the start, a kilometre or so apart.
const AT: Record<string, LonLat> = { a: [0.01, 0], b: [0.02, 0], c: [0.03, 0], d: [0.04, 0] };
const START: LonLat = [0, 0];
const coordsOf = (i: PlanItem): LonLat => AT[i.id];
const item = (id: string, extra: Partial<PlanItem> = {}): PlanItem => ({
  id,
  targetId: id,
  siteId: 's',
  mode: 'flexible',
  time: null,
  duration: 30,
  type: 'In-person visit',
  goal: '',
  status: 'planned',
  ...extra,
});
const ids = (items: PlanItem[]) => items.map((i) => i.id);

describe('placing stops', () => {
  test('a new stop goes where it adds the least travel, and a call goes last', () => {
    expect(ids(placeStops([item('a'), item('c'), item('b')], ['b'], coordsOf, START))).toEqual(['a', 'b', 'c']);
    expect(ids(placeStops([item('b'), item('a', { type: 'Phone call' }), item('c')], ['a'], coordsOf, START))).toEqual(['b', 'c', 'a']);
  });

  test('nothing goes before a visit that has already happened', () => {
    const items = [item('b', { status: 'done', outcome: 'Met' }), item('c'), item('a')];
    expect(ids(placeStops(items, ['a'], coordsOf, START))).toEqual(['b', 'a', 'c']);
  });

  test('Best order puts the Any time stops in the order with the least driving and leaves a timed visit at its time', () => {
    const items = [item('c'), item('a'), item('d', { mode: 'timed', time: '13:00' }), item('b')];
    const ordered = bestOrder(items, coordsOf, START);
    expect(ordered.find((i) => i.id === 'd')).toMatchObject({ mode: 'timed', time: '13:00' });
    expect(ids(ordered)).toEqual(['a', 'b', 'c', 'd']);
    // Nothing left to improve, so the day comes back as it is.
    expect(bestOrder(ordered, coordsOf, START)).toBe(ordered);
    // With the farthest visit at 09:00 only one stop fits before it, so the others come on the way back.
    const early = items.map((i) => (i.id === 'd' ? { ...i, time: '09:00' } : i));
    const day = scheduleDay(bestOrder(early, coordsOf, START), { coordsOf, start: START });
    expect(day.stops.map((s) => s.item.id)).toEqual(['a', 'd', 'c', 'b']);
    expect(day.clashes).toEqual([]);
  });

  test('Best order sees someone in their usual times even when that means more driving', () => {
    // b is only in until 08:45, so b comes first although a is on the way.
    const items = [item('a'), item('b'), item('c')];
    const windowsOf = (i: PlanItem): [number, number][] | null => (i.id === 'b' ? [[8 * 60, 8 * 60 + 45]] : null);
    const day = scheduleDay(bestOrder(items, coordsOf, START, null, windowsOf), { coordsOf, start: START, windowsOf });
    expect(day.stops[0].item.id).toBe('b');
    expect(day.stops.some((s) => s.outside)).toBe(false);
  });

  test('on the sample day, Best order keeps the booked times and has nothing left to improve', () => {
    const ws = addPeople(sampleWorkspace(today), todayIso, ['kenji', 'hannah', 'priya']);
    const best = orderBest(ws, todayIso);
    const plan = buildContext(best, today).dayPlan(todayIso);
    expect(plan.find((i) => i.id === 'v-maya')?.time).toBe('10:00');
    expect(plan.find((i) => i.id === 'v-jordan')?.time).toBe('14:00');
    expect(buildContext(best, today).bestOrderSaves(todayIso)).toBeNull();
  });

  test('Best order says how much less driving it would be', () => {
    const ws = addPeople(sampleWorkspace(today), todayIso, ['kenji', 'hannah', 'priya']);
    // The "Any time" stops turned round, from the order with the least driving.
    const anyTime = buildContext(ws, today)
      .dayPlan(todayIso)
      .filter((i) => i.mode !== 'timed')
      .map((i) => i.id);
    const turned = anyTime.reduce((w, id) => moveStop(w, todayIso, id, 0), ws);
    const best = orderBest(turned, todayIso);
    const driving = (w: typeof ws) => buildContext(w, today).daySchedule(todayIso).stops.reduce((total, s) => total + s.travel, 0);
    expect(buildContext(turned, today).bestOrderSaves(todayIso)).toBe(10);
    expect(driving(turned) - driving(best)).toBe(10);
    expect(buildContext(best, today).bestOrderSaves(todayIso)).toBeNull();
  });

  test('stops are numbered as the map numbers them; a call has no number', () => {
    const ws = sampleWorkspace(today);
    expect(stopNumber(ws, todayIso, 'jordan')).toMatchObject({ number: 2, of: 2, after: { id: 'v-maya' } });
    expect(stopNumber(ws, todayIso, 'alex')).toBeNull();
  });
});

describe('who to see instead', () => {
  const ws = sampleWorkspace(today);
  const ctx = buildContext(ws, today);

  test('for a freed time: up to three doctors free then, not already planned and not the one who cancelled', () => {
    const gap = { day: todayIso, siteId: 'msm', time: '14:00', duration: 30, except: 'jordan' };
    const standIns = ctx.standIns(gap);
    expect(standIns.length).toBeGreaterThan(0);
    expect(standIns.length).toBeLessThanOrEqual(3);
    for (const s of standIns) {
      expect(['maya', 'alex', 'jordan']).not.toContain(s.entity.id);
      expect(availability(s.entity, todayIso, '14:00', 30).ok).toBe(true);
      expect(s.km).toBeGreaterThanOrEqual(0);
    }
  });

  test('after "Not in", with no time to fill: doctors who are in that day', () => {
    const standIns = ctx.standIns({ day: todayIso, siteId: 'msm', time: null, duration: 30, except: 'maya' });
    expect(standIns.length).toBeGreaterThan(0);
    for (const s of standIns) expect(inOnDay(s.entity, todayIso).ok).toBe(true);
  });
});

describe('moving a visit to the next day', () => {
  test('an Any time visit moves, keeping its goal and where it came from', () => {
    const ws = sampleWorkspace(today);
    const next = moveToDay(ws, todayIso, 'v-alex', tomorrowIso);
    expect(next.plans[todayIso].some((i) => i.targetId === 'alex')).toBe(false);
    expect(next.plans[tomorrowIso].find((i) => i.targetId === 'alex')).toMatchObject({
      goal: 'Ask about ablation referrals leaving the system.',
      movedFrom: { day: todayIso, time: null },
    });
  });

  test('a visit with a time, or one already planned there, says why it can’t', () => {
    const ws = sampleWorkspace(today);
    expect(moveToDayError(ws, todayIso, 'v-maya', tomorrowIso)).toMatch(/Change the time/);
    expect(moveToDay(ws, todayIso, 'v-maya', tomorrowIso)).toBe(ws);
    const twice = moveToDay(ws, todayIso, 'v-alex', tomorrowIso);
    const back = twice.plans[tomorrowIso].find((i) => i.targetId === 'alex')!;
    const again = addPeople(twice, todayIso, ['alex']);
    expect(moveToDayError(again, tomorrowIso, back.id, todayIso)).toMatch(/already in your plan/);
  });
});

describe('whether a doctor is in', () => {
  test('in that day, with their hours, or not in on a day they aren’t on site', () => {
    expect(inOnDay(entity('maya'), todayIso)).toMatchObject({ ok: true });
    expect(inOnDay(entity('priya'), isoDate(addDays(today, 2)))).toEqual({ ok: false, why: 'Not in on Wednesdays' });
  });
});

describe('See everyone after a cancel', () => {
  test('opens Targets on doctors in that day and not planned, nearest to where the visit was, and says so in Filters', () => {
    const ctx = buildContext(sampleWorkspace(today), today);
    const filters = insteadFilters('msm');
    expect(activeFilterCount(filters)).toBe(3);
    const rows = ctx.search(filters);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.entity.kind).toBe('hcp');
      expect(r.planned).toBeNull();
      expect(inOnDay(r.entity, todayIso).ok).toBe(true);
    }
    const km = rows.map((r) => r.distance);
    expect(km).toEqual([...km].sort((a, b) => a - b));
    expect(rows.map((r) => r.entity.id)).not.toContain('maya');
  });
});

describe('the day view for choosing a time', () => {
  const plan = sampleWorkspace(today).plans[todayIso];

  test('half hours from 08:00 to 18:00, the rep’s visits taken, their usual times shaded and the first of those picked', () => {
    const grid = dayGrid(entity('kenji'), { day: todayIso, plan, duration: 30, onSite: true });
    expect(grid.rows[0].time).toBe('08:00');
    expect(grid.rows.at(-1)?.time).toBe('17:30');
    expect(grid.rows.find((r) => r.time === '10:00')?.taken).toBe(true);
    expect(grid.rows.find((r) => r.time === '14:00')?.taken).toBe(true);
    expect(grid.rows.find((r) => r.time === '09:30')?.taken).toBe(false);
    expect(grid.rows.filter((r) => r.usual).map((r) => r.time)).toEqual(['08:00', '08:30', '09:00', '09:30', '10:00', '10:30']);
    expect(grid.pick).toBe('08:00');
    expect(grid.visits.map((i) => i.id)).toEqual(['v-maya', 'v-jordan']);
    expect(grid.anyTime.map((i) => i.id)).toEqual(['v-alex']);
  });

  test('times already gone today can’t be picked, and a visit being moved doesn’t block its own time', () => {
    const later = dayGrid(entity('kenji'), { day: todayIso, plan, duration: 30, onSite: true, earliest: 8 * 60 + 45 });
    expect(later.rows.filter((r) => r.past).map((r) => r.time)).toEqual(['08:00', '08:30']);
    expect(later.pick).toBe('09:00');
    const moving = dayGrid(entity('maya'), { day: todayIso, plan, duration: 30, onSite: true, except: 'v-maya' });
    expect(moving.rows.find((r) => r.time === '10:00')?.taken).toBe(false);
    expect(moving.visits.map((i) => i.id)).toEqual(['v-jordan']);
  });

  test('stretches to an early usual time, and on a day they aren’t in nothing is shaded', () => {
    const tuesday = isoDate(addDays(today, 1));
    expect(dayGrid(entity('maya'), { day: tuesday, plan: [], duration: 30, onSite: true }).rows[0].time).toBe('07:00');
    const wednesday = dayGrid(entity('priya'), { day: isoDate(addDays(today, 2)), plan: [], duration: 30, onSite: true });
    expect(wednesday.rows.some((r) => r.usual)).toBe(false);
    expect(wednesday.pick).toBe('08:00');
  });
});
