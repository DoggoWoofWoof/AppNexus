// Someone's page, the one page for every doctor and account: who they are and
// when, with the star that keeps them in My targets, the Summary (where they work, when they're in, how it has gone and what to
// do next, until the rep improves it), two big buttons for what to do now, then
// Ask, Call, Directions and Listen, and short cards with everything else
// (components/target-info.tsx), each opening in full where it is. A link from Ask
// can open one card with `section`. Shared by every tab (see src/app/*/target).

import { Stack, useLocalSearchParams } from 'expo-router';
import { CircleCheck } from 'lucide-react-native';
import { useRef } from 'react';
import { ScrollView, View, type ScrollViewInstance } from 'react-native';

import { Avatar, StarButton } from '@/components/entity';
import { useLogSheet } from '@/components/log-sheet';
import { NotFound, SampleNote } from '@/components/profile';
import { QuickActions } from '@/components/quick-actions';
import { SummaryCard } from '@/components/summary-card';
import { TargetInfo, useCards } from '@/components/target-info';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useVisitSheets } from '@/components/visit-sheets';
import { clashesWith, siteOnDay } from '@/lib/booking';
import { buildBrief, outcomeWord } from '@/lib/brief';
import { useNoteOpened } from '@/lib/chat';
import { getEntity, shortName, siteFor } from '@/lib/data';
import { minutesOfDay, relativeDay, toMinutes } from '@/lib/format';
import { endTime } from '@/lib/plan';
import { useWorkspace } from '@/lib/store';
import { cardFor } from '@/lib/target';
import type { Entity } from '@/lib/types';

export default function TargetPage() {
  const { id, section } = useLocalSearchParams<{ id: string; section?: string }>();
  const entity = getEntity(id);
  // A new section starts the page afresh, so the card it asks for opens.
  return entity ? <Page key={`${id}-${section ?? ''}`} entity={entity} section={section} /> : <NotFound />;
}

