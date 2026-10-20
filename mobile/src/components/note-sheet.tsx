// The parts every sheet is built from: a dialog with the person at the top, a
// body that scrolls, labelled fields, chips to pick from, when something is due,
// and the buttons pinned below. Used by the log, visit and booking sheets.

import { CircleAlert } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/entity';
import { Button } from '@/components/ui/button';
import { DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { subtitle } from '@/lib/data';
import { addDays, formatDate, isoDate } from '@/lib/format';
import { useWorkspace } from '@/lib/store';
import type { Entity } from '@/lib/types';
import { cn } from '@/lib/utils';
import type { DraftError } from '@/lib/workspace';

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

/** When something is due, as a few quick choices. */
export function DueChoices({ value, onChange, withToday = false }: { value: string; onChange: (iso: string) => void; withToday?: boolean }) {
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

/** A labelled field, with an optional line under it, such as a reminder to keep patients out. */
export function Field({ label, id, hint, children }: { label: string; id: string; hint?: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Label nativeID={id}>{label}</Label>
      {children}
      {hint ? <Text className="text-sm text-muted-foreground">{hint}</Text> : null}
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
