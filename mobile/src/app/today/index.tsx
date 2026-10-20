// Today: the day, a map of the stops and one row per visit, each saying why
// they're worth seeing. Tap a row for that person's page; a visit whose time has
// gone, or an "Any time" one still open at 17:30, gets its own Log button, and the
// others a ⋯ that opens "Change visit" right here, like tapping an event in a
// phone's calendar. "Any time" stops have dots to drag them into another order.
// Above the day, one "Still to do" card holds what's left from before: visits
// earlier in the week never logged, and follow-ups due.
// "Add a visit" opens Targets, where + puts someone in the plan where it adds the
// least driving. Each stop has a time, "About 10:45" for an "Any time" one, worked
// out from the drive between stops and their usual times. The drive to each stop
// is on a line between it and the one before, like directions in a maps app, and
// the next one says when to leave; a line over the day says how much driving and
// when it should finish. A freed time offers the three best people to see instead.
// "Best order" (when it would help) puts the "Any time" stops in the order with the
// least driving, with Undo.

import { router } from 'expo-router';
import { Car, ChevronRight, CircleCheck, Ellipsis, GripVertical, ListTodo, Plus, Sparkles, X } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, useWindowDimensions, View } from 'react-native';

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
import { formatDate, formatMinutes, fromMinutes, plural } from '@/lib/format';
import { fixedStops, isOnSite, notLogged, type Clash, type Stop } from '@/lib/plan';
import { useWorkspace } from '@/lib/store';
import type { Entity, PlanItem } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Minutes since midnight, to tell which of today's visits have already happened. */
const minutesNow = (now = new Date()): number => now.getHours() * 60 + now.getMinutes();