function Page({ entity, section }: { entity: Entity; section?: string }) {
  const ctx = useWorkspace();
  const visits = useVisitSheets();
  const { openLog, sheet } = useLogSheet({ onNotIn: visits.openNotIn });
  const scrollRef = useRef<ScrollViewInstance>(null);
  const cards = useCards(scrollRef, cardFor(entity, section));
  const short = shortName(entity);
  const brief = buildBrief(entity, ctx);
  useNoteOpened(entity.id);

  const visit = ctx.nextVisit(entity.id);
  const visitToday = visit?.day === ctx.todayIso;
  const todayPlan = ctx.ws.plans[ctx.todayIso] ?? [];
  // From the plan or a note, so meeting them by chance counts too.
  const logged = ctx.loggedToday(entity.id);
  const metToday = !!logged?.met;
  // Cancelled today and not planned again: it can go back while its time is still
  // to come, unless that time has been filled since.
  const cancelled = !visit && !logged ? todayPlan.find((i) => i.targetId === entity.id && i.status === 'cancelled') : undefined;
  const gone = !!cancelled && cancelled.mode === 'timed' && !!cancelled.time && toMinutes(endTime(cancelled)) <= minutesOfDay(new Date());
  const canRestore =
    !!cancelled && !gone && !(cancelled.mode === 'timed' && cancelled.time && clashesWith(todayPlan, cancelled.time, cancelled.duration, cancelled.id).length);
  const addDay = ctx.ws.selection.day;
  const unconfirmed = visit?.item.booking === 'requested';

  const when = visit
    ? visitToday
      ? (visit.item.time ?? 'Today')
      : `${relativeDay(visit.day, ctx.today)}${visit.item.time ? ` ${visit.item.time}` : ''}`
    : logged
      ? `${outcomeWord(logged.met ? 'Met' : 'Attempted', logged.type)} today`
      : cancelled
        ? 'Cancelled today'
        : '';
  const what = entity.kind === 'hcp' ? entity.specialty : entity.typeDetail;
  // Where the visit is, or where they work today.
  const siteId = visit?.item.siteId ?? siteOnDay(entity, ctx.today.getDay()) ?? undefined;

  return (
    <ScrollView ref={scrollRef} className="flex-1 bg-background" contentContainerClassName="gap-4 px-4 pb-10 pt-4">
      <Stack.Screen options={{ title: short, headerTitle: '' }} />
      <View className="flex-row items-center gap-3">
        <Avatar entity={entity} size="lg" />
        <View className="flex-1 gap-0.5">
          <Text className="text-xl font-semibold">{entity.name}</Text>
          <Text className="text-base text-muted-foreground">{[what, when].filter(Boolean).join(' · ')}</Text>
          {visit && entity.kind === 'hcp' ? <Text className="text-sm text-muted-foreground">{siteFor(entity, visit.item.siteId).name}</Text> : null}
        </View>
        <StarButton on={ctx.isTarget(entity.id)} name={entity.name} onPress={() => ctx.toggleTarget(entity.id)} />
      </View>

      <SummaryCard entity={entity} brief={brief} />

      {visit && unconfirmed ? (
        <View className="flex-row flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-warn-soft py-3 pl-4 pr-3">
          <Text className="min-w-40 flex-1 text-base">
            <Text className="text-base font-semibold">Not confirmed yet.</Text>
            {visit.item.via ? ` Booked through ${visit.item.via}.` : ''}
          </Text>
          <Button size="sm" variant="outline" className="rounded-lg bg-card" onPress={() => ctx.confirmBooking(visit.day, visit.item.id)}>
            <Text>They confirmed</Text>
          </Button>
        </View>
      ) : null}

      {logged ? (
        <View className={metToday ? 'flex-row items-center gap-2 rounded-xl bg-success-soft p-4' : 'flex-row items-center gap-2 rounded-xl bg-muted p-4'}>
          <Icon as={CircleCheck} size={20} className={metToday ? 'text-success' : 'text-muted-foreground'} />
          <Text className="flex-1 text-base font-semibold">{metToday ? 'Logged. Nice work.' : `Logged today: ${outcomeWord('Attempted', logged.type).toLowerCase()}.`}</Text>
        </View>
      ) : null}

      <View className="mt-2 gap-2">
        {visit && visitToday ? (
          <Button size="lg" className="rounded-xl" onPress={() => openLog(entity, { day: visit.day, id: visit.item.id, type: visit.item.type })}>
            <Text className="text-lg">Log visit</Text>
          </Button>
        ) : null}
        {cancelled && canRestore ? (
          <Button size="lg" className="rounded-xl" onPress={() => ctx.restoreVisit(ctx.todayIso, cancelled.id)}>
            <Text className="text-lg">{cancelled.time ? `Put it back at ${cancelled.time}` : 'Put it back'}</Text>
          </Button>
        ) : !visit && !logged ? (
          <Button size="lg" className="rounded-xl" onPress={() => ctx.addToPlan(entity.id, addDay)}>
            <Text className="text-lg">{`Add to ${ctx.dayWord(ctx.addingTo(addDay))}`}</Text>
          </Button>
        ) : null}
        {visit ? (
          <Button size="lg" variant="outline" className="rounded-xl" onPress={() => visits.openChange(entity, { day: visit.day, id: visit.item.id, item: visit.item })}>
            <Text className="text-lg">Change visit</Text>
          </Button>
        ) : null}
        {/* Seen without a visit today, such as by chance; after they've been met, a note about it, the way it happened. */}
        {visitToday ? null : (
          <Button
            size="lg"
            variant="outline"
            className="rounded-xl"
            onPress={() => openLog(entity, undefined, logged?.met ? { title: 'Add a note', seen: true, type: logged.type } : { title: 'Log a visit' })}
          >
            <Text className="text-lg">{metToday ? 'Add a note' : 'Log a visit'}</Text>
          </Button>
        )}
      </View>

      <QuickActions entity={entity} siteId={siteId} />

      <View className="mt-2" onLayout={cards.onBase}>
        <TargetInfo entity={entity} brief={brief} cards={cards} onBook={() => visits.openBook(entity)} />
      </View>
      <SampleNote />
      {sheet}
      {visits.sheets}
    </ScrollView>
  );
}
