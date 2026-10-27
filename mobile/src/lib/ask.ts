// Ask Field Pro: answers plain-language questions from the rep's own book.
// Ported from the prototype's demo/js/ask.js. Intents are matched with keywords
// and answers are worked out from the sample data; the real version sends the
// question to a model that calls the same DocNexus services and returns this shape.
//
// A chat can be about one person or account (`about` with `scoped`), as on an
// HCP's profile: every question is then about them unless it names someone else.
//
// A question that asks for a list, such as "cardiologists in NJ using Competitor A",
// is read as Targets reads what's typed (lib/target-query.ts) and answered with the
// same search: the first few here, and a link that opens all of them in Targets.

import { buildBrief, outcomeWord, visitWhen } from './brief';
import { accountsByPatientsLost, allHcps, allOrgs, destination, getEntity, getOrg, hcpsAt, patientsLost, primaryOrg, procedureYoy, proceduresOf, referredOut, shortName, siteFor, STATES, testsOf, topReferrersOut } from './data';
import { DATA_PERIOD, PRIOR_PERIOD } from './data/seed';
import { addSeries } from './data/series';
import { canSeeOn, usualTimes } from './booking';
import { pickLabel } from './codes';
import { addDays, changeWords, formatDate, formatKm, formatNumber, haversineKm, isoDate, listJoin, plural, relativeDay, relativeDayLower, sum } from './format';
import { PREP_QUESTION, prepAnswer } from './prep';
import { DEFAULT_FILTERS, searchLink, SORTS, type Filters } from './search';
import { describeSearch, readTargetQuery } from './target-query';
import type { Entity, PlanItem, Signal } from './types';
import type { Context } from './workspace';

export type Intent =
  | 'contact'
  | 'history'
  | 'followups'
  | 'inbound'
  | 'referrals'
  | 'mix'
  | 'leakage'
  | 'decline'
  | 'growth'
  | 'find'
  | 'trend'
  | 'where'
  | 'peers'
  | 'near'
  | 'suggest'
  | 'visit'
  | 'plan'
  | 'people'
  | 'points'
  | 'brief'
  | 'prep'
  | 'saved'
  | 'week'
  | 'search';

/** Where a row or the next step leads: a profile (at a section) or another tab. */
export type AskLink =
  | { kind: 'profile'; id: string; section?: string }
  /** A search to show in Targets, as `searchLink` in lib/search.ts writes it. */
  | { kind: 'targets'; find: string }
  | { kind: 'book'; id: string }
  | { kind: 'tab'; tab: 'activity' | 'today' | 'targets' | 'saved' }
  | { kind: 'saved'; id: string }
  /**
   * Puts Ask's words in someone's Summary (lib/prep.ts). An answer kept from
   * before the Summary was one paragraph has `points` instead, added after the rep's words.
   */
  | { kind: 'prep'; id: string; text?: string; points?: string[] };

export interface AnswerRow {
  /** The person or account the row opens. */
  id?: string;
  title: string;
  sub?: string;
  figure: string;
  /** The change on last year in percent, as the trend arrow (`Delta`): in the figure's place when there's no figure, else under the title. */
  change?: number;
  tone?: 'warn';
}

export interface Answer {
  intent: Intent;
  /** Who the answer is about, so "where does she refer?" can follow it. */
  about: string | null;
  /** Who the question was about, named or followed on from: what a saved copy is titled after. */
  subject: string | null;
  /**
   * What the answer covers, e.g. "Procedures · Sample data, Oct 2025 to Sep 2026".
   * Every answer from the data ends with SAMPLE, or DATA_PERIOD when it gives figures.
   */
  scope: string[];
  /** One sentence that answers the question. */
  summary: string;
  rows: AnswerRow[];
  /** True when rows are labelled facts rather than a ranked list. */
  facts?: boolean;
  /** One next step. */
  doThis?: { text: string; label: string; link: AskLink } | null;
  /** Questions to ask next. */
  next: string[];
  /**
   * What the answer asks at its end, and the reply that says yes: "Add Dr. Volkov
   * to today?" and "Yes, add to today". Saying yes adds them (lib/chat.tsx).
   */
  offer?: { id: string; day: string; question: string; yes: string };
  /** Who saying yes put in the day, and which day, so the chat goes to Today to show them. */
  added?: { id: string; day: string };
  unknown?: boolean;
  /** What a saved copy is called, when the kind of question isn't enough (the week it covers). */
  title?: string;
}

export interface AskOptions {
  /** The person or account the conversation is already about. */
  about?: string | null;
  /** Every question is about `about` unless it names someone else (a profile's own chat). */
  scoped?: boolean;
  /** People and accounts the rep has asked about, whose Summary is in Saved. */
  talkedAbout?: string[];
  /** The day an answer offers to add someone to (`offer`); without it, it offers nothing. */
  offerOn?: string;
  /** People the rep said no to adding, who aren't offered again. */
  declined?: string[];
}

/** Starter questions, grouped by the moment in a rep's day they help with. */
export const STARTERS = [
  { title: 'Plan the day', questions: ['Who should I see today?', 'What’s on my plan today?', 'Who is near Mount Sinai West?'] },
  { title: 'Before a visit', questions: ['Brief me on Dr. Maya Patel', 'Where does Dr. Alex Morgan refer patients?', 'Top doctors at Mount Sinai Hospital'] },
  { title: 'Your territory', questions: ['Which accounts are growing the most?', 'What has declined?', 'Where am I losing the most volume?', 'What follow-ups are overdue?', 'Top doctors using competitor products'] },
  { title: 'End of the week', questions: ['Summarise my week'] },
];

/** The starter questions, with today's next visit filled in where it helps. */
export function startersFor(ctx: Context) {
  const next = ctx.dayPlan(ctx.todayIso).find((i) => i.status === 'planned');
  const who = next ? getEntity(next.targetId) : null;
  if (!who) return STARTERS;
  const about = who.kind === 'hcp' ? `Where does ${who.name} refer patients?` : `Where do patients at ${who.name} go?`;
  return STARTERS.map((g) => (g.title === 'Before a visit' ? { ...g, questions: [`Brief me on ${who.name}`, about, g.questions[2]] } : g));
}

/** Short questions for a profile's own chat; "they" works because the chat is about them. */
export function startersAbout(entity: Entity): string[] {
  return entity.kind === 'hcp'
    ? ['What should I bring up?', 'How is their volume trending?', 'Where do their patients go?', 'When can I see them?', 'What happened last time?']
    : ['What should I bring up?', 'Where do patients go?', 'Top doctors here', 'How is volume trending?', 'What happened last time?'];
}

const normalise = (s: string): string =>
  String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9%\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Names reps actually say: last names, first names and short facility names.
const EXTRA_ALIASES: Record<string, string[]> = {
  'msh-system': ['mount sinai health system', 'health system', 'mount sinai'],
  msh: ['mount sinai hospital', 'the main hospital', 'msh'],
  msw: ['mount sinai west', 'sinai west', 'msw'],
  msm: ['mount sinai morningside', 'morningside', 'msm'],
  kidney: ['kidney center', 'kidney'],
  harlem: ['harlem health center', 'harlem clinic', 'harlem'],
};

let aliasIndex: [string, string][] | null = null;
function aliases(): [string, string][] {
  if (aliasIndex) return aliasIndex;
  const out: [string, string][] = [];
  for (const h of allHcps()) {
    const parts = normalise(h.name.replace(/^Dr\.?\s*/, '')).split(' ');
    const last = parts[parts.length - 1];
    for (const a of new Set([parts.join(' '), last, parts[0], `dr ${last}`])) out.push([a, h.id]);
  }
  for (const o of allOrgs()) {
    out.push([normalise(o.name), o.id]);
    for (const a of EXTRA_ALIASES[o.id] ?? []) out.push([a, o.id]);
    // The rest of the territory by the first part of its name: "Alderbrook" for Alderbrook Medical Center.
    const short = normalise(o.name).replace(/ (medical center|hospital|heart institute|heart center|heart and vascular|vascular center|cardiology group|cardiology associates|cardiology)$/, '');
    if (!EXTRA_ALIASES[o.id] && short !== normalise(o.name)) out.push([short, o.id]);
  }
  aliasIndex = out.sort((a, b) => b[0].length - a[0].length);
  return aliasIndex;
}

/** The person or account a question names, if any. */
export function findEntity(question: string): Entity | null {
  const q = ` ${normalise(question)} `;
  for (const [alias, id] of aliases()) {
    if (q.includes(` ${alias} `)) return getEntity(id);
  }
  return null;
}

