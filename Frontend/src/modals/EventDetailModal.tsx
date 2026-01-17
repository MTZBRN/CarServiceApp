import React from 'react';
import { CalendarEvent } from '../types';
import { Trash2, Wrench, X, Calendar, User, Clock, FileText } from 'lucide-react';

interface Props {
  event: CalendarEvent | null;
  onClose: () => void;
  onDelete: (id: number) => void;
  onOpenWorksheet: (id: number) => void;
}

const EventDetailModal: React.FC<Props> = ({ event, onClose, onDelete, onOpenWorksheet }) => {
  if (!event) return null;

  return (
    <div className="modal-overlay modal-on-top" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth: '450px'}}>
        <button className="close-modal-btn" onClick={onClose}><X size={20} /></button>

        {/* FEJLÉC */}
        <div style={{borderBottom: '1px solid var(--border-color)', marginBottom: '15px', paddingBottom: '10px'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                <div style={{
                    width: '40px', height: '40px', borderRadius: '8px', 
                    background: event.type === 'mot' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    color: event.type === 'mot' ? '#ef4444' : '#3b82f6'
                }}>
                    {event.type === 'mot' ? '⚠️' : '🔧'}
                </div>
                <div>
                    <h2 style={{margin: 0, fontSize: '1.2rem'}}>{event.title}</h2>
                    <span style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>{event.type === 'mot' ? 'Műszaki Vizsga' : 'Szerviz Időpont'}</span>
                </div>
            </div>
        </div>

        {/* ADATOK LISTÁJA */}
        <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
            
            <div className="inset-box">
                <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px'}}>
                    <Clock size={16} color="var(--accent-blue)"/>
                    <strong>Időpont:</strong>
                    <span>
                        {event.start.toLocaleDateString()} {event.start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} 
                        - {event.end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                </div>
                
                {event.desc && (
                    <div style={{display: 'flex', alignItems: 'start', gap: '10px', marginTop: '10px'}}>
                        <User size={16} color="var(--accent-green)" style={{marginTop: 3}}/>
                        <div>
                            <strong>Ügyfél / Leírás:</strong>
                            <p style={{margin: '2px 0 0 0', color: 'var(--text-muted)'}}>{event.desc}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* GOMBOK */}
            <div style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
                {event.type === 'service' && event.id && (
                    <button 
                        onClick={() => onOpenWorksheet(event.id!)} 
                        className="btn-add"
                        style={{background: 'var(--accent-yellow)', color: 'black', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'}}
                    >
                        <Wrench size={18} /> Munkalap
                    </button>
                )}
                
                <button 
                    onClick={() => { if(window.confirm('Biztosan törlöd?')) onDelete(event.id!); onClose(); }} 
                    className="btn-delete"
                    style={{padding: '12px', flex: event.type === 'service' ? 0.3 : 1, display: 'flex', justifyContent: 'center', alignItems: 'center'}}
                >
                    <Trash2 size={18} /> {event.type !== 'service' && "Törlés"}
                </button>
            </div>

        </div>
      </div>
    </div>
  );
};

export default EventDetailModal;