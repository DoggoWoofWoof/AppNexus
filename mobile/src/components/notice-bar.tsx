// The prototype's toast: a short message above the tab bar after a change, with
// Undo when the change can be taken back, and at times another way to make it,
// such as "Today instead". It goes after a few seconds, longer with a choice.

import { useEffect } from 'react';
import { AccessibilityInfo, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useWorkspace } from '@/lib/store';

const SHOW_FOR_MS = 6000;
const CHOICE_FOR_MS = 10000;

export function NoticeBar({ bottom }: { bottom: number }) {
  const { notice, dismissNotice, undo } = useWorkspace();

  useEffect(() => {
    if (!notice) return;
    AccessibilityInfo.announceForAccessibility(notice.action ? `${notice.message}. ${notice.action.label}?` : notice.message);
    const timer = setTimeout(dismissNotice, notice.action ? CHOICE_FOR_MS : SHOW_FOR_MS);
    return () => clearTimeout(timer);
  }, [notice, dismissNotice]);

  if (!notice) return null;
  const undoButton = notice.canUndo ? (
    <Button size="sm" variant="ghost" onPress={undo} accessibilityLabel="Undo">
      <Text className="font-semibold text-background">Undo</Text>
    </Button>
  ) : null;
  return (
    <View pointerEvents="box-none" className="absolute inset-x-0 items-center px-4" style={{ bottom }}>
      {notice.action ? (
        // The choice goes under the message, which then has the width to be read.
        <View className="w-full max-w-md gap-1 rounded-lg bg-foreground pb-1 pl-4 pr-2 pt-3 shadow-lg shadow-black/20">
          <Text className="pr-2 text-sm text-background">{notice.message}</Text>
          <View className="flex-row justify-end">
            <Button size="sm" variant="ghost" onPress={notice.action.run}>
              <Text className="font-semibold text-background">{notice.action.label}</Text>
            </Button>
            {undoButton}
          </View>
        </View>
      ) : (
        <View className="w-full max-w-md flex-row items-center gap-3 rounded-lg bg-foreground py-2 pl-4 pr-2 shadow-lg shadow-black/20">
          <Text className="flex-1 text-sm text-background">{notice.message}</Text>
          {undoButton}
        </View>
      )}
    </View>
  );
}
