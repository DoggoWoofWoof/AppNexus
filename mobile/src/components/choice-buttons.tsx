// Big buttons, one of which is chosen, for the You page. Side by side, or one
// under another when the phone's text is large enough that they'd wrap.

import { Pressable, useWindowDimensions, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export function ChoiceButtons<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; title: string; sub?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const stacked = useWindowDimensions().fontScale >= 1.4;
  return (
    <View className={cn('gap-2', stacked ? 'flex-col' : 'flex-row')} accessibilityRole="radiogroup" accessibilityLabel={label}>
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
            className={cn(
              'min-h-14 items-center justify-center rounded-xl border px-2 py-2',
              !stacked && 'flex-1',
              on ? 'border-primary bg-primary' : 'border-border bg-card active:bg-accent',
            )}
          >
            <Text className={cn('text-lg font-semibold', on ? 'text-primary-foreground' : 'text-foreground')}>{o.title}</Text>
            {o.sub ? <Text className={cn('text-center text-sm', on ? 'text-primary-foreground' : 'text-muted-foreground')}>{o.sub}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
