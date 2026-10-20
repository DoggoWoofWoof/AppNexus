// Today: the day, a map of the stops and one row per visit, each saying why
// they're worth seeing. Tap a row for that person's page (log it, or say you can't
// make it); a visit whose time has gone, or an "Any time" one still open at 17:30,
// gets its own Log button. Above the day, one "Still to do" card holds what's left
// from before: visits earlier in the week never logged, and follow-ups due.
// "Add a visit" opens Targets, where + puts someone in the plan. One small Edit
// above the stops shows how to change the day: arrows move an "Any time" stop
// (timed ones go by their time), "Set a time" fixes one, and Remove takes it out.
// A visit with a time can only be moved or cancelled, as someone is expecting you.

import { router, useFocusEffect } from 'expo-router';
import { ArrowDown, ArrowUp, CalendarClock, ChevronRight, CircleCheck, Clock, ListTodo, Plus, Sparkles, Trash2, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { Avatar, useProfileHref } from '@/components/entity';
import { useLogSheet } from '@/components/log-sheet';
import { MenuButton } from '@/components/menu';
import { Screen } from '@/components/screen';
import { useStopTimeSheet } from '@/components/stop-time-sheet';
import { StopMap, type MapPin } from '@/components/stop-map';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useVisitSheets } from '@/components/visit-sheets';
import { getEntity, getOrg, shortName } from '@/lib/data';
import { formatDate, plural } from '@/lib/format';
import { isOnSite, notLogged } from '@/lib/plan';
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
  const { openLog, sheet } = useLogSheet();
  const { openStopTime, sheet: timeSheet } = useStopTimeSheet();
  const visits = useVisitSheets();
  const { width } = useWindowDimensions();
  // The day being edited, so switching days or tabs leaves Edit.
  const [editing, setEditing] = useState<string | null>(null);
  useFocusEffect(useCallback(() => () => setEditing(null), []));
  const [today, nextDay] = ctx.planDays();
  // The day is shared with Targets, so + there adds to the day shown here.
  const day = ctx.ws.selection.day === nextDay.iso ? nextDay.iso : today.iso;
  const isToday = day === today.iso;
  const plan = ctx.dayPlan(day);
  const active = plan.filter((i) => i.status !== 'cancelled');
  // A visit with a time is due a log once it's over; an "Any time" one from 17:30.
  const now = useMinutesNow();
  const unlogged = (i: PlanItem): boolean => isToday && notLogged(i, now);
  const next = isToday ? active.find((i) => i.status === 'planned' && !unlogged(i)) : undefined;
  const free = ctx.freeSlotsOn(day, new Date());
  const earlier = isToday
    ? ctx.unloggedBefore().flatMap((e) => {
        const who = getEntity(e.item.targetId);
        return who ? [{ ...e, who }] : [];
      })
    : [];
  const due = isToday ? ctx.openFollowUps().filter((f) => f.overdueBy >= 0) : [];
  const late = due.filter((f) => f.overdueBy > 0).length;
  // Editing ends by itself once there is nothing left to edit.
  const edit = editing === day && plan.length > 0;
  const done = active.filter((i) => i.status === 'done').length;
  const open = (targetId: string) => {
    const who = getEntity(targetId);
    if (who) router.push(profileHref(who));
  };
  const log = (item: PlanItem, on = day) => {
    const who = getEntity(item.targetId);
    if (who) openLog(who, { day: on, id: item.id, type: item.type }, on === today.iso ? {} : { title: `Log ${formatDate(on)}` });
  };
  const cantMakeIt = (item: PlanItem) => {
    const who = getEntity(item.targetId);
    if (who) visits.openCantMakeIt(who, { day, id: item.id, item });
  };
  const pickFive = () => ctx.addAllToPlan(ctx.suggestions(day, 5).map((s) => s.entity.id), day);

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
    <Screen inset>
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
            onPress={() => {
              ctx.chooseSlot(slot.itemId);
              router.navigate('/targets');
            }}
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
        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-sm text-muted-foreground" accessibilityLiveRegion="polite">
              {edit ? 'Arrows move an “Any time” stop' : `${plural(active.length, 'stop')}${done ? ` · ${done} done` : ''}`}
            </Text>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => setEditing(edit ? null : day)}
              accessibilityLabel={edit ? 'Done changing the day' : 'Edit the day: move, set a time or remove stops'}
            >
              <Text className="text-brand">{edit ? 'Done' : 'Edit'}</Text>
            </Button>
          </View>
          {plan.map((item) =>
            edit ? (
              <EditRow
                key={item.id}
                item={item}
                number={onSite.indexOf(item) + 1}
                first={active[0] === item}
                last={active[active.length - 1] === item}
                onMove={(direction) => ctx.moveStop(day, item.id, direction)}
                onSetTime={() => openStopTime(day, item)}
                onRemove={() => ctx.removeStop(day, item.id)}
                onCantMakeIt={() => cantMakeIt(item)}
              />
            ) : (
              <StopRow
                key={item.id}
                item={item}
                next={item === next}
                unlogged={unlogged(item)}
                number={onSite.indexOf(item) + 1}
                onPress={() => open(item.targetId)}
                onLog={() => log(item)}
              />
            ),
          )}
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
      {timeSheet}
      {visits.sheets}
    </Screen>
  );
}

