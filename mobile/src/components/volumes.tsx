// Every procedure and diagnosis figure for someone, shown when the volumes card on
// their page is opened in full. Tap a row for its quarters.

import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Bar, Delta, QuarterBars } from '@/components/charts';
import { FinePrint } from '@/components/profile';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { diagnosesOf, proceduresOf } from '@/lib/data';
import { DATA_PERIOD, FIGURES_END } from '@/lib/data/seed';
import { addSeries } from '@/lib/data/series';
import { formatNumber, lastQuarters, sum, yoy } from '@/lib/format';
import type { DiagnosisRow, Entity, ProcedureRow } from '@/lib/types';

const last4 = (series: number[]) => sum(series.slice(-4));

/** Procedures per quarter, then each procedure and each diagnosis, biggest first. */
export function AllVolumes({ entity }: { entity: Entity }) {
  const procedures = proceduresOf(entity) ?? [];
  const diagnoses = diagnosesOf(entity);
  const labels = lastQuarters(FIGURES_END);
  return (
    <>
      {procedures.length ? (
        <QuarterBars values={addSeries(procedures.map((r) => r.series))} labels={labels} caption="Procedures per quarter" />
      ) : (
        <Text className="text-sm text-muted-foreground">{entity.proceduresUnavailable ?? 'No procedures in this period.'}</Text>
      )}
      <Rows rows={procedures} labels={labels} />
      {diagnoses.length ? (
        <>
          <Text className="pt-1 text-sm font-semibold text-muted-foreground">Diagnosed patients</Text>
          <Rows rows={diagnoses} labels={labels} />
        </>
      ) : null}
      <FinePrint>{`${DATA_PERIOD}. Illustrative figures, not claims data. Patients are counted per quarter.`}</FinePrint>
    </>
  );
}

function Rows({ rows, labels }: { rows: (ProcedureRow | DiagnosisRow)[]; labels: string[] }) {
  const sorted = [...rows].sort((a, b) => last4(b.series) - last4(a.series));
  const max = Math.max(...sorted.map((r) => last4(r.series)), 1);
  return sorted.map((r) => <VolumeRow key={r.code} row={r} max={max} labels={labels} />);
}

function VolumeRow({ row, max, labels }: { row: ProcedureRow | DiagnosisRow; max: number; labels: string[] }) {
  const [open, setOpen] = useState(false);
  const name = 'family' in row ? row.family : row.name;
  const value = last4(row.series);
  return (
    <View className="gap-2 border-t border-border pt-2">
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint="Shows each quarter"
        className="min-h-11 gap-2 rounded-md active:bg-accent"
      >
        <View className="flex-row items-start gap-3">
          <View className="flex-1 gap-0.5">
            <Text>{name}</Text>
            <Text className="font-mono text-2xs text-muted-foreground">{row.code}</Text>
          </View>
          <View className="items-end gap-0.5">
            <Text className="font-mono">{formatNumber(value)}</Text>
            <Delta value={yoy(row.series)} suffix="" />
          </View>
          <Icon as={open ? ChevronUp : ChevronDown} size={16} className="self-center text-muted-foreground" />
        </View>
        <Bar value={value} max={max} />
      </Pressable>
      {open ? <QuarterBars values={row.series} labels={labels} caption={`${name} per quarter`} /> : null}
    </View>
  );
}
