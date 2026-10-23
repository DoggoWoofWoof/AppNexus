// Finding people three ways: the Filters sheet's search, the line Targets offers
// for what a rep types, and Ask, whose lists open in Targets as the same search.
// The sample day is Thursday 22 October 2026.

import { describe, expect, test } from '@jest/globals';

import { answer, detectIntent } from '@/lib/ask';
import { filterOptions, findFilters } from '@/lib/filter-search';
import { startOfDay } from '@/lib/format';
import { DEFAULT_FILTERS, readSearchLink, searchLink, type Filters } from '@/lib/search';
import { describeSearch, readTargetQuery } from '@/lib/target-query';
import { buildContext, freshWorkspace } from '@/lib/workspace';

const today = startOfDay(new Date(2026, 9, 22));
const ctx = buildContext(freshWorkspace(today), today);
const filters = (f: Partial<Filters> = {}): Filters => ({ ...DEFAULT_FILTERS, ...f });
const find = (text: string, f: Partial<Filters> = {}) => findFilters(filterOptions(filters(f), 'today'), text);
const labels = (text: string, f: Partial<Filters> = {}) => find(text, f).map((o) => o.label);

describe('the Filters sheet search', () => {
  test('finds a filter by a word of its name, or one a rep would say', () => {
    expect(labels('ep')[0]).toBe('Cardiac Electrophysiology');
    expect(labels('pci')[0]).toBe('PCI · 92928');
    expect(labels('tavr')[0]).toBe('TAVR · 33361');
    expect(labels('overdue')).toContain('Follow-up due');
    expect(labels('sinai west')[0]).toBe('At Mount Sinai West');
    expect(labels('nj')[0]).toBe('New Jersey');
    expect(labels('zzz')).toEqual([]);
    expect(labels('  ')).toEqual([]);
  });

  test('names that start with what was typed come first', () => {
    expect(labels('pa').slice(0, 3)).toEqual(['Patients going elsewhere', 'Pennsylvania', 'Pacemaker implant · 33208']);
  });

  test('offers specialties for doctors and types for accounts', () => {
    expect(labels('ep', { kind: 'hco' })).not.toContain('Cardiac Electrophysiology');
    expect(labels('hospital', { kind: 'hco' })[0]).toBe('Hospital');
    expect(labels('hospital')).not.toContain('Hospital');
  });

  test('tapping one adds it, and tapping it again takes it off', () => {
    const ep = find('ep')[0];
    expect(ep).toMatchObject({ on: false, single: false, patch: { specialties: ['Cardiac Electrophysiology'] } });
    const on = ep.patch;
    expect(find('ep', on)[0]).toMatchObject({ on: true, patch: { specialties: [] } });
    // Specialties add up; a procedure is one at a time, and tapping it again goes back to all of them.
    expect(find('interventional', on)[0].patch).toEqual({ specialties: ['Cardiac Electrophysiology', 'Interventional Cardiology'] });
    expect(find('tavr', { codes: '92928' })[0]).toMatchObject({ on: false, single: true, patch: { codes: '33361' } });
    expect(find('tavr', { codes: '33361' })[0]).toMatchObject({ on: true, patch: { codes: 'all' } });
  });

  test('a state narrows to it, and New York with New Jersey is the rep’s own territory again', () => {
    expect(find('pennsylvania')[0].patch).toEqual({ states: ['PA'] });
    expect(find('new york', { states: ['NJ'] })[0].patch).toEqual({ states: [] });
    expect(find('new jersey', { states: ['NJ', 'PA'] })[0]).toMatchObject({ on: true, patch: { states: ['PA'] } });
  });

  test('a competitor named takes the place of any competitor', () => {
    const [named] = find('competitor a', { competitors: ['any'] });
    expect(named).toMatchObject({ label: 'Uses Competitor A', on: false, patch: { competitors: ['Competitor A'] } });
    expect(find('uses competitor a')[0].label).toBe('Uses Competitor A');
    expect(find('uses a competitor', { competitors: ['any'] })[0]).toMatchObject({ on: true, patch: { competitors: [] } });
  });
});

describe('a search in words', () => {
  test('says who, where, doing what and why, as Targets offers it and Ask answers', () => {
    const f = filters({ specialties: ['Interventional Cardiology'], states: ['NJ'], competitors: ['any'] });
    expect(describeSearch(f, 'today')).toBe('interventional cardiologists in New Jersey using a competitor');
    expect(describeSearch(f, 'today', 5)).toBe('5 interventional cardiologists in New Jersey using a competitor');
    expect(describeSearch(f, 'today', 1)).toBe('1 interventional cardiologist in New Jersey using a competitor');
    expect(describeSearch(filters(), 'today')).toBe('doctors in your territory');
    expect(describeSearch(filters({ kind: 'hco', orgTypes: ['Hospital'], signals: ['leakage'] }), 'today', 3)).toBe('3 hospitals in your territory with patients going elsewhere');
    expect(describeSearch(filters({ org: 'msw', codes: '33361', mine: true }), 'today')).toBe('doctors in My targets at Mount Sinai West doing TAVR');
    expect(describeSearch(filters({ codes: 'coronary', competitors: ['Competitor A', 'Competitor B'] }), 'today')).toBe(
      'doctors in your territory doing coronary procedures using Competitor A or Competitor B',
    );
  });

  test('says the day the list is for, and the distance, the plan and a name', () => {
    expect(describeSearch(filters({ inDay: true }), 'today')).toBe('doctors in your territory working today');
    expect(describeSearch(filters({ inDay: true }), 'Monday')).toBe('doctors in your territory working on Monday');
    expect(describeSearch(filters({ distance: '5', planned: 'unplanned', query: ' Rossi ' }), 'today')).toBe('doctors in your territory within 5 km not in your plan matching “Rossi”');
  });
});

