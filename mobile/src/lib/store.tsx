// Holds the rep's workspace for the whole app. In memory for now: the sample is
// seeded fresh on each launch. On-device storage and sync come with the real services.

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { getEntity } from './data';
import { formatDate, isoDate, startOfDay } from './format';
import type { Workspace } from './types';
import {
  bookingError,
  bookVisit,
  buildContext,
  cancelVisit,
  clearReplacement,
  confirmBooking,
  fillSlot,
  findItem,
  followUpError,
  followUpRecord,
  freshWorkspace,
  noteError,
  noteRecords,
  restoreVisit,
  visitDone,
  withRecords,
  type BookingDraft,
  type Context,
  type DraftError,
  type FollowUpDraft,
  type NoteDraft,
} from './workspace';

/** A short message after a change, with Undo when the change can be taken back. */
export interface Notice {
  id: number;
  message: string;
  canUndo: boolean;
}

type Store = Context & {
  setWorkspace: (update: (ws: Workspace) => Workspace) => void;
  /** Saves a note, and its follow-up if one was asked for. Returns what's wrong instead when it can't be saved. */
  addNote: (draft: NoteDraft) => DraftError | null;
  /** Saves a follow-up. Returns what's wrong instead when it can't be saved. */
  addFollowUp: (draft: FollowUpDraft) => DraftError | null;
  /** The day Today shows, and that Targets marks people as planned on. */
  selectDay: (day: string) => void;
  /** Cancels a visit. Returns true when a timed slot was freed, for the screen to show Targets. */
  cancelVisit: (day: string, id: string, reason: string) => boolean;
  restoreVisit: (day: string, id: string) => void;
  /** Puts someone in the free slot as a requested visit. */
  fillSlot: (targetId: string) => void;
  clearReplacement: () => void;
  /** Books or reschedules a visit. Returns what's wrong instead when it can't be saved. */
  book: (draft: BookingDraft) => string | null;
  confirmBooking: (day: string, id: string) => void;
  notice: Notice | null;
  dismissNotice: () => void;
  undo: () => void;
};

const StoreContext = createContext<Store | null>(null);

export function WorkspaceProvider({ children, today: initialDay }: { children: ReactNode; today?: Date }) {
  const [today] = useState(() => initialDay ?? startOfDay());
  const [ws, setWs] = useState(() => freshWorkspace(today));
  const [notice, setNotice] = useState<Notice | null>(null);
  // The workspace before the last undoable change, and the latest one for the actions to read.
  const before = useRef<Workspace | null>(null);
  const current = useRef(ws);
  useEffect(() => {
    current.current = ws;
  }, [ws]);

  // The actions only need today, so they keep their identity as the workspace changes.
  const actions = useMemo(() => {
    const todayIso = isoDate(today);
    const apply = (next: Workspace, message: string, canUndo = true) => {
      before.current = canUndo ? current.current : null;
      current.current = next;
      setWs(next);
      setNotice({ id: Date.now(), message, canUndo });
    };
    const onDay = (day: string) => (day === todayIso ? 'today' : `on ${formatDate(day)}`);

    return {
      addNote: (draft: NoteDraft) => {
        const error = noteError(draft, todayIso);
        if (error) return error;
        const { interaction, followUp } = noteRecords(draft);
        setWs((w) => {
          const next = withRecords(w, { interactions: [interaction], followUps: followUp ? [followUp] : [] });
          return draft.visit ? visitDone(next, draft.visit.day, draft.visit.id) : next;
        });
        return null;
      },
      addFollowUp: (draft: FollowUpDraft) => {
        const error = followUpError(draft);
        if (error) return error;
        const followUp = followUpRecord(draft);
        setWs((w) => withRecords(w, { followUps: [followUp] }));
        return null;
      },
      selectDay: (day: string) => setWs((w) => ({ ...w, selection: { ...w.selection, day } })),
      cancelVisit: (day: string, id: string, reason: string) => {
        const next = cancelVisit(current.current, day, id, reason, todayIso);
        const freed = next.replacement?.itemId === id;
        apply(next, freed ? `Visit cancelled · ${next.replacement?.time} is free` : 'Visit cancelled');
        return freed;
      },
      restoreVisit: (day: string, id: string) => apply(restoreVisit(current.current, day, id), 'Visit restored', false),
      fillSlot: (targetId: string) => {
        const r = current.current.replacement;
        if (!r) return;
        apply(fillSlot(current.current, targetId), `${getEntity(targetId)?.name} added at ${r.time} · not confirmed yet`);
      },
      clearReplacement: () => setWs((w) => clearReplacement(w)),
      book: (draft: BookingDraft) => {
        const error = bookingError(current.current, draft);
        if (error || !draft.slot) return error;
        const when = `${onDay(draft.slot.day)} at ${draft.slot.time}`;
        apply(bookVisit(current.current, draft), draft.confirmed ? `Booked ${when}` : `Requested ${when} · mark it confirmed when they reply`);
        return null;
      },
      confirmBooking: (day: string, id: string) => {
        if (!findItem(current.current, day, id)) return;
        apply(confirmBooking(current.current, day, id), 'Visit confirmed');
      },
      dismissNotice: () => setNotice(null),
      undo: () => {
        if (!before.current) return;
        current.current = before.current;
        setWs(before.current);
        before.current = null;
        setNotice(null);
      },
    };
  }, [today]);

  const store = useMemo<Store>(
    () => ({ ...buildContext(ws, today), setWorkspace: setWs, notice, ...actions }),
    [ws, today, notice, actions],
  );
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useWorkspace(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return store;
}
