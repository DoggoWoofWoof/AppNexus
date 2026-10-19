// Navigation: one stack per bottom tab, like native apps. Each entry keeps its
// own UI context (selected profile tab, toggles, scroll position) so Back
// returns the rep to exactly where they were.

export const TABS = [
  { id: 'today', label: 'Today', icon: 'house' },
  { id: 'targets', label: 'Targets', icon: 'target' },
  { id: 'ask', label: 'Ask', icon: 'sparkles' },
  { id: 'activity', label: 'Activity', icon: 'list-checks' },
  { id: 'insights', label: 'Insights', icon: 'chart-column' },
];

const NAV_KEY = 'fieldpro.nav.v2';
let seq = 0;

export const makeEntry = (screen, params = {}, ui = {}) => ({
  key: `${screen}-${Date.now().toString(36)}-${(seq++).toString(36)}`,
  screen,
  params,
  ui,
  scroll: 0,
});

export const freshNav = () => ({
  tab: 'today',
  stacks: Object.fromEntries(TABS.map((t) => [t.id, [makeEntry(t.id)]])),
});

export function loadNav(session, isKnownScreen) {
  try {
    const saved = JSON.parse(session?.getItem(NAV_KEY) || 'null');
    const valid = saved && TABS.some((t) => t.id === saved.tab) && TABS.every((t) =>
      Array.isArray(saved.stacks?.[t.id]) && saved.stacks[t.id].length && saved.stacks[t.id][0].screen === t.id &&
      saved.stacks[t.id].every((e) => isKnownScreen(e.screen)));
    if (valid) return saved;
  } catch {
    // Fall through to a fresh navigation state.
  }
  return freshNav();
}

export function saveNav(session, nav) {
  const strip = ({ status, error, ...rest }) => rest;
  try {
    session?.setItem(NAV_KEY, JSON.stringify({ tab: nav.tab, stacks: Object.fromEntries(Object.entries(nav.stacks).map(([k, s]) => [k, s.map(strip)])) }));
  } catch {
    // Session storage is optional.
  }
}

export const currentEntry = (nav) => nav.stacks[nav.tab].at(-1);
export const previousEntry = (nav) => nav.stacks[nav.tab].at(-2) || null;

export function push(nav, entry) {
  nav.stacks[nav.tab].push(entry);
  return entry;
}

export function pop(nav) {
  const stack = nav.stacks[nav.tab];
  return stack.length > 1 ? stack.pop() : null;
}

/** Switching tabs keeps each tab's stack; tapping the current tab returns to its root. */
export function switchTab(nav, tab) {
  if (nav.tab === tab) nav.stacks[tab] = [nav.stacks[tab][0]];
  else nav.tab = tab;
}
