// Targets: who to see, best first. Search, one Filters button for everything
// else, and + on each row to put them in the day's plan. After a visit is
// cancelled it fills the free time instead: nearest first, "+ 11:00" on each row.

import { router } from 'expo-router';
import { Check, SlidersHorizontal, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, useProfileHref } from '@/components/entity';
import { MenuButton } from '@/components/menu';
import { Choices, SheetBody } from '@/components/note-sheet';
import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { allHcps, allOrgs, getOrg, shortName } from '@/lib/data';
import { formatKm, plural } from '@/lib/format';
import { activeFilterCount, DEFAULT_FILTERS, DISTANCES, SIGNAL_FILTERS, SORTS, type Filters, type SearchRow } from '@/lib/search';
import { useWorkspace } from '@/lib/store';
import { cn } from '@/lib/utils';

export default function Targets() {
  const ctx = useWorkspace();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const day = ctx.ws.selection.day;
  const free = ctx.ws.replacement?.day === day ? ctx.ws.replacement : null;
  const applied = free ? { ...filters, sort: 'distance' as const, planned: 'unplanned' as const } : filters;
  const rows = ctx.search(applied);
  const count = activeFilterCount(filters);
  const people = filters.kind === 'hcp';
  const fill = (id: string) => {
    ctx.fillSlot(id);
    router.navigate('/today');
  };

  return (
    <Screen inset>
      <View className="flex-row items-center gap-2">
        <MenuButton />
        <Input
          className="flex-1 rounded-xl"
          value={filters.query}
          onChangeText={(query) => set({ query })}
          placeholder={people ? 'Find a doctor' : 'Find an account'}
          accessibilityLabel={people ? 'Find a doctor' : 'Find an account'}
          returnKeyType="search"
          autoCorrect={false}
        />
        <Button variant="outline" className="rounded-xl" onPress={() => setShowFilters(true)} accessibilityLabel={count ? `Filters, ${count} on` : 'Filters'}>
          <Icon as={SlidersHorizontal} size={18} />
          <Text>{count ? `Filters · ${count}` : 'Filters'}</Text>
        </Button>
      </View>

      {free ? (
        <View className="flex-row items-center gap-2">
          <Text className="flex-1 text-base text-muted-foreground">
            <Text className="text-base font-semibold">{`Free at ${free.time}`}</Text>
            {` · nearest to ${getOrg(free.siteId)?.name ?? 'the visit'}`}
          </Text>
          <Button size="icon" variant="ghost" onPress={ctx.clearReplacement} accessibilityLabel="Leave it free">
            <Icon as={X} size={18} className="text-muted-foreground" />
          </Button>
        </View>
      ) : (
        <Text className="text-base text-muted-foreground" accessibilityLiveRegion="polite">
          {rows.length
            ? `${plural(rows.length, people ? 'doctor' : 'account')}, best first · + adds to ${day === ctx.todayIso ? 'today' : 'tomorrow'}`
            : 'Nobody matches. Try fewer filters.'}
        </Text>
      )}

      <View className="gap-2">
        {rows.map((row) => (
          <TargetRow key={row.entity.id} row={row} freeTime={free?.time ?? null} onFill={() => fill(row.entity.id)} onAdd={() => ctx.addToPlan(row.entity.id, day)} />
        ))}
      </View>

      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        {showFilters ? (
          <FilterSheet
            filters={filters}
            onChange={set}
            onClear={() => setFilters({ ...DEFAULT_FILTERS, query: filters.query, kind: filters.kind })}
            onDone={() => setShowFilters(false)}
            results={rows.length}
          />
        ) : null}
      </Dialog>
    </Screen>
  );
}

