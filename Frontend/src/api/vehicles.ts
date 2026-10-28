import client from './client';
import { mutation } from './changes';
import type { Vehicle, CreateVehicleRequest } from '../types';
export const vehiclesApi = {
  list: () => client.get<Vehicle[]>('/Vehicle'),
  get: (id: number) => client.get<Vehicle>(`/Vehicle/${id}`),
  create: (data: CreateVehicleRequest) => mutation(client.post<Vehicle>('/Vehicle', data), ['vehicles']),

  remove: (id: number) => mutation(client.delete<void>(`/Vehicle/${id}`), ["vehicles","appointments","worksheets"]),
};
