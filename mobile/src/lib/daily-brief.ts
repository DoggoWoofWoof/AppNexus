// The daily brief at the top of Today, where the app opens (components/daily-brief.tsx).
// For each state of the territory and next door it says who to reach out to
// there and why: the doctor beyond My targets with the best reason, someone
// using a competitor's products, as there's business to win, else someone
// growing fast; in the rep's own states when hardly anyone there is in My
// targets; and competitors' products there, a pattern when enough of a specialty
// use the same one ("Most vascular surgeons use Competitor A"), or how few of its
// biggest specialty use any ("None of its 4 interventionalists use a competitor").
// Then three doctors beyond My targets worth adding to the day, in the rep's own
// territory or a state picked on its tile, two who use a competitor's products and
// one growing fast, each with why in a sentence and the driving a visit adds, and
// a link to everyone there on Targets. Its figures are for the procedures chosen
// with the chip on Targets. The sample's figures are a fixed year, the last four
// quarters against the four before. Fixed rules over the sample data, not AI.

import { canSeeOn } from './booking';
import { pickLabel } from './codes';
import { getEntity, getOrg, shortName, stateOf, STATES, YOUR_STATES } from './data';
import { FIGURES_YEAR } from './data/seed';
import { daysBetween, formatMinutes, formatNumber, fromIso, haversineKm, listJoin, lowerFirst, plural } from './format';
import { isOnSite, type Stop } from './plan';
import { DEFAULT_FILTERS, searchLink, type SearchRow } from './search';
import { specialists } from './specialties';
import type { Context } from './workspace';

/** A state of the territory or next door: who to reach out to there, and why. */
export interface BriefTerritory {
  /** Its letters, as the territory chip on Targets takes them: "NJ". */
  state: string;
  name: string;
  /** In the rep's own territory, or next door. */
  yours: boolean;
  /** In the rep's own states, when hardly anyone there is in My targets: "None in My targets", "Only 2 in My targets". */
  gap: string;
  /**
   * Who to reach out to there first, beyond My targets, and why in a few words:
   * someone using a competitor's products, "Uses Competitor B", else someone
   * growing fast, "Growing fast", and of those, whoever gained the most
   * procedures on last year. With that change in percent.
   */
  first: { row: SearchRow; why: string; competitor: boolean; change: number } | null;
  /**
   * Competitors' products there, who first, for the words in bold. A pattern when
   * enough of a specialty use the same one: "Most vascular surgeons" "use
   * Competitor A", or "4 of 9 cardiologists" "use Competitor A". Otherwise how few
   * of its biggest specialty use any: "None of its 4 interventionalists" "use a
   * competitor", or "Only 1 of 8 interventionalists" "uses a competitor".
   */
  summary: { lead: string; rest: string; pattern: boolean };
  /** Its colour: a gap in My targets, a competitor's pattern, or neither. */
  tone: 'gap' | 'competitor' | 'plain';
  /** Why to look there in a sentence of its own, for a gap or a competitor: "Nobody in New Jersey is in My targets." */
  reason: string;
  /** All of it in a sentence or two, for screen readers. */
  words: string;
}

/** A doctor beyond My targets worth adding to the day, and why. */
export interface BriefPerson {
  row: SearchRow;
  /** Why, in a few coloured words and the rest of a sentence: "Uses Competitor B" ", and is near your visit to Dr. Lee." */
  lead: string;
  rest: string;
  /** Whether the reason is a competitor's products. */
  competitor: boolean;
  /** How much they do: "690 a year", and the change on last year in percent. */
  figure: string;
  change: number;
  /** What a visit adds to the day's driving, as Add would put it in: "10 min more driving". */
  driving: string;
}

