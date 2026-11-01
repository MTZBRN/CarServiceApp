export type Resource = 'customers' | 'vehicles' | 'appointments' | 'worksheets' | 'inventory' | 'settings' | 'dashboard';
type Listener = (resources: readonly Resource[]) => Promise<void>;
const listeners = new Set<Listener>();
export function subscribeChanges(listener: Listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export async function changed(resources: readonly Resource[]) {
  // A saved mutation remains successful even if a subsequent refresh fails. Resource state carries that error.
  await Promise.allSettled([...listeners].map(listener => listener(resources)));
}
export async function mutation<T>(request: Promise<T>, resources: readonly Resource[]): Promise<T> {
  const result = await request;
  await changed(resources);
  return result;
}
