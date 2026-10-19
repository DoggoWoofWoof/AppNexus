// Ported from the search and workspace parts of tests/state.test.js in the prototype.
// Storage and navigation tests come back when on-device storage does.

import { describe, expect, test } from '@jest/globals';

import { allEntities, getEntity, signalsFor } from '@/lib/data';
import { isoDate, startOfDay } from '@/lib/format';
import { activeFilterCount, DEFAULT_FILTERS, type Filters } from '@/lib/search';
import { buildContext, freshWorkspace, WORKSPACE_VERSION } from '@/lib/workspace';

const today = startOfDay(new Date());
const ws = freshWorkspace(today);
const ctx = buildContext(ws, today);
const search = (f: Partial<Filters>) => ctx.search({ ...DEFAULT_FILTERS, ...f });

describe('search', () => {
  test('matches names, specialties and affiliated organizations', () => {
    expect(search({ query: 'okafor' }).map((r) => r.entity.id)).toEqual(['okafor']);
    expect(search({ query: 'cardio' }).every((r) => r.entity.kind === 'hcp' && /cardio/i.test(r.entity.specialty))).toBe(true);
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
    const names = search({ sort: 'name' }).map((r) => r.entity.name.replace(/^Dr\. /, ''));
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  test('the filter count ignores the search text and People/Accounts tab', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, query: 'x', kind: 'hco', signals: ['leakage', 'rising'], distance: '5' })).toBe(3);
  });
});

describe('workspace', () => {
  test('the sample is seeded for today', () => {
    expect(ws).toMatchObject({ version: WORKSPACE_VERSION, seededOn: isoDate(today), pristine: true });
    expect(ctx.dayPlan(ctx.todayIso).length).toBeGreaterThan(0);
  });

  test('every plan item, note and follow-up points at a real target', () => {
    const ids = [
      ...Object.values(ws.plans).flat().map((i) => i.targetId),
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
