import React, { useState } from "react";
import { X, UserPlus } from "lucide-react";
import { usersApi } from "../../api/users";
import { apiErrorMessage } from "../../api/client";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await usersApi.create(formData);
      onSuccess();
    } catch (err: unknown) {
      setError(apiErrorMessage(err, "Hiba történt a mentés során."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: "400px" }}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <UserPlus color="#3b82f6" />
            <h2 style={{ margin: 0 }}>Új Felhasználó</h2>
          </div>
          <button onClick={onClose} className="icon-btn">
            <X />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "15px",
            marginTop: "20px",
          }}
        >
          {error && <div className="error-msg">{error}</div>}

          <div className="input-group">
            <label>Teljes név</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Pl. Kovács Béla"
            />
          </div>

          <div className="input-group">
            <label>Felhasználónév (Email)</label>
            <input
              type="text"
              required
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="bela.kovacs"
            />
          </div>

          <div className="input-group">
            <label>Jelszó</label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              placeholder="******"
            />
          </div>

          <div className="input-group">
            <label>Szerepkör</label>
            <select
              value={formData.role}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value })
              }
              style={{
                width: "100%",
                padding: "10px",
                background: "#27272a",
                color: "white",
                border: "1px solid #3f3f46",
                borderRadius: "8px",
              }}
            >
              <option value="mechanic">Szerelő (Mechanic)</option>
              <option value="admin">Adminisztrátor</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              style={{ flex: 1 }}
            >
              Mégse
            </button>
            <button
              type="submit"
              className="btn-primary"
              style={{ flex: 1 }}
              disabled={loading}
            >
              {loading ? "Mentés..." : "Létrehozás"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddUserModal;
