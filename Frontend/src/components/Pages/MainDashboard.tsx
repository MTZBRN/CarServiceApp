import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { differenceInCalendarDays, isSameDay } from 'date-fns';
import { CalendarDays, FileText, CheckCircle2, TriangleAlert, Package } from 'lucide-react';
import { useWorkshopResource } from '../../data/useWorkshopData';
import { apiErrorMessage } from '../../api/client';
import { vehiclesApi } from '../../api/vehicles';
import type { Vehicle } from '../../types';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { Input } from '../ui/Fields';
import { LoadingState, ErrorState } from '../ui/StateViews';
import AddVehicleModal from '../modals/AddVehicleModal';
import { date, inspection, stock, useRemoval } from '../../features/records/shared';
import '../../styles/final-pages.css';

export default function MainDashboard() {
  const vehicles = useWorkshopResource('vehicles'), customers = useWorkshopResource('customers');
  const appointments = useWorkshopResource('appointments'), jobs = useWorkshopResource('worksheets'), inventory = useWorkshopResource('inventory');
  const [search, setSearch] = useState(''), [add, setAdd] = useState(false);
  const [today, setToday] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setToday(new Date()), 60000); return () => clearInterval(timer); }, []);
  const removal = useRemoval<Vehicle>(vehiclesApi.remove);
  const resources = [vehicles, customers, appointments, jobs, inventory];
  const failed = resources.find(r => r.error);
  if (failed) return <ErrorState message={apiErrorMessage(failed.error, 'Az áttekintés adatai nem tölthetők be.')} onRetry={() => { resources.forEach(r => { void r.refresh(); }); }} />;
  if (resources.some(r => !r.loaded || r.loading)) return <LoadingState />;
  const bookings = appointments.data.filter(a => isSameDay(new Date(a.startTime), today)).sort((a,b) => a.startTime.localeCompare(b.startTime));
  const active = jobs.data.filter(j => !j.isCompleted).sort((a,b) => a.date.localeCompare(b.date) || a.id-b.id);
  const completed = jobs.data.filter(j => j.isCompleted);
  const inspections = vehicles.data.filter(v => v.motExpiry && differenceInCalendarDays(new Date(v.motExpiry), today) <= 30).sort((a,b) => a.motExpiry!.localeCompare(b.motExpiry!));
  const upcoming = inspections.filter(v => differenceInCalendarDays(new Date(v.motExpiry!), today) >= 0);
  const low = inventory.data.filter(p => Number.isInteger(p.stockQuantity) && p.stockQuantity >= 0 && p.stockQuantity < 5).sort((a,b) => a.stockQuantity-b.stockQuantity);
  const recent = [...jobs.data].sort((a,b) => b.date.localeCompare(a.date) || b.id-a.id).slice(0,6);
  const vehicle = (id:number) => vehicles.data.find(v => v.id === id);
  const owner = (v?:Vehicle) => customers.data.find(c => c.id === v?.customerId)?.name || v?.customer?.name || 'Nincs ügyféladat';
  const calendar = '/calendar?date='+today.toLocaleDateString('sv-SE')+'&view=agenda';
  const metrics = [
    { label:'Mai időpontok', value:bookings.length, note:'A mai napon kezdődő foglalások', to:calendar, icon:CalendarDays },
    { label:'Aktív munkalapok', value:active.length, note:'Minden nyitott munkalap', to:'/worksheets?status=open', icon:FileText },
    { label:'Befejezett munkák', value:completed.length, note:'Összes befejezett munkalap', to:'/worksheets?status=completed', icon:CheckCircle2 },
    { label:'Közelgő műszaki vizsgák', value:upcoming.length, note:'Ma és a következő 30 napban', to:'/vehicles', icon:TriangleAlert },
    { label:'Alacsony készlet', value:low.length, note:'0–4 db készleten', to:'/inventory', icon:Package },
  ];
  return <div className="overview-page">
    <div className="page-intro"><div><h2>Műhely mai áttekintése</h2><p>{date(today.toISOString())} · A következő teendők egy helyen.</p></div><Link className="ui-button ui-button-primary" to="/worksheets/new">Új munkalap</Link></div>
    <div className="overview-metrics">{metrics.map(({label,value,note,to,icon:Icon}) => <Link className="ui-card overview-metric" key={label} to={to} aria-label={label+': '+value}><span><Icon size={18} aria-hidden="true" />{label}</span><strong>{value}</strong><small>{note}</small></Link>)}</div>
    <div className="overview-grid">
      <Card><header><h2>Mai időpontok</h2><Link to={calendar}>Naptár megnyitása</Link></header>{!bookings.length && <p className="panel-empty">Nincs mára beírt munka.</p>}<ul className="attention-list">{bookings.map(a => { const v=vehicle(a.vehicleId); const job=jobs.data.find(j=>j.appointmentId===a.id); return <li key={a.id}><div><Link className="records-plate" to={'/vehicles/'+a.vehicleId}>{v?.licensePlate || '#'+a.vehicleId}</Link><small>{owner(v)} · {a.note || 'Nincs megjegyzés'}</small></div><Link to={job?'/worksheets/'+job.id:'/worksheets/new?appointmentId='+a.id}>{job?'Munkalap #'+job.id:'Munkalap készítése'}</Link></li>; })}</ul></Card>
      <Card><header><h2>Aktív munkalapok</h2><Link to="/worksheets?status=open">Összes ({active.length})</Link></header><p className="records-note">A legrégebbi munkalapdátumok elöl.</p>{!active.length && <p className="panel-empty">Nincs nyitott munkalap.</p>}<ul className="attention-list">{active.slice(0,6).map(j => <li key={j.id}><div><Link className="records-plate" to={'/worksheets/'+j.id}>{vehicle(j.vehicleId)?.licensePlate || '#'+j.vehicleId}</Link><small>#{j.id} · {date(j.date)} · {j.description || 'Nincs leírás'}</small></div><Badge tone="warning">Nyitott</Badge></li>)}</ul></Card>
      <Card id="inspections"><header><h2>Műszaki figyelmeztetések</h2><Link to="/vehicles">Járműlista megnyitása</Link></header><p className="records-note">Lejárt és 30 napon belül lejáró vizsgák ({inspections.length}).</p>{!inspections.length && <p className="panel-empty">Nincs közelgő vagy lejárt műszaki vizsga.</p>}<ul className="attention-list">{inspections.slice(0,6).map(v => <li key={v.id}><div><Link className="records-plate" to={'/vehicles/'+v.id}>{v.licensePlate}</Link><small>{date(v.motExpiry)} · {owner(v)}</small></div><Badge tone={inspection(v.motExpiry).tone}>{inspection(v.motExpiry).text}</Badge></li>)}</ul></Card>
      <Card id="stock"><header><h2>Készletfigyelmeztetések</h2><Link to="/inventory">Készlet megnyitása</Link></header><p className="records-note">0–4 db készleten; a munkalap nem csökkenti automatikusan a készletet.</p>{!low.length && <p className="panel-empty">Nincs alacsony készletű alkatrész.</p>}<ul className="attention-list">{low.slice(0,6).map(p => <li key={p.id}><div><strong>{p.name}</strong><small>{p.partNumber} · {p.stockQuantity} db</small></div><Badge tone={stock(p.stockQuantity).tone}>{stock(p.stockQuantity).text}</Badge></li>)}</ul></Card>
      <Card><header><h2>Legutóbbi munkalapdátumok</h2><Link to="/worksheets">Munkalapok</Link></header><p className="records-note">A munkalap dátuma szerint; nem a módosítás ideje alapján.</p>{!recent.length && <p className="panel-empty">Még nincs munkalap.</p>}<ul className="attention-list">{recent.map(j => <li key={j.id}><div><Link className="records-plate" to={'/worksheets/'+j.id}>{vehicle(j.vehicleId)?.licensePlate || '#'+j.vehicleId}</Link><small>#{j.id} · {date(j.date)} · {j.description}</small></div><Badge tone={j.isCompleted?'success':'warning'}>{j.isCompleted?'Befejezett':'Nyitott'}</Badge></li>)}</ul></Card>
      <Card><header><h2>Járműkereső</h2><Button onClick={()=>setAdd(true)}>Új jármű</Button></header><Input aria-label="Járműkereső" placeholder="Keresés rendszám vagy név…" value={search} onChange={e=>setSearch(e.target.value)} /><ul className="attention-list">{vehicles.data.filter(v => [v.licensePlate,v.make,v.model,owner(v)].join(' ').toLocaleLowerCase('hu').includes(search.toLocaleLowerCase('hu'))).slice(0,6).map(v => <li key={v.id}><div><Link className="records-plate" to={'/vehicles/'+v.id}>{v.licensePlate}</Link><small>{v.make} {v.model} · {owner(v)}</small></div><Button variant="danger" onClick={()=>removal.ask(v)} aria-label={v.licensePlate+' törlése'}>Törlés</Button></li>)}</ul>{!vehicles.data.length && <p className="panel-empty">Még nincs jármű.</p>}<Link to="/vehicles">Összes jármű</Link></Card>
    </div>
    {add && <AddVehicleModal customers={customers.data} onClose={()=>setAdd(false)} onSuccess={()=>setAdd(false)} />}{removal.dialog}
  </div>;
}
