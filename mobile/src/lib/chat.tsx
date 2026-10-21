// The Ask conversations: one about the whole territory (the Ask tab) and one per
// person or account (from their page). They're kept on the phone, so leaving a
// chat and coming back keeps the thread, and so is History, like a chat app's
// list of chats: every conversation and the people the rep opened.
//
// A conversation ends when the rep taps New on Ask, or when its day has gone,
// since "today" in an answer means the day it was asked. Opening an ended one
// from History puts it back in its chat to carry on, and whatever was going
// there goes to History in its place.
//
// What the rep asks about someone feeds their full Summary (lib/saved.ts), and
// "save that" keeps the last answer as a report in the menu's Saved list.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { answer, SAMPLE, type Answer } from './ask';
import { getEntity } from './data';
import { addDays, daysBetween, firstSentence, formatDate, fromMinutes, startOfDay, uid } from './format';
import { CHATS_BACKUP_KEY, CHATS_KEY, laterWriter, type DeviceStorage } from './persist';
import { reportFrom, type Asked } from './saved';
import { useWorkspace } from './store';

/** The Ask tab's thread; a person's own thread is keyed by their id. */
export const TERRITORY = 'territory';

/** How many ended conversations History keeps, and how many people it lists as opened. */
export const KEEP_CONVERSATIONS = 30;
export const KEEP_OPENED = 10;

export interface Turn {
  id: string;
  question: string;
  via: 'typed' | 'voice';
  answer: Answer | null;
  at: number;
  /** The saved report this answer was kept as. */
  savedId?: string;
}

/** A conversation that has ended. */
export interface Conversation {
  id: string;
  /** TERRITORY, or the person or account it was about. */
  key: string;
  turns: Turn[];
}

/** A line in History: a conversation still going today, or one that has ended. */
export interface ConversationItem {
  /** The thread's key while it's going; the conversation's id once it has ended. */
  id: string;
  key: string;
  live: boolean;
  /** The first question. */
  title: string;
  questions: number;
  /** When the last question was asked. */
  at: number;
}

/** What's kept on the phone. */
export interface Chats {
  threads: Record<string, Turn[]>;
  /** Ended conversations, newest first. */
  past: Conversation[];
  /** People and accounts whose page the rep opened, newest first. */
  opened: { id: string; at: number }[];
}

const CHATS_VERSION = 1;
export const NO_CHATS: Chats = { threads: {}, past: [], opened: [] };

/** When something was asked or opened: "Today 14:32", "Yesterday 09:10" or "Mon 19 Oct 16:05". */
export function whenLabel(at: number, today: Date): string {
  const d = new Date(at);
  const ago = daysBetween(d, today);
  return `${ago === 0 ? 'Today' : ago === 1 ? 'Yesterday' : formatDate(d)} ${fromMinutes(d.getHours() * 60 + d.getMinutes())}`;
}

const lastAt = (turns: Turn[]) => turns[turns.length - 1]?.at ?? 0;
const answered = (turns: Turn[]) => turns.filter((t) => t.answer);

/** Ends a thread: what was answered goes to History, newest first. */
export function endConversation(chats: Chats, key: string): Chats {
  const turns = answered(chats.threads[key] ?? []);
  const threads = { ...chats.threads, [key]: [] };
  if (!turns.length) return { ...chats, threads };
  const past = [{ id: uid('c'), key, turns }, ...chats.past].sort((a, b) => lastAt(b.turns) - lastAt(a.turns)).slice(0, KEEP_CONVERSATIONS);
  return { ...chats, threads, past };
}

/** Puts an ended conversation back in its chat to carry on; whatever was going there ends and goes to History. */
export function reopenConversation(chats: Chats, id: string): Chats {
  const c = chats.past.find((p) => p.id === id);
  if (!c) return chats;
  const ended = endConversation({ ...chats, past: chats.past.filter((p) => p !== c) }, c.key);
  return { ...ended, threads: { ...ended.threads, [c.key]: c.turns } };
}

