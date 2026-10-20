// Ask: questions about the whole territory, typed or spoken. Each person and
// account also has its own Ask, opened from their profile (src/screens/entity-chat.tsx).
// History, at the top, lists every conversation, like a chat app; tapping one
// opens it here, or in the person's own Ask, to carry on (src/app/ask/history.tsx).

import { router } from 'expo-router';
import { History, RotateCcw } from 'lucide-react-native';
import { View } from 'react-native';

import { ChatView, QuestionChips } from '@/components/chat';
import { TabHeader } from '@/components/menu';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { startersFor } from '@/lib/ask';
import { TERRITORY, useChat } from '@/lib/chat';
import { useWorkspace } from '@/lib/store';

export default function Ask() {
  const ctx = useWorkspace();
  const chat = useChat();
  const started = chat.turns(TERRITORY).length > 0;
  const ask = (q: string) => void chat.ask(TERRITORY, q);

  return (
    <ChatView
      chatKey={TERRITORY}
      inset
      placeholder="Ask anything"
      header={
        <TabHeader
          title="Ask"
          right={
            <View className="flex-row items-center">
              <Button size="sm" variant="ghost" onPress={() => router.push('/ask/history')} accessibilityLabel="History: your conversations">
                <Icon as={History} size={16} />
                <Text>History</Text>
              </Button>
              {started ? (
                <Button size="sm" variant="ghost" onPress={() => chat.newConversation(TERRITORY)} accessibilityLabel="Start a new conversation. This one stays in History.">
                  <Icon as={RotateCcw} size={16} />
                  <Text>New</Text>
                </Button>
              ) : null}
            </View>
          }
        />
      }
      empty={
        <View className="gap-3">
          <Text className="text-lg text-muted-foreground">Your day, your doctors, your numbers. Ask me.</Text>
          {/* One question for each moment: today, before a visit, the territory and the end of the week. */}
          <QuestionChips questions={startersFor(ctx).map((g) => g.questions[0])} onPick={ask} />
        </View>
      }
    />
  );
}
