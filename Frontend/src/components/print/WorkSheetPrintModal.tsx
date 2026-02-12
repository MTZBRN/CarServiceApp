import React, { useRef, useState, useEffect } from "react";
import { useReactToPrint } from "react-to-print";
import { X, Printer } from "lucide-react";
import { Vehicle, ServiceJob } from "../../types";
import api from "../../api/api"; // ✅ API importálása

interface Props {
  job: ServiceJob;
  vehicle: Vehicle;
  onClose: () => void;
}

const WorksheetPrintModal: React.FC<Props> = ({ job, vehicle, onClose }) => {
  const componentRef = useRef<HTMLDivElement>(null);

  // Beállítások betöltése a szerverről
  const [settings, setSettings] = useState<any>({});

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // ✅ 1. Lekérjük a központi adatbázisból
        const response = await api.get("/Settings");
        if (response.data) {
          setSettings(response.data);
        }
      } catch (error) {
        console.error("Nem sikerült betölteni a cégadatokat", error);
        // Ha hiba van (pl. nincs net), megpróbáljuk a localStorage-ból
        const saved = localStorage.getItem("appSettings");
        if (saved) setSettings(JSON.parse(saved));
      }
    };

    fetchSettings();
  }, []);

  // Szerkeszthető adatok state
  const [formData, setFormData] = useState({
    serialNumber: `GTA-${new Date().getFullYear()}-${job.id}`,
    date: new Date().toLocaleDateString("hu-HU"),

    // Megrendelő
    customerName: vehicle.customer?.name || "",
    customerAddress: vehicle.customer?.address || "",
    customerPhone: vehicle.customer?.phoneNumber || "",

    // Jármű
    licensePlate: vehicle.licensePlate,
    make: vehicle.make,
    model: vehicle.model,
    type: "",
    vin: vehicle.vin || "",
    year: vehicle.year.toString(),
    km: "0",
    fuelLevel: "1/2",
    fuelType: "Benzin",
    accessories: "Forg. eng., Kulcs",

    // Sérülés / Munka
    damage: "nincs",
    workDescription: job.description || "",

    // Nyilatkozatok
    partsRequested: "nem tart igényt",
    customerMaterials: "-",

    // Pénzügy
    deadline: "",
    estimatedCost: "",
  });

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Munkalap_${formData.licensePlate}`,
  });

  // --- VÉGLEGES STÍLUSOK ---
  const printStyles = `
    @page {
      size: A4;
      margin: 10mm; 
    }
    @media print {
      body, html { 
        margin: 0; 
        padding: 0;
        background: white !important;
        color: black !important;
      }
      
      .modal-overlay > *:not(.print-wrapper) {
        display: none !important;
      }

      .print-wrapper {
        position: relative !important;
        width: 100% !important;
        height: auto !important;
        background: white !important;
        color: black !important;
        z-index: 9999 !important;
        display: block !important;
        font-family: "Times New Roman", Times, serif !important;
      }

      input, textarea, select {
        background: transparent !important;
        border: none !important;
        appearance: none !important;
        padding: 0 !important;
        color: black !important;
        font-family: "Times New Roman", Times, serif !important;
      }
      
      ::placeholder { color: transparent !important; }
      select { text-indent: 0.01px; text-overflow: ""; }
    }
  `;

  const inputStyle: React.CSSProperties = {
    border: "none",
    background: "rgba(254, 240, 138, 0.4)",
    width: "100%",
    fontFamily: '"Times New Roman", Times, serif',
    fontSize: "inherit",
    fontWeight: "inherit",
    color: "black",
    outline: "none",
    padding: "2px 5px",
    borderRadius: "2px",
  };

  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };
  const cellStyle: React.CSSProperties = {
    border: "1px solid black",
    padding: "4px",
    verticalAlign: "middle",
    color: "black",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "11px",
    color: "black",
    fontWeight: "bold",
    marginRight: "5px",
    whiteSpace: "nowrap",
  };

  return (
    <div
      className="modal-overlay"
      style={{
        zIndex: 2000,
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.8)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <style>{printStyles}</style>

      <div
        className="modal-content"
        style={{
          maxWidth: "1000px",
          width: "95%",
          height: "95vh",
          display: "flex",
          flexDirection: "column",
          background: "#52525b",
          padding: 0,
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        {/* FEJLÉC */}
        <div
          style={{
            padding: "15px 20px",
            background: "#18181b",
            color: "white",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid #333",
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: "1.2rem",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              🖨️ Munkalap Előnézet
            </h3>
            <span style={{ fontSize: "0.85rem", color: "#a1a1aa" }}>
              A sárga mezők szerkeszthetőek. Nyomtatásban fehér lesz.
            </span>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => handlePrint && handlePrint()}
              className="btn-add"
              style={{
                background: "#3b82f6",
                color: "white",
                border: "none",
                padding: "8px 16px",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                gap: 5,
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              <Printer size={18} /> Nyomtatás
            </button>
            <button
              onClick={onClose}
              style={{
                background: "#333",
                border: "1px solid #555",
                color: "white",
                padding: "8px",
                borderRadius: "6px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* GÖRGETHETŐ TERÜLET */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px",
            background: "#27272a",
            display: "flex",
            justifyContent: "center",
          }}
        >
          {/* --- A4-ES LAP --- */}
          <div
            ref={componentRef}
            className="print-wrapper"
            style={{
              width: "210mm",
              minHeight: "297mm",
              background: "white",
              padding: "10mm",
              color: "black",
              fontFamily: '"Times New Roman", Times, serif',
              fontSize: "12px",
              boxShadow: "0 0 20px rgba(0,0,0,0.5)",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            {/* 1. SORSZÁM / DÁTUM */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                border: "2px solid black",
                marginBottom: "-1px",
              }}
            >
              <tbody>
                <tr style={{ height: "35px" }}>
                  <td style={{ ...cellStyle, width: "30%" }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span style={labelStyle}>Száma:</span>
                      <input
                        value={formData.serialNumber}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            serialNumber: e.target.value,
                          })
                        }
                        style={{ ...inputStyle, fontWeight: "bold" }}
                      />
                    </div>
                  </td>
                  <td
                    style={{
                      ...cellStyle,
                      textAlign: "center",
                      fontSize: "20px",
                      fontWeight: "bold",
                      background: "#eee",
                      letterSpacing: "2px",
                    }}
                  >
                    MUNKALAP
                  </td>
                  <td style={{ ...cellStyle, width: "25%" }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span style={labelStyle}>Kelt:</span>
                      <input
                        value={formData.date}
                        onChange={(e) =>
                          setFormData({ ...formData, date: e.target.value })
                        }
                        style={inputStyle}
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 2. MEGRENDELŐ / SZERVIZ (ADATBÁZISBÓL) */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                border: "2px solid black",
              }}
            >
              <tbody>
                <tr
                  style={{
                    background: "#eee",
                    fontSize: "11px",
                    fontWeight: "bold",
                    textAlign: "center",
                  }}
                >
                  <td style={{ ...cellStyle, width: "50%" }}>MEGRENDELŐ</td>
                  <td style={cellStyle}>VÁLLALKOZÁS</td>
                </tr>
                <tr>
                  <td
                    style={{
                      ...cellStyle,
                      verticalAlign: "top",
                      height: "90px",
                    }}
                  >
                    <div style={{ display: "flex", marginBottom: 5 }}>
                      <span style={{ ...labelStyle, width: 30 }}>Név:</span>
                      <input
                        value={formData.customerName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            customerName: e.target.value,
                          })
                        }
                        style={{ ...inputStyle, fontWeight: "bold" }}
                      />
                    </div>
                    <div style={{ display: "flex", marginBottom: 5 }}>
                      <span style={{ ...labelStyle, width: 30 }}>Cím:</span>
                      <input
                        value={formData.customerAddress}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            customerAddress: e.target.value,
                          })
                        }
                        style={inputStyle}
                      />
                    </div>
                    <div style={{ display: "flex", marginBottom: 5 }}>
                      <span style={{ ...labelStyle, width: 30 }}>Tel:</span>
                      <input
                        value={formData.customerPhone}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            customerPhone: e.target.value,
                          })
                        }
                        style={inputStyle}
                      />
                    </div>
                  </td>
                  <td
                    style={{
                      ...cellStyle,
                      verticalAlign: "top",
                      textAlign: "center",
                    }}
                  >
                    {/* ✅ Itt jelennek meg a Settings API-ból jövő adatok */}
                    <div
                      style={{
                        fontWeight: "bold",
                        fontSize: "14px",
                        marginTop: "10px",
                      }}
                    >
                      {settings.companyName || "GTA Szerviz Kft."}
                    </div>
                    <div style={{ fontSize: "11px", marginTop: "5px" }}>
                      {settings.address || "2083 Solymár, Mátyás király út 45."}
                    </div>
                    <div style={{ fontSize: "11px" }}>
                      Tel: {settings.phone || "+36-70/422-8889"}
                    </div>
                    <div style={{ fontSize: "11px" }}>
                      Adószám: {settings.taxNumber || "29028933-2-13"}
                    </div>
                    <div style={{ fontSize: "11px" }}>
                      Email: {settings.email || ""}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 3. JÁRMŰ ADATOK */}
            <div
              style={{
                textAlign: "center",
                fontWeight: "bold",
                border: "2px solid black",
                borderTop: "none",
                borderBottom: "none",
                background: "#eee",
                fontSize: "11px",
                padding: "2px",
              }}
            >
              JÁRMŰ ADATOK
            </div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                border: "2px solid black",
              }}
            >
              <tbody>
                <tr>
                  <td style={{ ...cellStyle, width: "33%" }}>
                    <div style={{ display: "flex" }}>
                      <span style={labelStyle}>Frsz:</span>
                      <input
                        value={formData.licensePlate}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            licensePlate: e.target.value,
                          })
                        }
                        style={{ ...inputStyle, fontWeight: "bold" }}
                      />
                    </div>
                  </td>
                  <td style={{ ...cellStyle, width: "33%" }}>
                    <div style={{ display: "flex" }}>
                      <span style={labelStyle}>Gyártmány:</span>
                      <input
                        value={formData.make}
                        onChange={(e) =>
                          setFormData({ ...formData, make: e.target.value })
                        }
                        style={inputStyle}
                      />
                    </div>
                  </td>
                  <td style={cellStyle}>
                    <div style={{ display: "flex" }}>
                      <span style={labelStyle}>Típus:</span>
                      <input
                        value={formData.model}
                        onChange={(e) =>
                          setFormData({ ...formData, model: e.target.value })
                        }
                        style={inputStyle}
                      />
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style={cellStyle}>
                    <div style={{ display: "flex" }}>
                      <span style={labelStyle}>Km óra:</span>
                      <input
                        value={formData.km}
                        onChange={(e) =>
                          setFormData({ ...formData, km: e.target.value })
                        }
                        style={{
                          ...inputStyle,
                          width: "80px",
                          textAlign: "right",
                        }}
                      />
                      <span
                        style={{
                          fontSize: "11px",
                          alignSelf: "center",
                          marginLeft: 5,
                        }}
                      >
                        km
                      </span>
                    </div>
                  </td>
                  <td style={cellStyle}>
                    <div style={{ display: "flex" }}>
                      <span style={labelStyle}>Üzemanyag:</span>
                      <select
                        value={formData.fuelType}
                        onChange={(e) =>
                          setFormData({ ...formData, fuelType: e.target.value })
                        }
                        style={selectStyle}
                      >
                        <option value="Benzin">Benzin</option>
                        <option value="Dízel">Dízel</option>
                        <option value="Hibrid">Hibrid</option>
                        <option value="Elektromos">Elektromos</option>
                      </select>
                    </div>
                  </td>
                  <td style={cellStyle}>
                    <div style={{ display: "flex" }}>
                      <span style={labelStyle}>Szint:</span>
                      <select
                        value={formData.fuelLevel}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            fuelLevel: e.target.value,
                          })
                        }
                        style={selectStyle}
                      >
                        <option value="Üres">Üres</option>
                        <option value="1/4">1/4</option>
                        <option value="1/2">1/2</option>
                        <option value="3/4">3/4</option>
                        <option value="Tele">Tele</option>
                      </select>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} style={cellStyle}>
                    <div style={{ display: "flex" }}>
                      <span style={labelStyle}>Tartozékok / Egyéb:</span>
                      <input
                        value={formData.accessories}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            accessories: e.target.value,
                          })
                        }
                        style={inputStyle}
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 4. SÉRÜLÉSEK */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                border: "2px solid black",
                borderTop: "none",
              }}
            >
              <tbody>
                <tr>
                  <td style={cellStyle}>
                    <div style={{ display: "flex" }}>
                      <span style={labelStyle}>Sérülés:</span>
                      <input
                        value={formData.damage}
                        onChange={(e) =>
                          setFormData({ ...formData, damage: e.target.value })
                        }
                        style={inputStyle}
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 5. HIBALEÍRÁS */}
            <div
              style={{
                flex: 1,
                border: "2px solid black",
                borderTop: "none",
                display: "flex",
                flexDirection: "column",
                minHeight: "200px",
              }}
            >
              <div
                style={{
                  background: "#eee",
                  fontSize: "11px",
                  padding: "4px",
                  borderBottom: "1px solid black",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <strong>Hibaleírás / Megrendelt munka:</strong>
                <span style={{ fontSize: "10px", fontWeight: "normal" }}>
                  műszaki vizsga / átvizsgálás / egyéb
                </span>
              </div>
              <textarea
                value={formData.workDescription}
                onChange={(e) =>
                  setFormData({ ...formData, workDescription: e.target.value })
                }
                style={{
                  flex: 1,
                  width: "100%",
                  border: "none",
                  resize: "none",
                  fontFamily: '"Times New Roman", Times, serif',
                  fontSize: "14px",
                  lineHeight: "1.5",
                  outline: "none",
                  background: "rgba(254, 240, 138, 0.2)",
                  padding: "10px",
                  color: "black",
                }}
              />
            </div>

            {/* 6. ALSÓ SZEKCIÓK */}
            <div style={{ marginTop: "auto", paddingTop: "10px" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  border: "2px solid black",
                  borderTop: "none",
                }}
              >
                <tbody>
                  <tr>
                    <td style={{ ...cellStyle, width: "50%" }}>
                      <span style={labelStyle}>
                        A kiszerelt alkatrészekre a megrendelő:
                      </span>
                      <select
                        value={formData.partsRequested}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            partsRequested: e.target.value,
                          })
                        }
                        style={selectStyle}
                      >
                        <option value="nem tart igényt">nem tart igényt</option>
                        <option value="igényt tart">igényt tart</option>
                      </select>
                    </td>
                    <td style={cellStyle}>
                      <div style={{ display: "flex" }}>
                        <span style={labelStyle}>Átadott anyagok:</span>
                        <input
                          value={formData.customerMaterials}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              customerMaterials: e.target.value,
                            })
                          }
                          style={inputStyle}
                        />
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...cellStyle }}>
                      <div style={{ display: "flex" }}>
                        <span style={labelStyle}>Vállalási határidő:</span>
                        <input
                          value={formData.deadline}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              deadline: e.target.value,
                            })
                          }
                          style={inputStyle}
                          placeholder="ÉÉÉÉ.HH.NN"
                        />
                      </div>
                    </td>
                    <td style={{ ...cellStyle }}>
                      <div style={{ display: "flex" }}>
                        <span style={labelStyle}>
                          Várható javítási költség (nettó Ft):
                        </span>
                        <input
                          value={formData.estimatedCost}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              estimatedCost: e.target.value,
                            })
                          }
                          style={{ ...inputStyle, fontWeight: "bold" }}
                        />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div
                style={{
                  border: "2px solid black",
                  borderTop: "none",
                  padding: "6px",
                  fontSize: "9px",
                  textAlign: "justify",
                  lineHeight: "1.2",
                }}
              >
                <strong>Megrendelő nyilatkozata:</strong> Az Adatvédelmi
                Szabályzatban illetve Vállalási Szabályzatban foglaltakat
                megismertem, tudomásul vettem és ennek ismeretében rendelem meg
                a munka elvégzését. Tudomásul veszem, hogy az általam hozott
                anyagokra, alkatrészekre a vállalkozó garanciát nem vállal. A
                jármű készre jelentése után legkésőbb 3 munkanapon belül köteles
                vagyok a járművet elszállítani (számla kiegyenlítése után), ezen
                túl a vállalkozó tárolási díjat számíthat fel. A jármű javítása
                után esetenként közúti próbára kerülhet sor, melyhez
                hozzájárulok.
              </div>

              {/* ALÁÍRÁS HELY */}
              <div
                style={{
                  border: "2px solid black",
                  borderTop: "none",
                  display: "flex",
                  height: "120px",
                }}
              >
                <div
                  style={{
                    flex: 1,
                    borderRight: "1px solid black",
                    padding: "10px",
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ fontSize: "11px", textAlign: "left" }}>
                    A jármű fenti munkáit megrendelem és átadom:
                  </div>
                  <div style={{ marginTop: "auto" }}>
                    <div
                      style={{
                        borderTop: "1px solid black",
                        width: "80%",
                        margin: "0 auto",
                        paddingTop: "5px",
                        fontSize: "11px",
                      }}
                    >
                      (megrendelő)
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    flex: 1,
                    padding: "10px",
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ fontSize: "11px", textAlign: "left" }}>
                    A járművet átvettem:
                  </div>
                  <div style={{ marginTop: "auto" }}>
                    <div
                      style={{
                        borderTop: "1px solid black",
                        width: "80%",
                        margin: "0 auto",
                        paddingTop: "5px",
                        fontSize: "11px",
                      }}
                    >
                      (vállalkozó képviselője)
                    </div>
                  </div>
                </div>
              </div>

              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  border: "2px solid black",
                  marginTop: "5px",
                  fontSize: "10px",
                }}
              >
                <tbody>
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        padding: "4px",
                        borderBottom: "1px solid black",
                      }}
                    >
                      Az elvégzett munka megfelelő, a jármű közúti forgalomban
                      résztvehet. A járművet megtekintettem/kipróbáltam.
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        borderRight: "1px solid black",
                        padding: "10px 5px",
                        verticalAlign: "bottom",
                        width: "25%",
                        height: "40px",
                      }}
                    >
                      Átadó:
                    </td>
                    <td
                      style={{
                        borderRight: "1px solid black",
                        padding: "10px 5px",
                        verticalAlign: "bottom",
                        width: "25%",
                      }}
                    >
                      Kelt: ...................
                    </td>
                    <td
                      style={{
                        borderRight: "1px solid black",
                        padding: "10px 5px",
                        verticalAlign: "bottom",
                        width: "25%",
                      }}
                    >
                      Átvevő:
                    </td>
                    <td
                      style={{
                        padding: "10px 5px",
                        verticalAlign: "bottom",
                        width: "25%",
                      }}
                    >
                      Kelt: ...................
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorksheetPrintModal;
