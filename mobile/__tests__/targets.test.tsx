// Targets: everyone in the made-up territory, ranked by procedures. The chips'
// territory and procedures, My targets and the star, competitors, and what a rep
// types read as filters. The sample day is Thursday 22 October 2026.

import { describe, expect, test } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { CODE_GROUPS, CODES, isCodePick, pickLabel, volumeIn, volumeText } from '@/lib/codes';
import { allEntities, getEntity, hcpsAt, proceduresOf, procedureTotal, stateOf, teamTargets, testsOf } from '@/lib/data';
import { HCPS } from '@/lib/data/hcps';
import { ORGS } from '@/lib/data/orgs';
import { NEXT_DOOR_HCPS, NEXT_DOOR_ORGS, TERRITORY_HCPS, TERRITORY_ORGS } from '@/lib/data/territory';
import { startOfDay, sum } from '@/lib/format';
import { restoreWorkspace } from '@/lib/persist';
import { activeFilterCount, DEFAULT_FILTERS, filterChips, mineFirst, type Filters } from '@/lib/search';
import { useWorkspace, WorkspaceProvider } from '@/lib/store';
import { readTargetQuery } from '@/lib/target-query';
import { buildContext, freshWorkspace, myTargets, withTarget } from '@/lib/workspace';

const today = startOfDay(new Date(2026, 9, 22));
const ctx = buildContext(freshWorkspace(today), today);
const search = (f: Partial<Filters>) => ctx.search({ ...DEFAULT_FILTERS, ...f });
const territory = [...TERRITORY_HCPS, ...TERRITORY_ORGS];
const nextDoor = [...NEXT_DOOR_HCPS, ...NEXT_DOOR_ORGS];

async function renderStore() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <WorkspaceProvider today={today} now={() => new Date(2026, 9, 22, 8, 0)}>
      {children}
    </WorkspaceProvider>
  );
  const { result } = await renderHook(() => useWorkspace(), { wrapper });
  return result;
}

describe('the territory', () => {
  test('is made up: 555 numbers, example.org addresses and no one twice', () => {
    expect(TERRITORY_HCPS).toHaveLength(121);
    expect(TERRITORY_ORGS).toHaveLength(31);
    expect(NEXT_DOOR_HCPS).toHaveLength(52);
    expect(NEXT_DOOR_ORGS).toHaveLength(13);
    const doctors = [...TERRITORY_HCPS, ...NEXT_DOOR_HCPS];
    expect(doctors.every((h) => /^\(\d{3}\) 555-\d{4}$/.test(h.contact.phone) && h.contact.email.endsWith('@example.org'))).toBe(true);
    const ids = [...HCPS, ...ORGS, ...territory, ...nextDoor].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const numbers = [...HCPS, ...doctors].flatMap((h) => [h.npi, h.contact.phone]);
    expect(new Set(numbers).size).toBe(numbers.length);
    // First and last names once each, so Ask can tell who a question means.
    const names = [...HCPS, ...doctors].flatMap((h) => h.name.replace(/^Dr\. /, '').split(' '));
    expect(new Set(names).size).toBe(names.length);
  });

  test('is New York and New Jersey, with Connecticut and Pennsylvania next door, and every account has doctors', () => {
    expect([...new Set([...HCPS, ...ORGS, ...territory].map((e) => stateOf(getEntity(e.id)!)))].sort()).toEqual(['NJ', 'NY']);
    expect([...new Set(nextDoor.map((e) => stateOf(getEntity(e.id)!)))].sort()).toEqual(['CT', 'PA']);
    expect(stateOf(getEntity('okafor')!)).toBe('NY');
    expect(TERRITORY_ORGS.every((o) => TERRITORY_HCPS.some((h) => h.affiliations.some((a) => a.orgId === o.id)))).toBe(true);
    expect(NEXT_DOOR_ORGS.every((o) => NEXT_DOOR_HCPS.some((h) => h.affiliations.some((a) => a.orgId === o.id)))).toBe(true);
  });

  test('My targets starts as the team’s list, which has none of the territory', () => {
    expect(myTargets(freshWorkspace(today))).toEqual(teamTargets());
    expect(teamTargets()).toHaveLength(16);
    expect(teamTargets().filter((id) => territory.some((e) => e.id === id))).toEqual([]);
  });
});

