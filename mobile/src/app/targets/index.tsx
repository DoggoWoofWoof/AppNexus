// Targets: who to see, best first. Search, one Filters button for everything
// else, and + on each row to put them in the day's plan. Each doctor says whether
// they're usually in that day ("In 12:30–13:30" or "Not in on Tuesdays"), and
// those who are come first. Someone already planned at any time gets "Set a
// time". Select picks several to add in one go, with one Undo.
// "See everyone" after a cancel or "Not in" opens it with the filters that sheet
// goes by (in that day, not planned, nearest to the visit first), shown in
// Filters to change. Filling a freed time, it shows "+ 11:00" for people usually
// seeing visitors then, and why not ("Usually Tue/Thu 07:30–08:30") for everyone else.

import { router, useLocalSearchParams } from 'expo-router';
import { Check, SlidersHorizontal, Square, SquareCheckBig, X } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
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
import { useVisitSheets } from '@/components/visit-sheets';
import { allHcps, allOrgs, getEntity, getOrg, shortName } from '@/lib/data';
import { formatKm, plural } from '@/lib/format';
import { inOnDay, type Availability } from '@/lib/booking';
import { activeFilterCount, DEFAULT_FILTERS, DISTANCES, insteadFilters, SIGNAL_FILTERS, SORTS, type Filters, type SearchRow } from '@/lib/search';
import { useWorkspace } from '@/lib/store';
import { cn } from '@/lib/utils';

