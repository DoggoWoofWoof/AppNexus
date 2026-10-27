// Today's review (components/day-review.tsx): the day's people in a paragraph,
// in the order the rep sees them, under the daily brief once anyone is in the
// day. It opens with the day in a sentence ("Today you're seeing four doctors,
// three in person and one by phone"), then says who each person is and why they
// matter: a competitor's products, patients they send to others in the day or to
// somewhere outside, a follow-up due, a time not confirmed. The same facts are
// the labels on their stops (`stopLabels`), in the same colours: gold for what
// to do today, rose for a competitor's products and patients going elsewhere,
// green for what's working. Fixed rules over the sample data, not AI.

import { volumeIn, type Volume } from './codes';
import { getEntity, getOrg, shortName, siteFor } from './data';
import { DESTINATIONS } from './data/orgs';
import { daysBetween, formatNumber, fromIso, fromMinutes, listJoin, lowerFirst, plural } from './format';
import { isOnSite } from './plan';
import { specialist, specialists } from './specialties';
import type { Entity, PlanItem, VisitType } from './types';
import type { Context } from './workspace';

/** A few words of the review, and how they stand out: a name in bold, or a fact in its label's colour. */
export interface ReviewBit {
  text: string;
  tone?: 'name' | 'warn' | 'rose' | 'success';
}

/** A label on a stop, in the colour of its kind of fact. */
export interface StopLabel {
  label: string;
  tone: 'warn' | 'rose' | 'success' | 'neutral';
  /** For someone new to you, the change on last year in percent, shown after the label with an arrow. */
  change?: number;
}

/** What matters about someone in the day, said in the review and on their stop. */
interface Facts {
  who: Entity;
  /** Their earliest follow-up due by the day, how it's said in the review, and how many days late it is today. */
  due: { what: string; late: number; on: string } | null;
  uses: string[];
  /** Patients a year they send to others in the day, and who, when it's enough to matter. */
  toDay: { count: number; names: string[]; surnames: string[] } | null;
  /** The place outside the system they send the most patients to a year, when it's enough to matter. */
  away: { count: number; ref: string } | null;
  /** Nothing logged with them yet. */
  isNew: boolean;
  volume: Volume | null;
}

/** Patients a year sent somewhere that matter: about one a month. */
const MONTHLY = 10;
/** Growing at least this much on last year, in percent, is worth saying. */
const FAST = 10;

type ReviewContext = Pick<Context, 'dayPlan' | 'daySchedule' | 'dayWord' | 'followUpsFor' | 'lastInteraction' | 'today' | 'ws'>;

const NUMBERS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
/** "four", or 12 past ten. */
const count = (n: number): string => NUMBERS[n] ?? String(n);
/** "an interventional cardiologist", "a cardiologist". */
const withA = (words: string): string => `${/^[aeiou]/i.test(words) ? 'an' : 'a'} ${words}`;
/** A yearly count in round numbers: "about 690". */
const about = (n: number): string => formatNumber(n < 100 ? Math.round(n / 5) * 5 : n < 1000 ? Math.round(n / 10) * 10 : Math.round(n / 100) * 100);
/** "Patel" for Dr. Maya Patel. */
const surname = (entity: Entity): string => entity.name.split(' ').pop() ?? entity.name;

/** How each way of reaching someone is said: after "with", and after "Then". */
const HOW: Record<VisitType, { noun: string; verb: string }> = {
  'In-person visit': { noun: '', verb: 'you see ' },
  Meeting: { noun: 'a meeting with ', verb: 'you meet ' },
  'Phone call': { noun: 'a call to ', verb: 'you call ' },
  'Video call': { noun: 'a video call with ', verb: 'you have a video call with ' },
  Email: { noun: 'an email to ', verb: 'you email ' },
};

/**
 * A follow-up as the thing that's due: "Send procedure mix vs. peers report" is
 * "the procedure mix vs. peers report", "Call about ablation referrals" is "the
 * call about ablation referrals", and anything else in quotes.
 */
