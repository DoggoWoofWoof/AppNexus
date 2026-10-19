// Add note and New follow-up: the rules ported from the prototype's saveNote and
// saveFollowUp (demo/js/actions.js), and the store actions the profiles call.

import { describe, expect, test } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { addDays, isoDate, startOfDay } from '@/lib/format';
import { DEFAULT_FILTERS } from '@/lib/search';
import { useWorkspace, WorkspaceProvider } from '@/lib/store';
import { followUpError, noteError, type FollowUpDraft, type NoteDraft } from '@/lib/workspace';

const today = startOfDay(new Date(2026, 9, 19));
const todayIso = isoDate(today);
const day = (offset: number) => isoDate(addDays(today, offset));

const note = (patch: Partial<NoteDraft> = {}): NoteDraft => ({
  targetId: 'maya',
  type: 'In-person visit',
  outcome: 'Met',
  date: todayIso,
  note: '  Agreed to review the peer report next week.  ',
  ...patch,
});
const followUp = (patch: Partial<FollowUpDraft> = {}): FollowUpDraft => ({ targetId: 'jordan', text: 'Send the AF pathway deck', due: day(3), ...patch });

async function renderStore() {
  const wrapper = ({ children }: { children: ReactNode }) => <WorkspaceProvider today={today}>{children}</WorkspaceProvider>;
  const { result } = await renderHook(() => useWorkspace(), { wrapper });
  return result;
}

describe('note and follow-up rules', () => {
  test('a note needs a known target, a day that has happened and, if asked for, a follow-up with text', () => {
    expect(noteError(note(), todayIso)).toBeNull();
    expect(noteError(note({ date: day(-30) }), todayIso)).toBeNull();
    expect(noteError(note({ note: '' }), todayIso)).toBeNull();
    expect(noteError(note({ targetId: 'nobody' }), todayIso)?.field).toBe('targetId');
    expect(noteError(note({ date: day(1) }), todayIso)?.field).toBe('date');
    expect(noteError(note({ date: '2026-02-31' }), todayIso)?.field).toBe('date');
    expect(noteError(note({ followUp: { text: '   ', due: day(7) } }), todayIso)?.field).toBe('followText');
    expect(noteError(note({ followUp: { text: 'Call back', due: '' } }), todayIso)?.field).toBe('followDue');
  });

  test('a follow-up needs a known target, some text and a due day', () => {
    expect(followUpError(followUp())).toBeNull();
    expect(followUpError(followUp({ targetId: '' }))?.field).toBe('targetId');
    expect(followUpError(followUp({ text: ' ' }))?.field).toBe('text');
    expect(followUpError(followUp({ due: 'soon' }))?.field).toBe('due');
  });
});

describe('addNote', () => {
  test('logs the note on the profile, newest first, and marks the workspace as changed', async () => {
    const store = await renderStore();
    const before = store.current.interactionsFor('maya').length;
    expect(store.current.ws.pristine).toBe(true);

    let error: unknown;
    await act(() => {
      error = store.current.addNote(note());
    });

    expect(error).toBeNull();
    const notes = store.current.interactionsFor('maya');
    expect(notes).toHaveLength(before + 1);
    expect(notes[0]).toMatchObject({
      targetId: 'maya',
      attendees: ['maya'],
      date: todayIso,
      type: 'In-person visit',
      outcome: 'Met',
      author: 'You',
      note: 'Agreed to review the peer report next week.',
      local: true,
    });
    expect(store.current.lastInteraction('maya')?.id).toBe(notes[0].id);
    expect(store.current.ws.pristine).toBe(false);
  });

  test('shows in the Activity journal, after earlier notes from the same day', async () => {
    const store = await renderStore();
    await act(() => {
      store.current.addNote(note({ note: 'First' }));
    });
    await act(() => {
      store.current.addNote(note({ note: 'Second' }));
    });
    expect(store.current.interactionsFor('maya').slice(0, 2).map((i) => i.note)).toEqual(['Second', 'First']);
  });

  test('can create a follow-up linked to the note', async () => {
    const store = await renderStore();
    await act(() => {
      store.current.addNote(note({ followUp: { text: ' Bring the one-pager ', due: day(7) } }));
    });
    const [latest] = store.current.interactionsFor('maya');
    const created = store.current.followUpsFor('maya').find((f) => f.interactionId === latest.id);
    expect(created).toMatchObject({ targetId: 'maya', text: 'Bring the one-pager', due: day(7), done: false, local: true });
    expect(store.current.openFollowUps().some((f) => f.id === created?.id)).toBe(true);
  });

  test('a note about an account lists the people met rather than HCP attendees', async () => {
    const store = await renderStore();
    await act(() => {
      store.current.addNote(note({ targetId: 'msw', type: 'Meeting', contacts: ['Dana Ortiz'] }));
    });
    expect(store.current.interactionsFor('msw')[0]).toMatchObject({ targetId: 'msw', attendees: [], contacts: ['Dana Ortiz'], type: 'Meeting' });
  });

  test('returns the problem and saves nothing when the note is invalid', async () => {
    const store = await renderStore();
    const ws = store.current.ws;
    let error: unknown;
    await act(() => {
      error = store.current.addNote(note({ followUp: { text: '', due: day(7) } }));
    });
    expect(error).toMatchObject({ field: 'followText' });
    expect(store.current.ws).toBe(ws);
  });
});

describe('addFollowUp', () => {
  test('adds an open follow-up to the profile and the Activity list', async () => {
    const store = await renderStore();
    let error: unknown;
    await act(() => {
      error = store.current.addFollowUp(followUp({ text: '  Send the AF pathway deck ' }));
    });
    expect(error).toBeNull();
    const created = store.current.followUpsFor('jordan').find((f) => f.text === 'Send the AF pathway deck');
    expect(created).toMatchObject({ targetId: 'jordan', due: day(3), done: false, local: true });
    expect(created?.interactionId).toBeUndefined();
    const open = store.current.openFollowUps();
    expect(open.find((f) => f.id === created?.id)?.overdueBy).toBe(-3);
    expect(open.map((f) => f.due)).toEqual([...open.map((f) => f.due)].sort());
    expect(store.current.ws.pristine).toBe(false);
  });

  test('one due today raises the follow-up signal', async () => {
    const store = await renderStore();
    const jordan = () => store.current.search({ ...DEFAULT_FILTERS, query: 'jordan' })[0];
    expect(jordan().signals.map((s) => s.id)).not.toContain('followup');
    await act(() => {
      store.current.addFollowUp(followUp({ due: todayIso }));
    });
    expect(jordan().signals.map((s) => s.id)).toContain('followup');
  });

  test('returns the problem and saves nothing when the follow-up is invalid', async () => {
    const store = await renderStore();
    const ws = store.current.ws;
    let error: unknown;
    await act(() => {
      error = store.current.addFollowUp(followUp({ text: '' }));
    });
    expect(error).toMatchObject({ field: 'text' });
    expect(store.current.ws).toBe(ws);
  });
});
