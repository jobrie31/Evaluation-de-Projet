// src/SoumissionPanneaux.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
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

const OPTIONS_NORBEC_DEFAUT = [
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

const EMPTY_PANNEAU = {
  fabricant: "Norbec",
  typesPanneaux: [],
  reponses: {},
};

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

function makeId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeEmptyConfigs(options) {
  return options.reduce((acc, option) => {
    acc[option] = { categories: [] };
    return acc;
  }, {});
}

function normalizeConfigs(options, configs) {
  const base = configs && typeof configs === "object" ? { ...configs } : {};

  options.forEach((option) => {
    if (!base[option]) {
      base[option] = { categories: [] };
    }

    if (!Array.isArray(base[option].categories)) {
      base[option].categories = [];
    }
  });

  return base;
}

function splitChoix(texte) {
  return String(texte || "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

function SoumissionPanneaux() {
  const [panneaux, setPanneaux] = useState([]);
  const [nouveauPanneau, setNouveauPanneau] = useState(EMPTY_PANNEAU);
  const [panneauEnEditionId, setPanneauEnEditionId] = useState(null);

  const [chargementConfig, setChargementConfig] = useState(true);
  const [chargementPanneaux, setChargementPanneaux] = useState(true);

  const [modeConfiguration, setModeConfiguration] = useState(false);
  const [optionsNorbec, setOptionsNorbec] = useState(OPTIONS_NORBEC_DEFAUT);
  const [nouvelleOptionNorbec, setNouvelleOptionNorbec] = useState("");

  const [configsNorbec, setConfigsNorbec] = useState(() =>
    makeEmptyConfigs(OPTIONS_NORBEC_DEFAUT)
  );

  const [typeConfigSelectionne, setTypeConfigSelectionne] = useState(
    OPTIONS_NORBEC_DEFAUT[0]
  );

  const [nouvelleCategorie, setNouvelleCategorie] = useState("");
  const [nouvelleQuestion, setNouvelleQuestion] = useState(EMPTY_QUESTION);
  const [questionEnEdition, setQuestionEnEdition] = useState(null);
  const [copieCategorieVersType, setCopieCategorieVersType] = useState({});

  useEffect(() => {
    const unsubscribe = onSnapshot(
      getConfigRef(),
      (snap) => {
        if (!snap.exists()) {
          const configsInitiales = makeEmptyConfigs(OPTIONS_NORBEC_DEFAUT);

          setOptionsNorbec(OPTIONS_NORBEC_DEFAUT);
          setConfigsNorbec(configsInitiales);
          setTypeConfigSelectionne(OPTIONS_NORBEC_DEFAUT[0]);
          setChargementConfig(false);
          return;
        }

        const data = snap.data();

        const options =
          Array.isArray(data.optionsNorbec) && data.optionsNorbec.length > 0
            ? data.optionsNorbec
            : OPTIONS_NORBEC_DEFAUT;

        const configs = normalizeConfigs(options, data.configsNorbec);

        setOptionsNorbec(options);
        setConfigsNorbec(configs);

        setTypeConfigSelectionne((prev) => {
          if (prev && options.includes(prev)) return prev;
          return options[0] || "";
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
  }, []);

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
        console.error("Erreur chargement panneaux:", error);
        alert("Erreur lors du chargement des panneaux Firestore.");
        setChargementPanneaux(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const sauvegarderConfiguration = async (nextOptions, nextConfigs) => {
    try {
      await setDoc(
        getConfigRef(),
        {
          optionsNorbec: nextOptions,
          configsNorbec: nextConfigs,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Erreur sauvegarde configuration:", error);
      alert("Erreur lors de la sauvegarde de la configuration.");
    }
  };

  const configSelectionnee = configsNorbec[typeConfigSelectionne] || {
    categories: [],
  };

  const questionsConfigurables = useMemo(() => {
    const questions = [];

    configSelectionnee.categories.forEach((cat) => {
      cat.questions.forEach((q) => {
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

    for (const cat of configSelectionnee.categories) {
      if (cat.id !== questionEnEdition.categorieId) continue;

      const q = cat.questions.find(
        (question) => question.id === questionEnEdition.questionId
      );

      if (q) return q;
    }

    return null;
  }, [questionEnEdition, configSelectionnee]);

  const questionsActives = useMemo(() => {
    const questions = [];

    nouveauPanneau.typesPanneaux.forEach((type) => {
      const config = configsNorbec[type];
      if (!config?.categories) return;

      config.categories.forEach((categorie) => {
        categorie.questions.forEach((question) => {
          questions.push({
            ...question,
            typePanneau: type,
            categorieTitre: categorie.titre,
          });
        });
      });
    });

    return questions;
  }, [nouveauPanneau.typesPanneaux, configsNorbec]);

  const resetQuestionForm = (categorieId = "") => {
    setNouvelleQuestion({
      ...EMPTY_QUESTION,
      categorieId,
    });
    setQuestionEnEdition(null);
  };

  const resetPanneauForm = () => {
    setNouveauPanneau(EMPTY_PANNEAU);
    setPanneauEnEditionId(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

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

  const getQuestionLabel = (typePanneau, questionId) => {
    const config = configsNorbec[typePanneau];

    for (const cat of config?.categories || []) {
      const question = cat.questions.find((q) => q.id === questionId);
      if (question) return question.label || cat.titre;
    }

    return questionId;
  };

  const getChoixQuestion = (question) => {
    if (!question) return [];

    if (question.type === "yesno") {
      return ["Oui", "Non"];
    }

    if (Array.isArray(question.choix) && question.choix.length > 0) {
      return question.choix;
    }

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

    if (!Array.isArray(question.choixConditionnels)) {
      return baseChoices;
    }

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

      const config = configsNorbec[typePanneau];

      for (const cat of config?.categories || []) {
        for (const q of cat.questions) {
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

    if (!configsNorbec[type]) {
      const nextConfigs = {
        ...configsNorbec,
        [type]: {
          categories: [],
        },
      };

      setConfigsNorbec(nextConfigs);
      sauvegarderConfiguration(optionsNorbec, nextConfigs);
    }
  };

  const handleAjouterOptionNorbec = async () => {
    const valeur = nouvelleOptionNorbec.trim();

    if (!valeur) return;

    const existeDeja = optionsNorbec.some(
      (option) => option.toLowerCase() === valeur.toLowerCase()
    );

    if (existeDeja) {
      alert("Cette option existe déjà.");
      return;
    }

    const nextOptions = [...optionsNorbec, valeur];

    const nextConfigs = {
      ...configsNorbec,
      [valeur]: {
        categories: [],
      },
    };

    setOptionsNorbec(nextOptions);
    setConfigsNorbec(nextConfigs);
    setTypeConfigSelectionne(valeur);
    setNouvelleOptionNorbec("");

    await sauvegarderConfiguration(nextOptions, nextConfigs);
  };

  const handleModifierOptionNorbec = async (ancienneValeur) => {
    const nouvelleValeur = window.prompt(
      "Modifier le nom de l’option :",
      ancienneValeur
    );

    if (nouvelleValeur === null) return;

    const valeur = nouvelleValeur.trim();
    if (!valeur) return;

    if (valeur === ancienneValeur) return;

    const existeDeja = optionsNorbec.some(
      (option) =>
        option.toLowerCase() === valeur.toLowerCase() &&
        option !== ancienneValeur
    );

    if (existeDeja) {
      alert("Cette option existe déjà.");
      return;
    }

    const nextOptions = optionsNorbec.map((option) =>
      option === ancienneValeur ? valeur : option
    );

    const nextConfigs = { ...configsNorbec };
    nextConfigs[valeur] = nextConfigs[ancienneValeur] || { categories: [] };
    delete nextConfigs[ancienneValeur];

    setOptionsNorbec(nextOptions);
    setConfigsNorbec(nextConfigs);

    setNouveauPanneau((prev) => {
      const nouvellesReponses = {};

      Object.entries(prev.reponses || {}).forEach(([key, valueReponse]) => {
        if (key.startsWith(`${ancienneValeur}__`)) {
          nouvellesReponses[key.replace(`${ancienneValeur}__`, `${valeur}__`)] =
            valueReponse;
        } else {
          nouvellesReponses[key] = valueReponse;
        }
      });

      return {
        ...prev,
        typesPanneaux: prev.typesPanneaux.map((t) =>
          t === ancienneValeur ? valeur : t
        ),
        reponses: nouvellesReponses,
      };
    });

    if (typeConfigSelectionne === ancienneValeur) {
      setTypeConfigSelectionne(valeur);
    }

    await sauvegarderConfiguration(nextOptions, nextConfigs);
  };

  const handleSupprimerOptionNorbec = async (optionASupprimer) => {
    const confirmation = window.confirm(
      `Voulez-vous vraiment supprimer l’option "${optionASupprimer}" ?`
    );

    if (!confirmation) return;

    const nextOptions = optionsNorbec.filter(
      (option) => option !== optionASupprimer
    );

    const nextConfigs = { ...configsNorbec };
    delete nextConfigs[optionASupprimer];

    setOptionsNorbec(nextOptions);
    setConfigsNorbec(nextConfigs);

    setNouveauPanneau((prev) => {
      const nouvellesReponses = { ...prev.reponses };

      Object.keys(nouvellesReponses).forEach((key) => {
        if (key.startsWith(`${optionASupprimer}__`)) {
          delete nouvellesReponses[key];
        }
      });

      return {
        ...prev,
        typesPanneaux: prev.typesPanneaux.filter(
          (type) => type !== optionASupprimer
        ),
        reponses: nouvellesReponses,
      };
    });

    if (typeConfigSelectionne === optionASupprimer) {
      setTypeConfigSelectionne(nextOptions[0] || "");
    }

    await sauvegarderConfiguration(nextOptions, nextConfigs);
  };

  const handleAjouterCategorie = async () => {
    const titre = nouvelleCategorie.trim();

    if (!titre) return;

    const ancienneConfig = configsNorbec[typeConfigSelectionne] || {
      categories: [],
    };

    const nextConfigs = {
      ...configsNorbec,
      [typeConfigSelectionne]: {
        ...ancienneConfig,
        categories: [
          ...ancienneConfig.categories,
          {
            id: makeId(),
            titre,
            questions: [],
          },
        ],
      },
    };

    setConfigsNorbec(nextConfigs);
    setNouvelleCategorie("");

    await sauvegarderConfiguration(optionsNorbec, nextConfigs);
  };

  const handleModifierCategorie = async (categorieId) => {
    const categorie = configSelectionnee.categories.find(
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

    const ancienneConfig = configsNorbec[typeConfigSelectionne] || {
      categories: [],
    };

    const nextConfigs = {
      ...configsNorbec,
      [typeConfigSelectionne]: {
        ...ancienneConfig,
        categories: ancienneConfig.categories.map((cat) => {
          if (cat.id !== categorieId) return cat;

          return {
            ...cat,
            titre,
            questions: cat.questions.map((q) => ({
              ...q,
              label: titre,
            })),
          };
        }),
      },
    };

    setConfigsNorbec(nextConfigs);
    await sauvegarderConfiguration(optionsNorbec, nextConfigs);
  };

  const handleDeplacerCategorie = async (categorieId, direction) => {
    const ancienneConfig = configsNorbec[typeConfigSelectionne] || {
      categories: [],
    };

    const index = ancienneConfig.categories.findIndex(
      (cat) => cat.id === categorieId
    );

    if (index === -1) return;

    const nouvelIndex = direction === "haut" ? index - 1 : index + 1;

    if (nouvelIndex < 0 || nouvelIndex >= ancienneConfig.categories.length) {
      return;
    }

    const categories = [...ancienneConfig.categories];
    const temp = categories[index];
    categories[index] = categories[nouvelIndex];
    categories[nouvelIndex] = temp;

    const nextConfigs = {
      ...configsNorbec,
      [typeConfigSelectionne]: {
        ...ancienneConfig,
        categories,
      },
    };

    setConfigsNorbec(nextConfigs);
    await sauvegarderConfiguration(optionsNorbec, nextConfigs);
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

    const categorie = configSelectionnee.categories.find(
      (cat) => cat.id === categorieId
    );

    if (!categorie) return;

    const confirmation = window.confirm(
      `Copier "${categorie.titre}" vers "${typeDestination}" ?`
    );

    if (!confirmation) return;

    const configDestination = configsNorbec[typeDestination] || {
      categories: [],
    };

    const categorieClonee = clonerCategoriePourAutreType(categorie);

    const nextConfigs = {
      ...configsNorbec,
      [typeDestination]: {
        ...configDestination,
        categories: [...configDestination.categories, categorieClonee],
      },
    };

    setConfigsNorbec(nextConfigs);

    setCopieCategorieVersType((prev) => ({
      ...prev,
      [categorieId]: "",
    }));

    await sauvegarderConfiguration(optionsNorbec, nextConfigs);
  };

  const handleSupprimerCategorie = async (categorieId) => {
    const confirmation = window.confirm(
      "Voulez-vous vraiment supprimer cette catégorie et ses questions ?"
    );

    if (!confirmation) return;

    const ancienneConfig = configsNorbec[typeConfigSelectionne] || {
      categories: [],
    };

    const nextConfigs = {
      ...configsNorbec,
      [typeConfigSelectionne]: {
        ...ancienneConfig,
        categories: ancienneConfig.categories.filter(
          (cat) => cat.id !== categorieId
        ),
      },
    };

    setConfigsNorbec(nextConfigs);

    if (questionEnEdition?.categorieId === categorieId) {
      resetQuestionForm();
    }

    await sauvegarderConfiguration(optionsNorbec, nextConfigs);
  };

  const creerQuestionDepuisFormulaire = () => {
    if (!nouvelleQuestion.categorieId) {
      alert("Veuillez choisir une catégorie.");
      return null;
    }

    const categorieSelectionnee = configSelectionnee.categories.find(
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
      alert(
        "Pour une condition, veuillez choisir la question dépendante et la valeur attendue."
      );
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
        alert(
          "Veuillez choisir la question, la réponse et les choix à afficher."
        );
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

    const ancienneConfig = configsNorbec[typeConfigSelectionne] || {
      categories: [],
    };

    let nextConfigs;

    if (questionEnEdition) {
      nextConfigs = {
        ...configsNorbec,
        [typeConfigSelectionne]: {
          ...ancienneConfig,
          categories: ancienneConfig.categories.map((cat) => {
            if (cat.id !== questionEnEdition.categorieId) return cat;

            return {
              ...cat,
              questions: cat.questions.map((q) =>
                q.id === questionEnEdition.questionId ? question : q
              ),
            };
          }),
        },
      };
    } else {
      nextConfigs = {
        ...configsNorbec,
        [typeConfigSelectionne]: {
          ...ancienneConfig,
          categories: ancienneConfig.categories.map((cat) => {
            if (cat.id !== nouvelleQuestion.categorieId) return cat;

            return {
              ...cat,
              questions: [...cat.questions, question],
            };
          }),
        },
      };
    }

    setConfigsNorbec(nextConfigs);
    resetQuestionForm(nouvelleQuestion.categorieId);

    await sauvegarderConfiguration(optionsNorbec, nextConfigs);
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
    const confirmation = window.confirm(
      "Voulez-vous vraiment supprimer cette question ?"
    );

    if (!confirmation) return;

    const ancienneConfig = configsNorbec[typeConfigSelectionne] || {
      categories: [],
    };

    const nextConfigs = {
      ...configsNorbec,
      [typeConfigSelectionne]: {
        ...ancienneConfig,
        categories: ancienneConfig.categories.map((cat) => {
          if (cat.id !== categorieId) return cat;

          return {
            ...cat,
            questions: cat.questions.filter((q) => q.id !== questionId),
          };
        }),
      },
    };

    setConfigsNorbec(nextConfigs);

    if (
      questionEnEdition?.categorieId === categorieId &&
      questionEnEdition?.questionId === questionId
    ) {
      resetQuestionForm(categorieId);
    }

    await sauvegarderConfiguration(optionsNorbec, nextConfigs);
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

  const handleAjouterOuModifierPanneau = async (e) => {
    e.preventDefault();

    if (nouveauPanneau.typesPanneaux.length === 0) {
      alert("Veuillez sélectionner au moins un type de panneau.");
      return;
    }

    if (!validerQuestionsObligatoires()) return;

    try {
      if (panneauEnEditionId) {
        await updateDoc(getPanneauRef(panneauEnEditionId), {
          fabricant: nouveauPanneau.fabricant,
          typesPanneaux: nouveauPanneau.typesPanneaux,
          reponses: nouveauPanneau.reponses,
          updatedAt: serverTimestamp(),
        });

        resetPanneauForm();
        return;
      }

      await addDoc(getPanneauxCollectionRef(), {
        fabricant: nouveauPanneau.fabricant,
        typesPanneaux: nouveauPanneau.typesPanneaux,
        reponses: nouveauPanneau.reponses,
        createdAt: serverTimestamp(),
      });

      resetPanneauForm();
    } catch (error) {
      console.error("Erreur enregistrement panneau:", error);
      alert("Erreur lors de l’enregistrement du panneau.");
    }
  };

  const handleModifierPanneau = (panneau) => {
    setPanneauEnEditionId(panneau.id);

    setNouveauPanneau({
      fabricant: panneau.fabricant || "Norbec",
      typesPanneaux: Array.isArray(panneau.typesPanneaux)
        ? panneau.typesPanneaux
        : [],
      reponses: panneau.reponses || {},
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSupprimerPanneau = async (id) => {
    const confirmation = window.confirm(
      "Voulez-vous vraiment supprimer ce panneau ?"
    );

    if (!confirmation) return;

    try {
      await deleteDoc(getPanneauRef(id));

      if (panneauEnEditionId === id) {
        resetPanneauForm();
      }
    } catch (error) {
      console.error("Erreur suppression panneau:", error);
      alert("Erreur lors de la suppression du panneau.");
    }
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
          {choixAffiches.map((choix) => (
            <option key={choix} value={choix}>
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
          {choixAffiches.map((choix) => (
            <label key={choix} className="soumission-radio-label">
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
          const config = configsNorbec[type];

          if (!config?.categories?.length) {
            return (
              <div key={type} className="soumission-type-block">
                <div className="soumission-type-header">{type}</div>
                <div className="soumission-category-block">
                  Aucune question configurée pour ce type de panneau.
                </div>
              </div>
            );
          }

          return (
            <div key={type} className="soumission-type-block">
              <div className="soumission-type-header">{type}</div>

              {config.categories.map((categorie) => {
                const questionsVisibles = categorie.questions.filter((question) =>
                  isQuestionVisible(type, question)
                );

                if (questionsVisibles.length === 0) {
                  return null;
                }

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
            margin-bottom: 24px;
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

          .soumission-section h3 {
            font-size: 16px;
            margin: 0 0 10px 0;
            color: #111827;
          }

          .soumission-field {
            display: flex;
            flex-direction: column;
            gap: 4px;
            font-size: 13px;
            color: #374151;
            margin-bottom: 12px;
          }

          .soumission-field select,
          .soumission-field input[type="text"],
          .soumission-field input[type="number"],
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

          .soumission-field select:focus,
          .soumission-field input:focus,
          .soumission-dynamic-field select:focus,
          .soumission-dynamic-field input:focus,
          .soumission-config-box input:focus,
          .soumission-config-box select:focus,
          .soumission-config-field input:focus,
          .soumission-config-field select:focus,
          .soumission-config-field textarea:focus {
            outline: 2px solid #2563eb;
            outline-offset: 1px;
            border-color: #2563eb;
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

          .soumission-checkbox-label {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            width: auto;
            margin: 0;
            padding: 0;
            font-size: 13px;
            font-weight: 400;
            color: #374151;
            cursor: pointer;
            line-height: 1.25;
          }

          .soumission-checkbox-label input[type="checkbox"] {
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

          .soumission-radio-label input {
            width: 15px;
            height: 15px;
          }

          .soumission-config-panel {
            border: 2px dashed #93c5fd;
            border-radius: 14px;
            background: #eff6ff;
            padding: 16px;
            margin-top: 0;
            margin-bottom: 18px;
          }

          .soumission-config-title {
            margin: 0 0 14px 0;
            color: #111827;
            font-size: 20px;
            font-weight: 800;
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

          .soumission-config-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-bottom: 14px;
          }

          .soumission-config-preview {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .soumission-config-category {
            background: white;
            border: 1px solid #dbeafe;
            border-radius: 12px;
            padding: 12px;
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

          .soumission-config-category-actions,
          .soumission-config-question-actions,
          .soumission-item-actions {
            display: flex;
            gap: 8px;
            align-items: center;
            flex-wrap: wrap;
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

          .soumission-actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            margin-top: 4px;
            flex-wrap: wrap;
          }

          .soumission-list {
            margin-top: 8px;
            font-size: 14px;
          }

          .soumission-list p {
            color: #6b7280;
          }

          .soumission-list ul {
            list-style: none;
            display: flex;
            flex-direction: column;
            padding: 0;
            margin: 0;
          }

          .soumission-item {
            padding: 0.5rem 0.8rem;
            border-bottom: 1px solid #e5e7eb;
            background: white;
          }

          .soumission-item.is-editing {
            background: #dbeafe;
            border: 1px solid #2563eb;
          }

          .soumission-item:hover {
            background: #f9fafb;
          }

          .soumission-item.is-editing:hover {
            background: #dbeafe;
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

            .soumission-card-top {
              flex-direction: column;
              align-items: flex-start;
            }

            .soumission-card-title {
              font-size: 22px;
            }

            .soumission-config-box {
              flex-direction: column;
              align-items: stretch;
            }

            .soumission-item-row,
            .soumission-config-question-line,
            .soumission-config-category-top {
              flex-direction: column;
              align-items: stretch;
            }

            .soumission-copy-row {
              grid-template-columns: 1fr;
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

      <section className="soumission-card">
        <div className="soumission-card-top">
          <div className="soumission-card-title">Feuille Norbec</div>

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
            Modification d’un panneau en cours. Clique sur “Enregistrer les
            modifications” pour sauvegarder.
          </div>
        )}

        <form
          onSubmit={handleAjouterOuModifierPanneau}
          className="soumission-form"
        >
          <div className="soumission-section">
            <h3>Types de panneaux</h3>

            <label className="soumission-field">
              Fabricant
              <select
                name="fabricant"
                value={nouveauPanneau.fabricant}
                onChange={handleChange}
              >
                <option value="Norbec">Norbec</option>
                <option value="Kingspan">Kingspan</option>
                <option value="Metl-Span">Metl-Span</option>
                <option value="AWIP">AWIP</option>
                <option value="Autre">Autre</option>
              </select>
            </label>

            <div className="soumission-question-title">
              Sélectionner le ou les types de panneaux demandés{" "}
              <span className="soumission-required">*</span>
            </div>

            {modeConfiguration && (
              <div className="soumission-config-box">
                <input
                  type="text"
                  value={nouvelleOptionNorbec}
                  onChange={(e) => setNouvelleOptionNorbec(e.target.value)}
                  placeholder="Ajouter une option Norbec"
                />

                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleAjouterOptionNorbec}
                >
                  Ajouter option
                </button>
              </div>
            )}

            <div className="soumission-options-list">
              {optionsNorbec.map((type) => (
                <div key={type} className="soumission-option-line">
                  <label className="soumission-checkbox-label">
                    <input
                      type="checkbox"
                      checked={nouveauPanneau.typesPanneaux.includes(type)}
                      onChange={() => handleTypePanneauToggle(type)}
                    />

                    <span>{type}</span>
                  </label>

                  {modeConfiguration && (
                    <div className="soumission-option-actions">
                      <button
                        type="button"
                        className="btn-secondary soumission-option-delete"
                        onClick={() => handleModifierOptionNorbec(type)}
                      >
                        Modifier
                      </button>

                      <button
                        type="button"
                        className="delete-btn soumission-option-delete"
                        onClick={() => handleSupprimerOptionNorbec(type)}
                      >
                        Supprimer
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {modeConfiguration && (
            <div className="soumission-config-panel">
              <h2 className="soumission-config-title">
                Configuration des catégories et questions
              </h2>

              {questionEnEdition && (
                <div className="soumission-editing-banner">
                  Modification d’une question en cours. Pour ajouter des choix
                  pour une autre réponse, change seulement “Si la réponse est”,
                  écris les nouveaux choix, puis clique sur Enregistrer.
                </div>
              )}

              <div className="soumission-config-grid">
                <label className="soumission-config-field">
                  Type de panneau à configurer
                  <select
                    value={typeConfigSelectionne}
                    onChange={(e) => {
                      setTypeConfigSelectionne(e.target.value);
                      resetQuestionForm();
                    }}
                  >
                    {optionsNorbec.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="soumission-config-field">
                  Ajouter une catégorie / question
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
                    Ajouter
                  </button>
                </div>
              </div>

              <div className="soumission-config-grid">
                <label className="soumission-config-field">
                  Catégorie de la question
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
                    {configSelectionnee.categories.map((cat) => (
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
                  Afficher cette question seulement selon une réponse précédente
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
                          .filter((q) => q.id !== questionEnEdition?.questionId)
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
                          {choixConditionQuestion.map((choix) => (
                            <option key={choix} value={choix}>
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
                          choixTexte: e.target.checked ? "" : prev.choixTexte,
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
                          value={nouvelleQuestion.choixConditionQuestionId}
                          onChange={(e) =>
                            handleChoixConditionQuestionChange(e.target.value)
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
                        Si la réponse est
                        {choixChoixConditionQuestion.length > 0 ? (
                          <select
                            value={nouvelleQuestion.choixConditionValeur}
                            onChange={(e) =>
                              handleChoixConditionValeurChange(e.target.value)
                            }
                          >
                            <option value="">Sélectionnez...</option>
                            {choixChoixConditionQuestion.map((choix) => (
                              <option key={choix} value={choix}>
                                {choix}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={nouvelleQuestion.choixConditionValeur}
                            onChange={(e) =>
                              handleChoixConditionValeurChange(e.target.value)
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
                    onClick={() => resetQuestionForm(nouvelleQuestion.categorieId)}
                  >
                    Annuler modification
                  </button>
                )}
              </div>

              <div className="soumission-config-preview">
                {configSelectionnee.categories.length === 0 ? (
                  <p>Aucune catégorie configurée pour ce type.</p>
                ) : (
                  configSelectionnee.categories.map((cat, index) => (
                    <div key={cat.id} className="soumission-config-category">
                      <div className="soumission-config-category-top">
                        <div className="soumission-config-category-title">
                          {index + 1}. {cat.titre}
                        </div>

                        <div className="soumission-config-category-actions">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleDeplacerCategorie(cat.id, "haut")}
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
                              index === configSelectionnee.categories.length - 1
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
                          <option value="">Copier vers un autre type...</option>
                          {optionsNorbec
                            .filter((type) => type !== typeConfigSelectionne)
                            .map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                        </select>

                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleCopierCategorieVersType(cat.id)}
                        >
                          Copier cette catégorie
                        </button>
                      </div>

                      {cat.questions.length === 0 ? (
                        <p>Aucune question dans cette catégorie.</p>
                      ) : (
                        cat.questions.map((q) => {
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
                                      typeConfigSelectionne,
                                      q.condition.questionId
                                    )}{" "}
                                    = {q.condition.valeur}
                                  </span>
                                )}

                                {q.choixConditionnels?.length > 0 &&
                                  q.choixConditionnels.map((rule, ruleIndex) => (
                                    <span
                                      key={`${rule.questionId}-${rule.valeur}-${ruleIndex}`}
                                      className="soumission-condition-note"
                                    >
                                      Choix si{" "}
                                      {getQuestionLabel(
                                        typeConfigSelectionne,
                                        rule.questionId
                                      )}{" "}
                                      = {rule.valeur} →{" "}
                                      {Array.isArray(rule.choix)
                                        ? rule.choix.join(", ")
                                        : ""}
                                    </span>
                                  ))}
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

            <button type="submit" className="btn-primary">
              {panneauEnEditionId
                ? "Enregistrer les modifications"
                : "Ajouter le panneau"}
            </button>
          </div>
        </form>
      </section>

      <main className="soumission-list">
        {panneaux.length === 0 ? (
          <p>Aucun panneau ajouté pour l’instant.</p>
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
                        {p.fabricant || "Fabricant non spécifié"}
                      </span>

                      {p.typesPanneaux?.length > 0 && (
                        <span className="soumission-item-info">
                          Types: <strong>{p.typesPanneaux.join(", ")}</strong>
                        </span>
                      )}
                    </div>

                    {Object.keys(p.reponses || {}).length > 0 && (
                      <div className="soumission-item-reponses">
                        {Object.entries(p.reponses).map(([key, value]) => {
                          const [typePanneau, questionId] = key.split("__");
                          const label = getQuestionLabel(
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
    </div>
  );
}

export default SoumissionPanneaux;