export default function Targets() {
  const ctx = useWorkspace();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  // From "See everyone": who it's instead of and where the visit was, set as filters each time it's tapped.
  const params = useLocalSearchParams<{ near?: string; except?: string; at?: string }>();
  const [instead, setInstead] = useState<{ near: string; except: string; at?: string } | null>(null);
  if (params.at && params.near && params.at !== instead?.at) {
    setInstead({ near: params.near, except: params.except ?? '', at: params.at });
    setFilters(insteadFilters(params.near));
  }
  const clearFilters = () => {
    setFilters({ ...DEFAULT_FILTERS, query: filters.query, kind: filters.kind });
    setInstead((i) => (i ? { ...i, near: '' } : i));
  };
  // Select: the people ticked to add in one go, or null when not selecting.
  const [picked, setPicked] = useState<string[] | null>(null);
  const day = ctx.ws.selection.day;
  const dayWord = ctx.dayWord(day);
  const free = ctx.filling;
  const others = ctx.freeSlotsOn(day, new Date()).filter((s) => s.itemId !== free?.itemId);
  const applied = free ? { ...filters, sort: 'distance' as const, planned: 'unplanned' as const } : filters;
  // Whose visit it was isn't offered back, until the filters are cleared.
  const found = ctx.search(applied).filter((r) => !instead?.near || r.entity.id !== instead.except);
  const insteadOf = instead?.near && filters.near === instead.near ? getEntity(instead.except) : undefined;
  // While filling a time, whoever is usually seeing people then comes first, still nearest first.
  const fits = new Map(found.map((r) => [r.entity.id, ctx.fitsSlot(r.entity)]));
  const canSee = found.filter((r) => fits.get(r.entity.id)?.ok);
  // Otherwise doctors who are in that day come first, unless sorted by name.
  const inDay = new Map(found.map((r) => [r.entity.id, r.entity.kind === 'hcp' ? inOnDay(r.entity, day) : null]));
  const isIn = (r: SearchRow) => inDay.get(r.entity.id)?.ok !== false;
  const rows = free
    ? [...canSee, ...found.filter((r) => !fits.get(r.entity.id)?.ok)]
    : applied.sort === 'name'
      ? found
      : [...found.filter(isIn), ...found.filter((r) => !isIn(r))];
  const visits = useVisitSheets();
  const picking = picked && !free ? picked : null;
  const count = activeFilterCount(filters);
  const people = filters.kind === 'hcp';
  const fill = (id: string) => {
    if (!free) return;
    ctx.fillSlot(free.itemId, id);
    router.navigate('/today');
  };
  const toggle = (id: string) => setPicked((p) => (p?.includes(id) ? p.filter((x) => x !== id) : [...(p ?? []), id]));
  const addPicked = () => {
    if (picking?.length) ctx.addPeople(picking, day);
    setPicked(null);
  };

  return (
    <View className="flex-1">
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

        {insteadOf && !free && !picking ? (
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-base text-muted-foreground" accessibilityLiveRegion="polite">
              <Text className="text-base font-semibold">{`Instead of ${shortName(insteadOf)}`}</Text>
              {` · in ${dayWord}, nearest to ${getOrg(filters.near)?.name ?? 'the visit'} first`}
            </Text>
            <Button size="icon" variant="ghost" onPress={clearFilters} accessibilityLabel="Show everyone">
              <Icon as={X} size={18} className="text-muted-foreground" />
            </Button>
          </View>
        ) : null}
        {free ? (
          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 text-base text-muted-foreground">
                <Text className="text-base font-semibold">{`Free at ${free.time}`}</Text>
                {` · nearest to ${getOrg(free.siteId)?.name ?? 'the visit'}`}
              </Text>
              <Button size="icon" variant="ghost" onPress={() => ctx.leaveFree(free.itemId)} accessibilityLabel={`Leave ${free.time} free`}>
                <Icon as={X} size={18} className="text-muted-foreground" />
              </Button>
            </View>
            {canSee.length ? null : (
              <Text className="text-sm text-muted-foreground" accessibilityLiveRegion="polite">
                {`Nobody here is usually seeing people at ${free.time}. Try ${people ? 'accounts' : 'doctors'} in Filters, or leave it free.`}
              </Text>
            )}
            {/* Other times freed that day wait here, so filling one doesn't lose the rest. */}
            {others.length ? (
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="text-sm text-muted-foreground">Also free:</Text>
                {others.map((s) => (
                  <Button key={s.itemId} size="sm" variant="outline" className="rounded-full" onPress={() => ctx.chooseSlot(s.itemId)} accessibilityLabel={`Fill ${s.time} instead`}>
                    <Text>{s.time}</Text>
                  </Button>
                ))}
              </View>
            ) : null}
          </View>
        ) : picking ? (
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-base text-muted-foreground" accessibilityLiveRegion="polite">
              {picking.length ? `${plural(picking.length, 'person', 'people')} picked` : `Tap the people to add to ${dayWord}`}
            </Text>
            <Button size="sm" variant="ghost" onPress={() => setPicked(null)}>
              <Text className="text-brand">Cancel</Text>
            </Button>
          </View>
        ) : (
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-base text-muted-foreground" accessibilityLiveRegion="polite">
              {rows.length ? `${plural(rows.length, people ? 'doctor' : 'account')}, ${ORDER_WORDS[applied.sort]} · + adds to ${dayWord}` : 'Nobody matches. Try fewer filters.'}
            </Text>
            {rows.some((r) => !r.planned) ? (
              <Button size="sm" variant="ghost" onPress={() => setPicked([])} accessibilityLabel={`Select several to add to ${dayWord}`}>
                <Text className="text-brand">Select</Text>
              </Button>
            ) : null}
          </View>
        )}

        <View className="gap-2">
          {rows.map((row) =>
            picking ? (
              <PickRow key={row.entity.id} row={row} on={picking.includes(row.entity.id)} onToggle={() => toggle(row.entity.id)} />
            ) : (
              <TargetRow
                key={row.entity.id}
                row={row}
                freeTime={free?.time ?? null}
                fit={fits.get(row.entity.id) ?? null}
                inDay={inDay.get(row.entity.id) ?? null}
                dayWord={dayWord}
                onFill={() => fill(row.entity.id)}
                onAdd={() => ctx.addToPlan(row.entity.id, day)}
                onSetTime={() => row.planned && visits.openSetTime(row.entity, { day, id: row.planned.id, item: row.planned })}
              />
            ),
          )}
        </View>
        {/* Room to scroll the last row clear of the Add bar. */}
        {picking ? <View className="h-20" /> : null}

        <Dialog open={showFilters} onOpenChange={setShowFilters}>
          {showFilters ? (
            <FilterSheet
              filters={filters}
              onChange={set}
              onClear={clearFilters}
              onDone={() => setShowFilters(false)}
              results={rows.length}
              dayWord={dayWord}
              nearSite={(instead?.near && getOrg(instead.near)) || undefined}
            />
          ) : null}
        </Dialog>
        {visits.sheets}
      </Screen>
      {picking ? (
        // Room at the bottom for the Ask button, which rises out of the tab bar below.
        <View className="absolute inset-x-0 bottom-0 border-t border-border bg-background px-4 pb-7 pt-3">

          <Button size="lg" className="rounded-xl" disabled={!picking.length} onPress={addPicked}>
            <Text className="text-lg">{picking.length ? `Add ${picking.length} to ${dayWord}` : 'Pick people to add'}</Text>
          </Button>
        </View>
      ) : null}
    </View>
  );
}

