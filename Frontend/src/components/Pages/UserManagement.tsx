import { useCallback, useEffect, useState } from 'react';
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
  const [users,setUsers]=useState<User[]>([]), [loading,setLoading]=useState(true);
  const [error,setError]=useState(''), [add,setAdd]=useState(false);
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try {setUsers((await usersApi.list()).data);}
    catch(e) {setError(apiErrorMessage(e,'A felhasználók nem tölthetők be.'));}
    finally {setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  const removal=useRemoval<User>(async id=>{await usersApi.remove(id);await load();});
  const lastAdmin=users.filter(u=>u.role==='admin').length===1;
  return <div className="records-page users-page">
    <div className="page-intro"><div><h2>Rendszerfelhasználók</h2><p>Műhelyhozzáférés és szerepkörök kezelése.</p></div><Button onClick={()=>setAdd(true)}><UserPlus size={17} aria-hidden="true" />Új hozzáadása</Button></div>
    <Card><p className="records-note">Rendszergazda: cégbeállítások és felhasználók kezelése is. Szerelő: műhelymunkák kezelése. Az utolsó rendszergazda nem törölhető.</p></Card>
    {loading?<LoadingState />:error?<ErrorState message={error} onRetry={()=>void load()} />:!users.length?<EmptyState title="Nincs felhasználó" />:<Table caption="Felhasználók"><thead><tr>{['Név','Azonosító (Email)','Szerepkör','Műveletek'].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{users.map(u=><tr key={u.id}><td data-label="Név">{u.name}</td><td data-label="Azonosító (Email)">{u.email}</td><td data-label="Szerepkör"><Badge tone={u.role==='admin'?'info':'neutral'}>{u.role==='admin'?'Rendszergazda':u.role==='mechanic'?'Szerelő':'Ismeretlen szerepkör'}</Badge></td><td data-label="Műveletek"><Button variant="danger" disabled={lastAdmin&&u.role==='admin'} title={lastAdmin&&u.role==='admin'?'Az utolsó rendszergazda nem törölhető.':undefined} aria-label={u.name+' törlése'} onClick={()=>removal.ask(u)}>Törlés</Button></td></tr>)}</tbody></Table>}
    {add && <AddUserModal onClose={()=>setAdd(false)} onSuccess={()=>{setAdd(false);void load();}} />}{removal.dialog}
  </div>;
}
