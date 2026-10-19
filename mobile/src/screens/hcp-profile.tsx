// HCP profile: who they are, where they practise, what they do, who they work
// with and what you've done together. Shared by every tab (see src/app/*/hcp), so
// Back returns to wherever the rep came from. Ported from demo/js/screens/hcp.js.
// The Overview is the brief and two figures; the detail sits behind the other tabs.

import { Stack, useLocalSearchParams } from 'expo-router';
import { GitBranch, Users } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { BarRow } from '@/components/charts';
import { EntityRow, SignalTag, Tag } from '@/components/entity';
import { useNoteSheets } from '@/components/note-sheet';
import {
  BriefCard,
  ComingLater,
  Detail,
  Disclosure,
  EmptyState,
  Kpis,
  NotFound,
  ProfileActions,
  ProfileHeader,
  ProfileLink,
  ProfileTabs,
  SampleNote,
  useProfileTab,
} from '@/components/profile';
import { ActivityPanel, VolumesPanel, type VolumeMode } from '@/components/profile-panels';
import { Screen, Section } from '@/components/screen';
import { TabsContent } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { useVisitSheets } from '@/components/visit-sheets';
import { buildBrief } from '@/lib/brief';
import { destination, getHcp, getOrg, parentOf, primaryOrg } from '@/lib/data';
import { formatNumber, plural, sum } from '@/lib/format';
import { useWorkspace } from '@/lib/store';
import type { Hcp, Referral } from '@/lib/types';

type Tab = 'overview' | 'volumes' | 'network' | 'activity';

export default function HcpProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const hcp = getHcp(id);
  return hcp ? <Profile hcp={hcp} /> : <NotFound />;
}

function Profile({ hcp }: { hcp: Hcp }) {
  const ctx = useWorkspace();
  const { tab, setTab, showTab, scrollRef, onTabsLayout } = useProfileTab<Tab>('overview');
  const [volumeMode, setVolumeMode] = useState<VolumeMode>('procedures');
  // After saving, show the Activity tab so the new note or follow-up is in view.
  const { openNote, openFollowUp, sheets } = useNoteSheets(hcp, () => showTab('activity'));
  const visits = useVisitSheets();
  const org = primaryOrg(hcp);
  const showVolumes = () => {
    setVolumeMode('procedures');
    showTab('volumes');
  };

  return (
    <Screen scrollRef={scrollRef}>
      <Stack.Screen options={{ title: hcp.name }} />

      <ProfileHeader
        entity={hcp}
        kicker={`HCP · ${hcp.specialty}`}
        title={`${hcp.name}, ${hcp.credentials}`}
        sub={`${org.name} · ${org.city.replace(/ \d{5}$/, '')}`}
        tags={ctx.signals(hcp).slice(0, 4).map((s) => <SignalTag key={s.id} signal={s} />)}
      />
      <ProfileActions onAddNote={() => openNote()} onNewFollowUp={openFollowUp} onBook={() => visits.openBook(hcp)} />

      <ProfileTabs
        label="Profile sections"
        value={tab}
        onChange={setTab}
        onLayout={onTabsLayout}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'volumes', label: 'Volumes' },
          { id: 'network', label: 'Network' },
          { id: 'activity', label: 'Activity', count: ctx.interactionsFor(hcp.id).length },
        ]}
      >
        <TabsContent value="overview" className="gap-5">
          <Overview hcp={hcp} onShowVolumes={showVolumes} onShowReferrals={() => showTab('network')} onShowFollowUps={() => showTab('activity')} />
        </TabsContent>
        <TabsContent value="volumes" className="gap-5">
          <VolumesPanel entity={hcp} mode={volumeMode} onModeChange={setVolumeMode} />
        </TabsContent>
        <TabsContent value="network" className="gap-5">
          <Network hcp={hcp} />
        </TabsContent>
        <TabsContent value="activity" className="gap-5">
          <ActivityPanel entity={hcp} onAddNote={() => openNote()} onNewFollowUp={openFollowUp} />
        </TabsContent>
      </ProfileTabs>

      {sheets}
      {visits.sheets}
    </Screen>
  );
}

const referralTotals = (hcp: Hcp) => {
  const inbound = sum(hcp.referrals.inbound.map((r) => r.count));
  const outbound = sum(hcp.referrals.outbound.map((r) => r.count));
  const leaving = sum(hcp.referrals.outbound.filter((r) => r.ref).map((r) => r.count));
  return { inbound, outbound, leaving, leavingPct: outbound ? Math.round((leaving / outbound) * 100) : null };
};

