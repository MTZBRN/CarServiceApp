import client from './client';
import { mutation } from './changes';
import type { Appointment, CreateAppointmentRequest, UpdateAppointmentRequest } from '../types';
export const appointmentsApi = {
  list: () => client.get<Appointment[]>('/Appointments'),
  get: (id: number) => client.get<Appointment>(`/Appointments/${id}`),
  create: (data: CreateAppointmentRequest) => mutation(client.post<Appointment>('/Appointments', data), ['appointments']),
  update: (id: number, data: UpdateAppointmentRequest) => mutation(client.put<void>(`/Appointments/${id}`, { ...data, id }), ["appointments","worksheets"]),
  remove: (id: number) => mutation(client.delete<void>(`/Appointments/${id}`), ["appointments","worksheets"]),
};
