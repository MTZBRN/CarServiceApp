import { useRef, useState, type FormEvent } from 'react';
import { usersApi } from '../../api/users';
import { apiErrorMessage } from '../../api/client';
import type { CreateUserRequest } from '../../types';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { FormField,Input,Select } from '../ui/Fields';
import { useToast } from '../ui/ToastProvider';
interface Props {onClose:()=>void;onSuccess:()=>void;}
export default function AddUserModal({onClose,onSuccess}:Props) {
  const [draft,setDraft]=useState<CreateUserRequest>({name:'',email:'',password:'',role:'mechanic'});
  const [errors,setErrors]=useState<Record<string,string>>({}),[error,setError]=useState(''),[saving,setSaving]=useState(false);
  const lock=useRef(false); const {showToast}=useToast();
  async function submit(event:FormEvent) {
    event.preventDefault();if(lock.current)return;
    const next:Record<string,string>={};
    if(!draft.name.trim())next.name='Add meg a teljes nevet.';
    if(!draft.email.trim())next.email='Add meg a felhasználónevet.';
    if(!draft.password.trim())next.password='Add meg a jelszót.';
    if(!['admin','mechanic'].includes(draft.role))next.role='Érvénytelen szerepkör.';
    setErrors(next);setError('');if(Object.keys(next).length)return;
    lock.current=true;setSaving(true);
    try {await usersApi.create(draft);showToast('A felhasználó létrehozva.','success');onSuccess();}
    catch(e){setError(apiErrorMessage(e,'A felhasználó létrehozása nem sikerült.'));}
    finally{lock.current=false;setSaving(false);}
  }
  const close=()=>{if(!lock.current)onClose();};
  return <Modal title="Új felhasználó" onClose={close}><form className="records-form" onSubmit={submit} noValidate aria-busy={saving}>
    <fieldset disabled={saving} className="form-fieldset records-form">
      <FormField label="Teljes név" error={errors.name}><Input data-autofocus autoComplete="name" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} /></FormField>
      <FormField label="Felhasználónév (Email)" hint="A meglévő rendszer email címet vagy felhasználónevet is elfogad." error={errors.email}><Input autoComplete="off" value={draft.email} onChange={e=>setDraft({...draft,email:e.target.value})} /></FormField>
      <FormField label="Jelszó" error={errors.password}><Input type="password" autoComplete="new-password" value={draft.password} onChange={e=>setDraft({...draft,password:e.target.value})} /></FormField>
      <FormField label="Szerepkör" error={errors.role}><Select value={draft.role} onChange={e=>setDraft({...draft,role:e.target.value})}><option value="mechanic">Szerelő</option><option value="admin">Rendszergazda</option></Select></FormField>
    </fieldset>
    {error && <p role="alert" className="records-error">{error}</p>}
    <div className="records-form-actions"><Button variant="secondary" disabled={saving} onClick={close}>Mégse</Button><Button type="submit" disabled={saving}>{saving?'Mentés…':'Létrehozás'}</Button></div>
  </form></Modal>;
}
