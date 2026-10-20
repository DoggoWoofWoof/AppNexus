// The row under the big buttons on someone's page, like a phone's contact card:
// Ask about them, call them, get directions to where the visit is, and hear the
// summary and what to bring up read aloud. Each is one tap, for the car park.

import { router } from 'expo-router';
import { Mic, Navigation, Phone, Square, Volume2, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';

import { useChatHref } from '@/components/entity';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { buildBrief, speechFor } from '@/lib/brief';
import { shortName, siteFor } from '@/lib/data';
import { improvedSummary } from '@/lib/prep';
import { useWorkspace } from '@/lib/store';
import type { Entity, LonLat } from '@/lib/types';
import { canListen, canSpeak, speak, stopSpeaking } from '@/lib/voice';

export const telUrl = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, '')}`;

/** Opens the phone's own maps app with the route there; Android and the browser get Google Maps' directions. */
export function directionsUrl([lon, lat]: LonLat, label: string): string {
  const name = encodeURIComponent(label);
  return Platform.OS === 'ios' ? `https://maps.apple.com/?daddr=${lat},${lon}&q=${name}` : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}

function Action({ icon, label, hint, on = false, onPress }: { icon: LucideIcon; label: string; hint: string; on?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={hint} className="min-h-16 flex-1 items-center gap-1.5 rounded-xl border border-border bg-card px-1 py-2.5 active:bg-accent">
      <View className={on ? 'h-9 w-9 items-center justify-center rounded-full bg-primary' : 'h-9 w-9 items-center justify-center rounded-full bg-brand-soft'}>
        <Icon as={icon} size={18} className={on ? 'text-primary-foreground' : 'text-brand'} />
      </View>
      <Text className="text-sm font-semibold text-brand" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Ask, Call, Directions and Listen. `siteId` is where the visit is, when there is one. */
export function QuickActions({ entity, siteId }: { entity: Entity; siteId?: string }) {
  const ctx = useWorkspace();
  const chatHref = useChatHref();
  const [reading, setReading] = useState(false);
  useEffect(() => () => stopSpeaking(), []);

  const short = shortName(entity);
  const site = siteFor(entity, siteId);
  // Doctors are booked and reached through their office line, accounts through the main line.
  const phone = entity.kind === 'hcp' ? entity.contact.phone : entity.phone;
  const who = entity.kind === 'hcp' && entity.contact.assistant ? entity.contact.assistant : short;

  const listen = () => {
    if (reading) {
      stopSpeaking();
      setReading(false);
      return;
    }
    setReading(true);
    // The rep's own summary, when they've written one, is what Listen reads.
    speak(speechFor(entity, ctx, buildBrief(entity, ctx), improvedSummary(ctx.ws, entity.id) ?? undefined), { onEnd: () => setReading(false) });
  };

  return (
    <View className="flex-row gap-2">
      <Action icon={Mic} label="Ask" hint={`Ask about ${short}`} onPress={() => router.push(chatHref(entity, canListen()))} />
      <Action icon={Phone} label="Call" hint={`Call ${who}, ${phone}`} onPress={() => void Linking.openURL(telUrl(phone))} />
      <Action icon={Navigation} label="Directions" hint={`Directions to ${site.name}`} onPress={() => void Linking.openURL(directionsUrl(site.coords, site.name))} />
      {canSpeak() ? <Action icon={reading ? Square : Volume2} label={reading ? 'Stop' : 'Listen'} hint={reading ? 'Stop reading' : `Hear the summary for ${short}`} on={reading} onPress={listen} /> : null}
    </View>
  );
}
