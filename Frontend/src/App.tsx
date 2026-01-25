import React, { useState, useCallback, useMemo } from "react";
import "./App.css";

// Ikonok
import {
  Calendar as CalIcon,
  Car,
  AlertTriangle,
  Search,
  Trash2,
  History,
  Plus,
  Wrench,
  ChevronLeft,
  ChevronRight,
  FileText,
  LogOut,
} from "lucide-react";

// Komponensek
import Sidebar from "./components/Sidebar";
import AppointmentModal from "./components/modals/AppointmentModal";
import EventDetailModal from "./components/modals/EventDetailModal";
import WorksheetModal from "./components/modals/WorksheetModal";
import AddVehicleModal from "./components/modals/AddVehicleModal";

// Oldalak
import Inventory from "./components/pages/Inventory";
import Garage from "./components/pages/Garage";
import DevDashboard from "./components/pages/Dashboard";
import VehicleDetails from "./components/pages/VehicleDetails";
import Settings from "./components/pages/Settings";
import UserManagement from "./components/pages/UserManagement";
import Login from "./components/pages/Login";

// Hook és API
import { useCarService } from "./hooks/useCarService";
import { CalendarEvent } from "./types";

// Naptár és Dátumkezelés
import {
  Calendar,
  dateFnsLocalizer,
  View,
  SlotInfo,
  Components,
} from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { hu } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

const locales = { hu: hu };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// --- 1. EGYEDI ESEMÉNY MEGJELENÍTÉS (Naptárban) ---
const CustomEvent = ({ event }: { event: CalendarEvent }) => {
  const isMot = event.type === "mot";
  const bgColor = isMot ? "rgba(239, 68, 68, 0.2)" : "rgba(59, 130, 246, 0.2)";
  const accentColor = isMot ? "#ef4444" : "#3b82f6";
  const Icon = isMot ? FileText : Wrench;

  <div
    style={{
      height: "100%",
      background: bgColor,
      borderLeft: `4px solid ${accentColor}`,
      padding: "2px 6px",
      color: "white",
      fontSize: "0.85rem",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      overflow: "hidden",
      boxSizing: "border-box",
      minHeight: "24px",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontWeight: 600,
        overflow: "hidden",
      }}
    >
      <Icon size={14} color={accentColor} style={{ flexShrink: 0 }} />
      <span
        style={{
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          lineHeight: 1.2,
        }}
      >
        {event.title}
      </span>
    </div>
  </div>;
};

