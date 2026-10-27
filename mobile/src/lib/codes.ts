// The procedures Targets ranks by: all of them, a group of codes such as
// coronary, or one code. The groups are the sample's own; a team would set
// theirs. A row with several codes ("CPT 33208, 33249") counts for each. Echo
// and stress tests are tests rather than procedures, as everywhere in the app
// (TEST_CODES in data/series.ts), so they count only when picked, not in All
// procedures.

import { proceduresOf, testsOf } from './data';
import { TEST_CODES } from './data/series';
import { formatNumber, sum } from './format';
import type { Entity } from './types';

/** Each procedure in the sample by its CPT code, with the name a rep uses. */
export const CODES: { code: string; label: string }[] = [
  { code: '92928', label: 'PCI' },
  { code: '93458', label: 'Diagnostic cardiac cath' },
  { code: '33533', label: 'CABG' },
  { code: '33361', label: 'TAVR' },
  { code: '33405', label: 'SAVR' },
  { code: '33426', label: 'Mitral repair' },
  { code: '93656', label: 'AF ablation' },
  { code: '33208', label: 'Pacemaker implant' },
  { code: '33249', label: 'ICD implant' },
  { code: '33285', label: 'Loop recorder' },
  { code: '37225', label: 'Peripheral intervention' },
  { code: '37215', label: 'Carotid stenting' },
  { code: '34702', label: 'EVAR' },
  { code: '93451', label: 'Right heart cath' },
  { code: '33979', label: 'LVAD implant' },
  { code: '93306', label: 'Echocardiography' },
  { code: '93015', label: 'Stress testing' },
];

export const CODE_GROUPS: { id: string; label: string; codes: string[] }[] = [
  { id: 'coronary', label: 'Coronary', codes: ['92928', '93458', '33533'] },
  { id: 'structural', label: 'Structural heart', codes: ['33361', '33405', '33426'] },
  { id: 'rhythm', label: 'Rhythm', codes: ['93656', '33208', '33249', '33285'] },
  { id: 'vascular', label: 'Vascular', codes: ['37225', '37215', '34702'] },
  { id: 'failure', label: 'Heart failure', codes: ['93451', '33979'] },
  { id: 'imaging', label: 'Echo and stress tests', codes: ['93306', '93015'] },
];

const ALL = CODES.map((c) => c.code).filter((c) => !TEST_CODES.includes(c));

/** Whether a pick is one Targets offers: 'all', a group's id or a code. */
export const isCodePick = (pick: unknown): pick is string =>
  pick === 'all' || CODE_GROUPS.some((g) => g.id === pick) || CODES.some((c) => c.code === pick);

/** The codes a pick covers, or null when it isn't one. */
export function codesFor(pick: string): string[] | null {
  if (pick === 'all') return ALL;
  const group = CODE_GROUPS.find((g) => g.id === pick);
  if (group) return group.codes;
  return CODES.some((c) => c.code === pick) ? [pick] : null;
}

/** What a pick is called on its chip: "All procedures", "Coronary" or "PCI". */
export const pickLabel = (pick: string): string =>
  CODE_GROUPS.find((g) => g.id === pick)?.label ?? CODES.find((c) => c.code === pick)?.label ?? 'All procedures';

const rowCodes = (code: string): string[] => code.match(/\d{5}/g) ?? [];

/** Procedures over the last four quarters and the four before, and the change in percent (null with none before). */
export interface Volume {
  year: number;
  before: number;
  change: number | null;
}

/** Their procedures in a pick, or null when they do none of them. */
export function volumeIn(entity: Entity, pick: string): Volume | null {
  const codes = codesFor(pick) ?? ALL;
  const rows = [...(proceduresOf(entity) ?? []), ...testsOf(entity)].filter((r) => rowCodes(r.code).some((c) => codes.includes(c)));
  const year = sum(rows.map((r) => sum(r.series.slice(-4))));
  const before = sum(rows.map((r) => sum(r.series.slice(-8, -4))));
  if (!year && !before) return null;
  return { year, before, change: before ? ((year - before) / before) * 100 : null };
}

/** "86 a year": a year's procedures. The change on the year before goes beside it as the trend arrow (`Delta`). */
export const volumeText = (v: Volume): string => `${formatNumber(v.year)} a year`;
