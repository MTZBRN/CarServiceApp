import React, { useState, useCallback } from 'react';
import './App.css';

// Ikonok (Lucide React)
import { Calendar as CalIcon, Car, User, AlertTriangle, Search, Trash2, History, Wrench, Plus } from 'lucide-react';

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
import {hu }from 'date-fns/locale/hu';
import 'react-big-calendar/lib/css/react-big-calendar.css';

// Komponensek
import AppointmentModal from './modals/AppointmentModal';
import EventDetailModal from './modals/EventDetailModal';
import WorksheetModal from './modals/WorksheetModal';
import VehicleHistoryModal from './modals/VehicleHistoryModal';
import AddVehicleModal from './modals/AddVehicleModal';

const locales = { 'hu': hu };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

function App() {
  const { 
    vehicles, customers, appointments, calendarEvents, message, setMessage, 
    refreshAll, deleteVehicle, deleteAppointment 
  } = useCarService();

  // --- STATEK ---
  const [date, setDate] = useState<Date>(new Date());
  const [view, setView] = useState<View>('month');
  const [showBigCalendar, setShowBigCalendar] = useState(false);
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  
  // Modálok state-jei
  const [showApptModal, setShowApptModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const [showWorksheetModal, setShowWorksheetModal] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<number | null>(null);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyVehicle, setHistoryVehicle] = useState<{id: number, plate: string} | null>(null);

  // Bal oldali űrlap és keresés
  const [form, setForm] = useState({ 
    licensePlate: '', make: '', model: '', year: 2024, customerId: '', motExpiry: '' 
  });
  const [searchTerm, setSearchTerm] = useState('');

  // --- FÜGGVÉNYEK ---

  const onNavigate = useCallback((newDate: Date) => setDate(newDate), [setDate]);
  const onView = useCallback((newView: View) => setView(newView), [setView]);

  const handleSelectSlot = ({ start }: SlotInfo) => {
    setSelectedSlot(start as Date);
    setShowApptModal(true);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  };

  const handleOpenWorksheet = (apptId: number) => {
      setSelectedAppointmentId(apptId);
      setShowEventModal(false);
      setShowWorksheetModal(true);
  };

  const handleOpenHistory = (id: number, plate: string) => {
    setHistoryVehicle({ id, plate });
    setShowHistoryModal(true);
  };

  const handleMainSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Mentés...');
    const d: any = { ...form };
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

  // Keresés logika
  const filteredVehicles = vehicles.filter(v => {
      const search = searchTerm.toLowerCase();
      const plate = v.licensePlate.toLowerCase();
      const owner = v.customer?.name.toLowerCase() || '';
      return plate.includes(search) || owner.includes(search);
  });

  const eventStyleGetter = (ev: CalendarEvent) => ({
    style: {
      backgroundColor: ev.type === 'mot' ? '#ef4444' : '#3b82f6',
      borderRadius: '4px', opacity: 0.9, color: 'white', display: 'block', border: 'none'
    }
  });

return (
    <div className="container">
      {/* HEADER: Kisebb, kompaktabb */}
      <div className="header" style={{marginBottom: '20px', paddingBottom: '15px'}}>
        <h1 style={{fontSize: '1.5rem'}}>GTA Szerviz 🚘</h1>
        
        {/* A STATISZTIKA MOST A HEADERBEN VAN (Mini kártyák) */}
        <div style={{display: 'flex', gap: '15px'}}>
            <div className="mini-stat">
                <span className="mini-stat-label">📅 Ma:</span>
                <span className="mini-stat-value">{appointments.filter(a => new Date(a.startTime).toDateString() === new Date().toDateString()).length}</span>
            </div>
            <div className="mini-stat" style={{borderColor: '#ef4444'}}>
                <span className="mini-stat-label" style={{color: '#ef4444'}}>⚠️ Lejárt:</span>
                <span className="mini-stat-value" style={{color: '#ef4444'}}>{vehicles.filter(v => getStatusColor(v.motExpiry) === '#ffcccc').length}</span>
            </div>
        </div>
      </div>

      <div className="dashboard-layout" style={{height: 'calc(100vh - 100px)'}}> {/* Teljes magasság! */}
        
        {/* --- BAL OSZLOP: Csak a lista és a kereső --- */}
        <div className="main-content" style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
          
          {/* A KÁRTYA MOST MÁR KITÖLTI A BAL SÁVOT */}
          {/* A KÁRTYA CSS-e most már kezeli a felosztást */}
          <div className="card" style={{padding: 0}}> 
            
            {/* 1. FEJLÉC SZEKCIÓ (Gomb + Kereső) */}
            <div className="card-header-section">
                <button 
                    onClick={() => setShowAddVehicleModal(true)} 
                    style={{
                        width: '100%', 
                        padding: '12px', 
                        background: 'var(--accent-blue)', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '6px', 
                        fontSize: '1rem', 
                        marginBottom: '15px',
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        gap: '8px'
                    }}>
                    <Plus size={18} /> Új Jármű Felvétele
                </button>

                <div style={{position: 'relative'}}>
                    <Search size={16} style={{position: 'absolute', left: '12px', top: '12px', color: '#666'}} />
                    <input 
                        type="text" 
                        placeholder="Keresés..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{paddingLeft: '35px', background: '#27272a', border: '1px solid #3f3f46'}}
                    />
                </div>
            </div>

            {/* 2. LISTA SZEKCIÓ (Görgethető) */}
            <div className="card-list-section">
                <div className="vehicle-list-header">Garázs ({filteredVehicles.length})</div>
                <ul className="vehicle-list">
                  {/* ... itt jön a .map(...) rész, az maradhat a régi ... */}
                  {filteredVehicles.map(v => {
                      /* ... a lista renderelés kódja ... */
                      const statusColor = getStatusColor(v.motExpiry);
                      let statusText = "OK";
                      let statusIcon = <div style={{width: 6, height: 6, borderRadius: '50%', background: '#10b981'}}></div>;
                      
                      if (statusColor === '#ffcccc') { 
                          statusText = "Lejárt"; 
                          statusIcon = <AlertTriangle size={12} color="#ef4444" />;
                      } else if (statusColor === '#fff3cd') { 
                          statusText = "Hamarosan"; 
                          statusIcon = <AlertTriangle size={12} color="#f59e0b" />;
                      }

                      return (
                        <li key={v.id} className="stitch-vehicle-card">
                          <div className="vehicle-icon-box">
                              <Car size={20} color="#e4e4e7" />
                          </div>
                          <div className="vehicle-info">
                              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                  <span className="plate-number">{v.licensePlate}</span>
                              </div>
                              <div className="owner-name">
                                  {v.customer?.name || '-'}
                              </div>
                          </div>
                          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px'}}>
                              <div className={`status-badge ${statusColor === '#ffcccc' ? 'badge-red' : statusColor === '#fff3cd' ? 'badge-yellow' : 'badge-green'}`} style={{padding: '2px 6px', fontSize: '0.65rem'}}>
                                  {statusIcon}
                                  <span>{statusText}</span>
                              </div>
                              <div className="action-buttons">
                                  <button onClick={() => handleOpenHistory(v.id, v.licensePlate)} className="icon-btn"><History size={18} /></button>
                                  <button onClick={() => deleteVehicle(v.id)} className="icon-btn delete-btn"><Trash2 size={18} /></button>
                              </div>
                          </div>
                        </li>
                      );
                  })}
                </ul>
            </div>
          </div>
        </div>

        {/* --- JOBB OSZLOP: NAPTÁR --- */}
        <div className="sidebar" style={{height: '100%'}}>
          <div className="calendar-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CalIcon size={20} color="#3b82f6"/> Naptár
              </h3>
              <button onClick={() => setShowBigCalendar(true)} style={{ background: '#27272a', color: 'white', border: '1px solid #3f3f46', padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px' }}>⛶ Nagyítás</button>
            </div>
            <Calendar
              selectable
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              localizer={localizer}
              events={calendarEvents}
              style={{ flex: 1 }} // Kitölti a maradék helyet
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

      {/* MODÁLOK */}
      {showAddVehicleModal && (
          <AddVehicleModal 
            customers={customers} 
            onClose={() => setShowAddVehicleModal(false)}
            onSuccess={() => { setShowAddVehicleModal(false); refreshAll(); }}
          />
      )}
      
      {/* ... A többi modal marad (showApptModal, showEventModal, stb.) ... */}
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
            onOpenWorksheet={handleOpenWorksheet}
        />
      )}

      {showWorksheetModal && selectedAppointmentId && (
          <WorksheetModal
              appointmentId={selectedAppointmentId}
              vehicleName={calendarEvents.find(e => e.id === selectedAppointmentId)?.title || "Jármű"}
              onClose={() => setShowWorksheetModal(false)}
              onSave={() => { setShowWorksheetModal(false); refreshAll(); }}
          />
      )}
      
      {showHistoryModal && historyVehicle && (
          <VehicleHistoryModal
              vehicleId={historyVehicle.id}
              vehiclePlate={historyVehicle.plate}
              onClose={() => setShowHistoryModal(false)}
          />
      )}

      {showBigCalendar && (
        <div className="modal-overlay" onClick={() => setShowBigCalendar(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{width: '90vw', height: '85vh', maxWidth: '1400px'}}>
            <button className="close-modal-btn" onClick={() => setShowBigCalendar(false)}>✖</button>
            <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Szerviz Naptár</h2>
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