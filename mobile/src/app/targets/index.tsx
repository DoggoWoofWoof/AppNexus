// Targets: find people and accounts, narrowed by the signals that matter today.
// After a timed visit is cancelled it also fills the free slot: the same list,
// unplanned people nearest the cancelled site first, with the time on each row.

import { router } from 'expo-router';
import { CalendarPlus, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { EntityRow } from '@/components/entity';
import { PageHeader, Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { getOrg } from '@/lib/data';
import { formatKm, plural } from '@/lib/format';
import { DEFAULT_FILTERS, SIGNAL_FILTERS, type Filters } from '@/lib/search';
import { useWorkspace } from '@/lib/store';
import type { SignalId } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function Targets() {
  const ctx = useWorkspace();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const toggleSignal = (id: SignalId) =>
    set({ signals: filters.signals.includes(id) ? filters.signals.filter((s) => s !== id) : [...filters.signals, id] });
  const free = ctx.ws.replacement?.day === ctx.ws.selection.day ? ctx.ws.replacement : null;
  const rows = ctx.search(free ? { ...filters, sort: 'distance', planned: 'unplanned' } : filters);
  const fill = (id: string) => {
    ctx.fillSlot(id);
    router.navigate('/today');
  };

  return (
    <Screen inset>
      <PageHeader title="Targets" sub="People and accounts in your territory" />

      {free ? (
        <View className="gap-3 rounded-lg border border-primary bg-accent p-4" accessibilityRole="summary">
          <View className="flex-row items-start gap-2">
            <Icon as={CalendarPlus} size={18} className="mt-0.5 text-brand" />
            <Text className="flex-1 text-accent-foreground">
              <Text className="font-semibold text-accent-foreground">{`${free.time} is free`}</Text>
              {` after ${free.name} cancelled. Nearest to ${getOrg(free.siteId)?.name} first; tap ${free.time} on a row to add them.`}
            </Text>
          </View>
          <Button size="sm" variant="ghost" className="self-start" onPress={ctx.clearReplacement}>
            <Text>Leave it free</Text>
          </Button>
        </View>
      ) : null}

      <Input
        value={filters.query}
        onChangeText={(query) => set({ query })}
        placeholder="Search name, specialty, NPI or site"
        accessibilityLabel="Search targets"
        returnKeyType="search"
        autoCorrect={false}
      />

      <View className="flex-row gap-2" accessibilityRole="tablist">
        {(['hcp', 'hco'] as const).map((kind) => (
          <Button
            key={kind}
            size="sm"
            variant={filters.kind === kind ? 'default' : 'outline'}
            onPress={() => set({ kind, specialty: '', orgType: '' })}
            accessibilityRole="tab"
            accessibilityState={{ selected: filters.kind === kind }}
          >
            <Text>{kind === 'hcp' ? 'People' : 'Accounts'}</Text>
          </Button>
        ))}
      </View>

      <View className="flex-row flex-wrap gap-2">
        {SIGNAL_FILTERS.map((s) => {
          const on = filters.signals.includes(s.id);
          return (
            <Pressable
              key={s.id}
              onPress={() => toggleSignal(s.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              hitSlop={4}
              className={cn('min-h-9 justify-center rounded-full border px-3 py-1.5', on ? 'border-primary bg-accent' : 'border-border bg-card')}
            >
              <Text className={cn('text-sm', on ? 'text-accent-foreground' : 'text-foreground')}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text className="text-sm text-muted-foreground" accessibilityLiveRegion="polite">
        {plural(rows.length, filters.kind === 'hcp' ? 'person' : 'account', filters.kind === 'hcp' ? 'people' : 'accounts')}
        {free ? ' not planned that day · nearest first' : ' · most relevant first'}
      </Text>

      <View className="gap-1">
        {rows.map((row) => (
          <EntityRow
            key={row.entity.id}
            entity={row.entity}
            signals={row.signals}
            trailing={<Text className="font-mono text-2xs text-muted-foreground">{formatKm(row.distance)}</Text>}
            action={
              free ? (
                <Button size="sm" onPress={() => fill(row.entity.id)} accessibilityLabel={`Add ${row.entity.name} at ${free.time}`}>
                  <Icon as={Plus} size={16} className="text-primary-foreground" />
                  <Text>{free.time}</Text>
                </Button>
              ) : undefined
            }
          />
        ))}
      </View>
    </Screen>
  );
}
