// Lookups and derived facts over the sample HCPs and HCOs.

import { daysBetween, fromIso, haversineKm, sum, yoy } from '../format';
import type { DiagnosisRow, Entity, FollowUp, Hcp, Interaction, Org, ProcedureRow, Signal, SignalId, Workspace } from '../types';
import { HCPS } from './hcps';
import { DESTINATIONS, ORGS } from './orgs';
import { REP } from './seed';
import { addSeries } from './series';

const hcpById = new Map<string, Hcp>(HCPS.map((h) => [h.id, { ...h, kind: 'hcp' }]));
const orgById = new Map<string, Org>(ORGS.map((o) => [o.id, { ...o, kind: 'hco' }]));

export const getHcp = (id: string): Hcp | null => hcpById.get(id) ?? null;
export const getOrg = (id: string): Org | null => orgById.get(id) ?? null;
export const getEntity = (id: string): Entity | null => hcpById.get(id) ?? orgById.get(id) ?? null;
export const allHcps = (): Hcp[] => [...hcpById.values()];
export const allOrgs = (): Org[] => [...orgById.values()];
export const allEntities = (): Entity[] => [...allHcps(), ...allOrgs()];
export const destination = (ref: string) => DESTINATIONS[ref];

/** Looks up an organization the sample data guarantees exists. */
const org = (id: string): Org => {
  const found = orgById.get(id);
  if (!found) throw new Error(`Unknown organization: ${id}`);
  return found;
};

export const primaryAffiliation = (hcp: Hcp) => hcp.affiliations.reduce((a, b) => (b.share > a.share ? b : a));
export const primaryOrg = (hcp: Hcp): Org => org(primaryAffiliation(hcp).orgId);

export const childrenOf = (orgId: string): Org[] => allOrgs().filter((o) => o.parentId === orgId);
export const parentOf = (o: Org): Org | null => (o.parentId ? getOrg(o.parentId) : null);

export function descendantsOf(orgId: string): Org[] {
  const out: Org[] = [];
  for (const child of childrenOf(orgId)) out.push(child, ...descendantsOf(child.id));
  return out;
}

/** The top-level system an organization belongs to (itself when it has no parent). */
export function systemOf(o: Org): Org {
  let current = o;
  while (current.parentId) current = org(current.parentId);
  return current;
}

/** HCPs affiliated with an org (or any facility below it), busiest first. */
export function hcpsAt(orgId: string): Hcp[] {
  const ids = new Set([orgId, ...descendantsOf(orgId).map((o) => o.id)]);
  return allHcps()
    .filter((h) => h.affiliations.some((a) => ids.has(a.orgId)))
    .sort((a, b) => procedureTotal(b) - procedureTotal(a));
}

function rollup<T extends { series: number[] }>(lists: (T[] | 'rollup' | null)[], key: keyof T): T[] {
  const groups = new Map<unknown, T>();
  for (const row of lists.filter((l): l is T[] => Array.isArray(l)).flat()) {
    const existing = groups.get(row[key]);
    groups.set(row[key], existing ? { ...existing, series: addSeries([existing.series, row.series]) } : { ...row });
  }
  return [...groups.values()].sort((a, b) => sum(b.series.slice(-4)) - sum(a.series.slice(-4)));
}

/** Procedure families for an entity; health systems roll up their facilities. */
export function proceduresOf(entity: Entity): ProcedureRow[] | null {
  if (entity.procedures !== 'rollup') return entity.procedures;
  return rollup(descendantsOf(entity.id).map((o) => o.procedures), 'family');
}

export function diagnosesOf(entity: Entity): DiagnosisRow[] {
  if (entity.diagnoses !== 'rollup') return entity.diagnoses;
  return rollup(descendantsOf(entity.id).map((o) => o.diagnoses), 'name');
}

/** Procedures over the last four quarters. */
export function procedureTotal(entity: Entity): number {
  const rows = proceduresOf(entity);
  return rows ? sum(rows.map((r) => sum(r.series.slice(-4)))) : 0;
}

export function procedureYoy(entity: Entity): number | null {
  const rows = proceduresOf(entity);
  return rows?.length ? yoy(addSeries(rows.map((r) => r.series))) : null;
}

/** Where a visit to this entity physically happens. */
export function siteFor(entity: Entity, siteId?: string): Org {
  if (entity.kind === 'hco') return entity;
  const chosen = siteId && entity.affiliations.some((a) => a.orgId === siteId) ? siteId : primaryAffiliation(entity).orgId;
  return org(chosen);
}

export const distanceFromStart = (entity: Entity, siteId?: string): number => haversineKm(REP.start.coords, siteFor(entity, siteId).coords);

/** "Dr. Lee" for Dr. Jordan Lee; accounts keep their full name. */
export const shortName = (entity: Pick<Entity, 'kind' | 'name'>): string =>
  entity.kind === 'hcp' ? entity.name.replace(/^Dr\. \S+ /, 'Dr. ') : entity.name;

export const subtitle = (entity: Entity): string =>
  entity.kind === 'hcp' ? `${entity.specialty} · ${primaryOrg(entity).name}` : `${entity.typeDetail} · ${entity.city.replace(/ \d{5}$/, '')}`;

// ---- Signals that depend on the rep's own activity ------------------------

type Activity = Pick<Workspace, 'interactions' | 'followUps'>;

export function lastInteraction(id: string, workspace: Activity): Interaction | null {
  return workspace.interactions
    .filter((i) => !i.deleted && (i.targetId === id || i.attendees.includes(id)))
    .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}

export function openFollowUps(id: string, workspace: Activity): FollowUp[] {
  return workspace.followUps.filter((f) => !f.done && f.targetId === id);
}

/** Why a target is worth attention, strongest first. */
export function signalsFor(entity: Entity, workspace: Activity, today: Date): Signal[] {
  const out: Signal[] = [];
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

const WEIGHTS: Record<SignalId, number> = { followup: 40, leakage: 30, rising: 20, unseen: 12 };

/** Relevance used for default sorting and "Who to see". */
export function priorityOf(entity: Entity, workspace: Activity, today: Date): number {
  const signals = signalsFor(entity, workspace, today);
  const assigned = entity.kind === 'hco' ? entity.assigned : true;
  return sum(signals.map((s) => WEIGHTS[s.id])) + (assigned ? 5 : 0) + Math.min(10, procedureTotal(entity) / 100);
}