function dueWords(text: string): string {
  const call = /^call (about|to|with|re:?) (.+)$/i.exec(text);
  if (call) return `the call ${call[1].toLowerCase()} ${call[2]}`;
  const thing = /^(send|share|bring|draft|prepare|email) (?:(?:the|a|an) )?(.+)$/i.exec(text);
  return thing ? `the ${thing[2]}` : `“${text}”`;
}

/** What matters about each person in the day, in the order they're seen. */
function factsFor(ctx: ReviewContext, day: string, items: PlanItem[]): Facts[] {
  const ids = items.map((i) => i.targetId);
  return items.flatMap((item) => {
    const who = getEntity(item.targetId);
    if (!who) return [];
    const [first] = ctx
      .followUpsFor(who.id)
      .filter((f) => !f.done && f.due <= day)
      .sort((a, b) => a.due.localeCompare(b.due));
    const outbound = who.kind === 'hcp' ? who.referrals.outbound : [];
    const inDay = outbound.filter((r) => r.hcpId && r.hcpId !== who.id && ids.includes(r.hcpId));
    const people = inDay.flatMap((r) => {
      const to = getEntity(r.hcpId ?? '');
      return to ? [to] : [];
    });
    const sent = inDay.reduce((total, r) => total + r.count, 0);
    const [away] = outbound.filter((r) => r.ref && DESTINATIONS[r.ref] && r.count >= MONTHLY).sort((a, b) => b.count - a.count);
    return [
      {
        who,
        due: first ? { what: dueWords(first.text), late: Math.max(0, daysBetween(fromIso(first.due), ctx.today)), on: first.due } : null,
        uses: who.competitors ?? [],
        toDay: people.length && sent >= MONTHLY ? { count: sent, names: people.map(shortName), surnames: people.map(surname) } : null,
        away: away?.ref ? { count: away.count, ref: away.ref } : null,
        isNew: !ctx.lastInteraction(who.id),
        volume: volumeIn(who, ctx.ws.prefs.codes),
      },
    ];
  });
}

/** The day's visits, cancelled ones left out, in the order Today shows them. */
const visitsOn = (ctx: ReviewContext, day: string, now?: Date): PlanItem[] => ctx.dayPlan(day, now).filter((i) => i.status !== 'cancelled');

/**
 * The labels on each stop, by visit: a follow-up due or late (gold), a
 * competitor's products and patients sent somewhere outside (rose), patients sent
 * to others in the day (green), and for someone new to you how much they do.
 */
export function stopLabels(ctx: ReviewContext, day: string, now?: Date): Map<string, StopLabel[]> {
  const items = visitsOn(ctx, day, now);
  const facts = factsFor(ctx, day, items);
  return new Map(
    items.map((item) => {
      const f = facts.find((x) => x.who.id === item.targetId);
      if (!f || item.status !== 'planned') return [item.id, []];
      const labels: StopLabel[] = [];
      if (f.due) labels.push({ label: f.due.late ? `${plural(f.due.late, 'day')} late` : `Due ${ctx.dayWord(f.due.on)}`, tone: 'warn' });
      if (f.uses.length) labels.push({ label: `Uses ${listJoin(f.uses)}`, tone: 'rose' });
      if (f.away) labels.push({ label: `Sends ${f.away.count} a year to ${DESTINATIONS[f.away.ref].short}`, tone: 'rose' });
      if (f.toDay) labels.push({ label: `Sends ${f.toDay.count} a year to ${listJoin(f.toDay.surnames)}`, tone: 'success' });
      if (f.isNew && f.volume) labels.push({ label: `${about(f.volume.year)} a year`, tone: 'neutral', change: Math.round(f.volume.change ?? 0) });
      return [item.id, labels];
    }),
  );
}

/**
 * The day's people in a paragraph, in the order they're seen, as bits to show
 * names in bold and the facts that matter in colour; null with nobody in the day.
 */
