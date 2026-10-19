// Bottom sheets (dialogs on wide screens). Each returns { title, content }.
// Form fields write straight to state as the rep types, so nothing is lost on Back.

import { allHcps, allOrgs, getEntity, getOrg, siteFor } from './data/index.js';
import { REP } from './data/seed.js';
import { addDays, formatDate, html, isoDate, plural } from './format.js';
import { VISIT_TYPES, endTime } from './plan.js';
import { DISTANCES, SORTS, activeFilterCount } from './search.js';
import { avatar, button, copyButton, dataAttrs, details, icon, soon, tag } from './ui.js';

export const OUTCOMES = ['Met', 'Attempted', 'Sent', 'Left message'];

export function renderSheet(sheet, ctx) {
  const fn = SHEETS[sheet.type];
  return fn ? fn(sheet, ctx) : null;
}

export const noteKey = (sheet) => (sheet.edit ? `edit:${sheet.edit}` : sheet.target || '_new');

/** The note being written: the saved draft, or defaults from the visit or note being edited. */
export function noteDraft(sheet, ctx) {
  const saved = ctx.ws.drafts[noteKey(sheet)];
  if (saved) return saved;
  if (sheet.edit) {
    const i = ctx.ws.interactions.find((x) => x.id === sheet.edit);
    return { targetId: i.targetId, type: i.type, outcome: i.outcome, date: i.date, note: i.note || '', contacts: i.contacts || [] };
  }
  const item = sheet.item ? (ctx.ws.plans[sheet.day] || []).find((i) => i.id === sheet.item) : null;
  const target = sheet.target ? getEntity(sheet.target) : null;
  return {
    targetId: sheet.target || '',
    type: item?.type || (target?.kind === 'hco' ? 'Meeting' : 'In-person visit'),
    outcome: 'Met',
    date: sheet.day && sheet.day <= ctx.todayIso ? sheet.day : ctx.todayIso,
    note: '',
    contacts: sheet.contact ? [sheet.contact] : [],
    followOn: false,
    followText: '',
    followDue: isoDate(addDays(ctx.today, 7)),
  };
}

const err = (sheet, field) => (sheet.error?.field === field ? html`<p class="field-error" id="err-${field}">${icon('circle-alert')}${sheet.error.message}</p>` : '');
const invalid = (sheet, field) => (sheet.error?.field === field ? html` aria-invalid="true" aria-describedby="err-${field}"` : '');

function targetPicker(sheet, current, { action, id }) {
  const people = allHcps().sort((a, b) => a.name.localeCompare(b.name));
  const orgs = allOrgs().sort((a, b) => a.name.localeCompare(b.name));
  return html`<label class="field field-wide"><span>Who is it with?</span>
    <select id="${id}" name="targetId" data-change="${action}"${invalid(sheet, 'targetId')}>
      <option value="">Choose a person or account</option>
      <optgroup label="People">${people.map((p) => html`<option value="${p.id}" ${p.id === current ? 'selected' : ''}>${p.name} · ${p.specialty}</option>`)}</optgroup>
      <optgroup label="Accounts">${orgs.map((o) => html`<option value="${o.id}" ${o.id === current ? 'selected' : ''}>${o.name}</option>`)}</optgroup>
    </select>${err(sheet, 'targetId')}</label>`;
}

const who = (entity, extra = '') => html`<div class="sheet-who">${avatar(entity)}<div class="entity-main"><span class="row-title">${entity.name}</span><span class="caption">${entity.kind === 'hcp' ? entity.specialty : entity.typeDetail}${extra ? ` · ${extra}` : ''}</span></div></div>`;

// ---- Note / log visit -----------------------------------------------------

