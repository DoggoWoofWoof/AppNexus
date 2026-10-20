// The visit brief: what to know and say before seeing someone. It leads every
// profile and can be shared as text. Talking points are fixed rules over the
// sample data, not AI. Ported from demo/js/brief.js.

import { destination, getEntity, openFollowUps, patientsLost, procedureTotal, procedureYoy, proceduresOf, referredOut, siteFor } from './data';
import { DATA_PERIOD } from './data/seed';
import { daysBetween, firstSentence, formatDate, formatNumber, fromIso, plural, relativeDay, relativeDayLower, sum, yoy } from './format';
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

export interface Brief {
  /** The next planned visit, today or later. */
  visit: { item: PlanItem; day: string } | null;
  goal: string;
  /** True when the goal is the app's suggestion rather than one set in the plan. */
  goalSuggested: boolean;
  /** When the goal is an open follow-up, when it's due: "due today", "overdue by 2 days". */
  goalDue: string | null;
  insight: string;
  points: { kind: PointKind; text: string }[];
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
    sub: last ? `${last.type} · ${last.outcome}` : 'Nothing logged yet',
  };
  return [volume, leak, contact];
}

export function buildBrief(entity: Entity, ctx: Context): Brief {
  const visit = ctx.nextVisit(entity.id);
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
  const goalFollowUp = visit?.item.goal ? null : (open[0] ?? null);
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
    goal: visit?.item.goal || suggested,
    goalSuggested: !visit?.item.goal,
    goalDue: goalFollowUp ? dueText(goalFollowUp, ctx.today) : null,
    insight,
    points: points.slice(0, 3),
    figures: briefFigures(entity, ctx),
    followUps: open,
  };
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
