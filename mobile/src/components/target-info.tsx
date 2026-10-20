// What a person's or account's page shows under its two big buttons: the
// headline figures, what to talk about, last time, their volumes, where patients
// go (and, at an account, who sends them out), who they work with and how to reach them. Short cards, each one tap from
// the full detail ("All" opens that part of the profile).

import { router } from 'expo-router';
import { ChevronRight, Phone } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { metWith } from '@/components/activity-log';
import { BarRow, Delta, StackBar } from '@/components/charts';
import { Avatar, useProfileHref } from '@/components/entity';
import { telUrl } from '@/components/quick-actions';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { Brief, Figure } from '@/lib/brief';
import { descendantsOf, destination, getEntity, getOrg, hcpsAt, proceduresOf, procedureTotal, shortName, topReferrersOut } from '@/lib/data';
import { DATA_PERIOD } from '@/lib/data/seed';
import { daysBetween, formatNumber, fromIso, plural, relativeDayLower, sum, yoy } from '@/lib/format';
import { useWorkspace } from '@/lib/store';
import type { Entity, Hcp, Org } from '@/lib/types';
import { cn } from '@/lib/utils';

/** A titled card. `more` opens the profile at that section. */
function Block({ title, more, children }: { title: string; more?: () => void; children: ReactNode }) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text variant="kicker">{title}</Text>
        {more ? (
          <Pressable onPress={more} accessibilityRole="link" accessibilityLabel={`All of ${title.toLowerCase()}`} hitSlop={8} className="flex-row items-center">
            <Text className="text-sm font-semibold text-brand">All</Text>
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
  // Last time already shows the last note and open follow-ups, so they aren't talking points too.
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

      {last || brief.followUps.length ? (
        <Block title="Last time" more={details('activity')}>
          {last ? (
            <View className="gap-1">
              <Text className="text-sm text-muted-foreground">{`${relativeDayLower(last.date, ctx.today).replace(/^./, (c) => c.toUpperCase())} · ${last.type} · ${last.author === 'You' ? 'you' : last.author}${last.local ? ' · on this phone, not sent yet' : ''}`}</Text>
              {last.note ? (
                <Text className="text-base leading-6" numberOfLines={3}>
                  {last.note}
                </Text>
              ) : null}
              {metWith(last).length ? <Text className="text-sm text-muted-foreground">{`With ${metWith(last).join(', ')}`}</Text> : null}
            </View>
          ) : null}
          {brief.followUps.slice(0, 3).map((f) => {
            const late = daysBetween(fromIso(f.due), ctx.today);
            return (
              <View key={f.id} className="flex-row items-start gap-2 border-t border-border pt-3">
                <Text className="flex-1 text-base">{f.text}</Text>
                <Text className={cn('text-sm', late > 0 ? 'text-danger' : late === 0 ? 'text-warn' : 'text-muted-foreground')}>
                  {late > 0 ? `${plural(late, 'day')} late` : `Due ${relativeDayLower(f.due, ctx.today)}`}
                </Text>
              </View>
            );
          })}
        </Block>
      ) : null}

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

function HcpBlocks({ hcp, more }: { hcp: Hcp; more: (section: string) => () => void }) {
  const out = [...hcp.referrals.outbound].sort((a, b) => b.count - a.count).slice(0, 4);
  const maxOut = Math.max(...out.map((r) => r.count), 1);
  const reach = [hcp.contact.preferred && ['Best time', hcp.contact.preferred], hcp.contact.assistant && ['Book through', hcp.contact.assistant]].filter(
    (v): v is [string, string] => !!v,
  );

  return (
    <>
      {out.length ? (
        <Block title="Where they send patients" more={more('network')}>
          {out.map((r, i) => {
            const peer = r.hcpId ? getEntity(r.hcpId) : null;
            const leaves = !!r.ref;
            const name = r.ref ? destination(r.ref).name : peer ? shortName(peer) : (r.label ?? 'Elsewhere');
            return (
              <BarRow
                key={`${name}-${i}`}
                label={
                  <Text className={cn('text-base', leaves && 'font-semibold text-signal-text')}>
                    {name}
                    {leaves ? ' · outside the system' : ''}
                  </Text>
                }
                sub={r.reason}
                value={r.count}
                max={maxOut}
                tone={leaves ? 'orange' : 'accent'}
              />
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

      <Block title="Reach them">
        {reach.map(([label, value]) => (
          <Fact key={label} label={label}>
            {value}
          </Fact>
        ))}
        <Fact label="Email">
          <Text className="text-base" selectable>
            {hcp.contact.email}
          </Text>
        </Fact>
        <CallButton phone={hcp.contact.phone} who={hcp.name} />
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

      <Block title="Reach them">
        <Fact label="Address">{`${org.address}, ${org.city}`}</Fact>
        <CallButton phone={org.phone} who={`${org.name} main line`} />
      </Block>
    </>
  );
}
