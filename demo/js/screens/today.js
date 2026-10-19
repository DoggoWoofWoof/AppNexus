// Today: a calm start. What's next, the day's plan, follow-ups due and who to see.

import { getEntity, getOrg, siteFor, subtitle } from '../data/index.js';
import { REP } from '../data/seed.js';
import { daysBetween, formatDate, fromIso, greeting, html, plural } from '../format.js';
import { mapView } from '../map.js';
import { endTime, isOnSite, routeOrder } from '../plan.js';
import { avatar, button, card, emptyState, icon, kpis, sectionHead, segmented, signalTags, tag } from '../ui.js';
import { askBar } from './ask.js';
import { followUpRow } from './profile-parts.js';

export const title = () => 'Today';

const TYPE_ICONS = { 'In-person visit': 'handshake', 'Phone call': 'phone', 'Video call': 'video', Email: 'mail', Meeting: 'users' };

export function render(ctx) {
  const day = ctx.entry.ui.day && ctx.planDays().some((d) => d.iso === ctx.entry.ui.day) ? ctx.entry.ui.day : ctx.todayIso;
  const isToday = day === ctx.todayIso;
  const all = routeOrder(ctx.ws.plans[day] || []);
  const active = all.filter((i) => i.status !== 'cancelled');
  const remaining = active.filter((i) => i.status === 'planned');
  const next = remaining[0];
  const due = ctx.ws.followUps.filter((f) => !f.done && daysBetween(ctx.today, fromIso(f.due)) <= 0).sort((a, b) => a.due.localeCompare(b.due));
  const overdue = due.filter((f) => daysBetween(ctx.today, fromIso(f.due)) < 0).length;
  const summary = [
    active.length ? `${plural(active.length, 'stop')} planned` : 'Nothing planned yet',
    active.length && remaining.length !== active.length ? `${active.length - remaining.length} done` : '',
    isToday && due.length ? `${plural(due.length, 'follow-up')} due${overdue ? ` (${overdue} overdue)` : ''}` : '',
  ].filter(Boolean).join(' · ');

  return html`
    <header class="page-head">
      <p class="eyebrow">${formatDate(ctx.today, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <h1>${greeting(ctx.now())}, ${REP.firstName}</h1>
      <p class="page-sub">${summary}.</p>
    </header>
    ${askBar({ id: 'today-ask' })}
    ${segmented(ctx.planDays().map((d) => ({ id: d.iso, label: d.label })), day, 'todayDay', { label: 'Day', key: 'day' })}
    ${replacementCard(ctx, day)}
    <div class="today-grid">
      <div class="today-main">
        ${next ? upNext(next, ctx, isToday) : ''}
        ${active.length ? planCard(all, ctx, day) : card(emptyState({
          icon: 'calendar-days',
          title: `No visits planned for ${ctx.dayName(day).toLowerCase()}`,
          body: 'Pick a few people or accounts and review them as one plan. Suggestions below are a good start.',
          actions: button({ label: 'Plan your day', icon: 'target', action: 'planYourDay', data: { day }, variant: 'primary' }),
        }))}
        ${isToday ? followUpsCard(due, ctx) : ''}
      </div>
      <div class="today-side">
        ${active.some(isOnSite) ? routeCard(active, ctx) : ''}
        ${suggestions(ctx, day)}
        ${isToday ? weekCard(ctx) : ''}
      </div>
    </div>
  `;
}

function replacementCard(ctx, day) {
  const r = ctx.ws.replacement;
  if (!r || r.day !== day) return '';
  return html`<div class="banner banner-accent" role="status">${icon('calendar-plus')}<span><strong>${r.time} is free</strong> after ${r.name} cancelled. Find someone near ${getOrg(r.siteId).name}?</span>
    <span class="banner-actions">${button({ label: 'Find nearby', action: 'findReplacement', size: 'sm', variant: 'primary' })}${button({ label: 'Leave it free', action: 'clearReplacement', size: 'sm', variant: 'ghost' })}</span></div>`;
}

function upNext(item, ctx, isToday) {
  const target = getEntity(item.targetId);
  const site = siteFor(target, item.siteId);
  return html`<section class="card next-card" aria-labelledby="next-title">
    <div class="next-top">
      <p class="eyebrow">${isToday ? 'Up next' : 'First stop'} · ${item.mode === 'timed' ? `${item.time}–${endTime(item)}` : 'Flexible'}</p>
      ${tag(item.type, 'neutral')}
    </div>
    <div class="next-who">
      ${avatar(target, 'avatar-lg')}
      <div>
        <h2 id="next-title" class="next-name">${target.name}</h2>
        <p class="caption">${target.kind === 'hcp' ? target.specialty : target.typeDetail} · ${site.name}</p>
      </div>
    </div>
    ${item.goal ? html`<p class="next-goal">${icon('target')}<span>${item.goal}</span></p>` : ''}
    <div class="tag-row">${signalTags(ctx.signals(target), 3)}</div>
    <div class="next-actions">
      ${button({ label: 'Prepare', icon: 'file-text', action: 'openProfile', data: { id: target.id }, variant: 'primary' })}
      ${button({ label: 'Log visit', icon: 'notebook-pen', action: 'logVisit', data: { item: item.id, day: ctx.dayOf(item.id) } })}
      ${button({ label: `More options for ${target.name}`, icon: 'ellipsis', action: 'visitOptions', data: { item: item.id, day: ctx.dayOf(item.id) }, iconOnly: true })}
    </div>
  </section>`;
}

