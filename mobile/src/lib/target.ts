// What someone's page adds under the brief, each as a short card in plain words:
// what was asked about them before, every visit and call so far, what was
// promised, who they refer to, similar doctors nearby who are in the same day,
// and how to get in. Fixed rules over the sample data and the rep's own plan,
// notes and chats, like the brief (lib/brief.ts).

import { bookingRoute, parseDays, siteOnDay, usualTimes, windowsFor } from './booking';
import type { ConversationItem, Turn } from './chat';
import { allHcps, destination, getEntity, getOrg, shortName, siteFor } from './data';
import { daysBetween, formatDate, fromIso, haversineKm, isoDate, plural, relativeDayLower, sum, toMinutes } from './format';
import type { Asked } from './saved';
import type { Confirms, Entity, FollowUp, Hcp, Interaction, Org, PlanItem, Workspace } from './types';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "A and B", or just "A". */
const both = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

/** Lower-cases the first letter of a name used mid-sentence, unless it's an abbreviation such as "PCI". */
const midSentence = (text: string) => (/^[A-Z][a-z]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text);

// ---- You asked before ------------------------------------------------------

/** Where a question was asked: a conversation now in History, or today's in the person's own Ask or the Ask tab. */
export type AskedWhere = { kind: 'history'; id: string } | { kind: 'chat' } | { kind: 'ask' };

export interface AskedBefore extends Asked {
  where: AskedWhere;
}

/**
 * The last few questions asked about someone, newest first, a question asked
 * twice once. Each opens the conversation it was asked in, to carry on: an
 * ended one goes back in its chat. `turnsOf` gives a conversation's questions.
 */
