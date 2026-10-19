// HCO profile: the account, where patients go, its place in the system, its
// people and what you've done there. Ported from demo/js/screens/hco.js.
// The Overview is the brief and two figures; the detail sits behind the other tabs.

import { Stack, useLocalSearchParams } from 'expo-router';
import { Building2, NotebookPen, User, Users } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { BarRow, Delta, StackBar } from '@/components/charts';
import { Avatar, EntityRow, SignalTag, Tag } from '@/components/entity';
import { useNoteSheets } from '@/components/note-sheet';
import {
  BriefCard,
  ComingLater,
  Detail,
  Disclosure,
  EmptyState,
  FinePrint,
  Kpis,
  NotFound,
  ProfileActions,
  ProfileHeader,
  ProfileLink,
  ProfileTabs,
  SampleNote,
  useProfileTab,
  Unavailable,
} from '@/components/profile';
import { ActivityPanel, VolumesPanel, type VolumeMode } from '@/components/profile-panels';
import { Screen, Section } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { TabsContent } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { useVisitSheets } from '@/components/visit-sheets';
import { buildBrief } from '@/lib/brief';
import { childrenOf, descendantsOf, destination, getOrg, hcpsAt, parentOf, primaryAffiliation, procedureTotal, systemOf } from '@/lib/data';
import { formatNumber, plural } from '@/lib/format';
import { useWorkspace } from '@/lib/store';
import type { Org } from '@/lib/types';
import { cn } from '@/lib/utils';

type Tab = 'overview' | 'volumes' | 'network' | 'activity';
const TABS: Tab[] = ['overview', 'volumes', 'network', 'activity'];

/** The tab a link from Ask asks for; an account's leakage is a view of its volumes. */
const tabFor = (section?: string): Tab => (section === 'leakage' ? 'volumes' : (TABS.find((t) => t === section) ?? 'overview'));

export default function HcoProfile() {
  const { id, section } = useLocalSearchParams<{ id: string; section?: string }>();
  const org = getOrg(id);
  return org ? <Profile org={org} section={section} /> : <NotFound />;
}

function Profile({ org, section }: { org: Org; section?: string }) {
  const ctx = useWorkspace();
  const { tab, setTab, showTab, scrollRef, onTabsLayout } = useProfileTab<Tab>(tabFor(section));
  const [volumeMode, setVolumeMode] = useState<VolumeMode>(section === 'leakage' && org.leakage ? 'leakage' : 'procedures');
  // After saving, show the Activity tab so the new note or follow-up is in view.
  const { openNote, openFollowUp, sheets } = useNoteSheets(org, () => showTab('activity'));
  const visits = useVisitSheets();
  const showVolumes = (mode: VolumeMode) => {
    setVolumeMode(mode);
    showTab('volumes');
  };

  return (
    <Screen scrollRef={scrollRef}>
      <Stack.Screen options={{ title: org.name }} />

      <ProfileHeader
        entity={org}
        kicker={`HCO · ${org.typeDetail}`}
        title={org.name}
        sub={`${org.address}, ${org.city}`}
        tags={
          <>
            <Tag label={org.assigned ? 'Assigned account' : 'Not assigned'} tone={org.assigned ? 'accent' : 'neutral'} />
            {ctx
              .signals(org)
              .slice(0, 3)
              .map((s) => (
                <SignalTag key={s.id} signal={s} />
              ))}
          </>
        }
      />
      <ProfileActions onAddNote={() => openNote()} onNewFollowUp={openFollowUp} onBook={() => visits.openBook(org)} />

      <ProfileTabs
        label="Account sections"
        value={tab}
        onChange={setTab}
        onLayout={onTabsLayout}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'volumes', label: 'Volumes' },
          { id: 'network', label: 'Network' },
          { id: 'activity', label: 'Activity', count: ctx.interactionsFor(org.id).length },
        ]}
      >
        <TabsContent value="overview" className="gap-5">
          <Overview org={org} onShowVolumes={showVolumes} onShowFollowUps={() => showTab('activity')} />
        </TabsContent>
        <TabsContent value="volumes" className="gap-5">
          <VolumesPanel
            entity={org}
            mode={volumeMode}
            onModeChange={setVolumeMode}
            leakage={org.leakage ? <Leakage org={org} /> : <Unavailable title="Leakage not reported for this site" body={org.leakageUnavailable} />}
          />
        </TabsContent>
        <TabsContent value="network" className="gap-5">
          <Network org={org} onLogMeeting={openNote} />
        </TabsContent>
        <TabsContent value="activity" className="gap-5">
          <ActivityPanel entity={org} onAddNote={() => openNote()} onNewFollowUp={openFollowUp} />
        </TabsContent>
      </ProfileTabs>

      {sheets}
      {visits.sheets}
    </Screen>
  );
}

