// Add note and New follow-up, after the prototype's note and follow-up sheets
// (demo/js/sheets.js). They save to the in-memory workspace through the store.
// The sheet parts are shared with the visit and booking sheets (visit-sheets.tsx).

import { CircleAlert } from 'lucide-react-native';
import { useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, Pressable, ScrollView, useWindowDimensions, View, type TextInputInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/entity';
import { FinePrint } from '@/components/profile';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Text } from '@/components/ui/text';
import { subtitle } from '@/lib/data';
import { addDays, formatDate, isoDate, relativeDay } from '@/lib/format';
import { VISIT_TYPES } from '@/lib/plan';
import { useWorkspace } from '@/lib/store';
import type { Entity, VisitType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { OUTCOMES, type DraftError } from '@/lib/workspace';

type Sheet = { kind: 'note'; target: Entity; contact?: string } | { kind: 'followup'; target: Entity };

/**
 * The note and follow-up dialogs for a profile. `onSaved` runs after a save,
 * so the profile can show the result.
 */
export function useNoteSheets(entity: Entity, onSaved: (kind: Sheet['kind']) => void) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const close = () => setSheet(null);
  const done = (kind: Sheet['kind'], message: string) => {
    close();
    onSaved(kind);
    AccessibilityInfo.announceForAccessibility(message);
  };
  const onOpenChange = (open: boolean) => !open && close();

  return {
    /** Add note about this profile, or about `target` (an executive's own facility) with `contact` attending. */
    openNote: (contact?: string, target: Entity = entity) => setSheet({ kind: 'note', target, contact }),
    openFollowUp: () => setSheet({ kind: 'followup', target: entity }),
    sheets: (
      <>
        <Dialog open={sheet?.kind === 'note'} onOpenChange={onOpenChange}>
          {sheet?.kind === 'note' ? (
            <SheetContent title="Add note" target={sheet.target}>
              <NoteForm target={sheet.target} contact={sheet.contact} onCancel={close} onSaved={(m) => done('note', m)} />
            </SheetContent>
          ) : null}
        </Dialog>
        <Dialog open={sheet?.kind === 'followup'} onOpenChange={onOpenChange}>
          {sheet?.kind === 'followup' ? (
            <SheetContent title="New follow-up" target={sheet.target}>
              <FollowUpForm target={sheet.target} onCancel={close} onSaved={(m) => done('followup', m)} />
            </SheetContent>
          ) : null}
        </Dialog>
      </>
    ),
  };
}

/** A dialog with a fixed header, a body that scrolls and the buttons pinned below it, like the prototype's sheets. */
export function SheetContent({ title, target, sub, children }: { title: string; target: Entity; sub?: string; children: ReactNode }) {
  const { height } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();
  return (
    // A percentage max height has nothing to resolve against inside the dialog's
    // wrappers, so cap it by the window instead.
    <DialogContent className="gap-0 p-0" style={{ maxHeight: Math.round((height - top - bottom) * 0.92) }}>
      <View className="flex-row items-center gap-3 border-b border-border px-5 pb-4 pr-12 pt-5">
        <Avatar entity={target} />
        <View className="flex-1 gap-0.5">
          <DialogTitle className="font-serif text-xl font-normal leading-7" maxFontSizeMultiplier={2}>
            {title}
          </DialogTitle>
          <DialogDescription maxFontSizeMultiplier={2}>
            {sub ?? `${target.name} · ${subtitle(target)}`}
          </DialogDescription>
        </View>
      </View>
      {children}
    </DialogContent>
  );
}

/** The form fields. Dragging dismisses the keyboard, which can cover the buttons below. */
export function SheetBody({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      className="shrink grow-0"
      contentContainerClassName="gap-5 p-5"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
    >
      {children}
    </ScrollView>
  );
}

