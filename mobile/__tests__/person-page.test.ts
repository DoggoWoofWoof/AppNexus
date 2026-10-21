// The one page for each person: the Summary at the top, what Listen reads, the
// card a link from Ask opens, and outcomes in plain words. The sample day is
// Monday 19 October 2026.

import { describe, expect, test } from '@jest/globals';

import { buildBrief, outcomeWord, speechFor, summaryOf, summaryParagraph } from '@/lib/brief';
import { allEntities, getEntity } from '@/lib/data';
import { startOfDay } from '@/lib/format';
import { withPrepEdit } from '@/lib/prep';
import { cardFor } from '@/lib/target';
import type { Entity } from '@/lib/types';
import { buildContext, freshWorkspace } from '@/lib/workspace';

const today = startOfDay(new Date(2026, 9, 19));
const ctx = buildContext(freshWorkspace(today), today);
const entity = (id: string): Entity => getEntity(id)!;

describe('the Summary', () => {
  test('a doctor: where they work, when they’re in and the last contact', () => {
    const summary = summaryOf(entity('maya'), ctx);
    expect(summary).toMatch(/^Works at /);
    expect(summary).toMatch(/Usually /);
    expect(summary).toMatch(/Last contact |You haven’t been in touch yet/);
  });

  test('an account: what it is, where, and its doctors', () => {
    const org = allEntities().find((e) => e.kind === 'hco' && e.type !== 'Health system')!;
    expect(summaryOf(org, ctx).startsWith(org.kind === 'hco' ? org.typeDetail : '')).toBe(true);
  });

  test('never says "Attempted", here or in the last-contact figure', () => {
    for (const e of allEntities()) {
      expect(summaryOf(e, ctx)).not.toMatch(/attempted/i);
      expect(buildBrief(e, ctx).figures[2].sub ?? '').not.toMatch(/Attempted/);
    }
  });

  test('Listen reads the name, the summary, the next step and the points to bring up', () => {
    const maya = entity('maya');
    const brief = buildBrief(maya, ctx);
    const speech = speechFor(maya, ctx, brief);
    expect(speech.startsWith(`${maya.name}.`)).toBe(true);
    expect(speech).toContain(summaryOf(maya, ctx));
    expect(speech).toContain('Next time:');
  });

  test('Listen reads the Summary as the card has it, and doesn’t say anything twice', () => {
    const maya = entity('maya');
    const brief = buildBrief(maya, ctx);
    // Until the rep has words of their own, the Summary says why they matter now, so it's said once.
    const plain = speechFor(maya, ctx, brief);
    expect(plain).toContain(summaryParagraph(maya, ctx));
    expect(plain.split(brief.insight)).toHaveLength(2);

    // With their words, why now comes after the numbers, and a point their words make isn't said again.
    const referrer = brief.points.find((p) => p.kind === 'referrer')!.text;
    const own = buildContext(withPrepEdit(ctx.ws, 'maya', { goal: '', text: `Ask how the new fellow is settling in. ${referrer}` }), today);
    const speech = speechFor(maya, own, buildBrief(maya, own));
    expect(speech).toContain(`${summaryOf(maya, own)} Ask how the new fellow is settling in. ${referrer}`);
    expect(speech.split(referrer)).toHaveLength(2);
    expect(speech).toContain(brief.insight);
  });
});

describe('outcomes in the log sheet’s words', () => {
  test('a visit is Met or Not in, a meeting with an account Met or Didn’t meet, a call Talked or No answer', () => {
    expect(outcomeWord('Met', 'In-person visit')).toBe('Met');
    expect(outcomeWord('Attempted', 'In-person visit')).toBe('Not in');
    expect(outcomeWord('Met', 'Meeting')).toBe('Met');
    expect(outcomeWord('Attempted', 'Meeting')).toBe('Didn’t meet');
    expect(outcomeWord('Met', 'Phone call')).toBe('Talked');
    expect(outcomeWord('Attempted', 'Phone call')).toBe('No answer');
    expect(outcomeWord('Left message', 'Phone call')).toBe('Left message');
  });
});

describe('links from Ask', () => {
  test('open the card for the old section names', () => {
    const maya = entity('maya');
    const org = allEntities().find((e) => e.kind === 'hco')!;
    expect(cardFor(maya, 'activity')).toBe('notes');
    expect(cardFor(maya, 'volumes')).toBe('volumes');
    expect(cardFor(maya, 'details')).toBe('details');
    expect(cardFor(maya, 'network')).toBe('refer');
    expect(cardFor(org, 'network')).toBe('doctors');
    expect(cardFor(org, 'leakage')).toBe('leakage');
    expect(cardFor(maya)).toBeUndefined();
  });
});
