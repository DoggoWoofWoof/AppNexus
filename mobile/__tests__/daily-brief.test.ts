// The daily brief at the top of Today (lib/daily-brief.ts): a tile for each state
// of the territory and next door with who to reach out to there and why, then
// three doctors worth adding to the day, in the rep's own territory or the state
// picked on a tile, on Tuesday 27 October 2026 at 08:00, with nothing in the day
// yet, as the app starts.

import { describe, expect, jest, test } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';

import { useDailyBrief } from '@/components/daily-brief';
import { dailyBrief } from '@/lib/daily-brief';
import { isoDate, startOfDay } from '@/lib/format';
import { DEFAULT_FILTERS, readSearchLink, type SearchRow } from '@/lib/search';
import { useWorkspace, WorkspaceProvider } from '@/lib/store';
import type { Interaction, Workspace } from '@/lib/types';
import { addToPlan, buildContext, freshWorkspace, withTarget } from '@/lib/workspace';

// The icons and the brief's building blocks use packages jest can't load, and
// nothing here draws them.
function mockUndrawn() {
  return new Proxy({}, { get: (_, name) => (name === '__esModule' ? true : () => null) });
}
jest.mock('lucide-react-native', () => mockUndrawn());
jest.mock('@/components/ui/text', () => mockUndrawn());
jest.mock('@/components/ui/icon', () => mockUndrawn());

const today = startOfDay(new Date(2026, 9, 27));
const now = new Date(2026, 9, 27, 8, 0);
const day = isoDate(today);
/** The chips as they start on Targets: the rep's own territory, all procedures. */
const home = { states: [] as string[], codes: 'all' };

const briefFor = (chosen = home, ws: Workspace = freshWorkspace(today), keep: string[] = [], on = day) => dailyBrief(buildContext(ws, today, now), on, chosen, keep, now);
const ids = (brief: ReturnType<typeof dailyBrief>) => brief.people.map((p) => p.row.entity.id);
/** Who of the brief comes first: Dr. Volkov, Dr. Adeleke and Dr. Kowalski. */
const [VOLKOV, ADELEKE, KOWALSKI] = ['adaeze-volkov', 'callum-adeleke', 'gabriela-kowalski'];

/** The fresh workspace with an email to someone on that day. */
function emailed(id: string, date: string): Workspace {
  const ws = freshWorkspace(today);
  const email: Interaction = { id: `i-${id}`, targetId: id, attendees: [id], date, type: 'Email', outcome: 'Sent', author: 'You', note: '' };
  return { ...ws, interactions: [...ws.interactions, email] };
}

/** Everyone in a state doing the procedures, as the brief counts them. */
const doctorsIn = (state: string, ws = freshWorkspace(today)) =>
  buildContext(ws, today, now)
    .search({ ...DEFAULT_FILTERS, states: [state] })
    .filter((r) => r.volume);
/** Procedures gained on the year before. */
const gained = (r: SearchRow) => (r.volume ? r.volume.year - r.volume.before : 0);

