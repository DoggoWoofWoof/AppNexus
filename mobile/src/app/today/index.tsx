// Today, where the app opens: the daily brief, then the day's visits in route
// order. The brief (components/daily-brief.tsx) is open when the day starts: a
// tile for each state of the territory and next door, which opens Targets there,
// and three doctors worth adding beyond My targets, each with why and + Add to
// put them in the day. A day with nothing in it shows the brief alone, so the day
// starts from it, or from Build route on Targets. Once anyone is in the day,
// Today's review (components/day-review.tsx) says who the rep is seeing and why
// they matter in a paragraph, and the visits follow, each with its goal and
// labels in the same colours: gold for what to do today, rose for a competitor's
// products and patients going elsewhere, green for what's working. Once the rep
// is done with the brief, it folds to a line at the top. Tapping a
// row opens their page, with the Summary, Log, Directions and Call at the top. A
// visit whose time has gone, or an "Any time" one still open at 17:30, gets its
// own Log button, and the others a ⋯ that opens "Change visit" right here, like
// tapping an event in a phone's calendar. "Any time" stops have dots to drag them
// into another order.
// From 17:30 the day is over: a line under the visits says who wasn't seen (how
// many, when there are more than three) and moves them all to tomorrow, with Undo,
// and those visits stop showing a time for today. "Add a visit" opens Targets,
// where + picks people and "Build route" puts them in the day, each where it adds
// the least driving, and comes back here. The map comes after the visits, and
// what's left from before (visits earlier in the week never logged, and
// follow-ups due) is one "Still to do" line at the bottom that opens in place.
// Each stop has a time, "About 10:45" for an "Any time" one, worked out from the
// drive between stops and their usual times. The drive to each stop is on a line
// between it and the one before, like directions in a maps app, and the next one
// says when to leave; a line over the day says how much driving and when it should
// finish. A freed time offers the three best people to see instead. "Save 12 min"
// (Best order, when it would help) puts the "Any time" stops in the order with the
// least driving, with Undo, and "Maps" opens the stops still to come in Google Maps,
// in order, from wherever the phone is.

import { router } from 'expo-router';
import { Car, ChevronDown, ChevronRight, ChevronUp, CircleCheck, Ellipsis, GripVertical, ListTodo, Navigation, Plus, X } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Linking, Pressable, useWindowDimensions, View } from 'react-native';

import { DailyBrief, useDailyBrief } from '@/components/daily-brief';
import { DayReview, StopLabels } from '@/components/day-review';
import { Avatar, useProfileHref } from '@/components/entity';
import { useLogSheet } from '@/components/log-sheet';
import { MenuButton } from '@/components/menu';
import { Screen } from '@/components/screen';
import { StopMap, type MapPin } from '@/components/stop-map';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useVisitSheets } from '@/components/visit-sheets';
import { getEntity, getOrg, shortName } from '@/lib/data';
import { formatDate, formatMinutes, fromMinutes, listJoin, plural, toMinutes } from '@/lib/format';
import { routeUrl } from '@/lib/links';
import { outcomeWord } from '@/lib/brief';
import { stopLabels, type StopLabel } from '@/lib/day-review';
import { END_OF_DAY, fixedStops, isOnSite, notLogged, type Clash, type Stop } from '@/lib/plan';
import { useWorkspace } from '@/lib/store';
import type { Entity, PlanItem } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Minutes since midnight, to tell which of today's visits have already happened. */
const minutesNow = (now: Date): number => now.getHours() * 60 + now.getMinutes();

/**
 * The time now, read again every minute, so a visit is flagged when its time
 * passes with the app open. The screen reads it once each time it's drawn, so
 * everything on it goes by the same time, such as at 17:30.
 */
function useClock(): Date {
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(timer);
  }, []);
  return new Date();
}

