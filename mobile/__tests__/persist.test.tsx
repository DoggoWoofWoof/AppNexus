// Keeping the rep's work on the phone: the workspace and half-written notes
// survive a reload, and a workspace kept from an earlier day is carried into today.

import { describe, expect, test } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { addDays, isoDate, startOfDay } from '@/lib/format';
import { draftKey, restoreDrafts, restoreWorkspace, WORKSPACE_KEY, type DeviceStorage, type LogDraft } from '@/lib/persist';
import { useWorkspace, WorkspaceProvider } from '@/lib/store';
import { cancelVisit, findItem, freshWorkspace, noteRecords, visitDone, withRecords } from '@/lib/workspace';

const today = startOfDay(new Date(2026, 9, 19));
const todayIso = isoDate(today);
const yesterday = addDays(today, -1);
const yesterdayIso = isoDate(yesterday);

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

// The planner tests' wrapper, eight in the morning, with somewhere to keep things.
async function renderStore(storage: DeviceStorage) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <WorkspaceProvider today={today} now={() => new Date(2026, 9, 19, 8, 0)} storage={storage}>
      {children}
    </WorkspaceProvider>
  );
  const view = await renderHook(() => useWorkspace(), { wrapper });
  // Nothing renders until what was kept has loaded.
  await waitFor(() => expect(view.result.current).toBeTruthy());
  return view;
}

const draft = (patch: Partial<LogDraft> = {}): LogDraft => ({
  targetId: 'maya',
  visit: { day: todayIso, id: 'v-maya' },
  outcome: 'Met',
  note: 'She wants the peer report by Fri',
  there: [],
  ...patch,
});

describe('after a reload', () => {
  test('a logged visit and its note are still there', async () => {
    const storage = memoryStorage();
    const first = await renderStore(storage);
    await act(() => {
      first.result.current.addNote({ targetId: 'maya', type: 'In-person visit', outcome: 'Met', date: todayIso, note: 'Agreed next steps', visit: { day: todayIso, id: 'v-maya' } });
    });
    expect(first.result.current.notice?.message).toBe('Visit logged · saved on this phone');
    // Closing writes what hasn't been written yet.
    await first.unmount();

    const { result } = await renderStore(storage);
    expect(findItem(result.current.ws, todayIso, 'v-maya')?.status).toBe('done');
    expect(result.current.interactionsFor('maya')[0]).toMatchObject({ note: 'Agreed next steps', local: true });
  });

  test('a change is written a moment later without waiting for the app to close', async () => {
    const storage = memoryStorage();
    const { result } = await renderStore(storage);
    await act(() => result.current.completeFollowUp('f-alex-1'));
    await waitFor(() => {
      const kept = JSON.parse(storage.items.get(WORKSPACE_KEY) ?? '{}');
      expect(kept.followUps?.find((f: { id: string }) => f.id === 'f-alex-1')?.done).toBe(true);
    });
  });

  test('a half-written note comes back for the same person and visit only', async () => {
    const storage = memoryStorage();
    const first = await renderStore(storage);
    const key = draftKey('maya', { day: todayIso, id: 'v-maya' });
    await act(() => first.result.current.keepDraft(key, draft()));
    await first.unmount();

    const second = await renderStore(storage);
    expect(second.result.current.draftFor(key)).toEqual(draft());
    expect(second.result.current.draftFor(draftKey('maya'))).toBeNull();
    expect(second.result.current.draftFor(draftKey('jordan', { day: todayIso, id: 'v-jordan' }))).toBeNull();

    // Once saved it's let go.
    await act(() => second.result.current.keepDraft(key, null));
    await second.unmount();
    const third = await renderStore(storage);
    expect(third.result.current.draftFor(key)).toBeNull();
  });

  test('storage that can’t be read is left alone, and the rep is told', async () => {
    const items = new Map([[WORKSPACE_KEY, 'kept from before']]);
    const storage = { ...memoryStorage(items), getItem: () => Promise.reject(new Error('locked')) };
    const view = await renderStore(storage);
    expect(view.result.current.notice?.message).toMatch(/^Couldn’t open what’s saved on this phone/);
    await act(() => {
      view.result.current.addNote({ targetId: 'maya', type: 'Phone call', outcome: 'Met', date: todayIso, note: '' });
    });
    expect(view.result.current.notice?.message).toBe('Note saved');
    await view.unmount();
    expect(items.get(WORKSPACE_KEY)).toBe('kept from before');
  });
});

