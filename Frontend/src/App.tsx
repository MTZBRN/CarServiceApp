import React, { useState, useCallback, useMemo, useEffect } from "react";
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
import MainDashboard from "./components/pages/MainDashboard";
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

// --- EGYEDI ESEMÉNY MEGJELENÍTÉS ---
const CustomEvent = ({ event }: { event: CalendarEvent }) => {
  const isMot = event.type === "mot";
  const bgColor = isMot ? "rgba(239, 68, 68, 0.2)" : "rgba(59, 130, 246, 0.2)";
  const accentColor = isMot ? "#ef4444" : "#3b82f6";
  const Icon = isMot ? FileText : Wrench;

  return (
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
    </div>
  );
};

// --- EGYEDI FEJLÉC ---
const CustomToolbar = (toolbar: any) => {
  const goToBack = () => toolbar.onNavigate("PREV");
  const goToNext = () => toolbar.onNavigate("NEXT");
  const goToCurrent = () => toolbar.onNavigate("TODAY");

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
        <span
          style={{
            textTransform: "capitalize",
            fontSize: "1.2rem",
            fontWeight: "bold",
            color: "white",
          }}
        >
          {format(toolbar.date, "MMMM yyyy")}
        </span>
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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    const savedUser = localStorage.getItem("currentUser");
    const savedRole = localStorage.getItem("userRole");

    if (token && savedUser) {
      setIsLoggedIn(true);
      setUserName(savedUser);
      setUserRole(savedRole || "mechanic");
    }
    setLoadingAuth(false);
  }, []);

  const handleLogin = (token: string, name: string, role: string) => {
    localStorage.setItem("authToken", token);
    localStorage.setItem("currentUser", name);
    localStorage.setItem("userRole", role);
    setIsLoggedIn(true);
    setUserName(name);
    setUserRole(role);
  };

  const handleLogout = () => {
    if (window.confirm("Biztosan ki akarsz jelentkezni?")) {
      localStorage.removeItem("authToken");
      localStorage.removeItem("currentUser");
      localStorage.removeItem("userRole");
      setIsLoggedIn(false);
      setUserName("");
      setUserRole("");
      setActiveTab("dashboard");
    }
  };

  // --- ADATOK BETÖLTÉSE ---
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
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [isDevMode, setIsDevMode] = useState(false);

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

  // Naptár callbackek
  const onNavigate = useCallback((newDate: Date) => setDate(newDate), []);
  const onView = useCallback((newView: View) => setView(newView), []);
  const processedEvents = useMemo(
    () => (calendarEvents || []).map((evt) => ({ ...evt, allDay: true })),
    [calendarEvents],
  );

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
  const handleOpenHistory = (id: number) => {
    setSelectedVehicleId(id);
    setActiveTab("vehicle_details");
  };

  const selectedVehicleObj = vehicles.find((v) => v.id === selectedVehicleId);

  // --- RENDERELÉS ---
  if (loadingAuth) return null;
  if (!isLoggedIn) return <Login onLogin={handleLogin} />;
  if (isDevMode)
    return (
      <DevDashboard
        onBack={() => {
          setIsDevMode(false);
          refreshAll();
        }}
      />
    );

  const calendarComponents: Components<CalendarEvent> = {
    event: CustomEvent as any,
    toolbar: CustomToolbar,
  };

  return (
    <div className="container">
      <button
        onClick={() => setIsDevMode(true)}
        className="dev-mode-btn"
        style={{
          position: "fixed",
          bottom: "10px",
          right: "10px",
          zIndex: 9999,
          opacity: 0.3,
        }}
      >
        <Wrench size={14} />
      </button>

      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        currentUser={userName}
        userRole={userRole}
      />

      <div className="content-area">
        {activeTab !== "vehicle_details" && (
          <div className="header">
            <div>
              <h1 style={{ textTransform: "capitalize" }}>
                {activeTab === "dashboard"
                  ? "Áttekintés 🚘"
                  : activeTab === "schedule"
                    ? "Szerviz Naptár 📅"
                    : activeTab === "vehicles"
                      ? "Járművek 🚙"
                      : activeTab === "userManagement"
                        ? "Felhasználók 👥"
                        : "Beállítások"}
              </h1>
            </div>
            <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
              <div className="mini-stat">
                <span className="mini-stat-label">Szerepkör:</span>{" "}
                <span className="mini-stat-value" style={{ color: "#3b82f6" }}>
                  {userRole}
                </span>
              </div>
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

        {activeTab === "dashboard" && (
          <MainDashboard
            vehicles={vehicles}
            appointments={appointments}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            onAddVehicle={() => setShowAddVehicleModal(true)}
            onOpenHistory={handleOpenHistory}
            onDeleteVehicle={deleteVehicle}
          />
        )}
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
              date={date}
              onNavigate={onNavigate}
              view={view}
              onView={onView}
            />
          </div>
        )}
        {activeTab === "vehicles" && <Garage />}
        {activeTab === "inventory" && <Inventory />}
        {activeTab === "vehicle_details" && selectedVehicleObj && (
          <VehicleDetails
            vehicle={selectedVehicleObj}
            onBack={() => {
              setActiveTab("dashboard");
              setSelectedVehicleId(null);
            }}
          />
        )}
        {activeTab === "settings" && <Settings />}
        {activeTab === "userManagement" && userRole === "admin" && (
          <UserManagement />
        )}
      </div>

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
        (() => {
          const appt = appointments.find((a) => a.id === selectedAppointmentId);
          const linkedVehicle = vehicles.find((v) => v.id === appt?.vehicleId);
          return (
            <WorksheetModal
              appointmentId={selectedAppointmentId}
              vehicleId={linkedVehicle?.id}
              vehicleName={linkedVehicle?.licensePlate || "Jármű"}
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
