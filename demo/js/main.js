// Entry point: preview controls (device, text size, theme, network) around the app.

import { NETWORK_MODES } from './api.js';
import { createApp } from './app.js';
import { loadMap } from './map.js';

const PREF_KEY = 'fieldpro.preview.v1';
const DEFAULTS = { view: 'phone', text: '1', theme: 'system', network: 'normal' };

const safe = (get) => { try { return get(); } catch { return null; } };
const storage = safe(() => window.localStorage);
const session = safe(() => window.sessionStorage);
const prefs = { ...DEFAULTS, ...(safe(() => JSON.parse(storage.getItem(PREF_KEY) || '{}')) || {}) };

const device = document.querySelector('.device');
const controls = document.querySelector('.preview');
const network = controls.querySelector('[data-group="network"]');
network.insertAdjacentHTML('beforeend', NETWORK_MODES.map((m) => `<button type="button" data-pref="network" data-value="${m.id}">${m.label}</button>`).join(''));

// On a real phone the device frame fills the screen, so start with the settings folded away.
const settings = controls.querySelector('details');
if (window.matchMedia('(min-width: 700px)').matches) settings.open = true;

function apply() {
  device.dataset.view = prefs.view;
  device.dataset.text = prefs.text === '2' ? 'large' : 'default';
  device.style.setProperty('--ts', prefs.text);
  if (prefs.theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = prefs.theme;
  for (const b of controls.querySelectorAll('[data-pref]')) b.setAttribute('aria-pressed', String(prefs[b.dataset.pref] === b.dataset.value));
  controls.querySelector('[data-summary]').textContent = [
    prefs.view === 'phone' ? 'Phone' : 'Wide screen',
    prefs.text === '2' ? '200% text' : '100% text',
    prefs.theme === 'system' ? 'System theme' : `${prefs.theme[0].toUpperCase()}${prefs.theme.slice(1)} theme`,
    NETWORK_MODES.find((m) => m.id === prefs.network)?.label,
  ].join(' · ');
}

apply();

const app = createApp({ root: document.getElementById('app'), storage, session, getMode: () => prefs.network });
app.start();
loadMap(new URL('../data/manhattan.json', import.meta.url)).then(() => app.render());

controls.addEventListener('click', (event) => {
  const pref = event.target.closest('[data-pref]');
  if (pref) {
    prefs[pref.dataset.pref] = pref.dataset.value;
    safe(() => storage.setItem(PREF_KEY, JSON.stringify(prefs)));
    apply();
    app.render();
    return;
  }
  if (event.target.closest('[data-reset]')) app.run('confirmReset');
});
