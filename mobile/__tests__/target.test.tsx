// What someone's page adds under the brief (lib/target.ts): what was asked about
// them before, visits so far, what was promised, who they refer to, similar
// doctors nearby and how to get in. The sample day is Tuesday 20 October 2026.

import { describe, expect, test } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { answer } from '@/lib/ask';
import { siteOnDay } from '@/lib/booking';
import { ChatProvider, NO_CHATS, TERRITORY, useChat, type ConversationItem, type Turn } from '@/lib/chat';
import { getEntity, getOrg } from '@/lib/data';
import { addDays, isoDate, startOfDay, sum } from '@/lib/format';
import { CHATS_KEY, type DeviceStorage } from '@/lib/persist';
import type { Asked } from '@/lib/saved';
import { WorkspaceProvider } from '@/lib/store';
import { askedBefore, howToGetIn, NEARBY_KM, promiseDue, similarNearby, siteThatDay, visitsSoFar, whoTheyReferTo } from '@/lib/target';
import type { FollowUp, Hcp, Interaction, Org, PlanItem, Workspace } from '@/lib/types';
import { buildContext, freshWorkspace } from '@/lib/workspace';

const today = startOfDay(new Date(2026, 9, 20));
const todayIso = isoDate(today);
const ws = freshWorkspace(today);
const ctx = buildContext(ws, today);
const day = (offset: number) => isoDate(addDays(today, offset));
const hcp = (id: string) => getEntity(id) as Hcp;
const org = (id: string) => getOrg(id) as Org;
const at = (date: number, h: number, m = 0) => new Date(2026, 9, date, h, m).getTime();

describe('You asked before', () => {
  const asked = (question: string, when: number): Asked => ({ question, answer: `About ${question}`, at: when });
  const turn = (a: Asked): Turn => ({ id: `t-${a.at}`, question: a.question, via: 'typed', answer: null, at: a.at });
  const item = (id: string, key: string, live: boolean, turns: Asked[]): ConversationItem & { turns: Turn[] } => ({
    id,
    key,
    live,
    title: turns[0].question,
    questions: turns.length,
    at: turns[turns.length - 1].at,
    turns: turns.map(turn),
  });

  test('the last three, newest first, a question asked twice only once', () => {
    const qs = [asked('When is she free?', at(12, 9)), asked('Where does she refer?', at(19, 9)), asked('when is she free?', at(18, 9)), asked('Who does she work with?', at(14, 9)), asked('What does she do most?', at(10, 9))];
    const list = askedBefore('maya', qs, [], () => []);
    expect(list.map((a) => [a.question, a.at])).toEqual([
      ['Where does she refer?', at(19, 9)],
      ['when is she free?', at(18, 9)],
      ['Who does she work with?', at(14, 9)],
    ]);
    expect(askedBefore('maya', qs, [], () => [], 5)).toHaveLength(4);
    expect(askedBefore('maya', [], [], () => [])).toEqual([]);
  });

  test('each opens the conversation it was asked in', () => {
    const ended = asked('Where does she refer?', at(12, 9));
    const hers = asked('When is she free?', at(20, 8));
    const territory = asked('How busy is Dr. Patel?', at(20, 9));
    const conversations = [item('territory', TERRITORY, true, [territory]), item('maya', 'maya', true, [hers]), item('c-1', 'maya', false, [ended])];
    const list = askedBefore('maya', [ended, hers, territory], conversations, (c) => (c as (typeof conversations)[number]).turns);
    expect(list.map((a) => [a.question, a.where])).toEqual([
      ['How busy is Dr. Patel?', { kind: 'ask' }],
      ['When is she free?', { kind: 'chat' }],
      ['Where does she refer?', { kind: 'history', id: 'c-1' }],
    ]);
  });

  test('from the chats kept on the phone', async () => {
    const answered = (question: string, when: number): Turn => ({ id: `t-${when}`, question, via: 'typed', answer: answer(question, ctx), at: when });
    const territory = answered('Where does Dr. Patel send patients?', at(20, 9));
    expect(territory.answer?.subject).toBe('maya');
    const chats = {
      version: 1,
      ...NO_CHATS,
      threads: { [TERRITORY]: [territory], maya: [answered('When is Dr. Patel free?', at(20, 8))] },
      past: [{ id: 'c-old', key: 'maya', turns: [answered('Who does she work with?', at(14, 9))] }],
    };
    const items = new Map([[CHATS_KEY, JSON.stringify(chats)]]);
    const storage: DeviceStorage = { getItem: async (key) => items.get(key) ?? null, setItem: async (key, value) => void items.set(key, value) };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <WorkspaceProvider today={today}>
        <ChatProvider storage={storage}>{children}</ChatProvider>
      </WorkspaceProvider>
    );
    const { result } = await renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.conversations()).toHaveLength(3));
    const chat = result.current;
    const list = askedBefore('maya', chat.asked('maya'), chat.conversations(), (c) => (c.live ? chat.turns(c.key) : (chat.conversation(c.id)?.turns ?? [])));
    expect(list.map((a) => [a.question, a.where.kind])).toEqual([
      ['Where does Dr. Patel send patients?', 'ask'],
      ['When is Dr. Patel free?', 'chat'],
      ['Who does she work with?', 'history'],
    ]);
  });
});