// Most specific first: "who refers to her" is inbound, not referrals.
const INTENTS: [Intent, RegExp | ((question: string, q: string, about: string | null, scoped: boolean) => boolean)][] = [
  // The week before Saved, so "my report for this week" is the week, not the Saved list.
  ['week', /\b(my week|week(ly)? (summary|report|update|recap|review)|(summar\w*|recap|review|report on) (of )?(the|this|last) week|(this|last) week s (summary|report)|what (did|have) i (do|done|get done|achieve\w*)( [a-z]+)? (this|last) week|(report|summary|update|recap) for (the|this|last|my) week|(report|update) for my (manager|boss))\b/],
  // Before Saved and Brief, so "improve their summary" works on it rather than listing or reading it.
  ['prep', PREP_QUESTION],
  ['saved', /\b(saved|my reports?|my prep( notes)?|prep notes|my summaries|what (did|have) i (save|kept|keep))\b/],
  ['contact', /\b(best time|when (can|should|do) i (see|catch|reach|visit|meet)|how (do|can|should) i (book|reach|contact|get hold of)|phone|email|assistant|scheduler|contact details|book (a )?(time|visit|meeting))\b|\bwhen can i see\b/],
  ['history', /\b(last (time|visit|met|meeting|call|contact|note)|what did (we|i)|discuss\w*|talked about|history|past (visits|notes))\b|\bwhat happened\b/],
  ['followups', /\b(follow ?-?ups?|overdue|owe|to ?-?dos?|tasks?|promised?)\b/],
  ['inbound', /\bwho refers\b|\brefer\w* (to|into) (her|him|them|this)\b|\breferral sources?\b/],
  ['referrals', /\b(refer\w*|sends?|sent)\b|\bwhere do (her|his|their) patients go\b/],
  ['mix', /\b(mix|which procedures|what procedures|procedure breakdown|breakdown)\b/],
  ['leakage', /\b(leak\w*|losing|lose|lost|leaving|left the system|out of (the )?system|where do (patients|cases)( [a-z ]+)? go)\b/],
  ['decline', /\b(declin\w*|drop\w*|down|fall\w*|fell|shrink\w*|decreas\w*|slow\w*|worse)\b/],
  ['growth', /\b(grow\w*|increas\w*|rising|rise|fastest|gain\w*|up the most)\b/],
  // After growth, decline and patients lost, which answer with their own figures, and before the rest,
  // so "which hospitals in NJ do TAVR?" is a list rather than where someone works.
  ['find', (question, q, about, scoped) => !!searchAsked(question, q, about, scoped)],
  ['trend', /\b(trend\w*|volumes?|how busy|how many procedures)\b/],
  ['where', /\bwhere (does|do) (she|he|they) (work|practi[sc]e)\b|\b(which|what) (hospitals?|sites?|locations?)\b|\baffiliat\w*\b/],
  ['peers', /\b(work with|colleagues?|peers?|relationships?|co-?authors?|care teams?)\b/],
  ['near', /\b(near|nearby|close to|closest|nearest|around)\b/],
  ['suggest', /\b(who should i|who to (see|visit|call)|suggest\w*|recommend\w*|priorit\w*|where should i go|who next)\b/],
  ['visit', /\b(when am i (seeing|meeting|visiting)|next (visit|meeting) with|am i seeing|is (she|he|they) (planned|booked))\b/],
  ['plan', /\b(today|tomorrow|my plan|schedule|agenda|next (visit|stop|meeting)|my day|on my plan|planned)\b/],
  ['people', /\b(top|best|biggest|busiest|key|which) (hcps?|doctors?|surgeons?|physicians?|cardiologists?|people)\b|\bwho (works|practices)\b|\b(doctors|hcps|surgeons|physicians) (at|here)\b/],
  ['points', /\b(talking points?|bring up|what should i (say|mention|bring|ask|raise)|pitch|goal)\b/],
  ['brief', /\b(brief|tell me about|prep\w*|who is|what should i know|summar\w*|overview|about)\b/],
];

/** Which kind of question this is. */
export function detectIntent(question: string, about: string | null = null, scoped = false): Intent {
  const q = normalise(question);
  for (const [intent, pattern] of INTENTS) if (typeof pattern === 'function' ? pattern(question, q, about, scoped) : pattern.test(q)) return intent;
  if (findEntity(question) || (about && (scoped || refersBack(q)))) return 'brief';
  return 'search';
}

/** True when search text reads like a question rather than a name. */
export function looksLikeQuestion(text: string): boolean {
  const q = normalise(text);
  if (q.split(' ').length < 2) return false;
  return /\?\s*$/.test(text) || /^(who|what|whats|which|where|when|why|how|show|list|brief|tell|give|any)\b/.test(q) || !['search', 'brief'].includes(detectIntent(q));
}

// "Where does she refer?", "what about there?": the question continues the last answer.
const refersBack = (q: string) =>
  /\b(she|he|they|her|his|their|them|it|its|there|here|this (account|doctor|hospital|one|person)|that (account|doctor|hospital|one|person)|same)\b/.test(q);
const PEOPLE_WORDS = /\b(hcps?|doctors?|surgeons?|physicians?|people|cardiologists?|who)\b/;

/**
 * The search a question asks for, read as Targets reads what's typed: "cardiologists
 * in NJ using Competitor A", "top hospitals for TAVR". Null when it's about one
 * doctor, about who's near an account, or names an account and nothing more, as
 * "top doctors at Mount Sinai Hospital" does, which is who works there.
 */
function searchAsked(question: string, q: string, about: string | null, scoped: boolean): Partial<Filters> | null {
  if (findEntity(question)?.kind === 'hcp') return null;
  const { filters, understood } = readTargetQuery(question);
  if (!understood || (filters.org && (filters.sort === 'distance' || filters.distance))) return null;
  const narrows = Object.keys(filters).some((key) => !['query', 'kind', 'sort', 'org'].includes(key));
  // "Top doctors" is the territory's, unless the chat is about an account, or it says "there".
  const top = !filters.org && !!filters.kind && filters.sort === 'volume' && !(about && (scoped || refersBack(q)));
  return narrows || top ? filters : null;
}

/**
 * Who a question about growth, decline or patients lost is about, when it says:
 * "which cardiologists in NJ are growing?" is New Jersey's cardiologists, found as
 * Targets finds them, rather than your book. `said` is them in words. Null when
 * the question doesn't narrow it, or names an account and nothing more.
 */
function narrowedTo(question: string, ctx: Context, only?: Filters['kind']): { pool: Entity[]; said: string } | null {
  const { filters } = readTargetQuery(question);
  // Growing or declining, and the order, are what's asked rather than who.
  if (!Object.keys(filters).some((key) => !['query', 'kind', 'sort', 'signals', 'org'].includes(key))) return null;
  const f: Filters = { ...DEFAULT_FILTERS, ...filters, query: '', signals: [], states: filters.states ?? [], codes: filters.codes ?? 'all' };
  const kinds: Filters['kind'][] = only ? [only] : filters.kind ? [filters.kind] : filters.specialties?.length ? ['hcp'] : filters.orgTypes?.length ? ['hco'] : ['hco', 'hcp'];
  const pool = kinds.flatMap((kind) => ctx.search({ ...f, kind }).map((r) => r.entity)).filter((e) => e.kind === 'hcp' || e.type !== 'Health system');
  const said = describeSearch({ ...f, kind: kinds[0] }, ctx.dayWord(ctx.ws.selection.day));
  return { pool, said: kinds.length > 1 ? `people and ${said}` : said };
}

const PHRASES: Partial<Record<Signal['id'], (s: Signal) => string>> = {
  followup: (s) => (s.label.startsWith('Overdue') ? 'an overdue follow-up' : 'a follow-up due'),
  leakage: () => 'patients going elsewhere',
  rising: () => 'busier than last year',
  unseen: (s) => (s.label === 'No contact yet' ? 'no contact yet' : 'no visit in 30+ days'),
};
/** Signals as a phrase, e.g. "patients going elsewhere and no visit in 30+ days". */
const reasons = (signals: Signal[]) => listJoin(signals.map((s) => PHRASES[s.id]?.(s) ?? s.label.toLowerCase()));
const possessive = (name: string) => `${name}’s`;
const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// Answers about the rep's own notes and plan say they're sample data; answers
// with volumes, referrals or leakage give the dates those figures cover.
export const SAMPLE = 'Sample data';
const VS_LAST_YEAR = `Compared with ${PRIOR_PERIOD}`;
const last4 = (series: number[]) => sum(series.slice(-4));
const prev4 = (series: number[]) => sum(series.slice(0, 4));
const totals = (e: Entity) => {
  const rows = proceduresOf(e);
  if (!rows?.length) return null;
  const s = addSeries(rows.map((r) => r.series));
  return { prev: prev4(s), cur: last4(s), growth: procedureYoy(e) ?? 0 };
};
/** Why someone has no procedure figures: they only do echo and stress tests, or the sample has none for them. */
const noProcedures = (e: Entity) =>
  testsOf(e).length
    ? `${e.name} does none of the procedures in this sample, only echo and stress tests.`
    : `Procedure volumes aren’t available for ${e.name}. ${e.proceduresUnavailable ?? ''}`.trim();