describe('the territory at a glance', () => {
  test('a tile for each state, the rep’s own first, with who to reach out to there first and why, and why to look there', () => {
    const { territories } = briefFor();
    expect(territories.map((t) => [t.state, t.yours, t.tone, t.gap, t.first && [t.first.row.entity.name, t.first.why, t.first.change], t.summary])).toEqual([
      ['NY', true, 'competitor', '', ['Dr. Dorothy Baptiste', 'Uses Competitor B', 15], { lead: 'Most vascular surgeons', rest: 'use Competitor A', pattern: true }],
      ['NJ', true, 'gap', 'None in My targets', ['Dr. Naveen Schreiber', 'Uses Competitor A', 19], { lead: '4 of 9 cardiologists', rest: 'use Competitor A', pattern: true }],
      // Next door, no pattern: how few of the biggest specialty use a competitor.
      ['CT', false, 'plain', '', ['Dr. Nadim Sundberg', 'Uses Competitor B', 12], { lead: 'Only 1 of 8 interventionalists', rest: 'uses a competitor', pattern: false }],
      ['PA', false, 'plain', '', ['Dr. Yuki Vaccaro', 'Uses Competitor B', 18], { lead: 'None of its 5 cardiologists', rest: 'use a competitor', pattern: false }],
    ]);
    expect(territories.map((t) => t.reason)).toEqual(['Most vascular surgeons in New York use Competitor A.', 'Nobody in New Jersey is in My targets.', '', '']);
    // Screen readers hear each in a sentence or two.
    expect(territories.map((t) => t.words)).toEqual([
      'New York. Dr. Dorothy Baptiste uses Competitor B, up 15% on last year. Most vascular surgeons there use Competitor A.',
      'New Jersey. None of its 45 doctors are in My targets. Dr. Naveen Schreiber uses Competitor A, up 19% on last year. 4 of 9 cardiologists there use Competitor A.',
      'Connecticut, next door. Dr. Nadim Sundberg uses Competitor B, up 12% on last year. Only 1 of 8 interventionalists uses a competitor.',
      'Pennsylvania, next door. Dr. Yuki Vaccaro uses Competitor B, up 18% on last year. None of its 5 cardiologists use a competitor.',
    ]);
  });

  test('who to reach out to first is for a reason, not size: someone using a competitor’s products, else someone growing fast, whoever gained most', () => {
    for (const t of briefFor().territories) {
      const using = doctorsIn(t.state).filter((r) => !r.mine && r.entity.competitors?.length);
      expect(gained(t.first!.row)).toBe(Math.max(...using.map(gained)));
    }
    // With everyone in Connecticut using a competitor's products in My targets, it's whoever's growing fast.
    const starred = doctorsIn('CT')
      .filter((r) => r.entity.competitors?.length)
      .reduce((ws, r) => withTarget(ws, r.entity.id, true), freshWorkspace(today));
    const ct = briefFor(home, starred).territories.find((t) => t.state === 'CT')!;
    expect(ct.first).toMatchObject({ why: 'Growing fast', competitor: false });
    const growing = doctorsIn('CT', starred).filter((r) => !r.mine && (r.volume?.change ?? 0) >= 10);
    expect(gained(ct.first!.row)).toBe(Math.max(...growing.map(gained)));
    expect(ct.words).toMatch(/^Connecticut, next door\. Dr\. [^.]+ is growing fast, up \d+% on last year\. /);
  });

  test('Full list opens Targets on everyone where the people are: the rep’s own territory, or the state picked', () => {
    expect(readSearchLink(briefFor().find)).toEqual({ states: [], codes: 'all' });
    expect(readSearchLink(briefFor({ states: ['CT'], codes: 'all' }).find)).toEqual({ states: ['CT'], codes: 'all' });
    expect(readSearchLink(briefFor({ states: ['NJ'], codes: '33361' }).find)).toEqual({ states: ['NJ'], codes: '33361' });
  });

  test('in the rep’s own territory, hardly anyone in My targets is a gap, said before a competitor', () => {
    const doctors = doctorsIn('NJ').map((r) => r.entity.id);
    const nj = (starred: number) =>
      briefFor(home, doctors.slice(0, starred).reduce((ws, id) => withTarget(ws, id, true), freshWorkspace(today))).territories.find((t) => t.state === 'NJ');
    expect(nj(1)).toMatchObject({ tone: 'gap', gap: 'Only 1 in My targets', reason: 'Only 1 in New Jersey is in My targets.' });
    expect(nj(4)).toMatchObject({ tone: 'gap', gap: 'Only 4 in My targets', reason: 'Only 4 in New Jersey are in My targets.' });
    // A tenth of them in My targets, and it's the competitor's pattern.
    expect(nj(5)).toMatchObject({ tone: 'competitor', gap: '', reason: '4 of 9 cardiologists in New Jersey use Competitor A.' });
  });

  test('counts the procedures chosen: a pattern only where enough of a specialty use the same competitor, and elsewhere how many use any', () => {
    const tavr = briefFor({ states: ['NJ'], codes: '33361' }).territories;
    expect(tavr.map((t) => [t.state, t.tone, t.gap, t.first?.row.entity.name, t.first?.why, `${t.summary.lead} ${t.summary.rest}`])).toEqual([
      ['NY', 'competitor', '', 'Dr. Zachary Madsen', 'Uses Competitor A', '3 of 8 interventionalists use Competitor A'],
      ['NJ', 'gap', 'None in My targets', 'Dr. Benjamin Goldberg', 'Uses Competitor A', '2 of 5 cardiothoracic surgeons use a competitor'],
      // Fewer than 3 of any specialty, so everyone there.
      ['CT', 'plain', '', 'Dr. Nadim Sundberg', 'Uses Competitor B', '1 of 3 doctors uses a competitor'],
      ['PA', 'plain', '', 'Dr. Elliot Zubiri', 'Uses Competitor B', '1 of 3 doctors uses a competitor'],
    ]);
    expect(tavr[0].words).toBe('New York. Dr. Zachary Madsen uses Competitor A, up 10% on last year. 3 of 8 interventionalists there use Competitor A.');
  });
});

