// Someone in on a day they don't usually see people. Dr. Elena Rossi works every
// weekday but sees people on Fridays only, 13:00–16:00. On a Thursday a visit in
// person with Dr. Rossi is outside their usual times whatever the time: the plan
// says so, Today says when they do with a better day, and Targets says it instead
// of "In today". Dr. Priya Raman, who sees people on Thursdays, is only outside
// them at the wrong time, and a call, or someone going by office hours, isn't held
// to a day. The sample day is Thursday 22 October 2026.

import { describe, expect, test } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { inOnDay, usualDay } from '@/lib/booking';
import { getEntity } from '@/lib/data';
import { addDays, isoDate, startOfDay } from '@/lib/format';
import { useWorkspace, WorkspaceProvider } from '@/lib/store';
import type { Entity, Hcp } from '@/lib/types';
import { addToPlan, buildContext, freshWorkspace } from '@/lib/workspace';

const today = startOfDay(new Date(2026, 9, 22));
const todayIso = isoDate(today);
const fridayIso = isoDate(addDays(today, 1));
const at = (h: number, m: number) => new Date(2026, 9, 22, h, m);
const entity = (id: string) => getEntity(id) as Entity;
const notFriday = 'Not their usual time · usually Fri 13:00–16:00';

async function renderStore(clock = at(8, 0)) {
  // Eight in the morning unless said, before any of the day's visits.
  const wrapper = ({ children }: { children: ReactNode }) => (
    <WorkspaceProvider today={today} now={() => clock}>
      {children}
    </WorkspaceProvider>
  );
  const { result } = await renderHook(() => useWorkspace(), { wrapper });
  return result;
}

