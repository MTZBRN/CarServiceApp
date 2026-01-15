import React from 'react';
import { CalendarEvent, Appointment, Vehicle } from '../types';

// Definiáljuk, milyen adatokat vár a komponens (Props)
interface Props {
    event: CalendarEvent | null;
    onClose: () => void;
    onDelete: (id: number) => void;
}

const EventDetailModal: React.FC<Props> = ({ event, onClose, onDelete }) => {
  if (!event) return null;

  // Típusellenőrzés segédfüggvények
  const isAppointment = (data: any): data is Appointment => event.type === 'service';
  const isVehicle = (data: any): data is Vehicle => event.type === 'mot';

  const handleDeleteClick = () => {
    if (event.type === 'mot') {
      alert("A műszaki vizsga jelzést az autó adatlapján tudod módosítani!");
      return;
    }
    // Itt biztosak lehetünk benne, hogy van ID, ha service típusú
    if (event.id && window.confirm(`Biztosan törlöd ezt az időpontot?\n${event.title}`)) {
      onDelete(event.id);
      onClose();
    }
  };

  // Az originalData típusa lehet Appointment vagy Vehicle. Kasztolnunk kell.
  const appData = isAppointment(event.originalData) ? event.originalData : null;
  
  return (
    <div className="modal-overlay modal-on-top" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '400px', height: 'auto' }} onClick={e => e.stopPropagation()}>
        <button className="close-modal-btn" onClick={onClose}>✖</button>

        <h3 style={{ marginTop: 0, color: event.type === 'mot' ? '#e74c3c' : '#3174ad' }}>
          {event.title}
        </h3>

        <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
          <p><strong>Kezdés:</strong> {event.start.toLocaleString()}</p>

          {event.type === 'service' && appData && (
            <>
              <p><strong>Autó:</strong> {appData.vehicle?.make} {appData.vehicle?.model}</p>
              <p><strong>Leírás:</strong> {appData.note || appData.description || '-'}</p>
            </>
          )}

          {event.type === 'mot' && (
            <p style={{ color: 'red', fontWeight: 'bold' }}>Ez egy automatikus figyelmeztetés.</p>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '5px', border: '1px solid #ddd', background: 'blue', cursor: 'pointer' }}>
            Bezárás
          </button>

          {event.type === 'service' && (
            <button onClick={handleDeleteClick} style={{ padding: '10px 20px', borderRadius: '5px', border: 'none', background: '#e74c3c', color: 'white', cursor: 'pointer' }}>
              Törlés 🗑️
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventDetailModal;