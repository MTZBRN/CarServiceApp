import React, { useState } from "react"; // useEffect nem is kell már az időhöz
import { apiService } from "../../api/apiservice";
import { Vehicle, Customer } from "../../types";
import {
  X,
  Save,
  Calendar,
  User,
  Car,
  AlignLeft,
  PlusCircle,
  Wrench,
} from "lucide-react";
import { InputField, SelectField } from "../ui/FormElements";
import { format } from "date-fns";

interface Props {
  selectedSlot: Date | null;
  onClose: () => void;
  onSuccess: () => void;
  vehicles: Vehicle[];
  customers: Customer[];
  setMessage: (msg: string | null) => void;
  onRefreshData?: () => void;
}

const AppointmentModal: React.FC<Props> = ({
  selectedSlot,
  onClose,
  onSuccess,
  vehicles,
  customers,
  setMessage,
  onRefreshData,
}) => {
  // Csak dátumot tárolunk, időt nem!
  const [formData, setFormData] = useState({
    vehicleId: 0,
    customerId: 0,
    date: selectedSlot ? format(selectedSlot, "yyyy-MM-dd") : "",
    description: "",
    type: "service",
  });

  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newClientData, setNewClientData] = useState({
    name: "",
    phone: "",
    email: "",
    plate: "",
    make: "",
    model: "",
    year: new Date().getFullYear(),
  });

  const availableVehicles = formData.customerId
    ? vehicles.filter((v) => v.customerId === formData.customerId)
    : vehicles;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.vehicleId === 0) return alert("Válassz járművet!");

    try {
      // Dátum szétszedése
      const [year, month, day] = formData.date.split("-").map(Number);

      // UTC-ben mentjük el 00:00-tól 23:59-ig.
      // Így biztosan "lefedi" a napot minden időzónában.
      const startDateTime = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
      const endDateTime = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));

      await apiService.createAppointment({
        vehicleId: formData.vehicleId,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        description: formData.description,
      });

      setMessage("Időpont sikeresen rögzítve! ✅");
      onSuccess();
    } catch (err) {
      console.error(err);
      alert("Hiba történt a mentés során!");
    }
  };

  const handleQuickAdd = async () => {
    // ... (Ez a rész változatlan maradhat a gyors felvételhez) ...
    if (!newClientData.name || !newClientData.plate)
      return alert("Név és Rendszám kötelező!");
    try {
      const custRes = await apiService.createCustomer({
        name: newClientData.name,
        phoneNumber: newClientData.phone,
        email: newClientData.email,
        address: "",
      });
      await apiService.createVehicle({
        licensePlate: newClientData.plate,
        make: newClientData.make,
        model: newClientData.model,
        year: newClientData.year,
        customerId: custRes.data.id,
        motExpiry: new Date().toISOString(),
      });
      if (onRefreshData) onRefreshData();
      alert("Sikeres felvétel! Válaszd ki a listából.");
      setShowQuickAdd(false);
      setNewClientData({
        name: "",
        phone: "",
        email: "",
        plate: "",
        make: "",
        model: "",
        year: 2024,
      });
    } catch (e) {
      alert("Hiba a gyors felvételnél.");
    }
  };

  return (
    <div className="modal-overlay modal-on-top" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "650px", width: "100%" }}
      >
        {/* FEJLÉC */}
        <div
          style={{
            padding: "20px",
            borderBottom: "1px solid #27272a",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#18181b",
          }}
        >
          <h3
            style={{
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: "1.2rem",
            }}
          >
            <Calendar size={22} color="#3b82f6" /> Új Munka Felvétele
          </h3>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: "25px", maxHeight: "80vh", overflowY: "auto" }}>
          {/* 1. DÁTUM SZEKCIÓ (Egyszerűsítve) */}
          <div
            style={{
              background: "#27272a",
              padding: "15px",
              borderRadius: "8px",
              marginBottom: "20px",
              border: "1px solid #3f3f46",
            }}
          >
            <div
              style={{ display: "flex", flexDirection: "column", gap: "5px" }}
            >
              <label
                style={{
                  color: "#a1a1aa",
                  fontSize: "0.85rem",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                Melyik napra?
              </label>
              <InputField
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                icon={Calendar}
                required
                style={{ fontSize: "1.1rem" }} // Kicsit nagyobb betűméret a dátumnak
              />
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#71717a",
                  marginTop: "5px",
                }}
              >
                ℹ️ A munka egész naposként kerül bejegyzésre.
              </div>
            </div>
          </div>

          {/* 2. ÜGYFÉL ÉS JÁRMŰ (Változatlan, csak a design) */}
          <div style={{ marginBottom: "20px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <span
                style={{
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  color: "#e4e4e7",
                  textTransform: "uppercase",
                }}
              >
                Ügyfél és Jármű
              </span>
              <button
                type="button"
                onClick={() => setShowQuickAdd(!showQuickAdd)}
                style={{
                  background: "transparent",
                  color: "#3b82f6",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: "0.85rem",
                }}
              >
                {showQuickAdd ? <X size={14} /> : <PlusCircle size={14} />}{" "}
                {showQuickAdd ? "Mégse" : "Új Ügyfél Felvétele"}
              </button>
            </div>

            {showQuickAdd && (
              /* Gyors felvétel panel (ugyanaz mint volt) */
              <div
                style={{
                  background: "#1e1e24",
                  border: "1px dashed #3b82f6",
                  borderRadius: "8px",
                  padding: "15px",
                  marginBottom: "15px",
                }}
              >
                <h4
                  style={{
                    marginTop: 0,
                    color: "#3b82f6",
                    fontSize: "0.95rem",
                  }}
                >
                  Gyors Felvétel
                </h4>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "10px",
                    marginBottom: "10px",
                  }}
                >
                  <InputField
                    placeholder="Név"
                    value={newClientData.name}
                    onChange={(e) =>
                      setNewClientData({
                        ...newClientData,
                        name: e.target.value,
                      })
                    }
                    style={{ height: 35 }}
                  />
                  <InputField
                    placeholder="Tel.szám"
                    value={newClientData.phone}
                    onChange={(e) =>
                      setNewClientData({
                        ...newClientData,
                        phone: e.target.value,
                      })
                    }
                    style={{ height: 35 }}
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "10px",
                    marginBottom: "10px",
                  }}
                >
                  <InputField
                    placeholder="Rendszám"
                    value={newClientData.plate}
                    onChange={(e) =>
                      setNewClientData({
                        ...newClientData,
                        plate: e.target.value,
                      })
                    }
                    style={{ height: 35 }}
                  />
                  <InputField
                    placeholder="Típus"
                    value={newClientData.model}
                    onChange={(e) =>
                      setNewClientData({
                        ...newClientData,
                        model: e.target.value,
                      })
                    }
                    style={{ height: 35 }}
                  />
                  <InputField
                    placeholder="Márka"
                    value={newClientData.make}
                    onChange={(e) =>
                      setNewClientData({
                        ...newClientData,
                        make: e.target.value,
                      })
                    }
                    style={{ height: 35 }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleQuickAdd}
                  style={{
                    width: "100%",
                    background: "#3b82f6",
                    color: "white",
                    border: "none",
                    padding: "8px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  Mentés és Kiválasztás
                </button>
              </div>
            )}

            {!showQuickAdd && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "15px",
                }}
              >
                <SelectField
                  label="Ügyfél (Szűrés)"
                  icon={User}
                  value={formData.customerId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      customerId: parseInt(e.target.value),
                      vehicleId: 0,
                    })
                  }
                  options={[
                    { value: 0, label: "Összes Ügyfél" },
                    ...customers.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
                <SelectField
                  label="Jármű Kiválasztása"
                  icon={Car}
                  value={formData.vehicleId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      vehicleId: parseInt(e.target.value),
                    })
                  }
                  required
                  options={[
                    { value: 0, label: "-- Válassz --" },
                    ...availableVehicles.map((v) => ({
                      value: v.id,
                      label: `${v.licensePlate} - ${v.make}`,
                    })),
                  ]}
                />
              </div>
            )}
          </div>

          {/* 3. EGYÉB ADATOK */}
          <div style={{ marginBottom: "15px" }}>
            <SelectField
              label="Munka Típusa"
              icon={Wrench}
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value })
              }
              options={[
                { value: "service", label: "🔧 Általános Szerviz" },
                { value: "mot", label: "🚦 Műszaki Vizsga" },
                { value: "oil", label: "🛢️ Olajcsere" },
                { value: "repair", label: "🔨 Javítás" },
              ]}
            />
          </div>
          <div style={{ marginBottom: "20px" }}>
            <InputField
              label="Megjegyzés / Leírás"
              icon={AlignLeft}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Pl. Kopogó hang a futómű felől..."
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              marginTop: "20px",
              borderTop: "1px solid #27272a",
              paddingTop: "20px",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "0 25px",
                height: "45px",
                background: "transparent",
                border: "1px solid #3f3f46",
                color: "white",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Mégse
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="btn-add"
              style={{
                height: "45px",
                padding: "0 25px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "1rem",
              }}
            >
              <Save size={18} /> Mentés
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentModal;
