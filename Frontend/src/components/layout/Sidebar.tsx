import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { CalendarDays, Car, ChevronLeft, ChevronRight, FileText, LayoutDashboard, LogOut, Package, Settings, ShieldCheck, Users, Wrench, Code2, X, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { profilePictureUrl } from '../../api/client';
import { useWorkshopResource } from '../../data/useWorkshopData';
import IconButton from '../ui/IconButton';
interface Props { collapsed?: boolean; mobile?: boolean; onToggle?: () => void; onClose?: () => void; onNavigate: () => void; onLogout: () => void; onDevTools?: () => void; }
const primary: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/dashboard', label: 'Áttekintés', icon: LayoutDashboard },
  { to: '/calendar', label: 'Naptár', icon: CalendarDays },
  { to: '/customers', label: 'Ügyfelek', icon: Users },
  { to: '/vehicles', label: 'Járművek', icon: Car },
  { to: '/inventory', label: 'Alkatrészek', icon: Package },
];
export default function Sidebar({ collapsed = false, mobile = false, onToggle, onClose, onNavigate, onLogout, onDevTools }: Props) {
  const { user } = useAuth();
  const { data: settings } = useWorkshopResource('settings');
  const [picture, setPicture] = useState<string | null>(null);
  useEffect(() => {
    const update = () => {
      try { const data = JSON.parse(localStorage.getItem('user_data') || '{}'); const file = data.profilePicturePath || user?.profilePicturePath; setPicture(typeof file === 'string' && file ? profilePictureUrl(file) : null); }
      catch { setPicture(null); }
    };
    update(); window.addEventListener('profile-updated', update);
    return () => window.removeEventListener('profile-updated', update);
  }, [user]);
  const role = user?.role === 'admin' ? 'Rendszergazda' : 'Szerelő';
  const link = ({ to, label, icon: Icon }: typeof primary[number]) => <NavLink key={to} to={to} onClick={onNavigate} title={collapsed ? label : undefined} className={({ isActive }) => 'shell-nav-item' + (isActive ? ' is-active' : '')}><Icon size={19} aria-hidden="true" /><span className="shell-nav-label">{label}</span></NavLink>;
  return <aside id={mobile ? 'mobile-navigation' : 'desktop-navigation'} className={'workshop-sidebar' + (collapsed ? ' is-collapsed' : '')} aria-label="Műhely navigáció">
    <div className="shell-brand"><span className="shell-brand-icon"><Wrench size={20} aria-hidden="true" /></span><div className="shell-brand-text"><strong title={settings?.companyName}>{settings?.companyName || 'GTA Szerviz'}</strong><span>Műhelykezelés</span></div>{mobile && <IconButton label="Menü bezárása" onClick={onClose}><X size={18} /></IconButton>}</div>
    <nav aria-label="Fő navigáció" className="shell-nav"><span className="shell-nav-caption">Munkaterület</span>{primary.slice(0, 4).map(link)}
      <button className="shell-nav-item shell-nav-unavailable" disabled aria-describedby={collapsed ? undefined : 'worksheet-nav-help'} title="A munkalapokat a jármű adatlapjáról nyithatod meg."><FileText size={19} aria-hidden="true" /><span className="shell-nav-label">Munkalapok<small id="worksheet-nav-help">Jármű adatlapjáról érhető el</small></span></button>
      {primary.slice(4).map(link)}
    </nav>
    <div className="shell-sidebar-lower">
      {user?.role === 'admin' && <nav aria-label="Adminisztráció" className="shell-nav"><span className="shell-nav-caption">Adminisztráció</span>{link({ to: '/users', label: 'Felhasználók', icon: ShieldCheck })}{link({ to: '/settings', label: 'Beállítások', icon: Settings })}{onDevTools && <button type="button" className="shell-nav-item shell-dev-tools" onClick={() => { onNavigate(); onDevTools(); }} title={collapsed ? 'Fejlesztői eszközök' : undefined}><Code2 size={18} aria-hidden="true" /><span className="shell-nav-label">Fejlesztői eszközök</span></button>}</nav>}
      <div className="shell-profile"><span className="shell-avatar" aria-hidden="true">{picture ? <img src={picture} alt="" onError={() => setPicture(null)} /> : (user?.userName || '?').slice(0, 2).toUpperCase()}</span><div className="shell-profile-text"><strong>{user?.userName}</strong><span>{role}</span></div><IconButton label="Kijelentkezés" onClick={onLogout}><LogOut size={17} aria-hidden="true" /></IconButton></div>
      {!mobile && <button type="button" className="shell-collapse" onClick={onToggle} aria-expanded={!collapsed} aria-controls="desktop-navigation" title={collapsed ? 'Oldalsáv kibontása' : 'Oldalsáv összecsukása'} aria-label={collapsed ? 'Oldalsáv kibontása' : 'Oldalsáv összecsukása'}>{collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}<span>Oldalsáv összecsukása</span></button>}
    </div>
  </aside>;
}
