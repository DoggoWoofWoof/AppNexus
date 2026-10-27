// Targets: everyone in the territory, most procedures first. Under the search
// box, Doctors or Accounts beside Filters, then the chips, on as many lines as
// they need, or in a row that scrolls at very large text: the territory
// (the rep's own, New York and New Jersey, one of them, or Connecticut or
// Pennsylvania next door), the procedures counted (all, a group such as
// Coronary, or one code), My targets, "Uses a competitor" (or the ones chosen in
// Filters), and one for each filter that's on, which takes it off. The territory and procedures are kept for next time. When nobody
// in the rep's own territory matches, it says how many next door, to show them.
// Filters has a search of its own (lib/filter-search.ts): "EP", "NJ", "PCI" or a
// hospital's name finds that filter to add with a tap, and several specialties,
// types or competitors add up. The search box takes plain English: as
// "cardiologists in NJ" is typed, "Show cardiologists in New Jersey" is offered
// under it, which, like pressing search, sets the chips from the words
// (lib/target-query.ts); anything left over, such as a name or a town, is
// searched for. Ask's answer to the same question opens here with the same
// chips, and so do the daily brief's tiles, each on its state. An account
// named, as in "top doctors at Quarry Ridge", or tapped from its row or its
// page, shows who works there, with an "At" chip to take it off.
// Each row has the phone and email.
// The star on a row keeps someone in My targets, which Ask goes by and the daily
// brief looks beyond. + picks someone for the day's route, as many as the rep
// likes, and "Build route" at the bottom puts them all in the day, each where it
// adds the least driving, then opens Today to go over the route, with one Undo;
// the star beside it puts them all in My targets. Each doctor says whether they're
// usually in that day ("In 12:30–13:30" or "Not in on Tuesdays"), and those who
// are come first. Someone in that day who doesn't usually see people then says
// when they do ("Not their usual time · usually Fri 13:00–16:00"). Someone
// already planned at any time gets "Set a time".
// My targets come first, then everyone else, each under a heading, unless the
// list is nearest first or by name. A star tapped leaves the row where it is
// until the list changes, so the rows don't jump about while adding people.
// The list shows 20 to a page, with Previous and Next under it; a new search or
// filter starts again from the first page.
// "See everyone" after a cancel or "Not in" opens it with the filters that sheet
// goes by (in that day, not planned, nearest to the visit first), shown as chips
// to change. Filling a freed time, it shows "+ 11:00" for people usually
// seeing visitors then, and why not ("Usually Tue/Thu 07:30–08:30") for everyone else.

import { router, useLocalSearchParams } from 'expo-router';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Circle, CircleCheck, Mail, Phone, Search, SlidersHorizontal, Square, SquareCheckBig, Star, Users, X, type LucideIcon } from 'lucide-react-native';
import { Fragment, useRef, useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Delta } from '@/components/charts';
import { StarButton, useProfileHref } from '@/components/entity';
import { MenuButton } from '@/components/menu';
import { Choices, SheetBody } from '@/components/note-sheet';
import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { useVisitSheets } from '@/components/visit-sheets';
import { inOnDay, type Availability } from '@/lib/booking';
import { outcomeWord } from '@/lib/brief';
import { CODE_GROUPS, CODES, pickLabel, volumeText } from '@/lib/codes';
import { allEntities, getEntity, getOrg, hcpsAt, shortName, stateOf, STATES, YOUR_STATES } from '@/lib/data';
import { filterOptions, findFilters, type FilterOption } from '@/lib/filter-search';
import { formatKm, listJoin, plural } from '@/lib/format';
import { telUrl } from '@/lib/links';
import { activeFilterCount, DEFAULT_FILTERS, filterChips, insteadFilters, mineFirst, readSearchLink, type Filters, type SearchRow } from '@/lib/search';
import { SHORT_SPECIALTY } from '@/lib/specialties';
import { useWorkspace } from '@/lib/store';
import { describeSearch, readTargetQuery } from '@/lib/target-query';
import type { Entity, Signal, VisitType } from '@/lib/types';
import { cn } from '@/lib/utils';

type SheetName = 'filters' | 'states' | 'codes';

/** How many rows a page of the list shows. */
const PAGE = 20;

const OWN_STATES = STATES.filter((s) => YOUR_STATES.includes(s.id));
const NEXT_DOOR = STATES.filter((s) => !YOUR_STATES.includes(s.id));

