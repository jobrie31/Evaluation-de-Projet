// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// (analytics pas obligatoire, donc on le laisse de côté pour l’instant)

// Config Firebase de ton projet
const firebaseConfig = {
  apiKey: "AIzaSyB15jP36S6WZeTG3GnFkjPX7aITQPbzfus",
  authDomain: "evaluation-de-projet.firebaseapp.com",
  projectId: "evaluation-de-projet",
  storageBucket: "evaluation-de-projet.firebasestorage.app",
  messagingSenderId: "911657491654",
  appId: "1:911657491654:web:a935c25ea9cdcf53e14bc7",
  measurementId: "G-7NSQZ6MYF2",
};

// Initialiser Firebase
const app = initializeApp(firebaseConfig);

// Exporter Firestore pour le reste de l'app
export const db = getFirestore(app);