export function NoteForm({
  target,
  contact,
  visit,
  onCancel,
  onSaved,
}: {
  target: Entity;
  contact?: string;
  /** The planned visit being logged; saving marks it done. */
  visit?: { day: string; id: string; type: VisitType };
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const ctx = useWorkspace();
  const [type, setType] = useState<VisitType>(visit?.type ?? (target.kind === 'hco' ? 'Meeting' : 'In-person visit'));
  // Nothing is pre-selected, so a visit that didn't happen isn't logged as met.
  const [outcome, setOutcome] = useState('');
  const [date, setDate] = useState(ctx.todayIso);
  const [note, setNote] = useState('');
  const [followOn, setFollowOn] = useState(false);
  const [followText, setFollowText] = useState('');
  const [followDue, setFollowDue] = useState(isoDate(addDays(ctx.today, 7)));
  const [error, setError] = useState<DraftError | null>(null);
  const followInput = useRef<TextInputInstance>(null);

  const save = () => {
    const problem = ctx.addNote({
      targetId: target.id,
      type,
      outcome,
      date,
      note,
      contacts: contact ? [contact] : [],
      followUp: followOn ? { text: followText, due: followDue } : null,
      visit: visit ? { day: visit.day, id: visit.id } : undefined,
    });
    if (problem) {
      setError(problem);
      AccessibilityInfo.announceForAccessibility(problem.message);
      if (problem.field === 'followText') followInput.current?.focus();
      return;
    }
    onSaved(`${type === 'In-person visit' ? 'Visit' : type} logged${followOn ? ', follow-up created' : ''}`);
  };

  const days = [0, -1, -2, -3].map((n) => isoDate(addDays(ctx.today, n)));
  // Unticking the follow-up also settles any problem with it.
  const showFollowUp = (on: boolean) => {
    setFollowOn(on);
    if (!on) setError(null);
  };

  return (
    <>
      <SheetBody>
        {contact ? <Text className="text-sm text-muted-foreground">With {contact}</Text> : null}
        <Choices label="Activity" value={type} onChange={setType} options={VISIT_TYPES.map((t) => ({ value: t, label: t }))} />
        <Choices
          label="What happened?"
          value={outcome}
          onChange={(o) => {
            setOutcome(o);
            if (error?.field === 'outcome') setError(null);
          }}
          options={OUTCOMES.map((o) => ({ value: o, label: o }))}
          invalid={error?.field === 'outcome'}
        />
        <Choices
          label="When"
          value={date}
          onChange={setDate}
          options={days.map((d) => ({ value: d, label: relativeDay(d, ctx.today) }))}
        />
        <Field label="Note" id="note-text">
          <Textarea
            value={note}
            onChangeText={setNote}
            maxLength={2000}
            numberOfLines={Platform.select({ web: 5, native: 8 })}
            className="min-h-28"
            placeholder="What was discussed, what they asked for, what happens next"
            accessibilityLabel="Note"
            aria-labelledby="note-text"
          />
        </Field>

        <View className="min-h-11 flex-row items-center gap-3">
          <Checkbox checked={followOn} onCheckedChange={showFollowUp} aria-labelledby="note-follow" accessibilityLabel="Create a follow-up" />
          <Label nativeID="note-follow" onPress={() => showFollowUp(!followOn)} className="text-base">
            Create a follow-up
          </Label>
        </View>
        {followOn ? (
          <View className="gap-5 rounded-md border border-border p-3">
            <Field label="Follow-up" id="note-follow-text">
              <Input
                ref={followInput}
                value={followText}
                onChangeText={(t) => {
                  setFollowText(t);
                  if (error?.field === 'followText') setError(null);
                }}
                maxLength={140}
                placeholder="e.g. Send the outcomes summary"
                accessibilityLabel="Follow-up"
                aria-labelledby="note-follow-text"
                aria-invalid={error?.field === 'followText'}
                className={cn(error?.field === 'followText' && 'border-danger')}
              />
            </Field>
            <DueChoices value={followDue} onChange={setFollowDue} />
          </View>
        ) : null}

        <FinePrint>Notes stay in the app until you close it. Saving to the device and syncing come later.</FinePrint>
      </SheetBody>
      <Footer onCancel={onCancel} onSave={save} saveLabel="Save note" error={error} />
    </>
  );
}

function FollowUpForm({ target, onCancel, onSaved }: { target: Entity; onCancel: () => void; onSaved: (message: string) => void }) {
  const ctx = useWorkspace();
  const [text, setText] = useState('');
  const [due, setDue] = useState(isoDate(addDays(ctx.today, 1)));
  const [error, setError] = useState<DraftError | null>(null);
  const textInput = useRef<TextInputInstance>(null);

  const save = () => {
    const problem = ctx.addFollowUp({ targetId: target.id, text, due });
    if (problem) {
      setError(problem);
      AccessibilityInfo.announceForAccessibility(problem.message);
      if (problem.field === 'text') textInput.current?.focus();
      return;
    }
    onSaved(`Follow-up created for ${target.name}`);
  };

  return (
    <>
      <SheetBody>
        <Field label="What needs to happen?" id="follow-text">
          <Input
            ref={textInput}
            value={text}
            onChangeText={(t) => {
              setText(t);
              if (error?.field === 'text') setError(null);
            }}
            maxLength={140}
            placeholder="e.g. Send the procedure mix report"
            accessibilityLabel="What needs to happen?"
            aria-labelledby="follow-text"
            aria-invalid={error?.field === 'text'}
            className={cn(error?.field === 'text' && 'border-danger')}
            autoFocus={Platform.OS === 'web'}
          />
        </Field>
        <DueChoices value={due} onChange={setDue} withToday />
      </SheetBody>
      <Footer onCancel={onCancel} onSave={save} saveLabel="Create follow-up" error={error} />
    </>
  );
}

function DueChoices({ value, onChange, withToday = false }: { value: string; onChange: (iso: string) => void; withToday?: boolean }) {
  const ctx = useWorkspace();
  const quick: [number, string][] = [...(withToday ? [[0, 'Today'] as [number, string]] : []), [1, 'Tomorrow'], [3, 'In 3 days'], [7, 'Next week'], [14, 'In 2 weeks']];
  return (
    <Choices
      label={`Due · ${formatDate(value)}`}
      groupLabel="Due"
      value={value}
      onChange={onChange}
      options={quick.map(([n, label]) => ({ value: isoDate(addDays(ctx.today, n)), label }))}
    />
  );
}

export function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Label nativeID={id}>{label}</Label>
      {children}
    </View>
  );
}

