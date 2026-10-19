// One saved item: visit prep (rebuilt from the data and what you asked) or a
// report kept from Ask. Listen to it, share it, or remove a report.
// Opened from Saved, from someone's page and from Ask (see src/app/*/doc).

import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ChevronRight, Trash2 } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';

import { DocSections, ListenButton, ShareButton } from '@/components/doc';
import { useProfileHref } from '@/components/entity';
import { FinePrint } from '@/components/profile';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useChat } from '@/lib/chat';
import { getEntity, shortName } from '@/lib/data';
import { buildPrep, prepTarget, reportDoc } from '@/lib/saved';
import { useWorkspace } from '@/lib/store';

export default function SavedDoc() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ctx = useWorkspace();
  const chat = useChat();
  const profileHref = useProfileHref();
  const target = prepTarget(id);
  const person = target ? getEntity(target) : null;
  const report = ctx.ws.saved.find((r) => r.id === id);
  const doc = person ? buildPrep(person, ctx, chat.asked(person.id)) : report ? reportDoc(report, ctx.today) : null;
  const about = doc?.about ? getEntity(doc.about) : null;
  const open = (entityId: string) => {
    const e = getEntity(entityId);
    if (e) router.push(profileHref(e));
  };

  if (!doc) {
    return (
      <View className="flex-1 gap-2 bg-background p-4">
        <Stack.Screen options={{ title: 'Saved' }} />
        <Text variant="h3">This one’s gone</Text>
        <Text className="text-muted-foreground">It may have been removed. Go back to Saved.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-4 px-4 pb-10 pt-4">
      <Stack.Screen options={{ title: doc.kind === 'prep' ? 'Visit prep' : 'Report' }} />
      <View className="gap-1">
        <Text className="text-sm text-muted-foreground">{doc.when}</Text>
        <Text variant="h2">{doc.title}</Text>
        {doc.question ? <Text className="text-muted-foreground">{`You asked: “${doc.question}”`}</Text> : null}
      </View>

      <View className="flex-row gap-2">
        <ListenButton doc={doc} variant="default" className="flex-1 rounded-xl" />
        <ShareButton doc={doc} className="flex-1 rounded-xl" />
      </View>

      <View className="gap-2 rounded-xl bg-brand-soft p-4">
        <Text className="text-base font-semibold leading-6">{doc.summary}</Text>
        {/* What it's built from and which months the figures cover, so they can be quoted. */}
        <Text className="text-sm text-muted-foreground">{doc.scope.join(' · ')}</Text>
      </View>

      <DocSections doc={doc} onOpen={open} />

      {about ? (
        <Button variant="outline" size="lg" className="rounded-xl" onPress={() => router.push(profileHref(about))}>
          <Text>{`Open ${shortName(about)}`}</Text>
          <Icon as={ChevronRight} size={16} />
        </Button>
      ) : null}
      {report ? (
        <Button
          variant="ghost"
          className="self-center"
          onPress={() => {
            router.back();
            ctx.removeSaved(report.id);
          }}
        >
          <Icon as={Trash2} size={16} className="text-danger" />
          <Text className="text-danger">Remove</Text>
        </Button>
      ) : null}
      <FinePrint>{doc.kind === 'prep' ? 'Built from the data and what you asked in Ask. It updates as you go.' : 'Figures as they were when you saved it.'}</FinePrint>
    </ScrollView>
  );
}
