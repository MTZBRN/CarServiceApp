import React, { useState, useEffect } from "react";
import { Users, UserPlus, Trash2, Shield, Wrench } from "lucide-react";
import { authService, User } from "../../api/authService";
import AddUserModal from "../modals/AddUserModal";

const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  // Betöltés
  const loadUsers = () => {
    setUsers(authService.getUsers());
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Biztosan törölni szeretnéd ${name} fiókját?`)) {
      try {
        authService.deleteUser(id);
        loadUsers();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* FEJLÉC */}
      <div
        className="card"
        style={{
          marginBottom: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Users color="#3b82f6" /> Felhasználók Kezelése
          </h2>
          <p style={{ margin: "5px 0 0 0", color: "#a1a1aa" }}>
            Munkatársak jogosultságai és fiókjai
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-add">
          <UserPlus size={18} /> Új Fiók
        </button>
      </div>

      {/* LISTA */}
      <div className="card" style={{ flex: 1, padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead
            style={{
              background: "#27272a",
              color: "#a1a1aa",
              textAlign: "left",
            }}
          >
            <tr>
              <th style={{ padding: "15px" }}>Név</th>
              <th style={{ padding: "15px" }}>Felhasználónév / Email</th>
              <th style={{ padding: "15px" }}>Jogosultság</th>
              <th style={{ padding: "15px", textAlign: "right" }}>Művelet</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} style={{ borderBottom: "1px solid #3f3f46" }}>
                <td
                  style={{
                    padding: "15px",
                    fontWeight: "bold",
                    color: "white",
                  }}
                >
                  {user.name}
                </td>
                <td style={{ padding: "15px", color: "#ccc" }}>{user.email}</td>
                <td style={{ padding: "15px" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 10px",
                      borderRadius: "20px",
                      fontSize: "0.8rem",
                      background:
                        user.role === "admin"
                          ? "rgba(59, 130, 246, 0.2)"
                          : "rgba(16, 185, 129, 0.2)",
                      color: user.role === "admin" ? "#3b82f6" : "#10b981",
                    }}
                  >
                    {user.role === "admin" ? (
                      <Shield size={12} />
                    ) : (
                      <Wrench size={12} />
                    )}
                    {user.role === "admin" ? "ADMINISZTRÁTOR" : "SZERELŐ"}
                  </span>
                </td>
                <td style={{ padding: "15px", textAlign: "right" }}>
                  <button
                    onClick={() => handleDelete(user.id, user.name)}
                    className="icon-btn"
                    style={{ color: "#ef4444", border: "1px solid #ef4444" }}
                    title="Törlés"
                  >
                    <Trash2 size={16} />
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
            loadUsers();
          }}
        />
      )}
    </div>
  );
};

export default UserManagement;
