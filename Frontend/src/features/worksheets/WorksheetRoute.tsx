import { useEffect,useRef,useState } from 'react';import { Navigate,useParams,useSearchParams } from 'react-router-dom';
import { worksheetsApi } from '../../api/worksheets';import { apiErrorMessage } from '../../api/client';import type { ServiceJob } from '../../types';import { useWorkshopResource } from '../../data/useWorkshopData';import { LoadingState,ErrorState } from '../../components/ui/StateViews';import WorksheetWorkspace from './WorksheetWorkspace';
export default function WorksheetRoute(){
 const {worksheetId}=useParams();const [params]=useSearchParams();const vehicles=useWorkshopResource('vehicles'),customers=useWorkshopResource('customers'),appointments=useWorkshopResource('appointments'),jobs=useWorkshopResource('worksheets');
 const ready=useRef('');const routeKey=worksheetId||'new:'+params.toString();
 const [loaded,setLoaded]=useState<ServiceJob|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let active=true;setLoaded(null);setError('');if(!worksheetId)return;if(!/^[1-9]\d*$/.test(worksheetId)){setError('Érvénytelen munkalapazonosító.');return;}void worksheetsApi.get(Number(worksheetId)).then(r=>{if(active)setLoaded(r.data);}).catch(e=>{if(active)setError(apiErrorMessage(e,'A munkalap nem található vagy nem tölthető be.'));});return()=>{active=false;};},[worksheetId,attempt]);
 if(error)return <ErrorState message={error} onRetry={()=>setAttempt(a=>a+1)} />;
 const failed=[vehicles,customers,appointments,jobs].find(s=>s.error);
 if(failed&&ready.current!==routeKey)return <ErrorState message={apiErrorMessage(failed.error,'A kapcsolódó adatok nem tölthetők be.')} onRetry={failed.refresh} />;
 if((ready.current!==routeKey&&[vehicles,customers,appointments,jobs].some(s=>!s.loaded))||(worksheetId&&(!loaded||loaded.id!==Number(worksheetId))))return <LoadingState />;
 ready.current=routeKey;
 const rawAppointment=params.get('appointmentId'),rawVehicle=params.get('vehicleId');
 if((rawAppointment&&!/^[1-9]\d*$/.test(rawAppointment))||(rawVehicle&&!/^[1-9]\d*$/.test(rawVehicle)))return <ErrorState message="Érvénytelen jármű- vagy időpontazonosító." />;
 const appointment=rawAppointment?appointments.data.find(a=>a.id===Number(rawAppointment)):undefined;
 if(!worksheetId&&rawAppointment&&!appointment)return <ErrorState message="Az időpont nem található." />;
 const existing=rawAppointment?jobs.data.find(j=>j.appointmentId===Number(rawAppointment)):undefined;
 if(!worksheetId&&existing)return <Navigate to={'/worksheets/'+existing.id} replace />;
 const vehicleId=loaded?.vehicleId||appointment?.vehicleId||Number(rawVehicle)||0;
 if(vehicleId&&!vehicles.data.some(v=>v.id===vehicleId))return <ErrorState message="A jármű nem található." />;
 return <WorksheetWorkspace key={worksheetId||'new:'+vehicleId+':'+(appointment?.id||'')} initial={loaded||undefined} vehicleId={vehicleId} appointmentId={loaded?.appointmentId||appointment?.id||null} />;
}
