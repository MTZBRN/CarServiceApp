import {requestQuery} from './query';
import type { Query } from '../types/queries';
import client from './client';
import { mutation } from './changes';
import type { Customer, CreateCustomerRequest, UpdateCustomerRequest } from '../types';
export const customersApi = {
  list: (params?:Query,signal?:AbortSignal) => client.get<Customer[]>('/Customers',{params:requestQuery(params),signal}),
  get: (id: number) => client.get<Customer>(`/Customers/${id}`),
  create: (data: CreateCustomerRequest) => mutation(client.post<Customer>('/Customers', data), ['customers']),
  update: (id: number, data: UpdateCustomerRequest) => mutation(client.put<void>(`/Customers/${id}`, data), ["customers","vehicles","appointments"]),
  remove: (id: number) => mutation(client.delete<void>(`/Customers/${id}`), ["customers","vehicles","appointments"]),
};
