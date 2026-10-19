// Ask: questions about the whole territory, typed or spoken. Each person and
// account also has its own Ask, opened from their profile (src/screens/entity-chat.tsx).

import { RotateCcw } from 'lucide-react-native';
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
            started ? (
              <Button size="sm" variant="ghost" onPress={() => chat.clear(TERRITORY)} accessibilityLabel="Start a new conversation">
                <Icon as={RotateCcw} size={16} />
                <Text>New</Text>
              </Button>
            ) : undefined
          }
        />
      }
      empty={
        <View className="gap-3">
          <Text className="text-lg text-muted-foreground">Your day, your doctors, your numbers. Ask me.</Text>
          <QuestionChips questions={startersFor(ctx).flatMap((g) => g.questions).slice(0, 4)} onPick={ask} />
        </View>
      }
    />
  );
}
