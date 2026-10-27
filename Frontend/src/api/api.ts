import axios from "axios";

// API callers use resource paths; the base URL supplies /api in both environments.
const viteEnv = (
  import.meta as ImportMeta & {
    env?: {
      PROD?: boolean;
    };
  }
).env;
const isProduction = viteEnv?.PROD ?? false; // Vite-ben a PROD, Node/Playwright alatt false
const API_URL = isProduction ? "/api" : "http://localhost:5232/api"; // A fejlesztői környezetben a backend URL-je

const api = axios.create({
  baseURL: API_URL,
});

// Axios Interceptor beállítása
api.interceptors.request.use(
  (config) => {
    const token =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("authToken")
        : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Válasz interceptor: Ha a szerver 401-et dob (lejárt token), kijelentkeztet
api.interceptors.response.use(
  (response) => {
    if (typeof window !== "undefined" && ["post", "put", "delete"].includes(response.config.method || "") && !response.config.url?.startsWith("/Auth")) window.dispatchEvent(new Event("business-data-updated"));
    return response;
  },
  (error) => {
    const isLoginRequest = error.config?.url?.endsWith("/Auth/login");
    const requestToken = error.config?.headers?.Authorization;
    const currentToken = localStorage.getItem("authToken");
    // A late response from an old session must not log out a newly signed-in user.
    if (error.response?.status === 401 && !isLoginRequest && requestToken === `Bearer ${currentToken}`) {
      localStorage.removeItem("authToken");
      localStorage.removeItem("currentUser");
      localStorage.removeItem("user_data");
      localStorage.removeItem("userRole"); // Biztos ami biztos
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("session-invalid"));
      } // Visszadob a loginra
    }
    return Promise.reject(error);
  },
);

export default api;