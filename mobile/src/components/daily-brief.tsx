// The daily brief at the top of Today (lib/daily-brief.ts), open when the day
// starts, to take in at a glance. A tile for each state of the territory and
// next door says who to reach out to there and why: someone beyond My targets
// using a competitor's products, or growing fast, a chip in the rep's own states
// when hardly anyone there is in My targets, and a line on competitors' products
// there. Then three doctors worth adding to the day, each with why in a sentence,
// how much they do and the driving a visit adds, in the rep's own territory until
// a tile is tapped, which picks that state for them, staying on Today; tapping it
// again goes back. "Full list" beside them opens Targets on everyone there.
// "+ Add" puts them in the day as a visit where it adds the least driving, as
// Build route on Targets does, and they show up in the day below. Tapping them
// asks Ask why they're worth seeing. The people for each state stay as they were
// when it showed them, so adding someone, or looking at another state and coming
// back, doesn't move the rows. Screen readers hear each tile and person in a
// sentence or two.
//
// One colour for each kind of fact, as in Today's review and the labels on the
// stops: rose for a competitor's products, green for what's working, and blue
// only for what can be tapped. A change on last year is the zig-zag arrow, as
// everywhere in the app (`Delta`). Once everyone in it is in the day, or the rep
// taps Done or its heading, it folds to a line at the top saying what's left,
// beside their faces, which opens it again. It folds too with Build route on
// Targets, and opens again the next day. With nothing to show it isn't shown.

import { router } from 'expo-router';
import { Car, Check, ChevronDown, ChevronRight, ChevronUp, Newspaper } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { Delta } from '@/components/charts';
import { Avatar, useChatHref } from '@/components/entity';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useChat } from '@/lib/chat';
import { dailyBrief, type BriefPerson, type BriefTerritory, type DailyBrief as Brief } from '@/lib/daily-brief';
import { getEntity, shortName } from '@/lib/data';
import { SHORT_SPECIALTY } from '@/lib/specialties';
import { useWorkspace } from '@/lib/store';
import { cn } from '@/lib/utils';

/** What tapping someone in the brief asks about them. */
export const WORTH_SEEING = 'Why are they worth seeing?';

/** Opens Targets with a search. `from` is new each time, so the same link sets the search again. */
const seeOnTargets = (find: string) => router.navigate({ pathname: '/targets', params: { find, from: String(Date.now()), by: 'brief' } });

/** True when the text is so large, or the screen so narrow, that words would be squeezed beside an icon or button. */
function useNarrow() {
  const { width, fontScale } = useWindowDimensions();
  return width / fontScale < 300;
}

/** A tile's colours for why to look at a state, a gap in My targets, a competitor's pattern or neither, with its faces and its line. */
const TILES: Record<BriefTerritory['tone'], { tile: string; face: string; line: string }> = {
  gap: { tile: 'border-brand-line bg-brand-soft', face: 'bg-card', line: 'border-brand-line' },
  competitor: { tile: 'border-signal-line bg-signal-soft', face: 'bg-card', line: 'border-signal-line' },
  plain: { tile: 'border-border bg-background', face: '', line: 'border-border' },
};

/** The brief, the day shown and the day it adds to, whether it's folded away, and the state picked on a tile. */
export interface BriefState {
  brief: Brief;
  day: string;
  /** The day + puts people in: the day shown, or once today is over the next working day. */
  on: string;
  folded: boolean;
  /** The state whose tile was tapped, for who's worth adding there; null for the rep's own territory. */
  picked: string | null;
  pick: (state: string | null) => void;
}

/**
 * The brief for `day` as it is at `now`, Today's clock, so a visit on the way is
 * still to come; null with nothing to show. Its people are in the rep's own
 * territory, or the state picked on a tile until the next day, never what
 * Targets is showing, so looking around there doesn't change Today. Who it
 * suggested stays, for each day, state and procedures, so adding someone or
 * looking at another state doesn't move the rows.
 */
