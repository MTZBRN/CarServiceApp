import client from './client';
import { mutation } from './changes';
import type { Part, SavePartRequest } from '../types';
export const inventoryApi = {
  list: () => client.get<Part[]>('/parts'),
  create: (data: SavePartRequest) => mutation(client.post<Part>('/parts', data), ['inventory']),
  update: (id: number, data: SavePartRequest) => mutation(client.put<void>(`/parts/${id}`, { ...data, id }), ["inventory"]),
  remove: (id: number) => mutation(client.delete<void>(`/parts/${id}`), ["inventory"]),
};
