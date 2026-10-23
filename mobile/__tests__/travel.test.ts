// Travel times: a time for every stop and the drive to get there, "Any time"
// stops never put where they clash, visits with a time that do clash said so,
// the time sheet leaving out times too close to drive between, and the stops
// handed to Google Maps in order. The sample day is Monday 19 October 2026.

import { describe, expect, test } from '@jest/globals';

import { dayGrid } from '@/lib/booking';
import { getEntity } from '@/lib/data';
import { isoDate, startOfDay } from '@/lib/format';
import { routeUrl } from '@/lib/links';
import { scheduleDay, travelMinutes, type ScheduleOptions } from '@/lib/plan';
import type { Entity, LonLat, PlanItem } from '@/lib/types';
import { buildContext, freshWorkspace } from '@/lib/workspace';

// Start at 0,0; site a is about 1.1 km away, b about 3.3 km (2.2 km from a).
const SITES: Record<string, LonLat> = { a: [0, 0.01], b: [0, 0.03] };
const start: LonLat = [0, 0];
const coordsOf = (i: PlanItem) => SITES[i.siteId];

const item = (id: string, extra: Partial<PlanItem> = {}): PlanItem => ({
  id,
  targetId: id,
  siteId: 'a',
  mode: 'flexible',
  time: null,
  duration: 30,
  type: 'In-person visit',
  goal: '',
  status: 'planned',
  ...extra,
});
const at = (time: string, extra: Partial<PlanItem> = {}): Partial<PlanItem> => ({ mode: 'timed', time, ...extra });
const hm = (h: number, m = 0) => h * 60 + m;

const plan = (items: PlanItem[], options: Partial<ScheduleOptions> = {}) => scheduleDay(items, { coordsOf, start, ...options });
const times = (s: ReturnType<typeof scheduleDay>) => s.stops.map((x) => [x.item.id, x.start, x.travel]);

describe('travel', () => {
  test('5 minutes to park and 4 a km, 1.5 a km beyond 10, rounded up to 5; nothing in the same building', () => {
    expect(travelMinutes(0)).toBe(0);
    expect(travelMinutes(1.1)).toBe(10);
    expect(travelMinutes(2.5)).toBe(15);
    expect(travelMinutes(5)).toBe(25);
    // Out of the city, as from Manhattan to Newark, the roads are faster.
    expect(travelMinutes(12)).toBe(50);
    expect(travelMinutes(20)).toBe(60);
    expect(travelMinutes(30)).toBe(75);
  });
});

