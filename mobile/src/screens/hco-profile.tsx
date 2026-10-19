// HCO profile: the account, its place in the system, its people and where patients go.

import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';

import { EntityRow, SignalTag, useProfileHref } from '@/components/entity';
import { Fact, NotFound } from '@/components/profile';
import { PlaceholderNote, Screen, Section } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { childrenOf, getOrg, hcpsAt, parentOf, procedureTotal, procedureYoy } from '@/lib/data';
import { formatNumber, formatPct } from '@/lib/format';
import { useWorkspace } from '@/lib/store';

export default function HcoProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ctx = useWorkspace();
  const profileHref = useProfileHref();
  const org = getOrg(id);
  if (!org) return <NotFound />;

  const signals = ctx.signals(org);
  const parent = parentOf(org);
  const facilities = childrenOf(org.id);
  const people = hcpsAt(org.id).slice(0, 5);
  const growth = procedureYoy(org);

  return (
    <Screen>
      <Stack.Screen options={{ title: org.name }} />

      <View className="gap-0.5">
        <Text variant="kicker">{org.type}</Text>
        <Text variant="h2">{org.name}</Text>
        <Text className="text-muted-foreground">{org.typeDetail}</Text>
      </View>
      {signals.length ? (
        <View className="flex-row flex-wrap gap-1">
          {signals.map((s) => (
            <SignalTag key={s.id} signal={s} />
          ))}
        </View>
      ) : null}

      <Section title="At a glance">
        <Fact label="Address" value={`${org.address}, ${org.city}`} />
        <Fact label="Phone" value={org.phone} mono />
        <Fact label="Ownership" value={org.ownership} />
        {org.beds != null ? <Fact label="Beds" value={formatNumber(org.beds)} /> : null}
        <Fact label="Procedures, 12 months" value={`${formatNumber(procedureTotal(org))}${growth != null ? ` (${formatPct(growth)})` : ''}`} />
        {parent ? (
          <Link href={profileHref(parent)} asChild>
            <Pressable className="min-h-11 justify-center" accessibilityRole="link">
              <Text className="text-primary">Part of {parent.name}</Text>
            </Pressable>
          </Link>
        ) : null}
      </Section>

      {facilities.length ? (
        <Section title="Facilities">
          {facilities.map((f) => (
            <EntityRow key={f.id} entity={f} signals={ctx.signals(f)} />
          ))}
        </Section>
      ) : null}

      {org.leakage ? (
        <Section title="Leakage" sub={org.leakage.scope}>
          <Fact label="Kept at this site" value={`${org.leakage.keptPct}%`} />
          <Fact label="Elsewhere in the system" value={`${org.leakage.inSystemPct}%`} />
          <Fact label="Left the system" value={`${org.leakage.leftPct}%`} />
          <Text className="text-sm text-muted-foreground">{org.leakage.insight}</Text>
        </Section>
      ) : null}

      <Section title="People here" sub="Busiest first">
        {people.map((h) => (
          <EntityRow key={h.id} entity={h} signals={ctx.signals(h)} />
        ))}
      </Section>

      <PlaceholderNote>Scaffold: executives, network, diagnoses and the activity log come next.</PlaceholderNote>
    </Screen>
  );
}
