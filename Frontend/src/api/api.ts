import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5232/api", // A te backend portod
});

// Axios Interceptor beállítása
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("authToken");
    if (token) {
      // ✅ Automatikusan hozzáadja a "Bearer <token>" fejlécet minden kéréshez
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Válasz interceptor (opcionális): Ha a szerver 401-et dob (lejárt token), kijelentkeztet
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("authToken");
      localStorage.removeItem("currentUser");
      window.location.href = "/"; // Visszadob a loginra
    }
    return Promise.reject(error);
  },
);

export default api;
