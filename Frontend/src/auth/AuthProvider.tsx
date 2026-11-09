import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { authApi } from '../api/auth';
import { resetApiSession, serverOrigin } from '../api/client';
import Modal from '../components/ui/Modal';
import { monitorActivity } from './monitorActivity';
import type { SessionUser } from '../types';

interface AuthState {
    user: SessionUser | null;
    loading: boolean;
    error: boolean;
    retry: () => void;
    login: (token: string, name: string, role: string) => void;
    logout: () => void;
}
const AuthContext = createContext<AuthState | null>(null);
const tokenSnapshot = () => localStorage.getItem('authToken');
function subscribeIdentity(update: () => void) {
    let observed = tokenSnapshot();
    const changed = () => {
        observed = tokenSnapshot();
        resetApiSession();
        update();
    };
    const reconcile = () => { if (observed !== tokenSnapshot()) changed(); };
    const storage = (event: StorageEvent) => {
        if (event.key === 'authToken' || event.key === null) changed();
    };
    window.addEventListener('storage', storage);
    window.addEventListener('session-invalid', changed);
    window.addEventListener('pageshow', reconcile);
    window.addEventListener('focus', reconcile);
    document.addEventListener('visibilitychange', reconcile);
    return () => {
        window.removeEventListener('storage', storage);
        window.removeEventListener('session-invalid', changed);
        window.removeEventListener('pageshow', reconcile);
        window.removeEventListener('focus', reconcile);
        document.removeEventListener('visibilitychange', reconcile);
    };
}
function login(token: string, name: string, role: string) {
    localStorage.setItem('currentUser', name);
    localStorage.setItem('userRole', role);
    localStorage.setItem('authToken', token);
    window.dispatchEvent(new Event('session-invalid'));
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const token = useSyncExternalStore(subscribeIdentity, tokenSnapshot);
    const [notice, setNotice] = useState('');
    const signOut = useCallback((expected: string, idle: boolean) => {
        if (tokenSnapshot() !== expected) return;
        for (const key of ['currentUser', 'userRole', 'user_data', 'authToken']) localStorage.removeItem(key);
        window.dispatchEvent(new Event('session-invalid'));
        setNotice(idle ? 'A munkamenet lejárt. Jelentkezz be újra.' : '');
        const unconfirmed = () => setNotice('Ezen az eszközön kijelentkeztél. A szerveroldali visszavonást nem sikerült megerősíteni.');
        void fetch(serverOrigin + '/api/Auth/logout' + (idle ? '?currentSessionOnly=true' : ''), {
            method: 'POST', headers: { Authorization: 'Bearer ' + expected }, keepalive: true,
            signal: AbortSignal.timeout(8000),
        }).then(response => { if (!response.ok && response.status !== 401) unconfirmed(); }).catch(unconfirmed);
    }, []);
    return <>
        {!token && notice && <p role="status">{notice}</p>}
        <Session key={token} token={token} signOut={signOut}>{children}</Session>
    </>;
}

function Session({ token, signOut, children }: {
    token: string | null; signOut: (token: string, idle: boolean) => void; children: ReactNode;
}) {
    const [user, setUser] = useState<SessionUser | null>(null);
    const [error, setError] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [warning, setWarning] = useState(false);
    const [continueSession, setContinueSession] = useState<() => void>(() => () => {});
    useEffect(() => {
        if (!token) return;
        let active = true;
        let stop: (() => void) | undefined;
        const started = Date.now();
        authApi.me().then(({ data }) => {
            if (!active || token !== tokenSnapshot()) return;
            if (!Number.isFinite(data.remainingMs) || !data.sessionId) throw new Error('Invalid session response');
            const { sessionId, remainingMs, ...identity } = data;
            const monitor = monitorActivity(token, sessionId, started + remainingMs, setWarning, () => signOut(token, true));
            stop = monitor.stop;
            if (token !== tokenSnapshot()) return;
            setContinueSession(() => monitor.extend);
            setUser(identity);
            localStorage.setItem('user_data', JSON.stringify(identity));
            localStorage.setItem('currentUser', identity.userName);
            localStorage.setItem('userRole', identity.role);
        }).catch(() => { if (active && tokenSnapshot() === token) setError(true); });
        return () => { active = false; stop?.(); };
    }, [attempt, token, signOut]);
    const retry = () => { setError(false); setAttempt(n => n + 1); };
    return <AuthContext.Provider value={{ user, loading: !!token && !user && !error, error, retry, login,
        logout: () => { if (token) signOut(token, false); } }}>
        {children}
        {warning && user && <Modal title="A munkamenet hamarosan lejár" onClose={continueSession}
            footer={<button type="button" onClick={continueSession}>Munkamenet folytatása</button>}>
            <p>A kijelentkezés előtt folytasd a munkamenetet és mentsd a módosításokat. A nem mentett munkalapadatok elvesznek.</p>
        </Modal>}
    </AuthContext.Provider>;
}
export function useAuth() {
    const auth = useContext(AuthContext);
    if (!auth) throw new Error('AuthProvider missing');
    return auth;
}
