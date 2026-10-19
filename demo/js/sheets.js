// Bottom sheets (dialogs on wide screens). Each returns { title, content }.
// Form fields write straight to state as the rep types, so nothing is lost on Back.

import { bookingRoute } from './booking.js';
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
    // Never assumed: an empty save must not record a meeting that didn't happen.
    outcome: '',
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
        ${item ? html`<p class="sheet-hint">${icon('circle-check')}Saving marks this visit as done in ${ctx.dayWord(sheet.day)}’s plan.</p>` : ''}
        <fieldset class="field field-wide"><legend>What happened?</legend>
          <div class="radio-row">${OUTCOMES.map((o, n) => html`<label class="radio"><input type="radio" name="outcome" value="${o}" data-change="noteField" data-field="outcome" ${o === d.outcome ? 'checked' : ''}${n === 0 ? invalid(sheet, 'outcome') : ''}><span>${o}</span></label>`)}</div>
          ${err(sheet, 'outcome')}
        </fieldset>
        <div class="field-grid">
          <label class="field"><span>Activity</span><select id="note-type" data-change="noteField" data-field="type" name="type">${VISIT_TYPES.map((t) => html`<option ${t === d.type ? 'selected' : ''}>${t}</option>`)}</select></label>
          <label class="field"><span>Date</span><input type="date" id="note-date" data-change="noteField" data-field="date" name="date" value="${d.date}" max="${ctx.todayIso}"${invalid(sheet, 'date')}>${err(sheet, 'date')}</label>
        </div>
        ${d.contacts?.length ? html`<p class="caption">With ${d.contacts.join(', ')}</p>` : ''}
        <div class="field field-wide">
          <div class="field-label-row">
            <label for="note-text">Note</label>
            ${button({ label: sheet.dictating ? 'Stop' : 'Speak', icon: sheet.dictating ? 'mic-off' : 'mic', action: 'noteDictate', size: 'sm', variant: sheet.dictating ? 'primary' : 'ghost', pressed: !!sheet.dictating })}
          </div>
          <textarea id="note-text" rows="6" maxlength="2000" ${field('note')} placeholder="What was discussed, what they asked for, what happens next. Or tap Speak.">${d.note}</textarea>
          <span class="field-hint" aria-live="polite">${sheet.dictating ? html`${icon('audio-lines')}Listening. Tap Stop when you’re done.` : html`${icon('save')}Kept as a draft on this device${d.spoken ? ' · spoken note' : ''}.`}</span>
        </div>
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
      ${radios(`In ${ctx.dayWord(ctx.ws.selection.day)}’s plan`, [{ id: 'any', label: 'Either' }, { id: 'unplanned', label: 'Not planned' }, { id: 'planned', label: 'Planned' }].map((o) => ({ ...o, field: 'planned' })), f.planned)}
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

/** "Today", "Tomorrow" or "Wed 21 Oct". */
export const shortDay = (iso, ctx) => (iso === ctx.todayIso || iso === ctx.tomorrowIso ? ctx.dayName(iso) : formatDate(iso));
/** "today", "tomorrow" or "on Wed 21 Oct", to follow a verb. */
export const onDay = (iso, ctx) => (iso === ctx.todayIso || iso === ctx.tomorrowIso ? ctx.dayWord(iso) : `on ${formatDate(iso)}`);

const option = (label, iconName, action, data = {}, hint = '', variant = '') => html`<li><button type="button" class="option${variant ? ` option-${variant}` : ''}" data-action="${action}"${dataAttrs(data)}>${icon(iconName)}<span class="entity-main"><span class="row-title">${label}</span>${hint ? html`<span class="caption">${hint}</span>` : ''}</span></button></li>`;

