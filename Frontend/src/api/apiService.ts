import axios, { AxiosResponse } from 'axios';
import { Vehicle, Customer, Appointment } from '../types';

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
  deleteAppointment: (id: number) => axios.delete(`${API_URL}/Appointments/${id}`)
};