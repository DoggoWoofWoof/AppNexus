// The Ask conversations: one about the whole territory (the Ask tab) and one per
// person or account (from their page). They live for the session, like the
// workspace, so leaving a chat and coming back keeps the thread.
//
// What the rep asks about someone feeds their visit prep (lib/saved.ts), and
// "save that" keeps the last answer as a report in the menu's Saved list.

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { answer, type Answer } from './ask';
import { getEntity } from './data';
import { firstSentence, uid } from './format';
import { reportFrom, type Asked } from './saved';
import { useWorkspace } from './store';

/** The Ask tab's thread; a person's own thread is keyed by their id. */
export const TERRITORY = 'territory';

export interface Turn {
  id: string;
  question: string;
  via: 'typed' | 'voice';
  answer: Answer | null;
  at: number;
  /** The saved report this answer was kept as. */
  savedId?: string;
}

interface ChatStore {
  turns: (key: string) => Turn[];
  /** Asks in a thread and resolves with the finished turn, so a spoken question can be answered aloud. */
  ask: (key: string, question: string, via?: Turn['via']) => Promise<Turn & { answer: Answer }>;
  /** Keeps an answer as a report. */
  save: (key: string, turnId: string) => void;
  clear: (key: string) => void;
  /** People and accounts asked about, most recent first. */
  talkedAbout: () => string[];
  /** The questions asked about someone, in either chat. */
  asked: (id: string) => Asked[];
}

const ChatContext = createContext<ChatStore | null>(null);

// "Save that", "keep this as a report": keep the last answer.
const SAVE_ONLY = /^\s*(please\s+)?(save|keep|store)\s+(this|that|it)(\s+(as\s+)?(a\s+)?report)?(\s+for me)?\s*[.!]?\s*$/i;
// "Make a report on where Dr. Patel's patients go": answer it, then keep it.
const REPORT = /^\s*(please\s+)?(make|create|build|write|give me|save)\s+(me\s+)?(a\s+)?report\s+(on|about|of|for)\s+/i;

export function ChatProvider({ children }: { children: ReactNode }) {
  const ctx = useWorkspace();
  const [threads, setThreads] = useState<Record<string, Turn[]>>({});
  // The latest workspace and threads, for answers worked out after a change.
  const latest = useRef({ ctx, threads });
  useEffect(() => {
    latest.current = { ctx, threads };
  }, [ctx, threads]);

  const store = useMemo<ChatStore>(() => {
    const update = (key: string, change: (turns: Turn[]) => Turn[]) => setThreads((t) => ({ ...t, [key]: change(t[key] ?? []) }));
    const all = () => Object.entries(threads).flatMap(([key, turns]) => turns.map((turn) => ({ key, turn })));
    /** Who a finished turn is about: the thread's person, or who the territory answer was about. */
    const subjectOf = (key: string, turn: Turn) => (key === TERRITORY ? (turn.answer?.subject ?? null) : key);

    const keep = (question: string, a: Answer) => {
      const report = reportFrom(question, a, latest.current.ctx.today);
      latest.current.ctx.saveReport(report);
      return report;
    };

    return {
      turns: (key) => threads[key] ?? [],
      ask: async (key, question, via = 'typed') => {
        const id = uid('t');
        const at = Date.now();
        update(key, (turns) => [...turns, { id, question, via, answer: null, at }]);
        // A person's chat is always about them; the Ask tab follows whoever the last answer was about.
        const scoped = key !== TERRITORY;
        const previous = (latest.current.threads[key] ?? []).filter((t) => t.answer);
        const last = previous[previous.length - 1];
        const about = scoped ? key : (last?.answer?.about ?? null);
        const talkedAbout = [...new Set(Object.entries(latest.current.threads).flatMap(([k, turns]) => turns.map((t) => (k === TERRITORY ? t.answer?.subject : k))).filter((v): v is string => !!v))];

        let result: Answer;
        let savedId: string | undefined;
        if (SAVE_ONLY.test(question)) {
          const target = [...previous].reverse().find((t) => t.answer && !t.answer.unknown && t.answer.intent !== 'saved');
          if (target?.answer) {
            const report = target.savedId ? null : keep(target.question, target.answer);
            if (report) update(key, (turns) => turns.map((t) => (t.id === target.id ? { ...t, savedId: report.id } : t)));
            result = savedReply(target.savedId ? 'That one’s already saved. It’s in the menu under Saved.' : `Saved “${report?.title}”. It’s in the menu under Saved.`, target.savedId ?? report?.id);
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
      save: (key, turnId) => {
        const turn = (threads[key] ?? []).find((t) => t.id === turnId);
        if (!turn?.answer || turn.savedId) return;
        const report = keep(turn.question, turn.answer);
        update(key, (turns) => turns.map((t) => (t.id === turnId ? { ...t, savedId: report.id } : t)));
      },
      clear: (key) => setThreads((t) => ({ ...t, [key]: [] })),
      talkedAbout: () => {
        const seen = new Map<string, number>();
        for (const { key, turn } of all()) {
          const id = turn.answer && subjectOf(key, turn);
          if (id && getEntity(id) && turn.answer?.intent !== 'saved') seen.set(id, Math.max(seen.get(id) ?? 0, turn.at));
        }
        return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
      },
      asked: (id) =>
        all()
          .filter(({ key, turn }) => turn.answer && !turn.answer.unknown && turn.answer.intent !== 'saved' && subjectOf(key, turn) === id)
          .map(({ turn }) => ({ question: turn.question, answer: firstSentence(turn.answer?.summary ?? ''), at: turn.at })),
    };
  }, [threads]);

  return <ChatContext.Provider value={store}>{children}</ChatContext.Provider>;
}

/** The reply to "save that". */
function savedReply(summary: string, id?: string): Answer {
  return {
    intent: 'saved',
    about: null,
    subject: null,
    scope: ['Saved', 'On this device'],
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
