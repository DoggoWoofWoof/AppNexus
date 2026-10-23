// What a rep types in Targets, or asks in Ask, read as filters:
// "cardiologists in NJ using Competitor A" picks New Jersey, Cardiology and
// Competitor A, and the words left over, such as a name or a town, are searched
// for as they are. An account named, as in "top doctors at Quarry Ridge", shows
// who works there, and "Mount Sinai" is the whole health system. A name in the
// list being searched, such as "Valemont Vascular Center" among accounts, is
// only a name. It knows the words below and the accounts in the data, it runs
// on the phone, and nothing typed is sent anywhere. describeSearch says a
// search back in words, as Targets offers it while typing and Ask answers it.

import { CODE_GROUPS, codesFor, pickLabel } from './codes';
import { allEntities, allOrgs, getOrg, STATES, systemOf, YOUR_STATES } from './data';
import { formatNumber, listJoin } from './format';
import type { Filters } from './search';
import type { SignalId } from './types';

type Patch = Partial<Filters>;

const STATE_WORDS: Record<string, string> = {
  'new york state': 'NY',
  'new york': 'NY',
  ny: 'NY',
  nys: 'NY',
  'new jersey': 'NJ',
  jersey: 'NJ',
  nj: 'NJ',
  connecticut: 'CT',
  ct: 'CT',
  pennsylvania: 'PA',
  pa: 'PA',
};

// One code, or a group of them, by the words reps use. Several named at once make the group they're all in.
const CODE_WORDS: Record<string, string> = {
  pci: '92928',
  pcis: '92928',
  stent: '92928',
  stents: '92928',
  'coronary stents': '92928',
  'diagnostic cath': '93458',
  'diagnostic caths': '93458',
  'cardiac cath': '93458',
  'heart cath': '93458',
  cath: '93458',
  caths: '93458',
  cabg: '33533',
  cabgs: '33533',
  bypass: '33533',
  tavr: '33361',
  tavrs: '33361',
  tavi: '33361',
  savr: '33405',
  mitral: '33426',
  'mitral repair': '33426',
  'af ablation': '93656',
  'afib ablation': '93656',
  ablation: '93656',
  ablations: '93656',
  afib: '93656',
  pacemaker: '33208',
  pacemakers: '33208',
  icd: '33249',
  icds: '33249',
  defibrillator: '33249',
  defibrillators: '33249',
  'loop recorder': '33285',
  'loop recorders': '33285',
  peripheral: '37225',
  'peripheral intervention': '37225',
  'peripheral interventions': '37225',
  carotid: '37215',
  'carotid stent': '37215',
  'carotid stents': '37215',
  'carotid stenting': '37215',
  evar: '34702',
  aneurysm: '34702',
  'right heart cath': '93451',
  'right heart caths': '93451',
  rhc: '93451',
  lvad: '33979',
  lvads: '33979',
  echo: '93306',
  echos: '93306',
  echoes: '93306',
  echocardiography: '93306',
  echocardiograms: '93306',
  'stress test': '93015',
  'stress tests': '93015',
  'stress testing': '93015',
  coronary: 'coronary',
  structural: 'structural',
  'structural heart': 'structural',
  valve: 'structural',
  valves: 'structural',
  rhythm: 'rhythm',
  arrhythmia: 'rhythm',
  vascular: 'vascular',
  'heart failure': 'failure',
  imaging: 'imaging',
  'all procedures': 'all',
};

