// The one sheet for choosing a time, like booking on a scheduling page: the day,
// then the free times as buttons, those in their usual times first with the best
// one already picked, and other free times one tap away. Times too close to
// another visit to drive between aren't offered. A line says what else the rep
// has that day and how far each is, so they can see how it fits. It books a time with someone
// ("Book a time"), moves a visit ("Change the time") and gives an "Any time" stop
// a time ("Set a time"), so all three look and work the same.

import { useState } from 'react';
import { AccessibilityInfo, Pressable, useWindowDimensions, View } from 'react-native';

import { Choices, Footer, SheetBody, SheetContent } from '@/components/note-sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { bookingRoute, dayGrid, siteOnDay, usualTimes } from '@/lib/booking';
import { getEntity, shortName, siteFor } from '@/lib/data';
import { formatDate, fromIso, relativeDay, toMinutes } from '@/lib/format';
import { isOnSite } from '@/lib/plan';
import { useWorkspace } from '@/lib/store';
import type { Entity, PlanItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { defaultDuration } from '@/lib/workspace';

type Visit = { day: string; id: string; item: PlanItem };

/** What the time is for: booking someone, moving a visit, or a time for an "Any time" stop. */
export type TimeFor = { kind: 'book' } | { kind: 'move'; from: Visit } | { kind: 'set'; day: string; item: PlanItem };

const WEEKDAY_NAMES = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

export function TimeForm({ target, mode, onCancel, onSaved }: { target: Entity; mode: TimeFor; onCancel: () => void; onSaved: (message: string) => void }) {
  const ctx = useWorkspace();
  const [now] = useState(() => new Date());
  const item = mode.kind === 'set' ? mode.item : mode.kind === 'move' ? mode.from.item : null;
  const duration = item?.duration ?? defaultDuration(target);
  const onSite = item ? isOnSite(item) : true;
  const booking = mode.kind !== 'set';
  // Where this visit would be on a day, to work out the drive to the others; none for a call.
  const siteOn = (d: string): string | null =>
    !onSite ? null : mode.kind === 'set' ? mode.item.siteId : (siteOnDay(target, fromIso(d).getDay()) ?? siteFor(target).id);
  // A stop's time is set on its own day; a booking can go on any of the next five working days, starting with the best one.
  const days = mode.kind === 'set' ? [mode.day] : ctx.bookingDays;
  const gridFor = (d: string) =>
    dayGrid(target, {
      day: d,
      plan: ctx.ws.plans[d],
      duration,
      onSite,
      // Today, nothing in the next quarter of an hour, or half hour when the office has to be asked.
      earliest: d === ctx.todayIso ? now.getHours() * 60 + now.getMinutes() + (booking ? 30 : 15) : 0,
      except: item?.id,
      travelTo: (other) => ctx.travelTo(siteOn(d), other),
    });
  const [day, setDay] = useState(() => (mode.kind === 'set' ? mode.day : (ctx.slotsFor(target, item, now)[0]?.day ?? days[0])));
  const grid = gridFor(day);
  const [time, setTime] = useState<string | null>(() => {
    if (mode.kind !== 'set') return grid.pick;
    // An "Any time" stop starts from the free time in their usual hours nearest to about when it is now, so the day stays as the rep sees it.
    const about = ctx.daySchedule(mode.day, now).stops.find((s) => s.item.id === mode.item.id)?.start;
    const near = about == null ? null : grid.rows.find((r) => r.usual && !r.taken && !r.past && !r.tight && toMinutes(r.time) >= about - 15);
    return near?.time ?? grid.pick;
  });
  const [showOther, setShowOther] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chooseDay = (d: string) => {
    setDay(d);
    setTime(gridFor(d).pick);
    setShowOther(false);
    setError(null);
  };
  const choose = (t: string) => {
    setTime(t);
    setError(null);
  };

  const save = () => {
    const problem = !time
      ? 'Choose a time.'
      : mode.kind === 'set'
        ? ctx.setStopTime(mode.day, mode.item.id, time)
        : ctx.book({
            targetId: target.id,
            slot: { day, time, siteId: siteOnDay(target, fromIso(day).getDay()) ?? siteFor(target).id },
            confirmed,
            from: mode.kind === 'move' ? { day: mode.from.day, id: mode.from.id } : undefined,
          });
    if (problem) {
      setError(problem);
      AccessibilityInfo.announceForAccessibility(problem);
      return;
    }
    onSaved(mode.kind === 'set' ? `Set for ${time}` : confirmed ? 'Visit booked' : 'Visit requested');
  };

  const title = mode.kind === 'set' ? 'Set a time' : mode.kind === 'move' ? 'Change the time' : 'Book a time';
  const sub =
    mode.kind === 'move'
      ? `${target.name} · was ${relativeDay(mode.from.day, ctx.today)}${mode.from.item.time ? ` ${mode.from.item.time}` : ''}`
      : mode.kind === 'set'
        ? `${target.name} · ${relativeDay(mode.day, ctx.today)}`
        : undefined;
  const route = bookingRoute(target);
  const notIn = onSite && !siteOnDay(target, fromIso(day).getDay());
  const dayLabel = (d: string) => (d === ctx.todayIso ? 'Today' : relativeDay(d, ctx.today) === 'Tomorrow' ? 'Tomorrow' : formatDate(d, { weekday: 'short', day: 'numeric' }));
  const thatDay = day === ctx.todayIso ? 'today' : 'that day';
  // Only free times are offered, like a booking page: theirs first, the rest one tap away.
  const free = grid.rows.filter((r) => !r.taken && !r.past && !r.tight);
  const tooTight = grid.rows.some((r) => r.tight && !r.taken && !r.past);
  const usual = free.filter((r) => r.usual).map((r) => r.time);
  const other = free.filter((r) => !r.usual).map((r) => r.time);
  const otherOpen = showOther || !usual.length || (!!time && other.includes(time));
  // What else is on that day and how far, so the rep can see how it fits.
  const away = (v: PlanItem) => ctx.travelTo(siteOn(day), v);
  const yourDay = [
    ...grid.visits.map((v) => `${v.time} ${who(v)}${away(v) ? `, ${away(v)} min away` : ''}`),
    ...grid.anyTime.map((v) => `${who(v)} (any time)`),
  ].join(' · ');
  const saveLabel = !time ? (booking ? 'Request' : 'Set time') : mode.kind === 'set' ? `Set ${time}` : `${confirmed ? 'Book' : 'Request'} ${dayLabel(day)} ${time}`;

  return (
    <SheetContent title={title} target={target} sub={sub}>
      <SheetBody>
        <View className="gap-1">
          <Text className="text-sm text-muted-foreground">{usualTimes(target)}</Text>
          {booking ? <Text className="text-sm text-muted-foreground" selectable>{`Book through ${route.label === 'Email' ? route.value : `${route.label} · ${route.value}`}`}</Text> : null}
        </View>

        {days.length > 1 ? <Choices label="Day" value={day} onChange={chooseDay} options={days.map((d) => ({ value: d, label: dayLabel(d) }))} /> : null}

        <View className="gap-3">
          {notIn ? <Text className="text-sm text-warn">{`${shortName(target)} isn’t usually in on ${WEEKDAY_NAMES[fromIso(day).getDay()]}.`}</Text> : null}
          {usual.length ? <Times label="Their usual times" times={usual} value={time} onChange={choose} /> : null}
          {other.length && otherOpen ? <Times label={usual.length ? 'Other free times' : 'Free times'} times={other} value={time} onChange={choose} /> : null}
          {other.length && !otherOpen ? (
            <Button variant="ghost" className="self-start px-0" onPress={() => setShowOther(true)}>
              <Text className="text-brand">{`Other times (${other.length})`}</Text>
            </Button>
          ) : null}
          {!free.length ? <Text className="text-base">{`No free times left ${thatDay}.${days.length > 1 ? ' Choose another day.' : ''}`}</Text> : null}
          <Text className="text-sm text-muted-foreground">{yourDay ? `Your day: ${yourDay}` : `Nothing else planned ${thatDay}.`}</Text>
          {tooTight ? <Text className="text-sm text-muted-foreground">Times too close to another visit to drive between aren’t shown.</Text> : null}
        </View>

        {booking ? (
          <View className="min-h-11 flex-row items-center gap-3">
            <Checkbox checked={confirmed} onCheckedChange={setConfirmed} aria-labelledby="time-confirmed" accessibilityLabel="They’ve already agreed to this time" />
            {/* The label's own wrapper doesn't shrink, so this one lets it wrap on a narrow phone. */}
            <View className="min-w-0 flex-1">
              <Label nativeID="time-confirmed" onPress={() => setConfirmed(!confirmed)} className="text-base">
                They’ve already agreed to this time
              </Label>
            </View>
          </View>
        ) : null}
      </SheetBody>
      <Footer onCancel={onCancel} onSave={save} saveLabel={saveLabel} error={error ? { message: error } : null} />
    </SheetContent>
  );
}

const who = (i: PlanItem): string => {
  const e = getEntity(i.targetId);
  return e ? shortName(e) : 'Someone';
};

/** Free times as big buttons, three to a row (two with large text); the chosen one is filled in. */
function Times({ label, times, value, onChange }: { label: string; times: string[]; value: string | null; onChange: (time: string) => void }) {
  const perRow = useWindowDimensions().fontScale >= 1.4 ? 2 : 3;
  const rows = Array.from({ length: Math.ceil(times.length / perRow) }, (_, r) => times.slice(r * perRow, (r + 1) * perRow));
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium">{label}</Text>
      {/* Rows of equal buttons, so they line up at any width; a short last row keeps the same sizes. */}
      <View className="gap-2" accessibilityRole="radiogroup" accessibilityLabel={label}>
        {rows.map((row) => (
          <View key={row[0]} className="flex-row gap-2">
            {row.map((t) => {
              const on = t === value;
              return (
                <Pressable
                  key={t}
                  onPress={() => onChange(t)}
                  accessibilityRole="radio"
                  accessibilityLabel={t}
                  // Not accessibilityState: the web build only passes aria-checked on.
                  aria-checked={on}
                  className={cn('min-h-11 flex-1 items-center justify-center rounded-lg border', on ? 'border-primary bg-primary' : 'border-border bg-card active:bg-accent')}
                >
                  <Text className={cn('text-base font-medium', on && 'text-primary-foreground')}>{t}</Text>
                </Pressable>
              );
            })}
            {Array.from({ length: perRow - row.length }, (_, i) => (
              <View key={i} className="flex-1" />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}