function note(sheet, ctx) {
  const d = noteDraft(sheet, ctx);
  const target = d.targetId ? getEntity(d.targetId) : null;
  const item = sheet.item ? (ctx.ws.plans[sheet.day] || []).find((i) => i.id === sheet.item) : null;
  const hasDraft = !!ctx.ws.drafts[noteKey(sheet)];
  const title = sheet.edit ? 'Edit note' : item ? 'Log visit' : target ? 'Add note' : 'Log a visit';
  const field = (name, attrs = '') => html`data-input="noteField" data-field="${name}" name="${name}"${attrs}`;
  return {
    title,
    content: html`<form class="sheet-form" data-submit="saveNote" novalidate>
      <div class="sheet-body">
        ${target && (sheet.target || sheet.edit) ? who(target, item ? `${item.mode === 'timed' ? `${item.time}–${endTime(item)}` : 'Flexible'} · ${siteFor(target, item.siteId).name}` : '') : targetPicker(sheet, d.targetId, { action: 'noteTarget', id: 'note-target' })}
        ${item ? html`<p class="sheet-hint">${icon('circle-check')}Saving marks this visit as done in ${ctx.dayName(sheet.day).toLowerCase()}’s plan.</p>` : ''}
        <div class="field-grid">
          <label class="field"><span>Activity</span><select id="note-type" data-change="noteField" data-field="type" name="type">${VISIT_TYPES.map((t) => html`<option ${t === d.type ? 'selected' : ''}>${t}</option>`)}</select></label>
          <label class="field"><span>Outcome</span><select id="note-outcome" data-change="noteField" data-field="outcome" name="outcome">${OUTCOMES.map((o) => html`<option ${o === d.outcome ? 'selected' : ''}>${o}</option>`)}</select></label>
          <label class="field"><span>Date</span><input type="date" id="note-date" data-change="noteField" data-field="date" name="date" value="${d.date}" max="${ctx.todayIso}"${invalid(sheet, 'date')}>${err(sheet, 'date')}</label>
        </div>
        ${d.contacts?.length ? html`<p class="caption">With ${d.contacts.join(', ')}</p>` : ''}
        <label class="field field-wide"><span>Note</span>
          <textarea id="note-text" rows="6" maxlength="2000" ${field('note')} placeholder="What was discussed, what they asked for, what happens next">${d.note}</textarea>
          <span class="field-hint">${icon('save')}Kept as a draft on this device while you type.</span>
        </label>
        ${sheet.edit ? '' : html`
          <label class="check-field"><input type="checkbox" id="note-follow" data-change="noteField" data-field="followOn" name="followOn" ${d.followOn ? 'checked' : ''}><span>Create a follow-up</span></label>
          ${d.followOn ? html`<div class="field-grid follow-fields">
            <label class="field field-wide"><span>Follow-up</span><input type="text" id="note-follow-text" ${field('followText')} value="${d.followText}" maxlength="140" placeholder="e.g. Send the outcomes summary"${invalid(sheet, 'followText')}>${err(sheet, 'followText')}</label>
            <label class="field"><span>Due</span><input type="date" id="note-follow-due" data-change="noteField" data-field="followDue" name="followDue" value="${d.followDue}" min="${ctx.todayIso}"></label>
          </div>` : ''}
        `}
      </div>
      <footer class="sheet-foot">
        ${sheet.edit ? button({ label: 'Delete note', icon: 'trash-2', action: 'deleteNote', data: { id: sheet.edit }, variant: 'danger' }) : hasDraft ? button({ label: 'Discard draft', action: 'discardDraft', data: { key: noteKey(sheet) }, variant: 'ghost' }) : ''}
        <span class="spacer"></span>
        ${button({ label: hasDraft && !sheet.edit ? 'Keep draft' : 'Cancel', action: 'closeSheet', variant: 'ghost' })}
        ${button({ label: sheet.edit ? 'Save changes' : item ? 'Save & mark done' : 'Save note', icon: 'check', type: 'submit', variant: 'primary' })}
      </footer>
    </form>`,
  };
}

// ---- Follow-up ------------------------------------------------------------

