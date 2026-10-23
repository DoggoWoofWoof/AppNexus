// The Filters sheet's search. Every filter Targets has is an option here, found
// by a word of its name or one a rep would say ("EP", "NJ", "PCI", "overdue",
// a hospital's name), and tapping it adds it as a chip, or takes it off again.
// Specialties, types of account, states, competitors and reasons to see someone
// add up; a procedure, an account, a distance or an order is one at a time.
// Without a search, the sheet lists the ones marked `browse` under their headings.

import { CODE_GROUPS, CODES } from './codes';
import { allEntities, allHcps, allOrgs, STATES, YOUR_STATES } from './data';
import { DISTANCES, SIGNAL_FILTERS, SORTS, type Filters } from './search';
import { QUERY_WORDS } from './target-query';

export const SPECIALTIES = [...new Set(allHcps().map((h) => h.specialty))].sort();
export const ORG_TYPES = [...new Set(allOrgs().map((o) => o.type))].sort();
export const COMPETITORS = [...new Set(allEntities().flatMap((e) => e.competitors ?? []))].sort();

export interface FilterOption {
  key: string;
  label: string;
  /** The heading it's under, which the search also shows beside it. */
  group: string;
  on: boolean;
  /** What tapping it changes: adds it, or takes it off when it's on. */
  patch: Partial<Filters>;
  /** One of a group, as a procedure or a distance is, rather than adding up. */
  single: boolean;
  /** Listed in the sheet before anything is searched for; the rest have chips of their own or are too many to list. */
  browse: boolean;
  /** Other words it's found by, such as "ep" for Cardiac Electrophysiology. */
  words: string[];
}

/** Lower case, no accents, and words of letters and digits only. */
const plainWords = (text: string): string[] =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

/** The phrases in one of the reader's word lists that mean `value`. */
const wordsFor = (list: Record<string, string>, value: string) => Object.keys(list).filter((w) => list[w] === value);

/** On and off for a filter that adds up. */
const flip = (list: string[], value: string) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

/**
 * Every filter for the list being shown, doctors or accounts, and whether each is
 * on. `f` is the whole search, the territory and procedures kept for next time included.
 */
