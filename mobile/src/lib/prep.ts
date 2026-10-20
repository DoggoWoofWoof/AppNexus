// The rep's own Summary of someone: their words and goal, kept on the phone with
// the workspace and laid over the summary written from the data each time
// (summaryOf in lib/brief.ts, buildPrep in lib/saved.ts). Inside the app it's
// still called prep, as in prepId; on screen it's the Summary.
//
// Ask can help. "How can I improve their summary?" suggests what it doesn't say
// yet, and "Help me write their summary" drafts a goal and what to bring up.
// "Add to summary" under either answer keeps them as the rep's own, to change after.

import type { Answer, AskLink } from './ask';
import { buildBrief, visitWhen, type Brief, type PointKind } from './brief';
import { getEntity, hcpsAt, procedureTotal, shortName } from './data';
import { DATA_PERIOD } from './data/seed';
import { daysBetween, firstSentence, fromIso, plural, relativeDayLower, sum } from './format';
import type { Asked } from './saved';
import type { Entity, FollowUp, PrepEdit, Workspace } from './types';
import type { Context } from './workspace';

export type { PrepEdit };

/** What the Summary's buttons ask in the person's own Ask. */
export const IMPROVE_PREP = 'How can I improve their summary?';
export const START_PREP = 'Help me write their summary';

// Asked of normalised text (lower case, no punctuation), in lib/ask.ts.
const STARTING = /\bhelp me (prep|prepare|get ready)\b|\bget me ready\b|\b(write|start|draft) (a |the |their |his |her )?summary\b/;
/** "Improve the summary for Dr. Patel", "make my prep better", "help me write their summary". */
export const PREP_QUESTION = new RegExp(
  `\\b(improve|sharpen|better|stronger|strengthen|tighten|add to|work on)\\b.*\\b(prep|summary)\\b|\\b(prep|summary)\\b.*\\b(better|stronger|sharper)\\b|${STARTING.source}`,
);

export const GOAL_MAX = 140;
/** A line of the rep's summary: room for two or three sentences. */
export const POINT_MAX = 300;
export const MAX_POINTS = 8;

const tidy = (text: string) => text.replace(/\s+/g, ' ').trim();
const key = (text: string) => text.toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();
/** Two points say the same thing, whatever the case, spacing or full stop. */
export const samePoint = (a: string, b: string): boolean => key(a) === key(b);
const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** The rep's edits to someone's prep, or null when they have none. */
export const prepEdit = (ws: Pick<Workspace, 'prep'>, id: string): PrepEdit | null => ws.prep?.[id] ?? null;

/**
 * The rep's own Summary of someone as plain sentences, shown and read aloud in
 * place of the one written from the data. Null until they have written or added some.
 */
export function improvedSummary(ws: Pick<Workspace, 'prep'>, id: string): string | null {
  const lines = prepEdit(ws, id)?.points ?? [];
  return lines.length ? lines.map(sentence).join(' ') : null;
}

/** The goal the prep would have without the rep's own: the plan's, or the suggested one. */
export const goalWithoutYours = (entity: Entity, ctx: Context): string => buildBrief(entity, { ...ctx, ws: { ...ctx.ws, prep: undefined } }).goal;

/** An edit as it's kept: trimmed, without blank or repeated points, within the limits. Null when nothing is left. */
function cleanEdit(edit: PrepEdit): PrepEdit | null {
  const goal = tidy(edit.goal).slice(0, GOAL_MAX);
  const points: string[] = [];
  for (const point of edit.points.map((p) => tidy(p).slice(0, POINT_MAX))) {
    if (point && !points.some((p) => samePoint(p, point))) points.push(point);
  }
  return goal || points.length ? { goal, points: points.slice(0, MAX_POINTS) } : null;
}

/** Keeps the rep's summary and goal for someone. With both blank, it goes back to the one written from the data. */
export function withPrepEdit(ws: Workspace, id: string, edit: PrepEdit): Workspace {
  const next = cleanEdit(edit);
  if (JSON.stringify(next) === JSON.stringify(prepEdit(ws, id))) return ws;
  const { [id]: _old, ...rest } = ws.prep ?? {};
  return { ...ws, prep: next ? { ...rest, [id]: next } : rest, pristine: false };
}

/** What "Add to summary" in Ask adds: a goal, used only when the rep has none, and lines after their own. */
export interface PrepAdd {
  goal?: string;
  points: string[];
}

