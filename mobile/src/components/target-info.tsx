// What a person's or account's page shows under its two big buttons: the
// headline figures, what to talk about, what was promised (with Done), last time,
// what was asked about them before, every visit and call so far, how to get in,
// similar doctors nearby who are in the same day, their volumes, who they refer
// to or where patients go (and, at an account, who sends them out) and who they
// work with. Short cards, each one tap from the rest ("See all"). The rules are
// in lib/target.ts.

import { router } from 'expo-router';
import { Check, ChevronRight, Phone, Plus } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { metWith } from '@/components/activity-log';
import { BarRow, Delta, StackBar } from '@/components/charts';
import { Avatar, useChatHref, useProfileHref } from '@/components/entity';
import { telUrl } from '@/components/quick-actions';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { Brief, Figure } from '@/lib/brief';
import { useChat, whenLabel } from '@/lib/chat';
import { descendantsOf, destination, getOrg, hcpsAt, proceduresOf, procedureTotal, shortName, topReferrersOut } from '@/lib/data';
import { DATA_PERIOD } from '@/lib/data/seed';
import { daysBetween, formatDate, formatKm, formatNumber, fromIso, relativeDayLower, sum, yoy } from '@/lib/format';
import { useWorkspace } from '@/lib/store';
import { askedBefore, howToGetIn, promiseDue, siteThatDay, similarNearby, visitsSoFar, whoTheyReferTo, type AskedWhere, type VisitOutcome } from '@/lib/target';
import type { Entity, Hcp, Org } from '@/lib/types';
import { cn } from '@/lib/utils';

/** A titled card. `more` opens the rest ("See all"), elsewhere or, with `expands`, in place. */
function Block({ title, more, expands, children }: { title: string; more?: () => void; expands?: boolean; children: ReactNode }) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text variant="kicker">{title}</Text>
        {more ? (
          <Pressable onPress={more} accessibilityRole={expands ? 'button' : 'link'} accessibilityLabel={`See all: ${title}`} hitSlop={12} className="flex-row items-center">
            <Text className="text-sm font-semibold text-brand">See all</Text>
            <Icon as={ChevronRight} size={14} className="text-brand" />
          </Pressable>
        ) : null}
      </View>
      <View className="gap-3 rounded-xl border border-border bg-card p-4">{children}</View>
    </View>
  );
}

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
          <Text className={cn('font-serif text-2xl leading-8', f.value.length > 7 && 'text-lg leading-6', f.tone === 'orange' && 'text-signal-text')}>{f.value}</Text>
          {f.delta != null ? <Delta value={f.delta} /> : f.sub ? <Text className="text-xs text-muted-foreground" numberOfLines={2}>{f.sub}</Text> : null}
        </Pressable>
      ))}
    </View>
  );
}

function Bullet({ children }: { children: string }) {
  return (
    <View className="flex-row items-start gap-2.5">
      <View className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
      <Text className="flex-1 text-base leading-6">{children}</Text>
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
      {typeof children === 'string' ? <Text className="text-base">{children}</Text> : children}
    </View>
  );
}

function CallButton({ phone, who }: { phone: string; who: string }) {
  return (
    <Button size="sm" variant="outline" className="self-start rounded-lg" onPress={() => void Linking.openURL(telUrl(phone))} accessibilityLabel={`Call ${who}`}>
      <Icon as={Phone} size={16} />
      <Text>{phone}</Text>
    </Button>
  );
}

