import {useLookup} from '../../data/paging';
import {useAuth} from '../../auth/AuthProvider';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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

export default function MainDashboard() {const {user}=useAuth();
  const [add,setAdd]=useState(false),[today,setToday]=useState(()=>new Date());
  const vehicles=useLookup('vehicles');const {search,setSearch}=vehicles;
  const day=today.toLocaleDateString('sv-SE');const start=new Date(today.getFullYear(),today.getMonth(),today.getDate()).toISOString();const end=new Date(today.getFullYear(),today.getMonth(),today.getDate()+1).toISOString();
  const summary=useWorkshopResource('dashboard',{date:day,start,end});
  useEffect(()=>{const timer=window.setInterval(()=>setToday(new Date()),60000);return()=>clearInterval(timer);},[]);
  const removal=useRemoval<Vehicle>(vehiclesApi.remove);
  const resources=[summary,vehicles];const failed=resources.find(r=>r.error);
  if(failed)return <ErrorState message={apiErrorMessage(failed.error,'Az áttekintés adatai nem tölthetők be.')} onRetry={()=>resources.forEach(r=>void r.refresh())} />;
  if(!summary.data||!summary.loaded||vehicles.loading&&!vehicles.loaded)return <LoadingState />;
  const data=summary.data;const {bookings,active,inspections,low,recent}=data;
  const vehicle=(id:number)=>[...vehicles.data,...bookings.flatMap(a=>a.vehicle?[a.vehicle]:[]),...active.flatMap(j=>j.vehicle?[j.vehicle]:[]),...recent.flatMap(j=>j.vehicle?[j.vehicle]:[])].find(v=>v.id===id);
  const owner=(v?:Vehicle)=>v?.customer?.name||'Nincs ügyféladat';
  const calendar = '/calendar?date='+today.toLocaleDateString('sv-SE')+'&view=agenda';
  const metrics = [
    { label:'Mai időpontok', value:data.todayCount, note:'A mai napon kezdődő foglalások', to:calendar, icon:CalendarDays },
    { label:'Aktív munkalapok', value:data.activeCount, note:'Minden nyitott munkalap', to:'/worksheets?status=open', icon:FileText },
    { label:'Befejezett munkák', value:data.completedCount, note:'Összes befejezett munkalap', to:'/worksheets?status=completed', icon:CheckCircle2 },
    { label:'Közelgő műszaki vizsgák', value:data.upcomingCount, note:'Ma és a következő 30 napban', to:'/vehicles', icon:TriangleAlert },
    { label:'Alacsony készlet', value:data.lowCount, note:'0–4 db készleten', to:'/inventory', icon:Package },
  ];
  return <div className="overview-page">
    <div className="page-intro"><div><h2>Műhely mai áttekintése</h2><p>{date(today.toISOString())} · A következő teendők egy helyen.</p></div><Link className="ui-button ui-button-primary" to="/worksheets/new">Új munkalap</Link></div>
    <div className="overview-metrics">{metrics.map(({label,value,note,to,icon:Icon}) => <Link className="ui-card overview-metric" key={label} to={to} aria-label={label+': '+value}><span><Icon size={18} aria-hidden="true" />{label}</span><strong>{value}</strong><small>{note}</small></Link>)}</div>
    <div className="overview-grid">
      <Card><header><h2>Mai időpontok</h2><Link to={calendar}>Naptár megnyitása</Link></header>{!bookings.length && <p className="panel-empty">Nincs mára beírt munka.</p>}<ul className="attention-list">{bookings.map(a => { const v=a.vehicle; const job=a.serviceJob; return <li key={a.id}><div><Link className="records-plate" to={'/vehicles/'+a.vehicleId}>{v?.licensePlate || '#'+a.vehicleId}</Link><small>{owner(v)} · {a.note || 'Nincs megjegyzés'}</small></div><Link to={job?'/worksheets/'+job.id:'/worksheets/new?appointmentId='+a.id}>{job?'Munkalap #'+job.id:'Munkalap készítése'}</Link></li>; })}</ul></Card>
      <Card><header><h2>Aktív munkalapok</h2><Link to="/worksheets?status=open">Összes ({data.activeCount})</Link></header><p className="records-note">A legrégebbi munkalapdátumok elöl.</p>{!data.activeCount && <p className="panel-empty">Nincs nyitott munkalap.</p>}<ul className="attention-list">{active.slice(0,6).map(j => <li key={j.id}><div><Link className="records-plate" to={'/worksheets/'+j.id}>{vehicle(j.vehicleId)?.licensePlate || '#'+j.vehicleId}</Link><small>#{j.id} · {date(j.date)} · {j.description || 'Nincs leírás'}</small></div><Badge tone="warning">Nyitott</Badge></li>)}</ul></Card>
      <Card id="inspections"><header><h2>Műszaki figyelmeztetések</h2><Link to="/vehicles">Járműlista megnyitása</Link></header><p className="records-note">Lejárt és 30 napon belül lejáró vizsgák ({data.inspectionCount}).</p>{!inspections.length && <p className="panel-empty">Nincs közelgő vagy lejárt műszaki vizsga.</p>}<ul className="attention-list">{inspections.slice(0,6).map(v => <li key={v.id}><div><Link className="records-plate" to={'/vehicles/'+v.id}>{v.licensePlate}</Link><small>{date(v.motExpiry)} · {owner(v)}</small></div><Badge tone={inspection(v.motExpiry).tone}>{inspection(v.motExpiry).text}</Badge></li>)}</ul></Card>
      <Card id="stock"><header><h2>Készletfigyelmeztetések</h2><Link to="/inventory">Készlet megnyitása</Link></header><p className="records-note">0–4 db készleten; a munkalap nem csökkenti automatikusan a készletet.</p>{!low.length && <p className="panel-empty">Nincs alacsony készletű alkatrész.</p>}<ul className="attention-list">{low.slice(0,6).map(p => <li key={p.id}><div><strong>{p.name}</strong><small>{p.partNumber} · {p.stockQuantity} db</small></div><Badge tone={stock(p.stockQuantity).tone}>{stock(p.stockQuantity).text}</Badge></li>)}</ul></Card>
      <Card><header><h2>Legutóbbi munkalapdátumok</h2><Link to="/worksheets">Munkalapok</Link></header><p className="records-note">A munkalap dátuma szerint; nem a módosítás ideje alapján.</p>{!recent.length && <p className="panel-empty">Még nincs munkalap.</p>}<ul className="attention-list">{recent.map(j => <li key={j.id}><div><Link className="records-plate" to={'/worksheets/'+j.id}>{vehicle(j.vehicleId)?.licensePlate || '#'+j.vehicleId}</Link><small>#{j.id} · {date(j.date)} · {j.description}</small></div><Badge tone={j.isCompleted?'success':'warning'}>{j.isCompleted?'Befejezett':'Nyitott'}</Badge></li>)}</ul></Card>
      <Card><header><h2>Járműkereső</h2><Button onClick={()=>setAdd(true)}>Új jármű</Button></header><Input aria-label="Járműkereső" placeholder="Keresés rendszám vagy név…" value={search} onChange={e=>setSearch(e.target.value)} /><ul className="attention-list">{vehicles.data.slice(0,6).map(v => <li key={v.id}><div><Link className="records-plate" to={'/vehicles/'+v.id}>{v.licensePlate}</Link><small>{v.make} {v.model} · {owner(v)}</small></div>{user?.role==='admin'&&<Button variant="danger" onClick={()=>removal.ask(v)} aria-label={v.licensePlate+' törlése'}>Törlés</Button>}</li>)}</ul>{!vehicles.data.length && <p className="panel-empty">Még nincs jármű.</p>}<Link to="/vehicles">Összes jármű</Link></Card>
    </div>
    {add && <AddVehicleModal customers={[]} onClose={()=>setAdd(false)} onSuccess={()=>setAdd(false)} />}{removal.dialog}
  </div>;
}
