import { flushSync } from 'react-dom';
import { Outlet, useOutletContext, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './auth/AuthProvider';
import AppShell from './components/layout/AppShell';
import ConfirmDialog from './components/ui/ConfirmDialog';
import AddVehicleModal from './components/modals/AddVehicleModal';
import MainDashboard from './components/Pages/MainDashboard';
import DevDashboard from './components/Pages/Dashboard';
import { useCarService } from './hooks/useCarService';
import {NavigationSafety,useNavigationSafety} from './features/worksheets/NavigationSafety';
import CalendarPage from './features/calendar/CalendarPage';
function AppContent() {
 const safety=useNavigationSafety();
 const {user,logout}=useAuth(); const navigate=useNavigate(); const location=useLocation();
 const {vehicles,customers,appointments,deleteVehicle}=useCarService();
 const [search,setSearch]=useState(''); const [dev,setDev]=useState(false); const [add,setAdd]=useState(false); const [exit,setExit]=useState(false);
 useEffect(()=>{setAdd(false);setDev(false);},[location.key]);
 return <AppShell onLogout={()=>setExit(true)} onDevTools={user?.role==='admin'?()=>setDev(true):undefined} title={dev?'Fejlesztői eszközök':undefined}>
 {dev&&user?.role==='admin'?<DevDashboard onBack={()=>setDev(false)} />:<Outlet context={{dashboard:<MainDashboard vehicles={vehicles} appointments={appointments} searchTerm={search} setSearchTerm={setSearch} onAddVehicle={()=>setAdd(true)} onOpenHistory={id=>navigate('/vehicles/'+id)} onDeleteVehicle={deleteVehicle} />} satisfies ScreenContext} />}
 {add&&<AddVehicleModal customers={customers} onClose={()=>setAdd(false)} onSuccess={()=>setAdd(false)} />}
 {exit&&<ConfirmDialog title="Kijelentkezés" confirmLabel="Kijelentkezés" onCancel={()=>setExit(false)} onConfirm={()=>{setExit(false);safety.request(()=>{flushSync(()=>logout());navigate('/login',{replace:true});});}}>Biztosan ki akarsz jelentkezni?</ConfirmDialog>}
 </AppShell>;
}
export default function App(){return <NavigationSafety><AppContent /></NavigationSafety>;}
interface ScreenContext {dashboard:ReactNode;}
export function DashboardRoute(){return useOutletContext<ScreenContext>().dashboard;}
export function CalendarRoute(){return <CalendarPage />;}
