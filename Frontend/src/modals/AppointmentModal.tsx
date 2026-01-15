import React, { useState, useEffect } from 'react';
import { apiService } from '../api/apiservice';
import { format } from 'date-fns';
import { Vehicle, Customer } from '../types';

interface Props {
    selectedSlot: Date | null;
    onClose: () => void;
    onSuccess: () => void;
    vehicles: Vehicle[];
    customers: Customer[];
    setMessage: (msg: string) => void;
}

const AppointmentModal: React.FC<Props> = ({ 
  selectedSlot, onClose, onSuccess, vehicles, customers, setMessage 
}) => {
  const [isNewCarMode, setIsNewCarMode] = useState(false);
  
  // Típusos state az űrlaphoz
  const [apptForm, setApptForm] = useState({
    vehicleId: '', 
    time: '08:00', 
    note: '',
    newLicense: '', newMake: '', newModel: '', newYear: 2024, newOwnerId: '',
    custName: '', custAddress: '', custPhone: '', custEmail: ''
  });

  useEffect(() => {
    if(customers.length > 0 && !apptForm.newOwnerId) {
        setApptForm(prev => ({...prev, newOwnerId: customers[0].id.toString()}));
    }
  }, [customers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Mentés...');

    if (!selectedSlot) return;

    try {
      let finalVehicleId = parseInt(apptForm.vehicleId);

      if (isNewCarMode) {
        let finalCustomerId = parseInt(apptForm.newOwnerId);

        if (apptForm.newOwnerId === 'NEW_CUSTOMER') {
          const newCustomerData = {
            name: apptForm.custName, address: apptForm.custAddress,
            phoneNumber: apptForm.custPhone, email: apptForm.custEmail
          };
          const custRes = await apiService.createCustomer(newCustomerData);
          finalCustomerId = custRes.data.id;
        }

        const newCarData = {
          licensePlate: apptForm.newLicense, make: apptForm.newMake, model: apptForm.newModel,
          year: Number(apptForm.newYear), customerId: finalCustomerId, motExpiry: null
        };
        const carRes = await apiService.createVehicle(newCarData);
        finalVehicleId = carRes.data.id;
      }

      const dateStr = format(selectedSlot, 'yyyy-MM-dd');
      const fullStartDate = `${dateStr}T${apptForm.time}:00`;

      await apiService.createAppointment({
        vehicleId: finalVehicleId, 
        startTime: fullStartDate, 
        endTime: fullStartDate, 
        note: apptForm.note
      });

      setMessage('Sikeres rögzítés! ✅');
      onSuccess();
      
    } catch (error) {
      console.error(error);
      setMessage('Hiba történt a mentéskor! ❌');
    }
  };

  // ... A JSX RÉSZ UGYANAZ MARAD, MINT A JS VERZIÓBAN, CSAK A KITERJESZTÉS .TSX ...
  // (Ide másold be a return (...) részt az előző válaszomból, az HTML, nem kell benne TypeScript változtatás)
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-dynamic" onClick={e => e.stopPropagation()}>
         {/* ... (A korábbi HTML kód ide jön) ... */}
         {/* Csak a TypeScript miatt a 'rows' attribútum number legyen, ne string */}
         {/* Az onChange eventeknél a 'e' típusa 'React.ChangeEvent<HTMLInputElement>' lenne, de a React alapból kikövetkezteti */}
          <button className="close-modal-btn" onClick={onClose}>✖</button>
          <h3>{isNewCarMode ? '✨ Új autó és időpont' : '📅 Időpont rögzítése'}</h3>
          <p style={{color: '#666'}}>Dátum: <strong>{selectedSlot?.toLocaleDateString()}</strong></p>

          <form onSubmit={handleSubmit} className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
             {/* ... UI GOMBOK ... */}
             <div style={{display: 'flex', gap: '10px'}}>
                 <button type="button" onClick={() => setIsNewCarMode(false)} style={{flex:1, padding:'10px', background: !isNewCarMode ? '#3498db' : '#eee', color: !isNewCarMode ? 'white' : '#333', border:'none', borderRadius:'5px'}}>Meglévő autó</button>
                 <button type="button" onClick={() => setIsNewCarMode(true)} style={{flex:1, padding:'10px', background: isNewCarMode ? '#27ae60' : '#eee', color: isNewCarMode ? 'white' : '#333', border:'none', borderRadius:'5px'}}>+ Új autó / Ügyfél</button>
             </div>

             <label>Kezdés: <input type="time" value={apptForm.time} onChange={e => setApptForm({...apptForm, time: e.target.value})} required style={{padding: '5px'}} /></label>

             {!isNewCarMode ? (
                <select value={apptForm.vehicleId} onChange={e => setApptForm({...apptForm, vehicleId: e.target.value})} required style={{padding:'10px'}}>
                  <option value="">-- Válassz autót --</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.licensePlate}</option>)}
                </select>
             ) : (
               <div style={{background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #ddd'}}>
                   <select value={apptForm.newOwnerId} onChange={e => setApptForm({...apptForm, newOwnerId: e.target.value})} style={{width: '100%', marginBottom: '10px', padding:'5px'}}>
                       {customers.map(c => <option key={c.id} value={c.id.toString()}>{c.name}</option>)}
                       <option value="NEW_CUSTOMER" style={{fontWeight: 'bold', color: 'green'}}>+ Új ügyfél</option>
                   </select>
                   
                   {apptForm.newOwnerId === 'NEW_CUSTOMER' && (
                       <div className="new-customer-box">
                           <input placeholder="Név" value={apptForm.custName} onChange={e => setApptForm({...apptForm, custName: e.target.value})} required style={{width:'95%', marginBottom:'5px'}} />
                           <input placeholder="Cím" value={apptForm.custAddress} onChange={e => setApptForm({...apptForm, custAddress: e.target.value})} required style={{width:'95%', marginBottom:'5px'}} />
                           <input placeholder="Telefon" value={apptForm.custPhone} onChange={e => setApptForm({...apptForm, custPhone: e.target.value})} required style={{width:'95%', marginBottom:'5px'}} />
                       </div>
                   )}
                   
                   <div style={{display:'flex', gap:'5px', marginTop:'10px'}}>
                       <input placeholder="Rendszám" value={apptForm.newLicense} onChange={e => setApptForm({...apptForm, newLicense: e.target.value})} required style={{flex:1}} />
                       <input placeholder="Márka" value={apptForm.newMake} onChange={e => setApptForm({...apptForm, newMake: e.target.value})} required style={{flex:1}} />
                       <input placeholder="Típus" value={apptForm.newModel} onChange={e => setApptForm({...apptForm, newModel: e.target.value})} required style={{flex:1}} />
                   </div>
               </div>
             )}

             <textarea placeholder="Megjegyzés..." value={apptForm.note} onChange={e => setApptForm({...apptForm, note: e.target.value})} rows={3} style={{padding:'10px'}} />
             
             <button type="submit" className="btn-add" style={{padding:'15px'}}>Mentés</button>
          </form>
      </div>
    </div>
  );
};

export default AppointmentModal;