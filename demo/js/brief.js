// The visit brief: what to know and say before seeing someone. It is the first
// card on every profile (Prepare opens the profile), built from the same sample
// data as the rest of it. Talking points are fixed rules over the data, not AI.

import { destination, getEntity, openFollowUps, proceduresOf, procedureTotal, procedureYoy, siteFor } from './data/index.js';
import { changeWords, formatDate, formatNumber, relativeDay, sum, yoy } from './format.js';
import { endTime } from './plan.js';

const firstSentence = (text) => (text.match(/^.*?[.!?](\s|$)/)?.[0] || text).trim();

/** The busiest procedure family over the last four quarters, with its change on last year. */
function topProcedure(entity) {
  const rows = proceduresOf(entity);
  if (!rows?.length) return null;
  const top = [...rows].sort((a, b) => sum(b.series.slice(-4)) - sum(a.series.slice(-4)))[0];
  return { name: top.family, count: sum(top.series.slice(-4)), growth: yoy(top.series) };
}

/** The biggest destination outside the system for an HCP's referrals or an account's patients. */
function topLeak(entity) {
  if (entity.kind === 'hcp') {
    const out = entity.referrals.outbound.filter((r) => r.ref).sort((a, b) => b.count - a.count)[0];
    return out ? { name: destination(out.ref).name, count: out.count, reason: out.reason } : null;
  }
  const dest = entity.leakage?.destinations.filter((d) => d.ref).sort((a, b) => b.patients - a.patients)[0];
  return dest ? { name: destination(dest.ref).name, count: dest.patients, family: entity.leakage.byFamily[0] } : null;
}

export function insightFor(entity) {
  return entity.kind === 'hcp' ? entity.insight : entity.leakage?.insight || entity.leakageUnavailable || 'No leakage signal for this facility.';
}

/** Three headline figures: volume, leakage and last contact. */
export function briefFigures(entity, ctx) {
  const last = ctx.lastInteraction(entity.id);
  const total = procedureTotal(entity);
  const volume = proceduresOf(entity)
    ? { label: 'Procedures · 12 mo', value: formatNumber(total), delta: procedureYoy(entity) }
    : { label: 'Procedures · 12 mo', value: '—', sub: 'Not in your code group' };
  let leak;
  if (entity.kind === 'hcp') {
    const out = entity.referrals.outbound;
    const leaving = sum(out.filter((r) => r.ref).map((r) => r.count));
    leak = { label: 'Referred out of system', value: formatNumber(leaving), sub: out.length ? `of ${formatNumber(sum(out.map((r) => r.count)))} referred out` : 'No referrals out', tone: leaving ? 'orange' : '' };
  } else {
    leak = entity.leakage
      ? { label: 'Patients leaving', value: `${entity.leakage.leftPct}%`, sub: `of ${formatNumber(entity.leakage.patients)} patients`, tone: entity.leakage.leftPct >= 20 ? 'orange' : '' }
      : { label: 'Patients leaving', value: '—', sub: 'Not reported here' };
  }
  const contact = { label: 'Last contact', value: last ? relativeDay(last.date, ctx.today) : 'Never', sub: last ? `${last.type} · ${last.outcome}` : 'Nothing logged yet' };
  return [volume, leak, contact];
}

/**
 * Everything the profile's first card shows. `visit` is the next planned visit
 * ({ item, day }) when there is one.
 */
export function buildBrief(entity, ctx) {
  const visit = ctx.nextVisit(entity.id);
  const open = openFollowUps(entity.id, ctx.ws).sort((a, b) => a.due.localeCompare(b.due));
  const last = ctx.lastInteraction(entity.id);
  const leak = topLeak(entity);
  const proc = topProcedure(entity);
  const pronoun = entity.kind === 'hcp' ? 'them' : 'the account';

  const points = [];
  if (open[0]) points.push({ icon: 'square-check-big', text: `You promised: ${open[0].text} (due ${relativeDay(open[0].due, ctx.today).toLowerCase()}).` });
  else if (last?.note) points.push({ icon: 'message-square', text: `Last time (${relativeDay(last.date, ctx.today).toLowerCase()}): ${firstSentence(last.note)}` });
  if (leak && entity.kind === 'hcp') {
    points.push({ icon: 'log-out', text: `${leak.count} patients went to ${leak.name}${leak.reason ? ` for ${leak.reason}` : ''}. Ask what would keep them in the system.` });
  } else if (leak) {
    points.push({ icon: 'log-out', text: `${leak.family.leftPct}% of ${leak.family.family} patients leave the system; ${leak.name} takes the most (${formatNumber(leak.count)} patients).` });
  }
  if (proc) {
    const dir = proc.growth >= 1 ? `up ${Math.round(proc.growth)}%` : proc.growth <= -1 ? `down ${Math.round(-proc.growth)}%` : 'flat';
    // The zig-zag arrow in green or red, as every change on the site is.
    const trend = proc.growth >= 1 ? 'up' : proc.growth <= -1 ? 'down' : 'flat';
    points.push({ icon: trend === 'down' ? 'trending-down' : 'trending-up', trend, text: `${proc.name}: ${formatNumber(proc.count)} in 12 months, ${dir} on last year.` });
  }
  if (points.length < 3 && entity.kind === 'hcp') {
    const source = entity.referrals.inbound.filter((r) => r.hcpId).sort((a, b) => b.count - a.count)[0];
    if (source) points.push({ icon: 'git-branch', text: `${getEntity(source.hcpId).name} sends ${pronoun} ${source.count} patients a year.` });
  }
  if (points.length < 3 && entity.kind === 'hco' && entity.executives?.[0]) {
    const e = entity.executives[0];
    points.push({ icon: 'user', text: `${e.name}, ${e.title}, is the ${e.role.toLowerCase()}.` });
  }

  const suggested = open[0]?.text || (leak ? `Ask what would keep ${leak.name} patients in the system` : 'Catch up and agree a next step');
  const goal = visit?.item.goal || suggested;

  return {
    visit,
    goal,
    goalSuggested: !visit?.item.goal,
    insight: insightFor(entity),
    points: points.slice(0, 3),
    figures: briefFigures(entity, ctx),
    followUps: open,
  };
}

/** When and where a visit is, e.g. "Thu 22 Oct · 07:30–08:00 · Mount Sinai West". */
export function visitWhen(visit, entity) {
  const { item, day } = visit;
  return [formatDate(day), item.mode === 'timed' ? `${item.time}–${endTime(item)}` : 'Any time', siteFor(entity, item.siteId).name].join(' · ');
}

/** The brief as plain text, for pasting into an email or a CRM note. */
export function briefText(entity, brief) {
  const lines = [`Visit brief: ${entity.name}`];
  if (brief.visit) lines.push(visitWhen(brief.visit, entity));
  lines.push('', `Goal: ${brief.goal}`, `Why now: ${brief.insight}`, '', 'Talking points:', ...brief.points.map((p) => `- ${p.text}`), '');
  lines.push(brief.figures.map((f) => `${f.label}: ${f.value}${f.delta != null ? ` (${changeWords(f.delta)} on last year)` : ''}`).join(' · '));
  lines.push('', 'Sample data.');
  return lines.join('\n');
}
