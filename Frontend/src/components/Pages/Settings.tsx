import React, { useState, useEffect } from "react";
import {
  Save,
  Building,
  CreditCard,
  Wrench,
  Lock,
  Camera,
  Upload,
} from "lucide-react";
import { InputField } from "../ui/FormElements";
import api from "../../api/api";

const Settings: React.FC = () => {
  // --- STATE-EK A CÉGES ADATOKHOZ ---
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [hourlyRate, setHourlyRate] = useState<number>(15000);
  const [vatRate, setVatRate] = useState<number>(27);
  const [saved, setSaved] = useState(false);

  // --- ÚJ STATE-EK: JELSZÓ ÉS PROFILKÉP ---
  const [passwords, setPasswords] = useState({
    oldPassword: "",
    newPassword: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // --- ADATOK BETÖLTÉSE A BACKEND-RŐL ---
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get("/Settings");
        if (response.data) {
          setCompanyName(response.data.companyName || "");
          setAddress(response.data.address || "");
          setTaxNumber(response.data.taxNumber || "");
          setPhone(response.data.phone || "");
          setEmail(response.data.email || "");
          setHourlyRate(response.data.hourlyRate || 15000);
          setVatRate(response.data.vatRate || 27);
        }
      } catch (err) {
        console.error("Hiba a beállítások betöltésekor:", err);
      }
    };

    fetchSettings();
  }, []);

  // --- CÉGADATOK ÉS PÉNZÜGYEK MENTÉSE A BACKEND-RE ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const settings = {
        companyName,
        address,
        taxNumber,
        phone,
        email,
        hourlyRate: Number(hourlyRate),
        vatRate: Number(vatRate),
      };

      await api.post("/Settings", settings);

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert("Hiba történt a rendszeradatok mentésekor!");
      console.error(err);
    }
  };

  // --- JELSZÓ MÓDOSÍTÁS (BACKEND) ---
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/Auth/change-password", passwords);
      alert("Sikeres jelszóváltás!");
      setPasswords({ oldPassword: "", newPassword: "" });
    } catch (err: any) {
      alert(err.response?.data?.message || "Hiba történt a jelszóváltáskor!");
    }
  };

  // --- PROFILKÉP FELTÖLTÉS (BACKEND) ---
  const handleFileUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await api.post("/Auth/upload-profile-picture", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Profilkép sikeresen feltöltve!");
      setSelectedFile(null);

      // ✅ 1. Frissítjük a localStorage-ot az új képpel
      // A backend visszaadja a teljes utat: "/uploads/kepneve.jpg"
      // Nekünk csak a fájlnév kell a végéről
      const filePath = res.data.filePath;
      const fileName = filePath.split("/").pop(); // Levágjuk a "/uploads/" részt

      const userData = JSON.parse(localStorage.getItem("user_data") || "{}");
      userData.profilePicturePath = fileName;
      localStorage.setItem("user_data", JSON.stringify(userData));

      // ✅ 2. Üzenünk a Sidebar-nak, hogy frissüljön!
      window.dispatchEvent(new Event("profile-updated"));
    } catch (err) {
      alert("Hiba a kép feltöltése során!");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", paddingBottom: "50px" }}>
      <h1
        style={{
          marginBottom: "30px",
          fontSize: "1.8rem",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <Wrench size={28} color="#3b82f6" /> Rendszer Beállítások
      </h1>

      {/* 1. PROFILKÉP ÉS SZEMÉLYES BEÁLLÍTÁSOK */}
      <div className="card" style={{ padding: "25px", marginBottom: "25px" }}>
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
          <Camera size={20} color="#3b82f6" /> Profilkép módosítása
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            style={{ color: "#a1a1aa" }}
          />
          <button
            onClick={handleFileUpload}
            disabled={!selectedFile || uploading}
            className="btn-add"
            style={{
              padding: "8px 20px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Upload size={16} />
            {uploading ? "Feltöltés..." : "Kép Mentése"}
          </button>
        </div>
      </div>

      {/* 2. BIZTONSÁG (JELSZÓ) */}
      <form
        onSubmit={handlePasswordChange}
        className="card"
        style={{ padding: "25px", marginBottom: "25px" }}
      >
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
          <Lock size={20} color="#ef4444" /> Jelszó módosítása
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "20px",
          }}
        >
          <InputField
            type="password"
            placeholder="Jelenlegi jelszó"
            value={passwords.oldPassword}
            onChange={(e) =>
              setPasswords({ ...passwords, oldPassword: e.target.value })
            }
            required
          />
          <InputField
            type="password"
            placeholder="Új jelszó"
            value={passwords.newPassword}
            onChange={(e) =>
              setPasswords({ ...passwords, newPassword: e.target.value })
            }
            required
          />
        </div>
        <button
          type="submit"
          className="btn-add"
          style={{ marginTop: "20px", background: "#ef4444", width: "100%" }}
        >
          Jelszó Frissítése
        </button>
      </form>

      {/* 3. CÉGES ADATOK ÉS PÉNZÜGYEK (BACKEND MENTÉS) */}
      <form
        onSubmit={handleSave}
        style={{ display: "flex", flexDirection: "column", gap: "25px" }}
      >
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
                Cégnév
              </label>
              <InputField
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
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
              <InputField
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
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
                Adószám
              </label>
              <InputField
                type="text"
                value={taxNumber}
                onChange={(e) => setTaxNumber(e.target.value)}
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
                Telefonszám
              </label>
              <InputField
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
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
                Email
              </label>
              <InputField
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
        </div>

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
                Rezsióradíj (Ft)
              </label>
              <InputField
                type="number"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(Number(e.target.value))}
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
                ÁFA (%)
              </label>
              <InputField
                type="number"
                value={vatRate}
                onChange={(e) => setVatRate(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="btn-add"
          style={{
            padding: "12px 30px",
            background: saved ? "#10b981" : "var(--accent-blue)",
          }}
        >
          <Save size={20} style={{ marginRight: "10px" }} />
          {saved ? "Beállítások Mentve! ✅" : "Rendszeradatok Mentése"}
        </button>
      </form>
    </div>
  );
};

export default Settings;
