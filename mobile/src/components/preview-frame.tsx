// On a computer or an iPad the web build shows the app inside a phone, like the
// prototype in demo/, rather than stretched across the window. The page loads the
// app again in a frame the size of the device, so the app lays itself out as it
// would on one. On a phone the app just runs. Native builds use the .native file.

import { SourceSerif4_600SemiBold, useFonts } from '@expo-google-fonts/source-serif-4';
import { useEffect, useState } from 'react';

/**
 * True for the page around the app: a window of its own, bigger than a phone
 * held either way, as on a computer or an iPad. Inside the frame the app is in an
 * iframe, so this is false there. `?frame=off` shows the app on its own.
 */
export const IN_PREVIEW_FRAME =
  typeof window !== 'undefined' &&
  window.self === window.top &&
  window.innerWidth >= 600 &&
  window.innerHeight >= 480 &&
  new URLSearchParams(window.location.search).get('frame') !== 'off';

const VIEWS = [
  { value: 'phone', label: 'Phone' },
  { value: 'ipad', label: 'iPad' },
] as const;
type View = (typeof VIEWS)[number]['value'];

const VIEW_KEY = 'fieldpro.preview.view';

function keptView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'ipad' ? 'ipad' : 'phone';
  } catch {
    return 'phone';
  }
}

export function PreviewFrame() {
  useFonts({ SourceSerif4_600SemiBold });
  const [view, setView] = useState<View>(keptView);
  // The app opens on whatever page this was opened on, so links and reloads still work.
  const [src] = useState(() => window.location.href);

  useEffect(() => {
    document.title = 'Field Pro · app preview';
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      // Private browsing: the choice just isn't kept.
    }
  }, [view]);

  return (
    <div className="fp-page">
      <style>{CSS}</style>
      <header className="fp-bar">
        <p className="fp-title">
          <strong>Field Pro</strong>
          <span>App preview · sample data</span>
        </p>
        <div className="fp-group" role="group" aria-label="Device">
          <span className="fp-label">View</span>
          {VIEWS.map((v) => (
            <button key={v.value} type="button" aria-pressed={view === v.value} onClick={() => setView(v.value)}>
              {v.label}
            </button>
          ))}
        </div>
      </header>
      <main className="fp-stage">
        {/* Switching view only resizes the device, so the app keeps its place. */}
        <div className="fp-device" data-view={view}>
          <iframe title="Field Pro" src={src} allow="microphone; clipboard-write" onLoad={(e) => phoneScrollBars(e.currentTarget)} />
        </div>
      </main>
    </div>
  );
}

/**
 * A phone only shows a thin scroll bar while scrolling. With a mouse, a computer
 * draws a wide one that sits inside the phone, so the app's are hidden there;
 * the wheel and trackpad still scroll. The app is on this site too, so its page can be styled.
 */
function phoneScrollBars(frame: HTMLIFrameElement) {
  const doc = frame.contentDocument;
  if (!doc || !window.matchMedia('(pointer: fine)').matches) return;
  const style = doc.createElement('style');
  style.textContent = '* { scrollbar-width: none; } *::-webkit-scrollbar { display: none; }';
  doc.head.append(style);
}

// The page's colours and the device frame follow demo/css/tokens.css and preview.css.
const CSS = `
.fp-page {
  --page: #E8ECF4;
  --surface: #FFFFFF;
  --surface-2: #F8F9FC;
  --line: #E1E6F0;
  --line-strong: #CBD3E1;
  --ink: #0B1220;
  --muted: #5B6478;
  --accent: #2447C4;
  --accent-strong: #2447C4;
  --focus: #2447C4;
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: auto;
  background: var(--page);
  color: var(--ink);
  font: 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
@media (prefers-color-scheme: dark) {
  .fp-page {
    --page: #05080F;
    --surface: #131C2E;
    --surface-2: #18223A;
    --line: #26324A;
    --line-strong: #34425F;
    --ink: #EEF2FA;
    --muted: #9AA6BD;
    --accent: #8FA9FF;
    --accent-strong: #4A6CF0;
    --focus: #A9BDFF;
  }
}
.fp-page *, .fp-page *::before, .fp-page *::after { box-sizing: border-box; }

.fp-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 20px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}
.fp-title { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px; margin: 0; }
.fp-title strong { font-family: SourceSerif4_600SemiBold, "Source Serif 4", Georgia, serif; font-size: 18px; font-weight: 600; }
.fp-title span { color: var(--muted); font-size: 13px; }

.fp-group { display: flex; align-items: center; gap: 4px; }
.fp-label {
  margin-right: 4px;
  font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}
.fp-group button {
  min-height: 34px;
  padding: 4px 14px;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.fp-group button:hover { border-color: var(--accent); }
.fp-group button[aria-pressed="true"] { background: var(--accent-strong); border-color: var(--accent-strong); color: #FFFFFF; }
.fp-group button:focus-visible { outline: 2.5px solid var(--focus); outline-offset: 2px; }

.fp-stage { flex: 1 0 auto; display: flex; justify-content: center; align-items: flex-start; padding: 20px 16px 28px; }

/* An iPhone screen, 390 by 844 inside the bezel, shorter when the window is. */
.fp-page .fp-device {
  box-sizing: content-box;
  flex: none;
  width: 390px;
  height: min(844px, calc(100vh - 130px));
  height: min(844px, calc(100dvh - 130px));
  min-height: 540px;
  overflow: hidden;
  border: 10px solid #0B1220;
  border-radius: 44px;
  background: #0B1220;
  box-shadow: 0 30px 60px -20px rgb(11 18 32 / 0.45), 0 0 0 1px rgb(255 255 255 / 0.06);
}
/* An iPad Air screen, 820 by 1180, narrower or shorter when the window is. */
.fp-page .fp-device[data-view="ipad"] {
  width: min(820px, calc(100% - 24px));
  height: min(1180px, calc(100vh - 134px));
  height: min(1180px, calc(100dvh - 134px));
  min-height: 540px;
  border-width: 12px;
  border-radius: 32px;
}
.fp-device iframe { display: block; width: 100%; height: 100%; border: 0; background: #F4F6FA; }
@media (prefers-color-scheme: dark) {
  /* A bezel the colour of the app's dark background would disappear into it. */
  .fp-page .fp-device { border-color: #262F43; background: #262F43; }
  .fp-device iframe { background: #0B1220; }
}

/* A window as narrow as a phone: the frame is the screen. */
@media (max-width: 520px) {
  .fp-bar { display: none; }
  .fp-stage { padding: 0; }
  .fp-page .fp-device,
  .fp-page .fp-device[data-view="ipad"] { width: 100%; height: 100vh; height: 100dvh; min-height: 0; border: 0; border-radius: 0; box-shadow: none; }
}
`;