export interface DailyBrief {
  /** The states of the rep's own territory, then those next door, each with why to look there first. */
  territories: BriefTerritory[];
  /** Two who use a competitor's products and one of the fastest growing, each with a visit that fits the day. */
  people: BriefPerson[];
  /** Over the people: "Worth adding today", and where, when it isn't the rep's whole territory. */
  heading: string;
  /** Everyone where the people are, as a search link for Targets. */
  find: string;
  /** Folded away, what's left, in a few words: "2 more to add today". Empty with nothing to say. */
  short: string;
  /** What its figures count, and when: "All procedures, Oct 2025 to Sep 2026, against the year before." */
  figures: string;
  /**
   * The brief in a sentence or two, for when it's folded away: who of its people
   * are in the day now, how many are left, and why to look at a state.
   */
  line: string;
}

/** Growing at least this much on last year, in percent, counts as growing fast. */
const FAST = 10;
/** How many doctors make a pattern. */
const ENOUGH = 3;
/** Fewer than this share of a state's doctors in My targets, of the rep's own, is a gap. */
const GAP = 0.1;
/** The most minutes of driving a visit can add to the day and still be on the way. */
const ON_THE_WAY = 20;
/** Visits adding up to this many minutes of driving come before those further out. */
const NEARBY = 45;
/** Days after reaching someone before they're suggested again, as a reply or a visit may still come. */
const RESTING = 14;
/** This many years in practice or fewer is new in practice, when someone may still be settling on what to use. */
const NEW_IN_PRACTICE = 5;

const added = (r: SearchRow): number => (r.volume ? r.volume.year - r.volume.before : 0);
/** Uses a competitor's products, so there's business to win. */
const using = (r: SearchRow): boolean => !!r.entity.competitors?.length;
/** Growing fast with no competitor's products. */
const growing = (r: SearchRow): boolean => !using(r) && (r.volume?.change ?? 0) >= FAST;
/** A yearly count in round numbers, as it's only about that: "690". */
const about = (n: number): string => formatNumber(n < 100 ? Math.round(n / 5) * 5 : n < 1000 ? Math.round(n / 10) * 10 : Math.round(n / 100) * 100);

type BriefContext = Pick<Context, 'search' | 'planItemFor' | 'dayWord' | 'detour' | 'daySchedule' | 'lastInteraction' | 'today'>;

/**
 * The brief for a day, with its people in the states given, or the rep's own
 * territory with none, and its figures for the procedures chosen on Targets
 * (`chosen`). The people aren't in My targets or the day already, nor reached in
 * the last fortnight, and each can be seen that day in their usual times. Those
 * on the way come first, then those nearby, each the most gained on last year.
 * Given `keep`, the people are those, as they were, so adding someone on the
 * brief doesn't move the rows. `now` keeps a visit today after it.
 */
