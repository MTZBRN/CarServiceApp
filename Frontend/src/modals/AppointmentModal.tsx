import React, { useState } from 'react';
import { Vehicle, Customer } from '../types';
import { apiService } from '../api/apiservice';
import { Calendar, User, Car, Clock, FileText, CheckCircle } from 'lucide-react';

interface Props {
  selectedSlot: Date | null;
  onClose: () => void;
  onSuccess: () => void;
  vehicles: Vehicle[];
  customers: Customer[];
  setMessage: (msg: string) => void;
}

const AppointmentModal: React.FC<Props> = ({ selectedSlot, onClose, onSuccess, vehicles, customers, setMessage }) => {
  const [activeTab, setActiveTab] = useState<'existing' | 'new'>('existing'); // 'existing' vagy 'new'
  
  // Form State
  const [vehicleId, setVehicleId] = useState<number | string>('');
  const [newCustomer, setNewCustomer] = useState({ name: '', address: '', phoneNumber: '', email: '' });
  const [newVehicle, setNewVehicle] = useState({ licensePlate: '', make: '', model: '', year: new Date().getFullYear(), motExpiry: '' });
  
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState(selectedSlot ? selectedSlot.toTimeString().slice(0, 5) : '08:00');
  const [duration, setDuration] = useState(60); // percben

  const handleSave = async () => {
    if (!selectedSlot) return;
    setMessage('Mentés...');

    // Dátum összerakása
    const startDateTime = new Date(selectedSlot);
    const [hours, minutes] = startTime.split(':').map(Number);
    startDateTime.setHours(hours, minutes, 0, 0);

    const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

    try {
      let finalVehicleId = vehicleId;

      // Ha új autót/ügyfelet veszünk fel
      if (activeTab === 'new') {
        const custRes = await apiService.createCustomer(newCustomer);
        const createdCustomer = custRes.data;

        const vehData: any = { ...newVehicle, customerId: createdCustomer.id };
        if (!vehData.motExpiry) vehData.motExpiry = null;

        const vehRes = await apiService.createVehicle(vehData);
        finalVehicleId = vehRes.data.id;
      }

      // Időpont mentése
      await apiService.createAppointment({
        vehicleId: Number(finalVehicleId),
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        note: description,
        description: description
      });

      setMessage('Sikeres foglalás! ✅');
      onSuccess();
    } catch (error) {
      console.error(error);
      alert('Hiba történt a mentés során!');
      setMessage('Hiba történt!');
    }
  };

  return (
    <div className="modal-overlay modal-on-top" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="close-modal-btn" onClick={onClose}>✖</button>
        
        <div style={{borderBottom: '1px solid var(--border-color)', marginBottom: '20px', paddingBottom: '10px'}}>
            <h2 style={{margin: 0, display: 'flex', alignItems: 'center', gap: '10px'}}>
                <Calendar color="var(--accent-blue)" /> Új időpont
            </h2>
            <p style={{margin: '5px 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem'}}>
                {selectedSlot?.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            </p>
        </div>

        {/* FÜLEK (TABS) - STITCH STYLE */}
        <div style={{display: 'flex', background: 'var(--bg-input)', padding: '4px', borderRadius: '8px', marginBottom: '20px'}}>
            <button 
                onClick={() => setActiveTab('existing')}
                style={{
                    flex: 1, padding: '8px', borderRadius: '6px', border: 'none', 
                    background: activeTab === 'existing' ? 'var(--bg-card)' : 'transparent',
                    color: activeTab === 'existing' ? 'white' : 'var(--text-muted)',
                    boxShadow: activeTab === 'existing' ? '0 2px 4px rgba(0,0,0,0.2)' : 'none'
                }}
            >
                Meglévő autó
            </button>
            <button 
                onClick={() => setActiveTab('new')}
                style={{
                    flex: 1, padding: '8px', borderRadius: '6px', border: 'none',
                    background: activeTab === 'new' ? 'var(--bg-card)' : 'transparent',
                    color: activeTab === 'new' ? 'white' : 'var(--text-muted)',
                    boxShadow: activeTab === 'new' ? '0 2px 4px rgba(0,0,0,0.2)' : 'none'
                }}
            >
                + Új autó / Ügyfél
            </button>
        </div>

        {/* TARTALOM */}
        <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
            
            {activeTab === 'existing' ? (
                <div>
                    <label><Car size={14} style={{display:'inline', marginRight:5}}/> Válassz autót</label>
                    <select 
                        value={vehicleId} 
                        onChange={e => setVehicleId(e.target.value)}
                        style={{width: '100%', padding: '12px', fontSize: '1rem'}}
                    >
                        <option value="">-- Válassz a listából --</option>
                        {vehicles.map(v => (
                            <option key={v.id} value={v.id}>
                                {v.licensePlate} ({v.make} {v.model}) - {v.customer?.name}
                            </option>
                        ))}
                    </select>
                </div>
            ) : (
                <div className="inset-box" style={{borderLeft: '3px solid var(--accent-green)'}}>
                    <h4 style={{marginTop: 0, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 5}}><User size={16}/> Új Ügyfél Adatai</h4>
                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px'}}>
                        <input placeholder="Név" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} />
                        <input placeholder="Telefon" value={newCustomer.phoneNumber} onChange={e => setNewCustomer({...newCustomer, phoneNumber: e.target.value})} />
                    </div>
                    
                    <h4 style={{marginTop: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 5}}><Car size={16}/> Autó Adatai</h4>
                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px'}}>
                        <input placeholder="Rendszám" value={newVehicle.licensePlate} onChange={e => setNewVehicle({...newVehicle, licensePlate: e.target.value})} />
                        <input placeholder="Márka" value={newVehicle.make} onChange={e => setNewVehicle({...newVehicle, make: e.target.value})} />
                        <input placeholder="Típus" value={newVehicle.model} onChange={e => setNewVehicle({...newVehicle, model: e.target.value})} />
                    </div>
                </div>
            )}

            <div style={{display: 'flex', gap: '15px'}}>
                <div style={{flex: 1}}>
                    <label><Clock size={14} style={{display:'inline', marginRight:5}}/> Kezdés</label>
                    <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                </div>
                <div style={{flex: 1}}>
                    <label><Clock size={14} style={{display:'inline', marginRight:5}}/> Hossz (perc)</label>
                    <select value={duration} onChange={e => setDuration(Number(e.target.value))}>
                        <option value={30}>30 perc</option>
                        <option value={60}>1 óra</option>
                        <option value={90}>1.5 óra</option>
                        <option value={120}>2 óra</option>
                        <option value={180}>3 óra</option>
                        <option value={240}>4 óra</option>
                    </select>
                </div>
            </div>

            <div>
                <label><FileText size={14} style={{display:'inline', marginRight:5}}/> Megjegyzés / Munka leírása</label>
                <textarea 
                    rows={3} 
                    value={description} 
                    onChange={e => setDescription(e.target.value)} 
                    placeholder="Pl. Olajcsere, fékvizsgálat..."
                />
            </div>

            <button 
                onClick={handleSave} 
                className="btn-add" 
                style={{marginTop: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px'}}
            >
                <CheckCircle size={18} /> Foglalás Mentése
            </button>
        </div>
      </div>
    </div>
  );
};

export default AppointmentModal;