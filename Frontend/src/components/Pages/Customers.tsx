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
export default function Customers(){
 const state=useWorkshopResource('customers'); const vehicles=useWorkshopResource('vehicles'); const [search,setSearch]=useState(''); const [editing,setEditing]=useState<Customer|null|undefined>(undefined); const [detail,setDetail]=useState<Customer|null>(null); const removal=useRemoval<Customer>(customersApi.remove);
 const rows=state.data.filter(c=>[c.name,c.phoneNumber,c.email].some(s=>s?.toLocaleLowerCase('hu').includes(search.toLocaleLowerCase('hu'))));
 return <div className="records-page"><Toolbar search={search} onSearch={setSearch} count={rows.length} total={state.data.length} action={<NewButton onClick={()=>setEditing(null)}>Új ügyfél</NewButton>} /><ListState {...state} count={rows.length} total={state.data.length} retry={state.refresh} reset={()=>setSearch('')}><Table caption="Ügyfelek"><thead><tr>{['Név','Telefonszám','Email','Cím','Járművek','Műveletek'].map(x=><th key={x} scope="col">{x}</th>)}</tr></thead><tbody>{rows.map(c=><tr key={c.id}><td data-label="Név">{c.name}</td><td data-label="Telefonszám"><a href={'tel:'+c.phoneNumber}>{c.phoneNumber}</a></td><td data-label="Email">{c.email||'—'}</td><td data-label="Cím">{c.address||'—'}</td><td data-label="Járművek">{vehicles.loaded&&!vehicles.error?vehicles.data.filter(v=>v.customerId===c.id).length:'—'}</td><td data-label="Műveletek"><div className="records-actions"><Button variant="secondary" onClick={()=>setDetail(c)}>Adatok</Button><Button variant="secondary" onClick={()=>setEditing(c)}>Szerkesztés</Button><Button variant="danger" onClick={()=>removal.ask(c)}>Törlés</Button></div></td></tr>)}</tbody></Table></ListState>
 {editing!==undefined&&<CustomerModal key={editing?.id||'new'} isOpen initialData={editing} onClose={()=>setEditing(undefined)} onSave={async data=>{if(editing)await customersApi.update(editing.id,data);else await customersApi.create(data);setEditing(undefined);}} />}{removal.dialog}
 {detail&&<Modal title={detail.name} onClose={()=>setDetail(null)}><p>{detail.phoneNumber} · {detail.email||'Nincs email'}</p><p>{detail.address||'Nincs cím'}</p><h3>Kapcsolódó járművek</h3>{vehicles.error?<p>Nem sikerült betölteni a járműveket.</p>:vehicles.data.filter(v=>v.customerId===detail.id).map(v=><p key={v.id}><Link to={'/vehicles/'+v.id}>{v.licensePlate} · {v.make} {v.model}</Link></p>)}</Modal>}</div>;
}