// --- 2. EGYEDI FEJLÉC (Naptárban) ---
const CustomToolbar = (toolbar: any) => {
  const goToBack = () => {
    toolbar.onNavigate("PREV");
  };
  const goToNext = () => {
    toolbar.onNavigate("NEXT");
  };
  const goToCurrent = () => {
    toolbar.onNavigate("TODAY");
  };

  const label = () => {
    const date = toolbar.date;
    return (
      <span
        style={{
          textTransform: "capitalize",
          fontSize: "1.2rem",
          fontWeight: "bold",
          color: "white",
        }}
      >
        {format(date, "MMMM yyyy")}
      </span>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "20px",
        padding: "0 5px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        {label()}
        <div
          style={{
            display: "flex",
            gap: "5px",
            background: "#18181b",
            padding: "4px",
            borderRadius: "8px",
            border: "1px solid #3f3f46",
          }}
        >
          <button
            onClick={goToBack}
            className="icon-btn"
            style={{ width: "32px", height: "32px", color: "#a1a1aa" }}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={goToCurrent}
            style={{
              background: "transparent",
              color: "white",
              padding: "0 15px",
              borderRadius: "6px",
              fontSize: "0.9rem",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Ma
          </button>
          <button
            onClick={goToNext}
            className="icon-btn"
            style={{ width: "32px", height: "32px", color: "#a1a1aa" }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          background: "#18181b",
          padding: "4px",
          borderRadius: "8px",
          border: "1px solid #3f3f46",
        }}
      >
        {["month", "week", "day", "agenda"].map((view) => (
          <button
            key={view}
            onClick={() => toolbar.onView(view)}
            style={{
              background: toolbar.view === view ? "#3f3f46" : "transparent",
              color: toolbar.view === view ? "white" : "#a1a1aa",
              border: "none",
              padding: "8px 16px",
              borderRadius: "6px",
              cursor: "pointer",
              textTransform: "capitalize",
              fontSize: "0.9rem",
              fontWeight: toolbar.view === view ? 600 : 500,
              transition: "all 0.2s",
            }}
          >
            {view === "month"
              ? "Hónap"
              : view === "week"
                ? "Hét"
                : view === "day"
                  ? "Nap"
                  : "Lista"}
          </button>
        ))}
      </div>
    </div>
  );
};

function App() {
  // --- AUTH STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem("authToken") !== null;
  });

  const handleLogin = (token: string) => {
    localStorage.setItem("authToken", token);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    if (window.confirm("Biztosan ki akarsz jelentkezni?")) {
      localStorage.removeItem("authToken");
      setIsAuthenticated(false);
    }
  };

  const [isDevMode, setIsDevMode] = useState(false);

  // --- ADATOK BETÖLTÉSE (Custom Hook) ---
  const {
    vehicles,
    customers,
    calendarEvents,
    setMessage,
    refreshAll,
    deleteVehicle,
    deleteAppointment,
    appointments,
  } = useCarService();

  // --- NAVIGÁCIÓS STATE ---
  const [activeTab, setActiveTab] = useState("dashboard");
  const [date, setDate] = useState<Date>(new Date());
  const [view, setView] = useState<View>("month");

  // 👇 ÚJ STATE: Melyik járművet nézzük a részletes oldalon?
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(
    null,
  );

  // --- MODÁLOK STATE ---
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [showApptModal, setShowApptModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null,
  );
  const [showWorksheetModal, setShowWorksheetModal] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<
    number | null
  >(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false); // Ezt megtartjuk fallbacknek, de most nem használjuk
  const [historyVehicle, setHistoryVehicle] = useState<{
    id: number;
    plate: string;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Naptár navigáció callbackek
  const onNavigate = useCallback(
    (newDate: Date) => setDate(newDate),
    [setDate],
  );
  const onView = useCallback((newView: View) => setView(newView), [setView]);

  // Naptár események (AllDay fix)
  const processedEvents = useMemo(() => {
    return calendarEvents.map((evt) => ({
      ...evt,
      allDay: true,
    }));
  }, [calendarEvents]);

  // --- HANDLEREK ---

  const handleSelectSlot = ({ start }: SlotInfo) => {
    setSelectedSlot(start as Date);
    setShowApptModal(true);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  };

  const handleOpenWorksheet = (apptId: number) => {
    setSelectedAppointmentId(apptId);
    setShowEventModal(false);
    setShowWorksheetModal(true);
  };

  const handleOpenHistory = (id: number, plate: string) => {
    setSelectedVehicleId(id);
    setActiveTab("vehicle_details");
  };

  const getStatusColor = (d: string | null | undefined) => {
    if (!d) return "#fff";
    const days = (new Date(d).getTime() - new Date().getTime()) / 86400000;
    return days < 0 ? "#ffcccc" : days < 30 ? "#fff3cd" : "#d4edda";
  };

  // Keresés a listában
  const filteredVehicles = vehicles.filter((v) => {
    const search = searchTerm.toLowerCase();
    const plate = v.licensePlate.toLowerCase();
    const owner = v.customer?.name.toLowerCase() || "";
    return plate.includes(search) || owner.includes(search);
  });

  // Megkeressük a kiválasztott autót objektumként az új oldalhoz
  const selectedVehicleObj = vehicles.find((v) => v.id === selectedVehicleId);

  // --- RENDERELÉS: VÉDELEM & DEV MODE ---

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  if (isDevMode) {
    return (
      <DevDashboard
        onBack={() => {
          setIsDevMode(false);
          refreshAll();
        }}
      />
    );
  }

  const calendarComponents: Components<CalendarEvent> = {
    event: CustomEvent as any,
    toolbar: CustomToolbar,
  };

  return (
    <div className="container">
      {/* Fejlesztői gomb */}
      <button
        onClick={() => setIsDevMode(true)}
        style={{
          position: "fixed",
          bottom: "10px",
          right: "10px",
          zIndex: 9999,
          background: "#333",
          border: "1px solid #555",
          color: "#666",
          borderRadius: "50%",
          width: "30px",
          height: "30px",
          cursor: "pointer",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          opacity: 0.5,
        }}
        title="Fejlesztői mód"
      >
        <Wrench size={14} />
      </button>

      {/* BAL OLDALI MENÜ */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* FŐ TARTALMI TERÜLET */}
      <div className="content-area">
        {/* HEADER - Csak akkor mutatjuk, ha NEM a részletes nézetben vagyunk */}
        {activeTab !== "vehicle_details" && (
          <div className="header">
            <div>
              <h1 style={{ textTransform: "capitalize" }}>
                {activeTab === "dashboard"
                  ? "Áttekintés 🚘"
                  : activeTab === "schedule"
                    ? "Szerviz Naptár 📅"
                    : activeTab === "vehicles"
                      ? "Járművek Listája 🚙"
                      : activeTab === "inventory"
                        ? "Raktárkészlet 📦"
                        : "Beállítások ⚙️"}
              </h1>
            </div>

            <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
              {activeTab === "dashboard" && (
                <>
                  <div className="mini-stat">
                    <span className="mini-stat-label">📅 Ma:</span>
                    <span className="mini-stat-value">
                      {
                        appointments.filter(
                          (a) =>
                            new Date(a.startTime).toDateString() ===
                            new Date().toDateString(),
                        ).length
                      }
                    </span>
                  </div>
                  <div className="mini-stat" style={{ borderColor: "#ef4444" }}>
                    <span
                      className="mini-stat-label"
                      style={{ color: "#ef4444" }}
                    >
                      ⚠️ Lejárt:
                    </span>
                    <span
                      className="mini-stat-value"
                      style={{ color: "#ef4444" }}
                    >
                      {
                        vehicles.filter(
                          (v) => getStatusColor(v.motExpiry) === "#ffcccc",
                        ).length
                      }
                    </span>
                  </div>
                </>
              )}

              <button
                onClick={handleLogout}
                className="icon-btn"
                style={{
                  border: "1px solid #ef4444",
                  color: "#ef4444",
                  padding: "6px 12px",
                  fontSize: "0.8rem",
                  gap: 6,
                }}
              >
                <LogOut size={14} /> Kilépés
              </button>
            </div>
          </div>
        )}

        {/* --- NÉZETEK (TABS) --- */}

        {/* 1. DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="dashboard-layout">
            <div className="main-content">
              <div className="card" style={{ padding: 0 }}>
                <div className="card-header-section">
                  <button
                    onClick={() => setShowAddVehicleModal(true)}
                    style={{
                      width: "100%",
                      padding: "12px",
                      background: "var(--accent-blue)",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "1rem",
                      marginBottom: "15px",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Plus size={18} /> Új Jármű Felvétele
                  </button>
                  <div style={{ position: "relative" }}>
                    <Search
                      size={16}
                      style={{
                        position: "absolute",
                        left: "12px",
                        top: "12px",
                        color: "#666",
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Keresés..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{
                        paddingLeft: "35px",
                        background: "#27272a",
                        border: "1px solid #3f3f46",
                      }}
                    />
                  </div>
                </div>
                <div className="card-list-section">
                  <div className="vehicle-list-header">
                    Garázs ({filteredVehicles.length})
                  </div>
                  <ul className="vehicle-list">
                    {filteredVehicles.map((v) => {
                      const statusColor = getStatusColor(v.motExpiry);
                      let statusText = "OK";
                      let statusIcon = (
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "#10b981",
                          }}
                        ></div>
                      );
                      if (statusColor === "#ffcccc") {
                        statusText = "Lejárt";
                        statusIcon = (
                          <AlertTriangle size={12} color="#ef4444" />
                        );
                      } else if (statusColor === "#fff3cd") {
                        statusText = "Hamarosan";
                        statusIcon = (
                          <AlertTriangle size={12} color="#f59e0b" />
                        );
                      }
                      return (
                        <li key={v.id} className="stitch-vehicle-card">
                          <div className="vehicle-icon-box">
                            <Car size={20} color="#e4e4e7" />
                          </div>
                          <div className="vehicle-info">
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <span className="plate-number">
                                {v.licensePlate}
                              </span>
                            </div>
                            <div className="owner-name">
                              {v.customer?.name || "-"}
                            </div>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-end",
                              gap: "5px",
                            }}
                          >
                            <div
                              className={`status-badge ${statusColor === "#ffcccc" ? "badge-red" : statusColor === "#fff3cd" ? "badge-yellow" : "badge-green"}`}
                              style={{
                                padding: "2px 6px",
                                fontSize: "0.65rem",
                              }}
                            >
                              {statusIcon}
                              <span>{statusText}</span>
                            </div>
                            <div className="action-buttons">
                              {/* 👇 ITT A MÓDOSÍTOTT GOMB: Történet megnyitása */}
                              <button
                                onClick={() =>
                                  handleOpenHistory(v.id, v.licensePlate)
                                }
                                className="icon-btn"
                                style={{ padding: 5 }}
                                title="Történet"
                              >
                                <History size={16} />
                              </button>

                              <button
                                onClick={() => deleteVehicle(v.id)}
                                className="icon-btn"
                                style={{ padding: 5 }}
                                title="Törlés"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>

            <div className="sidebar">
              <div
                className="calendar-card"
                style={{ height: "100%", overflow: "hidden" }}
              >
                <Calendar
                  selectable
                  onSelectSlot={handleSelectSlot}
                  onSelectEvent={handleSelectEvent}
                  localizer={localizer}
                  events={processedEvents}
                  style={{ height: "100%" }}
                  culture="hu"
                  components={calendarComponents}
                  popup
                  tooltipAccessor="tooltip"
                  date={date}
                  onNavigate={onNavigate}
                  view="month"
                  onView={() => {}}
                />
              </div>
            </div>
          </div>
        )}

        {/* 2. NAPTÁR (TELJES KÉPERNYŐS) */}
        {activeTab === "schedule" && (
          <div
            className="card"
            style={{
              height: "100%",
              padding: "20px",
              background: "#18181b",
              border: "none",
            }}
          >
            <Calendar
              selectable
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              localizer={localizer}
              events={processedEvents}
              style={{ height: "100%" }}
              culture="hu"
              components={calendarComponents}
              popup
              tooltipAccessor="tooltip"
              date={date}
              onNavigate={onNavigate}
              view={view}
              onView={onView}
            />
          </div>
        )}

        {/* 3. JÁRMŰVEK */}
        {activeTab === "vehicles" && <Garage />}

        {/* 4. RAKTÁR */}
        {activeTab === "inventory" && <Inventory />}

        {/* 5. JÁRMŰ RÉSZLETEK (ÚJ OLDAL) */}
        {activeTab === "vehicle_details" && selectedVehicleObj && (
          <VehicleDetails
            vehicle={selectedVehicleObj}
            onBack={() => {
              setActiveTab("dashboard");
              setSelectedVehicleId(null);
            }}
          />
        )}
        {/* 6. BEÁLLÍTÁSOK */}
        {activeTab === "settings" && <Settings />}
        {/* 7. FELHASZNÁLÓKEZELÉS */}
        {activeTab === "userManagement" && <UserManagement />}

        {/* 8. EGYÉB (Placeholder - ezt frissítsd, hogy a settings már ne legyen itt) */}
        {activeTab !== "dashboard" &&
          activeTab !== "schedule" &&
          activeTab !== "inventory" &&
          activeTab !== "vehicles" &&
          activeTab !== "vehicle_details" &&
          activeTab !== "settings" &&
          activeTab !== "userManagement" && (
            <div
              style={{
                flex: 1,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                flexDirection: "column",
                color: "var(--text-muted)",
                border: "2px dashed var(--border-color)",
                borderRadius: "12px",
              }}
            >
              <div style={{ fontSize: "3rem", marginBottom: "20px" }}>🚧</div>
              <h2>Ez a modul fejlesztés alatt áll.</h2>
            </div>
          )}
      </div>

      {/* --- MODÁLOK --- */}
      {showAddVehicleModal && (
        <AddVehicleModal
          customers={customers}
          onClose={() => setShowAddVehicleModal(false)}
          onSuccess={() => {
            setShowAddVehicleModal(false);
            refreshAll();
          }}
        />
      )}
      {showApptModal && (
        <AppointmentModal
          selectedSlot={selectedSlot}
          onClose={() => setShowApptModal(false)}
          onSuccess={() => {
            setShowApptModal(false);
            refreshAll();
          }}
          vehicles={vehicles}
          customers={customers}
          setMessage={setMessage}
        />
      )}
      {showEventModal && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setShowEventModal(false)}
          onDelete={deleteAppointment}
          onOpenWorksheet={handleOpenWorksheet}
        />
      )}
      {showWorksheetModal &&
        selectedAppointmentId &&
        // 1. Megkeressük az időponthoz tartozó autót
        (() => {
          const appt = appointments.find((a) => a.id === selectedAppointmentId);
          const linkedVehicle = vehicles.find((v) => v.id === appt?.vehicleId);

          return (
            <WorksheetModal
              appointmentId={selectedAppointmentId}
              vehicleId={linkedVehicle?.id}
              // A név megjelenítéshez (ha véletlenül nincs meg a vehicle objektum)
              vehicleName={linkedVehicle ? linkedVehicle.licensePlate : "Jármű"}
              // 👇 ITT A LÉNYEG: Átadjuk a teljes objektumot!
              vehicle={linkedVehicle}
              onClose={() => setShowWorksheetModal(false)}
              onSave={() => {
                setShowWorksheetModal(false);
                refreshAll();
              }}
            />
          );
        })()}
    </div>
  );
}

export default App;
