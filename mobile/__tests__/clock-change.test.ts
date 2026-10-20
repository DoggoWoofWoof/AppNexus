// The week the clocks go back. Sunday then has 25 hours, so stepping a day at a
// time by 24 hours got stuck on it, and listing the next five working days never
// ended: the app froze on opening in London from 21 to 25 October 2026, and in
// New York from 27 October to 1 November. Jest can't change its own time zone, so
// the date helpers run again in a Node process set to each of those places.

import { describe, expect, test } from '@jest/globals';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(path.join(__dirname, '../src/lib/format.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

/** Runs `code` after format.ts in a Node process in `zone`, and returns what it prints as JSON. */
function inZone<T>(zone: string, code: string): T {
  // Set in the process too: Node on Windows doesn't read TZ from its environment at start.
  const script = `process.env.TZ = ${JSON.stringify(zone)};\nconst lib = {};\n(function (exports) {\n${source}\n})(lib);\nconst { addDays, daysBetween, isoDate } = lib;\nconsole.log(JSON.stringify((() => { ${code} })()));`;
  const out = execFileSync(process.execPath, ['-e', script], { env: { ...process.env, TZ: zone }, encoding: 'utf8', timeout: 10000 });
  return JSON.parse(out) as T;
}

describe.each(['Europe/London', 'America/New_York', 'Australia/Sydney', 'Asia/Kolkata'])('in %s', (zone) => {
  test('a day on is always the next date on the calendar, all through 2026', () => {
    const wrong = inZone<string[]>(
      zone,
      `const wrong = [];
       for (let d = new Date(2026, 0, 1); d.getFullYear() === 2026; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
         const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
         const on = addDays(d, 1);
         if (isoDate(on) !== isoDate(next) || on.getHours() !== 0) wrong.push(isoDate(d));
         if (daysBetween(d, next) !== 1) wrong.push('between ' + isoDate(d));
       }
       return wrong;`,
    );
    expect(wrong).toEqual([]);
  });

  test('the next five working days can be listed every day the clocks change', () => {
    // The same loop as the booking days in workspace.ts, with a stop in case it sticks.
    const lists = inZone<string[][]>(
      zone,
      `return ['2026-10-21', '2026-10-25', '2026-10-27', '2026-11-01', '2026-03-28', '2026-04-04'].map((iso) => {
         const [y, m, day] = iso.split('-').map(Number);
         const days = [];
         let steps = 0;
         for (let d = new Date(y, m - 1, day); days.length < 5 && steps < 20; d = addDays(d, 1), steps++) {
           if (!days.length || (d.getDay() !== 0 && d.getDay() !== 6)) days.push(isoDate(d));
         }
         return days;
       });`,
    );
    expect(lists[0]).toEqual(['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-26', '2026-10-27']);
    expect(lists[1]).toEqual(['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29']);
    expect(lists[3]).toEqual(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']);
    for (const list of lists) expect(list).toHaveLength(5);
  });
});
