// Ask offering to add someone to the day: an answer about someone the rep could
// see and hasn't planned to ends with "Add Dr. Adeleke to today?" (lib/ask.ts),
// and "Yes, add to today" adds them as + Add does everywhere, a visit where it
// adds the least driving, and shows the day with the daily brief folded away
// (lib/chat.tsx). The sample day is Thursday 22 October 2026.

import { describe, expect, test } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { answer, spoken, yesOrNo, type AskOptions } from '@/lib/ask';
import { ChatProvider, TERRITORY, useChat, type Turn } from '@/lib/chat';
import { isoDate, startOfDay } from '@/lib/format';
import { useWorkspace, WorkspaceProvider } from '@/lib/store';
import { buildContext, sampleWorkspace } from '@/lib/workspace';

const today = startOfDay(new Date(2026, 9, 22));
const day = isoDate(today);
const ctx = buildContext(sampleWorkspace(today), today);
/** Asks about someone in their own chat, or in the Ask tab without `about`, offering to add them today. */
const ask = (question: string, about: string | null = null, options: AskOptions = {}) => answer(question, ctx, { about, scoped: !!about, offerOn: day, ...options });

async function renderChat(at = new Date(2026, 9, 22, 10, 0)) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <WorkspaceProvider today={today} now={() => at}>
      <ChatProvider>{children}</ChatProvider>
    </WorkspaceProvider>
  );
  const view = await renderHook(() => ({ ws: useWorkspace(), chat: useChat() }), { wrapper });
  await waitFor(() => expect(view.result.current).toBeTruthy());
  return view;
}

/** Asks in a chat, and gives its last turn once it's answered. */
async function say(view: Awaited<ReturnType<typeof renderChat>>, key: string, question: string): Promise<Turn> {
  await act(async () => {
    await view.result.current.chat.ask(key, question);
  });
  const turns = view.result.current.chat.turns(key);
  return turns[turns.length - 1];
}

describe('what Ask offers', () => {
  test('after an answer about someone the rep could see that day and hasn’t planned to, to add them', () => {
    const a = ask('Why are they worth seeing?', 'callum-adeleke');
    expect(a.offer).toEqual({ id: 'callum-adeleke', day, question: 'Add Dr. Adeleke to today?', yes: 'Yes, add to today' });
    // Read aloud, it asks too.
    expect(spoken(a)).toMatch(/Add Dr\. Adeleke to today\?$/);
    // Without a day to add to, nothing.
    expect(answer('Why are they worth seeing?', ctx, { about: 'callum-adeleke', scoped: true }).offer).toBeUndefined();
  });

  test('the same Add for someone new as for My targets, on a day they can be seen', () => {
    expect(ask('Why are they worth seeing?', 'adaeze-volkov').offer).toEqual({ id: 'adaeze-volkov', day, question: 'Add Dr. Volkov to today?', yes: 'Yes, add to today' });
    // Dr. Rossi is in on Fridays.
    expect(ask('Where do their patients go?', 'elena', { offerOn: '2026-10-23' }).offer).toEqual({ id: 'elena', day: '2026-10-23', question: 'Add Dr. Rossi to tomorrow?', yes: 'Yes, add to tomorrow' });
  });

  test('after a list, the first in it, as when asking about the account in the brief', () => {
    expect(ask('Top doctors here', 'pierhaven')).toMatchObject({ intent: 'people', offer: { id: 'adaeze-volkov', question: 'Add Dr. Volkov to today?' } });
    const list = ask('Top doctors using competitor products');
    expect(list.offer?.id).toBe(list.about);
  });

  test('not where booking a time is the next step, for anyone planned or not in that day, or anyone the rep said no to', () => {
    expect(ask('When can I see them?', 'adaeze-volkov').offer).toBeUndefined();
    expect(ask('What should I bring up?', 'adaeze-volkov').offer).toBeUndefined();
    // Dr. Patel is in the day already, and Dr. Rossi is in on Fridays.
    expect(ask('Brief me on Dr. Maya Patel').offer).toBeUndefined();
    expect(ask('Where do their patients go?', 'elena').offer).toBeUndefined();
    expect(ask('Where do their patients go?', 'elena', { offerOn: '2026-10-23' }).offer?.question).toBe('Add Dr. Rossi to tomorrow?');
    expect(ask('Why are they worth seeing?', 'adaeze-volkov', { declined: ['adaeze-volkov'] }).offer).toBeUndefined();
    // A health system isn't somewhere to visit, and patients lost across the territory says to start with a doctor there.
    expect(ask('Brief me on Mount Sinai Health System').offer).toBeUndefined();
    expect(ask('Where am I losing the most volume?').offer).toBeUndefined();
  });

  test('reads a reply as yes or no, and anything else as a question', () => {
    for (const reply of ['Yes, add to today', 'yes please', 'Sure', 'add them', 'Yeah, add to tomorrow please']) expect(yesOrNo(reply)).toBe('yes');
    for (const reply of ['No', 'Not now', 'no thanks']) expect(yesOrNo(reply)).toBe('no');
    for (const reply of ['Yes, but where do they refer?', 'ok thanks', 'What should I bring up?']) expect(yesOrNo(reply)).toBeNull();
  });
});

