// Deterministic quarterly volumes so the sample data looks lived-in but never changes between visits.

import type { Series } from '../types';

const SHAPE = [0, 3, -2, 1, -1, 2, -3, 1];

/**
 * Eight quarters of volume, oldest first, growing by roughly `growthPerYear`.
 * `base` is the volume of the oldest quarter.
 */
export function series(base: number, growthPerYear: number): Series {
  const perQuarter = Math.pow(1 + growthPerYear, 1 / 4);
  return SHAPE.map((wobble, i) => Math.max(0, Math.round(base * Math.pow(perQuarter, i) * (1 + wobble / 60))));
}

/**
 * Echo and stress tests: tests rather than procedures. A general cardiologist
 * reads hundreds a year, which would put them ahead of the doctors doing the
 * procedures, so they're counted on their own everywhere (testsOf() in index.ts).
 */
export const TEST_CODES = ['93306', '93015'];

/** Whether a volume row is a test: every code on it is one. */
export function isTest(row: { code: string }): boolean {
  const codes = row.code.match(/\d{5}/g) ?? [];
  return codes.length > 0 && codes.every((c) => TEST_CODES.includes(c));
}

/** Element-wise sum of several series. */
export function addSeries(list: Series[]): Series {
  return list.reduce((acc, s) => acc.map((v, i) => v + s[i]), new Array<number>(SHAPE.length).fill(0));
}
