// src/EvalProjet.jsx
import React, { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

const EVAL_PROJET_CSS = `
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background:
    radial-gradient(circle at top left, rgba(37, 99, 235, 0.12), transparent 34%),
    linear-gradient(135deg, #eef2ff 0%, #f8fafc 45%, #f1f5f9 100%);
  color: #0f172a;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.app-root {
  min-height: 100vh;
  padding: 26px 0 60px;
}

/* ---------- Header ---------- */

.app-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 18px 22px;
  margin-bottom: 22px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(14px);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.12);
}

.app-header h1 {
  color: #0f172a;
  text-shadow: 0 1px 0 rgba(255,255,255,0.7);
}

/* ---------- Buttons ---------- */

button {
  font-family: inherit;
}

.btn-primary {
  border: none;
  border-radius: 999px;
  padding: 13px 22px;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: white;
  font-weight: 800;
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 12px 28px rgba(37, 99, 235, 0.28);
  transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;
  white-space: nowrap;
}

.btn-primary:hover {
  transform: translateY(-2px);
  filter: brightness(1.05);
  box-shadow: 0 16px 34px rgba(37, 99, 235, 0.34);
}

.btn-primary:active {
  transform: translateY(0);
}

.delete-btn {
  border: none;
  border-radius: 999px;
  padding: 12px 18px;
  background: linear-gradient(135deg, #dc2626, #991b1b);
  color: white;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 12px 26px rgba(220, 38, 38, 0.22);
}

.delete-btn:hover {
  filter: brightness(1.05);
}

.close-top-right {
  border: 1px solid rgba(148, 163, 184, 0.45);
  border-radius: 999px;
  padding: 10px 16px;
  background: #f8fafc;
  color: #334155;
  font-weight: 800;
  cursor: pointer;
}

.close-top-right:hover {
  background: #e2e8f0;
}

/* ---------- Filters ---------- */

.filters-wrapper {
  display: grid;
  gap: 14px;
  padding: 18px;
  margin-bottom: 22px;
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 14px 40px rgba(15, 23, 42, 0.08);
}

.category-buttons,
.bracket-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}

.category-button,
.bracket-button {
  border: 1px solid rgba(148, 163, 184, 0.45);
  border-radius: 999px;
  padding: 11px 17px;
  background: #ffffff;
  color: #334155;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.06);
}

.category-button:hover,
.bracket-button:hover {
  transform: translateY(-1px);
  border-color: #2563eb;
  color: #1d4ed8;
}

.category-button-active,
.bracket-button-active {
  background: linear-gradient(135deg, #0f172a, #1e293b);
  border-color: #0f172a;
  color: white;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.24);
}

.filter-summary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  flex-wrap: wrap;
  padding-top: 8px;
  color: #475569;
  font-weight: 700;
}

.filter-summary strong {
  color: #0f172a;
}

.filter-clear-btn {
  border: none;
  border-radius: 999px;
  padding: 9px 14px;
  background: #fee2e2;
  color: #991b1b;
  font-weight: 900;
  cursor: pointer;
}

.filter-clear-btn:hover {
  background: #fecaca;
}

/* ---------- Summary ---------- */

.summary-wrapper {
  display: grid;
  gap: 18px;
  margin-bottom: 24px;
}

.summary-card {
  padding: 22px;
  border-radius: 28px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.95), rgba(248,250,252,0.95));
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.1);
}

.summary-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  margin-bottom: 16px;
  border-radius: 999px;
  background: #dbeafe;
  color: #1e3a8a;
  font-size: 18px;
  font-weight: 900;
}

.summary-mainline {
  display: grid;
  grid-template-columns: repeat(5, minmax(170px, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.summary-mainline span {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 76px;
  padding: 13px;
  border-radius: 18px;
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.9);
  color: #64748b;
  font-size: 13px;
  font-weight: 750;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05);
}

.summary-mainline strong {
  color: #0f172a;
  font-size: 16px;
}

.summary-positive {
  color: #15803d !important;
}

.summary-negative {
  color: #dc2626 !important;
}

.summary-subtitle {
  margin: 10px 0 14px;
  color: #334155;
  font-size: 17px;
  font-weight: 900;
}

.summary-subgrid {
  display: grid;
  grid-template-columns: repeat(4, minmax(210px, 1fr));
  gap: 14px;
}

.summary-area {
  border-radius: 22px;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.95);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.07);
}

.summary-area-header {
  padding: 13px 15px;
  background: linear-gradient(135deg, #0f172a, #1e293b);
  color: white;
}

.summary-area-title {
  font-weight: 900;
  letter-spacing: 0.02em;
}

.summary-area-body {
  padding: 15px;
}

.summary-hist {
  height: 185px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 24px;
  padding: 10px 8px 0;
}

.summary-bar-vertical {
  height: 100%;
  display: grid;
  grid-template-rows: auto 1fr auto;
  justify-items: center;
  gap: 8px;
}

.summary-bar-vertical-value {
  font-size: 12px;
  color: #475569;
  font-weight: 900;
  white-space: nowrap;
}

.summary-bar-vertical-track {
  position: relative;
  width: 48px;
  height: 100%;
  border-radius: 999px 999px 12px 12px;
  background: #e2e8f0;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.4);
}

.summary-bar-vertical-fill {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  min-height: 8px;
  border-radius: 999px 999px 10px 10px;
}

.summary-bar-soumis {
  background: linear-gradient(180deg, #60a5fa, #2563eb);
}

.summary-bar-paye {
  background: linear-gradient(180deg, #34d399, #16a34a);
}

.summary-bar-vertical-name {
  color: #334155;
  font-size: 12px;
  font-weight: 900;
}

.summary-area-gain-big {
  margin-top: 13px;
  padding: 12px;
  border-radius: 16px;
  background: #f8fafc;
  border: 1px solid rgba(226, 232, 240, 0.95);
  text-align: center;
  font-size: 14px;
  font-weight: 900;
}

.summary-area-total {
  margin-top: 5px;
  font-size: 13px;
  color: #475569;
}

/* ---------- Project list ---------- */

.project-list {
  margin-top: 20px;
}

.project-list > p {
  padding: 30px;
  text-align: center;
  background: white;
  border-radius: 22px;
  color: #64748b;
  font-weight: 800;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
}

.project-list ul {
  display: grid;
  gap: 13px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.project-item {
  border-radius: 22px;
  border: 1px solid rgba(148, 163, 184, 0.32);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
  cursor: pointer;
  overflow: hidden;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.project-item:hover {
  transform: translateY(-2px);
  border-color: rgba(37, 99, 235, 0.55);
  box-shadow: 0 18px 38px rgba(15, 23, 42, 0.13);
}

.project-item-row {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 15px;
  padding: 18px;
}

.project-main {
  min-width: 0;
  flex: 1;
}

.project-header-line {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.project-title {
  font-size: 20px;
  font-weight: 950;
  color: #0f172a;
  margin-right: 4px;
}

.project-inline-info {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 7px 10px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #475569;
  font-size: 13px;
  font-weight: 800;
}

.project-inline-info strong {
  color: #0f172a;
}

.project-description {
  margin-top: 10px;
  color: #64748b;
  font-size: 14px;
  line-height: 1.45;
}

.project-category-big {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 150px;
  padding: 12px 18px;
  border-radius: 18px;
  background: linear-gradient(135deg, #e0f2fe, #dbeafe);
  color: #1e40af;
  font-size: 16px;
  font-weight: 950;
  text-align: center;
}

/* ---------- Modal ---------- */

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 26px;
  background: rgba(15, 23, 42, 0.62);
  backdrop-filter: blur(8px);
}

.modal {
  width: min(980px, 96vw);
  max-height: 92vh;
  overflow: auto;
  padding: 24px;
  border-radius: 28px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.98));
  border: 1px solid rgba(255, 255, 255, 0.85);
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.32);
}

.modal h2 {
  margin: 0 0 18px;
  color: #0f172a;
  font-size: 26px;
  font-weight: 950;
}

.modal h2 span {
  color: #2563eb;
}

.project-modal {
  width: min(1350px, 97vw);
}

.project-modal-header {
  position: sticky;
  top: -24px;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin: -24px -24px 18px;
  padding: 18px 24px;
  background: rgba(255,255,255,0.94);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(226, 232, 240, 0.95);
}

.project-modal-header h2 {
  margin: 0;
}

.project-modal-summary {
  margin-bottom: 18px;
  padding: 18px;
  border-radius: 24px;
  background: #f8fafc;
  border: 1px solid rgba(226, 232, 240, 0.95);
}

.project-modal-mainline {
  grid-template-columns: repeat(4, minmax(170px, 1fr));
}

.project-modal-subgrid {
  grid-template-columns: repeat(4, minmax(190px, 1fr));
}

/* ---------- Form ---------- */

.project-form {
  display: grid;
  gap: 18px;
}

.form-section {
  padding: 18px;
  border-radius: 24px;
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.95);
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
}

.form-section h3 {
  margin: 0 0 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.95);
  color: #1e293b;
  font-size: 18px;
  font-weight: 950;
}

.form-section label {
  display: grid;
  gap: 7px;
  margin-bottom: 13px;
  color: #334155;
  font-size: 14px;
  font-weight: 850;
}

.form-section input,
.form-section select,
.form-section textarea,
.price-grid input {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.55);
  border-radius: 14px;
  padding: 12px 13px;
  background: #f8fafc;
  color: #0f172a;
  font-size: 15px;
  font-weight: 650;
  outline: none;
  transition: all 0.15s ease;
}

.form-section textarea {
  resize: vertical;
  min-height: 82px;
}

.form-section input:focus,
.form-section select:focus,
.form-section textarea:focus,
.price-grid input:focus {
  border-color: #2563eb;
  background: white;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.14);
}

.price-grid {
  display: grid;
  grid-template-columns: minmax(150px, 1fr) minmax(150px, 1fr) minmax(150px, 1fr);
  gap: 10px;
  align-items: center;
}

.price-grid-header {
  padding: 11px;
  border-radius: 14px;
  background: #0f172a;
  color: white;
  text-align: center;
  font-weight: 950;
}

.price-grid-label {
  padding: 12px 13px;
  border-radius: 14px;
  background: #e2e8f0;
  color: #1e293b;
  font-weight: 950;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 4px;
}

.form-actions button:not(.btn-primary):not(.delete-btn) {
  border: 1px solid rgba(148, 163, 184, 0.55);
  border-radius: 999px;
  padding: 12px 18px;
  background: white;
  color: #334155;
  font-weight: 850;
  cursor: pointer;
}

.form-actions button:not(.btn-primary):not(.delete-btn):hover {
  background: #f1f5f9;
}

.project-modal-actions {
  justify-content: space-between;
}

/* ---------- Scrollbar ---------- */

.modal::-webkit-scrollbar {
  width: 12px;
}

.modal::-webkit-scrollbar-track {
  background: #e2e8f0;
  border-radius: 999px;
}

.modal::-webkit-scrollbar-thumb {
  background: #94a3b8;
  border-radius: 999px;
  border: 3px solid #e2e8f0;
}

/* ---------- Responsive ---------- */

@media (max-width: 1300px) {
  .summary-mainline {
    grid-template-columns: repeat(3, minmax(170px, 1fr));
  }

  .summary-subgrid,
  .project-modal-subgrid {
    grid-template-columns: repeat(2, minmax(220px, 1fr));
  }

  .project-modal-mainline {
    grid-template-columns: repeat(2, minmax(170px, 1fr));
  }
}

@media (max-width: 900px) {
  .app-root {
    width: 94% !important;
    padding-top: 14px;
  }

  .app-header {
    position: static;
    flex-direction: column;
    padding: 16px;
  }

  .app-header h1 {
    font-size: 23px !important;
  }

  .summary-mainline,
  .project-modal-mainline {
    grid-template-columns: 1fr;
  }

  .summary-subgrid,
  .project-modal-subgrid {
    grid-template-columns: 1fr;
  }

  .project-item-row {
    flex-direction: column;
  }

  .project-category-big {
    width: 100%;
    min-width: 0;
  }

  .project-modal-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .price-grid {
    grid-template-columns: 1fr;
  }

  .price-grid-header:first-child {
    display: none;
  }

  .price-grid-header {
    display: none;
  }

  .price-grid-label {
    margin-top: 8px;
    background: #dbeafe;
    color: #1e40af;
  }

  .form-actions,
  .project-modal-actions {
    flex-direction: column;
  }

  .form-actions button,
  .project-modal-actions button {
    width: 100%;
  }
}

@media (max-width: 520px) {
  .modal-overlay {
    padding: 12px;
  }

  .modal {
    padding: 16px;
    border-radius: 22px;
  }

  .project-modal-header {
    margin: -16px -16px 16px;
    padding: 14px 16px;
    top: -16px;
  }

  .project-title {
    font-size: 18px;
  }

  .project-inline-info {
    width: 100%;
    justify-content: space-between;
  }

  .category-button,
  .bracket-button {
    width: 100%;
  }
}
`;

const CATEGORIES = ["Alimentaire", "Commercial", "Industriel", "Publique"];

const BUDGET_BRACKETS = [
  { id: "0-5k", label: "0 à 5 000 pi²", min: 0, max: 5000 },
  { id: "5k-20k", label: "5 000 à 20 000 pi²", min: 5000, max: 20000 },
  { id: "20k-50k", label: "20 000 à 50 000 pi²", min: 20000, max: 50000 },
  { id: "50k-100k", label: "50 000 à 100 000 pi²", min: 50000, max: 100000 },
  { id: "100k-plus", label: "100 000 pi² et plus", min: 100000, max: null },
];

const EMPTY_PROJECT = {
  nomProjet: "",
  categorie: "",
  description: "",
  superficie: "",
  dateSoumission: "",
  groupe: "",

  mouluresSoumis: "",
  mouluresPaye: "",
  quincailleriesSoumis: "",
  quincailleriesPaye: "",
  installationSoumis: "",
  installationPaye: "",
  equipementSoumis: "",
  equipementPaye: "",
};

const EVAL_PROJECTS_PATH = ["clients", "evaluation-projets-styro", "projets"];

function toNumber(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function getSuperficie(project) {
  return toNumber(project.superficie);
}

function getTotalSoumission(project) {
  return (
    toNumber(project.mouluresSoumis) +
    toNumber(project.quincailleriesSoumis) +
    toNumber(project.installationSoumis) +
    toNumber(project.equipementSoumis)
  );
}

function getTotalPaye(project) {
  return (
    toNumber(project.mouluresPaye) +
    toNumber(project.quincailleriesPaye) +
    toNumber(project.installationPaye) +
    toNumber(project.equipementPaye)
  );
}

function formatDate(value) {
  if (!value) return "";

  try {
    let d;

    if (value.seconds) {
      d = new Date(value.seconds * 1000);
    } else {
      d = new Date(value);
    }

    if (isNaN(d)) return value;

    return d.toLocaleDateString("fr-CA");
  } catch {
    return value;
  }
}

function buildSummaryForList(projects, categorieLabel = null) {
  if (!projects.length) return null;

  const totalArea = projects.reduce((sum, p) => sum + getSuperficie(p), 0);

  const totalSoumisMoney = projects.reduce(
    (sum, p) => sum + getTotalSoumission(p),
    0
  );

  const totalPayeMoney = projects.reduce(
    (sum, p) => sum + getTotalPaye(p),
    0
  );

  const totalSoumis = totalArea > 0 ? totalSoumisMoney / totalArea : 0;
  const totalPaye = totalArea > 0 ? totalPayeMoney / totalArea : 0;

  const diff = totalSoumis - totalPaye;
  const pct = totalSoumis > 0 ? (diff / totalSoumis) * 100 : null;
  const diffMoney = totalSoumisMoney - totalPayeMoney;

  const sumFieldMoney = (field) =>
    projects.reduce((sum, p) => sum + toNumber(p[field]), 0);

  const areas = [
    {
      id: "moulures",
      label: "Moulures",
      soumisField: "mouluresSoumis",
      payeField: "mouluresPaye",
    },
    {
      id: "quincailleries",
      label: "Quincailleries",
      soumisField: "quincailleriesSoumis",
      payeField: "quincailleriesPaye",
    },
    {
      id: "installation",
      label: "Installation",
      soumisField: "installationSoumis",
      payeField: "installationPaye",
    },
    {
      id: "equipement",
      label: "Équipement",
      soumisField: "equipementSoumis",
      payeField: "equipementPaye",
    },
  ];

  const areaSummaries = areas.map((a) => {
    const soumisMoney = sumFieldMoney(a.soumisField);
    const payeMoney = sumFieldMoney(a.payeField);

    const soumis = totalArea > 0 ? soumisMoney / totalArea : 0;
    const paye = totalArea > 0 ? payeMoney / totalArea : 0;

    const adiff = soumis - paye;
    const apct = soumis > 0 ? (adiff / soumis) * 100 : null;
    const diffMoneyArea = soumisMoney - payeMoney;

    return {
      id: a.id,
      label: a.label,
      soumis,
      paye,
      diff: adiff,
      pct: apct,
      diffMoney: diffMoneyArea,
    };
  });

  return {
    categorie: categorieLabel,
    count: projects.length,
    totalArea,
    totalSoumis,
    totalPaye,
    diff,
    pct,
    diffMoney,
    areaSummaries,
  };
}

function EvalProjet() {
  const [projects, setProjects] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newProject, setNewProject] = useState(EMPTY_PROJECT);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedBracketId, setSelectedBracketId] = useState("");

  const [editProject, setEditProject] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    const colRef = collection(db, ...EVAL_PROJECTS_PATH);

    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setProjects(data);
    });

    return () => unsubscribe();
  }, []);

  const handleOpenForm = () => {
    const todayStr = new Date().toISOString().slice(0, 10);

    setNewProject({
      ...EMPTY_PROJECT,
      dateSoumission: todayStr,
    });

    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setNewProject(EMPTY_PROJECT);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setNewProject((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const colRef = collection(db, ...EVAL_PROJECTS_PATH);

    const payload = {
      ...newProject,
      dateSoumission:
        newProject.dateSoumission || new Date().toISOString().slice(0, 10),
    };

    await addDoc(colRef, payload);
    handleCloseForm();
  };

  const handleSelectCategory = (cat) => {
    setSelectedCategory((prev) => (prev === cat ? "" : cat));
  };

  const handleSelectBracket = (id) => {
    setSelectedBracketId((prev) => (prev === id ? "" : id));
  };

  const handleClearFilters = () => {
    setSelectedCategory("");
    setSelectedBracketId("");
  };

  const deleteProject = async (id) => {
    if (
      !window.confirm(
        "Êtes-vous sûr de vouloir supprimer ce projet ? Cette action est irréversible."
      )
    ) {
      return;
    }

    await deleteDoc(doc(db, ...EVAL_PROJECTS_PATH, id));
  };

  const openProjectDetails = (project) => {
    setEditProject(project);
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditProject(null);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;

    setEditProject((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleUpdateProject = async (e) => {
    e.preventDefault();

    if (!editProject || !editProject.id) return;

    const { id, ...data } = editProject;
    const ref = doc(db, ...EVAL_PROJECTS_PATH, id);

    await updateDoc(ref, data);
    closeEditModal();
  };

  const visibleProjects = projects.filter((p) => {
    if (selectedCategory && p.categorie !== selectedCategory) return false;

    if (selectedBracketId) {
      const area = getSuperficie(p);
      const b = BUDGET_BRACKETS.find((x) => x.id === selectedBracketId);

      if (!b) return true;

      if (b.max == null) {
        if (area < b.min) return false;
      } else {
        if (area < b.min || area >= b.max) return false;
      }
    }

    return true;
  });

  const activeCategoryLabel = selectedCategory || "Toutes";

  const activeBracketLabel = selectedBracketId
    ? BUDGET_BRACKETS.find((b) => b.id === selectedBracketId)?.label
    : "Toutes";

  const hasFilters = selectedCategory || selectedBracketId;
  const isOnlyBracketFilter = !!selectedBracketId && !selectedCategory;
  const isNoFilter = !selectedCategory && !selectedBracketId;

  let globalSummary = null;
  let categorySummaries = [];

  if (isNoFilter) {
    globalSummary = buildSummaryForList(visibleProjects, null);
  } else if (isOnlyBracketFilter) {
    globalSummary = buildSummaryForList(visibleProjects, null);
  } else {
    categorySummaries = CATEGORIES.map((cat) => {
      const list = visibleProjects.filter((p) => p.categorie === cat);
      return buildSummaryForList(list, cat);
    }).filter(Boolean);
  }

  const formatDiffAndPct = (diffPerPi2, pct, diffMoney) => {
    if (pct == null) {
      return "—";
    }

    const diffStr = diffPerPi2.toLocaleString("fr-CA", {
      maximumFractionDigits: 2,
    });

    const pctStr = pct.toLocaleString("fr-CA", {
      maximumFractionDigits: 1,
    });

    let text = `${diffStr} $/pi² (${pctStr} %)`;

    if (typeof diffMoney === "number" && !Number.isNaN(diffMoney)) {
      const diffMoneyStr = diffMoney.toLocaleString("fr-CA", {
        maximumFractionDigits: 0,
      });

      text += ` — Total : ${diffMoneyStr} $`;
    }

    return text;
  };

  const renderArea = (a) => {
    const maxVal = Math.max(a.soumis, a.paye, 1);
    const hSoumis = Math.max((a.soumis / maxVal) * 100, 5);
    const hPaye = Math.max((a.paye / maxVal) * 100, 5);

    const pctClass =
      a.pct == null ? "" : a.pct >= 0 ? "summary-positive" : "summary-negative";

    let pctText = "—";

    if (a.pct != null) {
      const pctAbs = Math.abs(a.pct).toLocaleString("fr-CA", {
        maximumFractionDigits: 1,
      });

      const diffAbs = Math.abs(a.diff).toLocaleString("fr-CA", {
        maximumFractionDigits: 2,
      });

      const labelBase = a.pct >= 0 ? "Gain" : "Perte";
      pctText = `${labelBase} : ${diffAbs} $/pi² (${pctAbs} %)`;
    }

    let totalMoneyText = "";

    if (typeof a.diffMoney === "number" && !Number.isNaN(a.diffMoney)) {
      const absMoney = Math.abs(a.diffMoney).toLocaleString("fr-CA", {
        maximumFractionDigits: 0,
      });

      const labelBase = a.diffMoney >= 0 ? "Gain total" : "Perte totale";
      totalMoneyText = `${labelBase} : ${absMoney} $`;
    }

    return (
      <div key={a.id} className="summary-area">
        <div className="summary-area-header">
          <span className="summary-area-title">{a.label}</span>
        </div>

        <div className="summary-area-body">
          <div className="summary-hist">
            <div className="summary-bar-vertical">
              <span className="summary-bar-vertical-value">
                {a.soumis.toLocaleString("fr-CA", {
                  maximumFractionDigits: 2,
                })}{" "}
                $/pi²
              </span>

              <div className="summary-bar-vertical-track">
                <div
                  className="summary-bar-vertical-fill summary-bar-soumis"
                  style={{ height: `${hSoumis}%` }}
                />
              </div>

              <span className="summary-bar-vertical-name">Soumission</span>
            </div>

            <div className="summary-bar-vertical">
              <span className="summary-bar-vertical-value">
                {a.paye.toLocaleString("fr-CA", {
                  maximumFractionDigits: 2,
                })}{" "}
                $/pi²
              </span>

              <div className="summary-bar-vertical-track">
                <div
                  className="summary-bar-vertical-fill summary-bar-paye"
                  style={{ height: `${hPaye}%` }}
                />
              </div>

              <span className="summary-bar-vertical-name">Payé</span>
            </div>
          </div>

          <div className={`summary-area-gain-big ${pctClass}`}>
            <div>{pctText}</div>

            {totalMoneyText && (
              <div className="summary-area-total">{totalMoneyText}</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const editSummary = editProject
    ? buildSummaryForList([editProject], editProject.categorie || null)
    : null;

  return (
    <>
      <style>{EVAL_PROJET_CSS}</style>

      <div
        className="app-root"
        style={{
          width: "85%",
          maxWidth: "1800px",
          margin: "0 auto",
        }}
      >
        <header className="app-header">
          <h1
            style={{
              flex: 1,
              fontSize: "32px",
              fontWeight: 800,
              textAlign: "center",
              letterSpacing: "0.05em",
              margin: 0,
            }}
          >
            ÉVALUATION DE PROJETS - STYRO
          </h1>

          <button className="btn-primary" onClick={handleOpenForm}>
            Ajouter un nouveau projet
          </button>
        </header>

        <section className="filters-wrapper">
          <div className="category-buttons">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={
                  "category-button" +
                  (selectedCategory === cat ? " category-button-active" : "")
                }
                onClick={() => handleSelectCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="bracket-buttons">
            {BUDGET_BRACKETS.map((b) => (
              <button
                key={b.id}
                type="button"
                className={
                  "bracket-button" +
                  (selectedBracketId === b.id ? " bracket-button-active" : "")
                }
                onClick={() => handleSelectBracket(b.id)}
              >
                {b.label}
              </button>
            ))}
          </div>

          <div className="filter-summary">
            <span>
              Catégorie : <strong>{activeCategoryLabel}</strong>
            </span>

            <span>
              Superficie : <strong>{activeBracketLabel}</strong>
            </span>

            {hasFilters && (
              <button
                type="button"
                className="filter-clear-btn"
                onClick={handleClearFilters}
              >
                Réinitialiser
              </button>
            )}
          </div>
        </section>

        {(isNoFilter || isOnlyBracketFilter) && globalSummary && (
          <section className="summary-wrapper">
            <div className="summary-card">
              <div className="summary-title">
                {isNoFilter
                  ? "Résumé — Tous les projets"
                  : `Résumé — ${activeBracketLabel}`}
              </div>

              <div className="summary-mainline">
                <span>
                  Projets : <strong>{globalSummary.count}</strong>
                </span>

                <span>
                  Superficie totale :{" "}
                  <strong>
                    {globalSummary.totalArea.toLocaleString("fr-CA", {
                      maximumFractionDigits: 0,
                    })}{" "}
                    pi²
                  </strong>
                </span>

                <span>
                  Soumission moyenne :{" "}
                  <strong>
                    {globalSummary.totalSoumis.toLocaleString("fr-CA", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    $/pi²
                  </strong>
                </span>

                <span>
                  Payé moyen :{" "}
                  <strong>
                    {globalSummary.totalPaye.toLocaleString("fr-CA", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    $/pi²
                  </strong>
                </span>

                <span>
                  Gain / perte moyen :{" "}
                  <strong
                    className={
                      (globalSummary.diff ?? 0) >= 0
                        ? "summary-positive"
                        : "summary-negative"
                    }
                  >
                    {formatDiffAndPct(
                      globalSummary.diff,
                      globalSummary.pct,
                      globalSummary.diffMoney
                    )}
                  </strong>
                </span>
              </div>

              <div className="summary-subtitle">Par type de coût (en $/pi²)</div>

              <div className="summary-subgrid">
                {globalSummary.areaSummaries.map((a) => renderArea(a))}
              </div>
            </div>
          </section>
        )}

        {!isNoFilter && !isOnlyBracketFilter && categorySummaries.length > 0 && (
          <section className="summary-wrapper">
            {categorySummaries.map((s) => (
              <div key={s.categorie} className="summary-card">
                <div className="summary-title">{s.categorie}</div>

                <div className="summary-mainline">
                  <span>
                    Projets : <strong>{s.count}</strong>
                  </span>

                  <span>
                    Superficie totale :{" "}
                    <strong>
                      {s.totalArea.toLocaleString("fr-CA", {
                        maximumFractionDigits: 0,
                      })}{" "}
                      pi²
                    </strong>
                  </span>

                  <span>
                    Soumission moyenne :{" "}
                    <strong>
                      {s.totalSoumis.toLocaleString("fr-CA", {
                        maximumFractionDigits: 2,
                      })}{" "}
                      $/pi²
                    </strong>
                  </span>

                  <span>
                    Payé moyen :{" "}
                    <strong>
                      {s.totalPaye.toLocaleString("fr-CA", {
                        maximumFractionDigits: 2,
                      })}{" "}
                      $/pi²
                    </strong>
                  </span>

                  <span>
                    Gain / perte moyen :{" "}
                    <strong
                      className={
                        (s.diff ?? 0) >= 0
                          ? "summary-positive"
                          : "summary-negative"
                      }
                    >
                      {formatDiffAndPct(s.diff, s.pct, s.diffMoney)}
                    </strong>
                  </span>
                </div>

                <div className="summary-subtitle">Par type de coût (en $/pi²)</div>

                <div className="summary-subgrid">
                  {s.areaSummaries.map((a) => renderArea(a))}
                </div>
              </div>
            ))}
          </section>
        )}

        {showForm && (
          <div className="modal-overlay">
            <div className="modal">
              <h2>Ajouter un nouveau projet</h2>

              <form onSubmit={handleSubmit} className="project-form">
                <div className="form-section">
                  <h3>Informations générales</h3>

                  <label>
                    Nom du projet
                    <input
                      type="text"
                      name="nomProjet"
                      value={newProject.nomProjet}
                      onChange={handleChange}
                      required
                    />
                  </label>

                  <label>
                    Catégorie
                    <select
                      name="categorie"
                      value={newProject.categorie}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Sélectionner...</option>
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Superficie (pi²)
                    <input
                      type="number"
                      name="superficie"
                      value={newProject.superficie}
                      onChange={handleChange}
                      min="0"
                      step="1"
                      required
                    />
                  </label>

                  <label>
                    Date du projet
                    <input
                      type="date"
                      name="dateSoumission"
                      value={newProject.dateSoumission}
                      onChange={handleChange}
                    />
                  </label>

                  <label>
                    Notes / Description
                    <textarea
                      name="description"
                      value={newProject.description}
                      onChange={handleChange}
                      rows={3}
                    />
                  </label>
                </div>

                <div className="form-section">
                  <h3>Budget total par catégorie (en $)</h3>

                  <div className="price-grid">
                    <div className="price-grid-header" />
                    <div className="price-grid-header">Soumission</div>
                    <div className="price-grid-header">Payé</div>

                    <div className="price-grid-label">Moulures</div>

                    <input
                      type="number"
                      step="0.01"
                      name="mouluresSoumis"
                      value={newProject.mouluresSoumis}
                      onChange={handleChange}
                      placeholder="0.00"
                    />

                    <input
                      type="number"
                      step="0.01"
                      name="mouluresPaye"
                      value={newProject.mouluresPaye}
                      onChange={handleChange}
                      placeholder="0.00"
                    />

                    <div className="price-grid-label">Quincailleries</div>

                    <input
                      type="number"
                      step="0.01"
                      name="quincailleriesSoumis"
                      value={newProject.quincailleriesSoumis}
                      onChange={handleChange}
                      placeholder="0.00"
                    />

                    <input
                      type="number"
                      step="0.01"
                      name="quincailleriesPaye"
                      value={newProject.quincailleriesPaye}
                      onChange={handleChange}
                      placeholder="0.00"
                    />

                    <div className="price-grid-label">Installation</div>

                    <input
                      type="number"
                      step="0.01"
                      name="installationSoumis"
                      value={newProject.installationSoumis}
                      onChange={handleChange}
                      placeholder="0.00"
                    />

                    <input
                      type="number"
                      step="0.01"
                      name="installationPaye"
                      value={newProject.installationPaye}
                      onChange={handleChange}
                      placeholder="0.00"
                    />

                    <div className="price-grid-label">Équipement</div>

                    <input
                      type="number"
                      step="0.01"
                      name="equipementSoumis"
                      value={newProject.equipementSoumis}
                      onChange={handleChange}
                      placeholder="0.00"
                    />

                    <input
                      type="number"
                      step="0.01"
                      name="equipementPaye"
                      value={newProject.equipementPaye}
                      onChange={handleChange}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" onClick={handleCloseForm}>
                    Annuler
                  </button>

                  <button type="submit" className="btn-primary">
                    Enregistrer le projet
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showEditModal && editProject && (
          <div className="modal-overlay project-modal-overlay">
            <div className="modal project-modal">
              <div className="project-modal-header">
                <h2>
                  Détails du projet —{" "}
                  <span>{editProject.nomProjet || "Sans nom"}</span>
                </h2>

                <button className="close-top-right" onClick={closeEditModal}>
                  Fermer
                </button>
              </div>

              {editSummary && (
                <div className="project-modal-summary">
                  <div className="summary-mainline project-modal-mainline">
                    <span>
                      Superficie :{" "}
                      <strong>
                        {editSummary.totalArea.toLocaleString("fr-CA", {
                          maximumFractionDigits: 0,
                        })}{" "}
                        pi²
                      </strong>
                    </span>

                    <span>
                      Soumission moyenne :{" "}
                      <strong>
                        {editSummary.totalSoumis.toLocaleString("fr-CA", {
                          maximumFractionDigits: 2,
                        })}{" "}
                        $/pi²
                      </strong>
                    </span>

                    <span>
                      Payé moyen :{" "}
                      <strong>
                        {editSummary.totalPaye.toLocaleString("fr-CA", {
                          maximumFractionDigits: 2,
                        })}{" "}
                        $/pi²
                      </strong>
                    </span>

                    <span>
                      Gain / perte moyen :{" "}
                      <strong
                        className={
                          (editSummary.diff ?? 0) >= 0
                            ? "summary-positive"
                            : "summary-negative"
                        }
                      >
                        {formatDiffAndPct(
                          editSummary.diff,
                          editSummary.pct,
                          editSummary.diffMoney
                        )}
                      </strong>
                    </span>
                  </div>

                  <div className="summary-subtitle">
                    Par type de coût (en $/pi²)
                  </div>

                  <div className="summary-subgrid project-modal-subgrid">
                    {editSummary.areaSummaries.map((a) => renderArea(a))}
                  </div>
                </div>
              )}

              <form onSubmit={handleUpdateProject} className="project-form">
                <div className="form-section">
                  <h3>Informations générales</h3>

                  <label>
                    Nom du projet
                    <input
                      type="text"
                      name="nomProjet"
                      value={editProject.nomProjet || ""}
                      onChange={handleEditChange}
                      required
                    />
                  </label>

                  <label>
                    Catégorie
                    <select
                      name="categorie"
                      value={editProject.categorie || ""}
                      onChange={handleEditChange}
                      required
                    >
                      <option value="">Sélectionner...</option>
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Superficie (pi²)
                    <input
                      type="number"
                      name="superficie"
                      value={editProject.superficie || ""}
                      onChange={handleEditChange}
                      min="0"
                      step="1"
                      required
                    />
                  </label>

                  <label>
                    Date du projet
                    <input
                      type="date"
                      name="dateSoumission"
                      value={editProject.dateSoumission || ""}
                      onChange={handleEditChange}
                    />
                  </label>

                  <label>
                    Groupe
                    <input
                      type="text"
                      name="groupe"
                      value={editProject.groupe || ""}
                      onChange={handleEditChange}
                      placeholder="Groupe / client / équipe"
                    />
                  </label>

                  <label>
                    Notes / Description
                    <textarea
                      name="description"
                      value={editProject.description || ""}
                      onChange={handleEditChange}
                      rows={3}
                    />
                  </label>
                </div>

                <div className="form-section">
                  <h3>Budget total par catégorie (en $)</h3>

                  <div className="price-grid">
                    <div className="price-grid-header" />
                    <div className="price-grid-header">Soumission</div>
                    <div className="price-grid-header">Payé</div>

                    <div className="price-grid-label">Moulures</div>

                    <input
                      type="number"
                      step="0.01"
                      name="mouluresSoumis"
                      value={editProject.mouluresSoumis || ""}
                      onChange={handleEditChange}
                      placeholder="0.00"
                    />

                    <input
                      type="number"
                      step="0.01"
                      name="mouluresPaye"
                      value={editProject.mouluresPaye || ""}
                      onChange={handleEditChange}
                      placeholder="0.00"
                    />

                    <div className="price-grid-label">Quincailleries</div>

                    <input
                      type="number"
                      step="0.01"
                      name="quincailleriesSoumis"
                      value={editProject.quincailleriesSoumis || ""}
                      onChange={handleEditChange}
                      placeholder="0.00"
                    />

                    <input
                      type="number"
                      step="0.01"
                      name="quincailleriesPaye"
                      value={editProject.quincailleriesPaye || ""}
                      onChange={handleEditChange}
                      placeholder="0.00"
                    />

                    <div className="price-grid-label">Installation</div>

                    <input
                      type="number"
                      step="0.01"
                      name="installationSoumis"
                      value={editProject.installationSoumis || ""}
                      onChange={handleEditChange}
                      placeholder="0.00"
                    />

                    <input
                      type="number"
                      step="0.01"
                      name="installationPaye"
                      value={editProject.installationPaye || ""}
                      onChange={handleEditChange}
                      placeholder="0.00"
                    />

                    <div className="price-grid-label">Équipement</div>

                    <input
                      type="number"
                      step="0.01"
                      name="equipementSoumis"
                      value={editProject.equipementSoumis || ""}
                      onChange={handleEditChange}
                      placeholder="0.00"
                    />

                    <input
                      type="number"
                      step="0.01"
                      name="equipementPaye"
                      value={editProject.equipementPaye || ""}
                      onChange={handleEditChange}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="form-actions project-modal-actions">
                  <button
                    type="button"
                    className="delete-btn"
                    onClick={async () => {
                      if (!editProject?.id) return;

                      await deleteProject(editProject.id);
                      closeEditModal();
                    }}
                  >
                    Supprimer le projet
                  </button>

                  <button type="submit" className="btn-primary">
                    Enregistrer les modifications
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <main className="project-list">
          {visibleProjects.length === 0 ? (
            <p>Aucun projet pour l’instant.</p>
          ) : (
            <ul>
              {visibleProjects.map((p) => {
                const totalSoumis = getTotalSoumission(p);
                const superficie = getSuperficie(p);
                const totalParPi2 =
                  superficie > 0 ? totalSoumis / superficie : 0;

                return (
                  <li
                    key={p.id}
                    className="project-item"
                    onClick={() => openProjectDetails(p)}
                  >
                    <div className="project-item-row">
                      <div className="project-main">
                        <div className="project-header-line">
                          <span className="project-title">
                            {p.nomProjet || "Sans nom"}
                          </span>

                          <span className="project-inline-info">
                            Superficie:{" "}
                            <strong>
                              {superficie.toLocaleString("fr-CA", {
                                maximumFractionDigits: 0,
                              })}{" "}
                              pi²
                            </strong>
                          </span>

                          {p.dateSoumission && (
                            <span className="project-inline-info">
                              Date du projet:{" "}
                              <strong>{formatDate(p.dateSoumission)}</strong>
                            </span>
                          )}

                          <span className="project-inline-info">
                            Total soumis:{" "}
                            <strong>
                              {totalParPi2.toLocaleString("fr-CA", {
                                maximumFractionDigits: 2,
                              })}{" "}
                              $/pi²
                            </strong>
                          </span>
                        </div>

                        {p.description && (
                          <div className="project-description">
                            {p.description}
                          </div>
                        )}
                      </div>

                      {p.categorie && (
                        <div className="project-category-big">
                          {p.categorie}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </main>
      </div>
    </>
  );
}

export default EvalProjet;