// src/SoumissionPanneaux.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import SoumissionEquivalences from "./SoumissionEquivalences";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

const CLIENT_ID = "evaluation-projets-styro";
const CONFIG_DOC_ID = "norbec";

const FABRICANTS_INITIAUX = ["Norbec", "Kingspan", "Metl-Span", "AWIP"];

const TYPES_NORBEC_DEFAUT = [
  "Norex L",
  "Norex M",
  "Norex H",
  "Noroc",
  "Norex S (Panneaux intérieurs seulement)",
  "Norex IN",
];

const TYPES_REPONSES = [
  { value: "text", label: "Texte" },
  { value: "number", label: "Nombre" },
  { value: "select", label: "Menu déroulant" },
  { value: "radio", label: "Choix radio" },
  { value: "yesno", label: "Oui / Non" },
];

const EMPTY_QUESTION = {
  categorieId: "",
  type: "text",
  obligatoire: true,
  choixTexte: "",
  conditionActive: false,
  conditionQuestionId: "",
  conditionValeur: "",
  choixConditionnelsActif: false,
  choixConditionQuestionId: "",
  choixConditionValeur: "",
  choixConditionTexte: "",
};

const getConfigRef = () =>
  doc(
    db,
    "clients",
    CLIENT_ID,
    "soumissionPanneauxConfigurations",
    CONFIG_DOC_ID
  );

const getPanneauxCollectionRef = () =>
  collection(db, "clients", CLIENT_ID, "soumissionPanneauxPanneaux");

const getPanneauRef = (id) =>
  doc(db, "clients", CLIENT_ID, "soumissionPanneauxPanneaux", id);

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

function getTodayInputDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function makeEmptyPanneau(fabricant = "") {
  return {
    dateProjet: getTodayInputDate(),
    nomProjet: "",
    villeProjet: "",
    fabricant,
    typesPanneaux: [],
    reponses: {},
  };
}