describe('what a rep types', () => {
  test('reads who to see and who hasn’t been seen', () => {
    expect(readTargetQuery('who should I see in NJ').filters).toEqual({ sort: 'relevance', states: ['NJ'], query: '' });
    expect(readTargetQuery('which cardiologists haven’t I seen').filters).toEqual({ kind: 'hcp', specialties: ['Cardiology'], signals: ['unseen'], query: '' });
  });
});

describe('a search opened from Ask', () => {
  test('keeps what differs from a new search, and always the territory and procedures', () => {
    expect(JSON.parse(searchLink(filters({ competitors: ['any'] })))).toEqual({ states: [], codes: 'all', competitors: ['any'] });
    const f = filters({ kind: 'hco', orgTypes: ['Hospital'], states: ['NJ'], signals: ['leakage'], sort: 'relevance' });
    expect(readSearchLink(searchLink(f))).toEqual({ kind: 'hco', orgTypes: ['Hospital'], states: ['NJ'], signals: ['leakage'], sort: 'relevance', codes: 'all' });
    // Applied over a new search, it's the same search.
    expect({ ...DEFAULT_FILTERS, ...readSearchLink(searchLink(f)) }).toEqual(f);
  });

  test('a link changed by hand keeps only what’s valid', () => {
    expect(readSearchLink('not a link')).toBeNull();
    expect(readSearchLink('[1, 2]')).toBeNull();
    expect(readSearchLink('null')).toBeNull();
    expect(readSearchLink(JSON.stringify({ kind: 'nurse', sort: 'name', signals: ['leakage', 'luck'], states: 'NY', inDay: 'yes', mine: true }))).toEqual({
      sort: 'name',
      signals: ['leakage'],
      mine: true,
    });
  });
});

describe('Ask finds a list as Targets does', () => {
  const linkOf = (a: ReturnType<typeof answer>) => (a.doThis?.link.kind === 'targets' ? readSearchLink(a.doThis.link.find) : null);

  test('answers with the first few, and opens all of them in Targets', () => {
    const a = answer('Top doctors using competitor products', ctx);
    expect(a.intent).toBe('find');
    const all = ctx.search(filters({ competitors: ['any'] }));
    expect(all.length).toBeGreaterThan(6);
    expect(a.summary.startsWith(`${all.length} doctors in your territory using a competitor.`)).toBe(true);
    expect(a.rows.map((r) => r.id)).toEqual(all.slice(0, 6).map((r) => r.entity.id));
    expect(a.doThis?.label).toBe(`See all ${all.length} in Targets`);
    expect(linkOf(a)).toEqual({ states: [], codes: 'all', competitors: ['any'] });
  });

  test('reads the question as Targets reads what’s typed', () => {
    const a = answer('Interventional cardiologists in NJ using a competitor', ctx);
    const all = ctx.search(filters({ specialties: ['Interventional Cardiology'], states: ['NJ'], competitors: ['any'] }));
    expect(a.intent).toBe('find');
    expect(a.summary.startsWith(`${capitalised(describeSearch(filters({ specialties: ['Interventional Cardiology'], states: ['NJ'], competitors: ['any'] }), 'today', all.length))}.`)).toBe(true);
    expect(linkOf(a)).toEqual({ specialties: ['Interventional Cardiology'], states: ['NJ'], codes: 'all', competitors: ['any'] });
  });

  test('“Top doctors” is the territory’s, unless the chat is about an account', () => {
    expect(detectIntent('Top doctors in my territory')).toBe('find');
    expect(detectIntent('Top doctors here', 'msh', true)).toBe('people');
    const there = answer('Top doctors here', ctx, { about: 'msh', scoped: true });
    expect(there.rows.map((r) => r.id)).toEqual(
      ctx
        .search(filters({ org: 'msh' }))
        .slice(0, 6)
        .map((r) => r.entity.id),
    );
    expect(linkOf(there)).toMatchObject({ org: 'msh' });
  });

  test('growth, decline and patients lost are about who the question names', () => {
    const nj = new Set(ctx.search(filters({ specialties: ['Cardiology'], states: ['NJ'] })).map((r) => r.entity.id));
    const growing = answer('Which cardiologists in NJ are growing?', ctx);
    expect(growing.intent).toBe('growth');
    expect(growing.scope).toContain('Cardiologists in New Jersey');
    expect(growing.rows.length).toBeGreaterThan(0);
    expect(growing.rows.every((r) => nj.has(r.id!))).toBe(true);
    const declined = answer('Which cardiologists in NJ have declined?', ctx);
    expect(declined.intent).toBe('decline');
    expect(declined.rows.every((r) => nj.has(r.id!))).toBe(true);
    // Only the team's own accounts say where patients go, and none of them is in New Jersey.
    expect(answer('Which hospitals in NJ are losing patients?', ctx).summary).toBe('None of the hospitals in New Jersey report where their patients go.');
    // Without anyone named, it's the rep's own book.
    expect(answer('Which accounts are growing the most?', ctx).scope).toContain('Your book');
  });
});

const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