export function useDailyBrief(day: string, now: Date): BriefState | null {
  const ctx = useWorkspace();
  // Once today is over, + puts people on the next working day, so the brief is for that day.
  const on = ctx.addingTo(day);
  const { codes } = ctx.ws.prefs;
  const [pickedOn, setPickedOn] = useState<{ day: string; state: string } | null>(null);
  const picked = pickedOn?.day === ctx.todayIso ? pickedOn.state : null;
  const key = `${on}|${picked ?? ''}|${codes}`;
  const [kept, setKept] = useState<Record<string, string[]>>({});
  // Worked out again when the workspace changes, or each minute, as the brief looks at everyone.
  const minute = Math.floor(now.getTime() / 60_000);
  const brief = useMemo(
    () => dailyBrief(ctx, on, { states: picked ? [picked] : [], codes }, kept[key] ?? [], now),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `now` counts by the minute, and `picked` and `codes` are in `key`.
    [ctx, on, key, kept, minute],
  );
  if (!kept[key]) setKept({ ...kept, [key]: brief.people.map((p) => p.row.entity.id) });
  // A state with nobody doing the procedures chosen has no tile, so it can't stay picked.
  if (picked && !brief.territories.some((t) => t.state === picked)) setPickedOn(null);
  if (!brief.territories.length && !brief.people.length) return null;
  return {
    brief,
    day,
    on,
    folded: ctx.ws.selection.briefFolded === ctx.todayIso,
    picked,
    pick: (state) => setPickedOn(state ? { day: ctx.todayIso, state } : null),
  };
}

