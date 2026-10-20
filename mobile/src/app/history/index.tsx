// History, from the menu: the conversations from Ask, today's still going and
// earlier ones to read again as they were, then the people and accounts the rep
// opened. All of it is kept on this phone, and can be cleared.

import { router } from 'expo-router';
import { ChevronRight, History as HistoryIcon, MessageCircle } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Confirm } from '@/components/confirm';
import { Avatar, useChatHref, useProfileHref } from '@/components/entity';
import { TabHeader } from '@/components/menu';
import { EmptyState } from '@/components/profile';
import { Screen, Section } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { KEEP_CONVERSATIONS, TERRITORY, useChat, whenLabel, type ConversationItem } from '@/lib/chat';
import { getEntity, shortName, subtitle } from '@/lib/data';
import { plural } from '@/lib/format';
import { useWorkspace } from '@/lib/store';
import type { Entity } from '@/lib/types';

export default function History() {
  const ctx = useWorkspace();
  const chat = useChat();
  const chatHref = useChatHref();
  const profileHref = useProfileHref();
  const [clearing, setClearing] = useState(false);
  const talks = chat.conversations();
  const opened = chat.recentlyOpened().map((o) => ({ ...o, entity: getEntity(o.id) as Entity }));

  const open = (c: ConversationItem) => {
    const entity = getEntity(c.key);
    // Today's are still going, so they open where the rep can carry on.
    if (c.live && c.key === TERRITORY) router.navigate('/ask');
    else if (c.live && entity) router.push(chatHref(entity));
    else router.push({ pathname: '/history/[id]', params: { id: c.id } });
  };

  return (
    <Screen inset>
      <TabHeader title="History" sub="Your conversations and who you looked at" />

      <Section title="Conversations" sub={`From Ask, newest first. The last ${KEEP_CONVERSATIONS} are kept on this phone.`}>
        {talks.length ? (
          talks.map((c) => {
            const entity = c.key === TERRITORY ? null : getEntity(c.key);
            const when = whenLabel(c.at, ctx.today);
            return (
              <Item
                key={c.id}
                lead={entity ? <Avatar entity={entity} /> : <AskMark />}
                title={c.title}
                sub={[entity ? `About ${shortName(entity)}` : 'Ask', plural(c.questions, 'question'), c.live ? `${when} · carry on` : when].join(' · ')}
                onPress={() => open(c)}
              />
            );
          })
        ) : (
          <EmptyState icon={MessageCircle} title="No conversations yet" body="What you ask in Ask shows here, so you can read it again." />
        )}
      </Section>

      <Section title="People you opened" sub="Newest first">
        {opened.length ? (
          opened.map(({ id, at, entity }) => (
            <Item key={id} lead={<Avatar entity={entity} />} title={entity.name} sub={`${subtitle(entity)} · ${whenLabel(at, ctx.today)}`} onPress={() => router.push(profileHref(entity))} />
          ))
        ) : (
          <EmptyState icon={HistoryIcon} title="Nobody yet" body="Doctors and accounts you open show here, to find them again quickly." />
        )}
      </Section>

      {talks.length || opened.length ? (
        <Button variant="ghost" className="self-start" onPress={() => setClearing(true)}>
          <Text className="text-destructive">Clear history</Text>
        </Button>
      ) : null}

      <Confirm
        open={clearing}
        title="Clear your history?"
        body="Your conversations and the list of people you opened are taken off this phone. Saved reports, notes and your plan stay."
        action="Clear history"
        onConfirm={chat.forgetAll}
        onClose={() => setClearing(false)}
      />
    </Screen>
  );
}

function AskMark() {
  return (
    <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-soft">
      <Icon as={MessageCircle} size={20} className="text-brand" />
    </View>
  );
}

function Item({ lead, title, sub, onPress }: { lead: ReactNode; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" className="min-h-14 flex-row items-center gap-3 rounded-md py-1.5 active:bg-accent">
      {lead}
      <View className="flex-1 gap-0.5">
        <Text className="font-semibold" numberOfLines={2}>
          {title}
        </Text>
        <Text className="text-sm text-muted-foreground">{sub}</Text>
      </View>
      <Icon as={ChevronRight} size={18} className="text-muted-foreground" />
    </Pressable>
  );
}