const SPECIALTY_WORDS: Record<string, string> = {
  'interventional cardiologists': 'Interventional Cardiology',
  'interventional cardiologist': 'Interventional Cardiology',
  'interventional cardiology': 'Interventional Cardiology',
  interventionalists: 'Interventional Cardiology',
  interventionalist: 'Interventional Cardiology',
  interventional: 'Interventional Cardiology',
  'heart failure cardiologists': 'Advanced Heart Failure Cardiology',
  'heart failure cardiologist': 'Advanced Heart Failure Cardiology',
  'heart failure doctors': 'Advanced Heart Failure Cardiology',
  'advanced heart failure': 'Advanced Heart Failure Cardiology',
  electrophysiologists: 'Cardiac Electrophysiology',
  electrophysiologist: 'Cardiac Electrophysiology',
  electrophysiology: 'Cardiac Electrophysiology',
  ep: 'Cardiac Electrophysiology',
  eps: 'Cardiac Electrophysiology',
  'cardiothoracic surgeons': 'Cardiothoracic Surgery',
  'cardiothoracic surgeon': 'Cardiothoracic Surgery',
  'cardiothoracic surgery': 'Cardiothoracic Surgery',
  cardiothoracic: 'Cardiothoracic Surgery',
  // "CT" on its own is Connecticut.
  'ct surgeons': 'Cardiothoracic Surgery',
  'ct surgeon': 'Cardiothoracic Surgery',
  'ct surgery': 'Cardiothoracic Surgery',
  'cardiac surgeons': 'Cardiothoracic Surgery',
  'cardiac surgeon': 'Cardiothoracic Surgery',
  'heart surgeons': 'Cardiothoracic Surgery',
  'heart surgeon': 'Cardiothoracic Surgery',
  'vascular surgeons': 'Vascular Surgery',
  'vascular surgeon': 'Vascular Surgery',
  'vascular surgery': 'Vascular Surgery',
  cardiologists: 'Cardiology',
  cardiologist: 'Cardiology',
  cardiology: 'Cardiology',
  'general cardiologists': 'Cardiology',
  internists: 'Internal Medicine',
  internist: 'Internal Medicine',
  'internal medicine': 'Internal Medicine',
  'primary care': 'Internal Medicine',
  pcps: 'Internal Medicine',
  nephrologists: 'Nephrology',
  nephrologist: 'Nephrology',
  nephrology: 'Nephrology',
};

const SIGNAL_WORDS: Record<string, SignalId> = {
  'follow up': 'followup',
  'follow ups': 'followup',
  followup: 'followup',
  followups: 'followup',
  'follow up due': 'followup',
  due: 'followup',
  overdue: 'followup',
  leakage: 'leakage',
  leaking: 'leakage',
  'going elsewhere': 'leakage',
  'patients going elsewhere': 'leakage',
  'losing patients': 'leakage',
  'lost patients': 'leakage',
  'referring out': 'leakage',
  'sending out': 'leakage',
  'out of network': 'leakage',
  rising: 'rising',
  growing: 'rising',
  growth: 'rising',
  busier: 'rising',
  'trending up': 'rising',
  unseen: 'unseen',
  'not seen': 'unseen',
  'havent seen': 'unseen',
  'not visited': 'unseen',
  'havent visited': 'unseen',
  'havent met': 'unseen',
  'never seen': 'unseen',
  'never visited': 'unseen',
  'not met': 'unseen',
  'havent i seen': 'unseen',
  'havent i visited': 'unseen',
  'havent i met': 'unseen',
  'have not seen': 'unseen',
  'no contact': 'unseen',
  'fastest growing': 'rising',
};

