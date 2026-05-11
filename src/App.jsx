// src/App.jsx
import React, { useState } from "react";
import Login from "./Login";
import EvalProjet from "./EvalProjet";
import SoumissionPanneaux from "./SoumissionPanneaux";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("evalProjet");

  if (!user) {
    return <Login onLoginSuccess={(u) => setUser(u)} />;
  }

  return (
    <div className="app-shell">
      <nav
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
          padding: "12px 18px",
          background: "#0f172a",
          borderBottom: "1px solid rgba(255,255,255,0.12)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <button
          type="button"
          onClick={() => setPage("evalProjet")}
          className="btn-primary"
          style={{
            background: page === "evalProjet" ? "#2563eb" : "#334155",
          }}
        >
          Évaluation projets
        </button>

        <button
          type="button"
          onClick={() => setPage("soumissionPanneaux")}
          className="btn-primary"
          style={{
            background: page === "soumissionPanneaux" ? "#2563eb" : "#334155",
          }}
        >
          Soumission panneaux
        </button>
      </nav>

      {page === "evalProjet" && <EvalProjet user={user} />}
      {page === "soumissionPanneaux" && <SoumissionPanneaux user={user} />}
    </div>
  );
}

export default App;