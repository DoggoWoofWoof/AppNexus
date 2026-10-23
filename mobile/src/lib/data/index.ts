// Lookups and derived facts over the sample HCPs and HCOs: the team's accounts
// and doctors, the rest of the territory around them, and the territories next
// door (data/territory.ts).

import { daysBetween, fromIso, sum, yoy } from '../format';
import type { DiagnosisRow, Entity, FollowUp, Hcp, Interaction, Leakage, Org, ProcedureRow, Signal, SignalId, Workspace } from '../types';
import { HCPS } from './hcps';
import { DESTINATIONS, ORGS } from './orgs';
import { addSeries, isTest } from './series';
import { NEXT_DOOR_HCPS, NEXT_DOOR_ORGS, TERRITORY_HCPS, TERRITORY_ORGS } from './territory';

// The team's own come first, so where two share a name Ask means one of them.
const hcpById = new Map<string, Hcp>([...HCPS, ...TERRITORY_HCPS, ...NEXT_DOOR_HCPS].map((h) => [h.id, { ...h, kind: 'hcp' }]));
const orgById = new Map<string, Org>([...ORGS, ...TERRITORY_ORGS, ...NEXT_DOOR_ORGS].map((o) => [o.id, { ...o, kind: 'hco' }]));

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

/** The states in the sample, for Targets' territory chip: the rep's own, then the two next door. */
export const STATES: { id: string; label: string }[] = [
  { id: 'NY', label: 'New York' },
  { id: 'NJ', label: 'New Jersey' },
  { id: 'CT', label: 'Connecticut' },
  { id: 'PA', label: 'Pennsylvania' },
];

/** The rep's own territory, which Targets shows until another state is chosen. */
export const YOUR_STATES = ['NY', 'NJ'];

/** The state an account is in, or a doctor's main place: "NY" from "New York, NY 10019". */
export function stateOf(entity: Entity): string {
  const where = entity.kind === 'hco' ? entity : primaryOrg(entity);
  return /, ([A-Z]{2}) \d{5}$/.exec(where.city)?.[1] ?? '';
}

/** Whether someone is in the rep's own territory rather than next door. */
export const inYourTerritory = (entity: Entity): boolean => YOUR_STATES.includes(stateOf(entity));

let team: string[] | null = null;

/**
 * The team's list, which My targets starts as: the accounts assigned to the
 * team, the facilities below them, and everyone who works at any of them.
 */
export function teamTargets(): string[] {
  if (team) return team;
  const orgs = new Set(allOrgs().filter((o) => o.assigned).flatMap((o) => [o.id, ...descendantsOf(o.id).map((d) => d.id)]));
  team = [...orgs, ...allHcps().filter((h) => h.affiliations.some((a) => orgs.has(a.orgId))).map((h) => h.id)];
  return team;
}

/**
 * Whether a doctor works at an account or at a site below it, such as a health
 * system's hospitals. An account is at itself and at the accounts above it.
 */
