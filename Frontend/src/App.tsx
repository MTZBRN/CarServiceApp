import React, { useState, useCallback } from 'react';
import './App.css';

// Hook és API
import { useCarService } from './hooks/useCarService';
import { apiService } from './api/apiservice';
import { CalendarEvent } from './types';

// Naptár cuccok
import { Calendar, dateFnsLocalizer, View, SlotInfo } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import {startOfWeek} from 'date-fns/startOfWeek';
import {getDay} from 'date-fns/getDay';
import {hu} from 'date-fns/locale/hu';
import 'react-big-calendar/lib/css/react-big-calendar.css';

// Komponensek
import AppointmentModal from './modals/AppointmentModal';
import EventDetailModal from './modals/EventDetailModal';

const locales = { 'hu': hu };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

function App() {
  // A logikát behúzzuk a Hookból
  const { 
    vehicles, customers, calendarEvents, message, setMessage, 
    refreshAll, deleteVehicle, deleteAppointment 
  } = useCarService();

  // Statek típusossá tétele
  const [date, setDate] = useState<Date>(new Date());
  const [view, setView] = useState<View>('month');
  const [showBigCalendar, setShowBigCalendar] = useState(false);
  
  const [showApptModal, setShowApptModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const [form, setForm] = useState({ 
    licensePlate: '', make: '', model: '', year: 2024, customerId: '', motExpiry: '' 
  });

  const onNavigate = useCallback((newDate: Date) => setDate(newDate), [setDate]);
  const onView = useCallback((newView: View) => setView(newView), [setView]);

  // A react-big-calendar SlotInfo típust ad vissza
  const handleSelectSlot = ({ start }: SlotInfo) => {
    setSelectedSlot(start as Date);
    setShowApptModal(true);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  };

  const handleMainSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Mentés...');
    const d: any = { ...form }; // 'any' használata ideiglenesen a motExpiry null kezelése miatt
    if (!d.motExpiry) d.motExpiry = null;
    
    try {
      await apiService.createVehicle(d);
      setMessage('Sikeres mentés! ✅');
      refreshAll();
      setForm({ licensePlate: '', make: '', model: '', year: 2024, customerId: '', motExpiry: '' });
      setTimeout(() => setMessage(''), 3000);
    } catch { setMessage('Hiba!'); }
  };

  const getStatusColor = (d: string | null | undefined) => {
    if (!d) return '#fff';
    const days = (new Date(d).getTime() - new Date().getTime()) / 86400000;
    return days < 0 ? '#ffcccc' : days < 30 ? '#fff3cd' : '#d4edda';
  };

  const eventStyleGetter = (ev: CalendarEvent) => ({
    style: {
      backgroundColor: ev.type === 'mot' ? '#e74c3c' : '#3174ad',
      borderRadius: '4px', opacity: 0.8, color: 'white', display: 'block'
    }
  });

  return (
    <div className="container">
      {/* ... A HTML RÉSZ UGYANAZ MARAD, MINT A KORÁBBI VÁLASZBAN ... */}
      <div className="header">
        <h1>GTA Szervíz 🚘</h1>
        {message && <span className="status-msg">{message}</span>}
      </div>

      <div className="dashboard-layout">
        <div className="main-content">
          <div className="card">
            <h3>Gyors autó felvétel</h3>
            <form onSubmit={handleMainSubmit} className="form-group">
              <div style={{ gridColumn: 'span 2' }}>
                <select name="customerId" value={form.customerId} onChange={e => setForm({...form, customerId: e.target.value})} style={{ width: '100%' }}>
                    {customers.length === 0 && <option>Betöltés...</option>}
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <input placeholder="Rendszám" value={form.licensePlate} onChange={e => setForm({...form, licensePlate: e.target.value})} required />
              <input placeholder="Márka" value={form.make} onChange={e => setForm({...form, make: e.target.value})} required />
              <input placeholder="Típus" value={form.model} onChange={e => setForm({...form, model: e.target.value})} required />
              <input type="number" placeholder="Év" value={form.year} onChange={e => setForm({...form, year: parseInt(e.target.value)})} required />
              <input type="date" value={form.motExpiry} onChange={e => setForm({...form, motExpiry: e.target.value})} />
              <button type="submit" className="btn-add">Hozzáadás (+)</button>
            </form>
          </div>
          
          <div className="card">
            <h3>Garázs ({vehicles.length})</h3>
            <ul className="vehicle-list">
              {vehicles.map(v => (
                <li key={v.id} className="vehicle-item" style={{ backgroundColor: getStatusColor(v.motExpiry), padding: '10px', borderRadius: '8px', marginBottom: '5px' }}>
                  <div>
                      <strong>{v.licensePlate}</strong> — {v.make} {v.model}<br />
                      <span style={{ fontSize: '0.8rem' }}>📅 Műszaki: {v.motExpiry ? new Date(v.motExpiry).toLocaleDateString() : '-'}</span>
                  </div>
                  <button onClick={() => deleteVehicle(v.id)} className="btn-delete">Törlés</button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="sidebar">
          <div className="calendar-card" style={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0 }}>📅 Naptár</h3>
              <button onClick={() => setShowBigCalendar(true)} style={{ background: '#34495e', color: 'white', padding: '5px 10px', fontSize: '0.8rem' }}>⛶ Nagyítás</button>
            </div>
            <Calendar
              selectable
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              localizer={localizer}
              events={calendarEvents}
              style={{ height: '100%' }}
              culture='hu'
              eventPropGetter={eventStyleGetter}
              popup
              tooltipAccessor="tooltip"
              date={date} onNavigate={onNavigate} view='month' onView={() => { }}
              messages={{ next: ">", previous: "<", today: "Ma", month: "Hó", week: "Hét", day: "Nap", showMore: t => `+${t}` }}
            />
          </div>
        </div>
      </div>

      {showApptModal && (
        <AppointmentModal
          selectedSlot={selectedSlot}
          onClose={() => setShowApptModal(false)}
          onSuccess={() => { setShowApptModal(false); refreshAll(); }}
          vehicles={vehicles}
          customers={customers}
          setMessage={setMessage}
        />
      )}

      {showEventModal && (
        <EventDetailModal
            event={selectedEvent}
            onClose={() => setShowEventModal(false)}
            onDelete={deleteAppointment}
        />
      )}

      {showBigCalendar && (
        <div className="modal-overlay" onClick={() => setShowBigCalendar(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-modal-btn" onClick={() => setShowBigCalendar(false)}>✖</button>
            <h2 style={{ textAlign: 'center' }}>Szerviz Naptár - Teljes nézet</h2>
            <Calendar
              selectable
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              localizer={localizer}
              events={calendarEvents}
              style={{ height: '100%' }}
              culture='hu'
              eventPropGetter={eventStyleGetter}
              popup
              tooltipAccessor="tooltip"
              date={date} onNavigate={onNavigate} view={view} onView={onView}
              messages={{ next: "Következő", previous: "Előző", today: "Ma", month: "Hónap", week: "Hét", day: "Nap", showMore: t => `+${t} további` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;