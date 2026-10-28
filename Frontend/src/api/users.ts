import client from './client';
import type { User, CreateUserRequest } from '../types';
export const usersApi = {
 list: () => client.get<User[]>('/Users'),
 create: (data: CreateUserRequest) => client.post<User>('/Users', data),
 remove: (id: number) => client.delete<void>(`/Users/${id}`),
};