// Not a live region: save() announces the problem.
export function Problem({ message }: { message: string }) {
  return (
    <View className="flex-row items-start gap-1.5">
      <Icon as={CircleAlert} size={14} className="mt-0.5 text-danger" />
      <Text className="flex-1 text-sm text-danger">{message}</Text>
    </View>
  );
}

/** A single choice from a few options, as chips. */
export function Choices<T extends string>({
  label,
  groupLabel = label,
  options,
  value,
  onChange,
  invalid = false,
}: {
  label: string;
  groupLabel?: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Outlines the label in red when nothing has been chosen yet and one is needed. */
  invalid?: boolean;
}) {
  return (
    <View className="gap-2">
      <Text className={cn('text-sm font-medium', invalid && 'text-danger')}>{label}</Text>
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup" accessibilityLabel={groupLabel}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityLabel={o.label}
              accessibilityState={{ checked: on }}
              hitSlop={4}
              className={cn('min-h-9 justify-center rounded-full border px-3 py-1.5', on ? 'border-primary bg-accent' : 'border-border bg-card')}
            >
              <Text className={cn('text-sm', on ? 'text-accent-foreground' : 'text-foreground')}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Cancel and save, pinned under the form. A problem shows here, next to the button
 * that found it, since its field may be scrolled out of view; save() focuses the field.
 */
export function Footer({
  onCancel,
  onSave,
  saveLabel,
  error,
}: {
  onCancel: () => void;
  onSave: () => void;
  saveLabel: string;
  error: Pick<DraftError, 'message'> | null;
}) {
  return (
    <View className="gap-3 border-t border-border px-5 py-3">
      {error ? <Problem message={error.message} /> : null}
      <View className="flex-row flex-wrap justify-end gap-2">
        <Button variant="outline" onPress={onCancel} className="grow">
          <Text>Cancel</Text>
        </Button>
        <Button onPress={onSave} className="grow">
          <Text>{saveLabel}</Text>
        </Button>
      </View>
    </View>
  );
}
