import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { LoadingState, ErrorState } from "../components/ui/StateViews";
import Login from "../components/Pages/Login";
function SessionStatus() {
    const { error, retry } = useAuth();
    return error ? <ErrorState message="A munkamenet ellenőrzése nem sikerült." onRetry={retry} /> : <LoadingState />;
}
export function RequireAuth() {
    const { user, loading, error } = useAuth();
    const location = useLocation();
    if (loading || error)
        return <SessionStatus />;
    if (!user)
        return <Navigate to={"/login?returnTo=" + encodeURIComponent(location.pathname + location.search + location.hash)} replace/>;
    return <Outlet />;
}
export function RequireAdmin() {
    const { user } = useAuth();
    return user?.role === "admin" ? <Outlet /> : <ErrorState message="Nincs jogosultságod az oldal megtekintéséhez." />;
}
export function LoginRoute() {
    const { user, loading, error, login } = useAuth();
    const location = useLocation();
    const candidate = new URLSearchParams(location.search).get("returnTo") || "/dashboard";
    const target = candidate.startsWith("/") && !candidate.startsWith("//") && !candidate.includes("\\") && !/^\/login(?:[/?#]|$)/.test(candidate) ? candidate : "/dashboard";
    if (loading || error)
        return <SessionStatus />;
    return user ? <Navigate to={target} replace/> : <Login onLogin={login}/>;
}
