// Today: what's next, the day's plan, follow-ups due and who to see.

import { Link } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { EntityRow, useProfileHref } from '@/components/entity';
import { PageHeader, PlaceholderNote, Screen, Section } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getEntity, getOrg } from '@/lib/data';
import { REP } from '@/lib/data/seed';
import { formatDate, greeting, plural } from '@/lib/format';
import { endTime } from '@/lib/plan';
import { useWorkspace } from '@/lib/store';
import type { PlanItem } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function Today() {
  const ctx = useWorkspace();
  const [day, setDay] = useState(ctx.todayIso);
  const isToday = day === ctx.todayIso;
  const plan = ctx.dayPlan(day);
  const active = plan.filter((i) => i.status !== 'cancelled');
  const remaining = active.filter((i) => i.status === 'planned');
  const due = ctx.openFollowUps().filter((f) => f.overdueBy >= 0);
  const overdue = due.filter((f) => f.overdueBy > 0).length;
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
            onPress={() => setDay(d.iso)}
            accessibilityRole="tab"
            accessibilityState={{ selected: d.iso === day }}
          >
            <Text>{d.label}</Text>
          </Button>
        ))}
      </View>

      <Section title={isToday ? 'Your plan' : 'Tomorrow’s plan'} sub={plan.length ? 'In route order' : undefined}>
        {plan.length ? (
          plan.map((item) => <PlanRow key={item.id} item={item} />)
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

      <Section title="Who to see" sub="Not yet planned, strongest signals first">
        {ctx.suggestions(day, 3).map(({ entity, signals }) => (
          <EntityRow key={entity.id} entity={entity} signals={signals} />
        ))}
      </Section>

      <PlaceholderNote>Scaffold: plan editing, the route map and visit logging come next.</PlaceholderNote>
    </Screen>
  );
}

function PlanRow({ item }: { item: PlanItem }) {
  const profileHref = useProfileHref();
  const who = getEntity(item.targetId);
  if (!who) return null;
  const cancelled = item.status === 'cancelled';
  return (
    <Link href={profileHref(who)} className="py-1">
      <View className="flex-row gap-3">
        <View className="w-16">
          <Text className={cn('font-mono text-xs', cancelled && 'line-through text-muted-foreground')}>
            {item.mode === 'timed' && item.time ? item.time : 'Flexible'}
          </Text>
          {item.mode === 'timed' && item.time ? <Text className="font-mono text-2xs text-muted-foreground">to {endTime(item)}</Text> : null}
        </View>
        <View className="flex-1 gap-0.5">
          <Text className={cn('font-semibold', cancelled && 'line-through text-muted-foreground')}>{who.name}</Text>
          <Text className="text-sm text-muted-foreground">
            {item.type} · {getOrg(item.siteId)?.name}
            {item.status === 'done' ? ' · Done' : cancelled ? ' · Cancelled' : ''}
          </Text>
        </View>
      </View>
    </Link>
  );
}
