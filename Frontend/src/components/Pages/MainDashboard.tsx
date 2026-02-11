import React, { useMemo } from "react";
import {
  Car,
  AlertTriangle,
  Search,
  Trash2,
  History,
  Plus,
  Calendar as CalIcon,
  Clock,
  Phone,
  CheckCircle,
} from "lucide-react";
import { Vehicle, Appointment } from "../../types";
import { differenceInDays } from "date-fns";

interface MainDashboardProps {
  vehicles: Vehicle[];
  appointments: Appointment[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onAddVehicle: () => void;
  onOpenHistory: (id: number, plate: string) => void;
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
  // --- LOGIKA ---
  const stats = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    // 1. MAI MUNKÁK
    const todaysJobs = appointments.filter((app) => {
      const appDate = new Date(app.startTime || app.endTime);
      return appDate.toISOString().split("T")[0] === todayStr;
    });

    // 2. LEJÁRT MŰSZAKI
    const expiredMot = vehicles.filter(
      (v) => v.motExpiry && new Date(v.motExpiry) < now,
    );

    // 3. LEJÁR 30 NAPON BELÜL
    const upcomingMot = vehicles.filter((v) => {
      if (!v.motExpiry) return false;
      const expiry = new Date(v.motExpiry);
      return expiry >= now && expiry <= thirtyDaysFromNow;
    });

    return { todaysJobs, expiredMot, upcomingMot };
  }, [vehicles, appointments]);

  // Segéd: Hátralévő napok kiszámítása
  const getDaysRemaining = (expiryDate: string) => {
    const now = new Date();
    const expiry = new Date(expiryDate); // Javítva: parseISO helyett sima Date
    const days = differenceInDays(expiry, now);

    if (days < 0)
      return {
        text: "Lejárt",
        color: "#ef4444",
        icon: <AlertTriangle size={14} color="#ef4444" />,
      };
    if (days === 0)
      return {
        text: "MA jár le!",
        color: "#eab308",
        icon: <Clock size={14} color="#eab308" />,
      };
    return {
      text: `${days} nap múlva`,
      color: "#eab308",
      icon: <Clock size={14} color="#eab308" />,
    };
  };

  // Keresés logika
  const filteredVehicles = vehicles.filter((v) => {
    const search = searchTerm.toLowerCase();
    const plate = v.licensePlate.toLowerCase();
    const owner = v.customer?.name.toLowerCase() || ""; // Névre is keresünk
    return plate.includes(search) || owner.includes(search);
  });

  // STÍLUSOK
  const scrollableContainer: React.CSSProperties = {
    flex: 1,
    overflowY: "auto",
    padding: "15px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    scrollbarWidth: "thin",
    scrollbarColor: "#3f3f46 transparent",
  };

  return (
    <div
      className="dashboard-layout"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "20px",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* --- BAL OSZLOP: JÁRMŰ LISTA + TELEFONSZÁM --- */}
      <div
        className="card"
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
          padding: 0,
          background: "#18181b",
        }}
      >
        <div
          style={{
            padding: "20px",
            borderBottom: "1px solid #3f3f46",
            background: "#27272a",
          }}
        >
          <button
            onClick={onAddVehicle}
            className="btn-primary"
            style={{
              width: "100%",
              marginBottom: "15px",
              justifyContent: "center",
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
                color: "#a1a1aa",
              }}
            />
            <input
              type="text"
              placeholder="Keresés rendszám vagy név..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              style={{
                width: "100%",
                paddingLeft: "35px",
                background: "#18181b",
              }}
            />
          </div>
        </div>
        <div style={scrollableContainer}>
          <div
            style={{
              color: "#a1a1aa",
              fontSize: "0.85rem",
              fontWeight: "bold",
              marginBottom: 5,
            }}
          >
            ÖSSZES JÁRMŰ ({filteredVehicles.length})
          </div>
          {filteredVehicles.map((v) => (
            <div
              key={v.id}
              style={{
                background: "#27272a",
                padding: "12px",
                borderRadius: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                border: "1px solid #3f3f46",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    background: "#3f3f46",
                    padding: 8,
                    borderRadius: "50%",
                  }}
                >
                  <Car size={18} color="#e4e4e7" />
                </div>
                <div>
                  <div
                    style={{
                      fontWeight: "bold",
                      color: "white",
                      fontSize: "1.05rem",
                    }}
                  >
                    {v.licensePlate}
                  </div>
                  <div
                    style={{
                      fontSize: "0.85rem",
                      color: "#a1a1aa",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    {v.customer?.name || "-"}
                    {/* TELEFONSZÁM KIÍRÁSA */}
                    {v.customer?.phoneNumber && (
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 3,
                          color: "#71717a",
                        }}
                      >
                        • <Phone size={10} /> {v.customer.phoneNumber}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="action-buttons">
                <button
                  onClick={() => onOpenHistory(v.id, v.licensePlate)}
                  className="icon-btn"
                >
                  <History size={16} />
                </button>
                <button
                  onClick={() => onDeleteVehicle(v.id)}
                  className="icon-btn"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- JOBB OSZLOP: TEENDŐK + TELEFONSZÁM --- */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          height: "100%",
          overflow: "hidden",
        }}
      >
        {/* MAI MUNKÁK */}
        <div
          className="card"
          style={{
            padding: "20px",
            background: "#18181b",
            border: "1px solid #3f3f46",
            display: "flex",
            flexDirection: "column",
            maxHeight: "40%",
          }}
        >
          <h3
            style={{
              margin: "0 0 15px 0",
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "#3b82f6",
              fontSize: "1.1rem",
            }}
          >
            <CalIcon size={20} /> Mai Munkák ({stats.todaysJobs.length})
          </h3>
          <div style={scrollableContainer}>
            {stats.todaysJobs.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: "#52525b",
                  padding: "20px",
                  border: "1px dashed #3f3f46",
                  borderRadius: "8px",
                }}
              >
                Nincs mára beírt munka.
              </div>
            ) : (
              stats.todaysJobs.map((job) => (
                <div
                  key={job.id}
                  style={{
                    background: "#27272a",
                    padding: "12px",
                    borderRadius: "8px",
                    borderLeft: "4px solid #3b82f6",
                  }}
                >
                  <div
                    style={{
                      fontWeight: "bold",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {job.vehicle?.licensePlate}{" "}
                    <span style={{ fontWeight: "normal", color: "#a1a1aa" }}>
                      - {job.description}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "#71717a",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      marginTop: 4,
                    }}
                  >
                    👤 {job.vehicle?.customer?.name}
                    {job.vehicle?.customer?.phoneNumber && (
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        • <Phone size={10} /> {job.vehicle.customer.phoneNumber}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* FIGYELMEZTETÉSEK */}
        <div
          className="card"
          style={{
            padding: "20px",
            background: "#18181b",
            border: "1px solid #3f3f46",
            display: "flex",
            flexDirection: "column",
            flex: 1,
            overflow: "hidden",
          }}
        >
          <h3
            style={{
              margin: "0 0 15px 0",
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "#ef4444",
              fontSize: "1.1rem",
            }}
          >
            <AlertTriangle size={20} /> Műszaki Figyelmeztetések (
            {stats.expiredMot.length + stats.upcomingMot.length})
          </h3>
          <div style={scrollableContainer}>
            {/* LEJÁRTAK */}
            {stats.expiredMot.map((v) => {
              const status = getDaysRemaining(v.motExpiry!);
              return (
                <div
                  key={v.id}
                  style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    padding: "12px",
                    borderRadius: "8px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: "bold",
                        color: "#fca5a5",
                        fontSize: "1.1rem",
                      }}
                    >
                      {v.licensePlate}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#ef4444" }}>
                      {v.customer?.name}
                    </div>
                    {/* TELEFONSZÁM ITT IS: */}
                    {v.customer?.phoneNumber && (
                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: "#fca5a5",
                          marginTop: 2,
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <Phone size={12} /> {v.customer.phoneNumber}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        color: status.color,
                        fontWeight: "bold",
                        fontSize: "0.9rem",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        justifyContent: "flex-end",
                      }}
                    >
                      {status.icon} {status.text}
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "#fca5a5",
                        marginTop: 2,
                      }}
                    >
                      {new Date(v.motExpiry!).toLocaleDateString("hu-HU")}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* KÖZELGŐK */}
            {stats.upcomingMot.map((v) => {
              const status = getDaysRemaining(v.motExpiry!);
              return (
                <div
                  key={v.id}
                  style={{
                    background: "rgba(234, 179, 8, 0.1)",
                    padding: "12px",
                    borderRadius: "8px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    border: "1px solid rgba(234, 179, 8, 0.3)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: "bold",
                        color: "#fde047",
                        fontSize: "1.1rem",
                      }}
                    >
                      {v.licensePlate}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#eab308" }}>
                      {v.customer?.name}
                    </div>
                    {/* TELEFONSZÁM ITT IS: */}
                    {v.customer?.phoneNumber && (
                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: "#fde047",
                          marginTop: 2,
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <Phone size={12} /> {v.customer.phoneNumber}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        color: status.color,
                        fontWeight: "bold",
                        fontSize: "0.9rem",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        justifyContent: "flex-end",
                      }}
                    >
                      {status.icon} {status.text}
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "#fde047",
                        marginTop: 2,
                      }}
                    >
                      {new Date(v.motExpiry!).toLocaleDateString("hu-HU")}
                    </div>
                  </div>
                </div>
              );
            })}

            {stats.expiredMot.length === 0 &&
              stats.upcomingMot.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    color: "#52525b",
                    padding: "20px",
                    fontStyle: "italic",
                  }}
                >
                  Nincs lejárt vagy közelgő műszaki.{" "}
                  <CheckCircle
                    size={16}
                    style={{ display: "inline", verticalAlign: "middle" }}
                  />
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainDashboard;
