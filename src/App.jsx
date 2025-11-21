// src/App.jsx
import React, { useState, useEffect } from "react";
import Login from "./Login";
import "./App.css";
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

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
  superficie: "", // en pi²
  dateSoumission: "", // "date du projet"
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

// Format date (string ISO ou Timestamp Firestore) -> JJ-MM-AAAA
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

// Build résumé en $/pi² + TOTAL $
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

  const diff = totalSoumis - totalPaye; // $/pi²
  const pct = totalSoumis > 0 ? (diff / totalSoumis) * 100 : null;
  const diffMoney = totalSoumisMoney - totalPayeMoney; // TOTAL $

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

    const soumis = totalArea > 0 ? soumisMoney / totalArea : 0; // $/pi²
    const paye = totalArea > 0 ? payeMoney / totalArea : 0; // $/pi²

    const adiff = soumis - paye; // $/pi²
    const apct = soumis > 0 ? (adiff / soumis) * 100 : null;
    const diffMoneyArea = soumisMoney - payeMoney; // TOTAL $ pour cette catégorie

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
    diff, // $/pi²
    pct,
    diffMoney, // TOTAL $
    areaSummaries,
  };
}

function App() {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newProject, setNewProject] = useState(EMPTY_PROJECT);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedBracketId, setSelectedBracketId] = useState("");

  const [editProject, setEditProject] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Charger les projets depuis Firestore
  useEffect(() => {
    const colRef = collection(db, "projets");

    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setProjects(data);
    });

    return () => unsubscribe();
  }, []);

  // Tant qu'on n'est pas loggé, on montre juste le login
  if (!user) {
    return <Login onLoginSuccess={(u) => setUser(u)} />;
  }

  const handleOpenForm = () => {
    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    setNewProject({
      ...EMPTY_PROJECT,
      dateSoumission: todayStr, // auto : date du projet = aujourd'hui
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
    const colRef = collection(db, "projets");
    const payload = {
      ...newProject,
      // sécurité : si l'utilisateur efface la date, on remet aujourd'hui
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
    await deleteDoc(doc(db, "projets", id));
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
    const ref = doc(db, "projets", id);
    await updateDoc(ref, data);

    closeEditModal();
  };

  // Filtrage (par catégorie + par SUPERFICIE)
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

  // Résumés
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

  // maintenant le résumé global / par catégorie avec TOTAL $
  const editSummary = editProject
    ? buildSummaryForList([editProject], editProject.categorie || null)
    : null;

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

  return (
    <div className="app-root">
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

      {/* Filtres */}
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

      {/* Résumé global */}
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

      {/* Résumé par catégorie */}
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

              <div className="summary-subtitle">
                Par type de coût (en $/pi²)
              </div>
              <div className="summary-subgrid">
                {s.areaSummaries.map((a) => renderArea(a))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Formulaire ajout */}
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

      {/* MODALE ÉDITION PROJET */}
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

      {/* Liste des projets (tableau en bas des résumés) */}
      <main className="project-list">
        {visibleProjects.length === 0 ? (
          <p>Aucun projet pour l’instant.</p>
        ) : (
          <ul>
            {visibleProjects.map((p) => {
              const totalSoumis = getTotalSoumission(p);
              const superficie = getSuperficie(p);
              const totalParPi2 = superficie > 0 ? totalSoumis / superficie : 0;

              return (
                <li
                  key={p.id}
                  className="project-item"
                  onClick={() => openProjectDetails(p)}
                >
                  <div className="project-item-row">
                    {/* Gauche : titre + infos */}
                    <div className="project-main">
                      {/* Ligne 1 : titre + superficie + date + total soumis */}
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

                      {/* Description en dessous si présente */}
                      {p.description && (
                        <div className="project-description">
                          {p.description}
                        </div>
                      )}
                    </div>

                    {/* Droite : catégorie en gros */}
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
  );
}

export default App;
