import React, { useState } from "react";
import {
  LayoutDashboard,
  Calendar,
  Car,
  Wrench,
  Settings,
  LogOut,
  Package,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface Props {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<Props> = ({ activeTab, setActiveTab }) => {
  // State az összecsukáshoz
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    {
      id: "dashboard",
      label: "Áttekintés",
      icon: <LayoutDashboard size={20} />,
    },
    { id: "schedule", label: "Naptár", icon: <Calendar size={20} /> },
    { id: "vehicles", label: "Járművek", icon: <Car size={20} /> },
    { id: "inventory", label: "Raktár", icon: <Package size={20} /> },
    { id: "invoices", label: "Számlák", icon: <FileText size={20} /> },
    { id: "settings", label: "Beállítások", icon: <Settings size={20} /> },
  ];

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`sidebar-container ${isCollapsed ? "collapsed" : ""}`}>
      {/* Összecsukó Gomb */}
      <button
        className="sidebar-toggle-btn"
        onClick={toggleSidebar}
        title={isCollapsed ? "Kinyitás" : "Összecsukás"}
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* LOGO */}
      <div className="sidebar-logo">
        <div className="logo-icon">
          <Wrench size={18} color="white" />
        </div>
        {/* Ha nincs összecsukva, kiírjuk a szöveget */}
        <span
          className="logo-text"
          style={{
            opacity: isCollapsed ? 0 : 1,
            width: isCollapsed ? 0 : "auto",
          }}
        >
          GTA Szerviz
        </span>
      </div>

      {/* MENÜ LISTA */}
      <div className="sidebar-menu">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`sidebar-item ${activeTab === item.id ? "active" : ""}`}
            title={isCollapsed ? item.label : ""} // Tooltip ha össze van csukva
          >
            {item.icon}
            {!isCollapsed && <span>{item.label}</span>}
          </button>
        ))}
      </div>

      {/* ALJ (Felhasználó) */}
      <div className="sidebar-footer">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: 35,
              height: 35,
              borderRadius: "50%",
              background: "#3f3f46",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ fontWeight: "bold", fontSize: "0.8rem" }}>AM</span>
          </div>

          {!isCollapsed && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
                Alex Mechanic
              </span>
              <span style={{ fontSize: "0.7rem", color: "#a1a1aa" }}>
                Főnök
              </span>
            </div>
          )}
        </div>

        <button
          className="icon-btn"
          style={{ border: "none", padding: isCollapsed ? "5px" : "8px" }}
          title="Kijelentkezés"
        >
          <LogOut size={18} />
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
