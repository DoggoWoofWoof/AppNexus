// Lookups and derived facts over the sample HCPs and HCOs.

import { HCPS } from './hcps.js';
import { ORGS, DESTINATIONS } from './orgs.js';
import { REP } from './seed.js';
import { addSeries } from './series.js';
import { daysBetween, fromIso, haversineKm, sum, yoy } from '../format.js';

const hcpById = new Map(HCPS.map((h) => [h.id, { ...h, kind: 'hcp' }]));
const orgById = new Map(ORGS.map((o) => [o.id, { ...o, kind: 'hco' }]));

export const getHcp = (id) => hcpById.get(id) || null;
export const getOrg = (id) => orgById.get(id) || null;
export const getEntity = (id) => hcpById.get(id) || orgById.get(id) || null;
export const allHcps = () => [...hcpById.values()];
export const allOrgs = () => [...orgById.values()];
export const destination = (ref) => DESTINATIONS[ref];

export const primaryAffiliation = (hcp) => hcp.affiliations.reduce((a, b) => (b.share > a.share ? b : a));
export const primaryOrg = (hcp) => getOrg(primaryAffiliation(hcp).orgId);

export const childrenOf = (orgId) => allOrgs().filter((o) => o.parentId === orgId);
export const parentOf = (org) => (org.parentId ? getOrg(org.parentId) : null);

export function descendantsOf(orgId) {
  const out = [];
  for (const child of childrenOf(orgId)) out.push(child, ...descendantsOf(child.id));
  return out;
}

/** The top-level system an organization belongs to (itself when it has no parent). */
export function systemOf(org) {
  let current = org;
  while (current.parentId) current = getOrg(current.parentId);
  return current;
}

/** HCPs affiliated with an org (or any facility below it), busiest first. */
export function hcpsAt(orgId) {
  const ids = new Set([orgId, ...descendantsOf(orgId).map((o) => o.id)]);
  return allHcps()
    .filter((h) => h.affiliations.some((a) => ids.has(a.orgId)))
    .sort((a, b) => procedureTotal(b) - procedureTotal(a));
}

/** Procedure families for an entity; health systems roll up their facilities. */
export function proceduresOf(entity) {
  if (entity.procedures !== 'rollup') return entity.procedures;
  return rollup(descendantsOf(entity.id).map((o) => o.procedures), 'family');
}

export function diagnosesOf(entity) {
  if (entity.diagnoses !== 'rollup') return entity.diagnoses;
  return rollup(descendantsOf(entity.id).map((o) => o.diagnoses), 'name');
}

function rollup(lists, key) {
  const groups = new Map();
  for (const row of lists.filter(Array.isArray).flat()) {
    const existing = groups.get(row[key]);
    groups.set(row[key], existing ? { ...existing, series: addSeries([existing.series, row.series]) } : { ...row });
  }
  return [...groups.values()].sort((a, b) => sum(b.series.slice(-4)) - sum(a.series.slice(-4)));
}

/** Procedures over the last four quarters. */
export function procedureTotal(entity) {
  const rows = proceduresOf(entity);
  return rows ? sum(rows.map((r) => sum(r.series.slice(-4)))) : 0;
}

export function procedureYoy(entity) {
  const rows = proceduresOf(entity);
  return rows?.length ? yoy(addSeries(rows.map((r) => r.series))) : null;
}

/** Where a visit to this entity physically happens. */
export function siteFor(entity, siteId) {
  if (entity.kind === 'hco') return entity;
  const chosen = siteId && entity.affiliations.some((a) => a.orgId === siteId) ? siteId : primaryAffiliation(entity).orgId;
  return getOrg(chosen);
}

export const distanceFromStart = (entity, siteId) => haversineKm(REP.start.coords, siteFor(entity, siteId).coords);

export const subtitle = (entity) =>
  entity.kind === 'hcp' ? `${entity.specialty} · ${primaryOrg(entity).name}` : `${entity.typeDetail} · ${entity.city.replace(/ \d{5}$/, '')}`;

// ---- Signals that depend on the rep's own activity ------------------------

export function lastInteraction(id, workspace) {
  return workspace.interactions
    .filter((i) => !i.deleted && (i.targetId === id || i.attendees?.includes(id)))
    .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
}

export function openFollowUps(id, workspace) {
  return workspace.followUps.filter((f) => !f.done && f.targetId === id);
}

/**
 * Why a target is worth attention, strongest first. Each signal has an id
 * (used by filters), a short label and a tone for colour.
 */
export function signalsFor(entity, workspace, today) {
  const out = [];
  const due = openFollowUps(entity.id, workspace).filter((f) => daysBetween(today, fromIso(f.due)) <= 0);
  if (due.length) {
    const overdue = due.some((f) => daysBetween(today, fromIso(f.due)) < 0);
    out.push({ id: 'followup', label: overdue ? 'Overdue follow-up' : 'Follow-up due', tone: 'warn' });
  }
  const leaking = entity.kind === 'hcp' ? entity.leakageRisk : (entity.leakage?.leftPct ?? 0) >= 20;
  if (leaking) out.push({ id: 'leakage', label: 'Leakage risk', tone: 'orange' });
  const growth = procedureYoy(entity);
  if (growth != null && growth >= 10) out.push({ id: 'rising', label: 'Rising volume', tone: 'accent' });
  const last = lastInteraction(entity.id, workspace);
  const since = last ? daysBetween(fromIso(last.date), today) : Infinity;
  if (since > 30) out.push({ id: 'unseen', label: last ? 'Not seen in 30+ days' : 'No contact yet', tone: 'neutral' });
  return out;
}

/** Minutes of driving that cost a point: the unit the score's weights are in. */
const MINUTES_A_POINT = 5;

/**
 * How worth seeing someone is: the one score Relevance and "Suggested for today"
 * rank by, the same as the app's. In points, where a point is 5 minutes of driving:
 * - 40 for a follow-up due or late, as something was promised;
 * - 30 when patients go elsewhere, as that's business leaving;
 * - for their procedures a year, 6 each time they double from 25, up to 30 at 775,
 *   so the busiest count for more without a big hospital drowning out every doctor;
 *   half as much again when they use a competitor's products, as those are cases to win;
 * - a point for every 5 procedures more than the year before, up to 20, so growth
 *   counts by how much: from 8 a year to 10 is 25% more, but nothing to drive for;
 * - up to 25 for the time since the rep was last in touch, all of it after a month,
 *   so someone seen yesterday can wait;
 * - 5 for every doctor and for the accounts assigned to the rep;
 * - less a point for every 5 minutes of `driving` to them, as nobody can be in two
 *   places at once.
 */
export function priorityOf(entity, workspace, today, driving = 0) {
  const signals = signalsFor(entity, workspace, today);
  const has = (id) => signals.some((s) => s.id === id);
  const year = procedureTotal(entity);
  const before = sum((proceduresOf(entity) || []).map((r) => sum(r.series.slice(-8, -4))));
  const size = Math.min(30, 6 * Math.log2(1 + year / 25)) * (entity.competitors?.length ? 1.5 : 1);
  const growth = Math.min(20, Math.max(0, year - before) / 5);
  const last = lastInteraction(entity.id, workspace);
  const since = last ? daysBetween(fromIso(last.date), today) : Infinity;
  const assigned = entity.kind === 'hco' ? entity.assigned : true;
  return (has('followup') ? 40 : 0) + (has('leakage') ? 30 : 0) + size + growth + Math.min(25, (since * 25) / 30) + (assigned ? 5 : 0) - driving / MINUTES_A_POINT;
}
