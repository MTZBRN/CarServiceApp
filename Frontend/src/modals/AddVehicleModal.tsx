import React, { useState } from 'react';
import { apiService } from '../api/apiservice';
import { Customer } from '../types';

interface Props {
    customers: Customer[];
    onClose: () => void;
    onSuccess: () => void;
}

const AddVehicleModal: React.FC<Props> = ({ customers, onClose, onSuccess }) => {
    const [form, setForm] = useState({ 
        licensePlate: '', make: '', model: '', year: new Date().getFullYear(), customerId: '', motExpiry: '' 
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const d: any = { ...form };
        if (!d.motExpiry) d.motExpiry = null;
        try {
            await apiService.createVehicle(d);
            onSuccess();
        } catch (err) {
            alert('Hiba történt mentéskor!');
        }
    };

    return (
        <div className="modal-overlay modal-on-top" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="close-modal-btn" onClick={onClose}>✖</button>
                <h2 style={{marginTop: 0}}>✨ Új Jármű Felvétele</h2>
                
                <form onSubmit={handleSubmit} className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                    <div>
                        <label>Ügyfél</label>
                        <select value={form.customerId} onChange={e => setForm({...form, customerId: e.target.value})} style={{width: '100%'}} required>
                            <option value="">Válassz ügyfelet...</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    
                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
                        <div>
                            <label>Rendszám</label>
                            <input placeholder="ABC-123" value={form.licensePlate} onChange={e => setForm({...form, licensePlate: e.target.value})} required />
                        </div>
                        <div>
                            <label>Évjárat</label>
                            <input type="number" value={form.year} onChange={e => setForm({...form, year: parseInt(e.target.value)})} required />
                        </div>
                    </div>

                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
                        <div>
                            <label>Márka</label>
                            <input placeholder="Pl. Toyota" value={form.make} onChange={e => setForm({...form, make: e.target.value})} required />
                        </div>
                        <div>
                            <label>Típus</label>
                            <input placeholder="Pl. Corolla" value={form.model} onChange={e => setForm({...form, model: e.target.value})} required />
                        </div>
                    </div>

                    <div>
                        <label>Műszaki érvényessége</label>
                        <input type="date" value={form.motExpiry} onChange={e => setForm({...form, motExpiry: e.target.value})} />
                    </div>

                    <button type="submit" className="btn-add" style={{marginTop: '10px'}}>Mentés</button>
                </form>
            </div>
        </div>
    );
};

export default AddVehicleModal;