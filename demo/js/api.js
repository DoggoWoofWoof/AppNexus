// Mock service layer. Profiles "load" with latency so loading, offline and
// error states are real. Swap `load` for real fetches when wiring the backend.

export const NETWORK_MODES = [
  { id: 'normal', label: 'Normal' },
  { id: 'slow', label: 'Slow network' },
  { id: 'offline', label: 'Offline' },
  { id: 'error', label: 'Server errors' },
];

export class ApiError extends Error {
  constructor(kind) {
    super(kind);
    this.kind = kind; // 'offline' | 'server' | 'not-found'
  }
}

export function createApi({ getMode, latency = { normal: 450, slow: 2200 } } = {}) {
  const cache = new Map();
  const failedOnce = new Set();
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function load(key, resolve) {
    if (cache.has(key)) return cache.get(key);
    const mode = getMode();
    if (mode === 'offline') throw new ApiError('offline');
    await wait(latency[mode] ?? latency.normal);
    // Server errors fail the first attempt for each resource so Retry can recover.
    if (getMode() === 'error' && !failedOnce.has(key)) {
      failedOnce.add(key);
      throw new ApiError('server');
    }
    if (getMode() === 'offline') throw new ApiError('offline');
    const value = resolve();
    if (value == null) throw new ApiError('not-found');
    cache.set(key, value);
    return value;
  }

  return {
    load,
    has: (key) => cache.has(key),
    /** Keeps a copy for offline use without showing a loading state. */
    prefetch: (key, resolve) => { if (!cache.has(key) && getMode() !== 'offline') cache.set(key, resolve()); },
    reset: () => { cache.clear(); failedOnce.clear(); },
  };
}
