// What someone's page shows under its two big buttons, as short cards: the
// headline figures, follow-ups (with Done), last time, every visit and call so
// far, what was asked before, how to get in (with Book a time), similar doctors
// nearby, their volumes, who they refer to or where patients go (and, at an
// account, who sends them out, its doctors, people and health system), and
// contact details. "See all" opens a card in full where it is, and each figure
// opens its card, so everything about someone is on this one page. The rules
// are in lib/target.ts.

import { router } from 'expo-router';
import { Check, ChevronDown, ChevronRight, ChevronUp, Phone, Plus } from 'lucide-react-native';
import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { Linking, Pressable, View, type LayoutChangeEvent, type ScrollViewInstance } from 'react-native';

import { InteractionItem, metWith } from '@/components/activity-log';
import { BarRow, Delta, StackBar } from '@/components/charts';
import { Avatar, Tag, useChatHref, useProfileHref } from '@/components/entity';
import { FinePrint } from '@/components/profile';
import { AllVolumes } from '@/components/volumes';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { Brief, Figure } from '@/lib/brief';
import { TERRITORY, useChat, whenLabel } from '@/lib/chat';
import { childrenOf, descendantsOf, destination, diagnosesOf, getEntity, getOrg, hcpsAt, parentOf, proceduresOf, procedureTotal, shortName, testsOf, topReferrersOut } from '@/lib/data';
import { DATA_PERIOD } from '@/lib/data/seed';
import { daysBetween, formatDate, formatKm, formatNumber, fromIso, relativeDayLower, sum, yoy } from '@/lib/format';
import { telUrl } from '@/lib/links';
import { useWorkspace } from '@/lib/store';
import { askedBefore, howToGetIn, promiseDue, siteThatDay, similarNearby, visitsSoFar, whoTheyReferTo, type AskedWhere, type CardId, type VisitOutcome } from '@/lib/target';
import type { Entity, Hcp, Org } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Which cards are open in full, and scrolling to one. Put `onBase` on the view
 * holding TargetInfo, straight inside the scroll view, so a card's place on the page is known.
 */
export function useCards(scrollRef: RefObject<ScrollViewInstance | null>, initial?: CardId) {
  const [open, setOpen] = useState<CardId[]>(initial ? [initial] : []);
  const base = useRef(0);
  const at = useRef<Partial<Record<CardId, number>>>({});
  // A card a link asked for is scrolled to once it has been laid out.
  const pending = useRef<CardId | null>(initial ?? null);
  const scrollTo = (id: CardId) => {
    const y = at.current[id];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, base.current + y - 12), animated: true });
  };
  return {
    isOpen: (id: CardId) => open.includes(id),
    toggle: (id: CardId) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id])),
    /** Opens a card and scrolls to it. */
    show: (id: CardId) => {
      setOpen((o) => (o.includes(id) ? o : [...o, id]));
      scrollTo(id);
    },
    onBase: (e: LayoutChangeEvent) => {
      base.current = e.nativeEvent.layout.y;
    },
    place: (id: CardId, y: number) => {
      at.current[id] = y;
      if (pending.current === id) {
        pending.current = null;
        setTimeout(() => scrollTo(id), 50);
      }
    },
  };
}
export type Cards = ReturnType<typeof useCards>;

/** A titled card. With `id` and `canOpen`, "See all" opens it in full where it is. */
function Block({ title, id, cards, canOpen = false, children }: { title: string; id?: CardId; cards?: Cards; canOpen?: boolean; children: ReactNode }) {
  const open = !!id && !!cards?.isOpen(id);
  return (
    <View className="gap-2" onLayout={id && cards ? (e) => cards.place(id, e.nativeEvent.layout.y) : undefined}>
      <View className="flex-row items-center justify-between">
        <Text variant="kicker">{title}</Text>
        {id && cards && canOpen ? (
          <Pressable
            onPress={() => cards.toggle(id)}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={open ? `Show less: ${title}` : `See all: ${title}`}
            hitSlop={12}
            className="flex-row items-center gap-0.5"
          >
            <Text className="text-sm font-semibold text-brand">{open ? 'Show less' : 'See all'}</Text>
            <Icon as={open ? ChevronUp : ChevronDown} size={14} className="text-brand" />
          </Pressable>
        ) : null}
      </View>
      <View className="gap-3 rounded-xl border border-border bg-card p-4">{children}</View>
    </View>
  );
}