describe('Visits so far', () => {
  test('Dr. Patel: every visit and call, the next one first, and the time that has worked', () => {
    const visits = visitsSoFar('maya', ws, today);
    expect(visits.summary).toBe('Tried 5 times, met 4 times.');
    expect(visits.worked).toBe('Tuesday mornings');
    expect(visits.rows.map((r) => [r.day, r.time, r.label])).toEqual([
      [todayIso, '10:00', 'Planned'],
      [day(-12), null, 'Met'],
      ['2026-09-29', '07:30', 'Met'],
      ['2026-09-24', '07:30', 'Not in'],
      ['2026-09-15', '07:45', 'Met'],
      [day(-41), null, 'Talked'],
    ]);
  });

  test('Dr. Raman: tried three times, met once, and one visit never logged', () => {
    const visits = visitsSoFar('priya', ws, today);
    expect(visits.summary).toBe('Tried 3 times, met once. 1 wasn’t logged.');
    expect(visits.rows[0]).toMatchObject({ day: day(-5), label: 'Not logged yet', outcome: 'not-logged' });
    // Two misses and one meeting is not enough to say a time has worked.
    expect(visits.worked).toBeNull();
  });

  test('cancelled and moved visits say so; a teammate’s notes and emails aren’t visits', () => {
    expect(visitsSoFar('elena', ws, today)).toMatchObject({ summary: 'Not met yet. 1 was cancelled.', rows: [{ label: 'Cancelled', outcome: 'cancelled' }] });
    const okafor = visitsSoFar('okafor', ws, today);
    // He was also at the structural heart team meeting the rep went to.
    expect(okafor.summary).toBe('Tried twice, met twice.');
    expect(okafor.rows.map((r) => [r.day, r.type, r.label, r.moved])).toEqual([
      [day(-4), 'In-person visit', 'Met', 'Moved from Thu 15 Oct'],
      [day(-20), 'Meeting', 'Met', null],
    ]);
    expect(visitsSoFar('alex', ws, today)).toMatchObject({ summary: 'Not met yet.', rows: [{ type: 'Phone call', label: 'Planned' }] });
    expect(visitsSoFar('hannah', ws, today).rows).toEqual([]);
  });

  test('calls are talked or no answer, and a visit that didn’t happen says so', () => {
    const base: PlanItem = { id: 'x', targetId: 'hannah', siteId: 'msh', mode: 'timed', time: '09:00', duration: 30, type: 'Phone call', goal: '', status: 'done', outcome: 'Met' };
    const note = (date: string, outcome: string, type = 'Phone call'): Interaction => ({ id: `n-${date}`, targetId: 'hannah', attendees: ['hannah'], date, type, outcome, author: 'You', note: '' });
    const plans: Workspace['plans'] = {
      [day(-1)]: [base],
      [day(-2)]: [{ ...base, id: 'y', outcome: 'Attempted' }],
      [day(-3)]: [{ ...base, id: 'z', type: 'In-person visit', status: 'cancelled', cancelReason: 'Didn’t happen' }],
      [day(-20)]: [{ ...base, id: 'w', time: '11:00', movedFrom: { day: day(-20), time: '09:30' } }],
    };
    const interactions = [note(day(-1), 'Met'), note(day(-9), 'Left message'), note(day(-10), 'Sent', 'Email'), note(day(-11), 'Met', 'In-person visit')];
    const visits = visitsSoFar('hannah', { plans, interactions }, today);
    expect(visits.rows.map((r) => [r.day, r.label, r.moved])).toEqual([
      [day(-1), 'Talked', null],
      [day(-2), 'No answer', null],
      [day(-3), 'Didn’t happen', null],
      [day(-9), 'Left a message', null],
      [day(-11), 'Met', null],
      [day(-20), 'Talked', 'Moved from 09:30'],
    ]);
    expect(visits.summary).toBe('Tried 5 times, met 3 times. 1 was cancelled.');
    expect(visits.worked).toBe('Mornings');
  });
});

