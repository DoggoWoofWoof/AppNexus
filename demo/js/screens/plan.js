// Review plan: every selected target and existing visit for a day in one list.
// Edits stay in a draft until the rep saves, so nothing is half-planned.

import { getEntity, siteFor } from '../data/index.js';
import { REP } from '../data/seed.js';
import { formatDate, html, plural } from '../format.js';
import { mapView } from '../map.js';
import { DURATIONS, VISIT_TYPES, conflicts, endTime, isOnSite, routeDistance, routeOrder } from '../plan.js';
import { avatar, button, emptyState, icon, kpis, segmented, tag } from '../ui.js';

export const title = () => 'Review plan';

export function render(ctx) {
  const draft = ctx.planDraft();
  const items = routeOrder(draft.items.filter((i) => i.status !== 'cancelled'));
  const cancelled = draft.items.filter((i) => i.status === 'cancelled');
  const clashes = conflicts(draft.items);
  const clashIds = new Set(clashes.flat().map((i) => i.id));
  const coordsOf = (item) => siteFor(getEntity(item.targetId), item.siteId).coords;
  const km = routeDistance(items, coordsOf, REP.start.coords);
  const onSite = items.filter(isOnSite);
  const added = items.filter((i) => i.isNew).length;
  const dayOptions = ctx.planDays().map((d) => ({ id: d.iso, label: d.label }));

  return html`
    <header class="page-head">
      <p class="eyebrow">Review plan</p>
      <h1>${ctx.dayName(draft.day)} · ${formatDate(draft.day)}</h1>
      <p class="page-sub">Check times and order, then save once. Nothing changes until you save${added ? html` · <strong>${plural(added, 'new stop')}</strong>` : ''}.</p>
    </header>
    ${segmented(dayOptions, draft.day, 'planDay', { label: 'Day to plan', key: 'day' })}
    ${kpis([
      { label: 'Stops', value: String(items.length), sub: `${onSite.length} on site · ${items.length - onSite.length} remote` },
      { label: 'Planned times', value: String(items.filter((i) => i.mode === 'timed').length), sub: `${items.filter((i) => i.mode !== 'timed').length} flexible` },
      { label: 'Straight-line distance', value: `${km.toFixed(1)} km`, sub: `From ${REP.start.label}` },
    ])}
    ${clashes.length ? html`<div class="banner banner-danger" role="alert">${icon('triangle-alert')}<span><strong>${plural(clashes.length, 'time clash', 'time clashes')}.</strong> ${clashes.map(([a, b]) => `${getEntity(a.targetId).name} (${a.time}–${endTime(a)}) overlaps ${getEntity(b.targetId).name} (${b.time})`).join('; ')}. Change a time or make one flexible to save.</span></div>` : ''}
    ${items.length ? html`
      ${onSite.length ? mapView({
        points: onSite.map((i) => ({ id: i.siteId, coords: coordsOf(i), text: String(items.indexOf(i) + 1), title: `Stop ${items.indexOf(i) + 1}: ${getEntity(i.targetId).name}`, tone: 'planned' })),
        start: REP.start,
        route: true,
        action: null,
        label: `Route order for ${plural(onSite.length, 'on-site stop')}`,
        height: 220,
        caption: 'Dashed line shows stop order, not a driving route',
      }) : ''}
      <ol class="plan-list">${items.map((item, index) => stop(item, index, items, clashIds, ctx))}</ol>
      <div class="plan-tools">
        ${button({ label: 'Suggest order, nearest first', icon: 'route', action: 'planSuggest', variant: 'ghost', disabled: items.filter((i) => i.mode !== 'timed').length < 2 })}
        ${button({ label: 'Add more targets', icon: 'plus', action: 'planAddMore', variant: 'ghost' })}
      </div>
    ` : emptyState({ icon: 'calendar-days', title: 'No stops yet', body: 'Select people or accounts in Targets, then come back to set times and order.', actions: button({ label: 'Find targets', icon: 'target', action: 'planAddMore', variant: 'primary' }) })}
    ${cancelled.length ? html`<details class="done-group"><summary>${plural(cancelled.length, 'cancelled visit')}</summary><ul class="entity-list">${cancelled.map((i) => html`<li class="entity-item"><span class="entity-row is-static">${avatar(getEntity(i.targetId))}<span class="entity-main"><span class="row-title strike">${getEntity(i.targetId).name}</span><span class="caption">${i.mode === 'timed' ? i.time : 'Flexible'} · ${i.cancelReason || 'Cancelled'}</span></span></span>${button({ label: 'Restore', action: 'planRestore', data: { item: i.id }, size: 'sm' })}</li>`)}</ul></details>` : ''}
    <div class="sticky-actions">
      ${button({ label: 'Discard changes', action: 'planDiscard', variant: 'ghost', disabled: !ctx.planDirty() })}
      ${button({ label: added ? `Save plan · ${plural(added, 'new stop')}` : 'Save plan', icon: 'check', action: 'planSave', variant: 'primary', disabled: !!clashes.length || !ctx.planDirty() })}
    </div>
  `;
}

