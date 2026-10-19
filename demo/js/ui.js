// Shared render helpers. Every helper returns an html`` fragment.

import { ICONS } from './icons.js';
import { esc, formatNumber, formatPct, html, initials, raw } from './format.js';

export function icon(name, { label, className = '' } = {}) {
  const body = ICONS[name];
  if (!body) throw new Error(`Unknown icon: ${name}`);
  const a11y = label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true" focusable="false"';
  return raw(`<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${body}</svg>`);
}

/** data-* attributes from an object; values are escaped. */
export function dataAttrs(data = {}) {
  return raw(Object.entries(data)
    .filter(([, v]) => v != null && v !== false)
    .map(([k, v]) => ` data-${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}="${esc(v)}"`)
    .join(''));
}

/**
 * A button. `action` names the handler in actions.js; buttons without an
 * action must be disabled and say why (see `soon`).
 */
export function button({ label, icon: iconName, action, data, variant = 'secondary', size = '', disabled = false, pressed, ariaLabel, className = '', type = 'button', iconOnly = false }) {
  const cls = ['btn', `btn-${variant}`, size && `btn-${size}`, iconOnly && 'btn-icon', className].filter(Boolean).join(' ');
  return html`<button type="${type}" class="${cls}"${action ? raw(` data-action="${esc(action)}"`) : ''}${dataAttrs(data)}${disabled ? raw(' disabled') : ''}${pressed != null ? raw(` aria-pressed="${pressed}"`) : ''}${ariaLabel || iconOnly ? raw(` aria-label="${esc(ariaLabel || label)}"`) : ''}>${iconName ? icon(iconName) : ''}${iconOnly ? '' : html`<span>${label}</span>`}</button>`;
}

/** A clearly unavailable control with its reason, for features that are coming later. */
export function soon(label, reason = 'Coming later', iconName) {
  return html`<span class="soon"><button type="button" class="btn btn-secondary" disabled>${iconName ? icon(iconName) : ''}<span>${label}</span><span class="sr-only"> (${reason})</span></button><span class="soon-tag" aria-hidden="true">${reason}</span></span>`;
}

export const tag = (label, tone = 'neutral') => html`<span class="tag tag-${tone}">${label}</span>`;

export const signalTags = (signals, max = 3) => signals.slice(0, max).map((s) => tag(s.label, s.tone));

export function avatar(entity, size = '') {
  const kind = entity.kind === 'hco' ? 'org' : 'person';
  const glyph = entity.type === 'Health system' ? icon('network') : entity.type === 'Clinic' ? icon('stethoscope') : icon('hospital');
  return html`<span class="avatar avatar-${kind} ${size}" aria-hidden="true">${entity.kind === 'hco' ? glyph : initials(entity.name)}</span>`;
}

export function sectionHead(title, { sub, actions, level = 2, id } = {}) {
  return html`<div class="section-head"><div>${raw(`<h${level} class="section-title"${id ? ` id="${esc(id)}"` : ''}>`)}${title}${raw(`</h${level}>`)}${sub ? html`<p class="section-sub">${sub}</p>` : ''}</div>${actions ? html`<div class="section-actions">${actions}</div>` : ''}</div>`;
}

export const card = (content, className = '') => html`<section class="card ${className}">${content}</section>`;

export function kpis(items) {
  return html`<dl class="kpis">${items.map((k) => html`<div class="kpi${k.tone ? ` kpi-${k.tone}` : ''}"><dt>${k.label}</dt><dd><span class="kpi-value">${k.value}</span>${k.delta != null ? delta(k.delta) : ''}</dd>${k.sub ? html`<p class="kpi-sub">${k.sub}</p>` : ''}</div>`)}</dl>`;
}

/** A coloured year-over-year change, e.g. "+12%". */
export function delta(value, { suffix = ' YoY' } = {}) {
  if (value == null || Number.isNaN(value)) return '';
  const tone = value >= 1 ? 'up' : value <= -1 ? 'down' : 'flat';
  const glyph = tone === 'up' ? icon('trending-up') : tone === 'down' ? icon('trending-down') : '';
  return html`<span class="delta delta-${tone}">${glyph}${formatPct(value)}${suffix}</span>`;
}

/** Inline SVG trend line for a short series. Decorative: values are always shown as text nearby. */
export function sparkline(values, { width = 96, height = 28 } = {}) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(height - 3 - ((v - min) / span) * (height - 6)).toFixed(1)}`).join(' ');
  const [lx, ly] = points.split(' ').pop().split(',');
  return raw(`<svg class="spark" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${lx}" cy="${ly}" r="2.5" fill="currentColor"/></svg>`);
}

