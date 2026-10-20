// How a logged visit, call or meeting appears in full on someone's page, after
// the prototype's interactionItem() in demo/js/screens/profile-parts.js.

import { Handshake, Mail, MessageSquare, Phone, Users, Video, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { Tag, type TagTone } from '@/components/entity';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { outcomeWord } from '@/lib/brief';
import { getEntity, getHcp } from '@/lib/data';
import { formatDate } from '@/lib/format';
import type { Hcp, Interaction } from '@/lib/types';

const TYPE_ICONS: Record<string, LucideIcon> = {
  'In-person visit': Handshake,
  'Phone call': Phone,
  'Video call': Video,
  Email: Mail,
  Meeting: Users,
};

const OUTCOME_TONES: Record<string, TagTone> = { Met: 'success', Attempted: 'warn' };

/** Who else was there: doctors from the book, then other contacts by name. */
export function metWith(i: Interaction): string[] {
  const people = i.attendees
    .filter((id) => id !== i.targetId)
    .map(getHcp)
    .filter((h): h is Hcp => h != null)
    .map((h) => h.name);
  return [...people, ...(i.contacts ?? [])];
}

/** One logged visit, call or meeting. `about` is the profile showing it, so notes filed elsewhere say where. */
export function InteractionItem({ interaction: i, about }: { interaction: Interaction; about: string }) {
  const target = i.targetId !== about ? getEntity(i.targetId) : null;
  const met = metWith(i);
  return (
    <View className="flex-row gap-3">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-brand-soft" aria-hidden>
        <Icon as={TYPE_ICONS[i.type] ?? MessageSquare} size={16} className="text-brand" />
      </View>
      <View className="flex-1 gap-1">
        <Text className="font-semibold">{target ? `${target.name} · ${i.type}` : i.type}</Text>
        <Text className="text-sm text-muted-foreground">
          {formatDate(i.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {i.author}
        </Text>
        <View className="flex-row flex-wrap gap-1">
          <Tag label={outcomeWord(i.outcome, i.type)} tone={OUTCOME_TONES[i.outcome] ?? 'neutral'} />
        </View>
        {i.note ? <Text selectable>{i.note}</Text> : <Text className="text-muted-foreground">No note written.</Text>}
        {met.length ? <Text className="text-sm text-muted-foreground">With {met.join(', ')}</Text> : null}
      </View>
    </View>
  );
}
