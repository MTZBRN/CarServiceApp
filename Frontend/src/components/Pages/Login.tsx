import { useRef, useState, type FormEvent } from 'react';
import { Wrench, ArrowRight } from 'lucide-react';
import { authApi } from '../../api/auth';
import { apiErrorMessage } from '../../api/client';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { FormField, Input } from '../ui/Fields';
import '../../styles/final-pages.css';
interface Props { onLogin:(token:string,username:string,role:string)=>void; }
export default function Login({onLogin}:Props) {
  const [username,setUsername]=useState(''), [password,setPassword]=useState('');
  const [error,setError]=useState(''), [loading,setLoading]=useState(false);
  const lock=useRef(false);
  async function submit(event:FormEvent) {
    event.preventDefault(); if(lock.current)return;
    lock.current=true;setLoading(true);setError('');
    try {
      const {data}=await authApi.login({email:username,password});
      localStorage.setItem('user_data',JSON.stringify({name:data.userName,role:data.role,profilePicturePath:data.profilePicturePath}));
      onLogin(data.token,data.userName,data.role);
    } catch(e) {setError(apiErrorMessage(e,'A bejelentkezés nem sikerült. Ellenőrizd a felhasználónevet és a jelszót.'));}
    finally {lock.current=false;setLoading(false);}
  }
  return <main className="login-page"><Card className="login-card">
    <div className="login-brand"><span className="shell-brand-icon"><Wrench size={24} aria-hidden="true" /></span><div><h1>GTA Szerviz</h1><p>Műhelykezelés</p></div></div>
    <h2>Bejelentkezés</h2><p className="login-description">Lépj be a műhely munkaterületére.</p>
    <form onSubmit={submit} className="login-form" aria-busy={loading}>
      <FormField label="Felhasználónév (Email)"><Input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus placeholder="Felhasználónév (Email)" required value={username} onChange={e=>setUsername(e.target.value)} disabled={loading} /></FormField>
      <FormField label="Jelszó"><Input name="password" type="password" autoComplete="current-password" placeholder="Jelszó" required value={password} onChange={e=>setPassword(e.target.value)} disabled={loading} /></FormField>
      {error && <p className="login-error" role="alert">{error}</p>}
      <Button type="submit" disabled={loading}>{loading?'Belépés…':<>Belépés <ArrowRight size={17} aria-hidden="true" /></>}</Button>
    </form>
  </Card></main>;
}
