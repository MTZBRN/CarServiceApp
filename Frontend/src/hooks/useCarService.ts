import { useState, useEffect, useCallback } from "react";
import { apiService } from "../api/apiService";
import { Vehicle, Customer, Appointment, CalendarEvent } from "../types";

export const useCarService = (enabled = true) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const refreshAll = useCallback(() => {
    if (!enabled) return;
    return Promise.all([
      apiService.getVehicles(),
      apiService.getCustomers(),
      apiService.getAppointments(),
    ])
      .then(([vehRes, custRes, apptRes]) => {
        setVehicles(vehRes.data);
        setCustomers(custRes.data);
        setAppointments(apptRes.data);
      })
      .catch((err) => {
        console.error(err);
        setMessage("Hiba az adatok betöltésekor!");
      });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) { setVehicles([]); setCustomers([]); setAppointments([]); return; }
    refreshAll();
    const refresh = () => { void refreshAll(); };
    window.addEventListener("business-data-updated", refresh);
    return () => window.removeEventListener("business-data-updated", refresh);
  }, [refreshAll, enabled]);

  useEffect(() => {
    const serviceEvents: CalendarEvent[] = appointments.map((app) => ({
      id: app.id,
      title: app.vehicle ? app.vehicle.licensePlate : "Ismeretlen jármű",
      tooltip: `Szerviz: ${app.note || app.description || "-"}\nAutó: ${app.vehicle?.make} ${app.vehicle?.model}`,
      start: new Date(app.startTime),
      end: new Date(app.endTime),
      allDay: false,
      type: "service",
      originalData: app,
      desc: app.note || app.vehicle?.customer?.name || "",
    }));
    const motEvents: CalendarEvent[] = vehicles
      .filter((v) => v.motExpiry) // Csak ha van dátum
      .map((v) => ({
        id: v.id, // Opcionális
        title: `Lejáró műszaki: ${v.licensePlate}`,
        tooltip: `MŰSZAKI LEJÁR: ${v.licensePlate}`,
        start: new Date(v.motExpiry!), // A ! jelet használjuk, mert a filterrel már ellenőriztük
        end: new Date(v.motExpiry!),
        allDay: true,
        type: "mot",
        originalData: v,
      }));

    setCalendarEvents([...serviceEvents, ...motEvents]);
  }, [vehicles, appointments]);

  const deleteVehicle = async (id: number) => {
    if (!window.confirm("Biztosan törlöd?")) return;
    try {
      await apiService.deleteVehicle(id);
      refreshAll();
    } catch (e) {
      console.error(e);
      setMessage("Hiba a törléskor!");
    }
  };

  const deleteAppointment = async (id: number) => {
    try {
      await apiService.deleteAppointment(id);
      setMessage("Időpont törölve!");
      refreshAll();
    } catch (e) {
      console.error(e);
      setMessage("Hiba a törléskor!");
    }
  };

  return {
    vehicles,
    customers,
    appointments,
    calendarEvents,
    message,
    setMessage,
    refreshAll,
    deleteVehicle,
    deleteAppointment,
  };
};
