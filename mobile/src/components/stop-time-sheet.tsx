// Set a time for an "Any time" stop, from Edit on Today. Their usual times that
// day come first, clear of the rest of the plan; any other time can be typed.
// It's the rep's own time for the visit, so nothing is booked with the office.

import { useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';

import { Choices, Field, Footer, SheetBody, SheetContent } from '@/components/note-sheet';
import { FinePrint } from '@/components/profile';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { timesOnDay, usualTimes } from '@/lib/booking';
import { getEntity } from '@/lib/data';
import { relativeDay } from '@/lib/format';
import { isOnSite } from '@/lib/plan';
import { useWorkspace } from '@/lib/store';
import type { PlanItem } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Render `sheet` once on the screen that opens it. */
export function useStopTimeSheet() {
  const [open, setOpen] = useState<{ day: string; item: PlanItem } | null>(null);
  const close = () => setOpen(null);
  return {
    openStopTime: (day: string, item: PlanItem) => setOpen({ day, item }),
    sheet: (
      <Dialog open={!!open} onOpenChange={(o) => !o && close()}>
        {open ? <StopTimeForm day={open.day} item={open.item} onDone={close} /> : null}
      </Dialog>
    ),
  };
}

const OTHER = 'other';

function StopTimeForm({ day, item, onDone }: { day: string; item: PlanItem; onDone: () => void }) {
  const ctx = useWorkspace();
  const target = getEntity(item.targetId);
  const now = new Date();
  const isToday = day === ctx.todayIso;
  // Today, nothing in the next quarter of an hour.
  const times = target
    ? timesOnDay(target, {
        day,
        plan: ctx.ws.plans[day],
        duration: item.duration,
        onSite: isOnSite(item),
        earliest: isToday ? now.getHours() * 60 + now.getMinutes() + 15 : 0,
        except: item.id,
      })
    : [];
  const [pick, setPick] = useState(times[0] ?? OTHER);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!target) return null;

  const time = pick === OTHER ? typed.trim().padStart(5, '0') : pick;
  const best = target.kind === 'hcp' ? (target.contact.preferred ?? 'Not recorded · using office hours') : 'Office hours, Mon–Fri';
  const save = () => {
    const problem = ctx.setStopTime(day, item.id, time);
    if (problem) {
      setError(problem);
      AccessibilityInfo.announceForAccessibility(problem);
      return;
    }
    onDone();
  };

  return (
    <SheetContent title="Set a time" target={target} sub={`${target.name} · ${relativeDay(day, ctx.today)}`}>
      <SheetBody>
        <View className="gap-1">
          <Text className="text-sm text-muted-foreground">Best time</Text>
          <Text>{best}</Text>
        </View>
        <Choices
          label="Start at"
          value={pick}
          onChange={(value) => {
            setPick(value);
            setError(null);
          }}
          options={[...times.map((t) => ({ value: t, label: t })), { value: OTHER, label: 'Another time' }]}
        />
        {times.length ? null : (
          <Text className="-mt-2 text-sm text-muted-foreground">{`No free times in their usual hours ${isToday ? 'today' : 'that day'}. ${usualTimes(target)}.`}</Text>
        )}
        {pick === OTHER ? (
          <Field label="Start time" id="stop-time">
            <Input
              value={typed}
              onChangeText={(t) => {
                setTyped(t);
                setError(null);
              }}
              placeholder="e.g. 14:30"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              accessibilityLabel="Start time"
              aria-labelledby="stop-time"
              aria-invalid={!!error}
              className={cn(error && 'border-danger')}
            />
          </Field>
        ) : null}
        <FinePrint>The day then puts the visit at this time. Nothing is booked with their office.</FinePrint>
      </SheetBody>
      <Footer onCancel={onDone} onSave={save} saveLabel={pick === OTHER && !typed.trim() ? 'Set time' : `Set ${time}`} error={error ? { message: error } : null} />
    </SheetContent>
  );
}
