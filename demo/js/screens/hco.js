// HCO profile: overview, network (parent & child facilities), people, volumes, leakage, activity.

import { childrenOf, destination, getOrg, hcpsAt, parentOf, primaryAffiliation, procedureTotal, procedureYoy, systemOf, descendantsOf } from '../data/index.js';
import { formatNumber, html } from '../format.js';
import { mapView } from '../map.js';
import { avatar, barRow, card, copyButton, delta, details, emptyState, icon, kpis, panel, sectionHead, signalTags, soon, tabs, tag, unavailableState } from '../ui.js';
import { activityPanel, profileActions, profileHeader, sampleNote, volumesPanel, whyCard } from './profile-parts.js';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'network', label: 'Network' },
  { id: 'people', label: 'People' },
  { id: 'volumes', label: 'Volumes' },
  { id: 'leakage', label: 'Leakage' },
  { id: 'activity', label: 'Activity' },
];

export const resource = ({ id }) => ({ key: `hco:${id}`, resolve: () => getOrg(id) });

export const title = ({ entry }) => getOrg(entry.params.id)?.name || 'Account';

export function render(ctx) {
  const org = getOrg(ctx.entry.params.id);
  const current = TABS.some((t) => t.id === ctx.entry.ui.tab) ? ctx.entry.ui.tab : 'overview';
  const parent = parentOf(org);
  const activityCount = ctx.ws.interactions.filter((i) => !i.deleted && i.targetId === org.id).length;
  const panels = { overview, network, people, volumes: volumesPanel, leakage, activity: activityPanel };

  return html`
    ${profileHeader(org, ctx, {
      kicker: `HCO · ${org.typeDetail}`,
      title: org.name,
      sub: html`${org.address}, ${org.city}${parent ? html` · Part of <button type="button" class="link" data-action="openProfile" data-id="${parent.id}">${parent.name}</button>` : ''}`,
      chips: html`${org.assigned ? tag('Assigned account', 'accent') : tag('Not assigned', 'neutral')}${signalTags(ctx.signals(org), 3)}`,
    })}
    ${profileActions(org, ctx)}
    ${tabs(TABS.map((t) => (t.id === 'activity' ? { ...t, count: activityCount } : t)), current, { label: 'Account sections' })}
    ${panel(current, panels[current](org, ctx))}
  `;
}

function overview(org, ctx) {
  const people = hcpsAt(org.id);
  const facilities = descendantsOf(org.id);
  const parent = parentOf(org);
  return html`
    ${whyCard(org, ctx)}
    ${kpis([
      org.procedures ? { label: 'Procedures · 12 mo', value: formatNumber(procedureTotal(org)), delta: procedureYoy(org) } : { label: 'Procedures · 12 mo', value: '—', sub: 'Not in your code group' },
      org.leakage ? { label: 'Patients leaving the system', value: `${org.leakage.leftPct}%`, sub: `of ${formatNumber(org.leakage.patients)} patients`, tone: org.leakage.leftPct >= 20 ? 'orange' : '' } : { label: 'Leakage', value: '—', sub: 'Not reported here' },
      { label: 'HCPs in your book', value: String(people.length), sub: facilities.length ? `Across ${facilities.length + 1} facilities` : 'At this site' },
      { label: org.type === 'Health system' ? 'Facilities' : 'Beds', value: org.type === 'Health system' ? String(facilities.length) : org.beds ? formatNumber(org.beds) : '—', sub: org.type === 'Health system' ? 'In this territory' : org.beds ? 'Sample figure' : 'Outpatient site' },
    ])}
    <div class="grid-2">
      ${card(html`
        ${sectionHead('Organization')}
        ${details([
          ['Type', `${org.type} · ${org.typeDetail}`],
          ['Ownership', org.ownership],
          parent ? ['Parent', html`<button type="button" class="link" data-action="openProfile" data-id="${parent.id}">${parent.name}</button>`] : ['Parent', 'None · top-level system'],
          ['Phone', org.phone, copyButton(org.phone, 'phone number')],
          ['Address', `${org.address}, ${org.city}`],
        ])}
      `)}
      ${card(html`
        ${sectionHead('Location')}
        ${mapView({
          points: [{ id: org.id, coords: org.coords, text: '', title: org.name, tone: 'planned' }],
          action: null,
          label: `Map showing ${org.name}`,
          height: 190,
          caption: org.onMap ? '' : 'Headquarters address',
        })}
      `)}
    </div>
    ${sampleNote()}
  `;
}

