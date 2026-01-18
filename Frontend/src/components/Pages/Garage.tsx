import React, { useState } from "react";
import { useCarService } from "../../hooks/useCarService";
import { Vehicle } from "../../types";
import {
  Car,
  Search,
  Plus,
  Trash2,
  History,
  Wrench,
  User,
  ArrowRight,
} from "lucide-react";
import { InputField } from "../ui/FormElements";

// Komponensek
import WorksheetModal from "../modals/WorksheetModal";
import AddVehicleModal from "../modals/AddVehicleModal";
import VehicleDetails from "./VehicleDetails";

const Garage: React.FC = () => {
  const { vehicles, customers, refreshAll, deleteVehicle } = useCarService();

  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [worksheetTarget, setWorksheetTarget] = useState<{
    id: number;
    plate: string;
  } | null>(null);

  // Szűrés
  const filteredVehicles = vehicles.filter((v) => {
    const s = searchTerm.toLowerCase();
    return (
      v.licensePlate.toLowerCase().includes(s) ||
      v.make.toLowerCase().includes(s) ||
      v.model.toLowerCase().includes(s) ||
      (v.customer?.name || "").toLowerCase().includes(s)
    );
  });

  const handleDelete = async (id: number) => {
    if (window.confirm("Biztosan törölni akarod ezt a járművet?")) {
      await deleteVehicle(id);
      refreshAll();
    }
  };

  // --- RÉSZLETES NÉZET ---
  if (selectedVehicle) {
    return (
      <VehicleDetails
        vehicle={selectedVehicle}
        onBack={() => setSelectedVehicle(null)}
      />
    );
  }

  // --- LISTA NÉZET ---
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        animation: "fadeIn 0.3s ease-in-out",
      }}
    >
      {/* 1. ÚJ DESIGN FEJLÉC (Toolbar) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          padding: "10px 0",
        }}
      >
        {/* Bal oldal: Cím és Kereső */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            flex: 1,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "1.5rem",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <Car size={28} color="#3b82f6" /> Garázs
          </h2>
          <div style={{ width: "350px" }}>
            <InputField
              icon={Search}
              placeholder="Rendszám, Típus vagy Ügyfél keresése..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                marginBottom: 0,
                height: "45px",
                background: "#18181b",
                border: "1px solid #3f3f46",
              }}
            />
          </div>
        </div>

        {/* Jobb oldal: Hozzáadás gomb */}
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-add"
          style={{
            padding: "0 25px",
            height: "45px",
            fontSize: "1rem",
            fontWeight: 600,
            boxShadow: "0 4px 6px -1px rgba(59, 130, 246, 0.5)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <Plus size={20} /> Új Jármű
        </button>
      </div>

      {/* 2. GRID LISTA */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "20px",
          overflowY: "auto",
          paddingBottom: "20px",
        }}
      >
        {filteredVehicles.map((v) => (
          <div
            key={v.id}
            className="card"
            style={{
              padding: "0",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              border: "1px solid #3f3f46",
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow =
                "0 10px 15px -3px rgba(0,0,0,0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {/* Kártya Fejléc */}
            <div
              style={{
                padding: "15px",
                background: "#27272a",
                borderBottom: "1px solid #3f3f46",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "1.3rem",
                    letterSpacing: "1px",
                    color: "white",
                  }}
                >
                  {v.licensePlate}
                </h3>
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "#a1a1aa",
                    marginTop: "2px",
                  }}
                >
                  {v.make} {v.model} <span style={{ opacity: 0.5 }}>|</span>{" "}
                  {v.year}
                </div>
              </div>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "#18181b",
                  border: "1px solid #3f3f46",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Car size={20} color="#71717a" />
              </div>
            </div>

            {/* Kártya Tartalom */}
            <div style={{ padding: "20px", flex: 1, background: "#18181b" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "15px",
                }}
              >
                <User size={16} color="#3b82f6" />
                <span style={{ color: "white", fontWeight: 500 }}>
                  {v.customer?.name || "Nincs tulajdonos"}
                </span>
              </div>

              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  fontSize: "0.85rem",
                  background: "#27272a",
                  border: "1px solid #3f3f46",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ color: "#a1a1aa" }}>Műszaki vizsga:</span>
                <span
                  style={{
                    fontWeight: "bold",
                    color:
                      v.motExpiry && new Date(v.motExpiry) < new Date()
                        ? "#ef4444"
                        : "#10b981",
                  }}
                >
                  {v.motExpiry
                    ? new Date(v.motExpiry).toLocaleDateString()
                    : "-"}
                </span>
              </div>
            </div>

            {/* Akciógombok */}
            <div
              style={{
                padding: "12px",
                background: "#27272a",
                borderTop: "1px solid #3f3f46",
                display: "flex",
                gap: "10px",
              }}
            >
              <button
                onClick={() =>
                  setWorksheetTarget({ id: v.id, plate: v.licensePlate })
                }
                className="btn-add"
                style={{
                  flex: 1,
                  height: "38px",
                  fontSize: "0.9rem",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Wrench size={16} /> Szerviz
              </button>

              <button
                onClick={() => setSelectedVehicle(v)}
                style={{
                  flex: 1,
                  height: "38px",
                  background: "#3f3f46",
                  border: "1px solid #52525b",
                  color: "white",
                  borderRadius: "6px",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "0.9rem",
                }}
              >
                <History size={16} /> Adatlap
              </button>

              <button
                onClick={() => handleDelete(v.id)}
                style={{
                  width: "38px",
                  height: "38px",
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid #ef4444",
                  color: "#ef4444",
                  borderRadius: "6px",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
                title="Törlés"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}

        {filteredVehicles.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              padding: "60px",
              color: "#52525b",
            }}
          >
            <Car size={64} style={{ marginBottom: "20px", opacity: 0.2 }} />
            <h3>Nincs találat</h3>
            <p>Próbálj másik keresőszót vagy vegyél fel új járművet.</p>
          </div>
        )}
      </div>

      {/* MODÁLOK */}
      {showAddModal && (
        <AddVehicleModal
          customers={customers}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            refreshAll();
          }}
        />
      )}

      {worksheetTarget && (
        <WorksheetModal
          appointmentId={null}
          vehicleId={worksheetTarget.id}
          vehicleName={worksheetTarget.plate}
          onClose={() => setWorksheetTarget(null)}
          onSave={() => {
            setWorksheetTarget(null);
            refreshAll();
          }}
        />
      )}
    </div>
  );
};

export default Garage;