describe('who to add', () => {
  test('two who use a competitor and one growing fast, none in My targets, each with why, how much they do and the driving a visit adds', () => {
    const { people } = briefFor();
    expect(people.map((p) => [p.row.entity.id, `${p.lead}${p.rest}`, p.competitor, p.figure, p.change, p.driving])).toEqual([
      [VOLKOV, 'Uses Competitor B.', true, '650 a year', 15, '35 min more driving'],
      [ADELEKE, 'Uses Competitor B.', true, '620 a year', 10, '25 min more driving'],
      // How fast is in the figure, so the words say something else: there's business to win.
      [KOWALSKI, 'Growing fast, with no competitor yet.', false, '870 a year', 21, '30 min more driving'],
    ]);
    for (const { row } of people) expect(row.mine).toBe(false);
  });

  test('once the day has a visit, those near it say so, with the driving they add', () => {
    const one = addToPlan(freshWorkspace(today), day, VOLKOV, now);
    // As they were when it opened, so the rows don't move.
    const kept = briefFor(home, one, [VOLKOV, ADELEKE, KOWALSKI]).people;
    expect(kept.map((p) => [p.row.entity.id, `${p.lead}${p.rest}`, p.driving])).toEqual([
      [VOLKOV, 'Uses Competitor B.', '35 min more driving'],
      [ADELEKE, 'Uses Competitor B.', '40 min more driving'],
      [KOWALSKI, 'Growing fast, and near your visit to Dr. Volkov.', '10 min more driving'],
    ]);
    // Opened again, those on the way come first.
    const again = briefFor(home, one);
    expect(ids(again)).not.toContain(VOLKOV);
    expect(again.people.find((p) => p.row.entity.id === KOWALSKI)?.driving).toBe('10 min more driving');
  });

  test('leaves out anyone in My targets, in the day or reached in the last fortnight', () => {
    expect(ids(briefFor(home, withTarget(freshWorkspace(today), ADELEKE, true)))).not.toContain(ADELEKE);
    expect(ids(briefFor(home, addToPlan(freshWorkspace(today), day, ADELEKE, now)))).not.toContain(ADELEKE);
    // Emailed 13 days ago, a reply may still come; after a fortnight they're back.
    expect(ids(briefFor(home, emailed(VOLKOV, '2026-10-14')))).not.toContain(VOLKOV);
    expect(ids(briefFor(home, emailed(VOLKOV, '2026-10-13')))).toContain(VOLKOV);
  });

  test('in the state picked and for the procedures chosen', () => {
    expect(briefFor({ states: ['NJ'], codes: 'all' }).people.map((p) => [p.row.entity.name, `${p.lead}${p.rest}`])).toEqual([
      ['Dr. Vincent Fujita', 'Uses Competitor A.'],
      ['Dr. Ingrid Alvarado', 'Uses Competitor B.'],
      ['Dr. Caroline Oliveira', 'Growing fast, with no competitor yet.'],
    ]);
    // Few do TAVR in New Jersey, and the figures are theirs.
    expect(briefFor({ states: ['NJ'], codes: '33361' }).people.map((p) => [p.row.entity.name, `${p.lead}${p.rest}`, p.figure])).toEqual([
      ['Dr. Ingrid Alvarado', 'Uses Competitor B.', '90 a year'],
      ['Dr. Ayesha Esposito', 'Growing fast, with no competitor yet.', '50 a year'],
    ]);
    // Next door the driving can be long, in hours and minutes.
    expect(briefFor({ states: ['PA'], codes: 'all' }).people[0].driving).toBe('5 h 50 min more driving');
  });
});

