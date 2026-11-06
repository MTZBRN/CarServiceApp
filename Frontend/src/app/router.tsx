import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from '../App';
import { LoginRoute, RequireAuth, RequireAdmin } from './RouteGuards';
import { ErrorState, LoadingState } from '../components/ui/StateViews';
function page(load: () => Promise<{ default: ComponentType }>) {
  const Page = lazy(load);
  return <Suspense fallback={<LoadingState message="Oldal betöltése…" />}><Page /></Suspense>;
}
export const router = createBrowserRouter([
  { path: '/login', element: <LoginRoute /> },
  { path: '/adatkezeles', element: page(() => import('../features/privacy/PrivacyNoticePage')) },
  { element: <RequireAuth />, errorElement: <ErrorState message="Az oldal nem tölthető be." onRetry={() => window.location.reload()} />, children: [{ element: <App />, children: [
    { index: true, element: <Navigate to="/dashboard" replace /> },
    { path: 'dashboard', element: page(() => import('../components/Pages/MainDashboard')) },
    { path: 'calendar', element: page(() => import('../features/calendar/CalendarPage')) },
    { path: 'customers', element: page(() => import('../components/Pages/Customers')) },
    { path: 'vehicles', element: page(() => import('../components/Pages/Garage')) },
    { path: 'vehicles/:vehicleId', element: page(() => import('./VehicleDetailsRoute')) },
    { path: 'worksheets', element: page(() => import('../features/worksheets/WorksheetList')) },
    { path: 'worksheets/new', element: page(() => import('../features/worksheets/WorksheetRoute')) },
    { path: 'worksheets/:worksheetId', element: page(() => import('../features/worksheets/WorksheetRoute')) },
    { path: 'inventory', element: page(() => import('../components/Pages/Inventory')) },
    { element: <RequireAdmin />, children: [
      { path: 'audit', element: page(() => import('../components/Pages/Audit')) },
      { path: 'users', element: page(() => import('../components/Pages/UserManagement')) },
      { path: 'settings', element: page(() => import('../components/Pages/Settings')) },
    ] },
    { path: '*', element: <ErrorState message="Az oldal nem található." /> },
  ] }] },
]);
