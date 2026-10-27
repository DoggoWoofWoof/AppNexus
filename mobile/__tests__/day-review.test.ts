// Today's review (lib/day-review.ts): the day's people in a paragraph, in the
// order they're seen, and the labels on their stops in the same colours, on
// Tuesday 27 October 2026 at 08:00.

import { describe, expect, test } from '@jest/globals';

import { dayReview, stopLabels } from '@/lib/day-review';
import { isoDate, startOfDay } from '@/lib/format';
import type { Workspace } from '@/lib/types';
import { addToPlan, buildContext, freshWorkspace, sampleWorkspace } from '@/lib/workspace';

const today = startOfDay(new Date(2026, 9, 27));
const now = new Date(2026, 9, 27, 8, 0);
const day = isoDate(today);

/** The review as text, with what stands out in brackets: "[name:Dr. Patel]". */
function review(ws: Workspace): string | null {
  const bits = dayReview(buildContext(ws, today, now), day, now);
  return bits?.map((b) => (b.tone ? `[${b.tone}:${b.text}]` : b.text)).join('') ?? null;
}
/** Each stop's labels by who, with the change after how much someone new does. */
function labels(ws: Workspace): Record<string, string[]> {
  const ctx = buildContext(ws, today, now);
  return Object.fromEntries(
    ctx.dayPlan(day, now).map((item) => [item.targetId, (stopLabels(ctx, day, now).get(item.id) ?? []).map((l) => `${l.tone}:${l.label}${l.change != null ? ` ${l.change}%` : ''}`)]),
  );
}

describe('the review', () => {
  test('nothing with nobody in the day', () => {
    expect(review(freshWorkspace(today))).toBeNull();
    expect(labels(freshWorkspace(today))).toEqual({});
  });

  test('one visit: who they are, as a sentence of its own', () => {
    const ws = addToPlan(freshWorkspace(today), day, 'adaeze-volkov', now);
    expect(review(ws)).toBe(
      'Today you have one visit, at about 09:00. [name:Dr. Volkov] is an interventional cardiologist at Pierhaven Medical Center who is new to you, [rose:uses Competitor B] and does about 650 procedures a year, [success:up 15%].',
    );
    expect(labels(ws)).toEqual({ 'adaeze-volkov': ['rose:Uses Competitor B', 'neutral:650 a year 15%'] });
  });

  test('the three from the brief: the specialty they share said once, then each in the order they’re seen', () => {
    const ws = ['adaeze-volkov', 'callum-adeleke', 'gabriela-kowalski'].reduce((w, id) => addToPlan(w, day, id, now), freshWorkspace(today));
    expect(review(ws)).toBe(
      'Today you’re seeing three interventionalists, all in person and all new to you. ' +
        'You start at about 09:00 with [name:Dr. Adeleke] at Wrenfield Cardiology Group, who [rose:uses Competitor B] and does about 620 procedures a year, [success:up 10%]. ' +
        'Next is [name:Dr. Kowalski] at Orchard Row Cardiology, the busiest of the three, who does about 870 procedures a year, [success:up 21%]. ' +
        'You finish with [name:Dr. Volkov] at Pierhaven Medical Center, who also [rose:uses Competitor B] and does about 650 procedures a year, [success:up 15%].',
    );
    expect(labels(ws)).toEqual({
      'callum-adeleke': ['rose:Uses Competitor B', 'neutral:620 a year 10%'],
      'gabriela-kowalski': ['neutral:870 a year 21%'],
      'adaeze-volkov': ['rose:Uses Competitor B', 'neutral:650 a year 15%'],
    });
  });

  test('two are “both”', () => {
    const ws = ['adaeze-volkov', 'callum-adeleke'].reduce((w, id) => addToPlan(w, day, id, now), freshWorkspace(today));
    expect(review(ws)).toMatch(/^Today you’re seeing two interventionalists, both in person and both new to you\. /);
  });

  test('the sample day: who sends patients to whom, what’s due or not confirmed, and where two of them send patients outside, said once', () => {
    const ws = sampleWorkspace(today);
    expect(review(ws)).toBe(
      'Today you’re seeing three doctors, two in person and one by phone. ' +
        'You start at 10:00 with [name:Dr. Patel], an interventional cardiologist at Mount Sinai Hospital and the busiest of the three; the procedure mix vs. peers report is [warn:due today]. ' +
        'Next is [name:Dr. Lee], a cardiologist at Mount Sinai Morningside, who sends [success:33 patients a year] to Dr. Patel and Dr. Morgan; [warn:14:00 isn’t confirmed yet]. ' +
        'You finish with a call to [name:Dr. Morgan], an electrophysiologist at Mount Sinai West, who [rose:uses Competitor B]; the call about ablation referrals leaving the system is [warn:2 days late]. ' +
        'Between them, Dr. Patel and Dr. Morgan send [rose:28 patients a year] to Hudson Heart Institute, an independent heart centre: ask both why.',
    );
    // Dr. Patel sends Dr. Morgan fewer than one a month, which isn't worth saying.
    expect(labels(ws)).toEqual({
      maya: ['warn:Due today', 'rose:Sends 11 a year to Hudson'],
      jordan: ['success:Sends 33 a year to Patel and Morgan'],
      alex: ['warn:2 days late', 'rose:Uses Competitor B', 'rose:Sends 17 a year to Hudson'],
    });
  });

  test('someone added to the sample day is new to you, and a competitor said before is “also”', () => {
    const ws = addToPlan(sampleWorkspace(today), day, 'adaeze-volkov', now);
    expect(review(ws)).toContain('Then you see [name:Dr. Volkov], an interventional cardiologist at Pierhaven Medical Center, who is new to you, [rose:uses Competitor B] and does about 650 procedures a year, [success:up 15%]. ');
    expect(review(ws)).toContain('You finish with a call to [name:Dr. Morgan], an electrophysiologist at Mount Sinai West, who also [rose:uses Competitor B];');
    expect(review(ws)).toMatch(/^Today you’re seeing four doctors, three in person and one by phone\. .* and the busiest of the four;/);
  });

  test('labels only on visits still to do', () => {
    const ws = sampleWorkspace(today);
    const done: Workspace = { ...ws, plans: { ...ws.plans, [day]: (ws.plans[day] ?? []).map((i) => (i.targetId === 'maya' ? { ...i, status: 'done' as const } : i)) } };
    expect(labels(done).maya).toEqual([]);
    expect(labels(done).jordan).toEqual(['success:Sends 33 a year to Patel and Morgan']);
  });
});