/** A small heading inside a card that's open in full. */
const Sub = ({ children }: { children: string }) => <Text className="pt-1 text-sm font-semibold text-muted-foreground">{children}</Text>;

/** Volume, leakage and last contact side by side. */
function Glance({ figures, onPress }: { figures: Figure[]; onPress: (i: number) => void }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {figures.map((f, i) => (
        <Pressable
          key={f.label}
          onPress={() => onPress(i)}
          accessibilityRole="button"
          accessibilityLabel={[f.label, f.value, f.sub].filter(Boolean).join(', ')}
          className="min-w-[100px] flex-1 gap-0.5 rounded-xl border border-border bg-card p-3 active:bg-accent"
        >
          <Text className="text-xs text-muted-foreground" numberOfLines={2}>
            {f.label}
          </Text>
          <Text className={cn('font-serif text-2xl leading-8', f.value.length > 7 && 'text-lg leading-6', f.tone === 'rose' && 'text-signal-text')}>{f.value}</Text>
          {f.delta != null ? <Delta value={f.delta} /> : f.sub ? <Text className="text-xs text-muted-foreground" numberOfLines={2}>{f.sub}</Text> : null}
        </Pressable>
      ))}
    </View>
  );
}

/** A row that opens someone's page. */
function PersonRow({ entity, sub, figure }: { entity: Entity; sub: string; figure?: string }) {
  const profileHref = useProfileHref();
  return (
    <Pressable onPress={() => router.push(profileHref(entity))} accessibilityRole="link" className="flex-row items-center gap-3 rounded-md active:bg-accent">
      <Avatar entity={entity} />
      <View className="flex-1 gap-0.5">
        <Text className="font-semibold">{shortName(entity)}</Text>
        <Text className="text-sm text-muted-foreground">{sub}</Text>
      </View>
      {figure ? <Text className="font-mono text-sm">{figure}</Text> : null}
      <Icon as={ChevronRight} size={16} className="text-muted-foreground" />
    </Pressable>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-0.5">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      {typeof children === 'string' ? (
        <Text className="text-base" selectable>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

/** Everything under the buttons on a person's or account's page. `onBook` books a time with them. */
export function TargetInfo({ entity, brief, cards, onBook }: { entity: Entity; brief: Brief; cards: Cards; onBook: () => void }) {
  const ctx = useWorkspace();
  const byCount = (rows: { name: string; series: number[] }[]) =>
    rows.map((r) => ({ name: r.name, count: sum(r.series.slice(-4)), growth: yoy(r.series) })).sort((a, b) => b.count - a.count);
  const procedures = byCount((proceduresOf(entity) ?? []).map((r) => ({ name: r.family, series: r.series })));
  const tests = byCount(testsOf(entity).map((r) => ({ name: r.family, series: r.series })));
  // Someone without the procedures in this sample still has their tests, or their diagnoses.
  const top = procedures.length ? procedures : tests.length ? tests : byCount(diagnosesOf(entity));
  const maxTop = Math.max(...top.map((p) => p.count), 1);
  const volumesOpen = cards.isOpen('volumes');
  // Each figure opens the card that explains it.
  const figureCards: CardId[] = ['volumes', entity.kind === 'hcp' ? 'refer' : 'leakage', 'notes'];

  return (
    <View className="gap-5">
      <View className="gap-1.5">
        <Glance figures={brief.figures} onPress={(i) => cards.show(figureCards[i])} />
        <Text className="text-xs text-muted-foreground">{DATA_PERIOD}</Text>
      </View>

      <FollowUps brief={brief} cards={cards} />
      <LastTime entity={entity} cards={cards} />
      <VisitsSoFar entity={entity} cards={cards} />
      <AskedBefore entity={entity} />
      <HowToGetIn entity={entity} onBook={onBook} />
      {/* Who else to see while there: the day of their next visit, or the day being planned. */}
      {entity.kind === 'hcp' ? <SimilarNearby hcp={entity} day={brief.visit?.day ?? ctx.ws.selection.day} /> : null}

      {top.length ? (
        <Block
          title={procedures.length ? 'Top procedures · 12 months' : tests.length ? 'Echo and stress tests · 12 months' : 'Diagnosed patients · 12 months'}
          id="volumes"
          cards={cards}
          canOpen
        >
          {volumesOpen ? (
            <AllVolumes entity={entity} />
          ) : (
            top.slice(0, 3).map((p) => (
              <BarRow
                key={p.name}
                label={p.name}
                value={p.count}
                max={maxTop}
                display={
                  <View className="items-end">
                    <Text className="font-mono text-sm">{formatNumber(p.count)}</Text>
                    <Delta value={p.growth} suffix="" />
                  </View>
                }
              />
            ))
          )}
        </Block>
      ) : null}

      {entity.kind === 'hcp' ? <HcpBlocks hcp={entity} cards={cards} /> : <OrgBlocks org={entity} cards={cards} />}
      <Details entity={entity} cards={cards} />
    </View>
  );
}

const DUE_TONE = { late: 'text-danger', today: 'text-warn', later: 'text-muted-foreground' } as const;

/** Open follow-ups, soonest due first, how late each is, and Done. */
function FollowUps({ brief, cards }: { brief: Brief; cards: Cards }) {
  const ctx = useWorkspace();
  if (!brief.followUps.length) return null;
  const shown = cards.isOpen('followups') ? brief.followUps : brief.followUps.slice(0, 3);
  return (
    <Block title="Follow-ups" id="followups" cards={cards} canOpen={brief.followUps.length > 3}>
      {shown.map((f, i) => {
        const due = promiseDue(f, ctx.today);
        return (
          <View key={f.id} className={cn('flex-row items-center gap-3', i > 0 && 'border-t border-border pt-3')}>
            <View className="flex-1 gap-0.5">
              <Text className="text-base">{f.text}</Text>
              <Text className={cn('text-sm', DUE_TONE[due.tone], due.tone !== 'later' && 'font-semibold')}>{due.text}</Text>
            </View>
            <Button variant="outline" className="rounded-lg" onPress={() => ctx.completeFollowUp(f.id)} accessibilityLabel={`Done: ${f.text}`}>
              <Icon as={Check} size={18} />
              <Text>Done</Text>
            </Button>
          </View>
        );
      })}
    </Block>
  );
}

/** The last note, and every note on See all. */
function LastTime({ entity, cards }: { entity: Entity; cards: Cards }) {
  const ctx = useWorkspace();
  const notes = ctx.interactionsFor(entity.id);
  const last = notes[0];
  if (!last) return null;
  return (
    <Block title={cards.isOpen('notes') ? 'All notes' : 'Last time'} id="notes" cards={cards} canOpen={notes.length > 1}>
      {cards.isOpen('notes') ? (
        <View className="gap-5">
          {notes.map((i) => (
            <InteractionItem key={i.id} interaction={i} about={entity.id} />
          ))}
        </View>
      ) : (
        <View className="gap-1">
          <Text className="text-sm text-muted-foreground">{`${relativeDayLower(last.date, ctx.today).replace(/^./, (c) => c.toUpperCase())} · ${last.type} · ${last.author === 'You' ? 'you' : last.author}`}</Text>
          {last.note ? (
            <Text className="text-base leading-6" numberOfLines={3}>
              {last.note}
            </Text>
          ) : null}
          {metWith(last).length ? <Text className="text-sm text-muted-foreground">{`With ${metWith(last).join(', ')}`}</Text> : null}
        </View>
      )}
    </Block>
  );
}

/** The last few questions asked about them in Ask, each opening the conversation it was in to carry on. */
function AskedBefore({ entity }: { entity: Entity }) {
  const ctx = useWorkspace();
  const chat = useChat();
  const chatHref = useChatHref();
  const asked = askedBefore(entity.id, chat.asked(entity.id), chat.conversations(), (c) => (c.live ? chat.turns(c.key) : (chat.conversation(c.id)?.turns ?? [])), 3);
  if (!asked.length) return null;
  // An ended conversation goes back in its chat, like opening it from History.
  const open = (where: AskedWhere) => {
    const key = where.kind === 'history' ? chat.open(where.id) : where.kind === 'ask' ? TERRITORY : entity.id;
    if (key === TERRITORY) router.navigate('/ask');
    else router.push(chatHref({ id: key }));
  };
  return (
    <Block title="You asked before">
      {asked.map((a, i) => {
        const when = whenLabel(a.at, ctx.today);
        return (
          <Pressable
            key={`${a.at}-${a.question}`}
            onPress={() => open(a.where)}
            accessibilityRole="link"
            accessibilityHint="Opens that conversation to carry on"
            className={cn('flex-row items-center gap-3 rounded-md active:bg-accent', i > 0 && 'border-t border-border pt-3')}
          >
            <View className="flex-1 gap-0.5">
              <Text className="text-base font-semibold">{a.question}</Text>
              {a.answer ? (
                <Text className="text-sm text-muted-foreground" numberOfLines={2}>
                  {a.answer}
                </Text>
              ) : null}
              <Text className="text-xs text-muted-foreground">{when}</Text>
            </View>
            <Icon as={ChevronRight} size={16} className="text-muted-foreground" />
          </Pressable>
        );
      })}
    </Block>
  );
}

const OUTCOME_TONE: Record<VisitOutcome, string> = {
  met: 'text-success',
  'not-in': 'text-warn',
  cancelled: 'text-muted-foreground',
  'not-logged': 'text-signal-text',
  planned: 'text-brand',
};
const KIND: Record<string, string> = { 'In-person visit': 'Visit', 'Phone call': 'Call', 'Video call': 'Video call', Meeting: 'Meeting' };
const SHOWN_VISITS = 4;

/** Every visit and call so far with what happened, a line on how it's gone, and the time that has worked. */
function VisitsSoFar({ entity, cards }: { entity: Entity; cards: Cards }) {
  const ctx = useWorkspace();
  const visits = visitsSoFar(entity.id, ctx.ws, ctx.today);
  if (!visits.rows.length) return null;
  const dayLabel = (iso: string) => {
    const diff = daysBetween(ctx.today, fromIso(iso));
    return diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : formatDate(iso);
  };
  const rows = cards.isOpen('visits') ? visits.rows : visits.rows.slice(0, SHOWN_VISITS);
  return (
    <Block title="Visits so far" id="visits" cards={cards} canOpen={visits.rows.length > SHOWN_VISITS}>
      <View className="gap-0.5">
        <Text className="text-base font-semibold">{visits.summary}</Text>
        {visits.worked ? <Text className="text-base">{`${visits.worked} have worked.`}</Text> : null}
      </View>
      {rows.map((r, i) => (
        <View key={`${r.day}-${r.time}-${r.type}-${i}`} className="flex-row items-center gap-3 border-t border-border pt-3">
          <View className="flex-1 gap-0.5">
            <Text className="text-base">{[dayLabel(r.day), r.time].filter(Boolean).join(' · ')}</Text>
            <Text className="text-sm text-muted-foreground">{[KIND[r.type] ?? r.type, r.moved].filter(Boolean).join(' · ')}</Text>
          </View>
          <Text className={cn('text-base font-semibold', OUTCOME_TONE[r.outcome])}>{r.label}</Text>
        </View>
      ))}
    </Block>
  );
}

/** Who books, how they like to be asked, when and whether they confirm, and Book a time. Phone and email are under Contact. */
function HowToGetIn({ entity, onBook }: { entity: Entity; onBook: () => void }) {
  const way = howToGetIn(entity);
  return (
    <Block title="How to get in">
      <Fact label="Who books">{way.books}</Fact>
      {way.reach ? <Fact label="How to ask">{way.reach}</Fact> : null}
      <Fact label="When">{way.best}</Fact>
      {way.confirms ? <Fact label="Do they confirm?">{way.confirms}</Fact> : null}
      <Button size="sm" variant="outline" className="self-start rounded-lg" onPress={onBook}>
        <Text>Book a time</Text>
      </Button>
    </Block>
  );
}

/** Two or three doctors like them, close by and in that day, each with + to add to the plan. */
function SimilarNearby({ hcp, day }: { hcp: Hcp; day: string }) {
  const ctx = useWorkspace();
  const profileHref = useProfileHref();
  // People added from here stay in the list, ticked, rather than dropping out of it.
  const [added, setAdded] = useState<string[]>([]);
  const [addedFor, setAddedFor] = useState(day);
  if (addedFor !== day) {
    setAddedFor(day);
    setAdded([]);
  }
  const similar = similarNearby(hcp, ctx.ws, day, { keep: added });
  if (!similar.length) return null;
  const dayWord = ctx.dayWord(day);
  const when = dayWord === 'today' || dayWord === 'tomorrow' ? dayWord : `on ${dayWord}`;
  return (
    <Block title="Similar doctors nearby">
      <Text className="text-sm text-muted-foreground">{`Like ${shortName(hcp)}, and working near ${siteThatDay(hcp, ctx.ws, day).name} ${when}.`}</Text>
      {similar.map((d) => {
        const name = shortName(d.hcp);
        const where = d.km < 0.1 ? `Also at ${d.site.name}` : `${formatKm(d.km)} away, at ${d.site.name}`;
        return (
          <View key={d.hcp.id} className="flex-row items-center gap-3">
            <Pressable onPress={() => router.push(profileHref(d.hcp))} accessibilityRole="link" className="flex-1 flex-row items-center gap-3 rounded-md active:bg-accent">
              <Avatar entity={d.hcp} />
              <View className="flex-1 gap-0.5">
                <Text className="font-semibold">{name}</Text>
                <Text className="text-sm">{d.why}</Text>
                <Text className="text-sm text-muted-foreground">{`${d.hours} · ${where}`}</Text>
              </View>
            </Pressable>
            {ctx.planItemFor(d.hcp.id, day) ? (
              <View accessible accessibilityLabel={`${name} is in your plan ${when}`} className="h-11 w-11 items-center justify-center rounded-full bg-success-soft">
                <Icon as={Check} size={20} className="text-success" />
              </View>
            ) : (
              <Button
                size="icon"
                variant="outline"
                className="rounded-full"
                onPress={() => {
                  setAdded((ids) => (ids.includes(d.hcp.id) ? ids : [...ids, d.hcp.id]));
                  ctx.addToPlan(d.hcp.id, day);
                }}
                accessibilityLabel={`Add ${d.hcp.name} to ${dayWord}`}
              >
                <Icon as={Plus} size={20} />
              </Button>
            )}
          </View>
        );
      })}
    </Block>
  );
}

const SHOWN_REFERRALS = 4;

/** Who they send patients to; on See all, who sends patients to them and who they work closely with. */
function HcpBlocks({ hcp, cards }: { hcp: Hcp; cards: Cards }) {
  const profileHref = useProfileHref();
  const refer = whoTheyReferTo(hcp);
  const open = cards.isOpen('refer');
  const out = (open ? refer?.rows : refer?.rows.slice(0, SHOWN_REFERRALS)) ?? [];
  const maxOut = Math.max(...out.map((r) => r.count), 1);
  const inbound = [...hcp.referrals.inbound].sort((a, b) => b.count - a.count);
  const more = (refer?.rows.length ?? 0) > SHOWN_REFERRALS || inbound.length > 0 || hcp.relationships.length > 0;

  return (
    <>
      {refer || more ? (
        <Block title="Who they refer to" id="refer" cards={cards} canOpen={more}>
          {refer ? <Text className="text-base">{refer.summary}</Text> : <Text className="text-base">They don’t refer patients on.</Text>}
          {out.map((r, i) => {
            const peer = r.entity;
            const row = (
              <BarRow
                label={
                  <Text className={cn('text-base', r.outside && 'font-semibold text-signal-text')}>
                    {r.name}
                    {r.outside ? ' · outside the system' : ''}
                  </Text>
                }
                sub={r.reason}
                value={r.count}
                max={maxOut}
                tone={r.outside ? 'rose' : 'accent'}
                display={
                  <View className="flex-row items-center gap-1">
                    <Text className="font-mono text-sm">{formatNumber(r.count)}</Text>
                    {peer ? <Icon as={ChevronRight} size={16} className="text-muted-foreground" /> : null}
                  </View>
                }
              />
            );
            return peer ? (
              <Pressable key={`${r.name}-${i}`} onPress={() => router.push(profileHref(peer))} accessibilityRole="link" className="rounded-md active:bg-accent">
                {row}
              </Pressable>
            ) : (
              <View key={`${r.name}-${i}`}>{row}</View>
            );
          })}
          {open && inbound.length ? (
            <>
              <Sub>Who sends patients to them</Sub>
              {inbound.map((x, i) => {
                const peer = x.hcpId ? getEntity(x.hcpId) : null;
                return peer ? (
                  <PersonRow key={peer.id} entity={peer} sub={x.reason ?? (peer.kind === 'hcp' ? peer.specialty : peer.typeDetail)} figure={formatNumber(x.count)} />
                ) : (
                  <View key={`${x.label}-${i}`} className="flex-row items-center justify-between gap-3">
                    <Text className="flex-1 text-base">{x.label ?? 'Others'}</Text>
                    <Text className="font-mono text-sm">{formatNumber(x.count)}</Text>
                  </View>
                );
              })}
            </>
          ) : null}
          {open && hcp.relationships.length ? (
            <>
              <Sub>Works closely with</Sub>
              {hcp.relationships.map((rel) => {
                const peer = getEntity(rel.hcpId);
                return peer ? <PersonRow key={rel.hcpId} entity={peer} sub={`${rel.type} · ${rel.detail}`} /> : null;
              })}
            </>
          ) : null}
        </Block>
      ) : null}

      <Block title="Works at">
        {hcp.affiliations.map((a) => {
          const org = getOrg(a.orgId);
          return org ? <PersonRow key={a.orgId} entity={org} sub={`${a.role} · ${a.days}`} figure={`${a.share}%`} /> : null;
        })}
      </Block>
    </>
  );
}

function OrgBlocks({ org, cards }: { org: Org; cards: Cards }) {
  const l = org.leakage;
  const leakOpen = cards.isOpen('leakage');
  const allDoctors = hcpsAt(org.id);
  const doctors = cards.isOpen('doctors') ? allDoctors : allDoctors.slice(0, 3);
  // The decision makers and gatekeepers here and at the sites below it.
  const allExecs = [org, ...descendantsOf(org.id)].flatMap((o) => o.executives);
  const execs = cards.isOpen('people') ? allExecs : allExecs.slice(0, 3);
  const destinations = (l?.destinations ?? []).slice(0, leakOpen ? undefined : 3);
  const maxDest = Math.max(...destinations.map((d) => d.patients), 1);
  // The doctors here whose referrals go outside the system: who to talk to about keeping patients.
  const sendersOut = topReferrersOut(org.id).slice(0, 3);
  const parent = parentOf(org);
  const allSites = childrenOf(org.id);
  const sites = cards.isOpen('system') ? allSites : allSites.slice(0, 3);

  return (
    <>
      {l ? (
        <Block title="Where patients go" id="leakage" cards={cards} canOpen={l.destinations.length > 3 || l.byFamily.length > 0}>
          <StackBar
            parts={[
              ...(l.keptPct ? [{ label: org.type === 'Health system' ? 'Kept' : 'Kept here', pct: l.keptPct, className: 'bg-primary' }] : []),
              { label: 'Same system', pct: l.inSystemPct, className: 'bg-brand-line' },
              { label: 'Left', pct: l.leftPct, className: 'bg-signal' },
            ]}
            label={`Kept ${l.keptPct}%, moved within the system ${l.inSystemPct}%, left ${l.leftPct}%`}
          />
          {destinations.map((d, i) => {
            const inSystem = d.orgId ? getOrg(d.orgId) : null;
            const name = inSystem?.name ?? (d.ref ? destination(d.ref).name : 'Elsewhere');
            return (
              <BarRow
                key={`${name}-${i}`}
                label={<Text className={cn('text-base', !inSystem && 'font-semibold text-signal-text')}>{name}</Text>}
                sub={inSystem ? 'Same health system' : 'Outside the system'}
                value={d.patients}
                max={maxDest}
                tone={inSystem ? 'success' : 'rose'}
                display={
                  <View className="items-end">
                    <Text className="font-mono text-sm">{formatNumber(d.patients)}</Text>
                    {leakOpen && d.trend ? <Delta value={d.trend} suffix="" upIsBad /> : null}
                  </View>
                }
              />
            );
          })}
          {leakOpen && l.byFamily.length ? (
            <>
              <Sub>Leaving, by procedure</Sub>
              {l.byFamily.map((f) => (
                <BarRow key={f.family} label={f.family} value={f.leftPct} display={<Text className="font-mono text-sm">{f.leftPct}%</Text>} max={50} tone="rose" />
              ))}
              <FinePrint>{`${l.scope}. Illustrative figures; places outside the system are fictional names.`}</FinePrint>
            </>
          ) : null}
        </Block>
      ) : null}

      {sendersOut.length ? (
        <Block title="Who sends patients out">
          {sendersOut.map(({ hcp, count, mostTo }) => (
            <PersonRow key={hcp.id} entity={hcp} sub={`Mostly to ${mostTo}`} figure={formatNumber(count)} />
          ))}
          <Text className="text-xs text-muted-foreground">Patients each doctor sent outside the system, from all the places they work.</Text>
        </Block>
      ) : null}

      {doctors.length ? (
        <Block title="Busiest doctors here" id="doctors" cards={cards} canOpen={allDoctors.length > 3}>
          {doctors.map((h) => (
            <PersonRow key={h.id} entity={h} sub={h.specialty} figure={procedureTotal(h) ? formatNumber(procedureTotal(h)) : undefined} />
          ))}
          {/* Targets has them all, ranked by the procedures picked there, with phone, email and + Add. */}
          <Pressable
            onPress={() => router.navigate({ pathname: '/targets', params: { org: org.id, from: String(Date.now()) } })}
            accessibilityRole="link"
            hitSlop={8}
            className="flex-row items-center gap-0.5 self-start active:opacity-70"
          >
            <Text className="text-sm font-semibold text-brand">{allDoctors.length > 1 ? `All ${allDoctors.length} in Targets` : 'Open in Targets'}</Text>
            <Icon as={ChevronRight} size={14} className="text-brand" />
          </Pressable>
        </Block>
      ) : null}

      {execs.length ? (
        <Block title="People to meet" id="people" cards={cards} canOpen={allExecs.length > 3}>
          {execs.map((e) => (
            <View key={e.id} className="flex-row items-center gap-3">
              <Avatar entity={{ name: e.name }} />
              <View className="flex-1 gap-0.5">
                <Text className="font-semibold">{e.name}</Text>
                <Text className="text-sm text-muted-foreground">{`${e.role} · ${e.title}`}</Text>
                {cards.isOpen('people') ? (
                  <Text className="text-sm" selectable>
                    {e.email}
                  </Text>
                ) : null}
              </View>
              <Button size="icon" variant="outline" className="rounded-full" onPress={() => void Linking.openURL(telUrl(e.phone))} accessibilityLabel={`Call ${e.name}, ${e.phone}`}>
                <Icon as={Phone} size={18} />
              </Button>
            </View>
          ))}
        </Block>
      ) : null}

      {parent || allSites.length ? (
        <Block title="Health system" id="system" cards={cards} canOpen={allSites.length > 3}>
          {parent ? <PersonRow entity={parent} sub="Part of" /> : null}
          {sites.map((c) => (
            <PersonRow key={c.id} entity={c} sub={`${c.typeDetail} · ${c.address}`} />
          ))}
        </Block>
      ) : null}
    </>
  );
}

/** Phone, email and the rest of the record, closed until asked for. */
function Details({ entity, cards }: { entity: Entity; cards: Cards }) {
  const open = cards.isOpen('details');
  const phone = entity.kind === 'hcp' ? entity.contact.phone : entity.phone;
  return (
    <Block title="Contact and details" id="details" cards={cards} canOpen>
      <Fact label="Phone">{phone}</Fact>
      {entity.kind === 'hcp' ? (
        <>
          <Fact label="Email">{entity.contact.email}</Fact>
          {open ? (
            <>
              <Fact label="NPI">
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className="font-mono" selectable>
                    {entity.npi}
                  </Text>
                  <Tag label="Sample" />
                </View>
              </Fact>
              <Fact label="Board certification">{entity.boards.join(', ')}</Fact>
              <Fact label="In practice">{`${entity.yearsInPractice} years`}</Fact>
              <Fact label="Languages">{entity.languages.join(', ')}</Fact>
              {entity.education.map(([label, value]) => (
                <Fact key={label} label={label}>
                  {value}
                </Fact>
              ))}
            </>
          ) : null}
        </>
      ) : (
        <>
          <Fact label="Address">{`${entity.address}, ${entity.city}${entity.onMap ? '' : ' (headquarters)'}`}</Fact>
          {open ? (
            <>
              <Fact label="Type">{`${entity.type} · ${entity.typeDetail}`}</Fact>
              <Fact label="Ownership">{entity.ownership}</Fact>
              {entity.type === 'Health system' ? (
                <Fact label="Facilities">{`${descendantsOf(entity.id).length} in this territory`}</Fact>
              ) : (
                <Fact label="Beds">{entity.beds ? `${formatNumber(entity.beds)} (sample figure)` : 'None · outpatient site'}</Fact>
              )}
            </>
          ) : null}
        </>
      )}
    </Block>
  );
}
