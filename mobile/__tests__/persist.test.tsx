// Keeping the rep's work on the phone: the workspace and half-written notes
// survive a reload, and a workspace kept from an earlier day is carried into today.

import { describe, expect, test } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { addDays, isoDate, startOfDay } from '@/lib/format';
import { BACKUP_KEY, draftKey, laterWriter, restoreDrafts, restoreWorkspace, WORKSPACE_KEY, type DeviceStorage, type LogDraft } from '@/lib/persist';
import { useWorkspace, WorkspaceProvider } from '@/lib/store';
import { cancelVisit, findItem, freshWorkspace, noteRecords, sampleWorkspace, visitDone, withRecords } from '@/lib/workspace';

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

/** Somewhere that kept the sample with today planned: Dr. Patel, Dr. Lee and a call to Dr. Morgan. */
const keptDay = () => memoryStorage(new Map([[WORKSPACE_KEY, JSON.stringify(sampleWorkspace(today))]]));

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
    const storage = keptDay();
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
    const storage = keptDay();
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

  test('what an older version kept is put aside before the sample starts again, and the rep is told', async () => {
    const older = JSON.stringify({ ...withRecords(freshWorkspace(today), {}), version: 1 });
    const items = new Map([[WORKSPACE_KEY, older]]);
    const view = await renderStore(memoryStorage(items));
    expect(view.result.current.notice?.message).toMatch(/from an older version, so the sample started again\. A copy is kept on the phone\.$/);
    expect(items.get(BACKUP_KEY)).toBe(older);
    expect(view.result.current.ws.pristine).toBe(true);
  });

  test('nothing kept is no news: no notice and no copy', async () => {
    const items = new Map<string, string>();
    const view = await renderStore(memoryStorage(items));
    expect(view.result.current.notice).toBeNull();
    expect(items.has(BACKUP_KEY)).toBe(false);
  });

  test('an untouched sample from an older version starts again with nothing planned, and no notice or copy', async () => {
    const items = new Map([[WORKSPACE_KEY, JSON.stringify({ ...sampleWorkspace(today), version: 2 })]]);
    const view = await renderStore(memoryStorage(items));
    expect(view.result.current.notice).toBeNull();
    expect(items.has(BACKUP_KEY)).toBe(false);
    expect(view.result.current.ws.plans[todayIso]).toBeUndefined();
  });
});

describe('writing to the phone', () => {
  test('a write that fails is tried again with the next flush, unless something newer is waiting', async () => {
    const items = new Map<string, string>();
    let fail = true;
    const storage = {
      getItem: async (key: string) => items.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        if (fail) throw new Error('full');
        items.set(key, value);
      },
    };
    let errors = 0;
    const writer = laterWriter(storage, 'k', 1000, () => errors++);
    writer.write({ n: 1 });
    writer.flush();
    await waitFor(() => expect(errors).toBe(1));
    expect(items.has('k')).toBe(false);
    fail = false;
    writer.flush();
    await waitFor(() => expect(items.get('k')).toBe('{"n":1}'));

    fail = true;
    writer.write({ n: 2 });
    writer.flush();
    writer.write({ n: 3 });
    await waitFor(() => expect(errors).toBe(2));
    fail = false;
    writer.flush();
    await waitFor(() => expect(items.get('k')).toBe('{"n":3}'));
  });
});

describe('a workspace kept from an earlier day', () => {
  test('is seeded again for today if the rep never changed it, with nothing planned', () => {
    const ws = restoreWorkspace(JSON.stringify(freshWorkspace(yesterday)), today);
    expect(ws).toEqual(freshWorkspace(today));
    expect(ws.plans[todayIso]).toBeUndefined();
  });

  test('keeps the rep’s own work, and moves the selected day and any free slot on to today', () => {
    const { interaction } = noteRecords({ targetId: 'jordan', type: 'Phone call', outcome: 'Met', date: yesterdayIso, note: 'Call back Monday' });
    const before = withRecords(cancelVisit(sampleWorkspace(yesterday), yesterdayIso, 'v-maya', 'HCP unavailable', yesterdayIso), { interactions: [interaction] });
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
    const before = cancelVisit(sampleWorkspace(today), todayIso, 'v-maya', 'Other', todayIso);
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

  test('a draft for a visit since logged is let go; one for a visit moved or dropped stays with the person', () => {
    const mayaKey = draftKey('maya', { day: todayIso, id: 'v-maya' });
    const drafts = {
      [mayaKey]: draft(),
      [draftKey('jordan', { day: todayIso, id: 'v-gone' })]: draft({ targetId: 'jordan', visit: { day: todayIso, id: 'v-gone' } }),
      [draftKey('alex')]: draft({ targetId: 'alex', visit: undefined }),
    };
    const ws = sampleWorkspace(today);
    const kept = restoreDrafts(JSON.stringify(drafts), ws);
    expect(Object.keys(kept)).toEqual(['alex', mayaKey, 'jordan']);
    expect(kept.jordan).toEqual({ targetId: 'jordan', outcome: 'Met', note: 'She wants the peer report by Fri', there: [] });
    expect(Object.keys(restoreDrafts(JSON.stringify(drafts), visitDone(ws, todayIso, 'v-maya')))).toEqual(['alex', 'jordan']);
    // Cancelled: the words stay, as a draft for the person.
    expect(restoreDrafts(JSON.stringify(drafts), cancelVisit(ws, todayIso, 'v-maya', 'Clinic ran late', todayIso)).maya?.note).toBe('She wants the peer report by Fri');
    expect(restoreDrafts('not json', ws)).toEqual({});
  });

  test('a person’s own draft isn’t written over by one from a visit that went', () => {
    const drafts = {
      [draftKey('jordan')]: draft({ targetId: 'jordan', visit: undefined, note: 'Their own' }),
      [draftKey('jordan', { day: todayIso, id: 'v-gone' })]: draft({ targetId: 'jordan', visit: { day: todayIso, id: 'v-gone' }, note: 'From the visit' }),
    };
    expect(restoreDrafts(JSON.stringify(drafts), freshWorkspace(today)).jordan?.note).toBe('Their own');
  });
});
