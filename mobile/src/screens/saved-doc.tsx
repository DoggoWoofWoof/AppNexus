// One saved item: someone's full Summary (rebuilt from the data, what you asked
// and what you wrote) or a report kept from Ask. Listen to it, share it, or
// remove a report. A Summary can be improved: Edit keeps the rep's own words and
// goal, and Improve with Ask asks for more. When there's nothing much to go on
// yet, Write a summary with Ask leads instead (components/prep-actions.tsx,
// lib/prep.ts). Opened from Saved, from someone's page and from Ask (see src/app/*/doc).

import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ChevronRight, MessageCircle, Pencil, Trash2 } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';

import { DocSections, ListenButton, ShareButton } from '@/components/doc';
import { useProfileHref } from '@/components/entity';
import { useSummaryActions } from '@/components/prep-actions';
import { FinePrint } from '@/components/profile';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useChat } from '@/lib/chat';
import { getEntity, shortName } from '@/lib/data';
import { buildPrep, prepTarget, reportDoc } from '@/lib/saved';
import { useWorkspace } from '@/lib/store';
import type { Entity } from '@/lib/types';

export default function SavedDoc() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ctx = useWorkspace();
  const chat = useChat();
  const profileHref = useProfileHref();
  const target = prepTarget(id);
  const person = target ? getEntity(target) : null;
  const report = ctx.ws.saved.find((r) => r.id === id);
  const doc = person ? buildPrep(person, ctx, chat.asked(person.id)) : report ? reportDoc(report, ctx.today) : null;
  // A report can open who it's about. A Summary doesn't need to: the rep came from their page.
  const about = report?.about ? getEntity(report.about) : null;
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
      <Stack.Screen options={{ title: doc.kind === 'prep' ? 'Summary' : 'Report' }} />
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

      {person ? <ImproveSummary entity={person} /> : null}

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
      <FinePrint>
        {doc.kind === 'prep' ? 'Written from the data and what you asked in Ask, and it updates as you go. What you write is kept on this phone.' : 'Figures as they were when you saved it.'}
      </FinePrint>
    </ScrollView>
  );
}

/** Edit summary and Improve with Ask, or, with nothing much to go on yet, Write a summary with Ask first. */
function ImproveSummary({ entity }: { entity: Entity }) {
  const actions = useSummaryActions(entity);
  if (actions.thin) {
    return (
      <View className="gap-3 rounded-xl bg-brand-soft p-4">
        <Text className="text-base font-semibold leading-6">{`Nothing planned with ${shortName(entity)} yet, so this is only a start.`}</Text>
        <Text className="text-base leading-6">Ask can suggest a goal and what to bring up, from their figures and your notes.</Text>
        <Button size="lg" className="rounded-xl" onPress={actions.improve}>
          <Icon as={MessageCircle} size={18} className="text-primary-foreground" />
          <Text>{actions.improveLabel}</Text>
        </Button>
        <Button variant="ghost" onPress={actions.edit}>
          <Icon as={Pencil} size={16} />
          <Text>Write my own</Text>
        </Button>
        {actions.sheet}
      </View>
    );
  }
  return (
    <View className="gap-2">
      <Button variant="outline" size="lg" className="rounded-xl" onPress={actions.edit}>
        <Icon as={Pencil} size={16} />
        <Text>Edit summary</Text>
      </Button>
      <Button variant="outline" size="lg" className="rounded-xl" onPress={actions.improve}>
        <Icon as={MessageCircle} size={16} />
        <Text>{actions.improveLabel}</Text>
      </Button>
      {actions.sheet}
    </View>
  );
}
