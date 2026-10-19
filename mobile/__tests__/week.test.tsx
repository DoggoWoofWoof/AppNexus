// "Summarise my week": the report a rep sends their manager, worked out from the
// sample plan and notes, and kept in Saved like any other answer.

import { describe, expect, test } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { answer, detectIntent, SAMPLE, startersFor } from '@/lib/ask';
import { ChatProvider, TERRITORY, useChat } from '@/lib/chat';
import { addDays, isoDate, startOfDay } from '@/lib/format';
import { docText, reportDoc } from '@/lib/saved';
import { useWorkspace, WorkspaceProvider } from '@/lib/store';
import { bookVisit, buildContext, cancelVisit, freshWorkspace } from '@/lib/workspace';

// A Monday: the sample week runs from the Tuesday before.
const today = startOfDay(new Date(2026, 9, 19));
const todayIso = isoDate(today);
const ws = freshWorkspace(today);
const ctx = buildContext(ws, today);
const week = (w = ws) => answer('Summarise my week', buildContext(w, today));
const fact = (a: ReturnType<typeof week>, title: string) => a.rows.find((r) => r.title === title);

describe('summarise my week', () => {
  test('understands plain ways of asking, and leaves other "this week" questions alone', () => {
    for (const q of ['Summarise my week', 'Summarize my week', 'my week', 'How was my week?', 'What did I do this week?', 'Weekly report', 'Week summary', 'Give me a recap of the week', 'Update for my manager']) {
      expect([q, detectIntent(q)]).toEqual([q, 'week']);
    }
    expect(detectIntent('What follow-ups are due this week?')).toBe('followups');
    expect(detectIntent('What did I save this week?')).toBe('saved');
    expect(detectIntent('What did we discuss last week?')).toBe('history');
  });

  test('is one of the four chips on Ask before the first question', () => {
    const chips = startersFor(ctx).map((g) => g.questions[0]);
    expect(chips).toHaveLength(4);
    expect(chips).toContain('Summarise my week');
  });

  test('counts the sample week: visits done against planned, what changed, notes, follow-ups and accounts', () => {
    const a = week();
    expect(a).toMatchObject({ intent: 'week', subject: null, about: null, facts: true, title: 'Your week to 19 Oct' });
    expect(a.summary).toBe('Your week: 2 of 7 planned visits done, 3 more today. 2 notes logged, 1 follow-up late.');
    expect(a.rows.map((r) => r.title)).toEqual(['Visits done', 'Cancelled, moved or not seen', 'Notes logged', 'Follow-ups open', 'Accounts covered', 'See next week']);
    expect(fact(a, 'Visits done')).toMatchObject({ figure: '2 of 7', sub: 'Dr. Okafor (Thu) and Mount Sinai Hospital (Fri)' });
    expect(fact(a, 'Cancelled, moved or not seen')).toMatchObject({ figure: '3', sub: 'Dr. Rossi cancelled (Fri) · Dr. Okafor moved from Wed to Thu · Dr. Raman not seen (Wed)' });
    // A teammate's note isn't the rep's own.
    expect(fact(a, 'Notes logged')).toMatchObject({ figure: '2', sub: 'Dr. Okafor and Mount Sinai Hospital' });
    expect(fact(a, 'Follow-ups open')).toMatchObject({ figure: '4, 1 late', sub: '“Call about ablation referrals leaving the system” for Dr. Morgan, 2 days late', tone: 'warn' });
    expect(fact(a, 'Accounts covered')).toMatchObject({ figure: '1', sub: 'Mount Sinai Hospital' });
    // Notes and the plan are sample data, not the figures' months.
    expect(a.scope).toEqual(['13 to 19 Oct', 'Your plan and notes', SAMPLE]);
  });

  test('suggests two or three for next week with the app’s own reasons, skipping anyone seen or already planned', () => {
    const a = week();
    const sub = fact(a, 'See next week')!.sub!;
    expect(sub).toMatch(/: (patients going elsewhere|busier than last year|no visit in 30\+ days|no contact yet)/);
    for (const seenOrPlanned of ['Dr. Okafor', 'Dr. Patel', 'Dr. Lee', 'Dr. Morgan']) expect(sub).not.toContain(seenOrPlanned);
    expect(sub.split(/, | and /).length).toBeGreaterThanOrEqual(2);
    expect(a.doThis).toMatchObject({ label: 'Open Dr. Raman', link: { kind: 'profile', id: 'priya' } });
    expect(a.doThis?.text).toBe('Next week, start with Dr. Raman: patients going elsewhere and busier than last year.');
  });

  test('picks up today’s changes: a cancelled visit, and one moved out to another day', () => {
    const tomorrow = isoDate(addDays(today, 1));
    let next = cancelVisit(ws, todayIso, 'v-maya', 'Can’t make it', todayIso);
    next = bookVisit(next, { targetId: 'jordan', slot: { day: tomorrow, time: '09:00', siteId: 'msm' }, confirmed: true, from: { day: todayIso, id: 'v-jordan' } });
    expect(next.plans[tomorrow].find((i) => i.targetId === 'jordan')?.movedFrom).toEqual({ day: todayIso, time: '14:00' });
    const a = week(next);
    expect(a.summary).toBe('Your week: 2 of 7 planned visits done, 1 more today. 2 notes logged, 1 follow-up late.');
    expect(fact(a, 'Cancelled, moved or not seen')?.sub).toBe(
      'Dr. Rossi cancelled (Fri) · Dr. Patel cancelled (Mon) · Dr. Okafor moved from Wed to Thu · Dr. Lee moved from Mon to Tue 20 Oct · Dr. Raman not seen (Wed)',
    );
  });

  test('is about the rep’s week even in a person’s own chat', () => {
    const a = answer('Summarise my week', ctx, { about: 'maya', scoped: true });
    expect(a).toMatchObject({ intent: 'week', subject: null, title: 'Your week to 19 Oct' });
  });
});

describe('the week as a saved report', () => {
  test('saves from Ask, shows in Saved, and copies with when it was made and "For internal use"', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <WorkspaceProvider today={today}>
        <ChatProvider>{children}</ChatProvider>
      </WorkspaceProvider>
    );
    const { result: r } = await renderHook(() => ({ ws: useWorkspace(), chat: useChat() }), { wrapper });
    let turnId = '';
    await act(async () => {
      turnId = (await r.current.chat.ask(TERRITORY, 'Summarise my week')).id;
    });
    // The Save button under the answer.
    await act(async () => r.current.chat.save(TERRITORY, turnId));
    const [report] = r.current.ws.ws.saved;
    expect(report).toMatchObject({ title: 'Your week to 19 Oct', question: 'Summarise my week', about: null, facts: true });

    const doc = reportDoc(report, today);
    expect(doc).toMatchObject({ kind: 'report', when: 'Saved today' });
    expect(doc.sections[0].lines.map((l) => l.label)).toEqual(['Visits done', 'Cancelled, moved or not seen', 'Notes logged', 'Follow-ups open', 'Accounts covered', 'See next week']);
    const lines = docText(doc, new Date(2026, 9, 19, 17, 30)).split('\n');
    expect(lines.slice(0, 5)).toEqual(['Your week to 19 Oct', 'Saved today', '', 'Asked: Summarise my week', report.summary]);
    expect(lines).toContain('- Visits done: Dr. Okafor (Thu) and Mount Sinai Hospital (Fri) (2 of 7)');
    expect(lines.slice(-2)).toEqual(['13 to 19 Oct · Your plan and notes · Sample data', 'From Field Pro, 19 Oct 2026, 17:30. For internal use: check it before it goes outside the company.']);
  });
});
