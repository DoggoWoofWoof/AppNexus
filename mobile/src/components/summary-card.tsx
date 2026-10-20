// The Summary at the top of someone's page: who they are, when they're in and how
// it has gone, written from the data until the rep improves it, then the next step.
// Once the rep has written their own or kept some from Ask (lib/prep.ts), theirs
// shows instead. Tap for the full summary (the prep page, screens/saved-doc.tsx),
// or improve it with the two buttons (components/prep-actions.tsx).

import { router } from 'expo-router';
import { ChevronRight, MessageCircle, Pencil } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { useDocHref } from '@/components/entity';
import { useSummaryActions } from '@/components/prep-actions';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { summaryOf, type Brief } from '@/lib/brief';
import { firstSentence } from '@/lib/format';
import { improvedSummary } from '@/lib/prep';
import { prepId } from '@/lib/saved';
import { useWorkspace } from '@/lib/store';
import type { Entity } from '@/lib/types';

const sentence = (text: string): string => (/[.!?]$/.test(text) ? text : `${text}.`);

export function SummaryCard({ entity, brief }: { entity: Entity; brief: Brief }) {
  const ctx = useWorkspace();
  const docHref = useDocHref();
  const actions = useSummaryActions(entity, brief);
  const summary = improvedSummary(ctx.ws, entity.id) ?? `${summaryOf(entity, ctx)} ${sentence(firstSentence(brief.insight))}`;
  return (
    <View className="gap-3 rounded-xl bg-brand-soft p-4">
      <Pressable
        onPress={() => router.push(docHref(prepId(entity.id)))}
        accessibilityRole="link"
        accessibilityHint="Opens the full summary"
        className="gap-2 active:opacity-80"
      >
        <Text variant="kicker">Summary</Text>
        <Text className="text-base leading-6">{summary}</Text>
        <Text className="text-base leading-6">
          <Text className="text-base font-semibold">Next: </Text>
          {sentence(brief.goal)}
        </Text>
        <View className="flex-row items-center gap-1">
          <Text className="text-sm font-semibold text-brand">Full summary</Text>
          <Icon as={ChevronRight} size={14} className="text-brand" />
        </View>
      </Pressable>
      <View className="flex-row flex-wrap gap-2">
        <Button variant="outline" className="rounded-lg" onPress={actions.improve}>
          <Icon as={MessageCircle} size={16} />
          <Text>{actions.improveLabel}</Text>
        </Button>
        <Button variant="ghost" className="rounded-lg" onPress={actions.edit}>
          <Icon as={Pencil} size={16} />
          <Text>Edit</Text>
        </Button>
      </View>
      {actions.sheet}
    </View>
  );
}
