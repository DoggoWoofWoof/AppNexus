// Figures a rep can trust and follow: every figure says which months it covers,
// accounts rank by patients lost, an account names who sends patients out, and
// tags are in plain words. From the Nadia, Kwame and Tomás persona reviews.

import { describe, expect, test } from '@jest/globals';

import { answer, detectIntent, SAMPLE, type Intent } from '@/lib/ask';
import { briefFigures } from '@/lib/brief';
import { accountsByPatientsLost, allEntities, getEntity, getOrg, patientsLost, signalMeaning, signalsFor, topReferrersOut } from '@/lib/data';
import { DATA_PERIOD, FIGURES_END } from '@/lib/data/seed';
import { lastQuarters, startOfDay } from '@/lib/format';
import { buildPrep, docText, reportDoc, reportFrom } from '@/lib/saved';
import { SIGNAL_FILTERS } from '@/lib/search';
import type { Entity } from '@/lib/types';
import { buildContext, freshWorkspace } from '@/lib/workspace';

const today = startOfDay(new Date(2026, 9, 19));
const ws = freshWorkspace(today);
const ctx = buildContext(ws, today);
const entity = (id: string): Entity => getEntity(id)!;

// One question for each kind of answer.
const QUESTIONS: Record<Intent, string> = {
  contact: 'When can I see Dr. Patel?',
  history: 'What happened last time with Dr. Patel?',
  followups: 'What follow-ups are overdue?',
  inbound: 'Who refers to Dr. Patel?',
  referrals: 'Who sends the most patients out?',
  mix: 'What is the procedure mix at Mount Sinai West?',
  leakage: 'Where am I losing the most volume?',
  decline: 'What has declined?',
  growth: 'Which accounts are growing the most?',
  trend: 'How is Dr. Patel trending?',
  where: 'Which hospitals does Dr. Patel work at?',
  peers: 'Who does Dr. Patel work with?',
  near: 'Who is near Mount Sinai West?',
  suggest: 'Who should I see today?',
  visit: 'When am I seeing Dr. Patel?',
  plan: 'What’s on my plan today?',
  people: 'Top doctors at Mount Sinai Hospital',
  points: 'What should I bring up with Dr. Patel?',
  brief: 'Brief me on Dr. Maya Patel',
  prep: 'Help me prep for Dr. Patel',
  saved: 'What did I save?',
  week: 'Summarise my week',
  search: 'interventional',
};

// Answers built from volumes, referrals or leakage; the rest are about the rep's notes and plan.
const FIGURES: Intent[] = ['inbound', 'referrals', 'mix', 'leakage', 'decline', 'growth', 'trend', 'where', 'suggest', 'people', 'points', 'brief', 'prep'];

describe('the period the figures cover', () => {
  test('is one constant, and the charts label the same quarters', () => {
    expect(DATA_PERIOD).toBe('Sample data, Oct 2025 to Sep 2026');
    const quarters = lastQuarters(FIGURES_END);
    expect(quarters.slice(-4)).toEqual(['Q4 25', 'Q1 26', 'Q2 26', 'Q3 26']);
    // Charts don't move when today does.
    expect(lastQuarters(FIGURES_END)).toEqual(quarters);
  });

  test('every Ask answer says it is sample data, and answers with figures say which months', () => {
    for (const [intent, question] of Object.entries(QUESTIONS) as [Intent, string][]) {
      expect(detectIntent(question)).toBe(intent);
      const a = answer(question, ctx);
      if (a.unknown) continue;
      expect([intent, a.scope.at(-1)]).toEqual([intent, FIGURES.includes(intent) ? DATA_PERIOD : SAMPLE]);
      expect(a.scope.join(' ')).not.toMatch(/last 12 months/i);
    }
  });

  test('visit prep, saved reports and copied text carry the dates', () => {
    expect(buildPrep(entity('maya'), ctx).scope).toEqual([DATA_PERIOD]);

    const question = 'Where am I losing the most volume?';
    const doc = reportDoc(reportFrom(question, answer(question, ctx), today), today);
    expect(doc.scope).toContain(DATA_PERIOD);
    const lines = docText(doc, new Date(2026, 9, 19, 9, 0)).split('\n');
    expect(lines.at(-2)).toBe(`Patients who left the system · Most first · ${DATA_PERIOD}`);

    // Notes aren't from the figures, so they don't borrow the figures' months.
    const notes = reportDoc(reportFrom('What happened last time with Dr. Patel?', answer('What happened last time with Dr. Patel?', ctx), today), today);
    expect(docText(notes).split('\n').at(-2)).toBe(`Your notes and the team’s · Newest first · ${SAMPLE}`);

    // A report kept before scopes carried the dates still gets them when copied.
    expect(docText({ ...doc, scope: ['Procedures'] }).split('\n').at(-2)).toBe(`Procedures · ${DATA_PERIOD}`);
  });
});

describe('what Ask says to thanks, and about a doctor it doesn’t know', () => {
  test('thanks and hello get a reply, not a list of doctors', () => {
    for (const q of ['Thanks!', 'thank you', 'Hello', 'Good morning']) {
      expect(answer(q, ctx)).toMatchObject({ rows: [], subject: null, unknown: true });
    }
    expect(answer('Thanks!', ctx).summary).toMatch(/^You’re welcome/);
  });

  test('a doctor not in the data is said so, rather than answered about someone else', () => {
    expect(answer('Where does Dr. Smith refer?', ctx)).toMatchObject({
      summary: 'I can’t find Dr. Smith in your data. Check the spelling, or look them up in Targets.',
      subject: null,
      rows: [],
    });
    expect(answer('Where does Dr. Patel refer?', ctx).subject).toBe('maya');
  });
});

