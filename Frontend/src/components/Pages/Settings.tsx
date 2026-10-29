import { useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { authApi } from '../../api/auth';
import { settingsApi } from '../../api/settings';
import { apiErrorMessage, profilePictureUrl } from '../../api/client';
import { useWorkshopResource } from '../../data/useWorkshopData';
import type { SaveSettingsRequest, WorkshopSettings } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { FormField, Input } from '../ui/Fields';
import { LoadingState, ErrorState } from '../ui/StateViews';
import { useToast } from '../ui/ToastProvider';
import '../../features/records/records.css';
import '../../styles/final-pages.css';

function PersonalAccount() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [passwords, setPasswords] = useState({ oldPassword:'', newPassword:'', confirm:'' });
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [passwordError, setPasswordError] = useState(''), [uploadError, setUploadError] = useState('');
  const [saving, setSaving] = useState(false), [uploading, setUploading] = useState(false);
  const passwordLock = useRef(false), uploadLock = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File|null>(null);
  const [picture, setPicture] = useState<string|null>(() => {
    try { return JSON.parse(localStorage.getItem('user_data') || '{}').profilePicturePath || user?.profilePicturePath || null; }
    catch { return user?.profilePicturePath || null; }
  });
  async function changePassword(event:FormEvent) {
    event.preventDefault();
    if (passwordLock.current) return;
    const next:Record<string,string> = {};
    if (!passwords.oldPassword) next.oldPassword='Add meg a jelenlegi jelszót.';
    if (!passwords.newPassword.trim()) next.newPassword='Add meg az új jelszót.';
    if (passwords.confirm !== passwords.newPassword) next.confirm='A két új jelszó nem egyezik.';
    setErrors(next); setPasswordError('');
    if (Object.keys(next).length) return;
    passwordLock.current=true; setSaving(true);
    try {
      const response=await authApi.changePassword({ oldPassword:passwords.oldPassword, newPassword:passwords.newPassword });
      if(response.data.token) { localStorage.setItem("authToken",response.data.token); }
      setPasswords({oldPassword:'',newPassword:'',confirm:''});
      showToast('A jelszó módosítva.', 'success');
    } catch(e) { setPasswordError(apiErrorMessage(e,'A jelszóváltás nem sikerült.')); }
    finally { passwordLock.current=false; setSaving(false); }
  }
  async function upload(event:FormEvent) {
    event.preventDefault();
    if (uploadLock.current || !file) return;
    setUploadError('');
    if (!file.type.startsWith('image/') || !file.size) { setUploadError('Válassz egy nem üres képfájlt.'); return; }
    uploadLock.current=true; setUploading(true);
    const data=new FormData(); data.append('file',file);
    try {
      const response=await authApi.uploadProfilePicture(data);
      const name=response.data.filePath.split('/').pop() || null;
      const stored=JSON.parse(localStorage.getItem('user_data') || '{}');
      localStorage.setItem('user_data',JSON.stringify({...stored,profilePicturePath:name}));
      setPicture(name); setFile(null);
      if (fileInput.current) fileInput.current.value='';
      window.dispatchEvent(new Event('profile-updated'));
      showToast('A profilkép mentve.', 'success');
    } catch(e) { setUploadError(apiErrorMessage(e,'A profilkép feltöltése nem sikerült.')); }
    finally { uploadLock.current=false; setUploading(false); }
  }
  return <section className="settings-section" aria-labelledby="personal-heading">
    <h2 id="personal-heading">Személyes fiók</h2>
    <Card><h3>Profiladatok és profilkép</h3><div className="account-profile">
      {picture && <img className="account-picture" src={profilePictureUrl(picture)} alt="Saját profilkép" onError={()=>setPicture(null)} />}
      <div><strong>{user?.userName}</strong><p><Badge tone="neutral">{user?.role==='admin'?'Rendszergazda':'Szerelő'}</Badge></p></div>
    </div><p className="records-note">A név és a szerepkör ezen az oldalon nem módosítható.</p>
      <form className="records-form" onSubmit={upload} noValidate aria-busy={uploading}>
        <FormField label="Új profilkép" error={uploadError}><Input ref={fileInput} type="file" accept="image/*" disabled={uploading} onChange={e=>setFile(e.target.files?.[0] || null)} /></FormField>
        <div><Button type="submit" disabled={!file || uploading}>{uploading?'Feltöltés…':'Kép mentése'}</Button></div>
      </form>
    </Card>
    <Card><h3>Jelszó módosítása</h3><form className="records-form" onSubmit={changePassword} noValidate aria-busy={saving}>
      <fieldset disabled={saving} className="form-fieldset records-form-grid">
        <FormField label="Jelenlegi jelszó" error={errors.oldPassword}><Input type="password" autoComplete="current-password" value={passwords.oldPassword} onChange={e=>setPasswords({...passwords,oldPassword:e.target.value})} /></FormField>
        <FormField label="Új jelszó" error={errors.newPassword}><Input type="password" autoComplete="new-password" value={passwords.newPassword} onChange={e=>setPasswords({...passwords,newPassword:e.target.value})} /></FormField>
        <FormField label="Új jelszó megerősítése" error={errors.confirm}><Input type="password" autoComplete="new-password" value={passwords.confirm} onChange={e=>setPasswords({...passwords,confirm:e.target.value})} /></FormField>
      </fieldset>
      {passwordError && <p role="alert" className="records-error">{passwordError}</p>}
      <div><Button type="submit" disabled={saving}>{saving?'Mentés…':'Jelszó frissítése'}</Button></div>
    </form></Card>
  </section>;
}
function CompanyForm({ initial }:{initial:WorkshopSettings}) {
  const [draft,setDraft]=useState<SaveSettingsRequest>(()=>({...initial}));
  const [errors,setErrors]=useState<Record<string,string>>({});
  const [error,setError]=useState(''), [saving,setSaving]=useState(false);
  const lock=useRef(false);
  const {showToast}=useToast();
  async function save(event:FormEvent) {
    event.preventDefault(); if(lock.current)return;
    const next:Record<string,string>={};
    if (!draft.companyName.trim()) next.companyName='Add meg a cégnevet.';
    if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) next.email='Adj meg érvényes email címet.';
    if (!Number.isFinite(draft.hourlyRate) || draft.hourlyRate<0) next.hourlyRate='Adj meg nem negatív óradíjat.';
    if (!Number.isFinite(draft.vatRate) || draft.vatRate<0 || draft.vatRate>100) next.vatRate='Az ÁFA 0 és 100% közötti lehet.';
    setErrors(next); setError(''); if(Object.keys(next).length)return;
    lock.current=true;setSaving(true);
    try {
      const { companyName,address,taxNumber,phone,email,hourlyRate,vatRate }=draft;
      const response=await settingsApi.save({companyName,address,taxNumber,phone,email,hourlyRate,vatRate,version:draft.version});
      setDraft(previous=>({...previous,version:response.data.version}));
      showToast('A cégbeállítások mentve.','success');
    } catch(e) {setError(apiErrorMessage(e,'A beállítások mentése nem sikerült. A beírt adatok megmaradtak.'));}
    finally {lock.current=false;setSaving(false);}
  }
  const textFields=[['companyName','Cégnév'],['address','Cím'],['taxNumber','Adószám'],['phone','Telefonszám'],['email','Email']] as const;
  return <form className="settings-section" onSubmit={save} noValidate aria-busy={saving}>
    <h2>Cégbeállítások</h2>
    <Card><h3>Cégadatok a nyomtatott munkalaphoz</h3><p className="records-note">Ezeket az adatokat használja a munkalap nyomtatási előnézete.</p>
      <fieldset disabled={saving} className="form-fieldset records-form-grid">{textFields.map(([key,label])=><FormField key={key} label={label} error={errors[key]}><Input type={key==='email'?'email':key==='phone'?'tel':'text'} value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})} /></FormField>)}</fieldset>
    </Card>
    <Card><h3>Meglévő árazási alapértékek</h3><fieldset disabled={saving} className="form-fieldset records-form-grid">
      <FormField label="Rezsióradíj (Ft)" error={errors.hourlyRate}><Input type="number" min="0" step="any" value={Number.isNaN(draft.hourlyRate)?'':draft.hourlyRate} onChange={e=>setDraft({...draft,hourlyRate:e.target.value===''?NaN:Number(e.target.value)})} /></FormField>
      <FormField label="ÁFA (%)" error={errors.vatRate}><Input type="number" min="0" max="100" step="any" value={Number.isNaN(draft.vatRate)?'':draft.vatRate} onChange={e=>setDraft({...draft,vatRate:e.target.value===''?NaN:Number(e.target.value)})} /></FormField>
    </fieldset></Card>
    {error && <p role="alert" className="records-error">{error}</p>}
    <div><Button type="submit" disabled={saving}>{saving?'Mentés…':'Rendszeradatok mentése'}</Button></div>
  </form>;
}
export default function Settings() {
  const state=useWorkshopResource('settings');
  const {user}=useAuth();
  return <div className="settings-page"><PersonalAccount />{user?.role==='admin' && <>
    {state.error ? <ErrorState message={apiErrorMessage(state.error,'A cégadatok nem tölthetők be.')} onRetry={state.refresh} /> : !state.loaded || !state.data ? <LoadingState /> : <CompanyForm initial={state.data} />}
  </>}</div>;
}
