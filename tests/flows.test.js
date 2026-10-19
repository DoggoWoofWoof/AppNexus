// The planner flows end to end, through the real actions: cancel → fill from
// Targets, logging with an explicit outcome, booking, and the visit brief.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createActions } from '../demo/js/actions.js';
import { SCREENS, buildContext } from '../demo/js/app.js';
import { bookingRoute, parseDays, suggestSlots } from '../demo/js/booking.js';
import { briefText, buildBrief } from '../demo/js/brief.js';
import { getEntity } from '../demo/js/data/index.js';
import { addDays, fromIso, isoDate, startOfDay } from '../demo/js/format.js';
import { freshWorkspace } from '../demo/js/store.js';

const today = startOfDay(new Date());
const day = isoDate(today);

/** Just enough of the app for the actions: state, navigation, sheets and toasts. */
function fakeApp() {
  const stack = [{ screen: 'today', params: {}, ui: {} }];
  const app = {
    ws: freshWorkspace(today),
    today,
    todayIso: day,
    sheet: null,
    voice: { status: 'idle' },
    tab: 'today',
    toasts: [],
    ctx: () => buildContext({ ws: app.ws, entry: app.entry(), today }),
    entry: () => stack.at(-1),
    openSheet: (type, params = {}) => { app.sheet = { type, ...params }; },
    closeSheet: () => { app.sheet = null; },
    switchTab: (tab) => { app.sheet = null; app.tab = tab; stack.splice(0, stack.length, { screen: tab, params: {}, ui: {} }); },
    push: (screen, params) => stack.push({ screen, params, ui: {} }),
    toast: (message, options = {}) => app.toasts.push({ message, ...options }),
    touch() {}, announce() {}, focusAfter() {}, prefetchPlan() {}, render() {},
  };
  return { app, actions: createActions(app) };
}

const visit = (app, id) => Object.values(app.ws.plans).flat().find((i) => i.id === id);

function cancelMaya() {
  const { app, actions } = fakeApp();
  actions.cancelVisit({ item: 'v-maya', day });
  assert.equal(app.sheet.type, 'cancel');
  actions.confirmCancelVisit({ item: 'v-maya', day, reason: 'HCP unavailable' });
  return { app, actions };
}

test('cancelling a timed visit opens Targets, nearest to that site, without anyone already planned', () => {
  const { app } = cancelMaya();
  assert.equal(visit(app, 'v-maya').status, 'cancelled');
  assert.equal(visit(app, 'v-maya').cancelReason, 'HCP unavailable');
  assert.deepEqual({ time: app.ws.replacement.time, siteId: app.ws.replacement.siteId }, { time: '10:00', siteId: 'msw' });
  assert.equal(app.tab, 'targets');
  assert.equal(app.sheet, null, 'no separate fill sheet');
  assert.equal(app.ws.targets.sort, 'distance');
  const rows = app.ctx().search(app.ws.targets);
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => !r.planned), 'people already planned that day are hidden');
  assert.ok(!rows.some((r) => r.entity.id === 'maya'), 'the doctor who cancelled is not offered back');
  const km = rows.map((r) => r.distance);
  assert.deepEqual(km, [...km].sort((a, b) => a - b), 'nearest to the cancelled site first');
  const out = String(SCREENS.targets.render(app.ctx()));
  assert.match(out, /data-action="fillSlot"/);
  assert.match(out, /aria-label="Add [^"]+ at 10:00"/);
});

test('one tap on a Targets row fills the slot as a requested visit, and Undo puts it back', () => {
  const { app, actions } = cancelMaya();
  const pick = app.ctx().search(app.ws.targets)[0].entity;
  actions.fillSlot({ id: pick.id });
  const added = app.ws.plans[day].find((i) => i.targetId === pick.id);
  assert.equal(added.time, '10:00');
  assert.equal(added.mode, 'timed');
  assert.equal(added.booking, 'requested');
  assert.equal(added.via, bookingRoute(pick).label);
  assert.equal(app.ws.replacement, null);
  assert.equal(app.ws.targets.sort, 'relevance', 'Targets goes back to its usual order');
  assert.equal(app.tab, 'today');
  assert.equal(app.entry().ui.day, day);
  assert.equal(visit(app, 'v-jordan').time, '14:00', 'other appointments stay where they are');

  app.toasts.at(-1).undo();
  assert.ok(!app.ws.plans[day].some((i) => i.targetId === pick.id));
  assert.equal(app.ws.replacement.time, '10:00');
});

test('leaving the slot free clears it and restores Targets', () => {
  const { app, actions } = cancelMaya();
  actions.clearReplacement();
  assert.equal(app.ws.replacement, null);
  assert.equal(app.ws.targets.planned, 'any');
});