describe('patients lost', () => {
  test('is the share leaving times the patients', () => {
    expect(patientsLost(getOrg('msh')!.leakage!)).toBe(1061); // 17% of 6,240
    expect(patientsLost(getOrg('harlem')!.leakage!)).toBe(454); // 36% of 1,260
  });

  test('ranks accounts by patients, so a big account losing 17% comes before a small one losing 36%', () => {
    const ranked = accountsByPatientsLost();
    expect(ranked.map((r) => r.org.id)).toEqual(['msh', 'msw', 'msm', 'harlem']);
    expect(ranked.map((r) => r.lost)).toEqual([...ranked.map((r) => r.lost)].sort((a, b) => b - a));
    expect(ranked.every((r) => r.org.type !== 'Health system')).toBe(true);
  });

  test('Ask leads with the same account and gives the count first', () => {
    const a = answer('Where am I losing the most volume?', ctx);
    expect(a.about).toBe('msh');
    expect(a.summary).toMatch(/^Mount Sinai Hospital loses the most: 1,061 patients, 17% of 6,240\./);
    expect(a.rows[0]).toMatchObject({ id: 'msh', figure: '1,061' });
    expect(a.rows.map((r) => r.id)).toEqual(accountsByPatientsLost().map((r) => r.org.id));
  });

  test('an account’s headline figure is the number of patients, with the share under it', () => {
    const [, leaving] = briefFigures(entity('msw'), ctx);
    expect(leaving).toMatchObject({ label: 'Patients leaving', value: '827', sub: '26% of 3,180', tone: 'orange' });
  });
});

describe('who sends patients out', () => {
  test('lists the doctors at an account, and the clinics below it, with the most referrals outside the system', () => {
    expect(topReferrersOut('msw').map(({ hcp, count, mostTo }) => [hcp.id, count, mostTo])).toEqual([
      ['marcus', 22, 'Harlem River Cardiology Group'], // at Harlem Health Center, part of Mount Sinai West
      ['alex', 17, 'Hudson Heart Institute'],
      ['priya', 15, 'Harlem River Cardiology Group'],
      ['maya', 11, 'Hudson Heart Institute'],
    ]);
    expect(topReferrersOut('msh').map((r) => r.hcp.id)).toEqual(['alex', 'maya']);
    // Only doctors who send someone out are listed.
    expect(topReferrersOut('kidney')).toEqual([]);
  });

  test('territory-wide, Ask names the same doctor', () => {
    const [top] = topReferrersOut();
    expect(top.hcp.id).toBe('marcus');
    expect(answer('Who sends the most patients out?', ctx).rows[0]).toMatchObject({ id: top.hcp.id, figure: String(top.count) });
  });
});

describe('tags in plain words', () => {
  const all = allEntities().flatMap((e) => signalsFor(e, ws, today).map((s) => ({ e, s })));

  test('no tag uses jargon, and the Targets filters use the same words', () => {
    expect(all.length).toBeGreaterThan(0);
    for (const { s } of all) expect(s.label).not.toMatch(/leakage|volume|out of system/i);
    for (const f of SIGNAL_FILTERS) expect(f.label).not.toMatch(/leakage|volume/i);
    const labels = new Set(all.map(({ s }) => s.label));
    expect(labels).toContain(SIGNAL_FILTERS.find((f) => f.id === 'leakage')!.label);
    expect(labels).toContain(SIGNAL_FILTERS.find((f) => f.id === 'rising')!.label);
  });

  test('every tag has a one-sentence meaning for this person or account', () => {
    for (const { e, s } of all) {
      const meaning = signalMeaning(s, e);
      expect(meaning).toMatch(/^[A-Z0-9].*\.$/);
      expect(meaning.split('. ').length).toBe(1);
      expect(meaning).not.toMatch(/undefined|NaN|leakage/);
    }
    const leak = (id: string) => signalMeaning(signalsFor(entity(id), ws, today).find((s) => s.id === 'leakage')!, entity(id));
    expect(leak('msw')).toBe('26% of patients here go to centres outside Mount Sinai Health System.');
    expect(leak('alex')).toBe('They send some patients to centres outside Mount Sinai Health System.');
  });

  test('a doctor’s headline figure says where patients went, not "out of system"', () => {
    const [, sent] = briefFigures(entity('alex'), ctx);
    expect(sent).toMatchObject({ label: 'Sent outside the system', value: '17', sub: 'of 20 they referred on' });
  });

  test('Ask says "same health system" and "outside the system", not "in system" and "out of system"', () => {
    const subs = ['Who does Dr. Morgan refer to?', 'Where do patients at Mount Sinai West go?'].flatMap((q) => answer(q, ctx).rows.map((r) => r.sub ?? ''));
    expect(subs.some((s) => s.startsWith('Same health system'))).toBe(true);
    expect(subs.some((s) => /outside the system/i.test(s))).toBe(true);
    for (const s of subs) expect(s).not.toMatch(/\b(in|out of) system\b/i);
  });

  test('Ask says "Not in" for a visit that didn’t happen, never "Attempted"', () => {
    const history = answer('What happened last time with Dr. Raman?', ctx);
    expect(history.summary).toMatch(/: in-person visit, not in\./);
    expect(history.rows.map((r) => r.title)).toContain('In-person visit · Not in');
    const brief = answer('Brief me on Dr. Priya Raman', ctx);
    expect(brief.rows.some((r) => (r.sub ?? '').startsWith('In-person visit · Not in'))).toBe(true);
    for (const a of [history, brief]) expect(JSON.stringify(a)).not.toMatch(/Attempted/);
  });
});