type InDay = ReturnType<typeof inOnDay>;

const ORDER_WORDS: Record<Filters['sort'], string> = { relevance: 'best first', distance: 'nearest first', name: 'by name' };

/** Their picture, name, distance and the best reason to see them, and with `when` a line saying whether they're in that day. */
function RowInfo({ row, when }: { row: SearchRow; when?: { text: string; tone: 'in' | 'out' | 'planned' } | null }) {
  const why = row.signals[0];
  return (
    <>
      <Avatar entity={row.entity} />
      <View className="flex-1 gap-0.5">
        <Text className="text-base font-semibold">{shortName(row.entity)}</Text>
        <Text className="text-sm text-muted-foreground" numberOfLines={1}>
          {formatKm(row.distance)}
          {why ? <Text className={cn('text-sm', why.tone === 'warn' ? 'text-warn' : why.tone === 'orange' ? 'text-signal-text' : why.tone === 'accent' ? 'text-brand' : 'text-muted-foreground')}>{` · ${why.label}`}</Text> : null}
        </Text>
        {when ? (
          <Text className={cn('text-sm', when.tone === 'out' ? 'text-warn' : when.tone === 'planned' ? 'text-success' : 'text-muted-foreground')} numberOfLines={1}>
            {when.text}
          </Text>
        ) : null}
      </View>
    </>
  );
}

/** "In 12:30–13:30", "Not in on Tuesdays" or, once planned, when. */
function whenLine(row: SearchRow, inDay: InDay | null, dayWord: string): { text: string; tone: 'in' | 'out' | 'planned' } | null {
  if (row.planned) return { text: `In your plan · ${row.planned.mode === 'timed' && row.planned.time ? row.planned.time : 'any time'}`, tone: 'planned' };
  if (!inDay) return null;
  if (!inDay.ok) return { text: inDay.why, tone: 'out' };
  return inDay.hours ? { text: `In ${dayWord} ${inDay.hours}`, tone: 'in' } : { text: `In ${dayWord}`, tone: 'in' };
}

const Added = ({ name }: { name: string }) => (
  <View className="min-h-9 flex-row items-center gap-1 px-2" accessibilityLabel={`${name} is in your plan`}>
    <Icon as={Check} size={16} className="text-success" />
    <Text className="text-sm text-success">Added</Text>
  </View>
);

