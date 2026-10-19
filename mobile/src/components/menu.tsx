// The menu behind the ☰ button on each main screen: the detail most reps only
// need now and then (Saved, Activity, Insights), kept out of the tab bar so the
// main screens stay down to one or two big buttons.

import { router, type Href } from 'expo-router';
import { Bookmark, ChartColumn, ChevronRight, ListChecks, Menu as MenuIcon, type LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/entity';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useChat } from '@/lib/chat';
import { REP } from '@/lib/data/seed';
import { plural } from '@/lib/format';
import { useWorkspace } from '@/lib/store';

/** The top of a main screen: the menu button, a big title and at most one action on the right. */
export function TabHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <View className="flex-row items-start gap-2">
      <MenuButton />
      <View className="flex-1 gap-1 pt-1">
        <Text variant="h1">{title}</Text>
        {sub ? <Text className="text-lg text-muted-foreground">{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** The ☰ button, for screens whose top row is something other than a title. */
export function MenuButton() {
  const ctx = useWorkspace();
  const [open, setOpen] = useState(false);
  const due = ctx.openFollowUps().filter((f) => f.overdueBy >= 0).length;
  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className="-ml-2 rounded-full"
        onPress={() => setOpen(true)}
        accessibilityLabel={due ? `Menu, ${plural(due, 'follow-up')} due` : 'Menu'}
      >
        <Icon as={MenuIcon} size={24} />
        {due ? <View className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border border-background bg-signal" /> : null}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        {open ? <MenuSheet due={due} onClose={() => setOpen(false)} /> : null}
      </Dialog>
    </>
  );
}

function MenuSheet({ due, onClose }: { due: number; onClose: () => void }) {
  const ctx = useWorkspace();
  const chat = useChat();
  const { bottom } = useSafeAreaInsets();
  const saved = ctx.ws.saved.length + chat.talkedAbout().length;
  const go = (href: Href) => {
    onClose();
    router.navigate(href);
  };

  return (
    <DialogContent className="gap-2 p-4" style={{ marginBottom: bottom }}>
      <DialogTitle className="px-2 pb-2 font-serif text-2xl font-normal">Menu</DialogTitle>
      <MenuRow icon={Bookmark} title="Saved" sub={saved ? `${plural(saved, 'item')} · visit prep and reports` : 'Visit prep and reports'} onPress={() => go('/saved')} />
      <MenuRow icon={ListChecks} title="Activity" sub={due ? `${plural(due, 'follow-up')} due · your notes` : 'Your notes and follow-ups'} onPress={() => go('/activity')} alert={due > 0} />
      <MenuRow icon={ChartColumn} title="Insights" sub="Your territory at a glance" onPress={() => go('/insights')} />
      <View className="mt-2 flex-row items-center gap-3 border-t border-border px-2 pt-4">
        <Avatar entity={{ name: REP.name }} />
        <View className="flex-1">
          <Text className="font-semibold">{REP.name}</Text>
          <Text className="text-sm text-muted-foreground">{REP.team}</Text>
        </View>
      </View>
      <Text className="px-2 text-xs text-muted-foreground">Sample data. Nothing you add leaves this device yet.</Text>
    </DialogContent>
  );
}

function MenuRow({ icon, title, sub, alert = false, onPress }: { icon: LucideIcon; title: string; sub: string; alert?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" className="min-h-16 flex-row items-center gap-4 rounded-lg px-2 py-3 active:bg-accent">
      <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-soft">
        <Icon as={icon} size={22} className="text-brand" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-lg font-semibold">{title}</Text>
        <Text className={alert ? 'text-sm text-signal-text' : 'text-sm text-muted-foreground'}>{sub}</Text>
      </View>
      <Icon as={ChevronRight} size={20} className="text-muted-foreground" />
    </Pressable>
  );
}
