// Holds the rep's workspace for the whole app. In the app it is kept on the phone
// (lib/persist.ts) and loaded on launch; sync comes with the real services.

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { getEntity } from './data';
import { addDays, formatDate, isoDate, plural, startOfDay } from './format';
import { DRAFTS_KEY, laterWriter, loadKept, restoreDrafts, restoreWorkspace, WORKSPACE_KEY, type DeviceStorage, type Kept, type LogDraft } from './persist';
import { withPrefs } from './prefs';
import type { Prefs, SavedReport, Workspace } from './types';
import {
  addAllToPlan,
  addPeople,
  addToPlan,
  bookingError,
  bookVisit,
  buildContext,
  cancelVisit,
  chooseSlot,
  completeFollowUp,
  confirmBooking,
  fillSlot,
  fillSlotError,
  findItem,
  followUpError,
  followUpRecord,
  freshWorkspace,
  leaveFree,
  moveVisit,
  noteError,
  noteRecords,
  removeSaved,
  removeVisit,
  restoreVisit,
  saveReport,
  setVisitTime,
  visitsLogged,
  visitTimeError,
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
  completeFollowUp: (id: string) => void;
  /** The day Today shows, and that Targets marks people as planned on. */
  selectDay: (day: string) => void;
  /** Cancels a visit. Returns true when a timed slot was freed, for the screen to show Targets. */
  cancelVisit: (day: string, id: string, reason: string) => boolean;
  restoreVisit: (day: string, id: string) => void;
  /** Chooses which free slot Targets fills. */
  chooseSlot: (slotId: string) => void;
  /** Puts someone in a free slot as a requested visit, if they can usually be seen then. Says why not otherwise. */
  fillSlot: (slotId: string, targetId: string) => void;
  /** Stops offering a free slot. */
  leaveFree: (slotId: string) => void;
  /** Moves a flexible stop one place earlier or later. */
  moveStop: (day: string, id: string, direction: -1 | 1) => void;
  /** Gives a flexible stop a time. Returns what's wrong instead when it can't go then. */
  setStopTime: (day: string, id: string, time: string) => string | null;
  /** Takes a stop out of the day's plan. */
  removeStop: (day: string, id: string) => void;
  /** Books or reschedules a visit. Returns what's wrong instead when it can't be saved. */
  book: (draft: BookingDraft) => string | null;
  confirmBooking: (day: string, id: string) => void;
  /** Adds someone to a day's plan (the selected day by default) at no fixed time. */
  addToPlan: (targetId: string, day?: string) => void;
  /** Adds several people to a day, nearest first. */
  addAllToPlan: (targetIds: string[], day: string) => void;
  /** Adds the people picked on Targets after the day's other stops, with one Undo. */
  addPeople: (targetIds: string[], day: string) => void;
  /** Keeps an answer from Ask in the menu's Saved list. */
  saveReport: (report: SavedReport) => void;
  removeSaved: (id: string) => void;
  /** Changes the rep's own choices on the You page. Quietly, and Undo leaves them as they are. */
  setPrefs: (patch: Partial<Prefs>) => void;
  /** A note started in the log sheet and closed before it was saved. */
  draftFor: (key: string) => LogDraft | null;
  /** Keeps a half-written note, or with null lets it go. */
  keepDraft: (key: string, draft: LogDraft | null) => void;
  notice: Notice | null;
  dismissNotice: () => void;
  undo: () => void;
};

const StoreContext = createContext<Store | null>(null);

const systemClock = () => new Date();

// Long enough after the last change that typing doesn't write on every key.
const SAVE_DELAY_MS = 400;

/** When the phone won't take a write, such as when its storage is full. */
const saveFailed = (): Notice => ({ id: Date.now(), message: 'Couldn’t save on this phone. Closing the app will lose recent changes.', canUndo: false });

type ProviderProps = {
  children: ReactNode;
  /** The day to show. Without it the app follows the clock, and moves on to the next day at midnight. */
  today?: Date;
  /** The clock, so tests can say what time it is. */
  now?: () => Date;
  /** Where the workspace and note drafts are kept. Without it (most tests) it starts from the sample and keeps nothing. */
  storage?: DeviceStorage | null;
};

export function WorkspaceProvider({ children, today: initialDay, now = systemClock, storage = null }: ProviderProps) {
  const [today] = useState(() => initialDay ?? startOfDay(now()));
  const [kept, setKept] = useState<Kept | null>(() => (storage ? null : { ws: freshWorkspace(today), drafts: {}, readable: true }));
  useEffect(() => {
    if (!storage) return;
    let live = true;
    loadKept(storage, today).then((k) => {
      if (live) setKept(k);
    });
    return () => {
      live = false;
    };
  }, [storage, today]);

  // Nothing shows until it has loaded, so nothing done in the meantime is lost.
  if (!kept) return null;
  return (
    <LoadedWorkspace kept={kept} firstDay={today} followClock={!initialDay} now={now} storage={kept.readable ? storage : null}>
      {children}
    </LoadedWorkspace>
  );
}