function TargetRow({
  row,
  freeTime,
  fit,
  inDay,
  dayWord,
  onFill,
  onAdd,
  onSetTime,
}: {
  row: SearchRow;
  freeTime: string | null;
  /** Whether they can be seen at the free time, while one is being filled. */
  fit: Availability | null;
  /** Whether a doctor is in on the day being planned. */
  inDay: InDay | null;
  dayWord: string;
  onFill: () => void;
  onAdd: () => void;
  onSetTime: () => void;
}) {
  const profileHref = useProfileHref();
  const { entity, planned } = row;
  let action: ReactNode;
  if (freeTime && fit?.ok) {
    action = (
      <Button size="sm" className="rounded-lg" onPress={onFill} accessibilityLabel={`Add ${entity.name} at ${freeTime}`}>
        <Text>{`+ ${freeTime}`}</Text>
      </Button>
    );
  } else if (freeTime) {
    // Not offered: say when they can be seen instead.
    action = (
      <Text className="max-w-[42%] text-right text-sm text-muted-foreground" numberOfLines={2}>
        {/* A word joiner after each dash keeps "08:00–11:00" on one line. */}
        {fit && !fit.ok ? fit.why.replace(/–/g, '–⁠') : 'Not free then'}
      </Text>
    );
  } else if (planned?.mode === 'flexible' && planned.status === 'planned') {
    action = (
      <Button size="sm" variant="outline" className="rounded-lg" onPress={onSetTime} accessibilityLabel={`Set a time for ${entity.name}`}>
        <Text>Set a time</Text>
      </Button>
    );
  } else if (planned) {
    action = <Added name={entity.name} />;
  } else {
    action = (
      <Button size="sm" variant="outline" className="rounded-lg" onPress={onAdd} accessibilityLabel={`Add ${entity.name} to your plan`}>
        <Text>+ Add</Text>
      </Button>
    );
  }
  return (
    <View className="min-h-16 flex-row items-center gap-2 rounded-xl border border-border bg-card py-2 pl-3 pr-2">
      <Pressable onPress={() => router.push(profileHref(entity))} accessibilityRole="link" className="flex-1 flex-row items-center gap-3 active:opacity-70">
        <RowInfo row={row} when={freeTime ? null : whenLine(row, inDay, dayWord)} />
      </Pressable>
      {action}
    </View>
  );
}

/** In Select the whole row ticks them: one big target, and no button inside another. */
function PickRow({ row, on, onToggle }: { row: SearchRow; on: boolean; onToggle: () => void }) {
  const { entity, planned } = row;
  return (
    <Pressable
      onPress={onToggle}
      disabled={!!planned}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on, disabled: !!planned }}
      accessibilityLabel={planned ? `${entity.name}, already in your plan` : entity.name}
      className={cn('min-h-16 flex-row items-center gap-3 rounded-xl border py-2 pl-3 pr-4', on ? 'border-primary bg-accent' : 'border-border bg-card')}
    >
      <RowInfo row={row} />
      {planned ? <Added name={entity.name} /> : <Icon as={on ? SquareCheckBig : Square} size={22} className={on ? 'text-primary' : 'text-muted-foreground'} />}
    </Pressable>
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
  dayWord,
  nearSite,
}: {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
  onDone: () => void;
  results: number;
  dayWord: string;
  /** Where a cancelled visit was, offered as where to measure from. */
  nearSite?: { id: string; name: string };
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
        <Choices
          label="Who's in"
          value={filters.inDay ? 'in' : 'any'}
          onChange={(v) => onChange({ inDay: v === 'in' })}
          options={[
            { value: 'any', label: 'Anyone' },
            { value: 'in', label: `In ${dayWord}` },
          ]}
        />
        <Choices label="Distance" value={filters.distance} onChange={(distance) => onChange({ distance })} options={DISTANCES.map((d) => ({ value: d.id, label: d.label }))} />
        {nearSite ? (
          <Choices
            label="Measured from"
            value={filters.near}
            onChange={(near) => onChange({ near })}
            options={[
              { value: '', label: 'Where you start' },
              { value: nearSite.id, label: nearSite.name },
            ]}
          />
        ) : null}
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
