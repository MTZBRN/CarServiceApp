import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { LogOut, Menu } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import Sidebar from './Sidebar';
import PageHeader from './PageHeader';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import IconButton from '../ui/IconButton';
import DialogSurface from '../ui/DialogSurface';
const titles: Record<string, string> = { dashboard: 'Áttekintés', calendar: 'Szerviz Naptár', customers: 'Ügyfelek', vehicles: 'Járművek', worksheets: 'Munkalapok', inventory: 'Alkatrészek', users: 'Felhasználók', settings: 'Beállítások', audit: 'Eseménynapló' };
export default function AppShell({ children, onLogout, onDevTools, title }: { children: ReactNode; onLogout: () => void; onDevTools?: () => void; title?: string }) {
  const { user } = useAuth();
  const location = useLocation();
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('workshop.sidebar-collapsed') === 'true');
  const main = useRef<HTMLElement>(null);
  const previousPath = useRef(location.pathname);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const update = () => { setMobile(media.matches); setOpen(false); };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    setOpen(false);
    if (previousPath.current !== location.pathname) { main.current?.focus(); previousPath.current = location.pathname; }
  }, [location.key, location.pathname]);
  const toggle = () => { setCollapsed(value => { localStorage.setItem('workshop.sidebar-collapsed', String(!value)); return !value; }); };
  const section = location.pathname.split('/')[1];
  const details = section === 'vehicles' && location.pathname.split('/').length > 2;
  const worksheetDetail = section === 'worksheets' && location.pathname !== '/worksheets';
  const heading = title || (worksheetDetail ? (location.pathname.endsWith('/new') ? 'Új munkalap' : 'Munkalap') : details ? 'Jármű adatlapja' : titles[section] || 'Az oldal nem található');
  const close = () => setOpen(false);
  return <div className={'app-shell' + (!mobile && collapsed ? ' shell-collapsed' : '')}>
    <a className="skip-link" href="#main-content" onClick={() => main.current?.focus()}>Ugrás a tartalomra</a>
    {!mobile && <Sidebar collapsed={collapsed} onToggle={toggle} onNavigate={close} onLogout={onLogout} onDevTools={onDevTools} />}
    {mobile && open && <DialogSurface title="Navigáció" className="shell-drawer-overlay" onClose={close} dismissOnBackdrop initialFocus="first"><Sidebar mobile onClose={close} onNavigate={close} onLogout={() => { close(); onLogout(); }} onDevTools={onDevTools} /></DialogSurface>}
    <div className="shell-workspace">
      <header className="shell-topbar">
        {mobile && <IconButton label="Menü megnyitása" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(true)}><Menu size={21} aria-hidden="true" /></IconButton>}
        <PageHeader title={heading} breadcrumbs={worksheetDetail ? [{label:'Munkalapok',to:'/worksheets'},{label:location.pathname.endsWith('/new')?'Új munkalap':'Szerkesztés'}] : details ? [{ label: 'Járművek', to: '/vehicles' }, { label: 'Adatlap' }] : undefined} actions={<><span className="shell-role"><Badge tone="neutral">{user?.role === 'admin' ? 'Rendszergazda' : 'Szerelő'}</Badge></span><Button variant="ghost" onClick={onLogout}><LogOut size={16} aria-hidden="true" /><span>Kilépés</span></Button></>} />
      </header>
      <main className="app-main" id="main-content" ref={main} tabIndex={-1} aria-label={heading}><div className={'shell-page' + (section === 'calendar' ? ' shell-page-calendar' : '')}>{children}</div></main>
    </div>
  </div>;
}
