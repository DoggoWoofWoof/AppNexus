// Activity: follow-ups to do and a searchable journal of every visit, call and note.

import { getEntity } from '../data/index.js';
import { daysBetween, formatDate, fromIso, html, plural, relativeDay } from '../format.js';
import { avatar, button, card, emptyState, icon, sectionHead, segmented } from '../ui.js';
import { followUpRow, interactionItem } from './profile-parts.js';

export const title = () => 'Activity';

export function render(ctx) {
  const view = ctx.ws.activity.view === 'journal' ? 'journal' : 'todo';
  const open = ctx.ws.followUps.filter((f) => !f.done).length;
  const logged = ctx.ws.interactions.filter((i) => !i.deleted).length;
  return html`
    <header class="page-head">
      <p class="eyebrow">Follow-ups and notes</p>
      <h1>Activity</h1>
      <p class="page-sub">Everything you owe someone, and everything you’ve logged.</p>
    </header>
    <div class="toolbar">
      ${segmented([{ id: 'todo', label: 'To do', icon: 'list-checks', count: open }, { id: 'journal', label: 'Journal', icon: 'notebook-text', count: logged }], view, 'activityView', { label: 'Activity view', key: 'view' })}
      <div class="toolbar-actions">
        ${button({ label: 'New follow-up', icon: 'calendar-plus', action: 'newFollowUp', size: 'sm' })}
        ${button({ label: 'Log a visit', icon: 'notebook-pen', action: 'logVisit', size: 'sm', variant: 'primary' })}
      </div>
    </div>
    ${drafts(ctx)}
    ${view === 'todo' ? todo(ctx) : journal(ctx)}
  `;
}

function drafts(ctx) {
  const list = Object.entries(ctx.ws.drafts)
    .filter(([, d]) => d.note?.trim() || d.followText?.trim())
    .map(([key, d]) => ({ key, d, target: d.targetId ? getEntity(d.targetId) : null }));
  if (!list.length) return '';
  return html`<section class="card draft-card" aria-labelledby="drafts-title">
    ${sectionHead(plural(list.length, 'unsaved note'), { id: 'drafts-title', sub: 'Kept on this device until you save or discard them' })}
    <ul class="entity-list">${list.map(({ key, d, target }) => html`<li class="entity-item">
      <span class="entity-row is-static">${target ? avatar(target) : html`<span class="avatar avatar-person" aria-hidden="true">${icon('pencil')}</span>`}
        <span class="entity-main"><span class="row-title">${target ? target.name : 'No target chosen yet'}</span><span class="caption">${d.note?.trim() ? `“${d.note.trim().slice(0, 80)}${d.note.trim().length > 80 ? '…' : ''}”` : 'Follow-up only'}${d.updatedAt ? ` · ${relativeDay(d.updatedAt.slice(0, 10), ctx.today).toLowerCase()}` : ''}</span></span></span>
      ${button({ label: 'Resume', action: 'resumeDraft', data: { key }, size: 'sm' })}
    </li>`)}</ul>
  </section>`;
}

function todo(ctx) {
  const all = ctx.ws.followUps;
  const diff = (f) => daysBetween(ctx.today, fromIso(f.due));
  const open = all.filter((f) => !f.done).sort((a, b) => a.due.localeCompare(b.due));
  const groups = [
    { id: 'overdue', title: 'Overdue', items: open.filter((f) => diff(f) < 0) },
    { id: 'today', title: 'Due today', items: open.filter((f) => diff(f) === 0) },
    { id: 'upcoming', title: 'Coming up', items: open.filter((f) => diff(f) > 0) },
  ].filter((g) => g.items.length);
  const done = all.filter((f) => f.done).sort((a, b) => (b.doneOn || b.due).localeCompare(a.doneOn || a.due));

  if (!open.length) {
    return card(html`${emptyState({
      icon: 'square-check-big',
      title: 'You’re all caught up',
      body: 'Create a follow-up after a visit so the next step isn’t lost.',
      actions: button({ label: 'New follow-up', icon: 'plus', action: 'newFollowUp', variant: 'primary' }),
    })}${done.length ? doneGroup(done, ctx) : ''}`);
  }
  return html`${groups.map((g) => card(html`
    ${sectionHead(g.title, { sub: plural(g.items.length, 'follow-up') })}
    <ul class="follow-list">${g.items.map((f) => followUpRow(f, ctx))}</ul>
  `, `follow-group follow-${g.id}`))}${done.length ? card(doneGroup(done, ctx)) : ''}`;
}

const doneGroup = (done, ctx) => html`<details class="done-group"><summary>${plural(done.length, 'completed follow-up')}</summary><ul class="follow-list">${done.map((f) => followUpRow(f, ctx))}</ul></details>`;

function journal(ctx) {
  const query = ctx.ws.activity.query || '';
  const q = query.trim().toLowerCase();
  const items = ctx.ws.interactions
    .filter((i) => !i.deleted)
    .filter((i) => {
      if (!q) return true;
      const target = getEntity(i.targetId);
      return [target?.name, i.type, i.outcome, i.note, i.author, ...(i.contacts || [])].join(' ').toLowerCase().includes(q);
    })
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
  const byMonth = new Map();
  for (const i of items) {
    const key = i.date.slice(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key).push(i);
  }
  return html`
    <div class="search">
      ${icon('search')}
      <input type="search" id="journal-search" data-input="journalQuery" value="${query}" placeholder="Search notes, people or outcomes" aria-label="Search the journal" autocomplete="off">
      ${query ? button({ label: 'Clear search', icon: 'x', action: 'journalClear', variant: 'ghost', iconOnly: true }) : ''}
    </div>
    <p class="toolbar-count" role="status">${q ? `${plural(items.length, 'match', 'matches')} for “${query.trim()}”` : `${plural(items.length, 'entry', 'entries')} · newest first`}</p>
    ${items.length
      ? html`${[...byMonth.entries()].map(([month, list]) => card(html`
        ${sectionHead(formatDate(`${month}-01`, { month: 'long', year: 'numeric' }), { sub: plural(list.length, 'entry', 'entries') })}
        <ol class="timeline">${list.map((i) => interactionItem(i, ctx, { showTarget: true }))}</ol>
      `))}`
      : card(emptyState({
        icon: q ? 'search' : 'notebook-text',
        title: q ? 'No notes match' : 'Nothing logged yet',
        body: q ? 'Try a name, an outcome like “Attempted”, or a word from the note.' : 'Visits, calls and notes you log appear here.',
        actions: q ? button({ label: 'Clear search', action: 'journalClear' }) : button({ label: 'Log a visit', icon: 'notebook-pen', action: 'logVisit', variant: 'primary' }),
      }))}
  `;
}