// Everything else, word for word.
const OTHER_WORDS: Record<string, Patch> = {
  'health systems': { kind: 'hco', orgTypes: ['Health system'] },
  'health system': { kind: 'hco', orgTypes: ['Health system'] },
  hospitals: { kind: 'hco', orgTypes: ['Hospital'] },
  hospital: { kind: 'hco', orgTypes: ['Hospital'] },
  clinics: { kind: 'hco', orgTypes: ['Clinic'] },
  clinic: { kind: 'hco', orgTypes: ['Clinic'] },
  practices: { kind: 'hco', orgTypes: ['Clinic'] },
  practice: { kind: 'hco', orgTypes: ['Clinic'] },
  accounts: { kind: 'hco' },
  account: { kind: 'hco' },
  hcos: { kind: 'hco' },
  hco: { kind: 'hco' },
  organizations: { kind: 'hco' },
  organisations: { kind: 'hco' },
  facilities: { kind: 'hco' },
  facility: { kind: 'hco' },
  sites: { kind: 'hco' },
  doctors: { kind: 'hcp' },
  doctor: { kind: 'hcp' },
  docs: { kind: 'hcp' },
  physicians: { kind: 'hcp' },
  physician: { kind: 'hcp' },
  hcps: { kind: 'hcp' },
  hcp: { kind: 'hcp' },
  providers: { kind: 'hcp' },
  specialists: { kind: 'hcp' },
  clinicians: { kind: 'hcp' },
  people: { kind: 'hcp' },
  surgeons: { kind: 'hcp' },
  // The rep's own territory, whatever Targets was showing.
  'my territory': { states: [] },
  'our territory': { states: [] },
  territory: { states: [] },
  'my area': { states: [] },
  'my region': { states: [] },
  'my targets': { mine: true },
  'my target': { mine: true },
  'my list': { mine: true },
  'my book': { mine: true },
  mine: { mine: true },
  'my accounts': { mine: true, kind: 'hco' },
  'my hospitals': { mine: true, kind: 'hco', orgTypes: ['Hospital'] },
  'my doctors': { mine: true, kind: 'hcp' },
  'my docs': { mine: true, kind: 'hcp' },
  everyone: { mine: false },
  everybody: { mine: false },
  competitors: { competitors: ['any'] },
  competitor: { competitors: ['any'] },
  competition: { competitors: ['any'] },
  competitive: { competitors: ['any'] },
  competing: { competitors: ['any'] },
  rival: { competitors: ['any'] },
  rivals: { competitors: ['any'] },
  'most procedures': { sort: 'volume' },
  most: { sort: 'volume' },
  top: { sort: 'volume' },
  busiest: { sort: 'volume' },
  biggest: { sort: 'volume' },
  'high volume': { sort: 'volume' },
  'highest volume': { sort: 'volume' },
  volume: { sort: 'volume' },
  nearest: { sort: 'distance' },
  closest: { sort: 'distance' },
  nearby: { sort: 'distance' },
  near: { sort: 'distance' },
  'near me': { sort: 'distance' },
  'close by': { sort: 'distance' },
  close: { sort: 'distance' },
  'by name': { sort: 'name' },
  az: { sort: 'name' },
  alphabetical: { sort: 'name' },
  alphabetically: { sort: 'name' },
  'top priority': { sort: 'relevance' },
  priority: { sort: 'relevance' },
  prioritise: { sort: 'relevance' },
  prioritize: { sort: 'relevance' },
  best: { sort: 'relevance' },
  'should i see': { sort: 'relevance' },
  'should i visit': { sort: 'relevance' },
  'should i call': { sort: 'relevance' },
  'who to see': { sort: 'relevance' },
  'in today': { inDay: true },
  'in tomorrow': { inDay: true },
  'in that day': { inDay: true },
  'working today': { inDay: true },
  'working tomorrow': { inDay: true },
  available: { inDay: true },
  'not planned': { planned: 'unplanned' },
  unplanned: { planned: 'unplanned' },
  'not in my plan': { planned: 'unplanned' },
  'not in plan': { planned: 'unplanned' },
  'not added': { planned: 'unplanned' },
  planned: { planned: 'planned' },
  'in my plan': { planned: 'planned' },
  'in plan': { planned: 'planned' },
};

// Words that only join the others up, or ask: "who", "in", "using", "which", "products".
const FILLER = new Set(
  (
    'a an the in at on of for to from with by and or who whos that which are is do does doing did use uses using used ' +
    'anyone anybody someone somebody ' +
    'show me find list all any some get give see want need i my please lots lot many much procedures procedure cases ' +
    'case them they there here where what whats should could can will visit visits call today tomorrow this week more than ' +
    'have has their only just high very state states area ' +
    'how number tell about know our we us ranked rank code codes cpt group groups product products device devices brand brands ' +
    'worth focus meet meeting seeing go after while recently lately yet long ago'
  ).split(' '),
);

