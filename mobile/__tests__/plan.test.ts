// Ported from tests/plan.test.js in the prototype.

import { expect, test } from '@jest/globals';

import { addTargets, conflicts, endTime, moveFlexible, routeDistance, routeOrder, suggestOrder } from '@/lib/plan';
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

test('route order puts timed stops first by time, then flexible stops as arranged', () => {
  const items = [item('a'), item('b', { mode: 'timed', time: '14:00' }), item('c'), item('d', { mode: 'timed', time: '09:30' })];
  expect(routeOrder(items).map((i) => i.id)).toEqual(['d', 'b', 'a', 'c']);
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

test('moving flexible stops stays inside the flexible group', () => {
  const items = [item('a'), item('t', { mode: 'timed', time: '09:00' }), item('b'), item('c')];
  expect(moveFlexible(items, 'b', -1).map((i) => i.id)).toEqual(['t', 'b', 'a', 'c']);
  // The first stop cannot move earlier.
  expect(moveFlexible(items, 'a', -1)).toBe(items);
});

test('suggested order visits the nearest flexible stop next', () => {
  const coords: Record<string, LonLat> = { far: [-73.94, 40.81], near: [-73.98, 40.77], mid: [-73.96, 40.79] };
  const items = [item('far'), item('near'), item('mid')];
  const order = suggestOrder(items, (i) => coords[i.id], [-73.982, 40.768]);
  expect(order.map((i) => i.id)).toEqual(['near', 'mid', 'far']);
});

test('route distance only counts on-site stops', () => {
  const coords: Record<string, LonLat> = { a: [-73.98, 40.77], b: [-73.98, 40.77] };
  expect(routeDistance([item('a'), item('b', { type: 'Phone call' })], (i) => coords[i.id], [-73.98, 40.77])).toBe(0);
});
