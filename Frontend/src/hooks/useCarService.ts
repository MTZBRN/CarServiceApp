// Compatibility adapter for the existing dashboard/calendar/garage props.
import { useState } from 'react';
import { useWorkshopResource } from '../data/useWorkshopData';
import { vehiclesApi } from '../api/vehicles';
export const useCarService = () => {
  const { data: vehicles } = useWorkshopResource('vehicles');
  const { data: customers } = useWorkshopResource('customers');
  const { data: appointments } = useWorkshopResource('appointments');
  const [message, setMessage] = useState<string | null>(null);
  const deleteVehicle = async (id: number) => {
    if (!window.confirm('Biztosan törlöd?')) return false;
    try { await vehiclesApi.remove(id); return true; }
    catch { setMessage('Hiba a törléskor!'); return false; }
  };
  return { vehicles, customers, appointments, message, setMessage, deleteVehicle };
};
