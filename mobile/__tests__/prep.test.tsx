// Someone's Summary (lib/prep.ts, called prep inside the app): one paragraph, the
// facts written from the data and then the rep's own words, kept with the
// workspace, and Ask writing or improving those words, with "Use this summary"
// putting them in place. The sample day is Tuesday 20 October 2026.

import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';

import { useFollow } from '@/components/chat';
import { useSummaryActions } from '@/components/prep-actions';
import { answer, detectIntent, type AskLink } from '@/lib/ask';
import { buildBrief, insightFor, summaryOf, summaryParagraph } from '@/lib/brief';
import { ChatProvider, useChat } from '@/lib/chat';
import { getEntity } from '@/lib/data';
import { DATA_PERIOD } from '@/lib/data/seed';
import { sentence, startOfDay } from '@/lib/format';
import { restoreWorkspace } from '@/lib/persist';
import { IMPROVE_PREP, isThinPrep, prepEdit, START_PREP, TEXT_MAX, withPrepEdit, withSummaryText } from '@/lib/prep';
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
/** The words Ask would put in someone's Summary. */
const wordsFrom = (q: string, id: string, c = ctx) => (ask(q, id, c).doThis?.link as Extract<AskLink, { kind: 'prep' }>).text!;

describe('the Summary', () => {
  test('is one paragraph: the facts from the data, then why they matter now until the rep has words of their own', () => {
    const maya = entity('maya');
    const paragraph = `${summaryOf(maya, ctx)} ${sentence(insightFor(maya))}`;
    expect(summaryParagraph(maya, ctx)).toBe(paragraph);
    const doc = buildPrep(maya, ctx);
    expect(doc.title).toBe('Summary for Dr. Patel');
    expect(doc.sections[0]).toEqual({ title: 'Summary', lines: [{ text: paragraph }] });
    // Why now is in it, so it isn't said again.
    expect(doc.sections.map((s) => s.title)).not.toContain('Why now');
    expect(doc.summary).toMatch(/^Goal: Bring the procedure mix/);
  });

  test('the rep’s words go after the facts, their goal takes the place of the data’s, and nothing is said twice', () => {
    const maya = entity('maya');
    const referrer = buildBrief(maya, ctx).points.find((p) => p.kind === 'referrer')!.text;
    const next = within(withPrepEdit(ws, 'maya', { goal: 'Agree a date for the cath lab demo', text: `Ask how the new fellow is settling in. ${referrer}` }));
    const doc = buildPrep(maya, next);
    expect(doc.summary).toBe('Your goal: Agree a date for the cath lab demo');
    expect(doc.sections[0].lines).toEqual([{ text: `${summaryOf(maya, next)} Ask how the new fellow is settling in. ${referrer}` }]);
    // Their words don't say why now, so it has a section of its own, and what they do say isn't a talking point too.
    expect(section('maya', 'Why now', next)).toEqual([insightFor(maya)]);
    expect(section('maya', 'Talking points', next)).not.toContain(referrer);
    expect(section('maya', 'Talking points', next).length).toBeGreaterThan(0);
    expect(doc.scope).toEqual([DATA_PERIOD, 'Your own words, kept on this phone']);
    // Everyone else's is as it was.
    expect(buildPrep(entity('jordan'), next)).toEqual(buildPrep(entity('jordan'), ctx));
  });

  test('the facts keep up with the data, with the rep’s words kept after them', () => {
    const mine = withPrepEdit(ws, 'maya', { goal: '', text: 'Ask how the new fellow is settling in.' });
    const weekLater = buildContext(mine, startOfDay(new Date(2026, 9, 27)));
    expect(section('maya', 'Summary', weekLater)).toEqual([`${summaryOf(entity('maya'), weekLater)} Ask how the new fellow is settling in.`]);
    expect(summaryOf(entity('maya'), weekLater)).not.toBe(summaryOf(entity('maya'), within(mine)));
  });
});