/** Accounts in My targets that do the sample's procedures. */
const accounts = (ctx: Context) => allOrgs().filter((o) => ctx.isTarget(o.id) && o.type !== 'Health system' && proceduresOf(o)?.length);
/** Doctors in My targets. */
const doctors = (ctx: Context) => allHcps().filter((h) => ctx.isTarget(h.id));
const detailOf = (e: Entity) => (e.kind === 'hcp' ? e.specialty : e.typeDetail);
const open = (id: string, section?: string): AskLink => ({ kind: 'profile', id, section });

interface Input {
  question: string;
  q: string;
  entity: Entity | null;
  ctx: Context;
  talkedAbout?: string[];
  /** For a list: the search, when it isn't the question's own words. */
  filters?: Partial<Filters>;
}

/** Answers a question from the sample data and the rep's own activity. */
export function answer(question: string, ctx: Context, { about = null, scoped = false, talkedAbout = [], offerOn, declined = [] }: AskOptions = {}): Answer {
  const intent = detectIntent(question, about, scoped);
  const named = findEntity(question);
  const q = normalise(question);
  const chat = smallTalk(q);
  if (chat) return { intent: 'search', about: null, subject: null, scope: [], summary: chat, rows: [], next: ['Who should I see today?', 'What’s on my plan today?'], unknown: true };
  const stranger = named ? null : unknownDoctor(question);
  if (stranger) {
    return {
      intent: 'search',
      about: null,
      subject: null,
      scope: [SAMPLE],
      summary: `I can’t find ${stranger} in your data. Check the spelling, or look them up in Targets.`,
      rows: [],
      next: ['Who should I see today?', 'Top doctors at Mount Sinai Hospital'],
      unknown: true,
    };
  }
  const subject = named ?? (about && (scoped || refersBack(q)) ? getEntity(about) : null);
  // The week is the rep's own, even when asked in a person's chat, and a list is the territory's, or an account's.
  const entity = intent === 'week' || (intent === 'find' && subject?.kind === 'hcp') ? null : subject;
  const { about: answerAbout, ...result } = BUILDERS[intent]({ question, q, entity, ctx, talkedAbout });
  const built: Answer = { intent, about: answerAbout !== undefined ? answerAbout : (entity?.id ?? null), subject: entity?.id ?? null, ...result };
  const offer = offerOn ? offerFor(built, ctx, offerOn, declined) : null;
  return offer ? { ...built, offer } : built;
}

/** Answers that don't end by offering to add someone: booking a time is their next step, or they aren't about who to see. */
const NO_OFFER: Intent[] = ['contact', 'visit', 'points', 'plan', 'prep', 'saved', 'week', 'search'];

/**
 * What an answer asks at its end: "Add Dr. Volkov to today?", for whoever it's
 * about, which for a list is the first in it or the one it says to start with.
 * Only when the rep hasn't planned to, and not for a health system, which isn't
 * somewhere to visit, or after a list that found nobody. Saying yes adds a
 * visit, as + Add does everywhere, so only when the rep could see them that day.
 * Patients lost across the territory names an account and says to start with a
 * doctor there, so it offers neither.
 */
function offerFor(a: Answer, ctx: Context, day: string, declined: string[]): Answer['offer'] | null {
  if (NO_OFFER.includes(a.intent) || (a.about !== a.subject && (a.intent === 'leakage' || !a.rows.length))) return null;
  const who = a.about ? getEntity(a.about) : null;
  if (!who || declined.includes(who.id) || (who.kind === 'hco' && who.type === 'Health system') || ctx.planItemFor(who.id, day)) return null;
  const word = ctx.dayWord(day);
  return canSeeOn(who, day) ? { id: who.id, day, question: `Add ${shortName(who)} to ${word}?`, yes: `Yes, add to ${word}` } : null;
}

// "Yes, add to today", "sure", "add them": yes to what an answer asked at its end. "Not now": no.
const YES = /^((yes|yeah|yep|sure|ok|okay|go ahead|do it|please do|please)( please)?( add)?|(please )?add)( (them|him|her|it))?( (to|for) [a-z0-9 ]+)?( please)?$/;
const NO = /^(no|nope|nah|not now|not today|no thanks?( you)?|maybe later|later|skip( (them|him|her|it))?|don t|do not)$/;

/** Whether a reply says yes or no to what an answer asked at its end; null for anything else, such as another question. */
export function yesOrNo(reply: string): 'yes' | 'no' | null {
  const q = normalise(reply);
  return YES.test(q) ? 'yes' : NO.test(q) ? 'no' : null;
}

type Built = Omit<Answer, 'intent' | 'about' | 'subject'> & { about?: string | null };

/** A reply to thanks or a hello, which isn't a question about anyone; null for a question. */
function smallTalk(q: string): string | null {
  if (/^(thanks?( you)?( so much| a lot)?|thank you|ty|cheers|great thanks|ok thanks|perfect|got it|cool|great|nice|ok|okay)$/.test(q)) return 'You’re welcome. Ask me anything else about your day or your doctors.';
  if (/^(hi|hello|hey|good (morning|afternoon|evening))( there)?$/.test(q)) return 'Hello. Ask about someone by name, or about your day.';
  if (/^(bye|goodbye|see you|that s all|thats all|done)$/.test(q)) return 'Bye for now. Your conversation is kept in History.';
  return null;
}

/** A doctor named in a question, as "Dr. Smith" or "Dr Jane Smith", whom the data doesn't have; null when none is named. */
function unknownDoctor(question: string): string | null {
  const m = /\b[Dd]r\.?\s+([A-Za-z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+)?)/.exec(question);
  return m ? `Dr. ${m[1].charAt(0).toUpperCase()}${m[1].slice(1)}` : null;
}

const row = (e: Entity, figure: string, sub?: string, tone?: AnswerRow['tone']): AnswerRow => ({ id: e.id, title: e.name, sub, figure, tone });

function empty(summary: string, about: string | null = null): Built {
  return { scope: [DATA_PERIOD], summary, rows: [], next: ['Which accounts are growing the most?', 'Who should I see today?'], about };
}