export function dailyBrief(ctx: BriefContext, day: string, chosen: { states: string[]; codes: string }, keep: string[] = [], now?: Date): DailyBrief {
  const states = chosen.states.length ? chosen.states : YOUR_STATES;
  // One search for every state, as a search looks at everyone: the states and the people come from it.
  const everywhere = ctx.search({ ...DEFAULT_FILTERS, states: STATES.map((s) => s.id), codes: chosen.codes }).filter((r) => r.volume);
  const territories = territoriesFor(everywhere);

  const recent = (id: string) => {
    const last = ctx.lastInteraction(id);
    return !!last && daysBetween(fromIso(last.date), ctx.today) < RESTING;
  };
  const fresh = (r: SearchRow) => !r.mine && !ctx.planItemFor(r.entity.id, day) && !recent(r.entity.id);
  // What a visit adds to the day, worked out once each, and only for those in the running.
  const detours = new Map<string, ReturnType<BriefContext['detour']>>();
  const detourOf = (r: SearchRow) => {
    if (!detours.has(r.entity.id)) detours.set(r.entity.id, canSeeOn(r.entity, day) ? ctx.detour(r.entity.id, day, now) : null);
    return detours.get(r.entity.id) ?? null;
  };
  const doctors = everywhere.filter((r) => states.includes(stateOf(r.entity)));
  const kept = keep.flatMap((id) => doctors.filter((r) => r.entity.id === id));
  let chosenRows = kept;
  if (!keep.length) {
    const band = (r: SearchRow) => {
      const minutes = detourOf(r)?.minutes ?? Infinity;
      return minutes <= ON_THE_WAY ? 0 : minutes <= NEARBY ? 1 : 2;
    };
    const ranked = (rows: SearchRow[]) =>
      rows
        .filter((r) => detourOf(r))
        .sort((a, b) => band(a) - band(b) || added(b) - added(a));
    const users = ranked(doctors.filter((r) => fresh(r) && using(r)));
    const risers = ranked(doctors.filter((r) => fresh(r) && growing(r)));
    // Two who use a competitor and one of the fastest growing, each filling in when the other runs short.
    const fromUsing = Math.max(2, 3 - risers.length);
    chosenRows = [...users.slice(0, fromUsing), ...risers.slice(0, 3 - Math.min(fromUsing, users.length))];
  }
  // Where the day's visits are, to say which one someone is near.
  const visits = ctx.daySchedule(day, now).stops.filter((s) => isOnSite(s.item));
  // What else is said of each, so two of them don't read the same.
  const said = new Set<string>();
  const people = chosenRows.map((row) => personFor(row, detourOf(row), visits, said));

  const dayWord = ctx.dayWord(day);
  const when = dayWord === 'today' || dayWord === 'tomorrow' ? dayWord : `on ${dayWord}`;
  // Where the people are, when it isn't the rep's own territory.
  const own = states.length === YOUR_STATES.length && states.every((s) => YOUR_STATES.includes(s));
  const where = own ? '' : ` in ${listJoin(STATES.filter((s) => states.includes(s.id)).map((s) => s.label))}`;
  // Who of them is in the day now, from here or anywhere else.
  const inDay = people.filter((p) => ctx.planItemFor(p.row.entity.id, day));
  const left = people.length - inDay.length;
  const why = territories.filter((t) => t.reason);
  const line = [
    inDay.length ? `You added ${listJoin(inDay.map((p) => shortName(p.row.entity)))}.` : '',
    left ? `${plural(left, inDay.length ? 'more doctor' : 'doctor')} ${left === 1 ? 'is' : 'are'} worth adding ${when}.` : '',
    ...why.map((t) => t.reason),
  ].filter(Boolean);
  const [first] = why;
  const short = people.length
    ? left
      ? `${left}${inDay.length ? ' more' : ''} to add ${when}`
      : `All ${people.length} added ${when}`
    : first
      ? `${first.name}: ${lowerFirst(first.tone === 'gap' ? first.gap : `${first.summary.lead} ${first.summary.rest}`)}`
      : '';
  return {
    territories,
    people,
    heading: `Worth adding ${when}${where}`,
    find: searchLink({ ...DEFAULT_FILTERS, states: chosen.states, codes: chosen.codes }),
    short,
    figures: `${pickLabel(chosen.codes)}, ${FIGURES_YEAR}, against the year before.`,
    line: line.join(' '),
  };
}

/**
 * Each state with doctors doing the procedures chosen: the rep's own first, then
 * those next door, and in each those with a reason to look first, then the biggest.
 */
function territoriesFor(everywhere: SearchRow[]): BriefTerritory[] {
  const all = STATES.flatMap((state) => {
    const rows = everywhere.filter((r) => stateOf(r.entity) === state.id);
    return rows.length ? [{ count: rows.length, territory: territory(state, rows) }] : [];
  });
  const ranked = (yours: boolean) =>
    all
      .filter((t) => t.territory.yours === yours)
      .sort((a, b) => Number(!!b.territory.reason) - Number(!!a.territory.reason) || b.count - a.count)
      .map((t) => t.territory);
  return [...ranked(true), ...ranked(false)];
}