function StopRow({
  item,
  next,
  unlogged,
  number,
  onPress,
  onLog,
}: {
  item: PlanItem;
  next: boolean;
  unlogged: boolean;
  number: number;
  onPress: () => void;
  onLog: () => void;
}) {
  const ctx = useWorkspace();
  const who = getEntity(item.targetId);
  if (!who) return null;
  const cancelled = item.status === 'cancelled';
  const done = item.status === 'done';
  const when = item.mode === 'timed' && item.time ? item.time : 'Any time';
  const unconfirmed = !done && !cancelled && !unlogged && item.booking === 'requested';
  const status = done ? (item.outcome === 'Attempted' ? 'Not in' : 'Done') : cancelled ? 'Cancelled' : unlogged ? 'Not logged yet' : next ? 'Next' : '';
  // Where to go for a visit, or how for a call.
  const how = isOnSite(item) ? (getOrg(item.siteId)?.name ?? '') : item.type;
  const sub = [when, how, status, unconfirmed && 'Not confirmed yet'].filter(Boolean).join(' · ');
  // Why they're worth seeing: the visit's own goal, or what makes them a priority.
  const why = done || cancelled ? '' : item.goal || ctx.signals(who)[0]?.label || '';

  // The row opens their page; Log sits beside it rather than inside, as a button can't hold another.
  return (
    <View
      className={cn(
        'min-h-16 flex-row items-center gap-2 rounded-xl bg-card pr-3',
        next ? 'border-2 border-primary' : 'border border-border',
        cancelled && 'opacity-60',
      )}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={[who.name, sub, why].filter(Boolean).join(', ')}
        className="flex-1 flex-row items-center gap-3 rounded-xl py-3 pl-3 active:bg-accent"
      >
        <StopAvatar who={who} number={done ? 0 : number} next={next} />
        <View className="flex-1 gap-0.5">
          <Text className={cn('text-base font-semibold', cancelled && 'line-through')}>{shortName(who)}</Text>
          <Text className={cn('text-sm', next ? 'font-medium text-brand' : unlogged || unconfirmed ? 'font-medium text-warn' : 'text-muted-foreground')}>{sub}</Text>
          {why ? (
            <Text className="text-sm text-muted-foreground" numberOfLines={1}>
              {why}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {done ? <Icon as={CircleCheck} size={22} className="text-success" /> : null}
      {unlogged ? (
        <Button size="sm" className="rounded-lg" onPress={onLog} accessibilityLabel={`Log the visit with ${who.name}`}>
          <Text>Log</Text>
        </Button>
      ) : null}
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

/**
 * A stop while the day is being changed. An "Any time" stop has arrows, Set a
 * time and Remove, with Undo. A timed one keeps its place by its time, and as
 * someone is expecting the rep, it can only be moved or cancelled. Logged and
 * cancelled visits stay as the record. Nothing here opens their page, so a tap
 * can't lose the edit.
 */
function EditRow({
  item,
  number,
  first,
  last,
  onMove,
  onSetTime,
  onRemove,
  onCantMakeIt,
}: {
  item: PlanItem;
  number: number;
  first: boolean;
  last: boolean;
  onMove: (direction: -1 | 1) => void;
  onSetTime: () => void;
  onRemove: () => void;
  onCantMakeIt: () => void;
}) {
  const who = getEntity(item.targetId);
  if (!who) return null;
  const done = item.status === 'done';
  const cancelled = item.status === 'cancelled';
  const flexible = item.mode !== 'timed' && item.status === 'planned';
  const when = item.mode === 'timed' && item.time ? item.time : 'Any time';
  const state = done ? 'Done' : cancelled ? 'Cancelled' : item.mode === 'timed' ? 'Stays at its time' : '';
  const sub = [when, isOnSite(item) ? '' : item.type, state].filter(Boolean).join(' · ');
  return (
    <View className={cn('gap-3 rounded-xl border border-border bg-card p-3', (done || cancelled) && 'opacity-60')}>
      <View className="flex-row items-center gap-3">
        <StopAvatar who={who} number={done ? 0 : number} />
        <View className="flex-1 gap-0.5">
          <Text className={cn('text-base font-semibold', cancelled && 'line-through')}>{shortName(who)}</Text>
          <Text className="text-sm text-muted-foreground">{sub}</Text>
        </View>
        {flexible ? (
          <View className="flex-row gap-1">
            <Button size="icon" variant="outline" className="rounded-lg" disabled={first} onPress={() => onMove(-1)} accessibilityLabel={`Move ${who.name} earlier`}>
              <Icon as={ArrowUp} size={18} />
            </Button>
            <Button size="icon" variant="outline" className="rounded-lg" disabled={last} onPress={() => onMove(1)} accessibilityLabel={`Move ${who.name} later`}>
              <Icon as={ArrowDown} size={18} />
            </Button>
          </View>
        ) : null}
      </View>
      {flexible ? (
        <View className="flex-row gap-2">
          <Button size="sm" variant="outline" className="flex-1 rounded-lg" onPress={onSetTime} accessibilityLabel={`Set a time for ${who.name}`}>
            <Icon as={Clock} size={16} />
            <Text>Set a time</Text>
          </Button>
          <Button size="sm" variant="outline" className="flex-1 rounded-lg" onPress={onRemove} accessibilityLabel={`Take ${who.name} out of the plan`}>
            <Icon as={Trash2} size={16} className="text-danger" />
            <Text className="text-danger">Remove</Text>
          </Button>
        </View>
      ) : item.status === 'planned' ? (
        <Button size="sm" variant="outline" className="rounded-lg" onPress={onCantMakeIt} accessibilityLabel={`Can’t make it to ${who.name} at ${item.time}: move or cancel`}>
          <Icon as={CalendarClock} size={16} />
          <Text>Can’t make it</Text>
        </Button>
      ) : null}

    </View>
  );
}
