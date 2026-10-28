import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthProvider';
import type { Resource } from '../api/changes';
import { subscribeChanges } from '../api/changes';
import { createWorkshopStore, type ResourceState } from './workshopStore';

type Store = ReturnType<typeof createWorkshopStore>;
const Context = createContext<Store | null>(null);
function SessionData({ children }: { children: ReactNode }) {
  const [store] = useState(createWorkshopStore);
  useEffect(() => subscribeChanges(store.refresh), [store]);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function WorkshopDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // A session change destroys all cached business records, errors, and in-flight references.
  const key = user ? localStorage.getItem('authToken') : 'anonymous';
  return <SessionData key={key}>{children}</SessionData>;
}
export function useWorkshopData() {
  const store = useContext(Context);
  if (!store) throw new Error('WorkshopDataProvider missing');
  return store;
}
export function useWorkshopResource<K extends Resource>(name: K) {
  const { resources } = useWorkshopData();
  type Data = ReturnType<Store['resources'][K]['snapshot']>['data'];
  const record = resources[name];
  // The key determines both the fetcher and snapshot's data type.
  const state = useSyncExternalStore(record.subscribe, record.snapshot as () => ResourceState<Data>);
  useEffect(() => { void record.load(); }, [record]);
  return useMemo(() => ({ ...state, refresh: record.refresh }), [state, record]);
}
