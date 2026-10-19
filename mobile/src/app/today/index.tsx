// Today: the day, a map of the stops and one row per visit, each saying why
// they're worth seeing. Tap a row for that person's page (log it, or say you can't
// make it); a visit whose time has gone and isn't logged gets its own Log button.
// "Add a visit" opens Targets, where + puts someone in the plan.

import { router } from 'expo-router';
import { ChevronRight, CircleCheck, Plus, Sparkles, X } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Avatar, useProfileHref } from '@/components/entity';
import { useLogSheet } from '@/components/log-sheet';
import { MenuButton } from '@/components/menu';
import { Screen } from '@/components/screen';
import { StopMap, type MapPin } from '@/components/stop-map';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { getEntity, getOrg, shortName } from '@/lib/data';
import { REP } from '@/lib/data/seed';
import { formatDate, plural, toMinutes } from '@/lib/format';
import { isOnSite } from '@/lib/plan';
import { useWorkspace } from '@/lib/store';
import type { PlanItem } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Minutes since midnight, to tell which of today's visits have already happened. */
const minutesNow = (now = new Date()): number => now.getHours() * 60 + now.getMinutes();

export default function Today() {
  const ctx = useWorkspace();
  const profileHref = useProfileHref();
  const { openLog, sheet } = useLogSheet();
  const [today, tomorrow] = ctx.planDays();
  // The day is shared with Targets, so + there adds to the day shown here.
  const day = ctx.ws.selection.day === tomorrow.iso ? tomorrow.iso : today.iso;
  const isToday = day === today.iso;
  const plan = ctx.dayPlan(day);
  const active = plan.filter((i) => i.status !== 'cancelled');
  // A timed visit that has ended and is still only planned hasn't been logged.
  const now = minutesNow();
  const unlogged = (i: PlanItem): boolean => isToday && i.status === 'planned' && i.mode === 'timed' && !!i.time && toMinutes(i.time) + i.duration <= now;
  const next = isToday ? active.find((i) => i.status === 'planned' && !unlogged(i)) : undefined;
  const free = ctx.ws.replacement?.day === day ? ctx.ws.replacement : null;
  const due = isToday ? ctx.openFollowUps().filter((f) => f.overdueBy >= 0).length : 0;
  const open = (targetId: string) => {
    const who = getEntity(targetId);
    if (who) router.push(profileHref(who));
  };
  const log = (item: PlanItem) => {
    const who = getEntity(item.targetId);
    if (who) openLog(who, { day, id: item.id, type: item.type });
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
          onPress={() => ctx.selectDay(isToday ? tomorrow.iso : today.iso)}
          accessibilityLabel={isToday ? 'Show tomorrow' : 'Back to today'}
        >
          <Text className="text-brand">{isToday ? 'Tomorrow' : 'Today'}</Text>
        </Button>
      </View>

      {due ? (
        <Pressable
          onPress={() => router.navigate('/activity')}
          accessibilityRole="link"
          accessibilityHint="Opens Activity"
          className="min-h-12 flex-row items-center gap-2 rounded-xl bg-warn-soft px-4 py-2 active:opacity-80"
        >
          <Text className="flex-1 text-base font-semibold">{`${plural(due, 'follow-up')} due`}</Text>
          <Text className="text-base text-brand">See them</Text>
          <Icon as={ChevronRight} size={16} className="text-brand" />
        </Pressable>
      ) : null}

      {free ? (
        <View className="flex-row items-center gap-3 rounded-xl bg-brand-soft py-2 pl-4 pr-1">
          <Text className="flex-1 text-base">
            <Text className="text-base font-semibold">{`${free.time} is free.`}</Text>
            {` ${free.name.replace(/^Dr\. \S+ /, 'Dr. ')} can’t make it.`}
          </Text>
          <Button size="sm" className="rounded-lg" onPress={() => router.navigate('/targets')}>
            <Text>Find someone</Text>
          </Button>
          <Button size="icon" variant="ghost" onPress={ctx.clearReplacement} accessibilityLabel="Leave it free">
            <Icon as={X} size={18} className="text-muted-foreground" />
          </Button>
        </View>
      ) : null}

      {pins.length ? (
        <StopMap
          pins={pins}
          start={{ coords: REP.start.coords, label: REP.start.label }}
          route
          onPinPress={open}
          label={`Map of ${isToday ? 'today’s' : 'tomorrow’s'} stops`}
          height={190}
        />
      ) : null}

      {plan.length ? (
        <View className="gap-2">
          {plan.map((item) => (
            <StopRow
              key={item.id}
              item={item}
              next={item === next}
              unlogged={unlogged(item)}
              number={onSite.indexOf(item) + 1}
              onPress={() => open(item.targetId)}
              onLog={() => log(item)}
            />
          ))}
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
  const status = done ? 'Done' : cancelled ? 'Cancelled' : unlogged ? 'Not logged yet' : next ? 'Next' : '';
  const how = isOnSite(item) ? '' : item.type;
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
        <View>
          <Avatar entity={who} />
          {number > 0 && !done ? (
            <View className={cn('absolute -bottom-1 -right-1 h-5 min-w-5 items-center justify-center rounded-full border-2 border-card px-0.5', next ? 'bg-primary' : 'bg-foreground')}>
              <Text className="text-2xs font-semibold text-background" maxFontSizeMultiplier={1.2}>
                {number}
              </Text>
            </View>
          ) : null}
        </View>
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
