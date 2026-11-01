import {Pager,usePaging} from '../../data/paging';
import {Input} from '../ui/Fields';
import { useCallback, useEffect, useState, useRef } from 'react';
import { UserPlus } from 'lucide-react';
import { usersApi } from '../../api/users';
import { apiErrorMessage } from '../../api/client';
import type { User } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Table from '../ui/Table';
import { LoadingState,ErrorState,EmptyState } from '../ui/StateViews';
import { useRemoval } from '../../features/records/shared';
import AddUserModal from '../modals/AddUserModal';
export default function UserManagement() {
  const sequence=useRef(0),controller=useRef<AbortController|undefined>(undefined);
  const paging=usePaging();const [total,setTotal]=useState(0),[admins,setAdmins]=useState(0);
  const [users,setUsers]=useState<User[]>([]), [loading,setLoading]=useState(true);
  const [error,setError]=useState(''), [add,setAdd]=useState(false);
  const load=useCallback(async()=>{
    const current=++sequence.current;controller.current?.abort();controller.current=new AbortController();setLoading(true);setError('');
    try {const response=await usersApi.list({page:paging.page,q:paging.q},controller.current.signal);if(current!==sequence.current)return;setUsers(response.data);setTotal(Number(response.headers['x-total-count']??response.data.length));setAdmins(Number(response.headers['x-admin-count']??response.data.filter(u=>u.role==='admin').length));}
    catch(e) {if(current===sequence.current)setError(apiErrorMessage(e,'A felhasználók nem tölthetők be.'));}
    finally {if(current===sequence.current)setLoading(false);}
  },[paging.page,paging.q]);
  useEffect(()=>{void load();return()=>{sequence.current++;controller.current?.abort();};},[load]);
  const removal=useRemoval<User>(async id=>{await usersApi.remove(id);await load();});
  const lastAdmin=admins===1;
  return <div className="records-page users-page">
    <div className="page-intro"><div><h2>Rendszerfelhasználók</h2><p>Műhelyhozzáférés és szerepkörök kezelése.</p></div><Button onClick={()=>setAdd(true)}><UserPlus size={17} aria-hidden="true" />Új hozzáadása</Button></div>
    <Input aria-label="Felhasználók keresése" type="search" value={paging.search} onChange={e=>paging.setSearch(e.target.value)} />
    <Card><p className="records-note">Rendszergazda: cégbeállítások és felhasználók kezelése is. Szerelő: műhelymunkák kezelése. Az utolsó rendszergazda nem törölhető.</p></Card>
    {loading?<LoadingState />:error?<ErrorState message={error} onRetry={()=>void load()} />:!users.length?<EmptyState title="Nincs felhasználó" />:<Table caption="Felhasználók"><thead><tr>{['Név','Azonosító (Email)','Szerepkör','Műveletek'].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{users.map(u=><tr key={u.id}><td data-label="Név">{u.name}</td><td data-label="Azonosító (Email)">{u.email}</td><td data-label="Szerepkör"><Badge tone={u.role==='admin'?'info':'neutral'}>{u.role==='admin'?'Rendszergazda':u.role==='mechanic'?'Szerelő':'Ismeretlen szerepkör'}</Badge></td><td data-label="Műveletek"><Button variant="danger" disabled={lastAdmin&&u.role==='admin'} title={lastAdmin&&u.role==='admin'?'Az utolsó rendszergazda nem törölhető.':undefined} aria-label={u.name+' törlése'} onClick={()=>removal.ask(u)}>Törlés</Button></td></tr>)}</tbody></Table>}
    <Pager page={paging.page} totalCount={total} setPage={paging.setPage} loading={loading} />
    {add && <AddUserModal onClose={()=>setAdd(false)} onSuccess={()=>{setAdd(false);void load();}} />}{removal.dialog}
  </div>;
}
