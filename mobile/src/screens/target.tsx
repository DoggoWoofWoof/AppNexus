// Someone's page: who they are and when, two lines on why they matter, two big
// buttons for what to do now, then Ask, Call, Directions and Listen, and the facts
// worth knowing before a visit (components/target-info.tsx). The full profile is
// behind "All details". Shared by every tab (see src/app/*/target).

import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ChevronRight, CircleCheck } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';

import { Avatar, SignalTag, useDocHref, useProfileHref } from '@/components/entity';
import { useLogSheet } from '@/components/log-sheet';
import { NotFound } from '@/components/profile';
import { QuickActions } from '@/components/quick-actions';
import { TargetInfo } from '@/components/target-info';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useVisitSheets } from '@/components/visit-sheets';
import { clashesWith } from '@/lib/booking';
import { buildBrief } from '@/lib/brief';
import { getEntity, shortName, signalMeaning, siteFor } from '@/lib/data';
import { firstSentence, relativeDay } from '@/lib/format';
import { prepId } from '@/lib/saved';
import { useWorkspace } from '@/lib/store';
import type { Entity } from '@/lib/types';

const sentence = (text: string): string => (/[.!?]$/.test(text) ? text : `${text}.`);

export default function TargetPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entity = getEntity(id);
  return entity ? <Page entity={entity} /> : <NotFound />;
}

function Page({ entity }: { entity: Entity }) {
  const ctx = useWorkspace();
  const profileHref = useProfileHref();
  const docHref = useDocHref();
  const { openLog, sheet } = useLogSheet();
  const visits = useVisitSheets();
  const short = shortName(entity);
  const brief = buildBrief(entity, ctx);

  const visit = ctx.nextVisit(entity.id);
  const visitToday = visit?.day === ctx.todayIso;
  const todayPlan = ctx.ws.plans[ctx.todayIso] ?? [];
  const seenToday = todayPlan.some((i) => i.targetId === entity.id && i.status === 'done');
  // Cancelled today and not planned again: it can go back, unless its time has been filled since.
  const cancelled = !visit && !seenToday ? todayPlan.find((i) => i.targetId === entity.id && i.status === 'cancelled') : undefined;
  const canRestore = !!cancelled && !(cancelled.mode === 'timed' && cancelled.time && clashesWith(todayPlan, cancelled.time, cancelled.duration, cancelled.id).length);
  const addDay = ctx.ws.selection.day;
  const unconfirmed = visit?.item.booking === 'requested';

  const when = visit
    ? visitToday
      ? (visit.item.time ?? 'Today')
      : `${relativeDay(visit.day, ctx.today)}${visit.item.time ? ` ${visit.item.time}` : ''}`
    : seenToday
      ? 'Seen today'
      : cancelled
        ? 'Cancelled today'
        : '';
  const what = entity.kind === 'hcp' ? entity.specialty : entity.typeDetail;
  const where = entity.kind === 'hcp' ? siteFor(entity, visit?.item.siteId).name : entity.city.replace(/ \d{5}$/, '');
  const signals = ctx.signals(entity);


  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-4 px-4 pb-10 pt-4">
      <Stack.Screen options={{ title: short, headerTitle: '' }} />
      <View className="flex-row items-center gap-3">
        <Avatar entity={entity} size="lg" />
        <View className="flex-1 gap-0.5">
          <Text className="text-xl font-semibold">{entity.name}</Text>
          <Text className="text-base text-muted-foreground">{[what, when].filter(Boolean).join(' · ')}</Text>
          <Text className="text-sm text-muted-foreground">{where}</Text>
        </View>
      </View>
      {/* Each tag with what it means in plain words, since this is where a rep first meets them. */}
      {signals.length ? (
        <View className="-mt-1 gap-2">
          {signals.map((s) => (
            <View key={s.id} className="flex-row items-start gap-2">
              <SignalTag signal={s} />
              <Text className="flex-1 text-sm text-muted-foreground">{signalMeaning(s, entity)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Pressable
        onPress={() => router.push(docHref(prepId(entity.id)))}
        accessibilityRole="link"
        accessibilityHint="Opens the full prep"
        className="gap-2 rounded-xl bg-brand-soft p-4 active:opacity-80"
      >
        <Text className="text-base leading-6">{`${firstSentence(brief.insight)} ${sentence(brief.goal)}`}</Text>
        <View className="flex-row items-center gap-1">
          <Text className="text-sm font-semibold text-brand">Full prep</Text>
          <Icon as={ChevronRight} size={14} className="text-brand" />
        </View>
      </Pressable>

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

      {seenToday && !visit ? (
        <View className="flex-row items-center gap-2 rounded-xl bg-success-soft p-4">
          <Icon as={CircleCheck} size={20} className="text-success" />
          <Text className="flex-1 text-base font-semibold">Logged. Nice work.</Text>
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
        ) : !visit && !seenToday ? (
          <Button size="lg" className="rounded-xl" onPress={() => ctx.addToPlan(entity.id, addDay)}>
            <Text className="text-lg">{addDay === ctx.todayIso ? 'Add to today' : 'Add to tomorrow'}</Text>
          </Button>
        ) : null}
        {visit ? (
          <Button size="lg" variant="outline" className="rounded-xl" onPress={() => visits.openCantMakeIt(entity, { day: visit.day, id: visit.item.id, item: visit.item })}>
            <Text className="text-lg">Can’t make it</Text>
          </Button>
        ) : (
          <Button
            size="lg"
            variant="outline"
            className="rounded-xl"
            onPress={() => openLog(entity, undefined, seenToday ? { title: 'Add a note', seen: true } : { title: 'Log a visit' })}
          >
            <Text className="text-lg">{seenToday ? 'Add a note' : 'Log a visit'}</Text>
          </Button>
        )}
      </View>

      <QuickActions entity={entity} siteId={visit?.item.siteId} />

      <View className="mt-2">
        <TargetInfo entity={entity} brief={brief} />
      </View>

      <Button variant="ghost" className="self-center" onPress={() => router.push(profileHref(entity, 'details'))}>
        <Text className="text-muted-foreground">All details</Text>
        <Icon as={ChevronRight} size={16} className="text-muted-foreground" />
      </Button>
      {sheet}
      {visits.sheets}
    </ScrollView>
  );
}
