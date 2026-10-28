import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Calendar,
  Car,
  Settings as SettingsIcon,
  LogOut,
  Package,
  Users,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { profilePictureUrl } from "../api/client";
import { useWorkshopResource } from "../data/useWorkshopData";

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
  const { data: settings } = useWorkshopResource("settings");
  const serviceName = settings?.companyName || "GTA Szerviz";
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const effectiveUserRole = userRole || localStorage.getItem("userRole") || "";

  // --- ADATOK BETÖLTÉSE ÉS FIGYELÉSE ---
  useEffect(() => {

    const updateProfilePic = () => {
      const userData = JSON.parse(localStorage.getItem("user_data") || "{}");
      if (userData.profilePicturePath) {
        // ✅ MEGOLDÁS: Ha élesben vagyunk, ne tegyen elé semmit (relatív út),
        // ha lokálisan (a te gépeden), akkor tegye elé a localhostot!
        setProfilePicUrl(profilePictureUrl(userData.profilePicturePath));
      }
    };

    updateProfilePic();

    window.addEventListener("profile-updated", updateProfilePic);
    return () => {
      window.removeEventListener("profile-updated", updateProfilePic);
    };
  }, [effectiveUserRole]);

  const menuItems = [
    {
      id: "dashboard",
      label: "Áttekintés",
      icon: <LayoutDashboard size={20} />,
    },
    { id: "schedule", label: "Naptár", icon: <Calendar size={20} /> },
    { id: "vehicles", label: "Járművek", icon: <Car size={20} /> },
    { id: "inventory", label: "Raktár", icon: <Package size={20} /> },

    // ✅ ITT A VÁLTOZÁS: Számlák -> Ügyfelek
    { id: "customers", label: "Ügyfelek", icon: <Users size={20} /> },

    ...(effectiveUserRole === "admin"
      ? [
          {
            id: "settings",
            label: "Beállítások",
            icon: <SettingsIcon size={20} />,
          },
        ]
      : []),
    ...(effectiveUserRole === "admin"
      ? [
          {
            id: "userManagement",
            label: "Felhasználók",
            icon: <ShieldCheck size={20} />,
          },
        ]
      : []),
  ];

  return (
    <div
      className={`sidebar-container ${isCollapsed ? "collapsed" : ""}`}
      style={{ background: "#09090b", borderRight: "1px solid #27272a" }}
    >
      <button
        className="sidebar-toggle-btn"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div className="sidebar-logo">
        <div className="logo-icon" style={{ background: "#3b82f6" }}>
          <Wrench size={18} color="white" />
        </div>
        {!isCollapsed && (
          <span
            className="logo-text"
            style={{
              fontSize: "1rem",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {serviceName}
          </span>
        )}
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
              background: userRole === "admin" ? "#3b82f6" : "#10b981",
              overflow: "hidden",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              flexShrink: 0,
              color: "white",
              border: "2px solid #27272a",
            }}
          >
            {profilePicUrl ? (
              <img
                src={profilePicUrl}
                alt="Profile"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontWeight: "bold", fontSize: "0.8rem" }}>
                {currentUser.substring(0, 2).toUpperCase()}
              </span>
            )}
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
