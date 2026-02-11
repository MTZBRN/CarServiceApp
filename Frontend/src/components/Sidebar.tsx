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
  ShieldCheck,
} from "lucide-react";

interface Props {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  currentUser: string;
  userRole: string;
}

const Sidebar: React.FC<Props> = ({
  activeTab,
  setActiveTab,
  onLogout,
  currentUser,
  userRole,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // ✅ Átalakítva: A listát szűrjük a szerepkör alapján
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
    // ✅ Csak akkor adjuk hozzá, ha admin
    ...(userRole === "admin"
      ? [
          {
            id: "userManagement",
            label: "Felhasználók",
            icon: <ShieldCheck size={20} />,
          },
        ]
      : []),
  ];

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  return (
    <div
      className={`sidebar-container ${isCollapsed ? "collapsed" : ""}`}
      style={{ background: "#09090b", borderRight: "1px solid #27272a" }}
    >
      <button className="sidebar-toggle-btn" onClick={toggleSidebar}>
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div className="sidebar-logo">
        <div className="logo-icon" style={{ background: "#3b82f6" }}>
          <Wrench size={18} color="white" />
        </div>
        {!isCollapsed && <span className="logo-text">GTA Szerviz</span>}
      </div>

      <div className="sidebar-menu">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`sidebar-item ${activeTab === item.id ? "active" : ""}`}
            title={isCollapsed ? item.label : ""}
            style={{
              backgroundColor:
                activeTab === item.id ? "#3b82f6" : "transparent",
            }}
          >
            {item.icon}
            {!isCollapsed && <span>{item.label}</span>}
          </button>
        ))}
      </div>

      <div
        className="sidebar-footer"
        style={{ borderTop: "1px solid #27272a" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: 35,
              height: 35,
              borderRadius: "50%",
              background: userRole === "admin" ? "#3b82f6" : "#10b981", // Admin kék, Mechanic zöld
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              flexShrink: 0,
              color: "white",
            }}
          >
            <span style={{ fontWeight: "bold", fontSize: "0.8rem" }}>
              {currentUser.substring(0, 2).toUpperCase()}
            </span>
          </div>

          {!isCollapsed && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  fontSize: "0.85rem",
                  fontWeight: "bold",
                  color: "white",
                }}
              >
                {currentUser}
              </span>
              {/* ✅ Dinamikus szerepkör kiírás */}
              <span
                style={{
                  fontSize: "0.7rem",
                  color: "#a1a1aa",
                  textTransform: "capitalize",
                }}
              >
                {userRole === "admin" ? "Rendszergazda" : "Szerelő"}
              </span>
            </div>
          )}
        </div>

        <button
          className="icon-btn logout-hover"
          onClick={onLogout}
          style={{
            border: "none",
            padding: isCollapsed ? "5px" : "8px",
            color: "#ef4444",
            background: "transparent",
            cursor: "pointer",
          }}
          title="Kijelentkezés"
        >
          <LogOut size={18} />
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
