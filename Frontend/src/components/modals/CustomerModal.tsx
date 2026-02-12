import React, { useState, useEffect } from "react";
import { X, Save, User, Phone, Mail, MapPin, Plus } from "lucide-react";
import { InputField } from "../ui/FormElements";

interface CustomerData {
  id?: number;
  name: string;
  phoneNumber: string;
  email: string;
  address: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CustomerData) => void;
  initialData?: CustomerData | null;
}

const CustomerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [formData, setFormData] = useState<CustomerData>({
    name: "",
    phoneNumber: "",
    email: "",
    address: "",
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({ name: "", phoneNumber: "", email: "", address: "" });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(0,0,0,0.6)", // Áttetsző sötét háttér
        backdropFilter: "blur(4px)", // Homályosítás a háttérben
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <div
        className="modal-content"
        style={{
          background: "#18181b",
          padding: "30px",
          borderRadius: "16px",
          width: "90%",
          maxWidth: "480px",
          border: "1px solid #27272a",
          color: "white",
          boxShadow:
            "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "25px",
            borderBottom: "1px solid #27272a",
            paddingBottom: "15px",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "1.4rem",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            {initialData ? <User color="#3b82f6" /> : <Plus color="#10b981" />}
            {initialData ? "Ügyfél Szerkesztése" : "Új Ügyfél"}
          </h2>
          <button
            onClick={onClose}
            className="icon-btn"
            style={{
              background: "transparent",
              color: "#71717a",
              border: "none",
              cursor: "pointer",
            }}
          >
            <X size={24} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "20px" }}
        >
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "0.85rem",
                color: "#a1a1aa",
                fontWeight: "600",
              }}
            >
              NÉV *
            </label>
            <div style={{ position: "relative" }}>
              <User
                size={18}
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#52525b",
                }}
              />
              <InputField
                required
                placeholder="Teljes név"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                style={{
                  paddingLeft: "44px",
                  width: "100%",
                  background: "#27272a",
                  border: "1px solid #3f3f46",
                  height: "45px",
                  borderRadius: "8px",
                }}
              />
            </div>
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "0.85rem",
                color: "#a1a1aa",
                fontWeight: "600",
              }}
            >
              TELEFONSZÁM *
            </label>
            <div style={{ position: "relative" }}>
              <Phone
                size={18}
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#52525b",
                }}
              />
              <InputField
                required
                placeholder="+36 30 123 4567"
                value={formData.phoneNumber}
                onChange={(e) =>
                  setFormData({ ...formData, phoneNumber: e.target.value })
                }
                style={{
                  paddingLeft: "44px",
                  width: "100%",
                  background: "#27272a",
                  border: "1px solid #3f3f46",
                  height: "45px",
                  borderRadius: "8px",
                }}
              />
            </div>
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px" }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "0.85rem",
                  color: "#a1a1aa",
                  fontWeight: "600",
                }}
              >
                EMAIL CÍM
              </label>
              <div style={{ position: "relative" }}>
                <Mail
                  size={18}
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#52525b",
                  }}
                />
                <InputField
                  type="email"
                  placeholder="pelda@email.hu"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  style={{
                    paddingLeft: "44px",
                    width: "100%",
                    background: "#27272a",
                    border: "1px solid #3f3f46",
                    height: "45px",
                    borderRadius: "8px",
                  }}
                />
              </div>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "0.85rem",
                  color: "#a1a1aa",
                  fontWeight: "600",
                }}
              >
                LAKCÍM
              </label>
              <div style={{ position: "relative" }}>
                <MapPin
                  size={18}
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#52525b",
                  }}
                />
                <InputField
                  placeholder="Település, Utca, Házszám"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  style={{
                    paddingLeft: "44px",
                    width: "100%",
                    background: "#27272a",
                    border: "1px solid #3f3f46",
                    height: "45px",
                    borderRadius: "8px",
                  }}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="btn-add"
            style={{
              marginTop: "15px",
              background: "#3b82f6",
              padding: "14px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "10px",
              width: "100%",
              borderRadius: "8px",
              fontSize: "1rem",
              fontWeight: "bold",
              boxShadow: "0 4px 6px -1px rgba(59, 130, 246, 0.4)",
            }}
          >
            <Save size={20} />{" "}
            {initialData ? "Módosítások Mentése" : "Ügyfél Létrehozása"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CustomerModal;
