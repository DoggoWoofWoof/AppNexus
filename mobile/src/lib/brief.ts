// The visit brief: what to know and say before seeing someone. It leads every
// profile and can be shared as text. Talking points are fixed rules over the
// sample data, not AI. Ported from demo/js/brief.js.

import { usualTimes } from './booking';
import { destination, getEntity, getOrg, hcpsAt, openFollowUps, parentOf, patientsLost, procedureTotal, procedureYoy, proceduresOf, referredOut, siteFor } from './data';
import { DATA_PERIOD } from './data/seed';
import { daysBetween, firstSentence, formatDate, formatNumber, fromIso, isoDate, plural, relativeDay, relativeDayLower, says, sentence, sum, yoy } from './format';
import { endTime, isOnSite } from './plan';
import type { Entity, FollowUp, PlanItem } from './types';
import type { Context } from './workspace';

export interface Figure {
  label: string;
  value: string;
  delta?: number | null;
  sub?: string;
  tone?: 'orange';
}

/** What a talking point is about, so the screen can give it an icon. */
export type PointKind = 'promise' | 'lastNote' | 'leak' | 'up' | 'down' | 'referrer' | 'contact';

export interface BriefPoint {
  kind: PointKind;
  text: string;
}

export interface Brief {
  /** The next planned visit, today or later. */
  visit: { item: PlanItem; day: string } | null;
  goal: string;
  /** True when the goal is the app's suggestion rather than one set in the plan. */
  goalSuggested: boolean;
  /** When the goal is an open follow-up, when it's due: "due today", "overdue by 2 days". */
  goalDue: string | null;
  insight: string;
  points: BriefPoint[];
  /** Volume, leakage and last contact. */
  figures: Figure[];
  /** Open follow-ups, soonest due first. */
  followUps: FollowUp[];
}

/** "due today", "due in 3 days" or "overdue by 2 days". */
function dueText(f: FollowUp, today: Date): string {
  const late = daysBetween(fromIso(f.due), today);
  return late > 0 ? `overdue by ${plural(late, 'day')}` : `due ${relativeDayLower(f.due, today)}`;
}

/** The busiest procedure family over the last four quarters, with its change on last year. */
function topProcedure(entity: Entity) {
  const rows = proceduresOf(entity);
  if (!rows?.length) return null;
  const top = [...rows].sort((a, b) => sum(b.series.slice(-4)) - sum(a.series.slice(-4)))[0];
  return { name: top.family, count: sum(top.series.slice(-4)), growth: yoy(top.series) };
}

export function insightFor(entity: Entity): string {
  return entity.kind === 'hcp' ? entity.insight : (entity.leakage?.insight ?? entity.leakageUnavailable ?? 'No leakage signal for this facility.');
}

/** Three headline figures: volume, leakage and last contact. */
export function briefFigures(entity: Entity, ctx: Context): Figure[] {
  const last = ctx.lastInteraction(entity.id);
  const volume: Figure = proceduresOf(entity)
    ? { label: 'Procedures · 12 months', value: formatNumber(procedureTotal(entity)), delta: procedureYoy(entity) }
    : { label: 'Procedures · 12 months', value: '—', sub: 'None in this sample' };
  let leak: Figure;
  if (entity.kind === 'hcp') {
    const out = entity.referrals.outbound;
    const leaving = referredOut(entity);
    leak = {
      label: 'Sent outside the system',
      value: formatNumber(leaving),
      sub: out.length ? `of ${formatNumber(sum(out.map((r) => r.count)))} they referred on` : 'No referrals out',
      tone: leaving ? 'orange' : undefined,
    };
  } else {
    leak = entity.leakage
      ? {
          label: 'Patients leaving',
          value: formatNumber(patientsLost(entity.leakage)),
          sub: `${entity.leakage.leftPct}% of ${formatNumber(entity.leakage.patients)}`,
          tone: entity.leakage.leftPct >= 20 ? 'orange' : undefined,
        }
      : { label: 'Patients leaving', value: '—', sub: 'Not reported here' };
  }
  const contact: Figure = {
    label: 'Last contact',
    value: last ? relativeDay(last.date, ctx.today) : 'Never',
    sub: last ? `${last.type} · ${outcomeWord(last.outcome, last.type)}` : 'Nothing logged yet',
  };
  return [volume, leak, contact];
}