/** A state at a glance: a gap in My targets in the rep's own, who to reach out to there first and why, and competitors' products there. */
function territory(state: { id: string; label: string }, rows: SearchRow[]): BriefTerritory {
  const yours = YOUR_STATES.includes(state.id);
  const mine = rows.filter((r) => r.mine).length;
  const gapped = yours && mine < rows.length * GAP;
  // Someone using a competitor's products first, as there's business to win, else someone growing fast.
  const beyond = rows.filter((r) => !r.mine);
  const best = (reason: (r: SearchRow) => boolean) => beyond.filter(reason).sort((a, b) => added(b) - added(a))[0];
  const top = best(using) ?? best(growing);
  const first = top
    ? { row: top, why: using(top) ? `Uses ${listJoin(top.entity.competitors ?? [])}` : 'Growing fast', competitor: using(top), change: Math.round(top.volume?.change ?? 0) }
    : null;
  const summary = competitorsIn(rows);
  const used = summary.pattern;
  const tone = gapped ? 'gap' : used ? 'competitor' : 'plain';

  const where = `${state.label}${yours ? '' : ', next door'}`;
  const trend = (change: number) => (change >= 1 ? `, up ${change}% on last year` : change <= -1 ? `, down ${-change}% on last year` : '');
  const gapWords = !gapped ? '' : mine ? `Only ${mine} of its ${plural(rows.length, 'doctor')} ${mine === 1 ? 'is' : 'are'} in My targets.` : `None of its ${plural(rows.length, 'doctor')} are in My targets.`;
  // "Dr. Dorothy Baptiste uses Competitor B, up 15% on last year."
  const firstWords = first ? `${first.row.entity.name} ${first.competitor ? lowerFirst(first.why) : 'is growing fast'}${trend(first.change)}.` : '';
  return {
    state: state.id,
    name: state.label,
    yours,
    gap: !gapped ? '' : mine ? `Only ${mine} in My targets` : 'None in My targets',
    first,
    summary: { lead: summary.lead, rest: summary.rest, pattern: !!used },
    tone,
    reason: gapped
      ? mine
        ? `Only ${mine} in ${state.label} ${mine === 1 ? 'is' : 'are'} in My targets.`
        : `Nobody in ${state.label} is in My targets.`
      : used
        ? `${summary.lead} in ${state.label} ${summary.rest}.`
        : '',
    // "Most vascular surgeons there use Competitor A.", or "None of its 4 interventionalists use a competitor."
    words: [`${where}.`, gapWords, firstWords, `${summary.lead}${used ? ' there' : ''} ${summary.rest}.`].filter(Boolean).join(' '),
  };
}

/**
 * Competitors' products in a state, as reps would say it, who first. Specialties
 * of a few doctors at least count; with none, everyone there. When enough of one
 * use the same competitor's, it's a pattern: "Most vascular surgeons" "use
 * Competitor A", or "4 of 9 cardiologists" "use Competitor A". Otherwise it's how
 * few of the biggest use any: "None of its 4 interventionalists" "use a
 * competitor", or "Only 1 of 8 interventionalists" "uses a competitor".
 */
