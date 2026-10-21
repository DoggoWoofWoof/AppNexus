// Someone's Summary (called prep inside the app, as in prepId) is one paragraph:
// the facts written from the data each time, so they keep themselves up to date,
// then the rep's own words (summaryParagraph in lib/brief.ts). This keeps those
// words and the rep's own goal on the phone with the workspace.
//
// Ask can write the words, or make them better. "Help me write their summary"
// and "How can I improve their summary?" both answer with the whole paragraph:
// the rep's words as they are (or why they matter now, until they have some),
// then what matters most that they don't say yet, up to three things in all.
// "Use this summary" puts it in place, with Undo.

import type { Answer, AskLink } from './ask';
import { buildBrief, summaryOf, visitWhen, type Brief, type PointKind } from './brief';
import { getEntity, hcpsAt, procedureTotal, shortName } from './data';
import { DATA_PERIOD } from './data/seed';
import { listJoin, lowerFirst, samePoint, says, sentence, sentencesOf, sum } from './format';
import type { Entity, PrepEdit, Workspace } from './types';
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
/** The rep's words in a Summary: room for a good paragraph. */
export const TEXT_MAX = 1500;

const tidy = (text: string) => text.replace(/\s+/g, ' ').trim();

/** The rep's edits to someone's prep, or null when they have none. */
export const prepEdit = (ws: Pick<Workspace, 'prep'>, id: string): PrepEdit | null => ws.prep?.[id] ?? null;

/** The rep's words in someone's Summary, or null until they write some or keep Ask's. */
export const summaryText = (ws: Pick<Workspace, 'prep'>, id: string): string | null => prepEdit(ws, id)?.text || null;

/** The goal the prep would have without the rep's own: the plan's, or the suggested one. */
export const goalWithoutYours = (entity: Entity, ctx: Context): string => buildBrief(entity, { ...ctx, ws: { ...ctx.ws, prep: undefined } }).goal;

const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Words as a paragraph: on one line, starting with a capital and ending like a sentence. */
function asParagraph(text: string): string {
  const line = tidy(text).slice(0, TEXT_MAX).trim();
  return line ? sentence(capitalised(line)) : '';
}

/** An edit as it's kept: tidy and within the limits. Null when nothing is left. */
function cleanEdit(edit: PrepEdit): PrepEdit | null {
  const goal = tidy(edit.goal).slice(0, GOAL_MAX);
  const text = asParagraph(edit.text);
  return goal || text ? { goal, text } : null;
}

/** Keeps the rep's words and goal for someone. With both blank, the Summary goes back to the one from the data. */
export function withPrepEdit(ws: Workspace, id: string, edit: PrepEdit): Workspace {
  const next = cleanEdit(edit);
  if (JSON.stringify(next) === JSON.stringify(prepEdit(ws, id))) return ws;
  const { [id]: _old, ...rest } = ws.prep ?? {};
  return { ...ws, prep: next ? { ...rest, [id]: next } : rest, pristine: false };
}

/** Puts words from Ask in someone's Summary in place of the rep's, keeping their goal. */
export const withSummaryText = (ws: Workspace, id: string, text: string): Workspace =>
  withPrepEdit(ws, id, { goal: prepEdit(ws, id)?.goal ?? '', text });

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Lines kept before the Summary was one paragraph, as sentences one after another. */
const fromLines = (lines: unknown[]): string =>
  lines
    .filter((line): line is string => typeof line === 'string')
    .map(tidy)
    .filter(Boolean)
    .map((line) => sentence(capitalised(line)))
    .join(' ');

/** The edits kept on the phone, leaving out anything unreadable. Lines kept before the Summary was one paragraph become one. */
export function restorePrepEdits(value: unknown): Record<string, PrepEdit> {
  if (!isRecord(value)) return {};
  const out: Record<string, PrepEdit> = {};
  for (const [id, kept] of Object.entries(value)) {
    if (!isRecord(kept)) continue;
    const edit = cleanEdit({
      goal: typeof kept.goal === 'string' ? kept.goal : '',
      text: typeof kept.text === 'string' ? kept.text : Array.isArray(kept.points) ? fromLines(kept.points) : '',
    });
    if (edit) out[id] = edit;
  }
  return out;
}

/**
 * A Summary with little to say: no visit planned, nothing owed and nothing the
 * rep has written or kept. Its button offers to write one with Ask.
 */
export const isThinPrep = (brief: Pick<Brief, 'visit' | 'followUps'>, edit: PrepEdit | null): boolean => !brief.visit && !brief.followUps.length && !edit;

/** Something worth saying in someone's Summary, and what it's about, so Ask can say what it added. */
export interface SummaryIdea {
  text: string;
  about: string;
}

const ABOUT: Partial<Record<PointKind, string>> = {
  leak: 'where their patients go',
  up: 'their main procedure',
  down: 'their main procedure',
  referrer: 'who refers to them',
  contact: 'who to meet',
};

/**
 * Words to go in the middle of a sentence: "Heart failure" becomes "heart
 * failure", but "NSTEMI", "AF ablation" and "Harlem Health Center" stay as they are.
 */
function midSentence(text: string): string {
  const [first, second] = text.split(' ');
  const plainWord = /^[A-Z][a-z-]*[,:]?$/.test(first);
  const name = !!second && /^[A-Z]/.test(second);
  return plainWord && !name ? lowerFirst(text) : text;
}

/**
 * What matters most about someone, for their Summary, best first: why they matter
 * now, the brief's points on where patients go, their main procedure, who refers
 * to them and who to meet, then what else the data holds, each as a sentence for
 * the paragraph. A promise or last time changes from one visit to the next, so
 * it's left to the facts, the goal and the talking points, which keep up with it,
 * and how to get in has a card of its own.
 */