function network(org, ctx) {
  const system = systemOf(org);
  const parent = parentOf(org);
  const children = childrenOf(org.id);
  const node = (o, depth) => html`<li>
    <button type="button" class="tree-node${o.id === org.id ? ' is-current' : ''}" data-action="openProfile" data-id="${o.id}"${o.id === org.id ? html` aria-current="page"` : ''} style="--depth:${depth}">
      ${avatar(o, 'avatar-sm')}<span class="entity-main"><span class="row-title">${o.name}</span><span class="caption">${o.typeDetail}</span></span>
      ${o.id === org.id ? tag('You are here', 'accent') : ''}
    </button>
    ${childrenOf(o.id).length ? html`<ul>${childrenOf(o.id).map((c) => node(c, depth + 1))}</ul>` : ''}
  </li>`;
  const sites = [system, ...descendantsOf(system.id)].filter((o) => o.onMap);

  return html`
    ${card(html`
      ${sectionHead('Parent health system')}
      ${parent
        ? html`<button type="button" class="entity-row" data-action="openProfile" data-id="${parent.id}">${avatar(parent)}<span class="entity-main"><span class="row-title">${parent.name}</span><span class="caption">${parent.typeDetail} · ${parent.city}</span></span>${icon('chevron-right')}</button>`
        : html`<p class="muted">${org.name} is the top-level system.</p>`}
    `)}
    ${card(html`
      ${sectionHead('Child facilities', { sub: children.length ? `${children.length} directly under ${org.name}` : '' })}
      ${children.length
        ? html`<ul class="entity-list">${children.map((c) => html`<li><button type="button" class="entity-row" data-action="openProfile" data-id="${c.id}">${avatar(c)}<span class="entity-main"><span class="row-title">${c.name}</span><span class="caption">${c.typeDetail} · ${c.address} · ${hcpsAt(c.id).length} HCPs</span></span>${icon('chevron-right')}</button></li>`)}</ul>`
        : emptyState({ icon: 'building-2', title: 'No child facilities', body: `${org.name} has no facilities registered under it.` })}
    `)}
    ${card(html`
      ${sectionHead('Whole system', { sub: 'Public facility records; tap any facility' })}
      <ul class="tree">${node(system, 0)}</ul>
      ${mapView({
        points: sites.map((s) => ({ id: s.id, coords: s.coords, text: '', title: s.name, tone: s.id === org.id ? 'planned' : 'default', selected: s.id === org.id })),
        action: 'openSiteProfile',
        label: `Map of ${system.name} facilities`,
        height: 220,
      })}
    `)}
  `;
}

function people(org, ctx) {
  const hcps = hcpsAt(org.id);
  const execs = [org, ...descendantsOf(org.id)].flatMap((o) => o.executives.map((e) => ({ ...e, orgId: o.id, orgName: o.name })));
  return html`
    ${card(html`
      ${sectionHead('Key HCPs', { sub: 'Busiest first · select several to plan visits together' })}
      ${hcps.length
        ? html`<ul class="entity-list">${hcps.map((h) => {
          const aff = h.affiliations.find((a) => a.orgId === org.id) || primaryAffiliation(h);
          const total = procedureTotal(h);
          const selected = ctx.isSelected(h.id);
          const planned = ctx.planItemFor(h.id, ctx.ws.selection.day);
          return html`<li class="entity-item">
            <button type="button" class="entity-row" data-action="openProfile" data-id="${h.id}">
              ${avatar(h)}
              <span class="entity-main"><span class="row-title">${h.name}</span><span class="caption">${h.specialty} · ${aff.role}</span><span class="tag-row">${signalTags(ctx.signals(h), 2)}</span></span>
              <span class="entity-figure">${total ? html`${formatNumber(total)}<span class="caption">procedures</span>` : html`<span class="caption">Referrer</span>`}</span>
            </button>
            ${planned ? html`<span class="select-toggle is-planned" title="Already in the plan">${icon('calendar-days')}<span class="sr-only">Already planned</span></span>` : html`<button type="button" class="select-toggle" data-action="toggleSelect" data-id="${h.id}" aria-pressed="${selected}" aria-label="${selected ? 'Remove' : 'Add'} ${h.name} ${selected ? 'from' : 'to'} the plan">${icon(selected ? 'check' : 'plus')}</button>`}
          </li>`;
        })}</ul>`
        : emptyState({ icon: 'users', title: 'No HCPs in your book here', body: 'Nobody in your assigned book practices at this facility.' })}
    `)}
    ${card(html`
      ${sectionHead('Executives & decision makers', { sub: 'Sample contacts · tap for details' })}
      ${execs.length
        ? html`<ul class="entity-list">${execs.map((e) => html`<li><button type="button" class="entity-row" data-action="openContact" data-org="${e.orgId}" data-exec="${e.id}">
            ${avatar({ name: e.name })}
            <span class="entity-main"><span class="row-title">${e.name}</span><span class="caption">${e.title}${e.orgId !== org.id ? ` · ${e.orgName}` : ''}</span></span>
            ${tag(e.role, e.role === 'Economic buyer' || e.role === 'Decision maker' ? 'accent' : 'neutral')}
          </button></li>`)}</ul>`
        : emptyState({ icon: 'user', title: 'No executives recorded', body: 'Add one from the web platform; the app will show them here.' })}
    `)}
  `;
}