/** The brief (`useDailyBrief`): open, the states and who to add; folded, a line with their faces. */
export function DailyBrief({ state: { brief, day, on, folded, picked, pick } }: { state: BriefState }) {
  const ctx = useWorkspace();
  const chat = useChat();
  const chatHref = useChatHref();
  const narrow = useNarrow();
  const dayWord = ctx.dayWord(on);
  const when = dayWord === 'today' || dayWord === 'tomorrow' ? dayWord : `on ${dayWord}`;

  /** Opens the chat about someone with the question asked, unless it was the last one asked there. */
  const askAbout = (id: string) => {
    const who = getEntity(id);
    if (!who) return;
    const turns = chat.turns(id);
    if (turns[turns.length - 1]?.question !== WORTH_SEEING) void chat.ask(id, WORTH_SEEING);
    router.push(chatHref(who));
  };
  const add = (id: string) => {
    // To the day shown, as + adds everywhere: once today is over that's the next
    // working day, which Today then shows, with "Today instead".
    ctx.addToPlan(id, day);
    // Once everyone in it is in the day, it folds away and the day comes up.
    if (brief.people.every((p) => p.row.entity.id === id || ctx.planItemFor(p.row.entity.id, on))) ctx.foldBrief();
  };
  /** Opens Targets on everyone where the people are, the state picked or the rep's own territory, as its territory chip. */
  const seeAll = () => {
    ctx.setPrefs({ states: picked ? [picked] : [] });
    seeOnTargets(brief.find);
  };
  const place = brief.territories.find((t) => t.state === picked)?.name ?? 'your territory';

  return (
    <View className="rounded-xl border border-border bg-card">
      <Pressable
        onPress={() => ctx.foldBrief(!folded)}
        accessibilityRole="button"
        accessibilityState={{ expanded: !folded }}
        accessibilityLabel={folded && brief.line ? `Daily brief. ${brief.line}` : 'Daily brief'}
        className="min-h-16 flex-row items-center gap-3 rounded-xl p-3 active:bg-accent"
      >
        {/* At very large text the icon and faces go, so the words have the room. */}
        {narrow ? null : (
          <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-soft">
            <Icon as={Newspaper} size={20} className="text-brand" />
          </View>
        )}
        {/* Folded, what's left of it; open, it says that itself. */}
        <View className="flex-1 gap-0.5">
          <Text className={cn('font-serif', folded ? 'text-lg' : 'text-xl')}>Daily brief</Text>
          {folded && brief.short ? <Text className="text-xs text-muted-foreground">{brief.short}</Text> : null}
        </View>
        {folded && !narrow ? <Faces people={brief.people} day={on} /> : null}
        <Icon as={folded ? ChevronDown : ChevronUp} size={18} className="text-muted-foreground" />
      </Pressable>
      {folded ? null : (
        <View className="gap-3 px-3 pb-3">
          <Territories territories={brief.territories} picked={picked} onPick={(t) => pick(picked === t.state ? null : t.state)} />
          <View>
            <View className="flex-row items-center gap-2 pb-1.5">
              <Text variant="kicker" role="heading" className="flex-1">
                {brief.heading}
              </Text>
              <Pressable
                onPress={seeAll}
                accessibilityRole="link"
                accessibilityLabel={`Full list of everyone in ${place}, on Targets`}
                hitSlop={8}
                className="flex-row items-center gap-0.5 active:opacity-70"
              >
                <Text className="text-sm font-semibold text-brand">Full list</Text>
                <Icon as={ChevronRight} size={14} className="text-brand" />
              </Pressable>
            </View>
            {brief.people.length ? (
              brief.people.map((person) => <PersonRow key={person.row.entity.id} person={person} day={on} when={when} onAdd={add} onAsk={askAbout} />)
            ) : (
              <Text className="border-t border-border py-3 text-sm text-muted-foreground">{`No one ${picked ? 'there' : 'in your territory'} fits in ${when}.`}</Text>
            )}
          </View>
          {/* At very large text Done goes under the fine print, so it isn't squeezed. */}
          <View className={cn('gap-3', !narrow && 'flex-row items-center')}>
            <Text className={cn('text-xs text-muted-foreground', !narrow && 'flex-1')}>{`${brief.figures} Illustrative figures.`}</Text>
            <Button
              size="sm"
              variant="outline"
              className={cn('rounded-lg', narrow && 'self-start')}
              onPress={() => ctx.foldBrief()}
              accessibilityLabel="Done with the daily brief"
            >
              <Text>Done</Text>
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * A tile for each state, the rep's own territory beside next door, two to a
 * row; one under the other at very large text, or when there's only one side.
 */
function Territories({
  territories,
  picked,
  onPick,
}: {
  territories: BriefTerritory[];
  picked: string | null;
  onPick: (t: BriefTerritory) => void;
}) {
  const narrow = useNarrow();
  const yours = territories.filter((t) => t.yours);
  const nextDoor = territories.filter((t) => !t.yours);
  const tile = (t: BriefTerritory) => <Tile key={t.state} territory={t} picked={t.state === picked} onPress={() => onPick(t)} />;
  if (narrow || !yours.length || !nextDoor.length) {
    return [
      { title: 'Your territory', tiles: yours },
      { title: 'Next door', tiles: nextDoor },
    ].map((side) =>
      side.tiles.length ? (
        <View key={side.title} className="gap-2">
          <Text variant="kicker" role="heading">
            {side.title}
          </Text>
          {side.tiles.map(tile)}
        </View>
      ) : null,
    );
  }
  const rows = Array.from({ length: Math.max(yours.length, nextDoor.length) }, (_, i) => [yours[i], nextDoor[i]]);
  return (
    <View className="gap-2">
      {/* Screen readers hear "next door" in each tile instead, as the tiles go across. */}
      <View className="flex-row gap-2" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text variant="kicker" className="flex-1">
          Your territory
        </Text>
        <Text variant="kicker" className="flex-1">
          Next door
        </Text>
      </View>
      {rows.map((row) => (
        <View key={row.map((t) => t?.state).join()} className="flex-row gap-2">
          {row.map((t, i) => (t ? tile(t) : <View key={i} className="flex-1" />))}
        </View>
      ))}
    </View>
  );
}

/**
 * A state at a glance: in the rep's own, a chip when hardly anyone there is in My
 * targets; who to reach out to there first beyond them, with why in its colour
 * and the trend; and under a line, competitors' products there, who in rose when
 * enough of a specialty use the same one, or in bold how few use any. Tapping it
 * picks it for who's worth adding below, with a tick in its corner where an empty
 * ring was; tapping it again goes back to the rep's whole territory.
 */
function Tile({ territory: t, picked, onPress }: { territory: BriefTerritory; picked: boolean; onPress: () => void }) {
  const tone = TILES[t.tone];
  return (
    <Pressable
      onPress={onPress}
      // One or none at a time, so a radio, though tapping it again unpicks it.
      accessibilityRole="radio"
      // Not accessibilityState: the web build only passes aria-checked on.
      aria-checked={picked}
      accessibilityLabel={t.words}
      accessibilityHint={picked ? 'Shows who’s worth adding in your whole territory' : 'Shows who’s worth adding there'}
      // A thicker border when picked, with the padding a pixel less, so nothing moves.
      className={cn('flex-1 gap-2 rounded-xl active:opacity-70', tone.tile, picked ? 'border-2 border-primary p-[9px]' : 'border p-2.5')}
    >
      <View className="flex-row items-center gap-1">
        <Text className="flex-1 text-sm font-semibold">{t.name}</Text>
        {picked ? (
          <View className="h-4 w-4 items-center justify-center rounded-full bg-primary">
            <Icon as={Check} size={10} strokeWidth={4} className="text-primary-foreground" />
          </View>
        ) : (
          <View className="h-4 w-4 rounded-full border-[1.5px] border-muted-foreground" />
        )}
      </View>
      {t.gap ? (
        <View className="self-start rounded-full bg-card px-2 py-0.5">
          <Text className="text-2xs font-semibold text-brand">{t.gap}</Text>
        </View>
      ) : null}
      {t.first ? (
        <View className="flex-row items-center gap-2">
          <Avatar entity={t.first.row.entity} size="sm" className={tone.face} />
          <View className="flex-1">
            <Text className="text-sm font-semibold" numberOfLines={1}>
              {shortName(t.first.row.entity)}
            </Text>
            <View className="flex-row flex-wrap items-center gap-x-1.5">
              <Text className={cn('text-2xs font-semibold', t.first.competitor ? 'text-signal-text' : 'text-success')}>{t.first.why}</Text>
              <Delta value={t.first.change} suffix="" small hideFlat />
            </View>
          </View>
        </View>
      ) : null}
      <View className={cn('border-t pt-2', tone.line)}>
        <Text className="text-xs">
          <Text className={cn('text-xs font-semibold', t.summary.pattern && 'text-signal-text')}>{t.summary.lead}</Text>
          {` ${t.summary.rest}`}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Someone worth adding: who, why in a sentence, with the reason in its colour,
 * how much they do and the driving a visit adds, and "+ Add", as on Targets, or
 * "Added" once they're in the day. Tapping them asks about them.
 */
function PersonRow({
  person,
  day,
  when,
  onAdd,
  onAsk,
}: {
  person: BriefPerson;
  day: string;
  when: string;
  onAdd: (id: string) => void;
  onAsk: (id: string) => void;
}) {
  const ctx = useWorkspace();
  // At very large text the face goes, and the button goes under the words, as on Today.
  const narrow = useNarrow();
  const { entity } = person.row;
  const specialty = entity.kind === 'hcp' ? (SHORT_SPECIALTY[entity.specialty] ?? entity.specialty) : '';
  const trend = person.change >= 1 ? `, up ${person.change}%` : person.change <= -1 ? `, down ${-person.change}%` : '';
  const action = ctx.planItemFor(entity.id, day) ? (
    <View className="min-h-9 flex-row items-center gap-1 px-2" accessibilityLabel={`${entity.name} is in your plan`}>
      <Icon as={Check} size={16} className="text-success" />
      <Text className="text-sm text-success">Added</Text>
    </View>
  ) : (
    <Button size="sm" variant="outline" className="rounded-lg" onPress={() => onAdd(entity.id)} accessibilityLabel={`Add ${entity.name} ${when}`}>
      <Text>+ Add</Text>
    </Button>
  );
  return (
    <View className="flex-row gap-3 border-t border-border py-3">
      {narrow ? null : <Avatar entity={entity} />}
      <View className="flex-1 gap-2">
        <View className="flex-row items-start gap-2">
          <Pressable
            onPress={() => onAsk(entity.id)}
            accessibilityRole="button"
            accessibilityLabel={[`${entity.name}. ${person.lead}${person.rest}`, `${person.figure}${trend}.`, person.driving && `${person.driving}.`].filter(Boolean).join(' ')}
            accessibilityHint="Asks why they’re worth seeing"
            className="flex-1 gap-1 active:opacity-70"
          >
            <Text className="text-base font-semibold">
              {shortName(entity)}
              {specialty ? <Text className="text-sm font-normal text-muted-foreground">{` · ${specialty}`}</Text> : null}
            </Text>
            <Text className="text-sm">
              <Text className={cn('text-sm font-semibold', person.competitor ? 'text-signal-text' : 'text-success')}>{person.lead}</Text>
              {person.rest}
            </Text>
            <View className="flex-row flex-wrap items-center gap-x-3 gap-y-0.5" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View className="flex-row items-center gap-1">
                <Text className="text-xs text-muted-foreground">{person.figure}</Text>
                <Delta value={person.change} suffix="" hideFlat />
              </View>
              {person.driving ? (
                <View className="flex-row items-center gap-1">
                  <Icon as={Car} size={14} className="text-muted-foreground" />
                  <Text className="text-xs text-muted-foreground">{person.driving}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
          {narrow ? null : action}
        </View>
        {narrow ? <View className="flex-row">{action}</View> : null}
      </View>
    </View>
  );
}

/** The people in the brief as faces, with a tick on those in the day, for when it's folded. */
function Faces({ people, day }: { people: BriefPerson[]; day: string }) {
  const ctx = useWorkspace();
  return (
    <View className="flex-row" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {people.map((p, i) => (
        // The first on top, so each tick shows.
        <View key={p.row.entity.id} className={cn('rounded-full border-2 border-card', i > 0 && '-ml-2')} style={{ zIndex: people.length - i }}>
          <Avatar entity={p.row.entity} size="sm" />
          {ctx.planItemFor(p.row.entity.id, day) ? (
            <View className="absolute -bottom-1 -right-1 h-4 w-4 items-center justify-center rounded-full border-2 border-card bg-success">
              <Icon as={Check} size={9} strokeWidth={4} className="text-card" />
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}
