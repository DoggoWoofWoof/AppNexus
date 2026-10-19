// Ask: questions about the territory, typed or spoken. The answer engine and
// voice are not ported yet; this shows the starter questions so the tab is real.

import { Mic } from 'lucide-react-native';
import { View } from 'react-native';

import { PageHeader, PlaceholderNote, Screen, Section } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { getEntity } from '@/lib/data';
import { useWorkspace } from '@/lib/store';

/** Starter questions, grouped by the moment in a rep's day they help with (demo/js/ask.js). */
const STARTERS = [
  { title: 'Plan the day', questions: ['Who should I see today?', 'What’s on my plan today?', 'Who is near Mount Sinai West?'] },
  { title: 'Before a visit', questions: ['Brief me on Dr. Maya Patel', 'Where does Dr. Alex Morgan refer patients?', 'Top doctors at Mount Sinai Hospital'] },
  { title: 'Your territory', questions: ['Which accounts are growing the most?', 'What has declined?', 'Where am I losing the most volume?', 'What follow-ups are overdue?'] },
];

export default function Ask() {
  const ctx = useWorkspace();
  // Like the prototype, "Before a visit" talks about the next planned stop.
  const next = ctx.dayPlan(ctx.todayIso).find((i) => i.status === 'planned');
  const who = next ? getEntity(next.targetId) : null;
  const starters = who
    ? STARTERS.map((g) =>
        g.title === 'Before a visit'
          ? {
              ...g,
              questions: [
                `Brief me on ${who.name}`,
                who.kind === 'hcp' ? `Where does ${who.name} refer patients?` : `Where do patients at ${who.name} go?`,
                g.questions[2],
              ],
            }
          : g,
      )
    : STARTERS;

  return (
    <Screen inset>
      <PageHeader title="Ask" sub="Questions about your territory, answered from your data" />

      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <Input placeholder="Ask about a doctor, account or your day" accessibilityLabel="Ask a question" editable={false} />
        </View>
        <Button variant="outline" size="icon" disabled accessibilityLabel="Hold to talk (coming next)">
          <Icon as={Mic} size={20} />
        </Button>
      </View>

      {starters.map((group) => (
        <Section key={group.title} title={group.title}>
          <View className="flex-row flex-wrap gap-2">
            {group.questions.map((q) => (
              <View key={q} className="max-w-full rounded-full border border-brand-line bg-brand-soft px-3 py-1.5">
                <Text className="text-sm text-brand">{q}</Text>
              </View>
            ))}
          </View>
        </Section>
      ))}

      <PlaceholderNote>Scaffold: answers, push-to-talk and hands-free voice come next (see docs/ask-and-voice.md).</PlaceholderNote>
    </Screen>
  );
}
