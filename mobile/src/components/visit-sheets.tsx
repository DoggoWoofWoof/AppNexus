// The planner's sheets, after the prototype's visit options, cancel and book
// sheets (demo/js/sheets.js): what to do with a planned visit, cancelling it
// (a freed slot is then filled from Targets), logging it and booking a time.

import { router } from 'expo-router';
import {
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CalendarX,
  ChevronRight,
  CircleX,
  Clock,
  FileText,
  NotebookPen,
  RotateCcw,
  Target,
  type LucideIcon,
} from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';

import { useProfileHref } from '@/components/entity';
import { Choices, Field, Footer, NoteForm, SheetBody, SheetContent } from '@/components/note-sheet';
import { FinePrint } from '@/components/profile';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { bookingRoute, siteOnDay, type Slot } from '@/lib/booking';
import { getEntity, getOrg, siteFor } from '@/lib/data';
import { formatDate, fromIso, relativeDay } from '@/lib/format';
import { endTime } from '@/lib/plan';
import { useWorkspace } from '@/lib/store';
import type { Entity, PlanItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CANCEL_REASONS, findItem } from '@/lib/workspace';

type Ref = { day: string; id: string };
type Sheet =
  | ({ kind: 'options' } & Ref)
  | ({ kind: 'cancel' } & Ref)
  | ({ kind: 'log' } & Ref)
  | { kind: 'book'; targetId: string; from?: Ref };

/** The visit, cancel, log and book sheets. Render `sheets` once on the screen that opens them. */
export function useVisitSheets() {
  const ctx = useWorkspace();
  const profileHref = useProfileHref();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const close = () => setSheet(null);
  const onOpenChange = (open: boolean) => !open && close();
  const done = (message: string) => {
    close();
    AccessibilityInfo.announceForAccessibility(message);
  };

  const item = sheet && sheet.kind !== 'book' ? findItem(ctx.ws, sheet.day, sheet.id) : null;
  const target = sheet ? getEntity(sheet.kind === 'book' ? sheet.targetId : (item?.targetId ?? '')) : null;
  const ref = sheet && sheet.kind !== 'book' ? { day: sheet.day, id: sheet.id } : null;

  /** Targets, showing people not planned that day, nearest to the cancelled visit first. */
  const showReplacements = () => {
    close();
    router.navigate('/targets');
  };

  const content = (): ReactNode => {
    if (!sheet || !target) return null;
    if (sheet.kind === 'book') {
      const from = sheet.from ? findItem(ctx.ws, sheet.from.day, sheet.from.id) : null;
      return (
        <BookForm target={target} from={from && sheet.from ? { ...sheet.from, item: from } : null} onCancel={close} onSaved={done} />
      );
    }
    if (!item || !ref) return null;
    if (sheet.kind === 'log') {
      return (
        <SheetContent title="Log visit" target={target}>
          <NoteForm target={target} visit={{ ...ref, type: item.type }} onCancel={close} onSaved={done} />
        </SheetContent>
      );
    }
    if (sheet.kind === 'cancel') {
      return (
        <SheetContent title="Cancel visit" target={target} sub={visitLine(item, ref.day, ctx.today)}>
          <SheetBody>
            <Text className="text-sm text-muted-foreground">
              {item.mode === 'timed' && item.time
                ? `Tap the reason. Targets then shows who's nearest for ${item.time}.`
                : 'Tap the reason.'}
            </Text>
            <View className="gap-2" accessibilityRole="radiogroup" accessibilityLabel="Why was it cancelled?">
              {CANCEL_REASONS.map((reason) => (
                <OptionRow
                  key={reason}
                  icon={CalendarX}
                  title={reason}
                  onPress={() => {
                    const freed = ctx.cancelVisit(ref.day, ref.id, reason);
                    if (freed) showReplacements();
                    else done('Visit cancelled');
                  }}
                />
              ))}
            </View>
          </SheetBody>
          <View className="border-t border-border px-5 py-3">
            <Button variant="outline" onPress={close}>
              <Text>Keep visit</Text>
            </Button>
          </View>
        </SheetContent>
      );
    }

    const free = ctx.ws.replacement?.itemId === item.id;
    return (
      <SheetContent title={target.name} target={target} sub={visitLine(item, ref.day, ctx.today)}>
        <SheetBody>
          {item.goal ? <Hint icon={Target}>{item.goal}</Hint> : null}
          {item.status === 'cancelled' ? <Hint icon={CircleX}>{`Cancelled${item.cancelReason ? ` · ${item.cancelReason}` : ''}.`}</Hint> : null}
          {item.status === 'planned' && item.booking === 'requested' ? (
            <Hint icon={Clock}>{`Requested${item.via ? ` through ${item.via}` : ''}. Not confirmed yet.`}</Hint>
          ) : null}
          {item.status === 'done' ? <Hint icon={CalendarCheck}>Logged. The note is in Activity.</Hint> : null}
          <View className="gap-1">
            {item.status === 'planned' ? (
              <>
                <OptionRow
                  icon={FileText}
                  title="Prepare"
                  sub="Why now, goal and talking points"
                  onPress={() => {
                    close();
                    router.push(profileHref(target));
                  }}
                />
                {item.booking === 'requested' ? (
                  <OptionRow
                    icon={CalendarCheck}
                    title="Mark confirmed"
                    sub="They’ve agreed to the time"
                    onPress={() => {
                      ctx.confirmBooking(ref.day, ref.id);
                      close();
                    }}
                  />
                ) : null}
                <OptionRow icon={NotebookPen} title="Log visit" sub="Write a note and mark it done" onPress={() => setSheet({ kind: 'log', ...ref })} />
                <OptionRow
                  icon={CalendarClock}
                  title="Reschedule"
                  sub="Pick another time that suits them"
                  onPress={() => setSheet({ kind: 'book', targetId: target.id, from: ref })}
                />
                <OptionRow
                  icon={CalendarX}
                  title="Cancel visit"
                  sub={item.mode === 'timed' ? 'Then fill the slot with someone nearby' : undefined}
                  danger
                  onPress={() => setSheet({ kind: 'cancel', ...ref })}
                />
              </>
            ) : null}
            {free ? <OptionRow icon={CalendarPlus} title={`Fill ${item.time}`} sub="Nearest unplanned people, in Targets" onPress={showReplacements} /> : null}
            {item.status === 'cancelled' ? (
              <OptionRow
                icon={RotateCcw}
                title="Restore visit"
                sub={item.mode === 'timed' && item.time ? `Back at ${item.time}` : undefined}
                onPress={() => {
                  ctx.restoreVisit(ref.day, ref.id);
                  close();
                }}
              />
            ) : null}
          </View>
        </SheetBody>
      </SheetContent>
    );
  };

  return {
    /** What to do with a planned visit. */
    openVisit: (day: string, id: string) => setSheet({ kind: 'options', day, id }),
    /** Book a time with someone. */
    openBook: (entity: Entity) => setSheet({ kind: 'book', targetId: entity.id }),
    sheets: (
      <Dialog open={!!sheet} onOpenChange={onOpenChange}>
        {content()}
      </Dialog>
    ),
  };
}