function splitChoix(texte) {
  return String(texte || "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
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

function buildInitialTypesByFabricant(fabricants = FABRICANTS_INITIAUX) {
  return fabricants.reduce((acc, fabricant) => {
    acc[fabricant] = fabricant === "Norbec" ? TYPES_NORBEC_DEFAUT : [];
    return acc;
  }, {});
}

function buildInitialConfigsByFabricant(typesByFabricant) {
  const configs = {};

  Object.entries(typesByFabricant || {}).forEach(([fabricant, types]) => {
    configs[fabricant] = {};

    (types || []).forEach((type) => {
      configs[fabricant][type] = { categories: [] };
    });
  });

  return configs;
}

function normalizeTypesByFabricant(fabricants, data) {
  const oldOptionsNorbec = Array.isArray(data?.optionsNorbec)
    ? data.optionsNorbec
    : TYPES_NORBEC_DEFAUT;

  const base =
    data?.optionsPanneauxParFabricant &&
    typeof data.optionsPanneauxParFabricant === "object"
      ? { ...data.optionsPanneauxParFabricant }
      : buildInitialTypesByFabricant(fabricants);

  fabricants.forEach((fabricant) => {
    if (!Array.isArray(base[fabricant])) {
      base[fabricant] = fabricant === "Norbec" ? oldOptionsNorbec : [];
    }
  });

  return base;
}

function normalizeConfigsByFabricant(fabricants, typesByFabricant, data) {
  const oldConfigsNorbec =
    data?.configsNorbec && typeof data.configsNorbec === "object"
      ? data.configsNorbec
      : {};

  const base =
    data?.configsPanneauxParFabricant &&
    typeof data.configsPanneauxParFabricant === "object"
      ? { ...data.configsPanneauxParFabricant }
      : {};

  fabricants.forEach((fabricant) => {
    if (!base[fabricant] || typeof base[fabricant] !== "object") {
      base[fabricant] = {};
    }

    (typesByFabricant[fabricant] || []).forEach((type) => {
      if (!base[fabricant][type]) {
        base[fabricant][type] =
          fabricant === "Norbec" && oldConfigsNorbec[type]
            ? oldConfigsNorbec[type]
            : { categories: [] };
      }

      if (!Array.isArray(base[fabricant][type].categories)) {
        base[fabricant][type].categories = [];
      }
    });
  });

  return base;
}

function SoumissionPanneaux() {
  const [ongletActif, setOngletActif] = useState("formulaire");

  const [panneaux, setPanneaux] = useState([]);
  const [chargementConfig, setChargementConfig] = useState(true);
  const [chargementPanneaux, setChargementPanneaux] = useState(true);

  const [optionsFabricants, setOptionsFabricants] = useState([]);
  const [nouveauFabricant, setNouveauFabricant] = useState("");

  const [typesParFabricant, setTypesParFabricant] = useState(() =>
    buildInitialTypesByFabricant()
  );

  const [configsParFabricant, setConfigsParFabricant] = useState(() =>
    buildInitialConfigsByFabricant(buildInitialTypesByFabricant())
  );

  const [fabricantConfigSelectionne, setFabricantConfigSelectionne] =
    useState("Norbec");
  const [typeConfigSelectionne, setTypeConfigSelectionne] = useState("Norex L");
  const [nouveauTypePanneau, setNouveauTypePanneau] = useState("");

  const [nouveauPanneau, setNouveauPanneau] = useState(() =>
    makeEmptyPanneau("")
  );
  const [panneauEnEditionId, setPanneauEnEditionId] = useState(null);

  const [modeConfiguration, setModeConfiguration] = useState(false);

  const [nouvelleCategorie, setNouvelleCategorie] = useState("");
  const [nouvelleQuestion, setNouvelleQuestion] = useState(EMPTY_QUESTION);
  const [questionEnEdition, setQuestionEnEdition] = useState(null);
  const [copieCategorieVersType, setCopieCategorieVersType] = useState({});

  useEffect(() => {
    const unsubscribe = onSnapshot(
      getConfigRef(),
      (snap) => {
        if (!snap.exists()) {
          const fabricants = FABRICANTS_INITIAUX;
          const typesInitial = buildInitialTypesByFabricant(fabricants);
          const configsInitial = buildInitialConfigsByFabricant(typesInitial);

          setOptionsFabricants(fabricants);
          setTypesParFabricant(typesInitial);
          setConfigsParFabricant(configsInitial);
          setFabricantConfigSelectionne("Norbec");
          setTypeConfigSelectionne(TYPES_NORBEC_DEFAUT[0]);

          setNouveauPanneau((prev) => ({
            ...prev,
            fabricant: fabricants[0] || "",
          }));

          setChargementConfig(false);
          return;
        }

        const data = snap.data();

        const fabricants =
          Array.isArray(data.optionsFabricants) &&
          data.optionsFabricants.length > 0
            ? data.optionsFabricants
            : FABRICANTS_INITIAUX;

        const nextTypesParFabricant = normalizeTypesByFabricant(
          fabricants,
          data
        );

        const nextConfigsParFabricant = normalizeConfigsByFabricant(
          fabricants,
          nextTypesParFabricant,
          data
        );

        setOptionsFabricants(fabricants);
        setTypesParFabricant(nextTypesParFabricant);
        setConfigsParFabricant(nextConfigsParFabricant);

        setFabricantConfigSelectionne((prev) => {
          if (prev && fabricants.includes(prev)) return prev;
          return fabricants[0] || "";
        });

        setTypeConfigSelectionne((prev) => {
          const fabricantActuel = fabricants.includes(fabricantConfigSelectionne)
            ? fabricantConfigSelectionne
            : fabricants[0];

          const types = nextTypesParFabricant[fabricantActuel] || [];
          if (prev && types.includes(prev)) return prev;
          return types[0] || "";
        });

        setNouveauPanneau((prev) => {
          const fabricantValide =
            prev.fabricant && fabricants.includes(prev.fabricant)
              ? prev.fabricant
              : fabricants[0] || "";

          const typesValides = nextTypesParFabricant[fabricantValide] || [];

          return {
            ...prev,
            fabricant: fabricantValide,
            typesPanneaux: prev.typesPanneaux.filter((type) =>
              typesValides.includes(type)
            ),
          };
        });

        setChargementConfig(false);
      },
      (error) => {
        console.error("Erreur chargement configuration:", error);
        alert("Erreur lors du chargement de la configuration Firestore.");
        setChargementConfig(false);
      }
    );

    return () => unsubscribe();
  }, [fabricantConfigSelectionne]);

  useEffect(() => {
    const q = query(getPanneauxCollectionRef(), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const liste = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        setPanneaux(liste);
        setChargementPanneaux(false);
      },
      (error) => {
        console.error("Erreur chargement soumissions:", error);
        alert("Erreur lors du chargement des soumissions Firestore.");
        setChargementPanneaux(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const sauvegarderConfiguration = async (
    nextFabricants = optionsFabricants,
    nextTypesParFabricant = typesParFabricant,
    nextConfigsParFabricant = configsParFabricant
  ) => {
    try {
      await setDoc(
        getConfigRef(),
        {
          optionsFabricants: nextFabricants,
          optionsPanneauxParFabricant: nextTypesParFabricant,
          configsPanneauxParFabricant: nextConfigsParFabricant,

          // Compatibilité avec l’ancien code / page Équivalences Norbec
          optionsNorbec: nextTypesParFabricant.Norbec || [],
          configsNorbec: nextConfigsParFabricant.Norbec || {},

          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Erreur sauvegarde configuration:", error);
      alert("Erreur lors de la sauvegarde de la configuration.");
    }
  };

  const typesDuFabricantFormulaire = useMemo(() => {
    return typesParFabricant[nouveauPanneau.fabricant] || [];
  }, [typesParFabricant, nouveauPanneau.fabricant]);

  const typesDuFabricantConfig = useMemo(() => {
    return typesParFabricant[fabricantConfigSelectionne] || [];
  }, [typesParFabricant, fabricantConfigSelectionne]);

  const configSelectionnee = useMemo(() => {
    return (
      configsParFabricant?.[fabricantConfigSelectionne]?.[
        typeConfigSelectionne
      ] || { categories: [] }
    );
  }, [configsParFabricant, fabricantConfigSelectionne, typeConfigSelectionne]);

  const questionsConfigurables = useMemo(() => {
    const questions = [];

    (configSelectionnee.categories || []).forEach((cat) => {
      (cat.questions || []).forEach((q) => {
        questions.push({
          ...q,
          categorieId: cat.id,
          categorieTitre: cat.titre,
        });
      });
    });

    return questions;
  }, [configSelectionnee]);

  const questionEnEditionData = useMemo(() => {
    if (!questionEnEdition) return null;

    for (const cat of configSelectionnee.categories || []) {
      if (cat.id !== questionEnEdition.categorieId) continue;

      const q = (cat.questions || []).find(
        (question) => question.id === questionEnEdition.questionId
      );

      if (q) return q;
    }

    return null;
  }, [questionEnEdition, configSelectionnee]);

  const questionsActives = useMemo(() => {
    const questions = [];

    nouveauPanneau.typesPanneaux.forEach((type) => {
      const config =
        configsParFabricant?.[nouveauPanneau.fabricant]?.[type] || null;

      if (!config?.categories) return;

      config.categories.forEach((categorie) => {
        (categorie.questions || []).forEach((question) => {
          questions.push({
            ...question,
            typePanneau: type,
            categorieTitre: categorie.titre,
          });
        });
      });
    });

    return questions;
  }, [
    nouveauPanneau.typesPanneaux,
    nouveauPanneau.fabricant,
    configsParFabricant,
  ]);

  const resetQuestionForm = (categorieId = "") => {
    setNouvelleQuestion({
      ...EMPTY_QUESTION,
      categorieId,
    });
    setQuestionEnEdition(null);
  };

  const resetPanneauForm = () => {
    setNouveauPanneau(makeEmptyPanneau(optionsFabricants[0] || ""));
    setPanneauEnEditionId(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "fabricant") {
      setNouveauPanneau((prev) => ({
        ...prev,
        fabricant: value,
        typesPanneaux: [],
        reponses: {},
      }));
      return;
    }

    setNouveauPanneau((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const getReponseKey = (typePanneau, questionId) => {
    return `${typePanneau}__${questionId}`;
  };

  const getReponseValue = (typePanneau, questionId) => {
    const key = getReponseKey(typePanneau, questionId);
    return nouveauPanneau.reponses?.[key] || "";
  };

  const getQuestionLabel = (fabricant, typePanneau, questionId) => {
    const config = configsParFabricant?.[fabricant]?.[typePanneau];

    for (const cat of config?.categories || []) {
      const question = (cat.questions || []).find((q) => q.id === questionId);
      if (question) return question.label || cat.titre;
    }

    return questionId;
  };

  const getChoixQuestion = (question) => {
    if (!question) return [];
    if (question.type === "yesno") return ["Oui", "Non"];
    if (Array.isArray(question.choix)) return question.choix;
    return [];
  };

  const trouverRegleChoixConditionnels = (question, questionId, valeur) => {
    if (!question || !Array.isArray(question.choixConditionnels)) return null;

    return (
      question.choixConditionnels.find(
        (rule) =>
          rule?.active &&
          rule.questionId === questionId &&
          String(rule.valeur) === String(valeur)
      ) || null
    );
  };

  const isQuestionVisibleFromResponses = (typePanneau, question, reponses) => {
    if (!question.condition?.active) return true;

    const reponseDependance =
      reponses[getReponseKey(typePanneau, question.condition.questionId)] || "";

    return String(reponseDependance) === String(question.condition.valeur);
  };

  const isQuestionVisible = (typePanneau, question) => {
    return isQuestionVisibleFromResponses(
      typePanneau,
      question,
      nouveauPanneau.reponses || {}
    );
  };

  const getEffectiveChoicesFromResponses = (typePanneau, question, reponses) => {
    const baseChoices = Array.isArray(question.choix) ? question.choix : [];

    if (!Array.isArray(question.choixConditionnels)) return baseChoices;

    const regle = question.choixConditionnels.find((rule) => {
      if (!rule?.active) return false;

      const valeur =
        reponses[getReponseKey(typePanneau, rule.questionId)] || "";

      return String(valeur) === String(rule.valeur);
    });

    if (regle && Array.isArray(regle.choix) && regle.choix.length > 0) {
      return regle.choix;
    }

    return baseChoices;
  };

  const getEffectiveChoices = (typePanneau, question) => {
    return getEffectiveChoicesFromResponses(
      typePanneau,
      question,
      nouveauPanneau.reponses || {}
    );
  };

  const nettoyerReponsesDependantes = (
    typePanneau,
    questionId,
    prochaineValeur
  ) => {
    setNouveauPanneau((prev) => {
      const prochainesReponses = {
        ...prev.reponses,
        [getReponseKey(typePanneau, questionId)]: prochaineValeur,
      };

      const config =
        configsParFabricant?.[prev.fabricant]?.[typePanneau] || null;

      for (const cat of config?.categories || []) {
        for (const q of cat.questions || []) {
          const key = getReponseKey(typePanneau, q.id);

          const visible = isQuestionVisibleFromResponses(
            typePanneau,
            q,
            prochainesReponses
          );

          if (!visible) {
            delete prochainesReponses[key];
            continue;
          }

          if (q.type === "select" || q.type === "radio" || q.type === "yesno") {
            const choixPossibles = getEffectiveChoicesFromResponses(
              typePanneau,
              q,
              prochainesReponses
            );

            const valeurActuelle = prochainesReponses[key];

            if (
              valeurActuelle &&
              choixPossibles.length > 0 &&
              !choixPossibles.includes(valeurActuelle)
            ) {
              delete prochainesReponses[key];
            }
          }
        }
      }

      return {
        ...prev,
        reponses: prochainesReponses,
      };
    });
  };

  const handleReponseChange = (typePanneau, questionId, value) => {
    nettoyerReponsesDependantes(typePanneau, questionId, value);
  };

  const handleTypePanneauToggle = (type) => {
    setNouveauPanneau((prev) => {
      const dejaSelectionne = prev.typesPanneaux.includes(type);

      if (dejaSelectionne) {
        const nouvellesReponses = { ...prev.reponses };

        Object.keys(nouvellesReponses).forEach((key) => {
          if (key.startsWith(`${type}__`)) {
            delete nouvellesReponses[key];
          }
        });

        return {
          ...prev,
          typesPanneaux: prev.typesPanneaux.filter((t) => t !== type),
          reponses: nouvellesReponses,
        };
      }

      return {
        ...prev,
        typesPanneaux: [...prev.typesPanneaux, type],
      };
    });
  };

  const handleAjouterFabricant = async () => {
    const valeur = nouveauFabricant.trim();
    if (!valeur) return;

    const existe = optionsFabricants.some(
      (f) => normalizeText(f) === normalizeText(valeur)
    );

    if (existe) {
      alert("Ce fabricant existe déjà.");
      return;
    }

    const nextFabricants = [...optionsFabricants, valeur];

    const nextTypesParFabricant = {
      ...typesParFabricant,
      [valeur]: [],
    };

    const nextConfigsParFabricant = {
      ...configsParFabricant,
      [valeur]: {},
    };

    setOptionsFabricants(nextFabricants);
    setTypesParFabricant(nextTypesParFabricant);
    setConfigsParFabricant(nextConfigsParFabricant);
    setNouveauFabricant("");

    await sauvegarderConfiguration(
      nextFabricants,
      nextTypesParFabricant,
      nextConfigsParFabricant
    );
  };

  const handleModifierFabricant = async (ancienFabricant) => {
    const nouveauNom = window.prompt(
      "Modifier le nom du fabricant :",
      ancienFabricant
    );

    if (nouveauNom === null) return;

    const valeur = nouveauNom.trim();
    if (!valeur || valeur === ancienFabricant) return;

    const existe = optionsFabricants.some(
      (f) =>
        f !== ancienFabricant && normalizeText(f) === normalizeText(valeur)
    );

    if (existe) {
      alert("Ce fabricant existe déjà.");
      return;
    }

    const nextFabricants = optionsFabricants.map((f) =>
      f === ancienFabricant ? valeur : f
    );

    const nextTypesParFabricant = { ...typesParFabricant };
    nextTypesParFabricant[valeur] = nextTypesParFabricant[ancienFabricant] || [];
    delete nextTypesParFabricant[ancienFabricant];

    const nextConfigsParFabricant = { ...configsParFabricant };
    nextConfigsParFabricant[valeur] =
      nextConfigsParFabricant[ancienFabricant] || {};
    delete nextConfigsParFabricant[ancienFabricant];

    setOptionsFabricants(nextFabricants);
    setTypesParFabricant(nextTypesParFabricant);
    setConfigsParFabricant(nextConfigsParFabricant);

    setFabricantConfigSelectionne((prev) =>
      prev === ancienFabricant ? valeur : prev
    );

    setNouveauPanneau((prev) => ({
      ...prev,
      fabricant: prev.fabricant === ancienFabricant ? valeur : prev.fabricant,
    }));

    await sauvegarderConfiguration(
      nextFabricants,
      nextTypesParFabricant,
      nextConfigsParFabricant
    );
  };

  const handleSupprimerFabricant = async (fabricantASupprimer) => {
    if (optionsFabricants.length <= 1) {
      alert("Il doit rester au moins un fabricant.");
      return;
    }

    const confirmation = window.confirm(
      `Supprimer le fabricant "${fabricantASupprimer}" ?`
    );

    if (!confirmation) return;

    const nextFabricants = optionsFabricants.filter(
      (f) => f !== fabricantASupprimer
    );

    const nextTypesParFabricant = { ...typesParFabricant };
    delete nextTypesParFabricant[fabricantASupprimer];

    const nextConfigsParFabricant = { ...configsParFabricant };
    delete nextConfigsParFabricant[fabricantASupprimer];

    setOptionsFabricants(nextFabricants);
    setTypesParFabricant(nextTypesParFabricant);
    setConfigsParFabricant(nextConfigsParFabricant);

    setFabricantConfigSelectionne((prev) =>
      prev === fabricantASupprimer ? nextFabricants[0] || "" : prev
    );

    setTypeConfigSelectionne((prev) => {
      const newFabricant =
        fabricantConfigSelectionne === fabricantASupprimer
          ? nextFabricants[0] || ""
          : fabricantConfigSelectionne;

      const types = nextTypesParFabricant[newFabricant] || [];
      return types.includes(prev) ? prev : types[0] || "";
    });

    setNouveauPanneau((prev) => ({
      ...prev,
      fabricant:
        prev.fabricant === fabricantASupprimer
          ? nextFabricants[0] || ""
          : prev.fabricant,
      typesPanneaux:
        prev.fabricant === fabricantASupprimer ? [] : prev.typesPanneaux,
      reponses: prev.fabricant === fabricantASupprimer ? {} : prev.reponses,
    }));

    await sauvegarderConfiguration(
      nextFabricants,
      nextTypesParFabricant,
      nextConfigsParFabricant
    );
  };

  const handleFabricantConfigChange = (fabricant) => {
    const types = typesParFabricant[fabricant] || [];

    setFabricantConfigSelectionne(fabricant);
    setTypeConfigSelectionne(types[0] || "");
    resetQuestionForm();
  };

  const handleAjouterTypePanneau = async () => {
    const valeur = nouveauTypePanneau.trim();
    if (!valeur || !fabricantConfigSelectionne) return;

    const typesActuels = typesParFabricant[fabricantConfigSelectionne] || [];

    const existe = typesActuels.some(
      (type) => normalizeText(type) === normalizeText(valeur)
    );

    if (existe) {
      alert("Ce type de panneau existe déjà pour ce fabricant.");
      return;
    }

    const nextTypesParFabricant = {
      ...typesParFabricant,
      [fabricantConfigSelectionne]: [...typesActuels, valeur],
    };

    const nextConfigsParFabricant = {
      ...configsParFabricant,
      [fabricantConfigSelectionne]: {
        ...(configsParFabricant[fabricantConfigSelectionne] || {}),
        [valeur]: { categories: [] },
      },
    };

    setTypesParFabricant(nextTypesParFabricant);
    setConfigsParFabricant(nextConfigsParFabricant);
    setTypeConfigSelectionne(valeur);
    setNouveauTypePanneau("");

    await sauvegarderConfiguration(
      optionsFabricants,
      nextTypesParFabricant,
      nextConfigsParFabricant
    );
  };

  const handleModifierTypePanneau = async (ancienType) => {
    const nouveauNom = window.prompt("Modifier le type de panneau :", ancienType);
    if (nouveauNom === null) return;

    const valeur = nouveauNom.trim();
    if (!valeur || valeur === ancienType) return;

    const typesActuels = typesParFabricant[fabricantConfigSelectionne] || [];

    const existe = typesActuels.some(
      (type) => type !== ancienType && normalizeText(type) === normalizeText(valeur)
    );

    if (existe) {
      alert("Ce type existe déjà pour ce fabricant.");
      return;
    }

    const nextTypesParFabricant = {
      ...typesParFabricant,
      [fabricantConfigSelectionne]: typesActuels.map((type) =>
        type === ancienType ? valeur : type
      ),
    };

    const configsFabricant = configsParFabricant[fabricantConfigSelectionne] || {};
    const nextConfigsFabricant = { ...configsFabricant };
    nextConfigsFabricant[valeur] = nextConfigsFabricant[ancienType] || {
      categories: [],
    };
    delete nextConfigsFabricant[ancienType];

    const nextConfigsParFabricant = {
      ...configsParFabricant,
      [fabricantConfigSelectionne]: nextConfigsFabricant,
    };

    setTypesParFabricant(nextTypesParFabricant);
    setConfigsParFabricant(nextConfigsParFabricant);

    if (typeConfigSelectionne === ancienType) {
      setTypeConfigSelectionne(valeur);
    }

    setNouveauPanneau((prev) => {
      if (prev.fabricant !== fabricantConfigSelectionne) return prev;

      const nouvellesReponses = {};

      Object.entries(prev.reponses || {}).forEach(([key, valueReponse]) => {
        if (key.startsWith(`${ancienType}__`)) {
          nouvellesReponses[key.replace(`${ancienType}__`, `${valeur}__`)] =
            valueReponse;
        } else {
          nouvellesReponses[key] = valueReponse;
        }
      });

      return {
        ...prev,
        typesPanneaux: prev.typesPanneaux.map((type) =>
          type === ancienType ? valeur : type
        ),
        reponses: nouvellesReponses,
      };
    });

    await sauvegarderConfiguration(
      optionsFabricants,
      nextTypesParFabricant,
      nextConfigsParFabricant
    );
  };

  const handleSupprimerTypePanneau = async (typeASupprimer) => {
    const confirmation = window.confirm(
      `Supprimer le type "${typeASupprimer}" pour ${fabricantConfigSelectionne} ?`
    );

    if (!confirmation) return;

    const typesActuels = typesParFabricant[fabricantConfigSelectionne] || [];

    const nextTypes = typesActuels.filter((type) => type !== typeASupprimer);

    const nextTypesParFabricant = {
      ...typesParFabricant,
      [fabricantConfigSelectionne]: nextTypes,
    };

    const nextConfigsFabricant = {
      ...(configsParFabricant[fabricantConfigSelectionne] || {}),
    };
    delete nextConfigsFabricant[typeASupprimer];

    const nextConfigsParFabricant = {
      ...configsParFabricant,
      [fabricantConfigSelectionne]: nextConfigsFabricant,
    };

    setTypesParFabricant(nextTypesParFabricant);
    setConfigsParFabricant(nextConfigsParFabricant);

    if (typeConfigSelectionne === typeASupprimer) {
      setTypeConfigSelectionne(nextTypes[0] || "");
    }

    setNouveauPanneau((prev) => {
      if (prev.fabricant !== fabricantConfigSelectionne) return prev;

      const nouvellesReponses = { ...prev.reponses };

      Object.keys(nouvellesReponses).forEach((key) => {
        if (key.startsWith(`${typeASupprimer}__`)) {
          delete nouvellesReponses[key];
        }
      });

      return {
        ...prev,
        typesPanneaux: prev.typesPanneaux.filter(
          (type) => type !== typeASupprimer
        ),
        reponses: nouvellesReponses,
      };
    });

    await sauvegarderConfiguration(
      optionsFabricants,
      nextTypesParFabricant,
      nextConfigsParFabricant
    );
  };

  const handleAjouterCategorie = async () => {
    const titre = nouvelleCategorie.trim();
    if (!titre || !fabricantConfigSelectionne || !typeConfigSelectionne) return;

    const ancienneConfig = configSelectionnee || { categories: [] };

    const nextConfigsParFabricant = {
      ...configsParFabricant,
      [fabricantConfigSelectionne]: {
        ...(configsParFabricant[fabricantConfigSelectionne] || {}),
        [typeConfigSelectionne]: {
          ...ancienneConfig,
          categories: [
            ...(ancienneConfig.categories || []),
            {
              id: makeId(),
              titre,
              questions: [],
            },
          ],
        },
      },
    };

    setConfigsParFabricant(nextConfigsParFabricant);
    setNouvelleCategorie("");

    await sauvegarderConfiguration(
      optionsFabricants,
      typesParFabricant,
      nextConfigsParFabricant
    );
  };

  const handleModifierCategorie = async (categorieId) => {
    const categorie = (configSelectionnee.categories || []).find(
      (cat) => cat.id === categorieId
    );

    if (!categorie) return;

    const nouveauTitre = window.prompt(
      "Modifier le nom de la catégorie / question :",
      categorie.titre
    );

    if (nouveauTitre === null) return;

    const titre = nouveauTitre.trim();
    if (!titre) return;

    const nextConfigsParFabricant = {
      ...configsParFabricant,
      [fabricantConfigSelectionne]: {
        ...(configsParFabricant[fabricantConfigSelectionne] || {}),
        [typeConfigSelectionne]: {
          ...configSelectionnee,
          categories: (configSelectionnee.categories || []).map((cat) => {
            if (cat.id !== categorieId) return cat;

            return {
              ...cat,
              titre,
              questions: (cat.questions || []).map((q) => ({
                ...q,
                label: titre,
              })),
            };
          }),
        },
      },
    };

    setConfigsParFabricant(nextConfigsParFabricant);

    await sauvegarderConfiguration(
      optionsFabricants,
      typesParFabricant,
      nextConfigsParFabricant
    );
  };

  const handleDeplacerCategorie = async (categorieId, direction) => {
    const categories = [...(configSelectionnee.categories || [])];

    const index = categories.findIndex((cat) => cat.id === categorieId);
    if (index === -1) return;

    const nouvelIndex = direction === "haut" ? index - 1 : index + 1;
    if (nouvelIndex < 0 || nouvelIndex >= categories.length) return;

    const temp = categories[index];
    categories[index] = categories[nouvelIndex];
    categories[nouvelIndex] = temp;

    const nextConfigsParFabricant = {
      ...configsParFabricant,
      [fabricantConfigSelectionne]: {
        ...(configsParFabricant[fabricantConfigSelectionne] || {}),
        [typeConfigSelectionne]: {
          ...configSelectionnee,
          categories,
        },
      },
    };

    setConfigsParFabricant(nextConfigsParFabricant);

    await sauvegarderConfiguration(
      optionsFabricants,
      typesParFabricant,
      nextConfigsParFabricant
    );
  };

  const clonerCategoriePourAutreType = (categorie) => {
    const idMap = {};

    const questionsClonees = (categorie.questions || []).map((question) => {
      const nouveauQuestionId = makeId();
      idMap[question.id] = nouveauQuestionId;

      return {
        ...question,
        id: nouveauQuestionId,
      };
    });

    const questionsAvecConditionsCorrigees = questionsClonees.map((question) => {
      const condition = question.condition?.active
        ? {
            ...question.condition,
            questionId:
              idMap[question.condition.questionId] ||
              question.condition.questionId,
          }
        : question.condition;

      const choixConditionnels = Array.isArray(question.choixConditionnels)
        ? question.choixConditionnels.map((rule) => ({
            ...rule,
            questionId: idMap[rule.questionId] || rule.questionId,
          }))
        : [];

      return {
        ...question,
        condition,
        choixConditionnels,
      };
    });

    return {
      ...categorie,
      id: makeId(),
      titre: categorie.titre,
      questions: questionsAvecConditionsCorrigees,
    };
  };

  const handleCopierCategorieVersType = async (categorieId) => {
    const typeDestination = copieCategorieVersType[categorieId];

    if (!typeDestination) {
      alert("Veuillez choisir un type de panneau de destination.");
      return;
    }

    if (typeDestination === typeConfigSelectionne) {
      alert("Choisissez un autre type de panneau.");
      return;
    }

    const categorie = (configSelectionnee.categories || []).find(
      (cat) => cat.id === categorieId
    );

    if (!categorie) return;

    const configDestination =
      configsParFabricant?.[fabricantConfigSelectionne]?.[typeDestination] || {
        categories: [],
      };

    const categorieClonee = clonerCategoriePourAutreType(categorie);

    const nextConfigsParFabricant = {
      ...configsParFabricant,
      [fabricantConfigSelectionne]: {
        ...(configsParFabricant[fabricantConfigSelectionne] || {}),
        [typeDestination]: {
          ...configDestination,
          categories: [...(configDestination.categories || []), categorieClonee],
        },
      },
    };

    setConfigsParFabricant(nextConfigsParFabricant);

    setCopieCategorieVersType((prev) => ({
      ...prev,
      [categorieId]: "",
    }));

    await sauvegarderConfiguration(
      optionsFabricants,
      typesParFabricant,
      nextConfigsParFabricant
    );
  };

  const handleSupprimerCategorie = async (categorieId) => {
    const confirmation = window.confirm(
      "Supprimer cette catégorie et ses questions ?"
    );

    if (!confirmation) return;

    const nextConfigsParFabricant = {
      ...configsParFabricant,
      [fabricantConfigSelectionne]: {
        ...(configsParFabricant[fabricantConfigSelectionne] || {}),
        [typeConfigSelectionne]: {
          ...configSelectionnee,
          categories: (configSelectionnee.categories || []).filter(
            (cat) => cat.id !== categorieId
          ),
        },
      },
    };

    setConfigsParFabricant(nextConfigsParFabricant);

    if (questionEnEdition?.categorieId === categorieId) {
      resetQuestionForm();
    }

    await sauvegarderConfiguration(
      optionsFabricants,
      typesParFabricant,
      nextConfigsParFabricant
    );
  };

  const creerQuestionDepuisFormulaire = () => {
    if (!nouvelleQuestion.categorieId) {
      alert("Veuillez choisir une catégorie.");
      return null;
    }

    const categorieSelectionnee = (configSelectionnee.categories || []).find(
      (cat) => cat.id === nouvelleQuestion.categorieId
    );

    const label = categorieSelectionnee?.titre || "";

    const estSelectOuRadio =
      nouvelleQuestion.type === "select" || nouvelleQuestion.type === "radio";

    let choix = [];

    if (estSelectOuRadio && !nouvelleQuestion.choixConditionnelsActif) {
      choix = splitChoix(nouvelleQuestion.choixTexte);

      if (choix.length === 0) {
        alert("Veuillez ajouter au moins un choix par défaut.");
        return null;
      }
    }

    if (nouvelleQuestion.type === "yesno") {
      choix = ["Oui", "Non"];
    }

    if (
      nouvelleQuestion.conditionActive &&
      (!nouvelleQuestion.conditionQuestionId ||
        !nouvelleQuestion.conditionValeur)
    ) {
      alert("Pour une condition, choisis la question et la valeur attendue.");
      return null;
    }

    let choixConditionnels = [];

    if (questionEnEditionData?.choixConditionnels?.length > 0) {
      choixConditionnels = [...questionEnEditionData.choixConditionnels];
    }

    if (nouvelleQuestion.choixConditionnelsActif && estSelectOuRadio) {
      const choixDynamiques = splitChoix(nouvelleQuestion.choixConditionTexte);

      if (
        !nouvelleQuestion.choixConditionQuestionId ||
        !nouvelleQuestion.choixConditionValeur ||
        choixDynamiques.length === 0
      ) {
        alert("Veuillez choisir la question, la réponse et les choix à afficher.");
        return null;
      }

      choixConditionnels = choixConditionnels.filter(
        (rule) =>
          !(
            rule.questionId === nouvelleQuestion.choixConditionQuestionId &&
            String(rule.valeur) === String(nouvelleQuestion.choixConditionValeur)
          )
      );

      choixConditionnels.push({
        active: true,
        questionId: nouvelleQuestion.choixConditionQuestionId,
        valeur: nouvelleQuestion.choixConditionValeur,
        choix: choixDynamiques,
      });
    }

    if (estSelectOuRadio && nouvelleQuestion.choixConditionnelsActif) {
      choix = [];
    }

    if (!nouvelleQuestion.choixConditionnelsActif) {
      choixConditionnels = [];
    }

    return {
      id: questionEnEdition?.questionId || makeId(),
      label,
      type: nouvelleQuestion.type,
      obligatoire: nouvelleQuestion.obligatoire,
      choix,
      condition: {
        active: nouvelleQuestion.conditionActive,
        questionId: nouvelleQuestion.conditionQuestionId,
        valeur: nouvelleQuestion.conditionValeur,
      },
      choixConditionnels,
    };
  };

  const handleAjouterOuModifierQuestion = async () => {
    const question = creerQuestionDepuisFormulaire();
    if (!question) return;

    let nextCategories;

    if (questionEnEdition) {
      nextCategories = (configSelectionnee.categories || []).map((cat) => {
        if (cat.id !== questionEnEdition.categorieId) return cat;

        return {
          ...cat,
          questions: (cat.questions || []).map((q) =>
            q.id === questionEnEdition.questionId ? question : q
          ),
        };
      });
    } else {
      nextCategories = (configSelectionnee.categories || []).map((cat) => {
        if (cat.id !== nouvelleQuestion.categorieId) return cat;

        return {
          ...cat,
          questions: [...(cat.questions || []), question],
        };
      });
    }

    const nextConfigsParFabricant = {
      ...configsParFabricant,
      [fabricantConfigSelectionne]: {
        ...(configsParFabricant[fabricantConfigSelectionne] || {}),
        [typeConfigSelectionne]: {
          ...configSelectionnee,
          categories: nextCategories,
        },
      },
    };

    setConfigsParFabricant(nextConfigsParFabricant);
    resetQuestionForm(nouvelleQuestion.categorieId);

    await sauvegarderConfiguration(
      optionsFabricants,
      typesParFabricant,
      nextConfigsParFabricant
    );
  };

  const handleChargerQuestionPourModification = (categorieId, question) => {
    setQuestionEnEdition({
      categorieId,
      questionId: question.id,
    });

    const condition = question.condition || {};
    const choixConditionnel = Array.isArray(question.choixConditionnels)
      ? question.choixConditionnels[0]
      : null;

    setNouvelleQuestion({
      categorieId,
      type: question.type || "text",
      obligatoire: question.obligatoire !== false,
      choixTexte: Array.isArray(question.choix) ? question.choix.join(", ") : "",
      conditionActive: condition.active || false,
      conditionQuestionId: condition.questionId || "",
      conditionValeur: condition.valeur || "",
      choixConditionnelsActif:
        Array.isArray(question.choixConditionnels) &&
        question.choixConditionnels.length > 0,
      choixConditionQuestionId: choixConditionnel?.questionId || "",
      choixConditionValeur: choixConditionnel?.valeur || "",
      choixConditionTexte: Array.isArray(choixConditionnel?.choix)
        ? choixConditionnel.choix.join(", ")
        : "",
    });
  };

  const handleSupprimerQuestion = async (categorieId, questionId) => {
    const confirmation = window.confirm("Supprimer cette question ?");
    if (!confirmation) return;

    const nextCategories = (configSelectionnee.categories || []).map((cat) => {
      if (cat.id !== categorieId) return cat;

      return {
        ...cat,
        questions: (cat.questions || []).filter((q) => q.id !== questionId),
      };
    });

    const nextConfigsParFabricant = {
      ...configsParFabricant,
      [fabricantConfigSelectionne]: {
        ...(configsParFabricant[fabricantConfigSelectionne] || {}),
        [typeConfigSelectionne]: {
          ...configSelectionnee,
          categories: nextCategories,
        },
      },
    };

    setConfigsParFabricant(nextConfigsParFabricant);

    if (
      questionEnEdition?.categorieId === categorieId &&
      questionEnEdition?.questionId === questionId
    ) {
      resetQuestionForm(categorieId);
    }

    await sauvegarderConfiguration(
      optionsFabricants,
      typesParFabricant,
      nextConfigsParFabricant
    );
  };

  const getVisibleQuestions = () => {
    return questionsActives.filter((question) =>
      isQuestionVisible(question.typePanneau, question)
    );
  };

  const validerQuestionsObligatoires = () => {
    const questionsVisibles = getVisibleQuestions();

    for (const question of questionsVisibles) {
      if (!question.obligatoire) continue;

      const value = getReponseValue(question.typePanneau, question.id);

      if (!String(value || "").trim()) {
        alert(
          `Le champ "${question.label}" est obligatoire pour ${question.typePanneau}.`
        );
        return false;
      }
    }

    return true;
  };

  const handleEnregistrerSoumission = async (e) => {
    e.preventDefault();

    if (!nouveauPanneau.dateProjet) {
      alert("Veuillez choisir une date.");
      return;
    }

    if (!String(nouveauPanneau.nomProjet || "").trim()) {
      alert("Veuillez entrer le nom du projet.");
      return;
    }

    if (!String(nouveauPanneau.villeProjet || "").trim()) {
      alert("Veuillez entrer la ville du projet.");
      return;
    }

    if (!nouveauPanneau.fabricant) {
      alert("Veuillez choisir un fabricant.");
      return;
    }

    if (nouveauPanneau.typesPanneaux.length === 0) {
      alert("Veuillez sélectionner au moins un type de panneau.");
      return;
    }

    if (!validerQuestionsObligatoires()) return;

    try {
      if (panneauEnEditionId) {
        await updateDoc(getPanneauRef(panneauEnEditionId), {
          dateProjet: nouveauPanneau.dateProjet,
          nomProjet: nouveauPanneau.nomProjet.trim(),
          villeProjet: nouveauPanneau.villeProjet.trim(),
          fabricant: nouveauPanneau.fabricant,
          typesPanneaux: nouveauPanneau.typesPanneaux,
          reponses: nouveauPanneau.reponses,
          updatedAt: serverTimestamp(),
        });

        resetPanneauForm();
        setOngletActif("enregistrees");
        return;
      }

      await addDoc(getPanneauxCollectionRef(), {
        dateProjet: nouveauPanneau.dateProjet,
        nomProjet: nouveauPanneau.nomProjet.trim(),
        villeProjet: nouveauPanneau.villeProjet.trim(),
        fabricant: nouveauPanneau.fabricant,
        typesPanneaux: nouveauPanneau.typesPanneaux,
        reponses: nouveauPanneau.reponses,
        createdAt: serverTimestamp(),
      });

      resetPanneauForm();
      setOngletActif("enregistrees");
    } catch (error) {
      console.error("Erreur enregistrement soumission:", error);
      alert("Erreur lors de l’enregistrement de la soumission.");
    }
  };

  const handleModifierPanneau = (panneau) => {
    const fabricant = panneau.fabricant || optionsFabricants[0] || "";
    const typesDisponibles = typesParFabricant[fabricant] || [];

    setPanneauEnEditionId(panneau.id);

    setNouveauPanneau({
      dateProjet: panneau.dateProjet || getTodayInputDate(),
      nomProjet: panneau.nomProjet || "",
      villeProjet: panneau.villeProjet || "",
      fabricant,
      typesPanneaux: Array.isArray(panneau.typesPanneaux)
        ? panneau.typesPanneaux.filter((type) => typesDisponibles.includes(type))
        : [],
      reponses: panneau.reponses || {},
    });

    setOngletActif("formulaire");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSupprimerPanneau = async (id) => {
    const confirmation = window.confirm("Supprimer cette soumission ?");
    if (!confirmation) return;

    try {
      await deleteDoc(getPanneauRef(id));

      if (panneauEnEditionId === id) {
        resetPanneauForm();
      }
    } catch (error) {
      console.error("Erreur suppression soumission:", error);
      alert("Erreur lors de la suppression de la soumission.");
    }
  };

  const selectedConditionQuestion = questionsConfigurables.find(
    (q) => q.id === nouvelleQuestion.conditionQuestionId
  );

  const selectedChoixConditionQuestion = questionsConfigurables.find(
    (q) => q.id === nouvelleQuestion.choixConditionQuestionId
  );

  const choixConditionQuestion = getChoixQuestion(selectedConditionQuestion);
  const choixChoixConditionQuestion = getChoixQuestion(
    selectedChoixConditionQuestion
  );

  const handleChoixConditionQuestionChange = (questionId) => {
    setNouvelleQuestion((prev) => ({
      ...prev,
      choixConditionQuestionId: questionId,
      choixConditionValeur: "",
      choixConditionTexte: "",
    }));
  };

  const handleChoixConditionValeurChange = (valeur) => {
    const regleExistante = trouverRegleChoixConditionnels(
      questionEnEditionData,
      nouvelleQuestion.choixConditionQuestionId,
      valeur
    );

    setNouvelleQuestion((prev) => ({
      ...prev,
      choixConditionValeur: valeur,
      choixConditionTexte: Array.isArray(regleExistante?.choix)
        ? regleExistante.choix.join(", ")
        : "",
    }));
  };

  const supprimerChoixDuTexte = (champ, choixASupprimer, indexASupprimer) => {
    setNouvelleQuestion((prev) => {
      const choixActuels = splitChoix(prev[champ]);
      const prochainsChoix = choixActuels.filter(
        (choix, index) =>
          !(index === indexASupprimer && choix === choixASupprimer)
      );

      return {
        ...prev,
        [champ]: prochainsChoix.join(", "),
      };
    });
  };

  const renderChoixSupprimables = (
    champ,
    titreVide = "Aucun choix pour l’instant."
  ) => {
    const choix = splitChoix(nouvelleQuestion[champ]);

    if (choix.length === 0) {
      return <div className="soumission-choice-empty">{titreVide}</div>;
    }

    return (
      <div className="soumission-choice-chip-list">
        {choix.map((choixTexte, index) => (
          <span
            key={`${champ}-${choixTexte}-${index}`}
            className="soumission-choice-chip"
          >
            <span>{choixTexte}</span>

            <button
              type="button"
              className="soumission-choice-chip-delete"
              onClick={() => supprimerChoixDuTexte(champ, choixTexte, index)}
              title={`Supprimer ${choixTexte}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    );
  };

  const renderQuestion = (question) => {
    const value = getReponseValue(question.typePanneau, question.id);

    if (question.type === "select") {
      const choixAffiches = getEffectiveChoices(question.typePanneau, question);

      return (
        <select
          value={value}
          onChange={(e) =>
            handleReponseChange(
              question.typePanneau,
              question.id,
              e.target.value
            )
          }
        >
          <option value="">Sélectionnez...</option>
          {choixAffiches.map((choix, index) => (
            <option key={`${choix}-${index}`} value={choix}>
              {choix}
            </option>
          ))}
        </select>
      );
    }

    if (question.type === "radio" || question.type === "yesno") {
      const choixAffiches = getEffectiveChoices(question.typePanneau, question);

      return (
        <div className="soumission-radio-list">
          {choixAffiches.map((choix, index) => (
            <label
              key={`${question.id}-${choix}-${index}`}
              className="soumission-radio-label"
            >
              <input
                type="radio"
                name={`${question.typePanneau}-${question.id}`}
                checked={value === choix}
                onChange={() =>
                  handleReponseChange(question.typePanneau, question.id, choix)
                }
              />
              <span>{choix}</span>
            </label>
          ))}
        </div>
      );
    }

    return (
      <input
        type={question.type === "number" ? "number" : "text"}
        value={value}
        onChange={(e) =>
          handleReponseChange(question.typePanneau, question.id, e.target.value)
        }
      />
    );
  };

  const renderChampsDynamiques = () => {
    if (nouveauPanneau.typesPanneaux.length === 0) return null;

    return (
      <div className="soumission-dynamic-zone">
        {nouveauPanneau.typesPanneaux.map((type) => {
          const config =
            configsParFabricant?.[nouveauPanneau.fabricant]?.[type] || null;

          if (!config?.categories?.length) {
            return (
              <div key={type} className="soumission-type-block">
                <div className="soumission-type-header">
                  {nouveauPanneau.fabricant} — {type}
                </div>
                <div className="soumission-category-block">
                  Aucune question configurée pour ce type de panneau.
                </div>
              </div>
            );
          }

          return (
            <div key={type} className="soumission-type-block">
              <div className="soumission-type-header">
                {nouveauPanneau.fabricant} — {type}
              </div>

              {(config.categories || []).map((categorie) => {
                const questionsVisibles = (categorie.questions || []).filter(
                  (question) => isQuestionVisible(type, question)
                );

                if (questionsVisibles.length === 0) return null;

                return (
                  <div key={categorie.id} className="soumission-category-block">
                    <div className="soumission-fields-grid">
                      {questionsVisibles.map((question) => (
                        <label
                          key={question.id}
                          className="soumission-dynamic-field"
                        >
                          <span className="soumission-dynamic-field-label">
                            {question.label}
                            {question.obligatoire && (
                              <span className="soumission-required"> *</span>
                            )}
                          </span>

                          {renderQuestion({
                            ...question,
                            typePanneau: type,
                          })}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  const renderFormulaireSoumission = () => {
    return (
      <section className="soumission-card">
        <div className="soumission-card-top">
          <div>
            <div className="soumission-card-title">Nouvelle soumission</div>
            <div className="soumission-card-subtitle">
              Le fabricant choisi contrôle les types de panneaux disponibles.
            </div>
          </div>

          <button
            type="button"
            className={modeConfiguration ? "delete-btn" : "btn-secondary"}
            onClick={() => setModeConfiguration((prev) => !prev)}
          >
            {modeConfiguration
              ? "Fermer configuration"
              : "Configurer les options"}
          </button>
        </div>

        {(chargementConfig || chargementPanneaux) && (
          <div className="soumission-loading">
            Chargement des données Firestore...
          </div>
        )}

        {panneauEnEditionId && (
          <div className="soumission-editing-banner">
            Modification d’une soumission en cours.
          </div>
        )}

        <form onSubmit={handleEnregistrerSoumission} className="soumission-form">
          <div className="soumission-section soumission-project-section">
            <h3>Informations du projet</h3>

            <div className="soumission-project-grid">
              <label className="soumission-field">
                Date
                <input
                  type="date"
                  name="dateProjet"
                  value={nouveauPanneau.dateProjet}
                  onChange={handleChange}
                />
              </label>

              <label className="soumission-field">
                Nom du projet
                <input
                  type="text"
                  name="nomProjet"
                  value={nouveauPanneau.nomProjet}
                  onChange={handleChange}
                  placeholder="Ex: Projet usine Laval"
                />
              </label>

              <label className="soumission-field">
                Ville du projet
                <input
                  type="text"
                  name="villeProjet"
                  value={nouveauPanneau.villeProjet}
                  onChange={handleChange}
                  placeholder="Ex: Québec"
                />
              </label>
            </div>
          </div>

          <div className="soumission-section">
            <h3>Fabricant</h3>

            <label className="soumission-field">
              Choisir le fabricant
              <select
                name="fabricant"
                value={nouveauPanneau.fabricant}
                onChange={handleChange}
              >
                {optionsFabricants.map((fabricant, index) => (
                  <option key={`${fabricant}-${index}`} value={fabricant}>
                    {fabricant}
                  </option>
                ))}
              </select>
            </label>

            {modeConfiguration && (
              <div className="soumission-config-box vertical">
                <div className="soumission-config-inline">
                  <input
                    type="text"
                    value={nouveauFabricant}
                    onChange={(e) => setNouveauFabricant(e.target.value)}
                    placeholder="Ajouter un fabricant"
                  />

                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleAjouterFabricant}
                  >
                    Ajouter fabricant
                  </button>
                </div>

                <div className="soumission-config-list">
                  {optionsFabricants.map((fabricant, index) => (
                    <div
                      key={`${fabricant}-${index}`}
                      className="soumission-config-list-row"
                    >
                      <strong>{fabricant}</strong>

                      <div className="soumission-config-row-actions">
                        <button
                          type="button"
                          className="btn-secondary soumission-option-delete"
                          onClick={() => handleModifierFabricant(fabricant)}
                        >
                          Modifier
                        </button>

                        <button
                          type="button"
                          className="delete-btn soumission-option-delete"
                          onClick={() => handleSupprimerFabricant(fabricant)}
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="soumission-section">
            <h3>Types de panneaux — {nouveauPanneau.fabricant || "Aucun fabricant"}</h3>

            <div className="soumission-question-title">
              Sélectionner le ou les types de panneaux demandés{" "}
              <span className="soumission-required">*</span>
            </div>

            {typesDuFabricantFormulaire.length === 0 ? (
              <div className="soumission-empty-box">
                Aucun type de panneau configuré pour ce fabricant. Ouvre
                “Configurer les options” pour en ajouter.
              </div>
            ) : (
              <div className="soumission-options-list">
                {typesDuFabricantFormulaire.map((type, index) => (
                  <div
                    key={`${type}-${index}`}
                    className="soumission-option-line"
                  >
                    <label className="soumission-checkbox-label">
                      <input
                        type="checkbox"
                        checked={nouveauPanneau.typesPanneaux.includes(type)}
                        onChange={() => handleTypePanneauToggle(type)}
                      />

                      <span>{type}</span>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {modeConfiguration && (
            <div className="soumission-config-panel">
              <h2 className="soumission-config-title">
                Configuration par fabricant
              </h2>

              <p className="soumission-config-subtitle">
                Chaque fabricant a ses propres types de panneaux et ses propres
                questions.
              </p>

              <div className="soumission-config-step">
                <div className="soumission-config-step-header">
                  <div className="soumission-config-step-title-wrap">
                    <span className="soumission-config-step-number">1</span>
                    <div>
                      <h3 className="soumission-config-step-title">
                        Choisir le fabricant à configurer
                      </h3>
                      <p className="soumission-config-step-help">
                        Les types et questions ajoutés seront liés à ce
                        fabricant seulement.
                      </p>
                    </div>
                  </div>

                  <span className="soumission-current-type-badge">
                    {fabricantConfigSelectionne || "Aucun fabricant"}
                  </span>
                </div>

                <div className="soumission-config-grid">
                  <label className="soumission-config-field">
                    Fabricant
                    <select
                      value={fabricantConfigSelectionne}
                      onChange={(e) => handleFabricantConfigChange(e.target.value)}
                    >
                      {optionsFabricants.map((fabricant, index) => (
                        <option key={`${fabricant}-${index}`} value={fabricant}>
                          {fabricant}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="soumission-config-step">
                <div className="soumission-config-step-header">
                  <div className="soumission-config-step-title-wrap">
                    <span className="soumission-config-step-number">2</span>
                    <div>
                      <h3 className="soumission-config-step-title">
                        Types de panneaux de {fabricantConfigSelectionne}
                      </h3>
                      <p className="soumission-config-step-help">
                        Ici, tu ajoutes les types propres à ce fabricant.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="soumission-config-box">
                  <input
                    type="text"
                    value={nouveauTypePanneau}
                    onChange={(e) => setNouveauTypePanneau(e.target.value)}
                    placeholder={`Ajouter un type pour ${fabricantConfigSelectionne}`}
                  />

                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleAjouterTypePanneau}
                  >
                    Ajouter type
                  </button>
                </div>

                <div className="soumission-options-list">
                  {typesDuFabricantConfig.length === 0 ? (
                    <div className="soumission-empty-box">
                      Aucun type configuré pour ce fabricant.
                    </div>
                  ) : (
                    typesDuFabricantConfig.map((type, index) => (
                      <div
                        key={`${type}-${index}`}
                        className="soumission-option-line"
                      >
                        <label className="soumission-radio-like-label">
                          <input
                            type="radio"
                            name="type-config"
                            checked={typeConfigSelectionne === type}
                            onChange={() => {
                              setTypeConfigSelectionne(type);
                              resetQuestionForm();
                            }}
                          />

                          <span>{type}</span>
                        </label>

                        <div className="soumission-option-actions">
                          <button
                            type="button"
                            className="btn-secondary soumission-option-delete"
                            onClick={() => handleModifierTypePanneau(type)}
                          >
                            Modifier
                          </button>

                          <button
                            type="button"
                            className="delete-btn soumission-option-delete"
                            onClick={() => handleSupprimerTypePanneau(type)}
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {typeConfigSelectionne ? (
                <>
                  <div className="soumission-config-step">
                    <div className="soumission-config-step-header">
                      <div className="soumission-config-step-title-wrap">
                        <span className="soumission-config-step-number">3</span>
                        <div>
                          <h3 className="soumission-config-step-title">
                            Catégories / questions pour {typeConfigSelectionne}
                          </h3>
                          <p className="soumission-config-step-help">
                            Exemple : Largeur, Épaisseur, Couleur extérieure.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="soumission-config-grid">
                      <label className="soumission-config-field">
                        Nouvelle catégorie / question
                        <input
                          type="text"
                          value={nouvelleCategorie}
                          onChange={(e) => setNouvelleCategorie(e.target.value)}
                          placeholder="Ex: Largeur, Épaisseur, Couleur extérieure"
                        />
                      </label>

                      <div className="soumission-config-field">
                        <span>&nbsp;</span>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={handleAjouterCategorie}
                        >
                          Ajouter catégorie
                        </button>
                      </div>
                    </div>

                    {(configSelectionnee.categories || []).length > 0 && (
                      <div className="soumission-category-mini-list">
                        {(configSelectionnee.categories || []).map((cat, index) => (
                          <span
                            key={`${cat.id}-${index}`}
                            className="soumission-category-mini-chip"
                          >
                            {index + 1}. {cat.titre}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="soumission-config-step">
                    <div className="soumission-config-step-header">
                      <div className="soumission-config-step-title-wrap">
                        <span className="soumission-config-step-number">4</span>
                        <div>
                          <h3 className="soumission-config-step-title">
                            Ajouter ou modifier une question
                          </h3>
                          <p className="soumission-config-step-help">
                            Choisis la catégorie, le type de réponse, puis les choix.
                          </p>
                        </div>
                      </div>
                    </div>

                    {questionEnEdition && (
                      <div className="soumission-editing-banner">
                        Tu modifies une question existante.
                      </div>
                    )}

                    {(configSelectionnee.categories || []).length === 0 ? (
                      <div className="soumission-config-help-box">
                        Ajoute d’abord une catégorie.
                      </div>
                    ) : (
                      <>
                        <div className="soumission-config-grid">
                          <label className="soumission-config-field">
                            Question à configurer
                            <select
                              value={nouvelleQuestion.categorieId}
                              disabled={!!questionEnEdition}
                              onChange={(e) =>
                                setNouvelleQuestion((prev) => ({
                                  ...prev,
                                  categorieId: e.target.value,
                                }))
                              }
                            >
                              <option value="">Sélectionnez...</option>
                              {(configSelectionnee.categories || []).map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.titre}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="soumission-config-field">
                            Type de réponse
                            <select
                              value={nouvelleQuestion.type}
                              onChange={(e) =>
                                setNouvelleQuestion((prev) => ({
                                  ...prev,
                                  type: e.target.value,
                                  choixConditionnelsActif:
                                    e.target.value === "select" ||
                                    e.target.value === "radio"
                                      ? prev.choixConditionnelsActif
                                      : false,
                                  choixTexte:
                                    e.target.value === "select" ||
                                    e.target.value === "radio"
                                      ? prev.choixTexte
                                      : "",
                                }))
                              }
                            >
                              {TYPES_REPONSES.map((type) => (
                                <option key={type.value} value={type.value}>
                                  {type.label}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="soumission-config-field soumission-config-checkbox">
                            <input
                              type="checkbox"
                              checked={nouvelleQuestion.obligatoire}
                              onChange={(e) =>
                                setNouvelleQuestion((prev) => ({
                                  ...prev,
                                  obligatoire: e.target.checked,
                                }))
                              }
                            />
                            Champ obligatoire
                          </label>
                        </div>

                        {(nouvelleQuestion.type === "select" ||
                          nouvelleQuestion.type === "radio") &&
                          !nouvelleQuestion.choixConditionnelsActif && (
                            <div className="soumission-config-grid">
                              <label className="soumission-config-field">
                                Choix par défaut
                                <textarea
                                  value={nouvelleQuestion.choixTexte}
                                  onChange={(e) =>
                                    setNouvelleQuestion((prev) => ({
                                      ...prev,
                                      choixTexte: e.target.value,
                                    }))
                                  }
                                  placeholder={`Sépare les choix par des virgules. Exemple: 36", 42"`}
                                />

                                {renderChoixSupprimables(
                                  "choixTexte",
                                  "Aucun choix par défaut."
                                )}
                              </label>
                            </div>
                          )}

                        <div className="soumission-config-grid">
                          <label className="soumission-config-field soumission-config-checkbox">
                            <input
                              type="checkbox"
                              checked={nouvelleQuestion.conditionActive}
                              onChange={(e) =>
                                setNouvelleQuestion((prev) => ({
                                  ...prev,
                                  conditionActive: e.target.checked,
                                  conditionQuestionId: e.target.checked
                                    ? prev.conditionQuestionId
                                    : "",
                                  conditionValeur: e.target.checked
                                    ? prev.conditionValeur
                                    : "",
                                }))
                              }
                            />
                            Afficher cette question seulement selon une réponse
                            précédente
                          </label>

                          {nouvelleQuestion.conditionActive && (
                            <>
                              <label className="soumission-config-field">
                                Dépend de la question
                                <select
                                  value={nouvelleQuestion.conditionQuestionId}
                                  onChange={(e) =>
                                    setNouvelleQuestion((prev) => ({
                                      ...prev,
                                      conditionQuestionId: e.target.value,
                                      conditionValeur: "",
                                    }))
                                  }
                                >
                                  <option value="">Sélectionnez...</option>
                                  {questionsConfigurables
                                    .filter(
                                      (q) => q.id !== questionEnEdition?.questionId
                                    )
                                    .map((q) => (
                                      <option key={q.id} value={q.id}>
                                        {q.categorieTitre} — {q.label}
                                      </option>
                                    ))}
                                </select>
                              </label>

                              <label className="soumission-config-field">
                                Afficher si la réponse est
                                {choixConditionQuestion.length > 0 ? (
                                  <select
                                    value={nouvelleQuestion.conditionValeur}
                                    onChange={(e) =>
                                      setNouvelleQuestion((prev) => ({
                                        ...prev,
                                        conditionValeur: e.target.value,
                                      }))
                                    }
                                  >
                                    <option value="">Sélectionnez...</option>
                                    {choixConditionQuestion.map((choix, index) => (
                                      <option
                                        key={`${choix}-${index}`}
                                        value={choix}
                                      >
                                        {choix}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    value={nouvelleQuestion.conditionValeur}
                                    onChange={(e) =>
                                      setNouvelleQuestion((prev) => ({
                                        ...prev,
                                        conditionValeur: e.target.value,
                                      }))
                                    }
                                    placeholder="Écrire la réponse exacte"
                                  />
                                )}
                              </label>
                            </>
                          )}
                        </div>

                        {(nouvelleQuestion.type === "select" ||
                          nouvelleQuestion.type === "radio") && (
                          <div className="soumission-config-grid">
                            <label className="soumission-config-field soumission-config-checkbox">
                              <input
                                type="checkbox"
                                checked={nouvelleQuestion.choixConditionnelsActif}
                                onChange={(e) =>
                                  setNouvelleQuestion((prev) => ({
                                    ...prev,
                                    choixConditionnelsActif: e.target.checked,
                                    choixTexte: e.target.checked
                                      ? ""
                                      : prev.choixTexte,
                                    choixConditionQuestionId: e.target.checked
                                      ? prev.choixConditionQuestionId
                                      : "",
                                    choixConditionValeur: e.target.checked
                                      ? prev.choixConditionValeur
                                      : "",
                                    choixConditionTexte: e.target.checked
                                      ? prev.choixConditionTexte
                                      : "",
                                  }))
                                }
                              />
                              Changer les choix selon une réponse précédente
                            </label>

                            {nouvelleQuestion.choixConditionnelsActif && (
                              <>
                                <label className="soumission-config-field">
                                  Les choix changent selon
                                  <select
                                    value={
                                      nouvelleQuestion.choixConditionQuestionId
                                    }
                                    onChange={(e) =>
                                      handleChoixConditionQuestionChange(
                                        e.target.value
                                      )
                                    }
                                  >
                                    <option value="">Sélectionnez...</option>
                                    {questionsConfigurables
                                      .filter(
                                        (q) =>
                                          q.id !== questionEnEdition?.questionId
                                      )
                                      .map((q) => (
                                        <option key={q.id} value={q.id}>
                                          {q.categorieTitre} — {q.label}
                                        </option>
                                      ))}
                                  </select>
                                </label>

                                <label className="soumission-config-field">
                                  Si la réponse est
                                  {choixChoixConditionQuestion.length > 0 ? (
                                    <select
                                      value={
                                        nouvelleQuestion.choixConditionValeur
                                      }
                                      onChange={(e) =>
                                        handleChoixConditionValeurChange(
                                          e.target.value
                                        )
                                      }
                                    >
                                      <option value="">Sélectionnez...</option>
                                      {choixChoixConditionQuestion.map(
                                        (choix, index) => (
                                          <option
                                            key={`${choix}-${index}`}
                                            value={choix}
                                          >
                                            {choix}
                                          </option>
                                        )
                                      )}
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      value={
                                        nouvelleQuestion.choixConditionValeur
                                      }
                                      onChange={(e) =>
                                        handleChoixConditionValeurChange(
                                          e.target.value
                                        )
                                      }
                                      placeholder="Écrire la réponse exacte"
                                    />
                                  )}
                                </label>

                                <label className="soumission-config-field">
                                  Alors afficher ces choix
                                  <textarea
                                    value={nouvelleQuestion.choixConditionTexte}
                                    onChange={(e) =>
                                      setNouvelleQuestion((prev) => ({
                                        ...prev,
                                        choixConditionTexte: e.target.value,
                                      }))
                                    }
                                    placeholder={`Ex: 3", 4", 5", 6"`}
                                  />

                                  {renderChoixSupprimables(
                                    "choixConditionTexte",
                                    "Aucun choix conditionnel."
                                  )}
                                </label>
                              </>
                            )}
                          </div>
                        )}

                        <div className="soumission-config-actions">
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={handleAjouterOuModifierQuestion}
                          >
                            {questionEnEdition
                              ? "Enregistrer modification"
                              : "Ajouter question"}
                          </button>

                          {questionEnEdition && (
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() =>
                                resetQuestionForm(nouvelleQuestion.categorieId)
                              }
                            >
                              Annuler modification
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="soumission-config-step">
                    <div className="soumission-config-step-header">
                      <div className="soumission-config-step-title-wrap">
                        <span className="soumission-config-step-number">5</span>
                        <div>
                          <h3 className="soumission-config-step-title">
                            Aperçu — {fabricantConfigSelectionne} /{" "}
                            {typeConfigSelectionne}
                          </h3>
                          <p className="soumission-config-step-help">
                            Modifier l’ordre, copier ou supprimer des catégories.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="soumission-config-preview">
                      {(configSelectionnee.categories || []).length === 0 ? (
                        <p>Aucune catégorie configurée pour ce type.</p>
                      ) : (
                        (configSelectionnee.categories || []).map((cat, index) => (
                          <div key={cat.id} className="soumission-config-category">
                            <div className="soumission-config-category-top">
                              <div className="soumission-config-category-title">
                                {index + 1}. {cat.titre}
                              </div>

                              <div className="soumission-config-category-actions">
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={() =>
                                    handleDeplacerCategorie(cat.id, "haut")
                                  }
                                  disabled={index === 0}
                                >
                                  Monter
                                </button>

                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={() =>
                                    handleDeplacerCategorie(cat.id, "bas")
                                  }
                                  disabled={
                                    index ===
                                    (configSelectionnee.categories || []).length - 1
                                  }
                                >
                                  Descendre
                                </button>

                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={() => handleModifierCategorie(cat.id)}
                                >
                                  Modifier catégorie
                                </button>

                                <button
                                  type="button"
                                  className="delete-btn"
                                  onClick={() => handleSupprimerCategorie(cat.id)}
                                >
                                  Supprimer catégorie
                                </button>
                              </div>
                            </div>

                            <div className="soumission-copy-row">
                              <select
                                className="soumission-copy-select"
                                value={copieCategorieVersType[cat.id] || ""}
                                onChange={(e) =>
                                  setCopieCategorieVersType((prev) => ({
                                    ...prev,
                                    [cat.id]: e.target.value,
                                  }))
                                }
                              >
                                <option value="">
                                  Copier vers un autre type du même fabricant...
                                </option>

                                {typesDuFabricantConfig
                                  .filter((type) => type !== typeConfigSelectionne)
                                  .map((type, i) => (
                                    <option key={`${type}-${i}`} value={type}>
                                      {type}
                                    </option>
                                  ))}
                              </select>

                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() =>
                                  handleCopierCategorieVersType(cat.id)
                                }
                              >
                                Copier cette catégorie
                              </button>
                            </div>

                            {(cat.questions || []).length === 0 ? (
                              <p>Aucune question dans cette catégorie.</p>
                            ) : (
                              (cat.questions || []).map((q) => {
                                const isEditing =
                                  questionEnEdition?.categorieId === cat.id &&
                                  questionEnEdition?.questionId === q.id;

                                return (
                                  <div
                                    key={q.id}
                                    className={`soumission-config-question-line ${
                                      isEditing ? "is-editing" : ""
                                    }`}
                                  >
                                    <div className="soumission-config-question-info">
                                      <strong>
                                        {q.label}{" "}
                                        {q.obligatoire && (
                                          <span className="soumission-required">
                                            *
                                          </span>
                                        )}
                                      </strong>

                                      <span>
                                        Type: {q.type}
                                        {q.choix?.length > 0
                                          ? ` — Choix par défaut: ${q.choix.join(
                                              ", "
                                            )}`
                                          : ""}
                                      </span>

                                      {q.condition?.active && (
                                        <span className="soumission-condition-note">
                                          Visible si{" "}
                                          {getQuestionLabel(
                                            fabricantConfigSelectionne,
                                            typeConfigSelectionne,
                                            q.condition.questionId
                                          )}{" "}
                                          = {q.condition.valeur}
                                        </span>
                                      )}

                                      {q.choixConditionnels?.length > 0 &&
                                        q.choixConditionnels.map(
                                          (rule, ruleIndex) => (
                                            <span
                                              key={`${rule.questionId}-${rule.valeur}-${ruleIndex}`}
                                              className="soumission-condition-note"
                                            >
                                              Choix si{" "}
                                              {getQuestionLabel(
                                                fabricantConfigSelectionne,
                                                typeConfigSelectionne,
                                                rule.questionId
                                              )}{" "}
                                              = {rule.valeur} →{" "}
                                              {Array.isArray(rule.choix)
                                                ? rule.choix.join(", ")
                                                : ""}
                                            </span>
                                          )
                                        )}
                                    </div>

                                    <div className="soumission-config-question-actions">
                                      <button
                                        type="button"
                                        className="btn-secondary"
                                        onClick={() =>
                                          handleChargerQuestionPourModification(
                                            cat.id,
                                            q
                                          )
                                        }
                                      >
                                        Modifier
                                      </button>

                                      <button
                                        type="button"
                                        className="delete-btn"
                                        onClick={() =>
                                          handleSupprimerQuestion(cat.id, q.id)
                                        }
                                      >
                                        Supprimer
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="soumission-config-help-box">
                  Ajoute ou sélectionne un type de panneau pour configurer les
                  questions.
                </div>
              )}
            </div>
          )}

          {renderChampsDynamiques()}

          <div className="soumission-actions">
            {panneauEnEditionId && (
              <button
                type="button"
                className="btn-secondary"
                onClick={resetPanneauForm}
              >
                Annuler modification
              </button>
            )}

            <button type="submit" className="btn-primary soumission-save-btn">
              {panneauEnEditionId
                ? "Enregistrer les modifications"
                : "Enregistrer la soumission"}
            </button>
          </div>
        </form>
      </section>
    );
  };

  const renderSoumissionsEnregistrees = () => {
    return (
      <section className="soumission-card">
        <div className="soumission-card-top">
          <div>
            <div className="soumission-card-title">
              Soumissions enregistrées
            </div>
            <div className="soumission-card-subtitle">
              Toutes les soumissions sauvegardées apparaissent ici.
            </div>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              resetPanneauForm();
              setOngletActif("formulaire");
            }}
          >
            Nouvelle soumission
          </button>
        </div>

        <main className="soumission-list">
          {panneaux.length === 0 ? (
            <p>Aucune soumission enregistrée pour l’instant.</p>
          ) : (
            <ul>
              {panneaux.map((p) => (
                <li
                  key={p.id}
                  className={`soumission-item ${
                    panneauEnEditionId === p.id ? "is-editing" : ""
                  }`}
                >
                  <div className="soumission-item-row">
                    <div className="soumission-item-main">
                      <div className="soumission-item-header">
                        <span className="soumission-item-title">
                          {p.nomProjet || "Projet sans nom"}
                        </span>

                        <span className="soumission-item-info">
                          {formatDateFr(p.dateProjet)}
                        </span>

                        {p.villeProjet && (
                          <span className="soumission-item-info">
                            Ville: <strong>{p.villeProjet}</strong>
                          </span>
                        )}
                      </div>

                      <div className="soumission-item-info">
                        Fabricant:{" "}
                        <strong>{p.fabricant || "Non spécifié"}</strong>
                      </div>

                      {p.typesPanneaux?.length > 0 && (
                        <div className="soumission-item-info">
                          Types: <strong>{p.typesPanneaux.join(", ")}</strong>
                        </div>
                      )}

                      {Object.keys(p.reponses || {}).length > 0 && (
                        <div className="soumission-item-reponses">
                          {Object.entries(p.reponses).map(([key, value]) => {
                            const [typePanneau, questionId] = key.split("__");
                            const label = getQuestionLabel(
                              p.fabricant,
                              typePanneau,
                              questionId
                            );

                            return (
                              <div key={key}>
                                <strong>{typePanneau}</strong> — {label}:{" "}
                                <strong>{value}</strong>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="soumission-item-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => handleModifierPanneau(p)}
                      >
                        Modifier
                      </button>

                      <button
                        type="button"
                        className="delete-btn"
                        onClick={() => handleSupprimerPanneau(p.id)}
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </main>
      </section>
    );
  };

  return (
    <div className="app-root soumission-panneaux-page">
      <style>
        {`
          .soumission-panneaux-page {
            width: 85%;
            max-width: 1800px;
            margin: 0 auto;
          }

          .soumission-panneaux-header {
            display: flex;
            justify-content: center;
            align-items: center;
            margin-bottom: 18px;
          }

          .soumission-panneaux-title {
            flex: 1;
            font-size: 32px;
            font-weight: 800;
            text-align: center;
            letter-spacing: 0.05em;
            margin: 0;
            color: #111827;
          }

          .soumission-tabs {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
            margin-bottom: 20px;
          }

          .soumission-tab-btn {
            border: 1px solid #cbd5e1;
            background: #f8fafc;
            color: #334155;
            border-radius: 999px;
            padding: 10px 18px;
            font-size: 14px;
            font-weight: 800;
            cursor: pointer;
          }

          .soumission-tab-btn.active {
            background: #0f172a;
            color: white;
            border-color: #0f172a;
          }

          .soumission-card {
            background: #ffffff;
            border-radius: 16px;
            padding: 20px 24px;
            border: 1px solid #e5e7eb;
            box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
            margin-bottom: 20px;
          }

          .soumission-card-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            margin-bottom: 18px;
          }

          .soumission-card-title {
            font-weight: 700;
            font-size: 26px;
            color: #111827;
            margin: 0;
          }

          .soumission-card-subtitle {
            color: #64748b;
            font-size: 14px;
            margin-top: 4px;
          }

          .soumission-loading,
          .soumission-editing-banner {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            color: #92400e;
            border-radius: 10px;
            padding: 10px 12px;
            font-weight: 700;
            margin-bottom: 14px;
          }

          .soumission-editing-banner {
            background: #dbeafe;
            border-color: #3b82f6;
            color: #1e40af;
          }

          .soumission-form {
            display: flex;
            flex-direction: column;
            gap: 24px;
          }

          .soumission-section {
            background: #f9fafb;
            border-radius: 8px;
            padding: 12px 14px;
            border: 1px solid #e5e7eb;
          }

          .soumission-project-section {
            border-color: #bfdbfe;
            background: #eff6ff;
          }

          .soumission-section h3 {
            font-size: 16px;
            margin: 0 0 10px 0;
            color: #111827;
          }

          .soumission-project-grid {
            display: grid;
            grid-template-columns: 180px 1fr 1fr;
            gap: 12px;
          }

          .soumission-field {
            display: flex;
            flex-direction: column;
            gap: 4px;
            font-size: 13px;
            color: #374151;
            margin-bottom: 12px;
            font-weight: 700;
          }

          .soumission-field select,
          .soumission-field input[type="text"],
          .soumission-field input[type="number"],
          .soumission-field input[type="date"],
          .soumission-dynamic-field select,
          .soumission-dynamic-field input[type="text"],
          .soumission-dynamic-field input[type="number"],
          .soumission-config-box input,
          .soumission-config-box select,
          .soumission-config-field input,
          .soumission-config-field select,
          .soumission-config-field textarea,
          .soumission-copy-select {
            width: 100%;
            border-radius: 6px;
            border: 1px solid #d1d5db;
            padding: 7px 9px;
            font-size: 13px;
            background: white;
          }

          .soumission-question-title {
            font-weight: 700;
            font-size: 14px;
            margin-top: 8px;
            margin-bottom: 10px;
            color: #111827;
          }

          .soumission-required {
            color: #dc2626;
          }

          .soumission-empty-box {
            background: white;
            border: 1px dashed #cbd5e1;
            border-radius: 10px;
            color: #64748b;
            padding: 12px;
            font-weight: 700;
            font-size: 13px;
          }

          .soumission-config-box {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            background: #f9fafb;
            margin-bottom: 12px;
          }

          .soumission-config-box.vertical {
            flex-direction: column;
            align-items: stretch;
          }

          .soumission-config-inline {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 10px;
            align-items: center;
          }

          .soumission-config-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .soumission-config-list-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            padding: 8px 10px;
          }

          .soumission-config-row-actions {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .soumission-options-list {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }

          .soumission-option-line {
            display: flex;
            align-items: center;
            gap: 10px;
            width: 100%;
          }

          .soumission-checkbox-label,
          .soumission-radio-like-label {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            width: auto;
            margin: 0;
            padding: 0;
            font-size: 13px;
            font-weight: 600;
            color: #374151;
            cursor: pointer;
            line-height: 1.25;
          }

          .soumission-checkbox-label input,
          .soumission-radio-like-label input {
            width: 16px;
            height: 16px;
            min-width: 16px;
            min-height: 16px;
            margin: 0;
            padding: 0;
            cursor: pointer;
          }

          .soumission-option-actions {
            margin-left: auto;
            display: flex;
            gap: 8px;
            align-items: center;
          }

          .soumission-option-delete {
            padding: 5px 9px;
            font-size: 12px;
          }

          .soumission-dynamic-zone {
            display: flex;
            flex-direction: column;
            gap: 18px;
          }

          .soumission-type-block {
            border: 2px solid #bfdbfe;
            background: #eff6ff;
            border-radius: 14px;
            overflow: hidden;
          }

          .soumission-type-header {
            background: #0f172a;
            color: white;
            padding: 10px 14px;
            font-weight: 800;
            font-size: 18px;
          }

          .soumission-category-block {
            padding: 14px;
            border-top: 1px solid #dbeafe;
          }

          .soumission-fields-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 12px;
          }

          .soumission-dynamic-field {
            display: flex;
            flex-direction: column;
            gap: 6px;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            padding: 10px;
          }

          .soumission-dynamic-field-label {
            font-size: 13px;
            font-weight: 700;
            color: #111827;
          }

          .soumission-radio-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .soumission-radio-label {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            font-size: 13px;
            color: #374151;
          }

          .soumission-config-panel {
            border: 2px solid #bfdbfe;
            border-radius: 18px;
            background: #f8fbff;
            padding: 18px;
            margin-bottom: 18px;
          }

          .soumission-config-title {
            margin: 0;
            color: #111827;
            font-size: 24px;
            font-weight: 900;
          }

          .soumission-config-subtitle {
            color: #475569;
            margin: 6px 0 18px 0;
            font-size: 14px;
            line-height: 1.45;
          }

          .soumission-config-step {
            background: white;
            border: 1px solid #dbeafe;
            border-radius: 16px;
            padding: 16px;
            margin-bottom: 16px;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
          }

          .soumission-config-step-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 14px;
            margin-bottom: 14px;
          }

          .soumission-config-step-title-wrap {
            display: flex;
            align-items: flex-start;
            gap: 10px;
          }

          .soumission-config-step-number {
            width: 32px;
            height: 32px;
            min-width: 32px;
            border-radius: 999px;
            background: #2563eb;
            color: white;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-weight: 900;
            font-size: 15px;
          }

          .soumission-config-step-title {
            margin: 0;
            font-size: 18px;
            font-weight: 900;
            color: #0f172a;
          }

          .soumission-config-step-help {
            margin: 3px 0 0 0;
            color: #64748b;
            font-size: 13px;
            line-height: 1.35;
          }

          .soumission-current-type-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 999px;
            padding: 7px 12px;
            background: #dcfce7;
            color: #166534;
            border: 1px solid #86efac;
            font-size: 13px;
            font-weight: 900;
            white-space: nowrap;
          }

          .soumission-config-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 12px;
            margin-bottom: 14px;
          }

          .soumission-config-field {
            display: flex;
            flex-direction: column;
            gap: 5px;
            font-size: 13px;
            font-weight: 700;
            color: #374151;
          }

          .soumission-config-field textarea {
            min-height: 70px;
            resize: vertical;
          }

          .soumission-config-help-box {
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 12px;
            padding: 10px 12px;
            color: #1e3a8a;
            font-size: 13px;
            font-weight: 700;
            line-height: 1.4;
            margin-bottom: 14px;
          }

          .soumission-config-checkbox {
            flex-direction: row;
            align-items: center;
            gap: 8px;
            margin-top: 22px;
          }

          .soumission-config-checkbox input {
            width: 16px;
            height: 16px;
          }

          .soumission-category-mini-list,
          .soumission-choice-chip-list {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 10px;
          }

          .soumission-category-mini-chip {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            border-radius: 999px;
            padding: 6px 10px;
            font-size: 12px;
            font-weight: 800;
            color: #334155;
          }

          .soumission-choice-chip {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 5px 7px 5px 10px;
            border-radius: 999px;
            background: #e0f2fe;
            border: 1px solid #7dd3fc;
            color: #0f172a;
            font-size: 12px;
            font-weight: 700;
          }

          .soumission-choice-chip-delete {
            width: 20px;
            height: 20px;
            border: 0;
            border-radius: 999px;
            background: #dc2626;
            color: white;
            font-size: 15px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            font-weight: 900;
          }

          .soumission-choice-empty {
            margin-top: 8px;
            font-size: 12px;
            font-weight: 600;
            color: #6b7280;
          }

          .soumission-config-actions,
          .soumission-actions,
          .soumission-config-category-actions,
          .soumission-config-question-actions,
          .soumission-item-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            align-items: center;
          }

          .soumission-actions {
            justify-content: flex-end;
            margin-top: 4px;
          }

          .soumission-save-btn {
            font-size: 16px;
            padding: 11px 22px;
          }

          .soumission-config-category {
            background: white;
            border: 1px solid #dbeafe;
            border-radius: 12px;
            padding: 12px;
            margin-bottom: 12px;
          }

          .soumission-config-category-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 10px;
            margin-bottom: 8px;
          }

          .soumission-config-category-title {
            font-size: 16px;
            font-weight: 800;
            color: #111827;
          }

          .soumission-copy-row {
            display: grid;
            grid-template-columns: minmax(180px, 260px) auto;
            gap: 8px;
            align-items: center;
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid #e5e7eb;
          }

          .soumission-config-question-line {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            padding: 8px;
            border-radius: 8px;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            margin-top: 6px;
            font-size: 13px;
          }

          .soumission-config-question-line.is-editing {
            border-color: #2563eb;
            background: #dbeafe;
          }

          .soumission-config-question-info {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .soumission-condition-note {
            color: #2563eb;
            font-weight: 700;
          }

          .soumission-list {
            margin-top: 8px;
            font-size: 14px;
          }

          .soumission-list ul {
            list-style: none;
            display: flex;
            flex-direction: column;
            padding: 0;
            margin: 0;
            gap: 12px;
          }

          .soumission-item {
            padding: 14px 16px;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: white;
          }

          .soumission-item.is-editing {
            background: #dbeafe;
            border: 1px solid #2563eb;
          }

          .soumission-item-row {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 0.75rem;
          }

          .soumission-item-main {
            display: flex;
            flex-direction: column;
            gap: 0.35rem;
          }

          .soumission-item-header {
            display: flex;
            align-items: baseline;
            flex-wrap: wrap;
            gap: 0.75rem;
          }

          .soumission-item-title {
            font-size: 1.3rem;
            font-weight: 700;
          }

          .soumission-item-info {
            font-size: 1.05rem;
          }

          .soumission-item-reponses {
            font-size: 13px;
            color: #374151;
            line-height: 1.45;
            margin-top: 8px;
          }

          @media (max-width: 768px) {
            .soumission-panneaux-page {
              width: 100%;
              padding: 14px;
            }

            .soumission-panneaux-title {
              font-size: 24px;
            }

            .soumission-card {
              padding: 16px;
            }

            .soumission-card-top,
            .soumission-item-row,
            .soumission-config-question-line,
            .soumission-config-category-top,
            .soumission-config-step-header,
            .soumission-config-list-row {
              flex-direction: column;
              align-items: stretch;
            }

            .soumission-card-title {
              font-size: 22px;
            }

            .soumission-project-grid,
            .soumission-config-inline,
            .soumission-copy-row {
              grid-template-columns: 1fr;
            }

            .soumission-config-box {
              flex-direction: column;
              align-items: stretch;
            }

            .soumission-current-type-badge {
              width: fit-content;
            }

            .soumission-option-line {
              align-items: flex-start;
            }

            .soumission-option-actions {
              margin-left: 0;
            }
          }
        `}
      </style>

      <header className="soumission-panneaux-header">
        <h1 className="soumission-panneaux-title">SOUMISSION PANNEAUX</h1>
      </header>

      <div className="soumission-tabs">
        <button
          type="button"
          className={`soumission-tab-btn ${
            ongletActif === "formulaire" ? "active" : ""
          }`}
          onClick={() => setOngletActif("formulaire")}
        >
          Nouvelle soumission
        </button>

        <button
          type="button"
          className={`soumission-tab-btn ${
            ongletActif === "enregistrees" ? "active" : ""
          }`}
          onClick={() => setOngletActif("enregistrees")}
        >
          Soumissions enregistrées
        </button>

        <button
          type="button"
          className={`soumission-tab-btn ${
            ongletActif === "equivalences" ? "active" : ""
          }`}
          onClick={() => setOngletActif("equivalences")}
        >
          Équivalences
        </button>
      </div>

      {ongletActif === "formulaire" && renderFormulaireSoumission()}

      {ongletActif === "enregistrees" && renderSoumissionsEnregistrees()}

      {ongletActif === "equivalences" && <SoumissionEquivalences />}
    </div>
  );
}

export default SoumissionPanneaux;