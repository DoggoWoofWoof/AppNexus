// Ported from the search and workspace parts of tests/state.test.js in the prototype.
// Storage and navigation tests come back when on-device storage does.

import { describe, expect, test } from '@jest/globals';

import { allEntities, getEntity, getOrg, priorityOf, signalsFor } from '@/lib/data';
import { addDays, fromIso, isoDate, startOfDay } from '@/lib/format';
import { travelMinutes } from '@/lib/plan';
import { activeFilterCount, DEFAULT_FILTERS, type Filters } from '@/lib/search';
import type { Workspace } from '@/lib/types';
import { buildContext, freshWorkspace, sampleWorkspace, WORKSPACE_VERSION } from '@/lib/workspace';

const today = startOfDay(new Date());
const ws = freshWorkspace(today);
const ctx = buildContext(ws, today);
const search = (f: Partial<Filters>) => ctx.search({ ...DEFAULT_FILTERS, ...f });

describe('search', () => {
  test('matches names, specialties and affiliated organizations', () => {
    expect(search({ query: 'okafor' }).map((r) => r.entity.id)).toEqual(['okafor']);
    // A cardiologist, or someone at a cardiology practice.
    const cardio = search({ query: 'cardio' });
    expect(cardio.some((r) => r.entity.kind === 'hcp' && r.entity.specialty === 'Cardiology')).toBe(true);
    expect(
      cardio.every((r) => r.entity.kind === 'hcp' && (/cardio/i.test(r.entity.specialty) || r.entity.affiliations.some((a) => /cardio/i.test(getOrg(a.orgId)?.name ?? '')))),
    ).toBe(true);
    const morningside = search({ query: 'morningside' });
    expect(morningside.length).toBeGreaterThan(0);
    expect(morningside.every((r) => r.entity.kind === 'hcp' && r.entity.affiliations.some((a) => a.orgId === 'msm'))).toBe(true);
  });

  test('keeps people and accounts apart', () => {
    expect(search({ kind: 'hco' }).every((r) => r.entity.kind === 'hco')).toBe(true);
    expect(search({ kind: 'hcp' }).every((r) => r.entity.kind === 'hcp')).toBe(true);
  });

  test('filters narrow the results and sorts order them', () => {
    expect(search({ distance: '2' }).every((r) => r.distance <= 2)).toBe(true);
    expect(search({ signals: ['leakage'] }).every((r) => r.signals.some((s) => s.id === 'leakage'))).toBe(true);
    expect(search({ planned: 'unplanned' }).every((r) => !r.planned)).toBe(true);
    const near = search({ sort: 'distance' }).map((r) => r.distance);
    expect(near).toEqual([...near].sort((a, b) => a - b));
    // Doctors by surname, as the list shows them.
    const surnames = search({ sort: 'name' }).map((r) => r.entity.name.split(' ').pop()!);
    expect(surnames).toEqual([...surnames].sort((a, b) => a.localeCompare(b)));
    // The team's own come first by name among My targets.
    expect(search({ sort: 'name', mine: true }).map((r) => r.entity.name.split(' ').pop()).slice(0, 3)).toEqual(['Bell', 'Cohen', 'Lee']);
  });

  test('relevance counts the drive there: a point off for every 5 minutes, as nobody can be in two places at once', () => {
    const ranked = search({ sort: 'relevance', states: ['NY', 'NJ', 'CT', 'PA'] });
    for (const r of ranked) expect(r.priority).toBeCloseTo(priorityOf(r.entity, ws, today) - travelMinutes(r.distance) / 5);
    expect(ranked.some((r) => travelMinutes(r.distance) > 60)).toBe(true);
    const scores = ranked.map((r) => r.priority);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  test('relevance weighs how much they do, not percentages, and counts competitor use and time since last in touch', () => {
    const score = (id: string, w: Workspace = ws) => priorityOf(getEntity(id)!, w, today);
    // Dr. Adeyemi went from 8 a year to 10, 25% more; Dr. Mendoza does 385, if fewer than the year before.
    expect(score('desmond-mendoza')).toBeGreaterThan(score('vikram-adeyemi') + 15);
    // Using a competitor's products counts by what there is to win: nothing for someone doing no procedures.
    const won = (id: string) => score(id) - priorityOf({ ...getEntity(id)!, competitors: [] }, ws, today);
    expect(won('michael-fiore')).toBe(0);
    expect(won('adaeze-volkov')).toBeGreaterThan(10);
    // Someone seen yesterday can wait: the time since counts in full after a month.
    const emailed = (date: string): Workspace => ({
      ...ws,
      interactions: [...ws.interactions, { id: 'i-mendoza', targetId: 'desmond-mendoza', attendees: [], date, type: 'Email', outcome: 'Sent', author: 'You', note: '' }],
    });
    expect(score('desmond-mendoza') - score('desmond-mendoza', emailed(isoDate(addDays(today, -1))))).toBeGreaterThan(20);
    expect(score('desmond-mendoza', emailed(isoDate(addDays(today, -31))))).toBe(score('desmond-mendoza'));
  });

  test('the filter count ignores the search text and People/Accounts tab', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, query: 'x', kind: 'hco', signals: ['leakage', 'rising'], distance: '5' })).toBe(3);
  });
});

describe('workspace', () => {
  test('the sample is seeded for today, with nothing planned', () => {
    expect(ws).toMatchObject({ version: WORKSPACE_VERSION, seededOn: isoDate(today), pristine: true });
    // Today opens on the daily brief, and the day fills from it or from Targets.
    expect(ctx.dayPlan(ctx.todayIso)).toEqual([]);
  });

  test('the sample visits and calls are on weekdays, whatever day it’s seeded', () => {
    for (let d = 0; d < 7; d++) {
      const day = addDays(startOfDay(new Date(2026, 9, 19)), d);
      const weekend = freshWorkspace(day).interactions.filter((i) => [0, 6].includes(fromIso(i.date).getDay()));
      expect(weekend.map((i) => `${i.id} on ${i.date}`)).toEqual([]);
    }
  });

  test('every plan item, note and follow-up points at a real target', () => {
    const ids = [
      ...Object.values(sampleWorkspace(today).plans).flat().map((i) => i.targetId),
      ...ws.interactions.map((i) => i.targetId),
      ...ws.followUps.map((f) => f.targetId),
    ];
    expect(ids.filter((id) => !getEntity(id))).toEqual([]);
  });

  test('signals and suggestions are computed for every target', () => {
    for (const e of allEntities()) expect(Array.isArray(signalsFor(e, ws, today))).toBe(true);
    const suggested = ctx.suggestions(ctx.todayIso, 3);
    expect(suggested).toHaveLength(3);
    expect(suggested.every(({ entity }) => !ctx.planItemFor(entity.id, ctx.todayIso))).toBe(true);
  });

  test('open follow-ups come soonest first, with how overdue they are', () => {
    const open = ctx.openFollowUps();
    expect(open.map((f) => f.due)).toEqual([...open.map((f) => f.due)].sort());
    expect(open.some((f) => f.overdueBy > 0)).toBe(true);
  });
});
