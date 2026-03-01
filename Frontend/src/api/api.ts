import axios from "axios";

// ✅ OKOS URL KEZELÉS:
// Ha élesben fut (Render), akkor ugyanazon a szerveren van a backend, így elég az "/api"
// Ha lokálisan fejleszted (a te gépeden), akkor a localhost:5232-höz szól
const isProduction = import.meta.env.PROD;
const API_URL = isProduction ? "/api" : "http://localhost:5232/api";

const api = axios.create({
  baseURL: API_URL,
});

// Axios Interceptor beállítása
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("authToken");
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
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("authToken");
      localStorage.removeItem("currentUser");
      localStorage.removeItem("userRole"); // Biztos ami biztos
      window.location.href = "/"; // Visszadob a loginra
    }
    return Promise.reject(error);
  },
);

export default api;
