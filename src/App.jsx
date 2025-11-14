import React, { useState, useEffect } from "react";
import "./App.css";
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
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

// Build résumé en $/pi²
function buildSummaryForList(projects, categorieLabel = null) {
  if (!projects.length) return null;

  const totalArea = projects.reduce(
    (sum, p) => sum + getSuperficie(p),
    0
  );

  const totalSoumisMoney = projects.reduce(
    (sum, p) => sum + getTotalSoumission(p),
    0
  );
  const totalPayeMoney = projects.reduce(
    (sum, p) => sum + getTotalPaye(p),
    0
  );

  // Conversion en $/pi² si superficie > 0
  const totalSoumis =
    totalArea > 0 ? totalSoumisMoney / totalArea : 0;
  const totalPaye =
    totalArea > 0 ? totalPayeMoney / totalArea : 0;

  const diff = totalSoumis - totalPaye;
  const pct = totalSoumis > 0 ? (diff / totalSoumis) * 100 : null;

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

    const soumis =
      totalArea > 0 ? soumisMoney / totalArea : 0; // $/pi²
    const paye =
      totalArea > 0 ? payeMoney / totalArea : 0; // $/pi²

    const adiff = soumis - paye; // $/pi²
    const apct = soumis > 0 ? (adiff / soumis) * 100 : null;

    return {
      id: a.id,
      label: a.label,
      soumis,
      paye,
      diff: adiff,
      pct: apct,
    };
  });

  return {
    categorie: categorieLabel,
    count: projects.length,
    totalArea,
    totalSoumis, // $/pi²
    totalPaye, // $/pi²
    diff, // $/pi²
    pct,
    areaSummaries,
  };
}

function App() {
  const [projects, setProjects] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newProject, setNewProject] = useState(EMPTY_PROJECT);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedBracketId, setSelectedBracketId] = useState("");

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

  const handleOpenForm = () => {
    setNewProject(EMPTY_PROJECT);
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
    await addDoc(colRef, newProject);
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

  const handleDeleteProject = async (id) => {
    await deleteDoc(doc(db, "projets", id));
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
    // Aucun filtre -> résumé global de tous les projets
    globalSummary = buildSummaryForList(visibleProjects, null);
  } else if (isOnlyBracketFilter) {
    // seulement une tranche de superficie -> 1 résumé global
    globalSummary = buildSummaryForList(visibleProjects, null);
  } else {
    // catégorie choisie (avec ou sans tranche de superficie) -> par catégorie
    categorySummaries = CATEGORIES.map((cat) => {
      const list = visibleProjects.filter((p) => p.categorie === cat);
      return buildSummaryForList(list, cat);
    }).filter(Boolean);
  }

  // Bloc "type de coût" avec histogramme vertical Soumission/Payé et gros gain/perte
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
      pctText = `${labelBase} : ${pctAbs} % (${diffAbs} $/pi²)`;
    }

    return (
      <div key={a.id} className="summary-area">
        <div className="summary-area-header">
          <span className="summary-area-title">{a.label}</span>
        </div>

        <div className="summary-area-body">
          {/* Histogramme vertical Soumission / Payé en $/pi² */}
          <div className="summary-hist">
            {/* Soumission */}
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

            {/* Payé */}
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

          {/* Gros texte gain/perte à côté */}
          <div className={`summary-area-gain-big ${pctClass}`}>{pctText}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="app-root">
      <header className="app-header">
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

      {/* Résumé global (aucun filtre OU seulement tranche de superficie) */}
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
                    globalSummary.diff >= 0
                      ? "summary-positive"
                      : "summary-negative"
                  }
                >
                  {globalSummary.diff.toLocaleString("fr-CA", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  $/pi²
                </strong>
              </span>
              <span>
                % gain / perte :{" "}
                <strong
                  className={
                    (globalSummary.pct ?? 0) >= 0
                      ? "summary-positive"
                      : "summary-negative"
                  }
                >
                  {globalSummary.pct === null
                    ? "—"
                    : `${globalSummary.pct.toLocaleString("fr-CA", {
                        maximumFractionDigits: 1,
                      })} %`}
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

      {/* Résumé par catégorie (quand une catégorie est impliquée) */}
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
                      s.diff >= 0 ? "summary-positive" : "summary-negative"
                    }
                  >
                    {s.diff.toLocaleString("fr-CA", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    $/pi²
                  </strong>
                </span>
                <span>
                  % gain / perte :{" "}
                  <strong
                    className={
                      (s.pct ?? 0) >= 0
                        ? "summary-positive"
                        : "summary-negative"
                    }
                  >
                    {s.pct === null
                      ? "—"
                      : `${s.pct.toLocaleString("fr-CA", {
                          maximumFractionDigits: 1,
                        })} %`}
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

      {/* Liste des projets */}
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
                <li key={p.id}>
                  <div className="project-main">
                    <div>
                      <strong>{p.nomProjet || "Sans nom"}</strong>
                      {p.description && (
                        <span className="project-description">
                          {" "}
                          — {p.description}
                        </span>
                      )}
                    </div>
                    {p.categorie && (
                      <span className="project-category-tag">
                        {p.categorie}
                      </span>
                    )}
                  </div>
                  <div className="project-sub">
                    <span>
                      Superficie :{" "}
                      {superficie.toLocaleString("fr-CA", {
                        maximumFractionDigits: 0,
                      })}{" "}
                      pi²
                    </span>
                    <span>
                      Total soumis :{" "}
                      {totalParPi2.toLocaleString("fr-CA", {
                        maximumFractionDigits: 2,
                      })}{" "}
                      $/pi²
                    </span>
                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() => handleDeleteProject(p.id)}
                    >
                      Supprimer
                    </button>
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