describe('the day with times', () => {
  test('visits with a time are at it, with the drive to get there; an "Any time" stop goes after the stop before it', () => {
    const s = plan([item('t', at('10:00')), item('f', { siteId: 'b' })]);
    expect(times(s)).toEqual([
      ['t', hm(10), 10],
      ['f', hm(10, 45), 15],
    ]);
    expect(s.clashes).toEqual([]);
  });

  test('an "Any time" stop goes before a visit with a time only if there is time to get to it after; otherwise after it', () => {
    // From the start to b is 20 minutes, then 15 to a: 08:20–08:50, then 09:05 at a.
    const tight = plan([item('f', { siteId: 'b' }), item('t', at('09:00'))]);
    expect(times(tight)).toEqual([
      ['t', hm(9), 10],
      ['f', hm(9, 45), 15],
    ]);
    expect(tight.clashes).toEqual([]);
    const roomy = plan([item('f', { siteId: 'b' }), item('t', at('09:30'))]);
    expect(times(roomy)).toEqual([
      ['f', hm(8, 20), 20],
      ['t', hm(9, 30), 15],
    ]);
  });

  test('stops keep the day’s order, and a call needs no drive', () => {
    const s = plan([item('f1'), item('call', { type: 'Phone call', duration: 15 }), item('f2', { siteId: 'b' })]);
    expect(times(s)).toEqual([
      ['f1', hm(8, 10), 10],
      ['call', hm(8, 40), 0],
      ['f2', hm(9, 10), 15],
    ]);
  });

  test('an "Any time" stop waits for their usual times, but not past a visit with a time after it', () => {
    const call = item('call', { type: 'Phone call', duration: 15 });
    expect(times(plan([item('t', at('14:00')), call], { windowsOf: (i) => (i.id === 'call' ? [[hm(16), hm(17, 30)]] : null) }))).toEqual([
      ['t', hm(14), 10],
      ['call', hm(16), 0],
    ]);
    const s = plan([item('f', { siteId: 'b' }), item('t', at('09:00'))], { windowsOf: (i) => (i.id === 'f' ? [[hm(11), hm(12)]] : null) });
    expect(times(s)).toEqual([
      ['t', hm(9), 10],
      ['f', hm(11), 15],
    ]);
    expect(s.stops[1].outside).toBe(false);
    // Usually in from 15:00, but put before the 14:00: it goes first, outside their usual times.
    const early = plan([item('f'), item('t', at('14:00'))], { windowsOf: (i) => (i.id === 'f' ? [[hm(15), hm(16)]] : null) });
    expect(times(early)).toEqual([
      ['f', hm(8, 10), 10],
      ['t', hm(14), 0],
    ]);
    expect(early.stops[0].outside).toBe(true);
  });

  test('with no usual time left that day it goes at the first free time, saying it’s outside them', () => {
    const notIn = plan([item('f')], { windowsOf: () => [] });
    expect(times(notIn)).toEqual([['f', hm(8, 10), 10]]);
    expect(notIn.stops[0].outside).toBe(true);
    const gone = plan([item('t', at('09:00')), item('f')], { windowsOf: (i) => (i.id === 'f' ? [[hm(7, 30), hm(8, 30)]] : null) });
    expect(gone.stops[1]).toMatchObject({ start: hm(9, 30), outside: true });
  });

  test('today, a stop still to do goes no earlier than now, rounded up to 5 minutes; a logged one stays where it was', () => {
    const items = [item('done', { status: 'done' }), item('f', { siteId: 'b' })];
    expect(times(plan(items, { now: hm(11, 2) }))).toEqual([
      ['done', hm(8, 10), 10],
      ['f', hm(11, 20), 15],
    ]);
    // After the working day nothing is moved on: it's waiting to be logged.
    expect(times(plan(items, { now: hm(18) }))[1]).toEqual(['f', hm(8, 55), 15]);
  });

  test('an "Any time" stop that ends after 17:30 says so; a visit with a time then doesn’t', () => {
    const s = plan([item('t', at('17:15')), item('f')]);
    expect(s.stops[1]).toMatchObject({ start: hm(17, 45), late: true });
    expect(s.stops[0].late).toBe(false);
  });

  test('cancelled visits aren’t in it, and a visit before 08:00 keeps its time', () => {
    const s = plan([item('early', at('07:30')), item('gone', at('10:00', { status: 'cancelled' }))]);
    expect(times(s)).toEqual([['early', hm(7, 30), 10]]);
  });
});

describe('clashes between visits with a time', () => {
  test('two at once overlap', () => {
    const s = plan([item('x', at('10:00', { duration: 45 })), item('y', at('10:30')), item('z', at('13:00'))]);
    expect(s.clashes).toEqual([expect.objectContaining({ kind: 'overlap', earlier: expect.objectContaining({ id: 'x' }), later: expect.objectContaining({ id: 'y' }) })]);
  });

  test('too little time to get from one to the next is a clash, with how long it takes', () => {
    const s = plan([item('x', at('10:00')), item('y', at('10:35', { siteId: 'b' }))]);
    expect(s.clashes).toEqual([expect.objectContaining({ kind: 'travel', need: 15, free: 5 })]);
    // A call needs no drive, so the same times are fine.
    expect(plan([item('x', at('10:00')), item('y', at('10:35', { siteId: 'b', type: 'Phone call' }))]).clashes).toEqual([]);
  });

  test('the "Any time" stops fill around them without adding any', () => {
    const items = [item('f1'), item('x', at('09:00')), item('f2', { siteId: 'b' }), item('y', at('10:00')), item('f3', { siteId: 'b' })];
    const s = plan(items);
    expect(s.clashes).toEqual([]);
    s.stops.forEach((stop, i) => {
      if (i) expect(stop.start - stop.travel).toBeGreaterThanOrEqual(s.stops[i - 1].end);
    });
  });
});

