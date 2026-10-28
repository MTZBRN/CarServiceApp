import client from './client';
import { mutation } from './changes';
import type { ServiceJob, CreateWorksheetRequest, UpdateWorksheetRequest } from '../types';
const affected = ['worksheets', 'appointments'] as const;
export const worksheetsApi = {
  list: () => client.get<ServiceJob[]>('/ServiceJobs'),
  get: (id: number) => client.get<ServiceJob>(`/ServiceJobs/${id}`),
  byAppointment: (id: number) => client.get<ServiceJob>(`/ServiceJobs/ByAppointment/${id}`),
  byVehicle: (id: number) => client.get<ServiceJob[]>(`/ServiceJobs/ByVehicle/${id}`),
  create: (data: CreateWorksheetRequest) => mutation(client.post<ServiceJob>('/ServiceJobs', data), affected),
  update: (id: number, data: UpdateWorksheetRequest) => mutation(client.put<void>(`/ServiceJobs/${id}`, { ...data, id }), affected),
  remove: (id: number) => mutation(client.delete<void>(`/ServiceJobs/${id}`), affected),
};
