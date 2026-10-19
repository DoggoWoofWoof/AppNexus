import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addTargets, conflicts, endTime, moveFlexible, routeDistance, routeOrder, suggestOrder } from '../demo/js/plan.js';

const item = (id, extra = {}) => ({ id, targetId: id, siteId: 's', mode: 'flexible', time: null, duration: 30, type: 'In-person visit', status: 'planned', ...extra });

test('route order puts timed stops first by time, then flexible stops as arranged', () => {
  const items = [item('a'), item('b', { mode: 'timed', time: '14:00' }), item('c'), item('d', { mode: 'timed', time: '09:30' })];
  assert.deepEqual(routeOrder(items).map((i) => i.id), ['d', 'b', 'a', 'c']);
});

test('conflicts finds overlapping timed visits and ignores cancelled ones', () => {
  const items = [
    item('a', { mode: 'timed', time: '10:00', duration: 45 }),
    item('b', { mode: 'timed', time: '10:30' }),
    item('c', { mode: 'timed', time: '10:45' }),
    item('d', { mode: 'timed', time: '10:15', status: 'cancelled' }),
  ];
  assert.deepEqual(conflicts(items).map(([x, y]) => `${x.id}-${y.id}`), ['a-b', 'b-c']);
  assert.equal(conflicts([item('a', { mode: 'timed', time: '10:00' }), item('b', { mode: 'timed', time: '10:30' })]).length, 0, 'back-to-back visits do not clash');
});

test('end time adds the duration', () => {
  assert.equal(endTime(item('a', { time: '09:45', duration: 30 })), '10:15');
});

test('adding targets skips people already in the plan and adds the rest as flexible', () => {
  const existing = [item('maya')];
  const out = addTargets(existing, [{ id: 'maya', kind: 'hcp' }, { id: 'msw', kind: 'hco' }], () => ({ id: 'site-1' }));
  assert.equal(out.length, 2);
  const added = out[1];
  assert.equal(added.targetId, 'msw');
  assert.equal(added.mode, 'flexible');
  assert.equal(added.type, 'Meeting');
  assert.equal(added.isNew, true);
});

test('a cancelled visit can be planned again', () => {
  const out = addTargets([item('maya', { status: 'cancelled' })], [{ id: 'maya', kind: 'hcp' }], () => ({ id: 's' }));
  assert.equal(out.length, 2);
});

test('moving flexible stops stays inside the flexible group', () => {
  const items = [item('a'), item('t', { mode: 'timed', time: '09:00' }), item('b'), item('c')];
  assert.deepEqual(moveFlexible(items, 'b', -1).map((i) => i.id), ['t', 'b', 'a', 'c']);
  assert.equal(moveFlexible(items, 'a', -1), items, 'first stop cannot move earlier');
});

test('suggested order visits the nearest flexible stop next', () => {
  const coords = { far: [-73.94, 40.81], near: [-73.98, 40.77], mid: [-73.96, 40.79] };
  const items = [item('far'), item('near'), item('mid')];
  const order = suggestOrder(items, (i) => coords[i.id], [-73.982, 40.768]);
  assert.deepEqual(order.map((i) => i.id), ['near', 'mid', 'far']);
});

test('route distance only counts on-site stops', () => {
  const coords = { a: [-73.98, 40.77], b: [-73.98, 40.77] };
  const start = [-73.98, 40.77];
  assert.equal(routeDistance([item('a'), item('b', { type: 'Phone call' })], (i) => coords[i.id], start), 0);
});
