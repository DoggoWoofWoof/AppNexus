import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createActions } from '../demo/js/actions.js';
import { answer } from '../demo/js/ask.js';
import { SCREENS, buildContext } from '../demo/js/app.js';
import { allHcps, allOrgs } from '../demo/js/data/index.js';
import { addDays, isoDate, startOfDay } from '../demo/js/format.js';
import { TABS } from '../demo/js/nav.js';
import { SHEET_TYPES, renderSheet } from '../demo/js/sheets.js';
import { freshWorkspace } from '../demo/js/store.js';

// Pretend the browser can speak so the read-aloud controls render too.
globalThis.speechSynthesis = { speak() {}, cancel() {} };
globalThis.SpeechSynthesisUtterance = function SpeechSynthesisUtterance() {};

const today = startOfDay(new Date());
const ACTIONS = new Set(Object.keys(createActions({})));
const HCP_TABS = ['overview', 'affiliations', 'volumes', 'referrals', 'activity'];
const HCO_TABS = ['overview', 'network', 'people', 'volumes', 'leakage', 'activity'];

function screen(name, { params = {}, ui = {}, ws = freshWorkspace(today), voice } = {}) {
  const ctx = buildContext({ ws, entry: { screen: name, params, ui }, today, voice });
  return String(SCREENS[name].render(ctx));
}

/** Checks a rendered fragment: no leaked values, and every control is wired to a real action. */
function check(out, where) {
  assert.ok(out.length > 0, `${where} renders`);
  for (const bad of ['undefined', 'NaN', '[object Object]', '>null<']) {
    assert.ok(!out.includes(bad), `${where} shows "${bad}"`);
  }
  for (const [, kind, name] of out.matchAll(/data-(action|input|change|submit)="([^"]*)"/g)) {
    assert.ok(ACTIONS.has(name), `${where}: data-${kind}="${name}" has no handler`);
  }
  for (const [tag] of out.matchAll(/<button\b[^>]*>/g)) {
    assert.ok(/data-action=|\sdisabled\b|type="submit"/.test(tag), `${where}: button does nothing: ${tag.slice(0, 120)}`);
  }
  for (const [tag] of out.matchAll(/<form\b[^>]*>/g)) {
    assert.ok(tag.includes('data-submit='), `${where}: form has no submit handler`);
  }
}

test('every tab root renders', () => {
  for (const { id } of TABS) check(screen(id), id);
});

test('every person profile renders on every tab', () => {
  for (const hcp of allHcps()) {
    for (const tab of HCP_TABS) check(screen('hcp', { params: { id: hcp.id }, ui: { tab } }), `hcp ${hcp.id} ${tab}`);
    check(screen('hcp', { params: { id: hcp.id }, ui: { tab: 'volumes', volumes: 'diagnoses' } }), `hcp ${hcp.id} diagnoses`);
  }
});

test('every account profile renders on every tab', () => {
  for (const org of allOrgs()) {
    for (const tab of HCO_TABS) check(screen('hco', { params: { id: org.id }, ui: { tab } }), `hco ${org.id} ${tab}`);
    check(screen('hco', { params: { id: org.id }, ui: { tab: 'volumes', volumes: 'diagnoses' } }), `hco ${org.id} diagnoses`);
  }
});

test('screens render their other views', () => {
  const ws = freshWorkspace(today);
  ws.targets = { ...ws.targets, view: 'map', kind: 'hco', query: 'zzz' };
  check(screen('targets', { ws }), 'targets map, no results');
  ws.activity = { view: 'journal', query: 'cath' };
  check(screen('activity', { ws }), 'activity journal');
  check(screen('today', { ui: { day: isoDate(addDays(today, 1)) } }), 'today, tomorrow');
});

test('the plan review renders selected targets and clashes', () => {
  const ws = freshWorkspace(today);
  ws.selection.ids = ['priya', 'harlem'];
  check(screen('plan', { ws }), 'plan with selection');
  const day = isoDate(today);
  const [first, ...rest] = ws.plans[day];
  ws.planDraft = { day, items: [first, { ...first, id: 'clash', targetId: 'priya' }, ...rest] };
  check(screen('plan', { ws }), 'plan with a clash');
});

test('Ask renders conversations in every state', () => {
  const ws = freshWorkspace(today);
  const ctx = buildContext({ ws, entry: { screen: 'ask', params: {}, ui: {} }, today });
  const turns = ['What has declined?', 'Brief me on Mount Sinai West', 'What are my follow-ups?', 'banana']
    .map((q, i) => ({ id: `t${i}`, q, via: 'typed', status: 'ready', result: answer(q, ctx) }));
  turns.push({ id: 'think', q: 'Who refers the most?', via: 'voice', status: 'thinking' });
  turns.push({ id: 'off', q: 'Who refers the most?', via: 'sample', status: 'error', error: 'offline' });
  for (const voice of [{ status: 'idle' }, { status: 'listening', text: 'what has' }, { status: 'speaking' }, { status: 'error', error: 'not-allowed' }]) {
    check(screen('ask', { ws, ui: { turns, handsFree: voice.status === 'speaking' }, voice }), `ask voice ${voice.status}`);
  }
});

test('every sheet renders and is wired up', () => {
  const ws = freshWorkspace(today);
  const day = isoDate(today);
  const ctx = buildContext({ ws, entry: { screen: 'today', params: {}, ui: {} }, today });
  const item = ws.plans[day][0];
  const sheets = [
    { type: 'note', target: 'maya' },
    { type: 'note', item: item.id, day },
    { type: 'note', edit: ws.interactions[0].id },
    { type: 'note' },
    { type: 'followup', target: 'maya' },
    { type: 'followup', id: ws.followUps[0].id },
    { type: 'followup' },
    { type: 'contact', org: 'msw', exec: 'nguyen' },
    { type: 'filters' },
    { type: 'note', target: 'maya', dictating: true, error: { field: 'outcome', message: 'Choose what happened.' } },
    { type: 'visitOptions', item: item.id, day },
    { type: 'visitOptions', item: 'v-jordan', day },
    { type: 'cancel', item: item.id, day },
    { type: 'book', target: 'maya' },
    { type: 'book', target: 'msw' },
    { type: 'book', target: 'maya', from: item.id, fromDay: day, pick: 'other', time: '16:00' },
    { type: 'confirm', title: 'Reset the demo?', body: 'Your notes and plans on this device are cleared.', confirmLabel: 'Reset', run: 'resetDemo', danger: true },
    { type: 'account' },
  ];
  assert.deepEqual([...new Set(sheets.map((s) => s.type))].sort(), [...SHEET_TYPES].sort(), 'every sheet type is covered');
  for (const sheet of sheets) {
    const out = renderSheet(sheet, ctx);
    assert.ok(out?.title, `${sheet.type} has a title`);
    check(String(out.content), `sheet ${sheet.type}`);
  }
});
