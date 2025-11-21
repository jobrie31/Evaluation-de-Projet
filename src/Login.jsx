// src/Login.jsx
import React, { useState } from "react";
import "./App.css";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      if (onLoginSuccess) {
        onLoginSuccess(cred.user);
      }
    } catch (err) {
      console.error("Erreur de connexion:", err);
      let message =
        "Connexion impossible. Vérifie ton courriel et ton mot de passe.";
      if (err.code === "auth/user-not-found") {
        message = "Aucun utilisateur avec ce courriel.";
      } else if (err.code === "auth/wrong-password") {
        message = "Mot de passe invalide.";
      } else if (err.code === "auth/invalid-email") {
        message = "Courriel invalide.";
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-root">
      <div className="login-card">
        <h1 className="login-title">Connexion</h1>
        <p className="login-subtitle">
          Connecte-toi pour accéder à l’évaluation de projets.
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          <label className="login-label">
            Courriel
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="ton.email@styro.com"
            />
          </label>

          <label className="login-label">
            Mot de passe
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </label>

          {error && <div className="login-error">{error}</div>}

          <button
            type="submit"
            className="btn-primary login-button"
            disabled={submitting}
          >
            {submitting ? "Connexion..." : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