test('a flexible visit cancels without opening Targets', () => {
  const { app, actions } = fakeApp();
  actions.confirmCancelVisit({ item: 'v-alex', day, reason: 'Other' });
  assert.equal(visit(app, 'v-alex').status, 'cancelled');
  assert.equal(app.ws.replacement, null);
  assert.equal(app.tab, 'today');
});

test('logging a visit needs an outcome; nothing is assumed', () => {
  const { app, actions } = fakeApp();
  const before = app.ws.interactions.length;
  actions.logVisit({ item: 'v-maya', day });
  actions.saveNote({ values: {} });
  assert.equal(app.sheet.error.field, 'outcome');
  assert.equal(app.ws.interactions.length, before);
  assert.equal(visit(app, 'v-maya').status, 'planned');

  actions.saveNote({ values: { outcome: 'Attempted' } });
  assert.equal(app.ws.interactions.length, before + 1);
  assert.equal(app.ws.interactions.at(-1).outcome, 'Attempted');
  assert.equal(visit(app, 'v-maya').status, 'done');
});

test('a spoken note is kept as text and marked as spoken', () => {
  const { app, actions } = fakeApp();
  actions.addNote({ target: 'maya' });
  actions.noteField({ field: 'note', value: 'Asked about the registry' });
  app.ws.drafts.maya.spoken = true; // what Speak leaves in the draft
  actions.saveNote({ values: { outcome: 'Met' } });
  const saved = app.ws.interactions.at(-1);
  assert.equal(saved.note, 'Asked about the registry');
  assert.equal(saved.spoken, true);
});

test('booking suggests times inside the person’s own windows and avoids clashes', () => {
  const days = Array.from({ length: 14 }, (_, n) => isoDate(addDays(today, n + 1)));
  const maya = getEntity('maya');
  const slots = suggestSlots(maya, { days, plans: {}, count: 10 });
  assert.ok(slots.length > 0);
  for (const s of slots) {
    assert.ok(parseDays('Tue, Thu').has(fromIso(s.day).getDay()), `${s.day} is a Tuesday or Thursday`);
    assert.ok(s.time >= '07:30' && s.time < '08:30');
  }
  const first = slots[0];
  const busy = { [first.day]: [{ id: 'x', targetId: 'sam', mode: 'timed', time: first.time, duration: 30, status: 'planned' }] };
  const moved = suggestSlots(maya, { days, plans: busy, count: 1 })[0];
  assert.equal(moved.day, first.day);
  assert.ok(moved.time >= '08:00', 'the next free start after the clash');

  assert.equal(bookingRoute(maya).label, 'Rosa Diaz, scheduler');
  assert.equal(bookingRoute(getEntity('jordan')).label, 'Email');
  assert.match(bookingRoute(getEntity('msw')).label, /main line$/);
});

test('booking and rescheduling put a requested visit in the plan', () => {
  const { app, actions } = fakeApp();
  actions.bookVisit({ target: 'priya' });
  actions.saveBooking();
  const booked = Object.values(app.ws.plans).flat().find((i) => i.targetId === 'priya');
  assert.equal(booked.booking, 'requested');
  assert.equal(booked.mode, 'timed');

  actions.bookVisit({ target: 'maya', from: 'v-maya', fromDay: day });
  Object.assign(app.sheet, { pick: 'other', day, time: '14:10' });
  actions.saveBooking();
  assert.match(app.sheet.error.message, /^Clashes with .+ at 14:00\.$/);

  Object.assign(app.sheet, { time: '16:00', error: null, confirmed: true });
  actions.saveBooking();
  assert.equal(visit(app, 'v-maya'), undefined, 'the old time is replaced');
  const moved = app.ws.plans[day].find((i) => i.targetId === 'maya');
  assert.deepEqual({ time: moved.time, booking: moved.booking }, { time: '16:00', booking: 'confirmed' });
});

test('the brief has a goal, up to three talking points and copies as plain text', () => {
  const ctx = buildContext({ ws: freshWorkspace(today), entry: { screen: 'hcp', params: { id: 'maya' }, ui: {} }, today });
  const maya = buildBrief(getEntity('maya'), ctx);
  assert.equal(maya.visit.item.id, 'v-maya');
  assert.equal(maya.goal, 'Bring the procedure mix vs. peers report.');
  assert.equal(maya.goalSuggested, false);
  assert.ok(maya.points.length >= 1 && maya.points.length <= 3);
  const text = briefText(getEntity('maya'), maya);
  assert.match(text, /^Visit brief: /);
  assert.match(text, /Sample data\.$/);
  for (const id of ['hannah', 'msw', 'msh-system']) {
    const b = buildBrief(getEntity(id), ctx);
    assert.ok(b.goal && b.insight, `${id} has a goal and a reason`);
    assert.ok(!/undefined|NaN/.test(briefText(getEntity(id), b)), `${id} brief text is clean`);
  }
});