function leakage(org) {
  const l = org.leakage;
  if (!l) return unavailableState({ title: 'Leakage not reported for this site', body: org.leakageUnavailable });
  const max = Math.max(...l.destinations.map((d) => d.patients));
  const name = (d) => (d.orgId ? html`<button type="button" class="link" data-action="openProfile" data-id="${d.orgId}">${getOrg(d.orgId).name}</button> ${tag('In system', 'success')}` : html`${destination(d.ref).name} ${tag('Out of system', 'orange')}`);
  // More patients going elsewhere is bad news, so up is red.
  const trend = (t) => (t ? delta(t, { suffix: '', upIsBad: true }) : '');
  const kept = org.type === 'Health system' ? 'Kept in system' : org.leakage.keptPct ? 'Kept here' : null;
  return html`
    ${card(html`
      ${sectionHead('Leakage summary', { sub: `${l.scope} · last 12 months · sample` })}
      <p class="big-number">${formatNumber(l.patients)} <span class="unit">patients</span></p>
      <div class="stack-bar" role="img" aria-label="${kept ? `${kept} ${l.keptPct}%, ` : ''}moved within the system ${l.inSystemPct}%, left the system ${l.leftPct}%">
        ${l.keptPct ? html`<span class="seg seg-kept" style="--w:${l.keptPct}%"></span>` : ''}
        ${l.inSystemPct ? html`<span class="seg seg-moved" style="--w:${l.inSystemPct}%"></span>` : ''}
        <span class="seg seg-left" style="--w:${l.leftPct}%"></span>
      </div>
      <ul class="legend">
        ${kept ? html`<li><span class="swatch seg-kept"></span>${kept} <strong>${l.keptPct}%</strong></li>` : ''}
        ${l.inSystemPct ? html`<li><span class="swatch seg-moved"></span>Moved within system <strong>${l.inSystemPct}%</strong></li>` : ''}
        <li><span class="swatch seg-left"></span>Left the system <strong>${l.leftPct}%</strong></li>
      </ul>
      <p class="insight">${icon('lightbulb')}<span>${l.insight}</span></p>
    `)}
    <div class="grid-2">
      ${card(html`
        ${sectionHead('Top destinations', { sub: 'Where patients went, and the change on last year' })}
        ${l.destinations.map((d) => barRow({ labelHtml: name(d), value: d.patients, display: html`${formatNumber(d.patients)} ${trend(d.trend)}`, max, tone: d.orgId ? 'success' : 'orange' }))}
      `)}
      ${card(html`
        ${sectionHead('Leaving, by procedure', { sub: 'Share of patients who left the system' })}
        ${l.byFamily.map((f) => barRow({ label: f.family, value: f.leftPct, display: `${f.leftPct}%`, max: 50, tone: 'orange' }))}
      `)}
    </div>
    <div class="soon-row">${soon('Generate leakage report (PDF)', 'Coming later', 'file-chart-column')}</div>
    <p class="fineprint">${icon('info')} Illustrative figures. Out-of-system destinations are fictional names.</p>
  `;
}
