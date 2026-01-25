import React, { useState, useEffect, useRef } from "react";
import { apiService } from "../../api/apiservice";
import {
  X,
  Save,
  Plus,
  Trash2,
  Wrench,
  Package,
  Printer,
  FileText,
  Hash,
  DollarSign,
} from "lucide-react";
import { JobPart, Part, Vehicle, ServiceJob } from "../../types";
import WorksheetPrintModal from "../print/WorkSheetPrintModal";
import { InputField, SelectField } from "../ui/FormElements";

interface Props {
  appointmentId: number | null;
  vehicleId?: number;
  vehicleName: string;
  vehicle?: Vehicle;
  onClose: () => void;
  onSave: () => void;
}

const WorksheetModal: React.FC<Props> = ({
  appointmentId,
  vehicleId,
  vehicleName,
  vehicle,
  onClose,
  onSave,
}) => {
  const [loading, setLoading] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Alap adatok
  const [description, setDescription] = useState("");
  const [laborCost, setLaborCost] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  const [jobParts, setJobParts] = useState<JobPart[]>([]);
  const [inventory, setInventory] = useState<Part[]>([]);

  // Új tétel adatok
  const [newItem, setNewItem] = useState({
    name: "",
    quantity: 1,
    unitPrice: 0,
    partNumber: "",
  });

  // A Checkbox state-je TÖRÖLVE, mert mostantól automatikus!

  useEffect(() => {
    loadInitData();
  }, [appointmentId]);

  const loadInitData = async () => {
    setLoading(true);
    try {
      const partsRes = await apiService.getParts();
      setInventory(partsRes.data);

      if (appointmentId) {
        const res = await apiService.getServiceJob(appointmentId);
        if (res.data) {
          setDescription(res.data.description || "");
          setLaborCost(res.data.laborCost || 0);
          setIsCompleted(res.data.isCompleted || false);
          setJobParts(res.data.jobParts || []);
        }
      } else {
        setDescription("Gyors szerviz felvétel a Garázsból");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItem.name) return alert("Kérlek add meg az alkatrész nevét!");

    // Generálunk cikkszámot, ha nincs megadva
    const currentPartNumber =
      newItem.partNumber || `AUTO-${Date.now().toString().slice(-6)}`;

    // ELLENŐRZÉS: Létezik már ez a cikkszám a törzsben?
    const existingPart = inventory.find(
      (p) => p.partNumber.toLowerCase() === currentPartNumber.toLowerCase(),
    );

    if (!existingPart) {
      // --- HA NINCS: AUTOMATIKUS MENTÉS A TÖRZSBE ---
      try {
        const gross = newItem.unitPrice;
        const net = Math.round(gross / 1.27);

        // Létrehozás a backendben
        await apiService.createPart({
          name: newItem.name,
          partNumber: currentPartNumber,
          grossPrice: gross,
          netPrice: net,
          stockQuantity: 0,
        });

        // Frissítjük a helyi listát, hogy legközelebb már megtalálja
        const updated = await apiService.getParts();
        setInventory(updated.data);
      } catch (err) {
        console.error(err);
        return alert("Hiba történt az új alkatrész Cikktörzsbe mentésekor!");
      }
    }
    // Ha létezik, akkor nem csinálunk semmit, egyszerűen használjuk.

    // Listához adás (A munkalapra)
    const part: JobPart = {
      itemName: newItem.name,
      quantity: newItem.quantity,
      unitPrice: newItem.unitPrice,
      id: 0,
      partNumber: currentPartNumber,
      partName: newItem.name,
    };

    setJobParts([...jobParts, part]);
    setNewItem({ name: "", quantity: 1, unitPrice: 0, partNumber: "" });
  };

  const handleRemoveItem = (index: number) => {
    const updated = [...jobParts];
    updated.splice(index, 1);
    setJobParts(updated);
  };

  const handleSelectFromInventory = (e: { target: { value: string } }) => {
    const partId = parseInt(e.target.value);
    if (!partId) return;
    const p = inventory.find((x) => x.id === partId);
    if (p) {
      setNewItem({
        name: p.name,
        partNumber: p.partNumber,
        quantity: 1,
        unitPrice: p.grossPrice,
      });
    }
  };

  const handleSave = async () => {
    // Az ID-kat tisztítjuk (negatív ID nem mehet a backendre)
    const cleanedParts = jobParts.map((p) => ({
      ...p,
      id: p.id && p.id < 0 ? 0 : p.id,
    }));

    try {
      if (appointmentId) {
        // --- FRISSÍTÉS (PUT) - EZ HIÁNYZOTT! ---
        // Ha van ID, akkor Update-et hívunk, nem Save-et/Create-et
        await apiService.updateServiceJob(appointmentId, {
          id: appointmentId,
          appointmentId: appointmentId,
          description,
          laborCost,
          isCompleted,
          jobParts: cleanedParts,
        });
      } else {
        // --- LÉTREHOZÁS (POST) ---
        if (!vehicleId) return alert("Hiba: Nincs jármű kiválasztva!");

        await apiService.createServiceJob({
          vehicleId: vehicleId,
          date: new Date().toISOString(),
          description,
          laborCost,
          isCompleted,
          jobParts: cleanedParts,
        });
      }
      onSave(); // Bezárás és frissítés
    } catch (err) {
      console.error(err);
      alert("Hiba a mentés során!");
    }
  };

  const totalPartsCost = jobParts.reduce(
    (sum, p) => sum + p.unitPrice * p.quantity,
    0,
  );
  const totalCost = totalPartsCost + laborCost;

  if (loading) return null;

  return (
    <div className="modal-overlay modal-on-top" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "800px", width: "100%" }}
      >
        {/* FEJLÉC */}
        <div
          style={{
            padding: "20px",
            background: "#18181b",
            borderBottom: "1px solid #27272a",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: "1.2rem",
              }}
            >
              <Wrench size={22} color="#3b82f6" /> Munkalap: {vehicleName}
            </h3>
            <span
              style={{
                fontSize: "0.8rem",
                color: "#a1a1aa",
                marginLeft: "32px",
              }}
            >
              {appointmentId ? `ID: #${appointmentId}` : "ÚJ MUNKALAP"}
            </span>
          </div>
          {/* FEJLÉC GOMBOKNÁL: */}
          <div style={{ display: "flex", gap: "10px" }}>
            {appointmentId && (
              <button
                onClick={() => setShowPrintModal(true)} // Csak megjelenítjük
                className="icon-btn"
                title="Nyomtatás"
                style={{ color: "#3b82f6", border: "1px solid #3b82f6" }}
              >
                <Printer size={18} />
              </button>
            )}
            <button className="icon-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div style={{ padding: "25px", maxHeight: "80vh", overflowY: "auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 250px",
              gap: "20px",
              marginBottom: "25px",
            }}
          >
            <InputField
              label="Elvégzett munka leírása"
              icon={FileText}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ height: "auto" }}
            />
            <div
              style={{ display: "flex", flexDirection: "column", gap: "6px" }}
            >
              <label
                style={{
                  fontSize: "0.8rem",
                  color: "#a1a1aa",
                  fontWeight: 500,
                  textTransform: "uppercase",
                }}
              >
                Státusz
              </label>
              <button
                type="button"
                onClick={() => setIsCompleted(!isCompleted)}
                style={{
                  height: "40px",
                  background: isCompleted ? "#10b981" : "#eab308",
                  border: "none",
                  borderRadius: "6px",
                  color: isCompleted ? "white" : "black",
                  fontWeight: "bold",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                {isCompleted ? "✅ KÉSZ (Lezárva)" : "⏳ FOLYAMATBAN"}
              </button>
            </div>
          </div>

          <div
            style={{
              background: "#27272a",
              border: "1px solid #3f3f46",
              borderRadius: "8px",
              padding: "20px",
              marginBottom: "20px",
            }}
          >
            <h4
              style={{
                marginTop: 0,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "#e4e4e7",
              }}
            >
              <Package size={18} color="#3b82f6" /> Beépített Alkatrészek
            </h4>

            {/* ÚJ TÉTEL PANEL */}
            <div
              style={{
                background: "#18181b",
                padding: "15px",
                borderRadius: "8px",
                marginBottom: "15px",
                border: "1px dashed #3f3f46",
              }}
            >
              <div style={{ marginBottom: "15px" }}>
                <SelectField
                  label="Gyorstöltés Cikktörzsből"
                  icon={Hash}
                  onChange={handleSelectFromInventory}
                  value=""
                  options={[
                    { value: "", label: "-- Válassz --" },
                    ...inventory.map((p) => ({
                      value: p.id,
                      label: `${p.name} (${p.partNumber}) - ${p.grossPrice} Ft`,
                    })),
                  ]}
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 2fr 1fr 1fr",
                  gap: "10px",
                  marginBottom: "15px",
                }}
              >
                <InputField
                  label="Cikkszám"
                  value={newItem.partNumber}
                  onChange={(e) =>
                    setNewItem({ ...newItem, partNumber: e.target.value })
                  }
                  placeholder="Cikkszám"
                />
                <InputField
                  label="Megnevezés"
                  value={newItem.name}
                  onChange={(e) =>
                    setNewItem({ ...newItem, name: e.target.value })
                  }
                  placeholder="Megnevezés"
                />
                <InputField
                  label="Ár (Ft)"
                  type="number"
                  value={newItem.unitPrice || ""}
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      unitPrice: parseInt(e.target.value) || 0,
                    })
                  }
                />
                <InputField
                  label="Db"
                  type="number"
                  value={newItem.quantity || ""}
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      quantity: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>

              {/* GOMB SOR - Checkbox kivéve */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                }}
              >
                <button
                  onClick={handleAddItem}
                  className="btn-add"
                  style={{
                    padding: "0 25px",
                    height: "40px",
                    width: "auto",
                    fontSize: "0.9rem",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Plus size={18} /> Hozzáadás és Mentés
                </button>
              </div>
            </div>

            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.9rem",
              }}
            >
              <thead>
                <tr
                  style={{
                    color: "#a1a1aa",
                    borderBottom: "1px solid #3f3f46",
                  }}
                >
                  <th style={{ textAlign: "left", padding: "8px" }}>
                    Cikkszám
                  </th>
                  <th style={{ textAlign: "left", padding: "8px" }}>
                    Megnevezés
                  </th>
                  <th style={{ textAlign: "center", padding: "8px" }}>Db</th>
                  <th style={{ textAlign: "right", padding: "8px" }}>Ár</th>
                  <th style={{ textAlign: "right", padding: "8px" }}>Össz</th>
                  <th style={{ width: "40px" }}></th>
                </tr>
              </thead>
              <tbody>
                {jobParts.map((part, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #3f3f46" }}>
                    <td style={{ padding: "10px 8px", color: "#3b82f6" }}>
                      {part.partNumber || "-"}
                    </td>
                    <td style={{ padding: "10px 8px" }}>{part.itemName}</td>
                    <td style={{ padding: "10px 8px", textAlign: "center" }}>
                      {part.quantity}
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "right" }}>
                      {part.unitPrice.toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: "10px 8px",
                        textAlign: "right",
                        fontWeight: "bold",
                      }}
                    >
                      {(part.unitPrice * part.quantity).toLocaleString()}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        onClick={() => handleRemoveItem(idx)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#ef4444",
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "20px",
              alignItems: "center",
            }}
          >
            <div style={{ width: "200px" }}>
              <InputField
                label="Kiegészítő Munkadíj"
                icon={DollarSign}
                type="number"
                value={laborCost}
                onChange={(e) => setLaborCost(parseInt(e.target.value) || 0)}
                style={{ textAlign: "right", fontWeight: "bold" }}
              />
            </div>
          </div>

          <div
            style={{
              background: "#18181b",
              padding: "20px",
              borderRadius: "8px",
              marginTop: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              border: "1px solid #3b82f6",
            }}
          >
            <span style={{ fontSize: "1.2rem", color: "#a1a1aa" }}>
              Fizetendő Végösszeg:
            </span>
            <span
              style={{ fontSize: "1.8rem", fontWeight: "bold", color: "white" }}
            >
              {totalCost.toLocaleString()} Ft
            </span>
          </div>

          <button
            onClick={handleSave}
            className="btn-add"
            style={{
              marginTop: "25px",
              width: "100%",
              height: "50px",
              fontSize: "1.1rem",
            }}
          >
            <Save size={20} style={{ marginRight: 10 }} /> MENTÉS
          </button>
        </div>

        {showPrintModal && appointmentId && (
          <WorksheetPrintModal
            // Összeállítjuk a Job objektumot a jelenlegi state-ekből
            job={
              {
                id: appointmentId,
                description: description,
                laborCost: laborCost,
                isCompleted: isCompleted,
                jobParts: jobParts,
                date: new Date().toISOString(),
                vehicleId: vehicleId || vehicle?.id || 0,
              } as ServiceJob
            }
            // Átadjuk a kapott teljes vehicle objektumot
            // Ha véletlenül nincs meg (undefined), csinálunk egy üres "kamu" objektumot, hogy ne fagyjon le
            vehicle={
              vehicle ||
              ({
                id: vehicleId || 0,
                licensePlate: vehicleName,
                make: "",
                model: "",
                year: 0,
                customer: { name: "Ismeretlen", address: "", phoneNumber: "" },
              } as Vehicle)
            }
            onClose={() => setShowPrintModal(false)}
          />
        )}
      </div>
    </div>
  );
};

export default WorksheetModal;
