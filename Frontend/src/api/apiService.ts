import api from "./api";
import { Vehicle, Customer, Appointment, ServiceJob, Part } from "../types";

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
    api.post<ServiceJob>("/ServiceJobs", data),

  // 4. Frissítés (Update)
  updateServiceJob: (id: number, data: Partial<ServiceJob>) =>
    api.put(`/ServiceJobs/${id}`, data),

  // 5. Törlés
  deleteServiceJob: (id: number) => api.delete(`/ServiceJobs/${id}`),

  // Segédfüggvények
  getServiceJobByAppointment: (appointmentId: number) =>
    api.get<ServiceJob>(`/ServiceJobs/ByAppointment/${appointmentId}`),
  getServiceHistory: (vehicleId: number) =>
    api.get<ServiceJob[]>(`/ServiceJobs/ByVehicle/${vehicleId}`),

  //--- SEED DATA ---
  seedDatabase: () => api.post("/Seed"),
};