function visitOptions(sheet, ctx) {
  const item = (ctx.ws.plans[sheet.day] || []).find((i) => i.id === sheet.item);
  if (!item) return { title: 'Visit', content: html`<div class="sheet-body"><p>This visit is no longer in the plan.</p></div>` };
  const target = getEntity(item.targetId);
  const site = siteFor(target, item.siteId);
  const ids = { item: item.id, day: sheet.day };
  const when = item.mode === 'timed' ? `${item.time}–${endTime(item)}` : 'Flexible time';
  const free = ctx.ws.replacement?.itemId === item.id;

  return {
    title: target.name,
    content: html`<div class="sheet-body">
      ${who(target, `${shortDay(sheet.day, ctx)} · ${when} · ${site.name}`)}
      ${item.goal ? html`<p class="next-goal">${icon('target')}<span>${item.goal}</span></p>` : ''}
      ${item.status === 'cancelled' ? html`<p class="sheet-hint">${icon('circle-x')}Cancelled${item.cancelReason ? ` · ${item.cancelReason}` : ''}.</p>` : ''}
      ${item.booking === 'requested' && item.status === 'planned' ? html`<p class="sheet-hint">${icon('clock')}Requested${item.via ? ` through ${item.via}` : ''}. Not confirmed yet.</p>` : ''}
      <ul class="option-list">
        ${item.status === 'planned' ? html`
          ${option('Prepare', 'file-text', 'openProfile', { id: target.id }, 'Goal, talking points and follow-ups')}
          ${item.booking === 'requested' ? option('Mark confirmed', 'calendar-check', 'confirmBooking', ids, 'They’ve agreed to the time') : ''}
          ${option('Log visit', 'notebook-pen', 'logVisit', ids, 'Write a note and mark it done')}
          ${option('Reschedule', 'calendar-clock', 'bookVisit', { target: target.id, from: item.id, fromDay: sheet.day }, 'Pick another time that suits them')}
          ${option('Edit plan', 'pencil', 'reviewPlan', { day: sheet.day }, 'Change times, order or goals')}
          ${option('Cancel visit', 'calendar-x', 'cancelVisit', ids, item.mode === 'timed' ? 'Then fill the slot with someone nearby' : '', 'danger')}
        ` : ''}
        ${item.status === 'done' ? option('Mark as not done', 'rotate-ccw', 'reopenVisit', ids, 'The note you logged is kept') : ''}
        ${free ? option(`Fill ${item.time}`, 'calendar-plus', 'findReplacement', {}, 'Nearest unplanned people, in Targets') : ''}
        ${item.status === 'cancelled' ? option('Restore visit', 'rotate-ccw', 'restoreVisit', ids, item.mode === 'timed' ? `Back at ${item.time}` : '') : ''}
      </ul>
    </div>`,
  };
}

// ---- Cancel a visit (the slot is then filled from Targets) -----------------

export const CANCEL_REASONS = ['HCP unavailable', 'Rescheduled by office', 'Running late', 'Other'];

function cancel(sheet, ctx) {
  const item = (ctx.ws.plans[sheet.day] || []).find((i) => i.id === sheet.item);
  if (!item) return { title: 'Cancel visit', content: html`<div class="sheet-body"><p>This visit is no longer in the plan.</p></div>` };
  const target = getEntity(item.targetId);
  return {
    title: 'Cancel visit',
    content: html`<div class="sheet-body">
      ${who(target, `${shortDay(sheet.day, ctx)}${item.mode === 'timed' ? ` · ${item.time}` : ''}`)}
      <p class="sheet-lead">Why was it cancelled?</p>
      <ul class="option-list">${CANCEL_REASONS.map((reason) => option(reason, 'calendar-x', 'confirmCancelVisit', { item: item.id, day: sheet.day, reason }))}</ul>
      <p class="caption">You can restore it later.${item.mode === 'timed' ? ` Then Targets shows who’s nearest, so you can fill ${item.time}.` : ''}</p>
    </div>
    <footer class="sheet-foot"><span class="spacer"></span>${button({ label: 'Keep visit', action: 'closeSheet', variant: 'ghost' })}</footer>`,
  };
}

// ---- Book a visit -----------------------------------------------------------