export function followDraft(sheet, ctx) {
  if (sheet.values) return sheet.values;
  const existing = sheet.id ? ctx.ws.followUps.find((f) => f.id === sheet.id) : null;
  return existing
    ? { targetId: existing.targetId, text: existing.text, due: existing.due }
    : { targetId: sheet.target || '', text: '', due: isoDate(addDays(ctx.today, 1)) };
}

function followup(sheet, ctx) {
  const v = followDraft(sheet, ctx);
  const existing = sheet.id ? ctx.ws.followUps.find((f) => f.id === sheet.id) : null;
  const target = v.targetId ? getEntity(v.targetId) : null;
  const quick = [[1, 'Tomorrow'], [3, 'In 3 days'], [7, 'Next week'], [14, 'In 2 weeks']];
  return {
    title: existing ? 'Edit follow-up' : 'New follow-up',
    content: html`<form class="sheet-form" data-submit="saveFollowUp" novalidate>
      <div class="sheet-body">
        ${target && (sheet.target || existing) ? who(target) : targetPicker(sheet, v.targetId, { action: 'followTarget', id: 'follow-target' })}
        <label class="field field-wide"><span>What needs to happen?</span><input type="text" id="follow-text" name="text" data-input="followField" data-field="text" value="${v.text}" maxlength="140" placeholder="e.g. Send the procedure mix report"${invalid(sheet, 'text')}>${err(sheet, 'text')}</label>
        <label class="field"><span>Due</span><input type="date" id="follow-due" name="due" data-change="followField" data-field="due" value="${v.due}"${invalid(sheet, 'due')}>${err(sheet, 'due')}</label>
        <div class="chip-row" role="group" aria-label="Quick due dates">${quick.map(([n, label]) => {
          const iso = isoDate(addDays(ctx.today, n));
          return html`<button type="button" class="chip" data-action="followDue" data-due="${iso}" aria-pressed="${v.due === iso}">${label}</button>`;
        })}</div>
        ${existing?.done ? html`<p class="sheet-hint">${icon('circle-check')}Completed ${formatDate(existing.doneOn || existing.due)}.</p>` : ''}
      </div>
      <footer class="sheet-foot">
        ${existing ? button({ label: 'Delete', icon: 'trash-2', action: 'deleteFollowUp', data: { id: existing.id }, variant: 'danger' }) : ''}
        <span class="spacer"></span>
        ${button({ label: 'Cancel', action: 'closeSheet', variant: 'ghost' })}
        ${button({ label: existing ? 'Save changes' : 'Create follow-up', icon: 'check', type: 'submit', variant: 'primary' })}
      </footer>
    </form>`,
  };
}

// ---- Executive contact ----------------------------------------------------

function contact(sheet) {
  const org = getOrg(sheet.org);
  const e = org.executives.find((x) => x.id === sheet.exec);
  return {
    title: e.name,
    content: html`<div class="sheet-body">
      <div class="sheet-who">${avatar({ name: e.name }, 'avatar-lg')}<div class="entity-main"><span class="row-title">${e.title}</span><span class="caption">${org.name}</span><span class="tag-row">${tag(e.role, 'accent')}${tag('Sample contact', 'neutral')}</span></div></div>
      ${details([
        ['Phone', e.phone, copyButton(e.phone, 'phone number')],
        ['Email', e.email, copyButton(e.email, 'email address')],
        ['Organization', html`<button type="button" class="link" data-action="openProfile" data-id="${org.id}">${org.name}</button>`],
      ])}
    </div>
    <footer class="sheet-foot">
      <span class="spacer"></span>
      ${button({ label: 'Follow-up', icon: 'calendar-plus', action: 'addFollowUp', data: { target: org.id } })}
      ${button({ label: 'Log meeting', icon: 'notebook-pen', action: 'addNote', data: { target: org.id, contact: e.name }, variant: 'primary' })}
    </footer>`,
  };
}

