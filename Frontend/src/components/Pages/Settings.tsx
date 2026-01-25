import React, { useState, useEffect } from "react";
import {
  Save,
  Building,
  Phone,
  Mail,
  FileText,
  CreditCard,
  Percent,
  Wrench,
} from "lucide-react";
import { InputField } from "../ui/FormElements";

const Settings: React.FC = () => {
  // --- STATE-EK A BEÁLLÍTÁSOKHOZ ---
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [hourlyRate, setHourlyRate] = useState<number>(15000); // Alapértelmezett 15.000 Ft
  const [vatRate, setVatRate] = useState<number>(27); // Alapértelmezett 27%

  const [saved, setSaved] = useState(false);

  // --- BETÖLTÉS INDULÁSKOR ---
  useEffect(() => {
    const savedSettings = localStorage.getItem("appSettings");
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setCompanyName(parsed.companyName || "");
      setAddress(parsed.address || "");
      setTaxNumber(parsed.taxNumber || "");
      setPhone(parsed.phone || "");
      setEmail(parsed.email || "");
      setHourlyRate(parsed.hourlyRate || 15000);
      setVatRate(parsed.vatRate || 27);
    }
  }, []);

  // --- MENTÉS ---
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const settings = {
      companyName,
      address,
      taxNumber,
      phone,
      email,
      hourlyRate: Number(hourlyRate),
      vatRate: Number(vatRate),
    };

    localStorage.setItem("appSettings", JSON.stringify(settings));

    // Visszajelzés
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", paddingBottom: "50px" }}>
      {/* FEJLÉC */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "30px",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "1.8rem",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <Wrench size={28} color="#3b82f6" /> Rendszer Beállítások
        </h1>
      </div>

      <form
        onSubmit={handleSave}
        style={{ display: "flex", flexDirection: "column", gap: "25px" }}
      >
        {/* 1. CÉGES ADATOK KÁRTYA */}
        <div className="card" style={{ padding: "25px" }}>
          <h3
            style={{
              marginTop: 0,
              borderBottom: "1px solid #333",
              paddingBottom: "15px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              color: "#e4e4e7",
            }}
          >
            <Building size={20} color="#10b981" /> Cégadatok (Nyomtatáshoz)
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "20px",
            }}
          >
            <div style={{ gridColumn: "1 / -1" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  color: "#a1a1aa",
                  fontSize: "0.9rem",
                }}
              >
                Cégnév / Szerviz Neve
              </label>
              <InputField
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Pl. GTA Szerviz Kft."
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "#27272a",
                  border: "1px solid #3f3f46",
                  borderRadius: "8px",
                  color: "white",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  color: "#a1a1aa",
                  fontSize: "0.9rem",
                }}
              >
                Cím
              </label>
              <div style={{ position: "relative" }}>
                <Building
                  size={16}
                  style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    color: "#666",
                  }}
                />
                <InputField
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="1234 Budapest, Fő u. 1."
                  style={{
                    width: "100%",
                    padding: "12px 12px 12px 40px",
                    background: "#27272a",
                    border: "1px solid #3f3f46",
                    borderRadius: "8px",
                    color: "white",
                  }}
                />
              </div>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  color: "#a1a1aa",
                  fontSize: "0.9rem",
                }}
              >
                Adószám
              </label>
              <div style={{ position: "relative" }}>
                <FileText
                  size={16}
                  style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    color: "#666",
                  }}
                />
                <InputField
                  type="text"
                  value={taxNumber}
                  onChange={(e) => setTaxNumber(e.target.value)}
                  placeholder="12345678-1-42"
                  style={{
                    width: "100%",
                    padding: "12px 12px 12px 40px",
                    background: "#27272a",
                    border: "1px solid #3f3f46",
                    borderRadius: "8px",
                    color: "white",
                  }}
                />
              </div>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  color: "#a1a1aa",
                  fontSize: "0.9rem",
                }}
              >
                Telefonszám
              </label>
              <div style={{ position: "relative" }}>
                <Phone
                  size={16}
                  style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    color: "#666",
                  }}
                />
                <InputField
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+36 30 123 4567"
                  style={{
                    width: "100%",
                    padding: "12px 12px 12px 40px",
                    background: "#27272a",
                    border: "1px solid #3f3f46",
                    borderRadius: "8px",
                    color: "white",
                  }}
                />
              </div>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  color: "#a1a1aa",
                  fontSize: "0.9rem",
                }}
              >
                Email Cím
              </label>
              <div style={{ position: "relative" }}>
                <Mail
                  size={16}
                  style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    color: "#666",
                  }}
                />
                <InputField
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="info@gtaszerviz.hu"
                  style={{
                    width: "100%",
                    padding: "12px 12px 12px 40px",
                    background: "#27272a",
                    border: "1px solid #3f3f46",
                    borderRadius: "8px",
                    color: "white",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 2. PÉNZÜGYI BEÁLLÍTÁSOK */}
        <div className="card" style={{ padding: "25px" }}>
          <h3
            style={{
              marginTop: 0,
              borderBottom: "1px solid #333",
              paddingBottom: "15px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              color: "#e4e4e7",
            }}
          >
            <CreditCard size={20} color="#f59e0b" /> Árazás és Pénzügy
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "20px",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  color: "#a1a1aa",
                  fontSize: "0.9rem",
                }}
              >
                Alapértelmezett Rezsióradíj (Ft/óra)
              </label>
              <div style={{ position: "relative" }}>
                <Wrench
                  size={16}
                  style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    color: "#666",
                  }}
                />
                <InputField
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "12px 12px 12px 40px",
                    background: "#27272a",
                    border: "1px solid #3f3f46",
                    borderRadius: "8px",
                    color: "white",
                    fontWeight: "bold",
                  }}
                />
              </div>
              <div
                style={{ fontSize: "0.8rem", color: "#666", marginTop: "5px" }}
              >
                Ez alapján számolja majd a rendszer a munkadíjat.
              </div>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  color: "#a1a1aa",
                  fontSize: "0.9rem",
                }}
              >
                ÁFA Kulcs (%)
              </label>
              <div style={{ position: "relative" }}>
                <Percent
                  size={16}
                  style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    color: "#666",
                  }}
                />
                <InputField
                  type="number"
                  value={vatRate}
                  onChange={(e) => setVatRate(Number(e.target.value))}
                  placeholder="27"
                  style={{
                    width: "100%",
                    padding: "12px 12px 12px 40px",
                    background: "#27272a",
                    border: "1px solid #3f3f46",
                    borderRadius: "8px",
                    color: "white",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* MENTÉS GOMB */}
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <button
            type="submit"
            className="btn-add"
            style={{
              padding: "12px 30px",
              fontSize: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: saved ? "#10b981" : "var(--accent-blue)",
              transition: "all 0.3s",
            }}
          >
            <Save size={20} />
            {saved ? "Beállítások Mentve! ✅" : "Beállítások Mentése"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Settings;
