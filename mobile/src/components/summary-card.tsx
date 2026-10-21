// The Summary at the top of someone's page, as one paragraph: who they are, when
// they're in and how it has gone, written from the data each time so it stays up
// to date, then the rep's own words or Ask's (lib/prep.ts), or why now until they
// have some (summaryParagraph in lib/brief.ts). Then the next step. Tap for the
// full summary (screens/saved-doc.tsx), or improve it with the two buttons
// (components/prep-actions.tsx).

import { router } from 'expo-router';
import { ChevronRight, MessageCircle, Pencil } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { useDocHref } from '@/components/entity';
import { useSummaryActions } from '@/components/prep-actions';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { summaryParagraph, type Brief } from '@/lib/brief';
import { sentence } from '@/lib/format';
import { prepId } from '@/lib/saved';
import { useWorkspace } from '@/lib/store';
import type { Entity } from '@/lib/types';

export function SummaryCard({ entity, brief }: { entity: Entity; brief: Brief }) {
  const ctx = useWorkspace();
  const docHref = useDocHref();
  const actions = useSummaryActions(entity, brief);
  return (
    <View className="gap-3 rounded-xl bg-brand-soft p-4">
      <Pressable
        onPress={() => router.push(docHref(prepId(entity.id)))}
        accessibilityRole="link"
        accessibilityHint="Opens the full summary"
        className="gap-2 active:opacity-80"
      >
        <Text variant="kicker">Summary</Text>
        <Text className="text-base leading-6">{summaryParagraph(entity, ctx)}</Text>
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
