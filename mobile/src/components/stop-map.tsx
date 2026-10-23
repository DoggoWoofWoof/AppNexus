// A small static map of Manhattan with numbered pins, after the prototype's
// demo/js/map.js: public street and park outlines drawn as SVG, no tiles, no API
// key and no live location. Pins sit on top as buttons so they're easy to tap.
// The outlines are Manhattan's only, so with a pin anywhere else the map is
// plain land with the pins and route on it, not pins out in the water.

import { Check, Navigation } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import Svg, { G, Path, Polyline } from 'react-native-svg';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import geo from '@/lib/data/manhattan.json';
import type { LonLat } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface MapPin {
  id: string;
  coords: LonLat;
  /** Shown inside the pin, such as the stop's number. */
  label?: string;
  tone: 'next' | 'planned' | 'done' | 'muted';
  /** What a screen reader says for the pin. */
  title: string;
}

const COLORS = {
  light: { water: '#DCE6F5', land: '#F7F8FB', park: '#DCEFD8', road: '#E2E6EE', major: '#CBD3E1', route: 'hsl(226.9 69% 45.5%)' },
  dark: { water: '#0E1829', land: '#172238', park: '#183022', road: '#263350', major: '#34446A', route: 'hsl(226.1 100% 78%)' },
};

const W = 400;
const rad = Math.PI / 180;
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * rad) / 2));

/** Fits the points into the map with some padding, never closer than about a dozen blocks. */
function fit(coords: LonLat[], width: number, height: number, pad = 30) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [lon, lat] of coords) {
    minX = Math.min(minX, lon * rad);
    maxX = Math.max(maxX, lon * rad);
    minY = Math.min(minY, mercY(lat));
    maxY = Math.max(maxY, mercY(lat));
  }
  const minSpan = 0.022 * rad;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const scale = Math.min((width - pad * 2) / Math.max(maxX - minX, minSpan), (height - pad * 2) / Math.max(maxY - minY, minSpan));
  return ([lon, lat]: LonLat): [number, number] => [width / 2 + (lon * rad - cx) * scale, height / 2 - (mercY(lat) - cy) * scale];
}

type Geometry = { type: string; coordinates: unknown };
type Feature = { geometry: Geometry; properties: Record<string, string> };