// ---- Target filters -------------------------------------------------------

function filters(sheet, ctx) {
  const f = ctx.ws.targets;
  const count = ctx.search(f).length;
  const specialties = [...new Set(allHcps().map((h) => h.specialty))].sort();
  const types = [...new Set(allOrgs().map((o) => o.type))].sort();
  const radios = (name, options, current) => html`<fieldset class="field field-wide"><legend>${name}</legend><div class="radio-row">${options.map((o) => html`<label class="radio"><input type="radio" name="${name}" data-change="filterField" data-field="${o.field}" value="${o.id}" ${o.id === current ? 'checked' : ''}><span>${o.label}</span></label>`)}</div></fieldset>`;
  return {
    title: 'Filters',
    content: html`<div class="sheet-body">
      ${f.kind === 'hcp'
        ? html`<label class="field field-wide"><span>Specialty</span><select id="filter-specialty" data-change="filterField" data-field="specialty"><option value="">All specialties</option>${specialties.map((s) => html`<option ${s === f.specialty ? 'selected' : ''}>${s}</option>`)}</select></label>`
        : html`<label class="field field-wide"><span>Organization type</span><select id="filter-type" data-change="filterField" data-field="orgType"><option value="">All types</option>${types.map((t) => html`<option ${t === f.orgType ? 'selected' : ''}>${t}</option>`)}</select></label>`}
      ${radios('Distance', DISTANCES.map((d) => ({ ...d, field: 'distance' })), f.distance)}
      ${radios(`In ${ctx.dayName(ctx.ws.selection.day).toLowerCase()}’s plan`, [{ id: 'any', label: 'Either' }, { id: 'unplanned', label: 'Not planned' }, { id: 'planned', label: 'Planned' }].map((o) => ({ ...o, field: 'planned' })), f.planned)}
      ${radios('Sort by', SORTS.map((s) => ({ ...s, field: 'sort' })), f.sort)}
      <p class="caption">${icon('info')} Distances are straight-line from ${REP.start.label}.</p>
    </div>
    <footer class="sheet-foot">
      ${button({ label: 'Clear all', action: 'clearFilters', variant: 'ghost', disabled: !activeFilterCount(f) && f.sort === 'relevance' })}
      <span class="spacer"></span>
      ${button({ label: `Show ${plural(count, 'result')}`, action: 'closeSheet', variant: 'primary' })}
    </footer>`,
  };
}

// ---- Options for a planned visit ------------------------------------------

function visitOptions(sheet, ctx) {
  const item = (ctx.ws.plans[sheet.day] || []).find((i) => i.id === sheet.item);
  if (!item) return { title: 'Visit', content: html`<div class="sheet-body"><p>This visit is no longer in the plan.</p></div>` };
  const target = getEntity(item.targetId);
  const site = siteFor(target, item.siteId);
  const isToday = sheet.day === ctx.todayIso;
  const option = (label, iconName, action, data = {}, hint = '', variant = '') => html`<li><button type="button" class="option${variant ? ` option-${variant}` : ''}" data-action="${action}"${dataAttrs(data)}>${icon(iconName)}<span class="entity-main"><span class="row-title">${label}</span>${hint ? html`<span class="caption">${hint}</span>` : ''}</span></button></li>`;
  const ids = { item: item.id, day: sheet.day };
  const when = item.mode === 'timed' ? `${item.time}–${endTime(item)}` : 'Flexible time';

  return {
    title: target.name,
    content: html`<div class="sheet-body">
      ${who(target, `${item.type} · ${when} · ${site.name}`)}
      ${item.goal ? html`<p class="next-goal">${icon('target')}<span>${item.goal}</span></p>` : ''}
      ${item.status === 'cancelled' ? html`<p class="sheet-hint">${icon('circle-x')}Cancelled${item.cancelReason ? ` · ${item.cancelReason}` : ''}.</p>` : ''}
      <ul class="option-list">
        ${option(target.kind === 'hcp' ? 'Open profile' : 'Open account', 'file-text', 'openProfile', { id: target.id }, 'Prepare with notes, volumes and referrals')}
        ${item.status === 'planned' ? html`
          ${option('Log visit', 'notebook-pen', 'logVisit', ids, 'Write a note and mark it done')}
          ${option('Change time or order', 'clock', 'reviewPlan', { day: sheet.day }, 'Opens the plan for review')}
          ${isToday ? option('Move to tomorrow', 'calendar-arrow-up', 'moveTomorrow', ids, 'Keeps the time if tomorrow is free') : ''}
          ${option('Cancel visit', 'calendar-x', 'cancelVisit', ids, item.mode === 'timed' ? 'You can fill the free slot with someone nearby' : '', 'danger')}
        ` : ''}
        ${item.status === 'done' ? option('Mark as not done', 'rotate-ccw', 'reopenVisit', ids, 'The note you logged is kept') : ''}
        ${item.status === 'cancelled' ? option('Restore visit', 'rotate-ccw', 'restoreVisit', ids, item.mode === 'timed' ? `Back at ${item.time}` : '') : ''}
      </ul>
    </div>`,
  };
}