describe('procedures', () => {
  test('every code in the data has a name and one group', () => {
    const inData = new Set(allEntities().flatMap((e) => [...(proceduresOf(e) ?? []), ...testsOf(e)].flatMap((r) => r.code.match(/\d{5}/g) ?? [])));
    expect([...inData].filter((c) => !CODES.some((k) => k.code === c))).toEqual([]);
    expect(CODES.filter((c) => CODE_GROUPS.filter((g) => g.codes.includes(c.code)).length !== 1)).toEqual([]);
  });

  test('a pick is all, a group or one code', () => {
    expect(['all', 'coronary', '33361'].every(isCodePick)).toBe(true);
    expect(['kidney', '12345', 7, undefined].some(isCodePick)).toBe(false);
    expect(['all', 'coronary', '33361'].map(pickLabel)).toEqual(['All procedures', 'Coronary', 'TAVR']);
  });

  test('a year’s procedures and the year before, from the last eight quarters', () => {
    const okafor = getEntity('okafor')!;
    const rows = proceduresOf(okafor)!;
    expect(volumeIn(okafor, 'all')).toMatchObject({
      year: sum(rows.map((r) => sum(r.series.slice(-4)))),
      before: sum(rows.map((r) => sum(r.series.slice(-8, -4)))),
    });
    // A nephrologist does none of them.
    expect(volumeIn(getEntity(TERRITORY_HCPS.find((h) => h.specialty === 'Nephrology')!.id)!, 'all')).toBeNull();
    expect(volumeIn(okafor, 'rhythm')).toBeNull();
  });

  test('All procedures leaves out echo and stress tests, which count when picked', () => {
    // Dr. Jordan Lee, a general cardiologist, reads hundreds of echos and stress tests a year.
    const lee = getEntity('jordan')!;
    const caths = sum(proceduresOf(lee)!.flatMap((r) => (r.code === 'CPT 93458' ? r.series.slice(-4) : [])));
    expect(volumeIn(lee, 'all')?.year).toBe(caths);
    expect(volumeIn(lee, 'imaging')!.year).toBeGreaterThan(caths * 5);
  });

  test('are counted the same on someone’s page and an account’s busiest doctors as here', () => {
    for (const e of allEntities()) expect(procedureTotal(e)).toBe(volumeIn(e, 'all')?.year ?? 0);
    for (const org of allEntities().filter((e) => e.kind === 'hco')) {
      const ranked = [...hcpsAt(org.id)].sort((a, b) => (volumeIn(b, 'all')?.year ?? 0) - (volumeIn(a, 'all')?.year ?? 0));
      expect(hcpsAt(org.id).map(procedureTotal)).toEqual(ranked.map(procedureTotal));
    }
  });

  test('read as "86 a year ↑12%"', () => {
    expect(volumeText({ year: 86, before: 77, change: 11.7 })).toBe('86 a year ↑12%');
    expect(volumeText({ year: 1240, before: 1300, change: -4.6 })).toBe('1,240 a year ↓5%');
    expect(volumeText({ year: 86, before: 86, change: 0.3 })).toBe('86 a year');
    expect(volumeText({ year: 4, before: 0, change: null })).toBe('4 a year');
  });
});

