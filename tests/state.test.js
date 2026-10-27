import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ApiError, createApi } from '../demo/js/api.js';
import { buildContext } from '../demo/js/app.js';
import { priorityOf } from '../demo/js/data/index.js';
import { addDays, isoDate, startOfDay } from '../demo/js/format.js';
import { TABS, freshNav, loadNav, makeEntry, pop, push, saveNav, switchTab } from '../demo/js/nav.js';
import { travelMinutes } from '../demo/js/plan.js';
import { DEFAULT_FILTERS, activeFilterCount } from '../demo/js/search.js';
import { STORE_KEY, freshWorkspace, loadWorkspace, saveWorkspace } from '../demo/js/store.js';

const today = startOfDay(new Date());
const memory = (initial = {}) => {
  const data = { ...initial };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = String(v); }, data };
};

// ---- Search -------------------------------------------------------------------

const ws = freshWorkspace(today);
const ctx = buildContext({ ws, entry: { screen: 'targets', params: {}, ui: {} }, today });
const search = (f) => ctx.search({ ...DEFAULT_FILTERS, ...f });

test('search matches names, specialties and affiliated organizations', () => {
  assert.deepEqual(search({ query: 'okafor' }).map((r) => r.entity.id), ['okafor']);
  assert.ok(search({ query: 'cardio' }).every((r) => /cardio/i.test(r.entity.specialty)));
  const morningside = search({ query: 'morningside' });
  assert.ok(morningside.length > 0);
  assert.ok(morningside.every((r) => r.entity.affiliations.some((a) => a.orgId === 'msm')));
});

test('search keeps people and accounts apart', () => {
  assert.ok(search({ kind: 'hco' }).every((r) => r.entity.kind === 'hco'));
  assert.ok(search({ kind: 'hcp' }).every((r) => r.entity.kind === 'hcp'));
});

test('filters narrow the results and sorts order them', () => {
  assert.ok(search({ distance: '2' }).every((r) => r.distance <= 2));
  assert.ok(search({ signals: ['leakage'] }).every((r) => r.signals.some((s) => s.id === 'leakage')));
  assert.ok(search({ planned: 'unplanned' }).every((r) => !r.planned));
  const near = search({ sort: 'distance' }).map((r) => r.distance);
  assert.deepEqual(near, [...near].sort((a, b) => a - b));
  const names = search({ sort: 'name' }).map((r) => r.entity.name.replace(/^Dr\. /, ''));
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
});

test('relevance counts the drive there: a point off for every 5 minutes, as nobody can be in two places at once', () => {
  const ranked = search({ sort: 'relevance' });
  for (const r of ranked) assert.equal(r.priority, priorityOf(r.entity, ws, today) - travelMinutes(r.distance) / 5);
  assert.ok(ranked.some((r) => travelMinutes(r.distance) > 0));
  const scores = ranked.map((r) => r.priority);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
});

test('the filter count ignores the search text and People/Accounts tab', () => {
  assert.equal(activeFilterCount(DEFAULT_FILTERS), 0);
  assert.equal(activeFilterCount({ ...DEFAULT_FILTERS, query: 'x', kind: 'hco', signals: ['leakage', 'rising'], distance: '5' }), 3);
});

// ---- Workspace storage ---------------------------------------------------------------

test('a saved workspace is reloaded as it was', () => {
  const storage = memory();
  const saved = freshWorkspace(today);
  saved.pristine = false;
  saved.selection.ids = ['maya'];
  assert.equal(saveWorkspace(storage, saved), true);
  assert.deepEqual(loadWorkspace(storage, today).selection.ids, ['maya']);
});

test('an untouched sample is re-seeded on a new day; edited data is kept', () => {
  const yesterday = addDays(today, -1);
  const pristine = memory({ [STORE_KEY]: JSON.stringify(freshWorkspace(yesterday)) });
  assert.equal(loadWorkspace(pristine, today).seededOn, isoDate(today));
  const edited = freshWorkspace(yesterday);
  edited.pristine = false;
  const kept = memory({ [STORE_KEY]: JSON.stringify(edited) });
  assert.equal(loadWorkspace(kept, today).seededOn, isoDate(yesterday));
});

test('corrupt or blocked storage falls back to the sample', () => {
  assert.equal(loadWorkspace(memory({ [STORE_KEY]: '{not json' }), today).version, 2);
  const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };
  assert.equal(loadWorkspace(blocked, today).version, 2);
  assert.equal(saveWorkspace(blocked, freshWorkspace(today)), false);
});

// ---- Navigation -----------------------------------------------------------------

test('each tab keeps its own stack, and tapping the current tab returns to its root', () => {
  const nav = freshNav();
  push(nav, makeEntry('hcp', { id: 'maya' }, { tab: 'volumes' }));
  switchTab(nav, 'activity');
  switchTab(nav, 'today');
  assert.equal(nav.stacks.today.length, 2, 'stack kept across tab switches');
  assert.equal(nav.stacks.today[1].ui.tab, 'volumes', 'profile tab kept for Back');
  switchTab(nav, 'today');
  assert.equal(nav.stacks.today.length, 1);
  assert.equal(pop(nav), null, 'the root cannot be popped');
});

test('navigation survives a reload, and older saved shapes reset cleanly', () => {
  const session = memory();
  const nav = freshNav();
  push(nav, makeEntry('hco', { id: 'msw' }));
  nav.stacks.today.at(-1).status = 'loading';
  saveNav(session, nav);
  const loaded = loadNav(session, () => true);
  assert.equal(loaded.stacks.today.at(-1).params.id, 'msw');
  assert.equal(loaded.stacks.today.at(-1).status, undefined, 'loading state is not persisted');

  const old = { tab: 'today', stacks: Object.fromEntries(TABS.filter((t) => t.id !== 'ask').map((t) => [t.id, [makeEntry(t.id)]])) };
  const legacy = memory({ 'fieldpro.nav.v2': JSON.stringify(old) });
  assert.ok(loadNav(legacy, () => true).stacks.ask, 'a saved state without the Ask tab is replaced');
});

// ---- Mock API ---------------------------------------------------------------------

test('the mock API caches results and reports offline and server errors', async () => {
  let mode = 'normal';
  const api = createApi({ getMode: () => mode, latency: { normal: 1, slow: 1 } });
  assert.equal(await api.load('a', () => 1), 1);
  assert.equal(api.has('a'), true);

  mode = 'offline';
  await assert.rejects(api.load('b', () => 2), (e) => e instanceof ApiError && e.kind === 'offline');
  assert.equal(await api.load('a', () => 99), 1, 'cached data still loads offline');

  mode = 'error';
  await assert.rejects(api.load('c', () => 3), (e) => e.kind === 'server');
  assert.equal(await api.load('c', () => 3), 3, 'retry succeeds');

  mode = 'normal';
  await assert.rejects(api.load('missing', () => null), (e) => e.kind === 'not-found');
});
