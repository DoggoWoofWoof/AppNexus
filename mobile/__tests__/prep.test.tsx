// Improving someone's Summary (lib/prep.ts, called prep inside the app): the
// rep's own summary and goal laid over the one written from the data and kept
// with the workspace, and Ask helping to write or improve it, with "Add to
// summary" keeping what it suggests. The sample day is Tuesday 20 October 2026.

import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';

import { useFollow } from '@/components/chat';
import { useSummaryActions } from '@/components/prep-actions';
import { answer, detectIntent, type AskLink } from '@/lib/ask';
import { buildBrief, summaryOf } from '@/lib/brief';
import { ChatProvider, useChat } from '@/lib/chat';
import { getEntity } from '@/lib/data';
import { DATA_PERIOD } from '@/lib/data/seed';
import { startOfDay } from '@/lib/format';
import { restoreWorkspace } from '@/lib/persist';
import { improvedSummary, IMPROVE_PREP, isThinPrep, MAX_POINTS, prepEdit, START_PREP, withPrepAdded, withPrepEdit } from '@/lib/prep';
import { buildPrep } from '@/lib/saved';
import { useWorkspace, WorkspaceProvider } from '@/lib/store';
import type { Entity, Workspace } from '@/lib/types';
import { buildContext, freshWorkspace } from '@/lib/workspace';

// Where the app would go, without a navigator to go there.
jest.mock('expo-router', () => ({
  ...jest.requireActual<object>('expo-router'),
  router: { push: jest.fn(), back: jest.fn(), navigate: jest.fn() },
}));
// The icons and the screens' building blocks use packages jest can't load, and
// nothing here draws them.
function mockUndrawn() {
  return new Proxy({}, { get: (_, name) => (name === '__esModule' ? true : () => null) });
}
jest.mock('lucide-react-native', () => mockUndrawn());
jest.mock('@/components/ui/text', () => mockUndrawn());
jest.mock('@/components/ui/icon', () => mockUndrawn());
jest.mock('@/components/ui/dialog', () => mockUndrawn());
jest.mock('@/components/ui/checkbox', () => mockUndrawn());
jest.mock('@/components/ui/label', () => mockUndrawn());
const go = jest.mocked(router);

const today = startOfDay(new Date(2026, 9, 20));
const ws = freshWorkspace(today);
const ctx = buildContext(ws, today);
const entity = (id: string) => getEntity(id) as Entity;
const within = (next: Workspace) => buildContext(next, today);
const section = (id: string, title: string, c = ctx) => buildPrep(entity(id), c).sections.find((s) => s.title === title)?.lines.map((l) => l.text) ?? [];
const ask = (q: string, id: string, c = ctx) => answer(q, c, { about: id, scoped: true });
const linkOf = (q: string, id: string, c = ctx) => ask(q, id, c).doThis?.link as Extract<AskLink, { kind: 'prep' }>;

