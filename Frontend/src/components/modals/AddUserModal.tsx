import React, { useState } from "react";
import { X, Save, User, Lock, Mail, Shield } from "lucide-react";
import { InputField, SelectField } from "../ui/FormElements"; // Feltételezve, hogy vannak ilyenjeid
import { authService } from "../../api/authService";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const AddUserModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "mechanic",
  });

  const handleSave = () => {
    if (!formData.name || !formData.email || !formData.password) {
      alert("Minden mezőt ki kell tölteni!");
      return;
    }

    try {
      authService.addUser({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role as "admin" | "mechanic",
      });
      alert("Felhasználó sikeresen létrehozva!");
      onSuccess();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 3000 }}>
      <div className="modal-content" style={{ maxWidth: "500px" }}>
        <div
          style={{
            padding: "20px",
            background: "#18181b",
            borderBottom: "1px solid #333",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ margin: 0, color: "white", display: "flex", gap: 10 }}>
            <User size={20} color="#3b82f6" /> Új Munkatárs Hozzáadása
          </h3>
          <button onClick={onClose} className="icon-btn">
            <X size={20} />
          </button>
        </div>

        <div
          style={{
            padding: "25px",
            display: "flex",
            flexDirection: "column",
            gap: "15px",
          }}
        >
          <InputField
            label="Teljes Név"
            icon={User}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Pl. Kiss János"
          />

          <InputField
            label="Felhasználónév / Email"
            icon={Mail}
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            placeholder="janos@szerviz.hu"
          />

          <InputField
            label="Jelszó"
            icon={Lock}
            type="password"
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
          />

          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <label
              style={{
                color: "#a1a1aa",
                fontSize: "0.9rem",
                display: "flex",
                gap: 5,
                alignItems: "center",
              }}
            >
              <Shield size={14} /> Jogosultság
            </label>
            <select
              value={formData.role}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value })
              }
              style={{
                padding: "12px",
                background: "#27272a",
                border: "1px solid #3f3f46",
                borderRadius: "8px",
                color: "white",
                width: "100%",
                outline: "none",
              }}
            >
              <option value="mechanic">Szerelő (Csak munka)</option>
              <option value="admin">Adminisztrátor (Teljes hozzáférés)</option>
            </select>
          </div>

          <button
            onClick={handleSave}
            className="btn-add"
            style={{
              marginTop: "10px",
              width: "100%",
              justifyContent: "center",
            }}
          >
            <Save size={18} /> Fiók Létrehozása
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddUserModal;