// ---- Confirm --------------------------------------------------------------

export const CANCEL_REASONS = ['HCP unavailable', 'Rescheduled by office', 'Running late', 'Other'];

function confirm(sheet) {
  return {
    title: sheet.title,
    content: html`<form class="sheet-form" data-submit="${sheet.run}"${dataAttrs(sheet.data)} novalidate>
      <div class="sheet-body">
        <p>${sheet.body}</p>
        ${sheet.reasons ? html`<fieldset class="field field-wide"><legend>Reason <span class="muted">(optional)</span></legend><div class="radio-col">${sheet.reasons.map((r, i) => html`<label class="radio"><input type="radio" name="reason" value="${r}" ${i === 0 ? 'checked' : ''}><span>${r}</span></label>`)}</div></fieldset>` : ''}
      </div>
      <footer class="sheet-foot">
        <span class="spacer"></span>
        ${button({ label: sheet.cancelLabel || 'Keep it', action: 'closeSheet', variant: 'ghost' })}
        ${button({ label: sheet.confirmLabel, type: 'submit', variant: sheet.danger ? 'danger' : 'primary' })}
      </footer>
    </form>`,
  };
}

// ---- Account --------------------------------------------------------------

function account(sheet, ctx) {
  const local = ctx.ws.interactions.filter((i) => i.local).length + ctx.ws.followUps.filter((f) => f.local).length;
  return {
    title: 'Account',
    content: html`<div class="sheet-body">
      <div class="sheet-who">${avatar({ name: REP.name }, 'avatar-lg')}<div class="entity-main"><span class="row-title">${REP.name}</span><span class="caption">${REP.team}</span></div></div>
      ${details([
        ['Start point', `${REP.start.label} (sample, not live location)`],
        ['Saved on this device', local ? `${plural(local, 'change')} since the sample was loaded` : 'No changes yet'],
        ['CRM sync', html`${tag('Coming later', 'neutral')}`],
        ['Data', 'Sample data. People are fictional; facility names and locations are public records.'],
      ])}
      <div class="soon-row">${soon('Sync now', 'Coming later', 'refresh-cw')}</div>
    </div>
    <footer class="sheet-foot">
      ${button({ label: 'Reset sample data', icon: 'rotate-ccw', action: 'confirmReset', variant: 'danger' })}
      <span class="spacer"></span>
      ${button({ label: 'Done', action: 'closeSheet', variant: 'primary' })}
    </footer>`,
  };
}

const SHEETS = { note, followup, contact, filters, visitOptions, confirm, account };
export const SHEET_TYPES = Object.keys(SHEETS);
