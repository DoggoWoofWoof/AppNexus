// Reminders on the phone: a heads-up 15 minutes before each visit today that has
// a fixed time, and at 17:30 a nudge for visits that have passed and aren't logged.
// remindersFor and reminderChanges decide what should be scheduled, with no phone
// calls, so they can be tested; syncReminders brings the phone in step. Only the
// phone imports this (components/reminders.native.tsx); the web build has none.

import * as Notifications from 'expo-notifications';

import { buildBrief } from './brief';
import { getEntity, shortName } from './data';
import { fromIso, plural, toMinutes } from './format';
import { isOnSite } from './plan';
import type { PlanItem } from './types';
import type { Context } from './workspace';

export const HEADS_UP_MINUTES = 15;
export const END_OF_DAY = '17:30';
/** Android shows reminders in this channel; iOS ignores it. */
export const CHANNEL = 'visits';

// Every reminder the app schedules starts with this, so it never touches anyone else's.
const PREFIX = 'fieldpro-';
const UNLOGGED_ID = `${PREFIX}not-logged`;

export interface Reminder {
  /** One per visit, and one for the end of the day, so a change replaces the old reminder. */
  id: string;
  /** When it shows, in milliseconds. */
  at: number;
  title: string;
  body: string;
  /** Where a tap goes: the visit's page, or Today. */
  href: string;
}

/** A reminder already on the phone: its id and what it said when it was scheduled. */
export interface Scheduled {
  id: string;
  sig: string;
}

/** Everything a reminder shows, so any change to it reschedules it. */
export const signature = (r: Reminder): string => [r.at, r.title, r.body, r.href].join('|');

export const isHeadsUp = (r: Reminder): boolean => r.id !== UNLOGGED_ID;

/** A time on a day, in milliseconds. */
function at(day: string, minutes: number): number {
  const d = fromIso(day);
  d.setHours(0, minutes);
  return d.getTime();
}

/** One plain line from the visit's prep: the goal, or what was promised when the goal is a follow-up. */
export function prepLine(targetId: string, ctx: Context): string {
  const who = getEntity(targetId);
  if (!who) return '';
  const brief = buildBrief(who, ctx);
  return brief.goalDue ? `You promised: ${brief.goal}` : brief.goal;
}

/** "Dr. Patel", "Dr. Patel and Dr. Lee", "Dr. Patel, Dr. Lee and Mount Sinai West". */
function names(items: PlanItem[]): string {
  const all = items.map((i) => getEntity(i.targetId)).flatMap((e) => (e ? [shortName(e)] : []));
  return all.length > 1 ? `${all.slice(0, -1).join(', ')} and ${all[all.length - 1]}` : (all[0] ?? '');
}

/** The reminders today's plan needs from now on. Times that have gone are left out. */
export function remindersFor(ctx: Context, now: Date): Reminder[] {
  const day = ctx.todayIso;
  const later = (time: number) => time > now.getTime();
  // Today flags the same visits as "Not logged yet": a fixed time and still only planned.
  const timed = ctx.dayPlan(day).filter((i) => i.status === 'planned' && i.mode === 'timed' && !!i.time);
  const out: Reminder[] = [];
  for (const item of timed) {
    const who = getEntity(item.targetId);
    const time = at(day, toMinutes(item.time!) - HEADS_UP_MINUTES);
    if (!who || !later(time)) continue;
    out.push({
      id: `${PREFIX}visit-${item.id}`,
      at: time,
      title: `${who.name} at ${item.time}${isOnSite(item) ? '' : ` · ${item.type}`}`,
      body: prepLine(who.id, ctx),
      href: `/today/target/${who.id}`,
    });
  }
  // Visits over by 17:30 that aren't logged now; logging one before then reschedules this.
  const endOfDay = at(day, toMinutes(END_OF_DAY));
  const unlogged = timed.filter((i) => toMinutes(i.time!) + i.duration <= toMinutes(END_OF_DAY));
  if (unlogged.length && later(endOfDay)) {
    out.push({ id: UNLOGGED_ID, at: endOfDay, title: `${plural(unlogged.length, 'visit')} not logged yet`, body: `Tap to log ${names(unlogged)}.`, href: '/today' });
  }
  return out;
}

/** What to cancel and what to schedule so the phone has the wanted reminders. Reminders that haven't changed are left alone. */
export function reminderChanges(scheduled: Scheduled[], wanted: Reminder[]): { cancel: string[]; schedule: Reminder[] } {
  const ours = scheduled.filter((s) => s.id.startsWith(PREFIX));
  const want = new Map(wanted.map((r) => [r.id, signature(r)]));
  const kept = new Set(ours.filter((s) => want.get(s.id) === s.sig).map((s) => s.id));
  return {
    cancel: ours.filter((s) => !kept.has(s.id)).map((s) => s.id),
    schedule: wanted.filter((r) => !kept.has(r.id)),
  };
}

/** Cancels and schedules what changed. The phone must already allow notifications. */
export async function syncReminders(wanted: Reminder[]): Promise<void> {
  const requests = await Notifications.getAllScheduledNotificationsAsync();
  const scheduled = requests.map((r) => ({ id: r.identifier, sig: String(r.content.data?.sig ?? '') }));
  const { cancel, schedule } = reminderChanges(scheduled, wanted);
  await Promise.all(cancel.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
  for (const r of schedule) {
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body, data: { href: r.href, sig: signature(r) } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: CHANNEL },
    });
  }
}

/** Where a tapped reminder goes, or null when it isn't one of the app's. */
export function reminderHref(response: Notifications.NotificationResponse | null): string | null {
  const request = response?.notification.request;
  const href = request?.content.data?.href;
  return request?.identifier.startsWith(PREFIX) && typeof href === 'string' ? href : null;
}
