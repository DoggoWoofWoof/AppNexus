// Activity: follow-ups to clear (tap one for the person, Done to tick it off),
// then the visit journal, which can be searched by any word in a note.

import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { InteractionItem } from '@/components/activity-log';
import { useProfileHref } from '@/components/entity';
import { TabHeader } from '@/components/menu';
import { Screen, Section } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { getEntity } from '@/lib/data';
import { plural, relativeDay } from '@/lib/format';
import { useWorkspace } from '@/lib/store';
import { cn } from '@/lib/utils';
import { newestFirst } from '@/lib/workspace';

const RECENT = 6;

export default function Activity() {
  const ctx = useWorkspace();
  const profileHref = useProfileHref();
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(false);
  const open = ctx.openFollowUps();
  const groups = [
    { title: 'Overdue', items: open.filter((f) => f.overdueBy > 0), tone: 'text-warn' },
    { title: 'Due today', items: open.filter((f) => f.overdueBy === 0), tone: 'text-foreground' },
    { title: 'Coming up', items: open.filter((f) => f.overdueBy < 0), tone: 'text-muted-foreground' },
  ].filter((g) => g.items.length);
  const openPerson = (id: string) => {
    const who = getEntity(id);
    if (who) router.push(profileHref(who));
  };

  const words = query.trim().toLowerCase();
  const notes = ctx.ws.interactions.filter((i) => !i.deleted).sort(newestFirst);
  const found = words
    ? notes.filter((i) => [i.note, i.type, i.outcome, i.author, getEntity(i.targetId)?.name, ...(i.contacts ?? [])].join(' ').toLowerCase().includes(words))
    : notes;
  const shown = words || all ? found : found.slice(0, RECENT);

  return (
    <Screen inset>
      <TabHeader title="Activity" sub={plural(open.length, 'open follow-up')} />

      {groups.map((g) => (
        <Section key={g.title} title={g.title} sub={plural(g.items.length, 'follow-up')}>
          {g.items.map((f) => (
            <View key={f.id} className="flex-row items-center gap-2">
              <Pressable onPress={() => openPerson(f.targetId)} accessibilityRole="link" className="flex-1 gap-0.5 rounded-md py-1 active:bg-accent">
                <Text>{f.text}</Text>
                <Text className={cn('text-sm', g.tone)}>
                  {getEntity(f.targetId)?.name} · {relativeDay(f.due, ctx.today)}
                </Text>
              </Pressable>
              <Button size="sm" variant="outline" className="rounded-lg" onPress={() => ctx.completeFollowUp(f.id)} accessibilityLabel={`Done: ${f.text}`}>
                <Icon as={Check} size={16} />
                <Text>Done</Text>
              </Button>
            </View>
          ))}
        </Section>
      ))}

      <Section title="Visits and notes" sub="Yours and your team’s">
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Find a note by any word"
          accessibilityLabel="Find a note"
          returnKeyType="search"
          autoCorrect={false}
          className="rounded-xl"
        />
        {words ? (
          <Text className="text-sm text-muted-foreground" accessibilityLiveRegion="polite">
            {found.length ? `${plural(found.length, 'note')} with “${query.trim()}”` : `No notes with “${query.trim()}”`}
          </Text>
        ) : null}
        {shown.map((i) => (
          <Pressable key={i.id} onPress={() => openPerson(i.targetId)} accessibilityRole="link" className="rounded-md py-1 active:bg-accent">
            <InteractionItem interaction={i} about="" />
          </Pressable>
        ))}
        {!words && !all && found.length > RECENT ? (
          <Button variant="ghost" className="self-start" onPress={() => setAll(true)}>
            <Text className="text-brand">{`Show all ${found.length}`}</Text>
          </Button>
        ) : null}
      </Section>
    </Screen>
  );
}
