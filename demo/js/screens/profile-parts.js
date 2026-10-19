// Building blocks shared by the HCP and HCO profiles.

import { briefText, buildBrief, visitWhen } from '../brief.js';
import { diagnosesOf, getEntity, getHcp, proceduresOf } from '../data/index.js';
import { formatDate, formatNumber, html, lastQuarters, relativeDay, sum, yoy, fromIso, daysBetween } from '../format.js';
import { addSeries } from '../data/series.js';
import { avatar, button, card, delta, emptyState, icon, quarterBars, sectionHead, segmented, sparkline, tag, unavailableState } from '../ui.js';

const TYPE_ICONS = { 'In-person visit': 'handshake', 'Phone call': 'phone', 'Video call': 'video', Email: 'mail', Meeting: 'users' };

/** Add to plan / selected / already planned, for the day the rep is planning. */
export function planButton(entity, ctx) {
  const item = ctx.planItemFor(entity.id, ctx.ws.selection.day);
  const dayName = ctx.dayWord(ctx.ws.selection.day);
  if (item) {
    const when = item.mode === 'timed' ? item.time : 'flexible';
    return button({ label: `In ${dayName}'s plan · ${when}`, icon: 'calendar-days', action: 'reviewPlan', variant: 'secondary' });
  }
  const selected = ctx.isSelected(entity.id);
  return button({
    label: selected ? `Selected for ${dayName}` : 'Add to plan',
    icon: selected ? 'check' : 'calendar-plus',
    action: 'toggleSelect',
    data: { id: entity.id },
    variant: selected ? 'selected' : 'primary',
    pressed: selected,
  });
}

export function profileActions(entity, ctx) {
  return html`<div class="profile-actions">
    ${planButton(entity, ctx)}
    ${button({ label: 'Book a time', icon: 'calendar-clock', action: 'bookVisit', data: { target: entity.id } })}
    ${button({ label: 'Log visit', icon: 'notebook-pen', action: 'addNote', data: { target: entity.id } })}
    ${button({ label: 'Follow-up', icon: 'calendar-plus', action: 'addFollowUp', data: { target: entity.id } })}
  </div>`;
}

/** Last contact and plan status, shown under the profile name. */
export function contactLine(entity, ctx) {
  const last = ctx.lastInteraction(entity.id);
  const item = ctx.planItemFor(entity.id, ctx.todayIso);
  const parts = [last ? `Last contact ${relativeDay(last.date, ctx.today).toLowerCase()} · ${last.type.toLowerCase()}` : 'No contact logged yet'];
  if (item) parts.push(`In today's plan${item.mode === 'timed' ? ` at ${item.time}` : ''}`);
  return html`<p class="profile-status">${icon('clock')}<span>${parts.join(' · ')}</span></p>`;
}

/**
 * The first card on a profile, and what Prepare opens: why see them now, the
 * goal, three talking points and open follow-ups. With a visit coming up it
 * says when; Copy gives the same brief as text.
 */
export function whyCard(entity, ctx) {
  const b = buildBrief(entity, ctx);
  const requested = b.visit?.item.booking === 'requested';
  return card(html`
    ${sectionHead(b.visit ? 'Before your visit' : 'Why reach out', {
      sub: b.visit ? `${visitWhen(b.visit, entity)}${requested ? ' · not confirmed yet' : ''}` : 'Sample signals from claims and your activity',
      actions: button({ label: 'Copy brief', icon: 'copy', action: 'copy', data: { value: briefText(entity, b), label: 'brief' }, size: 'sm', variant: 'ghost', iconOnly: true }),
    })}
    <p class="insight">${icon('lightbulb')}<span>${b.insight}</span></p>
    ${entity.kind === 'hcp' && (entity.contact.preferred || entity.contact.assistant) ? html`<p class="profile-status">${icon('clock')}<span>${[
      entity.contact.preferred && `Best time: ${entity.contact.preferred}`,
      entity.contact.assistant && `Book through ${entity.contact.assistant}`,
    ].filter(Boolean).join(' · ')}</span></p>` : ''}
    <p class="next-goal">${icon('target')}<span><span class="kicker">${b.goalSuggested ? 'Suggested goal' : 'Goal'}</span> ${b.goal}</span></p>
    ${b.points.length ? html`<ul class="brief-points" aria-label="Talking points">${b.points.map((p) => html`<li>${icon(p.icon)}<span>${p.text}</span></li>`)}</ul>` : ''}
    ${b.followUps.length ? html`<ul class="follow-list">${b.followUps.map((f) => followUpRow(f, ctx, { showTarget: false }))}</ul>` : ''}
  `, 'why-card');
}

// ---- Volumes --------------------------------------------------------------

