// Static Manhattan map: real public geography (OSM streets and parks, NYC
// borough outlines) with interactive pins. No tiles, no API key, no live location.

import { esc, html, raw } from './format.js';
import { icon } from './ui.js';

let geo = null;
let state = 'loading'; // 'loading' | 'ready' | 'failed'
const pathCache = new Map();

export async function loadMap(url) {
  try {
    geo = await fetch(url).then((r) => (r.ok ? r.json() : null));
  } catch {
    geo = null;
  }
  state = geo ? 'ready' : 'failed';
  return !!geo;
}

const rad = Math.PI / 180;
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * rad) / 2));

/** A projection that fits the given [lon, lat] points into width × height with padding. */
export function fitProjection(coords, width, height, pad = 34) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [lon, lat] of coords) {
    const x = lon * rad, y = mercY(lat);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  // Never zoom in closer than roughly a dozen blocks.
  const minSpan = 0.022 * rad;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  let spanX = Math.max(maxX - minX, minSpan), spanY = Math.max(maxY - minY, minSpan);
  const innerW = width - pad * 2, innerH = height - pad * 2;
  const scale = Math.min(innerW / spanX, innerH / spanY);
  return {
    key: [cx, cy, scale, width, height].map((n) => n.toFixed(6)).join(':'),
    project: ([lon, lat]) => [width / 2 + (lon * rad - cx) * scale, height / 2 - (mercY(lat) - cy) * scale],
  };
}

function pathFor(geometry, project) {
  const ring = (pts, close) => pts.map((p, i) => {
    const [x, y] = project(p);
    return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join('') + (close ? 'Z' : '');
  switch (geometry.type) {
    case 'Polygon': return geometry.coordinates.map((r) => ring(r, true)).join('');
    case 'MultiPolygon': return geometry.coordinates.flatMap((p) => p.map((r) => ring(r, true))).join('');
    case 'LineString': return ring(geometry.coordinates, false);
    case 'MultiLineString': return geometry.coordinates.map((l) => ring(l, false)).join('');
    default: return '';
  }
}

function basemap(projection) {
  if (!geo) return '';
  if (pathCache.has(projection.key)) return pathCache.get(projection.key);
  const p = (f) => pathFor(f.geometry, projection.project);
  const major = new Set(['primary', 'secondary']);
  const svg = [
    `<g class="map-land">${geo.land.features.map((f) => `<path d="${p(f)}"/>`).join('')}</g>`,
    `<g class="map-parks">${geo.parks.features.map((f) => `<path d="${p(f)}"/>`).join('')}</g>`,
    `<g class="map-roads">${geo.roads.features.filter((f) => !major.has(f.properties.kind)).map((f) => `<path d="${p(f)}"/>`).join('')}</g>`,
    `<g class="map-roads map-roads-major">${geo.roads.features.filter((f) => major.has(f.properties.kind)).map((f) => `<path d="${p(f)}"/>`).join('')}</g>`,
  ].join('');
  if (pathCache.size > 24) pathCache.clear();
  pathCache.set(projection.key, svg);
  return svg;
}

/**
 * Renders a map with pins.
 * points: [{ id, coords, text, title, tone: 'default' | 'planned' | 'done' | 'muted', selected }]
 * start:  optional { coords, label } for the rep's start point.
 * route:  draws a dashed straight line through the points in order.
 */
export function mapView({ points, start, route = false, label, action = 'selectSite', width = 400, height = 250, caption }) {
  const all = [...points.map((p) => p.coords), ...(start ? [start.coords] : [])];
  const projection = fitProjection(all.length ? all : [[-73.97, 40.785]], width, height);
  const pos = (coords) => projection.project(coords);
  const pct = ([x, y]) => `left:${((x / width) * 100).toFixed(2)}%;top:${((y / height) * 100).toFixed(2)}%`;
  const line = route && points.length > 1
    ? `<polyline class="map-route" points="${[...(start ? [start.coords] : []), ...points.map((p) => p.coords)].map((c) => pos(c).map((n) => n.toFixed(1)).join(',')).join(' ')}"/>`
    : '';
  const unavailable = state === 'failed';

  return html`<figure class="map${unavailable ? ' map-unavailable' : ''}">
    <div class="map-canvas" style="aspect-ratio:${width}/${height}">
      ${raw(`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}" preserveAspectRatio="xMidYMid meet">${basemap(projection)}${line}</svg>`)}
      ${unavailable ? html`<p class="map-fallback">${icon('cloud-off')} Street map couldn't load. Pins show relative positions.</p>` : ''}
      ${start ? html`<span class="map-start" style="${pct(pos(start.coords))}" title="${start.label}">${icon('navigation')}<span class="sr-only">Start: ${start.label}</span></span>` : ''}
      ${points.map((p) => (action
        ? html`<button type="button" class="map-pin map-pin-${p.tone || 'default'}" style="${pct(pos(p.coords))}" data-action="${action}" data-site="${p.id}" aria-pressed="${!!p.selected}" aria-label="${p.title}">${p.text ?? ''}</button>`
        : html`<span class="map-pin map-pin-${p.tone || 'default'}" style="${pct(pos(p.coords))}" title="${p.title}">${p.text ?? ''}</span>`))}
    </div>
    <figcaption>${caption ? html`<span>${caption}</span>` : ''}<span class="map-credit"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a> · <a href="https://data.cityofnewyork.us/d/gthc-hcne" target="_blank" rel="noreferrer">NYC Open Data</a> · <a href="https://health.data.ny.gov/Health/Health-Facility-General-Information/vn5v-hh5r" target="_blank" rel="noreferrer">NY Health facilities</a></span></figcaption>
  </figure>`;
}