/** Minutes since midnight, kept up to date, so a visit is flagged when its time passes with the app open. */
function useMinutesNow(): number {
  const [now, setNow] = useState(minutesNow);
  useEffect(() => {
    const timer = setInterval(() => setNow(minutesNow()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export default function Today() {
  const ctx = useWorkspace();
  const profileHref = useProfileHref();
  const visits = useVisitSheets();
  const { openLog, sheet } = useLogSheet({ onNotIn: visits.openNotIn });
  const { width } = useWindowDimensions();
  const [today, nextDay] = ctx.planDays();
  // The day is shared with Targets, so + there adds to the day shown here.
  const day = ctx.ws.selection.day === nextDay.iso ? nextDay.iso : today.iso;
  const isToday = day === today.iso;
  const now = useMinutesNow();
  const plan = ctx.dayPlan(day, new Date());
  const active = plan.filter((i) => i.status !== 'cancelled');
  // When each stop is and the drive to it, from the order and their usual times.
  const schedule = ctx.daySchedule(day, new Date());
  const stopOf = new Map(schedule.stops.map((s) => [s.item.id, s]));
  // Visits with a time too close to get between, said on the later one.
  const clashOf = new Map(schedule.clashes.map((c) => [c.later.id, c]));
  // A visit with a time is due a log once it's over; an "Any time" one from 17:30.
  const unlogged = (i: PlanItem): boolean => isToday && notLogged(i, now);
  const next = isToday ? active.find((i) => i.status === 'planned' && !unlogged(i)) : undefined;
  // When to set off for the next stop today, or the first one on another day.
  const going = isToday ? next : active.find((i) => i.status === 'planned');
  const goingStop = going && stopOf.get(going.id);
  const leaveAt = goingStop && goingStop.travel > 0 && (!isToday || goingStop.start > now) ? goingStop.start - goingStop.travel : null;
  const leave = leaveAt == null ? '' : isToday && leaveAt <= now ? 'Leave now' : `Leave by ${fromMinutes(leaveAt)}`;
  const free = ctx.freeSlotsOn(day, new Date());
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
  const finish = active.some((i) => i.status === 'planned') ? Math.max(...schedule.stops.map((s) => s.end)) : null;
  const summary = [
    plural(active.length, 'stop'),
    done ? `${done} done` : '',
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
  const pickFive = () => ctx.addAllToPlan(ctx.suggestions(day, 5).map((s) => s.entity.id), day);

  // Dragging an "Any time" stop by its dots: which one, where it was, where it
  // would land, and how far the stops it passes move to make room.
  const [drag, setDrag] = useState<{ id: string; from: number; to: number; room: number } | null>(null);
  // Made once: the web has no useAnimatedValue.
  const [dragY] = useState(() => new Animated.Value(0));
  // How tall each stop is, with the drive line above it, to tell where a dragged one
  // would land. Where they are is worked out from the order, as the web doesn't say
  // when one only moves.
  const heights = useRef(new Map<string, number>());
  const movable = (i: PlanItem) => i.status === 'planned' && i.mode !== 'timed' && !unlogged(i);
  const handles = active.length > 1 && active.some(movable);
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

  return (
    <Screen inset scrollEnabled={!drag}>
      <View className="flex-row items-center gap-2">
        <MenuButton />
        <Text variant="h1" className="flex-1">
          {formatDate(day, { weekday: 'long' })}
        </Text>
        <Button
          size="sm"
          variant="ghost"
          onPress={() => ctx.selectDay(isToday ? nextDay.iso : today.iso)}
          accessibilityLabel={isToday ? `Show ${ctx.dayWord(nextDay.iso)}` : 'Back to today'}
        >
          <Text className="text-brand">{isToday ? nextDay.label : 'Today'}</Text>
        </Button>
      </View>

      {/* What's left from before, in one quiet card so the day stays the main thing:
          visits never logged (log them on their day, or say they didn't happen), then follow-ups due. */}
      {earlier.length || due.length ? (
        <View className="gap-2">
          <Text className="text-sm text-muted-foreground">Still to do</Text>
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
                <View className="flex-1 gap-0.5">
                  <Text className="text-base font-semibold">{`${plural(due.length, 'follow-up')} due`}</Text>
                  <Text className="text-sm text-muted-foreground">
                    {[late && `${late} late`, due.length - late && `${due.length - late} due today`].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text className="text-base text-brand">See them</Text>
                <Icon as={ChevronRight} size={18} className="text-brand" />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

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

      {pins.length ? (
        <View className="gap-1">
          <StopMap
            pins={pins}
            start={{ coords: ctx.start.coords, label: `${ctx.start.title}, ${ctx.start.place}` }}
            route
            onPinPress={open}
            label={`Map of ${ctx.dayWord(day)}’s stops`}
            // Taller on a wider screen, such as an iPad, up to the column's width.
            height={Math.round(Math.min(360, Math.max(190, (Math.min(width, 720) - 32) * 0.55)))}
          />
          <Text className="text-sm text-muted-foreground">{`From ${ctx.start.title}, ${ctx.start.place} · straight lines, not roads`}</Text>
        </View>
      ) : null}

      {plan.length ? (
        // On the web a drag with the mouse would otherwise select the text it passes.
        <View className="gap-2 web:select-none">
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-sm text-muted-foreground" accessibilityLiveRegion="polite">
              {summary}
            </Text>
            {ctx.bestOrderHelps(day, new Date()) ? (
              <Button size="sm" variant="ghost" onPress={() => ctx.bestOrder(day)} accessibilityLabel="Put the Any time stops in the order with the least driving">
                <Text className="text-brand">Best order</Text>
              </Button>
            ) : null}
          </View>
          {plan.map((item) => {
            const stop = stopOf.get(item.id);
            const clash = clashOf.get(item.id);
            // Said on the stop itself: an "Any time" one put outside their usual times, or late.
            const warnings = stop && item.status === 'planned' ? [stop.outside && 'Not their usual time', stop.late && 'After 17:30'].filter((w): w is string => !!w) : [];
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
          {active.some((i) => i.status === 'planned' && !unlogged(i)) ? (
            <Text className="text-sm text-muted-foreground">{`${handles ? 'Drag the dots to change the order. ' : ''}Tap ⋯ to change or cancel a visit.`}</Text>
          ) : null}
        </View>
      ) : (
        <View className="items-center gap-3 py-8">
          <View className="items-center gap-1">
            <Text className="text-lg font-semibold">Nothing planned yet</Text>
            <Text className="text-center text-muted-foreground">Pick who to see, or let the app pick the five most worth seeing.</Text>
          </View>
          <Button variant="outline" className="rounded-xl" onPress={pickFive}>
            <Icon as={Sparkles} size={18} className="text-brand" />
            <Text className="text-brand">Pick 5 for me</Text>
          </Button>
        </View>
      )}

      <Button
        size="lg"
        variant={plan.length ? 'outline' : 'default'}
        className="rounded-xl"
        onPress={() => router.navigate('/targets')}
      >
        <Icon as={Plus} size={20} className={plan.length ? undefined : 'text-primary-foreground'} />
        <Text className="text-lg">{plan.length ? 'Add a visit' : 'Choose who to see'}</Text>
      </Button>
      {sheet}
      {visits.sheets}
    </Screen>
  );
}

/** What's wrong with two visits with a time, in words. */
function clashText(clash: Clash): string {
  const before = getEntity(clash.earlier.targetId);
  const name = before ? shortName(before) : 'the visit before';
  return clash.kind === 'overlap' ? `Overlaps the visit with ${name}` : `Too tight: ${clash.need} min drive from ${name}, only ${clash.free} min between`;
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
  next: boolean;
  unlogged: boolean;
  number: number;
  /** Being dragged. */
  lifted: boolean;
  /** The dots to drag it by, null for a stop that can't move, or undefined when none in the day can. */
  handle: ReactNode | undefined;
  onPress: () => void;
  onLog: () => void;
  onChange: () => void;
}) {
  const ctx = useWorkspace();
  const who = getEntity(item.targetId);
  if (!who) return null;
  const cancelled = item.status === 'cancelled';
  const done = item.status === 'done';
  // An "Any time" stop still to do says about when, from the drive and their usual times.
  const when = item.mode === 'timed' && item.time ? item.time : stop && item.status === 'planned' ? `About ${fromMinutes(stop.start)}` : 'Any time';
  const unconfirmed = !done && !cancelled && !unlogged && item.booking === 'requested';
  const status = done ? (item.outcome === 'Attempted' ? 'Not in' : 'Done') : cancelled ? 'Cancelled' : unlogged ? 'Not logged yet' : next ? 'Next' : '';
  // Where to go for a visit, or how for a call.
  const how = isOnSite(item) ? (getOrg(item.siteId)?.name ?? '') : item.type;
  const sub = [when, how, status, unconfirmed && 'Not confirmed yet'].filter(Boolean).join(' · ');
  // Why they're worth seeing: the visit's own goal, or what makes them a priority.
  const why = done || cancelled ? '' : item.goal || ctx.signals(who)[0]?.label || '';

  // The row opens their page; Log and ⋯ sit beside it rather than inside, as a button can't hold another.
  return (
    <View
      className={cn(
        'min-h-16 flex-row items-center gap-1 rounded-xl bg-card pr-1',
        next || lifted ? 'border-2 border-primary' : 'border border-border',
        lifted && 'shadow-lg',
        cancelled && 'opacity-60',
      )}
    >
      {handle === undefined ? null : (handle ?? <View className="w-9" />)}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={[who.name, sub, ...warnings, why].filter(Boolean).join(', ')}
        className={cn('flex-1 flex-row items-center gap-3 rounded-xl py-3 active:bg-accent', handle === undefined && 'pl-3')}
      >
        <StopAvatar who={who} number={done ? 0 : number} next={next} />
        <View className="flex-1 gap-0.5">
          <Text className={cn('text-base font-semibold', cancelled && 'line-through')}>{shortName(who)}</Text>
          <Text className={cn('text-sm', next ? 'font-medium text-brand' : unlogged || unconfirmed ? 'font-medium text-warn' : 'text-muted-foreground')}>{sub}</Text>
          {warnings.map((w) => (
            <Text key={w} className="text-sm font-medium text-warn">
              {w}
            </Text>
          ))}
          {why ? (
            <Text className="text-sm text-muted-foreground" numberOfLines={1}>
              {why}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {done ? (
        <View className="min-h-11 min-w-11 items-center justify-center">
          <Icon as={CircleCheck} size={22} className="text-success" />
        </View>
      ) : unlogged ? (
        <Button size="sm" className="mr-2 rounded-lg" onPress={onLog} accessibilityLabel={`Log the visit with ${who.name}`}>
          <Text>Log</Text>
        </Button>
      ) : cancelled ? (
        <View className="min-h-11 min-w-11" />
      ) : (
        <Button size="icon" variant="ghost" className="rounded-lg" onPress={onChange} accessibilityLabel={`Change the visit with ${who.name}`}>
          <Icon as={Ellipsis} size={22} className="text-foreground" />
        </Button>
      )}
    </View>
  );
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
