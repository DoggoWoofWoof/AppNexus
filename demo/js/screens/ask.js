// Ask: questions about the rep's own book, typed or spoken. Answers lead with
// one sentence, show the ranked figures behind it, then suggest one next step.

import { startersFor } from '../ask.js';
import { getEntity } from '../data/index.js';
import { html } from '../format.js';
import { button, icon } from '../ui.js';
import { VOICE_ERRORS, canListen, canSpeak } from '../voice.js';

export const title = () => 'Ask';

const VIA = { voice: ['mic', 'Asked by voice'], sample: ['mic', 'Simulated voice question'], typed: ['message-square', 'Asked'] };

export function render(ctx) {
  const ui = ctx.entry.ui;
  const turns = ui.turns || [];
  const controls = [
    canListen() ? button({ label: 'Hands-free', icon: 'audio-lines', action: 'askHandsFree', pressed: !!ui.handsFree, variant: 'ghost', size: 'sm' }) : '',
    canSpeak() && !ui.handsFree ? button({ label: 'Read voice answers aloud', icon: ui.readAloud === false ? 'volume-x' : 'volume-2', action: 'askReadAloud', pressed: ui.readAloud !== false, variant: 'ghost', size: 'sm' }) : '',
    turns.length ? button({ label: 'New conversation', icon: 'rotate-ccw', action: 'askClear', variant: 'ghost', size: 'sm' }) : '',
  ].filter(Boolean);

  return html`
    <header class="page-head ask-head">
      <p class="eyebrow">Ask Field Pro</p>
      <h1>${turns.length ? 'Your questions' : 'What do you want to know?'}</h1>
      ${turns.length ? '' : html`<p class="page-sub">Ask about your accounts, people, plan and follow-ups. Type, tap the mic, or go hands-free for a back-and-forth conversation.</p>`}
      ${controls.length ? html`<div class="page-actions">${controls}</div>` : ''}
    </header>
    ${turns.length
      ? html`<ol class="ask-thread">${turns.map((t, i) => turnView(t, ctx, i === turns.length - 1))}</ol>
        <p class="fineprint ask-note">${icon('info')} Answers are worked out from sample figures and the notes on this device. Check figures before quoting them.</p>`
      : starters(ctx)}
    ${composer(ctx)}
  `;
}

function starters(ctx) {
  return html`<section class="ask-starters" aria-labelledby="starters-title">
    <h2 id="starters-title" class="section-title">Try asking</h2>
    ${startersFor(ctx).map((g) => html`<div class="ask-group">
      <h3 class="kicker">${g.title}</h3>
      <ul class="chip-list">${g.questions.map((q) => html`<li><button type="button" class="chip chip-ask" data-action="askSuggestion" data-q="${q}">${q}</button></li>`)}</ul>
    </div>`)}
    <p class="fineprint">${icon('info')} A preview of AI search. It answers from sample figures on this device; the real version will answer from your DocNexus data.</p>
  </section>`;
}

function turnView(turn, ctx, isLast) {
  const [glyph, label] = VIA[turn.via] || VIA.typed;
  return html`<li class="ask-turn" id="turn-${turn.id}">
    <p class="eyebrow ask-via">${icon(glyph)}${label}</p>
    <h2 class="ask-q" tabindex="-1">${turn.q}</h2>
    ${turn.status === 'thinking' ? thinking()
      : turn.status === 'error' ? failed(turn)
        : answerView(turn, ctx, isLast)}
  </li>`;
}

function thinking() {
  return html`<div class="ask-thinking" aria-busy="true" role="status">
    <p class="caption"><span class="spinner" aria-hidden="true"></span>Looking through your figures…</p>
    <span class="sk sk-line" style="width:80%"></span><span class="sk sk-line" style="width:55%"></span><span class="sk sk-block"></span>
  </div>`;
}

