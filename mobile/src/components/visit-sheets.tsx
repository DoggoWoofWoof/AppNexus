// Book a time, after the prototype's book sheet (demo/js/sheets.js). Ask offers
// it. "Can't make it" on the person's page (screens/target.tsx) asks first: move
// the visit to another time (or, for an "Any time" one, to the next working day),
// or cancel it. Cancelling, or logging "Not in" today, then offers the three best
// people to see instead (`standIns` in lib/workspace.ts), and after "Not in" the
// next time to try them again. "See everyone" opens Targets for the rest.

import { router } from 'expo-router';
import { CalendarArrowUp, CalendarClock, CalendarX } from 'lucide-react-native';
import { useState } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';

import { Avatar } from '@/components/entity';
import { Choices, Field, Footer, SheetBody, SheetContent } from '@/components/note-sheet';
import { FinePrint } from '@/components/profile';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { bookingRoute, siteOnDay, type Slot } from '@/lib/booking';
import { getEntity, getOrg, shortName, siteFor } from '@/lib/data';
import { formatDate, formatKm, fromIso, relativeDay } from '@/lib/format';
import { endTime } from '@/lib/plan';
import { useWorkspace } from '@/lib/store';
import type { Entity, PlanItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import type { Gap, StandIn } from '@/lib/workspace';

type Ref = { day: string; id: string };
type Visit = Ref & { item: PlanItem };
type Open =
  | { kind: 'book'; targetId: string }
  | { kind: 'cant' | 'move'; targetId: string; from: Visit }
  /** Someone to see instead; `notIn` when they weren't in, so trying again comes first. */
  | { kind: 'fill'; targetId: string; gap: Gap; notIn?: boolean };

/** Booking a time, "Can't make it" and who to see instead. Render `sheets` once on the screen that opens them. */
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
    /** Move a planned visit or cancel it. */
    openCantMakeIt: (entity: Entity, from: Visit) => setOpen({ kind: 'cant', targetId: entity.id, from }),
    /** Who could go in a free time, such as from Today's "14:00 is free". */
    openFill: (gap: Gap) => setOpen({ kind: 'fill', targetId: gap.except, gap }),
    /** After "Not in" today: try them again, or see someone close by instead. */
    openNotIn: (entity: Entity, visit: Ref) => {
      const item = (ctx.ws.plans[visit.day] ?? []).find((i) => i.id === visit.id);
      if (!item || visit.day !== ctx.todayIso) return;
      setOpen({ kind: 'fill', targetId: entity.id, notIn: true, gap: { day: visit.day, siteId: item.siteId, time: null, duration: item.duration, except: entity.id } });
    },
    sheets: (
      <Dialog open={!!target} onOpenChange={(o) => !o && close()}>
        {target && open?.kind === 'cant' ? (
          <CantMakeIt target={target} from={open.from} onMove={() => setOpen({ ...open, kind: 'move' })} onCancelVisit={() => cancel(open.from)} onKeep={close} />
        ) : target && open?.kind === 'fill' ? (
          <FillGap target={target} gap={open.gap} notIn={!!open.notIn} onBook={() => setOpen({ kind: 'book', targetId: target.id })} onClose={close} />
        ) : target && open ? (
          <BookForm
            target={target}
            from={open.kind === 'move' ? open.from : null}
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

/**
 * Asks before anything changes: moving keeps the visit's goal, cancelling frees its
 * time. An "Any time" visit can go to the next working day in one tap.
 */
function CantMakeIt({ target, from, onMove, onCancelVisit, onKeep }: { target: Entity; from: Visit; onMove: () => void; onCancelVisit: () => void; onKeep: () => void }) {
  const ctx = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const nextDay = from.item.mode === 'timed' ? undefined : ctx.bookingDays.find((d) => d > from.day);
  const toNextDay = () => {
    if (!nextDay) return;
    const problem = ctx.moveToDay(from.day, from.id, nextDay);
    if (problem) {
      setError(problem);
      AccessibilityInfo.announceForAccessibility(problem);
    } else onKeep();
  };
  return (
    <SheetContent title="Can’t make it?" target={target} sub={`${target.name} · ${visitLine(from.item, from.day, ctx.today)}`}>
      <SheetBody>
        {nextDay ? (
          <Button size="lg" className="rounded-xl" onPress={toNextDay}>
            <Icon as={CalendarArrowUp} size={20} className="text-primary-foreground" />
            <Text className="text-lg">{`Move to ${ctx.dayWord(nextDay)}`}</Text>
          </Button>
        ) : (
          <Button size="lg" className="rounded-xl" onPress={onMove}>
            <Icon as={CalendarClock} size={20} className="text-primary-foreground" />
            <Text className="text-lg">Move to another time</Text>
          </Button>
        )}
        {error ? (
          <Text className="-mt-2 text-sm text-danger" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <Button size="lg" variant="outline" className="-mt-2 rounded-xl" onPress={onCancelVisit}>
          <Icon as={CalendarX} size={20} className="text-danger" />
          <Text className="text-lg text-danger">Cancel the visit</Text>
        </Button>
        <Button variant="ghost" className="-mt-2" onPress={onKeep}>
          <Text className="text-muted-foreground">Keep it</Text>
        </Button>
      </SheetBody>
    </SheetContent>
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
  const seeEveryone = () => {
    if (gap.slotId) ctx.chooseSlot(gap.slotId);
    else ctx.selectDay(gap.day);
    onClose();
    router.navigate('/targets');
  };
  const title = notIn ? 'Not in today' : gap.time ? `${gap.time} is free` : `See someone else ${day}?`;
  const moved = ctx.ws.freeSlots.some((s) => s.itemId === gap.slotId && s.moved);
  const sub = notIn ? `${shortName(target)} wasn’t in. Try again, or see someone close by.` : `The visit with ${shortName(target)} ${moved ? 'moved' : 'is cancelled'}.`;

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
          <Button variant="ghost" className="flex-1 rounded-xl" onPress={onClose}>
            <Text className="text-muted-foreground">{gap.time ? 'Leave it free' : 'Not now'}</Text>
          </Button>
        </View>
      </SheetBody>
    </SheetContent>
  );
}

const visitLine = (item: PlanItem, day: string, today: Date): string => {
  const target = getEntity(item.targetId);
  const when = item.mode === 'timed' && item.time ? `${item.time}–${endTime(item)}` : 'Flexible time';
  return [relativeDay(day, today), when, target ? siteFor(target, item.siteId).name : ''].filter(Boolean).join(' · ');
};

const OTHER = 'other';

/** Book a time, or move a planned visit: their usual times first, clear of the rest of the plan. */
function BookForm({
  target,
  from,
  onCancel,
  onSaved,
}: {
  target: Entity;
  from: (Ref & { item: PlanItem }) | null;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const ctx = useWorkspace();
  const slots = ctx.slotsFor(target, from?.item);
  const [pick, setPick] = useState(slots.length ? '0' : OTHER);
  const [day, setDay] = useState(ctx.bookingDays[0]);
  const [time, setTime] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const route = bookingRoute(target);
  const best = target.kind === 'hcp' ? (target.contact.preferred ?? 'Not recorded · using office hours') : 'Office hours, Mon–Fri';

  const chosen: Slot | null =
    pick === OTHER
      ? time
        ? { day, time: time.trim().padStart(5, '0'), siteId: siteOnDay(target, fromIso(day).getDay()) ?? siteFor(target).id }
        : null
      : (slots[Number(pick)] ?? null);
  const label = chosen ? ` ${formatDate(chosen.day)} ${chosen.time}` : '';

  const save = () => {
    const problem = ctx.book({ targetId: target.id, slot: chosen, confirmed, from: from ? { day: from.day, id: from.id } : undefined });
    if (problem) {
      setError(problem);
      AccessibilityInfo.announceForAccessibility(problem);
      return;
    }
    onSaved(confirmed ? 'Visit booked' : 'Visit requested');
  };
  const choose = (value: string) => {
    setPick(value);
    setError(null);
  };

  return (
    <SheetContent
      title={from ? 'Reschedule' : 'Book a time'}
      target={target}
      sub={from ? `${target.name} · was ${visitLine(from.item, from.day, ctx.today)}` : undefined}
    >
      <SheetBody>
        <View className="gap-1">
          <Text className="text-sm text-muted-foreground">Best time</Text>
          <Text>{best}</Text>
        </View>
        <View className="gap-1">
          <Text className="text-sm text-muted-foreground">Book through</Text>
          <Text selectable>{route.label === 'Email' ? route.value : `${route.label} · ${route.value}`}</Text>
        </View>

        <View className="gap-2" accessibilityRole="radiogroup" accessibilityLabel="When">
          <Text className="text-sm font-medium">When</Text>
          {slots.map((slot, i) => (
            <SlotRow
              key={`${slot.day}-${slot.time}`}
              title={`${formatDate(slot.day)} · ${slot.time}`}
              sub={getOrg(slot.siteId)?.name}
              on={pick === String(i)}
              onPress={() => choose(String(i))}
            />
          ))}
          <SlotRow
            title="Another time"
            sub={slots.length ? undefined : 'No times in their usual hours in the next five working days'}
            on={pick === OTHER}
            onPress={() => choose(OTHER)}
          />
        </View>
        {pick === OTHER ? (
          <View className="gap-4 rounded-md border border-border p-3">
            <Choices label="Day" value={day} onChange={setDay} options={ctx.bookingDays.map((d) => ({ value: d, label: relativeDay(d, ctx.today) }))} />
            <Field label="Start time" id="book-time">
              <Input
                value={time}
                onChangeText={(t) => {
                  setTime(t);
                  setError(null);
                }}
                placeholder="e.g. 14:30"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                accessibilityLabel="Start time"
                aria-labelledby="book-time"
                aria-invalid={!!error}
                className={cn(error && 'border-danger')}
              />
            </Field>
          </View>
        ) : null}

        <View className="min-h-11 flex-row items-center gap-3">
          <Checkbox checked={confirmed} onCheckedChange={setConfirmed} aria-labelledby="book-confirmed" accessibilityLabel="They’ve already agreed to this time" />
          <Label nativeID="book-confirmed" onPress={() => setConfirmed(!confirmed)} className="flex-1 text-base">
            They’ve already agreed to this time
          </Label>
        </View>
        <FinePrint>
          {`${confirmed ? 'It goes in your plan as confirmed.' : 'It goes in your plan as requested until you mark it confirmed.'} Calendar and CRM sync come later.`}
        </FinePrint>
      </SheetBody>
      <Footer onCancel={onCancel} onSave={save} saveLabel={`${confirmed ? 'Book' : 'Request'}${label}`} error={error ? { message: error } : null} />
    </SheetContent>
  );
}

function SlotRow({ title, sub, on, onPress }: { title: string; sub?: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={sub ? `${title}, ${sub}` : title}
      className={cn('min-h-12 flex-row items-center gap-3 rounded-md border px-3 py-2', on ? 'border-primary bg-accent' : 'border-border bg-card')}
    >
      <View className={cn('h-4 w-4 items-center justify-center rounded-full border', on ? 'border-primary' : 'border-muted-foreground')}>
        {on ? <View className="h-2 w-2 rounded-full bg-primary" /> : null}
      </View>
      <View className="flex-1 gap-0.5">
        <Text className={cn('font-medium', on && 'text-accent-foreground')}>{title}</Text>
        {sub ? <Text className="text-sm text-muted-foreground">{sub}</Text> : null}
      </View>
    </Pressable>
  );
}
