// The rep's workspace (plans, notes, follow-ups, drafts, search context),
// persisted on this device. Navigation lives in nav.js.

import { seedWorkspace } from './data/seed.js';
import { DEFAULT_FILTERS } from './search.js';
import { isoDate } from './format.js';

export const STORE_KEY = 'fieldpro.workspace.v2';
const VERSION = 2;

export function freshWorkspace(today) {
  return {
    version: VERSION,
    seededOn: isoDate(today),
    // Untouched sample workspaces are re-seeded each day so the sample plan stays current.
    pristine: true,
    ...seedWorkspace(today),
    selection: { day: isoDate(today), ids: [] },
    // Unsaved edits to a day's plan: { day, items }.
    planDraft: null,
    // A cancelled timed visit whose slot the rep is trying to fill:
    // { day, time, duration, siteId, name, targetId, itemId }.
    replacement: null,
    // Unsent notes keyed by target id (or "edit:<interaction id>").
    drafts: {},
    targets: { ...DEFAULT_FILTERS },
    activity: { view: 'todo', query: '' },
  };
}

export function loadWorkspace(storage, today) {
  try {
    const saved = JSON.parse(storage?.getItem(STORE_KEY) || 'null');
    const stale = saved?.pristine && saved.seededOn !== isoDate(today);
    if (saved?.version === VERSION && !stale) {
      saved.targets = { ...DEFAULT_FILTERS, ...saved.targets };
      return saved;
    }
  } catch {
    // Corrupt or blocked storage: start from the sample workspace.
  }
  return freshWorkspace(today);
}

/** Returns false when the browser refuses to store (private mode, quota). */
export function saveWorkspace(storage, workspace) {
  try {
    storage?.setItem(STORE_KEY, JSON.stringify(workspace));
    return true;
  } catch {
    return false;
  }
}