function failed(turn) {
  const offline = turn.error === 'offline';
  return html`<div class="state state-error ask-error" role="alert">${icon(offline ? 'wifi-off' : 'triangle-alert')}
    <h3>${offline ? 'Ask needs a connection' : 'Couldn’t answer just now'}</h3>
    <p>${offline ? 'Your question is kept. Try again when you’re back online.' : 'The server didn’t respond. Your question is kept.'}</p>
    <div class="state-actions">${button({ label: 'Try again', icon: 'refresh-cw', action: 'askRetry', data: { id: turn.id }, variant: 'primary', size: 'sm' })}</div>
  </div>`;
}

function answerView(turn, ctx, isLast) {
  const r = turn.result;
  if (!r) return '';
  return html`<div class="ask-answer">
    ${r.scope?.length ? html`<ul class="ask-scope" aria-label="What this answer covers">${r.scope.map((s) => html`<li>${s}</li>`)}</ul>` : ''}
    <p class="ask-summary">${r.summary}</p>
    ${r.rows?.length ? (r.intent === 'brief' ? facts(r.rows) : ranked(r, ctx)) : ''}
    ${r.doThis ? doThis(r.doThis, ctx) : ''}
    <div class="ask-tools">
      ${canSpeak() ? button({ label: 'Read this answer aloud', icon: 'volume-2', action: 'askListen', data: { id: turn.id }, variant: 'ghost', size: 'sm', iconOnly: true }) : ''}
    </div>
    ${isLast && r.next?.length ? html`<div class="ask-next">
      <p class="kicker">Ask next</p>
      <ul class="chip-list">${r.next.map((q) => html`<li><button type="button" class="chip chip-ask" data-action="askSuggestion" data-q="${q}">${q}</button></li>`)}</ul>
    </div>` : ''}
  </div>`;
}

function ranked(r, ctx) {
  const numbered = r.intent !== 'followups' && r.intent !== 'plan';
  return html`<ol class="ask-rows${numbered ? ' is-ranked' : ''}">${r.rows.map((row, i) => {
    const body = html`${numbered ? html`<span class="ask-rank" aria-hidden="true">${i + 1}</span>` : ''}
      <span class="entity-main"><span class="row-title">${row.title}</span>${row.sub ? html`<span class="caption">${row.sub}</span>` : ''}</span>
      ${row.figure ? html`<span class="ask-figure${row.tone ? ` tone-${row.tone}` : ''}">${row.figure}</span>` : ''}`;
    const entity = row.id ? getEntity(row.id) : null;
    const open = entity
      ? html`<button type="button" class="ask-row" data-action="openProfile" data-id="${row.id}"${row.tab ? html` data-tab="${row.tab}"` : ''}>${body}${icon('chevron-right')}</button>`
      : html`<div class="ask-row">${body}</div>`;
    return html`<li class="ask-item">${open}${r.selectable && entity ? selectToggle(entity, ctx) : ''}</li>`;
  })}</ol>`;
}

function selectToggle(entity, ctx) {
  if (ctx.planItemFor(entity.id, ctx.ws.selection.day)) {
    return html`<span class="select-toggle is-planned" title="Already in the plan">${icon('calendar-days')}<span class="sr-only">Already planned</span></span>`;
  }
  const selected = ctx.isSelected(entity.id);
  return html`<button type="button" class="select-toggle" data-action="toggleSelect" data-id="${entity.id}" aria-pressed="${selected}" aria-label="${selected ? 'Remove' : 'Add'} ${entity.name} ${selected ? 'from' : 'to'} the plan">${icon(selected ? 'check' : 'plus')}</button>`;
}

function facts(rows) {
  return html`<dl class="ask-facts">${rows.map((f) => html`<div class="ask-fact${f.tone ? ` tone-${f.tone}` : ''}"><dt>${f.title}</dt><dd><span class="ask-fact-value">${f.figure}</span><span class="caption">${f.sub}</span></dd></div>`)}</dl>`;
}

