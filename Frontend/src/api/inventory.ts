import {requestQuery} from './query';
import type { Query } from '../types/queries';
import client from './client';
import { mutation } from './changes';
import type { Part, SavePartRequest } from '../types';
export const inventoryApi = {
  list: (params?:Query,signal?:AbortSignal) => client.get<Part[]>('/parts',{params:requestQuery(params),signal}),
  create: (data: SavePartRequest) => mutation(client.post<Part>('/parts', data), ['inventory']),
  update: (id: number, data: SavePartRequest) => mutation(client.put<void>(`/parts/${id}`, { ...data, id }), ["inventory"]),
  remove: (id: number) => mutation(client.delete<void>(`/parts/${id}`), ["inventory"]),
};
