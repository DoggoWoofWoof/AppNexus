// The You page's choices: where the day starts moves every distance with it, and
// the choices are kept on the phone without stopping the sample being re-seeded.

import { describe, expect, test } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { answer } from '@/lib/ask';
import { getEntity, getOrg, siteFor } from '@/lib/data';
import { addDays, haversineKm, isoDate, startOfDay } from '@/lib/format';
import { restoreWorkspace, WORKSPACE_KEY, type DeviceStorage } from '@/lib/persist';
import { DEFAULT_PREFS, restorePrefs, withPrefs } from '@/lib/prefs';
import { DEFAULT_FILTERS } from '@/lib/search';
import { useWorkspace, WorkspaceProvider } from '@/lib/store';
import type { PlanItem } from '@/lib/types';
import { addAllToPlan, buildContext, freshWorkspace } from '@/lib/workspace';

const today = startOfDay(new Date(2026, 9, 19));
const todayIso = isoDate(today);
const tomorrowIso = isoDate(addDays(today, 1));
const yesterday = addDays(today, -1);

const office = freshWorkspace(today);
const home = withPrefs(office, { start: 'home' });
const distances = (ws: typeof office) => new Map(buildContext(ws, today).search({ ...DEFAULT_FILTERS, sort: 'distance' }).map((r) => [r.entity.id, r.distance]));

describe('where the day starts', () => {
  test('starts at the office until the rep picks another place', () => {
    expect(office.prefs).toEqual(DEFAULT_PREFS);
    expect(buildContext(office, today).start).toMatchObject({ id: 'office', place: 'Columbus Circle' });
    expect(buildContext(home, today).start).toMatchObject({ id: 'home', place: 'West 96th Street' });
  });

  test('Targets measures distances from the chosen place', () => {
    const fromOffice = distances(office);
    const fromHome = distances(home);
    // Dr. Patel works round the corner from the office, at Mount Sinai West; Dr. Lee at Morningside, nearer home.
    expect(fromOffice.get('maya')!).toBeLessThan(fromHome.get('maya')!);
    expect(fromHome.get('jordan')!).toBeLessThan(fromOffice.get('jordan')!);
  });

  test('“Who is near” starts from the chosen place', () => {
    const fromOffice = answer('Who is near me?', buildContext(office, today));
    const fromHome = answer('Who is near me?', buildContext(home, today));
    expect(fromOffice.scope[0]).toBe('Near Columbus Circle');
    expect(fromHome.scope[0]).toBe('Near West 96th Street');
    expect(fromHome.summary).toMatch(/West 96th Street \(your sample start point\)/);
    expect(fromHome.rows[0].id).not.toBe(fromOffice.rows[0].id);
  });

  test('Pick 5 puts the stop nearest the chosen place first', () => {
    const coordsOf = (i: PlanItem) => (getOrg(i.siteId) ?? siteFor(getEntity(i.targetId)!)).coords;
    for (const ws of [office, home]) {
      const start = buildContext(ws, today).start.coords;
      const [first, ...rest] = addAllToPlan(ws, tomorrowIso, ['maya', 'jordan']).plans[tomorrowIso];
      expect(rest.every((i) => haversineKm(start, coordsOf(first)) <= haversineKm(start, coordsOf(i)))).toBe(true);
    }
    expect(addAllToPlan(office, tomorrowIso, ['maya', 'jordan']).plans[tomorrowIso][0].targetId).toBe('maya');
    expect(addAllToPlan(home, tomorrowIso, ['maya', 'jordan']).plans[tomorrowIso][0].targetId).toBe('jordan');
  });
});

/** Stands in for AsyncStorage. */
function memoryStorage(items = new Map<string, string>()) {
  return {
    items,
    getItem: async (key: string) => items.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      items.set(key, value);
    },
  };
}

async function renderStore(storage: DeviceStorage | null = null) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <WorkspaceProvider today={today} now={() => new Date(2026, 9, 19, 8, 0)} storage={storage}>
      {children}
    </WorkspaceProvider>
  );
  const view = await renderHook(() => useWorkspace(), { wrapper });
  await waitFor(() => expect(view.result.current).toBeTruthy());
  return view;
}

describe('the choices are kept', () => {
  test('and come back on relaunch, with the sample still untouched', async () => {
    const storage = memoryStorage();
    const first = await renderStore(storage);
    await act(() => first.result.current.setPrefs({ start: 'home', appearance: 'dark' }));
    expect(first.result.current.start.id).toBe('home');
    expect(first.result.current.notice).toBeNull();
    await first.unmount();

    const { result } = await renderStore(storage);
    expect(result.current.ws.prefs).toEqual({ ...DEFAULT_PREFS, start: 'home', appearance: 'dark' });
    expect(result.current.start.place).toBe('West 96th Street');
    expect(result.current.ws.pristine).toBe(true);
  });

  test('outlast the sample being seeded again the next day', () => {
    const kept = withPrefs(freshWorkspace(yesterday), { start: 'home', appearance: 'light' });
    const ws = restoreWorkspace(JSON.stringify(kept), today);
    expect(ws.seededOn).toBe(todayIso);
    expect(ws.prefs).toEqual({ ...DEFAULT_PREFS, start: 'home', appearance: 'light' });
  });

  test('a place, look or reminder setting no longer offered goes back to the default', () => {
    expect(restorePrefs({ start: 'moon', appearance: 'neon', reminders: 'hourly' })).toEqual(DEFAULT_PREFS);
    // Kept before reminders could be chosen: they stay on.
    expect(restorePrefs({ start: 'home', appearance: 'dark' })).toEqual({ ...DEFAULT_PREFS, start: 'home', appearance: 'dark' });
    expect(restorePrefs({ start: 'home', appearance: 'dark', reminders: 'end-of-day' }).reminders).toBe('end-of-day');
    expect(restorePrefs(undefined)).toEqual(DEFAULT_PREFS);
    // Targets' states and procedures: one no longer offered is left out, or goes back to all.
    expect(restorePrefs({ states: ['NJ', 'CA', 7], codes: 'coronary' })).toMatchObject({ states: ['NJ'], codes: 'coronary' });
    expect(restorePrefs({ states: 'NJ', codes: 'kidney' })).toMatchObject({ states: [], codes: 'all' });
    // A workspace kept before there were choices starts with the defaults.
    const { prefs: _prefs, ...older } = freshWorkspace(today);
    expect(restoreWorkspace(JSON.stringify({ ...older, pristine: false }), today).prefs).toEqual(DEFAULT_PREFS);
  });

  test('Undo takes back the plan change, not a choice made since', async () => {
    const { result } = await renderStore();
    await act(() => result.current.addToPlan('okafor', tomorrowIso));
    await act(() => result.current.setPrefs({ start: 'home' }));
    await act(() => result.current.undo());
    expect(result.current.ws.plans[tomorrowIso] ?? []).toEqual([]);
    expect(result.current.start.id).toBe('home');
  });

  test('is written to the phone with the workspace', async () => {
    const storage = memoryStorage();
    const { result } = await renderStore(storage);
    await act(() => result.current.setPrefs({ appearance: 'dark' }));
    await waitFor(() => expect(JSON.parse(storage.items.get(WORKSPACE_KEY) ?? '{}').prefs).toEqual({ ...DEFAULT_PREFS, appearance: 'dark' }));
  });
});
