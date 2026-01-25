import React, { useEffect, useState, useRef } from "react";
import { apiService } from "../../api/apiservice";
import { ServiceJob, Vehicle } from "../../types";
import {
  ArrowLeft,
  Calendar,
  Package,
  Copy,
  CheckCircle,
  Wrench,
  FileText,
  Printer,
  Edit,
  Trash2,
} from "lucide-react";

// IMPORTÁLJUK A MODALT A SZERKESZTÉSHEZ
import WorksheetModal from "../modals/WorksheetModal";

// NYOMTATÁSHOZ
import { useReactToPrint } from "react-to-print";
import WorksheetPrintModal from "../print/WorkSheetPrintModal";

interface Props {
  vehicle: Vehicle;
  onBack: () => void;
}

const VehicleDetails: React.FC<Props> = ({ vehicle, onBack }) => {
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // --- ÁLLAPOTOK A FUNKCIÓKHOZ ---
  const [editingJob, setEditingJob] = useState<ServiceJob | null>(null); // Épp szerkesztett munka
  const [printJob, setPrintJob] = useState<ServiceJob | null>(null); // Épp nyomtatott munka
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {}, [printJob]);

  // Adatok betöltése
  useEffect(() => {
    loadHistory();
  }, [vehicle.id]);

  const loadHistory = async () => {
    try {
      const res = await apiService.getServiceJobs();
      const history = res.data
        .filter((j) => j.vehicleId === vehicle.id)
        .sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );
      setJobs(history);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Törlés logika
  const handleDelete = async (id: number) => {
    if (
      !window.confirm(
        "Biztosan törölni szeretnéd ezt a munkalapot? A művelet nem vonható vissza!",
      )
    )
      return;

    try {
      await apiService.deleteServiceJob(id);
      // Lista frissítése törlés után
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch (err) {
      alert("Hiba történt a törlés során!");
      console.error(err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const totalSpent = jobs.reduce((sum, job) => {
    const partsCost =
      job.jobParts?.reduce((pSum, p) => pSum + p.unitPrice * p.quantity, 0) ||
      0;
    return sum + job.laborCost + partsCost;
  }, 0);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        animation: "fadeIn 0.3s ease-in-out",
      }}
    >
      {/* FEJLÉC SÁV */}
      <div
        style={{
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#27272a",
          padding: "20px",
          borderRadius: "12px",
          border: "1px solid #3f3f46",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <button
            onClick={onBack}
            className="icon-btn"
            style={{
              background: "#3f3f46",
              width: "40px",
              height: "40px",
              borderRadius: "8px",
            }}
            title="Vissza a listához"
          >
            <ArrowLeft size={20} color="white" />
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.8rem", letterSpacing: "1px" }}>
              {vehicle.licensePlate}
            </h2>
            <span style={{ color: "#a1a1aa" }}>
              {vehicle.make} {vehicle.model} ({vehicle.year})
            </span>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "0.9rem", color: "#a1a1aa" }}>
            Összes költés:
          </div>
          <div
            style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#3b82f6" }}
          >
            {totalSpent.toLocaleString()} Ft
          </div>
        </div>
      </div>

      {/* TARTALOM */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          <p>Betöltés...</p>
        ) : jobs.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "#666",
              marginTop: "50px",
              padding: "40px",
              border: "2px dashed #3f3f46",
              borderRadius: "12px",
            }}
          >
            <Wrench size={48} style={{ marginBottom: "15px", opacity: 0.5 }} />
            <h3>Nincs szerviztörténet</h3>
            <p>Ennek a járműnek még nincs rögzített munkalapja.</p>
          </div>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "20px" }}
          >
            {jobs.map((job) => (
              <div
                key={job.id}
                style={{
                  background: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                  overflow: "hidden",
                }}
              >
                {/* Munkalap Fejléc & Gombok */}
                <div
                  style={{
                    padding: "15px 20px",
                    background: "#27272a",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid #3f3f46",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "15px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        color: "white",
                        fontWeight: "bold",
                      }}
                    >
                      <Calendar size={18} color="#3b82f6" />
                      {job.date
                        ? new Date(job.date).toLocaleDateString()
                        : "Dátum hiba"}
                    </div>
                    <span style={{ color: "#666" }}>|</span>
                    <span style={{ fontSize: "0.9rem", color: "#a1a1aa" }}>
                      Munkalap ID: #{job.id}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    {/* SZERKESZTÉS GOMB ✏️ */}
                    <button
                      onClick={() => setEditingJob(job)}
                      className="icon-btn"
                      style={{
                        background: "#3f3f46",
                        color: "white",
                        width: "32px",
                        height: "32px",
                        borderRadius: "6px",
                      }}
                      title="Szerkesztés"
                    >
                      <Edit size={16} />
                    </button>

                    {/* NYOMTATÁS GOMB 🖨️ */}
                    <button
                      onClick={() => setPrintJob(job)}
                      className="icon-btn"
                      style={{
                        background: "transparent",
                        border: "1px solid #3b82f6",
                        color: "#3b82f6",
                        width: "32px",
                        height: "32px",
                        borderRadius: "6px",
                      }}
                      title="Nyomtatás"
                    >
                      <Printer size={16} />
                    </button>

                    {/* TÖRLÉS GOMB 🗑️ */}
                    <button
                      onClick={() => job.id && handleDelete(job.id)}
                      className="icon-btn"
                      style={{
                        background: "rgba(239, 68, 68, 0.2)",
                        color: "#ef4444",
                        width: "32px",
                        height: "32px",
                        borderRadius: "6px",
                      }}
                      title="Törlés"
                    >
                      <Trash2 size={16} />
                    </button>

                    {/* STÁTUSZ CÍMKE */}
                    <span
                      style={{
                        fontSize: "0.8rem",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontWeight: "bold",
                        marginLeft: "10px",
                        background: job.isCompleted
                          ? "rgba(16, 185, 129, 0.15)"
                          : "rgba(234, 179, 8, 0.15)",
                        color: job.isCompleted ? "#10b981" : "#eab308",
                        border: job.isCompleted
                          ? "1px solid rgba(16, 185, 129, 0.3)"
                          : "1px solid rgba(234, 179, 8, 0.3)",
                      }}
                    >
                      {job.isCompleted ? "LEZÁRT" : "NYITOTT"}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 350px",
                    borderBottom: "1px solid #3f3f46",
                  }}
                >
                  {/* Leírás rész */}
                  <div
                    style={{
                      padding: "20px",
                      borderRight: "1px solid #3f3f46",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        color: "#a1a1aa",
                        fontSize: "0.8rem",
                        marginBottom: "8px",
                        textTransform: "uppercase",
                      }}
                    >
                      <FileText size={14} /> Elvégzett munka leírása
                    </div>
                    <div
                      style={{
                        color: "white",
                        lineHeight: "1.5",
                        fontSize: "1rem",
                      }}
                    >
                      {job.description || "Nincs leírás megadva."}
                    </div>
                  </div>

                  {/* Pénzügyi rész */}
                  <div
                    style={{
                      padding: "20px",
                      background: "rgba(0,0,0,0.2)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "5px",
                      }}
                    >
                      <span style={{ color: "#a1a1aa" }}>Munkadíj:</span>
                      <span>{job.laborCost.toLocaleString()} Ft</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "10px",
                      }}
                    >
                      <span style={{ color: "#a1a1aa" }}>Anyagköltség:</span>
                      <span>
                        {(
                          job.jobParts?.reduce(
                            (s, p) => s + p.unitPrice * p.quantity,
                            0,
                          ) || 0
                        ).toLocaleString()}{" "}
                        Ft
                      </span>
                    </div>
                    <div
                      style={{
                        borderTop: "1px solid #444",
                        paddingTop: "10px",
                        display: "flex",
                        justifyContent: "space-between",
                        fontWeight: "bold",
                        fontSize: "1.1rem",
                      }}
                    >
                      <span>Összesen:</span>
                      <span style={{ color: "#3b82f6" }}>
                        {(
                          (job.laborCost || 0) +
                          (job.jobParts?.reduce(
                            (s, p) => s + p.unitPrice * p.quantity,
                            0,
                          ) || 0)
                        ).toLocaleString()}{" "}
                        Ft
                      </span>
                    </div>
                  </div>
                </div>

                {/* Alkatrészek Listája */}
                {job.jobParts && job.jobParts.length > 0 && (
                  <div style={{ padding: "0" }}>
                    <div
                      style={{
                        padding: "10px 20px",
                        background: "#222",
                        color: "#a1a1aa",
                        fontSize: "0.8rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        borderBottom: "1px solid #333",
                      }}
                    >
                      <Package size={14} /> BEÉPÍTETT ALKATRÉSZEK
                    </div>
                    <table
                      style={{
                        width: "100%",
                        fontSize: "0.9rem",
                        borderCollapse: "collapse",
                      }}
                    >
                      <tbody>
                        {job.jobParts.map((part, idx) => (
                          <tr
                            key={idx}
                            style={{ borderBottom: "1px solid #27272a" }}
                          >
                            <td
                              style={{ padding: "12px 20px", width: "220px" }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "10px",
                                  fontFamily: "monospace",
                                  color: "#3b82f6",
                                  background: "rgba(59, 130, 246, 0.1)",
                                  padding: "4px 8px",
                                  borderRadius: "4px",
                                  width: "fit-content",
                                }}
                              >
                                {part.partNumber || "N/A"}
                                {part.partNumber && (
                                  <button
                                    onClick={() =>
                                      copyToClipboard(part.partNumber!)
                                    }
                                    title="Másolás"
                                    style={{
                                      background: "none",
                                      border: "none",
                                      cursor: "pointer",
                                      color:
                                        copiedId === part.partNumber
                                          ? "#10b981"
                                          : "#555",
                                      padding: 0,
                                      display: "flex",
                                    }}
                                  >
                                    {copiedId === part.partNumber ? (
                                      <CheckCircle size={14} />
                                    ) : (
                                      <Copy size={14} />
                                    )}
                                  </button>
                                )}
                              </div>
                            </td>
                            <td
                              style={{
                                padding: "12px 10px",
                                color: "white",
                                fontWeight: 500,
                              }}
                            >
                              {part.itemName ||
                                part.partName ||
                                "Névtelen alkatrész"}
                            </td>
                            <td
                              style={{
                                padding: "12px 10px",
                                textAlign: "center",
                                color: "#a1a1aa",
                              }}
                            >
                              {part.quantity} db
                            </td>
                            <td
                              style={{
                                padding: "12px 20px",
                                textAlign: "right",
                                fontWeight: "bold",
                              }}
                            >
                              {part.unitPrice.toLocaleString()} Ft
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- SZERKESZTÉS MODAL --- */}
      {editingJob && (
        <WorksheetModal
          appointmentId={editingJob.id || null} // Az ID-t adjuk át, hogy betöltse az adatokat
          vehicleName={vehicle.licensePlate}
          vehicleId={vehicle.id}
          onClose={() => setEditingJob(null)}
          onSave={() => {
            setEditingJob(null);
            loadHistory(); // Frissítjük a listát mentés után
          }}
        />
      )}

      {/* 👇 ÚJ NYOMTATÁS ELŐNÉZET MODAL */}
      {printJob && (
        <WorksheetPrintModal
          job={printJob}
          vehicle={vehicle}
          onClose={() => setPrintJob(null)}
        />
      )}
    </div>
  );
};

export default VehicleDetails;
