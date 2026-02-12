import React, { useState } from "react";
import { Wrench, Lock, User, ArrowRight } from "lucide-react";
import axios from "axios";
// import { authService } from "../../api/authService"; // Ez most nem kell, ha direkt axios-t használsz

interface Props {
  onLogin: (token: string, username: string, role: string) => void;
}

const Login: React.FC<Props> = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await axios.post(
        "http://localhost:5232/api/Auth/login",
        {
          email: username,
          password: password,
        },
      );

      // ✅ KIBŐVÍTVE: Kiszedjük a profilképet is a válaszból
      // (A Backend camelCase-re konvertálja a mezőneveket: Token -> token, ProfilePicturePath -> profilePicturePath)
      const { token, userName, role, profilePicturePath } = response.data;

      // ✅ FONTOS: Elmentjük a Sidebar számára szükséges adatokat
      localStorage.setItem("authToken", token); // Ez kell az API hívásokhoz

      // Ez pedig a Sidebar-nak kell a megjelenítéshez:
      localStorage.setItem(
        "user_data",
        JSON.stringify({
          name: userName,
          role: role,
          profilePicturePath: profilePicturePath, // Itt mentjük el a kép nevét!
        }),
      );

      // Értesítjük az App.tsx-et a sikeres belépésről
      onLogin(token, userName, role);
    } catch (err: any) {
      console.error(err); // Segít a debuggolásban
      setError(
        err.response?.data?.message || "Hibás felhasználónév vagy jelszó!",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#09090b",
        backgroundImage:
          "radial-gradient(circle at 50% 50%, #1e1e24 0%, #09090b 100%)",
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: "400px",
          width: "90%",
          padding: "40px",
          borderRadius: "16px",
          background: "#18181b",
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
          border: "1px solid #27272a",
        }}
      >
        {/* LOGO SZEKCIÓ */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: "30px",
          }}
        >
          <div
            style={{
              width: "60px",
              height: "60px",
              background: "#3b82f6",
              borderRadius: "12px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              boxShadow: "0 10px 20px rgba(59, 130, 246, 0.4)",
              marginBottom: "15px",
            }}
          >
            <Wrench size={32} color="white" />
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: "1.8rem",
              color: "white",
              fontWeight: 800,
            }}
          >
            GTA Szerviz
          </h1>
          <p
            style={{
              margin: "5px 0 0 0",
              color: "#a1a1aa",
              fontSize: "0.9rem",
            }}
          >
            Bejelentkezés a rendszerbe
          </p>
        </div>

        {/* BEJELENTKEZÉSI FORM */}
        <form
          onSubmit={handleLoginSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "15px" }}
        >
          {error && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                color: "#ef4444",
                padding: "10px",
                borderRadius: "6px",
                fontSize: "0.85rem",
                textAlign: "center",
                border: "1px solid rgba(239, 68, 68, 0.3)",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ position: "relative" }}>
            <User
              size={18}
              color="#a1a1aa"
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 1,
              }}
            />
            <input
              type="text"
              placeholder="Felhasználónév (Email)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px 12px 12px 40px",
                background: "#27272a",
                border: "1px solid #3f3f46",
                color: "white",
                borderRadius: "8px",
                boxSizing: "border-box",
                fontSize: "1rem",
              }}
            />
          </div>

          <div style={{ position: "relative" }}>
            <Lock
              size={18}
              color="#a1a1aa"
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 1,
              }}
            />
            <input
              type="password"
              placeholder="Jelszó"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px 12px 12px 40px",
                background: "#27272a",
                border: "1px solid #3f3f46",
                color: "white",
                borderRadius: "8px",
                boxSizing: "border-box",
                fontSize: "1rem",
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              height: "50px",
              marginTop: "10px",
              fontSize: "1rem",
              fontWeight: "bold",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "10px",
              cursor: loading ? "not-allowed" : "pointer",
              borderRadius: "8px",
              border: "none",
              color: "white",
              background: loading ? "#3f3f46" : "#3b82f6",
              transition: "background 0.2s",
            }}
            disabled={loading}
          >
            {loading ? (
              "Belépés..."
            ) : (
              <>
                Belépés <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div
          style={{
            marginTop: "25px",
            textAlign: "center",
            fontSize: "0.75rem",
            color: "#52525b",
          }}
        >
          &copy; 2026 GTA Szerviz Rendszer v1.0
        </div>
      </div>
    </div>
  );
};

export default Login;
