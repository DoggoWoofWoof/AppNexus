// Ask Field Pro: answers plain-language questions from the rep's own book.
// The prototype matches intents with keywords and computes answers from the
// sample data. The real version would send the question to an LLM that calls
// the same DocNexus endpoints the screens use, and return this answer shape.

import { allHcps, allOrgs, destination, getEntity, getOrg, hcpsAt, primaryOrg, procedureTotal, procedureYoy, proceduresOf, siteFor } from './data/index.js';
import { addSeries } from './data/series.js';
import { REP } from './data/seed.js';
import { daysBetween, formatKm, formatNumber, formatPct, fromIso, haversineKm, plural, relativeDay, sum } from './format.js';
import { activeItems, routeOrder } from './plan.js';

/** Starter questions, grouped by the moment in a rep's day they help with. */
export const STARTERS = [
  { title: 'Plan the day', questions: ['Who should I see today?', 'What’s on my plan today?', 'Who is near Mount Sinai West?'] },
  { title: 'Before a visit', questions: ['Brief me on Dr. Maya Patel', 'Where does Dr. Alex Morgan refer patients?', 'Top doctors at Mount Sinai Hospital'] },
  { title: 'Your territory', questions: ['Which accounts are growing the most?', 'What has declined?', 'Where am I losing the most volume?', 'What follow-ups are overdue?'] },
];

/** The starter questions, with today's next visit filled in where it helps. */
export function startersFor(ctx) {
  const next = routeOrder(activeItems(ctx.ws.plans[ctx.todayIso])).find((i) => i.status === 'planned');
  const who = next ? getEntity(next.targetId) : null;
  if (!who) return STARTERS;
  const about = who.kind === 'hcp' ? `Where does ${who.name} refer patients?` : `Where do patients at ${who.name} go?`;
  return STARTERS.map((g) => (g.title === 'Before a visit' ? { ...g, questions: [`Brief me on ${who.name}`, about, g.questions[2]] } : g));
}

const QUESTION_START = /^(who|what|whats|which|where|when|why|how|show|list|brief|tell|give|any)\b/;

/** True when search text reads like a question, so Targets can offer to ask it. */
export function looksLikeQuestion(text) {
  const q = normalise(text);
  if (q.split(' ').length < 2) return false;
  return /\?\s*$/.test(String(text)) || QUESTION_START.test(q) || !['search', 'brief'].includes(detectIntent(q));
}

const normalise = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%\s-]/g, ' ').replace(/\s+/g, ' ').trim();

// Names reps actually say: last names, first names and short facility names.
const EXTRA_ALIASES = {
  'msh-system': ['mount sinai health system', 'health system', 'mount sinai'],
  msh: ['mount sinai hospital', 'the main hospital', 'msh'],
  msw: ['mount sinai west', 'sinai west', 'msw'],
  msm: ['mount sinai morningside', 'morningside', 'msm'],
  kidney: ['kidney center', 'kidney'],
  harlem: ['harlem health center', 'harlem clinic', 'harlem'],
};

let aliasIndex = null;
function aliases() {
  if (aliasIndex) return aliasIndex;
  const out = [];
  for (const h of allHcps()) {
    const parts = normalise(h.name.replace(/^Dr\.?\s*/, '')).split(' ');
    for (const a of new Set([parts.join(' '), parts.at(-1), parts[0], `dr ${parts.at(-1)}`])) out.push([a, h.id]);
  }
  for (const o of allOrgs()) {
    out.push([normalise(o.name), o.id]);
    for (const a of EXTRA_ALIASES[o.id] || []) out.push([a, o.id]);
  }
  aliasIndex = out.sort((a, b) => b[0].length - a[0].length);
  return aliasIndex;
}

/** The person or account a question is about, if it names one. */
export function findEntity(question) {
  const q = ` ${normalise(question)} `;
  for (const [alias, id] of aliases()) {
    if (q.includes(` ${alias} `)) return getEntity(id);
  }
  return null;
}

const INTENTS = [
  ['followups', /\b(follow ?-?ups?|overdue|owe|to ?-?dos?|tasks?)\b/],
  ['referrals', /\b(refer\w*|sends?|sent)\b/],
  ['mix', /\b(mix|which procedures|what procedures|procedure breakdown|breakdown)\b/],
  ['leakage', /\b(leak\w*|losing|lose|lost|leaving|left the system|out of (the )?system|where do (patients|cases)( [a-z ]+)? go)\b/],
  ['decline', /\b(declin\w*|drop\w*|down|fall\w*|fell|shrink\w*|decreas\w*|slow\w*|worse)\b/],
  ['growth', /\b(grow\w*|increas\w*|rising|rise|fastest|gain\w*|trending up|up the most)\b/],
  ['near', /\b(near|nearby|close to|closest|nearest|around)\b/],
  ['suggest', /\b(who should i|who to (see|visit|call)|suggest\w*|recommend\w*|priorit\w*|where should i go|who next)\b/],
  ['plan', /\b(today|tomorrow|my plan|schedule|agenda|next (visit|stop|meeting)|my day|on my plan|planned)\b/],
  ['people', /\b(top|best|biggest|busiest|key|which) (hcps?|doctors?|surgeons?|physicians?|cardiologists?|people)\b|\bwho (works|practices)\b|\b(doctors|hcps|surgeons|physicians) at\b/],
  ['brief', /\b(brief|tell me about|prep\w*|who is|what should i know|summar\w*|overview|about)\b/],
];

/** Which kind of question this is. */
export function detectIntent(question, about = null) {
  const q = normalise(question);
  for (const [intent, pattern] of INTENTS) if (pattern.test(q)) return intent;
  if (findEntity(question) || (about && refersBack(q))) return 'brief';
  return 'search';
}

// "Where does she refer?", "what about there?": the question continues the last answer.
const refersBack = (q) => /\b(she|he|they|her|his|their|them|it|its|there|this (account|doctor|hospital|one|person)|that (account|doctor|hospital|one|person)|same)\b/.test(q);
const PEOPLE_WORDS = /\b(hcps?|doctors?|surgeons?|physicians?|people|cardiologists?|who)\b/;

const listJoin = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);
const PHRASES = {
  followup: (s) => (s.label.startsWith('Overdue') ? 'an overdue follow-up' : 'a follow-up due'),
  leakage: () => 'leakage risk',
  rising: () => 'rising volume',
  unseen: (s) => (s.label === 'No contact yet' ? 'no contact yet' : 'no visit in 30+ days'),
};
/** Signals as a phrase, e.g. "leakage risk and no visit in 30+ days". */
const reasons = (signals) => listJoin(signals.map((s) => PHRASES[s.id]?.(s) ?? s.label.toLowerCase()));
const possessive = (name) => `${name}’s`;

const SAMPLE = 'Sample data';
const last4 = (series) => sum(series.slice(-4));
const prev4 = (series) => sum(series.slice(0, 4));
const totals = (e) => {
  const rows = proceduresOf(e);
  if (!rows?.length) return null;
  const s = addSeries(rows.map((r) => r.series));
  return { prev: prev4(s), cur: last4(s), growth: procedureYoy(e) };
};
const accounts = () => allOrgs().filter((o) => o.type !== 'Health system' && proceduresOf(o)?.length);

/**
 * Answers a question. `ctx` is the app context (workspace, today, signals,
 * suggestions, planItemFor, dayName). `about` is the entity the conversation
 * is already about, so "where does she refer?" works as a follow-up.
 */
export function answer(question, ctx, about = null) {
  const intent = detectIntent(question, about);
  const named = findEntity(question);
  const entity = named || (about && refersBack(normalise(question)) ? getEntity(about) : null);
  const build = BUILDERS[intent] || BUILDERS.search;
  const result = build({ question, q: normalise(question), entity, named, ctx });
  return { intent, about: result.about ?? entity?.id ?? null, ...result };
}

const row = (e, figure, sub, extra = {}) => ({ id: e.id, title: e.name, sub, figure, ...extra });

