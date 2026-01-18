import axios from "axios";
import { Vehicle, Customer, Appointment, ServiceJob, Part } from "../types";

// Ellenőrizd a portot!
const API_URL = "http://localhost:5232/api";

export const apiService = {
  // --- VEHICLES ---
  getVehicles: () => axios.get<Vehicle[]>(`${API_URL}/Vehicle`), // Ha a backend Vehicle-t vár
  createVehicle: (data: Partial<Vehicle>) =>
    axios.post<Vehicle>(`${API_URL}/Vehicle`, data),
  deleteVehicle: (id: number) => axios.delete(`${API_URL}/Vehicle/${id}`),

  // --- CUSTOMERS ---
  getCustomers: () => axios.get<Customer[]>(`${API_URL}/Customers`),
  createCustomer: (data: Partial<Customer>) =>
    axios.post<Customer>(`${API_URL}/Customers`, data),

  // --- APPOINTMENTS ---
  getAppointments: () => axios.get<Appointment[]>(`${API_URL}/Appointments`),
  createAppointment: (data: Partial<Appointment>) =>
    axios.post<Appointment>(`${API_URL}/Appointments`, data),
  deleteAppointment: (id: number) =>
    axios.delete(`${API_URL}/Appointments/${id}`),

  // --- SERVICE JOBS (MUNKALAPOK) ---
  // 1. Összes munka lekérése (Ez kell a Dashboardnak!)
  getServiceJobs: () => axios.get<ServiceJob[]>(`${API_URL}/ServiceJobs`),

  // 2. Egy konkrét munka lekérése ID alapján
  getServiceJob: (id: number) =>
    axios.get<ServiceJob>(`${API_URL}/ServiceJobs/${id}`),
  saveServiceJob: (data: any) => axios.post(`${API_URL}/ServiceJobs`, data),

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

  // --- PARTS ---
  getParts: () => axios.get<Part[]>(`${API_URL}/parts`),
  createPart: (data: Omit<Part, "id">) =>
    axios.post<Part>(`${API_URL}/parts`, data),
  updatePart: (id: number, data: Part) =>
    axios.put(`${API_URL}/parts/${id}`, data),
  deletePart: (id: number) => axios.delete(`${API_URL}/parts/${id}`),

  //--- SEED DATA ---
  seedDatabase: () => axios.post(`${API_URL}/Seed`),
};