describe('saying yes in the chat', () => {
  test('“Yes, add to today” adds them and shows the day, with the brief folded away', async () => {
    const view = await renderChat();
    expect((await say(view, 'adaeze-volkov', 'Why are they worth seeing?')).answer?.offer?.yes).toBe('Yes, add to today');
    const { answer: added } = await say(view, 'adaeze-volkov', 'Yes, add to today');
    expect(added).toMatchObject({ summary: 'Added Dr. Adaeze Volkov to today.', added: { id: 'adaeze-volkov', day }, unknown: true });
    const { ws } = view.result.current;
    expect(ws.planItemFor('adaeze-volkov', day)?.type).toBe('In-person visit');
    expect(ws.ws.selection).toMatchObject({ day, briefFolded: day });
    // Now they're in the day, it doesn't ask again.
    expect((await say(view, 'adaeze-volkov', 'Where do their patients go?')).answer?.offer).toBeUndefined();
  });

  test('after 17:30 it’s the next working day, as + on Today is', async () => {
    const view = await renderChat(new Date(2026, 9, 22, 18, 0));
    const { answer: asked } = await say(view, 'martin-janssen', 'Why are they worth seeing?');
    expect(asked?.offer).toMatchObject({ day: '2026-10-23', question: 'Add Dr. Janssen to tomorrow?', yes: 'Yes, add to tomorrow' });
    expect((await say(view, 'martin-janssen', 'Yes, add to tomorrow')).answer?.summary).toBe('Added Dr. Martin Janssen to tomorrow.');
    expect(view.result.current.ws.planItemFor('martin-janssen', '2026-10-23')).toBeTruthy();
    expect(view.result.current.ws.ws.selection.day).toBe('2026-10-23');
  });

  test('no leaves the day as it is, and they aren’t asked about again; anything else is a question', async () => {
    const view = await renderChat();
    await say(view, 'adaeze-volkov', 'Why are they worth seeing?');
    expect((await say(view, 'adaeze-volkov', 'How is their volume trending?')).answer).toMatchObject({ intent: 'trend', offer: { id: 'adaeze-volkov' } });
    const { answer: no } = await say(view, 'adaeze-volkov', 'Not now');
    expect(no).toMatchObject({ summary: 'OK, I won’t add Dr. Volkov.', unknown: true });
    expect(no?.added).toBeUndefined();
    expect(view.result.current.ws.planItemFor('adaeze-volkov', day)).toBeNull();
    expect((await say(view, 'adaeze-volkov', 'Where do their patients go?')).answer?.offer).toBeUndefined();
  });

  test('in the Ask tab, yes adds whoever the answer offered', async () => {
    const view = await renderChat();
    const { answer: list } = await say(view, TERRITORY, 'Top doctors using competitor products');
    const who = list?.offer?.id ?? '';
    expect(who).not.toBe('');
    const { answer: added } = await say(view, TERRITORY, 'yes');
    expect(added).toMatchObject({ about: who, added: { id: who, day } });
    expect(view.result.current.ws.planItemFor(who, day)).toBeTruthy();
  });
});
