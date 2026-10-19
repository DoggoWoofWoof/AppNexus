// Targets: search the assigned book, filter, switch list/map, and select several targets to plan.

import { getOrg, siteFor, subtitle } from '../data/index.js';
import { REP } from '../data/seed.js';
import { formatKm, html, plural } from '../format.js';
import { mapView } from '../map.js';
import { SIGNAL_FILTERS, SORTS, activeFilterCount } from '../search.js';
import { looksLikeQuestion } from '../ask.js';
import { avatar, button, emptyState, icon, segmented, signalTags } from '../ui.js';

export const resource = () => ({ key: 'targets', resolve: () => true });

export const title = () => 'Targets';

export function render(ctx) {
  const f = ctx.ws.targets;
  const rows = ctx.search(f);
  const counts = { hcp: ctx.search({ ...f, kind: 'hcp' }).length, hco: ctx.search({ ...f, kind: 'hco' }).length };
  const filterCount = activeFilterCount(f);
  const noun = f.kind === 'hcp' ? ['person', 'people'] : ['account', 'accounts'];
  const rep = ctx.ws.replacement;

  return html`
    <header class="page-head">
      <p class="eyebrow">Your book · ${REP.team}</p>
      <h1>Targets</h1>
      <p class="page-sub">Search your assigned people and accounts. Select several, then review them as one plan.</p>
    </header>
    ${rep ? html`<div class="banner banner-accent" role="status">${icon('calendar-plus')}<span><strong>Filling the ${rep.time} slot</strong> left by ${rep.name}. Nearest to ${getOrg(rep.siteId).name} first.</span>${button({ label: 'Stop', action: 'clearReplacement', size: 'sm', variant: 'ghost' })}</div>` : ''}
    <div class="search">
      ${icon('search')}
      <input type="search" id="target-search" data-input="targetsQuery" value="${f.query}" placeholder="Name, specialty, organization or NPI" aria-label="Search targets" autocomplete="off">
      ${f.query ? button({ label: 'Clear search', icon: 'x', action: 'targetsClearQuery', variant: 'ghost', iconOnly: true }) : ''}
    </div>
    ${looksLikeQuestion(f.query) ? html`<button type="button" class="ask-suggest" data-action="askSuggestion" data-q="${f.query}">${icon('sparkles')}<span><span class="kicker">Ask Field Pro</span><span class="ask-suggest-q">${f.query}</span></span>${icon('arrow-right')}</button>` : ''}
    ${segmented([{ id: 'hcp', label: 'People', icon: 'user', count: counts.hcp }, { id: 'hco', label: 'Accounts', icon: 'building-2', count: counts.hco }], f.kind, 'targetsKind', { label: 'Target type', key: 'kind' })}
    <div class="chip-row" role="group" aria-label="Quick filters">
      ${SIGNAL_FILTERS.map((s) => html`<button type="button" class="chip" data-action="toggleSignal" data-signal="${s.id}" aria-pressed="${f.signals.includes(s.id)}">${f.signals.includes(s.id) ? icon('check') : ''}${s.label}</button>`)}
      <button type="button" class="chip chip-filter" data-action="openFilters">${icon('sliders-horizontal')}Filters${filterCount ? html`<span class="count">${filterCount}</span>` : ''}</button>
    </div>
    <div class="toolbar">
      <p class="toolbar-count" role="status">${plural(rows.length, noun[0], noun[1])} · ${SORTS.find((s) => s.id === f.sort).label.toLowerCase()}</p>
      ${segmented([{ id: 'list', label: 'List', icon: 'list' }, { id: 'map', label: 'Map', icon: 'map' }], f.view, 'targetsView', { label: 'View', key: 'view' })}
    </div>
    <div class="targets-body" data-view="${f.view}">
      <div class="targets-list">${rows.length ? list(rows, ctx) : empty(ctx)}</div>
      <div class="targets-map">${map(rows, ctx)}</div>
    </div>
  `;
}

export function targetRow(row, ctx, { showDistance = true } = {}) {
  const { entity, signals, distance, planned } = row;
  const selected = ctx.isSelected(entity.id);
  return html`<li class="entity-item${selected ? ' is-selected' : ''}">
    <button type="button" class="entity-row" data-action="openProfile" data-id="${entity.id}">
      ${avatar(entity)}
      <span class="entity-main">
        <span class="row-title">${entity.name}</span>
        <span class="caption">${subtitle(entity)}</span>
        ${signals.length || planned ? html`<span class="tag-row">${planned ? html`<span class="tag tag-success">${icon('calendar-days')}Planned${planned.mode === 'timed' ? ` ${planned.time}` : ''}</span>` : ''}${signalTags(signals, 2)}</span>` : ''}
      </span>
      ${showDistance ? html`<span class="entity-figure">${formatKm(distance)}</span>` : ''}
    </button>
    ${planned
      ? html`<span class="select-toggle is-planned" title="Already in the plan">${icon('calendar-days')}<span class="sr-only">Already planned</span></span>`
      : html`<button type="button" class="select-toggle" data-action="toggleSelect" data-id="${entity.id}" aria-pressed="${selected}" aria-label="${selected ? 'Remove' : 'Add'} ${entity.name} ${selected ? 'from' : 'to'} the plan">${icon(selected ? 'check' : 'plus')}</button>`}
  </li>`;
}

function list(rows, ctx) {
  return html`<ul class="entity-list entity-list-cards">${rows.map((r) => targetRow(r, ctx))}</ul>
    <p class="fineprint">${icon('info')} Distances are straight-line from ${ctx.ws.replacement ? getOrg(ctx.ws.replacement.siteId).name : REP.start.label}, not driving routes.</p>`;
}

function empty(ctx) {
  const f = ctx.ws.targets;
  return emptyState({
    icon: 'search',
    title: f.query ? `No matches for “${f.query}”` : 'No targets match these filters',
    body: 'Try a different spelling, or widen the filters.',
    actions: html`${f.query ? button({ label: 'Ask Field Pro instead', icon: 'sparkles', action: 'askSuggestion', data: { q: f.query } }) : ''}${f.query ? button({ label: 'Clear search', action: 'targetsClearQuery' }) : ''}${activeFilterCount(f) ? button({ label: 'Clear filters', action: 'clearFilters', variant: 'primary' }) : ''}`,
  });
}

function map(rows, ctx) {
  const sites = new Map();
  for (const row of rows) {
    const site = siteFor(row.entity);
    const key = site.coords.join(',');
    if (!sites.has(key)) sites.set(key, { site, rows: [] });
    sites.get(key).rows.push(row);
  }
  const groups = [...sites.values()];
  const selected = groups.find((g) => g.site.id === ctx.ws.targets.site) || groups[0];
  const points = groups.map((g) => ({
    id: g.site.id,
    coords: g.site.coords,
    text: String(g.rows.length),
    title: `${g.site.name}: ${plural(g.rows.length, 'target')}`,
    tone: g.rows.some((r) => r.planned) ? 'planned' : 'default',
    selected: g === selected,
  }));
  return html`
    ${mapView({ points, start: REP.start, label: `Map of ${plural(groups.length, 'site')} with matching targets`, height: 300, caption: `Numbers show targets per site · ${REP.start.label} marked as start` })}
    ${selected ? html`<section class="map-detail" aria-live="polite">
      <h2 class="section-title">${selected.site.name}</h2>
      <p class="caption">${selected.site.address}, ${selected.site.city}</p>
      <ul class="entity-list">${selected.rows.map((r) => targetRow(r, ctx, { showDistance: false }))}</ul>
    </section>` : ''}
  `;
}