/** Quarterly bars with labels; doubles as an accessible table. */
export function quarterBars(values, labels, caption) {
  const max = Math.max(...values, 1);
  return html`<table class="qbars"><caption class="sr-only">${caption}</caption><tbody><tr>${values.map((v, i) => html`<td><span class="qbar-value">${formatNumber(v)}</span><span class="qbar" style="--h:${Math.max(4, Math.round((v / max) * 100))}"></span><span class="qbar-label">${labels[i]}</span></td>`)}</tr></tbody></table>`;
}

/** Horizontal share bar with a label and value. */
export function barRow({ label, sub, value, display, max, tone = 'accent', href, labelHtml }) {
  const pct = Math.max(2, Math.round((value / (max || 1)) * 100));
  return html`<div class="bar-row"><div class="bar-row-top"><span class="bar-label">${labelHtml || label}${sub ? html`<span class="bar-sub">${sub}</span>` : ''}</span><span class="bar-value">${display ?? formatNumber(value)}</span></div><span class="bar bar-${tone}" style="--w:${pct}%"></span></div>`;
}

export function emptyState({ icon: iconName = 'inbox', title, body, actions = '' }) {
  return html`<div class="state state-empty">${icon(iconName)}<h3>${title}</h3>${body ? html`<p>${body}</p>` : ''}${actions ? html`<div class="state-actions">${actions}</div>` : ''}</div>`;
}

export function unavailableState({ title, body }) {
  return html`<div class="state state-unavailable">${icon('lock')}<h3>${title}</h3><p>${body}</p></div>`;
}

export function errorState({ title, body, actions }) {
  return html`<div class="state state-error" role="alert">${icon('triangle-alert')}<h3>${title}</h3><p>${body}</p><div class="state-actions">${actions}</div></div>`;
}

/** Placeholder blocks shaped like the content that is loading. */
export function skeleton(kind = 'profile') {
  const line = (w) => html`<span class="sk sk-line" style="width:${w}"></span>`;
  const rows = (n) => html`${Array.from({ length: n }, () => html`<div class="sk-row"><span class="sk sk-avatar"></span><div class="sk-stack">${line('60%')}${line('85%')}</div></div>`)}`;
  if (kind === 'list') return html`<div class="skeleton" aria-busy="true" aria-label="Loading">${rows(6)}</div>`;
  return html`<div class="skeleton" aria-busy="true" aria-label="Loading profile"><div class="sk-row"><span class="sk sk-avatar sk-lg"></span><div class="sk-stack">${line('70%')}${line('45%')}</div></div><span class="sk sk-block"></span>${rows(3)}<span class="sk sk-block"></span></div>`;
}

export function segmented(options, current, action, { label, key = 'value' } = {}) {
  return html`<div class="segmented" role="group" aria-label="${label}">${options.map((o) => html`<button type="button" data-action="${action}"${dataAttrs({ [key]: o.id })} aria-pressed="${o.id === current}">${o.icon ? icon(o.icon) : ''}<span>${o.label}</span>${o.count != null ? html`<span class="count">${o.count}</span>` : ''}</button>`)}</div>`;
}

/** Tabs that switch in-page panels; selection is kept on the navigation entry. */
export function tabs(items, current, { label, action = 'profileTab' }) {
  return html`<div class="tabs" role="tablist" aria-label="${label}">${items.map((t) => html`<button type="button" role="tab" id="tab-${t.id}" aria-controls="panel-${t.id}" aria-selected="${t.id === current}" tabindex="${t.id === current ? 0 : -1}" data-action="${action}" data-tab="${t.id}">${t.label}${t.count ? html`<span class="count">${t.count}</span>` : ''}</button>`)}</div>`;
}

export const panel = (id, content) => html`<div class="tab-panel" role="tabpanel" id="panel-${id}" aria-labelledby="tab-${id}" tabindex="0">${content}</div>`;

/** Label/value list for identity and contact details. */
export function details(rows) {
  return html`<dl class="details">${rows.filter(Boolean).map(([label, value, extra]) => html`<div class="detail"><dt>${label}</dt><dd>${value}${extra ? html` ${extra}` : ''}</dd></div>`)}</dl>`;
}

export function copyButton(value, label) {
  return button({ label: `Copy ${label}`, icon: 'copy', action: 'copy', data: { value, label }, variant: 'ghost', size: 'sm', iconOnly: true });
}

/** Wraps a fragment so it can be returned from a render function as a string. */
export const toHtml = (fragment) => String(fragment);
