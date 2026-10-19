// HCP profile: who they are, where they practise and what they do. Shared by
// every tab (see src/app/*/hcp), so Back returns to wherever the rep came from.

import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Avatar, SignalTag, useProfileHref } from '@/components/entity';
import { Fact, NotFound } from '@/components/profile';
import { PlaceholderNote, Screen, Section } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { getHcp, getOrg, procedureTotal, procedureYoy, proceduresOf } from '@/lib/data';
import { formatDate, formatNumber, formatPct, sum } from '@/lib/format';
import { useWorkspace } from '@/lib/store';

export default function HcpProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ctx = useWorkspace();
  const profileHref = useProfileHref();
  const hcp = getHcp(id);
  if (!hcp) return <NotFound />;

  const signals = ctx.signals(hcp);
  const last = ctx.lastInteraction(hcp.id);
  const planned = ctx.planItemFor(hcp.id, ctx.todayIso);
  const procedures = proceduresOf(hcp);
  const growth = procedureYoy(hcp);

  return (
    <Screen>
      <Stack.Screen options={{ title: hcp.name }} />

      <View className="flex-row items-center gap-3">
        <Avatar entity={hcp} />
        <View className="flex-1 gap-0.5">
          <Text variant="h2">{hcp.name}</Text>
          <Text className="text-muted-foreground">
            {hcp.credentials} · {hcp.specialty}
          </Text>
        </View>
      </View>
      {signals.length ? (
        <View className="flex-row flex-wrap gap-1">
          {signals.map((s) => (
            <SignalTag key={s.id} signal={s} />
          ))}
        </View>
      ) : null}
      <Text>{hcp.insight}</Text>

      <Section title="At a glance">
        <Fact label="Today" value={planned ? `${planned.time ?? 'Flexible'} · ${planned.type}` : 'Not planned'} />
        <Fact label="Last contact" value={last ? `${formatDate(last.date)} · ${last.type}` : 'No contact yet'} />
        <Fact label="NPI" value={hcp.npi} mono />
        <Fact label="In practice" value={`${hcp.yearsInPractice} years`} />
        <Fact label="Languages" value={hcp.languages.join(', ')} />
        <Fact label="Prefers" value={hcp.contact.preferred ?? '–'} />
      </Section>

      <Section title="Affiliations" sub="Share of their procedures at each site">
        {hcp.affiliations.map((a) => {
          const org = getOrg(a.orgId);
          return org ? (
            <Link key={a.orgId} href={profileHref(org)} className="py-1">
              <View className="flex-row items-center gap-3">
                <View className="flex-1">
                  <Text className="font-semibold text-primary">{org.name}</Text>
                  <Text className="text-sm text-muted-foreground">
                    {a.role} · {a.days}
                  </Text>
                </View>
                <Text className="font-mono text-sm">{a.share}%</Text>
              </View>
            </Link>
          ) : null;
        })}
      </Section>

      <Section
        title="Volumes"
        sub={procedures ? `${formatNumber(procedureTotal(hcp))} procedures, last 12 months${growth != null ? ` · ${formatPct(growth)}` : ''}` : undefined}
      >
        {procedures ? (
          procedures.map((p) => (
            <View key={p.code} className="flex-row items-center gap-3">
              <Text className="flex-1">{p.family}</Text>
              <Text className="font-mono text-sm">{formatNumber(sum(p.series.slice(-4)))}</Text>
            </View>
          ))
        ) : (
          <Text className="text-muted-foreground">{hcp.proceduresUnavailable ?? 'No procedure data.'}</Text>
        )}
      </Section>

      <PlaceholderNote>Scaffold: referrals, relationships, the activity log and Plan/Log actions come next.</PlaceholderNote>
    </Screen>
  );
}