export function isAt(entity: Entity, orgId: string): boolean {
  const ids = new Set([orgId, ...descendantsOf(orgId).map((o) => o.id)]);
  return entity.kind === 'hcp' ? entity.affiliations.some((a) => ids.has(a.orgId)) : ids.has(entity.id);
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

/** Every procedure and test row for an entity; health systems roll up their facilities. */
function volumeRows(entity: Entity): ProcedureRow[] | null {
  if (entity.procedures !== 'rollup') return entity.procedures;
  return rollup(descendantsOf(entity.id).map((o) => o.procedures), 'family');
}

/** Procedure families for an entity, without echo and stress tests: none for someone who only does those. */
export function proceduresOf(entity: Entity): ProcedureRow[] | null {
  return volumeRows(entity)?.filter((r) => !isTest(r)) ?? null;
}

/** Echo and stress tests for an entity, counted apart from its procedures. */
export function testsOf(entity: Entity): ProcedureRow[] {
  return volumeRows(entity)?.filter(isTest) ?? [];
}

export function diagnosesOf(entity: Entity): DiagnosisRow[] {
  if (entity.diagnoses !== 'rollup') return entity.diagnoses;
  return rollup(descendantsOf(entity.id).map((o) => o.diagnoses), 'name');
}

/** Procedures over the last four quarters, without echo and stress tests. */
export function procedureTotal(entity: Entity): number {
  const rows = proceduresOf(entity);
  return rows ? sum(rows.map((r) => sum(r.series.slice(-4)))) : 0;
}

export function procedureYoy(entity: Entity): number | null {
  const rows = proceduresOf(entity);
  return rows?.length ? yoy(addSeries(rows.map((r) => r.series))) : null;
}

/** Patients an HCP referred to centres outside the system over the 12 months. */
export const referredOut = (hcp: Hcp): number => sum(hcp.referrals.outbound.filter((r) => r.ref).map((r) => r.count));

/** Patients who left an account for centres outside the system: its share leaving times its patients. */
export const patientsLost = (leakage: Leakage): number => Math.round((leakage.patients * leakage.leftPct) / 100);

/**
 * Accounts that report where their patients go, the most patients lost first.
 * By count, not share: a big account losing 17% can lose more than a small one losing 36%.
 */
export function accountsByPatientsLost(): { org: Org; leakage: Leakage; lost: number }[] {
  return allOrgs()
    .flatMap((org) => (org.leakage && org.type !== 'Health system' ? [{ org, leakage: org.leakage, lost: patientsLost(org.leakage) }] : []))
    .sort((a, b) => b.lost - a.lost);
}

/**
 * The doctors who send the most patients outside the system, most first, and
 * where most of them go. With an org, only doctors who work there or below it.
 * Referrals aren't split by site, so each count covers all of a doctor's sites.
 */
export function topReferrersOut(orgId?: string): { hcp: Hcp; count: number; mostTo: string }[] {
  return (orgId ? hcpsAt(orgId) : allHcps())
    .map((hcp) => {
      const top = hcp.referrals.outbound.filter((r) => r.ref).sort((a, b) => b.count - a.count)[0];
      return { hcp, count: referredOut(hcp), mostTo: top?.ref ? DESTINATIONS[top.ref].name : '' };
    })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
}

/** Where a visit to this entity physically happens. */
export function siteFor(entity: Entity, siteId?: string): Org {
  if (entity.kind === 'hco') return entity;
  const chosen = siteId && entity.affiliations.some((a) => a.orgId === siteId) ? siteId : primaryAffiliation(entity).orgId;
  return org(chosen);
}

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
  if (leaking) out.push({ id: 'leakage', label: 'Patients going elsewhere', tone: 'orange' });
  const growth = procedureYoy(entity);
  if (growth != null && growth >= 10) out.push({ id: 'rising', label: 'Busier than last year', tone: 'accent' });
  const last = lastInteraction(entity.id, workspace);
  const since = last ? daysBetween(fromIso(last.date), today) : Infinity;
  if (since > 30) out.push({ id: 'unseen', label: last ? 'Not seen in 30+ days' : 'No contact yet', tone: 'neutral' });
  return out;
}

/** What a signal means, in one plain sentence, for a rep who doesn't know the terms yet. */
export function signalMeaning(signal: Signal, entity: Entity): string {
  switch (signal.id) {
    case 'followup':
      return signal.label.startsWith('Overdue') ? 'Something you promised them is late.' : 'Something you promised them is due today.';
    case 'leakage': {
      const system = systemOf(entity.kind === 'hcp' ? primaryOrg(entity) : entity).name;
      return entity.kind === 'hcp' || !entity.leakage
        ? `They send some patients to centres outside ${system}.`
        : `${entity.leakage.leftPct}% of patients here go to centres outside ${system}.`;
    }
    case 'rising':
      return `${Math.round(procedureYoy(entity) ?? 0)}% more procedures than the year before.`;
    case 'unseen':
      return signal.label === 'No contact yet' ? 'No visit, call or note with them yet.' : 'No visit, call or note in over a month.';
  }
}

const WEIGHTS: Record<SignalId, number> = { followup: 40, leakage: 30, rising: 20, unseen: 12 };

/** Relevance used for default sorting and "Who to see". */
export function priorityOf(entity: Entity, workspace: Activity, today: Date): number {
  const signals = signalsFor(entity, workspace, today);
  const assigned = entity.kind === 'hco' ? entity.assigned : true;
  return sum(signals.map((s) => WEIGHTS[s.id])) + (assigned ? 5 : 0) + Math.min(10, procedureTotal(entity) / 100);
}
