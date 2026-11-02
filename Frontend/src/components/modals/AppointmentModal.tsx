import {useLookup} from '../../data/paging';
import SearchableLookup from '../ui/SearchableLookup';
import { useRef, useState } from 'react';
import { format } from 'date-fns';
import type { Appointment, Vehicle, Customer } from '../../types';
import { appointmentsApi } from '../../api/appointments';
import { apiErrorMessage } from '../../api/client';
import { useWorkshopResource } from '../../data/useWorkshopData';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { FormField, Input, Textarea } from '../ui/Fields';
import { ErrorState } from '../ui/StateViews';
import AddVehicleModal from './AddVehicleModal';
import '../../features/calendar/calendar.css';
interface Props { selectedSlot: Date | null; onClose:()=>void; onSuccess:()=>void; vehicles:Vehicle[]; customers:Customer[]; setMessage:(s:string|null)=>void; appointment?:Appointment; }
export default function AppointmentModal({selectedSlot,onClose,onSuccess,vehicles,customers,setMessage,appointment}:Props){
 const [expectedVersion]=useState(appointment?.version);
 const [vehicleId,setVehicleId]=useState(String(appointment?.vehicleId||(vehicles.length===1?vehicles[0].id:''))); const [customer,setCustomer]=useState('');
 const [picked,setPicked]=useState<Vehicle>();
 const [pickedCustomer,setPickedCustomer]=useState<Customer|null>(null);
 const fleet=useLookup('vehicles',{customerId:customer?Number(customer):undefined});const people=useLookup('customers');
 const current=useWorkshopResource('vehicles',{id:Number(vehicleId)},!!vehicleId);
 const jobs=useWorkshopResource('worksheets',{appointmentId:appointment?.id},!!appointment);
 const locked=!!appointment&&(!!appointment.serviceJob||jobs.data.some(j=>j.appointmentId===appointment.id));
 const [day,setDay]=useState(format(selectedSlot||new Date(),'yyyy-MM-dd'));
 const [start,setStart]=useState(appointment?format(new Date(appointment.startTime),"yyyy-MM-dd'T'HH:mm"):'');
 const [end,setEnd]=useState(appointment?format(new Date(appointment.endTime),"yyyy-MM-dd'T'HH:mm"):'');
 const [startDirty,setStartDirty]=useState(false); const [endDirty,setEndDirty]=useState(false);
 const [note,setNote]=useState(appointment?.note||''); const [errors,setErrors]=useState<Record<string,string>>({});const [error,setError]=useState('');const [saving,setSaving]=useState(false);const busy=useRef(false);
 const [quick,setQuick]=useState(false);
 const pinned=current.data[0]||picked||vehicles.find(v=>v.id===Number(vehicleId));const choices=pinned&&!fleet.data.some(v=>v.id===pinned.id)?[...fleet.data,pinned]:fleet.data;
 const selected=choices.find(v=>v.id===Number(vehicleId));
 const close=()=>{if(!busy.current)onClose();};
 return <Modal title={appointment?'Időpont szerkesztése':'Új időpont'} onClose={close} subtitle="Napi műhelytervezés · a * jelölt mezők kötelezők."><form className="appointment-form" noValidate onSubmit={async e=>{
 e.preventDefault();if(busy.current)return; const validation:Record<string,string>={};if(!selected)validation.vehicle='Válassz járművet.';
 let startTime=appointment?.startTime||day+'T00:00:00.000Z',endTime=appointment?.endTime||day+'T23:59:59.000Z';
 if(appointment){if(startDirty)startTime=Number.isFinite(new Date(start).getTime())?new Date(start).toISOString():'';if(endDirty)endTime=Number.isFinite(new Date(end).getTime())?new Date(end).toISOString():'';}
 if(!Number.isFinite(new Date(startTime).getTime()))validation.start='Érvényes dátumot adj meg.';
 if(!Number.isFinite(new Date(endTime).getTime())||new Date(endTime)<=new Date(startTime))validation.end='A befejezés legyen a kezdés után.';
 setErrors(validation);if(Object.keys(validation).length)return;
 if(appointment&&(!jobs.loaded||jobs.error)){setError('A munkalapkapcsolat ellenőrzése nem sikerült. Próbáld újra.');return;}
 busy.current=true;setSaving(true);setError('');try{const data={vehicleId:Number(vehicleId),startTime,endTime,note};if(appointment)await appointmentsApi.update(appointment.id,{...data,version:expectedVersion});else await appointmentsApi.create(data);setMessage('Időpont mentve.');onSuccess();}catch(e){setError(apiErrorMessage(e,'Az időpont mentése nem sikerült.'));}finally{busy.current=false;setSaving(false);}
 }}>
 {fleet.error!=null&&<ErrorState message="A járművek betöltése nem sikerült." onRetry={fleet.refresh} />}{people.error!=null&&<ErrorState message="Az ügyfelek betöltése nem sikerült." onRetry={people.refresh} />}
 {!appointment&&<SearchableLookup label="Ügyfél szűrése" lookup={people} selectedItem={pickedCustomer} getKey={c=>c.id} getLabel={c=>c.name} placeholder="Név, telefonszám vagy email keresése…" emptyLabel="Minden ügyfél" disabled={saving} onSelect={c=>{setPickedCustomer(c);setCustomer(c?String(c.id):'');setVehicleId('');setPicked(undefined);fleet.setSearch('');fleet.setPage(1);}} />}
 {locked ? <FormField label="Jármű *" hint="A jármű nem módosítható, mert az időponthoz munkalap tartozik."><Input disabled value={selected?`${selected.licensePlate} · ${selected.make} ${selected.model}`:vehicleId} /></FormField> :
 <SearchableLookup label="Jármű *" lookup={fleet} selectedItem={selected} getKey={v=>v.id} getLabel={v=>`${v.licensePlate} · ${v.make} ${v.model} · ${v.customer?.name||customers.find(c=>c.id===v.customerId)?.name||'Ismeretlen ügyfél'}`} placeholder="Rendszám, márka, típus vagy ügyfél keresése…" error={errors.vehicle} disabled={saving||!!appointment&&!jobs.loaded} autoFocus onSelect={v=>{setVehicleId(v?String(v.id):'');setPicked(v??undefined);}} />}
 {selected&&<p className="appointment-context">{selected.customer?.phoneNumber||customers.find(c=>c.id===selected.customerId)?.phoneNumber||'Nincs telefonszám'}</p>}
 {appointment?<div className="appointment-times"><FormField label="Kezdés *" error={errors.start}><Input type="datetime-local" value={start} onChange={e=>{setStart(e.target.value);setStartDirty(true);}} /></FormField><FormField label="Befejezés *" error={errors.end}><Input type="datetime-local" value={end} onChange={e=>{setEnd(e.target.value);setEndDirty(true);}} /></FormField></div>:<FormField label="Dátum *" error={errors.start||errors.end} hint="Napi foglalás. A pontos kezdést és befejezést később is szerkesztheted."><Input type="date" value={day} onChange={e=>setDay(e.target.value)} /></FormField>}
 <FormField label="Munka leírása / megjegyzés"><Textarea placeholder="Pl. Kopogó hang a futómű felől..." value={note} onChange={e=>setNote(e.target.value)} /></FormField>
 {appointment&&jobs.error!=null&&<ErrorState message="A munkalapkapcsolat betöltése nem sikerült." onRetry={jobs.refresh} />}
 {error&&<p role="alert" className="appointment-error">{error}</p>}
 <div className="appointment-actions">{!appointment&&<Button variant="secondary" disabled={saving} onClick={()=>setQuick(true)}>Új ügyfél / jármű</Button>}<Button variant="secondary" disabled={saving} onClick={close}>Mégse</Button><Button type="submit" disabled={saving||!!appointment&&(!jobs.loaded||!!jobs.error)}>{saving?'Mentés…':'Mentés'}</Button></div>
 </form>{quick&&<AddVehicleModal customers={customers} onClose={()=>setQuick(false)} onSuccess={added=>{if(added){setPicked(added);setCustomer('');setPickedCustomer(null);setVehicleId(String(added.id));fleet.setSearch('');fleet.setPage(1);}setQuick(false);}} />}</Modal>;
}
