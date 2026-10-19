// Which reminders the day needs, and that a change to the plan cancels and
// schedules only what changed. The phone is a fake: expo-notifications is mocked.

import { beforeEach, expect, jest, test } from '@jest/globals';
import * as Notifications from 'expo-notifications';

import { reminderChanges, reminderHref, remindersFor, signature, syncReminders } from '@/lib/reminders';
import type { PlanItem, Workspace } from '@/lib/types';
import { buildContext, cancelVisit, freshWorkspace, setVisitTime, visitDone } from '@/lib/workspace';

jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' },
  getAllScheduledNotificationsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
}));

const today = new Date(2026, 9, 20);
const day = '2026-10-20';
const at = (h: number, m: number) => new Date(2026, 9, 20, h, m);
const fresh = () => freshWorkspace(today);
const remindersAt = (ws: Workspace, h: number, m: number) => remindersFor(buildContext(ws, today), at(h, m));
/** Changes one of today's visits. */
const change = (ws: Workspace, id: string, patch: Partial<PlanItem>): Workspace => ({
  ...ws,
  plans: { ...ws.plans, [day]: ws.plans[day].map((i) => (i.id === id ? { ...i, ...patch } : i)) },
});

// A fake phone: what's scheduled on it, by id.
type Request = { identifier: string; content: { title: string; body: string; data: Record<string, unknown> }; trigger: { date: number } };
const phone = new Map<string, Request>();
const mocked = jest.mocked(Notifications);

beforeEach(() => {
  phone.clear();
  jest.clearAllMocks();
  mocked.getAllScheduledNotificationsAsync.mockImplementation(async () => [...phone.values()] as never);
  mocked.scheduleNotificationAsync.mockImplementation(async (request) => {
    phone.set(request.identifier!, request as never);
    return request.identifier!;
  });
  mocked.cancelScheduledNotificationAsync.mockImplementation(async (id) => {
    phone.delete(id);
  });
});

test('a heads-up 15 minutes before each timed visit, with a line from its prep, and the visits not logged at 17:30', () => {
  const reminders = remindersAt(fresh(), 8, 0);
  expect(reminders.map((r) => [r.title, new Date(r.at)])).toEqual([
    ['Dr. Maya Patel at 10:00', at(9, 45)],
    ['Dr. Jordan Lee at 14:00', at(13, 45)],
    ['2 visits not logged yet', at(17, 30)],
  ]);
  // The visit's goal, and a tap opens their visit page in Today.
  expect(reminders[0]).toMatchObject({ body: 'Bring the procedure mix vs. peers report.', href: '/today/target/maya' });
  // The "Any time" call has no time to remind about.
  expect(reminders.some((r) => r.title.includes('Morgan'))).toBe(false);
  expect(reminders[2]).toMatchObject({ body: 'Tap to log Dr. Patel and Dr. Lee.', href: '/today' });
});

test('times that have gone are left out', () => {
  expect(remindersAt(fresh(), 12, 0).map((r) => r.title)).toEqual(['Dr. Jordan Lee at 14:00', '2 visits not logged yet']);
  // Within 15 minutes of a visit it's too late for its heads-up.
  expect(remindersAt(fresh(), 13, 50).map((r) => r.title)).toEqual(['2 visits not logged yet']);
  expect(remindersAt(fresh(), 17, 31)).toEqual([]);
});

test('a logged or cancelled visit gets no heads-up and drops out of the 17:30 count', () => {
  const logged = visitDone(fresh(), day, 'v-maya');
  expect(remindersAt(logged, 8, 0).map((r) => [r.title, r.body])).toEqual([
    ['Dr. Jordan Lee at 14:00', 'Confirm a date for the fellows lunch-and-learn.'],
    ['1 visit not logged yet', 'Tap to log Dr. Lee.'],
  ]);
  const cancelled = cancelVisit(logged, day, 'v-jordan', 'Clinic closed', day, at(8, 0));
  expect(remindersAt(cancelled, 8, 0)).toEqual([]);
});