function book(sheet, ctx) {
  const target = getEntity(sheet.target);
  const from = sheet.from ? (ctx.ws.plans[sheet.fromDay] || []).find((i) => i.id === sheet.from) : null;
  const slots = ctx.slotsFor(target, from?.id);
  const pick = sheet.pick ?? (slots.length ? '0' : 'other');
  const route = bookingRoute(target);
  const best = target.kind === 'hcp' ? target.contact.preferred || 'Not recorded · using office hours' : 'Office hours, Mon–Fri';
  const days = ctx.planDays();
  const day = sheet.day || days[0].iso;
  const chosen = pick === 'other' ? (sheet.time ? { day, time: sheet.time } : null) : slots[Number(pick)];
  const label = chosen ? `${shortDay(chosen.day, ctx)} ${chosen.time}` : '';
  const radio = (value, title, sub) => html`<label class="slot"><input type="radio" name="pick" value="${value}" data-change="bookField" data-field="pick" ${pick === value ? 'checked' : ''}><span class="entity-main"><span class="row-title">${title}</span>${sub ? html`<span class="caption">${sub}</span>` : ''}</span></label>`;

  return {
    title: from ? `Reschedule ${target.name}` : `Book ${target.name}`,
    content: html`<form class="sheet-form" data-submit="saveBooking" novalidate>
      <div class="sheet-body">
        ${who(target, from ? `Was ${shortDay(sheet.fromDay, ctx)}${from.mode === 'timed' ? ` ${from.time}` : ''}` : '')}
        ${details([
          ['Best time', best],
          ['Book through', route.label === 'Email' ? route.value : `${route.label} · ${route.value}`, copyButton(route.value, route.kind)],
        ])}
        <fieldset class="field field-wide"><legend>When</legend>
          <div class="slot-list">
            ${slots.map((slot, i) => radio(String(i), `${shortDay(slot.day, ctx)} · ${slot.time}`, getOrg(slot.siteId).name))}
            ${radio('other', 'Another time', slots.length ? '' : 'No times in their usual hours in the next five working days')}
          </div>
        </fieldset>
        ${pick === 'other' ? html`<div class="field-grid">
          <label class="field"><span>Day</span><select id="book-day" name="day" data-change="bookField" data-field="day">${days.map((d) => html`<option value="${d.iso}" ${d.iso === day ? 'selected' : ''}>${shortDay(d.iso, ctx)}</option>`)}</select></label>
          <label class="field"><span>Start</span><input type="time" id="book-time" name="time" data-change="bookField" data-field="time" value="${sheet.time || ''}" step="300"${invalid(sheet, 'time')}>${err(sheet, 'time')}</label>
        </div>` : err(sheet, 'time')}
        <label class="check-field"><input type="checkbox" id="book-confirmed" name="confirmed" data-change="bookField" data-field="confirmed" ${sheet.confirmed ? 'checked' : ''}><span>They’ve already agreed to this time</span></label>
        <p class="caption">${icon('info')} ${sheet.confirmed ? 'It goes in your plan as confirmed.' : 'It goes in your plan as requested until you mark it confirmed.'} Calendar and CRM sync are coming later.</p>
      </div>
      <footer class="sheet-foot">
        <span class="spacer"></span>
        ${button({ label: 'Cancel', action: 'closeSheet', variant: 'ghost' })}
        ${button({ label: `${sheet.confirmed ? 'Book' : 'Request'}${label ? ` ${label}` : ''}`, icon: 'calendar-check', type: 'submit', variant: 'primary' })}
      </footer>
    </form>`,
  };
}

// ---- Confirm --------------------------------------------------------------

function confirm(sheet) {
  return {
    title: sheet.title,
    content: html`<form class="sheet-form" data-submit="${sheet.run}"${dataAttrs(sheet.data)} novalidate>
      <div class="sheet-body">
        <p>${sheet.body}</p>
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

const SHEETS = { note, followup, contact, filters, visitOptions, cancel, book, confirm, account };
export const SHEET_TYPES = Object.keys(SHEETS);