export function filterOptions(f: Filters, dayWord: string): FilterOption[] {
  const options: FilterOption[] = [];
  const add = (o: Omit<FilterOption, 'single' | 'browse' | 'words'> & Partial<FilterOption>) => options.push({ single: false, browse: true, words: [], ...o });

  for (const s of SIGNAL_FILTERS) {
    add({ key: `signal-${s.id}`, label: s.label, group: 'Why see them', on: f.signals.includes(s.id), patch: { signals: flip(f.signals, s.id) as Filters['signals'] }, words: wordsFor(QUERY_WORDS.signals, s.id) });
  }
  if (f.kind === 'hcp') {
    for (const s of SPECIALTIES) add({ key: `specialty-${s}`, label: s, group: 'Specialty', on: f.specialties.includes(s), patch: { specialties: flip(f.specialties, s) }, words: wordsFor(QUERY_WORDS.specialties, s) });
  } else {
    for (const t of ORG_TYPES) add({ key: `type-${t}`, label: t, group: 'Type', on: f.orgTypes.includes(t), patch: { orgTypes: flip(f.orgTypes, t) } });
  }
  // "A competitor" is any of them; one named is only that one.
  const anyCompetitor = f.competitors.includes('any');
  add({ key: 'competitor-any', label: 'Uses a competitor', group: 'Competitors', on: anyCompetitor, patch: { competitors: anyCompetitor ? [] : ['any'] }, words: ['competitors', 'competition'] });
  for (const c of COMPETITORS) {
    const on = f.competitors.includes(c);
    add({ key: `competitor-${c}`, label: `Uses ${c}`, group: 'Competitors', on, patch: { competitors: flip(anyCompetitor ? [] : f.competitors, c) } });
  }
  // One of a few, the first being anyone; tapping one that's on goes back to it.
  add({ key: 'in-any', label: 'Anyone', group: 'Who’s in', on: !f.inDay, single: true, patch: { inDay: false } });
  add({ key: 'in-day', label: `In ${dayWord}`, group: 'Who’s in', on: f.inDay, single: true, patch: { inDay: !f.inDay }, words: ['working', 'available'] });
  for (const d of DISTANCES) {
    const on = f.distance === d.id;
    add({ key: `distance-${d.id}`, label: d.label, group: 'Distance', on, single: true, patch: { distance: on ? 'any' : d.id }, words: ['near', 'close', 'km'] });
  }
  for (const [id, label] of [
    ['any', 'Everyone'],
    ['unplanned', 'Not planned'],
    ['planned', 'Planned'],
  ] as const) {
    const on = f.planned === id;
    add({ key: `planned-${id}`, label, group: 'In your plan', on, single: true, patch: { planned: on ? 'any' : id } });
  }
  // The list is always in some order, so tapping the one it's in leaves it.
  for (const s of SORTS) add({ key: `sort-${s.id}`, label: s.label, group: 'Order', on: f.sort === s.id, single: true, patch: { sort: s.id }, words: ['sort', 'order'] });

  // Only found by searching: these have chips of their own, or are too many to list.
  add({ key: 'mine', label: 'My targets', group: 'Your list', on: f.mine, browse: false, patch: { mine: !f.mine }, words: ['star', 'starred', 'my list'] });
  // An empty list of states is the rep's own territory.
  for (const st of STATES) {
    const on = f.states.includes(st.id);
    const rest = flip(f.states, st.id);
    add({
      key: `state-${st.id}`,
      label: st.label,
      group: YOUR_STATES.includes(st.id) ? 'Your territory' : 'Other territories',
      on,
      browse: false,
      patch: { states: rest.length === YOUR_STATES.length && YOUR_STATES.every((id) => rest.includes(id)) ? [] : rest },
      words: [st.id, ...wordsFor(QUERY_WORDS.states, st.id)],
    });
  }
  add({ key: 'state-home', label: 'All of your territory', group: 'Your territory', on: !f.states.length, single: true, browse: false, patch: { states: [] }, words: ['home'] });
  add({ key: 'codes-all', label: 'All procedures', group: 'Procedures', on: f.codes === 'all', single: true, browse: false, patch: { codes: 'all' } });
  for (const g of CODE_GROUPS) {
    const on = f.codes === g.id;
    add({ key: `codes-${g.id}`, label: g.label, group: 'Procedures', on, single: true, browse: false, patch: { codes: on ? 'all' : g.id }, words: wordsFor(QUERY_WORDS.codes, g.id) });
  }
  for (const c of CODES) {
    const on = f.codes === c.code;
    add({ key: `codes-${c.code}`, label: `${c.label} · ${c.code}`, group: 'Procedures', on, single: true, browse: false, patch: { codes: on ? 'all' : c.code }, words: wordsFor(QUERY_WORDS.codes, c.code) });
  }
  for (const o of [...allOrgs()].sort((a, b) => a.name.localeCompare(b.name))) {
    const on = f.org === o.id;
    add({ key: `org-${o.id}`, label: `At ${o.name}`, group: 'Accounts', on, single: true, browse: false, patch: { org: on ? '' : o.id }, words: [o.type] });
  }
  return options;
}

/**
 * The options a search finds: each word typed starts a word of the option's
 * name, heading or other words. Names that start with what was typed, with or
 * without their "At" or "Uses", come first, then the rest in the sheet's order.
 */
export function findFilters(options: FilterOption[], text: string): FilterOption[] {
  const typed = plainWords(text);
  if (!typed.length) return [];
  const phrase = typed.join(' ');
  const found = options.filter((o) => {
    const words = [...plainWords(o.label), ...plainWords(o.group), ...o.words.flatMap(plainWords)];
    return typed.every((t) => words.some((w) => w.startsWith(t)));
  });
  const startsWith = (name: string) => plainWords(name).join(' ').startsWith(phrase);
  const starts = (o: FilterOption) => startsWith(o.label) || startsWith(o.label.replace(/^(At|Uses) /, '')) || o.words.some(startsWith);
  return [...found.filter(starts), ...found.filter((o) => !starts(o))];
}