export default function Today() {
  const ctx = useWorkspace();
  const profileHref = useProfileHref();
  const visits = useVisitSheets();
  const { openLog, sheet } = useLogSheet({ onNotIn: visits.openNotIn });
  const { width } = useWindowDimensions();
  const narrow = useNarrow();
  const [today, nextDay] = ctx.planDays();
  // The day is shared with Targets, so + there adds to the day shown here.
  const day = ctx.ws.selection.day === nextDay.iso ? nextDay.iso : today.iso;
  const isToday = day === today.iso;
  const clock = useClock();
  const now = minutesNow(clock);
  const plan = ctx.dayPlan(day, clock);
  const active = plan.filter((i) => i.status !== 'cancelled');
  const brief = useDailyBrief(day, clock);
  // A day with nothing in it shows the brief alone, so the day starts from it, or from Build route on Targets.
  const briefOnly = !!brief && !brief.folded && !plan.length;
  // What matters about each stop, in a label or two (`stopLabels` in lib/day-review.ts).
  const labels = stopLabels(ctx, day, clock);
  // When each stop is and the drive to it, from the order and their usual times.
  const schedule = ctx.daySchedule(day, clock);
  const stopOf = new Map(schedule.stops.map((s) => [s.item.id, s]));
  // Visits with a time too close to get between, said on the later one.
  const clashOf = new Map(schedule.clashes.map((c) => [c.later.id, c]));
  // A visit with a time is due a log once it's over; an "Any time" one from 17:30.
  const unlogged = (i: PlanItem): boolean => isToday && notLogged(i, now);
  // From 17:30 today is over.
  const dayOver = isToday && now >= toMinutes(END_OF_DAY);
  const next = isToday ? active.find((i) => i.status === 'planned' && !unlogged(i)) : undefined;
  // Once the day is over, the visits not done, to move on in one go (`notDoneToday` in lib/workspace.ts).
  const notDone = isToday ? ctx.notDoneToday(clock) : null;
  const notDoneNames = listJoin((notDone?.moves ?? []).flatMap((m) => {
    const who = getEntity(m.item.targetId);
    return who ? [shortName(who)] : [];
  }));
  // When to set off for the next visit in person still to come: past any call, and
  // past a visit going on now. Today an "Any time" one starts as soon as it can, so
  // a time within the next few minutes is "Leave now" rather than one that creeps on.
  const going = active.find((i) => i.status === 'planned' && isOnSite(i) && (!isToday || (!unlogged(i) && (stopOf.get(i.id)?.start ?? 0) > now)));
  const goingStop = going && stopOf.get(going.id);
  const leaveAt = goingStop && goingStop.travel > 0 ? goingStop.start - goingStop.travel : null;
  const leave = leaveAt == null ? '' : isToday && leaveAt < now + 5 ? 'Leave now' : `Leave by ${fromMinutes(leaveAt)}`;
  const free = ctx.freeSlotsOn(day, clock);
  const earlier = isToday
    ? ctx.unloggedBefore().flatMap((e) => {
        const who = getEntity(e.item.targetId);
        return who ? [{ ...e, who }] : [];
      })
    : [];
  const due = isToday ? ctx.openFollowUps().filter((f) => f.overdueBy >= 0) : [];
  const late = due.filter((f) => f.overdueBy > 0).length;
  const done = active.filter((i) => i.status === 'done').length;
  const driving = schedule.stops.reduce((total, s) => total + s.travel, 0);
  // When the day should finish, while anything is still to come.
  const toCome = schedule.stops.filter((s) => s.item.status === 'planned' && !unlogged(s.item));
  const finish = toCome.length ? Math.max(...toCome.map((s) => s.end)) : null;
  // Best order only changes "Any time" stops still to come; once the day is over there are none.
  const anyTimeToCome = active.some((i) => i.status === 'planned' && i.mode !== 'timed' && !unlogged(i));
  const saves = anyTimeToCome ? ctx.bestOrderSaves(day, clock) : null;
  // What the stops under it don't say: how far along, the driving all day and when it ends.
  const summary = [
    done ? `${done} of ${active.length} done` : '',
    driving ? `${formatMinutes(driving)} driving` : '',
    finish != null ? `finish about ${fromMinutes(finish)}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const open = (targetId: string) => {
    const who = getEntity(targetId);
    if (who) router.push(profileHref(who));
  };
  const change = (item: PlanItem) => {
    const who = getEntity(item.targetId);
    if (who) visits.openChange(who, { day, id: item.id, item });
  };
  const log = (item: PlanItem, on = day) => {
    const who = getEntity(item.targetId);
    if (who) openLog(who, { day: on, id: item.id, type: item.type }, on === today.iso ? {} : { title: `Log ${formatDate(on)}` });
  };
  // Whether Still to do is open.
  const [showLeft, setShowLeft] = useState(false);
  const left = listJoin([earlier.length ? `${plural(earlier.length, 'visit')} to log` : '', due.length ? `${plural(due.length, 'follow-up')} due` : ''].filter(Boolean));

  // Dragging an "Any time" stop by its dots: which one, where it was, where it
  // would land, and how far the stops it passes move to make room.
  const [held, setDrag] = useState<{ id: string; from: number; to: number; room: number } | null>(null);
  // Made once: the web has no useAnimatedValue.
  const [dragY] = useState(() => new Animated.Value(0));
  // How tall each stop is, with the drive line above it, to tell where a dragged one
  // would land. Where they are is worked out from the order, as the web doesn't say
  // when one only moves.
  const heights = useRef(new Map<string, number>());
  // An "Any time" stop still to do, with somewhere else in the day it could go.
  const movable = (i: PlanItem) => {
    if (i.status !== 'planned' || i.mode === 'timed' || unlogged(i)) return false;
    const others = active.filter((o) => o !== i);
    return others.length > fixedStops(others, isToday ? now : null);
  };
  const handles = active.some(movable);
  // A stop that can't be dragged any more mid-drag, such as when its time passes, is let go.
  const drag = held && active.some((i) => i.id === held.id && movable(i)) ? held : null;
  const middles = (): Map<string, number> => {
    let y = 0;
    return new Map(
      active.map((i) => {
        const h = heights.current.get(i.id) ?? 0;
        y += h + 8;
        return [i.id, y - 8 - h / 2];
      }),
    );
  };
  const landing = (id: string, dy: number): number => {
    const at = middles();
    const middle = (at.get(id) ?? 0) + dy;
    const others = active.filter((i) => i.id !== id);
    const above = others.filter((i) => (at.get(i.id) ?? 0) < middle).length;
    // Nothing goes before a visit that has already happened.
    return Math.max(above, fixedStops(others, isToday ? now : null));
  };
  const shift = (index: number): number => {
    if (!drag || index < 0) return 0;
    if (drag.from < index && index <= drag.to) return -drag.room;
    if (drag.to <= index && index < drag.from) return drag.room;
    return 0;
  };
  const startDrag = (item: PlanItem) => {
    const from = active.indexOf(item);
    dragY.setValue(0);
    setDrag({ id: item.id, from, to: from, room: (heights.current.get(item.id) ?? 0) + 8 });
  };
  const moveDrag = (item: PlanItem, dy: number) => {
    dragY.setValue(dy);
    const to = landing(item.id, dy);
    setDrag((d) => (d && d.to !== to ? { ...d, to } : d));
  };
  const endDrag = (item: PlanItem, dy: number | null) => {
    const to = dy == null ? -1 : landing(item.id, dy);
    setDrag(null);
    dragY.setValue(0);
    if (to >= 0 && to !== active.indexOf(item)) ctx.moveStop(day, item.id, to);
  };

  // Stops that need travel, numbered in route order.
  const onSite = active.filter(isOnSite);
  // Where the visits still to come are, in order, for Maps: one stop for visits one
  // after another in the same place, and four at most on a phone, as its browser takes no more.
  const ahead = onSite
    .filter((i) => i.status === 'planned' && !unlogged(i))
    .filter((i, n, all) => n === 0 || i.siteId !== all[n - 1].siteId)
    .flatMap((i) => {
      const site = getOrg(i.siteId);
      return site ? [site.coords] : [];
    })
    .slice(0, width < 768 ? 4 : 10);
  const pins: MapPin[] = onSite.flatMap((item, i) => {
    const site = getOrg(item.siteId);
    const who = getEntity(item.targetId);
    if (!site || !who) return [];
    return [
      {
        id: item.targetId,
        coords: site.coords,
        label: String(i + 1),
        tone: item.status === 'done' ? 'done' : item === next ? 'next' : 'planned',
        title: `${i + 1}. ${who.name}${item.time ? ` at ${item.time}` : ''}`,
      },
    ];
  });

  const otherDay = (
    <Button
      size="sm"
      variant="ghost"
      onPress={() => ctx.selectDay(isToday ? nextDay.iso : today.iso)}
      accessibilityLabel={isToday ? `Show ${ctx.dayWord(nextDay.iso)}` : 'Back to today'}
    >
      <Text className="text-brand">{isToday ? nextDay.label : 'Today'}</Text>
    </Button>
  );

  return (
    <Screen inset scrollEnabled={!drag}>
      {/* At very large text the day's name has a line of its own, under the menu and the other day. */}
      {narrow ? (
        <View className="gap-1">
          <View className="flex-row items-center justify-between gap-2">
            <MenuButton />
            {otherDay}
          </View>
          <Text variant="h1">{formatDate(day, { weekday: 'long' })}</Text>
        </View>
      ) : (
        <View className="flex-row items-center gap-2">
          <MenuButton />
          <Text variant="h1" className="flex-1">
            {formatDate(day, { weekday: 'long' })}
          </Text>
          {otherDay}
        </View>
      )}

      {brief ? <DailyBrief state={brief} /> : null}
      {briefOnly ? null : <DayReview day={day} now={clock} />}

      {plan.length ? (
        // On the web a drag with the mouse would otherwise select the text it passes.
        <View className="gap-2 web:select-none">
          <Text variant="kicker" role="heading">
            Your day
          </Text>
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-sm text-muted-foreground" accessibilityLiveRegion="polite">
              {active.length ? summary : 'All cancelled'}
            </Text>
            {saves != null ? (
              <Button
                size="sm"
                variant="ghost"
                onPress={() => ctx.bestOrder(day)}
                accessibilityLabel={`Put the Any time stops in the best order: ${saves ? `${saves} min less driving` : 'little driving'}, in their usual times`}
              >
                <Text className="text-brand">{saves ? `Save ${saves} min` : 'Best order'}</Text>
              </Button>
            ) : null}
            {ahead.length ? (
              <Button
                size="sm"
                variant="ghost"
                onPress={() => void Linking.openURL(routeUrl(ahead))}
                accessibilityLabel={`Open ${ahead.length === 1 ? 'the next stop' : `the next ${ahead.length} stops`} in Google Maps, in order`}
              >
                <Icon as={Navigation} size={16} className="text-brand" />
                <Text className="text-brand">Maps</Text>
              </Button>
            ) : null}
          </View>
          {/* One line per freed time, so a second cancel doesn't hide the first. */}
          {free.map((slot) => (
            <View key={slot.itemId} className="flex-row items-center gap-3 rounded-xl bg-brand-soft py-2 pl-4 pr-1">
              <Text className="flex-1 text-base">
                <Text className="text-base font-semibold">{`${slot.time} is free.`}</Text>
                {` The visit with ${slot.name.replace(/^Dr\. \S+ /, 'Dr. ')} ${slot.moved ? 'moved' : 'was cancelled'}.`}
              </Text>
              <Button
                size="sm"
                className="rounded-lg"
                onPress={() => visits.openFill({ day, siteId: slot.siteId, time: slot.time, duration: slot.duration, except: slot.targetId, slotId: slot.itemId })}
                accessibilityLabel={`Find someone for ${slot.time}`}
              >
                <Text>Find someone</Text>
              </Button>
              <Button size="icon" variant="ghost" onPress={() => ctx.leaveFree(slot.itemId)} accessibilityLabel={`Leave ${slot.time} free`}>
                <Icon as={X} size={18} className="text-muted-foreground" />
              </Button>
            </View>
          ))}
          {plan.map((item) => {
            const stop = stopOf.get(item.id);
            const clash = clashOf.get(item.id);
            // Said on a stop still to come, with a better day or time: a day they aren't in, outside their usual times, or late.
            const warnings =
              stop && item.status === 'planned' && !unlogged(item) ? [ctx.timeWarning(item, day, stop.outside), stop.late && 'After 17:30'].filter((w): w is string => !!w) : [];
            const index = active.indexOf(item);
            const lifted = drag?.id === item.id;
            const by = shift(index);
            return (
              // The dragged stop follows the finger; the ones it passes move up or down to make room.
              <Animated.View
                key={item.id}
                onLayout={(e) => heights.current.set(item.id, e.nativeEvent.layout.height)}
                style={lifted ? { zIndex: 10, transform: [{ translateY: dragY }] } : by ? { transform: [{ translateY: by }] } : undefined}
              >
                <View className="gap-2">
                  {stop && (stop.travel > 0 || clash) ? (
                    <Drive
                      minutes={stop.travel}
                      leave={item === going ? leave : ''}
                      clash={clash ? clashText(clash) : ''}
                      indent={handles}
                      // Faint while the order changes, as the drives will too; none on the stop being dragged.
                      fade={lifted ? 'gone' : drag ? 'faint' : undefined}
                    />
                  ) : null}
                  <StopRow
                    item={item}
                    stop={stop}
                    warnings={warnings}
                    labels={labels.get(item.id) ?? []}
                    next={item === next}
                    unlogged={unlogged(item)}
                    number={onSite.indexOf(item) + 1}
                    lifted={lifted}
                    handle={
                      !handles ? undefined : movable(item) ? (
                        <DragHandle
                          name={getEntity(item.targetId)?.name ?? 'this stop'}
                          onStart={() => startDrag(item)}
                          onMove={(dy) => moveDrag(item, dy)}
                          onEnd={(dy) => endDrag(item, dy)}
                          onStep={(step) => ctx.moveStop(day, item.id, Math.max(0, index + step))}
                        />
                      ) : null
                    }
                    onPress={() => open(item.targetId)}
                    onLog={() => log(item)}
                    onChange={() => change(item)}
                  />
                </View>
              </Animated.View>
            );
          })}
          {/* Once the day is over, the visits not done move on in one go, with Undo. One
              done but not logged still has its own Log button above. */}
          {notDone ? (
            <View className="flex-row items-center gap-3 rounded-xl border border-border bg-card py-2 pl-4 pr-2">
              {/* By name when there are a few, as the stops above them all say "Not logged yet". */}
              <Text className="flex-1 text-base">{notDone.moves.length <= 3 ? `Not done today: ${notDoneNames}` : `${plural(notDone.moves.length, 'visit')} not done today`}</Text>
              <Button size="sm" variant="outline" className="rounded-lg" onPress={() => ctx.moveNotDone()} accessibilityLabel={`Move ${notDoneNames} to ${ctx.dayWord(notDone.to)}`}>
                <Text>{`Move ${notDone.moves.length === 1 ? 'it' : 'them'} to ${ctx.dayWord(notDone.to)}`}</Text>
              </Button>
            </View>
          ) : null}
        </View>
      ) : null}
      {/* A day with nothing in it says so once the brief is folded; once today is over, what's added goes on the next working day. */}
      {plan.length || briefOnly ? null : <Text className="text-sm text-muted-foreground">{dayOver ? 'Nothing left today' : 'Nothing planned yet'}</Text>}

      {briefOnly ? null : (
        <Button
          size="lg"
          variant={active.length ? 'outline' : 'default'}
          className="rounded-xl"
          onPress={() => router.navigate('/targets')}
        >
          <Icon as={Plus} size={20} className={active.length ? undefined : 'text-primary-foreground'} />
          <Text className="text-lg">{active.length ? 'Add a visit' : 'Choose who to see'}</Text>
        </Button>
      )}

      {pins.length ? (
        <StopMap
          pins={pins}
          start={{ coords: ctx.start.coords, label: `${ctx.start.title}, ${ctx.start.place}` }}
          route
          onPinPress={open}
          label={`Map of ${ctx.dayWord(day)}’s stops`}
          // Taller on a wider screen, such as an iPad, up to the column's width.
          height={Math.round(Math.min(360, Math.max(190, (Math.min(width, 720) - 32) * 0.55)))}
        />
      ) : null}

      {/* What's left from before, under the day so the day comes first: one line that
          opens to the visits never logged (log them on their day, or say they didn't
          happen), then the follow-ups due. */}
      {!briefOnly && (earlier.length || due.length) ? (
        <View className="gap-2">
          <Pressable
            onPress={() => setShowLeft((s) => !s)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showLeft }}
            className="min-h-11 flex-row items-center gap-2 active:opacity-70"
          >
            <Text className="flex-1 text-sm text-muted-foreground">
              <Text className="text-sm font-semibold">Still to do</Text>
              {` · ${left}`}
            </Text>
            <Icon as={showLeft ? ChevronUp : ChevronDown} size={18} className="text-muted-foreground" />
          </Pressable>
          {showLeft ? (
            <View className="rounded-xl border border-border bg-card">
              {earlier.map(({ day: on, item, who }, i) => (
                <View key={item.id} className={cn('gap-3 p-3', i > 0 && 'border-t border-border')}>
                  <View className="flex-row items-center gap-3">
                    <Avatar entity={who} />
                    <View className="flex-1 gap-0.5">
                      <Text className="text-base font-semibold">{shortName(who)}</Text>
                      <Text className="text-sm font-medium text-warn">{`Visit on ${formatDate(on)} · not logged yet`}</Text>
                    </View>
                  </View>
                  <View className="flex-row gap-2">
                    <Button className="flex-1 rounded-lg" onPress={() => log(item, on)} accessibilityLabel={`Log the visit with ${who.name} on ${formatDate(on)}`}>
                      <Text>Log</Text>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 rounded-lg"
                      onPress={() => ctx.cancelVisit(on, item.id, 'Didn’t happen')}
                      accessibilityLabel={`The visit with ${who.name} on ${formatDate(on)} didn’t happen`}
                    >
                      <Text>Didn’t happen</Text>
                    </Button>
                  </View>
                </View>
              ))}
              {due.length ? (
                <Pressable
                  onPress={() => router.navigate('/activity')}
                  accessibilityRole="link"
                  accessibilityHint="Opens Activity"
                  className={cn('min-h-16 flex-row items-center gap-3 rounded-xl p-3 active:bg-accent', earlier.length && 'rounded-t-none border-t border-border')}
                >
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-warn-soft">
                    <Icon as={ListTodo} size={20} className="text-warn" />
                  </View>
                  {/* How many is on the Still to do line. */}
                  <View className="flex-1 gap-0.5">
                    <Text className="text-base font-semibold">Follow-ups</Text>
                    <Text className="text-sm text-muted-foreground">
                      {[late && `${late} late`, due.length - late && `${due.length - late} due today`].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Text className="text-base text-brand">See them</Text>
                  <Icon as={ChevronRight} size={18} className="text-brand" />
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
      {sheet}
      {visits.sheets}
    </Screen>
  );
}

/** What's wrong with two visits with a time, in words. */
function clashText(clash: Clash): string {
  const nameOf = (item: PlanItem | null, otherwise: string) => {
    const who = item && getEntity(item.targetId);
    return who ? shortName(who) : otherwise;
  };
  if (clash.kind === 'overlap') return `Overlaps the visit with ${nameOf(clash.earlier, 'the visit before')}`;
  // The drive is from the last place visited, which isn't a call in between.
  return `Too tight: ${clash.need} min drive from ${nameOf(clash.from, 'where you start')}, only ${clash.free} min between`;
}

/** The drive to a stop, on a line between it and the one before, like directions in a maps app. */
function Drive({ minutes, leave, clash, indent, fade }: { minutes: number; leave: string; clash: string; indent: boolean; fade?: 'faint' | 'gone' }) {
  return (
    // The line sits under the pictures, which are further in when the stops have dots.
    <View className={cn('flex-row gap-3', indent ? 'pl-[60px]' : 'pl-[31px]', fade === 'faint' && 'opacity-30', fade === 'gone' && 'opacity-0')}>
      <View className="w-0.5 rounded-full bg-border" />
      <View className="flex-1 gap-0.5 py-1">
        {minutes ? (
          <View className="flex-row flex-wrap items-center gap-x-2">
            <Icon as={Car} size={16} className="text-muted-foreground" />
            <Text className="text-sm text-muted-foreground">{`${minutes} min drive`}</Text>
            {leave ? <Text className="text-sm font-medium text-brand">{`· ${leave}`}</Text> : null}
          </View>
        ) : null}
        {clash ? <Text className="text-sm font-medium text-warn">{clash}</Text> : null}
      </View>
    </View>
  );
}

/**
 * The dots beside an "Any time" stop: hold and drag them up or down to change the
 * order. With a screen reader, swipe up or down on them to move it one place.
 */
function DragHandle({
  name,
  onStart,
  onMove,
  onEnd,
  onStep,
}: {
  name: string;
  onStart: () => void;
  onMove: (dy: number) => void;
  /** How far it was dragged, or null when the drag was taken away, as by a call coming in. */
  onEnd: (dy: number | null) => void;
  onStep: (step: number) => void;
}) {
  // Where the finger went down, to tell how far it has moved.
  const startY = useRef(0);
  return (
    <View
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponderCapture={() => true}
      // Keep the drag rather than letting the page scroll.
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => {
        startY.current = e.nativeEvent.pageY;
        onStart();
      }}
      onResponderMove={(e) => onMove(e.nativeEvent.pageY - startY.current)}
      onResponderRelease={(e) => onEnd(e.nativeEvent.pageY - startY.current)}
      onResponderTerminate={() => onEnd(null)}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`Move ${name}`}
      accessibilityHint="Drag up or down to change the order"
      accessibilityActions={[
        { name: 'increment', label: 'Move earlier' },
        { name: 'decrement', label: 'Move later' },
      ]}
      onAccessibilityAction={(e) => onStep(e.nativeEvent.actionName === 'increment' ? -1 : 1)}
      className="w-9 items-center justify-center self-stretch web:cursor-grab web:touch-none"
    >
      <Icon as={GripVertical} size={20} className="text-muted-foreground" />
    </View>
  );
}

function StopRow({
  item,
  stop,
  warnings,
  labels,
  next,
  unlogged,
  number,
  lifted,
  handle,
  onPress,
  onLog,
  onChange,
}: {
  item: PlanItem;
  stop: Stop | undefined;
  warnings: string[];
  /** What matters about them, each in its colour. */
  labels: StopLabel[];
  next: boolean;
  unlogged: boolean;
  number: number;
  /** Being dragged. */
  lifted: boolean;
  /** The dots to drag it by, null for a stop that can't move, or undefined when none in the day can. */
  handle: ReactNode | undefined;
  /** Opens their page. */
  onPress: () => void;
  onLog: () => void;
  onChange: () => void;
}) {
  const narrow = useNarrow();
  const who = getEntity(item.targetId);
  if (!who) return null;
  const cancelled = item.status === 'cancelled';
  const done = item.status === 'done';
  // An "Any time" stop still to come says about when, from the drive and their usual
  // times. Once the day is over that time has gone, so it's just "Any time" again.
  const when = item.mode === 'timed' && item.time ? item.time : stop && item.status === 'planned' && !unlogged ? `About ${fromMinutes(stop.start)}` : 'Any time';
  const unconfirmed = !done && !cancelled && !unlogged && item.booking === 'requested';
  const status = done ? (item.outcome === 'Attempted' ? outcomeWord('Attempted', item.type) : 'Done') : cancelled ? 'Cancelled' : unlogged ? 'Not logged yet' : next ? 'Next' : '';
  // Where to go for a visit, unless it's the account itself, or how for a call.
  const how = isOnSite(item) ? (item.siteId === who.id ? '' : (getOrg(item.siteId)?.name ?? '')) : item.type;
  const sub = [when, how, status, unconfirmed && 'Not confirmed yet'].filter(Boolean).join(' · ');
  // What the visit is for, with what matters about them in the labels under it.
  const goal = done || cancelled ? '' : item.goal;

  // Log or ⋯, or a tick once it's done. At very large text it goes under the words,
  // which would otherwise be a few letters to a line; "Done" is in the words then.
  const action = done ? (
    narrow ? null : (
      <View className="min-h-11 min-w-11 items-center justify-center">
        <Icon as={CircleCheck} size={22} className="text-success" />
      </View>
    )
  ) : unlogged ? (
    <Button size="sm" className={cn('rounded-lg', !narrow && 'mr-2')} onPress={onLog} accessibilityLabel={`Log the visit with ${who.name}`}>
      <Text>Log</Text>
    </Button>
  ) : cancelled ? (
    narrow ? null : <View className="min-h-11 min-w-11" />
  ) : (
    <Button size="icon" variant="ghost" className="rounded-lg" onPress={onChange} accessibilityLabel={`Change the visit with ${who.name}`}>
      <Icon as={Ellipsis} size={22} className="text-foreground" />
    </Button>
  );

  // Tapping the row opens their page; Log and ⋯ sit beside it rather than inside,
  // as a button can't hold another. Gold is kept for what needs sorting out, such
  // as a time not confirmed; a visit not logged has its Log button.
  return (
    <View className={cn('rounded-xl bg-card', next || lifted ? 'border-2 border-primary' : 'border border-border', lifted && 'shadow-lg', cancelled && 'opacity-60')}>
      <View className="min-h-16 flex-row items-center gap-1 pr-1">
        {handle === undefined ? null : (handle ?? <View className="w-9" />)}
        <Pressable
          onPress={onPress}
          accessibilityRole="link"
          accessibilityLabel={[who.name, sub, ...warnings, goal, ...labels.map((l) => l.label)].filter(Boolean).join(', ')}
          accessibilityHint="Opens their page"
          className={cn('flex-1 flex-row items-center gap-3 rounded-xl py-3 active:bg-accent', handle === undefined && 'pl-3')}
        >
          <StopAvatar who={who} number={done ? 0 : number} next={next} />
          <View className="flex-1 gap-0.5">
            <Text className={cn('text-base font-semibold', cancelled && 'line-through')}>{shortName(who)}</Text>
            <Text className={cn('text-sm', next ? 'font-medium text-brand' : unconfirmed ? 'font-medium text-warn' : 'text-muted-foreground')}>{sub}</Text>
            {warnings.map((w) => (
              <Text key={w} className="text-sm font-medium text-warn">
                {w}
              </Text>
            ))}
            {goal ? (
              <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                {goal}
              </Text>
            ) : null}
            <StopLabels labels={labels} />
          </View>
        </Pressable>
        {narrow ? null : action}
      </View>
      {narrow && action ? <View className="flex-row px-3 pb-3">{action}</View> : null}
    </View>
  );
}

/** True when the text is so large, or the screen so narrow, that a row's words would be squeezed beside its button. */
function useNarrow() {
  const { width, fontScale } = useWindowDimensions();
  return width / fontScale < 300;
}

/** Their picture with the stop's number on the map, when it has one. */
function StopAvatar({ who, number, next = false }: { who: Entity; number: number; next?: boolean }) {
  return (
    <View>
      <Avatar entity={who} />
      {number > 0 ? (
        <View className={cn('absolute -bottom-1 -right-1 h-5 min-w-5 items-center justify-center rounded-full border-2 border-card px-0.5', next ? 'bg-primary' : 'bg-foreground')}>
          <Text className="text-2xs font-semibold text-background" maxFontSizeMultiplier={1.2}>
            {number}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
