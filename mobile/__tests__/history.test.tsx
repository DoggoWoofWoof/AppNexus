// History, on Ask and in the menu: Ask conversations kept on the phone, ended by
// New or by the day going, listed like a chat app's and opened again to carry
// on, and the people the rep opened. The sample day is Tuesday 20 October 2026.

import { describe, expect, test } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { answer } from '@/lib/ask';
import {
  ChatProvider,
  endConversation,
  groupConversations,
  KEEP_CONVERSATIONS,
  KEEP_OPENED,
  listWhen,
  NO_CHATS,
  reopenConversation,
  restoreChats,
  TERRITORY,
  useChat,
  whenLabel,
  type Chats,
  type ConversationItem,
  type Turn,
} from '@/lib/chat';
import { startOfDay } from '@/lib/format';
import { CHATS_BACKUP_KEY, CHATS_KEY, type DeviceStorage } from '@/lib/persist';
import { useWorkspace, WorkspaceProvider } from '@/lib/store';
import { buildContext, freshWorkspace } from '@/lib/workspace';

const today = startOfDay(new Date(2026, 9, 20));
const dayStart = today.getTime();
const ctx = buildContext(freshWorkspace(today), today);
const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m).getTime();
const turn = (question: string, when: number, extra: Partial<Turn> = {}): Turn => ({ id: `t-${when}-${question}`, question, via: 'typed', answer: answer(question, ctx), at: when, ...extra });
const kept = (chats: Partial<Chats>) => JSON.stringify({ version: 1, ...NO_CHATS, ...chats });

function memoryStorage(items = new Map<string, string>()) {
  const storage: DeviceStorage = {
    getItem: async (key) => items.get(key) ?? null,
    setItem: async (key, value) => {
      items.set(key, value);
    },
  };
  return { storage, items };
}

async function renderChat(storage: DeviceStorage | null = null) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <WorkspaceProvider today={today}>
      <ChatProvider storage={storage}>{children}</ChatProvider>
    </WorkspaceProvider>
  );
  const view = await renderHook(() => ({ ws: useWorkspace(), chat: useChat() }), { wrapper });
  await waitFor(() => expect(view.result.current).toBeTruthy());
  return view;
}

describe('what History keeps', () => {
  test('a chat from an earlier day has ended; today’s carries on', () => {
    const chats = restoreChats(kept({ threads: { [TERRITORY]: [turn('Who should I see today?', at(19, 9))], maya: [turn('When is she free?', at(20, 8))] } }), dayStart);
    expect(chats.threads[TERRITORY]).toEqual([]);
    expect(chats.threads.maya.map((t) => t.question)).toEqual(['When is she free?']);
    expect(chats.past).toEqual([expect.objectContaining({ key: TERRITORY, turns: [expect.objectContaining({ question: 'Who should I see today?' })] })]);
  });

  test('a question with no answer yet isn’t kept, and anything unreadable starts empty', () => {
    const chats = restoreChats(kept({ threads: { maya: [turn('When is she free?', at(20, 8)), turn('Where does she refer?', at(20, 8, 1), { answer: null })] } }), dayStart);
    expect(chats.threads.maya.map((t) => t.question)).toEqual(['When is she free?']);
    expect(restoreChats('not json', dayStart)).toEqual(NO_CHATS);
    expect(restoreChats(JSON.stringify({ version: 99, threads: {} }), dayStart)).toEqual(NO_CHATS);
    expect(restoreChats(null, dayStart)).toEqual(NO_CHATS);
  });

  test('New ends a conversation, newest first, and keeps the last ' + KEEP_CONVERSATIONS, () => {
    expect(endConversation(NO_CHATS, TERRITORY).past).toEqual([]);
    let chats: Chats = NO_CHATS;
    for (let i = 0; i < KEEP_CONVERSATIONS + 3; i++) {
      chats = { ...chats, threads: { [TERRITORY]: [turn(`Question ${i}`, at(20, 8) + i * 60_000)] } };
      chats = endConversation(chats, TERRITORY);
    }
    expect(chats.past).toHaveLength(KEEP_CONVERSATIONS);
    expect(chats.past[0].turns[0].question).toBe(`Question ${KEEP_CONVERSATIONS + 2}`);
    expect(chats.threads[TERRITORY]).toEqual([]);
  });

  test('says when, as a rep would', () => {
    expect(whenLabel(at(20, 14, 32), today)).toBe('Today 14:32');
    expect(whenLabel(at(19, 9, 5), today)).toBe('Yesterday 09:05');
    expect(whenLabel(at(16, 16, 0), today)).toBe('Fri 16 Oct 16:00');
    // In the list, under Today and Yesterday the time is enough.
    expect(listWhen(at(20, 14, 32), today)).toBe('14:32');
    expect(listWhen(at(19, 9, 5), today)).toBe('09:05');
    expect(listWhen(at(16, 16, 0), today)).toBe('Fri 16 Oct');
  });

  test('lists conversations under Today, Yesterday and Earlier, newest first', () => {
    const item = (id: string, when: number): ConversationItem => ({ id, key: TERRITORY, live: false, title: id, questions: 1, at: when });
    const groups = groupConversations([item('last week', at(13, 9)), item('this morning', at(20, 8)), item('just now', at(20, 15)), item('Friday', at(16, 16))], today);
    expect(groups.map((g) => [g.title, g.items.map((c) => c.id)])).toEqual([
      ['Today', ['just now', 'this morning']],
      ['Earlier', ['Friday', 'last week']],
    ]);
    expect(groupConversations([], today)).toEqual([]);
  });

  test('opening an ended conversation puts it back in its chat, and what was going there goes to History', () => {
    const yesterday: Chats = { ...NO_CHATS, threads: { [TERRITORY]: [] }, past: [{ id: 'c-1', key: TERRITORY, turns: [turn('Who should I see today?', at(19, 9))] }] };
    const going = { ...yesterday, threads: { [TERRITORY]: [turn('How is my week going?', at(20, 10))] } };
    const opened = reopenConversation(going, 'c-1');
    expect(opened.threads[TERRITORY].map((t) => t.question)).toEqual(['Who should I see today?']);
    expect(opened.past.map((c) => c.turns[0].question)).toEqual(['How is my week going?']);
    // With nothing going, nothing else is added; an unknown id changes nothing.
    expect(reopenConversation(yesterday, 'c-1').past).toEqual([]);
    expect(reopenConversation(going, 'nope')).toBe(going);
  });
});

