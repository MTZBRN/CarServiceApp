import React from 'react';
import { LayoutDashboard, Calendar, Car, Wrench, Settings, LogOut, Package, FileText } from 'lucide-react';

interface Props {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<Props> = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Áttekintés', icon: <LayoutDashboard size={20} /> },
    { id: 'schedule', label: 'Naptár', icon: <Calendar size={20} /> },
    { id: 'vehicles', label: 'Járművek', icon: <Car size={20} /> },
    { id: 'inventory', label: 'Raktár', icon: <Package size={20} /> },
    { id: 'invoices', label: 'Számlák', icon: <FileText size={20} /> },
    { id: 'settings', label: 'Beállítások', icon: <Settings size={20} /> },
  ];

  return (
    <div className="sidebar-container">
      {/* LOGO */}
      <div className="sidebar-logo">
        <div className="logo-icon"><Wrench size={18} color="white" /></div>
        <span className="logo-text">GTA Szerviz</span>
      </div>

      {/* MENÜ LISTA */}
      <div className="sidebar-menu">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* ALJ (Felhasználó) */}
      <div className="sidebar-footer">
        <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <div style={{width: 35, height: 35, borderRadius: '50%', background: '#3f3f46', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                <span style={{fontWeight: 'bold', fontSize: '0.8rem'}}>AM</span>
            </div>
            <div style={{display: 'flex', flexDirection: 'column'}}>
                <span style={{fontSize: '0.85rem', fontWeight: 'bold'}}>Alex Mechanic</span>
                <span style={{fontSize: '0.7rem', color: '#a1a1aa'}}>Főnök</span>
            </div>
        </div>
        <button className="icon-btn" style={{border: 'none'}}><LogOut size={18} /></button>
      </div>
    </div>
  );
};

export default Sidebar;