export function withPrepAdded(ws: Workspace, id: string, add: PrepAdd): Workspace {
  const now = prepEdit(ws, id);
  return withPrepEdit(ws, id, { goal: now?.goal || add.goal || '', points: [...(now?.points ?? []), ...add.points] });
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** The edits kept on the phone, leaving out anything unreadable. */
export function restorePrepEdits(value: unknown): Record<string, PrepEdit> {
  if (!isRecord(value)) return {};
  const out: Record<string, PrepEdit> = {};
  for (const [id, kept] of Object.entries(value)) {
    if (!isRecord(kept)) continue;
    const edit = cleanEdit({
      goal: typeof kept.goal === 'string' ? kept.goal : '',
      points: Array.isArray(kept.points) ? kept.points.filter((p): p is string => typeof p === 'string') : [],
    });
    if (edit) out[id] = edit;
  }
  return out;
}

/**
 * A Summary with little to say: no visit planned, nothing owed and nothing of
 * the rep's own, written or asked. Its button offers to write one with Ask.
 */
export const isThinPrep = (brief: Pick<Brief, 'visit' | 'followUps'>, edit: PrepEdit | null, asked: Asked[]): boolean =>
  !brief.visit && !brief.followUps.length && !edit && !asked.length;

/** Something worth bringing up, and where it comes from. */
export interface PrepIdea {
  text: string;
  why: string;
}

const WHY: Record<PointKind, string> = {
  promise: 'You promised it',
  lastNote: 'From your last note',
  leak: 'Where their patients go',
  up: 'Their volumes',
  down: 'Their volumes',
  referrer: 'Who refers to them',
  contact: 'People to meet',
};

const dueWords = (f: FollowUp, today: Date) => {
  const late = daysBetween(fromIso(f.due), today);
  return late > 0 ? `${plural(late, 'day')} late` : `Due ${relativeDayLower(f.due, today)}`;
};

/**
 * What could go in someone's prep, best first: the brief's talking points, then
 * what else the data and notes hold, such as other promises, last time, who
 * sends them patients, who they work with and their main condition.
 */
export function prepIdeas(entity: Entity, ctx: Context, brief: Brief = buildBrief(entity, ctx)): PrepIdea[] {
  const ideas: PrepIdea[] = brief.points.map((p) => ({ text: p.text, why: WHY[p.kind] }));
  const kinds = new Set(brief.points.map((p) => p.kind));
  const add = (text: string, why: string) => {
    if (!ideas.some((i) => samePoint(i.text, text))) ideas.push({ text, why });
  };

  // Promises not already the goal or a point.
  for (const f of brief.followUps) {
    if (!samePoint(f.text, brief.goal) && !brief.points.some((p) => p.text.includes(f.text))) add(`Bring what you promised: ${sentence(lowerFirst(f.text))}`, dueWords(f, ctx.today));
  }
  const last = ctx.lastInteraction(entity.id);
  if (last?.note && !kinds.has('lastNote')) add(`Pick up from last time: ${firstSentence(last.note)}`, `Your note, ${relativeDayLower(last.date, ctx.today)}`);

  if (entity.kind === 'hcp') {
    const source = entity.referrals.inbound.filter((r) => r.hcpId).sort((a, b) => b.count - a.count)[0];
    const referrer = source?.hcpId ? getEntity(source.hcpId) : null;
    if (source && referrer && !kinds.has('referrer')) add(`${referrer.name} sends them ${source.count} patients a year. Ask how that’s going.`, 'Who refers to them');
    const tie = entity.relationships[0];
    const peer = tie ? getEntity(tie.hcpId) : null;
    if (tie && peer) add(`They work with ${peer.name}: ${sentence(lowerFirst(tie.detail))}`, tie.type);
    const condition = [...entity.diagnoses].sort((a, b) => sum(b.series.slice(-4)) - sum(a.series.slice(-4)))[0];
    if (condition) add(`Their most common condition is ${lowerFirst(condition.name)}. Ask how they treat it now.`, 'From claims, last 12 months');
  } else {
    const busiest = [...hcpsAt(entity.id)].sort((a, b) => procedureTotal(b) - procedureTotal(a))[0];
    if (busiest) add(`${busiest.name} is their busiest doctor here. Ask to meet them.`, 'Top doctors here');
    const family = entity.leakage?.byFamily[1];
    if (family) add(`${family.leftPct}% of ${family.family} patients leave the system too.`, 'Where patients go');
    const person = entity.executives.find((e) => !brief.points.some((p) => p.text.includes(e.name)));
    if (person) add(`${person.name}, ${person.title}, is the ${person.role.toLowerCase()}.`, 'People to meet');
  }
  if (entity.access?.reach) add(`Getting in: ${sentence(entity.access.reach)}`, 'How to get in');
  return ideas;
}

/**
 * Ask's answer to "Help me write their summary" or "How can I improve their
 * summary?". Starting gives a goal and the three best points. Improving gives up
 * to three the full summary doesn't say yet. "Add to summary" keeps them as the rep's own.
 */
export function prepAnswer(entity: Entity, ctx: Context, q: string): Omit<Answer, 'intent' | 'about' | 'subject'> & { about: string } {
  const brief = buildBrief(entity, ctx);
  const edit = prepEdit(ctx.ws, entity.id);
  const mine = edit?.points ?? [];
  const starting = STARTING.test(q) && !mine.length;
  // Improving leaves out what the full summary already says.
  const said = starting ? mine : [...mine, ...brief.points.map((p) => p.text)];
  const ideas = prepIdeas(entity, ctx, brief)
    .filter((i) => !said.some((s) => samePoint(s, i.text)))
    .slice(0, 3);
  const name = shortName(entity);
  const result = {
    scope: [brief.visit ? visitWhen(brief.visit, entity, ctx.today) : 'No visit planned', DATA_PERIOD],
    rows: ideas.map((i) => ({ title: i.text, sub: i.why, figure: '' })),
    next: [entity.kind === 'hcp' ? 'Where do their patients go?' : 'Where do patients go?', 'What happened last time?', brief.visit ? 'Any open follow-ups?' : 'When can I see them?'],
    about: entity.id,
  };
  if (!ideas.length && !starting) {
    return { ...result, summary: `The summary for ${name} already has what the figures and your notes show. Ask me about them, then add what you learn with Edit summary.`, doThis: null };
  }
  const link: AskLink = { kind: 'prep', id: entity.id, goal: starting && !edit?.goal ? brief.goal : undefined, points: ideas.map((i) => i.text) };
  return {
    ...result,
    summary: starting ? `Here’s a start for ${name}. Goal: ${sentence(brief.goal)}` : `${plural(ideas.length, 'thing')} to add to the summary for ${name}.`,
    doThis: { text: 'Put this in the summary. You can change it after.', label: 'Add to summary', link },
  };
}
