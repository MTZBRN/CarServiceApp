import React, { useEffect, useState } from "react";
import { apiService } from "../../api/apiService";
import { ServiceJob, Vehicle } from "../../types";
import { ArrowLeft, Trash2, RefreshCw, Database } from "lucide-react";

interface Props {
  onBack: () => void;
}

const DevDashboard: React.FC<Props> = ({ onBack }) => {
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [jobsRes, vehiclesRes] = await Promise.all([
        apiService.getServiceJobs(),
        apiService.getVehicles(),
      ]);
      setJobs(jobsRes.data);
      setVehicles(vehiclesRes.data);
    } catch (err: any) {
      setError("Hiba: " + (err.message || ""));
    } finally {
      setLoading(false);
    }
  };

  // 👇 EZT A FÜGGVÉNYT ADTUK HOZZÁ
  const handleSeed = async () => {
    if (
      !window.confirm(
        "Biztosan generálsz tesztadatokat? Ez csak üres adatbázisnál működik hibátlanul.",
      )
    )
      return;
    setLoading(true);
    try {
      await apiService.seedDatabase();
      alert("Sikeres feltöltés! 🚀");
      loadData(); // Azonnal frissítjük a listát
    } catch (err: any) {
      // Itt kezeljük le, ha a backend azt mondja, hogy már vannak adatok
      const msg = err.response?.data || err.message || "Nem sikerült.";
      alert("Hiba: " + msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteJob = async (id: number) => {
    if (!window.confirm("Biztosan törölni akarod?")) return;
    try {
      await apiService.deleteServiceJob(id);
      loadData();
    } catch (err) {
      alert("Hiba a törlésnél!");
    }
  };

  return (
    <div
      style={{
        padding: "20px",
        color: "white",
        background: "#111",
        minHeight: "100vh",
        fontFamily: "monospace",
      }}
    >
      {/* FEJLÉC */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          paddingBottom: "20px",
          borderBottom: "1px solid #333",
        }}
      >
        <h1 style={{ margin: 0, color: "#eab308" }}>
          🛠️ DEV MÓD: Nyers Adatok
        </h1>
        <div style={{ display: "flex", gap: "10px" }}>
          {/* 👇 ITT AZ ÚJ SEED GOMB */}
          <button
            onClick={handleSeed}
            style={{
              padding: "10px 15px",
              cursor: "pointer",
              background: "#7c3aed",
              color: "white",
              border: "none",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontWeight: "bold",
            }}
            title="Tesztadatok generálása"
          >
            <Database size={16} /> Seed Data
          </button>

          <button
            onClick={loadData}
            style={{
              padding: "10px",
              cursor: "pointer",
              background: "#333",
              color: "white",
              border: "none",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <RefreshCw size={16} /> Frissítés
          </button>

          <button
            onClick={onBack}
            style={{
              padding: "10px 20px",
              cursor: "pointer",
              background: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <ArrowLeft size={16} /> Vissza az Appba
          </button>
        </div>
      </div>

      {loading && (
        <p style={{ color: "yellow" }}>Betöltés / Művelet folyamatban...</p>
      )}
      {error && (
        <div style={{ background: "red", padding: "10px" }}>⚠️ {error}</div>
      )}

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}
      >
        {/* JÁRMŰVEK */}
        <div
          style={{
            border: "1px solid #333",
            padding: "10px",
            background: "#222",
          }}
        >
          <h2>🚗 Járművek ({vehicles.length})</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {vehicles.map((v) => (
              <li
                key={v.id}
                style={{
                  marginBottom: "5px",
                  padding: "5px",
                  borderBottom: "1px solid #444",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>
                  <strong>[{v.id}]</strong> {v.licensePlate} ({v.make})
                </span>
                <span style={{ color: "#888" }}>Ügyfél ID: {v.customerId}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* MUNKALAPOK */}
        <div
          style={{
            border: "1px solid #333",
            padding: "10px",
            background: "#222",
          }}
        >
          <h2>🔧 Munkalapok ({jobs.length})</h2>
          <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
            {jobs.map((j) => (
              <div
                key={j.id}
                style={{
                  marginBottom: "10px",
                  padding: "10px",
                  background: "#1a1a1a",
                  border: "1px solid #444",
                }}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ color: "#eab308" }}>ID: #{j.id}</span>
                  <span>Jármű ID: {j.vehicleId}</span>
                </div>
                <div>{j.description}</div>
                <div
                  style={{
                    marginTop: "5px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <small>{j.jobParts?.length || 0} alkatrész</small>
                  <button
                    onClick={() => j.id && handleDeleteJob(j.id)}
                    style={{
                      color: "red",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DevDashboard;
