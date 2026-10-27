// Holds the rep's workspace for the whole app. In the app it is kept on the phone
// (lib/persist.ts) and loaded on launch; sync comes with the real services.

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { outsideWord, siteOnDay } from './booking';
import { getEntity, shortName } from './data';
import { addDays, dayInWords, formatDate, fromIso, isoDate, minutesOfDay, plural, startOfDay, toMinutes } from './format';
import { DRAFTS_KEY, laterWriter, loadKept, restoreDrafts, restoreWorkspace, WORKSPACE_KEY, type DeviceStorage, type Kept, type LogDraft } from './persist';
import { END_OF_DAY, isOnSite } from './plan';
import { withPrefs } from './prefs';
import { withPrepEdit, withSummaryText, type PrepEdit } from './prep';
import type { Entity, PlanItem, Prefs, SavedReport, VisitType, Workspace } from './types';
import {
  addPeople,
  addToPlan,
  bookingDaysFrom,
  bookingError,
  bookVisit,
  buildContext,
  cancelVisit,
  changeStop,
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
  moveStop,
  moveDayFor,
  moveToDay,
  moveToDayError,
  myTargets,
  notDoneToday,
  noteError,
  noteRecords,
  removeSaved,
  orderBest,
  placeOf,
  removeVisit,
  restoreVisit,
  saveReport,
  setVisitTime,
  stopNumber,
  visitsLogged,
  visitTimeError,
  withRecords,
  withTarget,
  withTargets,
  type BookingDraft,
  type Context,
  type DraftError,
  type FollowUpDraft,
  type NoteDraft,
} from './workspace';

/** A short message after a change, with Undo when the change can be taken back, and at times another way to make it. */
export interface Notice {
  id: number;
  message: string;
  canUndo: boolean;
  /** The change made another way instead, such as on today after all. */
  action?: { label: string; run: () => void };
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
  /** Gives a flexible stop a time. Returns what's wrong instead when it can't go then. */
  setStopTime: (day: string, id: string, time: string) => string | null;
  /** Takes a stop out of the day's plan. */
  removeStop: (day: string, id: string) => void;
  /** Books or reschedules a visit. Returns what's wrong instead when it can't be saved. */
  book: (draft: BookingDraft) => string | null;
  confirmBooking: (day: string, id: string) => void;
  /**
   * Adds someone to a day's plan (the selected day by default) at no fixed time, where
   * it adds the least travel. `type` makes it a call. Adding to today once it's over
   * puts them on the next working day (`addingTo`), with "Today instead"; on a day
   * they aren't in, the toast says so, with a day they are in instead.
   */
  addToPlan: (targetId: string, day?: string, type?: VisitType) => void;
  /** The day adding to `day` puts people on: the next working day once today is over, after 17:30, unless the rep chose today this evening. */
  addingTo: (day: string) => string;
  /** Puts the day's "Any time" visits in the order with the least driving, with Undo. */
  bestOrder: (day: string) => void;
  /** Puts an "Any time" stop at a place in the day as Today shows it (0 is next), with Undo. */
  moveStop: (day: string, id: string, at: number) => void;
  /** Makes a visit in person or a phone call, or changes how long it takes, with Undo. */
  changeStop: (day: string, id: string, change: Partial<Pick<PlanItem, 'type' | 'duration'>>) => void;
  /** Moves an "Any time" visit to another day. Returns what's wrong instead when it can't. */
  moveToDay: (day: string, id: string, toDay: string) => string | null;
  /**
   * Once today is over, moves its visits not done (`notDoneToday`) to the next
   * working day, or the next each can go, with one Undo.
   */
  moveNotDone: () => void;
  /** Adds the people picked on Targets after the day's other stops, with one Undo, as `addToPlan` does. */
  addPeople: (targetIds: string[], day: string) => void;
  /** Puts someone on My targets, or takes them off, with Undo. */
  toggleTarget: (id: string) => void;
  /** Puts the people picked on Targets on My targets, with one Undo. */
  addTargets: (ids: string[]) => void;
  /** Keeps an answer from Ask in the menu's Saved list. */
  saveReport: (report: SavedReport) => void;
  removeSaved: (id: string) => void;
  /** Changes the rep's own choices on the You page. Quietly, and Undo leaves them as they are. */
  setPrefs: (patch: Partial<Prefs>) => void;
  /**
   * Folds the daily brief on Today away until tomorrow, or with false opens it
   * again. Quietly, and Undo leaves it as it is. After a change, as it builds on it.
   */
  foldBrief: (folded?: boolean) => void;
  /** Keeps the rep's own words and goal for someone's Summary (their prep), with Undo. Both blank goes back to the one from the data. */
  editPrep: (id: string, edit: PrepEdit) => void;
  /** Puts words from Ask in someone's Summary in place of the rep's, keeping their goal, with Undo. */
  keepSummary: (id: string, text: string) => void;
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
  /** Without storage, the workspace to start from, such as a day already planned; the sample otherwise. */
  initial?: Workspace;
};