/** History's conversations under Today, Yesterday and Earlier, newest first, leaving out a group with none. */
export function groupConversations(items: ConversationItem[], today: Date): { title: 'Today' | 'Yesterday' | 'Earlier'; items: ConversationItem[] }[] {
  const groups = [
    { title: 'Today' as const, items: [] as ConversationItem[] },
    { title: 'Yesterday' as const, items: [] as ConversationItem[] },
    { title: 'Earlier' as const, items: [] as ConversationItem[] },
  ];
  for (const c of [...items].sort((a, b) => b.at - a.at)) groups[Math.min(2, Math.max(0, daysBetween(new Date(c.at), today)))].items.push(c);
  return groups.filter((g) => g.items.length);
}

/** When, in History's list: the time under Today and Yesterday, the date under Earlier. */
export function listWhen(at: number, today: Date): string {
  const d = new Date(at);
  return daysBetween(d, today) > 1 ? formatDate(d) : fromMinutes(d.getHours() * 60 + d.getMinutes());
}

/** Ends every thread last asked in before `dayStart`, so each day's chats start afresh. */
export function settleChats(chats: Chats, dayStart: number): Chats {
  return Object.entries(chats.threads)
    .filter(([, turns]) => turns.length && lastAt(turns) < dayStart)
    .reduce((c, [key]) => endConversation(c, key), chats);
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isTurn = (t: unknown): t is Turn => isRecord(t) && typeof t.question === 'string' && typeof t.at === 'number' && isRecord(t.answer);
const turnsOf = (value: unknown): Turn[] => (Array.isArray(value) ? value.filter(isTurn) : []);

/** The chats kept from last time, with any from an earlier day ended. Anything unreadable starts empty. */
export function restoreChats(raw: string | null, dayStart: number): Chats {
  let kept: unknown = null;
  try {
    kept = raw ? JSON.parse(raw) : null;
  } catch {
    // Unreadable, so there is nothing to carry on from.
  }
  if (!isRecord(kept) || kept.version !== CHATS_VERSION) return NO_CHATS;
  // A question still being answered when the app closed has no answer to keep.
  const threads = Object.fromEntries(Object.entries(isRecord(kept.threads) ? kept.threads : {}).map(([key, turns]) => [key, turnsOf(turns)]));
  const past = (Array.isArray(kept.past) ? kept.past : [])
    .filter((c): c is Conversation => isRecord(c) && typeof c.id === 'string' && typeof c.key === 'string')
    .map((c) => ({ id: c.id, key: c.key, turns: turnsOf(c.turns) }))
    .filter((c) => c.turns.length);
  const opened = (Array.isArray(kept.opened) ? kept.opened : []).filter((o): o is Chats['opened'][number] => isRecord(o) && typeof o.id === 'string' && typeof o.at === 'number');
  return settleChats({ threads, past, opened: opened.slice(0, KEEP_OPENED) }, dayStart);
}

/** Whether kept text is chats this version can carry on from. */
function chatsUsable(raw: string): boolean {
  try {
    const kept: unknown = JSON.parse(raw);
    return isRecord(kept) && kept.version === CHATS_VERSION;
  } catch {
    return false;
  }
}

/**
 * The chats kept on this phone. When they can't be read at all, nothing is
 * written, so a moment's trouble with storage doesn't wipe History; when they
 * can't be carried on from, a copy is put aside first.
 */
async function loadChats(storage: DeviceStorage, today: Date): Promise<{ chats: Chats; readable: boolean }> {
  let raw: string | null;
  try {
    raw = await storage.getItem(CHATS_KEY);
  } catch {
    return { chats: NO_CHATS, readable: false };
  }
  if (raw && !chatsUsable(raw)) {
    try {
      await storage.setItem(CHATS_BACKUP_KEY, raw);
    } catch {
      // The copy is a courtesy: starting again doesn't need it.
    }
  }
  return { chats: restoreChats(raw, startOfDay(today).getTime()), readable: true };
}

interface ChatStore {
  turns: (key: string) => Turn[];
  /** Asks in a thread and resolves with the finished turn, so a spoken question can be answered aloud. */
  ask: (key: string, question: string, via?: Turn['via']) => Promise<Turn & { answer: Answer }>;
  /** Keeps an answer as a report, from a thread that's going (by its key) or an ended conversation (by its id). */
  save: (where: string, turnId: string) => void;
  /** Ends a thread, keeping it in History, so the next question starts a new conversation. */
  newConversation: (key: string) => void;
  /** Conversations going today and those that have ended, newest first. */
  conversations: () => ConversationItem[];
  /** An ended conversation. */
  conversation: (id: string) => Conversation | null;
  /** Opens a conversation from History in its chat to carry on, and gives that chat's key: TERRITORY or the person's id. */
  open: (id: string) => string;
  /** Takes a conversation out of History: an ended one by its id, or one going today by its key. */
  forget: (id: string) => void;
  /** Clears every conversation and the people opened. */
  forgetAll: () => void;
  /** Notes that someone's page was opened. */
  opened: (id: string) => void;
  /** People and accounts opened, newest first. */
  recentlyOpened: () => Chats['opened'];
  /** People and accounts asked about in the last seven days, most recent first. */
  talkedAbout: () => string[];
  /** The questions asked about someone, in any chat kept. */
  asked: (id: string) => Asked[];
}

const ChatContext = createContext<ChatStore | null>(null);

// "Save that", "keep this as a report": keep the last answer.
const SAVE_ONLY = /^\s*(please\s+)?(save|keep|store)\s+(this|that|it)(\s+(as\s+)?(a\s+)?report)?(\s+for me)?\s*[.!]?\s*$/i;
// "Make a report on where Dr. Patel's patients go": answer it, then keep it.
const REPORT = /^\s*(please\s+)?(make|create|build|write|give me|save)\s+(me\s+)?(a\s+)?report\s+(on|about|of|for)\s+/i;

// Long enough after the last change that a run of questions writes once.
const SAVE_DELAY_MS = 400;

type ProviderProps = {
  children: ReactNode;
  /** Where the chats are kept. Without it (most tests) they start empty and nothing is kept. */
  storage?: DeviceStorage | null;
};

export function ChatProvider({ children, storage = null }: ProviderProps) {
  const { today } = useWorkspace();
  const [kept, setKept] = useState<{ chats: Chats; readable: boolean } | null>(() => (storage ? null : { chats: NO_CHATS, readable: true }));
  // Once, on launch: a new day after that is handled by LoadedChats.
  const loading = !kept;
  useEffect(() => {
    if (!storage || !loading) return;
    let live = true;
    loadChats(storage, today).then((loaded) => {
      if (live) setKept(loaded);
    });
    return () => {
      live = false;
    };
  }, [storage, today, loading]);

  // Nothing shows until it has loaded, so a question asked in the meantime isn't lost.
  if (!kept) return null;
  return (
    <LoadedChats kept={kept.chats} storage={kept.readable ? storage : null}>
      {children}
    </LoadedChats>
  );
}

function LoadedChats({ children, kept, storage }: { children: ReactNode; kept: Chats; storage: DeviceStorage | null }) {
  const ctx = useWorkspace();
  const [chats, setChats] = useState(kept);
  const { threads } = chats;
  // The latest workspace and chats, for answers worked out after a change.
  const latest = useRef({ ctx, chats });
  useEffect(() => {
    latest.current = { ctx, chats };
  }, [ctx, chats]);

  // Written to the phone a moment after the last change, and straight away when the app goes to the background.
  const writer = useMemo(() => (storage ? laterWriter(storage, CHATS_KEY, SAVE_DELAY_MS, () => {}) : null), [storage]);
  useEffect(() => {
    writer?.write({ version: CHATS_VERSION, ...chats });
  }, [writer, chats]);
  useEffect(() => {
    if (!writer) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') writer.flush();
    });
    return () => {
      sub.remove();
      writer.flush();
    };
  }, [writer]);

  // When the workspace moves on to a new day, yesterday's chats end.
  const dayStart = startOfDay(ctx.today).getTime();
  const [settledFor, setSettledFor] = useState(dayStart);
  if (settledFor !== dayStart) {
    setSettledFor(dayStart);
    setChats((c) => settleChats(c, dayStart));
  }

  // Stable, so a page can note it was opened without opening again each time History changes.
  const opened = useCallback((id: string) => {
    setChats((c) => ({ ...c, opened: [{ id, at: Date.now() }, ...c.opened.filter((o) => o.id !== id)].slice(0, KEEP_OPENED) }));
  }, []);

  // What's in Saved now. An answer whose report has gone since, by Undo or Remove, isn't saved any more and can be saved again.
  const savedIds = useMemo(() => new Set(ctx.ws.saved.map((s) => s.id)), [ctx.ws.saved]);

  const store = useMemo<ChatStore>(() => {
    const stillSaved = (t: Turn): Turn => (t.savedId && !savedIds.has(t.savedId) ? { ...t, savedId: undefined } : t);
    const isSaved = (id: string | undefined) => !!id && latest.current.ctx.ws.saved.some((s) => s.id === id);
    const update = (key: string, change: (turns: Turn[]) => Turn[]) => setChats((c) => ({ ...c, threads: { ...c.threads, [key]: change(c.threads[key] ?? []) } }));
    const all = () => [
      ...Object.entries(threads).flatMap(([key, turns]) => turns.map((turn) => ({ key, turn }))),
      ...chats.past.flatMap((c) => c.turns.map((turn) => ({ key: c.key, turn }))),
    ];
    /** Who a finished turn is about: who the answer was about, or else the thread's person. */
    const subjectOf = (key: string, turn: Turn) => turn.answer?.subject ?? (key === TERRITORY ? null : key);

    const keep = (question: string, a: Answer) => {
      const report = reportFrom(question, a, latest.current.ctx.today);
      latest.current.ctx.saveReport(report);
      return report;
    };

    return {
      turns: (key) => (threads[key] ?? []).map(stillSaved),
      ask: async (key, question, via = 'typed') => {
        const id = uid('t');
        const at = Date.now();
        update(key, (turns) => [...turns, { id, question, via, answer: null, at }]);
        // A person's chat is always about them; the Ask tab follows whoever the last answer was about.
        const scoped = key !== TERRITORY;
        const live = latest.current.chats.threads;
        const previous = (live[key] ?? []).filter((t) => t.answer);
        const last = previous[previous.length - 1];
        const about = scoped ? key : (last?.answer?.about ?? null);
        const talkedAbout = [...new Set(Object.entries(live).flatMap(([k, turns]) => turns.map((t) => (k === TERRITORY ? t.answer?.subject : k))).filter((v): v is string => !!v))];

        let result: Answer;
        let savedId: string | undefined;
        if (SAVE_ONLY.test(question)) {
          const target = [...previous].reverse().find((t) => t.answer && !t.answer.unknown && t.answer.intent !== 'saved');
          if (target?.answer) {
            const already = isSaved(target.savedId) ? target.savedId : undefined;
            const report = already ? null : keep(target.question, target.answer);
            if (report) update(key, (turns) => turns.map((t) => (t.id === target.id ? { ...t, savedId: report.id } : t)));
            result = savedReply(already ? 'That one’s already saved. It’s in the menu under Saved.' : `Saved “${report?.title}”. It’s in the menu under Saved.`, already ?? report?.id);
          } else {
            result = savedReply('Ask me something first, then say “save that” to keep the answer.');
          }
        } else {
          const rest = question.replace(REPORT, '');
          result = await Promise.resolve().then(() => answer(rest, latest.current.ctx, { about, scoped, talkedAbout }));
          if (rest !== question && !result.unknown) savedId = keep(question, result).id;
        }
        update(key, (turns) => turns.map((t) => (t.id === id ? { ...t, answer: result, savedId } : t)));
        return { id, question, via, answer: result, at, savedId };
      },
      save: (where, turnId) => {
        const ended = chats.past.find((c) => c.id === where);
        const turn = (ended ? ended.turns : (threads[where] ?? [])).find((t) => t.id === turnId);
        if (!turn?.answer || isSaved(turn.savedId)) return;
        const report = keep(turn.question, turn.answer);
        const mark = (turns: Turn[]) => turns.map((t) => (t.id === turnId ? { ...t, savedId: report.id } : t));
        if (ended) setChats((c) => ({ ...c, past: c.past.map((p) => (p.id === where ? { ...p, turns: mark(p.turns) } : p)) }));
        else update(where, mark);
      },
      newConversation: (key) => setChats((c) => endConversation(c, key)),
      conversations: () => {
        const item = (id: string, key: string, live: boolean, turns: Turn[]): ConversationItem => ({ id, key, live, title: turns[0].question, questions: turns.length, at: lastAt(turns) });
        const going = Object.entries(threads)
          .map(([key, turns]) => [key, answered(turns)] as const)
          .filter(([, turns]) => turns.length)
          .map(([key, turns]) => item(key, key, true, turns));
        return [...going, ...chats.past.map((c) => item(c.id, c.key, false, c.turns))].sort((a, b) => b.at - a.at);
      },
      conversation: (id) => {
        const ended = chats.past.find((c) => c.id === id);
        return ended ? { ...ended, turns: ended.turns.map(stillSaved) } : null;
      },
      open: (id) => {
        const ended = chats.past.find((c) => c.id === id);
        if (!ended) return id;
        setChats((c) => reopenConversation(c, id));
        return ended.key;
      },
      forget: (id) =>
        setChats((c) => (c.past.some((p) => p.id === id) ? { ...c, past: c.past.filter((p) => p.id !== id) } : { ...c, threads: { ...c.threads, [id]: [] } })),
      forgetAll: () => setChats(NO_CHATS),
      opened,
      recentlyOpened: () => chats.opened.filter((o) => getEntity(o.id)),
      talkedAbout: () => {
        // A week back, like the week's summary, so Saved doesn't fill with everyone ever asked about.
        const since = addDays(new Date(dayStart), -6).getTime();
        const seen = new Map<string, number>();
        for (const { key, turn } of all()) {
          const id = turn.answer && turn.at >= since && subjectOf(key, turn);
          if (id && getEntity(id) && turn.answer?.intent !== 'saved') seen.set(id, Math.max(seen.get(id) ?? 0, turn.at));
        }
        return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
      },
      // Asking for help with their Summary isn't a question about them, so it doesn't go in it.
      asked: (id) =>
        all()
          .filter(({ key, turn }) => turn.answer && !turn.answer.unknown && turn.answer.intent !== 'saved' && turn.answer.intent !== 'prep' && subjectOf(key, turn) === id)
          .map(({ turn }) => ({ question: turn.question, answer: firstSentence(turn.answer?.summary ?? ''), at: turn.at })),
    };
  }, [threads, chats.past, chats.opened, opened, dayStart, savedIds]);

  return <ChatContext.Provider value={store}>{children}</ChatContext.Provider>;
}

/** The reply to "save that". */
function savedReply(summary: string, id?: string): Answer {
  return {
    intent: 'saved',
    about: null,
    subject: null,
    scope: ['Saved', 'On this device', SAMPLE],
    summary,
    rows: [],
    doThis: id ? { text: 'Read it, listen to it or share it.', label: 'Open it', link: { kind: 'saved', id } } : null,
    next: ['Who should I see today?', 'What’s on my plan today?'],
  };
}

export function useChat(): ChatStore {
  const store = useContext(ChatContext);
  if (!store) throw new Error('useChat must be used inside ChatProvider');
  return store;
}

/** Notes that someone's page is open, for History. */
export function useNoteOpened(id: string) {
  const { opened } = useChat();
  useEffect(() => opened(id), [opened, id]);
}
