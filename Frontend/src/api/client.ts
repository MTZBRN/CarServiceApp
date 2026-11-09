import axios from 'axios';
const isProduction = (import.meta as ImportMeta & { env?: { PROD?: boolean } }).env?.PROD ?? false;
export const serverOrigin = isProduction ? '' : 'http://localhost:5232';
export const profilePictureUrl = (fileName: string) => serverOrigin + '/uploads/' + encodeURIComponent(fileName);
const client = axios.create({ baseURL: serverOrigin + '/api' });
let sessionGeneration = 0;
const storedToken = () => typeof localStorage === 'undefined' ? null : localStorage.getItem('authToken');
let boundToken = storedToken();
let sessionController = new AbortController();
const requestSessions = new WeakMap<object, number>();
// Called synchronously before clearing/changing identity, including repeated logins with the same token.
export function resetApiSession() {
  boundToken = storedToken();
  sessionGeneration++;
  sessionController.abort();
  sessionController = new AbortController();
}
client.interceptors.request.use(config => {
  requestSessions.set(config, sessionGeneration);
  config.signal = config.signal ? AbortSignal.any([config.signal as AbortSignal, sessionController.signal]) : sessionController.signal;
  const token = storedToken();
  if (token !== boundToken) throw new axios.CanceledError('Session changed');
  if (token) config.headers.Authorization = 'Bearer ' + token;
  return config;
});
client.interceptors.response.use(response => {
  if (requestSessions.get(response.config) !== sessionGeneration || storedToken() !== boundToken) throw new axios.CanceledError('Session changed');
  return response;
}, (error: unknown) => {
  if (axios.isAxiosError(error)) {
    if (error.config && requestSessions.get(error.config) !== sessionGeneration) return Promise.reject(new axios.CanceledError('Session changed'));
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
    if (error.response?.status === 401 && error.config?.url !== '/Auth/login' && token && error.config?.headers?.Authorization === 'Bearer ' + token) {
      for (const key of ['authToken', 'currentUser', 'user_data', 'userRole']) localStorage.removeItem(key);
      resetApiSession();
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('session-invalid'));
    }
  }
  return Promise.reject(error);
});
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string } | string>(error)) {
    const data = error.response?.data;
    const validation = data as {errors?:Record<string,string[]>} | undefined;
    if(validation?.errors) return Object.values(validation.errors).flat().join(' ');
    if (typeof data === 'string' && data) return data;
    if (data && typeof data === 'object' && typeof data.message === 'string') return data.message;
  }
  return fallback;
}
export default client;
