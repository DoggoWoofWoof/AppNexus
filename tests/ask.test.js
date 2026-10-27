import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildContext } from '../demo/js/app.js';
import { answer, detectIntent, findEntity, looksLikeQuestion, spoken, startersFor } from '../demo/js/ask.js';
import { getEntity } from '../demo/js/data/index.js';
import { startOfDay } from '../demo/js/format.js';
import { freshWorkspace } from '../demo/js/store.js';

const today = startOfDay(new Date());
const ctx = buildContext({ ws: freshWorkspace(today), entry: { screen: 'ask', params: {}, ui: {} }, today });
const BAD_TEXT = /undefined|NaN|null|\[object/;

test('every starter question gets a real answer', () => {
  const questions = startersFor(ctx).flatMap((g) => g.questions);
  assert.ok(questions.length >= 9);
  for (const q of questions) {
    const r = answer(q, ctx);
    assert.ok(!r.unknown, `${q} is understood`);
    assert.ok(r.summary && !BAD_TEXT.test(r.summary), `${q}: ${r.summary}`);
    for (const row of r.rows || []) {
      // What a row shows: a row with its change as the trend arrow may have no line under it.
      assert.ok(!BAD_TEXT.test([row.title, row.sub ?? '', row.figure].join(' ')), `${q}: row ${row.title}`);
      if (row.change != null) assert.ok(Number.isFinite(row.change), `${q}: row ${row.title} has a change`);
      if (row.id) assert.ok(getEntity(row.id), `${q}: row links to a real profile`);
    }
    if (r.doThis) assert.ok(r.doThis.label && r.doThis.action, `${q}: the next step is actionable`);
    assert.ok(!BAD_TEXT.test(spoken(r)), `${q}: spoken answer`);
  }
});

test('ranked answers lead with the biggest mover', () => {
  const declined = answer('What has declined?', ctx);
  assert.equal(declined.intent, 'decline');
  assert.equal(declined.rows[0].id, declined.about);
  assert.match(declined.summary, /^\d+ targets? declined/);

  const growing = answer('Which accounts are growing the most?', ctx);
  assert.equal(growing.intent, 'growth');
  assert.ok(growing.rows.every((r) => getEntity(r.id).kind === 'hco'), 'accounts question ranks accounts');
});

test('follow-up questions use the previous answer only when they refer back to it', () => {
  const followUp = answer('Where does she refer patients?', ctx, 'maya');
  assert.equal(followUp.intent, 'referrals');
  assert.equal(followUp.about, 'maya');
  assert.match(followUp.summary, /Maya Patel/);

  const fresh = answer('What has declined?', ctx, 'maya');
  assert.notEqual(fresh.about, 'maya', 'a territory question is not narrowed to the last person');
});

test('names and nicknames resolve to profiles', () => {
  assert.equal(findEntity('tell me about dr okafor')?.id, 'okafor');
  assert.equal(findEntity('how is mount sinai west doing')?.id, 'msw');
  assert.equal(findEntity('banana'), null);
  assert.equal(detectIntent('Brief me on Mount Sinai West'), 'brief');
});

test('unknown questions say what Ask can do instead of guessing', () => {
  const r = answer('banana', ctx);
  assert.equal(r.unknown, true);
  assert.equal(r.rows.length, 0);
  assert.match(r.summary, /Try asking/);
});

test('search suggests Ask only for questions, not names', () => {
  for (const q of ['What has declined?', 'who is growing', 'accounts growing most']) assert.equal(looksLikeQuestion(q), true, q);
  for (const q of ['patel', 'mount sinai west', 'cardiology', '']) assert.equal(looksLikeQuestion(q), false, q);
});
