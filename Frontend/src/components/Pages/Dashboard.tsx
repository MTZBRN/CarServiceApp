import { useRef, useState } from 'react';
import { seedDatabase } from '../../api/development';
import { worksheetsApi } from '../../api/worksheets';
import { apiErrorMessage } from '../../api/client';
import { useWorkshopResource } from '../../data/useWorkshopData';
import { useRemoval } from '../../features/records/shared';
import type { ServiceJob } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import { LoadingState, ErrorState } from '../ui/StateViews';
import { useToast } from '../ui/ToastProvider';
export default function DevDashboard({onBack}:{onBack:()=>void}) {
  const jobs=useWorkshopResource('worksheets'), vehicles=useWorkshopResource('vehicles');
  const [seed,setSeed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const lock=useRef(false);const {showToast}=useToast();
  const removal=useRemoval<ServiceJob>(worksheetsApi.remove);
  async function populate() {
    if(lock.current)return;lock.current=true;setBusy(true);setError('');
    try{await seedDatabase();setSeed(false);showToast('A tesztadatok létrehozva.','success');}
    catch(e){setError(apiErrorMessage(e,'A tesztadatok létrehozása nem sikerült.'));}
    finally{lock.current=false;setBusy(false);}
  }
  return <div className="records-page">
    <div className="page-intro"><div><h2>Fejlesztői adateszközök</h2><p>Adminisztrátori tesztadat-kezelés.</p></div><Button variant="secondary" onClick={onBack}>Vissza a műhelyhez</Button></div>
    <Card><p>A tesztadatok generálása és a munkalapok törlése módosítja a tárolt adatokat.</p><div className="records-actions"><Button variant="secondary" onClick={()=>{void jobs.refresh();void vehicles.refresh();}}>Frissítés</Button><Button variant="danger" onClick={()=>setSeed(true)}>Tesztadatok generálása</Button></div></Card>
    {jobs.loading||vehicles.loading?<LoadingState />:null}
    {Boolean(jobs.error||vehicles.error)&&<ErrorState message="A fejlesztői adatok nem tölthetők be." onRetry={()=>{void jobs.refresh();void vehicles.refresh();}} />}
    <Card><h2>Járművek ({vehicles.data.length})</h2>{vehicles.data.map(v=><p key={v.id}>#{v.id} · {v.licensePlate} · {v.make} {v.model}</p>)}</Card>
    <Card><h2>Munkalapok ({jobs.data.length})</h2>{jobs.data.map(j=><div className="attention-list" key={j.id}><p>#{j.id} · {j.description} · {j.jobParts.length} alkatrész</p><Button variant="danger" onClick={()=>removal.ask(j)} aria-label={'Munkalap #'+j.id+' törlése'}>Törlés</Button></div>)}</Card>
    {seed&&<ConfirmDialog title="Tesztadatok generálása" confirmLabel={busy?'Létrehozás…':'Létrehozás'} onCancel={()=>{if(!lock.current)setSeed(false);}} onConfirm={()=>void populate()}>Tesztadatokat hozol létre a jelenlegi adatbázisban. Folytatod?{error&&<span className="records-error" role="alert">{error}</span>}</ConfirmDialog>}{removal.dialog}
  </div>;
}
