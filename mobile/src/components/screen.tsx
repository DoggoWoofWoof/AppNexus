// Page scaffolding shared by every screen: a scrolling page, its header and titled sections.

import type { ReactNode, Ref } from 'react';
import { ScrollView, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/**
 * A scrolling page. Tab roots hide the navigation header, so they pass `inset`
 * to keep clear of the status bar; pushed screens sit under a header already.
 */
export function Screen({ children, inset = false, scrollRef }: { children: ReactNode; inset?: boolean; scrollRef?: Ref<ScrollViewInstance> }) {
  const { top } = useSafeAreaInsets();
  return (
    <ScrollView
      ref={scrollRef}
      className="flex-1 bg-background"
      contentContainerClassName="gap-5 px-4 pb-10"
      contentContainerStyle={{ paddingTop: (inset ? top : 0) + 16 }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function PageHeader({ kicker, title, sub }: { kicker?: string; title: string; sub?: string }) {
  return (
    <View className="gap-1">
      {kicker ? <Text variant="kicker">{kicker}</Text> : null}
      <Text variant="h1">{title}</Text>
      {sub ? <Text className="text-muted-foreground">{sub}</Text> : null}
    </View>
  );
}

export function Section({
  title,
  sub,
  action,
  children,
  className,
}: {
  title: string;
  sub?: string;
  /** A button beside the title; it wraps underneath when the text is large. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <View className={cn('gap-3 rounded-lg border border-border bg-card p-4', className)}>
      <View className="flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <View className="min-w-[60%] flex-1 gap-0.5">
          <Text variant="h4">{title}</Text>
          {sub ? <Text className="text-sm text-muted-foreground">{sub}</Text> : null}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

/** Marks what is still a placeholder, so nobody mistakes the scaffold for the finished screen. */
export function PlaceholderNote({ children }: { children: ReactNode }) {
  return (
    <View className="rounded-lg border border-dashed border-border p-3">
      <Text className="text-sm text-muted-foreground">{children}</Text>
    </View>
  );
}