export function volumesPanel(entity, ctx) {
  const mode = ctx.entry.ui.volumes || 'procedures';
  const rows = mode === 'procedures' ? proceduresOf(entity) : diagnosesOf(entity);
  const labels = lastQuarters(ctx.today);
  const unit = mode === 'procedures' ? 'procedures' : 'patients';
  const toggle = segmented([{ id: 'procedures', label: 'Procedures' }, { id: 'diagnoses', label: 'Diagnoses' }], mode, 'volumeMode', { label: 'Volume type', key: 'mode' });

  if (!rows) {
    return html`${toggle}${unavailableState({ title: 'Procedure volumes unavailable', body: entity.proceduresUnavailable || 'No procedure data in your code group.' })}`;
  }
  if (!rows.length) return html`${toggle}${emptyState({ icon: 'chart-column', title: `No ${unit} in this period` })}`;

  const total = addSeries(rows.map((r) => r.series));
  const last4 = sum(total.slice(-4));
  const sorted = [...rows].sort((a, b) => sum(b.series.slice(-4)) - sum(a.series.slice(-4)));
  const max = Math.max(...sorted.map((r) => sum(r.series.slice(-4))));

  return html`
    ${toggle}
    ${card(html`
      <div class="volume-total">
        <div>
          <p class="eyebrow">${mode === 'procedures' ? 'Procedures' : 'Diagnosed patients'} · last 12 months</p>
          <p class="big-number">${formatNumber(last4)}</p>
          ${delta(yoy(total))}
        </div>
        <div class="volume-spark">${sparkline(total, { width: 140, height: 44 })}<span class="caption">${labels[0]} – ${labels.at(-1)}</span></div>
      </div>
      ${quarterBars(total, labels, `${mode === 'procedures' ? 'Procedures' : 'Patients'} per quarter`)}
      <p class="fineprint">${icon('info')} Illustrative sample figures, not claims data. ${mode === 'diagnoses' ? 'Patients are counted per quarter.' : ''}</p>
    `)}
    ${card(html`
      ${sectionHead(mode === 'procedures' ? 'By procedure family' : 'By diagnosis', { sub: 'Tap a row for the quarterly trend' })}
      <ul class="volume-list">${sorted.map((r) => {
        const value = sum(r.series.slice(-4));
        const name = r.family || r.name;
        return html`<li><details class="volume-row">
          <summary>
            <span class="volume-name"><span>${name}</span><span class="caption">${r.code}</span></span>
            <span class="volume-figures"><span class="volume-value">${formatNumber(value)}</span>${delta(yoy(r.series))}</span>
            <span class="volume-trend">${sparkline(r.series)}</span>
            <span class="bar bar-accent" style="--w:${Math.max(2, Math.round((value / max) * 100))}%"></span>
          </summary>
          ${quarterBars(r.series, labels, `${name} per quarter`)}
        </details></li>`;
      })}</ul>
    `)}
  `;
}

// ---- Notes, interactions and follow-ups -----------------------------------

export function followUpRow(f, ctx, { showTarget = true } = {}) {
  const diff = daysBetween(ctx.today, fromIso(f.due));
  const tone = f.done ? 'neutral' : diff < 0 ? 'danger' : diff === 0 ? 'warn' : 'neutral';
  const target = getEntity(f.targetId);
  const dueLabel = f.done ? `Done ${relativeDay(f.doneOn || f.due, ctx.today).toLowerCase()}` : diff < 0 ? `Overdue · ${relativeDay(f.due, ctx.today).toLowerCase()}` : `Due ${relativeDay(f.due, ctx.today).toLowerCase()}`;
  return html`<li class="follow-row${f.done ? ' is-done' : ''}">
    <button type="button" class="check" role="checkbox" aria-checked="${f.done}" data-action="toggleFollowUp" data-id="${f.id}" aria-label="${f.done ? 'Mark not done' : 'Mark done'}: ${f.text}">${icon('check')}</button>
    <button type="button" class="follow-body" data-action="editFollowUp" data-id="${f.id}">
      <span class="follow-text">${f.text}</span>
      <span class="follow-meta">${tag(dueLabel, tone)}${showTarget && target ? html`<span class="caption">${target.name}</span>` : ''}</span>
    </button>
  </li>`;
}