function competitorsIn(rows: SearchRow[]): { lead: string; rest: string; pattern?: { competitor: string; specialty?: string } } {
  const specialtyOf = (r: SearchRow) => (r.entity.kind === 'hcp' ? r.entity.specialty : '');
  const groups = [...new Set(rows.map(specialtyOf))]
    .map((specialty) => ({ specialty, rows: rows.filter((r) => specialtyOf(r) === specialty) }))
    .filter((g) => g.specialty && g.rows.length >= ENOUGH)
    .sort((a, b) => b.rows.length - a.rows.length);
  const counted = groups.length ? groups : [{ specialty: '', rows }];
  const [best] = counted
    .flatMap((g) =>
      [...new Set(g.rows.flatMap((r) => r.entity.competitors ?? []))].map((competitor) => {
        const users = g.rows.filter((r) => r.entity.competitors?.includes(competitor)).length;
        return { ...g, competitor, users, share: users / g.rows.length };
      }),
    )
    .filter((c) => c.users >= ENOUGH)
    .sort((a, b) => b.share - a.share || b.users - a.users || a.competitor.localeCompare(b.competitor));
  if (best) {
    const lead = best.share > 0.5 ? `Most ${specialists(best.specialty)}` : `${best.users} of ${best.rows.length} ${specialists(best.specialty)}`;
    return { lead, rest: `use ${best.competitor}`, pattern: { competitor: best.competitor, specialty: best.specialty || undefined } };
  }
  const [{ specialty, rows: biggest }] = counted;
  const users = biggest.filter((r) => r.entity.competitors?.length).length;
  const share = users / biggest.length;
  const of = `${biggest.length} ${specialists(specialty)}`;
  // A state with one doctor doing the procedures chosen says so.
  if (biggest.length === 1) return { lead: 'Its one doctor', rest: users ? 'uses a competitor' : 'doesn’t use a competitor' };
  return {
    lead: !users ? `None of its ${of}` : share <= 0.25 ? `Only ${users} of ${of}` : share > 0.5 ? `Most ${specialists(specialty)}` : `${users} of ${of}`,
    rest: users === 1 ? 'uses a competitor' : 'use a competitor',
  };
}

/**
 * Why someone is worth adding, with how much they do and the driving a visit
 * adds: "Uses Competitor B", ", and is near your visit to Dr. Lee.", or for
 * someone growing fast, "Growing fast", ", with no competitor yet." What comes
 * after is the first reason more that's true and not already said of someone
 * before (`said`): near the day's visits, new in practice, so still settling on
 * what to use, or for someone growing fast, no competitor's products yet. How
 * much they do and how fast they're growing are in the figure under it.
 */
function personFor(row: SearchRow, detour: { minutes: number; stop: Stop } | null, visits: Stop[], said: Set<string>): BriefPerson {
  const uses = row.entity.competitors ?? [];
  const competitor = uses.length > 0;
  const near = detour && detour.minutes <= ON_THE_WAY ? nearWords(detour, visits) : '';
  const isNew = row.entity.kind === 'hcp' && row.entity.yearsInPractice <= NEW_IN_PRACTICE;
  const lead = competitor ? `Uses ${listJoin(uses)}` : 'Growing fast';
  // After "Growing fast" the "is" goes: "Growing fast, and near your visit to Dr. Volkov."
  const and = (words: string) => `, and ${competitor ? 'is ' : ''}${words}`;
  const options = [near ? and(near) : '', isNew ? and('new in practice') : '', competitor ? '' : ', with no competitor yet'].filter(Boolean);
  const also = options.find((o) => !said.has(`${lead}${o}`)) ?? '';
  if (also) said.add(`${lead}${also}`);
  return {
    row,
    lead,
    rest: `${also}.`,
    competitor,
    figure: `${about(row.volume?.year ?? 0)} a year`,
    change: Math.round(row.volume?.change ?? 0),
    driving: !detour ? '' : detour.minutes ? `${formatMinutes(detour.minutes)} more driving` : 'No more driving',
  };
}

/** "near your visit to Dr. Lee": the closest of the day's other visits to where they'd be seen. Empty when there are none. */
function nearWords(detour: { stop: Stop }, visits: Stop[]): string {
  const here = getOrg(detour.stop.item.siteId)?.coords;
  if (!here) return '';
  const [closest] = visits
    .filter((s) => s.item.targetId !== detour.stop.item.targetId)
    .map((s) => ({ item: s.item, km: haversineKm(here, getOrg(s.item.siteId)?.coords ?? here) }))
    .sort((a, b) => a.km - b.km);
  const who = closest && getEntity(closest.item.targetId);
  if (!who) return '';
  return closest.item.type === 'Meeting' || who.kind === 'hco' ? `near your meeting at ${who.name}` : `near your visit to ${shortName(who)}`;
}
