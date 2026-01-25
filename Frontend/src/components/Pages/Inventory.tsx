import React, { useState, useEffect } from "react";
import { apiService } from "../../api/apiService";
import { Part } from "../../types";
import {
  Search,
  Plus,
  Package,
  Edit,
  Trash2,
  Box,
  DollarSign,
  Hash,
  X,
  Save,
} from "lucide-react";
import { InputField } from "../ui/FormElements";

const Inventory: React.FC = () => {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);

  useEffect(() => {
    loadParts();
  }, []);

  const loadParts = async () => {
    setLoading(true);
    try {
      const res = await apiService.getParts();
      setParts(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Biztosan törölni akarod ezt az alkatrészt?")) return;
    try {
      await apiService.deletePart(id);
      setParts(parts.filter((p) => p.id !== id));
    } catch (e) {
      alert("Hiba a törlésnél!");
    }
  };

  const filteredParts = parts.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.partNumber.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        animation: "fadeIn 0.3s ease-in-out",
      }}
    >
      {/* FEJLÉC */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          padding: "10px 0",
        }}
      >
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
            <Package size={28} color="#eab308" /> Raktárkészlet
          </h2>
          <div style={{ width: "350px" }}>
            <InputField
              icon={Search}
              placeholder="Keresés cikkszám vagy név alapján..."
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

        <button
          onClick={() => {
            setEditingPart(null);
            setShowModal(true);
          }}
          className="btn-add"
          style={{
            padding: "0 25px",
            height: "45px",
            fontSize: "1rem",
            fontWeight: 600,
            background: "#eab308",
            color: "black", // Sárga gomb a raktárhoz
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <Plus size={20} /> Új Alkatrész
        </button>
      </div>

      {/* TÁBLÁZAT */}
      <div
        className="card"
        style={{
          padding: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          flex: 1,
          border: "1px solid #3f3f46",
        }}
      >
        <div style={{ overflowY: "auto", flex: 1 }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.95rem",
            }}
          >
            <thead
              style={{
                position: "sticky",
                top: 0,
                background: "#27272a",
                zIndex: 10,
              }}
            >
              <tr
                style={{
                  textAlign: "left",
                  color: "#a1a1aa",
                  borderBottom: "1px solid #3f3f46",
                }}
              >
                <th style={{ padding: "15px 20px" }}>Cikkszám</th>
                <th style={{ padding: "15px 20px" }}>Megnevezés</th>
                <th style={{ padding: "15px 20px", textAlign: "right" }}>
                  Nettó Ár
                </th>
                <th style={{ padding: "15px 20px", textAlign: "right" }}>
                  Bruttó Ár
                </th>
                <th style={{ padding: "15px 20px", textAlign: "center" }}>
                  Készlet
                </th>
                <th style={{ padding: "15px 20px", textAlign: "right" }}>
                  Műveletek
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredParts.map((p) => (
                <tr
                  key={p.id}
                  style={{
                    borderBottom: "1px solid #27272a",
                    transition: "background 0.2s",
                  }}
                  className="table-row"
                >
                  <td
                    style={{
                      padding: "15px 20px",
                      fontFamily: "monospace",
                      color: "#eab308",
                    }}
                  >
                    {p.partNumber}
                  </td>
                  <td
                    style={{
                      padding: "15px 20px",
                      fontWeight: 500,
                      color: "white",
                    }}
                  >
                    {p.name}
                  </td>
                  <td
                    style={{
                      padding: "15px 20px",
                      textAlign: "right",
                      color: "#a1a1aa",
                    }}
                  >
                    {p.netPrice.toLocaleString()} Ft
                  </td>
                  <td
                    style={{
                      padding: "15px 20px",
                      textAlign: "right",
                      fontWeight: "bold",
                      color: "white",
                    }}
                  >
                    {p.grossPrice.toLocaleString()} Ft
                  </td>
                  <td style={{ padding: "15px 20px", textAlign: "center" }}>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: "bold",
                        background:
                          p.stockQuantity > 0
                            ? "rgba(16, 185, 129, 0.15)"
                            : "rgba(239, 68, 68, 0.15)",
                        color: p.stockQuantity > 0 ? "#10b981" : "#ef4444",
                      }}
                    >
                      {p.stockQuantity} db
                    </span>
                  </td>
                  <td style={{ padding: "15px 20px", textAlign: "right" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "10px",
                      }}
                    >
                      <button
                        onClick={() => {
                          setEditingPart(p);
                          setShowModal(true);
                        }}
                        className="icon-btn"
                        style={{ color: "#a1a1aa" }}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="icon-btn"
                        style={{ color: "#ef4444" }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredParts.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      textAlign: "center",
                      padding: "50px",
                      color: "#52525b",
                    }}
                  >
                    Nincs találat a raktárban.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- INLINE MODAL (Hogy ne kelljen külön fájl) --- */}
      {showModal && (
        <PartModal
          part={editingPart}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            loadParts();
          }}
        />
      )}
    </div>
  );
};

// --- ALKATRÉSZ LÉTREHOZÓ/SZERKESZTŐ MODAL ---
const PartModal = ({
  part,
  onClose,
  onSuccess,
}: {
  part: Part | null;
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const [formData, setFormData] = useState({
    name: part?.name || "",
    partNumber: part?.partNumber || "",
    netPrice: part?.netPrice || 0,
    grossPrice: part?.grossPrice || 0,
    stockQuantity: part?.stockQuantity || 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (part) {
        await apiService.updatePart(part.id, { ...formData, id: part.id });
      } else {
        await apiService.createPart(formData);
      }
      onSuccess();
    } catch (e) {
      alert("Hiba a mentésnél!");
    }
  };

  // Automatikus Nettó/Bruttó számolás
  const handleGrossChange = (val: number) => {
    setFormData({
      ...formData,
      grossPrice: val,
      netPrice: Math.round(val / 1.27),
    });
  };

  return (
    <div className="modal-overlay modal-on-top" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "500px" }}
      >
        <div
          style={{
            padding: "20px",
            borderBottom: "1px solid #333",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <h3
            style={{
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Box color="#eab308" />{" "}
            {part ? "Alkatrész Szerkesztése" : "Új Alkatrész"}
          </h3>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "25px" }}>
          <InputField
            label="Cikkszám"
            icon={Hash}
            value={formData.partNumber}
            onChange={(e) =>
              setFormData({ ...formData, partNumber: e.target.value })
            }
            required
            placeholder="Pl. OLAJ-5W30"
          />
          <InputField
            label="Megnevezés"
            icon={Package}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="Pl. Motorolaj 5W30"
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "15px",
            }}
          >
            <InputField
              label="Bruttó Ár (Ft)"
              icon={DollarSign}
              type="number"
              value={formData.grossPrice}
              onChange={(e) => handleGrossChange(parseInt(e.target.value) || 0)}
              required
            />
            <InputField
              label="Nettó Ár (Ft)"
              type="number"
              value={formData.netPrice}
              readOnly
              style={{ opacity: 0.7, cursor: "not-allowed" }}
            />
          </div>

          <InputField
            label="Készlet (db)"
            type="number"
            value={formData.stockQuantity}
            onChange={(e) =>
              setFormData({
                ...formData,
                stockQuantity: parseInt(e.target.value) || 0,
              })
            }
          />

          <button
            type="submit"
            className="btn-add"
            style={{
              width: "100%",
              marginTop: "20px",
              background: "#eab308",
              color: "black",
            }}
          >
            <Save size={18} style={{ marginRight: 8 }} /> Mentés
          </button>
        </form>
      </div>
    </div>
  );
};

export default Inventory;