// Words in many accounts' names, which on their own don't say which one.
const GENERIC = new Set(
  'medical center centre hospital hospitals heart institute group associates cardiology vascular health system clinic point ridge hill row kidney and of the'.split(' '),
);

/** Lower case, no accents and nothing but letters and digits, so "Follow-up" is "followup". */
const plain = (word: string): string =>
  word
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

// The competitors named in the data, by name: "competitor a".
const COMPETITOR_NAMES = (): Record<string, string> =>
  Object.fromEntries(
    [...new Set(allEntities().flatMap((e) => e.competitors ?? []))].map((name) => [name.split(/\s+/).map(plain).join(' '), name]),
  );

const LONGEST = 4;

/** The kilometres in "within 2 km" or "under 3 miles", as the distances Targets offers. */
function distanceIn(text: string): { distance: Filters['distance']; rest: string } | null {
  const m = /\b(?:within|under|less than|in)?\s*(\d+(?:\.\d+)?)\s*(km|kms|kilometers|kilometres|mi|mile|miles)\b/i.exec(text);
  if (!m) return null;
  const km = Number(m[1]) * (m[2].toLowerCase().startsWith('mi') ? 1.609 : 1);
  return { distance: km <= 2 ? '2' : km <= 5 ? '5' : 'any', rest: text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length) };
}

/** The pick that covers every code named: one code, the group they're all in, or the first named. */
function pickFor(picks: string[]): string | undefined {
  if (picks.length <= 1) return picks[0];
  if (picks.includes('all')) return 'all';
  const covered = new Set(picks.flatMap((p) => codesFor(p) ?? []));
  return CODE_GROUPS.find((g) => [...covered].every((c) => g.codes.includes(c)))?.id ?? picks[0];
}

export interface ReadQuery {
  /** The filters the words set, with `query` the words left over. States and codes are among them when named. */
  filters: Patch;
  /** Whether any word set a filter, rather than all being searched for as a name. */
  understood: boolean;
}

/**
 * The account the words name, the most words first: all or part of one name,
 * such as "quarry ridge", or a run that only one health system's accounts share,
 * such as "mount sinai", for the system. One word does too, such as "riverwick"
 * or "sinai", unless it's short, a word any account could have, or one the
 * reader knows.
 */
function accountIn(words: string[]): { id: string; at: number; length: number } | null {
  const orgs = allOrgs().map((org) => ({ org, words: org.name.split(/\s+/).map(plain).filter(Boolean) }));
  const runIn = (name: string[], run: string[]) => name.some((_, k) => run.every((w, j) => name[k + j] === w));
  const known = (phrase: string) =>
    phrase in STATE_WORDS || phrase in SPECIALTY_WORDS || phrase in CODE_WORDS || phrase in SIGNAL_WORDS || phrase in OTHER_WORDS || FILLER.has(phrase);
  let best: { id: string; at: number; length: number } | null = null;
  for (let i = 0; i < words.length; i++) {
    for (let n = Math.min(LONGEST + 2, words.length - i); n >= 1; n--) {
      const run = words.slice(i, i + n).map(plain);
      if (known(run.join(' '))) continue;
      const hits = orgs.filter((o) => runIn(o.words, run));
      if (!hits.length) continue;
      if (n === 1 && (GENERIC.has(run[0]) || run[0].length < 5)) break;
      const whole = hits.find((o) => o.words.length === n);
      const systems = [...new Set(hits.map((o) => systemOf(o.org).id))];
      const org = whole?.org ?? (hits.length === 1 ? hits[0].org : systems.length === 1 ? getOrg(systems[0]) : null);
      if (org && (!best || n > best.length)) best = { id: org.id, at: i, length: n };
      break;
    }
  }
  return best;
}

