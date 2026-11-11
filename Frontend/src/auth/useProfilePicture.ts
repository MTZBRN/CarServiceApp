import { useEffect, useState } from 'react';
import client from '../api/client';

// Fetch through the session-aware API client. Data URLs work with the existing
// img-src data: CSP; no public URL, token query parameter or persistent image cache.
export function useProfilePicture(name: string | null) {
  const token = localStorage.getItem('authToken');
  const [loaded, setLoaded] = useState<{ name: string; token: string; url: string } | null>(null);
  useEffect(() => {
    if (!name || !token) return;
    const controller = new AbortController();
    const reader = new FileReader();
    let active = true;
    void client.get<Blob>('/ProfileImages/' + encodeURIComponent(name), {
      responseType: 'blob', signal: controller.signal,
    }).then(({ data }) => {
      if (!active || localStorage.getItem('authToken') !== token) return;
      reader.onload = () => {
        if (active && localStorage.getItem('authToken') === token && typeof reader.result === 'string')
          setLoaded({ name, token, url: reader.result });
      };
      reader.readAsDataURL(data);
    }).catch(() => { /* Missing/denied images fall back to initials; 401 is handled by the API client. */ });
    return () => { active = false; controller.abort(); reader.abort(); };
  }, [name, token]);
  // Never render the previous filename/identity while the next request is pending.
  return loaded?.name === name && loaded.token === token ? loaded.url : null;
}
