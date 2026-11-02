import {useEffect,useState} from 'react';
import Button from '../components/ui/Button';
import {useWorkshopResource} from './WorkshopDataProvider';
import type {Query} from '../types/queries';

export function useDebounced<T>(value:T,delay=250){const [stable,setStable]=useState(value);useEffect(()=>{const timer=setTimeout(()=>setStable(value),delay);return()=>clearTimeout(timer);},[value,delay]);return stable;}
export function usePaging(initialSearch=''){
 const [search,setSearchValue]=useState(initialSearch),[page,setPage]=useState(1);const q=useDebounced(search);
 return {search,q,page,setPage,setSearch:(value:string)=>{setSearchValue(value);setPage(1);}};
}
export function Pager({page,pageSize=50,totalCount=0,setPage,loading,loaded=true,label='Lapozás'}:{page:number;pageSize?:number;totalCount?:number;setPage:(page:number)=>void;loading?:boolean;loaded?:boolean;label?:string}){
 const pages=Math.max(1,Math.ceil(totalCount/pageSize));
 useEffect(()=>{if(loaded&&!loading&&page>pages)setPage(pages);},[loaded,loading,page,pages,setPage]);
 return <nav aria-label={label} className="records-actions"><Button variant="secondary" disabled={loading||page<=1} onClick={()=>setPage(page-1)}>Előző oldal</Button><span aria-live="polite">{page}. oldal / {pages} · {totalCount} találat</span><Button variant="secondary" disabled={loading||page>=pages} onClick={()=>setPage(page+1)}>Következő oldal</Button></nav>;
}
export function useLookup<K extends 'customers'|'vehicles'|'inventory'>(name:K,extra:Query={},enabled=true){const paging=usePaging();const state=useWorkshopResource(name,{...extra,page:paging.page,q:paging.q},enabled);return {...state,...paging};}