describe('Edit summary', () => {
  test('keeps tidy words and goal, and both left blank goes back to the ones from the data', () => {
    const next = withPrepEdit(ws, 'maya', { goal: '  Ask about   the valve clinic ', text: '  bring the TAVR deck\n and ask about   Friday clinics ' });
    expect(prepEdit(next, 'maya')).toEqual({ goal: 'Ask about the valve clinic', text: 'Bring the TAVR deck and ask about Friday clinics.' });
    expect(next.pristine).toBe(false);
    // Saving the same again changes nothing.
    expect(withPrepEdit(next, 'maya', { goal: 'Ask about the valve clinic', text: 'Bring the TAVR deck and ask about Friday clinics' })).toBe(next);
    expect(withPrepEdit(ws, 'maya', { goal: ' ', text: '\n' })).toBe(ws);

    const cleared = withPrepEdit(next, 'maya', { goal: '', text: ' ' });
    expect(prepEdit(cleared, 'maya')).toBeNull();
    expect(cleared.prep).toEqual({});
  });

  test('keeps a paragraph’s worth', () => {
    expect(prepEdit(withPrepEdit(ws, 'maya', { goal: '', text: 'a'.repeat(TEXT_MAX + 50) }), 'maya')?.text).toBe(`A${'a'.repeat(TEXT_MAX - 1)}.`);
  });

  test('a goal of their own goes on someone’s page too, and what was owed becomes a point', () => {
    const before = buildBrief(entity('msw'), ctx);
    expect(before).toMatchObject({ goal: 'Draft pricing proposal for value analysis', goalSuggested: true });
    expect(before.goalDue).not.toBeNull();

    const after = buildBrief(entity('msw'), within(withPrepEdit(ws, 'msw', { goal: 'Meet Dana Ortiz about the review', text: '' })));
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
      prep: { maya: { goal: 3, text: 'bring it' }, jordan: 'nonsense', hannah: { goal: '', text: '' }, alex: { goal: 'Ask about EP', text: 'Bring the summary.' } },
    };
    expect(restoreWorkspace(JSON.stringify(kept), today).prep).toEqual({
      maya: { goal: '', text: 'Bring it.' },
      alex: { goal: 'Ask about EP', text: 'Bring the summary.' },
    });
    expect(restoreWorkspace(JSON.stringify({ ...kept, prep: ['maya'] }), today).prep).toEqual({});
  });

  test('lines kept before the Summary was one paragraph become one', () => {
    const kept = { ...ws, pristine: false, prep: { maya: { goal: 'Ask about EP', points: ['Bring it', 7, '', 'is the lab busy?'] }, jordan: { goal: '', points: [] } } };
    expect(restoreWorkspace(JSON.stringify(kept), today).prep).toEqual({ maya: { goal: 'Ask about EP', text: 'Bring it. Is the lab busy?' } });
  });
});

