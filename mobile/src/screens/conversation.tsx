// An ended conversation from History, as it was: each question and its answer,
// with the figures as they were that day. Answers can still be saved, read aloud
// and followed. One button carries on in Ask, or in the person's own Ask.

import { router, Stack, useLocalSearchParams } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AnswerView, Question, useFollow } from '@/components/chat';
import { Confirm } from '@/components/confirm';
import { useChatHref } from '@/components/entity';
import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { spoken } from '@/lib/ask';
import { TERRITORY, useChat, whenLabel, type Turn } from '@/lib/chat';
import { getEntity, shortName } from '@/lib/data';
import { plural } from '@/lib/format';
import { useWorkspace } from '@/lib/store';
import { speak, stopSpeaking } from '@/lib/voice';

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ctx = useWorkspace();
  const chat = useChat();
  const chatHref = useChatHref();
  const { follow, openRow, sheets } = useFollow();
  const [reading, setReading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Stop reading when the page closes.
  useEffect(() => () => stopSpeaking(), []);

  const conversation = chat.conversation(id);
  if (!conversation) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'History' }} />
        <Text variant="h3">This conversation isn’t in History any more</Text>
        <Text className="text-muted-foreground">It may have been deleted. Go back to see the others.</Text>
      </Screen>
    );
  }

  const entity = conversation.key === TERRITORY ? null : getEntity(conversation.key);
  const { turns } = conversation;
  const read = (turn: Turn) => {
    if (reading === turn.id) {
      stopSpeaking();
      setReading(null);
      return;
    }
    if (!turn.answer) return;
    setReading(turn.id);
    speak(spoken(turn.answer), { onEnd: () => setReading((current) => (current === turn.id ? null : current)) });
  };
  const carryOn = () => {
    if (entity) router.push(chatHref(entity));
    else router.navigate('/ask');
  };

  return (
    <>
      <Stack.Screen options={{ title: entity ? `About ${shortName(entity)}` : 'Ask' }} />
      <Screen>
        <Text className="text-sm text-muted-foreground">
          {`${whenLabel(turns[0].at, ctx.today)} · ${plural(turns.length, 'question')}. Answers as they were then: figures and plans may have changed since.`}
        </Text>
        {turns.map((turn) => (
          <View key={turn.id} className="gap-3">
            <Question turn={turn} />
            <AnswerView
              turn={turn}
              isLast={false}
              reading={reading === turn.id}
              onRead={() => read(turn)}
              onSave={() => chat.save(conversation.id, turn.id)}
              onAsk={carryOn}
              onFollow={follow}
              onOpenRow={openRow}
            />
          </View>
        ))}
        <View className="gap-2 pt-2">
          <Button size="lg" className="rounded-xl" onPress={carryOn}>
            <Icon as={MessageCircle} size={18} className="text-primary-foreground" />
            <Text>{entity ? `Ask about ${shortName(entity)}` : 'Ask something new'}</Text>
          </Button>
          <Button variant="ghost" onPress={() => setDeleting(true)}>
            <Text className="text-destructive">Delete this conversation</Text>
          </Button>
        </View>
      </Screen>
      <Confirm
        open={deleting}
        title="Delete this conversation?"
        body="It’s taken off this phone. Anything you saved from it stays in Saved."
        action="Delete"
        onConfirm={() => {
          router.back();
          chat.forget(conversation.id);
        }}
        onClose={() => setDeleting(false)}
      />
      {sheets}
    </>
  );
}
