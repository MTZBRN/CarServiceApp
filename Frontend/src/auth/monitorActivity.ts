import { authApi } from '../api/auth';

// Only server acknowledgements advance this deadline. A reload uses read-only /me.
export function monitorActivity(token: string, sessionId: string, initialDeadline: number,
    warn: (visible: boolean) => void, expire: () => void) {
    const key = 'workshop.idle.' + sessionId;
    let deadline = initialDeadline;
    let timer: number;
    let pending = false;
    let stopped = false;
    let lastSent = -Infinity;
    const current = () => !stopped && localStorage.getItem('authToken') === token;
    function check() {
        window.clearTimeout(timer);
        if (!current()) return false;
        deadline = Math.max(deadline, Number(localStorage.getItem(key)) || 0);
        const remaining = deadline - Date.now();
        if (remaining <= 0) { expire(); return false; }
        warn(remaining <= 60_000);
        timer = window.setTimeout(check, remaining > 60_000 ? remaining - 60_000 : remaining);
        return true;
    }
    function extend() {
        if (!check() || pending || document.visibilityState !== 'visible') return;
        const started = Date.now();
        if (started - lastSent < 1000) return;
        pending = true;
        lastSent = started;
        void authApi.activity().then(({ data }) => {
            if (!current() || !Number.isFinite(data.remainingMs)) return;
            deadline = Math.max(deadline, started + data.remainingMs, Number(localStorage.getItem(key)) || 0);
            localStorage.setItem(key, String(deadline));
            check();
        }).catch(() => { /* Offline or rate-limited gestures keep the last confirmed deadline. */ })
          .finally(() => { pending = false; });
    }
    function gesture(event: Event) {
        if (!event.isTrusted || !check() || deadline - Date.now() <= 60_000) return;
        extend();
    }
    const shared = (event: StorageEvent) => { if (event.key === key) check(); };
    const gestures = ['pointerdown', 'keydown', 'input', 'wheel'];
    gestures.forEach(type => window.addEventListener(type, gesture, { capture: true, passive: true }));
    window.addEventListener('storage', shared);
    window.addEventListener('pageshow', check);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    check();
    return { extend, stop() {
        stopped = true;
        window.clearTimeout(timer);
        gestures.forEach(type => window.removeEventListener(type, gesture, true));
        window.removeEventListener('storage', shared);
        window.removeEventListener('pageshow', check);
        window.removeEventListener('focus', check);
        document.removeEventListener('visibilitychange', check);
        if (localStorage.getItem('authToken') !== token) localStorage.removeItem(key);
    } };
}
