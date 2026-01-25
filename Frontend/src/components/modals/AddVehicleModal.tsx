import React, { useState, useEffect } from "react";
import { apiService } from "../../api/apiService";
import { Customer } from "../../types";
import { X, Save, Car, User, Calendar, Hash, FileText } from "lucide-react";

// AZ ÚJ KOMPONENSEK IMPORTÁLÁSA:
import { InputField, SelectField } from "../ui/FormElements";

interface Props {
  customers: Customer[];
  onClose: () => void;
  onSuccess: () => void;
}

const AddVehicleModal: React.FC<Props> = ({
  customers,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<"existing" | "new">("existing");

  // Form adatok
  const [formData, setFormData] = useState({
    licensePlate: "",
    make: "",
    model: "",
    year: new Date().getFullYear(),
    vin: "",
    motExpiry: "",
    customerId: 0,
  });
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
  });

  // Ügyféllista frissítése, ha üres
  const [allCustomers, setAllCustomers] = useState<Customer[]>(customers);
  useEffect(() => {
    if (customers.length === 0)
      apiService.getCustomers().then((r) => setAllCustomers(r.data));
  }, [customers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let cId = formData.customerId;

      // Ha új ügyfelet veszünk fel
      if (activeTab === "new") {
        if (!newCustomer.name || !newCustomer.phone)
          return alert("Név és telefonszám kötelező!");
        const res = await apiService.createCustomer({ ...newCustomer });
        cId = res.data.id;
      }

      if (cId === 0) return alert("Kérlek válassz ügyfelet!");

      // Jármű mentése
      await apiService.createVehicle({ ...formData, customerId: cId });
      onSuccess();
    } catch (err) {
      console.error(err);
      alert("Hiba történt a mentés során!");
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
            <Car size={22} color="#3b82f6" /> Jármű Rögzítése
          </h3>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "25px" }}>
          {/* TAB VÁLTÓ (Meglévő vs Új Ügyfél) */}
          <div
            style={{
              display: "flex",
              background: "#27272a",
              padding: "4px",
              borderRadius: "8px",
              marginBottom: "25px",
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab("existing")}
              style={{
                flex: 1,
                padding: "10px",
                border: "none",
                background:
                  activeTab === "existing" ? "#3f3f46" : "transparent",
                color: activeTab === "existing" ? "white" : "#a1a1aa",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Meglévő Ügyfélhez
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("new")}
              style={{
                flex: 1,
                padding: "10px",
                border: "none",
                background: activeTab === "new" ? "#3b82f6" : "transparent",
                color: activeTab === "new" ? "white" : "#a1a1aa",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              + Új Ügyfél & Jármű
            </button>
          </div>

          {/* --- ÜGYFÉL SZEKCIÓ --- */}
          <div
            style={{
              marginBottom: "20px",
              paddingBottom: "20px",
              borderBottom: "1px solid #27272a",
            }}
          >
            {activeTab === "existing" ? (
              <SelectField
                label="Ügyfél Kiválasztása"
                icon={User}
                value={formData.customerId}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    customerId: parseInt(e.target.value),
                  })
                }
                options={[
                  { value: 0, label: "-- Válassz a listából --" },
                  ...allCustomers.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.5fr 1fr 1fr",
                  gap: "15px",
                }}
              >
                <InputField
                  label="Teljes Név"
                  icon={User}
                  required
                  value={newCustomer.name}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, name: e.target.value })
                  }
                  placeholder="Pl. Kiss János"
                />
                <InputField
                  label="Telefonszám"
                  required
                  value={newCustomer.phone}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, phone: e.target.value })
                  }
                  placeholder="+36..."
                />
                <InputField
                  label="Email (Op)"
                  value={newCustomer.email}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, email: e.target.value })
                  }
                  placeholder="email@..."
                />
              </div>
            )}
          </div>

          {/* --- JÁRMŰ SZEKCIÓ --- */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 2fr",
              gap: "15px",
              marginBottom: "5px",
            }}
          >
            <InputField
              label="Rendszám"
              icon={Car}
              required
              value={formData.licensePlate}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  licensePlate: e.target.value.toUpperCase(),
                })
              }
              placeholder="ABC-123"
              style={{ fontWeight: "bold", letterSpacing: "1px" }}
              maxLength={10}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "15px",
              }}
            >
              <InputField
                label="Márka"
                value={formData.make}
                onChange={(e) =>
                  setFormData({ ...formData, make: e.target.value })
                }
                placeholder="Toyota"
              />
              <InputField
                label="Típus"
                value={formData.model}
                onChange={(e) =>
                  setFormData({ ...formData, model: e.target.value })
                }
                placeholder="Corolla"
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 2fr 1.5fr",
              gap: "15px",
            }}
          >
            <InputField
              label="Évjárat"
              type="number"
              icon={Calendar}
              required
              value={formData.year}
              onChange={(e) =>
                setFormData({ ...formData, year: parseInt(e.target.value) })
              }
            />
            <InputField
              label="Alvázszám (VIN)"
              icon={Hash}
              value={formData.vin}
              onChange={(e) =>
                setFormData({ ...formData, vin: e.target.value.toUpperCase() })
              }
              placeholder="WBA..."
            />
            <InputField
              label="Műszaki Érv."
              type="date"
              value={formData.motExpiry}
              onChange={(e) =>
                setFormData({ ...formData, motExpiry: e.target.value })
              }
            />
          </div>

          {/* LÁBLÉC GOMBOK */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              marginTop: "30px",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "0 25px",
                height: "40px",
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
              type="submit"
              className="btn-add"
              style={{
                height: "40px",
                padding: "0 25px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Save size={18} /> Mentés
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddVehicleModal;