function stop(item, index, items, clashIds, ctx) {
  const target = getEntity(item.targetId);
  const flexible = items.filter((i) => i.mode !== 'timed');
  const fi = flexible.indexOf(item);
  const id = item.id;
  const sites = target.kind === 'hcp' ? target.affiliations.map((a) => getEntity(a.orgId)) : [];
  return html`<li class="plan-stop${clashIds.has(id) ? ' has-clash' : ''}">
    <div class="plan-stop-head">
      <span class="pin-number" aria-hidden="true">${index + 1}</span>
      ${avatar(target)}
      <div class="entity-main">
        <button type="button" class="link row-title" data-action="openProfile" data-id="${target.id}">${target.name}</button>
        <span class="caption">${siteFor(target, item.siteId).name}</span>
      </div>
      ${item.isNew ? tag('New', 'accent') : ''}
      ${button({ label: `Remove ${target.name} from the plan`, icon: 'x', action: 'planRemove', data: { item: id }, variant: 'ghost', iconOnly: true })}
    </div>
    <div class="plan-fields">
      <label class="field"><span>Activity</span><select id="plan-type-${id}" data-change="planField" data-item="${id}" data-field="type">${VISIT_TYPES.map((t) => html`<option ${t === item.type ? 'selected' : ''}>${t}</option>`)}</select></label>
      ${sites.length > 1 ? html`<label class="field"><span>Location</span><select id="plan-site-${id}" data-change="planField" data-item="${id}" data-field="siteId">${sites.map((s) => html`<option value="${s.id}" ${s.id === item.siteId ? 'selected' : ''}>${s.name}</option>`)}</select></label>` : ''}
      <label class="field"><span>Timing</span><select id="plan-mode-${id}" data-change="planField" data-item="${id}" data-field="mode"><option value="flexible" ${item.mode !== 'timed' ? 'selected' : ''}>Flexible · any time</option><option value="timed" ${item.mode === 'timed' ? 'selected' : ''}>Planned time</option></select></label>
      ${item.mode === 'timed' ? html`<label class="field"><span>Start</span><input type="time" id="plan-time-${id}" data-change="planField" data-item="${id}" data-field="time" value="${item.time || '09:00'}" step="300"></label>` : ''}
      <label class="field"><span>Duration</span><select id="plan-duration-${id}" data-change="planField" data-item="${id}" data-field="duration">${DURATIONS.map((d) => html`<option value="${d}" ${d === item.duration ? 'selected' : ''}>${d} min</option>`)}</select></label>
      <label class="field field-wide"><span>Goal <span class="muted">(optional)</span></span><input type="text" id="plan-goal-${id}" data-input="planGoal" data-item="${id}" value="${item.goal || ''}" placeholder="What do you want from this visit?" maxlength="140"></label>
    </div>
    ${item.mode !== 'timed' && flexible.length > 1 ? html`<div class="plan-move">
      ${button({ label: 'Move earlier', icon: 'arrow-up', action: 'planMove', data: { item: id, dir: -1 }, variant: 'ghost', size: 'sm', disabled: fi === 0 })}
      ${button({ label: 'Move later', icon: 'arrow-down', action: 'planMove', data: { item: id, dir: 1 }, variant: 'ghost', size: 'sm', disabled: fi === flexible.length - 1 })}
    </div>` : ''}
  </li>`;
}
