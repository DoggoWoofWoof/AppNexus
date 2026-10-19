// The tab bar icon from the prototype (demo/css/app.css): a soft pill behind the
// selected tab, Ask as a big round button in the middle, and an optional count.

import type { LucideIcon } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { cn } from '@/lib/utils';

/** Room for the pill; React Navigation's icon box is only 31pt wide. */
export const TAB_ICON_WIDTH = 50;

export function TabIcon({
  icon: Glyph,
  color,
  focused,
  filled = false,
  badge,
}: {
  icon: LucideIcon;
  color: string;
  focused: boolean;
  filled?: boolean;
  badge?: number;
}) {
  // Ask is a round button raised out of the bar, as the one big thing to press.
  if (filled) {
    return (
      <View className={cn('-mt-5 h-14 w-14 items-center justify-center rounded-full border-4 border-card shadow-md shadow-black/20', focused ? 'bg-primary-hover' : 'bg-primary')}>
        <Glyph color="white" size={26} />
      </View>
    );
  }
  return (
    <View className={cn('rounded-full px-3.5 py-[3px]', focused && 'bg-brand-soft')}>
      <Glyph color={color} size={22} />
      {badge ? (
        // The count is in the tab's accessibility label, so the badge itself is hidden.
        <View
          className="absolute -top-1 left-[35px] min-w-5 items-center rounded-full border-2 border-card bg-signal px-1"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text className="font-mono text-[10.5px] leading-[13px] text-white" maxFontSizeMultiplier={1.3}>
            {badge}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