function pathFor(geometry: Geometry, project: (c: LonLat) => [number, number]): string {
  const ring = (pts: LonLat[], close: boolean) =>
    pts
      .map((p, i) => {
        const [x, y] = project(p);
        return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join('') + (close ? 'Z' : '');
  switch (geometry.type) {
    case 'Polygon':
      return (geometry.coordinates as LonLat[][]).map((r) => ring(r, true)).join('');
    case 'MultiPolygon':
      return (geometry.coordinates as LonLat[][][]).flatMap((p) => p.map((r) => ring(r, true))).join('');
    case 'MultiLineString':
      return (geometry.coordinates as LonLat[][]).map((l) => ring(l, false)).join('');
    case 'LineString':
      return ring(geometry.coordinates as LonLat[], false);
    default:
      return '';
  }
}

const features = (layer: { features: unknown[] }) => layer.features as Feature[];
const MAJOR = new Set(['primary', 'secondary']);

/** Whether a place is on the land the map draws: Manhattan and its islands. */
function onLand([x, y]: LonLat): boolean {
  return features(geo.land).some((f) => {
    const polygons =
      f.geometry.type === 'Polygon' ? [f.geometry.coordinates as LonLat[][]] : f.geometry.type === 'MultiPolygon' ? (f.geometry.coordinates as LonLat[][][]) : [];
    return polygons.some(([outer]) => {
      let inside = false;
      for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
        const [xi, yi] = outer[i];
        const [xj, yj] = outer[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    });
  });
}

const PIN = {
  next: 'border-card bg-primary',
  planned: 'border-primary bg-card',
  done: 'border-card bg-success',
  muted: 'border-card bg-track',
} as const;
const PIN_TEXT = { next: 'text-primary-foreground', planned: 'text-primary', done: 'text-white', muted: 'text-muted-foreground' } as const;

/**
 * Pins on a map of Manhattan, or of land around it when one is elsewhere. `route`
 * joins the pins in order with a dashed line from `start`. Tapping a pin calls
 * `onPinPress` with its id.
 */
export function StopMap({
  pins,
  start,
  route = false,
  onPinPress,
  label,
  height = 210,
}: {
  pins: MapPin[];
  start?: { coords: LonLat; label: string };
  route?: boolean;
  onPinPress?: (id: string) => void;
  label: string;
  height?: number;
}) {
  const { colorScheme } = useColorScheme();
  const color = COLORS[colorScheme === 'dark' ? 'dark' : 'light'];
  const [width, setWidth] = useState(0);
  const H = Math.round((W * height) / Math.max(width, 1)) || height;

  const key = JSON.stringify([pins.map((p) => p.coords), start?.coords, H]);
  // Projecting thousands of street points is the slow part, so it only runs when the pins move.
  const drawn = useMemo(() => {
    const coords = [...pins.map((p) => p.coords), ...(start ? [start.coords] : [])];
    const project = fit(coords.length ? coords : [[-73.97, 40.785]], W, H);
    // Off the island there's land the map doesn't have, so it draws none of it.
    const wide = coords.some((c) => !onLand(c));
    const join = (list: Feature[]) => (wide ? '' : list.map((f) => pathFor(f.geometry, project)).join(''));
    const roads = features(geo.roads);
    const line = route && pins.length ? [...(start ? [start.coords] : []), ...pins.map((p) => p.coords)].map((c) => project(c).map((n) => n.toFixed(1)).join(',')).join(' ') : '';
    return {
      wide,
      land: join(features(geo.land)),
      parks: join(features(geo.parks)),
      roads: join(roads.filter((f) => !MAJOR.has(f.properties.kind))),
      major: join(roads.filter((f) => MAJOR.has(f.properties.kind))),
      line,
      at: (c: LonLat) => {
        const [x, y] = project(c);
        return { left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` } as const;
      },
    };
    // `key` stands in for the coordinates, which are new arrays on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, route]);

  return (
    <View className="gap-1">
      <View
        className="overflow-hidden rounded-lg border border-border"
        style={{ height, backgroundColor: drawn.wide ? color.land : color.water }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessibilityLabel={label}
      >
        {width ? (
          <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" pointerEvents="none">
            {drawn.wide ? null : (
              <>
                <Path d={drawn.land} fill={color.land} />
                <Path d={drawn.parks} fill={color.park} />
              </>
            )}
            <G fill="none" strokeLinecap="round" strokeLinejoin="round">
              {drawn.wide ? null : (
                <>
                  <Path d={drawn.roads} stroke={color.road} strokeWidth={0.7} />
                  <Path d={drawn.major} stroke={color.major} strokeWidth={1.4} />
                </>
              )}
              {drawn.line ? <Polyline points={drawn.line} stroke={color.route} strokeWidth={2.25} strokeDasharray="6 5" /> : null}
            </G>
          </Svg>
        ) : null}
        {width && start ? (
          <View
            className="absolute -ml-3 -mt-3 h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-foreground"
            style={drawn.at(start.coords)}
            accessibilityLabel={`Start: ${start.label}`}
          >
            <Icon as={Navigation} size={12} className="text-background" />
          </View>
        ) : null}
        {width
          ? pins.map((pin) => (
              <Pressable
                key={pin.id}
                onPress={onPinPress ? () => onPinPress(pin.id) : undefined}
                disabled={!onPinPress}
                accessibilityRole={onPinPress ? 'button' : undefined}
                accessibilityLabel={pin.title}
                hitSlop={10}
                className={cn('absolute -ml-4 -mt-4 h-8 min-w-8 items-center justify-center rounded-full border-2 px-1.5', PIN[pin.tone])}
                style={drawn.at(pin.coords)}
              >
                {pin.tone === 'done' ? (
                  <Icon as={Check} size={16} className="text-white" />
                ) : (
                  <Text className={cn('text-sm font-semibold', PIN_TEXT[pin.tone])} maxFontSizeMultiplier={1.2}>
                    {pin.label ?? ''}
                  </Text>
                )}
              </Pressable>
            ))
          : null}
      </View>
      {drawn.wide ? null : (
        <Text
          className="self-end text-2xs text-muted-foreground"
          onPress={() => void Linking.openURL('https://www.openstreetmap.org/copyright')}
          accessibilityRole="link"
        >
          © OpenStreetMap contributors · NYC Open Data
        </Text>
      )}
    </View>
  );
}
