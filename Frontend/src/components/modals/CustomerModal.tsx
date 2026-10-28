import { useRef, useState } from 'react';
import type { Customer, CreateCustomerRequest } from '../../types';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { FormField, Input } from '../ui/Fields';
import { apiErrorMessage } from '../../api/client';
import '../../features/records/records.css';
export default function CustomerModal({ isOpen, initialData, onSave, onClose }: { isOpen: boolean; initialData?: Customer | null; onSave: (data: CreateCustomerRequest) => void | Promise<void>; onClose: () => void }) {
 const [data,setData] = useState({ name:initialData?.name || '', phoneNumber:initialData?.phoneNumber || '', email:initialData?.email || '', address:initialData?.address || '' });
 const [errors,setErrors] = useState<Record<string,string>>({}); const [error,setError]=useState(''); const [saving,setSaving]=useState(false); const lock=useRef(false);
 if (!isOpen) return null;
 return <Modal title={initialData ? 'Ügyfél szerkesztése' : 'Új ügyfél'} onClose={() => { if(!lock.current) onClose(); }}><form className="records-form" noValidate onSubmit={async e=>{e.preventDefault(); if(lock.current)return; const next:Record<string,string>={}; if(!data.name.trim())next.name='A név kötelező.'; if(!data.phoneNumber.trim())next.phoneNumber='A telefonszám kötelező.'; if(data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email))next.email='Érvényes email címet adj meg.'; setErrors(next); if(Object.keys(next).length)return; lock.current=true;setSaving(true);setError('');try{await onSave({...data,name:data.name.trim(),phoneNumber:data.phoneNumber.trim()});}catch(e){setError(apiErrorMessage(e,'A mentés nem sikerült.'));}finally{lock.current=false;setSaving(false);}}}>
 {(['name','phoneNumber','email','address'] as const).map((key,i)=><FormField key={key} label={['Teljes név *','Telefonszám *','Email','Cím'][i]} error={errors[key]}><Input data-autofocus={i===0 || undefined} type={key==='email'?'email':key==='phoneNumber'?'tel':'text'} required={i<2} placeholder={['Teljes név','+36 30 123 4567','pelda@email.hu','Település, Utca, Házszám'][i]} value={data[key]} onChange={e=>setData({...data,[key]:e.target.value})} /></FormField>)}
 {error&&<p role="alert" className="records-error">{error}</p>}<div className="records-form-actions"><Button variant="secondary" disabled={saving} onClick={onClose}>Mégse</Button><Button type="submit" disabled={saving}>{saving?'Mentés…':initialData?'Módosítások mentése':'Ügyfél létrehozása'}</Button></div></form></Modal>;
}
