// The app shell: layout, navigation, resource loading, sheets, toasts and focus.

import { createActions } from './actions.js';
import { createApi } from './api.js';
import { allHcps, allOrgs, getEntity, getOrg, lastInteraction, priorityOf, signalsFor, siteFor } from './data/index.js';
import { REP } from './data/seed.js';
import { addDays, daysBetween, formatDate, fromIso, haversineKm, html, initials, isoDate, plural, startOfDay } from './format.js';
import { TABS, currentEntry, freshNav, loadNav, makeEntry, pop, previousEntry, push, saveNav, switchTab } from './nav.js';
import { activeItems } from './plan.js';
import { searchTargets } from './search.js';
import { renderSheet } from './sheets.js';
import { freshWorkspace, loadWorkspace, saveWorkspace } from './store.js';
import { button, emptyState, errorState, icon, skeleton } from './ui.js';
import * as activity from './screens/activity.js';
import * as ask from './screens/ask.js';
import * as hco from './screens/hco.js';
import * as hcp from './screens/hcp.js';
import * as insights from './screens/insights.js';
import * as plan from './screens/plan.js';
import * as targets from './screens/targets.js';
import * as today from './screens/today.js';

export const SCREENS = { today, targets, ask, activity, insights, hcp, hco, plan };

const clone = (value) => JSON.parse(JSON.stringify(value));
const FOCUS_KEYS = ['id', 'tab', 'item', 'day', 'signal', 'kind', 'view', 'mode', 'site', 'dir', 'key', 'due', 'field', 'target'];

/**
 * Builds the context screens render from: the workspace plus derived lookups
 * that depend on it. Exported so tests can render screens without a DOM.
 */
export function buildContext({ ws, entry, today: day, now = () => new Date(), sheet = null, voice = { status: 'idle' } }) {
  const todayIso = isoDate(day);
  const tomorrowIso = isoDate(addDays(day, 1));
  const signalCache = new Map();
  const signals = (e) => {
    if (!signalCache.has(e.id)) signalCache.set(e.id, signalsFor(e, ws, day));
    return signalCache.get(e.id);
  };
  const planItemFor = (id, d) => activeItems(ws.plans[d]).find((i) => i.targetId === id) || null;
  const strip = (items = []) => JSON.stringify(items.map(({ isNew, ...rest }) => rest));
  const dayName = (iso) => (iso === todayIso ? 'Today' : iso === tomorrowIso ? 'Tomorrow' : formatDate(iso, { weekday: 'long' }));
  const entities = [...allHcps(), ...allOrgs()];

  return {
    ws, entry, sheet, now, voice, today: day, todayIso,
    signals,
    planItemFor,
    dayName,
    lastInteraction: (id) => lastInteraction(id, ws),
    dayOf: (itemId) => Object.keys(ws.plans).find((d) => ws.plans[d].some((i) => i.id === itemId)),
    planDays: () => [{ iso: todayIso, label: 'Today' }, { iso: tomorrowIso, label: 'Tomorrow' }],
    planDraft: () => ws.planDraft || { day: ws.selection.day, items: clone(ws.plans[ws.selection.day] || []) },
    planDirty: () => !!ws.planDraft && strip(ws.planDraft.items) !== strip(ws.plans[ws.planDraft.day]),
    isSelected: (id) => ws.selection.ids.includes(id) ||
      !!(ws.planDraft?.day === ws.selection.day && ws.planDraft.items.some((i) => i.isNew && i.targetId === id)),
    search: (f) => {
      const origin = ws.replacement ? getOrg(ws.replacement.siteId).coords : REP.start.coords;
      return searchTargets(entities, f, {
        signals,
        distance: (e) => haversineKm(origin, siteFor(e).coords),
        planned: (e) => planItemFor(e.id, ws.selection.day),
        priority: (e) => priorityOf(e, ws, day),
        haystack: (e) => (e.kind === 'hcp'
          ? [e.name, e.specialty, e.npi, ...e.affiliations.map((a) => getOrg(a.orgId).name)]
          : [e.name, e.type, e.typeDetail, e.address, e.city]).join(' '),
      });
    },
    suggestions: (d, count) => {
      const planned = new Set(activeItems(ws.plans[d]).map((i) => i.targetId));
      return entities
        .filter((e) => !planned.has(e.id) && e.type !== 'Health system' && (e.kind === 'hcp' || e.assigned))
        .map((e) => ({ entity: e, signals: signals(e), priority: priorityOf(e, ws, day) }))
        .sort((a, b) => b.priority - a.priority)
        .slice(0, count);
    },
    weekStats: () => {
      const ago = (iso) => daysBetween(fromIso(iso), day);
      const people = allHcps();
      const open = ws.followUps.filter((f) => !f.done);
      return {
        logged: ws.interactions.filter((i) => !i.deleted && i.author === 'You' && ago(i.date) < 7).length,
        people: people.length,
        seen: people.filter((h) => { const last = lastInteraction(h.id, ws); return last && ago(last.date) <= 30; }).length,
        open: open.length,
        overdue: open.filter((f) => ago(f.due) > 0).length,
      };
    },
  };
}