const visitLine = (item: PlanItem, day: string, today: Date): string => {
  const target = getEntity(item.targetId);
  const when = item.mode === 'timed' && item.time ? `${item.time}–${endTime(item)}` : 'Flexible time';
  return [relativeDay(day, today), when, target ? siteFor(target, item.siteId).name : ''].filter(Boolean).join(' · ');
};

function Hint({ icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <View className="flex-row items-start gap-2">
      <Icon as={icon} size={16} className="mt-0.5 text-muted-foreground" />
      <Text className="flex-1 text-sm text-muted-foreground">{children}</Text>
    </View>
  );
}

function OptionRow({ icon, title, sub, danger = false, onPress }: { icon: LucideIcon; title: string; sub?: string; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityHint={sub} className="min-h-12 flex-row items-center gap-3 rounded-md px-1 py-2 active:bg-accent">
      <Icon as={icon} size={18} className={danger ? 'text-danger' : 'text-muted-foreground'} />
      <View className="flex-1 gap-0.5">
        <Text className={cn('font-medium', danger && 'text-danger')}>{title}</Text>
        {sub ? <Text className="text-sm text-muted-foreground">{sub}</Text> : null}
      </View>
      <Icon as={ChevronRight} size={16} className="text-muted-foreground" />
    </Pressable>
  );
}

const OTHER = 'other';