describe('a workspace kept from an earlier day', () => {
  test('is seeded again for today if the rep never changed it', () => {
    const ws = restoreWorkspace(JSON.stringify(freshWorkspace(yesterday)), today);
    expect(ws).toEqual(freshWorkspace(today));
    expect(findItem(ws, todayIso, 'v-maya')?.status).toBe('planned');
  });

  test('keeps the rep’s own work, and moves the selected day and any free slot on to today', () => {
    const { interaction } = noteRecords({ targetId: 'jordan', type: 'Phone call', outcome: 'Met', date: yesterdayIso, note: 'Call back Monday' });
    const before = withRecords(cancelVisit(freshWorkspace(yesterday), yesterdayIso, 'v-maya', 'HCP unavailable', yesterdayIso), { interactions: [interaction] });
    expect(before.freeSlots.map((s) => s.day)).toEqual([yesterdayIso]);
    expect(before.selection).toMatchObject({ day: yesterdayIso, slot: 'v-maya' });

    const ws = restoreWorkspace(JSON.stringify(before), today);
    expect(ws.interactions[0]).toMatchObject({ note: 'Call back Monday', local: true });
    expect(findItem(ws, yesterdayIso, 'v-maya')).toMatchObject({ status: 'cancelled', cancelReason: 'HCP unavailable' });
    expect(ws.pristine).toBe(false);
    expect(ws.seededOn).toBe(yesterdayIso);
    expect(ws.selection).toEqual({ day: todayIso, ids: [] });
    expect(ws.freeSlots).toEqual([]);

    // Today stays selected, but not a slot that has gone.
    const onToday = restoreWorkspace(JSON.stringify({ ...before, selection: { day: todayIso, ids: [], slot: 'v-maya' } }), today);
    expect(onToday.selection).toEqual({ day: todayIso, ids: [] });
  });

  test('a free slot or selected day still to come is left as it was', () => {
    const before = cancelVisit(freshWorkspace(today), todayIso, 'v-maya', 'Other', todayIso);
    const ws = restoreWorkspace(JSON.stringify(before), today);
    expect(ws.freeSlots).toEqual(before.freeSlots);
    expect(ws.selection).toEqual(before.selection);
  });
});

describe('what can’t be used starts from the sample', () => {
  test('nothing kept, unreadable or another version', () => {
    const fresh = freshWorkspace(today);
    expect(restoreWorkspace(null, today)).toEqual(fresh);
    expect(restoreWorkspace('{"version":', today)).toEqual(fresh);
    expect(restoreWorkspace('[]', today)).toEqual(fresh);
    expect(restoreWorkspace(JSON.stringify({ ...withRecords(fresh, {}), version: 1 }), today)).toEqual(fresh);
  });

  test('anything added to the workspace since it was kept starts empty', () => {
    const { saved: _saved, ...older } = withRecords(freshWorkspace(today), {});
    expect(restoreWorkspace(JSON.stringify(older), today).saved).toEqual([]);
  });

  test('a draft for a visit that has since been logged or dropped is let go', () => {
    const drafts = {
      [draftKey('maya', { day: todayIso, id: 'v-maya' })]: draft(),
      [draftKey('jordan', { day: todayIso, id: 'v-gone' })]: draft({ targetId: 'jordan', visit: { day: todayIso, id: 'v-gone' } }),
      [draftKey('alex')]: draft({ targetId: 'alex', visit: undefined }),
    };
    const ws = freshWorkspace(today);
    expect(Object.keys(restoreDrafts(JSON.stringify(drafts), ws))).toEqual([draftKey('maya', { day: todayIso, id: 'v-maya' }), 'alex']);
    expect(Object.keys(restoreDrafts(JSON.stringify(drafts), visitDone(ws, todayIso, 'v-maya')))).toEqual(['alex']);
    expect(restoreDrafts('not json', ws)).toEqual({});
  });
});
