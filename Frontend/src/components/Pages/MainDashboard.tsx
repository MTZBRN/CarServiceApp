import React from "react";
import {
  Car,
  Calendar,
  AlertTriangle,
  Search,
  Plus,
  History,
  Trash2,
  CheckCircle,
} from "lucide-react";
import { Vehicle, Appointment } from "../../types";
// ✅ JAVÍTVA: Kivettük a parseISO-t, mert nem találta
import { isSameDay, differenceInDays, format } from "date-fns";

interface MainDashboardProps {
  vehicles: Vehicle[];
  appointments: Appointment[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onAddVehicle: () => void;
  onOpenHistory: (id: number) => void;
  onDeleteVehicle: (id: number) => void;
}

const MainDashboard: React.FC<MainDashboardProps> = ({
  vehicles,
  appointments,
  searchTerm,
  setSearchTerm,
  onAddVehicle,
  onOpenHistory,
  onDeleteVehicle,
}) => {
  // --- SZŰRÉSEK ---

  // 1. Mai munkák
  const today = new Date();
  const todaysAppointments = appointments.filter((appt) =>
    // ✅ JAVÍTVA: new Date() használata parseISO helyett
    isSameDay(new Date(appt.startTime), today),
  );

  // 2. Járművek keresése
  const filteredVehicles = vehicles.filter(
    (v) =>
      v.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.customer?.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // 3. Műszaki vizsga figyelmeztetések
  const motAlerts = vehicles
    .filter((v) => {
      if (!v.motExpiry) return false;
      const expiry = new Date(v.motExpiry);
      const diff = differenceInDays(expiry, today);
      return diff <= 30;
    })
    .sort(
      (a, b) =>
        new Date(a.motExpiry!).getTime() - new Date(b.motExpiry!).getTime(),
    );

  // Kártya stílus
  const cardStyle = {
    background: "#18181b",
    borderRadius: "16px",
    padding: "25px",
    border: "1px solid #27272a",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "25px",
        paddingBottom: "50px",
        height: "calc(100vh - 100px)",
        gridTemplateRows: "auto 1fr",
      }}
    >
      {/* 1. BAL OSZLOP: KERESŐ ÉS LISTA */}
      <div
        style={{
          gridRow: "1 / -1",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {/* Keresőmező és Gomb */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={onAddVehicle}
            className="btn-add"
            style={{
              padding: "0 20px",
              fontWeight: "600",
              background: "white",
              color: "black",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              height: "45px",
              borderRadius: "8px",
              whiteSpace: "nowrap",
            }}
          >
            <Plus size={18} /> Új Jármű
          </button>

          <div style={{ position: "relative", flex: 1 }}>
            <Search
              size={18}
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#71717a",
              }}
            />
            <input
              type="text"
              placeholder="Keresés rendszám vagy név..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                height: "45px",
                padding: "0 15px 0 45px",
                background: "#18181b",
                border: "1px solid #3f3f46",
                borderRadius: "8px",
                color: "white",
                fontSize: "0.95rem",
                outline: "none",
              }}
            />
          </div>
        </div>

