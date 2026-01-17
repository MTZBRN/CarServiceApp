import axios, { AxiosResponse } from 'axios';
import { Vehicle, Customer, Appointment,ServiceJob, Part} from '../types';

const API_URL = 'http://localhost:5232/api';

export const apiService = {
  getVehicles: () => axios.get<Vehicle[]>(`${API_URL}/Vehicle`),
  getCustomers: () => axios.get<Customer[]>(`${API_URL}/Customers`),
  getAppointments: () => axios.get<Appointment[]>(`${API_URL}/Appointments`),
  
  // A Partial<T> azt jelenti, hogy nem kell ID-t küldeni létrehozáskor
  createCustomer: (data: Partial<Customer>) => axios.post<Customer>(`${API_URL}/Customers`, data),
  createVehicle: (data: Partial<Vehicle>) => axios.post<Vehicle>(`${API_URL}/Vehicle`, data),
  createAppointment: (data: Partial<Appointment>) => axios.post<Appointment>(`${API_URL}/Appointments`, data),
  
  deleteVehicle: (id: number) => axios.delete(`${API_URL}/Vehicle/${id}`),
  deleteAppointment: (id: number) => axios.delete(`${API_URL}/Appointments/${id}`),

  getServiceJob: (appointmentId: number) => axios.get<ServiceJob>(`${API_URL}/ServiceJobs/ByAppointment/${appointmentId}`),
  saveServiceJob: (data: ServiceJob) => axios.post<ServiceJob>(`${API_URL}/ServiceJobs`, data),

  
  getServiceHistory: (vehicleId: number) => axios.get<ServiceJob[]>(`${API_URL}/ServiceJobs/ByVehicle/${vehicleId}`),

  getParts: () => axios.get<Part[]>(`${API_URL}/parts`),
    createPart: (data: Omit<Part, 'id'>) => axios.post<Part>(`${API_URL}/parts`, data),
    updatePart: (id: number, data: Part) => axios.put(`${API_URL}/parts/${id}`, data),
    deletePart: (id: number) => axios.delete(`${API_URL}/parts/${id}`),
};