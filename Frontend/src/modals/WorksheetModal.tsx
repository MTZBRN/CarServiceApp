import React, { useState, useEffect } from 'react';
import { apiService } from '../api/apiservice';
import { ServiceJob, JobPart } from '../types';

interface Props {
    appointmentId: number;
    vehicleName: string;
    onClose: () => void;
    onSave: () => void;
}

const WorksheetModal: React.FC<Props> = ({ appointmentId, vehicleName, onClose, onSave }) => {
    const [isLoading, setIsLoading] = useState(true);
    
    const [job, setJob] = useState<ServiceJob>({
        appointmentId: appointmentId,
        description: '',
        laborCost: 0,
        isCompleted: false,
        jobParts: []
    });

    useEffect(() => {
        const loadData = async () => {
            try {
                const res = await apiService.getServiceJob(appointmentId);
                if (res.data) setJob(res.data);
            } catch (error) {
                console.log("Még nincs munkalap, üres űrlapot kezdünk.");
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [appointmentId]);

    const addPart = () => {
        // FONTOS: Üres cikkszámmal hozzuk létre
        setJob({ ...job, jobParts: [...job.jobParts, { partNumber: '', partName: '', quantity: 1, unitPrice: 0 }] });
    };

    const removePart = (index: number) => {
        const newParts = [...job.jobParts];
        newParts.splice(index, 1);
        setJob({ ...job, jobParts: newParts });
    };

    const updatePart = (index: number, field: keyof JobPart, value: any) => {
        const newParts = [...job.jobParts];
        // @ts-ignore
        newParts[index][field] = value;
        setJob({ ...job, jobParts: newParts });
    };

    const partsTotal = job.jobParts.reduce((sum, part) => sum + (part.quantity * part.unitPrice), 0);
    const grandTotal = partsTotal + Number(job.laborCost);

    const handleSave = async () => {
        try {
            await apiService.saveServiceJob(job);
            alert("Munkalap sikeresen mentve! ✅");
            onSave();
        } catch (error) {
            console.error(error);
            alert("Hiba mentéskor! ❌");
        }
    };

    if (isLoading) return <div className="modal-overlay">Betöltés...</div>;

    return (
        <div className="modal-overlay modal-on-top" onClick={onClose}>
            <div 
                className="modal-content modal-dynamic" 
                onClick={e => e.stopPropagation()}
                style={{ width: '95vw', maxWidth: '1000px' }} // Kicsit még szélesebbre engedjük (1000px)
            >
                <button className="close-modal-btn" onClick={onClose}>✖</button>
                
                <div style={{borderBottom: '2px solid #3498db', marginBottom: '15px', paddingBottom: '10px'}}>
                    <h2 style={{margin: 0}}>🔧 Munkalap: {vehicleName}</h2>
                    <span style={{fontSize: '0.9rem', color: '#666'}}>Azonosító: #{appointmentId}</span>
                </div>

                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                    
                    {/* LEÍRÁS */}
                    <div style={{display: 'flex', gap: '15px', flexWrap: 'wrap'}}>
                        <div style={{flex: '2 1 300px'}}>
                            <label style={{fontWeight: 'bold'}}>Elvégzett munka leírása:</label>
                            <textarea 
                                value={job.description} 
                                onChange={e => setJob({...job, description: e.target.value})}
                                rows={2} 
                                style={{width: '100%', padding: '8px'}} 
                                placeholder="Pl. Olajcsere, szűrők cseréje..."
                            />
                        </div>
                        <div className={job.isCompleted ? "status-box-completed" : "status-box-pending"} style={{flex: '1 1 150px'}}>
                            <label style={{cursor: 'pointer', fontWeight: 'bold', width: '100%', margin: 0, display: 'flex', alignItems: 'center', color: 'inherit'}}>
                                <input 
                                    type="checkbox" 
                                    checked={job.isCompleted} 
                                    onChange={e => setJob({...job, isCompleted: e.target.checked})}
                                    style={{width: '20px', height: '20px', marginRight: '10px', accentColor: job.isCompleted ? '#10b981' : '#f59e0b'}}
                                />
                                {job.isCompleted ? "KÉSZ ✔️" : "FOLYAMATBAN ⏳"}
                            </label>
                        </div>
                    </div>

                    {/* --- ALKATRÉSZEK LISTÁJA (ITT A LÉNYEG!) --- */}
                    <div className="inset-box" style={{overflowX: 'auto'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', minWidth: '800px'}}>
                            <h4 style={{margin: 0}}>⚙️ Beépített alkatrészek</h4>
                            <button type="button" onClick={addPart} style={{background: '#27ae60', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer'}}>
                                + Új alkatrész
                            </button>
                        </div>

                        {job.jobParts.length === 0 && <p style={{color: '#999', fontStyle: 'italic'}}>Nincs alkatrész hozzáadva.</p>}

                        {/* A sor minimum szélességét megnöveljük 900px-re */}
                        {job.jobParts.map((part, index) => (
                            <div key={index} style={{display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center', minWidth: '900px'}}>
                                
                                {/* CIKKSZÁM: Fix 140px, nem mehet össze */}
                                <input 
                                    placeholder="Cikkszám (Pl. OF-3323)" 
                                    value={part.partNumber} 
                                    onChange={e => updatePart(index, 'partNumber', e.target.value)}
                                    style={{flex: '0 0 140px', padding: '5px', fontWeight: 'bold', color: '#555'}} 
                                />

                                {/* NÉV: Ez az egyetlen, ami nőhet (flex-grow: 1), de minimum 250px */}
                                <input 
                                    placeholder="Alkatrész neve" 
                                    value={part.partName} 
                                    onChange={e => updatePart(index, 'partName', e.target.value)}
                                    style={{flex: '1 0 250px', padding: '5px'}} 
                                />

                                {/* DB: Fix 70px */}
                                <input 
                                    type="number" 
                                    placeholder="Db" 
                                    value={part.quantity} 
                                    onChange={e => updatePart(index, 'quantity', Number(e.target.value))}
                                    style={{flex: '0 0 70px', padding: '5px'}} 
                                />

                                {/* ÁR: Fix 100px */}
                                <input 
                                    type="number" 
                                    placeholder="Ár (Ft)" 
                                    value={part.unitPrice} 
                                    onChange={e => updatePart(index, 'unitPrice', Number(e.target.value))}
                                    style={{flex: '0 0 100px', padding: '5px'}} 
                                />

                                {/* ÖSSZESEN: Fix 120px */}
                                <div style={{flex: '0 0 120px', fontWeight: 'bold', textAlign: 'right'}}>
                                    {(part.quantity * part.unitPrice).toLocaleString()} Ft
                                </div>

                                <button onClick={() => removePart(index)} style={{background: 'transparent', border: 'none', color: 'red', cursor: 'pointer', fontSize: '1.2rem', marginLeft: '5px'}}>🗑️</button>
                            </div>
                        ))}
                        
                        <div style={{textAlign: 'right', marginTop: '10px', borderTop: '1px solid #ccc', paddingTop: '5px', minWidth: '800px'}}>
                            <strong>Anyagköltség: {partsTotal.toLocaleString()} Ft</strong>
                        </div>
                    </div>

                    {/* VÉGÖSSZEG */}
                    <div style={{display: 'flex', justifyContent: 'flex-end', gap: '20px', alignItems: 'center', flexWrap: 'wrap'}}>
                        <div>
                            <label style={{fontWeight: 'bold', marginRight: '10px'}}>Munkadíj (Ft):</label>
                            <input 
                                type="number" 
                                value={job.laborCost} 
                                onChange={e => setJob({...job, laborCost: Number(e.target.value)})}
                                style={{padding: '8px', fontSize: '1.1rem', width: '150px', textAlign: 'right'}}
                            />
                        </div>
                    </div>

                    <div className="inset-box" style={{overflowX: 'auto'}}>
                        <span style={{fontSize: '1.2rem', marginRight: '20px'}}>Végösszeg (Fizetendő):</span>
                        <span style={{fontSize: '2rem', fontWeight: 'bold'}}>{grandTotal.toLocaleString()} Ft</span>
                    </div>

                    <button onClick={handleSave} style={{width: '100%', padding: '15px', background: '#3498db', color: 'white', border: 'none', borderRadius: '5px', fontSize: '1.2rem', cursor: 'pointer', fontWeight: 'bold'}}>
                        💾 Munkalap Mentése
                    </button>

                </div>
            </div>
        </div>
    );
};

export default WorksheetModal;