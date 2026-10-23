// Links that open another app: the phone to call, and maps for directions or the
// day's route. Plain functions, so the tests can check them.

import { Platform } from 'react-native';

import type { LonLat } from './types';

export const telUrl = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, '')}`;

/** Opens the phone's own maps app with the route there; Android and the browser get Google Maps' directions. */
export function directionsUrl([lon, lat]: LonLat, label: string): string {
  const name = encodeURIComponent(label);
  return Platform.OS === 'ios' ? `https://maps.apple.com/?daddr=${lat},${lon}&q=${name}` : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}

/**
 * Google Maps with the stops in order, from wherever the phone is. Apple Maps takes
 * only one stop, so it's Google's on every phone, in its app where there is one. In
 * a phone's browser Google takes up to four stops, so a phone passes no more.
 */
export function routeUrl(stops: LonLat[]): string {
  const at = ([lon, lat]: LonLat) => `${lat},${lon}`;
  const via = stops.slice(0, -1).map(at).join('|');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(at(stops[stops.length - 1]))}${via ? `&waypoints=${encodeURIComponent(via)}` : ''}&travelmode=driving`;
}
