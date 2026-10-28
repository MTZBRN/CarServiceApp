import { flushSync } from "react-dom";
import { Outlet, useOutletContext, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { useState, useCallback, useMemo, useEffect, type ReactNode } from "react";
import "./App.css";

// Ikonok
import {
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
import MainDashboard from "./components/Pages/MainDashboard";


import DevDashboard from "./components/Pages/Dashboard";





import Badge from "./components/ui/Badge";

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
  ToolbarProps,
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

// --- EGYEDI ESEMÉNY MEGJELENÍTÉS (KÁRTYA STÍLUS) ---
const CustomEvent = ({ event }: { event: CalendarEvent }) => {
  const isMot = event.type === "mot";
  // Szebb, telítettebb színek a kártyákhoz
  const bgColor = isMot
    ? "rgba(239, 68, 68, 0.15)"
    : "rgba(59, 130, 246, 0.15)";
  const borderColor = isMot ? "#ef4444" : "#3b82f6";
  const Icon = isMot ? FileText : Wrench;
  const vehicle = event.type === "service" ? event.originalData.vehicle : event.originalData;
  const customerName = vehicle?.customer?.name;
  const details =
    (event.type === "service" ? event.originalData.note : "") ||
    customerName ||
    event.desc ||
    "Egész napos";

  return (
    <div
      style={{
        background: bgColor,
        borderLeft: `4px solid ${borderColor}`,
        padding: "8px 10px",
        color: "#ffffff",
        fontSize: "0.85rem",
        borderRadius: "8px",
        marginBottom: "5px",
        minHeight: "58px",
        boxSizing: "border-box",
        boxShadow: "0 4px 10px rgba(2, 6, 23, 0.18)",
      }}
    >
      <div
        className="calendar-event-title"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontWeight: "600",
          marginBottom: "5px",
        }}
      >
        <Icon size={14} color={borderColor} style={{ flexShrink: 0 }} />
        <span
          className="calendar-event-name"
          style={{
            minWidth: 0,
          }}
        >
          {event.title}
        </span>
        <Badge tone={isMot ? "warning" : "info"}>
          {isMot ? "Műszaki" : "Szerviz"}
        </Badge>
      </div>
      <div className="calendar-event-details">
        {details}
      </div>
    </div>
  );
};

