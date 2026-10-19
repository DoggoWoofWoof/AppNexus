// Today: what's next, the day's plan, follow-ups due and who to see.
// Tapping a stop opens its options: prepare, confirm, log, reschedule or cancel.

import { router } from 'expo-router';
import { CalendarPlus, ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { EntityRow, Tag } from '@/components/entity';
import { PageHeader, PlaceholderNote, Screen, Section } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useVisitSheets } from '@/components/visit-sheets';
import { getEntity, getOrg } from '@/lib/data';
import { REP } from '@/lib/data/seed';
import { formatDate, greeting, plural } from '@/lib/format';
import { endTime } from '@/lib/plan';
import { useWorkspace } from '@/lib/store';
import type { PlanItem } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function Today() {
  const ctx = useWorkspace();
  const { openVisit, sheets } = useVisitSheets();
  // The day is shared with Targets, so filling a free slot comes back to that day.
  const day = ctx.planDays().some((d) => d.iso === ctx.ws.selection.day) ? ctx.ws.selection.day : ctx.todayIso;
  const isToday = day === ctx.todayIso;
  const plan = ctx.dayPlan(day);
  const active = plan.filter((i) => i.status !== 'cancelled');
  const remaining = active.filter((i) => i.status === 'planned');
  const due = ctx.openFollowUps().filter((f) => f.overdueBy >= 0);
  const overdue = due.filter((f) => f.overdueBy > 0).length;
  const free = ctx.ws.replacement?.day === day ? ctx.ws.replacement : null;
  const summary = [
    active.length ? `${plural(active.length, 'stop')} planned` : 'Nothing planned yet',
    remaining.length !== active.length ? `${active.length - remaining.length} done` : '',
    isToday && due.length ? `${plural(due.length, 'follow-up')} due${overdue ? ` (${overdue} overdue)` : ''}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen inset>
      <PageHeader
        kicker={formatDate(ctx.today, { weekday: 'long', day: 'numeric', month: 'long' })}
        title={`${greeting()}, ${REP.firstName}`}
        sub={`${summary}.`}
      />

      <View className="flex-row gap-2" accessibilityRole="tablist">
        {ctx.planDays().map((d) => (
          <Button
            key={d.iso}
            size="sm"
            variant={d.iso === day ? 'default' : 'outline'}
            onPress={() => ctx.selectDay(d.iso)}
            accessibilityRole="tab"
            accessibilityState={{ selected: d.iso === day }}
          >
            <Text>{d.label}</Text>
          </Button>
        ))}
      </View>

      {free ? (
        <View className="gap-3 rounded-lg border border-primary bg-accent p-4" accessibilityRole="summary">
          <View className="flex-row items-start gap-2">
            <Icon as={CalendarPlus} size={18} className="mt-0.5 text-brand" />
            <Text className="flex-1 text-accent-foreground">
              <Text className="font-semibold text-accent-foreground">{`${free.time} is free`}</Text>
              {` after ${free.name} cancelled. Find someone near ${getOrg(free.siteId)?.name}?`}
            </Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            <Button size="sm" onPress={() => router.navigate('/targets')}>
              <Text>Find nearby</Text>
            </Button>
            <Button size="sm" variant="ghost" onPress={ctx.clearReplacement}>
              <Text>Leave it free</Text>
            </Button>
          </View>
        </View>
      ) : null}

      <Section title={isToday ? 'Your plan' : 'Tomorrow’s plan'} sub={plan.length ? 'Tap a stop for options' : undefined}>
        {plan.length ? (
          plan.map((item) => <PlanRow key={item.id} item={item} onPress={() => openVisit(day, item.id)} />)
        ) : (
          <Text className="text-muted-foreground">No visits planned. Suggestions below are a good start.</Text>
        )}
      </Section>

      {isToday && due.length ? (
        <Section title="Follow-ups due" sub={overdue ? `${overdue} overdue` : undefined}>
          {due.map((f) => {
            const who = getEntity(f.targetId);
            return (
              <View key={f.id} className="gap-0.5 border-b border-border pb-2 last:border-b-0">
                <Text>{f.text}</Text>
                <Text className={cn('text-sm', f.overdueBy > 0 ? 'text-warn' : 'text-muted-foreground')}>
                  {who?.name} · {f.overdueBy > 0 ? `${plural(f.overdueBy, 'day')} overdue` : 'Due today'}
                </Text>
              </View>
            );
          })}
        </Section>
      ) : null}

      <Section title="Who to see" sub="Top of your Targets list: follow-ups, leakage and volume">
        {ctx.suggestions(day, 3).map(({ entity, signals }) => (
          <EntityRow key={entity.id} entity={entity} signals={signals} />
        ))}
      </Section>

      <PlaceholderNote>Still to come here: the route map and editing the plan.</PlaceholderNote>
      {sheets}
    </Screen>
  );
}

function PlanRow({ item, onPress }: { item: PlanItem; onPress: () => void }) {
  const who = getEntity(item.targetId);
  if (!who) return null;
  const cancelled = item.status === 'cancelled';
  const timed = item.mode === 'timed' && item.time;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${timed ? item.time : 'Any time'}, ${who.name}${cancelled ? ', cancelled' : ''}`}
      accessibilityHint="Opens options for this visit"
      className="flex-row items-center gap-3 rounded-md py-1.5 active:bg-accent"
    >
      <View className="w-14">
        <Text className={cn('font-mono text-xs', cancelled && 'text-muted-foreground line-through')}>{timed ? item.time : 'Any time'}</Text>
        {timed ? <Text className="font-mono text-2xs text-muted-foreground">to {endTime(item)}</Text> : null}
      </View>
      <View className="flex-1 gap-1">
        <Text className={cn('font-semibold', cancelled && 'text-muted-foreground line-through')}>{who.name}</Text>
        <Text className="text-sm text-muted-foreground">
          {item.type} · {getOrg(item.siteId)?.name}
        </Text>
        {item.status === 'done' ? (
          <Tag label="Done" tone="success" />
        ) : cancelled ? (
          <Tag label="Cancelled" />
        ) : item.booking === 'requested' ? (
          <Tag label="Requested" tone="warn" />
        ) : null}
      </View>
      <Icon as={ChevronRight} size={18} className="text-muted-foreground" />
    </Pressable>
  );
}