export function summaryIdeas(entity: Entity, ctx: Context, brief: Brief = buildBrief(entity, ctx)): SummaryIdea[] {
  const ideas: SummaryIdea[] = [{ text: sentence(brief.insight), about: 'why they matter now' }];
  const add = (text: string, about: string) => {
    if (!ideas.some((i) => samePoint(i.text, text))) ideas.push({ text, about });
  };
  for (const p of brief.points) {
    const about = ABOUT[p.kind];
    if (!about) continue;
    if (p.kind === 'up' || p.kind === 'down') {
      // A volume the insight is about already, as in "PCI volume is up about 17%", isn't said again.
      // Said in full, the talking point isn't said twice (pointsBesides in lib/brief.ts).
      if (!brief.insight.includes(p.text.split(':')[0])) add(`Their most common procedure is ${midSentence(p.text)}`, about);
    } else add(p.text, about);
  }
  const kinds = new Set(brief.points.map((p) => p.kind));
  if (entity.kind === 'hcp') {
    const source = entity.referrals.inbound.filter((r) => r.hcpId).sort((a, b) => b.count - a.count)[0];
    const referrer = source?.hcpId ? getEntity(source.hcpId) : null;
    if (source && referrer && !kinds.has('referrer')) add(`${referrer.name} sends them ${source.count} patients a year.`, 'who refers to them');
    const tie = entity.relationships[0];
    const peer = tie ? getEntity(tie.hcpId) : null;
    if (tie && peer) add(`They work with ${peer.name}: ${sentence(midSentence(tie.detail))}`, 'who they work with');
    const condition = [...entity.diagnoses].sort((a, b) => sum(b.series.slice(-4)) - sum(a.series.slice(-4)))[0];
    if (condition) add(`Their patients most often have ${sentence(midSentence(condition.name))}`, 'their main condition');
  } else {
    const busiest = [...hcpsAt(entity.id)].sort((a, b) => procedureTotal(b) - procedureTotal(a))[0];
    if (busiest) add(`${busiest.name} is the busiest doctor you cover here.`, 'their busiest doctor');
    const family = entity.leakage?.byFamily[1];
    if (family) add(`${family.leftPct}% of ${family.family} patients leave the system too.`, 'where else patients go');
    const person = entity.executives.find((e) => !brief.points.some((p) => p.text.includes(e.name)));
    if (person) add(`${person.name}, ${person.title}, is the ${person.role.toLowerCase()}.`, 'who to meet');
  }
  return ideas;
}

/** Why now and two more: as much as a summary has room for. */
const IDEAS_IN_SUMMARY = 3;

/**
 * What Ask would make the rep's words in someone's Summary: theirs as they are,
 * or why they matter now until they have some, as the Summary says then, followed
 * by what matters most that they don't say yet, up to three things in all. Null
 * when they say those already. `full` when there was more to say but no room
 * left for it.
 */
export function betterSummary(entity: Entity, ctx: Context, brief: Brief = buildBrief(entity, ctx)): { text: string; added: SummaryIdea[]; full: boolean } | null {
  const start = summaryText(ctx.ws, entity.id) ?? sentence(brief.insight);
  const ideas = summaryIdeas(entity, ctx, brief);
  let room = IDEAS_IN_SUMMARY - ideas.filter((i) => says(start, i.text)).length;
  let text = start;
  const added: SummaryIdea[] = [];
  let full = false;
  for (const idea of ideas) {
    if (room <= 0) break;
    // Part of it may be said already, such as the first sentence of why now.
    const unsaid = sentencesOf(idea.text).filter((s) => !says(text, s));
    if (!unsaid.length) continue;
    const longer = [text, ...unsaid].join(' ');
    if (longer.length > TEXT_MAX) {
      full = true;
      break;
    }
    text = longer;
    added.push(idea);
    room -= 1;
  }
  return added.length || full ? { text, added, full } : null;
}

/**
 * Ask's answer to "Help me write their summary" or "How can I improve their
 * summary?": the whole Summary as it would read, the facts from the data and then
 * the better words, with "Use this summary" to put it in place.
 */
export function prepAnswer(entity: Entity, ctx: Context): Omit<Answer, 'intent' | 'about' | 'subject'> & { about: string } {
  const brief = buildBrief(entity, ctx);
  const better = betterSummary(entity, ctx, brief);
  const name = shortName(entity);
  const result = {
    scope: [brief.visit ? visitWhen(brief.visit, entity, ctx.today) : 'No visit planned', DATA_PERIOD],
    rows: [] as Answer['rows'],
    next: [entity.kind === 'hcp' ? 'Where do their patients go?' : 'Where do patients go?', 'What happened last time?', brief.visit ? 'Any open follow-ups?' : 'When can I see them?'],
    about: entity.id,
  };
  if (!better?.added.length) {
    const why = better?.full
      ? `The summary for ${name} has no room for more. Make it shorter with Edit, then ask again.`
      : `The summary for ${name} already says what matters most in the figures. Ask me about them, then add what you learn with Edit.`;
    return { ...result, summary: why, doThis: null };
  }
  const link: AskLink = { kind: 'prep', id: entity.id, text: better.text };
  return {
    ...result,
    summary: `${summaryOf(entity, ctx)} ${better.text}`,
    doThis: { text: `This adds ${listJoin([...new Set(better.added.map((i) => i.about))])}. You can change it after.`, label: 'Use this summary', link },
  };
}
