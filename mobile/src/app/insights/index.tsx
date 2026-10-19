// Insights: a territory snapshot. Where patients leave (most patients first,
// not the highest share) and who is growing.

import { View } from 'react-native';

import { EntityRow } from '@/components/entity';
import { TabHeader } from '@/components/menu';
import { Screen, Section } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { accountsByPatientsLost, allHcps, destination, getOrg, procedureTotal, procedureYoy } from '@/lib/data';
import { DATA_PERIOD, REP } from '@/lib/data/seed';
import { formatNumber, formatPct } from '@/lib/format';
import type { Hcp } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function Insights() {
  const system = getOrg('msh-system');
  const leakage = system?.leakage;
  const rising = allHcps()
    .map((h) => ({ h, growth: procedureYoy(h) }))
    .filter((r): r is { h: Hcp; growth: number } => r.growth != null)
    .sort((a, b) => b.growth - a.growth);
  const outside = leakage?.destinations.filter((d) => d.ref) ?? [];
  const systemYoy = system ? procedureYoy(system) : null;

  return (
    <Screen inset>
      <TabHeader title="Insights" sub={`${REP.team} · ${DATA_PERIOD}`} />

      <View className="flex-row flex-wrap gap-3">
        <Kpi
          label="Procedures in your territory"
          value={system ? formatNumber(procedureTotal(system)) : '–'}
          sub={systemYoy != null ? `${formatPct(systemYoy)} on last year` : undefined}
        />
        <Kpi label="Patients leaving the system" value={leakage ? `${leakage.leftPct}%` : '–'} sub={leakage ? `of ${formatNumber(leakage.patients)} patients` : undefined} tone="text-signal-text" />
      </View>

      <Section title="Where patients leave" sub="Patients who went outside the system, most first">
        {accountsByPatientsLost().map(({ org, leakage: l, lost }) => (
          <EntityRow
            key={org.id}
            entity={org}
            detail={`of ${formatNumber(l.patients)} patients · worst for ${l.byFamily[0]?.family ?? '–'}`}
            trailing={
              <View className="items-end">
                <Text className="font-mono text-sm text-signal-text">{formatNumber(lost)}</Text>
                <Text className="font-mono text-2xs text-muted-foreground">{`${l.leftPct}%`}</Text>
              </View>
            }
          />
        ))}
      </Section>

      <Section title="Top destinations outside the system" sub="Fictional names · patients, last 12 months">
        {outside.map((d) => (
          <View key={d.ref} className="flex-row items-center gap-3">
            <View className="flex-1">
              <Text className="font-semibold">{destination(d.ref!)?.name}</Text>
              <Text className="text-sm text-muted-foreground">{destination(d.ref!)?.note}</Text>
            </View>
            <Text className="font-mono text-sm">{formatNumber(d.patients)}</Text>
          </View>
        ))}
      </Section>

      <Section title="Volume trends by HCP" sub="Procedures, last 12 months vs the 12 before">
        {rising.map(({ h, growth }) => (
          <EntityRow
            key={h.id}
            entity={h}
            detail={h.specialty}
            trailing={
              <View className="items-end">
                <Text className="font-mono text-sm">{formatNumber(procedureTotal(h))}</Text>
                <Text className={cn('font-mono text-2xs', growth >= 0 ? 'text-success' : 'text-danger')}>{formatPct(growth)}</Text>
              </View>
            }
          />
        ))}
      </Section>

    </Screen>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <View className="min-w-40 flex-1 gap-1 rounded-lg border border-border bg-card p-4">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className={cn('font-serif text-num', tone)}>{value}</Text>
      {sub ? <Text className="text-xs text-muted-foreground">{sub}</Text> : null}
    </View>
  );
}
