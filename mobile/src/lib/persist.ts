// Keeps the rep's workspace and half-written notes on this phone between
// launches. Nothing is sent anywhere: there is no server yet, so saved notes
// say "On this phone · not sent yet" until sync comes with the real services.

import { getEntity } from './data';
import { restorePrefs } from './prefs';
import { restorePrepEdits } from './prep';
import type { Workspace } from './types';
import { findItem, freshWorkspace, WORKSPACE_VERSION } from './workspace';

// Not the prototype's key: the two share an address on GitHub Pages, and their shapes differ.
export const WORKSPACE_KEY = 'fieldpro.app.workspace';
export const DRAFTS_KEY = 'fieldpro.app.drafts';
/** What was kept, when it couldn't be carried on from, so starting again loses nothing for good. */
export const BACKUP_KEY = 'fieldpro.app.workspace.backup';
/** The Ask conversations and History (lib/chat.tsx). */
export const CHATS_KEY = 'fieldpro.app.chats';
/** The chats kept, when they couldn't be carried on from. */
export const CHATS_BACKUP_KEY = 'fieldpro.app.chats.backup';

/** Where things are kept. AsyncStorage in the app; a plain object in tests. */
export interface DeviceStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/** A note started in the log sheet and not saved yet. */
export interface LogDraft {
  targetId: string;
  /** The planned visit it logs, if any. */
  visit?: { day: string; id: string };
  outcome: string;
  note: string;
  /** Who was there, at an account. */
  there: string[];
}

export type Drafts = Record<string, LogDraft>;

/** One draft per person, or per planned visit. */
export const draftKey = (targetId: string, visit?: { day: string; id: string }): string =>
  visit ? `${targetId}/${visit.day}/${visit.id}` : targetId;

const readJson = (raw: string | null): unknown => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    // Unreadable, so there is nothing to carry on from.
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/**
 * The workspace kept from last time, carried into today. An untouched sample from
 * an earlier day is seeded again, as on a fresh launch. The rep's own work is kept,
 * and only what points at a day that has gone moves on to today.
 */
export function restoreWorkspace(raw: string | null, today: Date): Workspace {
  const fresh = freshWorkspace(today);
  const kept = readJson(raw);
  if (!isRecord(kept)) return fresh;
  // The rep's choices on the You page outlast a re-seeded sample.
  const prefs = restorePrefs(kept.prefs);
  if (kept.version !== WORKSPACE_VERSION) return { ...fresh, prefs };
  if (kept.pristine && kept.seededOn !== fresh.seededOn) return { ...fresh, prefs };
  // Anything added to the workspace since it was kept starts as it would in a new one.
  const ws = { ...fresh, ...kept, prefs, prep: restorePrepEdits(kept.prep), targets: restoreTargets(kept.targets) } as Workspace;
  // A time freed on a day that has gone can't be filled now.
  const freeSlots = ws.freeSlots.filter((s) => s.day >= fresh.seededOn);
  const { slot, ...selection } = ws.selection;
  const stillFree = freeSlots.some((s) => s.itemId === slot);
  return {
    ...ws,
    freeSlots,
    selection: selection.day < fresh.seededOn ? fresh.selection : stillFree ? ws.selection : selection,
  };
}

/** My targets as kept, leaving out anyone no longer in the data; missing (the team's list) when it isn't a list. */
function restoreTargets(kept: unknown): string[] | undefined {
  if (!Array.isArray(kept)) return undefined;
  return [...new Set(kept.filter((id): id is string => typeof id === 'string' && !!getEntity(id)))];
}

/** Whether kept text is a workspace this version can carry on from. */
function usable(raw: string | null): boolean {
  const kept = readJson(raw);
  return isRecord(kept) && kept.version === WORKSPACE_VERSION;
}

/**
 * Drafts kept from last time. One for a visit that has been logged is let go. One
 * for a visit moved or cancelled since stays as a note about the person, unless
 * they already have one.
 */
export function restoreDrafts(raw: string | null, ws: Workspace): Drafts {
  const kept = readJson(raw);
  if (!isRecord(kept)) return {};
  const out: Drafts = {};
  const entries = Object.entries(kept as Drafts);
  for (const [key, d] of entries) if (!d.visit) out[key] = d;
  for (const [key, d] of entries) {
    if (!d.visit) continue;
    const status = findItem(ws, d.visit.day, d.visit.id)?.status;
    if (status === 'planned') out[key] = d;
    // A visit logged since needs no draft.
    else if (status !== 'done' && !out[d.targetId]) out[d.targetId] = { targetId: d.targetId, outcome: d.outcome, note: d.note, there: d.there };
  }
  return out;
}

export interface Kept {
  ws: Workspace;
  drafts: Drafts;
  /** False when storage couldn't be read, so nothing is written over what's there. */
  readable: boolean;
  /** True when what was kept couldn't be carried on from, and a copy was put aside under BACKUP_KEY. */
  replaced?: boolean;
}

/** What was kept on this phone, ready for today. */
export async function loadKept(storage: DeviceStorage, today: Date): Promise<Kept> {
  try {
    const [ws, drafts] = await Promise.all([storage.getItem(WORKSPACE_KEY), storage.getItem(DRAFTS_KEY)]);
    const restored = restoreWorkspace(ws, today);
    // From an older version, or unreadable: the sample starts again, and a copy is kept before it's written over.
    const replaced = !!ws && !usable(ws);
    if (replaced) {
      try {
        await storage.setItem(BACKUP_KEY, ws!);
      } catch {
        // The copy is a courtesy: starting again doesn't need it.
      }
    }
    return { ws: restored, drafts: restoreDrafts(drafts, restored), readable: true, replaced };
  } catch {
    return { ws: freshWorkspace(today), drafts: {}, readable: false };
  }
}

/**
 * Writes the latest value a moment after the last change, so typing doesn't write
 * on every key, or straight away on `flush`, such as when the app goes to the background.
 * A write that fails is tried again with the next change or flush.
 */
export function laterWriter(storage: DeviceStorage, key: string, delayMs: number, onError: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: { value: unknown } | null = null;
  const flush = () => {
    clearTimeout(timer);
    if (!pending) return;
    const failed = pending;
    pending = null;
    const retry = () => {
      // Unless something newer is already waiting to be written.
      pending ??= failed;
      onError();
    };
    try {
      storage.setItem(key, JSON.stringify(failed.value)).catch(retry);
    } catch {
      retry();
    }
  };

  return {
    write: (value: unknown) => {
      pending = { value };
      clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    flush,
  };
}
