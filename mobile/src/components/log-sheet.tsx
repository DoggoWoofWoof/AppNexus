// Log a visit: Met or Not in, then talk (or type) and Save. Logging a planned
// visit marks it done; with nothing planned it asks whether it was a visit or a
// call. At an account it also asks who was there. Once they've been seen today
// it's just a note. "Add a follow-up" saves something to do next, and when.

import { Check, Mic, Plus, Square } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, View } from 'react-native';

import { Choices, DueChoices, Problem, SheetBody, SheetContent } from '@/components/note-sheet';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Text } from '@/components/ui/text';
import { descendantsOf, getEntity, hcpsAt, shortName } from '@/lib/data';
import { addDays, isoDate } from '@/lib/format';
import { draftKey } from '@/lib/persist';
import { useWorkspace } from '@/lib/store';
import type { Entity, VisitType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { canListen, listen, VOICE_ERRORS, type Listening } from '@/lib/voice';
import type { DraftError } from '@/lib/workspace';

type Visit = { day: string; id: string; type: VisitType };
type Options = {
  title?: string;
  /** Already seen today, so only the note is asked for. */
  seen?: boolean;
};

/** The log sheet. Render `sheet` once on the screen that opens it. `onNotIn` follows a visit logged as not in. */
export function useLogSheet({ onNotIn }: { onNotIn?: (target: Entity, visit: Visit) => void } = {}) {
  const [open, setOpen] = useState<{ target: Entity; visit?: Visit; options: Options } | null>(null);
  const close = () => setOpen(null);
  return {
    /** Log a planned visit, or with no visit a note about someone. */
    openLog: (target: Entity, visit?: Visit, options: Options = {}) => setOpen({ target, visit, options }),
    sheet: (
      <Dialog open={!!open} onOpenChange={(o) => !o && close()}>
        {open ? (
          <SheetContent title={open.options.title ?? (open.visit ? 'Log visit' : 'Add a note')} target={open.target}>
            <LogForm
              target={open.target}
              visit={open.visit}
              seen={!!open.options.seen}
              onDone={(outcome) => {
                const { target, visit } = open;
                close();
                if (outcome === 'Attempted' && visit) onNotIn?.(target, visit);
              }}
            />
          </SheetContent>
        ) : null}
      </Dialog>
    ),
  };
}

function LogForm({ target, visit, seen, onDone }: { target: Entity; visit?: Visit; seen: boolean; onDone: (outcome: string) => void }) {
  const ctx = useWorkspace();
  const inPersonType: VisitType = target.kind === 'hco' ? 'Meeting' : 'In-person visit';
  const [type, setType] = useState<VisitType>(visit?.type ?? inPersonType);
  const inPerson = type === 'In-person visit' || type === 'Meeting';
  const choices = inPerson
    ? [
        { value: 'Met', label: 'Met' },
        { value: 'Attempted', label: 'Not in' },
      ]
    : [
        { value: 'Met', label: 'Talked' },
        { value: 'Attempted', label: 'No answer' },
      ];
  // A note closed before it was saved comes back, for this person and visit.
  const key = draftKey(target.id, visit);
  const [kept] = useState(() => ctx.draftFor(key));
  // Nothing is chosen for them, so a visit that didn't happen isn't logged as met.
  // A note after they've been seen today is about a meeting that happened.
  const start = seen ? 'Met' : '';
  const [outcome, setOutcome] = useState(seen ? start : (kept?.outcome ?? start));
  const [note, setNote] = useState(kept?.note ?? '');
  // Who was in the room at an account: doctors planned there today first, then its
  // busiest, and its executives. Ticking a doctor planned today logs their visit too.
  const plannedHere = ctx.dayPlan(ctx.todayIso).filter((i) => i.status === 'planned' && i.siteId === target.id && i.targetId !== target.id);
  const doctors = [...new Set([...plannedHere.map((i) => i.targetId), ...hcpsAt(target.id).map((h) => h.id)])].slice(0, Math.max(6, plannedHere.length));
  const people =
    target.kind === 'hco'
      ? [
          ...doctors.flatMap((id) => {
            const h = getEntity(id);
            return h ? [{ key: h.id, label: shortName(h), doctor: true }] : [];
          }),

          ...[target, ...descendantsOf(target.id)]
            .flatMap((o) => o.executives)
            .slice(0, 3)
            .map((e) => ({ key: e.name, label: e.name, doctor: false })),
        ]
      : [];
  const [there, setThere] = useState<string[]>(kept?.there ?? []);
  const [followOn, setFollowOn] = useState(false);
  const [followText, setFollowText] = useState('');
  const [followDue, setFollowDue] = useState(() => isoDate(addDays(ctx.today, 7)));
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [error, setError] = useState<DraftError | null>(null);
  const session = useRef<Listening | null>(null);
  useEffect(() => () => session.current?.cancel(), []);

  // Every change is kept on the phone until Save, so closing the sheet by mistake loses nothing.
  const { keepDraft } = ctx;
  useEffect(() => {
    const blank = !note.trim() && !there.length && outcome === start;
    keepDraft(key, blank ? null : { targetId: target.id, visit: visit && { day: visit.day, id: visit.id }, outcome, note, there });
  }, [keepDraft, key, target.id, visit, start, outcome, note, there]);

  const dictate = () => {
    if (listening) {
      session.current?.stop();
      return;
    }
    // What's spoken goes after what's already there.
    const before = note.trim() ? `${note.trim()} ` : '';
    setVoiceError(null);
    setListening(true);
    session.current = listen({
      continuous: true,
      onText: (heard) => setNote(before + heard),
      onDone: (heard) => {
        setListening(false);
        setNote(before + heard);
      },
      onError: (e) => {
        setListening(false);
        setVoiceError(VOICE_ERRORS[e] || null);
      },
    });
  };

  const save = () => {
    session.current?.stop();
    if (seen && !note.trim()) {
      const problem: DraftError = { field: 'text', message: canListen() ? 'Say or type the note first.' : 'Type the note first.' };
      setError(problem);
      AccessibilityInfo.announceForAccessibility(problem.message);
      return;
    }
    const problem = ctx.addNote({
      targetId: target.id,
      type,
      outcome,
      // A visit from an earlier day is logged on the day it was planned.
      date: visit && visit.day < ctx.todayIso ? visit.day : ctx.todayIso,
      note,
      attendees: people.filter((p) => p.doctor && there.includes(p.key)).map((p) => p.key),
      contacts: people.filter((p) => !p.doctor && there.includes(p.key)).map((p) => p.key),
      // Left blank, there's no follow-up.
      followUp: followOn && followText.trim() ? { text: followText, due: followDue } : null,
      visit: visit ? { day: visit.day, id: visit.id } : undefined,
    });
    if (problem) {
      setError(problem);
      AccessibilityInfo.announceForAccessibility(problem.message);
      return;
    }
    keepDraft(key, null);
    onDone(outcome);
  };

  return (
    <>
      <SheetBody>
        {kept ? <Text className="text-sm text-muted-foreground">Not saved yet. This is where you left off.</Text> : null}
        {visit || seen ? null : (
          <Choices
            label="Visit or call?"
            value={type}
            onChange={(t) => {
              setType(t);
              setOutcome(start);
            }}
            options={[
              { value: inPersonType, label: target.kind === 'hco' ? 'Meeting' : 'Visit' },
              { value: 'Phone call', label: 'Phone call' },
            ]}
          />
        )}
        {seen ? null : (
          <View className="flex-row gap-2" accessibilityRole="radiogroup" accessibilityLabel={inPerson ? 'Did you see them?' : 'Did you get through?'}>
            {choices.map((c) => {
              const on = outcome === c.value;
              return (
                <Pressable
                  key={c.value}
                  onPress={() => {
                    setOutcome(c.value);
                    setError(null);
                  }}
                  accessibilityRole="radio"
                  accessibilityLabel={c.label}
                  accessibilityState={{ checked: on }}
                  className={cn('min-h-14 flex-1 items-center justify-center rounded-xl border px-3', on ? 'border-primary bg-primary' : 'border-border bg-card active:bg-accent')}
                >
                  <Text className={cn('text-lg font-semibold', on ? 'text-primary-foreground' : 'text-foreground')}>{c.label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {people.length && outcome === 'Met' ? (
          <View className="gap-2">
            <Text className="text-sm font-medium">Who was there?</Text>
            <View className="flex-row flex-wrap gap-2">
              {people.map((p) => {
                const on = there.includes(p.key);
                return (
                  <Pressable
                    key={p.key}
                    onPress={() => setThere((t) => (on ? t.filter((k) => k !== p.key) : [...t, p.key]))}
                    accessibilityRole="checkbox"
                    accessibilityLabel={p.label}
                    accessibilityState={{ checked: on }}
                    hitSlop={4}
                    className={cn('min-h-9 flex-row items-center gap-1 rounded-full border px-3 py-1.5', on ? 'border-primary bg-primary' : 'border-border bg-card')}
                  >
                    {on ? <Icon as={Check} size={14} className="text-primary-foreground" /> : null}
                    <Text className={cn('text-sm', on ? 'font-medium text-primary-foreground' : 'text-foreground')}>{p.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {canListen() ? (
          <View className="items-center gap-3 py-4">
            <Pressable
              onPress={dictate}
              accessibilityRole="button"
              accessibilityLabel={listening ? 'Stop' : 'Say what happened'}
              className={cn('h-20 w-20 items-center justify-center rounded-full active:opacity-80', listening ? 'bg-destructive' : 'bg-primary')}
            >
              <Icon as={listening ? Square : Mic} size={34} className="text-white" />
            </Pressable>
            <Text className={cn('text-base', listening ? 'text-brand' : 'text-muted-foreground')}>{listening ? 'Listening… tap to stop' : 'Tap and talk'}</Text>
          </View>
        ) : null}
        {voiceError ? <Text className="text-sm text-muted-foreground">{voiceError}</Text> : null}
        <Textarea
          value={note}
          onChangeText={setNote}
          editable={!listening}
          maxLength={2000}
          numberOfLines={Platform.select({ web: 3, native: 5 })}
          className="min-h-20 rounded-xl"
          placeholder={`${canListen() ? 'Or type a note' : 'Type a note'}${seen ? '' : ' (optional)'}`}
          accessibilityLabel={seen ? 'Note' : 'Note, optional'}
        />
        <Text className="-mt-3 text-sm text-muted-foreground">Keep patient details out. Your team can read notes.</Text>
        {followOn ? (
          <View className="gap-3 rounded-xl border border-border p-3">
            <Input
              value={followText}
              onChangeText={setFollowText}
              maxLength={140}
              placeholder="What to do next, e.g. send the outcomes summary"
              accessibilityLabel="Follow-up, what to do next"
              autoFocus
            />
            <DueChoices value={followDue} onChange={setFollowDue} />
          </View>
        ) : (
          <Button variant="outline" className="self-start rounded-lg" onPress={() => setFollowOn(true)}>
            <Icon as={Plus} size={16} />
            <Text>Add a follow-up</Text>
          </Button>
        )}
      </SheetBody>
      <View className="gap-2 border-t border-border px-5 py-3">
        {error ? <Problem message={error.field === 'outcome' ? `Tap ${choices[0].label} or ${choices[1].label} first.` : error.message} /> : null}
        <Button size="lg" onPress={save}>
          <Text className="text-lg">Save</Text>
        </Button>
      </View>
    </>
  );
}