describe('a day they’re in but don’t usually see people', () => {
  test('Targets says when they do, instead of “In today”', () => {
    expect(inOnDay(entity('elena'), todayIso)).toEqual({ ok: true, hours: '', outside: notFriday });
    expect(inOnDay(entity('elena'), fridayIso)).toEqual({ ok: true, hours: '13:00–16:00', outside: null });
    // Dr. Raman sees people on Thursdays.
    expect(inOnDay(entity('priya'), todayIso)).toEqual({ ok: true, hours: '12:30–13:30', outside: null });
  });

  test('an “Any time” stop goes outside their usual times, and the add, Today and Targets say so', async () => {
    const store = await renderStore(at(15, 30));
    await act(() => store.current.addToPlan('elena'));
    const item = store.current.planItemFor('elena', todayIso)!;
    const stop = store.current.daySchedule(todayIso, at(15, 30)).stops.find((s) => s.item.id === item.id)!;
    expect(stop.outside).toBe(true);
    expect(store.current.notice?.message).toMatch(/^Dr\. Elena Rossi added today.* · not their usual time$/);
    expect(store.current.timeWarning(item, todayIso, stop.outside)).toBe(`${notFriday} · try tomorrow`);
    // Targets, which doesn't pass the day's own word, says the same once they're planned.
    expect(store.current.timeWarning(item, todayIso, false)).toBe(`${notFriday} · try tomorrow`);
    // Change visit moves them to the same day.
    expect(store.current.moveDayFor(item, todayIso)).toBe(fridayIso);
  });

  test('a time set for Dr. Rossi is wrong too, even one that would suit them on a Friday', async () => {
    const store = await renderStore();
    await act(() => store.current.addToPlan('elena'));
    const id = store.current.planItemFor('elena', todayIso)!.id;
    await act(() => {
      store.current.setStopTime(todayIso, id, '15:00');
    });
    const item = store.current.planItemFor('elena', todayIso)!;
    expect(item).toMatchObject({ mode: 'timed', time: '15:00' });
    expect(store.current.timeWarning(item, todayIso, false)).toBe(`${notFriday} · try tomorrow`);
  });

  test('a better day is one of their usual days, not just the next day they’re in', () => {
    // From a Monday, Tuesday to Thursday would be no better for Dr. Rossi.
    const monday = startOfDay(new Date(2026, 9, 26));
    const mondayIso = isoDate(monday);
    const ctx = buildContext(addToPlan(freshWorkspace(monday), mondayIso, 'elena'), monday);
    const item = ctx.planItemFor('elena', mondayIso)!;
    expect(ctx.timeWarning(item, mondayIso, true)).toBe(`${notFriday} · try Friday`);
    expect(ctx.moveDayFor(item, mondayIso)).toBe(isoDate(addDays(monday, 4)));
    // Dr. Watanabe sees people on Monday mornings only.
    const kenji = buildContext(addToPlan(freshWorkspace(today), todayIso, 'kenji'), today);
    expect(kenji.timeWarning(kenji.planItemFor('kenji', todayIso)!, todayIso, true)).toBe('Not their usual time · usually Mon 08:00–11:00 · try Monday');
  });

  test('a call isn’t held to a day, as calls can be made on days they aren’t in', async () => {
    const store = await renderStore(at(15, 30));
    await act(() => store.current.addToPlan('elena', todayIso, 'Phone call'));
    const item = store.current.planItemFor('elena', todayIso)!;
    const stop = store.current.daySchedule(todayIso, at(15, 30)).stops.find((s) => s.item.id === item.id)!;
    expect(stop.outside).toBe(false);
    expect(store.current.timeWarning(item, todayIso, stop.outside)).toBeNull();
  });

  test('someone without usual times of their own isn’t held to a day', () => {
    // Dr. Hannah Cohen goes by office hours. If they were in on Saturdays too, any time then would do.
    const hannah = entity('hannah') as Hcp;
    const saturdays = { ...hannah, affiliations: hannah.affiliations.map((a) => ({ ...a, days: 'Mon–Sat' })) };
    expect(inOnDay(saturdays, isoDate(addDays(today, 2)))).toEqual({ ok: true, hours: '', outside: null });
    // Nor is anyone whose usual times name no days.
    const elena = entity('elena') as Hcp;
    const vague = { ...elena, contact: { ...elena.contact, windows: [{ days: 'By appointment', from: '09:00', to: '17:00' }] } };
    expect(usualDay(vague, 4)).toBe(true);
    expect(inOnDay(vague, todayIso)).toEqual({ ok: true, hours: '', outside: null });
  });
});

describe('a day they do see people', () => {
  test('Dr. Raman is outside their usual times only at the wrong time', async () => {
    // Too late for their 12:30–13:30, so the stop goes after it. The day itself is fine, so Targets says nothing.
    const late = await renderStore(at(15, 30));
    await act(() => late.current.addToPlan('priya'));
    const anyTime = late.current.planItemFor('priya', todayIso)!;
    const stop = late.current.daySchedule(todayIso, at(15, 30)).stops.find((s) => s.item.id === anyTime.id)!;
    expect(stop.outside).toBe(true);
    expect(late.current.timeWarning(anyTime, todayIso, stop.outside)).toBe('Not their usual time · usually 12:30–13:30');
    expect(late.current.timeWarning(anyTime, todayIso, false)).toBeNull();

    // In the morning Dr. Raman goes in their usual times, and a time set outside them says so.
    const store = await renderStore();
    await act(() => store.current.addToPlan('priya'));
    const item = store.current.planItemFor('priya', todayIso)!;
    expect(store.current.daySchedule(todayIso, at(8, 0)).stops.find((s) => s.item.id === item.id)?.outside).toBe(false);
    expect(store.current.timeWarning(item, todayIso, false)).toBeNull();
    await act(() => {
      store.current.setStopTime(todayIso, item.id, '15:00');
    });
    expect(store.current.timeWarning(store.current.planItemFor('priya', todayIso)!, todayIso, false)).toBe('Not their usual time · usually 12:30–13:30');
  });
});