const firstNotice = (kept: Kept): Notice | null =>
  !kept.readable
    ? { id: Date.now(), message: 'Couldn’t open what’s saved on this phone, so changes won’t be kept.', canUndo: false }
    : kept.replaced
      ? { id: Date.now(), message: 'What was on this phone was from an older version, so the sample started again. A copy is kept on the phone.', canUndo: false }
      : null;

function LoadedWorkspace({
  children,
  kept,
  firstDay,
  followClock,
  now,
  storage,
}: {
  children: ReactNode;
  kept: Kept;
  firstDay: Date;
  followClock: boolean;
  now: () => Date;
  storage: DeviceStorage | null;
}) {
  const [today, setToday] = useState(firstDay);
  const [ws, setWs] = useState(kept.ws);
  const [notice, setNotice] = useState<Notice | null>(() => firstNotice(kept));
  const drafts = useRef(kept.drafts);
  // Writes to the phone, a moment after the last change.
  const writers = useMemo(() => {
    if (!storage) return null;
    const failed = () => setNotice(saveFailed());
    return { ws: laterWriter(storage, WORKSPACE_KEY, SAVE_DELAY_MS, failed), drafts: laterWriter(storage, DRAFTS_KEY, SAVE_DELAY_MS, failed) };
  }, [storage]);
  useEffect(() => {
    writers?.ws.write(ws);
  }, [writers, ws]);
  // Straight away when the app goes to the background or closes, so the last change isn't lost.
  useEffect(() => {
    if (!writers) return;
    const flush = () => {
      writers.ws.flush();
      writers.drafts.flush();
    };
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') flush();
    });
    return () => {
      sub.remove();
      flush();
    };
  }, [writers]);
  // The workspace before the last undoable change, and the latest one for the actions to read.
  const before = useRef<Workspace | null>(null);
  const current = useRef(ws);
  useEffect(() => {
    current.current = ws;
  }, [ws]);

  // Open past midnight, or back the next day: the app moves on to the new day as
  // a fresh launch would, keeping the rep's work. Undo can't reach back across it.
  useEffect(() => {
    if (!followClock) return;
    const moveOn = () => {
      const day = startOfDay(now());
      if (isoDate(day) === isoDate(today)) return;
      const next = restoreWorkspace(JSON.stringify(current.current), day);
      drafts.current = restoreDrafts(JSON.stringify(drafts.current), next);
      writers?.drafts.write(drafts.current);
      before.current = null;
      current.current = next;
      setWs(next);
      setNotice(null);
      setToday(day);
    };
    const timer = setTimeout(moveOn, addDays(today, 1).getTime() - now().getTime() + 1000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') moveOn();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [followClock, today, now, writers]);

  // The actions only need today, so they keep their identity as the workspace changes.
  const actions = useMemo(() => {
    const todayIso = isoDate(today);
    const apply = (next: Workspace, message: string, canUndo = true) => {
      before.current = canUndo ? current.current : null;
      current.current = next;
      setWs(next);
      setNotice({ id: Date.now(), message, canUndo });
    };
    // A change that needs no toast, such as which free slot Targets is filling.
    const quietly = (next: Workspace) => {
      current.current = next;
      setWs(next);
    };
    const onDay = (day: string) => (day === todayIso ? 'today' : `on ${formatDate(day)}`);

    return {
      addNote: (draft: NoteDraft) => {
        const error = noteError(draft, todayIso);
        if (error) return error;
        const { interaction, followUp } = noteRecords(draft);
        setWs((w) => visitsLogged(withRecords(w, { interactions: [interaction], followUps: followUp ? [followUp] : [] }), draft));
        // There's no server yet, so say where it is rather than just "saved".
        const message = writers ? (draft.visit ? 'Visit logged · saved on this phone' : 'Note saved on this phone') : draft.visit ? 'Visit logged' : 'Note saved';
        setNotice({ id: Date.now(), message, canUndo: false });
        return null;
      },
      addFollowUp: (draft: FollowUpDraft) => {
        const error = followUpError(draft);
        if (error) return error;
        const followUp = followUpRecord(draft);
        setWs((w) => withRecords(w, { followUps: [followUp] }));
        return null;
      },
      completeFollowUp: (id: string) => apply(completeFollowUp(current.current, id, todayIso), 'Follow-up done'),
      selectDay: (day: string) => setWs((w) => ({ ...w, selection: { ...w.selection, day } })),
      cancelVisit: (day: string, id: string, reason: string) => {
        const next = cancelVisit(current.current, day, id, reason, todayIso, now());
        const freed = next.freeSlots.find((s) => s.itemId === id);
        apply(next, freed ? `Visit cancelled · ${freed.time} is free` : 'Visit cancelled');
        return !!freed;
      },
      restoreVisit: (day: string, id: string) => apply(restoreVisit(current.current, day, id), 'Visit restored', false),
      chooseSlot: (slotId: string) => quietly(chooseSlot(current.current, slotId)),
      fillSlot: (slotId: string, targetId: string) => {
        const slot = current.current.freeSlots.find((s) => s.itemId === slotId);
        const error = fillSlotError(current.current, slotId, targetId, now());
        if (!slot || error) {
          setNotice({ id: Date.now(), message: error ?? 'That time is no longer free.', canUndo: false });
          return;
        }
        apply(fillSlot(current.current, slotId, targetId, now()), `${getEntity(targetId)?.name} added at ${slot.time} · not confirmed yet`);
      },
      leaveFree: (slotId: string) => quietly(leaveFree(current.current, slotId)),
      moveStop: (day: string, id: string, direction: -1 | 1) => {
        // The arrows put a move back, so it needs no Undo; an older Undo would also lose the move.
        before.current = null;
        setNotice((n) => (n?.canUndo ? null : n));
        quietly(moveVisit(current.current, day, id, direction));
      },
      setStopTime: (day: string, id: string, time: string) => {
        const error = visitTimeError(current.current, day, id, time, now());
        if (error) return error;
        const who = getEntity(findItem(current.current, day, id)?.targetId ?? '');
        apply(setVisitTime(current.current, day, id, time), `${who?.name ?? 'Visit'} at ${time} ${onDay(day)}`);
        return null;
      },
      removeStop: (day: string, id: string) => {
        const who = getEntity(findItem(current.current, day, id)?.targetId ?? '');
        const next = removeVisit(current.current, day, id);
        if (next !== current.current) apply(next, `${who?.name ?? 'Visit'} taken out of the plan`);
      },
      book: (draft: BookingDraft) => {
        const error = bookingError(current.current, draft);
        if (error || !draft.slot) return error;
        const when = `${onDay(draft.slot.day)} at ${draft.slot.time}`;
        // Nothing is sent: the rep asks the office themselves, and marks it confirmed when they agree.
        apply(bookVisit(current.current, draft, todayIso, now()), draft.confirmed ? `Booked ${when}` : `Put in your plan ${when} · ask them, then mark it confirmed`);
        return null;

      },
      confirmBooking: (day: string, id: string) => {
        if (!findItem(current.current, day, id)) return;
        apply(confirmBooking(current.current, day, id), 'Visit confirmed');
      },
      addToPlan: (targetId: string, day = current.current.selection.day) => {
        const who = getEntity(targetId);
        if (!who) return;
        apply(addToPlan(current.current, day, targetId), `${who.name} added ${onDay(day)}`);
      },
      addAllToPlan: (targetIds: string[], day: string) => {
        const next = addAllToPlan(current.current, day, targetIds);
        const added = (next.plans[day]?.length ?? 0) - (current.current.plans[day]?.length ?? 0);
        if (added) apply(next, `${plural(added, 'person', 'people')} added ${onDay(day)}`);
      },
      addPeople: (targetIds: string[], day: string) => {
        const next = addPeople(current.current, day, targetIds);
        const added = (next.plans[day]?.length ?? 0) - (current.current.plans[day]?.length ?? 0);
        const only = added === 1 ? getEntity(next.plans[day][next.plans[day].length - 1].targetId) : null;
        if (added) apply(next, `${only ? only.name : plural(added, 'person', 'people')} added ${onDay(day)}`);
      },
      saveReport: (report: SavedReport) => apply(saveReport(current.current, report), 'Saved. Find it in the menu.'),
      removeSaved: (id: string) => apply(removeSaved(current.current, id), 'Removed from Saved'),
      setPrefs: (patch: Partial<Prefs>) => quietly(withPrefs(current.current, patch)),
      // Drafts aren't part of the workspace, so typing doesn't redraw every screen.
      draftFor: (key: string) => drafts.current[key] ?? null,
      keepDraft: (key: string, draft: LogDraft | null) => {
        const { [key]: _old, ...rest } = drafts.current;
        drafts.current = draft ? { ...rest, [key]: draft } : rest;
        writers?.drafts.write(drafts.current);
      },
      dismissNotice: () => setNotice(null),
      undo: () => {
        if (!before.current) return;
        // Undo takes back the last change to the plan or notes, not a choice made on the You page since.
        const back = { ...before.current, prefs: current.current.prefs };
        current.current = back;
        setWs(back);
        before.current = null;
        setNotice(null);
      },
    };
  }, [today, now, writers]);

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
