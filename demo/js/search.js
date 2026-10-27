// Target search, filtering and sorting. Pure functions so they are easy to test.

export const SIGNAL_FILTERS = [
  { id: 'followup', label: 'Follow-up due' },
  { id: 'leakage', label: 'Leakage risk' },
  { id: 'rising', label: 'Rising volume' },
  { id: 'unseen', label: 'Not seen 30+ days' },
];

export const DISTANCES = [
  { id: 'any', label: 'Any distance' },
  { id: '2', label: 'Within 2 km' },
  { id: '5', label: 'Within 5 km' },
];

export const SORTS = [
  { id: 'relevance', label: 'Relevance' },
  { id: 'distance', label: 'Nearest first' },
  { id: 'name', label: 'Name' },
];

export const DEFAULT_FILTERS = {
  query: '',
  kind: 'hcp',
  signals: [],
  specialty: '',
  orgType: '',
  distance: 'any',
  planned: 'any',
  sort: 'relevance',
  view: 'list',
};

/** Number of filters applied beyond the search text and the People/Accounts tab. */
export function activeFilterCount(f) {
  return f.signals.length + (f.specialty ? 1 : 0) + (f.orgType ? 1 : 0) + (f.distance !== 'any' ? 1 : 0) + (f.planned !== 'any' ? 1 : 0);
}

const normalise = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

/**
 * Filters and sorts entities. `ctx` supplies everything that depends on the
 * rep's workspace: { haystack, signals, distance, priority, planned }, where
 * priority takes how far away they are, as the drive there counts.
 * Returns rows of { entity, signals, distance, planned, priority }.
 */
export function searchTargets(entities, f, ctx) {
  const tokens = normalise(f.query).split(/\s+/).filter(Boolean);
  const maxKm = f.distance === 'any' ? Infinity : Number(f.distance);

  const rows = entities
    .filter((e) => e.kind === f.kind)
    .map((entity) => {
      const distance = ctx.distance(entity);
      return {
        entity,
        signals: ctx.signals(entity),
        distance,
        planned: ctx.planned(entity),
        priority: ctx.priority(entity, distance),
      };
    })
    .filter((row) => {
      const hay = normalise(ctx.haystack(row.entity));
      if (!tokens.every((t) => hay.includes(t))) return false;
      if (f.signals.length && !f.signals.every((id) => row.signals.some((s) => s.id === id))) return false;
      if (f.kind === 'hcp' && f.specialty && row.entity.specialty !== f.specialty) return false;
      if (f.kind === 'hco' && f.orgType && row.entity.type !== f.orgType) return false;
      if (row.distance > maxKm) return false;
      if (f.planned === 'planned' && !row.planned) return false;
      if (f.planned === 'unplanned' && row.planned) return false;
      return true;
    });

  const byName = (a, b) => a.entity.name.replace(/^Dr\. /, '').localeCompare(b.entity.name.replace(/^Dr\. /, ''));
  const sorters = {
    relevance: (a, b) => b.priority - a.priority || byName(a, b),
    distance: (a, b) => a.distance - b.distance || byName(a, b),
    name: byName,
  };
  return rows.sort(sorters[f.sort] || sorters.relevance);
}