        {/* Jármű Lista */}
        <div style={{ ...cardStyle, overflow: "hidden", padding: 0 }}>
          <div
            style={{
              padding: "15px 20px",
              borderBottom: "1px solid #27272a",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#202024",
            }}
          >
            <span
              style={{
                fontWeight: "600",
                color: "#a1a1aa",
                fontSize: "0.85rem",
                textTransform: "uppercase",
              }}
            >
              Összes Jármű ({filteredVehicles.length})
            </span>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "15px" }}>
            {filteredVehicles.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: "#52525b",
                  marginTop: "30px",
                }}
              >
                Nincs találat.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {filteredVehicles.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    style={{
                      background: "#27272a",
                      borderRadius: "10px",
                      padding: "15px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      border: "1px solid #3f3f46",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          marginBottom: "4px",
                        }}
                      >
                        <Car size={16} color="#a1a1aa" />
                        <span
                          style={{
                            fontWeight: "bold",
                            fontSize: "1.1rem",
                            color: "white",
                          }}
                        >
                          {vehicle.licensePlate}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "#a1a1aa" }}>
                        {vehicle.make} {vehicle.model}
                        {vehicle.customer ? ` | ${vehicle.customer.name}` : ""}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => onOpenHistory(vehicle.id)}
                        title="Adatlap megnyitása"
                        style={{
                          background: "#3f3f46",
                          border: "none",
                          width: "36px",
                          height: "36px",
                          borderRadius: "8px",
                          color: "white",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <History size={18} />
                      </button>
                      <button
                        onClick={() => onDeleteVehicle(vehicle.id)}
                        title="Törlés"
                        style={{
                          background: "rgba(239, 68, 68, 0.1)",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          width: "36px",
                          height: "36px",
                          borderRadius: "8px",
                          color: "#ef4444",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. JOBB OSZLOP: MAI MUNKÁK + FIGYELMEZTETÉSEK */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "25px",
          height: "100%",
        }}
      >
        {/* MAI MUNKÁK */}
        <div style={{ ...cardStyle, flex: 1, maxHeight: "50%" }}>
          <h3
            style={{
              margin: "0 0 20px 0",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              color: "#60a5fa",
              fontSize: "1.1rem",
            }}
          >
            <Calendar size={20} /> Mai Munkák ({todaysAppointments.length})
          </h3>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {todaysAppointments.length === 0 ? (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px dashed #3f3f46",
                  borderRadius: "10px",
                  color: "#52525b",
                }}
              >
                Nincs mára beírt munka.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {todaysAppointments.map((appt) => {
                  const vehicle = vehicles.find((v) => v.id === appt.vehicleId);
                  return (
                    <div
                      key={appt.id}
                      onClick={() => vehicle && onOpenHistory(vehicle.id)}
                      style={{
                        padding: "15px",
                        background: "rgba(59, 130, 246, 0.1)",
                        borderLeft: "4px solid #3b82f6",
                        borderRadius: "8px",
                        cursor: "pointer",
                        transition: "background 0.2s",
                      }}
                      className="hover-card"
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "5px",
                        }}
                      >
                        <span
                          style={{
                            fontWeight: "bold",
                            color: "white",
                            fontSize: "1rem",
                          }}
                        >
                          {vehicle?.licensePlate || "Ismeretlen jármű"}
                        </span>
                        <span
                          style={{
                            fontSize: "0.8rem",
                            color: "#93c5fd",
                            background: "rgba(59, 130, 246, 0.2)",
                            padding: "2px 8px",
                            borderRadius: "12px",
                          }}
                        >
                          {/* ✅ ITT VOLT A TYPE HIBA - most már működni fog a types.ts frissítése után */}
                          {appt.type === "service" ? "Szerviz" : "Műszaki"}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.9rem", color: "#bfdbfe" }}>
                        {appt.note || "Nincs megjegyzés"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* MŰSZAKI FIGYELMEZTETÉSEK */}
        <div style={{ ...cardStyle, flex: 1, maxHeight: "50%" }}>
          <h3
            style={{
              margin: "0 0 20px 0",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              color: "#ef4444",
              fontSize: "1.1rem",
            }}
          >
            <AlertTriangle size={20} /> Műszaki Figyelmeztetések (
            {motAlerts.length})
          </h3>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {motAlerts.length === 0 ? (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px dashed #3f3f46",
                  borderRadius: "10px",
                  color: "#52525b",
                }}
              >
                <CheckCircle
                  size={24}
                  style={{ marginRight: "10px", color: "#10b981" }}
                />
                Minden rendben!
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {motAlerts.map((vehicle) => {
                  const expiry = new Date(vehicle.motExpiry!);
                  const diff = differenceInDays(expiry, today);
                  let label = "";
                  let color = "";

                  if (diff < 0) {
                    label = "LEJÁRT!";
                    color = "#ef4444";
                  } else if (diff === 0) {
                    label = "MA jár le!";
                    color = "#f59e0b";
                  } else {
                    label = `${diff} nap múlva`;
                    color = "#eab308";
                  }

                  return (
                    <div
                      key={vehicle.id}
                      onClick={() => onOpenHistory(vehicle.id)}
                      style={{
                        padding: "15px",
                        background: "rgba(239, 68, 68, 0.05)",
                        border: `1px solid ${color}`,
                        borderRadius: "8px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: "bold",
                            color: color,
                            marginBottom: "2px",
                          }}
                        >
                          {vehicle.licensePlate}
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "#a1a1aa" }}>
                          {vehicle.customer?.name}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontWeight: "bold",
                            color: color,
                            fontSize: "0.9rem",
                          }}
                        >
                          {label}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "#71717a" }}>
                          {format(expiry, "yyyy. MM. dd.")}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainDashboard;
