import React, { useState, useEffect } from "react";
import api from "../../api/api";
import {
  Users,
  Search,
  Phone,
  Mail,
  MapPin,
  Plus,
  Edit,
  Trash2,
  User,
} from "lucide-react";
import CustomerModal from "../modals/CustomerModal";
import { useToast } from "../ui/ToastProvider";

interface Customer {
  id: number;
  name: string;
  phoneNumber: string;
  email: string | null;
  address: string | null;
}

const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // Modal statek
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const { showToast } = useToast();

  // --- STÍLUSOK ---
  const customStyles = `
    .customer-table-container {
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #27272a;
      background: #18181b;
    }
    .customer-row {
      border-bottom: 1px solid #27272a;
      transition: background 0.2s;
    }
    .customer-row:last-child {
      border-bottom: none;
    }
    .customer-row:hover {
      background-color: #27272a;
    }
    .search-input:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
    }
  `;

  // --- BETÖLTÉS ---
  const fetchCustomers = () => {
    setLoading(true);
    api
      .get("/Customers")
      .then((res) => setCustomers(res.data))
      .catch((err) => console.error("Hiba", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // --- TÖRLÉS ---
  const handleDelete = async (id: number) => {
    if (window.confirm("Biztosan törölni szeretnéd?")) {
      try {
        await api.delete(`/Customers/${id}`);
        fetchCustomers();
        showToast("Az ügyfél törölve.", "success");
      } catch (error) {
        showToast("Hiba történt az ügyfél törlésekor.", "error");
      }
    }
  };

  // --- MENTÉS ---
  const handleSave = async (data: any) => {
    try {
      if (editingCustomer) {
        await api.put(`/Customers/${editingCustomer.id}`, data);
      } else {
        await api.post("/Customers", data);
      }
      setIsModalOpen(false);
      setEditingCustomer(null);
      fetchCustomers();
      showToast(
        editingCustomer ? "Az ügyfél módosítva." : "Az ügyfél létrehozva.",
        "success",
      );
    } catch (error) {
      showToast("Hiba történt az ügyfél mentésekor.", "error");
    }
  };

  // --- MODAL ---
  const openNewModal = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phoneNumber.includes(searchTerm),
  );

  return (
    <div
      style={{ maxWidth: "1200px", margin: "0 auto", paddingBottom: "50px" }}
    >
      <style>{customStyles}</style>

      {/* --- FEJLÉC (Garázs stílus) --- */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "25px",
        }}
      >
        {/* BAL OLDAL: Cím és Kereső EGY SORBAN */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "25px",
            flex: 1,
          }}
        >
          {/* Cím + Ikon */}
          <h2
            style={{
              margin: 0,
              fontSize: "1.5rem",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              color: "white",
            }}
          >
            <Users size={28} color="#e4e4e7" /> Ügyfelek
          </h2>

          {/* Keresőmező */}
          <div
            style={{ position: "relative", width: "100%", maxWidth: "400px" }}
          >
            <Search
              size={18}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#71717a",
              }}
            />
            <input
              type="text"
              placeholder="Keresés név vagy telefonszám..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              style={{
                width: "100%",
                padding: "10px 10px 10px 40px",
                background: "#18181b",
                border: "1px solid #3f3f46",
                borderRadius: "8px",
                color: "white",
                fontSize: "0.95rem",
                outline: "none",
                transition: "all 0.2s",
              }}
            />
          </div>
        </div>

        {/* JOBB OLDAL: Gomb */}
        <button
          onClick={openNewModal}
          className="btn-add"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            borderRadius: "8px",
            fontWeight: "600",
            background: "#3b82f6",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          <Plus size={20} /> Új Ügyfél
        </button>
      </div>

      {/* --- LISTA --- */}
      <div className="customer-table-container">
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            color: "#e4e4e7",
          }}
        >
          <thead>
            <tr
              style={{
                background: "#202024",
                textAlign: "left",
                fontSize: "0.85rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#a1a1aa",
              }}
            >
              <th style={{ padding: "16px 20px", fontWeight: "600" }}>Név</th>
              <th style={{ padding: "16px 20px", fontWeight: "600" }}>
                Telefonszám
              </th>
              <th style={{ padding: "16px 20px", fontWeight: "600" }}>
                Elérhetőség
              </th>
              <th
                style={{
                  padding: "16px 20px",
                  textAlign: "right",
                  fontWeight: "600",
                }}
              >
                Műveletek
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={4}
                  style={{
                    padding: "40px",
                    textAlign: "center",
                    color: "#71717a",
                  }}
                >
                  Betöltés...
                </td>
              </tr>
            ) : filteredCustomers.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  style={{
                    padding: "50px",
                    textAlign: "center",
                    color: "#71717a",
                  }}
                >
                  Nincs találat.
                </td>
              </tr>
            ) : (
              filteredCustomers.map((customer) => (
                <tr key={customer.id} className="customer-row">
                  <td style={{ padding: "16px 20px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          background: "#27272a",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <User size={16} color="#a1a1aa" />
                      </div>
                      <span style={{ fontWeight: "600", color: "white" }}>
                        {customer.name}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        color: "#60a5fa",
                        background: "rgba(59, 130, 246, 0.1)",
                        width: "fit-content",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        fontSize: "0.9rem",
                      }}
                    >
                      <Phone size={14} /> {customer.phoneNumber}
                    </div>
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                        fontSize: "0.9rem",
                      }}
                    >
                      {customer.address && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            color: "#e4e4e7",
                          }}
                        >
                          <MapPin size={14} color="#71717a" />{" "}
                          {customer.address}
                        </div>
                      )}
                      {customer.email && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            color: "#a1a1aa",
                          }}
                        >
                          <Mail size={14} /> {customer.email}
                        </div>
                      )}
                      {!customer.address && !customer.email && (
                        <span style={{ color: "#52525b" }}>-</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "16px 20px", textAlign: "right" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "8px",
                      }}
                    >
                      <button
                        onClick={() => openEditModal(customer)}
                        style={{
                          background: "transparent",
                          border: "1px solid #3f3f46",
                          padding: "6px",
                          borderRadius: "6px",
                          color: "#fbbf24",
                          cursor: "pointer",
                        }}
                        title="Szerkesztés"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(customer.id)}
                        style={{
                          background: "transparent",
                          border: "1px solid #3f3f46",
                          padding: "6px",
                          borderRadius: "6px",
                          color: "#ef4444",
                          cursor: "pointer",
                        }}
                        title="Törlés"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CustomerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialData={
          editingCustomer
            ? {
                ...editingCustomer,
                email: editingCustomer.email ?? "",
                address: editingCustomer.address ?? "",
              }
            : null
        }
      />
    </div>
  );
};

export default Customers;
