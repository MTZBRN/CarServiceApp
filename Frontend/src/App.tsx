import { lazy, Suspense, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import AppShell from './components/layout/AppShell';
import ConfirmDialog from './components/ui/ConfirmDialog';
import { LoadingState } from './components/ui/StateViews';
import { NavigationSafety, useNavigationSafety } from './features/worksheets/NavigationSafety';
const DevTools = lazy(() => import('./components/Pages/Dashboard'));
function AppContent() {
  const safety = useNavigationSafety();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dev, setDev] = useState(false);
  const [exit, setExit] = useState(false);
  useEffect(() => { setDev(false); }, [location.key]);
  return <AppShell onLogout={() => setExit(true)} onDevTools={user?.role === 'admin' ? () => safety.request(() => setDev(true)) : undefined} title={dev ? 'Fejlesztői eszközök' : undefined}>
    {dev && user?.role === 'admin' ? <Suspense fallback={<LoadingState />}><DevTools onBack={() => setDev(false)} /></Suspense> : <Outlet />}
    {exit && <ConfirmDialog title="Kijelentkezés" confirmLabel="Kijelentkezés" onCancel={() => setExit(false)} onConfirm={() => { setExit(false); safety.request(() => { flushSync(() => logout()); navigate('/login', { replace: true }); }); }}>Biztosan ki akarsz jelentkezni?</ConfirmDialog>}
  </AppShell>;
}
export default function App() { return <NavigationSafety><AppContent /></NavigationSafety>; }
