// How people and accounts appear in lists: avatar, name, a subtitle and their signals.

import { Link, type Href } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useTab } from '@/components/tab-stack';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { subtitle } from '@/lib/data';
import { initials } from '@/lib/format';
import type { Entity, Signal, Tone } from '@/lib/types';
import { cn } from '@/lib/utils';

const TONES: Record<Tone, { box: string; text: string }> = {
  warn: { box: 'bg-warn-soft', text: 'text-warn' },
  orange: { box: 'bg-signal-soft', text: 'text-signal-text' },
  accent: { box: 'bg-brand-soft', text: 'text-brand' },
  neutral: { box: 'bg-track', text: 'text-muted-foreground' },
};

export function SignalTag({ signal }: { signal: Signal }) {
  const tone = TONES[signal.tone];
  return (
    <View className={cn('max-w-full rounded-full px-2 py-0.5', tone.box)}>
      <Text className={cn('text-2xs font-medium', tone.text)}>{signal.label}</Text>
    </View>
  );
}

export function Avatar({ entity }: { entity: Entity }) {
  return (
    <View
      className={cn('h-10 w-10 items-center justify-center bg-brand-soft', entity.kind === 'hcp' ? 'rounded-full' : 'rounded-md')}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text className="text-xs font-semibold text-brand" maxFontSizeMultiplier={1.3}>
        {initials(entity.name.replace(/^Dr\. /, ''))}
      </Text>
    </View>
  );
}

/**
 * Links to a profile inside the tab that is showing it, e.g. /targets/hcp/maya,
 * so it opens on that tab's stack and Back returns to where the rep was.
 */
export function useProfileHref() {
  const tab = useTab();
  return (entity: Pick<Entity, 'id' | 'kind'>): Href => ({
    pathname: `/${tab}/${entity.kind}/[id]`,
    params: { id: entity.id },
  });
}

export function EntityRow({
  entity,
  signals = [],
  detail,
  trailing,
}: {
  entity: Entity;
  signals?: Signal[];
  detail?: string;
  trailing?: ReactNode;
}) {
  const profileHref = useProfileHref();
  return (
    <Link href={profileHref(entity)} asChild>
      <Pressable className="flex-row items-center gap-3 rounded-md py-2 active:bg-accent" accessibilityRole="link">
        <Avatar entity={entity} />
        <View className="flex-1 gap-0.5">
          <Text className="font-semibold">{entity.name}</Text>
          <Text className="text-sm text-muted-foreground">{detail ?? subtitle(entity)}</Text>
          {signals.length ? (
            <View className="mt-1 flex-row flex-wrap gap-1">
              {signals.map((s) => (
                <SignalTag key={s.id} signal={s} />
              ))}
            </View>
          ) : null}
        </View>
        {trailing}
        <Icon as={ChevronRight} size={18} className="text-muted-foreground" />
      </Pressable>
    </Link>
  );
}