describe('choosing a time', () => {
  const day = isoDate(startOfDay(new Date(2026, 9, 19)));
  const who = getEntity('maya') as Entity;
  const state = (grid: ReturnType<typeof dayGrid>, time: string) => {
    const row = grid.rows.find((r) => r.time === time)!;
    return row.taken ? 'taken' : row.tight ? 'tight' : 'free';
  };

  test('times too close to a visit somewhere else to drive between aren’t offered', () => {
    // A visit at 10:00 that's 20 minutes away: 09:30 ends just as it starts, 10:30 starts as it ends.
    const grid = dayGrid(who, { day, plan: [item('t', at('10:00'))], duration: 30, onSite: true, travelTo: () => 20 });
    expect(['09:00', '09:30', '10:00', '10:30', '11:00'].map((t) => state(grid, t))).toEqual(['free', 'tight', 'taken', 'tight', 'free']);
    expect(grid.pick).not.toBe('09:30');
    // In the same building there's no drive, so the times next to it are fine.
    const near = dayGrid(who, { day, plan: [item('t', at('10:00'))], duration: 30, onSite: true, travelTo: () => 0 });
    expect(near.rows.some((r) => r.tight)).toBe(false);
  });
});

describe('the sample day', () => {
  const today = startOfDay(new Date(2026, 9, 19));
  const ctx = buildContext(freshWorkspace(today), today);

  test('Maya at 10:00, Jordan at 14:00, and the call to Alex in his usual time, with nothing clashing', () => {
    const s = ctx.daySchedule(isoDate(today));
    expect(s.stops.map((x) => [x.item.id, x.start])).toEqual([
      ['v-maya', hm(10)],
      ['v-jordan', hm(14)],
      ['v-alex', hm(16)],
    ]);
    expect(s.stops.map((x) => x.travel > 0)).toEqual([true, true, false]);
    expect(s.clashes).toEqual([]);
  });

  test('the drive from one visit’s place to another’s is the one the day uses; none for a call or with no place', () => {
    const [maya, jordan, alex] = ctx.daySchedule(isoDate(today)).stops;
    expect(ctx.travelTo(maya.item.siteId, jordan.item)).toBe(jordan.travel);
    expect(ctx.travelTo(maya.item.siteId, maya.item)).toBe(0);
    expect(ctx.travelTo(maya.item.siteId, alex.item)).toBe(0);
    expect(ctx.travelTo(null, jordan.item)).toBe(0);
  });

  test('later today, the call isn’t put before now', () => {
    const s = ctx.daySchedule(isoDate(today), new Date(2026, 9, 19, 16, 40));
    expect(s.stops.find((x) => x.item.id === 'v-alex')?.start).toBe(hm(16, 40));
  });
});

describe('Maps', () => {
  test('the stops go in order, the last as where to end up, from wherever the phone is', () => {
    const url = new URL(routeUrl([[-74.17, 40.74], [-74.04, 40.72], [-73.99, 40.69]]));
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/dir/');
    expect(url.searchParams.get('origin')).toBeNull();
    expect(url.searchParams.get('destination')).toBe('40.69,-73.99');
    expect(url.searchParams.get('waypoints')).toBe('40.74,-74.17|40.72,-74.04');
    expect(url.searchParams.get('travelmode')).toBe('driving');
  });

  test('one stop has nothing on the way', () => {
    expect(new URL(routeUrl([[-74.17, 40.74]])).searchParams.get('waypoints')).toBeNull();
  });
});
