import {useLookup,LookupTools} from '../../data/paging';
import {useAuth} from '../../auth/AuthProvider';
import { useCallback,useEffect,useRef,useState } from 'react';
import { Link,useBlocker,useBeforeUnload,useNavigate,useSearchParams } from 'react-router-dom';
import type { ServiceJob } from '../../types';import { worksheetsApi } from '../../api/worksheets';import { apiErrorMessage } from '../../api/client';import { useWorkshopResource } from '../../data/useWorkshopData';
import Card from '../../components/ui/Card';import Button from '../../components/ui/Button';import Badge from '../../components/ui/Badge';import ConfirmDialog from '../../components/ui/ConfirmDialog';import { FormField,Input,Select,Textarea } from '../../components/ui/Fields';import { useToast } from '../../components/ui/ToastProvider';import WorksheetPrintModal from '../../components/print/WorkSheetPrintModal';
import { draftFrom,toParts,validateDraft,partsSubtotal,type WorksheetDraft } from './model';import PartsEditor from './PartsEditor';import { money,date } from '../records/shared';import { useNavigationSafety } from './NavigationSafety';import './worksheets.css';
export default function WorksheetWorkspace({initial,vehicleId,appointmentId}:{initial?:ServiceJob;vehicleId:number;appointmentId:number|null}) {
 const {user}=useAuth();
 const navigate=useNavigate();const [params]=useSearchParams();const {showToast}=useToast();const safety=useNavigationSafety();
 const empty:WorksheetDraft={vehicleId:vehicleId?String(vehicleId):'',date:new Date().toLocaleDateString('sv-SE'),description:'',laborCost:'0',parts:[]};
 const [draft,setDraft]=useState<WorksheetDraft>(()=>initial?draftFrom(initial):empty);const [saved,setSaved]=useState(initial);const [baseline,setBaseline]=useState(()=>JSON.stringify(initial?draftFrom(initial):empty));
 const [errors,setErrors]=useState<Record<string,string>>({});const [error,setError]=useState('');const [busy,setBusy]=useState(false);const lock=useRef(false);const allow=useRef(false);const [pendingPart,setPendingPart]=useState(false);
 const [print,setPrint]=useState<ServiceJob|null>(()=>initial&&params.get('print')==='1'?initial:null);const [complete,setComplete]=useState<boolean|null>(null);const [externalLeave,setExternalLeave]=useState<(()=>void)|null>(null);const [existingId,setExistingId]=useState<number|null>(null);
 const readOnly=!!saved?.isCompleted&&user?.role!=='admin';
 const dirty=JSON.stringify(draft)!==baseline||pendingPart;const dirtyRef=useRef(dirty);dirtyRef.current=dirty;
 const blocker=useBlocker(({currentLocation,nextLocation})=>!allow.current&&(dirtyRef.current||lock.current)&&(currentLocation.pathname!==nextLocation.pathname||currentLocation.search!==nextLocation.search));
 useBeforeUnload(useCallback(event=>{if(dirtyRef.current||lock.current){event.preventDefault();event.returnValue='';}},[]));
 useEffect(()=>safety.register(leave=>{if(dirtyRef.current||lock.current)setExternalLeave(()=>leave);else leave();}),[safety]);
 const fleet=useLookup('vehicles');const current=useWorkshopResource('vehicles',{id:Number(draft.vehicleId)},!!draft.vehicleId);const appointments=useWorkshopResource('appointments',{id:appointmentId??undefined},!!appointmentId);
 const vehicle=current.data[0]||fleet.data.find(v=>v.id===Number(draft.vehicleId));const customer=vehicle?.customer;const choices=vehicle&&!fleet.data.some(v=>v.id===vehicle.id)?[...fleet.data,vehicle]:fleet.data;
 const contextVehicle=vehicle?{...vehicle,customer}:undefined;const appointment=appointments.data.find(a=>a.id===appointmentId);
 useEffect(()=>{const frame=requestAnimationFrame(()=>document.querySelector<HTMLElement>('.worksheet-workspace [data-autofocus]')?.focus());return()=>cancelAnimationFrame(frame);},[]);
 const numericParts=toParts(draft.parts);const subtotal=partsSubtotal(numericParts);const labor=Number(draft.laborCost);const total=subtotal+labor;
 const patch=(value:Partial<WorksheetDraft>)=>setDraft(previous=>({...previous,...value}));
 async function openPrint(id:number){try{const fresh=(await worksheetsApi.get(id)).data;setBusy(false);setPrint(fresh);}catch(e){setError(apiErrorMessage(e,'A mentett munkalap visszaolvasása nem sikerült. Nyomtatás előtt próbáld újra.'));}}
 async function save(status=saved?.isCompleted||false,andPrint=false):Promise<boolean>{
  if(lock.current||readOnly)return false;const validation=validateDraft(draft);if(pendingPart)validation.parts='Az új tételt előbb add a munkalaphoz, vagy ürítsd a bevitelt.';setErrors(validation);if(Object.keys(validation).length)return false;
  lock.current=true;setBusy(true);setError('');setExistingId(null);const submitted={...draft,parts:draft.parts.map(p=>({...p}))};
  try {
   const fields={description:submitted.description,laborCost:Number(submitted.laborCost),isCompleted:status,jobParts:toParts(submitted.parts)};
   let result:ServiceJob;
   if(saved){const response=await worksheetsApi.update(saved.id,{...fields,version:saved.version});result=response.data;}
   else result=(await worksheetsApi.create({...fields,vehicleId:Number(submitted.vehicleId),appointmentId,date:submitted.date+'T12:00:00.000Z'})).data;
   setSaved(result);setBaseline(JSON.stringify(submitted));showToast('A munkalap mentve.','success');
   if(!saved){allow.current=true;navigate('/worksheets/'+result.id+(andPrint?'?print=1':''),{replace:true});}
   else if(andPrint)await openPrint(result.id);
   return true;
  } catch(e) {
   setError(apiErrorMessage(e,'A mentés nem sikerült. A módosításaid megmaradtak.'));
   if(!saved&&appointmentId){try{setExistingId((await worksheetsApi.byAppointment(appointmentId)).data.id);}catch{/* The original save error remains authoritative. */}}
   return false;
  } finally {lock.current=false;setBusy(false);}
 }
 return <section className="worksheet-workspace" aria-label="Munkalap szerkesztő">
 {readOnly&&<p role="status">A befejezett munkalap csak olvasható. Módosításhoz adminisztrátor szükséges.</p>}
 <div className="ws-identity"><strong>{saved?'Munkalap #'+saved.id:'Új munkalap'}</strong><Badge tone={saved?.isCompleted?'success':'warning'}>{saved?.isCompleted?'Befejezett':'Nyitott'}</Badge><span role="status">{busy?'Mentés folyamatban…':dirty?'Nem mentett módosítások':'Nincs nem mentett módosítás'}</span><Link to="/worksheets">Munkalapok listája</Link></div>
 <div className="ws-layout"><div className="ws-main"><Card><h2>Jármű és ügyfél</h2>
 { !saved&&!appointmentId&&<LookupTools {...fleet} label="Járművek" /> }
 <FormField label="Jármű *" error={errors.vehicle} hint={saved||appointmentId?'A járműkapcsolat ezen a munkalapon nem módosítható.':undefined}><Select value={draft.vehicleId} disabled={!!saved||!!appointmentId||busy} onChange={e=>patch({vehicleId:e.target.value})} data-autofocus={!saved&&!vehicleId||undefined}><option value="">Válassz járművet</option>{choices.map(v=><option key={v.id} value={v.id}>{v.licensePlate} · {v.make} {v.model} · {v.customer?.name}</option>)}</Select></FormField>
 {contextVehicle&&<div className="ws-context"><Link className="records-plate" to={'/vehicles/'+contextVehicle.id}>{contextVehicle.licensePlate}</Link><span>{contextVehicle.make} {contextVehicle.model}</span><span>{customer?.name||'Nincs ügyféladat'}</span><span>{customer?.phoneNumber||'Nincs telefonszám'}</span></div>}
 <FormField label="Munkalap dátuma *" error={errors.date} hint={saved?'A tárolt munkalap dátuma.':undefined}><Input type="date" value={draft.date} disabled={!!saved||busy} onChange={e=>patch({date:e.target.value})} /></FormField>
 <p className="ws-note">{appointmentId?'Kapcsolódó időpont #'+appointmentId+' · '+(appointment?date(appointment.startTime)+' · '+(appointment.note||'Szerviz'):'Az időpont már nem érhető el.'):'Önálló munkalap, nincs kapcsolódó időpont.'}</p></Card>
 <Card><h2>Elvégzendő / elvégzett munka</h2><FormField label="Munka leírása *" error={errors.description}><Textarea data-autofocus={!!saved||!!vehicleId||undefined} rows={5} disabled={busy||readOnly} value={draft.description} onChange={e=>patch({description:e.target.value})} /></FormField></Card>
 <PartsEditor parts={draft.parts} onChange={parts=>patch({parts})} onPendingChange={setPendingPart} errors={errors} disabled={busy||readOnly} />
 {errors.parts&&<p role="alert" className="ws-error">{errors.parts}</p>}
 <Card><h2>Munkadíj</h2><FormField label="Munkadíj (Ft) *" error={errors.labor}><Input type="number" step="any" disabled={busy||readOnly} value={draft.laborCost} onChange={e=>patch({laborCost:e.target.value})} /></FormField></Card></div>
 <aside className="ws-summary"><Card><h2>Összesítés</h2><dl><dt>Alkatrészek</dt><dd data-testid="parts-subtotal">{money(subtotal)}</dd><dt>Munkadíj</dt><dd>{money(labor)}</dd><dt>Végösszeg</dt><dd data-testid="worksheet-total"><strong>{money(total)}</strong></dd></dl>{Object.entries(errors).filter(([key])=>!key.startsWith('name')&&!key.startsWith('quantity')&&!key.startsWith('price')).length>0&&<p className="ws-error" role="alert">Ellenőrizd a jelzett mezőket.</p>}
 {error&&<p role="alert" className="ws-error">{error}</p>}{existingId&&<Link to={'/worksheets/'+existingId}>A már létező munkalap megnyitása: #{existingId}</Link>}
 {!readOnly&&<Button disabled={busy||readOnly} onClick={()=>void save()} data-testid="save-worksheet">{busy?'Mentés…':'Mentés'}</Button>}
 <Button data-worksheet-print disabled={busy} variant="secondary" onClick={()=>{if(!saved||dirty)void save(saved?.isCompleted||false,true);else{lock.current=true;setBusy(true);void openPrint(saved.id).finally(()=>{lock.current=false;setBusy(false);});}}}>{dirty||!saved?'Mentés és nyomtatás':'Nyomtatás'}</Button>
 {!readOnly&&<Button variant={saved?.isCompleted?'secondary':'primary'} disabled={busy||readOnly} onClick={()=>setComplete(!saved?.isCompleted)}>{saved?.isCompleted?'Munkalap újranyitása':'Munkalap befejezése'}</Button>}
 <p className="ws-note">A végösszeg az alkatrészsorok és a munkadíj összege. Nincs automatikus készletcsökkentés.</p></Card></aside></div>
 {complete!==null&&<ConfirmDialog title={complete?'Munkalap befejezése':'Munkalap újranyitása'} confirmLabel={busy?'Mentés…':'Megerősítés'} onCancel={()=>{if(!lock.current)setComplete(null);}} onConfirm={async()=>{if(await save(complete))setComplete(null);}}>A munkalap {complete?'Befejezett':'Nyitott'} állapotot kap. A módosításokat is menti. Ez nem számlázás vagy fizetés rögzítése.{error&&<span className="ws-error" role="alert">{error}</span>}</ConfirmDialog>}
 {(blocker.state==='blocked'||externalLeave)&&<ConfirmDialog title="Nem mentett módosítások" confirmLabel="Módosítások elvetése" onCancel={()=>{if(blocker.state==='blocked')blocker.reset();setExternalLeave(null);}} onConfirm={()=>{if(lock.current)return;allow.current=true;if(blocker.state==='blocked')blocker.proceed();else externalLeave?.();setExternalLeave(null);}}>A nem mentett változtatások elvesznek. Biztosan elhagyod a munkalapot?{busy&&<span>Várd meg a folyamatban lévő mentést.</span>}</ConfirmDialog>}
 {print&&contextVehicle&&<WorksheetPrintModal job={print} vehicle={contextVehicle} onClose={()=>{setPrint(null);requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('[data-worksheet-print]')?.focus());}} />}
 </section>;
}

