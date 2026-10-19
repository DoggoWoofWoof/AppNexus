// Ask about one person or account, opened from their profile. Every question is
// about them unless it names someone else, so "where do their patients go?" works.
// Shared by every tab (see src/app/*/chat), like the profiles.

import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { ChatView, QuestionChips } from '@/components/chat';
import { Avatar } from '@/components/entity';
import { NotFound } from '@/components/profile';
import { Text } from '@/components/ui/text';
import { startersAbout } from '@/lib/ask';
import { useChat } from '@/lib/chat';
import { getEntity, shortName, subtitle } from '@/lib/data';

export default function EntityChat() {
  const { id, listen } = useLocalSearchParams<{ id: string; listen?: string }>();
  const entity = getEntity(id);
  const chat = useChat();
  if (!entity) return <NotFound />;
  const short = shortName(entity);

  return (
    <>
      <Stack.Screen options={{ title: `Ask about ${short}` }} />
      <ChatView
        chatKey={entity.id}
        listenOnOpen={listen === '1'}
        placeholder={`Ask about ${short}`}
        empty={
          <View className="gap-4">
            <View className="flex-row items-center gap-3">
              <Avatar entity={entity} />
              <View className="flex-1">
                <Text className="font-semibold">{entity.name}</Text>
                <Text className="text-sm text-muted-foreground">{subtitle(entity)}</Text>
              </View>
            </View>
            <QuestionChips questions={startersAbout(entity)} onPick={(q) => void chat.ask(entity.id, q)} />
          </View>
        }
      />
    </>
  );
}
