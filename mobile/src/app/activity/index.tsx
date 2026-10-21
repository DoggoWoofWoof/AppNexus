// Activity: one list of follow-ups, soonest first, each saying how late it is
// (tap for the person, Done to tick it off), then every visit and note, newest
// first, in short rows that can be searched by any word.

import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useProfileHref } from '@/components/entity';
import { TabHeader } from '@/components/menu';
import { FinePrint } from '@/components/profile';
import { Screen, Section } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { outcomeWord } from '@/lib/brief';
import { getEntity, shortName } from '@/lib/data';
import { plural, relativeDay } from '@/lib/format';
import { useWorkspace } from '@/lib/store';
import { promiseDue } from '@/lib/target';
import type { Interaction } from '@/lib/types';
import { cn } from '@/lib/utils';
import { newestFirst } from '@/lib/workspace';

const SHOWN_FOLLOW_UPS = 5;
const SHOWN_NOTES = 6;
const DUE_TONE = { late: 'font-semibold text-danger', today: 'font-semibold text-warn', later: 'text-muted-foreground' } as const;
const KIND: Record<string, string> = { 'In-person visit': 'Visit', 'Phone call': 'Call', 'Video call': 'Video call', Meeting: 'Meeting', Email: 'Email' };

export default function Activity() {
  const ctx = useWorkspace();
  const profileHref = useProfileHref();
  const [query, setQuery] = useState('');
  const [allFollowUps, setAllFollowUps] = useState(false);
  const [allNotes, setAllNotes] = useState(false);
  const open = ctx.openFollowUps();
  const due = open.filter((f) => f.overdueBy >= 0).length;
  const followUps = allFollowUps ? open : open.slice(0, SHOWN_FOLLOW_UPS);
  const openPerson = (id: string) => {
    const who = getEntity(id);
    if (who) router.push(profileHref(who));
  };

  const words = query.trim().toLowerCase();
  const notes = ctx.ws.interactions.filter((i) => !i.deleted).sort(newestFirst);
  const found = words
    ? notes.filter((i) => [i.note, i.type, outcomeWord(i.outcome, i.type), i.author, getEntity(i.targetId)?.name, ...(i.contacts ?? [])].join(' ').toLowerCase().includes(words))
    : notes;
  const shown = words || allNotes ? found : found.slice(0, SHOWN_NOTES);

  return (
    <Screen inset>
      <TabHeader
        title="Activity"
        // The menu says how many are due, so this does too.
        sub={open.length ? [plural(open.length, 'open follow-up'), due && `${due} due now`].filter(Boolean).join(' · ') : 'No follow-ups open'}
      />

      {open.length ? (
        <Section title="Follow-ups">
          {followUps.map((f, i) => {
            const who = getEntity(f.targetId);
            const due = promiseDue(f, ctx.today);
            return (
              <View key={f.id} className={cn('flex-row items-center gap-2', i > 0 && 'border-t border-border pt-3')}>
                <Pressable onPress={() => openPerson(f.targetId)} accessibilityRole="link" className="flex-1 gap-0.5 rounded-md active:bg-accent">
                  <Text className="text-base">{f.text}</Text>
                  <Text className="text-sm text-muted-foreground">
                    {who ? `${shortName(who)} · ` : ''}
                    <Text className={cn('text-sm', DUE_TONE[due.tone])}>{due.text}</Text>
                  </Text>
                </Pressable>
                <Button size="sm" variant="outline" className="rounded-lg" onPress={() => ctx.completeFollowUp(f.id)} accessibilityLabel={`Done: ${f.text}`}>
                  <Icon as={Check} size={16} />
                  <Text>Done</Text>
                </Button>
              </View>
            );
          })}
          {!allFollowUps && open.length > SHOWN_FOLLOW_UPS ? (
            <Button variant="ghost" className="self-start" onPress={() => setAllFollowUps(true)}>
              <Text className="text-brand">{`Show all ${open.length}`}</Text>
            </Button>
          ) : null}
        </Section>
      ) : null}

      <Section title="Visits and notes" sub="Yours and your team’s, newest first">
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Find a note by any word"
          accessibilityLabel="Find a note"
          returnKeyType="search"
          autoCorrect={false}
          className="rounded-xl"
        />
        {words ? (
          <Text className="text-sm text-muted-foreground" accessibilityLiveRegion="polite">
            {found.length ? `${plural(found.length, 'note')} with “${query.trim()}”` : `No notes with “${query.trim()}”`}
          </Text>
        ) : null}
        {shown.map((i) => (
          <NoteRow key={i.id} interaction={i} onPress={() => openPerson(i.targetId)} />
        ))}
        {!words && !allNotes && found.length > SHOWN_NOTES ? (
          <Button variant="ghost" className="self-start" onPress={() => setAllNotes(true)}>
            <Text className="text-brand">{`Show all ${found.length}`}</Text>
          </Button>
        ) : null}
      </Section>
      <FinePrint>Notes and follow-ups you add stay on this phone for now.</FinePrint>
    </Screen>
  );
}

const OUTCOME_TONE: Record<string, string> = { Met: 'text-success', Talked: 'text-success', 'Not in': 'text-warn', 'Didn’t meet': 'text-warn', 'No answer': 'text-warn' };

/** Who, when, what kind and how it went, and the start of the note. */
function NoteRow({ interaction: i, onPress }: { interaction: Interaction; onPress: () => void }) {
  const ctx = useWorkspace();
  const who = getEntity(i.targetId);
  const outcome = outcomeWord(i.outcome, i.type);
  return (
    <Pressable onPress={onPress} accessibilityRole="link" className="gap-0.5 rounded-md border-t border-border pt-3 active:bg-accent">
      <Text className="text-base font-semibold">{who ? shortName(who) : 'Someone'}</Text>
      <Text className="text-sm text-muted-foreground">
        {`${relativeDay(i.date, ctx.today)} · ${KIND[i.type] ?? i.type} · `}
        <Text className={cn('text-sm', OUTCOME_TONE[outcome] ?? 'text-muted-foreground')}>{outcome}</Text>
        {i.author === 'You' ? '' : ` · ${i.author}`}
      </Text>
      {i.note ? (
        <Text className="text-base" numberOfLines={2}>
          {i.note}
        </Text>
      ) : null}
    </Pressable>
  );
}