export function buildBrief(entity: Entity, ctx: Context): Brief {
  const visit = ctx.nextVisit(entity.id);
  // A goal the rep wrote in their prep (lib/prep.ts) comes before the plan's or a suggested one.
  const ownGoal = ctx.ws.prep?.[entity.id]?.goal || '';
  const open = openFollowUps(entity.id, ctx.ws).sort((a, b) => a.due.localeCompare(b.due));
  const last = ctx.lastInteraction(entity.id);
  const proc = topProcedure(entity);
  const insight = insightFor(entity);
  const points: Brief['points'] = [];
  let leakName: string | null = null;
  // The insight often names the same place already; don't say it twice.
  const pointUnlessSaid = (name: string, point: Brief['points'][number]) => {
    if (!insight.includes(name)) points.push(point);
  };

  // With no goal in the plan, the soonest follow-up is the goal, so the first
  // point goes back to last time rather than saying the follow-up again.
  const goalFollowUp = ownGoal || visit?.item.goal ? null : (open[0] ?? null);
  if (open[0] && !goalFollowUp) points.push({ kind: 'promise', text: `You promised: ${open[0].text} (${dueText(open[0], ctx.today)}).` });
  else if (last?.note) points.push({ kind: 'lastNote', text: `Last time (${relativeDayLower(last.date, ctx.today)}): ${firstSentence(last.note)}` });

  // The biggest destination outside the system for an HCP's referrals or an account's patients.
  if (entity.kind === 'hcp') {
    const out = entity.referrals.outbound.filter((r) => r.ref).sort((a, b) => b.count - a.count)[0];
    if (out?.ref) {
      leakName = destination(out.ref).name;
      pointUnlessSaid(leakName, { kind: 'leak', text: `${out.count} patients went to ${leakName}${out.reason ? ` for ${out.reason}` : ''}. Ask what would keep them in the system.` });
    }
  } else {
    const dest = entity.leakage?.destinations.filter((d) => d.ref).sort((a, b) => b.patients - a.patients)[0];
    const family = entity.leakage?.byFamily[0];
    if (dest?.ref && family) {
      leakName = destination(dest.ref).name;
      pointUnlessSaid(leakName, {
        kind: 'leak',
        text: `${family.leftPct}% of ${family.family} patients leave the system; ${leakName} takes the most (${formatNumber(dest.patients)} patients).`,
      });
    }
  }

  if (proc) {
    const dir = proc.growth >= 1 ? `up ${Math.round(proc.growth)}%` : proc.growth <= -1 ? `down ${Math.round(-proc.growth)}%` : 'flat';
    points.push({ kind: proc.growth <= -1 ? 'down' : 'up', text: `${proc.name}: ${formatNumber(proc.count)} in 12 months, ${dir} on last year.` });
  }

  if (points.length < 3 && entity.kind === 'hcp') {
    const source = entity.referrals.inbound.filter((r) => r.hcpId).sort((a, b) => b.count - a.count)[0];
    const peer = source?.hcpId ? getEntity(source.hcpId) : null;
    if (source && peer) points.push({ kind: 'referrer', text: `${peer.name} sends them ${source.count} patients a year.` });
  }
  if (points.length < 3 && entity.kind === 'hco' && entity.executives[0]) {
    const e = entity.executives[0];
    points.push({ kind: 'contact', text: `${e.name}, ${e.title}, is the ${e.role.toLowerCase()}.` });
  }

  const suggested = goalFollowUp?.text ?? (leakName ? `Ask what would keep ${leakName} patients in the system` : 'Catch up and agree a next step');
  return {
    visit,
    goal: ownGoal || visit?.item.goal || suggested,
    goalSuggested: !ownGoal && !visit?.item.goal,
    goalDue: goalFollowUp ? dueText(goalFollowUp, ctx.today) : null,
    insight,
    points: points.slice(0, 3),
    figures: briefFigures(entity, ctx),
    followUps: open,
  };
}

/**
 * A logged outcome in the log sheet's words: "Met" or "Not in" after a visit,
 * "Talked" or "No answer" after a call, and "Met" or "Didn’t meet" after a
 * meeting with an account, which isn't "in" or out.
 */
export function outcomeWord(outcome: string, type: string): string {
  const call = type === 'Phone call' || type === 'Video call';
  if (outcome === 'Attempted') return call ? 'No answer' : type === 'Meeting' ? 'Didn’t meet' : 'Not in';
  return outcome === 'Met' && call ? 'Talked' : outcome;
}

/**
 * A few plain sentences on who someone is, at the start of their Summary: where
 * they work and when they're in, the last contact, and follow-ups owed. Written
 * from the data each time, so it stays up to date; the rep's own words go after
 * it (summaryParagraph). The numbers sit in the figures under it.
 */