test('a call given a time says so, and with no goal the body is what was promised', () => {
  const timed = change(setVisitTime(fresh(), day, 'v-alex', '15:00'), 'v-alex', { goal: '' });
  const reminders = remindersAt(timed, 8, 0);
  expect(reminders.find((r) => r.href === '/today/target/alex')).toMatchObject({
    title: 'Dr. Alex Morgan at 15:00 · Phone call',
    body: 'You promised: Call about ablation referrals leaving the system',
    at: at(14, 45).getTime(),
  });
  expect(reminders[reminders.length - 1]).toMatchObject({ title: '3 visits not logged yet', body: 'Tap to log Dr. Patel, Dr. Lee and Dr. Morgan.' });
  // A visit that ends after 17:30 hasn't passed by then.
  const late = change(fresh(), 'v-jordan', { time: '17:15' });
  expect(remindersAt(late, 8, 0).map((r) => r.title)).toEqual(['Dr. Maya Patel at 10:00', 'Dr. Jordan Lee at 17:15', '1 visit not logged yet']);
});

test('reminderChanges replaces only what changed and leaves other apps’ notifications alone', () => {
  const before = remindersAt(fresh(), 8, 0);
  const scheduled = [...before.map((r) => ({ id: r.id, sig: signature(r) })), { id: 'someone-else', sig: '' }];
  expect(reminderChanges(scheduled, before)).toEqual({ cancel: [], schedule: [] });
  const moved = remindersAt(change(fresh(), 'v-jordan', { time: '15:00' }), 8, 0);
  const { cancel, schedule } = reminderChanges(scheduled, moved);
  // Jordan's heads-up moves; the 17:30 count is the same, and Maya's is untouched.
  expect(cancel).toEqual(['fieldpro-visit-v-jordan']);
  expect(schedule.map((r) => [r.title, new Date(r.at)])).toEqual([['Dr. Jordan Lee at 15:00', at(14, 45)]]);
});

test('syncReminders keeps the phone in step as visits are added, moved, logged and cancelled', async () => {
  phone.set('someone-else', { identifier: 'someone-else', content: { title: 'Not ours', body: '', data: {} }, trigger: { date: 0 } });
  const titles = () => [...phone.values()].map((r) => r.content.title).sort();

  let ws = fresh();
  await syncReminders(remindersAt(ws, 8, 0));
  expect(titles()).toEqual(['2 visits not logged yet', 'Dr. Jordan Lee at 14:00', 'Dr. Maya Patel at 10:00', 'Not ours']);
  expect(phone.get('fieldpro-visit-v-maya')).toMatchObject({ content: { data: { href: '/today/target/maya' } }, trigger: { type: 'date', date: at(9, 45).getTime(), channelId: 'visits' } });

  // Nothing changed: nothing is cancelled or scheduled again.
  jest.clearAllMocks();
  await syncReminders(remindersAt(ws, 8, 0));
  expect(mocked.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();

  // Added: the call gets a time.
  ws = setVisitTime(ws, day, 'v-alex', '15:00');
  jest.clearAllMocks();
  await syncReminders(remindersAt(ws, 8, 0));
  expect(mocked.cancelScheduledNotificationAsync.mock.calls.map(([id]) => id)).toEqual(['fieldpro-not-logged']);
  expect(mocked.scheduleNotificationAsync.mock.calls.map(([r]) => r.content.title)).toEqual(['Dr. Alex Morgan at 15:00 · Phone call', '3 visits not logged yet']);

  // Moved: only that visit's heads-up is replaced.
  ws = change(ws, 'v-jordan', { time: '14:30' });
  jest.clearAllMocks();
  await syncReminders(remindersAt(ws, 8, 0));
  expect(mocked.cancelScheduledNotificationAsync.mock.calls.map(([id]) => id)).toEqual(['fieldpro-visit-v-jordan']);
  expect(phone.get('fieldpro-visit-v-jordan')).toMatchObject({ content: { title: 'Dr. Jordan Lee at 14:30' }, trigger: { date: at(14, 15).getTime() } });

  // Logged and cancelled: their heads-ups go, and so does the 17:30 reminder once nothing is left to log.
  ws = cancelVisit(visitDone(visitDone(ws, day, 'v-maya'), day, 'v-alex'), day, 'v-jordan', 'Clinic closed', day, at(8, 0));
  await syncReminders(remindersAt(ws, 8, 0));
  expect(titles()).toEqual(['Not ours']);
});

test('a tap goes where the reminder says, and other notifications are ignored', () => {
  const response = (identifier: string, href: unknown) => ({ notification: { request: { identifier, content: { data: { href } } } } }) as never;
  expect(reminderHref(response('fieldpro-visit-v-maya', '/today/target/maya'))).toBe('/today/target/maya');
  expect(reminderHref(response('fieldpro-not-logged', '/today'))).toBe('/today');
  expect(reminderHref(response('someone-else', '/today'))).toBeNull();
  expect(reminderHref(null)).toBeNull();
});
