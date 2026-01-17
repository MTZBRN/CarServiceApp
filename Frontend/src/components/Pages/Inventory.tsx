import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, Trash2, Edit2, Save, X } from 'lucide-react';
import { apiService } from '../../api/apiservice';
import { Part } from '../../types';

const Inventory: React.FC = () => {
    const [parts, setParts] = useState<Part[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Új / Szerkesztés State
    const [showModal, setShowModal] = useState(false);
    const [editingPart, setEditingPart] = useState<Part | null>(null);
    const [formData, setFormData] = useState({
        partNumber: '', name: '', netPrice: 0, grossPrice: 0, stockQuantity: 0
    });

    useEffect(() => {
        loadParts();
    }, []);

    const loadParts = async () => {
        try {
            const res = await apiService.getParts();
            setParts(res.data);
        } catch (err) {
            console.error("Nem sikerült betölteni a raktárt", err);
        } finally {
            setLoading(false);
        }
    };

    // --- ÁRKÉPZÉS LOGIKA ---
    const handleNetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const net = Number(e.target.value);
        // Automatikus Bruttó számítás (27% ÁFA)
        const gross = Math.round(net * 1.27); 
        setFormData({ ...formData, netPrice: net, grossPrice: gross });
    };

    const handleGrossChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const gross = Number(e.target.value);
        // Automatikus Nettó visszaszámítás, ha a bruttót írják át
        const net = Math.round(gross / 1.27);
        setFormData({ ...formData, grossPrice: gross, netPrice: net });
    };
    // -----------------------

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingPart) {
                await apiService.updatePart(editingPart.id, { ...formData, id: editingPart.id });
            } else {
                await apiService.createPart(formData);
            }
            setShowModal(false);
            setEditingPart(null);
            setFormData({ partNumber: '', name: '', netPrice: 0, grossPrice: 0, stockQuantity: 0 });
            loadParts();
        } catch (err) {
            alert('Hiba történt a mentéskor!');
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Biztosan törlöd ezt az alkatrészt?')) return;
        try {
            await apiService.deletePart(id);
            loadParts();
        } catch (err) {
            alert('Hiba törléskor!');
        }
    };

    const openEdit = (p: Part) => {
        setEditingPart(p);
        setFormData({
            partNumber: p.partNumber, name: p.name, 
            netPrice: p.netPrice, grossPrice: p.grossPrice, 
            stockQuantity: p.stockQuantity
        });
        setShowModal(true);
    };

    const filteredParts = parts.filter(p => 
        p.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div style={{height: '100%', display: 'flex', flexDirection: 'column'}}>
            {/* FEJLÉC + KERESŐ */}
            <div className="card" style={{marginBottom: '20px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div style={{position: 'relative', width: '300px'}}>
                    <Search size={18} style={{position: 'absolute', left: 10, top: 10, color: '#666'}} />
                    <input 
                        placeholder="Keresés cikkszám vagy név alapján..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{paddingLeft: '35px'}}
                    />
                </div>
                <button onClick={() => { setEditingPart(null); setFormData({ partNumber: '', name: '', netPrice: 0, grossPrice: 0, stockQuantity: 0 }); setShowModal(true); }} className="btn-add" style={{width: 'auto', display: 'flex', gap: 10, alignItems: 'center'}}>
                    <Plus size={18} /> Új Alkatrész
                </button>
            </div>

            {/* TÁBLÁZAT */}
            <div className="card" style={{flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column'}}>
                <div style={{overflowY: 'auto', flex: 1}}>
                    <table style={{width: '100%', borderCollapse: 'collapse', color: 'var(--text-main)'}}>
                        <thead style={{background: '#27272a', position: 'sticky', top: 0}}>
                            <tr>
                                <th style={{padding: '12px', textAlign: 'left'}}>Cikkszám</th>
                                <th style={{padding: '12px', textAlign: 'left'}}>Megnevezés</th>
                                <th style={{padding: '12px', textAlign: 'right'}}>Nettó Ár</th>
                                <th style={{padding: '12px', textAlign: 'right'}}>Bruttó Ár</th>
                                <th style={{padding: '12px', textAlign: 'center'}}>Készlet</th>
                                <th style={{padding: '12px', textAlign: 'right'}}>Műveletek</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredParts.map(p => (
                                <tr key={p.id} style={{borderBottom: '1px solid var(--border-color)'}}>
                                    <td style={{padding: '12px', fontWeight: 'bold', color: 'var(--accent-blue)'}}>{p.partNumber}</td>
                                    <td style={{padding: '12px'}}>{p.name}</td>
                                    <td style={{padding: '12px', textAlign: 'right'}}>{p.netPrice.toLocaleString()} Ft</td>
                                    <td style={{padding: '12px', textAlign: 'right', fontWeight: 'bold'}}>{p.grossPrice.toLocaleString()} Ft</td>
                                    <td style={{padding: '12px', textAlign: 'center'}}>
                                        <span style={{
                                            padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem',
                                            background: p.stockQuantity > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                            color: p.stockQuantity > 0 ? '#10b981' : '#ef4444'
                                        }}>
                                            {p.stockQuantity} db
                                        </span>
                                    </td>
                                    <td style={{padding: '12px', textAlign: 'right'}}>
                                        <button onClick={() => openEdit(p)} className="icon-btn" style={{marginRight: 5}}><Edit2 size={16}/></button>
                                        <button onClick={() => handleDelete(p.id)} className="icon-btn delete-btn"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL (Új / Szerkesztés) */}
            {showModal && (
                <div className="modal-overlay modal-on-top" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <button className="close-modal-btn" onClick={() => setShowModal(false)}>✖</button>
                        <h2 style={{marginTop: 0, display: 'flex', alignItems: 'center', gap: 10}}>
                            <Package color="var(--accent-blue)"/> {editingPart ? 'Alkatrész Szerkesztése' : 'Új Alkatrész'}
                        </h2>
                        
                        <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                            <div style={{display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px'}}>
                                <div>
                                    <label>Cikkszám (UNIX)</label>
                                    <input required value={formData.partNumber} onChange={e => setFormData({...formData, partNumber: e.target.value})} placeholder="PL. OF-123" />
                                </div>
                                <div>
                                    <label>Megnevezés</label>
                                    <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Pl. Olajszűrő" />
                                </div>
                            </div>

                            <div className="inset-box" style={{background: 'rgba(59, 130, 246, 0.05)', border: '1px solid var(--accent-blue)'}}>
                                <h4 style={{margin: '0 0 10px 0', color: 'var(--accent-blue)'}}>Árképzés</h4>
                                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                                    <div>
                                        <label>Nettó Ár (Ft)</label>
                                        <input type="number" required value={formData.netPrice} onChange={handleNetChange} />
                                    </div>
                                    <div>
                                        <label>Bruttó Ár (27%)</label>
                                        <input type="number" required value={formData.grossPrice} onChange={handleGrossChange} />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label>Készlet (Mennyiség)</label>
                                <input type="number" value={formData.stockQuantity} onChange={e => setFormData({...formData, stockQuantity: parseInt(e.target.value)})} />
                            </div>

                            <button type="submit" className="btn-add">
                                {editingPart ? 'Mentés' : 'Hozzáadás'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;