import client from './client';
import { mutation } from './changes';
import type { WorkshopSettings, SaveSettingsRequest } from '../types';
export const settingsApi = {
 get: () => client.get<WorkshopSettings>('/Settings'),
 save: (data: SaveSettingsRequest) => mutation(client.post<void>('/Settings', data), ['settings']),
};