/** Whether the words are whole words in one of the names, in order: "valemont vascular" is in "Valemont Vascular Center". */
function inAName(text: string, names: string[]): boolean {
  const words = ` ${text.split(/\s+/).map(plain).filter(Boolean).join(' ')} `;
  return words.trim() !== '' && names.some((n) => ` ${n.split(/\s+/).map(plain).filter(Boolean).join(' ')} `.includes(words));
}

/**
 * Reads what was typed into filters. Words are matched longest first and left to
 * right, so "right heart cath" is one procedure and the first of "doctors at
 * hospitals" says which list. Anything not understood is kept, as typed, to
 * search names with, and so is the whole of it when it's part of one of `names`.
 */
export function readTargetQuery(text: string, names: string[] = []): ReadQuery {
  if (inAName(text, names)) return { filters: { query: text.trim() }, understood: false };
  const patch: Patch = {};
  const within = distanceIn(text);
  if (within) patch.distance = within.distance;
  const words = (within?.rest ?? text).split(/[\s,;]+/).filter((w) => plain(w));
  const account = accountIn(words);
  if (account) {
    patch.org = account.id;
    words.splice(account.at, account.length);
  }
  const competitors = COMPETITOR_NAMES();
  const states = new Set<string>();
  const picks: string[] = [];
  const signals: SignalId[] = [];
  const left: string[] = [];

  const apply = (p: Patch) => {
    // The first of doctors or accounts named says which list; the rest add to it.
    for (const [key, value] of Object.entries(p) as [keyof Patch, never][]) {
      if (key === 'kind' && patch.kind) continue;
      // Specialties, types and competitors add up: "cardiologists and EPs".
      if (key === 'specialties' || key === 'orgTypes' || key === 'competitors') patch[key] = [...new Set([...(patch[key] ?? []), ...(value as string[])])];
      else patch[key] = value;
    }
  };

  for (let i = 0; i < words.length; ) {
    let matched = 0;
    for (let n = Math.min(LONGEST, words.length - i); n >= 1 && !matched; n--) {
      const phrase = words
        .slice(i, i + n)
        .map(plain)
        .join(' ');
      if (phrase in competitors) apply({ competitors: [competitors[phrase]] });
      else if (phrase in STATE_WORDS) states.add(STATE_WORDS[phrase]);
      else if (phrase in SPECIALTY_WORDS) apply({ kind: 'hcp', specialties: [SPECIALTY_WORDS[phrase]] });
      else if (phrase in CODE_WORDS) picks.push(CODE_WORDS[phrase]);
      else if (/^\d{5}$/.test(phrase) && codesFor(phrase)) picks.push(phrase);
      else if (phrase in SIGNAL_WORDS) signals.push(SIGNAL_WORDS[phrase]);
      else if (phrase in OTHER_WORDS) apply(OTHER_WORDS[phrase]);
      else continue;
      matched = n;
    }
    // Small numbers, as in "top 10", say nothing a filter can.
    if (!matched && !FILLER.has(plain(words[i])) && !/^\d{1,3}$/.test(plain(words[i]))) left.push(words[i]);
    i += matched || 1;
  }

  // The rep's own territory is what Targets shows anyway; otherwise the states in the order the chip lists them.
  if (states.size) patch.states = states.size === YOUR_STATES.length && YOUR_STATES.every((st) => states.has(st)) ? [] : STATES.map((st) => st.id).filter((id) => states.has(id));
  const pick = pickFor(picks);
  if (pick) patch.codes = pick;
  if (signals.length) patch.signals = [...new Set(signals)];
  // A specialty is for doctors and a type for accounts: whichever list was named first keeps its own.
  if (patch.kind === 'hco') delete patch.specialties;
  if (patch.kind === 'hcp') delete patch.orgTypes;
  // A competitor named is more than "a competitor".
  if (patch.competitors && patch.competitors.length > 1) patch.competitors = patch.competitors.filter((c) => c !== 'any');
  const understood = Object.keys(patch).length > 0;
  // With nothing understood, the words stay exactly as typed.
  return { filters: { ...patch, query: understood ? left.join(' ') : text.trim() }, understood };
}

