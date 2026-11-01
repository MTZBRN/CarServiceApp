import type {Appointment,Part,ServiceJob,Vehicle} from './domain';
export type Query = Record<string,string|number|undefined>;
export interface DashboardData {
 todayCount:number;activeCount:number;completedCount:number;inspectionCount:number;upcomingCount:number;lowCount:number;
 bookings:Appointment[];active:ServiceJob[];recent:ServiceJob[];inspections:Vehicle[];low:Part[];
}