export function createApp({ root, storage, session, now = () => new Date(), getMode = () => 'normal' }) {
  const app = { sheet: null, voice: { status: 'idle' }, api: createApi({ getMode }) };
  app.today = startOfDay(now());
  app.todayIso = isoDate(app.today);
  app.ws = loadWorkspace(storage, app.today);
  app.nav = loadNav(session, (s) => s in SCREENS);

  let pendingFocus = null;
  let pendingReveal = null;
  let sheetOpener = null;
  let lastKey = null;
  let toast = null;
  let toastTimer = null;
  let storageWarned = false;

  root.innerHTML = `<div class="app">
    <div class="app-main">
      <header class="appbar"></header>
      <div class="app-status"></div>
      <main class="screen" id="main" tabindex="-1"></main>
      <div class="tray-slot"></div>
    </div>
    <nav class="tabbar" aria-label="Main"></nav>
    <div class="sheet-layer"></div>
    <div class="toast-region" aria-live="polite"></div>
    <div class="sr-only" aria-live="polite" data-announcer></div>
  </div>`;
  const els = {
    main: root.querySelector('.app-main'),
    appbar: root.querySelector('.appbar'),
    status: root.querySelector('.app-status'),
    screen: root.querySelector('.screen'),
    tray: root.querySelector('.tray-slot'),
    tabbar: root.querySelector('.tabbar'),
    sheet: root.querySelector('.sheet-layer'),
    toast: root.querySelector('.toast-region'),
    announcer: root.querySelector('[data-announcer]'),
  };

  // ---- Context and helpers used by actions ---------------------------------

  app.ctx = () => buildContext({ ws: app.ws, entry: currentEntry(app.nav), today: app.today, now, sheet: app.sheet, voice: app.voice });
  app.entry = () => currentEntry(app.nav);
  app.touch = () => { app.ws.pristine = false; };
  app.focusAfter = (selector) => { pendingFocus = selector; };
  /** Scrolls an element to the top of the screen after the next render. */
  app.reveal = (selector) => { pendingReveal = selector; };
  app.announce = (message) => {
    els.announcer.textContent = '';
    setTimeout(() => { els.announcer.textContent = message; }, 50);
  };
  app.copy = (value) => (navigator.clipboard?.writeText(value).then(() => true, () => false) ?? Promise.resolve(false));

  // ---- Navigation ----------------------------------------------------------

  const saveScroll = () => { app.entry().scroll = els.screen.scrollTop; };

  app.push = (screen, params = {}, ui = {}) => {
    const from = app.sheet ? sheetOpener : captureFocus();
    app.sheet = null;
    sheetOpener = null;
    saveScroll();
    app.entry().returnFocus = from;
    push(app.nav, makeEntry(screen, params, ui));
    pendingFocus = 'heading';
  };

  app.back = () => {
    if (app.sheet) return app.closeSheet();
    if (!previousEntry(app.nav)) return;
    pop(app.nav);
    pendingFocus = app.entry().returnFocus || 'heading';
  };

  app.switchTab = (tab, { root: toRoot = false } = {}) => {
    app.sheet = null;
    sheetOpener = null;
    saveScroll();
    if (toRoot && app.nav.tab !== tab) {
      app.nav.tab = tab;
      app.nav.stacks[tab] = [app.nav.stacks[tab][0]];
    } else {
      switchTab(app.nav, tab);
    }
    pendingFocus = 'heading';
  };

  /** After saving a plan: leave the review screen and show the day on Today. */
  app.finishPlan = (day) => {
    for (const [tab, stack] of Object.entries(app.nav.stacks)) {
      const at = stack.findIndex((e) => e.screen === 'plan');
      if (at > 0) app.nav.stacks[tab] = stack.slice(0, at);
    }
    app.nav.tab = 'today';
    app.nav.stacks.today = [app.nav.stacks.today[0]];
    app.nav.stacks.today[0].ui.day = day;
    pendingFocus = 'heading';
  };

  app.retry = () => {
    const entry = app.entry();
    delete entry.status;
    delete entry.error;
  };

  app.prefetchPlan = (day) => {
    for (const item of activeItems(app.ws.plans[day])) {
      const target = getEntity(item.targetId);
      if (target) app.api.prefetch(`${target.kind}:${target.id}`, () => target);
    }
  };

  app.reset = () => {
    app.cancelVoice?.();
    app.ws = freshWorkspace(app.today);
    app.nav = freshNav();
    app.api.reset();
    app.sheet = null;
    sheetOpener = null;
    lastKey = null;
    pendingFocus = 'heading';
    app.prefetchPlan(app.todayIso);
  };

  // ---- Sheets --------------------------------------------------------------

  app.openSheet = (type, params = {}) => {
    if (!app.sheet) sheetOpener = captureFocus();
    app.sheet = { type, ...params };
    pendingFocus = '#sheet-title';
  };

  app.closeSheet = () => {
    if (!app.sheet) return;
    app.sheet = null;
    pendingFocus = sheetOpener;
    sheetOpener = null;
  };

  // ---- Toasts --------------------------------------------------------------

  app.toast = (message, { undo } = {}) => {
    clearTimeout(toastTimer);
    toast = { message, undo };
    els.toast.innerHTML = String(html`<div class="toast">${icon(undo ? 'circle-check' : 'info')}<span class="toast-text">${message}</span>${undo ? button({ label: 'Undo', action: 'toastUndo', variant: 'ghost', size: 'sm', className: 'toast-action' }) : ''}${button({ label: 'Dismiss', icon: 'x', action: 'toastClose', variant: 'ghost', size: 'sm', iconOnly: true })}</div>`);
    scheduleHide();
  };
  const scheduleHide = () => {
    clearTimeout(toastTimer);
    toastTimer = setTimeout(app.hideToast, toast?.undo ? 9000 : 5000);
  };
  app.hideToast = () => {
    clearTimeout(toastTimer);
    toast = null;
    els.toast.innerHTML = '';
  };
  app.undoToast = () => {
    const undo = toast?.undo;
    app.hideToast();
    if (undo) {
      undo();
      app.touch();
      app.toast('Undone');
    }
  };
  els.toast.addEventListener('focusin', () => clearTimeout(toastTimer));
  els.toast.addEventListener('focusout', () => toast && scheduleHide());
  els.toast.addEventListener('mouseenter', () => clearTimeout(toastTimer));
  els.toast.addEventListener('mouseleave', () => toast && scheduleHide());

  // ---- Rendering -----------------------------------------------------------

  function load(entry, res) {
    entry.status = 'loading';
    app.api.load(res.key, res.resolve).then(
      () => { entry.status = 'ready'; },
      (error) => { entry.status = 'error'; entry.error = error.kind || 'server'; },
    ).finally(() => {
      if (app.entry() !== entry) return;
      const active = document.activeElement;
      if (!active || active === document.body || active === els.screen) pendingFocus = 'heading';
      render();
    });
  }

  function resourceView(entry, res, screen) {
    if (!entry.status || entry.status === 'ready') load(entry, res);
    const what = entry.screen === 'hcp' || entry.screen === 'hco' ? 'this profile' : `your ${screen.title({ entry }).toLowerCase()}`;
    const backButton = previousEntry(app.nav) ? button({ label: 'Go back', action: 'back', variant: 'ghost' }) : '';
    const retry = button({ label: 'Try again', icon: 'refresh-cw', action: 'retry', variant: 'primary' });
    if (entry.status === 'error') {
      if (entry.error === 'offline') {
        return html`<h1 class="sr-only">${screen.title({ entry })}</h1>${emptyState({ icon: 'wifi-off', title: 'Not available offline', body: `${entry.screen === 'hcp' || entry.screen === 'hco' ? 'This profile' : 'This screen'} hasn’t been saved on this device yet. Profiles in today’s plan are saved automatically.`, actions: html`${retry}${backButton}` })}`;
      }
      if (entry.error === 'not-found') {
        return html`<h1 class="sr-only">Not found</h1>${emptyState({ icon: 'search-x', title: 'Profile not found', body: 'It may have been removed from your book.', actions: backButton })}`;
      }
      return html`<h1 class="sr-only">${screen.title({ entry })}</h1>${errorState({ title: `Couldn’t load ${what}`, body: 'The server didn’t respond. Your notes and plans are safe on this device.', actions: html`${retry}${backButton}` })}`;
    }
    return skeleton(entry.screen === 'targets' ? 'list' : 'profile');
  }

  function appbar(entry, ctx) {
    const screen = SCREENS[entry.screen];
    const prev = previousEntry(app.nav);
    const account = html`<button type="button" class="account-btn" data-action="openAccount" aria-label="Account and sync, ${REP.name}">${initials(REP.name)}</button>`;
    const search = entry.screen === 'targets' ? '' : button({ label: 'Search targets', icon: 'search', action: 'openGlobalSearch', variant: 'ghost', iconOnly: true });
    if (!prev) {
      return html`<span class="brand">${icon('activity', { className: 'brand-mark' })}<span class="brand-name">Field Pro</span><span class="brand-by">DocNexus</span></span><span class="appbar-actions">${search}${account}</span>`;
    }
    const prevTitle = SCREENS[prev.screen].title({ entry: prev, ws: app.ws });
    return html`<button type="button" class="back" data-action="back" aria-label="Back to ${prevTitle}">${icon('chevron-left')}<span class="back-label">${prevTitle}</span></button>
      <span class="appbar-title" aria-hidden="true">${screen.title({ entry, ws: app.ws })}</span>
      <span class="appbar-actions">${search}${account}</span>`;
  }

  function tabbar() {
    const due = app.ws.followUps.filter((f) => !f.done && f.due <= app.todayIso).length;
    return html`${TABS.map((t) => html`<button type="button" class="nav-btn" data-action="tab" data-tab="${t.id}"${t.id === app.nav.tab ? html` aria-current="page"` : ''}>
      ${icon(t.icon)}<span class="nav-label">${t.label}</span>${t.id === 'activity' && due ? html`<span class="nav-badge"><span class="sr-only">, </span>${due}<span class="sr-only"> due</span></span>` : ''}
    </button>`)}`;
  }

  function tray(entry, ctx) {
    if (entry.screen === 'plan') return '';
    const ws = app.ws;
    const draft = ws.planDraft;
    const dirty = ctx.planDirty();
    const picked = ws.selection.ids.length + (draft?.day === ws.selection.day ? draft.items.filter((i) => i.isNew).length : 0);
    if (!picked && !dirty) return '';
    const day = draft && dirty ? draft.day : ws.selection.day;
    const text = picked
      ? html`<strong>${plural(picked, 'target')} selected</strong><span class="caption">for ${ctx.dayName(day).toLowerCase()}${dirty && !ws.selection.ids.length ? ' · not saved yet' : ''}</span>`
      : html`<strong>Unsaved plan</strong><span class="caption">${ctx.dayName(day)} · review to save</span>`;
    return html`<div class="tray" role="region" aria-label="Plan selection">
      <span class="tray-icon" aria-hidden="true">${icon('calendar-check')}</span>
      <p class="tray-text">${text}</p>
      ${ws.selection.ids.length ? button({ label: 'Clear', action: 'clearSelection', variant: 'ghost', size: 'sm' }) : ''}
      ${button({ label: 'Review plan', icon: 'arrow-right', action: 'reviewPlan', data: { day }, variant: 'primary', size: 'sm' })}
    </div>`;
  }

  function sheetView(ctx) {
    if (!app.sheet) return '';
    const view = renderSheet(app.sheet, ctx);
    if (!view) return '';
    return html`<div class="sheet-backdrop" data-action="closeSheet"></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" data-sheet="${app.sheet.type}">
        <header class="sheet-head"><h2 id="sheet-title" tabindex="-1">${view.title}</h2>${button({ label: 'Close', icon: 'x', action: 'closeSheet', variant: 'ghost', iconOnly: true })}</header>
        ${view.content}
      </div>`;
  }

  function render() {
    const day = startOfDay(now());
    if (isoDate(day) !== app.todayIso) {
      app.today = day;
      app.todayIso = isoDate(day);
    }
    const entry = app.entry();
    const screen = SCREENS[entry.screen];
    // Listening stops when the rep leaves the Ask screen.
    if (app.voice.status !== 'idle' && entry.screen !== 'ask') app.cancelVoice?.();
    const focus = pendingFocus ?? captureFocus();
    pendingFocus = null;
    const sameEntry = lastKey === entry.key;
    if (sameEntry) entry.scroll = els.screen.scrollTop;
    if (entry.screen === 'plan' && !app.ws.planDraft) {
      app.ws.planDraft = { day: app.ws.selection.day, items: clone(app.ws.plans[app.ws.selection.day] || []) };
    }

    const ctx = app.ctx();
    const res = screen.resource?.(entry.params);
    const body = res && !app.api.has(res.key) ? resourceView(entry, res, screen) : screen.render(ctx);

    els.appbar.innerHTML = String(appbar(entry, ctx));
    els.status.innerHTML = getMode() === 'offline'
      ? String(html`<p class="offline-banner" role="status">${icon('wifi-off')}<span>You’re offline. Today’s plan and saved profiles still work; changes stay on this device.</span></p>`)
      : '';
    els.screen.innerHTML = String(body);
    els.screen.dataset.screen = entry.screen;
    els.screen.querySelector('h1')?.setAttribute('tabindex', '-1');
    els.tray.innerHTML = String(tray(entry, ctx));
    els.tabbar.innerHTML = String(tabbar());
    els.sheet.innerHTML = String(sheetView(ctx));
    els.main.inert = !!app.sheet;
    els.tabbar.inert = !!app.sheet;

    els.screen.scrollTop = entry.scroll || 0;
    if (pendingReveal) {
      // Scroll only the screen; scrollIntoView would also move the page around the device frame.
      const el = els.screen.querySelector(pendingReveal);
      if (el) els.screen.scrollTop += el.getBoundingClientRect().top - els.screen.getBoundingClientRect().top - 8;
      entry.scroll = els.screen.scrollTop;
      pendingReveal = null;
    }
    lastKey = entry.key;
    restoreFocus(focus);
    saveNav(session, app.nav);
    root.dataset.sheet = app.sheet ? app.sheet.type : '';
  }

  // ---- Focus ---------------------------------------------------------------

  function captureFocus() {
    const el = document.activeElement;
    if (!el || el === document.body || !root.contains(el)) return null;
    if (el.id) return { selector: `#${CSS.escape(el.id)}`, start: el.selectionStart, end: el.selectionEnd };
    const kind = ['action', 'change', 'input'].find((k) => el.dataset?.[k]);
    if (!kind) return null;
    let selector = `[data-${kind}="${CSS.escape(el.dataset[kind])}"]`;
    for (const k of FOCUS_KEYS) {
      if (el.dataset[k] != null) selector += `[data-${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}="${CSS.escape(el.dataset[k])}"]`;
    }
    return { selector };
  }

  function restoreFocus(target) {
    if (!target) return;
    const heading = () => els.screen.querySelector('h1') || els.screen;
    if (target === 'heading') return heading().focus({ preventScroll: true });
    const selector = typeof target === 'string' ? target : target.selector;
    const scope = app.sheet ? els.sheet : root;
    const el = scope.querySelector(selector);
    if (el && !el.disabled) {
      el.focus({ preventScroll: !!el.closest('.screen') });
      if (target.start != null && typeof el.setSelectionRange === 'function') {
        try { el.setSelectionRange(target.start, target.end); } catch { /* not a text field */ }
      }
    } else if (app.sheet) {
      els.sheet.querySelector('#sheet-title')?.focus();
    } else {
      heading().focus({ preventScroll: true });
    }
  }

  // ---- Events --------------------------------------------------------------

  const actions = createActions(app);
  app.actions = actions;

  function dispatch(name, params) {
    const fn = actions[name];
    if (!fn) {
      console.warn(`No action named "${name}"`);
      return;
    }
    const result = fn(params);
    if (!saveWorkspace(storage, app.ws) && !storageWarned) {
      storageWarned = true;
      app.toast('This browser isn’t saving changes (private mode?). They’ll be lost on reload.');
    }
    if (result !== 'quiet') render();
  }
  app.run = (name, params = {}) => dispatch(name, params);

  root.addEventListener('click', (event) => {
    const el = event.target.closest('[data-action]');
    if (!el || !root.contains(el) || el.disabled) return;
    event.preventDefault();
    dispatch(el.dataset.action, { ...el.dataset, value: el.value });
  });
  root.addEventListener('input', (event) => {
    const el = event.target;
    if (el.dataset?.input) dispatch(el.dataset.input, { ...el.dataset, value: el.value });
  });
  root.addEventListener('change', (event) => {
    const el = event.target;
    if (el.dataset?.change) dispatch(el.dataset.change, { ...el.dataset, value: el.type === 'checkbox' ? el.checked : el.value });
  });
  root.addEventListener('submit', (event) => {
    const form = event.target;
    if (!form.dataset?.submit) return;
    event.preventDefault();
    dispatch(form.dataset.submit, { ...form.dataset, values: Object.fromEntries(new FormData(form)) });
  });
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && app.voice.status !== 'idle' && !app.sheet) {
      event.preventDefault();
      dispatch('askVoiceCancel', {});
      return;
    }
    if (event.key === 'Escape' && app.sheet) {
      event.preventDefault();
      dispatch('closeSheet', {});
      return;
    }
    const tab = event.target.closest?.('[role="tab"]');
    if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      const list = [...tab.parentElement.querySelectorAll('[role="tab"]')];
      const i = list.indexOf(tab);
      const next = event.key === 'Home' ? list[0] : event.key === 'End' ? list.at(-1) : list[(i + (event.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length];
      event.preventDefault();
      dispatch('profileTab', { tab: next.dataset.tab });
      next.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }
  });

  app.render = render;
  app.start = () => {
    app.prefetchPlan(app.todayIso);
    render();
    app.resumeAsk();
  };
  return app;
}