/** Who they are, why see them now and what to bring up; everything else is a tab away. */
function Overview({
  hcp,
  onShowVolumes,
  onShowReferrals,
  onShowFollowUps,
}: {
  hcp: Hcp;
  onShowVolumes: () => void;
  onShowReferrals: () => void;
  onShowFollowUps: () => void;
}) {
  const ctx = useWorkspace();
  const brief = buildBrief(hcp, ctx);
  // Last contact, the third figure, is already under the name.
  const [volume, referred] = brief.figures;
  const org = primaryOrg(hcp);

  return (
    <>
      <BriefCard entity={hcp} brief={brief} onShowFollowUps={onShowFollowUps} />
      <Kpis
        items={[
          { ...volume, onPress: onShowVolumes, hint: 'Opens procedure volumes' },
          { ...referred, onPress: onShowReferrals, hint: 'Opens their referrals in Network' },
        ]}
      />

      <Section title="Contact">
        <Detail label="Phone" value={hcp.contact.phone} />
        <Detail label="Email" value={hcp.contact.email} />
        <Detail label="Primary practice">
          <ProfileLink entity={org}>
            <Text className="font-semibold text-primary">{org.name}</Text>
            <Text className="text-sm text-muted-foreground">
              {org.address}, {org.city}
            </Text>
          </ProfileLink>
        </Detail>
      </Section>

      <Disclosure title="Identity" sub="NPI, board certification, education and languages">
        <Detail label="NPI">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="font-mono" selectable>
              {hcp.npi}
            </Text>
            <Tag label="Sample" />
          </View>
        </Detail>
        <Detail label="Board certification" value={hcp.boards.join(', ')} />
        <Detail label="In practice" value={`${hcp.yearsInPractice} years`} />
        <Detail label="Languages" value={hcp.languages.join(', ')} />
        {hcp.education.map(([label, value]) => (
          <Detail key={label} label={label} value={value} />
        ))}
      </Disclosure>

      <ComingLater title="More on the web profile" items={hcp.webSections} />
      <SampleNote />
    </>
  );
}

function Network({ hcp }: { hcp: Hcp }) {
  const rows = [...hcp.affiliations].sort((a, b) => b.share - a.share);
  const first = getOrg(rows[0].orgId);
  const system = first ? parentOf(first) : null;
  const { inbound, outbound } = hcp.referrals;
  const r = referralTotals(hcp);
  const maxIn = Math.max(1, ...inbound.map((x) => x.count));
  const maxOut = Math.max(1, ...outbound.map((x) => x.count));

  return (
    <>
      <Section title="Associated HCOs" sub={`${plural(rows.length, 'practice location')} · share of their procedures at each (sample)`}>
        {rows.map((a, i) => {
          const site = getOrg(a.orgId);
          if (!site) return null;
          return (
            <View key={a.orgId} className="gap-1 border-t border-border pt-2">
              <ProfileLink entity={site}>
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className="font-semibold text-primary">{site.name}</Text>
                  {i === 0 ? <Tag label="Primary" tone="accent" /> : null}
                </View>
                <Text className="text-sm text-muted-foreground">
                  {site.typeDetail} · {site.address}, {site.city}
                </Text>
              </ProfileLink>
              <BarRow label={`${a.role} · ${a.days}`} value={a.share} display={<Text className="font-mono text-sm">{a.share}%</Text>} max={100} />
            </View>
          );
        })}
        {system ? (
          <ProfileLink entity={system}>
            <Text className="text-sm text-muted-foreground">
              Part of <Text className="text-sm font-semibold text-primary">{system.name}</Text>
            </Text>
          </ProfileLink>
        ) : null}
        <View className="flex-row flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
          <Text className="text-muted-foreground">Map of practice locations</Text>
          <Tag label="Coming later" />
        </View>
      </Section>

      <Kpis
        items={[
          { label: 'Referred in · 12 mo', value: formatNumber(r.inbound), sub: plural(inbound.length, 'source') },
          { label: 'Referred out · 12 mo', value: formatNumber(r.outbound), sub: plural(outbound.length, 'destination') },
          {
            label: 'Leaving the system',
            value: r.leavingPct != null ? `${r.leavingPct}%` : '—',
            sub: plural(r.leaving, 'patient'),
            tone: r.leaving ? 'orange' : undefined,
          },
        ]}
      />

      <Section title="Who refers to them" sub="Patients referred in, last 12 months (sample)">
        {inbound.length ? (
          inbound.map((x) => <ReferralRow key={x.hcpId ?? x.label} referral={x} max={maxIn} />)
        ) : (
          <EmptyState icon={GitBranch} title="No inbound referrals" body="Nobody in the claims sample referred patients to this HCP." />
        )}
      </Section>

      <Section title="Where they refer" sub="Patients referred out, last 12 months (sample)">
        {outbound.length ? (
          outbound.map((x) => <ReferralRow key={x.hcpId ?? x.ref ?? x.label} referral={x} max={maxOut} />)
        ) : (
          <EmptyState icon={GitBranch} title="No outbound referrals" body="They treat their own patients rather than referring them on." />
        )}
      </Section>

      <Section title="Professional relationships" sub="Co-authors, care teams and shared patients">
        {hcp.relationships.length ? (
          hcp.relationships.map((rel) => {
            const peer = getHcp(rel.hcpId);
            return peer ? (
              <EntityRow key={rel.hcpId} entity={peer} detail={`${peer.specialty} · ${rel.detail}`} tags={<Tag label={rel.type} tone="accent" />} />
            ) : null;
          })
        ) : (
          <EmptyState icon={Users} title="No relationships found" body="No co-authors, care teams or shared patients in the sample data." />
        )}
      </Section>
    </>
  );
}

/** A referral source or destination: a colleague you can open, a place outside the system, or a group. */
function ReferralRow({ referral: x, max }: { referral: Referral; max: number }) {
  const peer = x.hcpId ? getHcp(x.hcpId) : null;
  const outside = x.ref ? destination(x.ref) : null;
  const row = (label: ReactNode) => <BarRow label={label} sub={x.reason} value={x.count} max={max} tone={outside ? 'orange' : 'accent'} />;

  if (peer) {
    return <ProfileLink entity={peer}>{row(<Text className="font-semibold text-primary">{peer.name}</Text>)}</ProfileLink>;
  }
  if (outside) {
    return row(
      <View className="flex-row flex-wrap items-center gap-2">
        <Text>{outside.name}</Text>
        <Tag label="Out of system" tone="orange" />
      </View>,
    );
  }
  return row(x.label ?? 'Other');
}
