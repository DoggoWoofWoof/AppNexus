// History, from the History button on Ask and from the menu: every Ask
// conversation, like the list of chats in a chat app. Each is titled by its first
// question, newest first under Today, Yesterday and Earlier, and opens in its chat
// to carry on: the Ask tab, or the person's own Ask. "New chat" starts afresh.
// Then the people and accounts the rep opened. All of it is kept on this phone,
// and can be cleared.

import { router, Stack } from 'expo-router';
import { ChevronRight, History as HistoryIcon, MessageCircle, SquarePen } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Confirm } from '@/components/confirm';
import { Avatar, useChatHref, useProfileHref } from '@/components/entity';
import { EmptyState } from '@/components/profile';
import { Screen, Section } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { groupConversations, KEEP_CONVERSATIONS, listWhen, TERRITORY, useChat, whenLabel, type ConversationItem } from '@/lib/chat';
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
  const [deleting, setDeleting] = useState<ConversationItem | null>(null);
  const talks = chat.conversations();
  const opened = chat.recentlyOpened().map((o) => ({ ...o, entity: getEntity(o.id) as Entity }));

  // Ask is the first screen of this tab, so going back to it shows the chat.
  const toAsk = () => (router.canDismiss() ? router.dismissAll() : router.replace('/ask'));
  const open = (c: ConversationItem) => {
    const key = chat.open(c.id);
    if (key === TERRITORY) toAsk();
    else router.push(chatHref({ id: key }));
  };
  const newChat = () => {
    chat.newConversation(TERRITORY);
    toAsk();
  };

  return (
    <>
      <Stack.Screen options={{ title: 'History' }} />
      <Screen>
        <Button size="lg" className="rounded-xl" onPress={newChat}>
          <Icon as={SquarePen} size={18} className="text-primary-foreground" />
          <Text>New chat</Text>
        </Button>

        {talks.length ? (
          groupConversations(talks, ctx.today).map((group) => (
            <Section key={group.title} title={group.title}>
              {group.items.map((c) => {
                const entity = c.key === TERRITORY ? null : getEntity(c.key);
                const where = entity ? `About ${shortName(entity)}` : c.live ? 'Open in Ask' : 'Ask';
                return (
                  <Item
                    key={c.id}
                    lead={entity ? <Avatar entity={entity} /> : <AskMark />}
                    title={c.title}
                    sub={[where, plural(c.questions, 'question'), listWhen(c.at, ctx.today)].join(' · ')}
                    hint="Opens this conversation to carry on. Press and hold to delete it."
                    onPress={() => open(c)}
                    onLongPress={() => setDeleting(c)}
                  />
                );
              })}
            </Section>
          ))
        ) : (
          <EmptyState icon={MessageCircle} title="No conversations yet" body="What you ask in Ask shows here, so you can carry on later." />
        )}
        {talks.length ? (
          <Text className="text-sm text-muted-foreground">{`Tap one to carry on. Press and hold one to delete it. The last ${KEEP_CONVERSATIONS} are kept on this phone.`}</Text>
        ) : null}

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
      </Screen>

      <Confirm
        open={!!deleting}
        title="Delete this conversation?"
        body={`“${deleting?.title ?? ''}” is taken off this phone. Anything you saved from it stays in Saved.`}
        action="Delete"
        onConfirm={() => deleting && chat.forget(deleting.id)}
        onClose={() => setDeleting(null)}
      />
      <Confirm
        open={clearing}
        title="Clear your history?"
        body="Your conversations and the list of people you opened are taken off this phone. Saved reports, notes and your plan stay."
        action="Clear history"
        onConfirm={chat.forgetAll}
        onClose={() => setClearing(false)}
      />
    </>
  );
}

function AskMark() {
  return (
    <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-soft">
      <Icon as={MessageCircle} size={20} className="text-brand" />
    </View>
  );
}

function Item({
  lead,
  title,
  sub,
  hint,
  onPress,
  onLongPress,
}: {
  lead: ReactNode;
  title: string;
  sub: string;
  hint?: string;
  onPress: () => void;
  /** Deletes it, after asking; also offered to screen readers as an action. */
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="link"
      accessibilityHint={hint}
      accessibilityActions={onLongPress ? [{ name: 'delete', label: 'Delete this conversation' }] : undefined}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'delete' && onLongPress?.()}
      className="min-h-14 flex-row items-center gap-3 rounded-md py-1.5 active:bg-accent"
    >
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