describe('History in the app', () => {
  test('keeps conversations on the phone, ended ones to read again', async () => {
    const { storage, items } = memoryStorage();
    const first = await renderChat(storage);
    await act(async () => {
      await first.result.current.chat.ask(TERRITORY, 'Who should I see today?');
    });
    expect(first.result.current.chat.conversations()).toEqual([expect.objectContaining({ id: TERRITORY, live: true, title: 'Who should I see today?', questions: 1 })]);
    await act(() => first.result.current.chat.newConversation(TERRITORY));
    expect(first.result.current.chat.turns(TERRITORY)).toEqual([]);
    const [ended] = first.result.current.chat.conversations();
    expect(ended).toMatchObject({ live: false, key: TERRITORY, title: 'Who should I see today?' });
    await waitFor(() => expect(JSON.parse(items.get(CHATS_KEY) ?? '{}').past).toHaveLength(1));
    await first.unmount();

    // Opened again, it's still there, and an answer in it can still be saved.
    const again = await renderChat(storage);
    const { chat } = again.result.current;
    const conversation = chat.conversation(ended.id)!;
    expect(conversation.turns.map((t) => t.question)).toEqual(['Who should I see today?']);
    await act(() => chat.save(ended.id, conversation.turns[0].id));
    expect(again.result.current.ws.ws.saved).toHaveLength(1);
    expect(again.result.current.chat.conversation(ended.id)!.turns[0].savedId).toBe(again.result.current.ws.ws.saved[0].id);

    await act(() => again.result.current.chat.forget(ended.id));
    expect(again.result.current.chat.conversations()).toEqual([]);
    // Deleting a conversation leaves what was saved from it.
    expect(again.result.current.ws.ws.saved).toHaveLength(1);
  });

  test('a conversation opened from History carries on where it was, in its own chat', async () => {
    const { storage } = memoryStorage(
      new Map([
        [
          CHATS_KEY,
          kept({
            threads: { [TERRITORY]: [turn('What’s on my plan today?', at(20, 8))] },
            past: [
              { id: 'c-mine', key: TERRITORY, turns: [turn('Who should I see today?', at(19, 9))] },
              { id: 'c-maya', key: 'maya', turns: [turn('Where does she refer?', at(16, 9))] },
            ],
          }),
        ],
      ]),
    );
    const { result } = await renderChat(storage);
    expect(result.current.chat.conversations().map((c) => [c.title, c.live])).toEqual([
      ['What’s on my plan today?', true],
      ['Who should I see today?', false],
      ['Where does she refer?', false],
    ]);

    // Opening it gives the chat to show it in, the Ask tab or the person's own.
    let key = '';
    await act(() => {
      key = result.current.chat.open('c-mine');
    });
    expect(key).toBe(TERRITORY);
    expect(result.current.chat.turns(TERRITORY).map((t) => t.question)).toEqual(['Who should I see today?']);
    await act(async () => {
      await result.current.chat.ask(TERRITORY, 'Who is near?');
    });
    expect(result.current.chat.turns(TERRITORY).map((t) => t.question)).toEqual(['Who should I see today?', 'Who is near?']);
    // Today's chat that was showing is still in the list, and nothing is listed twice.
    const list = result.current.chat.conversations();
    expect(list.map((c) => [c.title, c.live, c.questions])).toEqual([
      ['Who should I see today?', true, 2],
      ['What’s on my plan today?', false, 1],
      ['Where does she refer?', false, 1],
    ]);

    await act(() => {
      key = result.current.chat.open('c-maya');
    });
    expect(key).toBe('maya');
    expect(result.current.chat.turns('maya').map((t) => t.question)).toEqual(['Where does she refer?']);
    // One going today opens as it is.
    expect(result.current.chat.open(TERRITORY)).toBe(TERRITORY);
    expect(result.current.chat.conversations()).toHaveLength(3);
  });

  test('lists the people opened, newest first, once each, and Clear history empties it all', async () => {
    const { result } = await renderChat();
    await act(() => {
      for (const id of ['maya', 'jordan', 'maya']) result.current.chat.opened(id);
    });
    expect(result.current.chat.recentlyOpened().map((o) => o.id)).toEqual(['maya', 'jordan']);
    await act(() => {
      for (let i = 0; i < KEEP_OPENED * 2 + 2; i++) result.current.chat.opened(i % 2 ? 'maya' : `nobody-${i}`);
    });
    // The last ten are kept, and only people still in the book are listed.
    expect(result.current.chat.recentlyOpened().map((o) => o.id)).toEqual(['maya']);

    await act(async () => {
      await result.current.chat.ask('jordan', 'When is he free?');
    });
    await act(() => result.current.chat.forgetAll());
    expect(result.current.chat.conversations()).toEqual([]);
    expect(result.current.chat.recentlyOpened()).toEqual([]);
  });

  test('their page lists every question kept, but Saved only lists those asked about this week', async () => {
    const { storage } = memoryStorage(
      new Map([
        [
          CHATS_KEY,
          kept({
            past: [
              { id: 'c-old', key: 'maya', turns: [turn('Where does she refer?', at(10, 9))] },
              { id: 'c-new', key: 'jordan', turns: [turn('When is he free?', at(18, 9))] },
            ],
          }),
        ],
      ]),
    );
    const { result } = await renderChat(storage);
    expect(result.current.chat.talkedAbout()).toEqual(['jordan']);
    expect(result.current.chat.asked('maya').map((a) => a.question)).toEqual(['Where does she refer?']);
    expect(result.current.chat.conversations().map((c) => c.id)).toEqual(['c-new', 'c-old']);
  });

  test('chats that can’t be read are copied aside on the phone, and Ask starts again', async () => {
    const unreadable = JSON.stringify({ version: 99, threads: {} });
    const { storage, items } = memoryStorage(new Map([[CHATS_KEY, unreadable]]));
    const { result } = await renderChat(storage);
    expect(result.current.chat.conversations()).toEqual([]);
    expect(items.get(CHATS_BACKUP_KEY)).toBe(unreadable);
  });

  test('an answer can be saved again once its report is removed from Saved', async () => {
    const { result } = await renderChat();
    await act(async () => {
      await result.current.chat.ask(TERRITORY, 'Who should I see today?');
    });
    const [asked] = result.current.chat.turns(TERRITORY);
    await act(() => result.current.chat.save(TERRITORY, asked.id));
    const [report] = result.current.ws.ws.saved;
    expect(result.current.chat.turns(TERRITORY)[0].savedId).toBe(report.id);
    await act(() => result.current.ws.removeSaved(report.id));
    expect(result.current.chat.turns(TERRITORY)[0].savedId).toBeUndefined();
    await act(() => result.current.chat.save(TERRITORY, asked.id));
    expect(result.current.ws.ws.saved).toHaveLength(1);
  });

  test('a question in someone’s chat that names another doctor is kept with that doctor', async () => {
    const { result } = await renderChat();
    await act(async () => {
      await result.current.chat.ask('maya', 'Who refers to Dr. Okafor?');
    });
    expect(result.current.chat.talkedAbout()).toContain('okafor');
    expect(result.current.chat.asked('okafor').map((a) => a.question)).toEqual(['Who refers to Dr. Okafor?']);
  });
});
