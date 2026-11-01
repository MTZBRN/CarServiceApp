import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthProvider';
import type { Resource } from '../api/changes';
import { subscribeChanges } from '../api/changes';
import { createWorkshopStore, type ResourceState } from './workshopStore';
import {queryKey} from './workshopStore';
import type {Query} from '../types/queries';

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
export function useWorkshopResource<K extends Resource>(name: K, query?:Query, enabled=true) {
  const store = useWorkshopData();
  type Data = ReturnType<Store['resources'][K]['snapshot']>['data'];
  const key=query?queryKey(query):'';
  // Canonical keys share pending requests even when callers construct a fresh parameter object.
  const record = useMemo(()=>query?store.query(name,query):store.resources[name],[store,name,key]);
  // The key determines both the fetcher and snapshot's data type.
  const state = useSyncExternalStore(record.subscribe, record.snapshot as () => ResourceState<Data>);
  useEffect(() => { if(enabled)void record.load(); }, [record,enabled]);
  return useMemo(() => ({ ...state, refresh: record.refresh }), [state, record]);
}