/** What the account is, why see them now and what to bring up; everything else is a tab away. */
function Overview({ org, onShowVolumes, onShowFollowUps }: { org: Org; onShowVolumes: (mode: VolumeMode) => void; onShowFollowUps: () => void }) {
  const ctx = useWorkspace();
  const brief = buildBrief(org, ctx);
  // Last contact, the third figure, is already under the name.
  const [volume, leaving] = brief.figures;
  const facilities = descendantsOf(org.id);

  return (
    <>
      <BriefCard entity={org} brief={brief} onShowFollowUps={onShowFollowUps} />
      <Kpis
        items={[
          { ...volume, onPress: () => onShowVolumes('procedures'), hint: 'Opens procedure volumes' },
          { ...leaving, onPress: () => onShowVolumes('leakage'), hint: 'Opens where patients go' },
        ]}
      />

      <Section title="Contact">
        <Detail label="Phone" value={org.phone} />
        <Detail label="Address" value={`${org.address}, ${org.city}`} />
        {org.onMap ? null : <FinePrint>This is the headquarters address.</FinePrint>}
      </Section>

      <Disclosure title="About the account" sub="Type, ownership and size">
        <Detail label="Type" value={`${org.type} · ${org.typeDetail}`} />
        <Detail label="Ownership" value={org.ownership} />
        {org.type === 'Health system' ? (
          <Detail label="Facilities" value={`${facilities.length} in this territory`} />
        ) : (
          <Detail label="Beds" value={org.beds ? `${formatNumber(org.beds)} (sample figure)` : 'None · outpatient site'} />
        )}
      </Disclosure>

      <ComingLater title="More on the web platform" items={['Map of this facility', 'Leakage report (PDF)']} />
      <SampleNote />
    </>
  );
}

function Leakage({ org }: { org: Org }) {
  const l = org.leakage;
  if (!l) return null;
  const max = Math.max(...l.destinations.map((d) => d.patients));
  const kept = org.type === 'Health system' ? 'Kept in system' : l.keptPct ? 'Kept here' : null;
  const parts = [
    ...(kept ? [{ label: kept, pct: l.keptPct, className: 'bg-primary' }] : []),
    { label: 'Moved within system', pct: l.inSystemPct, className: 'bg-brand-line' },
    { label: 'Left the system', pct: l.leftPct, className: 'bg-signal' },
  ];

  return (
    <>
      <Section title="Leakage summary" sub={`${l.scope} · last 12 months · sample`}>
        <Text>
          <Text className="font-serif text-num">{formatNumber(l.patients)}</Text>
          <Text className="text-muted-foreground"> patients</Text>
        </Text>
        {/* The leakage insight leads the brief on the Overview. */}
        <StackBar parts={parts} label={parts.filter((p) => p.pct).map((p) => `${p.label} ${p.pct}%`).join(', ')} />
      </Section>

      <Section title="Top destinations" sub="Where patients went, and the change on last year">
        {l.destinations.map((d) => {
          const inSystem = d.orgId ? getOrg(d.orgId) : null;
          const name = inSystem?.name ?? (d.ref ? destination(d.ref)?.name : null) ?? 'Elsewhere';
          const row = (
            <BarRow
              label={
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className={cn(inSystem && 'font-semibold text-primary')}>{name}</Text>
                  <Tag label={inSystem ? 'In system' : 'Out of system'} tone={inSystem ? 'success' : 'orange'} />
                </View>
              }
              value={d.patients}
              display={
                <View className="items-end">
                  <Text className="font-mono text-sm">{formatNumber(d.patients)}</Text>
                  {d.trend ? <Delta value={d.trend} suffix="" upIsBad /> : null}
                </View>
              }
              max={max}
              tone={inSystem ? 'success' : 'orange'}
            />
          );
          return inSystem ? (
            <ProfileLink key={inSystem.id} entity={inSystem}>
              {row}
            </ProfileLink>
          ) : (
            <View key={d.ref ?? name}>{row}</View>
          );
        })}
      </Section>

      <Section title="Leaving, by procedure" sub="Share of patients who left the system">
        {l.byFamily.map((f) => (
          <BarRow key={f.family} label={f.family} value={f.leftPct} display={<Text className="font-mono text-sm">{f.leftPct}%</Text>} max={50} tone="orange" />
        ))}
        <FinePrint>Illustrative figures. Out-of-system destinations are fictional names.</FinePrint>
      </Section>
    </>
  );
}

