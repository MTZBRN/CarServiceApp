import {requestQuery} from './query';
import type { Query } from '../types/queries';
import client from './client';
import type { User, CreateUserRequest } from '../types';
export const usersApi = {
 list: (params?:Query,signal?:AbortSignal) => client.get<User[]>('/Users',{params:requestQuery(params),signal}),
 create: (data: CreateUserRequest) => client.post<User>('/Users', data),
 remove: (id: number) => client.delete<void>(`/Users/${id}`),
};
