// Holds the rep's workspace for the whole app. In memory for now: the sample is
// seeded fresh on each launch. On-device storage and sync come with the real services.

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { startOfDay } from './format';
import type { Workspace } from './types';
import { buildContext, freshWorkspace, type Context } from './workspace';

type Store = Context & { setWorkspace: (update: (ws: Workspace) => Workspace) => void };

const StoreContext = createContext<Store | null>(null);

export function WorkspaceProvider({ children, today: initialDay }: { children: ReactNode; today?: Date }) {
  const [today] = useState(() => initialDay ?? startOfDay());
  const [ws, setWs] = useState(() => freshWorkspace(today));
  const store = useMemo<Store>(() => ({ ...buildContext(ws, today), setWorkspace: setWs }), [ws, today]);
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useWorkspace(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return store;
}
