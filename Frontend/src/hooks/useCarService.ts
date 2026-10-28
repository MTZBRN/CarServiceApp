// Compatibility adapter for the existing dashboard/calendar/garage props.
import { useMemo, useState } from 'react';
import { useWorkshopResource } from '../data/useWorkshopData';
import { vehiclesApi } from '../api/vehicles';
import { appointmentsApi } from '../api/appointments';
import type { CalendarEvent } from '../types';
export const useCarService = () => {
  const { data: vehicles } = useWorkshopResource('vehicles');
  const { data: customers } = useWorkshopResource('customers');
  const { data: appointments } = useWorkshopResource('appointments');
  const [message, setMessage] = useState<string | null>(null);
  const calendarEvents = useMemo<CalendarEvent[]>(() => [
    ...appointments.map(app => ({ id: app.id, title: app.vehicle?.licensePlate || 'Ismeretlen jármű', tooltip: `Szerviz: ${app.note || '-'}\nAutó: ${app.vehicle?.make} ${app.vehicle?.model}`, start: new Date(app.startTime), end: new Date(app.endTime), allDay: false, type: 'service' as const, originalData: app, desc: app.note || app.vehicle?.customer?.name || '' })),
    ...vehicles.filter(v => v.motExpiry).map(v => ({ id: v.id, title: `Lejáró műszaki: ${v.licensePlate}`, tooltip: `MŰSZAKI LEJÁR: ${v.licensePlate}`, start: new Date(v.motExpiry!), end: new Date(v.motExpiry!), allDay: true, type: 'mot' as const, originalData: v })),
  ], [vehicles, appointments]);
  const deleteVehicle = async (id: number) => {
    if (!window.confirm('Biztosan törlöd?')) return false;
    try { await vehiclesApi.remove(id); return true; }
    catch { setMessage('Hiba a törléskor!'); return false; }
  };
  const deleteAppointment = async (id: number) => {
    try { await appointmentsApi.remove(id); setMessage('Időpont törölve!'); }
    catch { setMessage('Hiba a törléskor!'); }
  };
  return { vehicles, customers, appointments, calendarEvents, message, setMessage, deleteVehicle, deleteAppointment };
};