const BUILDERS = {
  growth({ q, entity, ctx }) {
    const people = PEOPLE_WORDS.test(q);
    if (entity && !(entity.kind === 'hco' && people)) return BUILDERS.trend({ entity });
    const pool = entity ? hcpsAt(entity.id) : people ? allHcps() : accounts();
    const ranked = pool.map((e) => ({ e, t: totals(e) })).filter((r) => r.t).sort((a, b) => b.t.growth - a.t.growth);
    if (!ranked.length) return empty('No procedure volumes to compare yet.');
    const top = ranked[0];
    const pick = ranked.slice(0, 3).find((r) => ctx.signals(r.e).some((s) => s.id === 'leakage' || s.id === 'unseen')) || top;
    const pickSignals = ctx.signals(pick.e).filter((s) => s.id !== 'rising');
    return {
      scope: ['Last 12 months vs the 12 before', entity?.kind === 'hco' ? `At ${entity.name}` : 'Your book', SAMPLE],
      summary: `${top.e.name} grew fastest: ${formatNumber(top.t.prev)} to ${formatNumber(top.t.cur)} procedures (${formatPct(top.t.growth)}).`,
      columns: ['Name', 'Change'],
      rows: ranked.slice(0, 5).map(({ e, t }) => row(e, formatPct(t.growth), `${e.kind === 'hcp' ? e.specialty : e.typeDetail} · ${formatNumber(t.cur)} procedures`, { tone: t.growth >= 0 ? 'up' : 'down', tab: 'volumes' })),
      doThis: {
        text: pickSignals.length ? `${pick.e.name} is growing, with ${reasons(pickSignals)}. Start there.` : `${pick.e.name} is growing fastest. Visit while volume is moving.`,
        label: `Open ${pick.e.name}`, action: 'openProfile', data: { id: pick.e.id, tab: 'volumes' }, add: pick.e.id,
      },
      next: ['What has declined?', 'Where am I losing the most volume?', people ? 'Which accounts are growing the most?' : 'Which doctors are growing the most?'],
      about: pick.e.id,
    };
  },

  decline({ q, entity }) {
    const people = PEOPLE_WORDS.test(q);
    if (entity?.kind === 'hcp') return BUILDERS.trend({ entity });
    const pool = entity?.kind === 'hco' ? hcpsAt(entity.id) : [...(people ? [] : accounts()), ...allHcps()];
    const ranked = pool.map((e) => ({ e, t: totals(e) })).filter((r) => r.t).sort((a, b) => a.t.growth - b.t.growth);
    const down = ranked.filter((r) => r.t.growth < 0);
    if (!down.length) {
      const slow = ranked[0];
      return {
        scope: ['Last 12 months vs the 12 before', SAMPLE],
        summary: `Nothing declined. Slowest growth is ${slow.e.name} at ${formatPct(slow.t.growth)}.`,
        columns: ['Name', 'Change'],
        rows: ranked.slice(0, 5).map(({ e, t }) => row(e, formatPct(t.growth), `${formatNumber(t.cur)} procedures`, { tone: 'up', tab: 'volumes' })),
        next: ['Which accounts are growing the most?', 'Where am I losing the most volume?'],
      };
    }
    const top = down[0];
    const family = proceduresOf(top.e).map((r) => ({ r, g: (last4(r.series) - prev4(r.series)) })).sort((a, b) => a.g - b.g)[0].r;
    return {
      scope: ['Last 12 months vs the 12 before', entity?.kind === 'hco' ? `At ${entity.name}` : 'People and accounts', SAMPLE],
      summary: `${plural(down.length, 'target')} declined. The biggest drop is ${top.e.name}: ${formatNumber(top.t.prev)} to ${formatNumber(top.t.cur)} procedures (${formatPct(top.t.growth)}).`,
      columns: ['Name', 'Change'],
      rows: down.slice(0, 5).map(({ e, t }) => row(e, formatPct(t.growth), `${e.kind === 'hcp' ? e.specialty : e.typeDetail} · ${formatNumber(t.cur)} procedures`, { tone: 'down', tab: 'volumes' })),
      doThis: {
        text: `Most of ${possessive(top.e.name)} drop is in ${family.family.toLowerCase()}. Ask where those cases are going now.`,
        label: `Open ${top.e.name}`, action: 'openProfile', data: { id: top.e.id, tab: 'volumes' }, add: top.e.id,
      },
      next: [top.e.kind === 'hcp' ? `Where does ${top.e.name} refer patients?` : `Where do patients at ${top.e.name} go?`, 'Which accounts are growing the most?', 'Where am I losing the most volume?'],
      about: top.e.id,
    };
  },

  leakage({ entity }) {
    if (entity?.kind === 'hco') {
      const l = entity.leakage;
      if (!l) return empty(`${entity.name} doesn’t report leakage. ${entity.leakageUnavailable || ''}`.trim(), entity.id);
      const top = l.destinations[0];
      const destName = (d) => (d.orgId ? getOrg(d.orgId).name : destination(d.ref).name);
      return {
        scope: ['Patients who left', 'Last 12 months', SAMPLE],
        summary: `${l.leftPct}% of ${formatNumber(l.patients)} patients at ${entity.name} left the system. The biggest destination is ${destName(top)}, with ${formatNumber(top.patients)}.`,
        columns: ['Destination', 'Patients'],
        rows: l.destinations.map((d) => (d.orgId
          ? row(getOrg(d.orgId), formatNumber(d.patients), 'In system', { tab: 'leakage' })
          : { title: destination(d.ref).name, sub: `${destination(d.ref).note} · out of system`, figure: formatNumber(d.patients), tone: 'warn' })),
        doThis: { text: `${l.byFamily[0].family} is the biggest gap: ${l.byFamily[0].leftPct}% of those patients leave.`, label: 'Open leakage', action: 'openProfile', data: { id: entity.id, tab: 'leakage' }, add: entity.id },
        next: [`Top doctors at ${entity.name}`, 'Which accounts are growing the most?', 'Who should I see today?'],
      };
    }
    if (entity?.kind === 'hcp') return BUILDERS.referrals({ entity });
    const ranked = allOrgs().filter((o) => o.leakage && o.type !== 'Health system').sort((a, b) => b.leakage.leftPct - a.leakage.leftPct);
    const top = ranked[0];
    const lost = sum(ranked.map((o) => Math.round(o.leakage.patients * (o.leakage.leftPct / 100))));
    const referrer = hcpsAt(top.id).map((h) => ({ h, out: sum(h.referrals.outbound.filter((r) => r.ref).map((r) => r.count)) })).sort((a, b) => b.out - a.out)[0];
    return {
      scope: ['Patients who left the system', 'Last 12 months', SAMPLE],
      summary: `${top.name} loses the most: ${top.leakage.leftPct}% of ${formatNumber(top.leakage.patients)} patients left. Across your accounts, about ${formatNumber(lost)} patients left the system.`,
      columns: ['Account', 'Left'],
      rows: ranked.map((o) => row(o, `${o.leakage.leftPct}%`, `${formatNumber(o.leakage.patients)} patients · biggest gap ${o.leakage.byFamily[0].family}`, { tone: o.leakage.leftPct >= 20 ? 'warn' : '', tab: 'leakage' })),
      doThis: referrer?.out
        ? { text: `${referrer.h.name} sends ${referrer.out} patients a year out of the system from ${top.name}. Start there.`, label: `Open ${referrer.h.name}`, action: 'openProfile', data: { id: referrer.h.id, tab: 'referrals' }, add: referrer.h.id }
        : { text: `${top.leakage.byFamily[0].family} is the biggest gap at ${top.name}.`, label: `Open ${top.name}`, action: 'openProfile', data: { id: top.id, tab: 'leakage' }, add: top.id },
      next: [`Where do patients at ${top.name} go?`, 'Which accounts are growing the most?', 'Who should I see today?'],
      about: top.id,
    };
  },

  referrals({ entity }) {
    if (entity?.kind !== 'hcp') {
      const ranked = allHcps().map((h) => ({ h, out: sum(h.referrals.outbound.filter((r) => r.ref).map((r) => r.count)) })).filter((r) => r.out).sort((a, b) => b.out - a.out);
      return {
        scope: ['Referrals out of the system', 'Last 12 months', SAMPLE],
        summary: `${ranked[0].h.name} sends the most patients out of the system: ${ranked[0].out} in the last 12 months.`,
        columns: ['Doctor', 'Sent out'],
        rows: ranked.slice(0, 5).map(({ h, out }) => row(h, String(out), `${h.specialty} · ${primaryOrg(h).name}`, { tone: 'warn', tab: 'referrals' })),
        doThis: { text: `A visit to ${ranked[0].h.name} could keep the most patients in the system.`, label: `Open ${ranked[0].h.name}`, action: 'openProfile', data: { id: ranked[0].h.id, tab: 'referrals' }, add: ranked[0].h.id },
        next: [`Brief me on ${ranked[0].h.name}`, 'Where am I losing the most volume?'],
        about: ranked[0].h.id,
      };
    }
    const out = entity.referrals.outbound;
    if (!out.length) return empty(`${entity.name} doesn’t refer patients on in the sample data.`, entity.id);
    const total = sum(out.map((r) => r.count));
    const leaving = out.filter((r) => r.ref);
    const leftCount = sum(leaving.map((r) => r.count));
    const topOut = leaving.sort((a, b) => b.count - a.count)[0];
    return {
      scope: ['Referrals out', 'Last 12 months', SAMPLE],
      summary: leftCount
        ? `${entity.name} referred ${total} patients on. ${leftCount} (${Math.round((leftCount / total) * 100)}%) went outside the system, ${leaving.length === 1 ? 'all' : `${topOut.count}`} to ${destination(topOut.ref).name}.`
        : `${entity.name} referred ${total} patients on, all within the system.`,
      columns: ['Referred to', 'Patients'],
      rows: [...out].sort((a, b) => b.count - a.count).map((r) => (r.hcpId
        ? row(getEntity(r.hcpId), String(r.count), `In system · ${r.reason}`, { tab: 'overview' })
        : { title: destination(r.ref).name, sub: `Out of system · ${r.reason}`, figure: String(r.count), tone: 'warn' })),
      doThis: topOut ? { text: `Ask why ${topOut.reason} patients go to ${destination(topOut.ref).name} instead of staying in the system.`, label: 'Open referrals', action: 'openProfile', data: { id: entity.id, tab: 'referrals' }, add: entity.id } : null,
      next: [`Brief me on ${entity.name}`, `Procedure mix for ${entity.name}`, 'Who should I see today?'],
    };
  },

  /** How one person or account is trending, family by family. */
  trend({ entity }) {
    const t = totals(entity);
    if (!t) return empty(`Procedure volumes aren’t available for ${entity.name}. ${entity.proceduresUnavailable || ''}`.trim(), entity.id);
    const families = proceduresOf(entity).map((r) => ({ r, prev: prev4(r.series), cur: last4(r.series) }))
      .map((f) => ({ ...f, pct: f.prev ? ((f.cur - f.prev) / f.prev) * 100 : 0 }))
      .sort((a, b) => Math.abs(b.cur - b.prev) - Math.abs(a.cur - a.prev));
    const mover = families[0];
    const direction = t.growth >= 1 ? 'up' : t.growth <= -1 ? 'down' : 'flat';
    return {
      scope: ['Last 12 months vs the 12 before', SAMPLE],
      summary: `${entity.name} is ${direction === 'flat' ? 'flat' : direction} on last year: ${formatNumber(t.prev)} to ${formatNumber(t.cur)} procedures (${formatPct(t.growth)}). The biggest change is ${mover.r.family} (${formatPct(mover.pct)}).`,
      columns: ['Procedure', 'Change'],
      rows: families.map((f) => ({ title: f.r.family, sub: `${f.r.code} · ${formatNumber(f.cur)} in the last 12 months`, figure: formatPct(f.pct), tone: f.pct >= 0 ? 'up' : 'down' })),
      doThis: { text: 'See the quarter-by-quarter trend before the visit.', label: 'Open volumes', action: 'openProfile', data: { id: entity.id, tab: 'volumes' }, add: entity.id },
      next: entity.kind === 'hcp'
        ? [`Where does ${entity.name} refer patients?`, `Brief me on ${entity.name}`, 'What has declined?']
        : [`Where do patients at ${entity.name} go?`, `Top doctors at ${entity.name}`, 'What has declined?'],
      about: entity.id,
    };
  },

  mix({ entity }) {
    const e = entity || getOrg('msh-system');
    const rows = proceduresOf(e);
    if (!rows) return empty(`Procedure volumes aren’t available for ${e.name}. ${e.proceduresUnavailable || ''}`.trim(), e.id);
    const total = sum(rows.map((r) => last4(r.series)));
    const sorted = [...rows].sort((a, b) => last4(b.series) - last4(a.series));
    return {
      scope: ['Procedures', 'Last 12 months', SAMPLE],
      summary: `${sorted[0].family} is ${Math.round((last4(sorted[0].series) / total) * 100)}% of ${possessive(e.name)} ${formatNumber(total)} procedures in the last 12 months.`,
      columns: ['Procedure', 'Count'],
      rows: sorted.map((r) => ({ title: r.family, sub: `${r.code} · ${formatPct(((last4(r.series) - prev4(r.series)) / (prev4(r.series) || 1)) * 100)} on last year`, figure: formatNumber(last4(r.series)) })),
      doThis: { text: 'Open the volumes tab for the quarter-by-quarter trend.', label: 'Open volumes', action: 'openProfile', data: { id: e.id, tab: 'volumes' }, add: e.id },
      next: [e.kind === 'hco' ? `Top doctors at ${e.name}` : `Brief me on ${e.name}`, 'Which accounts are growing the most?'],
      about: e.id,
    };
  },

  people({ entity }) {
    const org = entity?.kind === 'hco' ? entity : entity ? primaryOrg(entity) : getOrg('msh-system');
    const list = hcpsAt(org.id);
    if (!list.length) return empty(`Nobody in your book practices at ${org.name}.`, org.id);
    const top = list[0];
    return {
      scope: [`At ${org.name}`, 'Procedures, last 12 months', SAMPLE],
      summary: procedureTotal(top) ? `${top.name} leads at ${org.name} with ${formatNumber(procedureTotal(top))} procedures in the last 12 months.` : `${list.length} people in your book work at ${org.name}.`,
      columns: ['Doctor', 'Procedures'],
      rows: list.slice(0, 6).map((h) => row(h, procedureTotal(h) ? formatNumber(procedureTotal(h)) : 'Referrer', h.specialty)),
      doThis: { text: `See every HCP and the executives at ${org.name}.`, label: 'Open people', action: 'openProfile', data: { id: org.id, tab: 'people' }, add: top.id },
      next: [`Brief me on ${top.name}`, `Where do patients at ${org.name} go?`],
      about: org.id,
    };
  },

  followups({ ctx }) {
    const open = ctx.ws.followUps.filter((f) => !f.done).sort((a, b) => a.due.localeCompare(b.due));
    if (!open.length) return { scope: ['Your follow-ups'], summary: 'You have no open follow-ups.', rows: [], next: ['Who should I see today?'] };
    const overdue = open.filter((f) => daysBetween(ctx.today, fromIso(f.due)) < 0);
    const first = open[0];
    return {
      scope: ['Your follow-ups', 'On this device'],
      summary: `You have ${plural(open.length, 'open follow-up')}${overdue.length ? `, ${overdue.length} overdue` : ''}. Most urgent: “${first.text}” for ${getEntity(first.targetId).name}.`,
      columns: ['Follow-up', 'Due'],
      rows: open.map((f) => ({ id: f.targetId, title: f.text, sub: getEntity(f.targetId).name, figure: `Due ${relativeDay(f.due, ctx.today).toLowerCase()}`, tone: daysBetween(ctx.today, fromIso(f.due)) < 0 ? 'warn' : '', tab: 'activity' })),
      doThis: { text: 'Tick them off in Activity as you go.', label: 'Open Activity', action: 'tab', data: { tab: 'activity' } },
      next: ['Who should I see today?', 'What’s on my plan today?'],
      about: first.targetId,
    };
  },

  plan({ q, ctx }) {
    const day = /\btomorrow\b/.test(q) ? ctx.planDays()[1].iso : ctx.todayIso;
    const items = routeOrder(activeItems(ctx.ws.plans[day]));
    const name = ctx.dayName(day).toLowerCase();
    if (!items.length) {
      return {
        scope: [ctx.dayName(day)],
        summary: `Nothing is planned for ${name} yet.`,
        rows: [],
        doThis: { text: 'Pick a few people or accounts, then review them as one plan.', label: 'Plan the day', action: 'planYourDay', data: { day } },
        next: ['Who should I see today?', 'Who is near Mount Sinai West?'],
      };
    }
    const first = items.find((i) => i.status === 'planned') || items[0];
    return {
      scope: [ctx.dayName(day), plural(items.length, 'stop')],
      summary: `${plural(items.length, 'stop')} ${name}. ${first.status === 'planned' ? 'Next' : 'First'}: ${getEntity(first.targetId).name}${first.mode === 'timed' ? ` at ${first.time}` : ''}.`,
      columns: ['Stop', 'Time'],
      rows: items.map((i) => {
        const t = getEntity(i.targetId);
        return row(t, i.status === 'done' ? 'Done' : i.mode === 'timed' ? i.time : 'Any time', `${i.type} · ${siteFor(t, i.siteId).name}`, { tab: 'overview' });
      }),
      doThis: { text: 'Change times or add stops in one place.', label: 'Review plan', action: 'reviewPlan', data: { day } },
      next: [`Brief me on ${getEntity(first.targetId).name}`, 'Who should I see today?', 'What follow-ups are overdue?'],
      about: first.targetId,
    };
  },

  suggest({ ctx }) {
    const picks = ctx.suggestions(ctx.todayIso, 5);
    if (!picks.length) return empty('Everyone suggested is already planned for today.');
    const top = picks[0];
    return {
      scope: ['Today', 'Follow-ups, leakage, volume and last contact'],
      summary: `Start with ${top.entity.name}: ${reasons(top.signals) || 'the highest volume in your book'}.`,
      columns: ['Target', 'Why'],
      rows: picks.map(({ entity: e, signals }) => row(e, '', signals.slice(0, 2).map((s) => s.label).join(' · ') || (e.kind === 'hcp' ? e.specialty : e.typeDetail))),
      doThis: { text: `Add ${top.entity.name} and anyone else you pick, then review them as one plan.`, label: `Open ${top.entity.name}`, action: 'openProfile', data: { id: top.entity.id }, add: top.entity.id },
      next: [`Brief me on ${top.entity.name}`, `Who is near ${siteFor(top.entity).name}?`, 'What’s on my plan today?'],
      about: top.entity.id,
      selectable: true,
    };
  },

  near({ entity, ctx }) {
    const place = entity ? siteFor(entity) : null;
    const origin = place ? place.coords : REP.start.coords;
    const label = place ? place.name : `${REP.start.label} (your sample start point)`;
    const near = [...allHcps(), ...allOrgs()]
      .filter((e) => e.type !== 'Health system' && e.id !== place?.id && e.id !== entity?.id)
      .map((e) => ({ e, km: haversineKm(origin, siteFor(e).coords) }))
      .filter((r) => !ctx.planItemFor(r.e.id, ctx.todayIso))
      .sort((a, b) => a.km - b.km);
    const within = near.filter((r) => r.km <= 2);
    const top = near[0];
    if (!top) return empty(`Everyone near ${label} is already in today’s plan.`, entity?.id);
    return {
      scope: [`Near ${place ? place.name : REP.start.label}`, 'Straight-line distance', 'Not yet planned today'],
      summary: within.length
        ? `${plural(within.length, 'unplanned target')} within 2 km of ${label}. Closest: ${top.e.name}, ${formatKm(top.km)}.`
        : `Nothing unplanned within 2 km of ${label}. The closest is ${top.e.name} at ${siteFor(top.e).name}, ${formatKm(top.km)} away.`,
      columns: ['Target', 'Distance'],
      rows: near.slice(0, 6).map(({ e, km }) => row(e, formatKm(km), e.kind === 'hcp' ? `${e.specialty} · ${siteFor(e).name}` : e.typeDetail)),
      doThis: { text: `Fit ${top.e.name} in while you’re nearby.`, label: `Open ${top.e.name}`, action: 'openProfile', data: { id: top.e.id }, add: top.e.id },
      next: ['Who should I see today?', 'What’s on my plan today?'],
      about: top.e.id,
      selectable: true,
    };
  },

  brief({ entity, ctx }) {
    if (!entity) return BUILDERS.search({ question: '', q: '', ctx });
    const last = ctx.lastInteraction(entity.id);
    const open = ctx.ws.followUps.filter((f) => !f.done && f.targetId === entity.id);
    const t = totals(entity);
    const planned = ctx.planItemFor(entity.id, ctx.todayIso);
    const facts = [
      { title: 'Last contact', figure: last ? relativeDay(last.date, ctx.today) : 'Never', sub: last ? `${last.type} · ${last.outcome}${last.note ? ` · “${last.note.slice(0, 70)}${last.note.length > 70 ? '…' : ''}”` : ''}` : 'No interactions logged yet' },
      { title: 'Open follow-ups', figure: String(open.length), sub: open[0] ? open[0].text : 'None', tone: open.length ? 'warn' : '' },
      t ? { title: 'Procedures · 12 months', figure: formatNumber(t.cur), sub: `${formatPct(t.growth)} on last year`, tone: t.growth >= 0 ? 'up' : 'down' } : { title: 'Procedures', figure: '—', sub: 'Not in your code group' },
      entity.kind === 'hcp'
        ? { title: 'Referrals out of system', figure: String(sum(entity.referrals.outbound.filter((r) => r.ref).map((r) => r.count))), sub: 'Patients, last 12 months', tone: entity.leakageRisk ? 'warn' : '' }
        : { title: 'Patients leaving', figure: entity.leakage ? `${entity.leakage.leftPct}%` : '—', sub: entity.leakage ? `of ${formatNumber(entity.leakage.patients)} patients` : 'Not reported', tone: entity.leakage?.leftPct >= 20 ? 'warn' : '' },
    ];
    if (planned) facts.unshift({ title: 'In today’s plan', figure: planned.mode === 'timed' ? planned.time : 'Any time', sub: planned.goal || planned.type });
    const insight = entity.kind === 'hcp' ? entity.insight : entity.leakage?.insight || entity.leakageUnavailable;
    return {
      scope: [entity.kind === 'hcp' ? entity.specialty : entity.typeDetail, SAMPLE],
      summary: insight,
      columns: ['', ''],
      rows: facts,
      doThis: { text: 'Open the full profile to prepare.', label: entity.kind === 'hcp' ? 'Open profile' : 'Open account', action: 'openProfile', data: { id: entity.id }, add: entity.id },
      next: entity.kind === 'hcp'
        ? [`Where does ${entity.name} refer patients?`, `Procedure mix for ${entity.name}`, `Who is near ${siteFor(entity).name}?`]
        : [`Where do patients at ${entity.name} go?`, `Top doctors at ${entity.name}`],
      about: entity.id,
      title: entity.name,
    };
  },

  search({ question, q, ctx }) {
    const words = q.replace(/\b(show|find|me|the|a|an|for|of|in|at|who|what|is|are|my|please)\b/g, ' ').trim();
    const rows = words ? [...ctx.search({ ...ctx.ws.targets, query: words, kind: 'hcp', signals: [], specialty: '', orgType: '', distance: 'any', planned: 'any' }), ...ctx.search({ ...ctx.ws.targets, query: words, kind: 'hco', signals: [], specialty: '', orgType: '', distance: 'any', planned: 'any' })] : [];
    if (rows.length) {
      return {
        scope: ['Search', 'Your book'],
        summary: `I couldn’t answer that as a question, but ${plural(rows.length, 'target matches', 'targets match')} “${question.trim()}”.`,
        columns: ['Target', ''],
        rows: rows.slice(0, 6).map((r) => row(r.entity, '', r.entity.kind === 'hcp' ? `${r.entity.specialty} · ${siteFor(r.entity).name}` : r.entity.typeDetail)),
        next: STARTERS[2].questions.slice(0, 3),
        selectable: true,
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

function empty(summary, about = null) {
  return { scope: [SAMPLE], summary, rows: [], next: ['Which accounts are growing the most?', 'Who should I see today?'], about };
}

/** A short version for reading aloud. */
export function spoken(result) {
  return [result.summary, result.doThis?.text].filter(Boolean).join(' ');
}