export default function Targets() {
  const ctx = useWorkspace();
  const { states, codes } = ctx.ws.prefs;
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sheet, setSheet] = useState<SheetName | null>(null);
  // Once the words typed, or a question in Ask, have set the filters, a line says so until they're changed.
  const [read, setRead] = useState<string | null>(null);
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  // The territory and procedures are kept for next time; the rest are this list's.
  const change = (patch: Partial<Filters>) => {
    const { states: inStates, codes: inCodes, ...rest } = patch;
    if (inStates || inCodes) ctx.setPrefs({ ...(inStates ? { states: inStates } : {}), ...(inCodes ? { codes: inCodes } : {}) });
    set(rest);
  };
  // From "See everyone": who it's instead of and where the visit was, set as filters each time it's tapped.
  const params = useLocalSearchParams<{ near?: string; except?: string; at?: string; org?: string; find?: string; from?: string; by?: string }>();
  const [instead, setInstead] = useState<{ near: string; except: string; at?: string } | null>(null);
  if (params.at && params.near && params.at !== instead?.at) {
    setInstead({ near: params.near, except: params.except ?? '', at: params.at });
    setFilters(insteadFilters(params.near));
  }
  // From an account's page, the doctors there; from Ask or the daily brief, the
  // search it answered, whose territory and procedures are the rep's chips (a tile
  // of the brief sets its state there first). Set each time one is tapped.
  const [fromOrg, setFromOrg] = useState<string | null>(null);
  if (params.from && params.from !== fromOrg && (params.org || params.find)) {
    setFromOrg(params.from);
    if (params.org) setFilters({ ...DEFAULT_FILTERS, kind: 'hcp', org: params.org });
    else {
      const asked = { ...readSearchLink(params.find ?? '') };
      delete asked.states;
      delete asked.codes;
      setFilters({ ...DEFAULT_FILTERS, ...asked, org: asked.org && getOrg(asked.org) ? asked.org : '' });
      setRead(params.by === 'brief' ? 'From your daily brief. Tap a chip to change it.' : 'Set from what you asked. Tap a chip to change it.');
    }
  }
  // The account chosen has its own chip, so clearing the filters keeps it.
  const clearFilters = () => {
    setFilters({ ...DEFAULT_FILTERS, query: filters.query, kind: filters.kind, mine: filters.mine, org: filters.org });
    setInstead((i) => (i ? { ...i, near: '' } : i));
  };
  const atOrg = filters.org ? getOrg(filters.org) : undefined;
  const scroll = useRef<ScrollViewInstance>(null);
  const { width, fontScale } = useWindowDimensions();
  // Who + has picked for the day's route.
  const [picked, setPicked] = useState<string[]>([]);
  const day = ctx.ws.selection.day;
  const dayWord = ctx.dayWord(day);
  const free = ctx.filling;
  const others = ctx.freeSlotsOn(day, new Date()).filter((s) => s.itemId !== free?.itemId);
  const chosen: Filters = { ...filters, states, codes };
  const applied = free ? { ...chosen, sort: 'distance' as const, planned: 'unplanned' as const } : chosen;
  // Whose visit it was isn't offered back, until the filters are cleared.
  const found = ctx.search(applied).filter((r) => !instead?.near || r.entity.id !== instead.except);
  const insteadOf = instead?.near && filters.near === instead.near ? getEntity(instead.except) : undefined;
  // While filling a time, whoever is usually free then comes first, still nearest first.
  const fits = new Map(found.map((r) => [r.entity.id, ctx.fitsSlot(r.entity)]));
  const canSee = found.filter((r) => fits.get(r.entity.id)?.ok);
  // Otherwise doctors who are in that day come first, unless sorted by name.
  const inDay = new Map(found.map((r) => [r.entity.id, r.entity.kind === 'hcp' ? inOnDay(r.entity, day) : null]));
  const isIn = (r: SearchRow) => inDay.get(r.entity.id)?.ok !== false;
  const ranked = free
    ? [...canSee, ...found.filter((r) => !fits.get(r.entity.id)?.ok)]
    : applied.sort === 'name'
      ? found
      : [...found.filter(isIn), ...found.filter((r) => !isIn(r))];
  // Twenty to a page. Anything that changes the list starts it again from the first
  // page, and who's in My targets is taken then, so a star tapped doesn't move the row.
  const listKey = JSON.stringify([applied, day]);
  const mineNow = () => found.filter((r) => r.mine).map((r) => r.entity.id);
  const [paged, setPaged] = useState(() => ({ key: listKey, page: 0, mine: mineNow() }));
  if (paged.key !== listKey) setPaged({ key: listKey, page: 0, mine: mineNow() });
  // My targets first, then everyone else, when the list is ranked rather than nearest first or by name.
  const kept = new Set(paged.key === listKey ? paged.mine : mineNow());
  const isMine = (r: SearchRow) => kept.has(r.entity.id);
  const grouped = !free && (applied.sort === 'volume' || applied.sort === 'relevance');
  const rows = grouped ? mineFirst(ranked, isMine) : ranked;
  // A heading over each part, when there are both.
  const mineCount = grouped ? rows.filter(isMine).length : 0;
  const headed = mineCount > 0 && mineCount < rows.length;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  // Past the end once rows have gone, as when taking people off My targets, it's the last page.
  const page = Math.min(paged.key === listKey ? paged.page : 0, pages - 1);
  const first = page * PAGE;
  const shown = rows.slice(first, first + PAGE);
  const goTo = (next: number) => {
    setPaged((p) => ({ ...p, page: next }));
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  // Nobody in the rep's own territory: who matches next door, to show them.
  const nextDoor = !rows.length && !states.length && !filters.org && !free ? ctx.search({ ...applied, states: NEXT_DOOR.map((s) => s.id) }) : [];
  const nextDoorStates = NEXT_DOOR.filter((s) => nextDoor.some((r) => stateOf(r.entity) === s.id));
  const visits = useVisitSheets();
  // The day Build route adds to: the next working day once today is over.
  const routeDay = ctx.addingTo(day);
  // Those picked not in that day already, as when added from their page since; none while filling a freed time.
  const picking = free ? [] : picked.filter((id) => !ctx.planItemFor(id, routeDay));
  const count = activeFilterCount(filters);
  const people = filters.kind === 'hcp';
  const fill = (id: string) => {
    if (!free) return;
    ctx.fillSlot(free.itemId, id);
    router.navigate('/today');
  };
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  // Build route: the people picked go in the day, and Today opens to go over the route, with one Undo.
  const buildRoute = () => {
    setPicked([]);
    if (!picking.length) return;
    ctx.addPeople(picking, day);
    // The rep has chosen who to see, so Today shows the day with the brief folded away.
    ctx.foldBrief();
    router.navigate('/today');
  };
  // They stay picked, to build the route with them too.
  const starPicked = () => {
    if (picking.length) ctx.addTargets(picking);
  };
  // Doctors and accounts have their own specialties and types, so switching clears them.
  const switchTo = (kind: Entity['kind']) => set({ kind, specialties: [], orgTypes: [] });
  // An account's doctors: everyone there, not only My targets, from the top.
  const seeDoctors = (orgId: string) => {
    set({ kind: 'hcp', org: orgId, specialties: [], orgTypes: [], mine: false });
    setRead(null);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  // What the words typed mean as filters, until they're used. A name in the list is only a name.
  const names = allEntities()
    .filter((e) => e.kind === filters.kind)
    .map((e) => e.name);
  const typed = filters.query.trim() && !read ? readTargetQuery(filters.query, names) : null;
  const words = typed?.understood ? { ...(typed.filters.kind && typed.filters.kind !== filters.kind ? { specialties: [], orgTypes: [] } : {}), ...typed.filters } : null;
  const offer = words ? describeSearch({ ...chosen, ...words }, dayWord) : '';
  // Search, or the line offering it, sets the chips from the words; anything left over stays in the box.
  const readQuery = () => {
    if (!words) return;
    change(words);
    setRead('Set from what you typed. Tap a chip to change it.');
  };
  // The territory chip: "Your territory" until a state is chosen, then its name, or their letters for several.
  const stateNames = (states.length ? STATES.filter((s) => states.includes(s.id)) : OWN_STATES).map((s) => s.label);
  const territory = !states.length ? 'Your territory' : states.length === 1 ? stateNames[0] : states.join(', ');
  // Two chips to a line, or more, unless the text is very large.
  const wrapChips = width / fontScale >= 360;
  const chips = (
    <>
      {/* An account is in one state, so the states are put aside while one is chosen. */}
      {atOrg ? (
        <Chip label={`At ${atOrg.name}`} on clears onPress={() => set({ org: '' })} accessibilityLabel={`At ${atOrg.name}, take it off`} />
      ) : (
        <Chip label={territory} on={states.length > 0} opens onPress={() => setSheet('states')} accessibilityLabel={`Territory: ${listJoin(stateNames)}`} />
      )}
      <Chip label={pickLabel(codes)} on={codes !== 'all'} opens onPress={() => setSheet('codes')} accessibilityLabel={`Procedures: ${pickLabel(codes)}`} />
      <Chip label="My targets" icon={Star} filled={filters.mine} on={filters.mine} checkbox onPress={() => set({ mine: !filters.mine })} />
      <Chip
        label={filters.competitors.length && !filters.competitors.includes('any') ? `Uses ${filters.competitors.join(' or ')}` : 'Uses a competitor'}
        on={filters.competitors.length > 0}
        checkbox
        onPress={() => set({ competitors: filters.competitors.length ? [] : ['any'] })}
      />
      {filterChips(filters, dayWord).map((c) => (
        <Chip key={c.key} label={c.label} on clears onPress={() => set(c.off)} accessibilityLabel={`${c.label}, take it off`} />
      ))}
    </>
  );

  return (
    <View className="flex-1">
      <Screen inset scrollRef={scroll}>
        <View className="gap-3">
          <View className="flex-row items-center gap-2">
            <MenuButton />
            <Input
              className="flex-1 rounded-xl"
              value={filters.query}
              onChangeText={(query) => {
                set({ query });
                setRead(null);
              }}
              onSubmitEditing={readQuery}
              placeholder={people ? 'Try “cardiologists in NJ”' : 'Try “hospitals in NJ”'}
              accessibilityLabel={people ? 'Find doctors' : 'Find accounts'}
              returnKeyType="search"
              autoCorrect={false}
            />
          </View>
          {offer ? (
            <Pressable
              onPress={readQuery}
              accessibilityRole="button"
              accessibilityHint="Sets the filters from what you typed"
              className="min-h-11 flex-row items-center gap-2 rounded-xl border border-brand-line bg-brand-soft px-3 py-2 active:opacity-70"
            >
              <Icon as={Search} size={16} className="text-brand" />
              <Text className="flex-1 text-sm text-brand">{`Show ${offer}`}</Text>
              <Icon as={ChevronRight} size={16} className="text-brand" />
            </Pressable>
          ) : null}
          <View className="flex-row items-center gap-2">
            <Tabs value={filters.kind} onValueChange={(kind) => switchTo(kind as Entity['kind'])} className="flex-1">
              <TabsList>
                <TabsTrigger value="hcp">
                  <Text>Doctors</Text>
                </TabsTrigger>
                <TabsTrigger value="hco">
                  <Text>Accounts</Text>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Pressable
              onPress={() => setSheet('filters')}
              accessibilityRole="button"
              accessibilityLabel={count ? `Filters, ${count} on` : 'Filters'}
              className={cn('min-h-11 flex-row items-center gap-1.5 rounded-lg border px-3 active:opacity-70', count ? 'border-primary bg-accent' : 'border-border bg-card')}
            >
              <Icon as={SlidersHorizontal} size={16} className={count ? 'text-accent-foreground' : 'text-muted-foreground'} />
              <Text className={cn('text-sm font-semibold', count ? 'text-accent-foreground' : 'text-foreground')}>{count ? `Filters · ${count}` : 'Filters'}</Text>
            </Pressable>
          </View>
          {/* The chips wrap, so the competitor one and any filter that's on can be seen,
              unless the text is too big for two to a line, as at 200%; then they scroll sideways. */}
          {wrapChips ? (
            <View className="flex-row flex-wrap gap-2">{chips}</View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 grow-0" contentContainerClassName="gap-2 px-4" keyboardShouldPersistTaps="handled">
              {chips}
            </ScrollView>
          )}
          {read ? (
            <Text className="text-sm text-muted-foreground" accessibilityLiveRegion="polite">
              {read}
            </Text>
          ) : null}
        </View>

        {insteadOf && !free ? (
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
                <Text className="text-base font-semibold">{`Free at ${free.time}${day === ctx.todayIso ? '' : `, ${dayWord}`}`}</Text>
                {` · nearest to ${getOrg(free.siteId)?.name ?? 'the visit'}`}
              </Text>
              <Button size="icon" variant="ghost" onPress={() => ctx.leaveFree(free.itemId)} accessibilityLabel={`Leave ${free.time} free`}>
                <Icon as={X} size={18} className="text-muted-foreground" />
              </Button>
            </View>
            {canSee.length ? null : (
              <Text className="text-sm text-muted-foreground" accessibilityLiveRegion="polite">
                {`Nobody here is usually free at ${free.time}. Try ${people ? 'Accounts' : 'Doctors'} above, or leave it free.`}
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
        ) : (
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-base text-muted-foreground" accessibilityLiveRegion="polite">
              {rows.length
                ? `${plural(rows.length, people ? 'doctor' : 'account')}, ${ORDER_WORDS[applied.sort]}${page ? ` · page ${page + 1} of ${pages}` : ` · +\u00a0picks who to see ${ctx.dayWord(routeDay)}`}`
                : nextDoor.length
                  ? `Nobody in your territory. ${plural(nextDoor.length, people ? 'doctor' : 'account')} in ${listJoin(nextDoorStates.map((s) => s.label))}.`
                  : offer
                    ? 'Nobody by that name. Tap Show above, or press search, to use the words as filters.'
                    : 'Nobody matches. Try fewer filters.'}
            </Text>
            {nextDoor.length ? (
              <Button
                size="sm"
                variant="ghost"
                onPress={() => ctx.setPrefs({ states: nextDoorStates.map((s) => s.id) })}
                accessibilityLabel={`Show ${listJoin(nextDoorStates.map((s) => s.label))}`}
              >
                <Text className="text-brand">Show</Text>
              </Button>
            ) : null}
          </View>
        )}

        <View className="gap-2">
          {shown.map((row, i) => (
            <Fragment key={row.entity.id}>
              {/* Each part's heading, and again at the top of a page that goes on with it. */}
              {headed && (i === 0 || first + i === mineCount) ? (
                <Text variant="kicker" role="heading" className={i ? 'pt-3' : undefined}>
                  {first + i < mineCount ? `My targets · ${mineCount}` : `Everyone else · ${rows.length - mineCount}`}
                </Text>
              ) : null}
              <TargetRow
                row={row}
                freeTime={free?.time ?? null}
                fit={fits.get(row.entity.id) ?? null}
                inDay={inDay.get(row.entity.id) ?? null}
                dayWord={dayWord}
                warning={row.planned ? ctx.timeWarning(row.planned, day, false) : null}
                logged={day === ctx.todayIso ? ctx.loggedToday(row.entity.id) : null}
                onStar={() => ctx.toggleTarget(row.entity.id)}
                onDoctors={() => seeDoctors(row.entity.id)}
                onFill={() => fill(row.entity.id)}
                picked={picking.includes(row.entity.id)}
                onPick={() => toggle(row.entity.id)}
                onSetTime={() => row.planned && visits.openSetTime(row.entity, { day, id: row.planned.id, item: row.planned })}
              />
            </Fragment>
          ))}
        </View>
        {pages > 1 ? (
          <View className="flex-row flex-wrap items-center justify-between gap-2 pt-1">
            <Button size="lg" variant="outline" className="rounded-xl" disabled={page === 0} onPress={() => goTo(page - 1)} accessibilityLabel="Previous page">
              <Icon as={ChevronLeft} size={18} />
              <Text>Previous</Text>
            </Button>
            <Text className="text-sm text-muted-foreground">{`${first + 1}–${first + shown.length} of ${rows.length}`}</Text>
            <Button size="lg" variant="outline" className="rounded-xl" disabled={page === pages - 1} onPress={() => goTo(page + 1)} accessibilityLabel="Next page">
              <Text>Next</Text>
              <Icon as={ChevronRight} size={18} />
            </Button>
          </View>
        ) : null}
        {/* Room to scroll the last row clear of the Build route bar. */}
        {picking.length ? <View className="h-20" /> : null}

        <Dialog open={!!sheet} onOpenChange={(open) => !open && setSheet(null)}>
          {sheet === 'filters' ? (
            <FilterSheet
              options={filterOptions(chosen, dayWord)}
              near={filters.near}
              onChange={change}
              onClear={clearFilters}
              onDone={() => setSheet(null)}
              results={rows.length}
              nearSite={(instead?.near && getOrg(instead.near)) || undefined}
            />
          ) : sheet === 'states' ? (
            <ChipSheet title="Territory" sub="Targets shows it, and keeps it for next time." results={rows.length} onDone={() => setSheet(null)}>
              {/* One choice across both: the rep's own territory or part of it, or one next door. */}
              <Choices
                label="Your territory"
                value={states.join()}
                onChange={(v) => ctx.setPrefs({ states: v ? [v] : [] })}
                options={[{ value: '', label: listJoin(OWN_STATES.map((s) => s.label)) }, ...OWN_STATES.map((s) => ({ value: s.id, label: s.label }))]}
              />
              <Choices
                label="Other territories"
                value={states.join()}
                onChange={(v) => ctx.setPrefs({ states: [v] })}
                options={NEXT_DOOR.map((s) => ({ value: s.id, label: s.label }))}
              />
            </ChipSheet>
          ) : sheet === 'codes' ? (
            <ChipSheet
              title="Procedures"
              sub="Most in the last four quarters first. All procedures leaves out echo and stress tests. Kept for next time."
              results={rows.length}
              onDone={() => setSheet(null)}
            >
              <CodeChoices value={codes} onChange={(pick) => ctx.setPrefs({ codes: pick })} />
            </ChipSheet>
          ) : null}
        </Dialog>
        {visits.sheets}
      </Screen>
      {picking.length ? (
        // Room at the bottom for the Ask button, which rises out of the tab bar below.
        // At very large text the star goes without its words, so Build route still fits.
        <View className="absolute inset-x-0 bottom-0 flex-row gap-2 border-t border-border bg-background px-4 pb-7 pt-3">
          <Button
            size="lg"
            variant="outline"
            className="rounded-xl"
            onPress={starPicked}
            accessibilityLabel={`Add the ${plural(picking.length, 'person', 'people')} picked to My targets`}
          >
            <Icon as={Star} size={18} />
            {wrapChips ? <Text>My targets</Text> : null}
          </Button>
          <Button
            size="lg"
            className="flex-1 rounded-xl"
            onPress={buildRoute}
            accessibilityLabel={`Build ${ctx.dayWord(routeDay)}’s route with the ${plural(picking.length, 'person', 'people')} picked`}
          >
            <Text className="text-lg">{`Build route · ${picking.length}`}</Text>
          </Button>
        </View>
      ) : null}
    </View>
  );
}

type InDay = ReturnType<typeof inOnDay>;

const ORDER_WORDS: Record<Filters['sort'], string> = { volume: 'most procedures first', relevance: 'best first', distance: 'nearest first', name: 'by name' };

/**
 * A chip under the search box. One that opens choices has a ▾, one for a filter
 * that's on has an × and takes it off, and My targets and competitors are tick boxes.
 */
function Chip({
  label,
  icon,
  on,
  opens = false,
  clears = false,
  filled = false,
  checkbox = false,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  icon?: LucideIcon;
  on: boolean;
  opens?: boolean;
  clears?: boolean;
  /** The icon filled in, as the star is for My targets. */
  filled?: boolean;
  checkbox?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={checkbox ? 'checkbox' : 'button'}
      // Not accessibilityState: the web build only passes aria-checked on.
      aria-checked={checkbox ? on : undefined}
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={4}
      className={cn('min-h-9 flex-row items-center gap-1.5 rounded-full border px-3 active:opacity-70', on ? 'border-primary bg-accent' : 'border-border bg-card')}
    >
      {icon ? <Icon as={icon} size={14} className={on ? 'text-accent-foreground' : 'text-muted-foreground'} fill={filled ? 'currentColor' : 'none'} /> : null}
      <Text className={cn('text-sm', on ? 'text-accent-foreground' : 'text-foreground')}>{label}</Text>
      {opens ? <Icon as={ChevronDown} size={14} className="text-muted-foreground" /> : null}
      {clears ? <Icon as={X} size={14} className="text-accent-foreground" /> : null}
    </Pressable>
  );
}

const TONE: Record<Signal['tone'], string> = { warn: 'text-warn', rose: 'text-signal-text', accent: 'text-brand', neutral: 'text-muted-foreground' };

/**
 * Their name and specialty; their procedures a year with the change as the
 * trend arrow, and how far; why to see them and whose products they use; and
 * with `when`, whether they're in that day.
 */
function RowInfo({ row, when }: { row: SearchRow; when?: { text: string; tone: 'in' | 'out' | 'planned' } | null }) {
  const { entity, volume } = row;
  // Growth is in the number already, and "No contact yet" goes without saying for someone not in My targets.
  const why = row.signals.find((s) => s.id !== 'rising' && (s.id !== 'unseen' || row.mine));
  const uses = entity.competitors?.length ? `Uses ${entity.competitors.join(' and ')}` : '';
  return (
    <View className="flex-1 gap-0.5">
      {entity.kind === 'hcp' ? (
        <Text className="text-base font-semibold" numberOfLines={1}>
          {shortName(entity)}
          <Text className="text-sm font-normal text-muted-foreground">{` · ${SHORT_SPECIALTY[entity.specialty] ?? entity.specialty}`}</Text>
        </Text>
      ) : (
        <Text className="text-base font-semibold">{entity.name}</Text>
      )}
      <View className="flex-row items-center gap-1.5">
        {volume ? (
          <>
            <Text className="text-sm font-medium">{volumeText(volume)}</Text>
            <Delta value={volume.change} suffix="" hideFlat />
          </>
        ) : entity.kind === 'hco' ? (
          <Text className="shrink text-sm text-muted-foreground" numberOfLines={1}>
            {entity.typeDetail}
          </Text>
        ) : null}
        <Text className="text-sm text-muted-foreground">{volume || entity.kind === 'hco' ? `· ${formatKm(row.distance)}` : formatKm(row.distance)}</Text>
      </View>
      {why || uses ? (
        // Two lines at most, so a competitor's name isn't cut off after a long reason.
        <Text className="text-sm" numberOfLines={2}>
          {why ? <Text className={cn('text-sm', TONE[why.tone])}>{why.label}</Text> : null}
          {why && uses ? <Text className="text-sm text-muted-foreground">{' · '}</Text> : null}
          {uses ? <Text className="text-sm text-signal-text">{uses}</Text> : null}
        </Text>
      ) : null}
      {when ? (
        <Text className={cn('text-sm', when.tone === 'out' ? 'text-warn' : when.tone === 'planned' ? 'text-success' : 'text-muted-foreground')} numberOfLines={1}>
          {when.text}
        </Text>
      ) : null}
    </View>
  );
}

type Logged = { met: boolean; type: VisitType } | null;

/**
 * "In 12:30–13:30", "Not in on Tuesdays", or on a day they're in but don't
 * usually see people, "Not their usual time · usually Fri 13:00–16:00". Once
 * planned when, or why it isn't a good day or time for them, and once logged
 * today how it went: "Met today", "No answer today".
 */
function whenLine(row: SearchRow, inDay: InDay | null, dayWord: string, logged: Logged, warning: string | null): { text: string; tone: 'in' | 'out' | 'planned' } | null {
  const { planned } = row;
  if (planned?.status === 'planned') {
    return warning ? { text: warning, tone: 'out' } : { text: `In your plan · ${planned.mode === 'timed' && planned.time ? planned.time : 'any time'}`, tone: 'planned' };
  }
  if (logged) return { text: `${outcomeWord(logged.met ? 'Met' : 'Attempted', logged.type)} today`, tone: logged.met ? 'planned' : 'out' };
  if (planned) return { text: `Logged ${dayWord}`, tone: 'planned' };
  if (!inDay) return null;
  if (!inDay.ok) return { text: inDay.why, tone: 'out' };
  if (inDay.outside) return { text: inDay.outside, tone: 'out' };
  return inDay.hours ? { text: `In ${dayWord} ${inDay.hours}`, tone: 'in' } : { text: `In ${dayWord}`, tone: 'in' };
}

/** In the plan: "Added", or "Logged" once the visit is logged, however it went. */
const Added = ({ name, logged }: { name: string; logged: boolean }) => (
  <View className="min-h-9 flex-row items-center gap-1 px-2" accessibilityLabel={logged ? `${name} is logged` : `${name} is in your plan`}>
    <Icon as={Check} size={16} className={logged ? 'text-muted-foreground' : 'text-success'} />
    <Text className={logged ? 'text-sm text-muted-foreground' : 'text-sm text-success'}>{logged ? 'Logged' : 'Added'}</Text>
  </View>
);

function TargetRow({
  row,
  freeTime,
  fit,
  inDay,
  dayWord,
  warning,
  logged,
  onStar,
  onDoctors,
  onFill,
  picked,
  onPick,
  onSetTime,
}: {
  row: SearchRow;
  freeTime: string | null;
  /** Whether they can be seen at the free time, while one is being filled. */
  fit: Availability | null;
  /** Whether a doctor is in on the day being planned. */
  inDay: InDay | null;
  dayWord: string;
  /** Once planned, why it isn't a good day or time for them, as Today says it. */
  warning: string | null;
  /** How they were logged today, when the day is today. */
  logged: Logged;
  onStar: () => void;
  /** For an account, shows the doctors there. */
  onDoctors: () => void;
  onFill: () => void;
  /** Picked with +, for Build route. */
  picked: boolean;
  onPick: () => void;
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
    action = <Added name={entity.name} logged={planned.status === 'done'} />;
  } else {
    // + picks them, and a second tap puts them back; Build route at the bottom adds everyone picked.
    action = (
      <Button
        size="sm"
        variant={picked ? 'default' : 'outline'}
        className="rounded-lg"
        onPress={onPick}
        // Not accessibilityState: the web build only passes aria-checked on.
        role="checkbox"
        aria-checked={picked}
        accessibilityLabel={`Pick ${entity.name} for your route`}
      >
        {picked ? <Icon as={Check} size={16} className="text-primary-foreground" /> : null}
        <Text>{picked ? 'Picked' : '+ Add'}</Text>
      </Button>
    );
  }
  return (
    <View className="rounded-xl border border-border bg-card py-2 pl-1 pr-2">
      <View className="min-h-12 flex-row items-center gap-1">
        <StarButton on={row.mine} name={entity.name} onPress={onStar} />
        <Pressable onPress={() => router.push(profileHref(entity))} accessibilityRole="link" className="flex-1 flex-row items-center active:opacity-70">
          <RowInfo row={row} when={freeTime ? null : whenLine(row, inDay, dayWord, logged, warning)} />
        </Pressable>
        {action}
      </View>
      <ContactLine entity={entity} onDoctors={onDoctors} />
    </View>
  );
}

/** Under the name, one tap each: a doctor's phone and email, or an account's main line and its doctors. Each is 44pt to tap, with the slop. */
function ContactLine({ entity, onDoctors }: { entity: Entity; onDoctors: () => void }) {
  const phone = entity.kind === 'hcp' ? entity.contact.phone : entity.phone;
  const doctors = entity.kind === 'hco' ? hcpsAt(entity.id).length : 0;
  return (
    <View className="flex-row flex-wrap items-center gap-x-4 pl-11">
      {doctors ? <ContactLink icon={Users} label={plural(doctors, 'doctor')} hint={`See the doctors at ${entity.name}`} onPress={onDoctors} /> : null}
      <ContactLink icon={Phone} label={phone} hint={`Call ${entity.name}, ${phone}`} onPress={() => void Linking.openURL(telUrl(phone))} />
      {entity.kind === 'hcp' ? (
        <ContactLink
          icon={Mail}
          label={entity.contact.email}
          hint={`Email ${entity.name}, ${entity.contact.email}`}
          onPress={() => void Linking.openURL(`mailto:${entity.contact.email}`)}
        />
      ) : null}
    </View>
  );
}

const ContactLink = ({ icon, label, hint, onPress }: { icon: LucideIcon; label: string; hint: string; onPress: () => void }) => (
  <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={hint} hitSlop={6} className="min-h-8 flex-row items-center gap-1.5 active:opacity-70">
    <Icon as={icon} size={14} className="text-brand" />
    <Text className="text-sm text-muted-foreground">{label}</Text>
  </Pressable>
);

/**
 * A sheet from the chips: what it's for, the choices, and the list's count to go
 * back to it. `top` stays put above the choices as they scroll, as a search does.
 */
function ChipSheet({
  title,
  sub,
  top,
  results,
  onDone,
  onClear,
  children,
}: {
  title: string;
  sub?: string;
  top?: ReactNode;
  results: number;
  onDone: () => void;
  onClear?: () => void;
  children: ReactNode;
}) {
  const { width, height } = useWindowDimensions();
  const { top: topInset, bottom } = useSafeAreaInsets();
  return (
    // The window sets the width: percentages have nothing to resolve against inside the dialog.
    <DialogContent className="gap-0 p-0" style={{ width: Math.min(width - 16, 512), maxHeight: Math.round((height - topInset - bottom) * 0.92) }}>
      <View className={cn('gap-1 px-5 pr-12 pt-5', top ? 'pb-2' : 'border-b border-border pb-3')}>
        <DialogTitle className="font-serif text-xl font-normal">{title}</DialogTitle>
        {sub ? <DialogDescription>{sub}</DialogDescription> : null}
      </View>
      {top ? <View className="border-b border-border px-5 pb-3">{top}</View> : null}
      <SheetBody>{children}</SheetBody>
      <View className="flex-row gap-2 border-t border-border px-5 py-3">
        {onClear ? (
          <Button variant="outline" className="flex-1 rounded-xl" onPress={onClear}>
            <Text>Clear</Text>
          </Button>
        ) : null}
        <Button className="flex-1 rounded-xl" onPress={onDone}>
          <Text>{`Show ${results}`}</Text>
        </Button>
      </View>
    </DialogContent>
  );
}

/** All procedures, a group of them, or one. */
function CodeChoices({ value, onChange }: { value: string; onChange: (pick: string) => void }) {
  const group = value === 'all' || CODE_GROUPS.some((g) => g.id === value) ? value : '';
  return (
    <>
      <Choices label="Group" value={group} onChange={onChange} options={[{ value: 'all', label: 'All procedures' }, ...CODE_GROUPS.map((g) => ({ value: g.id, label: g.label }))]} />
      <Choices label="Or one procedure" value={group ? '' : value} onChange={onChange} options={CODES.map((c) => ({ value: c.code, label: `${c.label} · ${c.code}` }))} />
    </>
  );
}

/**
 * Every filter in one place, with a search to find any of them, so the list
 * itself stays a search box and a row of chips. Before anything is typed it
 * shows those without a chip of their own, under their headings.
 */
function FilterSheet({
  options,
  near,
  onChange,
  onClear,
  onDone,
  results,
  nearSite,
}: {
  options: FilterOption[];
  /** Where distances are measured from, when it's a cancelled visit's site. */
  near: string;
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
  onDone: () => void;
  results: number;
  /** Where a cancelled visit was, offered as where to measure from. */
  nearSite?: { id: string; name: string };
}) {
  const [find, setFind] = useState('');
  const found = find.trim() ? findFilters(options, find) : null;
  const groups = [...new Set(options.filter((o) => o.browse).map((o) => o.group))];
  return (
    <ChipSheet
      title="Filters"
      results={results}
      onDone={onDone}
      onClear={onClear}
      top={
        <Input
          value={find}
          onChangeText={setFind}
          placeholder="Find a filter: EP, NJ, PCI, a hospital…"
          accessibilityLabel="Find a filter"
          returnKeyType="search"
          autoCorrect={false}
        />
      }
    >
      {found ? (
        found.length ? (
          <View>
            {found.slice(0, 40).map((o) => (
              <OptionRow key={o.key} option={o} onPress={() => onChange(o.patch)} />
            ))}
          </View>
        ) : (
          <Text className="text-muted-foreground">{`No filter called “${find.trim()}”. Try a specialty, a state, a procedure, a competitor or an account.`}</Text>
        )
      ) : (
        groups.map((group) => (
          <Fragment key={group}>
            <OptionPills label={group} options={options.filter((o) => o.browse && o.group === group)} onPress={(o) => onChange(o.patch)} />
            {group === 'Distance' && nearSite ? (
              <Choices
                label="Measured from"
                value={near}
                onChange={(v) => onChange({ near: v })}
                options={[
                  { value: '', label: 'Where you start' },
                  { value: nearSite.id, label: nearSite.name },
                ]}
              />
            ) : null}
          </Fragment>
        ))
      )}
    </ChipSheet>
  );
}

/** A heading's filters as pills: those that add up are tick boxes, the rest one choice of several. */
function OptionPills({ label, options, onPress }: { label: string; options: FilterOption[]; onPress: (o: FilterOption) => void }) {
  const single = options.every((o) => o.single);
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium">{label}</Text>
      <View className="flex-row flex-wrap gap-2" accessibilityRole={single ? 'radiogroup' : undefined} accessibilityLabel={label}>
        {options.map((o) => (
          <Pressable
            key={o.key}
            onPress={() => onPress(o)}
            accessibilityRole={o.single ? 'radio' : 'checkbox'}
            // Not accessibilityState: the web build only passes aria-checked on.
            aria-checked={o.on}
            accessibilityLabel={o.label}
            hitSlop={4}
            className={cn('min-h-9 justify-center rounded-full border px-3 py-1.5', o.on ? 'border-primary bg-accent' : 'border-border bg-card')}
          >
            <Text className={cn('text-sm', o.on ? 'text-accent-foreground' : 'text-foreground')}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** A filter the search found, with what kind it is under it; tapping adds it or takes it off. */
function OptionRow({ option, onPress }: { option: FilterOption; onPress: () => void }) {
  const icon = option.single ? (option.on ? CircleCheck : Circle) : option.on ? SquareCheckBig : Square;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={option.single ? 'radio' : 'checkbox'}
      aria-checked={option.on}
      accessibilityLabel={`${option.label}, ${option.group}`}
      className="min-h-12 flex-row items-center gap-3 border-b border-border py-2 active:opacity-70"
    >
      <Icon as={icon} size={20} className={option.on ? 'text-primary' : 'text-muted-foreground'} />
      <View className="flex-1">
        <Text className="text-base">{option.label}</Text>
        <Text className="text-sm text-muted-foreground">{option.group}</Text>
      </View>
    </Pressable>
  );
}
