import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../../api/apiservice';
import { JobPart, Part } from '../../types';
import { X, Save, Plus, Trash2, Wrench, Package, ArrowDownCircle, Save as SaveIcon, Printer } from 'lucide-react';

import { useReactToPrint } from 'react-to-print';
import { PrintableWorksheet } from '../print/PrintableWorkSheet'; // Ellenőrizd a fájlnevet (kis/nagybetű)!

interface Props {
  appointmentId: number;
  vehicleName: string;
  onClose: () => void;
  onSave: () => void;
}

const WorksheetModal: React.FC<Props> = ({ appointmentId, vehicleName, onClose, onSave }) => {
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState('');
  const [laborCost, setLaborCost] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  
  const [jobParts, setJobParts] = useState<JobPart[]>([]);
  const [inventory, setInventory] = useState<Part[]>([]);

  // ÚJ MEZŐK: Cikkszám (partNumber) és a Jelölőnégyzet (saveToInventory)
  const [newItem, setNewItem] = useState({ name: '', quantity: 1, unitPrice: 0, partNumber: '' });
  const [saveToInventory, setSaveToInventory] = useState(false);

  // --- NYOMTATÁS HOOK (Fontos: Ez a komponens tetején legyen!) ---
  const printRef = useRef<HTMLDivElement>(null);
  
  const handlePrint = useReactToPrint({
    contentRef: printRef, 
    documentTitle: `Munkalap_${appointmentId}`,
  });
  // -------------------------------------------------------------

  useEffect(() => {
    loadData();
  }, [appointmentId]);

  const loadData = async () => {
    try {
      const res = await apiService.getServiceJob(appointmentId);
      if (res.data) {
        setDescription(res.data.description || '');
        setLaborCost(res.data.laborCost || 0);
        setIsCompleted(res.data.isCompleted || false);
        setJobParts(res.data.jobParts || []);
      }
      
      const partsRes = await apiService.getParts();
      setInventory(partsRes.data);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItem.name) return;

    // --- 1. MENTÉS A CIKKTÖRZSBE (Ha pipálva van) ---
    if (saveToInventory) {
        // ELLENŐRZÉS: Létezik már ez a cikkszám?
        const alreadyExists = inventory.find(p => 
            p.partNumber.toLowerCase() === newItem.partNumber.toLowerCase()
        );

        if (alreadyExists) {
            alert(`Figyelem: A(z) "${newItem.partNumber}" cikkszám már szerepel a törzsben! \n\nNem hoztam létre újat, de a munkalapra felvettem a tételt.`);
        } else {
            // HA MÉG NEM LÉTEZIK: Mentés
            try {
                const gross = newItem.unitPrice;
                const net = Math.round(gross / 1.27);
                const pNum = newItem.partNumber || `AUTO-${Date.now().toString().slice(-6)}`;

                await apiService.createPart({
                    name: newItem.name,
                    partNumber: pNum,
                    grossPrice: gross,
                    netPrice: net,
                    stockQuantity: 0
                });
                
                // Lista frissítése a háttérben
                const updatedInv = await apiService.getParts();
                setInventory(updatedInv.data);
                
            } catch (err) {
                alert('Hiba történt a Cikktörzsbe mentéskor.');
            }
        }
    }

    // --- 2. HOZZÁADÁS A MUNKAALAPHOZ ---
    const part: JobPart = {
        itemName: newItem.name,
        quantity: newItem.quantity,
        unitPrice: newItem.unitPrice,
        id: 0,
        partNumber: newItem.partNumber,
        partName: newItem.name
    };
    
    setJobParts([...jobParts, part]);
    
    // Resetelés
    setNewItem({ name: '', quantity: 1, unitPrice: 0, partNumber: '' });
    setSaveToInventory(false);
  };

  const handleRemoveItem = (index: number) => {
    const updated = [...jobParts];
    updated.splice(index, 1);
    setJobParts(updated);
  };

  const handleSelectFromInventory = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const partId = parseInt(e.target.value);
      if (!partId) return;

      const selectedPart = inventory.find(p => p.id === partId);
      if (selectedPart) {
          setNewItem({
              name: selectedPart.name,
              partNumber: selectedPart.partNumber,
              quantity: 1,
              unitPrice: selectedPart.grossPrice
          });
          setSaveToInventory(false);
      }
  };

  const handleSave = async () => {
    // A negatív/ideiglenes ID-k takarítása
    const cleanedParts = jobParts.map(p => ({
        ...p,
        id: (p.id && p.id < 0) ? 0 : p.id 
    }));

    const data = {
      appointmentId,
      description,
      laborCost,
      isCompleted,
      jobParts: cleanedParts
    };
    
    try {
      await apiService.saveServiceJob(data);
      onSave();
    } catch (err) {
      console.error(err);
      alert('Hiba a mentés során!');
    }
  };

  const totalPartsCost = jobParts.reduce((sum, p) => sum + (p.unitPrice * p.quantity), 0);
  const totalCost = totalPartsCost + laborCost;

  if (loading) return <div className="modal-overlay">Betöltés...</div>;

  return (
    <div className="modal-overlay modal-on-top" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth: '750px'}}>
        
        {/* FEJLÉC GOMBOK (Nyomtatás + Bezárás) */}
        <div style={{position: 'absolute', top: 15, right: 15, display: 'flex', gap: '10px'}}>
            <button 
                onClick={() => handlePrint && handlePrint()} 
                className="icon-btn" 
                title="Nyomtatás"
                style={{background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', border: '1px solid #3b82f6'}}
            >
                <Printer size={20}/>
            </button>
            <button className="close-modal-btn" style={{position: 'static'}} onClick={onClose}><X size={20}/></button>
        </div>
        
        <div style={{borderBottom: '1px solid var(--border-color)', marginBottom: '15px', paddingBottom: '10px', paddingRight: '80px'}}>
            <h2 style={{margin: 0, display: 'flex', alignItems: 'center', gap: '10px'}}>
                <Wrench color="var(--accent-blue)"/> Munkalap: {vehicleName}
            </h2>
            <span style={{fontSize: '0.85rem', color: 'var(--text-muted)'}}>Azonosító: #{appointmentId}</span>
        </div>

        <div className="modal-dynamic">
            
            {/* MUNKA LEÍRÁSA */}
            <div style={{marginBottom: '20px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px'}}>
                    <label style={{fontWeight: 'bold'}}>Elvégzett munka leírása:</label>
                    <label className="checkbox-container" style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}}>
                        <input type="checkbox" checked={isCompleted} onChange={e => setIsCompleted(e.target.checked)} style={{width: 'auto', margin: 0}} />
                        <span style={{
                            padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold',
                            background: isCompleted ? 'var(--accent-green)' : 'var(--accent-yellow)',
                            color: isCompleted ? 'white' : 'black'
                        }}>
                            {isCompleted ? 'KÉSZ (Lezárva) ✅' : 'FOLYAMATBAN ⏳'}
                        </span>
                    </label>
                </div>
                <textarea 
                    rows={3} 
                    placeholder="Pl. Olajcsere, szűrők cseréje, fékvizsgálat..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    style={{width: '100%', resize: 'vertical'}}
                />
            </div>

            {/* ALKATRÉSZEK */}
            <div className="inset-box">
                <h4 style={{marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <Package size={16}/> Beépített alkatrészek
                </h4>

                {/* --- ÚJ TÉTEL HOZZÁADÁSA --- */}
                <div style={{background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px dashed var(--border-color)'}}>
                    
                    {/* 1. SOR: Gyorstöltés */}
                    <div style={{marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px'}}>
                        <ArrowDownCircle size={16} color="var(--accent-blue)"/>
                        <select 
                            onChange={handleSelectFromInventory} 
                            style={{padding: '8px', fontSize: '0.9rem', color: 'var(--accent-blue)', fontWeight: 'bold', flex: 1}}
                            defaultValue=""
                        >
                            <option value="" disabled>-- Válassz a Cikktörzsből (Gyorstöltés) --</option>
                            {inventory.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.partNumber}) - {p.grossPrice} Ft</option>
                            ))}
                        </select>
                    </div>

                    {/* 2. SOR: Manuális mezők */}
                    <div style={{display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: '10px', alignItems: 'end', marginBottom: '10px'}}>
                        <div>
                            <label style={{fontSize: '0.8rem'}}>Cikkszám</label>
                            <input 
                                placeholder="Pl. OF-123" 
                                value={newItem.partNumber} 
                                onChange={e => setNewItem({...newItem, partNumber: e.target.value})}
                            />
                        </div>
                        <div>
                            <label style={{fontSize: '0.8rem'}}>Megnevezés</label>
                            <input 
                                placeholder="Pl. Olajszűrő" 
                                value={newItem.name} 
                                onChange={e => setNewItem({...newItem, name: e.target.value})}
                            />
                        </div>
                        <div>
                            <label style={{fontSize: '0.8rem'}}>Ár/db (Ft)</label>
                            <input 
                                type="number" 
                                value={newItem.unitPrice || ''} 
                                onChange={e => setNewItem({...newItem, unitPrice: parseInt(e.target.value) || 0})}
                            />
                        </div>
                        <div>
                            <label style={{fontSize: '0.8rem'}}>Db</label>
                            <input 
                                type="number" 
                                value={newItem.quantity || ''} 
                                onChange={e => setNewItem({...newItem, quantity: parseInt(e.target.value) || 0})}
                            />
                        </div>
                    </div>

                    {/* 3. SOR: Mentés törzsbe + Hozzáadás gomb */}
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--accent-blue)'}}>
                            <input 
                                type="checkbox" 
                                checked={saveToInventory}
                                onChange={e => setSaveToInventory(e.target.checked)}
                                style={{width: 'auto', margin: 0}}
                            />
                            <SaveIcon size={14}/> Mentés a Cikktörzsbe is
                        </label>

                        <button onClick={handleAddItem} className="btn-add" style={{padding: '8px 20px', width: 'auto', display: 'flex', alignItems: 'center', gap: 5}}>
                            <Plus size={18}/> Hozzáadás
                        </button>
                    </div>
                </div>

                {/* TÁBLÁZAT */}
                {jobParts.length === 0 ? (
                    <p style={{fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'center'}}>Nincs alkatrész hozzáadva.</p>
                ) : (
                    <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem'}}>
                        <thead>
                            <tr style={{color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)'}}>
                                <th style={{textAlign: 'left', padding: '5px'}}>Cikkszám</th>
                                <th style={{textAlign: 'left', padding: '5px'}}>Megnevezés</th>
                                <th style={{textAlign: 'center', padding: '5px'}}>Db</th>
                                <th style={{textAlign: 'right', padding: '5px'}}>Ár</th>
                                <th style={{textAlign: 'right', padding: '5px'}}>Össz</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {jobParts.map((part, idx) => (
                                <tr key={idx} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                                    <td style={{padding: '8px 5px', color: 'var(--accent-blue)', fontSize: '0.8rem'}}>{inventory.find(i => i.name === part.itemName)?.partNumber || '-'}</td>
                                    <td style={{padding: '8px 5px'}}>{part.itemName}</td>
                                    <td style={{padding: '8px 5px', textAlign: 'center'}}>{part.quantity}</td>
                                    <td style={{padding: '8px 5px', textAlign: 'right'}}>{part.unitPrice.toLocaleString()}</td>
                                    <td style={{padding: '8px 5px', textAlign: 'right', fontWeight: 'bold'}}>{(part.unitPrice * part.quantity).toLocaleString()}</td>
                                    <td style={{textAlign: 'right'}}>
                                        <button onClick={() => handleRemoveItem(idx)} className="icon-btn delete-btn"><Trash2 size={14}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                
                <div style={{textAlign: 'right', marginTop: '10px', color: 'var(--text-muted)'}}>
                    Anyagköltség: <strong>{totalPartsCost.toLocaleString()} Ft</strong>
                </div>
            </div>

            {/* ÖSSZESÍTÉS */}
            <div style={{display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '15px', marginTop: '20px'}}>
                <div style={{textAlign: 'right'}}>
                    <label style={{display: 'block', marginBottom: '5px'}}>Kiegészítő Munkadíj (Ft):</label>
                    <input type="number" value={laborCost || ''} onChange={e => setLaborCost(parseInt(e.target.value) || 0)} style={{width: '150px', textAlign: 'right', fontWeight: 'bold'}} />
                </div>
            </div>

            <div style={{
                background: '#27272a', padding: '15px', borderRadius: '8px', marginTop: '15px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--accent-blue)'
            }}>
                <span style={{fontSize: '1.1rem'}}>Végösszeg (Fizetendő):</span>
                <span style={{fontSize: '1.5rem', fontWeight: 'bold', color: 'white'}}>{totalCost.toLocaleString()} Ft</span>
            </div>

            <button onClick={handleSave} className="btn-add" style={{marginTop: '20px', width: '100%', display: 'flex', justifyContent: 'center', gap: '10px'}}>
                <Save size={18}/> Munkalap Mentése
            </button>
        </div>

        {/* --- REJTETT NYOMTATÁSI KÉP --- */}
        <div style={{ display: 'none' }}>
            <PrintableWorksheet 
                ref={printRef}
                data={{
                    id: appointmentId,
                    customerName: "Ügyfél", // Ha van konkrét neved, ide írd be
                    vehiclePlate: vehicleName.split(' ')[0] || "Rendszám",
                    vehicleType: vehicleName,
                    description: description,
                    jobParts: jobParts,
                    laborCost: laborCost,
                    date: new Date().toLocaleDateString()
                }}
            />
        </div>

      </div>
    </div>
  );
};

export default WorksheetModal;