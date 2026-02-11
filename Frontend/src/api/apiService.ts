import axios from "axios";
import api from "./api";
import { Vehicle, Customer, Appointment, ServiceJob, Part } from "../types";

// Ellenőrizd a portot!
const API_URL = "http://localhost:5232/api";

export const apiService = {
  getVehicles: () => api.get<Vehicle[]>("/Vehicle"),
  createVehicle: (data: Partial<Vehicle>) =>
    api.post<Vehicle>("/Vehicle", data),
  deleteVehicle: (id: number) => api.delete(`/Vehicle/${id}`),

  // --- CUSTOMERS ---
  getCustomers: () => api.get<Customer[]>("/Customers"),
  createCustomer: (data: Partial<Customer>) =>
    api.post<Customer>("/Customers", data),

  // --- APPOINTMENTS ---
  getAppointments: () => api.get<Appointment[]>("/Appointments"),
  createAppointment: (data: Partial<Appointment>) =>
    api.post<Appointment>(`/Appointments`, data),
  deleteAppointment: (id: number) => api.delete(`/Appointments/${id}`),

  // --- SERVICE JOBS ---
  getServiceJobs: () => api.get<ServiceJob[]>("/ServiceJobs"),
  saveServiceJob: (data: any) => api.post("/ServiceJobs", data),

  // --- PARTS ---
  getParts: () => api.get<Part[]>("/parts"),
  createPart: (data: Omit<Part, "id">) => api.post<Part>("/parts", data),
  updatePart: (id: number, data: Part) => api.put(`/parts/${id}`, data),
  deletePart: (id: number) => api.delete(`/parts/${id}`),

  // 3. Létrehozás (Create)
  createServiceJob: (data: Partial<ServiceJob>) =>
    axios.post<ServiceJob>(`${API_URL}/ServiceJobs`, data),

  // 4. Frissítés (Update) - Ha a "save" nálad frissítést is jelent, akkor használhatod azt
  updateServiceJob: (id: number, data: Partial<ServiceJob>) =>
    axios.put(`${API_URL}/ServiceJobs/${id}`, data),

  // 5. Törlés
  deleteServiceJob: (id: number) =>
    axios.delete(`${API_URL}/ServiceJobs/${id}`),

  // Régi segédfüggvények (maradhatnak, ha használod őket)
  getServiceJobByAppointment: (appointmentId: number) =>
    axios.get<ServiceJob>(
      `${API_URL}/ServiceJobs/ByAppointment/${appointmentId}`,
    ),
  getServiceHistory: (vehicleId: number) =>
    axios.get<ServiceJob[]>(`${API_URL}/ServiceJobs/ByVehicle/${vehicleId}`),

  //--- SEED DATA ---
  seedDatabase: () => axios.post(`${API_URL}/Seed`),
};
