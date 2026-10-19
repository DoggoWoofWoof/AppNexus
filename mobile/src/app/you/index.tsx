// You: the sample rep, where their day starts and how the app looks. One choice
// per row, kept on the phone with the workspace (lib/prefs.ts).

import { CloudOff, Type, type LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Avatar } from '@/components/entity';
import { TabHeader } from '@/components/menu';
import { Screen, Section } from '@/components/screen';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { REP, START_POINTS } from '@/lib/data/seed';
import { APPEARANCES } from '@/lib/prefs';
import { useWorkspace } from '@/lib/store';
import type { Appearance } from '@/lib/types';
import { cn } from '@/lib/utils';

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
        <Choices
          label="Where your day starts"
          options={START_POINTS.map((p) => ({ value: p.id, title: p.title, sub: p.place }))}
          value={prefs.start}
          onChange={(start) => ctx.setPrefs({ start })}
        />
        <Text className="text-sm text-muted-foreground">Sample places. Your location isn’t used.</Text>
      </Section>

      <Section title="Appearance" sub="System matches your phone">
        <Choices
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

/** Big side-by-side buttons, one of which is chosen. */
function Choices<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; title: string; sub?: string }[]; value: T; onChange: (value: T) => void }) {
  return (
    <View className="flex-row gap-2" accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityLabel={o.sub ? `${o.title}, ${o.sub}` : o.title}
            // Not accessibilityState: the web build only passes aria-checked on.
            aria-checked={on}
            className={cn('min-h-14 flex-1 items-center justify-center rounded-xl border px-2 py-2', on ? 'border-primary bg-primary' : 'border-border bg-card active:bg-accent')}
          >
            <Text className={cn('text-lg font-semibold', on ? 'text-primary-foreground' : 'text-foreground')}>{o.title}</Text>
            {o.sub ? <Text className={cn('text-center text-sm', on ? 'text-primary-foreground' : 'text-muted-foreground')}>{o.sub}</Text> : null}
          </Pressable>
        );
      })}
    </View>
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