describe('Promised', () => {
  const promise = (due: string): FollowUp => ({ id: 'f', targetId: 'maya', text: 'Send the report', due, done: false });
  test('says how late each is, or when it is due', () => {
    expect(promiseDue(promise(day(-2)), today)).toEqual({ text: '2 days late', tone: 'late' });
    expect(promiseDue(promise(day(-1)), today)).toEqual({ text: '1 day late', tone: 'late' });
    expect(promiseDue(promise(todayIso), today)).toEqual({ text: 'Due today', tone: 'today' });
    expect(promiseDue(promise(day(3)), today)).toEqual({ text: 'Due in 3 days', tone: 'later' });
    expect(promiseDue(promise(day(30)), today)).toEqual({ text: 'Due 19 Nov 2026', tone: 'later' });
  });
});

describe('Who they refer to', () => {
  test('by doctor or centre, most first, with how many left the system', () => {
    const maya = hcp('maya');
    const refer = whoTheyReferTo(maya)!;
    expect(refer.rows.map((r) => r.count)).toEqual([...refer.rows.map((r) => r.count)].sort((a, b) => b - a));
    expect(sum(refer.rows.map((r) => r.count))).toBe(sum(maya.referrals.outbound.map((r) => r.count)));
    const total = sum(refer.rows.map((r) => r.count));
    const outside = sum(refer.rows.filter((r) => r.outside).map((r) => r.count));
    expect(refer.summary).toBe(`${total} patients sent on in 12 months. ${outside ? `${outside} went outside the system.` : 'All stayed in the system.'}`);
    expect(refer.rows.filter((r) => r.outside).every((r) => r.entity === null)).toBe(true);
    expect(refer.rows.filter((r) => r.entity).every((r) => r.entity?.kind === 'hcp' && !r.outside)).toBe(true);
  });

  test('a doctor who sends no one on has no card', () => {
    expect(whoTheyReferTo({ ...hcp('maya'), referrals: { inbound: [], outbound: [] } })).toBeNull();
  });
});

describe('Similar doctors nearby', () => {
  test('like Dr. Patel, close to where she is, in that day and not already planned', () => {
    const similar = similarNearby(hcp('maya'), ws, todayIso);
    expect(similar.map((d) => d.hcp.id)).toEqual(['okafor', 'priya', 'marcus']);
    expect(similar[0]).toMatchObject({ why: 'Also does diagnostic cardiac cath and PCI', hours: '15:00–17:00', site: { id: 'msh' } });
    expect(similar[0].km).toBeLessThan(0.1);
    expect(similar[1].why).toBe('Also sees coronary artery disease');
    const planned = new Set(ws.plans[todayIso].map((i) => i.targetId));
    for (const d of similar) {
      expect(planned.has(d.hcp.id)).toBe(false);
      expect(d.km).toBeLessThanOrEqual(NEARBY_KM);
      expect(siteOnDay(d.hcp, today.getDay())).toBe(d.site.id);
    }
  });

  test('measures from where she is that day, leaves out the planned unless just added, and has none at the weekend', () => {
    expect(siteThatDay(hcp('maya'), ws, todayIso).id).toBe('msh');
    const okafor: PlanItem = { id: 'v-new', targetId: 'okafor', siteId: 'msh', mode: 'flexible', time: null, duration: 30, type: 'In-person visit', goal: '', status: 'planned' };
    const plans = { ...ws.plans, [todayIso]: [...ws.plans[todayIso], okafor] };
    expect(similarNearby(hcp('maya'), { plans }, todayIso).map((d) => d.hcp.id)).not.toContain('okafor');
    expect(similarNearby(hcp('maya'), { plans }, todayIso, { keep: ['okafor'] }).map((d) => d.hcp.id)).toContain('okafor');
    const saturday = isoDate(addDays(today, 4));
    expect(similarNearby(hcp('maya'), ws, saturday)).toEqual([]);
  });
});

describe('How to get in', () => {
  test('who books, how they like to be asked, when, and whether they confirm', () => {
    expect(howToGetIn(hcp('maya'))).toEqual({
      books: 'Rosa Diaz, scheduler',
      reach: 'Call Rosa a week ahead. She texts back to confirm.',
      best: 'Usually Tue/Thu 07:30–08:30',
      confirms: 'Usually confirms a booked time.',
    });
    expect(howToGetIn(hcp('jordan')).books).toBe('They book their own time, by email');
    expect(howToGetIn(hcp('priya'))).toMatchObject({ books: 'The front desk, on the office phone', confirms: 'Rarely confirms. Call that morning to check they’re in.' });
    expect(howToGetIn(org('harlem'))).toMatchObject({ books: 'Carmen Reyes, Practice Administrator', reach: 'Carmen Reyes keeps the diary. Call, don’t email.' });
  });

  test('without notes on them, it says only what the data knows', () => {
    const { access: _access, ...plain } = hcp('maya');
    expect(howToGetIn(plain as Hcp)).toMatchObject({ books: 'Rosa Diaz, scheduler', reach: null, confirms: null });
  });
});
