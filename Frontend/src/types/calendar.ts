import type { Appointment, Vehicle } from './domain';
interface EventBase { id: number; title: string; tooltip?: string; start: Date; end: Date; allDay?: boolean; desc?: string; }
export type CalendarEvent = EventBase & ({ type: 'service'; originalData: Appointment } | { type: 'mot'; originalData: Vehicle });