export function summaryOf(entity: Entity, ctx: Context): string {
  const todayIso = isoDate(ctx.today);
  const last = ctx.lastInteraction(entity.id);
  const open = openFollowUps(entity.id, ctx.ws);
  const late = open.filter((f) => f.due < todayIso).length;
  const dueToday = open.filter((f) => f.due === todayIso).length;
  let who: string;
  if (entity.kind === 'hcp') {
    const sites = [...entity.affiliations].sort((a, b) => b.share - a.share).flatMap((a) => getOrg(a.orgId)?.name ?? []);
    who = `Works at ${sites[0] ?? siteFor(entity).name}${sites.length > 1 ? ` and ${plural(sites.length - 1, 'other place')}` : ''}. ${usualTimes(entity)}.`;
  } else {
    const parent = parentOf(entity);
    const doctors = hcpsAt(entity.id).length;
    who = [
      `${entity.typeDetail} in ${entity.city.replace(/ \d{5}$/, '')}${parent ? `, part of ${parent.name}` : ''}.`,
      doctors ? `${plural(doctors, 'doctor')} you cover ${doctors === 1 ? 'works' : 'work'} here.` : '',
    ]
      .filter(Boolean)
      .join(' ');
  }
  const by = last && last.author !== 'You' ? ` by ${last.author}` : '';
  const seen = last
    ? `Last contact ${relativeDayLower(last.date, ctx.today)}: ${last.type.toLowerCase()}${by}, ${outcomeWord(last.outcome, last.type).toLowerCase()}.`
    : 'You haven’t been in touch yet.';
  const owed = late ? `${plural(late, 'follow-up')} late.` : dueToday ? `${plural(dueToday, 'follow-up')} due today.` : open.length ? `${plural(open.length, 'follow-up')} open.` : '';
  return [who, seen, owed].filter(Boolean).join(' ');
}

/**
 * Someone's Summary as one paragraph: the facts written from the data each time
 * (summaryOf), then the rep's own words, written by them or kept from Ask
 * (lib/prep.ts), or why they matter now until they have some.
 */
export const summaryParagraph = (entity: Entity, ctx: Context): string =>
  `${summaryOf(entity, ctx)} ${ctx.ws.prep?.[entity.id]?.text || sentence(insightFor(entity))}`;

/** The talking points someone's Summary doesn't say already. */
export const pointsBesides = (brief: Pick<Brief, 'points'>, summary: string): BriefPoint[] => brief.points.filter((p) => !says(summary, p.text));

/**
 * What Listen reads on someone's page: who they are, the Summary as the card has
 * it, the numbers that matter, why now if the Summary doesn't say it, and what to
 * bring up that it doesn't say already.
 */
export function speechFor(entity: Entity, ctx: Context, brief: Brief): string {
  const [volume] = brief.figures;
  const trend = volume.delta != null ? `, ${volume.delta >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(volume.delta))}% on last year` : '';
  const summary = summaryParagraph(entity, ctx);
  return [
    `${entity.name}.`,
    summary,
    volume.value !== '—' ? `${volume.value} procedures in the last 12 months${trend}.` : '',
    says(summary, brief.insight) ? '' : brief.insight,
    `Next time: ${brief.goal.replace(/[.!?]?$/, '.')}`,
    ...pointsBesides(brief, summary).filter((p) => p.kind !== 'up' && p.kind !== 'down').map((p) => p.text),
  ]
    .filter(Boolean)
    .join(' ');
}

/** When and where a visit is, e.g. "Thu 22 Oct · 07:30–08:00 · Mount Sinai West"; calls and emails have no place. */
export function visitWhen({ item, day }: NonNullable<Brief['visit']>, entity: Entity, today: Date): string {
  const diff = relativeDay(day, today);
  const date = diff === 'Today' || diff === 'Tomorrow' ? `${diff}, ${formatDate(day)}` : formatDate(day);
  const time = item.mode === 'timed' && item.time ? `${item.time}–${endTime(item)}` : 'Any time';
  return [date, time, ...(isOnSite(item) ? [siteFor(entity, item.siteId).name] : [])].join(' · ');
}

/** The brief as plain text, for pasting into an email or a CRM note. */
export function briefText(entity: Entity, brief: Brief, today: Date): string {
  const lines = [`Visit brief: ${entity.name}`];
  if (brief.visit) lines.push(visitWhen(brief.visit, entity, today));
  lines.push('', `Goal: ${brief.goal}${brief.goalDue ? ` (follow-up ${brief.goalDue})` : ''}`, `Why now: ${brief.insight}`);
  if (brief.points.length) lines.push('', 'Talking points:', ...brief.points.map((p) => `- ${p.text}`));
  lines.push('', brief.figures.map((f) => `${f.label}: ${f.value}${f.delta != null ? ` (${f.delta >= 0 ? '+' : ''}${Math.round(f.delta)}% on last year)` : ''}`).join(' · '));
  lines.push('', `${DATA_PERIOD}.`);
  return lines.join('\n');
}
