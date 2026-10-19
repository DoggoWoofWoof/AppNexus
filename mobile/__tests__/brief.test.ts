// The visit brief that leads each profile, after the brief test in the
// prototype's tests/flows.test.js.

import { describe, expect, test } from '@jest/globals';

import { briefText, buildBrief, visitWhen } from '@/lib/brief';
import { allEntities, getEntity, getOrg } from '@/lib/data';
import { DATA_PERIOD } from '@/lib/data/seed';
import { addDays, isoDate, startOfDay } from '@/lib/format';
import type { Entity } from '@/lib/types';
import { buildContext, freshWorkspace } from '@/lib/workspace';

const today = startOfDay(new Date(2026, 9, 19));
const ws = freshWorkspace(today);
const ctx = buildContext(ws, today);
const entity = (id: string): Entity => getEntity(id)!;

describe('nextVisit', () => {
  test('finds the next planned visit, today or later, and skips cancelled ones', () => {
    expect(ctx.nextVisit('maya')).toMatchObject({ day: isoDate(today), item: { id: 'v-maya' } });
    expect(ctx.nextVisit('hannah')).toBeNull();

    const later = isoDate(addDays(today, 2));
    const plans = {
      [isoDate(addDays(today, -1))]: [{ ...ws.plans[isoDate(today)][0], id: 'v-past', targetId: 'hannah' }],
      [isoDate(today)]: [{ ...ws.plans[isoDate(today)][0], id: 'v-off', targetId: 'hannah', status: 'cancelled' as const }],
      [later]: [{ ...ws.plans[isoDate(today)][0], id: 'v-later', targetId: 'hannah' }],
    };
    expect(buildContext({ ...ws, plans }, today).nextVisit('hannah')).toMatchObject({ day: later, item: { id: 'v-later' } });
  });
});

describe('buildBrief', () => {
  test('uses the planned goal, says when the visit is and leads with what was promised', () => {
    const maya = buildBrief(entity('maya'), ctx);
    expect(maya.goal).toBe('Bring the procedure mix vs. peers report.');
    expect(maya.goalSuggested).toBe(false);
    expect(visitWhen(maya.visit!, entity('maya'), today)).toMatch(/^Today, .* · 10:00–10:30 · /);
    expect(maya.points[0]).toEqual({ kind: 'promise', text: 'You promised: Send procedure mix vs. peers report (due today).' });
    expect(maya.points.length).toBeLessThanOrEqual(3);
    expect(maya.figures.map((f) => f.label)).toEqual(['Procedures · 12 mo', 'Sent outside the system', 'Last contact']);
  });

  test('a planned call says when, but not where', () => {
    const alex = buildBrief(entity('alex'), ctx);
    expect(alex.visit?.item.type).toBe('Phone call');
    expect(visitWhen(alex.visit!, entity('alex'), today)).toMatch(/^Today, [^·]+ · Any time$/);
  });

  test('suggests a goal when nothing is planned', () => {
    const hannah = buildBrief(entity('hannah'), ctx);
    expect(hannah.visit).toBeNull();
    expect(hannah.goalSuggested).toBe(true);
    expect(hannah.goal.length).toBeGreaterThan(0);
  });

  test('an open follow-up becomes the goal and is not repeated as a talking point', () => {
    const msw = buildBrief(entity('msw'), ctx);
    expect(msw.goal).toBe('Draft pricing proposal for value analysis');
    expect(msw.goalDue).toBe('due 29 Oct 2026');
    expect(msw.points[0].text).toBe('Last time (15 days ago): Value analysis timing: next committee review in six weeks.');
    expect(briefText(entity('msw'), msw, today)).toContain('Goal: Draft pricing proposal for value analysis (follow-up due 29 Oct 2026)');
  });

  test('an account brief leads with its leakage, without repeating it as a talking point', () => {
    const msw = buildBrief(entity('msw'), ctx);
    expect(msw.insight).toBe(getOrg('msw')!.leakage!.insight);
    expect(msw.insight).toMatch(/Hudson Heart Institute/);
    expect(msw.points.map((p) => p.kind)).toEqual(['lastNote', 'up', 'contact']);
    expect(msw.figures[1].label).toBe('Patients leaving');
  });

  test('a talking point about leakage only names places the insight does not', () => {
    const leaks = allEntities().flatMap((e) => {
      const brief = buildBrief(e, ctx);
      return brief.points
        .filter((p) => p.kind === 'leak')
        .map((p) => ({ insight: brief.insight, place: /went to (.+?)(?: for |\.)|; (.+) takes/.exec(p.text)!.slice(1).find(Boolean)! }));
    });
    expect(leaks.length).toBeGreaterThan(0);
    for (const { insight, place } of leaks) expect(insight).not.toContain(place);
  });

  test('every profile gets a goal, a reason and clean text', () => {
    for (const e of allEntities()) {
      const brief = buildBrief(e, ctx);
      expect(brief.goal).toBeTruthy();
      expect(brief.insight).toBeTruthy();
      expect(brief.points.length).toBeLessThanOrEqual(3);
      const text = briefText(e, brief, today);
      expect(text).toMatch(/^Visit brief: /);
      expect(text.endsWith(`\n${DATA_PERIOD}.`)).toBe(true);
      expect(text).not.toMatch(/undefined|NaN|null/);
    }
  });
});