describe('Write a summary with Ask', () => {
  test('is offered when nothing is planned, owed or written', () => {
    const hannah = buildBrief(entity('hannah'), ctx);
    expect(isThinPrep(hannah, null)).toBe(true);
    expect(isThinPrep(hannah, { goal: '', text: 'Ask about the CKD clinic.' })).toBe(false);
    // Someone with a visit today, or something owed, has a prep worth opening.
    expect(isThinPrep(buildBrief(entity('maya'), ctx), null)).toBe(false);
    expect(isThinPrep(buildBrief(entity('msw'), ctx), null)).toBe(false);
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

  test('answers with the whole paragraph, and Use this summary puts it in place once', () => {
    const hannah = entity('hannah');
    const words = `${sentence(insightFor(hannah))} Their patients most often have chronic kidney disease, stage 3–5.`;
    const start = ask(START_PREP, 'hannah');
    expect(start).toMatchObject({
      intent: 'prep',
      about: 'hannah',
      summary: `${summaryOf(hannah, ctx)} ${words}`,
      scope: ['No visit planned', DATA_PERIOD],
      rows: [],
      // Why now is in the Summary already, so it isn't something Ask adds.
      doThis: { text: 'This adds their main condition. You can change it after.', label: 'Use this summary', link: { kind: 'prep', id: 'hannah', text: words } },
    });

    const kept = withSummaryText(ws, 'hannah', words);
    // The Summary now reads as the answer did.
    expect(summaryParagraph(hannah, within(kept))).toBe(start.summary);
    expect(section('hannah', 'Summary', within(kept))).toEqual([start.summary]);
    expect(isThinPrep(buildBrief(hannah, within(kept)), prepEdit(kept, 'hannah'))).toBe(false);
    // The same again is the summary already, and Ask has nothing more to add.
    expect(withSummaryText(kept, 'hannah', words)).toBe(kept);
    expect(ask(IMPROVE_PREP, 'hannah', within(kept))).toMatchObject({
      summary: 'The summary for Dr. Cohen already says what matters most in the figures. Ask me about them, then add what you learn with Edit.',
      doThis: null,
    });
  });

  test('Improve with Ask keeps the rep’s words and goal, adds what they don’t say, and then has nothing to add', () => {
    const maya = entity('maya');
    const mine = withPrepEdit(ws, 'maya', { goal: 'Agree a demo date', text: 'Ask how the new fellow is settling in.' });
    const better = ask(IMPROVE_PREP, 'maya', within(mine));
    expect(better.doThis).toMatchObject({ text: 'This adds why they matter now, their main procedure and who refers to them. You can change it after.', label: 'Use this summary' });
    const words = wordsFrom(IMPROVE_PREP, 'maya', within(mine));
    expect(words.startsWith(`Ask how the new fellow is settling in. ${insightFor(maya)}`)).toBe(true);
    expect(better.summary).toBe(`${summaryOf(maya, within(mine))} ${words}`);

    const kept = withSummaryText(mine, 'maya', words);
    expect(prepEdit(kept, 'maya')).toEqual({ goal: 'Agree a demo date', text: words });
    // What it added isn't a talking point as well; what was promised still is.
    expect(section('maya', 'Talking points', within(kept))).toEqual([expect.stringMatching(/^You promised: /)]);
    expect(ask(IMPROVE_PREP, 'maya', within(kept)).doThis).toBeNull();
  });

  test('reads as sentences about the place for an account, keeping names and short forms as they are', () => {
    expect(wordsFrom(IMPROVE_PREP, 'msw')).toBe(
      `${sentence(insightFor(entity('msw')))} Their most common procedure is diagnostic cardiac cath: 995 in 12 months, up 2% on last year. Dr. Paul Nguyen, Chief of Cardiology, is the clinical champion.`,
    );
    expect(wordsFrom(IMPROVE_PREP, 'alex')).toContain('Their most common procedure is AF ablation: 152 in 12 months');
  });

  test('a promise or last time isn’t written in, as it would go out of date, and stays a talking point', () => {
    // Dr. Morgan owes a call, and Mount Sinai West has a note from last time.
    for (const id of ['alex', 'msw']) {
      const [owed] = buildBrief(entity(id), ctx).points;
      expect(['promise', 'lastNote']).toContain(owed.kind);
      const kept = within(withSummaryText(ws, id, wordsFrom(IMPROVE_PREP, id)));
      expect(summaryParagraph(entity(id), kept)).not.toMatch(/You promised|Last time/);
      expect(section(id, 'Talking points', kept)).toContain(owed.text);
    }
  });

  test('with no room left, Ask says so rather than cutting the summary short', () => {
    const mine = withPrepEdit(ws, 'maya', { goal: '', text: 'a'.repeat(TEXT_MAX - 20) });
    expect(ask(IMPROVE_PREP, 'maya', within(mine))).toMatchObject({
      summary: 'The summary for Dr. Patel has no room for more. Make it shorter with Edit, then ask again.',
      doThis: null,
    });
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

  test('saving a summary or using Ask’s says so and can be undone, and the same again says it’s there', async () => {
    const { result } = await renderHook(() => useWorkspace(), { wrapper });
    await act(() => result.current.editPrep('maya', { goal: 'Agree a demo date', text: 'Ask about the fellows' }));
    expect(result.current.notice).toMatchObject({ message: expect.stringMatching(/^Summary saved/), canUndo: true });
    expect(prepEdit(result.current.ws, 'maya')).toEqual({ goal: 'Agree a demo date', text: 'Ask about the fellows.' });

    // Ask's words take the place of the rep's, and their goal stays.
    await act(() => result.current.keepSummary('maya', 'The lab is busy on Fridays.'));
    expect(result.current.notice).toMatchObject({ message: expect.stringMatching(/^Summary updated/), canUndo: true });
    expect(prepEdit(result.current.ws, 'maya')).toEqual({ goal: 'Agree a demo date', text: 'The lab is busy on Fridays.' });
    await act(() => result.current.undo());
    expect(prepEdit(result.current.ws, 'maya')?.text).toBe('Ask about the fellows.');

    await act(() => result.current.keepSummary('maya', 'ask about the fellows'));
    expect(result.current.notice).toMatchObject({ message: 'That’s the summary already', canUndo: false });
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

  test('Use this summary goes back to where it came from, or opens the full summary', async () => {
    const link: AskLink = { kind: 'prep', id: 'maya', text: 'Ask about the fellows.' };
    const fromPrep = await renderHook(() => ({ follow: useFollow('maya').follow, ws: useWorkspace().ws }), { wrapper });
    await act(() => fromPrep.result.current.follow(link));
    expect(go.back).toHaveBeenCalledTimes(1);
    expect(go.push).not.toHaveBeenCalled();
    expect(prepEdit(fromPrep.result.current.ws, 'maya')?.text).toBe('Ask about the fellows.');

    const elsewhere = await renderHook(() => useFollow().follow, { wrapper });
    await act(() => elsewhere.result.current(link));
    expect(go.push).toHaveBeenCalledWith({ pathname: '/today/doc/[id]', params: { id: 'prep-maya' } });
  });

  test('an answer from before the Summary was one paragraph adds its lines after the rep’s words', async () => {
    const view = await renderHook(() => ({ follow: useFollow('maya').follow, store: useWorkspace() }), { wrapper });
    await act(() => view.result.current.store.editPrep('maya', { goal: '', text: 'Bring the deck.' }));
    await act(() => view.result.current.follow({ kind: 'prep', id: 'maya', points: ['Ask about the fellows'] }));
    expect(prepEdit(view.result.current.store.ws, 'maya')?.text).toBe('Bring the deck. Ask about the fellows.');
  });
});