/** The words each state, procedure, specialty and reason to see someone is known by, for finding a filter by them. */
export const QUERY_WORDS = { states: STATE_WORDS, codes: CODE_WORDS, specialties: SPECIALTY_WORDS, signals: SIGNAL_WORDS };

// What each specialty's doctors and each type of account are called, one and several.
const SPECIALISTS: Record<string, [string, string]> = {
  'Interventional Cardiology': ['interventional cardiologist', 'interventional cardiologists'],
  Cardiology: ['cardiologist', 'cardiologists'],
  'Cardiac Electrophysiology': ['electrophysiologist', 'electrophysiologists'],
  'Cardiothoracic Surgery': ['cardiothoracic surgeon', 'cardiothoracic surgeons'],
  'Vascular Surgery': ['vascular surgeon', 'vascular surgeons'],
  'Advanced Heart Failure Cardiology': ['heart failure cardiologist', 'heart failure cardiologists'],
  'Internal Medicine': ['internist', 'internists'],
  Nephrology: ['nephrologist', 'nephrologists'],
};
const ACCOUNT_TYPES: Record<string, [string, string]> = {
  Hospital: ['hospital', 'hospitals'],
  Clinic: ['clinic', 'clinics'],
  'Health system': ['health system', 'health systems'],
};
const SIGNAL_PHRASES: Record<SignalId, string> = {
  followup: 'with a follow-up due',
  leakage: 'with patients going elsewhere',
  rising: 'busier than last year',
  unseen: 'not seen in 30+ days',
};

/** "PCI" stays as it is; "Coronary" is "coronary procedures" and "Pacemaker implant" "pacemaker implant". */
function procedureWords(pick: string): string {
  const label = pickLabel(pick);
  if (pick === 'imaging') return 'echo and stress tests';
  if (CODE_GROUPS.some((g) => g.id === pick)) return `${label.toLowerCase()} procedures`;
  return /^[A-Z]{2,}/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1);
}

const orJoin = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`);

/**
 * What a search finds, in words: "37 interventional cardiologists in New Jersey
 * using Competitor A". Without a count it's just the list, as Targets offers
 * what was typed: "interventional cardiologists in New Jersey using Competitor A".
 * The order isn't said; the list says it.
 */
export function describeSearch(f: Filters, dayWord: string, count?: number): string {
  const one = count === 1;
  const named = f.kind === 'hcp' ? f.specialties.map((s) => SPECIALISTS[s] ?? [s, s]) : f.orgTypes.map((t) => ACCOUNT_TYPES[t] ?? [t, t]);
  const noun = named.length ? listJoin(named.map(([a, b]) => (one ? a : b))) : f.kind === 'hcp' ? (one ? 'doctor' : 'doctors') : one ? 'account' : 'accounts';
  const where = f.org
    ? `at ${getOrg(f.org)?.name ?? 'that account'}`
    : f.states.length
      ? `in ${listJoin(STATES.filter((st) => f.states.includes(st.id)).map((st) => st.label))}`
      : 'in your territory';
  return [
    count === undefined ? '' : formatNumber(count),
    noun,
    f.mine ? 'in My targets' : '',
    where,
    f.codes !== 'all' ? `doing ${procedureWords(f.codes)}` : '',
    f.competitors.length ? (f.competitors.includes('any') ? 'using a competitor' : `using ${orJoin(f.competitors)}`) : '',
    ...f.signals.map((id) => SIGNAL_PHRASES[id]),
    f.inDay ? `working ${/^(today|tomorrow)$/.test(dayWord) ? dayWord : `on ${dayWord}`}` : '',
    f.distance !== 'any' ? `within ${f.distance} km` : '',
    f.planned === 'unplanned' ? 'not in your plan' : f.planned === 'planned' ? 'in your plan' : '',
    f.query.trim() ? `matching “${f.query.trim()}”` : '',
  ]
    .filter(Boolean)
    .join(' ');
}
