// What the menu's Saved list holds: the Summary of anyone the rep is seeing or
// has asked about, and reports kept from Ask. A Summary (called prep inside the
// app) is one working copy, rebuilt every time from the data and the plan with the
// rep's own words in it, so it is never out of date. What they asked stays in the
// chat. A report is a snapshot of one answer, so it keeps the figures as they were
// when saved.

import { SAMPLE, type Answer, type Intent } from './ask';
import { buildBrief, pointsBesides, summaryParagraph, visitWhen } from './brief';
import { getEntity, shortName } from './data';
import { DATA_PERIOD } from './data/seed';
import { daysBetween, formatDate, fromIso, fromMinutes, isoDate, plural, relativeDayLower, says, uid } from './format';
import { prepEdit } from './prep';
import type { Entity, SavedReport } from './types';
import type { Context } from './workspace';

export interface DocLine {
  /** A small label above the text, such as the question an answer came from. */
  label?: string;
  text: string;
  sub?: string;
  figure?: string;
  /** The person or account the line opens. */
  id?: string;
}

/** A saved item as the screens show it, whether it's prep or a report. */
export interface Doc {
  id: string;
  kind: 'prep' | 'report';
  title: string;
  about: string | null;
  /** The visit it's for, or when it was saved. */
  when: string;
  /** The question a report answered. */
  question?: string;
  summary: string;
  sections: { title: string; lines: DocLine[] }[];
  scope: string[];
}

/** A question the rep asked about someone, and the answer's first sentence. */
export interface Asked {
  question: string;
  answer: string;
  at: number;
}

export const prepId = (entityId: string): string => `prep-${entityId}`;
export const prepTarget = (id: string): string | null => (id.startsWith('prep-') ? id.slice(5) : null);

/**
 * Someone's full Summary: the paragraph from their page (summaryParagraph), the
 * goal, why now, the talking points and anything still owed, each as the data and
 * plan have it now. The rep's goal (lib/prep.ts) takes the place of the one
 * written from the data, and nothing the paragraph says is said twice.
 */
export function buildPrep(entity: Entity, ctx: Context): Doc {
  const brief = buildBrief(entity, ctx);
  const own = prepEdit(ctx.ws, entity.id);
  const summary = summaryParagraph(entity, ctx);
  const sections: Doc['sections'] = [{ title: 'Summary', lines: [{ text: summary }] }];
  if (!says(summary, brief.insight)) sections.push({ title: 'Why now', lines: [{ text: brief.insight }] });
  const points = pointsBesides(brief, summary);
  if (points.length) sections.push({ title: 'Talking points', lines: points.map((p) => ({ text: p.text })) });
  // The soonest follow-up is already the goal when nothing else was set, or the first talking point.
  const said = brief.goalDue || brief.points.some((p) => p.kind === 'promise');
  const owed = said ? brief.followUps.slice(1) : brief.followUps;

  if (owed.length) {
    sections.push({
      title: 'Still to do',
      lines: owed.map((f) => {
        const late = daysBetween(fromIso(f.due), ctx.today);
        return { text: f.text, figure: late > 0 ? `${plural(late, 'day')} late` : `Due ${relativeDayLower(f.due, ctx.today)}` };
      }),
    });
  }
  return {
    id: prepId(entity.id),
    kind: 'prep',
    title: `Summary for ${shortName(entity)}`,
    about: entity.id,
    when: brief.visit ? visitWhen(brief.visit, entity, ctx.today) : 'No visit planned yet',
    summary: `${own?.goal ? 'Your goal' : brief.goalSuggested ? 'Suggested goal' : 'Goal'}: ${brief.goal}${brief.goalDue ? ` (${brief.goalDue})` : ''}`,
    sections,
    scope: [DATA_PERIOD, ...(own ? ['Your own words, kept on this phone'] : [])],
  };
}

