// The prototype's toast: a short message above the tab bar after a change, with
// Undo when the change can be taken back. It goes after a few seconds.

import { useEffect } from 'react';
import { AccessibilityInfo, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useWorkspace } from '@/lib/store';

const SHOW_FOR_MS = 6000;

export function NoticeBar({ bottom }: { bottom: number }) {
  const { notice, dismissNotice, undo } = useWorkspace();

  useEffect(() => {
    if (!notice) return;
    AccessibilityInfo.announceForAccessibility(notice.message);
    const timer = setTimeout(dismissNotice, SHOW_FOR_MS);
    return () => clearTimeout(timer);
  }, [notice, dismissNotice]);

  if (!notice) return null;
  return (
    <View pointerEvents="box-none" className="absolute inset-x-0 items-center px-4" style={{ bottom }}>
      <View className="w-full max-w-md flex-row items-center gap-3 rounded-lg bg-foreground py-2 pl-4 pr-2 shadow-lg shadow-black/20">
        <Text className="flex-1 text-sm text-background">{notice.message}</Text>
        {notice.canUndo ? (
          <Button size="sm" variant="ghost" onPress={undo} accessibilityLabel="Undo">
            <Text className="font-semibold text-background">Undo</Text>
          </Button>
        ) : null}
      </View>
    </View>
  );
}