/** Everything under the buttons on a person's or account's page. */
export function TargetInfo({ entity, brief }: { entity: Entity; brief: Brief }) {
  const ctx = useWorkspace();
  const profileHref = useProfileHref();
  const details = (section: string) => () => router.push(profileHref(entity, section));
  const last = ctx.lastInteraction(entity.id);
  const procedures = (proceduresOf(entity) ?? [])
    .map((r) => ({ name: r.family, count: sum(r.series.slice(-4)), growth: yoy(r.series) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  const maxProc = Math.max(...procedures.map((p) => p.count), 1);
  const leakSection = entity.kind === 'hcp' ? 'network' : 'leakage';
  // Promised and Last time already show the open follow-ups and the last note, so they aren't talking points too.
  const points = brief.points.filter((p) => !(p.kind === 'promise' && brief.followUps.length) && !(p.kind === 'lastNote' && last));

  return (
    <View className="gap-5">
      <View className="gap-1.5">
        <Glance figures={brief.figures} onPress={(i) => details(['volumes', leakSection, 'activity'][i])()} />
        <Text className="text-xs text-muted-foreground">{DATA_PERIOD}</Text>
      </View>

      {points.length ? (
        <Block title="Talk about">
          {points.map((p) => (
            <Bullet key={p.text}>{p.text}</Bullet>
          ))}
        </Block>
      ) : null}

      <Promised brief={brief} more={details('activity')} />

      {last ? (
        <Block title="Last time" more={details('activity')}>
          <View className="gap-1">
            <Text className="text-sm text-muted-foreground">{`${relativeDayLower(last.date, ctx.today).replace(/^./, (c) => c.toUpperCase())} · ${last.type} · ${last.author === 'You' ? 'you' : last.author}${last.local ? ' · on this phone, not sent yet' : ''}`}</Text>
            {last.note ? (
              <Text className="text-base leading-6" numberOfLines={3}>
                {last.note}
              </Text>
            ) : null}
            {metWith(last).length ? <Text className="text-sm text-muted-foreground">{`With ${metWith(last).join(', ')}`}</Text> : null}
          </View>
        </Block>
      ) : null}

      <AskedBefore entity={entity} />
      <VisitsSoFar entity={entity} />
      <HowToGetIn entity={entity} />
      {/* Who else to see while there: the day of their next visit, or the day being planned. */}
      {entity.kind === 'hcp' ? <SimilarNearby hcp={entity} day={brief.visit?.day ?? ctx.ws.selection.day} /> : null}

      {procedures.length ? (
        <Block title="Top procedures · 12 months" more={details('volumes')}>
          {procedures.map((p) => (
            <BarRow
              key={p.name}
              label={p.name}
              value={p.count}
              max={maxProc}
              display={
                <View className="items-end">
                  <Text className="font-mono text-sm">{formatNumber(p.count)}</Text>
                  <Delta value={p.growth} suffix="" />
                </View>
              }
            />
          ))}
        </Block>
      ) : null}

      {entity.kind === 'hcp' ? <HcpBlocks hcp={entity} more={details} /> : <OrgBlocks org={entity} more={details} />}
    </View>
  );
}

const DUE_TONE = { late: 'text-danger', today: 'text-warn', later: 'text-muted-foreground' } as const;

/** Open follow-ups, soonest due first, how late each is, and Done. */
function Promised({ brief, more }: { brief: Brief; more: () => void }) {
  const ctx = useWorkspace();
  if (!brief.followUps.length) return null;
  return (
    <Block title="Promised" more={brief.followUps.length > 3 ? more : undefined}>
      {brief.followUps.slice(0, 3).map((f, i) => {
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

/** The last few questions asked about them in Ask, each opening the conversation it was in. */
function AskedBefore({ entity }: { entity: Entity }) {
  const ctx = useWorkspace();
  const chat = useChat();
  const chatHref = useChatHref();
  const asked = askedBefore(entity.id, chat.asked(entity.id), chat.conversations(), (c) => (c.live ? chat.turns(c.key) : (chat.conversation(c.id)?.turns ?? [])), 4);
  if (!asked.length) return null;
  // An ended conversation opens as it was; today's opens where the rep can carry on.
  const open = (where: AskedWhere) => {
    if (where.kind === 'history') router.push({ pathname: '/history/[id]', params: { id: where.id } });
    else if (where.kind === 'ask') router.navigate('/ask');
    else router.push(chatHref(entity));
  };
  return (
    <Block title="You asked before" more={asked.length > 3 ? () => router.navigate('/history') : undefined}>
      {asked.slice(0, 3).map((a, i) => {
        const when = whenLabel(a.at, ctx.today);
        return (
          <Pressable
            key={`${a.at}-${a.question}`}
            onPress={() => open(a.where)}
            accessibilityRole="link"
            accessibilityHint={a.where.kind === 'history' ? 'Opens that conversation' : 'Opens it to carry on'}
            className={cn('flex-row items-center gap-3 rounded-md active:bg-accent', i > 0 && 'border-t border-border pt-3')}
          >
            <View className="flex-1 gap-0.5">
              <Text className="text-base font-semibold">{a.question}</Text>
              {a.answer ? (
                <Text className="text-sm text-muted-foreground" numberOfLines={2}>
                  {a.answer}
                </Text>
              ) : null}
              <Text className="text-xs text-muted-foreground">{a.where.kind === 'history' ? when : `${when} · carry on`}</Text>
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
function VisitsSoFar({ entity }: { entity: Entity }) {
  const ctx = useWorkspace();
  const [expanded, setExpanded] = useState(false);
  const visits = visitsSoFar(entity.id, ctx.ws, ctx.today);
  if (!visits.rows.length) return null;
  const dayLabel = (iso: string) => {
    const diff = daysBetween(ctx.today, fromIso(iso));
    return diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : formatDate(iso);
  };
  const more = visits.rows.length > SHOWN_VISITS && !expanded;
  return (
    <Block title="Visits so far" more={more ? () => setExpanded(true) : undefined} expands>
      <View className="gap-0.5">
        <Text className="text-base font-semibold">{visits.summary}</Text>
        {visits.worked ? <Text className="text-base">{`${visits.worked} have worked.`}</Text> : null}
      </View>
      {(expanded ? visits.rows : visits.rows.slice(0, SHOWN_VISITS)).map((r, i) => (
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

/** Who books, how they like to be asked, when, whether they confirm, and how to reach them. */
function HowToGetIn({ entity }: { entity: Entity }) {
  const way = howToGetIn(entity);
  return (
    <Block title="How to get in">
      <Fact label="Who books">{way.books}</Fact>
      {way.reach ? <Fact label="How to ask">{way.reach}</Fact> : null}
      <Fact label="When">{way.best}</Fact>
      {way.confirms ? <Fact label="Do they confirm?">{way.confirms}</Fact> : null}
      {entity.kind === 'hcp' ? (
        <Fact label="Email">
          <Text className="text-base" selectable>
            {entity.contact.email}
          </Text>
        </Fact>
      ) : (
        <Fact label="Address">{`${entity.address}, ${entity.city}`}</Fact>
      )}
      {entity.kind === 'hcp' ? <CallButton phone={entity.contact.phone} who={entity.name} /> : <CallButton phone={entity.phone} who={`${entity.name} main line`} />}
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

function HcpBlocks({ hcp, more }: { hcp: Hcp; more: (section: string) => () => void }) {
  const profileHref = useProfileHref();
  const refer = whoTheyReferTo(hcp);
  const out = refer?.rows.slice(0, 4) ?? [];
  const maxOut = Math.max(...out.map((r) => r.count), 1);

  return (
    <>
      {refer ? (
        <Block title="Who they refer to" more={more('network')}>
          <Text className="text-base">{refer.summary}</Text>
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
                tone={r.outside ? 'orange' : 'accent'}
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

function OrgBlocks({ org, more }: { org: Org; more: (section: string) => () => void }) {
  const l = org.leakage;
  const doctors = hcpsAt(org.id).slice(0, 3);
  // The decision makers and gatekeepers here and at the sites below it.
  const execs = [org, ...descendantsOf(org.id)].flatMap((o) => o.executives).slice(0, 3);
  const destinations = (l?.destinations ?? []).slice(0, 3);
  const maxDest = Math.max(...destinations.map((d) => d.patients), 1);
  // The doctors here whose referrals go outside the system: who to talk to about keeping patients.
  const sendersOut = topReferrersOut(org.id).slice(0, 3);

  return (
    <>
      {l ? (
        <Block title="Where patients go" more={more('leakage')}>
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
                tone={inSystem ? 'success' : 'orange'}
              />
            );
          })}
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
        <Block title="Busiest doctors here" more={more('network')}>
          {doctors.map((h) => (
            <PersonRow key={h.id} entity={h} sub={h.specialty} figure={procedureTotal(h) ? formatNumber(procedureTotal(h)) : undefined} />
          ))}
        </Block>
      ) : null}

      {execs.length ? (
        <Block title="People to meet" more={more('network')}>
          {execs.map((e) => (
            <View key={e.id} className="flex-row items-center gap-3">
              <Avatar entity={{ name: e.name }} />
              <View className="flex-1 gap-0.5">
                <Text className="font-semibold">{e.name}</Text>
                <Text className="text-sm text-muted-foreground">{`${e.role} · ${e.title}`}</Text>
              </View>
              <Button size="icon" variant="outline" className="rounded-full" onPress={() => void Linking.openURL(telUrl(e.phone))} accessibilityLabel={`Call ${e.name}, ${e.phone}`}>
                <Icon as={Phone} size={18} />
              </Button>
            </View>
          ))}
        </Block>
      ) : null}
    </>
  );
}
