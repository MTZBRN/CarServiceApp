import React, { useState, useEffect } from "react";
import { apiService } from "../../api/apiService";
import { ServiceJob } from "../../types";

interface Props {
  vehicleId: number;
  vehiclePlate: string;
  onClose: () => void;
}

const VehicleHistoryModal: React.FC<Props> = ({
  vehicleId,
  vehiclePlate,
  onClose,
}) => {
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedJobId, setExpandedJobId] = useState<number | null>(null); // Melyik sor van lenyitva?

  useEffect(() => {
    apiService
      .getServiceHistory(vehicleId)
      .then((res) => setJobs(res.data))
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  }, [vehicleId]);

  // Ár formázó (pl. 12 500 Ft)
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("hu-HU", {
      style: "currency",
      currency: "HUF",
      maximumFractionDigits: 0,
    }).format(val);

  // Dátum formázó
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("hu-HU", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Összeg számoló
  const calculateTotal = (job: ServiceJob) => {
    const partsTotal = job.jobParts.reduce(
      (sum, p) => sum + p.quantity * p.unitPrice,
      0,
    );
    return partsTotal + job.laborCost;
  };

  const toggleExpand = (id: number) => {
    if (expandedJobId === id) setExpandedJobId(null);
    else setExpandedJobId(id);
  };

  return (
    <div className="modal-overlay modal-on-top" onClick={onClose}>
      <div
        className="modal-content modal-dynamic"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "95vw", maxWidth: "1000px" }}
      >
        <button className="close-modal-btn" onClick={onClose}>
          ✖
        </button>

        <div
          style={{
            borderBottom: "2px solid #3498db",
            marginBottom: "20px",
            paddingBottom: "10px",
          }}
        >
          <h2 style={{ margin: 0 }}>📜 Szerviz Történet: {vehiclePlate}</h2>
        </div>

        {isLoading ? (
          <p>Betöltés...</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            {jobs.length === 0 ? (
              <p
                style={{
                  fontStyle: "italic",
                  color: "#777",
                  textAlign: "center",
                }}
              >
                Ehhez az autóhoz még nincs rögzítve munkalap.
              </p>
            ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: "600px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#f8f9fa",
                      borderBottom: "2px solid #ddd",
                      textAlign: "left",
                    }}
                  >
                    <th style={{ padding: "12px" }}>Dátum</th>
                    <th style={{ padding: "12px" }}>Leírás</th>
                    <th style={{ padding: "12px" }}>Státusz</th>
                    <th style={{ padding: "12px", textAlign: "right" }}>
                      Végösszeg
                    </th>
                    <th style={{ padding: "12px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <React.Fragment key={job.id}>
                      {/* FŐ SOR */}
                      <tr
                        onClick={() => toggleExpand(job.id!)}
                        style={{
                          borderBottom: "1px solid #eee",
                          cursor: "pointer",
                          background:
                            expandedJobId === job.id ? "#eef2f7" : "white",
                        }}
                      >
                        <td style={{ padding: "12px", fontWeight: "bold" }}>
                          {formatDate(job.appointment?.startTime)}
                        </td>
                        <td
                          style={{
                            padding: "12px",
                            color:
                              job.description || job.appointment?.note
                                ? "inherit"
                                : "#777",
                            fontStyle:
                              job.description || job.appointment?.note
                                ? "normal"
                                : "italic",
                          }}
                        >
                          {job.description ||
                            job.appointment?.note ||
                            "Nincs leírás"}
                        </td>
                        <td style={{ padding: "12px" }}>
                          {job.isCompleted ? (
                            <span
                              style={{
                                background: "#d4edda",
                                color: "#155724",
                                padding: "4px 8px",
                                borderRadius: "12px",
                                fontSize: "0.85rem",
                              }}
                            >
                              Kész
                            </span>
                          ) : (
                            <span
                              style={{
                                background: "#fff3cd",
                                color: "#856404",
                                padding: "4px 8px",
                                borderRadius: "12px",
                                fontSize: "0.85rem",
                              }}
                            >
                              Folyamatban
                            </span>
                          )}
                        </td>
                        <td
                          style={{
                            padding: "12px",
                            textAlign: "right",
                            fontWeight: "bold",
                            color: "#2c3e50",
                          }}
                        >
                          {formatCurrency(calculateTotal(job))}
                        </td>
                        <td style={{ padding: "12px", textAlign: "center" }}>
                          {expandedJobId === job.id ? "🔼" : "🔽"}
                        </td>
                      </tr>

                      {/* LENYÍLÓ RÉSZLETEK (Alkatrészek + Cikkszámok) */}
                      {expandedJobId === job.id && (
                        <tr>
                          <td
                            colSpan={5}
                            style={{
                              background: "#f8f9fa",
                              padding: "15px",
                              borderBottom: "2px solid #ddd",
                            }}
                          >
                            <div style={{ paddingLeft: "20px" }}>
                              <h4
                                style={{
                                  marginTop: 0,
                                  marginBottom: "10px",
                                  color: "#555",
                                }}
                              >
                                🛠️ Beépített alkatrészek és költségek:
                              </h4>

                              <table
                                style={{
                                  width: "100%",
                                  fontSize: "0.9rem",
                                  background: "white",
                                  border: "1px solid #ddd",
                                }}
                              >
                                <thead style={{ background: "#eee" }}>
                                  <tr>
                                    <th
                                      style={{
                                        padding: "8px",
                                        textAlign: "left",
                                      }}
                                    >
                                      Cikkszám
                                    </th>
                                    <th
                                      style={{
                                        padding: "8px",
                                        textAlign: "left",
                                      }}
                                    >
                                      Megnevezés
                                    </th>
                                    <th
                                      style={{
                                        padding: "8px",
                                        textAlign: "center",
                                      }}
                                    >
                                      Mennyiség
                                    </th>
                                    <th
                                      style={{
                                        padding: "8px",
                                        textAlign: "right",
                                      }}
                                    >
                                      Egységár
                                    </th>
                                    <th
                                      style={{
                                        padding: "8px",
                                        textAlign: "right",
                                      }}
                                    >
                                      Összesen
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {job.jobParts.map((part, idx) => (
                                    <tr
                                      key={idx}
                                      style={{ borderBottom: "1px solid #eee" }}
                                    >
                                      <td
                                        style={{
                                          padding: "8px",
                                          fontFamily: "monospace",
                                          fontWeight: "bold",
                                          color: "#444",
                                        }}
                                      >
                                        {part.partNumber || "-"}
                                      </td>
                                      <td style={{ padding: "8px" }}>
                                        {part.partName}
                                      </td>
                                      <td
                                        style={{
                                          padding: "8px",
                                          textAlign: "center",
                                        }}
                                      >
                                        {part.quantity} db
                                      </td>
                                      <td
                                        style={{
                                          padding: "8px",
                                          textAlign: "right",
                                        }}
                                      >
                                        {formatCurrency(part.unitPrice)}
                                      </td>
                                      <td
                                        style={{
                                          padding: "8px",
                                          textAlign: "right",
                                        }}
                                      >
                                        {formatCurrency(
                                          part.quantity * part.unitPrice,
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                  {/* Munkadíj sor */}
                                  <tr style={{ background: "#fffbec" }}>
                                    <td colSpan={3}></td>
                                    <td
                                      style={{
                                        padding: "8px",
                                        textAlign: "right",
                                        fontWeight: "bold",
                                      }}
                                    >
                                      Munkadíj:
                                    </td>
                                    <td
                                      style={{
                                        padding: "8px",
                                        textAlign: "right",
                                        fontWeight: "bold",
                                      }}
                                    >
                                      {formatCurrency(job.laborCost)}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VehicleHistoryModal;