const BUILDERS: Record<Intent, (input: Input) => Built> = {
  contact({ entity, ctx }) {
    if (!entity) return BUILDERS.suggest({ question: '', q: '', entity, ctx });
    const slots = ctx.slotsFor(entity).slice(0, 3);
    const rows: AnswerRow[] = [];
    if (entity.kind === 'hcp') {
      const c = entity.contact;
      if (c.preferred) rows.push({ title: 'Best time', figure: '', sub: c.preferred });
      rows.push({ title: 'Book through', figure: '', sub: c.assistant ?? 'Their office directly' });
      rows.push({ title: 'Phone', figure: '', sub: c.phone }, { title: 'Email', figure: '', sub: c.email });
    } else {
      rows.push({ title: 'Main line', figure: '', sub: entity.phone }, { title: 'Address', figure: '', sub: `${entity.address}, ${entity.city}` });
    }
    const planned = ctx.nextVisit(entity.id);
    return {
      scope: [entity.name, SAMPLE],
      summary: planned
        ? `You’re already seeing ${entity.name}: ${visitWhen(planned, entity, ctx.today)}.`
        : slots.length
          ? `The next times that suit ${entity.name} are ${listJoin(slots.map((s) => `${formatDate(s.day)} at ${s.time}`))}.`
          : `Nothing free that suits ${entity.name} in the next few working days.`,
      rows,
      facts: true,
      doThis: planned ? null : { text: 'Request a time; it stays requested until they confirm.', label: 'Book a time', link: { kind: 'book', id: entity.id } },
      next: ['What should I bring up?', 'What happened last time?'],
      about: entity.id,
    };
  },

  history({ entity, ctx }) {
    if (!entity) return BUILDERS.followups({ question: '', q: '', entity, ctx });
    const notes = ctx.interactionsFor(entity.id).slice(0, 4);
    if (!notes.length) return { ...empty(`No visits, calls or notes with ${entity.name} yet.`, entity.id), next: ['What should I bring up?', 'When can I see them?'] };
    const [last] = notes;
    return {
      scope: ['Your notes and the team’s', 'Newest first', SAMPLE],
      summary: `Last contact was ${relativeDayLower(last.date, ctx.today)}: ${last.type.toLowerCase()}, ${outcomeWord(last.outcome, last.type).toLowerCase()}.${last.note ? ` “${last.note}”` : ''}`,
      rows: notes.map((i) => ({ title: `${i.type} · ${outcomeWord(i.outcome, i.type)}`, sub: [i.author, i.note].filter(Boolean).join(' · '), figure: relativeDay(i.date, ctx.today) })),
      doThis: { text: 'See every note and follow-up.', label: 'Open activity', link: open(entity.id, 'activity') },
      next: ['What should I bring up?', 'Any open follow-ups?'],
      about: entity.id,
    };
  },

  followups({ entity, ctx }) {
    const open_ = ctx.openFollowUps().filter((f) => !entity || f.targetId === entity.id);
    if (!open_.length) {
      return { scope: ['Your follow-ups', SAMPLE], summary: entity ? `Nothing open with ${entity.name}.` : 'You have no open follow-ups.', rows: [], next: entity ? ['What should I bring up?'] : ['Who should I see today?'], about: entity?.id ?? null };
    }
    const overdue = open_.filter((f) => f.overdueBy > 0);
    const first = open_[0];
    const who = getEntity(first.targetId);
    return {
      scope: ['Your follow-ups', SAMPLE],
      summary: `${entity ? `${plural(open_.length, 'open follow-up')} with ${entity.name}` : `You have ${plural(open_.length, 'open follow-up')}`}${overdue.length ? `, ${overdue.length} overdue` : ''}. Most urgent: “${first.text}”${entity ? '' : ` for ${who?.name}`}.`,
      rows: open_.map((f) => ({ id: entity ? undefined : f.targetId, title: f.text, sub: entity ? undefined : getEntity(f.targetId)?.name, figure: f.overdueBy > 0 ? `${plural(f.overdueBy, 'day')} late` : `Due ${relativeDayLower(f.due, ctx.today)}`, tone: f.overdueBy > 0 ? 'warn' : undefined })),
      doThis: { text: 'Tick them off in Activity as you go.', label: 'Open Activity', link: { kind: 'tab', tab: 'activity' } },
      next: entity ? ['What should I bring up?', 'When can I see them?'] : ['Who should I see today?', 'What’s on my plan today?'],
      about: entity?.id ?? first.targetId,
    };
  },

  inbound({ entity, ctx }) {
    if (entity?.kind !== 'hcp') return BUILDERS.referrals({ question: '', q: '', entity, ctx });
    const inbound = entity.referrals.inbound;
    if (!inbound.length) return { ...empty(`Nobody in the sample claims referred patients to ${entity.name}.`, entity.id), next: ['Where do their patients go?'] };
    const sorted = [...inbound].sort((a, b) => b.count - a.count);
    const top = sorted[0];
    const topName = top.hcpId ? getEntity(top.hcpId)?.name : (top.label ?? 'Other');
    return {
      scope: ['Referrals in', DATA_PERIOD],
      summary: `${entity.name} received ${sum(inbound.map((r) => r.count))} referrals. The most came from ${topName} (${top.count}).`,
      rows: sorted.map((r) => {
        const peer = r.hcpId ? getEntity(r.hcpId) : null;
        return peer ? row(peer, String(r.count), r.reason) : { title: r.label ?? 'Other', sub: r.reason, figure: String(r.count) };
      }),
      next: ['Where do their patients go?', 'Who do they work with?'],
      about: entity.id,
    };
  },

  referrals({ entity, ctx }) {
    if (entity?.kind !== 'hcp') {
      if (entity?.kind === 'hco') return BUILDERS.leakage({ question: '', q: '', entity, ctx });
      const ranked = topReferrersOut();
      const top = ranked[0].hcp;
      return {
        scope: ['Referrals out of the system', DATA_PERIOD],
        summary: `${top.name} sends the most patients out of the system: ${ranked[0].count} in the last 12 months.`,
        rows: ranked.slice(0, 5).map(({ hcp, count }) => row(hcp, String(count), `${hcp.specialty} · ${primaryOrg(hcp).name}`, 'warn')),
        doThis: { text: `A visit to ${top.name} could keep the most patients in the system.`, label: `Open ${top.name}`, link: open(top.id, 'network') },
        next: [`Brief me on ${top.name}`, 'Where am I losing the most volume?'],
        about: top.id,
      };
    }
    const out = entity.referrals.outbound;
    if (!out.length) return { ...empty(`${entity.name} doesn’t refer patients on in the sample data.`, entity.id), next: ['Who refers to them?'] };
    const total = sum(out.map((r) => r.count));
    const leaving = out.filter((r) => r.ref).sort((a, b) => b.count - a.count);
    const leftCount = sum(leaving.map((r) => r.count));
    const topOut = leaving[0];
    return {
      scope: ['Referrals out', DATA_PERIOD],
      summary: leftCount
        ? `${entity.name} referred ${total} patients on. ${leftCount} (${Math.round((leftCount / total) * 100)}%) went outside the system, ${leaving.length === 1 ? 'all' : `${topOut.count}`} to ${destination(topOut.ref!).name}.`
        : `${entity.name} referred ${total} patients on, all within the system.`,
      rows: [...out]
        .sort((a, b) => b.count - a.count)
        .map((r) => {
          const peer = r.hcpId ? getEntity(r.hcpId) : null;
          if (peer) return row(peer, String(r.count), `Same health system · ${r.reason}`);
          return r.ref
            ? { title: destination(r.ref).name, sub: `Outside the system · ${r.reason}`, figure: String(r.count), tone: 'warn' as const }
            : { title: r.label ?? 'Other', sub: r.reason, figure: String(r.count) };
        }),
      doThis: topOut ? { text: `Ask why ${topOut.reason} patients go to ${destination(topOut.ref!).name} instead of staying in the system.`, label: 'Open referrals', link: open(entity.id, 'network') } : null,
      next: ['Who refers to them?', 'What should I bring up?', 'How is their volume trending?'],
      about: entity.id,
    };
  },

  mix({ entity }) {
    const e = entity ?? getOrg('msh-system')!;
    const rows = proceduresOf(e);
    if (!rows?.length) return empty(noProcedures(e), e.id);
    const total = sum(rows.map((r) => last4(r.series)));
    const sorted = [...rows].sort((a, b) => last4(b.series) - last4(a.series));
    return {
      scope: ['Procedures', DATA_PERIOD],
      summary: `${sorted[0].family} is ${Math.round((last4(sorted[0].series) / total) * 100)}% of ${possessive(e.name)} ${formatNumber(total)} procedures in the last 12 months.`,
      rows: sorted.map((r) => ({ title: r.family, figure: formatNumber(last4(r.series)), change: ((last4(r.series) - prev4(r.series)) / (prev4(r.series) || 1)) * 100 })),
      doThis: { text: 'The quarter-by-quarter trend is on the profile.', label: 'Open volumes', link: open(e.id, 'volumes') },
      next: [e.kind === 'hco' ? `Top doctors at ${e.name}` : 'How is their volume trending?', 'Which accounts are growing the most?'],
      about: e.id,
    };
  },

  leakage({ question, entity, ctx }) {
    if (entity?.kind === 'hco') {
      const l = entity.leakage;
      if (!l) return empty(`${entity.name} doesn’t report where its patients go. ${entity.leakageUnavailable ?? ''}`.trim(), entity.id);
      const top = l.destinations[0];
      const destName = (d: (typeof l.destinations)[number]) => (d.orgId ? (getOrg(d.orgId)?.name ?? '') : destination(d.ref!).name);
      return {
        scope: ['Patients who left', DATA_PERIOD],
        summary: `About ${formatNumber(patientsLost(l))} patients at ${entity.name} left the system, ${l.leftPct}% of ${formatNumber(l.patients)}. The biggest destination is ${destName(top)}, with ${formatNumber(top.patients)}.`,
        rows: l.destinations.map((d) => {
          const org = d.orgId ? getOrg(d.orgId) : null;
          return org ? row(org, formatNumber(d.patients), 'Same health system') : { title: destination(d.ref!).name, sub: `${destination(d.ref!).note} · outside the system`, figure: formatNumber(d.patients), tone: 'warn' as const };
        }),
        doThis: { text: `${l.byFamily[0].family} is the biggest gap: ${l.byFamily[0].leftPct}% of those patients leave.`, label: 'See where they go', link: open(entity.id, 'leakage') },
        next: [`Top doctors at ${entity.name}`, 'Which accounts are growing the most?', 'Who should I see today?'],
        about: entity.id,
      };
    }
    if (entity?.kind === 'hcp') return BUILDERS.referrals({ question: '', q: '', entity, ctx });
    // Accounts only: who loses patients is counted for an account, not a doctor.
    const narrowed = narrowedTo(question, ctx, 'hco');
    const ranked = accountsByPatientsLost().filter((r) => !narrowed || narrowed.pool.some((e) => e.id === r.org.id));
    if (!ranked.length) return empty(`None of the ${narrowed?.said ?? 'accounts'} report where their patients go.`);
    const { org: top, leakage: topLeak } = ranked[0];
    const lost = sum(ranked.map((r) => r.lost));
    const referrer = topReferrersOut(top.id)[0];
    return {
      scope: ['Patients who left the system', ...(narrowed ? [capitalise(narrowed.said)] : []), 'Most first', DATA_PERIOD],
      summary: `${top.name} loses the most: ${formatNumber(ranked[0].lost)} patients, ${topLeak.leftPct}% of ${formatNumber(topLeak.patients)}. Across ${narrowed ? `the ${narrowed.said}` : 'your accounts'}, about ${formatNumber(lost)} patients left the system.`,
      rows: ranked.map(({ org, leakage: l, lost: n }) => row(org, formatNumber(n), `${l.leftPct}% of ${formatNumber(l.patients)} patients · worst for ${l.byFamily[0].family}`, l.leftPct >= 20 ? 'warn' : undefined)),
      doThis: referrer
        ? { text: `${referrer.hcp.name} works there and sends ${referrer.count} patients a year outside the system. Start there.`, label: `Open ${referrer.hcp.name}`, link: open(referrer.hcp.id, 'network') }
        : { text: `At ${top.name}, ${topLeak.byFamily[0].family} patients leave the most.`, label: `Open ${top.name}`, link: open(top.id, 'leakage') },
      next: [`Where do patients at ${top.name} go?`, 'Which accounts are growing the most?', 'Who should I see today?'],
      about: top.id,
    };
  },

  growth({ question, q, entity, ctx }) {
    const people = PEOPLE_WORDS.test(q);
    if (entity && !(entity.kind === 'hco' && people)) return BUILDERS.trend({ question: '', q, entity, ctx });
    const narrowed = narrowedTo(question, ctx);
    const pool: Entity[] = narrowed?.pool ?? (entity ? hcpsAt(entity.id) : people ? doctors(ctx) : accounts(ctx));
    const ranked = pool
      .map((e) => ({ e, t: totals(e) }))
      .filter((r): r is { e: Entity; t: NonNullable<ReturnType<typeof totals>> } => !!r.t)
      .sort((a, b) => b.t.growth - a.t.growth);
    if (!ranked.length) return empty(narrowed ? `No procedure volumes to compare for ${narrowed.said}.` : 'No procedure volumes to compare yet.');
    const top = ranked[0];
    const pick = ranked.slice(0, 3).find((r) => ctx.signals(r.e).some((s) => s.id === 'leakage' || s.id === 'unseen')) ?? top;
    const pickSignals = ctx.signals(pick.e).filter((s) => s.id !== 'rising');
    return {
      scope: [VS_LAST_YEAR, narrowed ? capitalise(narrowed.said) : entity?.kind === 'hco' ? `At ${entity.name}` : 'Your book', DATA_PERIOD],
      summary: `${top.e.name} grew fastest: ${formatNumber(top.t.prev)} to ${formatNumber(top.t.cur)} procedures (${changeWords(top.t.growth)}).`,
      rows: ranked.slice(0, 5).map(({ e, t }) => ({ ...row(e, '', `${detailOf(e)} · ${formatNumber(t.cur)} procedures`), change: t.growth })),
      doThis: {
        text: pickSignals.length ? `${pick.e.name} is growing, with ${reasons(pickSignals)}. Start there.` : `${pick.e.name} is growing fastest. Visit while volume is moving.`,
        label: `Open ${pick.e.name}`,
        link: open(pick.e.id, 'volumes'),
      },
      next: ['What has declined?', 'Where am I losing the most volume?', people ? 'Which accounts are growing the most?' : 'Which doctors are growing the most?'],
      about: pick.e.id,
    };
  },

  decline({ question, q, entity, ctx }) {
    const people = PEOPLE_WORDS.test(q);
    if (entity?.kind === 'hcp') return BUILDERS.trend({ question: '', q, entity, ctx });
    const narrowed = narrowedTo(question, ctx);
    const pool: Entity[] = narrowed?.pool ?? (entity?.kind === 'hco' ? hcpsAt(entity.id) : [...(people ? [] : accounts(ctx)), ...doctors(ctx)]);
    const ranked = pool
      .map((e) => ({ e, t: totals(e) }))
      .filter((r): r is { e: Entity; t: NonNullable<ReturnType<typeof totals>> } => !!r.t)
      .sort((a, b) => a.t.growth - b.t.growth);
    if (!ranked.length) return empty(narrowed ? `No procedure volumes to compare for ${narrowed.said}.` : 'No procedure volumes to compare yet.');
    const down = ranked.filter((r) => r.t.growth < 0);
    if (!down.length) {
      const slow = ranked[0];
      return {
        scope: [VS_LAST_YEAR, DATA_PERIOD],
        summary: `Nothing declined. Slowest growth is ${slow.e.name}, ${changeWords(slow.t.growth)}.`,
        rows: ranked.slice(0, 5).map(({ e, t }) => ({ ...row(e, '', `${formatNumber(t.cur)} procedures`), change: t.growth })),
        next: ['Which accounts are growing the most?', 'Where am I losing the most volume?'],
      };
    }
    const top = down[0];
    const family = proceduresOf(top.e)!
      .map((r) => ({ r, g: last4(r.series) - prev4(r.series) }))
      .sort((a, b) => a.g - b.g)[0].r;
    return {
      scope: [VS_LAST_YEAR, narrowed ? capitalise(narrowed.said) : entity?.kind === 'hco' ? `At ${entity.name}` : 'People and accounts', DATA_PERIOD],
      summary: `${narrowed ? `${down.length} of the ${narrowed.said}` : plural(down.length, 'target')} declined. The biggest drop is ${top.e.name}: ${formatNumber(top.t.prev)} to ${formatNumber(top.t.cur)} procedures (${changeWords(top.t.growth)}).`,
      rows: down.slice(0, 5).map(({ e, t }) => ({ ...row(e, '', `${detailOf(e)} · ${formatNumber(t.cur)} procedures`), change: t.growth })),
      doThis: { text: `Most of ${possessive(top.e.name)} drop is in ${family.family.toLowerCase()}. Ask where those cases are going now.`, label: `Open ${top.e.name}`, link: open(top.e.id, 'volumes') },
      next: [top.e.kind === 'hcp' ? `Where does ${top.e.name} refer patients?` : `Where do patients at ${top.e.name} go?`, 'Which accounts are growing the most?', 'Where am I losing the most volume?'],
      about: top.e.id,
    };
  },

  /** How one person or account is trending, family by family. */
  trend({ entity, ctx }) {
    if (!entity) return BUILDERS.growth({ question: '', q: '', entity, ctx });
    const t = totals(entity);
    if (!t) return empty(noProcedures(entity), entity.id);
    const families = proceduresOf(entity)!
      .map((r) => ({ r, prev: prev4(r.series), cur: last4(r.series) }))
      .map((f) => ({ ...f, pct: f.prev ? ((f.cur - f.prev) / f.prev) * 100 : 0 }))
      .sort((a, b) => Math.abs(b.cur - b.prev) - Math.abs(a.cur - a.prev));
    const mover = families[0];
    const direction = t.growth >= 1 ? 'up' : t.growth <= -1 ? 'down' : 'flat';
    return {
      scope: [VS_LAST_YEAR, DATA_PERIOD],
      summary: `${entity.name} is ${direction} on last year: ${formatNumber(t.prev)} to ${formatNumber(t.cur)} procedures (${changeWords(t.growth)}). The biggest change is ${mover.r.family} (${changeWords(mover.pct)}).`,
      rows: families.map((f) => ({ title: f.r.family, sub: `${formatNumber(f.cur)} in the last 12 months`, figure: '', change: f.pct })),
      doThis: { text: 'See the quarter-by-quarter trend before the visit.', label: 'Open volumes', link: open(entity.id, 'volumes') },
      next: entity.kind === 'hcp' ? ['Where do their patients go?', 'What should I bring up?'] : [`Where do patients at ${entity.name} go?`, `Top doctors at ${entity.name}`],
      about: entity.id,
    };
  },

  where({ question, q, entity, ctx }) {
    if (entity?.kind !== 'hcp') return BUILDERS.people({ question, q, entity, ctx });
    const rows = [...entity.affiliations].sort((a, b) => b.share - a.share);
    const first = getOrg(rows[0].orgId)!;
    return {
      scope: ['Practice locations', 'Share of their procedures', DATA_PERIOD],
      summary: `${entity.name} does most of their work at ${first.name} (${rows[0].share}%, ${rows[0].days}).`,
      rows: rows.flatMap((a) => {
        const site = getOrg(a.orgId);
        return site ? [row(site, `${a.share}%`, `${a.role} · ${a.days}`)] : [];
      }),
      next: ['When can I see them?', 'Who do they work with?'],
      about: entity.id,
    };
  },

  peers({ question, q, entity, ctx }) {
    if (entity?.kind !== 'hcp') return BUILDERS.people({ question, q, entity, ctx });
    const rels = entity.relationships.flatMap((r) => {
      const peer = getEntity(r.hcpId);
      return peer ? [{ peer, r }] : [];
    });
    if (!rels.length) return { ...empty(`No co-authors, care teams or shared patients for ${entity.name} in the sample data.`, entity.id), next: ['Who refers to them?'] };
    return {
      scope: ['Co-authors, care teams and shared patients', SAMPLE],
      summary: `${entity.name} works most closely with ${rels[0].peer.name} (${rels[0].r.type.toLowerCase()}).`,
      rows: rels.map(({ peer, r }) => row(peer, '', `${r.type} · ${r.detail}`)),
      next: ['Who refers to them?', 'Where do their patients go?'],
      about: entity.id,
    };
  },

  near({ entity, ctx }) {
    const place = entity ? siteFor(entity) : null;
    const origin = place ? place.coords : ctx.start.coords;
    const label = place ? place.name : `${ctx.start.place} (your sample start point)`;
    const near = [...allHcps(), ...allOrgs()]
      .filter((e) => ctx.isTarget(e.id) && (e.kind === 'hcp' || e.type !== 'Health system') && e.id !== place?.id && e.id !== entity?.id)
      .map((e) => ({ e, km: haversineKm(origin, siteFor(e).coords) }))
      .filter((r) => !ctx.planItemFor(r.e.id, ctx.todayIso))
      .sort((a, b) => a.km - b.km);
    const within = near.filter((r) => r.km <= 2);
    const top = near[0];
    if (!top) return empty(`Everyone near ${label} is already in today’s plan.`, entity?.id ?? null);
    return {
      scope: [`Near ${place ? place.name : ctx.start.place}`, 'Straight-line distance', 'Not yet planned today', SAMPLE],
      summary: within.length
        ? `${plural(within.length, 'unplanned target')} within 2 km of ${label}. Closest: ${top.e.name}, ${formatKm(top.km)}.`
        : `Nothing unplanned within 2 km of ${label}. The closest is ${top.e.name} at ${siteFor(top.e).name}, ${formatKm(top.km)} away.`,
      rows: near.slice(0, 6).map(({ e, km }) => row(e, formatKm(km), e.kind === 'hcp' ? `${e.specialty} · ${siteFor(e).name}` : e.typeDetail)),
      doThis: { text: `Fit ${top.e.name} in while you’re nearby.`, label: `Open ${top.e.name}`, link: open(top.e.id) },
      next: ['Who should I see today?', 'What’s on my plan today?'],
      about: top.e.id,
    };
  },

  suggest({ ctx }) {
    const picks = ctx.suggestions(ctx.todayIso, 5);
    if (!picks.length) return empty('Everyone suggested is already planned for today.');
    const top = picks[0];
    return {
      scope: ['Today', 'Follow-ups, figures and last contact', DATA_PERIOD],
      summary: `Start with ${top.entity.name}: ${reasons(top.signals) || 'the highest volume in your book'}.`,
      rows: picks.map(({ entity: e, signals }) => row(e, '', signals.slice(0, 2).map((s) => s.label).join(' · ') || detailOf(e))),
      doThis: { text: `${top.entity.name} is the strongest case for a visit.`, label: `Open ${top.entity.name}`, link: open(top.entity.id) },
      next: [`Brief me on ${top.entity.name}`, `Who is near ${siteFor(top.entity).name}?`, 'What’s on my plan today?'],
      about: top.entity.id,
    };
  },

  visit({ entity, q, ctx }) {
    if (!entity) return BUILDERS.plan({ question: '', q, entity, ctx });
    const next = ctx.nextVisit(entity.id);
    return {
      scope: [entity.name, 'Your plan', SAMPLE],
      summary: next ? `Next visit: ${visitWhen(next, entity, ctx.today)}${next.item.booking === 'requested' ? ', still requested' : ''}.` : `${entity.name} isn’t in your plan yet.`,
      rows: [],
      doThis: next ? null : { text: 'Request a time that suits them.', label: 'Book a time', link: { kind: 'book', id: entity.id } },
      next: ['What should I bring up?', 'When can I see them?'],
      about: entity.id,
    };
  },

  plan({ q, ctx }) {
    // "Tomorrow" is the next working day Today plans: Monday, on a Friday.
    const [, next] = ctx.planDays();
    const day = /\btomorrow\b/.test(q) ? next.iso : ctx.todayIso;
    const items = ctx.dayPlan(day).filter((i) => i.status !== 'cancelled');
    const name = day === ctx.todayIso ? 'today' : next.label === 'Tomorrow' ? 'tomorrow' : `on ${next.label}`;
    if (!items.length) {
      return {
        scope: [formatDate(day), SAMPLE],
        summary: `Nothing is planned for ${name} yet.`,
        rows: [],
        doThis: { text: 'Pick who to see from Targets.', label: 'Open Targets', link: { kind: 'tab', tab: 'targets' } },
        next: ['Who should I see today?', 'Who is near Mount Sinai West?'],
      };
    }
    const first = items.find((i) => i.status === 'planned') ?? items[0];
    const firstWho = getEntity(first.targetId);
    return {
      scope: [formatDate(day), plural(items.length, 'stop'), SAMPLE],
      summary: `${plural(items.length, 'stop')} ${name}. ${first.status === 'planned' ? 'Next' : 'First'}: ${firstWho?.name}${first.mode === 'timed' ? ` at ${first.time}` : ''}.`,
      rows: items.flatMap((i) => {
        const t = getEntity(i.targetId);
        return t ? [row(t, i.status === 'done' ? 'Done' : i.mode === 'timed' && i.time ? i.time : 'Any time', `${i.type} · ${siteFor(t, i.siteId).name}`)] : [];
      }),
      next: [`Brief me on ${firstWho?.name}`, 'Who should I see today?', 'What follow-ups are overdue?'],
      about: first.targetId,
    };
  },

  /** Who works at an account, or a doctor's main one, as Targets lists them there; without either, the list the question asks for. */
  people({ question, q, entity, ctx }) {
    const org = entity?.kind === 'hco' ? entity : entity ? primaryOrg(entity) : null;
    return BUILDERS.find({ question, q, entity: org, ctx, filters: org ? { kind: 'hcp', org: org.id } : undefined });
  },

  /** A list, found as Targets finds it: the first few here, and all of them there, to narrow down or add to the day. */
  find({ question, entity, ctx, filters }) {
    const read = filters ?? readTargetQuery(question).filters;
    const kind = read.kind ?? (read.orgTypes?.length ? 'hco' : 'hcp');
    // "Which doctors there use a competitor?" is at the account the chat is about.
    const org = read.org ?? (entity?.kind === 'hco' ? entity.id : '');
    const asked: Filters = { ...DEFAULT_FILTERS, ...read, kind, org, states: read.states ?? [], codes: read.codes ?? 'all' };
    // Words that aren't a name or a place, such as "lately", are left out rather than finding nobody.
    const all = ctx.search(asked);
    const left = !all.length && asked.query.trim() && ctx.search({ ...asked, query: '' }).length ? asked.query.trim() : '';
    const f = left ? { ...asked, query: '' } : asked;
    const found = left ? ctx.search(f) : all;
    const dayWord = ctx.dayWord(ctx.ws.selection.day);
    const link: AskLink = { kind: 'targets', find: searchLink(f) };
    const where = f.org ? `At ${getOrg(f.org)?.name ?? 'that account'}` : f.states.length ? listJoin(STATES.filter((st) => f.states.includes(st.id)).map((st) => st.label)) : 'Your territory';
    const scope = [where, f.codes === 'all' ? 'All procedures' : pickLabel(f.codes), DATA_PERIOD];
    if (!found.length) {
      return {
        scope,
        summary: `No ${describeSearch(f, dayWord)}.`,
        rows: [],
        doThis: { text: 'Take a filter off to see more.', label: 'Open in Targets', link },
        next: ['Top doctors in my territory', 'Which accounts are growing the most?'],
        about: org || null,
      };
    }
    const top = found[0].entity;
    const shown = found.slice(0, 6);
    const lead =
      f.sort === 'distance'
        ? `Closest: ${top.name}, ${formatKm(found[0].distance)}.`
        : f.sort === 'volume' && found[0].volume
          ? `Most procedures: ${top.name}, ${formatNumber(found[0].volume.year)} in the last 12 months.`
          : f.sort === 'relevance'
            ? `First: ${top.name}${found[0].signals.length ? ` (${listJoin(found[0].signals.slice(0, 2).map((s) => s.label.toLowerCase()))})` : ''}.`
            : '';
    return {
      scope: [...scope.slice(0, 2), SORTS.find((s) => s.id === f.sort)?.label ?? '', DATA_PERIOD].filter(Boolean),
      summary: [`${capitalise(describeSearch(f, dayWord, found.length))}.`, left ? `I left out “${left}”, as it isn’t a name or place I know.` : '', lead].filter(Boolean).join(' '),
      rows: shown.map((r) =>
        row(
          r.entity,
          f.sort === 'distance' ? formatKm(r.distance) : formatNumber(r.volume?.year ?? 0),
          r.entity.kind === 'hcp' ? `${r.entity.specialty} · ${siteFor(r.entity).name}` : r.entity.typeDetail,
        ),
      ),
      doThis:
        found.length > shown.length
          ? { text: `${formatNumber(found.length - shown.length)} more, with filters to narrow them down.`, label: `See all ${formatNumber(found.length)} in Targets`, link }
          : { text: 'Narrow them down, or add them to your day.', label: 'Open in Targets', link },
      next: [`Brief me on ${top.name}`, top.kind === 'hcp' ? `Where does ${top.name} refer patients?` : `Where do patients at ${top.name} go?`, 'Which accounts are growing the most?'],
      about: top.id,
    };
  },

  /** The goal and talking points from the visit brief. */
  points({ entity, ctx }) {
    if (!entity) return BUILDERS.suggest({ question: '', q: '', entity, ctx });
    const brief = buildBrief(entity, ctx);
    return {
      scope: [brief.visit ? visitWhen(brief.visit, entity, ctx.today) : 'No visit planned', DATA_PERIOD],
      summary: `${brief.goalSuggested ? 'Suggested goal' : 'Goal'}: ${brief.goal}`,
      rows: brief.points.map((p) => ({ title: p.text, figure: '' })),
      doThis: brief.visit ? null : { text: 'Book a time to raise it.', label: 'Book a time', link: { kind: 'book', id: entity.id } },
      next: ['What happened last time?', entity.kind === 'hcp' ? 'Where do their patients go?' : 'Where do patients go?', 'When can I see them?'],
      about: entity.id,
    };
  },

  brief({ entity, ctx }) {
    if (!entity) return BUILDERS.search({ question: '', q: '', entity, ctx });
    const last = ctx.lastInteraction(entity.id);
    const followUps = ctx.openFollowUps().filter((f) => f.targetId === entity.id);
    const t = totals(entity);
    const next = ctx.nextVisit(entity.id);
    const facts: AnswerRow[] = [
      {
        title: 'Last contact',
        figure: last ? relativeDay(last.date, ctx.today) : 'Never',
        sub: last ? `${last.type} · ${outcomeWord(last.outcome, last.type)}${last.note ? ` · “${last.note.slice(0, 70)}${last.note.length > 70 ? '…' : ''}”` : ''}` : 'No interactions logged yet',
      },
      { title: 'Open follow-ups', figure: String(followUps.length), sub: followUps[0]?.text ?? 'None', tone: followUps.length ? 'warn' : undefined },
      t
        ? { title: 'Procedures · 12 months', figure: formatNumber(t.cur), change: t.growth }
        : { title: 'Procedures', figure: '—', sub: 'None in this sample' },
      entity.kind === 'hcp'
        ? { title: 'Sent outside the system', figure: String(referredOut(entity)), sub: 'Patients, last 12 months', tone: entity.leakageRisk ? 'warn' : undefined }
        : { title: 'Patients leaving', figure: entity.leakage ? formatNumber(patientsLost(entity.leakage)) : '—', sub: entity.leakage ? `${entity.leakage.leftPct}% of ${formatNumber(entity.leakage.patients)} patients` : 'Not reported', tone: (entity.leakage?.leftPct ?? 0) >= 20 ? 'warn' : undefined },
    ];
    if (next) facts.unshift({ title: 'Next visit', figure: next.item.mode === 'timed' && next.item.time ? next.item.time : 'Any time', sub: `${relativeDay(next.day, ctx.today)} · ${next.item.goal || next.item.type}` });
    const insight = entity.kind === 'hcp' ? entity.insight : (entity.leakage?.insight ?? entity.leakageUnavailable ?? `${entity.name}: ${entity.typeDetail}.`);
    return {
      scope: [detailOf(entity), DATA_PERIOD],
      summary: insight,
      rows: facts,
      facts: true,
      doThis: { text: 'The full brief and figures are on the profile.', label: entity.kind === 'hcp' ? 'Open profile' : 'Open account', link: open(entity.id) },
      next: entity.kind === 'hcp' ? ['What should I bring up?', 'Where do their patients go?', 'When can I see them?'] : [`Where do patients at ${entity.name} go?`, `Top doctors at ${entity.name}`],
      about: entity.id,
    };
  },

  /** Help with someone's Summary: a start, or what it doesn't say yet (lib/prep.ts). */
  prep({ entity, ctx, q }) {
    if (!entity) return { ...empty('Who is it for? Ask “Improve the summary for Dr. Patel”, or tap Improve with Ask on their Summary.'), scope: [SAMPLE], next: ['Who should I see today?', 'What’s on my plan today?'] };
    return prepAnswer(entity, ctx);
  },

  /** What's in the menu's Saved list: summaries and reports. */
  saved({ entity, ctx, talkedAbout = [] }) {
    // As the Saved list has them: anyone asked about, and anyone still to see today or next.
    const preps = ctx
      .summaryPeople(talkedAbout)
      .filter((e) => !entity || e.id === entity.id)
      .map((e) => ({ id: e.id, title: `Summary for ${e.name}`, sub: 'Summary', figure: '' }));
    const reports = ctx.ws.saved
      .filter((r) => !entity || r.about === entity.id)
      .map((r) => ({ title: r.title, sub: `Saved ${relativeDayLower(r.savedOn, ctx.today)}`, figure: '' }));
    const total = preps.length + reports.length;
    return {
      scope: ['Saved', 'On this device', SAMPLE],
      summary: total
        ? `You have ${[preps.length ? plural(preps.length, 'summary', 'summaries') : '', reports.length ? plural(reports.length, 'saved report') : ''].filter(Boolean).join(' and ')}${entity ? ` about ${entity.name}` : ''}.`
        : 'Nothing saved yet. Ask about a doctor and their Summary is kept for you; say “save that” after any answer to keep it as a report.',
      rows: [...preps, ...reports],
      doThis: total ? { text: 'Everything you’ve kept is in the menu.', label: 'Open Saved', link: { kind: 'tab', tab: 'saved' } } : null,
      next: ['Who should I see today?', 'Where am I losing the most volume?'],
      about: entity?.id ?? null,
    };
  },

  /**
   * The last seven days, today included, as the report a rep sends their manager:
   * visits logged against those due, what didn't go to plan, notes, follow-ups,
   * accounts covered and who to see next week.
   */
  week({ ctx }) {
    const from = isoDate(addDays(ctx.today, -6));
    const inWeek = (day: string) => day >= from && day <= ctx.todayIso;
    const dayName = (day: string) => formatDate(day, inWeek(day) ? { weekday: 'short' } : { weekday: 'short', day: 'numeric', month: 'short' });
    type Visit = { day: string; item: PlanItem; who: Entity };
    // Visits planned on the week's days, and any moved from the week to a later day.
    const visits = Object.entries(ctx.ws.plans)
      .flatMap(([day, items]) => items.map((item) => ({ day, item, who: getEntity(item.targetId) })))
      .filter((v): v is Visit => !!v.who && (inWeek(v.day) || (!!v.item.movedFrom && inWeek(v.item.movedFrom.day))))
      .sort((a, b) => a.day.localeCompare(b.day) || (a.item.time ?? '').localeCompare(b.item.time ?? ''));
    const name = (v: Visit) => shortName(v.who);
    const ofWeek = visits.filter((v) => inWeek(v.day));
    const done = ofWeek.filter((v) => v.item.status === 'done');
    const notIn = done.filter((v) => v.item.outcome === 'Attempted').length;
    // Due: visits on the days gone by that weren't cancelled, and today's once logged. Today's others are still to come.
    const due = ofWeek.filter((v) => v.item.status !== 'cancelled' && (v.day < ctx.todayIso || v.item.status === 'done'));
    const laterToday = ofWeek.filter((v) => v.item.status === 'planned' && v.day === ctx.todayIso).length;
    const moved = ({ day, item }: Visit) =>
      !item.movedFrom ? '' : item.movedFrom.day === day ? `moved from ${item.movedFrom.time ?? 'any time'}` : `moved from ${dayName(item.movedFrom.day)}`;
    const when = (v: Visit, ...more: string[]) => `(${[dayName(v.day), ...more, moved(v)].filter(Boolean).join(', ')})`;
    const changes = [
      ...ofWeek.filter((v) => v.item.status === 'cancelled').map((v) => `${name(v)}: visit cancelled (${dayName(v.day)})`),
      // A move still to happen; one that has happened says so where it's listed.
      ...visits
        .filter((v) => v.item.movedFrom && v.item.status === 'planned' && v.day >= ctx.todayIso)
        .map((v) => (v.item.movedFrom!.day === v.day ? `${name(v)} moved to ${v.item.time} (${dayName(v.day)})` : `${name(v)} moved from ${dayName(v.item.movedFrom!.day)} to ${dayName(v.day)}`)),
      ...ofWeek.filter((v) => v.item.status === 'planned' && v.day < ctx.todayIso).map((v) => `${name(v)} not logged ${when(v)}`),
    ];
    const notes = ctx.ws.interactions.filter((i) => !i.deleted && i.author === 'You' && inWeek(i.date));
    const noted = [...new Set(notes.map((i) => i.targetId))].flatMap((id) => getEntity(id) ?? []);
    // Accounts where the rep met someone in person: a visit there, or a meeting with the account.
    const inPerson = (type: string) => type === 'In-person visit' || type === 'Meeting';
    const covered = [
      ...new Set([
        ...done.filter((v) => v.item.outcome !== 'Attempted' && inPerson(v.item.type)).map((v) => v.item.siteId),
        ...notes.filter((i) => i.outcome === 'Met' && inPerson(i.type) && getEntity(i.targetId)?.kind === 'hco').map((i) => i.targetId),
      ]),
    ].flatMap((id) => getOrg(id) ?? []);
    const followUps = ctx.openFollowUps();
    const late = followUps.filter((f) => f.overdueBy > 0);
    const owedBy = (f: (typeof followUps)[number]) => {
      const who = getEntity(f.targetId);
      return `“${f.text}”${who ? ` for ${shortName(who)}` : ''}`;
    };
    // Worth seeing next week: the app's own reasons, leaving out anyone seen or written about this week, or already planned.
    const nextMonday = isoDate(addDays(ctx.today, (8 - ctx.today.getDay()) % 7 || 7));
    const seen = new Set([...done.map((v) => v.who.id), ...notes.flatMap((i) => [i.targetId, ...i.attendees])]);
    const picks = ctx
      .suggestions(nextMonday, 50, false)
      .map((s) => ({ entity: s.entity, why: s.signals.filter((g) => g.id !== 'followup') }))
      .filter((s) => s.why.length && !seen.has(s.entity.id) && !ctx.nextVisit(s.entity.id))
      .slice(0, 3);
    const top = picks[0];

    const rows: AnswerRow[] = [
      { title: 'Visits logged', figure: `${done.length} of ${due.length}`, sub: done.length ? listJoin(done.map((v) => `${name(v)} ${when(v, v.item.outcome === 'Attempted' ? outcomeWord('Attempted', v.item.type).toLowerCase() : '')}`)) : 'None logged yet' },
    ];
    if (changes.length) rows.push({ title: 'Cancelled, moved or not logged', figure: String(changes.length), sub: changes.join(' · '), tone: 'warn' });
    rows.push(
      { title: 'Notes logged', figure: String(notes.length), sub: noted.length ? listJoin(noted.map(shortName)) : 'None yet' },
      {
        title: 'Follow-ups open',
        figure: late.length ? `${followUps.length}, ${late.length} late` : String(followUps.length),
        sub: late.length
          ? late.slice(0, 2).map((f) => `${owedBy(f)}, ${plural(f.overdueBy, 'day')} late`).join(' · ')
          : followUps.length ? `Next: ${owedBy(followUps[0])}, due ${relativeDayLower(followUps[0].due, ctx.today)}` : 'All done',
        tone: late.length ? 'warn' : undefined,
      },
      { title: 'Accounts covered', figure: String(covered.length), sub: covered.length ? listJoin(covered.map((o) => o.name)) : 'None yet' },
      // One row each, which opens their page, with why and when they're usually free.
      ...picks.map((p) => ({ id: p.entity.id, title: `Next week: ${shortName(p.entity)}`, figure: '', sub: `${capitalise(reasons(p.why.slice(0, 2)))} · ${usualTimes(p.entity)}` })),
    );

    const dayMonth = { day: 'numeric', month: 'short' } as const;
    const range = `${formatDate(from, from.slice(0, 7) === ctx.todayIso.slice(0, 7) ? { day: 'numeric' } : dayMonth)} to ${formatDate(ctx.today, dayMonth)}`;
    const lateText = late.length ? `, ${plural(late.length, 'follow-up')} late` : '';
    const notInText = notIn ? ` (${notIn} not in)` : '';
    const laterText = laterToday ? `, ${laterToday} more today` : '';
    return {
      title: `Your week to ${formatDate(ctx.today, dayMonth)}`,
      scope: [range, 'Your plan and notes', SAMPLE],
      summary:
        due.length || laterToday
          ? `Your week: ${done.length} of ${plural(due.length, 'visit')} logged${notInText}${laterText}. ${plural(notes.length, 'note')} logged${lateText}.`
          : `Your week: no visits planned. ${plural(notes.length, 'note')} logged${lateText}.`,
      rows,
      facts: true,
      doThis: top ? { text: `Next week, start with ${shortName(top.entity)}: ${reasons(top.why.slice(0, 2))}.`, label: `Open ${shortName(top.entity)}`, link: open(top.entity.id) } : null,
      next: [...new Set(['What follow-ups are overdue?', top ? `Brief me on ${top.entity.name}` : 'Who should I see today?', 'Who should I see today?'])],
      about: null,
    };
  },

  search({ question, q, ctx }) {
    const words = q.replace(/\b(show|find|me|the|a|an|for|of|in|at|who|what|is|are|my|please)\b/g, ' ').replace(/\s+/g, ' ').trim();
    const rows = words
      ? [...ctx.search({ ...DEFAULT_FILTERS, query: words, kind: 'hcp' }), ...ctx.search({ ...DEFAULT_FILTERS, query: words, kind: 'hco' })]
      : [];
    if (rows.length) {
      return {
        scope: ['Search', 'Your book', SAMPLE],
        summary: `I couldn’t answer that as a question, but ${plural(rows.length, 'target matches', 'targets match')} “${question.trim()}”.`,
        rows: rows.slice(0, 6).map((r) => row(r.entity, '', r.entity.kind === 'hcp' ? `${r.entity.specialty} · ${siteFor(r.entity).name}` : r.entity.typeDetail)),
        next: STARTERS[2].questions.slice(0, 3),
      };
    }
    return {
      scope: ['Not understood'],
      summary: 'I can’t answer that yet. Try asking about growth, decline, leakage, referrals, your plan, follow-ups, or a person or account by name.',
      rows: [],
      next: [STARTERS[0].questions[0], STARTERS[1].questions[0], STARTERS[2].questions[0]],
      unknown: true,
    };
  },
};

/** A short version for reading aloud: the answer and the next step, without the table. The week reads every line, as it's a report. */
export function spoken(a: Answer): string {
  const points = a.intent === 'points' ? a.rows.map((r) => r.title) : [];
  const lines = a.intent === 'week' ? a.rows.map((r) => `${[r.title, r.figure].filter(Boolean).join(', ')}: ${r.sub ?? ''}.`.replace(/: \.$/, '.')) : [];
  return [a.summary, ...points, ...lines, a.doThis?.text, a.offer?.question].filter(Boolean).join(' ');
}
