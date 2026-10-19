// Keeps the rep's workspace and half-written notes on this phone between
// launches. Nothing is sent anywhere: there is no server yet, so saved notes
// say "On this phone · not sent yet" until sync comes with the real services.

import { restorePrefs } from './prefs';
import type { Workspace } from './types';
import { findItem, freshWorkspace, WORKSPACE_VERSION } from './workspace';

// Not the prototype's key: the two share an address on GitHub Pages, and their shapes differ.
export const WORKSPACE_KEY = 'fieldpro.app.workspace';
export const DRAFTS_KEY = 'fieldpro.app.drafts';

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
  const ws = { ...fresh, ...kept, prefs } as Workspace;
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

/** Drafts kept from last time, leaving out any for a visit that is no longer planned. */
export function restoreDrafts(raw: string | null, ws: Workspace): Drafts {
  const kept = readJson(raw);
  if (!isRecord(kept)) return {};
  return Object.fromEntries(
    Object.entries(kept as Drafts).filter(([, d]) => !d.visit || findItem(ws, d.visit.day, d.visit.id)?.status === 'planned'),
  );
}

export interface Kept {
  ws: Workspace;
  drafts: Drafts;
  /** False when storage couldn't be read, so nothing is written over what's there. */
  readable: boolean;
}

/** What was kept on this phone, ready for today. */
export async function loadKept(storage: DeviceStorage, today: Date): Promise<Kept> {
  try {
    const [ws, drafts] = await Promise.all([storage.getItem(WORKSPACE_KEY), storage.getItem(DRAFTS_KEY)]);
    const restored = restoreWorkspace(ws, today);
    return { ws: restored, drafts: restoreDrafts(drafts, restored), readable: true };
  } catch {
    return { ws: freshWorkspace(today), drafts: {}, readable: false };
  }
}

/**
 * Writes the latest value a moment after the last change, so typing doesn't write
 * on every key, or straight away on `flush`, such as when the app goes to the background.
 */
export function laterWriter(storage: DeviceStorage, key: string, delayMs: number, onError: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: { value: unknown } | null = null;
  const flush = () => {
    clearTimeout(timer);
    if (!pending) return;
    const { value } = pending;
    pending = null;
    try {
      storage.setItem(key, JSON.stringify(value)).catch(onError);
    } catch {
      onError();
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
