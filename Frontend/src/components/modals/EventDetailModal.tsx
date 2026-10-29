import {useAuth} from '../../auth/AuthProvider';
import { Link } from 'react-router-dom';
import type { CalendarEvent, ServiceJob } from '../../types';
import Modal from '../ui/Modal';import Button from '../ui/Button';import Badge from '../ui/Badge';
import { format } from 'date-fns';import { hu } from 'date-fns/locale';
interface Props { event:CalendarEvent; worksheet?:ServiceJob; ready:boolean; onClose:()=>void; onEdit:()=>void; onDelete:()=>void; onOpenWorksheet:()=>void; }
export default function EventDetailModal({event,worksheet,ready,onClose,onEdit,onDelete,onOpenWorksheet}:Props){
 const {user}=useAuth();
 const vehicle=event.type==='mot'?event.originalData:event.originalData.vehicle;const app=event.type==='service'?event.originalData:null;
 const show=(s:string)=>format(new Date(s),'yyyy. MM. dd. HH:mm',{locale:hu});
 return <Modal title={event.type==='mot'?'Műszaki emlékeztető':'Időpont részletei'} onClose={onClose}>
 <div className="appointment-details"><strong className="calendar-registration">{vehicle?.licensePlate||'Ismeretlen jármű'}</strong><p>{vehicle?.make} {vehicle?.model}</p><Badge tone={app?'info':'warning'}>{app?'Szerviz időpont':'Emlékeztető · műszaki vizsga'}</Badge>
 <dl><dt>Ügyfél</dt><dd>{vehicle?.customer?.name||'Nincs megadva'}</dd><dt>Telefon</dt><dd>{vehicle?.customer?.phoneNumber||'Nincs megadva'}</dd>
 {app?<><dt>Kezdés</dt><dd>{show(app.startTime)}</dd><dt>Befejezés</dt><dd>{show(app.endTime)}</dd><dt>Megjegyzés</dt><dd>{app.note||'Nincs megadva'}</dd><dt>Munkalap</dt><dd>{!ready?'Állapot betöltése…':worksheet?('#'+worksheet.id+' · '+(worksheet.isCompleted?'Befejezett':'Nyitott')):'Még nincs munkalap'}</dd></>:<><dt>Lejárat</dt><dd>{format(event.start,'yyyy. MM. dd.')}</dd><dt>Állapot</dt><dd>{event.start<new Date(new Date().setHours(0,0,0,0))?'Lejárt':'Esedékes műszaki vizsga'}</dd></>}
 </dl><div className="appointment-actions">{app&&<Button disabled={!ready} onClick={onOpenWorksheet}>{worksheet?'Munkalap megnyitása':'Munkalap létrehozása'}</Button>}{vehicle&&<Link className="ui-button ui-button-secondary" to={'/vehicles/'+vehicle.id}>Jármű adatlapja</Link>}{app&&<><Button variant="secondary" onClick={onEdit}>Időpont szerkesztése</Button>{user?.role==='admin'&&<Button variant="danger" onClick={onDelete}>Időpont törlése</Button>}</>}</div></div></Modal>;
}