export function askedBefore(id: string, asked: Asked[], conversations: ConversationItem[], turnsOf: (c: ConversationItem) => Turn[], count = 3): AskedBefore[] {
  const seen = new Set<string>();
  return [...asked]
    .sort((a, b) => b.at - a.at)
    .filter((a) => {
      const key = a.question.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, count)
    .map((a) => {
      const c = conversations.find((item) => turnsOf(item).some((t) => t.at === a.at && t.question === a.question));
      const where: AskedWhere = c && !c.live ? { kind: 'history', id: c.id } : c && c.key !== id ? { kind: 'ask' } : { kind: 'chat' };
      return { ...a, where };
    });
}

// ---- Visits so far ---------------------------------------------------------

export type VisitOutcome = 'met' | 'not-in' | 'cancelled' | 'not-logged' | 'planned';

export interface VisitRow {
  day: string;
  time: string | null;
  type: string;
  outcome: VisitOutcome;
  /** "Met" or "Not in" (for a call, "Talked" or "No answer"), "Cancelled", "Not logged yet" or "Planned". */
  label: string;
  /** Where a moved visit was first planned: "Moved from Thu 15 Oct". */
  moved: string | null;
}

export interface VisitsSoFar {
  /** Visits still to come, soonest first, then the rest, newest first. */
  rows: VisitRow[];
  /** "Tried 3 times, met once." with anything cancelled or not logged. */
  summary: string;
  /** The day and time of day that has worked, when it has more than once: "Tuesday mornings". */
  worked: string | null;
}

const isCall = (type: string) => type === 'Phone call' || type === 'Video call';
const onSite = (type: string) => type === 'In-person visit' || type === 'Meeting';

function outcomeLabel(outcome: VisitOutcome, type: string): string {
  if (outcome === 'met') return isCall(type) ? 'Talked' : 'Met';
  if (outcome === 'not-in') return isCall(type) ? 'No answer' : 'Not in';
  if (outcome === 'cancelled') return 'Cancelled';
  return outcome === 'not-logged' ? 'Not logged yet' : 'Planned';
}

function planRow(day: string, item: PlanItem, todayIso: string): VisitRow {
  const outcome: VisitOutcome =
    item.status === 'done' ? (item.outcome === 'Attempted' ? 'not-in' : 'met') : item.status === 'cancelled' ? 'cancelled' : day < todayIso ? 'not-logged' : 'planned';
  const from = item.movedFrom;
  const moved = from ? `Moved from ${from.day === day ? (from.time ?? 'any time') : formatDate(from.day)}` : null;
  const label = outcome === 'cancelled' && item.cancelReason === 'Didn’t happen' ? 'Didn’t happen' : outcomeLabel(outcome, item.type);
  return { day, time: item.mode === 'timed' ? item.time : null, type: item.type, outcome, label, moved };
}

function noteRow(i: Interaction): VisitRow | null {
  const outcome: VisitOutcome | null = i.outcome === 'Met' ? 'met' : i.outcome === 'Attempted' || i.outcome === 'Left message' ? 'not-in' : null;
  if (!outcome) return null;
  return { day: i.date, time: null, type: i.type, outcome, label: i.outcome === 'Left message' ? 'Left a message' : outcomeLabel(outcome, i.type), moved: null };
}

const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
const partOfDay = (time: string) => (toMinutes(time) < 12 * 60 ? 'morning' : toMinutes(time) < 17 * 60 ? 'afternoon' : 'evening');

/** The key that has worked most, at least twice and more often than not. Rows are newest first, so a tie goes to the latest. */
function mostWorked(rows: VisitRow[], keyOf: (r: VisitRow) => string | null): string | null {
  const tally = new Map<string, { met: number; missed: number }>();
  for (const r of rows) {
    const key = keyOf(r);
    if (!key || (r.outcome !== 'met' && r.outcome !== 'not-in')) continue;
    const t = tally.get(key) ?? { met: 0, missed: 0 };
    if (r.outcome === 'met') t.met++;
    else t.missed++;
    tally.set(key, t);
  }
  let best: [string, number] | null = null;
  for (const [key, t] of tally) if (t.met >= 2 && t.met > t.missed && (!best || t.met > best[1])) best = [key, t.met];
  return best?.[0] ?? null;
}

/**
 * Every planned visit and call with someone, and the visits and calls the rep
 * noted without a plan, with what happened. A note on the same day as a planned
 * visit of the same kind is that visit, logged. Emails and the team's notes aren't visits of the rep's.
 */
export function visitsSoFar(id: string, ws: Pick<Workspace, 'plans' | 'interactions'>, today: Date): VisitsSoFar {
  const todayIso = isoDate(today);
  const planned = Object.entries(ws.plans).flatMap(([day, items]) => items.filter((i) => i.targetId === id).map((item) => planRow(day, item, todayIso)));
  const sameVisit = (a: VisitRow, b: VisitRow) => a.day === b.day && (isCall(a.type) ? isCall(b.type) : onSite(a.type) && onSite(b.type));
  const noted = ws.interactions
    .filter((i) => !i.deleted && i.author === 'You' && (i.targetId === id || i.attendees.includes(id)) && i.type !== 'Email')
    .flatMap((i) => noteRow(i) ?? [])
    .filter((r) => !planned.some((p) => sameVisit(p, r)));
  const all = [...planned, ...noted];
  const ahead = all.filter((r) => r.outcome === 'planned').sort((a, b) => a.day.localeCompare(b.day) || (a.time ?? '').localeCompare(b.time ?? ''));
  const behind = all.filter((r) => r.outcome !== 'planned').sort((a, b) => b.day.localeCompare(a.day) || (b.time ?? '').localeCompare(a.time ?? ''));

  const tries = behind.filter((r) => r.outcome === 'met' || r.outcome === 'not-in').length;
  const met = behind.filter((r) => r.outcome === 'met').length;
  const cancelled = behind.filter((r) => r.outcome === 'cancelled').length;
  const notLogged = behind.filter((r) => r.outcome === 'not-logged').length;
  const summary = [
    tries ? `Tried ${times(tries)}, ${met ? `met ${times(met)}` : 'not met yet'}.` : 'Not met yet.',
    cancelled ? `${cancelled} ${cancelled === 1 ? 'was' : 'were'} cancelled.` : '',
    notLogged ? `${notLogged} ${notLogged === 1 ? 'wasn’t' : 'weren’t'} logged.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const weekday = (r: VisitRow) => WEEKDAYS[fromIso(r.day).getDay()];
  const worked =
    mostWorked(behind, (r) => (r.time ? `${weekday(r)} ${partOfDay(r.time)}s` : null)) ??
    mostWorked(behind, (r) => `${weekday(r)}s`) ??
    mostWorked(behind, (r) => (r.time ? `${partOfDay(r.time)}s`.replace(/^./, (c) => c.toUpperCase()) : null));
  return { rows: [...ahead, ...behind], summary, worked };
}

// ---- Promised --------------------------------------------------------------

/** How late a promise is, or when it's due: "3 days late", "Due today", "Due in 3 days". */
export function promiseDue(f: FollowUp, today: Date): { text: string; tone: 'late' | 'today' | 'later' } {
  const late = daysBetween(fromIso(f.due), today);
  if (late > 0) return { text: `${plural(late, 'day')} late`, tone: 'late' };
  return { text: `Due ${relativeDayLower(f.due, today)}`, tone: late === 0 ? 'today' : 'later' };
}

// ---- Which card a link opens ----------------------------------------------

/** The cards that open in full. */
export type CardId = 'followups' | 'notes' | 'visits' | 'volumes' | 'refer' | 'leakage' | 'doctors' | 'people' | 'system' | 'details';

/** The card a link asks for, by the sections the old profile tabs had (links from Ask still use them). */
export function cardFor(entity: Entity, section?: string): CardId | undefined {
  if (section === 'activity') return 'notes';
  if (section === 'volumes' || section === 'details') return section;
  if (section === 'network') return entity.kind === 'hcp' ? 'refer' : 'doctors';
  if (section === 'leakage') return entity.kind === 'hcp' ? 'refer' : 'leakage';
  return undefined;
}

// ---- Who they refer to -----------------------------------------------------

export interface ReferralRow {
  name: string;
  count: number;
  reason?: string;
  /** A doctor in the book, whose page the row opens. */
  entity: Entity | null;
  /** A centre outside the system. */
  outside: boolean;
}

/** Where a doctor's patients go, by doctor or centre, most first, with a line on how many left the system. */
export function whoTheyReferTo(hcp: Hcp): { rows: ReferralRow[]; summary: string } | null {
  const rows = hcp.referrals.outbound
    .map((r): ReferralRow => {
      const peer = r.hcpId ? getEntity(r.hcpId) : null;
      return { name: r.ref ? destination(r.ref).name : peer ? shortName(peer) : (r.label ?? 'Elsewhere'), count: r.count, reason: r.reason, entity: peer, outside: !!r.ref };
    })
    .sort((a, b) => b.count - a.count);
  if (!rows.length) return null;
  const total = sum(rows.map((r) => r.count));
  const outside = sum(rows.filter((r) => r.outside).map((r) => r.count));
  return {
    rows,
    summary: `${plural(total, 'patient')} sent on in 12 months. ${outside ? `${outside} went outside the system.` : 'All stayed in the system.'}`,
  };
}

// ---- Similar doctors nearby ------------------------------------------------

/** How close "nearby" is, straight line, between where each works that day. */
export const NEARBY_KM = 3;

export interface SimilarDoctor {
  hcp: Hcp;
  /** Why they're like them: "Also does PCI", "Also in cardiology", "Also sees coronary artery disease". */
  why: string;
  km: number;
  /** Where they are that day. */
  site: Org;
  /** Their usual times that day: "14:00–17:00". */
  hours: string;
}

/** A procedure family without how they take part, so "TAVR (co-operator)" is TAVR. */
const family = (name: string) => name.replace(/\s*\(.*\)$/, '');

/** Where a doctor is on a day: their visit's site if they're in the plan, else where they work that weekday, else their main site. */
export function siteThatDay(hcp: Hcp, ws: Pick<Workspace, 'plans'>, day: string): Org {
  const theirs = (ws.plans[day] ?? []).find((i) => i.targetId === hcp.id && i.status !== 'cancelled');
  return siteFor(hcp, theirs?.siteId ?? siteOnDay(hcp, fromIso(day).getDay()) ?? undefined);
}

/**
 * Up to three doctors like this one who work within NEARBY_KM of them on a day
 * and are usually free to be seen then, most alike first, then nearest. Alike
 * means the same procedures or specialty, and less so the same main conditions
 * (their two biggest diagnoses). Anyone already in that day's plan is left out,
 * apart from `keep` (people just added from this list).
 */
export function similarNearby(hcp: Hcp, ws: Pick<Workspace, 'plans'>, day: string, { keep = [], count = 3 }: { keep?: string[]; count?: number } = {}): SimilarDoctor[] {
  const weekday = fromIso(day).getDay();
  const plan = ws.plans[day] ?? [];
  const from = siteThatDay(hcp, ws, day);
  const inPlan = new Set(plan.map((i) => i.targetId).filter((id) => !keep.includes(id)));
  const families = (h: Hcp) => (h.procedures ?? []).map((p) => family(p.family));
  const conditions = (h: Hcp) => h.diagnoses.slice(0, 2).map((d) => d.name);
  const mine = families(hcp);

  return allHcps()
    .filter((o) => o.id !== hcp.id && !inPlan.has(o.id))
    .flatMap((o) => {
      const siteId = siteOnDay(o, weekday);
      const site = siteId ? getOrg(siteId) : null;
      const hours = windowsFor(o).filter((w) => parseDays(w.days).has(weekday));
      if (!site || !hours.length) return [];
      const km = haversineKm(from.coords, site.coords);
      const shared = mine.filter((f) => families(o).includes(f));
      const same = o.specialty === hcp.specialty;
      const sees = conditions(hcp).filter((c) => conditions(o).includes(c));
      const score = (same ? 3 : 0) + 2 * shared.length + sees.length;
      if (km > NEARBY_KM || !score) return [];
      const why = shared.length
        ? `Also does ${both(shared.slice(0, 2).map(midSentence))}`
        : same
          ? `Also in ${hcp.specialty.toLowerCase()}`
          : `Also sees ${midSentence(sees[0])}`;
      return [{ hcp: o, why, km, site, hours: hours.map((w) => `${w.from}–${w.to}`).join(' or '), score }];
    })
    .sort((a, b) => b.score - a.score || a.km - b.km)
    .slice(0, count)
    .map(({ score: _score, ...d }) => d);
}

// ---- How to get in ---------------------------------------------------------

export interface WayIn {
  /** Who books their time. */
  books: string;
  /** How they like to be asked, from the rep's notes. */
  reach: string | null;
  /** When they can usually be seen: "Usually Tue/Thu 07:30–08:30". */
  best: string;
  /** Whether they usually confirm, and what to do about it. */
  confirms: string | null;
}

const CONFIRMS: Record<Confirms, string> = {
  usually: 'Usually confirms a booked time.',
  sometimes: 'Sometimes confirms. Check the day before.',
  rarely: 'Rarely confirms. Call that morning to check they’re in.',
};

/** Who books, how they like to be asked, when, and whether they usually confirm. */
export function howToGetIn(entity: Entity): WayIn {
  const access = entity.access ?? null;
  const confirms = access ? CONFIRMS[access.confirms] : null;
  if (entity.kind === 'hco') {
    const gatekeeper = entity.executives.find((e) => e.role === 'Gatekeeper');
    return { books: gatekeeper ? `${gatekeeper.name}, ${gatekeeper.title}` : 'The main line', reach: access?.reach ?? null, best: usualTimes(entity), confirms };
  }
  const route = bookingRoute(entity);
  const books = entity.contact.assistant ?? (route.kind === 'email address' ? 'They book their own time, by email' : 'The front desk, on the office phone');
  return { books, reach: access?.reach ?? null, best: usualTimes(entity), confirms };
}