export function interactionItem(i, ctx, { showTarget = false } = {}) {
  const target = getEntity(i.targetId);
  const people = (i.attendees || []).filter((id) => id !== i.targetId).map(getHcp).filter(Boolean);
  const mine = i.author === 'You';
  return html`<li class="timeline-item">
    <span class="timeline-icon" aria-hidden="true">${icon(TYPE_ICONS[i.type] || 'message-square')}</span>
    <article class="timeline-body">
      <header>
        <p class="timeline-title">${showTarget && target ? html`<button type="button" class="link" data-action="openProfile" data-id="${target.id}" data-tab="activity">${target.name}</button> · ` : ''}${i.type}</p>
        <p class="caption">${formatDate(i.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · ${i.author}${i.edited ? ' · edited' : ''}</p>
      </header>
      <div class="timeline-tags">${tag(i.outcome, i.outcome === 'Met' ? 'success' : i.outcome === 'Attempted' ? 'warn' : 'neutral')}${i.spoken ? html`<span class="tag tag-neutral">${icon('mic')}Spoken</span>` : ''}${i.local ? tag('Saved on this device', 'neutral') : ''}</div>
      ${i.note ? html`<p class="timeline-note">${i.note}</p>` : html`<p class="timeline-note muted">No note written.</p>`}
      ${people.length || i.contacts?.length ? html`<p class="caption">With ${[...people.map((p) => p.name), ...(i.contacts || [])].join(', ')}</p>` : ''}
      ${mine ? html`<div class="timeline-actions">${button({ label: 'Edit', icon: 'pencil', action: 'editNote', data: { id: i.id }, variant: 'ghost', size: 'sm' })}</div>` : ''}
    </article>
  </li>`;
}

export function activityPanel(entity, ctx) {
  const ids = new Set([entity.id]);
  const interactions = ctx.ws.interactions
    .filter((i) => !i.deleted && (ids.has(i.targetId) || i.attendees?.includes(entity.id)))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
  const follow = ctx.ws.followUps.filter((f) => f.targetId === entity.id).sort((a, b) => a.due.localeCompare(b.due));
  const open = follow.filter((f) => !f.done);
  const done = follow.filter((f) => f.done);
  const draft = ctx.ws.drafts[entity.id];
  const hasDraft = draft && (draft.note?.trim() || draft.followText?.trim());

  return html`
    ${card(html`
      ${sectionHead('Follow-ups', { actions: button({ label: 'New follow-up', icon: 'plus', action: 'addFollowUp', data: { target: entity.id }, size: 'sm' }) })}
      ${open.length ? html`<ul class="follow-list">${open.map((f) => followUpRow(f, ctx, { showTarget: false }))}</ul>` : emptyState({ icon: 'square-check-big', title: 'No open follow-ups', body: 'Create one after a visit so the next step isn’t lost.' })}
      ${done.length ? html`<details class="done-group"><summary>${done.length} completed</summary><ul class="follow-list">${done.map((f) => followUpRow(f, ctx, { showTarget: false }))}</ul></details>` : ''}
    `)}
    ${card(html`
      ${sectionHead('Notes & interactions', { sub: 'Visits, calls and meetings, newest first', actions: button({ label: 'Add note', icon: 'notebook-pen', action: 'addNote', data: { target: entity.id }, size: 'sm', variant: 'primary' }) })}
      ${hasDraft ? html`<div class="draft-banner">${icon('pencil')}<span>You have an unsaved note${draft.updatedAt ? ` from ${relativeDay(draft.updatedAt.slice(0, 10), ctx.today).toLowerCase()}` : ''}.</span>${button({ label: 'Resume', action: 'addNote', data: { target: entity.id }, size: 'sm' })}</div>` : ''}
      ${interactions.length
        ? html`<ol class="timeline">${interactions.map((i) => interactionItem(i, ctx))}</ol>`
        : emptyState({ icon: 'message-square', title: 'No interactions yet', body: 'Log your first visit or call to start the history for this profile.', actions: button({ label: 'Log first visit', icon: 'notebook-pen', action: 'addNote', data: { target: entity.id }, variant: 'primary' }) })}
    `)}
  `;
}

/** Profile sections that exist on the web platform but are not in the app yet. */
export function webSections(entity) {
  return card(html`
    ${sectionHead('More on the web profile', { sub: 'These sections are in the DocNexus platform and are coming to the app later.' })}
    <ul class="soon-list">${entity.webSections.map((s) => html`<li>${s}${tag('Coming later', 'neutral')}</li>`)}</ul>
  `);
}

/** Header shared by both profile types. */
export function profileHeader(entity, ctx, { kicker, title, sub, chips }) {
  return html`<header class="profile-head">
    ${avatar(entity, 'avatar-xl')}
    <div class="profile-id">
      <p class="eyebrow">${kicker}</p>
      <h1 class="profile-name">${title}</h1>
      <p class="profile-sub">${sub}</p>
      ${chips ? html`<div class="tag-row">${chips}</div>` : ''}
      ${contactLine(entity, ctx)}
    </div>
  </header>`;
}

export const sampleNote = () => html`<p class="fineprint">${icon('info')} Sample profile. People are fictional; facility names and locations are public records.</p>`;