export function WorkspaceProvider({ children, today: initialDay, now = systemClock, storage = null, initial }: ProviderProps) {
  const [today] = useState(() => initialDay ?? startOfDay(now()));
  const [kept, setKept] = useState<Kept | null>(() => (storage ? null : { ws: initial ?? freshWorkspace(today), drafts: {}, readable: true }));
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
  // The day the rep said to keep adding to after 17:30, with Today instead.
  const keptToday = useRef('');
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
    const days = bookingDaysFrom(today);
    // Undo goes back to `from`: the workspace before this change, or before the one it replaces.
    const apply = (next: Workspace, message: string, canUndo = true, action?: Notice['action'], from = current.current) => {
      before.current = canUndo ? from : null;
      current.current = next;
      setWs(next);
      setNotice({ id: Date.now(), message, canUndo, action });
    };
    // A note or follow-up written after a change: Undo would take it back too, so Undo goes.
    const dropUndo = () => {
      if (!before.current) return;
      before.current = null;
      setNotice((n) => (n?.canUndo ? null : n));
    };
    // A change that needs no toast, such as which free slot Targets is filling.
    const quietly = (next: Workspace) => {
      current.current = next;
      setWs(next);
    };
    const onDay = (day: string) => {
      const word = dayInWords(day, today);
      return word === 'today' || word === 'tomorrow' ? word : `on ${word}`;
    };
    // After 17:30 today is over, so adding to it adds to the next working day, unless the rep chose today this evening.
    const addingTo = (day: string) => {
      const at = now();
      const over = day === todayIso && isoDate(at) === todayIso && minutesOfDay(at) >= toMinutes(END_OF_DAY) && keptToday.current !== todayIso;
      return over ? days[1] : day;
    };
    // What the toast says after adding to a day: who and where in the day, or how
    // many, and anyone not in that day, with a better day for one person.
    const saidAdded = (base: Workspace, next: Workspace, day: string, single?: Entity): { message: string; changed: boolean; better?: string | null } | null => {
      const was = new Set((base.plans[day] ?? []).map((i) => i.id));
      const added = (next.plans[day] ?? []).filter((i) => !was.has(i.id));
      if (!added.length) return single ? { message: `${single.name} is already in your plan ${onDay(day)}`, changed: false } : null;
      const weekday = fromIso(day).getDay();
      const away = added.filter((i) => {
        const who = getEntity(i.targetId);
        return !!who && isOnSite(i) && !siteOnDay(who, weekday);
      });
      // An account isn't "in" or out: its offices are closed.
      const closed = away.every((i) => getEntity(i.targetId)?.kind === 'hco');
      const notIn = `${closed ? 'closed' : 'not in'} on ${formatDate(day, { weekday: 'long' })}s`;
      if (added.length > 1) {
        const note = away.length ? ` · ${away.length === 1 ? '1 is' : `${away.length} are`} ${notIn}` : '';
        return { message: `${plural(added.length, 'visit')} added ${onDay(day)}${note}`, changed: true };
      }
      const who = getEntity(added[0].targetId);
      if (!who) return null;
      if (away.length) return { message: `${who.name} added ${onDay(day)}, but ${who.kind === 'hco' ? 'it’s' : 'they’re'} ${notIn}`, changed: true, better: moveDayFor(next, added[0], day, days) };
      // Say where it went, as the map numbers the stops, so the rep needn't go and look.
      const spot = stopNumber(next, day, who.id, now());
      const where = !spot ? (added[0].type === 'Email' ? ' as an email' : ' as a call') : spot.of < 2 ? '' : ` · stop ${spot.number}${spot.after ? `, after ${shortName(getEntity(spot.after.targetId) ?? who)}` : ', first'}`;
      return { message: `${who.name} added ${onDay(day)}${where}${spot?.outside ? ` · ${outsideWord(who).toLowerCase()}` : ''}`, changed: true };
    };
    /**
     * Adds to a day with `add` and says so, with one Undo. Once today is over it adds
     * to the next working day and shows that day, with "Today instead"; someone not
     * in that day gets a day they are in instead.
     */
    const addTo = (day: string, add: (ws: Workspace, day: string) => Workspace, single?: Entity) => {
      const base = current.current;
      const to = addingTo(day);
      // The same add on another day, showing `shown`, with Undo back to before either.
      const instead = (other: string, shown: string) => {
        const from = { ...base, prefs: current.current.prefs, selection: { ...current.current.selection, day: shown } };
        const again = add(from, other);
        const said = saidAdded(from, again, other, single);
        if (said) apply(again, said.message, said.changed, undefined, base);
      };
      const next = add(base, to);
      const said = saidAdded(base, next, to, single);
      if (!said) return;
      if (to !== day) {
        const run = () => {
          keptToday.current = todayIso;
          instead(day, day);
        };
        apply({ ...next, selection: { ...next.selection, day: to } }, `Today’s over: ${said.message}`, said.changed, { label: 'Today instead', run });
        return;
      }
      const better = said.better;
      const word = better && dayInWords(better, today);
      const action = better && word ? { label: `${word.charAt(0).toUpperCase()}${word.slice(1)} instead`, run: () => instead(better, current.current.selection.day) } : undefined;
      apply(next, said.message, said.changed, action);
    };

    return {
      addNote: (draft: NoteDraft) => {
        const error = noteError(draft, todayIso);
        if (error) return error;
        const { interaction, followUp } = noteRecords(draft);
        dropUndo();
        setWs((w) => visitsLogged(withRecords(w, { interactions: [interaction], followUps: followUp ? [followUp] : [] }), draft, now()));
        // There's no server yet, so say where it is rather than just "saved".
        const message = writers ? (draft.visit ? 'Visit logged · saved on this phone' : 'Note saved on this phone') : draft.visit ? 'Visit logged' : 'Note saved';
        setNotice({ id: Date.now(), message, canUndo: false });
        return null;
      },
      addFollowUp: (draft: FollowUpDraft) => {
        const error = followUpError(draft);
        if (error) return error;
        const followUp = followUpRecord(draft);
        dropUndo();
        setWs((w) => withRecords(w, { followUps: [followUp] }));
        return null;
      },
      completeFollowUp: (id: string) => apply(completeFollowUp(current.current, id, todayIso), 'Follow-up done'),
      selectDay: (day: string) => setWs((w) => ({ ...w, selection: { ...w.selection, day } })),
      cancelVisit: (day: string, id: string, reason: string) => {
        const next = cancelVisit(current.current, day, id, reason, todayIso, now());
        const freed = next.freeSlots.find((s) => s.itemId === id);
        apply(next, reason === 'Didn’t happen' ? 'Marked as didn’t happen' : freed ? `Visit cancelled · ${freed.time} is free` : 'Visit cancelled');
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
        apply(fillSlot(current.current, slotId, targetId, now()), `${getEntity(targetId)?.name} added ${onDay(slot.day)} at ${slot.time} · not confirmed yet`);
      },
      leaveFree: (slotId: string) => quietly(leaveFree(current.current, slotId)),
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
      addToPlan: (targetId: string, day = current.current.selection.day, type?: VisitType) => {
        const who = getEntity(targetId);
        if (who) addTo(day, (ws, d) => addToPlan(ws, d, targetId, now(), type), who);
      },
      addingTo,
      bestOrder: (day: string) => {
        const next = orderBest(current.current, day, now());
        if (next === current.current) return;
        const saves = buildContext(current.current, today, now()).bestOrderSaves(day, now());
        apply(next, saves ? `Stops put in the best order: ${saves} min less driving` : 'Stops put in the best order: little driving, in their usual times');
      },
      moveStop: (day: string, id: string, at: number) => {
        const next = moveStop(current.current, day, id, at, now());
        const who = getEntity(findItem(next, day, id)?.targetId ?? '');
        const spot = placeOf(next, day, id, now());
        if (next === current.current || !who || !spot) return;
        // Say where it went, as a stop that can't fit before a visit with a time goes after it.
        const before = spot.after && getEntity(spot.after.targetId);
        const lead = day === todayIso ? spot.next : spot.first;
        apply(next, lead ? `${who.name} is ${day === todayIso ? 'next' : 'first'}` : `${who.name} moved, after ${before ? shortName(before) : 'the stop before'}`);
      },
      changeStop: (day: string, id: string, change: Partial<Pick<PlanItem, 'type' | 'duration'>>) => {
        const who = getEntity(findItem(current.current, day, id)?.targetId ?? '');
        if (!who) return;
        const what = change.type ? `is now ${change.type === 'Phone call' ? 'a phone call' : 'a visit in person'}` : `now takes ${change.duration} min`;
        apply(changeStop(current.current, day, id, change), `${who.name} ${what}`);
      },
      moveToDay: (day: string, id: string, toDay: string) => {
        const error = moveToDayError(current.current, day, id, toDay);
        if (error) return error;
        const who = getEntity(findItem(current.current, day, id)?.targetId ?? '');
        apply(moveToDay(current.current, day, id, toDay), `${who?.name ?? 'Visit'} moved to ${dayInWords(toDay, today)}`);
        return null;
      },
      moveNotDone: () => {
        const notDone = notDoneToday(current.current, todayIso, now(), days);
        if (!notDone) return;
        const { moves, to } = notDone;
        const next = moves.reduce((w, m) => moveToDay(w, todayIso, m.item.id, m.to), current.current);
        const first = getEntity(moves[0].item.targetId);
        const what = moves.length === 1 && first ? first.name : plural(moves.length, 'visit');
        // Any that went another day, as they aren't in that day or are planned then already.
        const others = moves.filter((m) => m.to !== to);
        const other = others.length === 1 ? getEntity(others[0].item.targetId) : null;
        const away = !!other && others[0].to > to && isOnSite(others[0].item) && !siteOnDay(other, fromIso(to).getDay());
        const why = !away ? '' : other.kind === 'hco' ? ', when it’s open' : ', when they’re in';
        const elsewhere = other ? ` · ${shortName(other)} to ${dayInWords(others[0].to, today)}${why}` : others.length ? ` · ${others.length} to other days` : '';
        apply(next, `${what} moved to ${dayInWords(to, today)}${elsewhere}`);
      },
      addPeople: (targetIds: string[], day: string) => addTo(day, (ws, d) => addPeople(ws, d, targetIds, now())),
      toggleTarget: (id: string) => {
        const who = getEntity(id);
        if (!who) return;
        const on = !myTargets(current.current).includes(id);
        apply(withTarget(current.current, id, on), `${who.name} ${on ? 'added to' : 'taken off'} My targets`);
      },
      addTargets: (ids: string[]) => {
        const have = new Set(myTargets(current.current));
        const adding = ids.filter((id) => !have.has(id) && getEntity(id));
        if (!adding.length) {
          setNotice({ id: Date.now(), message: ids.length === 1 ? 'Already in My targets' : 'They’re all in My targets already', canUndo: false });
          return;
        }
        const one = adding.length === 1 ? getEntity(adding[0]) : null;
        apply(withTargets(current.current, adding), `${one ? one.name : adding.length} added to My targets`);
      },
      saveReport: (report: SavedReport) => apply(saveReport(current.current, report), 'Saved. Find it in the menu.'),
      removeSaved: (id: string) => apply(removeSaved(current.current, id), 'Removed from Saved'),
      setPrefs: (patch: Partial<Prefs>) => quietly(withPrefs(current.current, patch)),
      // On whatever the last change left, like selectDay, so folding it after adding someone keeps them.
      foldBrief: (folded = true) =>
        setWs((w) => {
          const { briefFolded: _was, ...selection } = w.selection;
          return { ...w, selection: folded ? { ...selection, briefFolded: todayIso } : selection };
        }),
      editPrep: (id: string, edit: PrepEdit) => {
        const next = withPrepEdit(current.current, id, edit);
        if (next !== current.current) apply(next, writers ? 'Summary saved on this phone' : 'Summary saved');
      },
      keepSummary: (id: string, text: string) => {
        const next = withSummaryText(current.current, id, text);
        if (next === current.current) setNotice({ id: Date.now(), message: 'That’s the summary already', canUndo: false });
        else apply(next, writers ? 'Summary updated on this phone' : 'Summary updated');
      },
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
        // Undo takes back the last change to the plan or notes, not a choice made on the You page
        // since, nor the day shown or the free time being filled.
        const back = { ...before.current, prefs: current.current.prefs, selection: current.current.selection };
        current.current = back;
        setWs(back);
        before.current = null;
        setNotice(null);
      },
    };
  }, [today, now, writers]);

  const store = useMemo<Store>(
    () => ({ ...buildContext(ws, today, now()), setWorkspace: setWs, notice, ...actions }),
    [ws, today, now, notice, actions],
  );
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useWorkspace(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return store;
}
