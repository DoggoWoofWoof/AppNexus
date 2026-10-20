// Ported from tests/plan.test.js in the prototype.

import { expect, test } from '@jest/globals';

import { addTargets, conflicts, endTime, routeDistance, routeOrder, timeStop } from '@/lib/plan';
import type { LonLat, PlanItem } from '@/lib/types';

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

test('route order puts timed stops by time and keeps each flexible stop after the latest timed stop before it', () => {
  const items = [item('a'), item('b', { mode: 'timed', time: '14:00' }), item('c'), item('d', { mode: 'timed', time: '09:30' }), item('e')];
  // a comes before any timed stop; c and e come after 14:00, the latest before them.
  expect(routeOrder(items).map((i) => i.id)).toEqual(['a', 'd', 'b', 'c', 'e']);
  // A plan already in route order stays as it is.
  const ordered = routeOrder(items);
  expect(routeOrder(ordered)).toEqual(ordered);
  // A timed stop added at the end goes in by its time and leaves the flexible stops where they were.
  const booked = [...ordered, item('f', { mode: 'timed', time: '11:00' })];
  expect(routeOrder(booked).map((i) => i.id)).toEqual(['a', 'd', 'f', 'b', 'c', 'e']);
});

test('conflicts finds overlapping timed visits and ignores cancelled ones', () => {
  const items = [
    item('a', { mode: 'timed', time: '10:00', duration: 45 }),
    item('b', { mode: 'timed', time: '10:30' }),
    item('c', { mode: 'timed', time: '10:45' }),
    item('d', { mode: 'timed', time: '10:15', status: 'cancelled' }),
  ];
  expect(conflicts(items).map(([x, y]) => `${x.id}-${y.id}`)).toEqual(['a-b', 'b-c']);
  // Back-to-back visits do not clash.
  expect(conflicts([item('a', { mode: 'timed', time: '10:00' }), item('b', { mode: 'timed', time: '10:30' })])).toHaveLength(0);
});

test('end time adds the duration', () => {
  expect(endTime(item('a', { time: '09:45', duration: 30 }))).toBe('10:15');
});

test('adding targets skips people already in the plan and adds the rest as flexible', () => {
  const out = addTargets([item('maya')], [{ id: 'maya', kind: 'hcp' }, { id: 'msw', kind: 'hco' }], () => ({ id: 'site-1' }));
  expect(out).toHaveLength(2);
  expect(out[1]).toMatchObject({ targetId: 'msw', mode: 'flexible', type: 'Meeting', isNew: true });
});

test('a cancelled visit can be planned again', () => {
  const out = addTargets([item('maya', { status: 'cancelled' })], [{ id: 'maya', kind: 'hcp' }], () => ({ id: 's' }));
  expect(out).toHaveLength(2);
});

test('a flexible stop given a time goes in by that time without taking the stops after it along', () => {
  const items = [item('t', { mode: 'timed', time: '10:00' }), item('a'), item('b'), item('u', { mode: 'timed', time: '14:00' })];
  const timed = timeStop(items, 'a', '16:00');
  expect(timed.find((i) => i.id === 'a')).toMatchObject({ mode: 'timed', time: '16:00' });
  expect(routeOrder(timed).map((i) => i.id)).toEqual(['t', 'b', 'u', 'a']);
  expect(routeOrder(timeStop(items, 'b', '08:00')).map((i) => i.id)).toEqual(['b', 't', 'a', 'u']);
});

test('route distance only counts on-site stops', () => {
  const coords: Record<string, LonLat> = { a: [-73.98, 40.77], b: [-73.98, 40.77] };
  expect(routeDistance([item('a'), item('b', { type: 'Phone call' })], (i) => coords[i.id], [-73.98, 40.77])).toBe(0);
});
