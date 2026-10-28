import type { Customer, Vehicle, Appointment, ServiceJob, Part, WorkshopSettings } from './domain';
export type CreateCustomerRequest = Omit<Customer, 'id' | 'email' | 'address'> & Partial<Pick<Customer, 'email' | 'address'>>;
export type UpdateCustomerRequest = CreateCustomerRequest;
export type CreateVehicleRequest = Omit<Vehicle, 'id' | 'customer'>;
export type CreateAppointmentRequest = Pick<Appointment, 'vehicleId' | 'startTime' | 'endTime' | 'note'>;
export type UpdateAppointmentRequest = CreateAppointmentRequest;
export type CreateWorksheetRequest = Omit<ServiceJob, 'id' | 'vehicle' | 'appointment'>;
export type UpdateWorksheetRequest = Pick<ServiceJob, 'description' | 'laborCost' | 'isCompleted' | 'jobParts'> & { appointmentId?: number | null };
export type SavePartRequest = Omit<Part, 'id'>;
export type SaveSettingsRequest = Omit<WorkshopSettings, 'id'>;
export interface LoginRequest { email: string; password: string; }
export interface ChangePasswordRequest { oldPassword: string; newPassword: string; }
export interface CreateUserRequest { name: string; email: string; password: string; role: string; }