// --- EGYEDI FEJLÉC ---
const CustomToolbar = (toolbar: ToolbarProps<CalendarEvent>) => {
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
        <h2
          style={{
            textTransform: "capitalize",
            fontSize: "1.5rem",
            fontWeight: "bold",
            color: "white",
            margin: 0,
          }}
        >
          {format(toolbar.date, "MMMM yyyy")}
        </h2>
        <div
          style={{
            display: "flex",
            gap: "5px",
            background: "#27272a",
            padding: "4px",
            borderRadius: "8px",
            border: "1px solid #3f3f46",
          }}
        >
          <button
            onClick={goToBack}
            className="calendar-nav-btn"
            aria-label="Előző időszak"
            style={{
              width: "32px",
              height: "32px",
              color: "#a1a1aa",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={goToCurrent}
            className="calendar-today-btn"
            style={{
              background: "transparent",
              color: "white",
              padding: "0 15px",
              borderRadius: "6px",
              fontSize: "0.9rem",
              cursor: "pointer",
              fontWeight: 600,
              border: "none",
            }}
          >
            Ma
          </button>
          <button
            onClick={goToNext}
            className="calendar-nav-btn"
            aria-label="Következő időszak"
            style={{
              width: "32px",
              height: "32px",
              color: "#a1a1aa",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          background: "#27272a",
          padding: "4px",
          borderRadius: "8px",
          border: "1px solid #3f3f46",
        }}
      >
        {(["month", "week", "agenda"] as View[]).map((view) => (
          <button
            key={view}
            onClick={() => toolbar.onView(view)}
            style={{
              background: toolbar.view === view ? "#3b82f6" : "transparent",
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
                ? "Heti Beosztás"
                : "Lista"}
          </button>
        ))}
      </div>
    </div>
  );
};

function App() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const userName = user!.userName;
  const userRole = user!.role;
  const routeTabs: Record<string, string> = { dashboard: "dashboard", calendar: "schedule", vehicles: "vehicles", customers: "customers", inventory: "inventory", users: "userManagement", settings: "settings" };
  const activeTab = location.pathname.startsWith("/vehicles/") ? "vehicle_details" : routeTabs[location.pathname.split("/")[1]] || "";
  const setActiveTab = (tab: string) => { const route = Object.keys(routeTabs).find(key => routeTabs[key] === tab); if (route) navigate("/" + route); };
  const handleLogout = () => {
    if (window.confirm("Biztosan ki akarsz jelentkezni?")) { flushSync(() => logout()); navigate("/login", { replace: true }); }
  };

  // --- ADATOK BETÖLTÉSE ---
  const {
    vehicles,
    customers,
    calendarEvents,
    setMessage,
    deleteVehicle,
    deleteAppointment,
    appointments,
  } = useCarService();

  // --- NAVIGÁCIÓS STATE ---
  const [date, setDate] = useState<Date>(new Date());
  const [view, setView] = useState<View>("week");
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

  // Route changes dismiss page-local overlays, including browser back/forward.
  useEffect(() => {
    setShowAddVehicleModal(false);
    setShowApptModal(false);
    setShowEventModal(false);
    setShowWorksheetModal(false);
    setIsDevMode(false);
  }, [location.key]);

  // Naptár callbackek
  const onNavigate = useCallback((newDate: Date) => setDate(newDate), []);
  const onView = useCallback((newView: View) => setView(newView), []);

  // ✅ MINDEN ESEMÉNY EGÉSZ NAPOS (Így nem lesz rács, csak oszlopok!)
  const processedEvents = useMemo(
    () => (calendarEvents || []).map((evt) => ({ ...evt, allDay: true })),
    [calendarEvents],
  );

  const handleSelectSlot = ({ start }: SlotInfo) => {
    // Mindig éjféltől induljon a mentés, mert napot választunk
    start.setHours(0, 0, 0, 0);
    setSelectedSlot(start);
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
  const handleOpenHistory = (id: number) => navigate(`/vehicles/${id}`);

  // --- ✅ ÚJ STÍLUSOK: HETI NÉZET OSZLOPOKKÁ ALAKÍTÁSA ---
  const calendarStyles = `
    .rbc-calendar { color: #e4e4e7; font-family: inherit; }
    
    /* Fejléc napok */
    .rbc-header { 
      padding: 15px 0; 
      font-weight: 700; 
      color: #e4e4e7; 
      border-bottom: 1px solid #3f3f46; 
      text-transform: uppercase;
      font-size: 0.9rem;
      background: #202024;
    }
    
    .rbc-today { background-color: rgba(59, 130, 246, 0.05); }
    .rbc-off-range-bg { background: #09090b; opacity: 0.5; }
    
    /* Keretek és hátterek */
    .rbc-month-view, .rbc-time-view { 
      border: 1px solid #3f3f46; 
      background: #18181b; 
      border-radius: 12px; 
      overflow: hidden; 
    }
    .rbc-day-bg + .rbc-day-bg { border-left: 1px solid #3f3f46; }
    .rbc-header + .rbc-header { border-left: 1px solid #3f3f46; }

    /* --- EZ A VARÁZSLAT A HETI NÉZETHEZ --- */
    /* Eltüntetjük az alsó időrácsot (00:00 - 23:00) */
    .rbc-time-content { display: none !important; }
    
    /* A felső részt (ahol az egész naposak vannak) kihúzzuk teljes magasságra */
    .rbc-time-view { flex-direction: column; height: 100%; }
    .rbc-time-header { flex: 1; height: 100%; }
    .rbc-time-header-content { height: 100%; border-left: 1px solid #3f3f46; }
    .rbc-allday-cell { height: 100%; max-height: none !important; }
    .rbc-row-content { height: 100%; z-index: 10; }
    
    /* Események (Kártyák) */
    .rbc-event { 
      background: transparent !important; 
      padding: 2px 4px !important; 
      outline: none !important;
    }
    .rbc-event:focus { outline: none; }
    .rbc-event-label { display: none; } /* Nem kell az időpont felirat */
  `;

  if (isDevMode && userRole === "admin")
    return (
      <DevDashboard
        onBack={() => {
          setIsDevMode(false);
        }}
      />
    );

  const calendarComponents: Components<CalendarEvent> = {
    event: CustomEvent,
    toolbar: CustomToolbar,
  };

  return (
    <div className="container">
      <style>{calendarStyles}</style>

      {userRole === "admin" && <button
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
      </button>}

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
                  ? "Áttekintés"
                  : activeTab === "schedule"
                    ? "Szerviz Naptár"
                    : activeTab === "vehicles"
                      ? "Járművek"
                      : activeTab === "customers"
                        ? "Ügyfelek"
                        : activeTab === "userManagement"
                          ? "Felhasználók"
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

        <Outlet context={{ dashboard: (
          <MainDashboard
            vehicles={vehicles}
            appointments={appointments}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            onAddVehicle={() => setShowAddVehicleModal(true)}
            onOpenHistory={handleOpenHistory}
            onDeleteVehicle={deleteVehicle}
          />), calendar: (
          <div
            className="card"
            style={{
              height: "100%",
              padding: "20px",
              background: "#09090b",
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
              // Kivettem a Day view-t, mert az itt értelmetlen lenne
              views={["month", "week", "agenda"]}
            />
          </div>) } satisfies ScreenContext} />
      </div>

      {showAddVehicleModal && (
        <AddVehicleModal
          customers={customers}
          onClose={() => setShowAddVehicleModal(false)}
          onSuccess={() => {
            setShowAddVehicleModal(false);
          }}
        />
      )}
      {showApptModal && (
        <AppointmentModal
          selectedSlot={selectedSlot}
          onClose={() => setShowApptModal(false)}
          onSuccess={() => {
            setShowApptModal(false);
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
              }}
            />
          );
        })()}
    </div>
  );
}

export default App;

interface ScreenContext { dashboard: ReactNode; calendar: ReactNode; }
export function DashboardRoute() { return useOutletContext<ScreenContext>().dashboard; }
export function CalendarRoute() { return useOutletContext<ScreenContext>().calendar; }
