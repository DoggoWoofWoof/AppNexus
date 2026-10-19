// Targets: find people and accounts, narrowed by the signals that matter today.

import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { EntityRow } from '@/components/entity';
import { PageHeader, Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
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
  const rows = ctx.search(filters);

  return (
    <Screen inset>
      <PageHeader title="Targets" sub="People and accounts in your territory" />

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
        {plural(rows.length, filters.kind === 'hcp' ? 'person' : 'account', filters.kind === 'hcp' ? 'people' : 'accounts')} · most relevant first
      </Text>

      <View className="gap-1">
        {rows.map((row) => (
          <EntityRow
            key={row.entity.id}
            entity={row.entity}
            signals={row.signals}
            trailing={<Text className="font-mono text-2xs text-muted-foreground">{formatKm(row.distance)}</Text>}
          />
        ))}
      </View>
    </Screen>
  );
}
