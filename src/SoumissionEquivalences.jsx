// src/SoumissionEquivalences.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";

const CLIENT_ID = "evaluation-projets-styro";
const CONFIG_DOC_ID = "equivalences-panneaux";
const PANNEAUX_CONFIG_DOC_ID = "norbec";

const FABRICANTS_DEFAUT = ["Norbec", "Kingspan", "Metl-Span", "AWIP"];
const CATEGORIES_DEFAUT = [
  "Type de panneau",
  "Couleur",
  "Profil",
  "Épaisseur",
  "Fini",
  "Isolant",
];

const getEquivalencesConfigRef = () =>
  doc(
    db,
    "clients",
    CLIENT_ID,
    "soumissionPanneauxEquivalences",
    CONFIG_DOC_ID
  );

const getSoumissionPanneauxConfigRef = () =>
  doc(
    db,
    "clients",
    CLIENT_ID,
    "soumissionPanneauxConfigurations",
    PANNEAUX_CONFIG_DOC_ID
  );

const getSoumissionsCollectionRef = () =>
  collection(db, "clients", CLIENT_ID, "soumissionPanneauxPanneaux");

function makeId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatDateFr(dateString) {
  if (!dateString) return "";
  const [yyyy, mm, dd] = String(dateString).split("-");
  if (!yyyy || !mm || !dd) return dateString;

  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return d.toLocaleDateString("fr-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function emptyLigne(fabricants = []) {
  return {
    id: makeId(),
    categorie: "",
    valeurs: fabricants.reduce((acc, fabricant) => {
      acc[fabricant] = "";
      return acc;
    }, {}),
    note: "",
  };
}

function SoumissionEquivalences() {
  const [chargement, setChargement] = useState(true);
  const [configPanneauxExistante, setConfigPanneauxExistante] = useState(null);

  const [fabricants, setFabricants] = useState(FABRICANTS_DEFAUT);
  const [categories, setCategories] = useState(CATEGORIES_DEFAUT);
  const [lignes, setLignes] = useState([]);

  const [ligneForm, setLigneForm] = useState(() =>
    emptyLigne(FABRICANTS_DEFAUT)
  );
  const [ligneEnEditionId, setLigneEnEditionId] = useState(null);

  const [ongletActif, setOngletActif] = useState("config");

  const [soumissions, setSoumissions] = useState([]);
  const [soumissionSelectionneeId, setSoumissionSelectionneeId] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      getEquivalencesConfigRef(),
      (snap) => {
        if (!snap.exists()) {
          setFabricants(FABRICANTS_DEFAUT);
          setCategories(CATEGORIES_DEFAUT);
          setLignes([]);
          setChargement(false);
          return;
        }

        const data = snap.data();

        const nextFabricants =
          Array.isArray(data.fabricants) && data.fabricants.length > 0
            ? data.fabricants
            : FABRICANTS_DEFAUT;

        const nextCategories =
          Array.isArray(data.categories) && data.categories.length > 0
            ? data.categories
            : CATEGORIES_DEFAUT;

        const nextLignes = Array.isArray(data.lignes) ? data.lignes : [];

        setFabricants(nextFabricants);
        setCategories(nextCategories);
        setLignes(nextLignes);

        setLigneForm((prev) => ({
          ...prev,
          valeurs: nextFabricants.reduce((acc, fabricant) => {
            acc[fabricant] = prev.valeurs?.[fabricant] || "";
            return acc;
          }, {}),
        }));

        setChargement(false);
      },
      (error) => {
        console.error("Erreur chargement équivalences:", error);
        alert("Erreur lors du chargement des équivalences.");
        setChargement(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      getSoumissionPanneauxConfigRef(),
      (snap) => {
        if (!snap.exists()) {
          setConfigPanneauxExistante(null);
          return;
        }

        setConfigPanneauxExistante(snap.data());
      },
      (error) => {
        console.error("Erreur chargement config panneaux:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(getSoumissionsCollectionRef(), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const liste = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        setSoumissions(liste);

        setSoumissionSelectionneeId((prev) => {
          if (prev && liste.some((s) => s.id === prev)) return prev;
          return liste[0]?.id || "";
        });
      },
      (error) => {
        console.error("Erreur chargement soumissions:", error);
        alert("Erreur lors du chargement des soumissions enregistrées.");
      }
    );

    return () => unsubscribe();
  }, []);

  const sauvegarderConfig = async (
    nextFabricants = fabricants,
    nextCategories = categories,
    nextLignes = lignes
  ) => {
    try {
      await setDoc(
        getEquivalencesConfigRef(),
        {
          fabricants: nextFabricants,
          categories: nextCategories,
          lignes: nextLignes,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Erreur sauvegarde équivalences:", error);
      alert("Erreur lors de la sauvegarde des équivalences.");
    }
  };

  const getValeursDisponibles = (categorie, fabricant) => {
    const valeurs = [];

    lignes.forEach((ligne) => {
      if (normalizeText(ligne.categorie) !== normalizeText(categorie)) return;

      const valeur = String(ligne.valeurs?.[fabricant] || "").trim();
      if (!valeur) return;

      const existe = valeurs.some(
        (v) => normalizeText(v) === normalizeText(valeur)
      );

      if (!existe) valeurs.push(valeur);
    });

    return valeurs.sort((a, b) => a.localeCompare(b, "fr-CA"));
  };

  const updateLignesEtSauvegarder = async (nextLignes) => {
    setLignes(nextLignes);
    await sauvegarderConfig(fabricants, categories, nextLignes);
  };

  const handleModifierCelluleTableau = async (ligneId, fabricant, valeur) => {
    const nextLignes = lignes.map((ligne) => {
      if (ligne.id !== ligneId) return ligne;

      return {
        ...ligne,
        valeurs: {
          ...(ligne.valeurs || {}),
          [fabricant]: valeur,
        },
      };
    });

    await updateLignesEtSauvegarder(nextLignes);
  };

  const handleModifierNoteTableau = async (ligneId, note) => {
    const nextLignes = lignes.map((ligne) => {
      if (ligne.id !== ligneId) return ligne;

      return {
        ...ligne,
        note,
      };
    });

    await updateLignesEtSauvegarder(nextLignes);
  };

  const importerDepuisSoumissionPanneaux = async () => {
    if (!configPanneauxExistante) {
      alert("Aucune configuration Norbec trouvée dans SoumissionPanneaux.");
      return;
    }

    const optionsNorbec = Array.isArray(configPanneauxExistante.optionsNorbec)
      ? configPanneauxExistante.optionsNorbec
      : [];

    const configsNorbec =
      configPanneauxExistante.configsNorbec &&
      typeof configPanneauxExistante.configsNorbec === "object"
        ? configPanneauxExistante.configsNorbec
        : {};

    if (optionsNorbec.length === 0) {
      alert("Aucun type Norbec trouvé à importer.");
      return;
    }

    let nextFabricants = [...fabricants];

    if (!nextFabricants.some((f) => normalizeText(f) === "norbec")) {
      nextFabricants = ["Norbec", ...nextFabricants];
    }

    let nextCategories = [...categories];

    let nextLignes = lignes.map((ligne) => ({
      ...ligne,
      valeurs: nextFabricants.reduce((acc, fabricant) => {
        acc[fabricant] = ligne.valeurs?.[fabricant] || "";
        return acc;
      }, {}),
    }));

    const ajouterCategorieSiManquante = (categorie) => {
      const cleanCategorie = String(categorie || "").trim();
      if (!cleanCategorie) return;

      const existe = nextCategories.some(
        (c) => normalizeText(c) === normalizeText(cleanCategorie)
      );

      if (!existe) {
        nextCategories.push(cleanCategorie);
      }
    };

    const ajouterLigneSiManquante = (categorie, valeurNorbec, note = "") => {
      const cleanCategorie = String(categorie || "").trim();
      const cleanValeur = String(valeurNorbec || "").trim();

      if (!cleanCategorie || !cleanValeur) return;

      const existe = nextLignes.some((ligne) => {
        return (
          normalizeText(ligne.categorie) === normalizeText(cleanCategorie) &&
          normalizeText(ligne.valeurs?.Norbec) === normalizeText(cleanValeur)
        );
      });

      if (existe) return;

      nextLignes.push({
        id: makeId(),
        categorie: cleanCategorie,
        valeurs: nextFabricants.reduce((acc, fabricant) => {
          acc[fabricant] = fabricant === "Norbec" ? cleanValeur : "";
          return acc;
        }, {}),
        note: note || "Importé depuis SoumissionPanneaux",
      });
    };

    ajouterCategorieSiManquante("Type de panneau");

    optionsNorbec.forEach((typeNorbec) => {
      ajouterLigneSiManquante(
        "Type de panneau",
        typeNorbec,
        "Type Norbec importé depuis SoumissionPanneaux"
      );
    });

    Object.entries(configsNorbec).forEach(([typePanneau, config]) => {
      if (!config || !Array.isArray(config.categories)) return;

      config.categories.forEach((categorie) => {
        const nomCategorie = categorie.titre || "";
        ajouterCategorieSiManquante(nomCategorie);

        if (!Array.isArray(categorie.questions)) return;

        categorie.questions.forEach((question) => {
          if (Array.isArray(question.choix)) {
            question.choix.forEach((choix) => {
              ajouterLigneSiManquante(
                nomCategorie,
                choix,
                `Choix importé depuis ${typePanneau}`
              );
            });
          }

          if (Array.isArray(question.choixConditionnels)) {
            question.choixConditionnels.forEach((regle) => {
              if (!Array.isArray(regle.choix)) return;

              regle.choix.forEach((choix) => {
                ajouterLigneSiManquante(
                  nomCategorie,
                  choix,
                  `Choix conditionnel importé depuis ${typePanneau}`
                );
              });
            });
          }
        });
      });
    });

    setFabricants(nextFabricants);
    setCategories(nextCategories);
    setLignes(nextLignes);

    setLigneForm((prev) => ({
      ...prev,
      valeurs: nextFabricants.reduce((acc, fabricant) => {
        acc[fabricant] = prev.valeurs?.[fabricant] || "";
        return acc;
      }, {}),
    }));

    await sauvegarderConfig(nextFabricants, nextCategories, nextLignes);

    alert("Importation Norbec terminée.");
  };

  const handleLigneValeurChange = (fabricant, valeur) => {
    setLigneForm((prev) => ({
      ...prev,
      valeurs: {
        ...(prev.valeurs || {}),
        [fabricant]: valeur,
      },
    }));
  };

  const handleCategorieLigneChange = (categorie) => {
    setLigneForm((prev) => ({
      ...prev,
      categorie,
      valeurs: {
        ...(prev.valeurs || {}),
        Norbec: "",
      },
    }));
  };

  const resetLigneForm = () => {
    setLigneForm(emptyLigne(fabricants));
    setLigneEnEditionId(null);
  };

  const handleAjouterOuModifierLigne = async () => {
    if (!ligneForm.categorie) {
      alert("Choisis une catégorie.");
      return;
    }

    const valeursRemplies = fabricants.filter((fabricant) =>
      String(ligneForm.valeurs?.[fabricant] || "").trim()
    );

    if (valeursRemplies.length < 2) {
      alert("Entre au moins deux valeurs pour faire une équivalence.");
      return;
    }

    const ligneAEnregistrer = {
      ...ligneForm,
      id: ligneEnEditionId || ligneForm.id || makeId(),
      valeurs: fabricants.reduce((acc, fabricant) => {
        acc[fabricant] = String(ligneForm.valeurs?.[fabricant] || "").trim();
        return acc;
      }, {}),
      note: String(ligneForm.note || "").trim(),
    };

    let nextLignes;

    if (ligneEnEditionId) {
      nextLignes = lignes.map((ligne) =>
        ligne.id === ligneEnEditionId ? ligneAEnregistrer : ligne
      );
    } else {
      nextLignes = [...lignes, ligneAEnregistrer];
    }

    setLignes(nextLignes);
    resetLigneForm();

    await sauvegarderConfig(fabricants, categories, nextLignes);
  };

  const handleModifierLigne = (ligne) => {
    setLigneEnEditionId(ligne.id);
    setLigneForm({
      id: ligne.id,
      categorie: ligne.categorie || "",
      valeurs: fabricants.reduce((acc, fabricant) => {
        acc[fabricant] = ligne.valeurs?.[fabricant] || "";
        return acc;
      }, {}),
      note: ligne.note || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSupprimerLigne = async (ligneId) => {
    const confirmation = window.confirm("Supprimer cette équivalence ?");
    if (!confirmation) return;

    const nextLignes = lignes.filter((ligne) => ligne.id !== ligneId);

    setLignes(nextLignes);

    if (ligneEnEditionId === ligneId) {
      resetLigneForm();
    }

    await sauvegarderConfig(fabricants, categories, nextLignes);
  };

  const trouverEquivalence = (categorie, fabricantDepart, valeurDepart) => {
    const valeurNormalisee = normalizeText(valeurDepart);

    if (!categorie || !fabricantDepart || !valeurNormalisee) return null;

    return (
      lignes.find((ligne) => {
        if (normalizeText(ligne.categorie) !== normalizeText(categorie)) {
          return false;
        }

        const valeurLigne = normalizeText(ligne.valeurs?.[fabricantDepart]);

        return valeurLigne && valeurLigne === valeurNormalisee;
      }) || null
    );
  };

  const trouverQuestionDansConfig = (typePanneau, questionId) => {
    const configsNorbec =
      configPanneauxExistante?.configsNorbec &&
      typeof configPanneauxExistante.configsNorbec === "object"
        ? configPanneauxExistante.configsNorbec
        : {};

    const configType = configsNorbec[typePanneau];

    if (!configType || !Array.isArray(configType.categories)) {
      return {
        categorie: "Autre",
        label: questionId,
      };
    }

    for (const categorie of configType.categories) {
      const question = (categorie.questions || []).find(
        (q) => q.id === questionId
      );

      if (question) {
        return {
          categorie: question.label || categorie.titre || "Autre",
          label: question.label || categorie.titre || questionId,
        };
      }
    }

    return {
      categorie: "Autre",
      label: questionId,
    };
  };

  const soumissionSelectionnee = useMemo(() => {
    return (
      soumissions.find((soumission) => soumission.id === soumissionSelectionneeId) ||
      null
    );
  }, [soumissions, soumissionSelectionneeId]);

  const lignesSoumissionSelectionnee = useMemo(() => {
    if (!soumissionSelectionnee) return [];

    const sourceFabricant = soumissionSelectionnee.fabricant || "Norbec";
    const resultat = [];

    if (Array.isArray(soumissionSelectionnee.typesPanneaux)) {
      soumissionSelectionnee.typesPanneaux.forEach((typePanneau) => {
        resultat.push({
          id: `type-${typePanneau}`,
          categorie: "Type de panneau",
          champ: "Type de panneau",
          typePanneau,
          valeurSource: typePanneau,
          sourceFabricant,
        });
      });
    }

    Object.entries(soumissionSelectionnee.reponses || {}).forEach(
      ([key, value]) => {
        if (value === null || value === undefined || String(value).trim() === "") {
          return;
        }

        const [typePanneau, questionId] = key.split("__");
        const infoQuestion = trouverQuestionDansConfig(typePanneau, questionId);

        resultat.push({
          id: key,
          categorie: infoQuestion.categorie,
          champ: infoQuestion.label,
          typePanneau,
          valeurSource: String(value),
          sourceFabricant,
        });
      }
    );

    return resultat;
  }, [soumissionSelectionnee, configPanneauxExistante]);

  const fabricantsCiblesSoumission = useMemo(() => {
    const sourceFabricant = soumissionSelectionnee?.fabricant || "Norbec";
    return fabricants.filter((fabricant) => fabricant !== sourceFabricant);
  }, [fabricants, soumissionSelectionnee]);

  const resultatsSoumissionComplete = useMemo(() => {
    if (!soumissionSelectionnee) return [];

    return lignesSoumissionSelectionnee.map((ligneSoumission) => {
      const equivalence = trouverEquivalence(
        ligneSoumission.categorie,
        ligneSoumission.sourceFabricant,
        ligneSoumission.valeurSource
      );

      return {
        ...ligneSoumission,
        equivalence,
        resultats: fabricantsCiblesSoumission.map((fabricantCible) => ({
          fabricant: fabricantCible,
          valeur: equivalence?.valeurs?.[fabricantCible] || "",
        })),
      };
    });
  }, [
    lignesSoumissionSelectionnee,
    fabricantsCiblesSoumission,
    soumissionSelectionnee,
    lignes,
  ]);

  const lignesParCategorie = useMemo(() => {
    return categories.reduce((acc, categorie) => {
      acc[categorie] = lignes.filter(
        (ligne) => normalizeText(ligne.categorie) === normalizeText(categorie)
      );
      return acc;
    }, {});
  }, [categories, lignes]);

  return (
    <div className="app-root equivalences-page">
      <style>
        {`
          .equivalences-page {
            width: 88%;
            max-width: 1800px;
            margin: 0 auto;
          }

          .equiv-header {
            text-align: center;
            margin-bottom: 18px;
          }

          .equiv-title {
            font-size: 32px;
            font-weight: 900;
            margin: 0;
            color: #111827;
            letter-spacing: 0.04em;
          }

          .equiv-subtitle {
            margin: 8px 0 0 0;
            color: #64748b;
            font-size: 14px;
          }

          .equiv-tabs {
            display: flex;
            justify-content: center;
            gap: 10px;
            flex-wrap: wrap;
            margin-bottom: 20px;
          }

          .equiv-tab {
            border: 1px solid #cbd5e1;
            background: #f8fafc;
            color: #334155;
            border-radius: 999px;
            padding: 10px 18px;
            font-size: 14px;
            font-weight: 900;
            cursor: pointer;
          }

          .equiv-tab.active {
            background: #0f172a;
            color: white;
            border-color: #0f172a;
          }

          .equiv-card {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 18px;
            padding: 20px 24px;
            box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
            margin-bottom: 18px;
          }

          .equiv-card-title {
            font-size: 24px;
            font-weight: 900;
            color: #111827;
            margin: 0 0 6px 0;
          }

          .equiv-card-help {
            color: #64748b;
            font-size: 14px;
            margin: 0 0 16px 0;
            line-height: 1.45;
          }

          .equiv-loading {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            color: #92400e;
            border-radius: 10px;
            padding: 10px 12px;
            font-weight: 800;
            margin-bottom: 14px;
          }

          .equiv-import-box {
            background: #ecfdf5;
            border: 1px solid #86efac;
            border-radius: 16px;
            padding: 14px;
            margin-bottom: 16px;
          }

          .equiv-import-title {
            font-size: 16px;
            font-weight: 900;
            color: #166534;
            margin: 0 0 6px 0;
          }

          .equiv-import-text {
            color: #166534;
            font-size: 13px;
            font-weight: 700;
            line-height: 1.45;
            margin: 0 0 12px 0;
          }

          .equiv-section {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 14px;
            margin-bottom: 16px;
          }

          .equiv-section-title {
            font-size: 17px;
            font-weight: 900;
            color: #0f172a;
            margin: 0 0 10px 0;
          }

          .equiv-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 12px;
          }

          .equiv-field {
            display: flex;
            flex-direction: column;
            gap: 5px;
            font-size: 13px;
            font-weight: 800;
            color: #374151;
          }

          .equiv-field input,
          .equiv-field select,
          .equiv-field textarea {
            width: 100%;
            border-radius: 8px;
            border: 1px solid #d1d5db;
            padding: 8px 10px;
            font-size: 13px;
            background: white;
          }

          .equiv-field textarea {
            min-height: 70px;
            resize: vertical;
          }

          .equiv-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            align-items: center;
            justify-content: flex-end;
            margin-top: 12px;
          }

          .equiv-form-panel {
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 16px;
            padding: 16px;
            margin-bottom: 18px;
          }

          .equiv-form-title {
            font-size: 18px;
            font-weight: 900;
            color: #1e3a8a;
            margin: 0 0 12px 0;
          }

          .equiv-table-wrap {
            overflow-x: auto;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: white;
          }

          .equiv-table {
            width: 100%;
            border-collapse: collapse;
            min-width: 850px;
          }

          .equiv-table th,
          .equiv-table td {
            border-bottom: 1px solid #e5e7eb;
            padding: 10px 12px;
            text-align: left;
            vertical-align: top;
            font-size: 13px;
          }

          .equiv-table th {
            background: #f8fafc;
            color: #0f172a;
            font-weight: 900;
            position: sticky;
            top: 0;
            z-index: 1;
          }

          .equiv-table tr:last-child td {
            border-bottom: 0;
          }

          .equiv-table-input,
          .equiv-table-select {
            width: 100%;
            min-width: 130px;
            border: 1px solid transparent;
            background: transparent;
            border-radius: 8px;
            padding: 7px 8px;
            font-size: 13px;
            color: #111827;
          }

          .equiv-table-input:hover,
          .equiv-table-select:hover {
            background: #f8fafc;
            border-color: #cbd5e1;
          }

          .equiv-table-input:focus,
          .equiv-table-select:focus {
            background: white;
            border-color: #2563eb;
            outline: 2px solid #bfdbfe;
          }

          .equiv-table-note {
            min-width: 260px;
          }

          .equiv-table-save-note {
            color: #64748b;
            font-size: 11px;
            font-weight: 700;
            margin-top: 4px;
          }

          .equiv-category-block {
            margin-bottom: 18px;
          }

          .equiv-category-title {
            font-size: 18px;
            font-weight: 900;
            color: #111827;
            margin: 0 0 8px 0;
          }

          .equiv-empty {
            color: #64748b;
            font-size: 14px;
            font-weight: 700;
            padding: 12px;
            background: #f8fafc;
            border: 1px dashed #cbd5e1;
            border-radius: 12px;
          }

          .equiv-result-ok {
            color: #166534;
            font-weight: 900;
          }

          .equiv-result-missing {
            color: #dc2626;
            font-weight: 900;
          }

          .equiv-note {
            color: #64748b;
            font-size: 12px;
            margin-top: 4px;
          }

          .equiv-soumission-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 10px;
            margin-bottom: 14px;
          }

          .equiv-summary-card {
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 10px 12px;
          }

          .equiv-summary-label {
            font-size: 12px;
            color: #64748b;
            font-weight: 800;
            margin-bottom: 3px;
          }

          .equiv-summary-value {
            font-size: 15px;
            color: #0f172a;
            font-weight: 900;
          }

          @media (max-width: 768px) {
            .equivalences-page {
              width: 100%;
              padding: 14px;
            }

            .equiv-title {
              font-size: 24px;
            }

            .equiv-card {
              padding: 16px;
            }

            .equiv-actions {
              justify-content: flex-start;
            }
          }
        `}
      </style>

      <header className="equiv-header">
        <h1 className="equiv-title">ÉQUIVALENCES ENTRE FABRICANTS</h1>
        <p className="equiv-subtitle">
          Évalue automatiquement une soumission enregistrée vers les autres fabricants.
        </p>
      </header>

      <div className="equiv-tabs">
        <button
          type="button"
          className={`equiv-tab ${ongletActif === "config" ? "active" : ""}`}
          onClick={() => setOngletActif("config")}
        >
          Configurer les équivalences
        </button>

        <button
          type="button"
          className={`equiv-tab ${ongletActif === "evaluer" ? "active" : ""}`}
          onClick={() => setOngletActif("evaluer")}
        >
          Évaluer une soumission enregistrée
        </button>
      </div>

      {chargement && (
        <div className="equiv-loading">Chargement des équivalences...</div>
      )}

      {ongletActif === "config" && (
        <>
          <section className="equiv-card">
            <h2 className="equiv-card-title">
              1. Importer ta configuration Norbec existante
            </h2>

            <p className="equiv-card-help">
              Ce bouton récupère les types de panneaux et les choix que tu as
              déjà créés dans la page SoumissionPanneaux. Les valeurs Norbec
              seront déjà remplies, puis tu peux écrire les équivalents
              directement dans les tableaux.
            </p>

            <div className="equiv-import-box">
              <h3 className="equiv-import-title">
                Import automatique depuis SoumissionPanneaux
              </h3>

              <p className="equiv-import-text">
                Exemple : si tu as déjà créé “Norex L”, “Norex M” ou des choix
                comme “Blanc régal”, ils seront ajoutés ici avec Norbec déjà
                rempli.
              </p>

              <button
                type="button"
                className="btn-primary"
                onClick={importerDepuisSoumissionPanneaux}
              >
                Importer les types et choix Norbec déjà configurés
              </button>
            </div>
          </section>

          <section className="equiv-card">
            <h2 className="equiv-card-title">2. Équivalences</h2>

            <p className="equiv-card-help">
              Tu peux ajouter une équivalence manuellement ici, ou modifier
              directement les cases dans les tableaux plus bas.
            </p>

            <div className="equiv-form-panel">
              <h3 className="equiv-form-title">
                {ligneEnEditionId
                  ? "Modifier l’équivalence"
                  : "Nouvelle équivalence"}
              </h3>

              <div className="equiv-grid">
                <label className="equiv-field">
                  Catégorie
                  <select
                    value={ligneForm.categorie}
                    onChange={(e) => handleCategorieLigneChange(e.target.value)}
                  >
                    <option value="">Sélectionnez...</option>
                    {categories.map((categorie, index) => (
                      <option key={`${categorie}-${index}`} value={categorie}>
                        {categorie}
                      </option>
                    ))}
                  </select>
                </label>

                {fabricants.map((fabricant, index) => {
                  const valeursDisponibles = getValeursDisponibles(
                    ligneForm.categorie,
                    fabricant
                  );

                  if (fabricant === "Norbec") {
                    return (
                      <label
                        key={`${fabricant}-${index}`}
                        className="equiv-field"
                      >
                        Valeur chez {fabricant}
                        <select
                          value={ligneForm.valeurs?.[fabricant] || ""}
                          onChange={(e) =>
                            handleLigneValeurChange(fabricant, e.target.value)
                          }
                          disabled={!ligneForm.categorie}
                        >
                          <option value="">
                            {ligneForm.categorie
                              ? "Sélectionnez une valeur Norbec..."
                              : "Choisis d’abord une catégorie"}
                          </option>

                          {valeursDisponibles.map((valeur, valeurIndex) => (
                            <option
                              key={`${fabricant}-${valeur}-${valeurIndex}`}
                              value={valeur}
                            >
                              {valeur}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  }

                  return (
                    <label
                      key={`${fabricant}-${index}`}
                      className="equiv-field"
                    >
                      Valeur chez {fabricant}
                      <input
                        type="text"
                        value={ligneForm.valeurs?.[fabricant] || ""}
                        onChange={(e) =>
                          handleLigneValeurChange(fabricant, e.target.value)
                        }
                        placeholder="Écrire l’équivalent"
                      />
                    </label>
                  );
                })}

                <label className="equiv-field">
                  Note
                  <textarea
                    value={ligneForm.note || ""}
                    onChange={(e) =>
                      setLigneForm((prev) => ({
                        ...prev,
                        note: e.target.value,
                      }))
                    }
                    placeholder="Note optionnelle..."
                  />
                </label>
              </div>

              <div className="equiv-actions">
                {ligneEnEditionId && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={resetLigneForm}
                  >
                    Annuler modification
                  </button>
                )}

                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleAjouterOuModifierLigne}
                >
                  {ligneEnEditionId
                    ? "Enregistrer modification"
                    : "Ajouter équivalence"}
                </button>
              </div>
            </div>

            {categories.map((categorie, categorieIndex) => {
              const lignesCategorie = lignesParCategorie[categorie] || [];

              return (
                <div
                  key={`${categorie}-${categorieIndex}`}
                  className="equiv-category-block"
                >
                  <h3 className="equiv-category-title">{categorie}</h3>

                  {lignesCategorie.length === 0 ? (
                    <div className="equiv-empty">
                      Aucune équivalence dans cette catégorie.
                    </div>
                  ) : (
                    <div className="equiv-table-wrap">
                      <table className="equiv-table">
                        <thead>
                          <tr>
                            {fabricants.map((fabricant, index) => (
                              <th key={`${fabricant}-${index}`}>{fabricant}</th>
                            ))}
                            <th>Note</th>
                            <th>Actions</th>
                          </tr>
                        </thead>

                        <tbody>
                          {lignesCategorie.map((ligne) => (
                            <tr key={ligne.id}>
                              {fabricants.map((fabricant, index) => {
                                const valeurCellule =
                                  ligne.valeurs?.[fabricant] || "";

                                if (fabricant === "Norbec") {
                                  const valeursNorbec =
                                    getValeursDisponibles(categorie, "Norbec");

                                  return (
                                    <td
                                      key={`${fabricant}-${ligne.id}-${index}`}
                                    >
                                      <select
                                        className="equiv-table-select"
                                        value={valeurCellule}
                                        onChange={(e) =>
                                          handleModifierCelluleTableau(
                                            ligne.id,
                                            fabricant,
                                            e.target.value
                                          )
                                        }
                                      >
                                        <option value="">—</option>

                                        {valeurCellule &&
                                          !valeursNorbec.some(
                                            (v) =>
                                              normalizeText(v) ===
                                              normalizeText(valeurCellule)
                                          ) && (
                                            <option value={valeurCellule}>
                                              {valeurCellule}
                                            </option>
                                          )}

                                        {valeursNorbec.map(
                                          (valeur, valeurIndex) => (
                                            <option
                                              key={`${ligne.id}-${fabricant}-${valeur}-${valeurIndex}`}
                                              value={valeur}
                                            >
                                              {valeur}
                                            </option>
                                          )
                                        )}
                                      </select>
                                    </td>
                                  );
                                }

                                return (
                                  <td key={`${fabricant}-${ligne.id}-${index}`}>
                                    <input
                                      className="equiv-table-input"
                                      type="text"
                                      value={valeurCellule}
                                      onChange={(e) =>
                                        handleModifierCelluleTableau(
                                          ligne.id,
                                          fabricant,
                                          e.target.value
                                        )
                                      }
                                      placeholder="—"
                                    />
                                  </td>
                                );
                              })}

                              <td>
                                <input
                                  className="equiv-table-input equiv-table-note"
                                  type="text"
                                  value={ligne.note || ""}
                                  onChange={(e) =>
                                    handleModifierNoteTableau(
                                      ligne.id,
                                      e.target.value
                                    )
                                  }
                                  placeholder="Note..."
                                />
                                <div className="equiv-table-save-note">
                                  Sauvegarde automatique
                                </div>
                              </td>

                              <td>
                                <div className="equiv-actions">
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => handleModifierLigne(ligne)}
                                  >
                                    Modifier
                                  </button>

                                  <button
                                    type="button"
                                    className="delete-btn"
                                    onClick={() =>
                                      handleSupprimerLigne(ligne.id)
                                    }
                                  >
                                    Supprimer
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </>
      )}

      {ongletActif === "evaluer" && (
        <section className="equiv-card">
          <h2 className="equiv-card-title">
            Évaluer une soumission enregistrée
          </h2>

          <p className="equiv-card-help">
            Choisis une soumission enregistrée. L’application va prendre toutes
            ses réponses et chercher les équivalences configurées pour chaque
            catégorie.
          </p>

          <div className="equiv-section">
            <h3 className="equiv-section-title">Soumission à évaluer</h3>

            <div className="equiv-grid">
              <label className="equiv-field">
                Soumission enregistrée
                <select
                  value={soumissionSelectionneeId}
                  onChange={(e) => setSoumissionSelectionneeId(e.target.value)}
                >
                  <option value="">Sélectionnez une soumission...</option>
                  {soumissions.map((soumission) => (
                    <option key={soumission.id} value={soumission.id}>
                      {soumission.nomProjet || "Projet sans nom"} —{" "}
                      {soumission.villeProjet || "Ville non spécifiée"} —{" "}
                      {formatDateFr(soumission.dateProjet)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {!soumissionSelectionnee ? (
            <div className="equiv-empty">
              Aucune soumission sélectionnée.
            </div>
          ) : (
            <>
              <div className="equiv-soumission-summary">
                <div className="equiv-summary-card">
                  <div className="equiv-summary-label">Projet</div>
                  <div className="equiv-summary-value">
                    {soumissionSelectionnee.nomProjet || "—"}
                  </div>
                </div>

                <div className="equiv-summary-card">
                  <div className="equiv-summary-label">Ville</div>
                  <div className="equiv-summary-value">
                    {soumissionSelectionnee.villeProjet || "—"}
                  </div>
                </div>

                <div className="equiv-summary-card">
                  <div className="equiv-summary-label">Date</div>
                  <div className="equiv-summary-value">
                    {formatDateFr(soumissionSelectionnee.dateProjet) || "—"}
                  </div>
                </div>

                <div className="equiv-summary-card">
                  <div className="equiv-summary-label">Fabricant source</div>
                  <div className="equiv-summary-value">
                    {soumissionSelectionnee.fabricant || "Norbec"}
                  </div>
                </div>
              </div>

              {resultatsSoumissionComplete.length === 0 ? (
                <div className="equiv-empty">
                  Cette soumission ne contient pas encore de réponses à évaluer.
                </div>
              ) : (
                <div className="equiv-table-wrap">
                  <table className="equiv-table">
                    <thead>
                      <tr>
                        <th>Type de panneau</th>
                        <th>Catégorie</th>
                        <th>Champ</th>
                        <th>Valeur source</th>
                        {fabricantsCiblesSoumission.map((fabricant) => (
                          <th key={fabricant}>Équivalent {fabricant}</th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {resultatsSoumissionComplete.map((ligne) => (
                        <tr key={ligne.id}>
                          <td>{ligne.typePanneau || "—"}</td>
                          <td>{ligne.categorie || "—"}</td>
                          <td>{ligne.champ || "—"}</td>

                          <td>
                            <strong>{ligne.sourceFabricant}</strong> —{" "}
                            {ligne.valeurSource}
                          </td>

                          {ligne.resultats.map((resultat) => (
                            <td key={`${ligne.id}-${resultat.fabricant}`}>
                              {resultat.valeur ? (
                                <span className="equiv-result-ok">
                                  {resultat.valeur}
                                </span>
                              ) : (
                                <span className="equiv-result-missing">
                                  Aucun équivalent trouvé
                                </span>
                              )}

                              {ligne.equivalence?.note && (
                                <div className="equiv-note">
                                  Note : {ligne.equivalence.note}
                                </div>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

export default SoumissionEquivalences;