function planCard(items, ctx, day) {
  return card(html`
    ${sectionHead('Your plan', { sub: 'Tap a stop for options', actions: button({ label: 'Edit plan', icon: 'pencil', action: 'reviewPlan', data: { day }, size: 'sm' }) })}
    <ol class="day-timeline">${items.map((item) => {
      const target = getEntity(item.targetId);
      const status = item.status === 'done' ? 'Done' : item.status === 'cancelled' ? 'Cancelled' : '';
      return html`<li class="day-stop is-${item.status}">
        <span class="day-time">${item.mode === 'timed' ? item.time : 'Any time'}<span class="caption">${item.duration} min</span></span>
        <button type="button" class="day-stop-body" data-action="visitOptions" data-item="${item.id}" data-day="${day}">
          <span class="day-stop-icon" aria-hidden="true">${item.status === 'done' ? icon('circle-check') : icon(TYPE_ICONS[item.type] || 'map-pin')}</span>
          <span class="entity-main"><span class="row-title${item.status === 'cancelled' ? ' strike' : ''}">${target.name}</span><span class="caption">${item.type} · ${siteFor(target, item.siteId).name}</span></span>
          ${status ? tag(status, item.status === 'done' ? 'success' : 'neutral') : icon('chevron-right')}
        </button>
      </li>`;
    })}</ol>
  `);
}

function routeCard(items, ctx) {
  const onSite = routeOrder(items).filter(isOnSite);
  return card(html`
    ${sectionHead('Route', { sub: `${plural(onSite.length, 'site visit')} · straight-line order` })}
    ${mapView({
      points: onSite.map((i, n) => ({ id: i.siteId, coords: siteFor(getEntity(i.targetId), i.siteId).coords, text: String(n + 1), title: `${n + 1}. ${getEntity(i.targetId).name}`, tone: i.status === 'done' ? 'done' : 'planned' })),
      start: REP.start,
      route: true,
      action: null,
      label: 'Map of today’s stops in order',
      height: 200,
    })}
    ${button({ label: 'Open in Targets map', icon: 'map', action: 'openPlanMap', variant: 'ghost', size: 'sm' })}
  `);
}

function followUpsCard(due, ctx) {
  return card(html`
    ${sectionHead('Follow-ups due', { actions: button({ label: 'All follow-ups', action: 'tab', data: { tab: 'activity' }, size: 'sm', variant: 'ghost' }) })}
    ${due.length
      ? html`<ul class="follow-list">${due.slice(0, 4).map((f) => followUpRow(f, ctx))}</ul>${due.length > 4 ? html`<p class="caption">+${due.length - 4} more in Activity</p>` : ''}`
      : emptyState({ icon: 'square-check-big', title: 'Nothing due today', body: 'Follow-ups you create after visits appear here on their due date.' })}
  `);
}

function suggestions(ctx, day) {
  const picks = ctx.suggestions(day, 3);
  return card(html`
    ${sectionHead('Who to see', { sub: 'Ranked by follow-ups, leakage and volume' })}
    ${picks.length
      ? html`<ul class="entity-list">${picks.map(({ entity, signals }) => {
        const selected = ctx.isSelected(entity.id);
        return html`<li class="entity-item${selected ? ' is-selected' : ''}">
          <button type="button" class="entity-row" data-action="openProfile" data-id="${entity.id}">${avatar(entity)}<span class="entity-main"><span class="row-title">${entity.name}</span><span class="caption">${subtitle(entity)}</span><span class="tag-row">${signalTags(signals, 2)}</span></span></button>
          <button type="button" class="select-toggle" data-action="toggleSelect" data-id="${entity.id}" aria-pressed="${selected}" aria-label="${selected ? 'Remove' : 'Add'} ${entity.name} ${selected ? 'from' : 'to'} the plan">${icon(selected ? 'check' : 'plus')}</button>
        </li>`;
      })}</ul>`
      : emptyState({ icon: 'sparkles', title: 'Everyone suggested is planned', body: 'Search Targets for more people and accounts.' })}
    ${button({ label: 'Search all targets', icon: 'search', action: 'tab', data: { tab: 'targets' }, variant: 'ghost', size: 'sm' })}
  `);
}

function weekCard(ctx) {
  const s = ctx.weekStats();
  return card(html`
    ${sectionHead('This week', { sub: 'Your activity on this device and in the sample history' })}
    ${kpis([
      { label: 'Logged · last 7 days', value: String(s.logged), sub: 'Visits, calls and notes' },
      { label: 'People seen · 30 days', value: `${s.seen}/${s.people}` },
      { label: 'Open follow-ups', value: String(s.open), tone: s.overdue ? 'orange' : '', sub: s.overdue ? `${s.overdue} overdue` : 'None overdue' },
    ])}
  `);
}
