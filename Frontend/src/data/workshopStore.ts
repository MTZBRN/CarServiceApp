import client from '../api/client';
import { customersApi } from '../api/customers';
import { vehiclesApi } from '../api/vehicles';
import { appointmentsApi } from '../api/appointments';
import { worksheetsApi } from '../api/worksheets';
import { inventoryApi } from '../api/inventory';
import { settingsApi } from '../api/settings';
import type { Resource } from '../api/changes';
import type { Customer,Vehicle,Appointment,ServiceJob,Part,WorkshopSettings } from '../types';
import type { Query,DashboardData } from '../types/queries';

type Payload = {customers:Customer[];vehicles:Vehicle[];appointments:Appointment[];worksheets:ServiceJob[];inventory:Part[];settings:WorkshopSettings|null;dashboard:DashboardData|null};
type Transport<T> = {data:T;headers?:Record<string,unknown>};
export interface ResourceState<T> {data:T;loading:boolean;error:unknown;loaded:boolean;totalCount:number;page:number;pageSize:number;}
function resource<T>(initial:T,fetcher:(signal:AbortSignal)=>Promise<Transport<T>>,query:Query={},cancelUnused=false){
 let snapshot:ResourceState<T>={data:initial,loading:false,error:null,loaded:false,totalCount:0,page:Number(query.page)||1,pageSize:Number(query.pageSize)||50};
 let pending:Promise<void>|undefined,controller:AbortController|undefined;let requested=false,revision=0;
 const subscribers=new Set<()=>void>();
 const publish=(next:ResourceState<T>)=>{snapshot=next;subscribers.forEach(fn=>fn());};
 const load=(force=false):Promise<void>=>{
  requested=true;if(!force&&pending)return pending;if(!force&&snapshot.loaded)return Promise.resolve();
  if(cancelUnused)controller?.abort();controller=new AbortController();const current=++revision,token=localStorage.getItem('authToken');
  publish({...snapshot,loading:true,error:null});
  const task=fetcher(controller.signal).then(({data,headers})=>{
   if(current===revision&&token===localStorage.getItem('authToken'))publish({...snapshot,data,loading:false,loaded:true,error:null,
    totalCount:Number(headers?.['x-total-count']??(Array.isArray(data)?data.length:0)),page:Number(headers?.['x-page']??query.page??1),pageSize:Number(headers?.['x-page-size']??query.pageSize??50)});
  }).catch((error:unknown)=>{if(current===revision&&token===localStorage.getItem('authToken'))publish({...snapshot,loading:false,loaded:true,error});}).finally(()=>{if(current===revision)pending=undefined;});
  pending=task;return task;
 };
 return {snapshot:()=>snapshot,inUse:()=>subscribers.size>0,
  subscribe:(fn:()=>void)=>{subscribers.add(fn);return()=>{subscribers.delete(fn);if(cancelUnused&&!subscribers.size&&pending){controller?.abort();revision++;pending=undefined;snapshot={...snapshot,loading:false,loaded:false};}};},
  load,refresh:()=>load(true),invalidate:()=>{
   if(!requested)return Promise.resolve();
   if(!cancelUnused||subscribers.size)return load(true);
   controller?.abort();revision++;pending=undefined;snapshot={...snapshot,loaded:false,loading:false};return Promise.resolve();
  }};
}
export function queryKey(query:Query={}){return JSON.stringify(Object.fromEntries(Object.entries(query).filter(([k,v])=>v!==undefined&&v!==''&&!(k==='page'&&v===1)&&!(k==='pageSize'&&v===50)).sort(([a],[b])=>a.localeCompare(b))));}
export function createWorkshopStore(){
 const fetchers={customers:customersApi.list,vehicles:vehiclesApi.list,appointments:appointmentsApi.list,worksheets:worksheetsApi.list,inventory:inventoryApi.list,
  settings:()=>settingsApi.get(),dashboard:(params?:Query,signal?:AbortSignal)=>client.get<DashboardData>('/Dashboard',{params,signal})};
 function make<K extends Resource>(name:K,query:Query={},dynamic=false){
  const fetcher=async(signal:AbortSignal)=>{
   if(query.id&&['vehicles','appointments','worksheets','customers'].includes(name)){
    const path={vehicles:'Vehicle',appointments:'Appointments',worksheets:'ServiceJobs',customers:'Customers'}[name as 'vehicles'];
    const response=await client.get<unknown>(`/${path}/${query.id}`,{signal});return {data:[response.data]} as Transport<Payload[K]>;
   }
   return await fetchers[name](query,signal) as unknown as Transport<Payload[K]>;
  };
  return resource((name==='settings'||name==='dashboard'?null:[]) as Payload[K],fetcher,query,dynamic);
 }
 const resources={customers:make('customers'),vehicles:make('vehicles'),appointments:make('appointments'),worksheets:make('worksheets'),inventory:make('inventory'),settings:make('settings'),dashboard:make('dashboard')};
 type AnyRecord=ReturnType<typeof make<Resource>>;
 const queries=new Map<string,{name:Resource;record:AnyRecord}>();
 return {resources,query:<K extends Resource>(name:K,params:Query)=>{
  if(queryKey(params)==='{}')return resources[name] as ReturnType<typeof make<K>>;
  const key=name+queryKey(params);const cached=queries.get(key);if(cached)return cached.record as ReturnType<typeof make<K>>;
  if(queries.size>=64){const oldest=[...queries].find(([,v])=>!v.record.inUse());if(oldest)queries.delete(oldest[0]);else throw new Error('Too many active resource queries');}
  const record=make(name,params,true);queries.set(key,{name,record:record as AnyRecord});return record;
 },refresh:async(names:readonly Resource[])=>{
  const affected=new Set(names);if(names.some(n=>n!=='settings'))affected.add('dashboard');
  await Promise.all([...affected].map(name=>resources[name].invalidate()).concat([...queries.values()].filter(q=>affected.has(q.name)).map(q=>q.record.invalidate())));
 }};
}