const TITLES: Partial<Record<Intent, string>> = {
  contact: 'How to reach them',
  history: 'Visit history',
  followups: 'Follow-ups',
  inbound: 'Who refers to them',
  referrals: 'Where they refer',
  mix: 'Procedure mix',
  leakage: 'Where patients go',
  decline: 'What has declined',
  growth: 'What is growing',
  trend: 'Volume trend',
  where: 'Where they work',
  peers: 'Who they work with',
  near: 'Who is nearby',
  suggest: 'Who to see',
  plan: 'Your plan',
  people: 'Top doctors',
  points: 'Talking points',
  brief: 'Brief',
  prep: 'A better summary',
};

/** A name for a saved answer, such as "Where patients go · Mount Sinai West" or "Your week to 19 Oct". */
export function reportTitle(question: string, a: Answer): string {
  const subject = a.subject ? getEntity(a.subject) : null;
  const base = a.title ?? TITLES[a.intent] ?? question.replace(/[?.!\s]+$/, '');
  return subject ? `${base} · ${shortName(subject)}` : base;
}

/** Keeps an answer as a report. */
export function reportFrom(question: string, a: Answer, today: Date, now = Date.now()): SavedReport {
  return {
    id: uid('r'),
    title: reportTitle(question, a),
    about: a.subject,
    question,
    savedOn: isoDate(today),
    createdAt: now,
    summary: a.summary,
    rows: a.rows.map(({ title, sub, figure, id }) => ({ title, sub, figure, id })),
    facts: a.facts,
    scope: a.scope,
  };
}

export function reportDoc(r: SavedReport, today: Date): Doc {
  return {
    id: r.id,
    kind: 'report',
    title: r.title,
    about: r.about,
    when: `Saved ${relativeDayLower(r.savedOn, today)}`,
    question: r.question,
    summary: r.summary,
    sections: r.rows.length
      ? [{ title: r.facts ? 'Details' : 'Figures', lines: r.rows.map((row) => (r.facts ? { label: row.title, text: row.sub ?? '', figure: row.figure, id: row.id } : { text: row.title, sub: row.sub, figure: row.figure, id: row.id })) }]
      : [],
    scope: r.scope,
  };
}

/** What Listen reads: the summary, then the first lines of each section, or every line of a report like the week, with its labels. */
export function docSpeech(doc: Doc): string {
  const lines = doc.sections.flatMap((s) =>
    doc.kind === 'report' && s.lines.some((l) => l.label)
      ? s.lines.map((l) => `${[l.label, l.figure].filter(Boolean).join(', ')}: ${l.text}`)
      : s.lines.slice(0, 3).map((l) => [l.text, l.figure].filter(Boolean).join(', ')),
  );
  return [doc.title, doc.summary, ...lines].map((t) => t.replace(/[.\s]+$/, '')).join('. ') + '.';
}

/**
 * The item as plain text, for sharing in an email or a CRM note. It ends with
 * what it's built from (with the months the figures cover), when it was made,
 * since prep is rebuilt each time and figures move, and a reminder that it's
 * for internal use.
 */
export function docText(doc: Doc, now = new Date()): string {
  const out = [doc.title, doc.when, ''];
  if (doc.question) out.push(`Asked: ${doc.question}`);
  out.push(doc.summary);
  for (const s of doc.sections) {
    out.push('', `${s.title}:`, ...s.lines.map((l) => `- ${l.label ? `${l.label}: ` : ''}${[l.text, l.figure ? `(${l.figure})` : ''].filter(Boolean).join(' ')}${l.sub ? ` — ${l.sub}` : ''}`));
  }
  out.push('', (doc.scope.some((s) => s.startsWith(SAMPLE)) ? doc.scope : [...doc.scope, DATA_PERIOD]).join(' · '));
  const made = `${formatDate(now, { day: 'numeric', month: 'short', year: 'numeric' })}, ${fromMinutes(now.getHours() * 60 + now.getMinutes())}`;
  out.push(`From Field Pro, ${made}. For internal use: check it before it goes outside the company.`);
  return out.join('\n');
}
