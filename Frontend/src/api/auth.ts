import client from './client';
import type { SessionUser, LoginRequest, ChangePasswordRequest } from '../types';
export const authApi = {
  me: () => client.get<SessionUser>('/Auth/me'),
  login: (data: LoginRequest) => client.post<SessionUser & { token: string }>('/Auth/login', data),
  changePassword: (data: ChangePasswordRequest) => client.post<void>('/Auth/change-password', data),
  uploadProfilePicture: (data: FormData) => client.post<{ filePath: string }>('/Auth/upload-profile-picture', data),
};
