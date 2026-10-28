import { customersApi } from '../api/customers';
import { vehiclesApi } from '../api/vehicles';
import { appointmentsApi } from '../api/appointments';
import { worksheetsApi } from '../api/worksheets';
import { inventoryApi } from '../api/inventory';
import { settingsApi } from '../api/settings';
import { type Resource } from '../api/changes';
import type { Customer, Vehicle, Appointment, ServiceJob, Part, WorkshopSettings } from '../types';

export interface ResourceState<T> { data: T; loading: boolean; error: unknown; loaded: boolean; }
function resource<T>(initial: T, fetcher: () => Promise<{ data: T }>) {
  let snapshot: ResourceState<T> = { data: initial, loading: false, error: null, loaded: false };
  let pending: Promise<void> | undefined;
  let requested = false;
  let revision = 0;
  const subscribers = new Set<() => void>();
  const publish = (next: ResourceState<T>) => { snapshot = next; subscribers.forEach(fn => fn()); };
  const load = (force = false): Promise<void> => {
    requested = true;
    if (!force && pending) return pending;
    if (!force && snapshot.loaded) return Promise.resolve();
    const current = ++revision;
    const token = localStorage.getItem('authToken');
    publish({ ...snapshot, loading: true, error: null });
    const task = fetcher().then(({ data }) => {
      if (current === revision && token === localStorage.getItem('authToken')) publish({ data, loading: false, loaded: true, error: null });
    }).catch((error: unknown) => {
      if (current === revision && token === localStorage.getItem('authToken')) publish({ ...snapshot, loading: false, loaded: true, error });
    }).finally(() => { if (current === revision) pending = undefined; });
    pending = task;
    return task;
  };
  return {
    snapshot: () => snapshot,
    subscribe: (fn: () => void) => { subscribers.add(fn); return () => { subscribers.delete(fn); }; },
    load, refresh: () => load(true), invalidate: () => requested ? load(true) : Promise.resolve(),
  };
}
export function createWorkshopStore() {
  const resources = {
    customers: resource<Customer[]>([], customersApi.list),
    vehicles: resource<Vehicle[]>([], vehiclesApi.list),
    appointments: resource<Appointment[]>([], appointmentsApi.list),
    worksheets: resource<ServiceJob[]>([], worksheetsApi.list),
    inventory: resource<Part[]>([], inventoryApi.list),
    settings: resource<WorkshopSettings | null>(null, settingsApi.get),
  };
  return { resources, refresh: async (names: readonly Resource[]) => { await Promise.all(names.map(name => resources[name].invalidate())); } };
}

