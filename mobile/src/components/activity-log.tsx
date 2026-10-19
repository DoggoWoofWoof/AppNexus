// How follow-ups and logged notes appear, after the prototype's followUpRow()
// and interactionItem() in demo/js/screens/profile-parts.js.

import { CalendarClock, CircleCheck, Handshake, Mail, MessageSquare, Phone, Users, Video, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { Tag, type TagTone } from '@/components/entity';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { getEntity, getHcp } from '@/lib/data';
import { daysBetween, formatDate, fromIso, relativeDayLower } from '@/lib/format';
import { useWorkspace } from '@/lib/store';
import type { FollowUp, Hcp, Interaction } from '@/lib/types';
import { cn } from '@/lib/utils';

const TYPE_ICONS: Record<string, LucideIcon> = {
  'In-person visit': Handshake,
  'Phone call': Phone,
  'Video call': Video,
  Email: Mail,
  Meeting: Users,
};

const OUTCOME_TONES: Record<string, TagTone> = { Met: 'success', Attempted: 'warn' };

/** The outcome in the log sheet's words, so a visit where they weren't in doesn't read as one that happened. */
const outcomeLabel = (i: Interaction): string =>
  i.outcome === 'Attempted' ? (i.type === 'In-person visit' || i.type === 'Meeting' ? 'Not in' : 'No answer') : i.outcome;

export function FollowUpRow({ followUp: f, showTarget = false }: { followUp: FollowUp; showTarget?: boolean }) {
  const ctx = useWorkspace();
  const diff = daysBetween(ctx.today, fromIso(f.due));
  const when = relativeDayLower(f.due, ctx.today);
  const due = f.done ? `Done ${relativeDayLower(f.doneOn ?? f.due, ctx.today)}` : diff < 0 ? `Overdue · ${when}` : `Due ${when}`;
  const tone: TagTone = f.done ? 'neutral' : diff < 0 ? 'danger' : diff === 0 ? 'warn' : 'neutral';
  const target = showTarget ? getEntity(f.targetId) : null;
  return (
    <View className="flex-row items-start gap-3 py-1">
      <Icon as={f.done ? CircleCheck : CalendarClock} size={18} className={cn('mt-0.5', f.done ? 'text-success' : 'text-muted-foreground')} />
      <View className="flex-1 gap-1">
        <Text className={cn(f.done && 'text-muted-foreground line-through')}>{f.text}</Text>
        <View className="flex-row flex-wrap items-center gap-2">
          <Tag label={due} tone={tone} />
          {f.local ? <Tag label="Not synced" /> : null}
          {target ? <Text className="text-sm text-muted-foreground">{target.name}</Text> : null}
        </View>
      </View>
    </View>
  );
}

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
          <Tag label={outcomeLabel(i)} tone={OUTCOME_TONES[i.outcome] ?? 'neutral'} />
          {i.local ? <Tag label="Not synced" /> : null}
        </View>
        {i.note ? <Text selectable>{i.note}</Text> : <Text className="text-muted-foreground">No note written.</Text>}
        {met.length ? <Text className="text-sm text-muted-foreground">With {met.join(', ')}</Text> : null}
      </View>
    </View>
  );
}
