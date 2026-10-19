// Activity: follow-ups to clear, then the visit journal.

import { View } from 'react-native';

import { PageHeader, PlaceholderNote, Screen, Section } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { getEntity } from '@/lib/data';
import { formatDate, plural, relativeDay } from '@/lib/format';
import { useWorkspace } from '@/lib/store';
import { cn } from '@/lib/utils';
import { newestFirst } from '@/lib/workspace';

export default function Activity() {
  const ctx = useWorkspace();
  const open = ctx.openFollowUps();
  const groups = [
    { title: 'Overdue', items: open.filter((f) => f.overdueBy > 0), tone: 'text-warn' },
    { title: 'Due today', items: open.filter((f) => f.overdueBy === 0), tone: 'text-foreground' },
    { title: 'Coming up', items: open.filter((f) => f.overdueBy < 0), tone: 'text-muted-foreground' },
  ].filter((g) => g.items.length);
  const journal = ctx.ws.interactions
    .filter((i) => !i.deleted)
    .sort(newestFirst)
    .slice(0, 6);

  return (
    <Screen inset>
      <PageHeader title="Activity" sub={`${plural(open.length, 'open follow-up')}`} />

      {groups.map((g) => (
        <Section key={g.title} title={g.title} sub={plural(g.items.length, 'follow-up')}>
          {g.items.map((f) => (
            <View key={f.id} className="gap-0.5">
              <Text>{f.text}</Text>
              <Text className={cn('text-sm', g.tone)}>
                {getEntity(f.targetId)?.name} · {relativeDay(f.due, ctx.today)}
              </Text>
            </View>
          ))}
        </Section>
      ))}

      <Section title="Recent visits" sub="Your notes and your team’s">
        {journal.map((i) => (
          <View key={i.id} className="gap-0.5">
            <Text className="font-semibold">{getEntity(i.targetId)?.name}</Text>
            <Text className="text-sm text-muted-foreground">
              {formatDate(i.date)} · {i.type} · {i.author}
            </Text>
            <Text className="text-sm" numberOfLines={3}>
              {i.note}
            </Text>
          </View>
        ))}
      </Section>

      <PlaceholderNote>Scaffold: completing follow-ups, editing notes and search come next.</PlaceholderNote>
    </Screen>
  );
}