describe('the list', () => {
  test('is most procedures first, with anyone doing none last', () => {
    const years = search({}).map((r) => r.volume?.year ?? -1);
    expect(years).toEqual([...years].sort((a, b) => b - a));
    expect(years.at(-1)).toBe(-1);
  });

  test('is the rep’s own territory until a state is chosen, and a state shows only who works there', () => {
    expect(search({})).toHaveLength(131);
    const nj = search({ states: ['NJ'] });
    expect(nj.length).toBeGreaterThan(0);
    expect(nj.every((r) => stateOf(r.entity) === 'NJ')).toBe(true);
    expect(nj.length + search({ states: ['NY'] }).length).toBe(search({}).length);
    const ct = search({ states: ['CT'] });
    expect(ct.length).toBeGreaterThan(0);
    expect(ct.every((r) => stateOf(r.entity) === 'CT')).toBe(true);
    expect(search({ kind: 'hco', states: ['PA'] }).map((r) => r.entity.id).sort()).toEqual(['hollowmere', 'ironvale', 'kettlewood', 'nettlebrook', 'oakhallow', 'rookhaven']);
  });

  test('a group of procedures leaves out anyone doing none, and ranks by it', () => {
    const structural = search({ codes: 'structural' });
    expect(structural.length).toBeGreaterThan(0);
    expect(structural.length).toBeLessThan(search({}).length);
    expect(structural.every((r) => r.volume)).toBe(true);
    const years = structural.map((r) => r.volume!.year);
    expect(years).toEqual([...years].sort((a, b) => b - a));
  });

  test('My targets and competitors narrow it', () => {
    const team = teamTargets().filter((id) => getEntity(id)?.kind === 'hcp');
    expect(search({ mine: true }).map((r) => r.entity.id).sort()).toEqual([...team].sort());
    const competing = search({ competitors: ['any'] });
    expect(competing.length).toBeGreaterThan(0);
    expect(competing.every((r) => r.entity.competitors?.length)).toBe(true);
    expect(search({ competitors: ['Competitor B'] }).map((r) => r.entity.id)).toContain('alex');
    expect(search({ competitors: ['Competitor B'] }).map((r) => r.entity.id)).not.toContain('okafor');
  });

  test('an account shows who works there or at a site below it, whatever the states', () => {
    const ids = (f: Partial<Filters>) =>
      search(f)
        .map((r) => r.entity.id)
        .sort();
    expect(ids({ org: 'quarry' })).toEqual(
      hcpsAt('quarry')
        .map((h) => h.id)
        .sort(),
    );
    expect(ids({ org: 'quarry' }).length).toBeGreaterThan(1);
    // Quarry Ridge is in New Jersey.
    expect(ids({ org: 'quarry', states: ['NY'] })).toEqual(ids({ org: 'quarry' }));
    // A health system is all of its sites.
    expect(ids({ org: 'msh-system' })).toEqual(expect.arrayContaining(ids({ org: 'msw' })));
    expect(ids({ org: 'msh-system' }).length).toBeGreaterThan(ids({ org: 'msw' }).length);
    expect(ids({ kind: 'hco', org: 'msh-system' })).toEqual(['harlem', 'kidney', 'msh', 'msh-system', 'msm', 'msw']);
  });

  test('finds doctors by the town they work in', () => {
    const newark = search({ query: 'newark' });
    expect(newark.length).toBeGreaterThan(0);
    expect(newark.every((r) => r.entity.kind === 'hcp' && stateOf(r.entity) === 'NJ')).toBe(true);
  });

  test('each filter that’s on is a chip that takes it off, and competitors have their own', () => {
    expect(filterChips(DEFAULT_FILTERS, 'today')).toEqual([]);
    const on = { ...DEFAULT_FILTERS, signals: ['leakage' as const], competitors: ['any'], distance: '5' as const, inDay: true };
    const chips = filterChips(on, 'today');
    expect(chips.map((c) => c.label)).toEqual(['Patients going elsewhere', 'Within 5 km', 'In today']);
    expect(chips.map((c) => c.off)).toEqual([{ signals: [] }, { distance: 'any' }, { inDay: false }]);
    expect(activeFilterCount(on)).toBe(3);
  });
});

describe('what a rep types', () => {
  const read = (text: string) => readTargetQuery(text).filters;

  test('sets states, specialties, competitors and procedures', () => {
    expect(read('interventional cardiologists in NJ using competitor a')).toEqual({
      kind: 'hcp',
      specialties: ['Interventional Cardiology'],
      states: ['NJ'],
      competitors: ['Competitor A'],
      query: '',
    });
    expect(read('TAVR in New York')).toEqual({ codes: '33361', states: ['NY'], query: '' });
    expect(read('NY and NJ')).toEqual({ states: [], query: '' });
    expect(read('cardiologists in Connecticut')).toEqual({ kind: 'hcp', specialties: ['Cardiology'], states: ['CT'], query: '' });
    expect(read('PA and NJ')).toEqual({ states: ['NJ', 'PA'], query: '' });
    // CT surgeons are cardiothoracic, not Connecticut's.
    expect(read('CT surgeons in PA')).toEqual({ kind: 'hcp', specialties: ['Cardiothoracic Surgery'], states: ['PA'], query: '' });
    expect(read('anyone using competitors')).toEqual({ competitors: ['any'], query: '' });
    expect(read('92928')).toEqual({ codes: '92928', query: '' });
    expect(read('right heart caths')).toEqual({ codes: '93451', query: '' });
  });

  test('several procedures make the group they’re all in, or else the first', () => {
    expect(read('PCI and CABG')).toMatchObject({ codes: 'coronary' });
    expect(read('PCI and TAVR')).toMatchObject({ codes: '92928' });
    expect(read('coronary stents')).toMatchObject({ codes: '92928' });
  });

  test('sets accounts, My targets, order, distance and reasons', () => {
    expect(read('hospitals in nj')).toEqual({ kind: 'hco', orgTypes: ['Hospital'], states: ['NJ'], query: '' });
    expect(read('my doctors with follow-ups due')).toEqual({ mine: true, kind: 'hcp', signals: ['followup'], query: '' });
    expect(read('nearest EP within 2 km')).toEqual({ distance: '2', sort: 'distance', kind: 'hcp', specialties: ['Cardiac Electrophysiology'], query: '' });
    expect(read('top 10 vascular surgeons not planned')).toEqual({ sort: 'volume', kind: 'hcp', specialties: ['Vascular Surgery'], planned: 'unplanned', query: '' });
    expect(read('who’s in today, under 3 miles')).toEqual({ inDay: true, distance: '5', query: '' });
  });

  test('the first of doctors or accounts named says which list', () => {
    expect(read('doctors at hospitals')).toEqual({ kind: 'hcp', query: '' });
    expect(read('hospitals with cardiologists')).toEqual({ kind: 'hco', orgTypes: ['Hospital'], query: '' });
  });

  test('an account named shows who works there, and a health system all its sites', () => {
    expect(read('top hcps at quarry ridge')).toEqual({ sort: 'volume', kind: 'hcp', org: 'quarry', query: '' });
    expect(read('doctors at Mount Sinai West')).toEqual({ kind: 'hcp', org: 'msw', query: '' });
    expect(read('Mount Sinai Hospital')).toEqual({ org: 'msh', query: '' });
    expect(read('cardiologists at mount sinai')).toEqual({ kind: 'hcp', specialties: ['Cardiology'], org: 'msh-system', query: '' });
    expect(read('sinai')).toEqual({ org: 'msh-system', query: '' });
    expect(read('riverwick EPs')).toEqual({ kind: 'hcp', specialties: ['Cardiac Electrophysiology'], org: 'riverwick', query: '' });
    // A word many accounts have is only a word.
    expect(readTargetQuery('medical center').understood).toBe(false);
    // On Accounts, an account's own name is searched for as a name.
    expect(readTargetQuery('Riverwick', ['Riverwick Heart Institute']).understood).toBe(false);
  });

  test('leaves names and towns to search for', () => {
    expect(read('cardiologists in Newark')).toEqual({ kind: 'hcp', specialties: ['Cardiology'], query: 'Newark' });
    // Nothing understood: the words stay exactly as typed.
    expect(readTargetQuery('  O’Brien ')).toEqual({ filters: { query: 'O’Brien' }, understood: false });
    // A name, even one with words that would be filters, is only a name.
    expect(readTargetQuery('Valemont Vascular', ['Valemont Vascular Center']).understood).toBe(false);
    expect(readTargetQuery('Rossi', ['Dr. Elena Rossi']).understood).toBe(false);
    // Part of a word isn't a name: "NJ" is New Jersey, even with an Anjali in the list.
    expect(readTargetQuery('nj', ['Dr. Anjali Rao']).filters).toEqual({ states: ['NJ'], query: '' });
  });
});

