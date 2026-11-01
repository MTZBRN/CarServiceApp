import {useCallback,useEffect,useState} from 'react';
import client,{apiErrorMessage} from '../../api/client';
import type {Query} from '../../types/queries';
import {Pager,useDebounced} from '../../data/paging';
import Card from '../ui/Card';
import Table from '../ui/Table';
import Badge from '../ui/Badge';
import {Input,Select} from '../ui/Fields';
import {LoadingState,ErrorState,EmptyState} from '../ui/StateViews';
import '../../features/records/records.css';
import './audit.css';

interface AuditEvent {id:number;timestampUtc:string;actorUserId:number|null;actorName:string;actorRole:string;action:string;resourceType:string;resourceId:number|null;outcome:string;details:string;traceId:string;}
export default function Audit(){
 const [filters,setFilters]=useState<Record<string,string>>({}),[page,setPage]=useState(1),[revision,setRevision]=useState(0);
 const stable=useDebounced(JSON.stringify(filters)),[rows,setRows]=useState<AuditEvent[]>([]),[total,setTotal]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState<unknown>(null);
 const change=(key:string,value:string)=>{setPage(1);setFilters(old=>({...old,[key]:value}));};
 const retry=useCallback(()=>setRevision(v=>v+1),[]);
 useEffect(()=>{
  const controller=new AbortController();let active=true;setLoading(true);setError(null);
  const query=Object.fromEntries(Object.entries(JSON.parse(stable) as Query).filter(([,v])=>v!==''));
  void client.get<AuditEvent[]>('/Audit',{params:{...query,page},signal:controller.signal}).then(response=>{if(active){setRows(response.data);setTotal(Number(response.headers['x-total-count']??response.data.length));}}).catch((failure:unknown)=>{if(active)setError(failure);}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;controller.abort();};
 },[stable,page,revision]);
 return <section className="records-page audit-page"><Card><p>Biztonsági és üzleti események · csak olvasható. Az időpontok UTC szerint láthatók. A bejegyzések mezőneveket és korlátozott változásadatokat tartalmaznak.</p></Card>
 <div className="audit-filters">{[['from','Dátumtól (UTC)','date'],['to','Dátumig (UTC)','date'],['actorId','Felhasználó azonosítója','number'],['action','Esemény (pl. Worksheet.Completed)','text'],['resourceType','Erőforrás (pl. Worksheet)','text'],['resourceId','Rekord azonosítója','number']].map(([key,label,type])=><label key={key}>{label}<Input type={type} min={type==='number'?1:undefined} maxLength={key==='action'?64:32} value={filters[key]||''} onChange={e=>change(key,e.target.value)} /></label>)}<label>Eredmény<Select value={filters.outcome||''} onChange={e=>change('outcome',e.target.value)}><option value="">Mind</option><option value="Success">Sikeres</option><option value="Failure">Sikertelen</option></Select></label></div>
 {loading?<LoadingState />:error?<ErrorState message={apiErrorMessage(error,'A napló nem tölthető be.')} onRetry={retry} />:!rows.length?<EmptyState title="Nincs naplóbejegyzés a szűréshez" />:<Table caption="Eseménynapló"><thead><tr>{['Időpont (UTC)','Felhasználó','Esemény','Erőforrás','Eredmény','Részletek'].map(name=><th key={name} scope="col">{name}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id}><td data-label="Időpont (UTC)">{row.timestampUtc.replace('T',' ').replace(/\.\d+Z$/,'Z')}<small>#{row.id}</small></td><td data-label="Felhasználó">{row.actorName||'Ismeretlen'}<small>{row.actorUserId?'#'+row.actorUserId+' · ':''}{row.actorRole}</small></td><td data-label="Esemény">{row.action}</td><td data-label="Erőforrás">{row.resourceType}{row.resourceId!=null?' #'+row.resourceId:''}</td><td data-label="Eredmény"><Badge tone={row.outcome==='Success'?'success':'warning'}>{row.outcome==='Success'?'Sikeres':'Sikertelen'}</Badge></td><td data-label="Részletek"><code>{row.details}</code></td></tr>)}</tbody></Table>}
 <Pager page={page} pageSize={50} totalCount={total} setPage={setPage} loading={loading||JSON.stringify(filters)!==stable} loaded={!loading&&!error} />
 </section>;
}
