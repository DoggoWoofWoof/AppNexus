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
import { bookVisit, buildContext, cancelVisit, sampleWorkspace } from '@/lib/workspace';

// A Monday: the sample week runs from the Tuesday before.
const today = startOfDay(new Date(2026, 9, 19));
const todayIso = isoDate(today);
const ws = sampleWorkspace(today);
const ctx = buildContext(ws, today);
const week = (w = ws) => answer('Summarise my week', buildContext(w, today));
const fact = (a: ReturnType<typeof week>, title: string) => a.rows.find((r) => r.title === title);

describe('summarise my week', () => {
  test('understands plain ways of asking, and leaves other "this week" questions alone', () => {
    for (const q of ['Summarise my week', 'Summarize my week', 'my week', 'How was my week?', 'What did I do this week?', 'Weekly report', 'Week summary', 'Give me a recap of the week', 'Update for my manager', 'Read my report for this week']) {
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

  test('counts the sample week: visits logged of those due so far, what changed, notes, follow-ups and accounts', () => {
    const a = week();
    expect(a).toMatchObject({ intent: 'week', subject: null, about: null, facts: true, title: 'Your week to 19 Oct' });
    // Today's three are still to come, and a cancelled visit wasn't due.
    expect(a.summary).toBe('Your week: 2 of 3 visits logged, 3 more today. 2 notes logged, 1 follow-up late.');
    expect(a.rows.map((r) => r.title)).toEqual([
      'Visits logged',
      'Cancelled, moved or not logged',
      'Notes logged',
      'Follow-ups open',
      'Accounts covered',
      'Next week: Mount Sinai Morningside',
      'Next week: Dr. Rossi',
      'Next week: Dr. Raman',
    ]);
    // A visit that was moved and then done says so where it's counted, not as a change.
    expect(fact(a, 'Visits logged')).toMatchObject({ figure: '2 of 3', sub: 'Dr. Okafor (Thu, moved from Wed) and Mount Sinai Hospital (Fri)' });
    expect(fact(a, 'Cancelled, moved or not logged')).toMatchObject({ figure: '2', sub: 'Dr. Rossi: visit cancelled (Fri) · Dr. Raman not logged (Wed)', tone: 'warn' });
    // A teammate's note isn't the rep's own.
    expect(fact(a, 'Notes logged')).toMatchObject({ figure: '2', sub: 'Dr. Okafor and Mount Sinai Hospital' });
    expect(fact(a, 'Follow-ups open')).toMatchObject({ figure: '4, 1 late', sub: '“Call about ablation referrals leaving the system” for Dr. Morgan, 2 days late', tone: 'warn' });
    expect(fact(a, 'Accounts covered')).toMatchObject({ figure: '1', sub: 'Mount Sinai Hospital' });
    // Notes and the plan are sample data, not the figures' months.
    expect(a.scope).toEqual(['13 to 19 Oct', 'Your plan and notes', SAMPLE]);
  });

  test('suggests two or three for next week, one row each, with the app’s own reasons and when they’re usually free', () => {
    const a = week();
    const picks = a.rows.filter((r) => r.title.startsWith('Next week: '));
    expect(picks.length).toBeGreaterThanOrEqual(2);
    expect(picks.length).toBeLessThanOrEqual(3);
    for (const pick of picks) {
      expect(pick.id).toBeTruthy();
      expect(pick.sub).toMatch(/^(Patients going elsewhere|Busier than last year|No visit in 30\+ days|No contact yet).* · (Usually|Office hours) /);
    }
    // Anyone seen this week or already planned is left out.
    for (const seenOrPlanned of ['Dr. Okafor', 'Dr. Patel', 'Dr. Lee', 'Dr. Morgan', 'Mount Sinai Hospital']) expect(picks.map((p) => p.title)).not.toContain(`Next week: ${seenOrPlanned}`);
    expect(picks[0]).toMatchObject({ id: 'msm', sub: 'Patients going elsewhere and no contact yet · Office hours weekdays 09:00–17:00' });
    expect(a.doThis).toMatchObject({ label: 'Open Mount Sinai Morningside', link: { kind: 'profile', id: 'msm' } });
    expect(a.doThis?.text).toBe('Next week, start with Mount Sinai Morningside: patients going elsewhere and no contact yet.');
  });

  test('picks up today’s changes: a cancelled visit, and one moved out to another day', () => {
    const tomorrow = isoDate(addDays(today, 1));
    let next = cancelVisit(ws, todayIso, 'v-maya', 'Can’t make it', todayIso);
    next = bookVisit(next, { targetId: 'jordan', slot: { day: tomorrow, time: '09:00', siteId: 'msm' }, confirmed: true, from: { day: todayIso, id: 'v-jordan' } });
    expect(next.plans[tomorrow].find((i) => i.targetId === 'jordan')?.movedFrom).toEqual({ day: todayIso, time: '14:00' });
    const a = week(next);
    expect(a.summary).toBe('Your week: 2 of 3 visits logged, 1 more today. 2 notes logged, 1 follow-up late.');
    expect(fact(a, 'Cancelled, moved or not logged')).toMatchObject({
      figure: '4',
      sub: 'Dr. Rossi: visit cancelled (Fri) · Dr. Patel: visit cancelled (Mon) · Dr. Lee moved from Mon to Tue 20 Oct · Dr. Raman not logged (Wed)',
    });
  });

  test('a visit logged as not in counts as logged, and says so', () => {
    const notIn = { ...ws, plans: { ...ws.plans, '2026-10-16': ws.plans['2026-10-16'].map((i) => (i.id === 'v-msh-past' ? { ...i, outcome: 'Attempted' } : i)) } };
    const a = week(notIn);
    expect(a.summary).toBe('Your week: 2 of 3 visits logged (1 not in), 3 more today. 2 notes logged, 1 follow-up late.');
  });

  test('is about the rep’s week even in a person’s own chat', () => {
    const a = answer('Summarise my week', ctx, { about: 'maya', scoped: true });
    expect(a).toMatchObject({ intent: 'week', subject: null, title: 'Your week to 19 Oct' });
  });
});

describe('the week as a saved report', () => {
  test('saves from Ask, shows in Saved, and copies with when it was made and "For internal use"', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <WorkspaceProvider today={today} initial={sampleWorkspace(today)}>
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
    expect(doc.sections[0].lines.map((l) => l.label).slice(0, 6)).toEqual([
      'Visits logged',
      'Cancelled, moved or not logged',
      'Notes logged',
      'Follow-ups open',
      'Accounts covered',
      'Next week: Mount Sinai Morningside',
    ]);
    const lines = docText(doc, new Date(2026, 9, 19, 17, 30)).split('\n');
    expect(lines.slice(0, 5)).toEqual(['Your week to 19 Oct', 'Saved today', '', 'Asked: Summarise my week', report.summary]);
    expect(lines).toContain('- Visits logged: Dr. Okafor (Thu, moved from Wed) and Mount Sinai Hospital (Fri) (2 of 3)');

    expect(lines.slice(-2)).toEqual(['13 to 19 Oct · Your plan and notes · Sample data', 'From Field Pro, 19 Oct 2026, 17:30. For internal use: check it before it goes outside the company.']);
  });
});