describe('Edit summary', () => {
  test('keeps a tidy goal and lines, and both left blank goes back to the ones from the data', () => {
    const next = withPrepEdit(ws, 'maya', {
      goal: '  Ask about   the valve clinic ',
      points: ['Bring the TAVR deck', '', 'bring the tavr deck.', '  Ask about Friday clinics '],
    });
    expect(prepEdit(next, 'maya')).toEqual({ goal: 'Ask about the valve clinic', points: ['Bring the TAVR deck', 'Ask about Friday clinics'] });
    expect(next.pristine).toBe(false);
    // Saving the same again changes nothing.
    expect(withPrepEdit(next, 'maya', { goal: 'Ask about the valve clinic', points: ['Bring the TAVR deck', 'Ask about Friday clinics'] })).toBe(next);
    expect(withPrepEdit(ws, 'maya', { goal: ' ', points: [''] })).toBe(ws);

    const cleared = withPrepEdit(next, 'maya', { goal: '', points: [' '] });
    expect(prepEdit(cleared, 'maya')).toBeNull();
    expect(cleared.prep).toEqual({});
  });

  test('keeps no more than the limit of points', () => {
    const many = Array.from({ length: MAX_POINTS + 3 }, (_, i) => `Point ${i + 1}`);
    expect(prepEdit(withPrepEdit(ws, 'maya', { goal: '', points: many }), 'maya')?.points).toHaveLength(MAX_POINTS);
  });

  test('the rep’s summary and goal take the place of the data’s, and the talking points don’t repeat them', () => {
    const plain = buildPrep(entity('maya'), ctx);
    expect(plain.title).toBe('Summary for Dr. Patel');
    expect(plain.sections[0]).toEqual({ title: 'Summary', lines: [{ text: summaryOf(entity('maya'), ctx) }] });
    const [first, ...rest] = section('maya', 'Talking points');
    const next = within(withPrepEdit(ws, 'maya', { goal: 'Agree a date for the cath lab demo', points: ['Ask how the new fellow is settling in', first] }));
    const doc = buildPrep(entity('maya'), next);

    expect(plain.summary).toMatch(/^Goal: Bring the procedure mix/);
    expect(doc.summary).toBe('Your goal: Agree a date for the cath lab demo');
    expect(doc.sections[0]).toEqual({ title: 'Summary', lines: [{ text: 'Ask how the new fellow is settling in' }, { text: first }] });
    expect(section('maya', 'Talking points', next)).toEqual(rest);
    expect(doc.scope).toEqual([DATA_PERIOD, 'Your own words, kept on this phone']);
    // Everyone else's prep is as it was.
    expect(buildPrep(entity('jordan'), next)).toEqual(buildPrep(entity('jordan'), ctx));
  });

  test('the rep’s summary reads as sentences, for the card and Listen, and is none until they write some', () => {
    expect(improvedSummary(ws, 'maya')).toBeNull();
    expect(improvedSummary(withPrepEdit(ws, 'maya', { goal: 'Agree a demo date', points: [] }), 'maya')).toBeNull();
    const mine = withPrepEdit(ws, 'maya', { goal: '', points: ['Ask how the new fellow is settling in', 'Bring the TAVR deck.', 'Is the lab busy?'] });
    expect(improvedSummary(mine, 'maya')).toBe('Ask how the new fellow is settling in. Bring the TAVR deck. Is the lab busy?');
  });

  test('a goal of their own goes on someone’s page too, and what was owed becomes a point', () => {
    const before = buildBrief(entity('msw'), ctx);
    expect(before).toMatchObject({ goal: 'Draft pricing proposal for value analysis', goalSuggested: true });
    expect(before.goalDue).not.toBeNull();

    const after = buildBrief(entity('msw'), within(withPrepEdit(ws, 'msw', { goal: 'Meet Dana Ortiz about the review', points: [] })));
    expect(after).toMatchObject({ goal: 'Meet Dana Ortiz about the review', goalSuggested: false, goalDue: null });
    expect(after.points.find((p) => p.kind === 'promise')?.text).toMatch(/^You promised: Draft pricing proposal for value analysis \(/);
  });
});

describe('kept on the phone', () => {
  test('a workspace kept before prep could be changed still loads, with none', () => {
    const { prep: _none, ...old } = { ...ws, pristine: false };
    const restored = restoreWorkspace(JSON.stringify(old), today);
    expect(restored.prep).toEqual({});
    expect(buildPrep(entity('maya'), within(restored))).toEqual(buildPrep(entity('maya'), ctx));
  });

  test('edits come back, and anything unreadable is left out', () => {
    const kept = {
      ...ws,
      pristine: false,
      prep: { maya: { goal: 3, points: ['Bring it', 7, ''] }, jordan: 'nonsense', hannah: { goal: '', points: [] }, alex: { goal: 'Ask about EP', points: ['Bring the summary'] } },
    };
    expect(restoreWorkspace(JSON.stringify(kept), today).prep).toEqual({
      maya: { goal: '', points: ['Bring it'] },
      alex: { goal: 'Ask about EP', points: ['Bring the summary'] },
    });
    expect(restoreWorkspace(JSON.stringify({ ...kept, prep: ['maya'] }), today).prep).toEqual({});
  });
});

describe('Write a summary with Ask', () => {
  test('is offered when nothing is planned, owed, written or asked', () => {
    const hannah = buildBrief(entity('hannah'), ctx);
    expect(isThinPrep(hannah, null, [])).toBe(true);
    expect(isThinPrep(hannah, { goal: '', points: ['Ask about the CKD clinic'] }, [])).toBe(false);
    expect(isThinPrep(hannah, null, [{ question: 'Who refers to her?', answer: 'Dr. Okafor.', at: 1 }])).toBe(false);
    // Someone with a visit today, or something owed, has a prep worth opening.
    expect(isThinPrep(buildBrief(entity('maya'), ctx), null, [])).toBe(false);
    expect(isThinPrep(buildBrief(entity('msw'), ctx), null, [])).toBe(false);
  });

  test('Ask knows both questions, and other questions about a summary still go where they did', () => {
    expect(detectIntent(START_PREP, 'hannah', true)).toBe('prep');
    expect(detectIntent(IMPROVE_PREP, 'maya', true)).toBe('prep');
    expect(detectIntent('Improve the summary for Dr. Patel')).toBe('prep');
    expect(detectIntent('Help me prep for Dr. Patel')).toBe('prep');
    expect(detectIntent('Make my prep stronger', 'maya', true)).toBe('prep');
    expect(detectIntent('Show my saved prep')).toBe('saved');
    expect(detectIntent('Give me a summary of Dr. Patel')).toBe('brief');
    expect(detectIntent('Summarise my week')).toBe('week');
    // Not about anyone, so Ask asks who it's for.
    const who = answer('How can I make my prep better?', ctx);
    expect(who).toMatchObject({ intent: 'prep', summary: expect.stringMatching(/^Who is it for\?/) });
    expect(who.doThis ?? null).toBeNull();
  });

  test('drafts a goal and what to bring up, and Add to summary keeps it once', () => {
    const start = ask(START_PREP, 'hannah');
    expect(start).toMatchObject({ intent: 'prep', about: 'hannah', summary: 'Here’s a start for Dr. Cohen. Goal: Catch up and agree a next step.' });
    expect(start.rows.length).toBeGreaterThan(0);
    expect(start.scope).toEqual(['No visit planned', DATA_PERIOD]);
    const link = linkOf(START_PREP, 'hannah');
    expect(link).toEqual({ kind: 'prep', id: 'hannah', goal: 'Catch up and agree a next step', points: start.rows.map((r) => r.title) });

    const added = withPrepAdded(ws, 'hannah', link);
    const doc = buildPrep(entity('hannah'), within(added));
    expect(doc.summary).toBe('Your goal: Catch up and agree a next step');
    expect(section('hannah', 'Summary', within(added))).toEqual(link.points);
    expect(isThinPrep(buildBrief(entity('hannah'), within(added)), prepEdit(added, 'hannah'), [])).toBe(false);
    // The same again is already there.
    expect(withPrepAdded(added, 'hannah', link)).toBe(added);
  });

  test('a goal the rep wrote isn’t replaced, and their points stay first', () => {
    const mine = withPrepEdit(ws, 'hannah', { goal: 'Ask about the CKD clinic', points: ['Bring the referral map'] });
    const link = linkOf(START_PREP, 'hannah', within(mine));
    const added = prepEdit(withPrepAdded(mine, 'hannah', link), 'hannah');
    expect(added?.goal).toBe('Ask about the CKD clinic');
    expect(added?.points[0]).toBe('Bring the referral map');
  });

  test('Improve with Ask suggests only what the full summary doesn’t say yet, until there’s nothing new', () => {
    const talking = section('maya', 'Talking points');
    const first = ask(IMPROVE_PREP, 'maya');
    expect(first.summary).toBe('3 things to add to the summary for Dr. Patel.');
    expect(first.doThis).toMatchObject({ label: 'Add to summary' });
    expect(first.rows.some((r) => talking.includes(r.title))).toBe(false);
    expect(linkOf(IMPROVE_PREP, 'maya').goal).toBeUndefined();

    let next = ws;
    for (let i = 0; i < 5 && ask(IMPROVE_PREP, 'maya', within(next)).doThis; i++) {
      const link = linkOf(IMPROVE_PREP, 'maya', within(next));
      const more = withPrepAdded(next, 'maya', link);
      expect(more).not.toBe(next);
      next = more;
    }
    const done = ask(IMPROVE_PREP, 'maya', within(next));
    expect(done.doThis).toBeNull();
    expect(done.summary).toMatch(/^The summary for Dr\. Patel already has what the figures and your notes show/);
    // What was added came after nothing of the rep's, and the goal is still the plan's.
    expect(buildPrep(entity('maya'), within(next)).summary).toMatch(/^Goal: Bring the procedure mix/);
  });
});

describe('in the app', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <WorkspaceProvider today={today}>
      <ChatProvider>{children}</ChatProvider>
    </WorkspaceProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('saving a summary says so and can be undone, and adding the same again says it’s there', async () => {
    const { result } = await renderHook(() => useWorkspace(), { wrapper });
    await act(() => result.current.editPrep('maya', { goal: 'Agree a demo date', points: ['Ask about the fellows'] }));
    expect(result.current.notice).toMatchObject({ message: expect.stringMatching(/^Summary saved/), canUndo: true });
    expect(prepEdit(result.current.ws, 'maya')).toEqual({ goal: 'Agree a demo date', points: ['Ask about the fellows'] });
    await act(() => result.current.undo());
    expect(prepEdit(result.current.ws, 'maya')).toBeNull();

    await act(() => result.current.addToPrep('maya', { points: ['Ask about the fellows'] }));
    expect(result.current.notice).toMatchObject({ message: 'Added to the summary', canUndo: true });
    await act(() => result.current.addToPrep('maya', { points: ['ask about the fellows.'] }));
    expect(result.current.notice).toMatchObject({ message: 'That’s already in the summary', canUndo: false });
  });

  test('asking Ask to help with the summary doesn’t go in it as a question about them', async () => {
    const { result } = await renderHook(() => useChat(), { wrapper });
    await act(async () => {
      await result.current.ask('maya', IMPROVE_PREP);
      await result.current.ask('maya', 'Where do their patients go?');
    });
    expect(result.current.asked('maya').map((a) => a.question)).toEqual(['Where do their patients go?']);
  });

  test('Improve with Ask asks in their own Ask, which knows where it came from', async () => {
    const { result } = await renderHook(() => ({ actions: useSummaryActions(entity('maya')), chat: useChat() }), { wrapper });
    expect(result.current.actions).toMatchObject({ thin: false, improveLabel: 'Improve with Ask' });
    await act(() => result.current.actions.improve());
    expect(go.push).toHaveBeenCalledWith({ pathname: '/today/chat/[id]', params: { id: 'maya', from: 'prep' } });
    await waitFor(() => expect(result.current.chat.turns('maya').map((t) => t.question)).toEqual([IMPROVE_PREP]));
  });

  test('with nothing much to go on, the button writes a summary with Ask instead', async () => {
    const { result } = await renderHook(() => ({ actions: useSummaryActions(entity('hannah')), chat: useChat() }), { wrapper });
    expect(result.current.actions).toMatchObject({ thin: true, improveLabel: 'Write a summary with Ask' });
    await act(() => result.current.actions.improve());
    expect(go.push).toHaveBeenCalledWith({ pathname: '/today/chat/[id]', params: { id: 'hannah', from: 'prep' } });
    await waitFor(() => expect(result.current.chat.turns('hannah').map((t) => t.question)).toEqual([START_PREP]));
    // Asking for help isn't something of their own yet, so it still says write one.
    expect(result.current.actions.improveLabel).toBe('Write a summary with Ask');
  });

  test('Add to summary goes back to where it came from, or opens the full summary', async () => {
    const link: AskLink = { kind: 'prep', id: 'maya', points: ['Ask about the fellows'] };
    const fromPrep = await renderHook(() => ({ follow: useFollow('maya').follow, ws: useWorkspace().ws }), { wrapper });
    await act(() => fromPrep.result.current.follow(link));
    expect(go.back).toHaveBeenCalledTimes(1);
    expect(go.push).not.toHaveBeenCalled();
    expect(prepEdit(fromPrep.result.current.ws, 'maya')?.points).toEqual(['Ask about the fellows']);

    const elsewhere = await renderHook(() => useFollow().follow, { wrapper });
    await act(() => elsewhere.result.current(link));
    expect(go.push).toHaveBeenCalledWith({ pathname: '/today/doc/[id]', params: { id: 'prep-maya' } });
  });
});