describe('the rest of the brief', () => {
  test('over the people, when and where; under it all, what the figures count', () => {
    const brief = briefFor();
    expect([brief.heading, brief.figures]).toEqual(['Worth adding today', 'All procedures, Oct 2025 to Sep 2026, against the year before.']);
    expect(briefFor({ states: ['NJ'], codes: 'all' }).heading).toBe('Worth adding today in New Jersey');
    expect(briefFor({ states: ['NJ', 'NY'], codes: 'all' }).heading).toBe('Worth adding today');
    expect(briefFor({ states: ['PA', 'NJ'], codes: 'all' }).heading).toBe('Worth adding today in New Jersey and Pennsylvania');
    expect(briefFor({ states: ['NJ'], codes: '33361' }).figures).toBe('TAVR, Oct 2025 to Sep 2026, against the year before.');
    expect(briefFor(home, freshWorkspace(today), [], '2026-10-29').heading).toBe('Worth adding on Thursday');
  });

  test('folded away, what’s left in a few words, and all of it in a sentence or two', () => {
    const brief = briefFor();
    const why = 'Most vascular surgeons in New York use Competitor A. Nobody in New Jersey is in My targets.';
    expect([brief.short, brief.line]).toEqual(['3 to add today', `3 doctors are worth adding today. ${why}`]);
    // Who of them is in the day now, and who's left.
    const shown = ids(brief);
    const one = briefFor(home, addToPlan(freshWorkspace(today), day, VOLKOV, now), shown);
    expect([one.short, one.line]).toEqual(['2 more to add today', `You added Dr. Volkov. 2 more doctors are worth adding today. ${why}`]);
    const all = briefFor(home, shown.reduce((ws, id) => addToPlan(ws, day, id, now), freshWorkspace(today)), shown);
    expect([all.short, all.line]).toEqual(['All 3 added today', `You added Dr. Volkov, Dr. Adeleke and Dr. Kowalski. ${why}`]);
  });
});

describe('tapping a tile', () => {
  async function renderBrief() {
    const wrapper = ({ children }: { children: ReactNode }) => createElement(WorkspaceProvider, { today, now: () => now, children });
    const view = await renderHook(() => ({ ws: useWorkspace(), state: useDailyBrief(day, now) }), { wrapper });
    await waitFor(() => expect(view.result.current.state).toBeTruthy());
    return view;
  }

  test('shows who’s worth adding in that state, staying on Today, until it’s tapped again, whatever Targets shows', async () => {
    const view = await renderBrief();
    const state = () => view.result.current.state!;
    const names = () => state().brief.people.map((p) => p.row.entity.name);
    expect([state().picked, state().brief.heading]).toEqual([null, 'Worth adding today']);
    const yours = names();
    await act(async () => state().pick('CT'));
    expect([state().picked, state().brief.heading, names()]).toEqual(['CT', 'Worth adding today in Connecticut', ['Dr. Nadim Sundberg', 'Dr. Brigitte Siddiqui', 'Dr. Nobuko Reinholt']]);
    // Targets keeps its own chips: looking at another state there leaves Today as it was.
    await act(async () => view.result.current.ws.setPrefs({ states: ['PA'] }));
    expect(state().brief.heading).toBe('Worth adding today in Connecticut');
    // Tapped again, the rep's own territory, with the same people as before.
    await act(async () => state().pick(null));
    expect([state().picked, state().brief.heading, names()]).toEqual([null, 'Worth adding today', yours]);
  });
});
