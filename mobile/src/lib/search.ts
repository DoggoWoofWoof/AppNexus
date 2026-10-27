// Target search, filtering and sorting. Pure functions so they are easy to test.

import type { Volume } from './codes';
import type { Entity, PlanItem, Signal, SignalId } from './types';

export const SIGNAL_FILTERS: { id: SignalId; label: string }[] = [
  { id: 'followup', label: 'Follow-up due' },
  { id: 'leakage', label: 'Patients going elsewhere' },
  { id: 'rising', label: 'Busier than last year' },
  { id: 'unseen', label: 'Not seen 30+ days' },
];

export const DISTANCES = [
  { id: 'any', label: 'Any distance' },
  { id: '2', label: 'Within 2 km' },
  { id: '5', label: 'Within 5 km' },
] as const;

export const SORTS = [
  { id: 'volume', label: 'Most procedures' },
  { id: 'relevance', label: 'Relevance' },
  { id: 'distance', label: 'Nearest first' },
  { id: 'name', label: 'Name' },
] as const;

export interface Filters {
  query: string;
  kind: Entity['kind'];
  signals: SignalId[];
  /** Doctors in any of these specialties; none for every specialty. */
  specialties: string[];
  /** Accounts of any of these types; none for every type. */
  orgTypes: string[];
  distance: (typeof DISTANCES)[number]['id'];
  planned: 'any' | 'planned' | 'unplanned';
  sort: (typeof SORTS)[number]['id'];
  /** Only people who usually work on the day being planned. */
  inDay: boolean;
  /** Distances from this site instead of where the day starts, such as a cancelled visit's; '' for the start. */
  near: string;
  /** The states to show, such as ['NJ']; empty for the rep's own territory. Targets keeps it with the rep's choices. */
  states: string[];
  /** The procedures counted and ranked by (lib/codes.ts): 'all', a group or one code. Anyone doing none of them is left out. */
  codes: string;
  /** Only My targets. */
  mine: boolean;
  /** Only those using a competitor's products: none for anyone, ['any'] for any competitor, or any of those named. */
  competitors: string[];
  /** Only who works at this account or a site below it, or for accounts its sites; '' for anywhere. The states shown don't apply. */
  org: string;
}

export const DEFAULT_FILTERS: Filters = {
  query: '',
  kind: 'hcp',
  signals: [],
  specialties: [],
  orgTypes: [],
  distance: 'any',
  planned: 'any',
  sort: 'volume',
  inDay: false,
  near: '',
  states: [],
  codes: 'all',
  mine: false,
  competitors: [],
  org: '',
};

/**
 * A search as text, to open in Targets from an Ask answer: the filters that
 * differ from a new search, and always the territory and procedures, which
 * Targets keeps with the rep's choices.
 */
export const searchLink = (f: Filters): string =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(f).filter(([key, value]) => key === 'states' || key === 'codes' || JSON.stringify(value) !== JSON.stringify(DEFAULT_FILTERS[key as keyof Filters])),
    ),
  );

/**
 * The filters in a link from `searchLink`, keeping only what's valid, so a link
 * changed by hand can't break the list; null when it isn't one. Whether the
 * account and procedures exist is for whoever applies it to check.
 */
export function readSearchLink(text: string): Partial<Filters> | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const words = (v: unknown) => (Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : undefined);
  const oneOf = <T extends string>(v: unknown, ids: readonly T[]) => (ids.includes(v as T) ? (v as T) : undefined);
  const f: Partial<Filters> = {
    query: typeof r.query === 'string' ? r.query : undefined,
    kind: oneOf(r.kind, ['hcp', 'hco'] as const),
    signals: words(r.signals)?.filter((id): id is SignalId => SIGNAL_FILTERS.some((s) => s.id === id)),
    specialties: words(r.specialties),
    orgTypes: words(r.orgTypes),
    distance: oneOf(r.distance, DISTANCES.map((d) => d.id)),
    planned: oneOf(r.planned, ['any', 'planned', 'unplanned'] as const),
    sort: oneOf(r.sort, SORTS.map((s) => s.id)),
    inDay: typeof r.inDay === 'boolean' ? r.inDay : undefined,
    states: words(r.states),
    codes: typeof r.codes === 'string' ? r.codes : undefined,
    mine: typeof r.mine === 'boolean' ? r.mine : undefined,
    competitors: words(r.competitors),
    org: typeof r.org === 'string' ? r.org : undefined,
  };
  return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined));
}

/**
 * Who could be seen instead of a visit that won't happen: doctors in that day and
 * not planned yet, nearest to where the visit was first. The same things the
 * "See someone else" sheet goes by, set as filters so Targets shows them and they can be changed.
 */
export const insteadFilters = (siteId: string): Filters => ({ ...DEFAULT_FILTERS, kind: 'hcp', inDay: true, near: siteId, planned: 'unplanned', sort: 'distance' });

/** Number of filters in the Filters sheet that are on: not the search text, the Doctors/Accounts switch, or competitors, which have a chip of their own. */
export function activeFilterCount(f: Filters): number {
  return (
    f.signals.length +
    f.specialties.length +
    f.orgTypes.length +
    (f.distance !== 'any' ? 1 : 0) +
    (f.planned !== 'any' ? 1 : 0) +
    (f.inDay ? 1 : 0) +
    (f.near ? 1 : 0)
  );
}