function doThis(d, ctx) {
  const entity = d.add ? getEntity(d.add) : null;
  const canAdd = entity && !ctx.planItemFor(entity.id, ctx.ws.selection.day) && entity.type !== 'Health system';
  const selected = canAdd && ctx.isSelected(entity.id);
  return html`<div class="ask-do">
    <p><span class="kicker">Do this</span>${d.text}</p>
    <div class="ask-do-actions">
      ${button({ label: d.label, icon: 'arrow-right', action: d.action, data: d.data, variant: 'primary', size: 'sm' })}
      ${canAdd ? button({ label: selected ? 'Selected for the plan' : 'Add to plan', icon: selected ? 'check' : 'plus', action: 'toggleSelect', data: { id: entity.id }, pressed: selected, size: 'sm' }) : ''}
    </div>
  </div>`;
}

function composer(ctx) {
  const ui = ctx.entry.ui;
  const voice = ctx.voice || { status: 'idle' };
  return html`<div class="ask-composer">
    ${voice.status === 'listening' ? html`<div class="voice-panel" role="status">
      <span class="voice-orb" aria-hidden="true">${icon('mic')}</span>
      <div class="voice-text">
        <p class="kicker">${voice.simulated ? 'Simulated voice · sample question' : ui.handsFree ? 'Hands-free · listening' : 'Listening · ask, then pause'}</p>
        <p class="voice-transcript" data-voice-text>${voice.text || '…'}</p>
      </div>
      <div class="voice-actions">
        ${ui.handsFree
          ? button({ label: 'End hands-free', action: 'askHandsFree', variant: 'ghost', size: 'sm' })
          : button({ label: 'Cancel', action: 'askVoiceCancel', variant: 'ghost', size: 'sm' })}
        ${button({ label: 'Done', icon: 'check', action: 'askVoiceStop', variant: 'primary', size: 'sm' })}
      </div>
    </div>` : ''}
    ${voice.status === 'speaking' ? html`<div class="voice-panel is-speaking" role="status">
      <span class="voice-orb" aria-hidden="true">${icon('audio-lines')}</span>
      <div class="voice-text">
        <p class="kicker">Hands-free · reading the answer</p>
        <p>I’ll listen again when it finishes. Say “stop” to end.</p>
      </div>
      <div class="voice-actions">
        ${button({ label: 'End hands-free', action: 'askHandsFree', variant: 'ghost', size: 'sm' })}
        ${button({ label: 'Ask now', icon: 'mic', action: 'askVoice', variant: 'primary', size: 'sm' })}
      </div>
    </div>` : ''}
    ${voice.status === 'error' ? html`<div class="voice-panel is-error" role="alert">
      <span class="voice-orb" aria-hidden="true">${icon('mic-off')}</span>
      <p class="voice-text">${VOICE_ERRORS[voice.error] || VOICE_ERRORS.unsupported}</p>
      <div class="voice-actions">
        ${button({ label: 'Try a sample voice question', action: 'askVoiceDemo', size: 'sm' })}
        ${button({ label: 'Dismiss', icon: 'x', action: 'askVoiceCancel', variant: 'ghost', size: 'sm', iconOnly: true })}
      </div>
    </div>` : ''}
    <form class="ask-form" data-submit="askSubmit" role="search" aria-label="Ask Field Pro">
      <label for="ask-input" class="sr-only">Ask a question</label>
      <input id="ask-input" name="q" type="text" value="${ui.draft || ''}" data-input="askInput" placeholder="Ask about accounts, people or your plan" autocomplete="off" enterkeyhint="send">
      <button type="button" class="btn btn-ghost btn-icon ask-mic" data-action="askVoice" aria-label="Ask by voice"${voice.status === 'listening' ? html` aria-pressed="true"` : ''}>${icon('mic')}</button>
      <button type="submit" class="btn btn-primary btn-icon" aria-label="Ask">${icon('arrow-up')}</button>
    </form>
  </div>`;
}
