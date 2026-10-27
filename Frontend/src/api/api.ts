import axios from "axios";

// ✅ OKOS URL KEZELÉS:
// Kivettük az "/api" végződést, hogy ne duplázódjon meg a hívásoknál (ne legyen /api/api/...)
const viteEnv = (
  import.meta as ImportMeta & {
    env?: {
      PROD?: boolean;
    };
  }
).env;
const isProduction = viteEnv?.PROD ?? false; // Vite-ben a PROD, Node/Playwright alatt false
const API_URL = isProduction ? "" : "http://localhost:5232/api"; // A fejlesztői környezetben a backend URL-je

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
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url?.endsWith("/Auth/login");
    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem("authToken");
      localStorage.removeItem("currentUser");
      localStorage.removeItem("userRole"); // Biztos ami biztos
      if (typeof window !== "undefined") {
        window.location.href = "/";
      } // Visszadob a loginra
    }
    return Promise.reject(error);
  },
);

export default api;