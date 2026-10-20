// Changing the day: putting new stops where they add the least travel, Best order,
// who to see instead after a cancel or "Not in", moving a visit to the next day,
// and whether a doctor is in that day. The sample day is Monday 19 October 2026.

import { describe, expect, test } from '@jest/globals';

import { availability, inOnDay } from '@/lib/booking';
import { getEntity } from '@/lib/data';
import { addDays, isoDate, startOfDay } from '@/lib/format';
import { bestOrder, placeStops } from '@/lib/plan';
import type { Entity, LonLat, PlanItem } from '@/lib/types';
import { addPeople, buildContext, freshWorkspace, moveToDay, moveToDayError, orderBest, stopNumber } from '@/lib/workspace';

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

  test('Best order puts the Any time stops in the shortest order and leaves a timed visit at its time', () => {
    const items = [item('c'), item('a'), item('d', { mode: 'timed', time: '09:00' }), item('b')];
    const ordered = bestOrder(items, coordsOf, START);
    expect(ordered.find((i) => i.id === 'd')).toMatchObject({ mode: 'timed', time: '09:00' });
    expect(ids(ordered.filter((i) => i.mode === 'flexible'))).toEqual(['a', 'b', 'c']);
    expect(ids(bestOrder(ordered, coordsOf, START))).toEqual(ids(ordered));
  });

  test('on the sample day, Best order keeps the booked times and has nothing left to improve', () => {
    const ws = addPeople(freshWorkspace(today), todayIso, ['kenji', 'hannah', 'priya']);
    const best = orderBest(ws, todayIso);
    const plan = buildContext(best, today).dayPlan(todayIso);
    expect(plan.find((i) => i.id === 'v-maya')?.time).toBe('10:00');
    expect(plan.find((i) => i.id === 'v-jordan')?.time).toBe('14:00');
    expect(buildContext(best, today).bestOrderHelps(todayIso)).toBe(false);
  });

  test('stops are numbered as the map numbers them; a call has no number', () => {
    const ws = freshWorkspace(today);
    expect(stopNumber(ws, todayIso, 'jordan')).toMatchObject({ number: 2, of: 2, after: { id: 'v-maya' } });
    expect(stopNumber(ws, todayIso, 'alex')).toBeNull();
  });
});

describe('who to see instead', () => {
  const ws = freshWorkspace(today);
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
    const ws = freshWorkspace(today);
    const next = moveToDay(ws, todayIso, 'v-alex', tomorrowIso);
    expect(next.plans[todayIso].some((i) => i.targetId === 'alex')).toBe(false);
    expect(next.plans[tomorrowIso].find((i) => i.targetId === 'alex')).toMatchObject({
      goal: 'Ask about ablation referrals leaving the system.',
      movedFrom: { day: todayIso, time: null },
    });
  });

  test('a visit with a time, or one already planned there, says why it can’t', () => {
    const ws = freshWorkspace(today);
    expect(moveToDayError(ws, todayIso, 'v-maya', tomorrowIso)).toMatch(/Move to another time/);
    expect(moveToDay(ws, todayIso, 'v-maya', tomorrowIso)).toBe(ws);
    const twice = moveToDay(ws, todayIso, 'v-alex', tomorrowIso);
    const back = twice.plans[tomorrowIso].find((i) => i.targetId === 'alex')!;
    const again = addPeople(twice, todayIso, ['alex']);
    expect(moveToDayError(again, tomorrowIso, back.id, todayIso)).toMatch(/already in your plan/);
  });
});

describe('whether a doctor is in', () => {
  test('in that day, with their hours; not in on a day they aren’t on site; gone once their time is over', () => {
    expect(inOnDay(entity('maya'), todayIso)).toMatchObject({ ok: true });
    expect(inOnDay(entity('priya'), isoDate(addDays(today, 2)))).toEqual({ ok: false, why: 'Not in on Wednesdays' });
    const late = new Date(2026, 9, 19, 22, 0);
    expect(inOnDay(entity('hannah'), todayIso)).toMatchObject({ ok: true });
    expect(inOnDay(entity('hannah'), todayIso, late)).toMatchObject({ ok: false, why: expect.stringMatching(/^Gone for today/) });
  });
});
