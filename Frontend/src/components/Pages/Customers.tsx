import {Pager,usePaging} from '../../data/paging';
import {useAuth} from '../../auth/AuthProvider';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Customer } from '../../types';
import { customersApi } from '../../api/customers';
import { useWorkshopResource } from '../../data/useWorkshopData';
import CustomerModal from '../modals/CustomerModal';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Table from '../ui/Table';
import { Toolbar, NewButton, ListState, useRemoval } from '../../features/records/shared';
export default function Customers(){const {user}=useAuth();
 const paging=usePaging(); const {search,setSearch}=paging; const state=useWorkshopResource('customers',{page:paging.page,q:paging.q}); const [editing,setEditing]=useState<Customer|null|undefined>(undefined); const [detail,setDetail]=useState<Customer|null>(null); const removal=useRemoval<Customer>(customersApi.remove);
 const [relatedPage,setRelatedPage]=useState(1); const vehicles=useWorkshopResource('vehicles',{customerId:detail?.id,page:relatedPage},!!detail); const rows=search===paging.q?state.data:[];
 return <div className="records-page"><Toolbar search={search} onSearch={setSearch} count={rows.length} total={state.totalCount} action={<NewButton onClick={()=>setEditing(null)}>Új ügyfél</NewButton>} /><ListState {...state} loading={state.loading||search!==paging.q} count={rows.length} total={state.totalCount} retry={state.refresh} reset={()=>setSearch('')}><Table caption="Ügyfelek"><thead><tr>{['Név','Telefonszám','Email','Cím','Járművek','Műveletek'].map(x=><th key={x} scope="col">{x}</th>)}</tr></thead><tbody>{rows.map(c=><tr key={c.id}><td data-label="Név">{c.name}</td><td data-label="Telefonszám"><a href={'tel:'+c.phoneNumber}>{c.phoneNumber}</a></td><td data-label="Email">{c.email||'—'}</td><td data-label="Cím">{c.address||'—'}</td><td data-label="Járművek">{c.vehicleCount??'—'}</td><td data-label="Műveletek"><div className="records-actions"><Button variant="secondary" onClick={()=>{setRelatedPage(1);setDetail(c);}}>Adatok</Button><Button variant="secondary" onClick={()=>setEditing(c)}>Szerkesztés</Button>{user?.role==='admin'&&<Button variant="danger" onClick={()=>removal.ask(c)}>Törlés</Button>}</div></td></tr>)}</tbody></Table></ListState>
 <Pager {...state} page={paging.page} setPage={paging.setPage} />
 {editing!==undefined&&<CustomerModal key={editing?.id||'new'} isOpen initialData={editing} onClose={()=>setEditing(undefined)} onSave={async data=>{if(editing)await customersApi.update(editing.id,data);else await customersApi.create(data);setEditing(undefined);}} />}{removal.dialog}
 {detail&&<Modal title={detail.name} onClose={()=>setDetail(null)}><p>{detail.phoneNumber} · {detail.email||'Nincs email'}</p><p>{detail.address||'Nincs cím'}</p><h3>Kapcsolódó járművek</h3>{vehicles.error?<p>Nem sikerült betölteni a járműveket.</p>:vehicles.data.filter(v=>v.customerId===detail.id).map(v=><p key={v.id}><Link to={'/vehicles/'+v.id}>{v.licensePlate} · {v.make} {v.model}</Link></p>)}<Pager {...vehicles} page={relatedPage} setPage={setRelatedPage} label="Kapcsolódó járművek lapozása" /></Modal>}</div>;
}
