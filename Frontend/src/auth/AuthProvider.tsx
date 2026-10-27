import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import api from "../api/api";
interface SessionUser {
    userName: string;
    role: string;
    profilePicturePath?: string;
}
interface AuthState {
    user: SessionUser | null;
    loading: boolean;
    error: boolean;
    retry: () => void;
    login: (token: string, name: string, role: string) => void;
    logout: () => void;
}
const AuthContext = createContext<AuthState | null>(null);
function clearSession() { for (const key of ["authToken", "currentUser", "userRole", "user_data"])
    localStorage.removeItem(key); }
export function AuthProvider({ children }: {
    children: ReactNode;
}) {
    const [user, setUser] = useState<SessionUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const generation = useRef(0);
    useEffect(() => {
        const invalidate = () => { generation.current++; clearSession(); setUser(null); setLoading(false); setError(false); };
        window.addEventListener("session-invalid", invalidate);
        return () => window.removeEventListener("session-invalid", invalidate);
    }, []);
    useEffect(() => {
        const current = ++generation.current;
        let active = true;
        setLoading(true);
        setError(false);
        if (!localStorage.getItem("authToken")) {
            clearSession();
            setUser(null);
            setLoading(false);
            return;
        }
        api.get<SessionUser>("/Auth/me").then(({ data }) => {
            if (!active || current !== generation.current)
                return;
            setUser(data);
            localStorage.setItem("currentUser", data.userName);
            localStorage.setItem("userRole", data.role);
            localStorage.setItem("user_data", JSON.stringify(data));
        }).catch(err => {
            if (active && current === generation.current && err.response?.status !== 401)
                setError(true);
        }).finally(() => { if (active && current === generation.current)
            setLoading(false); });
        return () => { active = false; };
    }, [attempt]);
    const login = (token: string, name: string, role: string) => {
        generation.current++;
        localStorage.setItem("authToken", token);
        localStorage.setItem("currentUser", name);
        localStorage.setItem("userRole", role);
        setUser({ userName: name, role });
        setLoading(false);
        setError(false);
    };
    const logout = () => { generation.current++; clearSession(); setUser(null); setLoading(false); setError(false); };
    return <AuthContext.Provider value={{ user, loading, error, retry: () => setAttempt(a => a + 1), login, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const auth = useContext(AuthContext); if (!auth)
    throw new Error("AuthProvider missing"); return auth; }
