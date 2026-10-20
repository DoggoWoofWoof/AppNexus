// You: the sample rep, where their day starts, reminders and how the app looks.
// One choice per row, kept on the phone with the workspace (lib/prefs.ts).

import { CloudOff, Type, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { ChoiceButtons } from '@/components/choice-buttons';
import { Avatar } from '@/components/entity';
import { TabHeader } from '@/components/menu';
import { ReminderChoice } from '@/components/reminders';
import { Screen, Section } from '@/components/screen';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { REP, START_POINTS } from '@/lib/data/seed';
import { APPEARANCES } from '@/lib/prefs';
import { useWorkspace } from '@/lib/store';
import type { Appearance } from '@/lib/types';

const APPEARANCE_TITLE: Record<Appearance, string> = { system: 'System', light: 'Light', dark: 'Dark' };

export default function You() {
  const ctx = useWorkspace();
  const { prefs } = ctx.ws;

  return (
    <Screen inset>
      <TabHeader title="You" sub="Your choices stay on this phone" />

      <View className="flex-row items-center gap-4 rounded-lg border border-border bg-card p-4">
        <Avatar entity={{ name: REP.name }} size="lg" />
        <View className="flex-1 items-start gap-1">
          <View className="rounded-full bg-signal-soft px-2.5 py-0.5">
            <Text className="text-xs font-semibold text-signal-text">Sample profile</Text>
          </View>
          <Text className="text-xl font-semibold">{REP.name}</Text>
          <Text className="text-muted-foreground">{REP.team}</Text>
        </View>
      </View>

      <Section title="Where your day starts" sub="Distances, “Pick 5 for me” and “Who is near” start here">
        <ChoiceButtons
          label="Where your day starts"
          options={START_POINTS.map((p) => ({ value: p.id, title: p.title, sub: p.place }))}
          value={prefs.start}
          onChange={(start) => ctx.setPrefs({ start })}
        />
        <Text className="text-sm text-muted-foreground">Sample places. Your location isn’t used.</Text>
      </Section>

      <Section title="Reminders" sub="Before each visit with a time, and at 17:30 for visits not logged">
        <ReminderChoice />
      </Section>

      <Section title="Appearance" sub="System matches your phone">
        <ChoiceButtons
          label="Appearance"
          options={APPEARANCES.map((a) => ({ value: a, title: APPEARANCE_TITLE[a] }))}
          value={prefs.appearance}
          onChange={(appearance) => ctx.setPrefs({ appearance })}
        />
      </Section>

      <View className="gap-4 rounded-lg border border-border bg-card p-4">
        <Line icon={Type} text="Text size follows your phone’s settings." />
        <Line icon={CloudOff} text="Connection: sample data, not connected." />
      </View>
    </Screen>
  );
}

function Line({ icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <Icon as={icon} size={22} className="text-muted-foreground" />
      <Text className="flex-1">{text}</Text>
    </View>
  );
}
