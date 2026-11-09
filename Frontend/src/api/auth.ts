import client from './client';
import type { SessionUser, LoginRequest, ChangePasswordRequest } from '../types';
export const authApi = {
  me: () => client.get<SessionUser & {sessionId:string; remainingMs:number}>('/Auth/me'),
  activity: () => client.post<{remainingMs:number}>('/Auth/activity', null, {timeout:8000}),
  login: (data: LoginRequest) => client.post<SessionUser & { token: string }>('/Auth/login', data),
  changePassword: (data: ChangePasswordRequest) => client.post<{token:string}>('/Auth/change-password', data),
  uploadProfilePicture: (data: FormData) => client.post<{ filePath: string }>('/Auth/upload-profile-picture', data),
};