/** Book a time, or move a planned visit: their usual times first, clear of the rest of the plan. */
function BookForm({
  target,
  from,
  onCancel,
  onSaved,
}: {
  target: Entity;
  from: (Ref & { item: PlanItem }) | null;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const ctx = useWorkspace();
  const slots = ctx.slotsFor(target, from?.item);
  const [pick, setPick] = useState(slots.length ? '0' : OTHER);
  const [day, setDay] = useState(ctx.bookingDays[0]);
  const [time, setTime] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const route = bookingRoute(target);
  const best = target.kind === 'hcp' ? (target.contact.preferred ?? 'Not recorded · using office hours') : 'Office hours, Mon–Fri';

  const chosen: Slot | null =
    pick === OTHER
      ? time
        ? { day, time: time.trim().padStart(5, '0'), siteId: siteOnDay(target, fromIso(day).getDay()) ?? siteFor(target).id }
        : null
      : (slots[Number(pick)] ?? null);
  const label = chosen ? ` ${formatDate(chosen.day)} ${chosen.time}` : '';

  const save = () => {
    const problem = ctx.book({ targetId: target.id, slot: chosen, confirmed, from: from ? { day: from.day, id: from.id } : undefined });
    if (problem) {
      setError(problem);
      AccessibilityInfo.announceForAccessibility(problem);
      return;
    }
    onSaved(confirmed ? 'Visit booked' : 'Visit requested');
  };
  const choose = (value: string) => {
    setPick(value);
    setError(null);
  };

  return (
    <SheetContent
      title={from ? 'Reschedule' : 'Book a time'}
      target={target}
      sub={from ? `${target.name} · was ${visitLine(from.item, from.day, ctx.today)}` : undefined}
    >
      <SheetBody>
        <View className="gap-1">
          <Text className="text-sm text-muted-foreground">Best time</Text>
          <Text>{best}</Text>
        </View>
        <View className="gap-1">
          <Text className="text-sm text-muted-foreground">Book through</Text>
          <Text selectable>{route.label === 'Email' ? route.value : `${route.label} · ${route.value}`}</Text>
        </View>

        <View className="gap-2" accessibilityRole="radiogroup" accessibilityLabel="When">
          <Text className="text-sm font-medium">When</Text>
          {slots.map((slot, i) => (
            <SlotRow
              key={`${slot.day}-${slot.time}`}
              title={`${formatDate(slot.day)} · ${slot.time}`}
              sub={getOrg(slot.siteId)?.name}
              on={pick === String(i)}
              onPress={() => choose(String(i))}
            />
          ))}
          <SlotRow
            title="Another time"
            sub={slots.length ? undefined : 'No times in their usual hours in the next five working days'}
            on={pick === OTHER}
            onPress={() => choose(OTHER)}
          />
        </View>
        {pick === OTHER ? (
          <View className="gap-4 rounded-md border border-border p-3">
            <Choices label="Day" value={day} onChange={setDay} options={ctx.bookingDays.map((d) => ({ value: d, label: relativeDay(d, ctx.today) }))} />
            <Field label="Start time" id="book-time">
              <Input
                value={time}
                onChangeText={(t) => {
                  setTime(t);
                  setError(null);
                }}
                placeholder="e.g. 14:30"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                accessibilityLabel="Start time"
                aria-labelledby="book-time"
                aria-invalid={!!error}
                className={cn(error && 'border-danger')}
              />
            </Field>
          </View>
        ) : null}

        <View className="min-h-11 flex-row items-center gap-3">
          <Checkbox checked={confirmed} onCheckedChange={setConfirmed} aria-labelledby="book-confirmed" accessibilityLabel="They’ve already agreed to this time" />
          <Label nativeID="book-confirmed" onPress={() => setConfirmed(!confirmed)} className="flex-1 text-base">
            They’ve already agreed to this time
          </Label>
        </View>
        <FinePrint>
          {`${confirmed ? 'It goes in your plan as confirmed.' : 'It goes in your plan as requested until you mark it confirmed.'} Calendar and CRM sync come later.`}
        </FinePrint>
      </SheetBody>
      <Footer onCancel={onCancel} onSave={save} saveLabel={`${confirmed ? 'Book' : 'Request'}${label}`} error={error ? { message: error } : null} />
    </SheetContent>
  );
}

function SlotRow({ title, sub, on, onPress }: { title: string; sub?: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={sub ? `${title}, ${sub}` : title}
      className={cn('min-h-12 flex-row items-center gap-3 rounded-md border px-3 py-2', on ? 'border-primary bg-accent' : 'border-border bg-card')}
    >
      <View className={cn('h-4 w-4 items-center justify-center rounded-full border', on ? 'border-primary' : 'border-muted-foreground')}>
        {on ? <View className="h-2 w-2 rounded-full bg-primary" /> : null}
      </View>
      <View className="flex-1 gap-0.5">
        <Text className={cn('font-medium', on && 'text-accent-foreground')}>{title}</Text>
        {sub ? <Text className="text-sm text-muted-foreground">{sub}</Text> : null}
      </View>
    </Pressable>
  );
}