function TargetRow({ row, freeTime, onFill, onAdd }: { row: SearchRow; freeTime: string | null; onFill: () => void; onAdd: () => void }) {
  const profileHref = useProfileHref();
  const { entity, signals, planned } = row;
  const short = shortName(entity);
  const why = signals[0];
  return (
    <View className="min-h-16 flex-row items-center gap-2 rounded-xl border border-border bg-card py-2 pl-3 pr-2">
      <Pressable onPress={() => router.push(profileHref(entity))} accessibilityRole="link" className="flex-1 flex-row items-center gap-3 active:opacity-70">
        <Avatar entity={entity} />
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-semibold">{short}</Text>
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {formatKm(row.distance)}
            {why ? <Text className={cn('text-sm', why.tone === 'warn' ? 'text-warn' : why.tone === 'orange' ? 'text-signal-text' : why.tone === 'accent' ? 'text-brand' : 'text-muted-foreground')}>{` · ${why.label}`}</Text> : null}
          </Text>
        </View>
      </Pressable>
      {freeTime ? (
        <Button size="sm" className="rounded-lg" onPress={onFill} accessibilityLabel={`Add ${entity.name} at ${freeTime}`}>
          <Text>{`+ ${freeTime}`}</Text>
        </Button>
      ) : planned ? (
        <View className="min-h-9 flex-row items-center gap-1 px-2" accessibilityLabel={`${entity.name} is in your plan`}>
          <Icon as={Check} size={16} className="text-success" />
          <Text className="text-sm text-success">Added</Text>
        </View>
      ) : (
        <Button size="sm" variant="outline" className="rounded-lg" onPress={onAdd} accessibilityLabel={`Add ${entity.name} to your plan`}>
          <Text>+ Add</Text>
        </Button>
      )}
    </View>
  );
}

const SPECIALTIES = [...new Set(allHcps().map((h) => h.specialty))].sort();
const ORG_TYPES = [...new Set(allOrgs().map((o) => o.type))].sort();

/** Every filter in one place, so the list itself stays one search box and one button. */
function FilterSheet({
  filters,
  onChange,
  onClear,
  onDone,
  results,
}: {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
  onDone: () => void;
  results: number;
}) {
  const { height } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();
  const toggle = (id: Filters['signals'][number]) =>
    onChange({ signals: filters.signals.includes(id) ? filters.signals.filter((s) => s !== id) : [...filters.signals, id] });
  return (
    <DialogContent className="gap-0 p-0" style={{ maxHeight: Math.round((height - top - bottom) * 0.92) }}>
      <View className="border-b border-border px-5 pb-3 pt-5">
        <DialogTitle className="font-serif text-xl font-normal">Filters</DialogTitle>
      </View>
      <SheetBody>
        <Choices
          label="Show"
          value={filters.kind}
          onChange={(kind) => onChange({ kind, specialty: '', orgType: '' })}
          options={[
            { value: 'hcp', label: 'Doctors' },
            { value: 'hco', label: 'Accounts' },
          ]}
        />
        <View className="gap-2">
          <Text className="text-sm font-medium">Why see them</Text>
          <View className="flex-row flex-wrap gap-2">
            {SIGNAL_FILTERS.map((s) => {
              const on = filters.signals.includes(s.id);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => toggle(s.id)}
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
        </View>
        {filters.kind === 'hcp' ? (
          <Choices
            label="Specialty"
            value={filters.specialty}
            onChange={(specialty) => onChange({ specialty })}
            options={[{ value: '', label: 'Any' }, ...SPECIALTIES.map((s) => ({ value: s, label: s }))]}
          />
        ) : (
          <Choices
            label="Type"
            value={filters.orgType}
            onChange={(orgType) => onChange({ orgType })}
            options={[{ value: '', label: 'Any' }, ...ORG_TYPES.map((t) => ({ value: t, label: t }))]}
          />
        )}
        <Choices label="Distance" value={filters.distance} onChange={(distance) => onChange({ distance })} options={DISTANCES.map((d) => ({ value: d.id, label: d.label }))} />
        <Choices
          label="In your plan"
          value={filters.planned}
          onChange={(planned) => onChange({ planned })}
          options={[
            { value: 'any', label: 'Everyone' },
            { value: 'unplanned', label: 'Not planned' },
            { value: 'planned', label: 'Planned' },
          ]}
        />
        <Choices label="Order" value={filters.sort} onChange={(sort) => onChange({ sort })} options={SORTS.map((s) => ({ value: s.id, label: s.label }))} />
      </SheetBody>
      <View className="flex-row gap-2 border-t border-border px-5 py-3">
        <Button variant="outline" className="flex-1 rounded-xl" onPress={onClear}>
          <Text>Clear</Text>
        </Button>
        <Button className="flex-1 rounded-xl" onPress={onDone}>
          <Text>{`Show ${results}`}</Text>
        </Button>
      </View>
    </DialogContent>
  );
}
