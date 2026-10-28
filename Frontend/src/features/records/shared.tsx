import { useRef, useState, type ReactNode } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { Search, Plus } from 'lucide-react';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { Input } from '../../components/ui/Fields';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/StateViews';
import { apiErrorMessage } from '../../api/client';
import { useToast } from '../../components/ui/ToastProvider';
import './records.css';
export const money = (value: number) => Number.isFinite(value) && value >= 0 ? new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 2 }).format(value) : 'Adathiba: ' + String(value);
export const date = (value?: string | null) => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleDateString('hu-HU') : 'Nincs megadva';
export function inspection(value?: string | null) {
 if (!value) return { text: 'Nincs megadva', tone: 'neutral' as const };
 const expiry = new Date(value); expiry.setHours(0,0,0,0); const today = new Date(); today.setHours(0,0,0,0);
 const days = differenceInCalendarDays(expiry, today);
 return !Number.isFinite(days) ? { text: 'Hibás dátum', tone: 'danger' as const } : days < 0 ? { text: 'Lejárt', tone: 'danger' as const } : days <= 30 ? { text: 'Hamarosan lejár', tone: 'warning' as const } : { text: 'Érvényes', tone: 'success' as const };
}
export function stock(value: number) { return !Number.isInteger(value) || value < 0 ? { text: 'Adathiba', tone: 'danger' as const } : value === 0 ? { text: 'Nincs készleten', tone: 'neutral' as const } : value < 5 ? { text: 'Alacsony készlet', tone: 'warning' as const } : { text: 'Készleten', tone: 'success' as const }; }
export function Toolbar({ search, onSearch, count, total, action, children }: { search: string; onSearch: (s: string) => void; count: number; total: number; action?: ReactNode; children?: ReactNode }) {
 return <div className="records-toolbar"><div className="records-search"><Search size={17} aria-hidden="true" /><Input aria-label="Keresés" placeholder="Keresés…" value={search} onChange={e => onSearch(e.target.value)} /></div>{children}<span className="records-count" role="status">{count} / {total} találat</span>{action}</div>;
}
export function NewButton({ children, onClick }: { children: ReactNode; onClick: () => void }) { return <Button onClick={onClick}><Plus size={16} aria-hidden="true" />{children}</Button>; }
export function ListState({ loading, error, count, total, retry, reset, children, emptyTitle = "Még nincs rögzített adat", emptyMessage = "Az első tételt a fenti új gombbal rögzítheted." }: { loading: boolean; error: unknown; count: number; total: number; retry: () => void; reset: () => void; emptyTitle?: string; emptyMessage?: string; children: ReactNode }) {
 return <>{error != null && <ErrorState message={apiErrorMessage(error, 'Az adatok betöltése nem sikerült.')} onRetry={retry} />}{loading && <LoadingState />}{!loading && !error && !total ? <EmptyState title={emptyTitle}>{emptyMessage}</EmptyState> : !loading && !error && !count ? <EmptyState title="Nincs keresési találat" action={<Button variant="secondary" onClick={reset}>Szűrők törlése</Button>} /> : count > 0 ? children : null}</>;
}
export function useRemoval<T extends { id: number }>(remove: (id: number) => Promise<unknown>) {
 const [target, setTarget] = useState<T | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const lock = useRef(false); const { showToast } = useToast();
 return { target, ask: (t: T) => { setError(''); setTarget(t); }, dialog: target && <ConfirmDialog title="Törlés megerősítése" confirmLabel={busy ? 'Törlés…' : 'Törlés'} onCancel={() => { if (!lock.current) setTarget(null); }} onConfirm={async () => { if (lock.current) return; lock.current = true; setBusy(true); try { await remove(target.id); setTarget(null); showToast('Sikeres törlés.', 'success'); } catch (e) { setError(apiErrorMessage(e, 'A törlés nem sikerült.')); } finally { lock.current = false; setBusy(false); } }}>Biztosan törlöd ezt a tételt: {String('licensePlate' in target ? target.licensePlate : 'name' in target ? target.name : '#' + target.id)}? A művelet nem vonható vissza.{error && <span role="alert" className="records-error">{error}</span>}</ConfirmDialog> };
}