/** The filters from the Filters sheet that are on, each as a chip that takes it off again. Competitors have their own. */
export function filterChips(f: Filters, dayWord: string): { key: string; label: string; off: Partial<Filters> }[] {
  return [
    ...f.signals.map((id) => ({ key: id, label: SIGNAL_FILTERS.find((s) => s.id === id)?.label ?? id, off: { signals: f.signals.filter((s) => s !== id) } })),
    ...f.specialties.map((s) => ({ key: `specialty-${s}`, label: s, off: { specialties: f.specialties.filter((x) => x !== s) } })),
    ...f.orgTypes.map((t) => ({ key: `type-${t}`, label: t, off: { orgTypes: f.orgTypes.filter((x) => x !== t) } })),
    ...(f.distance !== 'any' ? [{ key: 'distance', label: DISTANCES.find((d) => d.id === f.distance)?.label ?? '', off: { distance: 'any' as const } }] : []),
    ...(f.planned !== 'any' ? [{ key: 'planned', label: f.planned === 'planned' ? 'Planned' : 'Not planned', off: { planned: 'any' as const } }] : []),
    ...(f.inDay ? [{ key: 'inDay', label: `In ${dayWord}`, off: { inDay: false } }] : []),
  ];
}

const normalise = (s: string): string => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

export interface SearchContext {
  haystack: (e: Entity) => string;
  signals: (e: Entity) => Signal[];
  /** How far away they are, from `near` when it's set. */
  distance: (e: Entity, near: string) => number;
  planned: (e: Entity) => PlanItem | null;
  /** How worth seeing they are, with the driving to them from `km` away and the procedures picked (`priorityOf` in lib/data). */
  priority: (e: Entity, km: number, volume: Volume | null) => number;
  /** Whether they usually work on the day being planned. */
  inDay: (e: Entity) => boolean;
  /** Whether they're in My targets. */
  mine: (e: Entity) => boolean;
  /** Their procedures in a pick of codes (`volumeIn` in lib/codes.ts). */
  volume: (e: Entity, codes: string) => Volume | null;
  /** The state they're in, such as "NY". */
  state: (e: Entity) => string;
  /** The states shown when none are chosen: the rep's own territory. */
  home: string[];
  /** Whether they work at an account (`isAt` in lib/data). */
  isAt: (e: Entity, orgId: string) => boolean;
}

export interface SearchRow {
  entity: Entity;
  signals: Signal[];
  distance: number;
  planned: PlanItem | null;
  /** How worth seeing they are, in the procedures picked, less the drive there from where `distance` is measured. */
  priority: number;
  /** Their procedures in the codes picked, or null when they do none. */
  volume: Volume | null;
  /** In My targets. */
  mine: boolean;
}

/** My targets first, then everyone else, each in the order it was in. */
export function mineFirst(rows: SearchRow[], mine: (row: SearchRow) => boolean = (row) => row.mine): SearchRow[] {
  return [...rows.filter(mine), ...rows.filter((row) => !mine(row))];
}

/** Filters and sorts entities. `ctx` supplies everything that depends on the rep's workspace. */
export function searchTargets(entities: Entity[], f: Filters, ctx: SearchContext): SearchRow[] {
  const tokens = normalise(f.query).split(/\s+/).filter(Boolean);
  const maxKm = f.distance === 'any' ? Infinity : Number(f.distance);
  const states = f.states.length ? f.states : ctx.home;

  const rows = entities
    .filter((e) => e.kind === f.kind)
    .map((entity) => {
      const distance = ctx.distance(entity, f.near);
      const volume = ctx.volume(entity, f.codes);
      return {
        entity,
        signals: ctx.signals(entity),
        distance,
        planned: ctx.planned(entity),
        priority: ctx.priority(entity, distance, volume),
        volume,
        mine: ctx.mine(entity),
      };
    })
    .filter((row) => {
      const hay = normalise(ctx.haystack(row.entity));
      if (!tokens.every((t) => hay.includes(t))) return false;
      if (f.signals.length && !f.signals.every((id) => row.signals.some((s) => s.id === id))) return false;
      if (row.entity.kind === 'hcp' && f.specialties.length && !f.specialties.includes(row.entity.specialty)) return false;
      if (row.entity.kind === 'hco' && f.orgTypes.length && !f.orgTypes.includes(row.entity.type)) return false;
      if (row.distance > maxKm) return false;
      if (f.planned === 'planned' && !row.planned) return false;
      if (f.planned === 'unplanned' && row.planned) return false;
      if (f.inDay && !ctx.inDay(row.entity)) return false;
      if (f.org && !ctx.isAt(row.entity, f.org)) return false;
      if (!f.org && !states.includes(ctx.state(row.entity))) return false;
      if (f.codes !== 'all' && !row.volume) return false;
      if (f.mine && !row.mine) return false;
      const uses = row.entity.competitors ?? [];
      if (f.competitors.length && (f.competitors.includes('any') ? !uses.length : !f.competitors.some((c) => uses.includes(c)))) return false;
      return true;
    });

  // Doctors by surname, as the list shows them ("Dr. Lee"), then first name; accounts by name.
  const sortName = (r: SearchRow) => (r.entity.kind === 'hcp' ? r.entity.name.replace(/^Dr\. /, '').replace(/^(\S+) (.+)$/, '$2 $1') : r.entity.name);
  const byName = (a: SearchRow, b: SearchRow) => sortName(a).localeCompare(sortName(b));
  const sorters: Record<Filters['sort'], (a: SearchRow, b: SearchRow) => number> = {
    // Those doing none of the procedures go last.
    volume: (a, b) => (b.volume?.year ?? -1) - (a.volume?.year ?? -1) || b.priority - a.priority || byName(a, b),
    relevance: (a, b) => b.priority - a.priority || byName(a, b),
    distance: (a, b) => a.distance - b.distance || byName(a, b),
    name: byName,
  };
  return rows.sort(sorters[f.sort] ?? sorters.volume);
}