describe('My targets', () => {
  test('the star adds and takes off, with Undo', async () => {
    const store = await renderStore();
    const someone = TERRITORY_HCPS[0];
    expect(store.current.isTarget(someone.id)).toBe(false);
    await act(() => store.current.toggleTarget(someone.id));
    expect(store.current.isTarget(someone.id)).toBe(true);
    expect(store.current.notice).toMatchObject({ message: `${someone.name} added to My targets`, canUndo: true });
    await act(() => store.current.undo());
    expect(store.current.isTarget(someone.id)).toBe(false);
    // The team's own can be taken off too.
    await act(() => store.current.toggleTarget('okafor'));
    expect(store.current.isTarget('okafor')).toBe(false);
    expect(store.current.notice?.message).toBe('Dr. Daniel Okafor taken off My targets');
  });

  test('Select adds several at once, and says when they’re in already', async () => {
    const store = await renderStore();
    const [a, b] = TERRITORY_HCPS;
    await act(() => store.current.addTargets([a.id, b.id, 'okafor']));
    expect(store.current.notice?.message).toBe('2 added to My targets');
    expect([a.id, b.id].every(store.current.isTarget)).toBe(true);
    await act(() => store.current.addTargets(['okafor']));
    expect(store.current.notice).toMatchObject({ message: 'Already in My targets', canUndo: false });
    await act(() => store.current.addTargets([a.id, b.id]));
    expect(store.current.notice?.message).toBe('They’re all in My targets already');
  });

  test('come first in the list, then everyone else, each most procedures first', () => {
    const rows = mineFirst(search({}));
    const mine = rows.filter((r) => r.mine).length;
    expect(mine).toBeGreaterThan(0);
    expect(rows.slice(0, mine).every((r) => r.mine)).toBe(true);
    const rest = rows.slice(mine).map((r) => r.volume?.year ?? -1);
    expect(rest).toEqual([...rest].sort((a, b) => b - a));
    // Targets goes by who was in My targets when the list opened, so a star tapped doesn't move the row.
    expect(mineFirst(search({}), (r) => r.entity.id === 'okafor')[0].entity.id).toBe('okafor');
  });

  test('is kept on the phone, leaving out anyone no longer in the data', () => {
    const ws = withTarget(freshWorkspace(today), TERRITORY_HCPS[0].id, true);
    const back = restoreWorkspace(JSON.stringify({ ...ws, targets: [...ws.targets!, 'nobody', 7] }), today);
    expect(back.targets).toEqual(ws.targets);
    expect(back.targets).toContain(TERRITORY_HCPS[0].id);
    // Kept before there was a list of its own: the team's.
    expect(restoreWorkspace(JSON.stringify(freshWorkspace(today)), today).targets).toBeUndefined();
  });
});
