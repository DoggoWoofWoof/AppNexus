// Small pieces shared by the screens: a page that isn't there, an empty list,
// fine print and the note that the people are fictional.

import { Stack } from 'expo-router';
import { Info, type LucideIcon } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

export function NotFound() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Text variant="h3">This profile isn’t in your book</Text>
      <Text className="text-muted-foreground">It may have been reassigned. Go back and pick another target.</Text>
    </Screen>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  return (
    <View className="items-center gap-2 rounded-md border border-dashed border-border px-4 py-5">
      <Icon as={icon} size={22} className="text-muted-foreground" />
      <Text className="text-center font-semibold">{title}</Text>
      {body ? <Text className="text-center text-sm text-muted-foreground">{body}</Text> : null}
      {action}
    </View>
  );
}

export function FinePrint({ children }: { children: string }) {
  return (
    <View className="flex-row items-start gap-2">
      <Icon as={Info} size={14} className="mt-0.5 text-muted-foreground" />
      <Text className="flex-1 text-xs text-muted-foreground">{children}</Text>
    </View>
  );
}

export const SampleNote = () => <FinePrint>Sample profile. People are fictional; facility names and locations are public records. Notes stay on this phone for now.</FinePrint>;
