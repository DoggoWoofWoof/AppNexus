// Booking a time (the sheet in components/time-sheet.tsx). Ask offers it.
// "Change visit" on the person's page (screens/target.tsx) and Today's ⋯ asks
// what to change, like tapping an event in a phone's calendar: a visit with a time
// can have its time changed or be cancelled; an "Any time" stop can be given a
// time, moved to the next working day they can be seen (and are in, for a visit in
// person) or taken off the day. Either can be made a
// phone call or a visit in person, and take longer or shorter. Cancelling,
// or logging "Not in" today, then offers the three best people to see instead
// (`standIns` in lib/workspace.ts), and after "Not in" the next time to try them
// again. "See everyone" opens Targets for the rest, with the same filters on. A
// call with no answer offers a call on the next working day instead.

import { router } from 'expo-router';
import { CalendarArrowUp, CalendarClock, CalendarX, Clock, Phone, Trash2, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';

import { Avatar } from '@/components/entity';
import { Choices, SheetBody, SheetContent } from '@/components/note-sheet';
import { TimeForm } from '@/components/time-sheet';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { getEntity, getOrg, shortName, siteFor } from '@/lib/data';
import { siteOnDay } from '@/lib/booking';
import { outcomeWord } from '@/lib/brief';
import { formatDate, formatKm, fromIso, relativeDay } from '@/lib/format';
import { endTime, isOnSite } from '@/lib/plan';
import { useWorkspace } from '@/lib/store';
import type { Entity, PlanItem, VisitType } from '@/lib/types';
import type { Gap, StandIn } from '@/lib/workspace';

type Ref = { day: string; id: string };
type Visit = Ref & { item: PlanItem };
type Open =
  | { kind: 'book'; targetId: string }
  | { kind: 'change' | 'move' | 'set'; targetId: string; from: Visit }
  /** Someone to see instead; `notIn` when they weren't in, so trying again comes first, and `call` when it was a call nobody answered. */
  | { kind: 'fill'; targetId: string; gap: Gap; notIn?: boolean; call?: boolean };

/** Booking a time, changing a visit and who to see instead. Render `sheets` once on the screen that opens them. */
export function useVisitSheets() {
  const ctx = useWorkspace();
  const [open, setOpen] = useState<Open | null>(null);
  const target = open ? getEntity(open.targetId) : null;
  const close = () => setOpen(null);
  // The time it leaves, if it's still to come, can go to someone else; so can the day, for an "Any time" visit.
  const cancel = (from: Visit) => {
    const freed = ctx.cancelVisit(from.day, from.id, 'Can’t make it');
    const { item } = from;
    setOpen({
      kind: 'fill',
      targetId: item.targetId,
      gap: { day: from.day, siteId: item.siteId, time: freed ? item.time : null, duration: item.duration, except: item.targetId, slotId: freed ? from.id : undefined },
    });
  };
  return {
    /** Book a time with someone. */
    openBook: (entity: Entity) => setOpen({ kind: 'book', targetId: entity.id }),
    /** Change a planned visit: its time or day, or cancel or remove it. */
    openChange: (entity: Entity, from: Visit) => setOpen({ kind: 'change', targetId: entity.id, from }),
    /** Give an "Any time" stop a time, such as from Targets. */
    openSetTime: (entity: Entity, from: Visit) => setOpen({ kind: 'set', targetId: entity.id, from }),
    /** Who could go in a free time, such as from Today's "14:00 is free". */
    openFill: (gap: Gap) => setOpen({ kind: 'fill', targetId: gap.except, gap }),
    /** After "Not in" today: try them again, or see someone close by instead. After "No answer", call again. */
    openNotIn: (entity: Entity, visit: Ref) => {
      const item = (ctx.ws.plans[visit.day] ?? []).find((i) => i.id === visit.id);
      if (!item || visit.day !== ctx.todayIso) return;
      setOpen({
        kind: 'fill',
        targetId: entity.id,
        notIn: true,
        call: !isOnSite(item),
        gap: { day: visit.day, siteId: item.siteId, time: null, duration: item.duration, except: entity.id },
      });
    },
    sheets: (
      <Dialog open={!!target} onOpenChange={(o) => !o && close()}>
        {target && open?.kind === 'change' ? (
          <ChangeVisit
            target={target}
            from={open.from}
            // With the visit as it is now, as how long it takes may have changed in the sheet.
            onTime={(item) => setOpen({ ...open, kind: isBooked(item) ? 'move' : 'set', from: { ...open.from, item } })}
            onCancelVisit={(item) => cancel({ ...open.from, item })}
            onClose={close}
          />
        ) : target && open?.kind === 'fill' ? (
          open.call ? (
            <CallAgain target={target} day={open.gap.day} onClose={close} />
          ) : (
            <FillGap target={target} gap={open.gap} notIn={!!open.notIn} onBook={() => setOpen({ kind: 'book', targetId: target.id })} onClose={close} />
          )
        ) : target && open ? (
          <TimeForm
            target={target}
            mode={open.kind === 'move' ? { kind: 'move', from: open.from } : open.kind === 'set' ? { kind: 'set', day: open.from.day, item: open.from.item } : { kind: 'book' }}
            onCancel={close}
            onSaved={(message) => {
              close();
              AccessibilityInfo.announceForAccessibility(message);
            }}
          />
        ) : null}
      </Dialog>
    ),
  };
}

/** A visit booked with them, so someone is expecting the rep, rather than a time the rep set themselves. */
const isBooked = (item: PlanItem): boolean => item.mode === 'timed' && !!item.booking;

/**
 * What to change about a visit, as a short list like a phone's action sheet. A
 * booked visit has someone expecting the rep: its time changes (keeping its goal)
 * or it's cancelled, which frees the time. An "Any time" stop, or one the rep gave
 * a time themselves, gets a (new) time, goes to the next working day they can be
 * seen, or comes off the day, with Undo. In person on a day they aren't in, the
 * day they are in comes first. Either can be a visit in person or a phone call, and take 15
 * to 60 minutes; those change straight away, with Undo, and the sheet stays open.
 */
function ChangeVisit({
  target,
  from,
  onTime,
  onCancelVisit,
  onClose,
}: {
  target: Entity;
  from: Visit;
  onTime: (item: PlanItem) => void;
  onCancelVisit: (item: PlanItem) => void;
  onClose: () => void;
}) {
  const ctx = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  // The visit as it is now, as how and how long change it while the sheet is open.
  const item = (ctx.ws.plans[from.day] ?? []).find((i) => i.id === from.id) ?? from.item;
  const timed = item.mode === 'timed';
  const booked = isBooked(item);
  // An account's in-person visit is a meeting.
  const inPerson: VisitType = target.kind === 'hco' ? 'Meeting' : 'In-person visit';
  const how: VisitType = isOnSite(item) ? inPerson : 'Phone call';
  const lengths = [...new Set([15, 30, 45, 60, item.duration])].sort((a, b) => a - b);
  const nextDay = booked ? null : ctx.moveDayFor(item, from.day);
  // In person, they need to be in: said when that's why it isn't simply the next working day.
  const inOn = (d: string) => !isOnSite(item) || !!siteOnDay(target, fromIso(d).getDay());
  const notIn = !inOn(from.day);
  const whenIn = !!nextDay && (notIn || ctx.bookingDays.some((d) => d > from.day && d < nextDay && !inOn(d)));
  const whenInWords = target.kind === 'hco' ? 'when it’s open' : 'when they’re in';
  const toNextDay = () => {
    if (!nextDay) return;
    const problem = ctx.moveToDay(from.day, from.id, nextDay);
    if (problem) {
      setError(problem);
      AccessibilityInfo.announceForAccessibility(problem);
    } else onClose();
  };
  const remove = () => {
    ctx.removeStop(from.day, from.id);
    onClose();
  };
  return (
    <SheetContent title="Change visit" target={target} sub={`${target.name} · ${visitLine(item, from.day, ctx.today)}`}>
      <SheetBody>
        <View className="gap-2">
          {notIn && nextDay ? <Action icon={CalendarArrowUp} label={`Move to ${ctx.dayWord(nextDay)}, ${whenInWords}`} onPress={toNextDay} /> : null}
          <Action icon={timed ? CalendarClock : Clock} label={timed ? 'Change the time' : 'Set a time'} onPress={() => onTime(item)} />
          {!notIn && nextDay ? (
            <Action icon={CalendarArrowUp} label={`Move to ${ctx.dayWord(nextDay)}${whenIn ? `, ${whenInWords}` : ''}`} onPress={toNextDay} />
          ) : null}
          {error ? (
            <Text className="text-sm text-danger" accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
        </View>
        <Choices
          label="How"
          options={[
            { value: inPerson, label: 'In person' },
            { value: 'Phone call', label: 'Phone call' },
          ]}
          value={how}
          onChange={(type) => type !== how && ctx.changeStop(from.day, from.id, { type })}
        />
        <Choices
          label="How long"
          options={lengths.map((m) => ({ value: String(m), label: `${m} min` }))}
          value={String(item.duration)}
          onChange={(m) => Number(m) !== item.duration && ctx.changeStop(from.day, from.id, { duration: Number(m) })}
        />
        {booked ? (
          <Action icon={CalendarX} label="Cancel the visit" danger onPress={() => onCancelVisit(item)} />
        ) : (
          <Action icon={Trash2} label={`Remove from ${ctx.dayWord(from.day)}`} danger onPress={remove} />
        )}
        <Button variant="ghost" className="-mt-2" onPress={onClose}>
          <Text className="text-muted-foreground">Done</Text>
        </Button>
      </SheetBody>
    </SheetContent>
  );
}

/** One choice in the Change visit sheet: a full-width button with an icon. */
function Action({ icon, label, danger = false, onPress }: { icon: LucideIcon; label: string; danger?: boolean; onPress: () => void }) {
  return (
    <Button size="lg" variant="outline" className="justify-start rounded-xl" onPress={onPress}>
      <Icon as={icon} size={20} className={danger ? 'text-danger' : 'text-brand'} />
      <Text className={danger ? 'text-lg text-danger' : 'text-lg'}>{label}</Text>
    </Button>
  );
}

/**
 * Who to see instead, after a cancel or "Not in": the three best fits, close by and
 * free then, each one tap to add. After "Not in", the next time to try them again
 * comes first. "See everyone" opens Targets, nearest first.
 */
function FillGap({ target, gap, notIn, onBook, onClose }: { target: Entity; gap: Gap; notIn: boolean; onBook: () => void; onClose: () => void }) {
  const ctx = useWorkspace();
  const [now] = useState(() => new Date());
  const standIns = ctx.standIns(gap, now);
  const retry = notIn ? (ctx.slotsFor(target, null, now)[0] ?? null) : null;
  const site = getOrg(gap.siteId)?.name ?? 'the visit';
  const day = ctx.dayWord(gap.day);
  const add = (s: StandIn) => {
    if (gap.time && gap.slotId) ctx.fillSlot(gap.slotId, s.entity.id);
    else ctx.addToPlan(s.entity.id, gap.day);
    onClose();
  };
  const tryAgain = () => {
    if (!retry) return;
    if (ctx.book({ targetId: target.id, slot: retry, confirmed: false })) onBook();
    else onClose();
  };
  // Targets with the same filters this sheet goes by, so the list is the rest of these.
  const seeEveryone = () => {
    if (gap.slotId) ctx.chooseSlot(gap.slotId);
    else ctx.selectDay(gap.day);
    onClose();
    router.navigate({ pathname: '/targets', params: { near: gap.siteId, except: gap.except, at: String(Date.now()) } });
  };
  const account = target.kind === 'hco';
  const title = notIn ? `${outcomeWord('Attempted', account ? 'Meeting' : 'In-person visit')} today` : gap.time ? `${gap.time} is free` : `See someone else ${day}?`;
  const moved = ctx.ws.freeSlots.some((s) => s.itemId === gap.slotId && s.moved);
  const missed = account ? `The meeting at ${target.name} didn’t happen.` : `${shortName(target)} wasn’t in.`;
  const sub = notIn ? `${missed} Try again, or see someone close by.` : `The ${account ? 'meeting at' : 'visit with'} ${shortName(target)} ${moved ? 'moved' : 'is cancelled'}.`;

  return (
    <SheetContent title={title} target={target} sub={sub}>
      <SheetBody>
        {notIn ? (
          <View className="gap-2">
            <Text className="text-sm font-medium">{`Try ${shortName(target)} again`}</Text>
            {retry ? (
              <Button size="lg" className="rounded-xl" onPress={tryAgain} accessibilityLabel={`Ask for ${formatDate(retry.day)} at ${retry.time}`}>
                <Icon as={CalendarClock} size={20} className="text-primary-foreground" />
                <Text className="text-lg">{`${relativeDay(retry.day, ctx.today)} · ${retry.time}`}</Text>
              </Button>
            ) : null}
            <Button variant="outline" className="rounded-xl" onPress={onBook}>
              <Text>{retry ? 'Another time' : 'Choose a time'}</Text>
            </Button>
          </View>
        ) : null}

        <View className="gap-2">
          <Text className="text-sm font-medium">{gap.time ? `Free at ${gap.time}, close to ${site}` : `In ${day}, close to ${site}`}</Text>
          {standIns.length ? (
            standIns.map((s) => (
              <View key={s.entity.id} className="min-h-16 flex-row items-center gap-3 rounded-xl border border-border bg-card py-2 pl-3 pr-2">
                <Avatar entity={s.entity} />
                <View className="flex-1 gap-0.5">
                  <Text className="text-base font-semibold">{shortName(s.entity)}</Text>
                  <Text className="text-sm text-muted-foreground">{[formatKm(s.km), s.hours && `in ${s.hours}`].filter(Boolean).join(' · ')}</Text>
                  {s.why ? <Text className="text-sm text-brand">{s.why}</Text> : null}
                </View>
                <Button
                  size="sm"
                  className="rounded-lg"
                  onPress={() => add(s)}
                  accessibilityLabel={gap.time ? `Add ${s.entity.name} at ${gap.time}` : `Add ${s.entity.name} to ${day}`}
                >
                  <Text>{gap.time ? `+ ${gap.time}` : '+ Add'}</Text>
                </Button>
              </View>
            ))
          ) : (
            <Text className="text-muted-foreground">{gap.time ? 'Nobody close by is usually free then.' : `Nobody close by has time left ${day}.`}</Text>
          )}
        </View>

        <View className="flex-row gap-2">
          <Button variant="outline" className="flex-1 rounded-xl" onPress={seeEveryone}>
            <Text>See everyone</Text>
          </Button>
          <Button
            variant="ghost"
            className="flex-1 rounded-xl"
            onPress={() => {
              if (gap.time && gap.slotId) ctx.leaveFree(gap.slotId);
              onClose();
            }}
          >
            <Text className="text-muted-foreground">{gap.time ? 'Leave it free' : 'Not now'}</Text>
          </Button>
        </View>
      </SheetBody>
    </SheetContent>
  );
}

/**
 * After a call nobody answered: call again on the next working day, as a call at
 * any time. Nobody close by is offered, as a call isn't anywhere.
 */
function CallAgain({ target, day, onClose }: { target: Entity; day: string; onClose: () => void }) {
  const ctx = useWorkspace();
  const next = ctx.bookingDays.find((d) => d > day);
  const planned = next ? (ctx.ws.plans[next] ?? []).some((i) => i.targetId === target.id && i.status !== 'cancelled') : false;
  const callAgain = () => {
    if (next) ctx.addToPlan(target.id, next, 'Phone call');
    onClose();
  };

  return (
    <SheetContent title="No answer" target={target} sub={`${shortName(target)} didn’t answer.`}>
      <SheetBody>
        {next && planned ? (
          <Text className="text-muted-foreground">{`${shortName(target)} is in your plan ${ctx.dayWord(next)} already.`}</Text>
        ) : next ? (
          <Button size="lg" className="rounded-xl" onPress={callAgain} accessibilityLabel={`Add a call to ${target.name} ${ctx.dayWord(next)}`}>
            <Icon as={Phone} size={20} className="text-primary-foreground" />
            <Text className="text-lg">{`Call again ${ctx.dayWord(next)}`}</Text>
          </Button>
        ) : null}
        <Button variant="ghost" className="rounded-xl" onPress={onClose}>
          <Text className="text-muted-foreground">Not now</Text>
        </Button>
      </SheetBody>
    </SheetContent>
  );
}

const visitLine = (item: PlanItem, day: string, today: Date): string => {
  const target = getEntity(item.targetId);
  const when = item.mode === 'timed' && item.time ? `${item.time}–${endTime(item)}` : 'Any time';
  return [relativeDay(day, today), when, !isOnSite(item) ? item.type : target ? siteFor(target, item.siteId).name : ''].filter(Boolean).join(' · ');
};
