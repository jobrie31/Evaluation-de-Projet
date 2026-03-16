// src/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Config Firebase de Planification Styro
const firebaseConfig = {
  apiKey: "AIzaSyANkJRYoCA1e2CsCoFslfnKJzgV-KlRHn8",
  authDomain: "planification-styro.firebaseapp.com",
  projectId: "planification-styro",
  storageBucket: "planification-styro.firebasestorage.app",
  messagingSenderId: "387018358469",
  appId: "1:387018358469:web:bf4436c734a15f69c3aac",
};

// Évite une double initialisation en dev / hot reload
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Exporter Firestore pour le reste de l'app
export const db = getFirestore(app);

// Exporter Auth pour le login
export const auth = getAuth(app);

export default app;