// Deterministic quarterly volumes so the sample data looks lived-in but never changes between visits.

const SHAPE = [0, 3, -2, 1, -1, 2, -3, 1];

/**
 * Eight quarters of volume, oldest first, growing by roughly `growthPerYear`.
 * `base` is the volume of the oldest quarter.
 */
export function series(base, growthPerYear) {
  const perQuarter = Math.pow(1 + growthPerYear, 1 / 4);
  return SHAPE.map((wobble, i) => Math.max(0, Math.round(base * Math.pow(perQuarter, i) * (1 + wobble / 60))));
}

/** Element-wise sum of several series. */
export function addSeries(list) {
  return list.reduce((acc, s) => acc.map((v, i) => v + s[i]), new Array(SHAPE.length).fill(0));
}
