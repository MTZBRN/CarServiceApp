import {requestQuery} from './query';
import type { Query } from '../types/queries';
import client from './client';
import { mutation } from './changes';
import type { ServiceJob, CreateWorksheetRequest, UpdateWorksheetRequest } from '../types';
const affected = ['worksheets', 'appointments'] as const;
export const worksheetsApi = {
  list: (params?:Query,signal?:AbortSignal) => client.get<ServiceJob[]>('/ServiceJobs',{params:requestQuery(params),signal}),
  get: (id: number) => client.get<ServiceJob>(`/ServiceJobs/${id}`),
  byAppointment: (id: number) => client.get<ServiceJob>(`/ServiceJobs/ByAppointment/${id}`),
  byVehicle: (id: number,params?:Query) => client.get<ServiceJob[]>(`/ServiceJobs/ByVehicle/${id}`,{params}),
  create: (data: CreateWorksheetRequest) => mutation(client.post<ServiceJob>('/ServiceJobs', data), affected),
  update: (id: number, data: UpdateWorksheetRequest) => mutation(client.put<ServiceJob>(`/ServiceJobs/${id}`, { ...data, id }), affected),
  remove: (id: number) => mutation(client.delete<void>(`/ServiceJobs/${id}`), affected),
};
