// Small charts for profiles, after the prototype's ui.js: year-on-year change,
// sparklines, quarterly bars and share bars. Every figure is also given as text.

import { TrendingDown, TrendingUp } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import type { ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatNumber, formatPct } from '@/lib/format';
import { THEME } from '@/lib/theme';
import { cn } from '@/lib/utils';

/** Above this system text size, charts switch to plain lists so their labels can grow. */
const LARGE_TEXT = 1.35;

export const useLargeText = () => useWindowDimensions().fontScale > LARGE_TEXT;

/**
 * A coloured change, e.g. "+12% on last year". Rising is good for volumes; pass
 * `upIsBad` where a rise is bad news, such as patients leaving.
 */
export function Delta({ value, suffix = ' on last year', upIsBad = false }: { value: number | null; suffix?: string; upIsBad?: boolean }) {
  if (value == null || Number.isNaN(value)) return null;
  const dir = value >= 1 ? 'up' : value <= -1 ? 'down' : 'flat';
  const good = dir === 'flat' ? null : (dir === 'up') !== upIsBad;
  const color = good == null ? 'text-muted-foreground' : good ? 'text-success' : 'text-danger';
  return (
    <View className="flex-row items-center gap-1">
      {dir !== 'flat' ? <Icon as={dir === 'up' ? TrendingUp : TrendingDown} size={14} className={color} /> : null}
      <Text className={cn('font-mono text-xs', color)}>
        {formatPct(value)}
        {suffix}
      </Text>
    </View>
  );
}

/** A trend line. Decorative: the values are always shown as text nearby. */
export function Sparkline({ values, width = 96, height = 28 }: { values: number[]; width?: number; height?: number }) {
  const { colorScheme } = useColorScheme();
  const color = THEME[colorScheme === 'dark' ? 'dark' : 'light'].primary;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const points = values.map((v, i) => [i * step, height - 3 - ((v - min) / span) * (height - 6)]);
  const [lx, ly] = points[points.length - 1];
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
      <Svg width={width} height={height} viewBox={`-3 0 ${width + 6} ${height}`}>
        <Polyline
          points={points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <Circle cx={lx} cy={ly} r={2.5} fill={color} />
      </Svg>
    </View>
  );
}

/** Eight quarters as columns, the latest highlighted; a plain list when text is large. */
export function QuarterBars({ values, labels, caption }: { values: number[]; labels: string[]; caption: string }) {
  const large = useLargeText();
  const max = Math.max(...values, 1);
  if (large) {
    return (
      <View className="gap-1" accessibilityLabel={caption}>
        {values.map((v, i) => (
          <View key={labels[i]} className="flex-row justify-between gap-3">
            <Text className="font-mono text-sm text-muted-foreground">{labels[i]}</Text>
            <Text className="font-mono text-sm">{formatNumber(v)}</Text>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View
      className="flex-row items-end gap-1"
      accessible
      accessibilityLabel={`${caption}: ${values.map((v, i) => `${labels[i]} ${formatNumber(v)}`).join(', ')}`}
    >
      {values.map((v, i) => (
        <View key={labels[i]} className="flex-1 items-center gap-1">
          <Text className="font-mono text-2xs text-muted-foreground" maxFontSizeMultiplier={LARGE_TEXT} numberOfLines={1} adjustsFontSizeToFit>
            {formatNumber(v)}
          </Text>
          <View
            className={cn('w-full max-w-9 rounded-t-md rounded-b-sm', i === values.length - 1 ? 'bg-primary' : 'bg-brand-line')}
            style={{ height: Math.max(4, Math.round((v / max) * 84)) }}
          />
          {/* Quarter over year ("Q4" / "24"): eight labels side by side run together at phone width. */}
          <Text className="text-center font-mono text-2xs text-muted-foreground" maxFontSizeMultiplier={LARGE_TEXT} numberOfLines={2}>
            {labels[i].replace(' ', '\n')}
          </Text>
        </View>
      ))}
    </View>
  );
}

export type BarTone = 'accent' | 'orange' | 'success';

const BAR: Record<BarTone, string> = { accent: 'bg-primary', orange: 'bg-signal', success: 'bg-success' };

/** A horizontal bar. Its value is read out by the row it sits in. */
export function Bar({ value, max, tone = 'accent' }: { value: number; max: number; tone?: BarTone }) {
  const pct = Math.max(2, Math.round((value / (max || 1)) * 100));
  return (
    <View className="h-1.5 w-full overflow-hidden rounded-full bg-track" aria-hidden>
      <View className={cn('h-full rounded-full', BAR[tone])} style={{ width: `${pct}%` }} />
    </View>
  );
}

/** A labelled share bar, the prototype's `barRow()`. */
export function BarRow({
  label,
  sub,
  value,
  display,
  max,
  tone,
}: {
  label: ReactNode;
  sub?: string;
  value: number;
  display?: ReactNode;
  max: number;
  tone?: BarTone;
}) {
  return (
    <View className="gap-1.5 py-1">
      <View className="flex-row flex-wrap items-start justify-between gap-x-3">
        <View className="min-w-[55%] flex-1 gap-0.5">
          {typeof label === 'string' ? <Text>{label}</Text> : label}
          {sub ? <Text className="text-sm text-muted-foreground">{sub}</Text> : null}
        </View>
        {display ?? <Text className="font-mono text-sm">{formatNumber(value)}</Text>}
      </View>
      <Bar value={value} max={max} tone={tone} />
    </View>
  );
}

/** Kept / moved / left as one stacked bar with a legend. */
export function StackBar({ parts, label }: { parts: { label: string; pct: number; className: string }[]; label: string }) {
  const shown = parts.filter((p) => p.pct > 0);
  return (
    <View className="gap-2">
      <View className="h-3 w-full flex-row overflow-hidden rounded-full bg-track" accessibilityLabel={label} accessible>
        {shown.map((p) => (
          <View key={p.label} className={p.className} style={{ width: `${p.pct}%` }} />
        ))}
      </View>
      <View className="flex-row flex-wrap gap-x-4 gap-y-1" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {shown.map((p) => (
          <View key={p.label} className="flex-row items-center gap-1.5">
            <View className={cn('h-2.5 w-2.5 rounded-sm', p.className)} />
            <Text className="text-sm">
              {p.label} <Text className="text-sm font-semibold">{p.pct}%</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
