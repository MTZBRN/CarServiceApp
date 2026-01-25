import React, { useState } from "react";
import { Wrench, Lock, User, ArrowRight } from "lucide-react";
import { authService } from "../../api/authService";

interface Props {
  onLogin: (token: string) => void;
}

const Login: React.FC<Props> = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Itt hívjuk meg az új szolgáltatást
    const user = authService.login(username, password);

    if (user) {
      // Sikeres belépés!
      // Ha akarod, elmentheted a nevet is a localStorage-ba, hogy kiírd az App.tsx-ben
      localStorage.setItem("currentUser", JSON.stringify(user));
      onLogin(user.role); // Átadhatjuk a role-t is az App-nak!
    } else {
      setError("Hibás felhasználónév vagy jelszó!");
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
        background: "#121212",
        backgroundImage:
          "radial-gradient(circle at 50% 50%, #1e1e24 0%, #121212 100%)",
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: "400px",
          width: "90%",
          padding: "40px",
          borderRadius: "16px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
          border: "1px solid #333",
        }}
      >
        {/* LOGO */}
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
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
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
            Jelentkezz be a folytatáshoz
          </p>
        </div>

        {/* FORM */}
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
              }}
            />
            <input
              type="text"
              placeholder="Felhasználónév"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ paddingLeft: "40px", height: "45px", fontSize: "1rem" }}
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
              }}
            />
            <input
              type="password"
              placeholder="Jelszó"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ paddingLeft: "40px", height: "45px", fontSize: "1rem" }}
            />
          </div>

          <button
            type="submit"
            className="btn-add"
            style={{
              height: "50px",
              marginTop: "10px",
              fontSize: "1rem",
              fontWeight: "bold",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "10px",
              background: loading
                ? "#4b5563"
                : "linear-gradient(90deg, #3b82f6, #8b5cf6)",
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
            fontSize: "0.8rem",
            color: "#555",
          }}
        >
          &copy; 2026 GTA Service Manager v1.0
        </div>
      </div>
    </div>
  );
};

export default Login;
