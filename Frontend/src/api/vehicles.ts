import {requestQuery} from './query';
import type { Query } from '../types/queries';
import client from './client';
import { mutation } from './changes';
import type { Vehicle, CreateVehicleRequest } from '../types';
export const vehiclesApi = {
  list: (params?:Query,signal?:AbortSignal) => client.get<Vehicle[]>('/Vehicle',{params:requestQuery(params),signal}),
  get: (id: number) => client.get<Vehicle>(`/Vehicle/${id}`),
  create: (data: CreateVehicleRequest) => mutation(client.post<Vehicle>('/Vehicle', data), ['vehicles']),

  remove: (id: number) => mutation(client.delete<void>(`/Vehicle/${id}`), ["vehicles","appointments","worksheets"]),
};
