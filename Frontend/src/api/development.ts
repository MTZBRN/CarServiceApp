import client from './client';
import { mutation } from './changes';
export const seedDatabase = () => mutation(client.post<void>('/Seed'), ['customers', 'vehicles', 'appointments', 'worksheets', 'inventory']);
