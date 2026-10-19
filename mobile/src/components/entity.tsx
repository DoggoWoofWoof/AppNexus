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

export type TagTone = Tone | 'success' | 'danger';

const TONES: Record<TagTone, { box: string; text: string }> = {
  warn: { box: 'bg-warn-soft', text: 'text-warn' },
  orange: { box: 'bg-signal-soft', text: 'text-signal-text' },
  accent: { box: 'bg-brand-soft', text: 'text-brand' },
  neutral: { box: 'bg-track', text: 'text-muted-foreground' },
  success: { box: 'bg-success-soft', text: 'text-success' },
  danger: { box: 'bg-danger-soft', text: 'text-danger' },
};

/** A small coloured label, the prototype's `tag()`. */
export function Tag({ label, tone = 'neutral' }: { label: string; tone?: TagTone }) {
  return (
    <View className={cn('max-w-full self-start rounded-full px-2 py-0.5', TONES[tone].box)}>
      <Text className={cn('text-2xs font-medium', TONES[tone].text)}>{label}</Text>
    </View>
  );
}

export function SignalTag({ signal }: { signal: Signal }) {
  return <Tag label={signal.label} tone={signal.tone} />;
}

/** Initials in a circle for people (including contacts outside the book), a rounded square for accounts. */
export function Avatar({ entity, size = 'md' }: { entity: { name: string; kind?: Entity['kind'] }; size?: 'md' | 'lg' }) {
  return (
    <View
      className={cn(
        'items-center justify-center bg-brand-soft',
        size === 'lg' ? 'h-14 w-14' : 'h-10 w-10',
        entity.kind === 'hco' ? 'rounded-md' : 'rounded-full',
      )}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text className={cn('font-semibold text-brand', size === 'lg' ? 'text-base' : 'text-xs')} maxFontSizeMultiplier={1.3}>
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
  tags,
  trailing,
  action,
}: {
  entity: Entity;
  signals?: Signal[];
  detail?: string;
  /** Extra tags under the detail, where they can wrap rather than squeeze the name. */
  tags?: ReactNode;
  trailing?: ReactNode;
  /** A button next to the row rather than inside its link. */
  action?: ReactNode;
}) {
  const profileHref = useProfileHref();
  const row = (
    <Link href={profileHref(entity)} asChild>
      <Pressable className="flex-row items-center gap-3 rounded-md py-2 active:bg-accent" accessibilityRole="link">
        <Avatar entity={entity} />
        <View className="flex-1 gap-0.5">
          <Text className="font-semibold">{entity.name}</Text>
          <Text className="text-sm text-muted-foreground">{detail ?? subtitle(entity)}</Text>
          {signals.length || tags ? (
            <View className="mt-1 flex-row flex-wrap gap-1">
              {tags}
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
  if (!action) return row;
  return (
    <View className="flex-row flex-wrap items-center justify-end gap-x-2">
      <View className="min-w-[13rem] flex-1">{row}</View>
      {action}
    </View>
  );
}
