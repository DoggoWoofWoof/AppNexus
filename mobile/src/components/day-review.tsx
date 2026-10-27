// Today's review, under the daily brief once anyone is in the day
// (lib/day-review.ts): the day's people in a paragraph, in the order the rep
// sees them. Names are in bold and the few facts that matter in their labels'
// colours, on the words only, so it still reads as a paragraph: gold for what to
// do today, rose for a competitor's products and patients going elsewhere, green
// for what's working.

import { ClipboardCheck } from 'lucide-react-native';
import { View } from 'react-native';

import { Delta } from '@/components/charts';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { dayReview, type ReviewBit, type StopLabel } from '@/lib/day-review';
import { useWorkspace } from '@/lib/store';
import { cn } from '@/lib/utils';

const TONES: Record<NonNullable<ReviewBit['tone']>, string> = {
  name: 'font-semibold text-foreground',
  warn: 'font-semibold text-warn',
  rose: 'font-semibold text-signal-text',
  success: 'font-semibold text-success',
};

/** The review of `day` as it is at `now`, Today's clock; nothing with nobody in the day. */
export function DayReview({ day, now }: { day: string; now: Date }) {
  const ctx = useWorkspace();
  const bits = dayReview(ctx, day, now);
  if (!bits) return null;
  const dayWord = ctx.dayWord(day);
  const title = dayWord === 'today' ? 'Today’s review' : dayWord === 'tomorrow' ? 'Tomorrow’s review' : `${dayWord}’s review`;
  return (
    <View className="gap-2 rounded-xl border border-border bg-card p-3">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-soft">
          <Icon as={ClipboardCheck} size={20} className="text-brand" />
        </View>
        <Text role="heading" className="flex-1 font-serif text-xl">
          {title}
        </Text>
      </View>
      <Text className="text-base leading-6 text-foreground/80">
        {bits.map((bit, i) =>
          bit.tone ? (
            <Text key={i} className={cn('text-base leading-6', TONES[bit.tone])}>
              {bit.text}
            </Text>
          ) : (
            bit.text
          ),
        )}
      </Text>
    </View>
  );
}

const LABELS: Record<StopLabel['tone'], { box: string; text: string }> = {
  warn: { box: 'bg-warn-soft', text: 'text-warn' },
  rose: { box: 'bg-signal-soft', text: 'text-signal-text' },
  success: { box: 'bg-success-soft', text: 'text-success' },
  neutral: { box: 'bg-track', text: 'text-foreground' },
};

/** A stop's labels (`stopLabels`), each in the colour of its kind of fact, with the trend after how much someone new does. */
export function StopLabels({ labels }: { labels: StopLabel[] }) {
  if (!labels.length) return null;
  return (
    <View className="mt-1 flex-row flex-wrap gap-1.5">
      {labels.map((l) => (
        <View key={l.label} className={cn('max-w-full flex-row items-center gap-1 rounded-full px-2 py-0.5', LABELS[l.tone].box)}>
          <Text className={cn('text-2xs font-semibold', LABELS[l.tone].text)}>{l.label}</Text>
          {l.change != null ? <Delta value={l.change} suffix="" small hideFlat /> : null}
        </View>
      ))}
    </View>
  );
}
