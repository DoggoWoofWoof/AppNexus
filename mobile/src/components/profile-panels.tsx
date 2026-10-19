// The Volumes and Activity panels, the same on HCP and HCO profiles
// (volumesPanel and activityPanel in demo/js/screens/profile-parts.js).

import { ChartColumn, ChevronDown, ChevronUp, MessageSquare, NotebookPen, Plus, SquareCheckBig } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { FollowUpRow, InteractionItem } from '@/components/activity-log';
import { Bar, Delta, QuarterBars, Sparkline } from '@/components/charts';
import { EmptyState, FinePrint, ProfileTabs, Unavailable } from '@/components/profile';
import { Section } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { TabsContent } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { diagnosesOf, proceduresOf } from '@/lib/data';
import { addSeries } from '@/lib/data/series';
import { formatNumber, lastQuarters, plural, sum, yoy } from '@/lib/format';
import { useWorkspace } from '@/lib/store';
import type { DiagnosisRow, Entity, ProcedureRow } from '@/lib/types';

export type VolumeMode = 'procedures' | 'diagnoses' | 'leakage';

const last4 = (series: number[]) => sum(series.slice(-4));

/**
 * Procedure and diagnosis volumes, and for accounts where their patients go.
 * The profile holds `mode` so its headline figures can open the right one.
 */
export function VolumesPanel({
  entity,
  mode,
  onModeChange,
  leakage,
}: {
  entity: Entity;
  mode: VolumeMode;
  onModeChange: (mode: VolumeMode) => void;
  /** The account's leakage, shown as a third segment. */
  leakage?: ReactNode;
}) {
  const shown = mode === 'leakage' && !leakage ? 'procedures' : mode;
  return (
    <ProfileTabs
      label="Volume type"
      value={shown}
      onChange={onModeChange}
      tabs={[
        { id: 'procedures', label: 'Procedures' },
        { id: 'diagnoses', label: 'Diagnoses' },
        ...(leakage ? [{ id: 'leakage' as const, label: 'Leakage' }] : []),
      ]}
    >
      <TabsContent value="procedures" className="gap-5">
        <Volumes entity={entity} mode="procedures" />
      </TabsContent>
      <TabsContent value="diagnoses" className="gap-5">
        <Volumes entity={entity} mode="diagnoses" />
      </TabsContent>
      {leakage ? (
        <TabsContent value="leakage" className="gap-5">
          {leakage}
        </TabsContent>
      ) : null}
    </ProfileTabs>
  );
}

function Volumes({ entity, mode }: { entity: Entity; mode: Exclude<VolumeMode, 'leakage'> }) {
  const ctx = useWorkspace();
  const rows: (ProcedureRow | DiagnosisRow)[] | null = mode === 'procedures' ? proceduresOf(entity) : diagnosesOf(entity);
  const labels = lastQuarters(ctx.today);
  const noun = mode === 'procedures' ? 'Procedures' : 'Patients';

  if (!rows) return <Unavailable title="Procedure volumes unavailable" body={entity.proceduresUnavailable ?? 'No procedure data in your code group.'} />;
  if (!rows.length) return <EmptyState icon={ChartColumn} title={`No ${noun.toLowerCase()} in this period`} />;

  const total = addSeries(rows.map((r) => r.series));
  const sorted = [...rows].sort((a, b) => last4(b.series) - last4(a.series));
  const max = Math.max(...sorted.map((r) => last4(r.series)));

  return (
    <>
      <Section title={mode === 'procedures' ? 'Procedures · last 12 months' : 'Diagnosed patients · last 12 months'}>
        <View className="flex-row flex-wrap items-end justify-between gap-3">
          <View className="gap-1">
            <Text className="font-serif text-num">{formatNumber(last4(total))}</Text>
            <Delta value={yoy(total)} />
          </View>
          <View className="items-end gap-1">
            <Sparkline values={total} width={140} height={44} />
            <Text className="font-mono text-2xs text-muted-foreground">
              {labels[0]} – {labels[labels.length - 1]}
            </Text>
          </View>
        </View>
        <QuarterBars values={total} labels={labels} caption={`${noun} per quarter`} />
        <FinePrint>{`Illustrative sample figures, not claims data.${mode === 'diagnoses' ? ' Patients are counted per quarter.' : ''}`}</FinePrint>
      </Section>

      <Section title={mode === 'procedures' ? 'By procedure family' : 'By diagnosis'} sub="Tap a row for the quarterly trend">
        {sorted.map((r) => (
          <VolumeRow key={r.code} row={r} max={max} labels={labels} />
        ))}
      </Section>
    </>
  );
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
        accessibilityHint="Shows the quarterly trend"
        className="min-h-11 gap-2 rounded-md active:bg-accent"
      >
        <View className="flex-row flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <View className="min-w-[50%] flex-1 gap-0.5">
            <Text>{name}</Text>
            <Text className="font-mono text-2xs text-muted-foreground">{row.code}</Text>
          </View>
          <View className="items-end gap-0.5">
            <Text className="font-mono">{formatNumber(value)}</Text>
            <Delta value={yoy(row.series)} />
          </View>
          <View className="flex-row items-center gap-1 self-center">
            <Sparkline values={row.series} />
            <Icon as={open ? ChevronUp : ChevronDown} size={16} className="text-muted-foreground" />
          </View>
        </View>
        <Bar value={value} max={max} />
      </Pressable>
      {open ? <QuarterBars values={row.series} labels={labels} caption={`${name} per quarter`} /> : null}
    </View>
  );
}

export function ActivityPanel({ entity, onAddNote, onNewFollowUp }: { entity: Entity; onAddNote: () => void; onNewFollowUp: () => void }) {
  const ctx = useWorkspace();
  const [showDone, setShowDone] = useState(false);
  const followUps = ctx.followUpsFor(entity.id);
  const open = followUps.filter((f) => !f.done);
  const done = followUps.filter((f) => f.done);
  const interactions = ctx.interactionsFor(entity.id);

  return (
    <>
      <Section
        title="Follow-ups"
        sub={open.length ? plural(open.length, 'open follow-up') : undefined}
        action={
          <Button size="sm" variant="outline" onPress={onNewFollowUp}>
            <Icon as={Plus} size={16} />
            <Text>New follow-up</Text>
          </Button>
        }
      >
        {open.length ? (
          open.map((f) => <FollowUpRow key={f.id} followUp={f} />)
        ) : (
          <EmptyState icon={SquareCheckBig} title="No open follow-ups" body="Create one after a visit so the next step isn’t lost." />
        )}
        {done.length ? (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="self-start"
              onPress={() => setShowDone((s) => !s)}
              accessibilityState={{ expanded: showDone }}
            >
              <Icon as={showDone ? ChevronUp : ChevronDown} size={16} />
              <Text>{`${done.length} completed`}</Text>
            </Button>
            {showDone ? done.map((f) => <FollowUpRow key={f.id} followUp={f} />) : null}
          </>
        ) : null}
      </Section>

      <Section
        title="Notes & interactions"
        sub="Visits, calls and meetings, newest first"
        action={
          <Button size="sm" onPress={onAddNote}>
            <Icon as={NotebookPen} size={16} />
            <Text>Add note</Text>
          </Button>
        }
      >
        {interactions.length ? (
          <View className="gap-5">
            {interactions.map((i) => (
              <InteractionItem key={i.id} interaction={i} about={entity.id} />
            ))}
          </View>
        ) : (
          <EmptyState icon={MessageSquare} title="No interactions yet" body="Log your first visit or call to start the history for this profile." />
        )}
      </Section>
    </>
  );
}
