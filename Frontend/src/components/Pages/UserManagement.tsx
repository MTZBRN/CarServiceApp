import React, { useEffect, useState } from "react";
import api from "../../api/api"; // Az új interceptoros kliensünk
import { User, Trash2, Shield, UserPlus } from "lucide-react";
import AddUserModal from "../modals/AddUserModal";

const UserManagement = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // Itt már NEM kell manuálisan fejlécet adni, az api.ts intézi!
      const res = await api.get("/Users");
      setUsers(res.data);
    } catch (err) {
      console.error("Nem sikerült lekérni a felhasználókat", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("Biztosan törlöd ezt a felhasználót?")) {
      try {
        await api.delete(`/Users/${id}`);
        fetchUsers(); // Lista frissítése
      } catch (err) {
        alert("Hiba a törlés során! Lehet, hogy nincs admin jogod?");
      }
    }
  };

  return (
    <div className="card" style={{ padding: "20px", height: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <h2 style={{ color: "white", margin: 0 }}>Rendszerfelhasználók</h2>
        <button
          className="btn-primary"
          style={{ display: "flex", gap: 8 }}
          onClick={() => setShowAddModal(true)} // ✅ Modál megnyitása
        >
          <UserPlus size={18} /> Új hozzáadása
        </button>
      </div>

      <div style={{ overflowY: "auto", flex: 1 }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            color: "#e4e4e7",
          }}
        >
          <thead>
            <tr
              style={{ textAlign: "left", borderBottom: "1px solid #27272a" }}
            >
              <th style={{ padding: "12px" }}>Név</th>
              <th style={{ padding: "12px" }}>Azonosító (Email)</th>
              <th style={{ padding: "12px" }}>Szerepkör</th>
              <th style={{ padding: "12px" }}>Műveletek</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: "1px solid #18181b" }}>
                <td style={{ padding: "12px" }}>{u.name}</td>
                <td style={{ padding: "12px" }}>{u.email}</td>
                <td style={{ padding: "12px" }}>
                  <span
                    className={`status-badge ${u.role === "admin" ? "badge-blue" : "badge-green"}`}
                  >
                    {u.role === "admin" ? (
                      <Shield size={12} />
                    ) : (
                      <User size={12} />
                    )}{" "}
                    {u.role}
                  </span>
                </td>
                <td style={{ padding: "12px" }}>
                  <button
                    onClick={() => handleDelete(u.id)}
                    className="icon-btn"
                    style={{ color: "#ef4444" }}
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showAddModal && (
        <AddUserModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchUsers(); // Lista frissítése a szerverről
          }}
        />
      )}
    </div>
  );
};

export default UserManagement;
