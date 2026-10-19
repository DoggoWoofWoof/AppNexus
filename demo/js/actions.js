// Every user action, by name. Screens refer to these with data-action,
// data-input, data-change and data-submit; tests check that each name exists.
// Return 'quiet' to skip the re-render (used while typing in a field).

import { answer, spoken } from './ask.js';
import { bookingRoute, clashesWith, siteOnDay } from './booking.js';
import { getEntity, siteFor } from './data/index.js';
import { REP } from './data/seed.js';
import { addDays, fromIso, fromMinutes, isoDate, plural, toMinutes, uid } from './format.js';
import { activeItems, addTargets, conflicts, moveFlexible, suggestOrder } from './plan.js';
import { DEFAULT_FILTERS } from './search.js';
import { followDraft, noteDraft, noteKey, onDay } from './sheets.js';
import { canListen, listen, simulate, speak, stopSpeaking } from './voice.js';

const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function createActions(app) {
  const ws = () => app.ws;
  const dayWord = (iso) => app.ctx().dayWord(iso);
  const findItem = (day, id) => (ws().plans[day] || []).find((i) => i.id === id);

  /** Applies a change to a saved visit and to the same visit in an open plan draft. */
  function forItem(day, id, change) {
    const saved = findItem(day, id);
    if (saved) change(saved);
    const draft = ws().planDraft;
    const drafted = draft?.day === day ? draft.items.find((i) => i.id === id) : null;
    if (drafted) change(drafted);
    return saved;
  }

  /** Runs a change that can be undone from the toast; only the named parts of the workspace are restored. */
  function withUndo(message, keys, change) {
    const before = Object.fromEntries(keys.map((k) => [k, clone(ws()[k])]));
    const result = change();
    app.touch();
    app.toast(message, { undo: () => Object.assign(app.ws, clone(before)) });
    return result;
  }

  /** The open plan draft for a day, created from the saved plan when needed. */
  function ensureDraft(day) {
    const w = ws();
    const draft = w.planDraft;
    if (draft && draft.day === day) return draft;
    const carried = draft && app.ctx().planDirty() ? draft.items.filter((i) => i.isNew) : [];
    const items = clone(w.plans[day] || []);
    const planned = new Set(activeItems(items).map((i) => i.targetId));
    w.planDraft = { day, items: [...items, ...carried.filter((i) => !planned.has(i.targetId))] };
    w.selection.day = day;
    return w.planDraft;
  }

  /** Next free start time after the last timed stop, for a stop switched to a planned time. */
  function suggestTime(items, except) {
    const timed = activeItems(items).filter((i) => i.mode === 'timed' && i.time && i.id !== except);
    if (!timed.length) return '09:00';
    const end = Math.max(...timed.map((i) => toMinutes(i.time) + i.duration));
    return fromMinutes(Math.min(end + 15, 23 * 60));
  }

  const draftItem = (id) => ws().planDraft?.items.find((i) => i.id === id);

  /** Adds a visit to a day's saved plan, and to the open draft for that day. */
  function addItem(day, item) {
    const w = ws();
    w.plans[day] = [...(w.plans[day] || []), item];
    if (w.planDraft?.day === day) w.planDraft.items.push(clone(item));
  }

  /** Targets, showing people not planned that day, nearest to the cancelled visit first. */
  function showReplacements() {
    const w = ws();
    if (!w.replacement) return;
    w.selection.day = w.replacement.day;
    w.targets = { ...w.targets, kind: 'hcp', sort: 'distance', planned: 'unplanned', view: 'list' };
    app.switchTab('targets', { root: true });
  }

  /** Targets back to its usual filters once a free slot is filled or left. */
  function resetReplacementFilters() {
    const t = ws().targets;
    if (t.planned === 'unplanned' && t.sort === 'distance') ws().targets = { ...t, planned: 'any', sort: 'relevance' };
  }

  function removeItem(day, id) {
    const w = ws();
    w.plans[day] = (w.plans[day] || []).filter((i) => i.id !== id);
    if (w.planDraft?.day === day) w.planDraft.items = w.planDraft.items.filter((i) => i.id !== id);
  }

  // ---- Ask Field Pro: conversation and voice ---------------------------------
  // The conversation lives on the Ask tab's root entry, so it survives
  // opening a profile from an answer and coming Back.

  const askEntry = () => app.nav.stacks.ask[0];
  const turns = () => (askEntry().ui.turns ||= []);
  const asking = new Set();
  let voiceSession = null;
  let dictation = null;
  let sample = 0;

  function openAsk() {
    if (app.entry() !== askEntry()) app.switchTab('ask', { root: true });
  }

  /** Answers a turn after a (mock) round trip, so offline and error modes apply to Ask too. */
  function think(id) {
    if (asking.has(id)) return;
    asking.add(id);
    app.api.load(`ask:${id}`, () => true).then(() => {
      const list = turns();
      const at = list.findIndex((t) => t.id === id);
      if (at < 0) return;
      const turn = list[at];
      const about = list.slice(0, at).reverse().find((t) => t.result)?.result.about ?? null;
      turn.result = answer(turn.q, app.ctx(), about);
      turn.status = 'ready';
      app.announce(turn.result.summary);
      const ui = askEntry().ui;
      const byVoice = turn.via === 'voice' || turn.via === 'sample';
      if (ui.handsFree && turn.via === 'voice') {
        // Hands-free: read the answer, then listen for the next question.
        app.voice = { status: 'speaking' };
        speak(spoken(turn.result), { onEnd: listenAgain });
      } else if (ui.handsFree || (byVoice && ui.readAloud !== false)) {
        speak(spoken(turn.result));
      }
    }, (error) => {
      const turn = turns().find((t) => t.id === id);
      if (!turn) return;
      turn.status = 'error';
      turn.error = error.kind || 'server';
    }).finally(() => {
      asking.delete(id);
      if (app.entry() === askEntry()) app.render();
    });
  }

  function ask(question, via) {
    const q = String(question || '').trim();
    openAsk();
    if (!q) return app.focusAfter('#ask-input');
    stopSpeaking();
    const list = turns();
    const turn = { id: uid('ask'), q, via: via === 'chip' ? 'typed' : via, status: 'thinking' };
    list.push(turn);
    if (list.length > 20) list.splice(0, list.length - 20);
    askEntry().ui.draft = '';
    app.reveal(`#turn-${turn.id}`);
    app.focusAfter(via === 'typed' ? '#ask-input' : `#turn-${turn.id} .ask-q`);
    think(turn.id);
  }

  function listenAgain() {
    if (app.voice.status !== 'speaking') return;
    if (askEntry().ui.handsFree && app.entry() === askEntry()) startVoice(false);
    else app.voice = { status: 'idle' };
    app.render();
  }

  const STOP_WORDS = /^(stop|end|cancel|that s all|thats all|that is all|thanks|thank you|bye|goodbye|never mind)\b/;

  function startVoice(simulated) {
    stopSpeaking();
    voiceSession?.cancel();
    app.voice = { status: 'listening', text: '', simulated };
    const onText = (text) => {
      app.voice.text = text;
      const el = document.querySelector('[data-voice-text]');
      if (el) el.textContent = text || '…';
    };
    const onDone = (text) => {
      voiceSession = null;
      app.voice = { status: 'idle' };
      const ui = askEntry().ui;
      if (ui.handsFree && STOP_WORDS.test(text.toLowerCase().replace(/[^a-z\s]/g, ' ').trim())) {
        ui.handsFree = false;
        app.toast('Hands-free off');
        app.focusAfter('#ask-input');
      } else {
        ask(text, simulated ? 'sample' : 'voice');
      }
      app.render();
    };
    const onError = (code) => {
      voiceSession = null;
      app.voice = code === 'aborted' ? { status: 'idle' } : { status: 'error', error: code };
      app.render();
    };
    if (simulated) {
      const SAMPLES = ['Which accounts are growing the most?', 'What has declined?', 'Who should I see today?', 'Where am I losing the most volume?'];
      voiceSession = simulate(SAMPLES[sample++ % SAMPLES.length], { onText, onDone });
    } else {
      voiceSession = listen({ onText, onDone, onError });
    }
    app.focusAfter('[data-action="askVoiceStop"]');
  }

  function cancelVoice() {
    stopSpeaking();
    voiceSession?.cancel();
    voiceSession = null;
    app.voice = { status: 'idle' };
  }

  app.cancelVoice = cancelVoice;
  /** Picks up questions that were still being answered when the page reloaded. */
  app.resumeAsk = () => turns().filter((t) => t.status === 'thinking').forEach((t) => think(t.id));

  return {
    // ---- Navigation ------------------------------------------------------
    tab: ({ tab }) => app.switchTab(tab),
    back: () => app.back(),
    retry: () => app.retry(),
    openProfile: ({ id, tab }) => {
      const entity = getEntity(id);
      if (!entity) return app.toast('That profile isn’t in your book.');
      const entry = app.entry();
      if (entry.screen === entity.kind && entry.params.id === id) {
        app.closeSheet();
        if (tab) entry.ui.tab = tab;
        return;
      }
      app.push(entity.kind, { id }, tab ? { tab } : {});
    },
    openSiteProfile: ({ site }) => app.push('hco', { id: site }),
    profileTab: ({ tab }) => {
      app.entry().ui.tab = tab;
      app.focusAfter(`#tab-${tab}`);
    },
    volumeMode: ({ mode }) => { app.entry().ui.volumes = mode; },
    openGlobalSearch: () => {
      app.switchTab('targets', { root: true });
      app.focusAfter('#target-search');
    },
    openAccount: () => app.openSheet('account'),
    closeSheet: () => app.closeSheet(),
    toastUndo: () => app.undoToast(),
    toastClose: () => { app.hideToast(); return 'quiet'; },

    // ---- Targets ---------------------------------------------------------
    targetsQuery: ({ value }) => { ws().targets.query = value; },
    targetsClearQuery: () => {
      ws().targets.query = '';
      app.focusAfter('#target-search');
    },
    targetsKind: ({ kind }) => { ws().targets.kind = kind; },
    targetsView: ({ view }) => { ws().targets.view = view; },
    toggleSignal: ({ signal }) => {
      const list = ws().targets.signals;
      ws().targets.signals = list.includes(signal) ? list.filter((s) => s !== signal) : [...list, signal];
    },
    selectSite: ({ site }) => { ws().targets.site = site; },
    openFilters: () => app.openSheet('filters'),
    filterField: ({ field, value }) => { ws().targets[field] = value; },
    clearFilters: () => {
      const { query, kind, view } = ws().targets;
      ws().targets = { ...DEFAULT_FILTERS, query, kind, view };
      app.announce('Filters cleared');
    },

    // ---- Selecting targets and reviewing the plan ------------------------
    toggleSelect: ({ id }) => {
      const w = ws();
      const entity = getEntity(id);
      const day = w.selection.day;
      const draft = w.planDraft;
      const inDraft = draft?.day === day ? draft.items.findIndex((i) => i.isNew && i.targetId === id) : -1;
      let added;
      if (inDraft >= 0) {
        draft.items.splice(inDraft, 1);
        added = false;
      } else if (w.selection.ids.includes(id)) {
        w.selection.ids = w.selection.ids.filter((x) => x !== id);
        added = false;
      } else {
        w.selection.ids.push(id);
        added = true;
      }
      const count = w.selection.ids.length + (draft?.day === day ? draft.items.filter((i) => i.isNew).length : 0);
      app.announce(`${entity.name} ${added ? 'selected for' : 'removed from'} ${dayWord(day)}’s plan. ${plural(count, 'target')} selected.`);
    },
    clearSelection: () => withUndo('Selection cleared', ['selection'], () => { ws().selection.ids = []; }),
    reviewPlan: ({ day } = {}) => {
      const w = ws();
      const target = day || w.selection.day;
      const draft = ensureDraft(target);
      if (w.selection.ids.length) {
        draft.items = addTargets(draft.items, w.selection.ids.map(getEntity).filter(Boolean), (e) => siteFor(e));
        w.selection.ids = [];
      }
      const r = w.replacement;
      if (r && r.day === target) {
        const first = draft.items.find((i) => i.isNew && i.mode !== 'timed' && i.status === 'planned');
        if (first) {
          Object.assign(first, { mode: 'timed', time: r.time, duration: r.duration });
          w.replacement = null;
          app.toast(`${getEntity(first.targetId).name} placed in the free ${r.time} slot`);
        }
      }
      if (app.entry().screen !== 'plan') app.push('plan');
    },
    planDay: ({ day }) => {
      const draft = ws().planDraft;
      if (!draft || draft.day === day) return;
      const editedExisting = JSON.stringify(draft.items.filter((i) => !i.isNew)) !== JSON.stringify(ws().plans[draft.day] || []);
      const change = () => { ensureDraft(day); };
      if (editedExisting) withUndo(`Unsaved edits to ${dayWord(draft.day)}’s visits were set aside`, ['planDraft', 'selection'], change);
      else change();
    },
    planField: ({ item, field, value }) => {
      const it = draftItem(item);
      if (!it) return;
      if (field === 'duration') it.duration = Number(value);
      else if (field === 'mode') {
        it.mode = value;
        if (value === 'timed' && !it.time) it.time = suggestTime(ws().planDraft.items, it.id);
      } else if (field === 'time') {
        if (value) it.time = value;
      } else it[field] = value;
    },
    planGoal: ({ item, value }) => {
      const it = draftItem(item);
      if (it) it.goal = value;
    },
    planMove: ({ item, dir }) => {
      ws().planDraft.items = moveFlexible(ws().planDraft.items, item, Number(dir));
    },
    planRemove: ({ item }) => {
      const it = draftItem(item);
      if (!it) return;
      const name = getEntity(it.targetId).name;
      withUndo(it.isNew ? `${name} removed` : `${name} removed · save to confirm`, ['planDraft'], () => {
        ws().planDraft.items = ws().planDraft.items.filter((i) => i.id !== item);
      });
      app.focusAfter('.screen h1');
    },
    planRestore: ({ item }) => {
      const it = draftItem(item);
      if (!it) return;
      it.status = 'planned';
      delete it.cancelReason;
      if (ws().replacement?.itemId === item) ws().replacement = null;
    },
    planSuggest: () => {
      const coordsOf = (i) => siteFor(getEntity(i.targetId), i.siteId).coords;
      ws().planDraft.items = suggestOrder(ws().planDraft.items, coordsOf, REP.start.coords);
      app.toast('Flexible stops ordered nearest-first');
    },
    planAddMore: () => {
      const draft = ws().planDraft;
      if (draft) ws().selection.day = draft.day;
      app.switchTab('targets', { root: true });
      app.announce(`Select more targets, then choose Review plan.`);
    },
    planDiscard: () => {
      withUndo('Plan changes discarded', ['planDraft', 'selection', 'replacement'], () => {
        ws().planDraft = null;
        ws().selection.ids = [];
      });
      app.back();
    },
    planSave: () => {
      const w = ws();
      const draft = w.planDraft;
      if (!draft) return;
      if (conflicts(draft.items).length) return app.toast('Fix the time clashes before saving.');
      const before = { plans: clone(w.plans), planDraft: clone(draft) };
      w.plans[draft.day] = draft.items.map(({ isNew, ...rest }) => rest);
      w.planDraft = null;
      app.touch();
      app.prefetchPlan(draft.day);
      const stops = activeItems(w.plans[draft.day]).length;
      app.finishPlan(draft.day);
      app.toast(`Plan saved for ${dayWord(draft.day)} · ${plural(stops, 'stop')}`, { undo: () => Object.assign(app.ws, clone(before)) });
    },
    planYourDay: ({ day }) => {
      const w = ws();
      if (!(w.planDraft && app.ctx().planDirty())) w.planDraft = null;
      w.selection.day = day;
      app.switchTab('targets', { root: true });
      app.announce(`Select people or accounts for ${dayWord(day)}, then choose Review plan.`);
    },
    todayDay: ({ day }) => {
      app.entry().ui.day = day;
      const w = ws();
      if (!w.selection.ids.length && !(w.planDraft && app.ctx().planDirty())) {
        w.selection.day = day;
        w.planDraft = null;
      }
    },
    openPlanMap: () => {
      const w = ws();
      w.selection.day = app.todayIso;
      w.targets = { ...w.targets, planned: 'planned', view: 'map', signals: [], site: undefined };
      app.switchTab('targets', { root: true });
      app.toast('Showing today’s planned targets on the map');
    },
    findReplacement: () => showReplacements(),
    clearReplacement: () => {
      ws().replacement = null;
      resetReplacementFilters();
      app.closeSheet();
    },
    /** Puts someone in the free slot as a requested visit, then shows that day on Today. */
    fillSlot: ({ id }) => {
      const r = ws().replacement;
      const entity = getEntity(id);
      if (!r || !entity) return;
      const item = {
        id: uid('v'), targetId: id, siteId: siteOnDay(entity, fromIso(r.day).getDay()) || siteFor(entity).id,
        mode: 'timed', time: r.time, duration: r.duration, type: entity.kind === 'hco' ? 'Meeting' : 'In-person visit', goal: '', status: 'planned',
        booking: 'requested', via: bookingRoute(entity).label,
      };
      withUndo(`${entity.name} added at ${r.time} · not confirmed yet`, ['plans', 'planDraft', 'replacement', 'targets'], () => {
        addItem(r.day, item);
        ws().replacement = null;
        resetReplacementFilters();
      });
      app.switchTab('today', { root: true });
      app.entry().ui.day = r.day;
    },

    // ---- Booking -----------------------------------------------------------
    bookVisit: ({ target, from, fromDay }) => app.openSheet('book', { target, from, fromDay }),
    bookField: ({ field, value }) => {
      const sheet = app.sheet;
      sheet[field] = value;
      if (sheet.error) sheet.error = null;
    },
    saveBooking: () => {
      const sheet = app.sheet;
      const ctx = app.ctx();
      const w = ws();
      const target = getEntity(sheet.target);
      const from = sheet.from ? findItem(sheet.fromDay, sheet.from) : null;
      const slots = ctx.slotsFor(target, from?.id);
      const pick = sheet.pick ?? (slots.length ? '0' : 'other');
      const fail = (field, message) => { sheet.error = { field, message }; app.focusAfter('.sheet [aria-invalid="true"]'); };
      let slot = pick === 'other' ? null : slots[Number(pick)];
      if (!slot) {
        const day = sheet.day || app.todayIso;
        if (!sheet.time) return fail('time', 'Choose a start time.');
        slot = { day, time: sheet.time, siteId: siteOnDay(target, fromIso(day).getDay()) || siteFor(target).id };
      }
      const duration = from?.duration ?? (target.kind === 'hco' ? 45 : 30);
      if (activeItems(w.plans[slot.day]).some((i) => i.targetId === target.id && i.id !== from?.id)) {
        return fail('time', `${target.name} is already in your plan ${onDay(slot.day, ctx)}.`);
      }
      const clash = clashesWith(w.plans[slot.day], slot.time, duration, from?.id)[0];
      if (clash) return fail('time', `Clashes with ${getEntity(clash.targetId).name} at ${clash.time}.`);
      const confirmed = !!sheet.confirmed;
      const route = bookingRoute(target);
      const item = {
        id: uid('v'), targetId: target.id, siteId: slot.siteId, mode: 'timed', time: slot.time, duration,
        type: from?.type ?? (target.kind === 'hco' ? 'Meeting' : 'In-person visit'), goal: from?.goal ?? '', status: 'planned',
        booking: confirmed ? 'confirmed' : 'requested', via: route.label,
      };
      const when = `${onDay(slot.day, ctx)} at ${slot.time}`;
      withUndo(confirmed ? `Booked ${when}` : `Requested ${when} · mark it confirmed when they reply`, ['plans', 'planDraft'], () => {
        if (from?.status === 'planned') removeItem(sheet.fromDay, from.id);
        addItem(slot.day, item);
      });
      app.prefetchPlan(slot.day);
      app.closeSheet();
    },
    confirmBooking: ({ item, day }) => {
      withUndo('Visit confirmed', ['plans', 'planDraft'], () => forItem(day, item, (x) => { x.booking = 'confirmed'; }));
      app.closeSheet();
    },

    // ---- Visits ----------------------------------------------------------
    visitOptions: ({ item, day }) => app.openSheet('visitOptions', { item, day }),
    logVisit: ({ item, day } = {}) => {
      const it = item ? findItem(day, item) : null;
      app.openSheet('note', it ? { target: it.targetId, item, day } : {});
    },
    cancelVisit: ({ item, day }) => app.openSheet('cancel', { item, day }),
    /** Cancels with the reason tapped; a timed visit's slot is then offered to someone nearby. */
    confirmCancelVisit: ({ item, day, reason = '' }) => {
      const it = findItem(day, item);
      if (!it) return app.closeSheet();
      const target = getEntity(it.targetId);
      const freesSlot = it.mode === 'timed' && day >= app.todayIso;
      withUndo(freesSlot ? `Visit cancelled · ${it.time} is free` : 'Visit cancelled', ['plans', 'planDraft', 'replacement'], () => {
        forItem(day, item, (x) => { x.status = 'cancelled'; x.cancelReason = reason; });
        if (freesSlot) ws().replacement = { day, time: it.time, duration: it.duration, siteId: siteFor(target, it.siteId).id, name: target.name, targetId: target.id, itemId: item };
      });
      if (freesSlot) showReplacements();
      else app.closeSheet();
    },
    reopenVisit: ({ item, day }) => {
      forItem(day, item, (x) => { x.status = 'planned'; });
      app.touch();
      app.closeSheet();
      app.toast('Visit marked as not done');
    },
    restoreVisit: ({ item, day }) => {
      forItem(day, item, (x) => { x.status = 'planned'; delete x.cancelReason; });
      if (ws().replacement?.itemId === item) ws().replacement = null;
      app.touch();
      app.closeSheet();
      app.toast('Visit restored');
    },

    // ---- Notes -----------------------------------------------------------
    addNote: ({ target, contact }) => app.openSheet('note', { target, contact }),
    editNote: ({ id }) => app.openSheet('note', { edit: id }),
    resumeDraft: ({ key }) => {
      if (key.startsWith('edit:')) app.openSheet('note', { edit: key.slice(5) });
      else app.openSheet('note', key === '_new' ? {} : { target: key });
    },
    noteField: ({ field, value }) => {
      const sheet = app.sheet;
      const key = noteKey(sheet);
      ws().drafts[key] = { ...noteDraft(sheet, app.ctx()), [field]: value, updatedAt: new Date().toISOString() };
      return field === 'note' || field === 'followText' ? 'quiet' : undefined;
    },
    noteTarget: ({ value }) => {
      const sheet = app.sheet;
      ws().drafts[noteKey(sheet)] = { ...noteDraft(sheet, app.ctx()), targetId: value, updatedAt: new Date().toISOString() };
      if (sheet.error?.field === 'targetId') sheet.error = null;
    },
    /** Speak a note: speech becomes text in the note, after anything already typed. */
    noteDictate: () => {
      const sheet = app.sheet;
      if (dictation) return dictation.stop();
      const key = noteKey(sheet);
      const before = noteDraft(sheet, app.ctx()).note.trim();
      const join = (text) => [before, text].filter(Boolean).join(before && !/[.!?]$/.test(before) ? '. ' : ' ');
      const finish = (text) => {
        dictation = null;
        if (app.sheet !== sheet) return;
        sheet.dictating = false;
        if (text) ws().drafts[key] = { ...noteDraft(sheet, app.ctx()), note: join(text), spoken: true, updatedAt: new Date().toISOString() };
        app.render();
      };
      const onText = (text) => { const el = document.getElementById('note-text'); if (el) el.value = join(text); };
      // Without a working microphone the demo plays a sample, so the flow can still be tried.
      const sample = (why) => {
        app.toast(`${why}, so here’s a sample spoken note.`);
        sheet.dictating = true;
        dictation = simulate('Talked through the outcomes data. They want the one-page summary before Friday and asked about training for the new team.', { onText, onDone: finish, wordMs: 90 });
        app.render();
      };
      sheet.dictating = true;
      if (!canListen()) return sample('This browser can’t turn speech into text');
      dictation = listen({
        onText,
        onDone: finish,
        onError: (code) => {
          finish('');
          if (code === 'no-speech') app.toast('Didn’t catch that. Tap Speak and try again.');
          else if (code !== 'aborted') sample(['not-allowed', 'service-not-allowed', 'audio-capture'].includes(code) ? 'The microphone isn’t available' : 'Speech isn’t available here');
        },
      });
      app.focusAfter('[data-action="noteDictate"]');
    },
    saveNote: ({ values = {} }) => {
      const sheet = app.sheet;
      const w = ws();
      const key = noteKey(sheet);
      const d = { ...noteDraft(sheet, app.ctx()), ...values, followOn: sheet.edit ? false : values.followOn === 'on' };
      const fail = (field, message) => { sheet.error = { field, message }; app.focusAfter(`.sheet [aria-invalid="true"]`); };
      if (!d.targetId) return fail('targetId', 'Choose who this was with.');
      if (!d.outcome) return fail('outcome', 'Choose what happened, even if it was only a message.');
      if (!d.date || d.date > app.todayIso) return fail('date', 'Use today or an earlier date.');
      if (d.followOn && !d.followText?.trim()) return fail('followText', 'Say what needs to happen, or untick “Create a follow-up”.');
      const before = { interactions: clone(w.interactions), followUps: clone(w.followUps), plans: clone(w.plans), planDraft: clone(w.planDraft), drafts: clone(w.drafts) };
      const target = getEntity(d.targetId);
      const parts = [];
      if (sheet.edit) {
        const i = w.interactions.find((x) => x.id === sheet.edit);
        Object.assign(i, { type: d.type, outcome: d.outcome, date: d.date, note: d.note.trim(), edited: true, ...(d.spoken ? { spoken: true } : {}) });
        parts.push('Note updated');
      } else {
        const interaction = {
          id: uid('i'), targetId: target.id, attendees: target.kind === 'hcp' ? [target.id] : [], contacts: d.contacts || [],
          date: d.date, type: d.type, outcome: d.outcome, author: 'You', note: d.note.trim(), local: true, createdAt: Date.now(),
          ...(d.spoken ? { spoken: true } : {}),
        };
        w.interactions.push(interaction);
        parts.push(`${d.type === 'In-person visit' ? 'Visit' : d.type} logged`);
        if (d.followOn) {
          w.followUps.push({ id: uid('f'), targetId: target.id, text: d.followText.trim(), due: d.followDue || isoDate(addDays(app.today, 7)), done: false, interactionId: interaction.id, local: true });
          parts.push('follow-up created');
        }
        if (sheet.item) {
          forItem(sheet.day, sheet.item, (x) => { x.status = 'done'; x.interactionId = interaction.id; });
          parts.push('visit done');
        }
      }
      delete w.drafts[key];
      app.touch();
      app.closeSheet();
      app.toast(parts.join(' · '), { undo: () => Object.assign(app.ws, clone(before)) });
    },
    discardDraft: ({ key }) => {
      withUndo('Draft discarded', ['drafts'], () => { delete ws().drafts[key]; });
      app.closeSheet();
    },
    deleteNote: ({ id }) => {
      withUndo('Note deleted', ['interactions'], () => {
        ws().interactions.find((i) => i.id === id).deleted = true;
        delete ws().drafts[`edit:${id}`];
      });
      app.closeSheet();
    },

    // ---- Follow-ups --------------------------------------------------------
    addFollowUp: ({ target }) => app.openSheet('followup', { target }),
    newFollowUp: () => app.openSheet('followup', {}),
    editFollowUp: ({ id }) => app.openSheet('followup', { id }),
    followField: ({ field, value }) => {
      const sheet = app.sheet;
      sheet.values = { ...followDraft(sheet, app.ctx()), [field]: value };
      return field === 'text' ? 'quiet' : undefined;
    },
    followTarget: ({ value }) => {
      const sheet = app.sheet;
      sheet.values = { ...followDraft(sheet, app.ctx()), targetId: value };
      if (sheet.error?.field === 'targetId') sheet.error = null;
    },
    followDue: ({ due }) => {
      const sheet = app.sheet;
      sheet.values = { ...followDraft(sheet, app.ctx()), due };
    },
    saveFollowUp: ({ values = {} }) => {
      const sheet = app.sheet;
      const v = { ...followDraft(sheet, app.ctx()), ...values };
      const fail = (field, message) => { sheet.error = { field, message }; app.focusAfter(`.sheet [aria-invalid="true"]`); };
      if (!v.targetId) return fail('targetId', 'Choose who the follow-up is for.');
      if (!v.text?.trim()) return fail('text', 'Say what needs to happen.');
      if (!v.due) return fail('due', 'Choose a due date.');
      withUndo(sheet.id ? 'Follow-up updated' : `Follow-up created for ${getEntity(v.targetId).name}`, ['followUps'], () => {
        if (sheet.id) Object.assign(ws().followUps.find((f) => f.id === sheet.id), { text: v.text.trim(), due: v.due });
        else ws().followUps.push({ id: uid('f'), targetId: v.targetId, text: v.text.trim(), due: v.due, done: false, local: true });
      });
      app.closeSheet();
    },
    toggleFollowUp: ({ id }) => {
      const f = ws().followUps.find((x) => x.id === id);
      withUndo(f.done ? 'Follow-up reopened' : 'Follow-up done', ['followUps'], () => {
        f.done = !f.done;
        f.doneOn = f.done ? app.todayIso : undefined;
      });
    },
    deleteFollowUp: ({ id }) => {
      withUndo('Follow-up deleted', ['followUps'], () => { ws().followUps = ws().followUps.filter((f) => f.id !== id); });
      app.closeSheet();
    },

    // ---- Activity ----------------------------------------------------------
    activityView: ({ view }) => { ws().activity.view = view; },
    journalQuery: ({ value }) => { ws().activity.query = value; },
    journalClear: () => {
      ws().activity.query = '';
      app.focusAfter('#journal-search');
    },

    // ---- Ask Field Pro -------------------------------------------------------
    askSubmit: ({ values }) => ask(values?.q, 'typed'),
    askInput: ({ value }) => {
      askEntry().ui.draft = value;
      return 'quiet';
    },
    askSuggestion: ({ q }) => ask(q, 'chip'),
    askRetry: ({ id }) => {
      const turn = turns().find((t) => t.id === id);
      if (!turn) return;
      turn.status = 'thinking';
      delete turn.error;
      app.focusAfter(`#turn-${id} .ask-q`);
      think(id);
    },
    askClear: () => {
      stopSpeaking();
      askEntry().ui.turns = [];
      app.focusAfter('#ask-input');
    },
    askReadAloud: () => {
      const ui = askEntry().ui;
      ui.readAloud = ui.readAloud === false;
      if (!ui.readAloud) stopSpeaking();
      app.announce(ui.readAloud ? 'Answers to voice questions will be read aloud' : 'Answers will not be read aloud');
    },
    askListen: ({ id }) => {
      const turn = turns().find((t) => t.id === id);
      if (turn?.result) speak(spoken(turn.result));
      return 'quiet';
    },
    askVoice: () => {
      if (app.voice.status === 'listening') return voiceSession?.stop();
      openAsk();
      startVoice(false);
    },
    askHandsFree: () => {
      const ui = askEntry().ui;
      ui.handsFree = !ui.handsFree;
      if (!ui.handsFree) {
        cancelVoice();
        app.announce('Hands-free off');
        return;
      }
      openAsk();
      startVoice(false);
    },
    askVoiceDemo: () => {
      openAsk();
      startVoice(true);
    },
    askVoiceStop: () => {
      voiceSession?.stop();
      return 'quiet';
    },
    askVoiceCancel: () => {
      cancelVoice();
      app.focusAfter('#ask-input');
    },

    // ---- Contacts, copying and account ---------------------------------------
    openContact: ({ org, exec }) => app.openSheet('contact', { org, exec }),
    copy: ({ value, label }) => {
      app.copy(value).then((ok) => app.toast(ok ? `${cap(label)} copied` : `Couldn’t copy. The ${label} is ${value}`));
      return 'quiet';
    },
    confirmReset: () => app.openSheet('confirm', {
      title: 'Reset sample data?',
      body: 'Notes, follow-ups and plan changes on this device are replaced with the original sample. This can’t be undone.',
      confirmLabel: 'Reset sample data',
      run: 'resetDemo',
      danger: true,
    }),
    resetDemo: () => {
      app.reset();
      app.toast('Sample data restored');
    },
  };
}
