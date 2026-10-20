// Saved, from the menu: the Summary of anyone you've asked about or are seeing
// today or the next working day, then the answers you kept from Ask as reports.

import { router } from 'expo-router';
import { ChevronRight, FileText } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Avatar } from '@/components/entity';
import { TabHeader } from '@/components/menu';
import { EmptyState } from '@/components/profile';
import { Screen, Section } from '@/components/screen';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useChat } from '@/lib/chat';
import { getEntity } from '@/lib/data';
import { plural } from '@/lib/format';
import { buildPrep, reportDoc } from '@/lib/saved';
import { useWorkspace } from '@/lib/store';
import type { Entity } from '@/lib/types';

export default function Saved() {
  const ctx = useWorkspace();
  const chat = useChat();
  const talked = chat.talkedAbout();
  const planned = ctx
    .planDays()
    .flatMap((d) => ctx.dayPlan(d.iso))
    .filter((i) => i.status === 'planned')
    .map((i) => i.targetId);
  const preps = [...new Set([...talked, ...planned])]
    .map((id) => getEntity(id))
    .filter((e): e is Entity => !!e)
    .map((entity) => ({ entity, doc: buildPrep(entity, ctx, chat.asked(entity.id)) }));
  const reports = ctx.ws.saved.map((r) => reportDoc(r, ctx.today));
  const open = (id: string) => router.push({ pathname: '/saved/[id]', params: { id } });

  return (
    <Screen inset>
      <TabHeader title="Saved" sub="Summaries and reports from Ask" />

      <Section title="Summaries" sub="Who you’re seeing and who you asked about">
        {preps.length ? (
          preps.map(({ entity, doc }) => {
            const asked = chat.asked(entity.id).length;
            return (
              <Item
                key={doc.id}
                lead={<Avatar entity={entity} />}
                title={doc.title}
                sub={[doc.when, asked ? plural(asked, 'question') : ''].filter(Boolean).join(' · ')}
                onPress={() => open(doc.id)}
              />
            );
          })
        ) : (
          <Text className="text-muted-foreground">{`Nothing planned for today or ${ctx.dayWord(ctx.planDays()[1].iso)}, and you haven’t asked about anyone yet.`}</Text>

        )}
      </Section>

      <Section title="Reports" sub="Answers you kept from Ask">
        {reports.length ? (
          reports.map((doc) => (
            <Item
              key={doc.id}
              lead={
                <View className="h-10 w-10 items-center justify-center rounded-md bg-brand-soft">
                  <Icon as={FileText} size={20} className="text-brand" />
                </View>
              }
              title={doc.title}
              sub={doc.when}
              onPress={() => open(doc.id)}
            />
          ))
        ) : (
          <EmptyState icon={FileText} title="No reports yet" body="Ask a question, then tap Save or say “save that”." />
        )}
      </Section>
    </Screen>
  );
}

function Item({ lead, title, sub, onPress }: { lead: ReactNode; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" className="min-h-14 flex-row items-center gap-3 rounded-md py-1.5 active:bg-accent">
      {lead}
      <View className="flex-1 gap-0.5">
        <Text className="font-semibold">{title}</Text>
        <Text className="text-sm text-muted-foreground">{sub}</Text>
      </View>
      <Icon as={ChevronRight} size={18} className="text-muted-foreground" />
    </Pressable>
  );
}
