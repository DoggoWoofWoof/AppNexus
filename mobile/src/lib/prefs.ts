// The rep's own choices on the You page: where the day starts and how the app
// looks. They're kept on the phone with the workspace, but they aren't the rep's
// work, so changing them doesn't stop an untouched sample being re-seeded.

import { START_POINTS } from './data/seed';
import type { Appearance, Prefs, ReminderSetting, StartPoint, Workspace } from './types';

export const APPEARANCES: Appearance[] = ['system', 'light', 'dark'];
export const REMINDER_SETTINGS: ReminderSetting[] = ['all', 'end-of-day', 'off'];

// Reminders are on until the rep says no; the phone still asks before any is shown.
export const DEFAULT_PREFS: Prefs = { start: 'office', appearance: 'system', reminders: 'all' };

/** Where the day starts: the place chosen on the You page, or the office. */
export const startPoint = (ws: Pick<Workspace, 'prefs'>): StartPoint =>
  START_POINTS.find((p) => p.id === ws.prefs.start) ?? START_POINTS.find((p) => p.id === DEFAULT_PREFS.start)!;

export const withPrefs = (ws: Workspace, patch: Partial<Prefs>): Workspace => ({ ...ws, prefs: { ...ws.prefs, ...patch } });

/** Choices kept on the phone, with anything missing or no longer offered back to its default. */
export function restorePrefs(kept: unknown): Prefs {
  const k = (kept && typeof kept === 'object' ? kept : {}) as Partial<Record<keyof Prefs, unknown>>;
  return {
    start: START_POINTS.some((p) => p.id === k.start) ? (k.start as string) : DEFAULT_PREFS.start,
    appearance: APPEARANCES.includes(k.appearance as Appearance) ? (k.appearance as Appearance) : DEFAULT_PREFS.appearance,
    reminders: REMINDER_SETTINGS.includes(k.reminders as ReminderSetting) ? (k.reminders as ReminderSetting) : DEFAULT_PREFS.reminders,
  };
}