function Network({ org, onLogMeeting }: { org: Org; onLogMeeting: (contact: string, target: Org) => void }) {
  const ctx = useWorkspace();
  const parent = parentOf(org);
  const children = childrenOf(org.id);
  const system = systemOf(org);
  const hcps = hcpsAt(org.id);
  const execs = [org, ...descendantsOf(org.id)].flatMap((o) => o.executives.map((e) => ({ ...e, org: o })));

  return (
    <>
      <Section title="Parent health system">
        {parent ? <EntityRow entity={parent} detail={`${parent.typeDetail} · ${parent.city}`} /> : <Text className="text-muted-foreground">{org.name} is the top-level system.</Text>}
      </Section>

      <Section title="Child facilities" sub={children.length ? `${children.length} directly under ${org.name}` : undefined}>
        {children.length ? (
          children.map((c) => <EntityRow key={c.id} entity={c} detail={`${c.typeDetail} · ${c.address} · ${plural(hcpsAt(c.id).length, 'HCP')}`} />)
        ) : (
          <EmptyState icon={Building2} title="No child facilities" body={`${org.name} has no facilities registered under it.`} />
        )}
      </Section>

      <Section title="Whole system" sub="Public facility records · tap any facility">
        <SystemTree node={system} current={org.id} depth={0} />
        <View className="flex-row flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
          <Text className="text-muted-foreground">Map of the system’s facilities</Text>
          <Tag label="Coming later" />
        </View>
      </Section>

      <Section title="Key HCPs" sub="Busiest first">
        {hcps.length ? (
          hcps.map((h) => {
            const aff = h.affiliations.find((a) => a.orgId === org.id) ?? primaryAffiliation(h);
            const total = procedureTotal(h);
            return (
              <EntityRow
                key={h.id}
                entity={h}
                signals={ctx.signals(h).slice(0, 2)}
                detail={`${h.specialty} · ${aff.role}`}
                trailing={
                  <View className="items-end">
                    <Text className="font-mono text-sm">{total ? formatNumber(total) : '—'}</Text>
                    <Text className="text-2xs text-muted-foreground">{total ? 'procedures' : 'Referrer'}</Text>
                  </View>
                }
              />
            );
          })
        ) : (
          <EmptyState icon={Users} title="No HCPs in your book here" body="Nobody in your assigned book practices at this facility." />
        )}
      </Section>

      <Section title="Executives & decision makers" sub="Sample contacts">
        {execs.length ? (
          execs.map((e) => (
            <View key={`${e.org.id}-${e.id}`} className="gap-2 border-t border-border pt-3">
              <View className="flex-row items-start gap-3">
                <Avatar entity={{ name: e.name }} />
                <View className="flex-1 gap-0.5">
                  <Text className="font-semibold">{e.name}</Text>
                  <Text className="text-sm text-muted-foreground">
                    {e.title}
                    {e.org.id !== org.id ? ` · ${e.org.name}` : ''}
                  </Text>
                  <Tag label={e.role} tone={e.role === 'Economic buyer' || e.role === 'Decision maker' ? 'accent' : 'neutral'} />
                </View>
              </View>
              <View className="gap-0.5 pl-[52px]">
                <Text className="font-mono text-sm" selectable>
                  {e.phone}
                </Text>
                <Text className="text-sm" selectable>
                  {e.email}
                </Text>
              </View>
              <Button size="sm" variant="outline" className="ml-[52px] self-start" onPress={() => onLogMeeting(e.name, e.org)}>
                <Icon as={NotebookPen} size={16} />
                <Text>Log meeting</Text>
              </Button>
            </View>
          ))
        ) : (
          <EmptyState icon={User} title="No executives recorded" body="Add one from the web platform; the app will show them here." />
        )}
      </Section>
    </>
  );
}

/** The system's facilities as an indented tree, with this one marked. */
function SystemTree({ node, current, depth }: { node: Org; current: string; depth: number }) {
  const here = node.id === current;
  const kids = childrenOf(node.id);
  const body = (
    <View className={cn('flex-row items-center gap-2 rounded-md px-2 py-1.5', here && 'bg-brand-soft')} style={{ marginLeft: depth * 16 }}>
      <View className="flex-1 gap-0.5">
        <Text className={cn('font-semibold', !here && 'text-primary')}>{node.name}</Text>
        <Text className="text-sm text-muted-foreground">{node.typeDetail}</Text>
      </View>
      {here ? <Tag label="You are here" tone="accent" /> : null}
    </View>
  );
  return (
    <View className="gap-1">
      {here ? (
        <View className="min-h-11 justify-center" accessibilityState={{ selected: true }}>
          {body}
        </View>
      ) : (
        <ProfileLink entity={node}>{body}</ProfileLink>
      )}
      {kids.map((k) => (
        <SystemTree key={k.id} node={k} current={current} depth={depth + 1} />
      ))}
    </View>
  );
}
