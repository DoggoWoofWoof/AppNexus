// Pieces shared by the HCP and HCO profile screens.

import { Stack } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Text } from '@/components/ui/text';

export function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View className="flex-row flex-wrap justify-between gap-x-3">
      <Text className="text-muted-foreground">{label}</Text>
      <Text className={mono ? 'font-mono text-sm' : undefined}>{value}</Text>
    </View>
  );
}

export function NotFound() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Text variant="h3">This profile isn’t in your book</Text>
      <Text className="text-muted-foreground">It may have been reassigned. Go back and pick another target.</Text>
    </Screen>
  );
}