export function dayReview(ctx: ReviewContext, day: string, now?: Date): ReviewBit[] | null {
  const items = visitsOn(ctx, day, now);
  if (!items.length) return null;
  const starts = new Map(ctx.daySchedule(day, now).stops.map((s) => [s.item.id, s.start]));
  const facts = factsFor(ctx, day, items);
  const n = facts.length;
  const dayWord = ctx.dayWord(day);
  const When = dayWord === 'today' ? 'Today' : dayWord === 'tomorrow' ? 'Tomorrow' : `On ${dayWord}`;
  const bits: ReviewBit[] = [];
  const say = (text: string, tone?: ReviewBit['tone']) => bits.push({ text, tone });

  // Places outside the system two or more of them send patients to, said once for them all at the end.
  const together = Object.keys(DESTINATIONS).flatMap((ref) => {
    const senders = facts.filter((f) => f.who.kind === 'hcp' && f.who.referrals.outbound.some((r) => r.ref === ref && r.count >= MONTHLY / 2));
    const total = senders.reduce((sum, f) => sum + (f.who.kind === 'hcp' ? f.who.referrals.outbound.filter((r) => r.ref === ref).reduce((t, r) => t + r.count, 0) : 0), 0);
    return senders.length >= 2 && total >= MONTHLY ? [{ ref, senders, total }] : [];
  });
  const saidTogether = (f: Facts) => together.some((t) => t.ref === f.away?.ref && t.senders.includes(f));

  // One specialty for all the doctors is said once, at the start: "three interventional cardiologists".
  const specialties = new Set(facts.flatMap((f) => (f.who.kind === 'hcp' ? [f.who.specialty] : [])));
  const shared = n > 1 && specialties.size === 1 && facts.filter((f) => f.who.kind === 'hcp').length > 1 ? [...specialties][0] : '';

  // The day in a sentence: how many, and how they're seen.
  const allNew = n > 1 && facts.every((f) => f.isNew);
  if (n === 1) {
    const [item] = items;
    const kind = isOnSite(item) ? 'visit' : item.type === 'Email' ? 'email' : 'call';
    const time = timeWords(item, starts.get(item.id));
    say(`${When} you have one ${kind}${time ? `, ${time}` : ''}. `);
  } else {
    const doctors = facts.filter((f) => f.who.kind === 'hcp').length;
    const accounts = n - doctors;
    const whom = listJoin([doctors ? `${count(doctors)} ${shared ? specialists(shared) : doctors === 1 ? 'doctor' : 'doctors'}` : '', accounts ? `${count(accounts)} ${accounts === 1 ? 'account' : 'accounts'}` : ''].filter(Boolean));
    const ways = [
      { n: items.filter(isOnSite).length, words: 'in person' },
      { n: items.filter((i) => i.type === 'Phone call').length, words: 'by phone' },
      { n: items.filter((i) => i.type === 'Video call').length, words: 'by video' },
      { n: items.filter((i) => i.type === 'Email').length, words: 'by email' },
    ].filter((w) => w.n);
    const all = n === 2 ? 'both' : 'all';
    const how = ways.length > 1 ? listJoin(ways.map((w) => `${count(w.n)} ${w.words}`)) : `${all} ${ways[0]?.words ?? 'in person'}`;
    say(`${When} you’re seeing ${whom}, ${how}${allNew ? `${ways.length > 1 ? ',' : ' and'} ${all} new to you` : ''}. `);
  }

  // The busiest doctor of the day, said beside their name.
  const doctors = facts.filter((f) => f.who.kind === 'hcp' && f.volume);
  const busiest = doctors.length > 1 && facts.filter((f) => f.who.kind === 'hcp').length === doctors.length ? [...doctors].sort((a, b) => (b.volume?.year ?? 0) - (a.volume?.year ?? 0))[0] : null;
  const seenUses = new Set<string>();

  facts.forEach((f, i) => {
    const item = items[i];
    const how = HOW[item.type];
    const time = timeWords(item, starts.get(item.id));
    const meeting = item.type === 'Meeting' && f.who.kind === 'hco' ? 'a meeting at ' : how.noun;
    if (n === 1) {
      // One person: who they are, as a sentence of its own.
    } else if (i === 0) {
      say(`You start${time && item.type !== 'Email' ? ` ${time}` : ''} with ${meeting}`);
    } else if (i === n - 1) {
      say(`You finish with ${meeting}`);
    } else if (i === 1) {
      say(`Next is ${meeting}`);
    } else {
      say(`Then ${item.type === 'Meeting' && f.who.kind === 'hco' ? 'you meet at ' : how.verb}`);
    }
    say(shortName(f.who), 'name');

    // Who they are: "an interventional cardiologist at Mount Sinai Hospital", or an
    // account's kind; with one specialty for all the doctors, just where they are.
    const site = isOnSite(item) && item.siteId !== f.who.id ? getOrg(item.siteId)?.name : f.who.kind === 'hcp' ? siteFor(f.who).name : '';
    const at = site ? ` at ${site}` : '';
    const rank = f === busiest ? `the ${doctors.length === 2 ? 'busier of the two' : `busiest of the ${count(doctors.length)}`}` : '';
    if (shared && f.who.kind === 'hcp') {
      say(`${at}${rank ? `, ${rank}` : ''}`);
    } else {
      const role = f.who.kind === 'hcp' ? `${withA(specialist(f.who.specialty))}${at}` : withA(lowerFirst(f.who.typeDetail));
      say(`${n === 1 ? ' is' : ','} ${role}${rank ? ` and ${rank}` : ''}`);
    }

    // Who they are to the rep, each a clause: new to you, a competitor's products, who they send patients to, and how much they do.
    const clauses: ReviewBit[][] = [];
    if (f.isNew && !allNew) clauses.push([{ text: 'is new to you' }]);
    if (f.uses.length) {
      const also = f.uses.some((c) => seenUses.has(c)) ? 'also ' : '';
      clauses.push([{ text: also }, { text: `uses ${listJoin(f.uses)}`, tone: 'rose' }]);
      f.uses.forEach((c) => seenUses.add(c));
    }
    if (f.toDay) clauses.push([{ text: 'sends ' }, { text: `${f.toDay.count} patients a year`, tone: 'success' }, { text: ` to ${listJoin(f.toDay.names)}` }]);
    if (f.away && !saidTogether(f)) clauses.push([{ text: 'sends ' }, { text: `${f.away.count} patients a year`, tone: 'rose' }, { text: ` to ${DESTINATIONS[f.away.ref].name}` }]);
    if (f.isNew && f.volume) {
      const change = Math.round(f.volume.change ?? 0);
      clauses.push([{ text: `does about ${about(f.volume.year)} procedures a year` }, ...(change >= FAST ? [{ text: ', ' }, { text: `up ${change}%`, tone: 'success' as const }] : [])]);
    }
    if (clauses.length) {
      say(n === 1 ? ' who ' : ', who ');
      clauses.forEach((clause, c) => {
        if (c) say(c === clauses.length - 1 ? ' and ' : ', ');
        clause.forEach((b) => b.text && say(b.text, b.tone));
      });
    }

    // What needs doing about the visit: a follow-up due, or a time not confirmed.
    const status: ReviewBit[][] = [];
    if (f.due && item.status === 'planned') {
      status.push([{ text: `${f.due.what} is ` }, { text: f.due.late ? `${plural(f.due.late, 'day')} late` : `due ${ctx.dayWord(f.due.on)}`, tone: 'warn' }]);
    }
    if (item.booking === 'requested' && item.status === 'planned') status.push([{ text: `${item.time ?? 'the time'} isn’t confirmed yet`, tone: 'warn' }]);
    status.forEach((s, c) => {
      say(c ? ', and ' : '; ');
      s.forEach((b) => say(b.text, b.tone));
    });
    say('. ');
  });

  // Patients two or more of them send to the same place outside, said once.
  together.forEach((t) => {
    const place = DESTINATIONS[t.ref];
    say(`Between them, ${listJoin(t.senders.map((f) => shortName(f.who)))} send `);
    say(`${t.total} patients a year`, 'rose');
    say(` to ${place.name}, ${withA(lowerFirst(place.note))}: ask ${t.senders.length === 2 ? 'both' : 'them all'} why. `);
  });
  // Without the space after the last sentence.
  const last = bits[bits.length - 1];
  last.text = last.text.trimEnd();
  return bits.filter((b) => b.text);
}

/** "at 10:00" for a visit with a time, "at about 10:45" for an "Any time" one, worked out from the day. */
function timeWords(item: PlanItem, start: number | undefined): string {
  if (item.mode === 'timed' && item.time) return `at ${item.time}`;
  return start == null ? '' : `at about ${fromMinutes(start)}`;
}
