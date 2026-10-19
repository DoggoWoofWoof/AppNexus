// Target search, filtering and sorting. Pure functions so they are easy to test.

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
  { id: 'relevance', label: 'Relevance' },
  { id: 'distance', label: 'Nearest first' },
  { id: 'name', label: 'Name' },
] as const;

export interface Filters {
  query: string;
  kind: Entity['kind'];
  signals: SignalId[];
  specialty: string;
  orgType: string;
  distance: (typeof DISTANCES)[number]['id'];
  planned: 'any' | 'planned' | 'unplanned';
  sort: (typeof SORTS)[number]['id'];
}

export const DEFAULT_FILTERS: Filters = {
  query: '',
  kind: 'hcp',
  signals: [],
  specialty: '',
  orgType: '',
  distance: 'any',
  planned: 'any',
  sort: 'relevance',
};

/** Number of filters applied beyond the search text and the People/Accounts tab. */
export function activeFilterCount(f: Filters): number {
  return f.signals.length + (f.specialty ? 1 : 0) + (f.orgType ? 1 : 0) + (f.distance !== 'any' ? 1 : 0) + (f.planned !== 'any' ? 1 : 0);
}

const normalise = (s: string): string => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

export interface SearchContext {
  haystack: (e: Entity) => string;
  signals: (e: Entity) => Signal[];
  distance: (e: Entity) => number;
  planned: (e: Entity) => PlanItem | null;
  priority: (e: Entity) => number;
}

export interface SearchRow {
  entity: Entity;
  signals: Signal[];
  distance: number;
  planned: PlanItem | null;
  priority: number;
}

/** Filters and sorts entities. `ctx` supplies everything that depends on the rep's workspace. */
export function searchTargets(entities: Entity[], f: Filters, ctx: SearchContext): SearchRow[] {
  const tokens = normalise(f.query).split(/\s+/).filter(Boolean);
  const maxKm = f.distance === 'any' ? Infinity : Number(f.distance);

  const rows = entities
    .filter((e) => e.kind === f.kind)
    .map((entity) => ({
      entity,
      signals: ctx.signals(entity),
      distance: ctx.distance(entity),
      planned: ctx.planned(entity),
      priority: ctx.priority(entity),
    }))
    .filter((row) => {
      const hay = normalise(ctx.haystack(row.entity));
      if (!tokens.every((t) => hay.includes(t))) return false;
      if (f.signals.length && !f.signals.every((id) => row.signals.some((s) => s.id === id))) return false;
      if (row.entity.kind === 'hcp' && f.specialty && row.entity.specialty !== f.specialty) return false;
      if (row.entity.kind === 'hco' && f.orgType && row.entity.type !== f.orgType) return false;
      if (row.distance > maxKm) return false;
      if (f.planned === 'planned' && !row.planned) return false;
      if (f.planned === 'unplanned' && row.planned) return false;
      return true;
    });

  const bare = (r: SearchRow) => r.entity.name.replace(/^Dr\. /, '');
  const byName = (a: SearchRow, b: SearchRow) => bare(a).localeCompare(bare(b));
  const sorters: Record<Filters['sort'], (a: SearchRow, b: SearchRow) => number> = {
    relevance: (a, b) => b.priority - a.priority || byName(a, b),
    distance: (a, b) => a.distance - b.distance || byName(a, b),
    name: byName,
  };
  return rows.sort(sorters[f.sort] ?? sorters.relevance);
}
