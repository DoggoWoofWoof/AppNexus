// A question before something that can't be undone, such as clearing History:
// what will happen in one sentence, then the button that does it and one that doesn't.

import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';

export function Confirm({
  open,
  title,
  body,
  action,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  /** The button that does it, such as "Clear history". */
  action: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { bottom } = useSafeAreaInsets();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {open ? (
        <DialogContent className="gap-4 p-5" style={{ marginBottom: bottom }}>
          <DialogTitle className="font-serif text-2xl font-normal">{title}</DialogTitle>
          <Text className="text-base text-muted-foreground">{body}</Text>
          <View className="flex-row flex-wrap gap-3">
            <Button
              size="lg"
              variant="destructive"
              className="min-w-[45%] flex-1 rounded-xl"
              onPress={() => {
                onClose();
                onConfirm();
              }}
            >
              <Text>{action}</Text>
            </Button>
            <Button size="lg" variant="outline" className="min-w-[45%] flex-1 rounded-xl" onPress={onClose}>
              <Text>Keep it</Text>
            </Button>
          </View>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
