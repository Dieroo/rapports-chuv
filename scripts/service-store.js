// Slice 4 — Gestion du bloc service côté logique.
// Couvre :
//   - Mutations des tâches d'un service (ajout, toggle, suppression)
//   - Suggestions de tâches récurrentes à reprendre au démarrage d'un service
//   - Toggle d'épinglage d'une tâche en cours dans la bibliothèque
//
// Depuis slice C : support des répétitions par tâche.
// Une tâche avec repetitions > 1 stocke un tableau `occurrences` :
//   [{ heure: ISO|null }, ...]  — null = non cochée
// `cochee` reste vrai quand TOUTES les occurrences sont cochées (rétrocompat.).
//
// Les textareas (transmission, notes) sont sauvegardées via majService(), pas ici.

import {
  majService, getService,
  enregistrerTacheRecurrente, listerTachesRecurrentes,
  setEpinglageTacheRecurrenteParTexte
} from './db.js';

// Identifiant court pour une tâche (suffit pour distinguer dans le DOM).
function idTache() {
  return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Construit le tableau d'occurrences vides pour N répétitions.
function occurrencesVides(n) {
  return Array.from({ length: Math.max(1, n) }, () => ({ heure: null }));
}

// Détermine si une tâche (objet) est "cochée" au sens large :
//   - ancienne tâche sans occurrences → champ cochee booléen
//   - nouvelle tâche avec occurrences → toutes cochées
function estTacheCochee(tache) {
  if (Array.isArray(tache.occurrences) && tache.occurrences.length > 0) {
    return tache.occurrences.every(o => o.heure !== null);
  }
  return !!tache.cochee;
}

// === Tâches d'un service ===

export async function ajouterTacheAuService(serviceId, texte, repetitions = 1) {
  const t = (texte || '').trim();
  if (!t) return null;
  const service = await getService(serviceId);
  if (!service) return null;
  const taches = Array.isArray(service.taches) ? service.taches.slice() : [];
  // Pas de doublon exact à l'intérieur d'un même service
  if (taches.some(x => x.texte.toLowerCase() === t.toLowerCase())) {
    return await getService(serviceId);
  }
  const n = Math.max(1, Math.min(99, parseInt(repetitions, 10) || 1));
  taches.push({
    id: idTache(),
    texte: t,
    cochee: false,
    horodatageCompletion: null,
    repetitions: n,
    occurrences: occurrencesVides(n)
  });
  await majService(serviceId, { taches });
  // Enrichit la bibliothèque (compteur d'usage + mémorise repetitions)
  await enregistrerTacheRecurrente(t, n);
  return await getService(serviceId);
}

export async function ajouterPlusieursTachesAuService(serviceId, textes) {
  const service = await getService(serviceId);
  if (!service) return null;
  const taches = Array.isArray(service.taches) ? service.taches.slice() : [];
  const existants = new Set(taches.map(x => x.texte.toLowerCase()));
  // Charge la bibliothèque pour récupérer les repetitions mémorisées
  const biblio = await listerTachesRecurrentes();
  const repMap = new Map(biblio.map(b => [b.texte.toLowerCase(), b.repetitions || 1]));
  let modif = false;
  for (const brut of textes) {
    const t = (brut || '').trim();
    if (!t || existants.has(t.toLowerCase())) continue;
    const n = repMap.get(t.toLowerCase()) || 1;
    taches.push({
      id: idTache(),
      texte: t,
      cochee: false,
      horodatageCompletion: null,
      repetitions: n,
      occurrences: occurrencesVides(n)
    });
    existants.add(t.toLowerCase());
    await enregistrerTacheRecurrente(t, n);
    modif = true;
  }
  if (modif) await majService(serviceId, { taches });
  return await getService(serviceId);
}

// Coche / décoche une occurrence précise (par index) d'une tâche.
// Met à jour cochee (true si toutes cochées) et horodatageCompletion.
export async function toggleOccurrenceTache(serviceId, tacheId, indexOccurrence) {
  const service = await getService(serviceId);
  if (!service) return null;
  const taches = (service.taches || []).map(t => {
    if (t.id !== tacheId) return t;

    // Rétrocompat : tâche sans occurrences → on traite comme 1 répétition
    const occs = Array.isArray(t.occurrences) && t.occurrences.length > 0
      ? t.occurrences.slice()
      : [{ heure: t.cochee ? (t.horodatageCompletion || new Date().toISOString()) : null }];

    const idx = Math.max(0, Math.min(occs.length - 1, indexOccurrence));
    const estCochee = occs[idx].heure !== null;
    occs[idx] = { heure: estCochee ? null : new Date().toISOString() };

    const touteCochee = occs.every(o => o.heure !== null);
    return {
      ...t,
      occurrences: occs,
      cochee: touteCochee,
      horodatageCompletion: touteCochee ? (occs[occs.length - 1].heure || new Date().toISOString()) : null
    };
  });
  await majService(serviceId, { taches });
  return await getService(serviceId);
}

// Modifie l'heure d'une occurrence précise (tap sur l'heure pour corriger).
// heureISO : string ISO (ex: new Date().toISOString()) ou null pour décocher.
export async function majHeureOccurrence(serviceId, tacheId, indexOccurrence, heureISO) {
  const service = await getService(serviceId);
  if (!service) return null;
  const taches = (service.taches || []).map(t => {
    if (t.id !== tacheId) return t;
    const occs = Array.isArray(t.occurrences) && t.occurrences.length > 0
      ? t.occurrences.slice()
      : [{ heure: null }];
    const idx = Math.max(0, Math.min(occs.length - 1, indexOccurrence));
    occs[idx] = { heure: heureISO };
    const touteCochee = occs.every(o => o.heure !== null);
    return {
      ...t,
      occurrences: occs,
      cochee: touteCochee,
      horodatageCompletion: touteCochee ? (occs[occs.length - 1].heure || null) : null
    };
  });
  await majService(serviceId, { taches });
  return await getService(serviceId);
}

// Conservé pour rétrocompatibilité — redirige vers toggleOccurrenceTache index 0.
export async function toggleTacheService(serviceId, tacheId) {
  return await toggleOccurrenceTache(serviceId, tacheId, 0);
}

export async function supprimerTacheService(serviceId, tacheId) {
  const service = await getService(serviceId);
  if (!service) return null;
  const taches = (service.taches || []).filter(t => t.id !== tacheId);
  await majService(serviceId, { taches });
  return await getService(serviceId);
}

// === Bibliothèque tâches récurrentes ===

// Score combiné : épinglées d'abord, puis fréquence × récence.
export async function listerSuggestionsRecurrentes() {
  const toutes = await listerTachesRecurrentes();
  const maintenant = Date.now();
  return toutes
    .map(t => {
      const recence = t.derniereUtilisation
        ? 1 / (1 + (maintenant - new Date(t.derniereUtilisation)) / (1000 * 60 * 60 * 24))
        : 0;
      return {
        ...t,
        epinglee: !!t.epinglee,
        score: (t.compteur || 0) * 2 + recence * 3
      };
    })
    .sort((a, b) => {
      if (a.epinglee !== b.epinglee) return a.epinglee ? -1 : 1;
      if (a.score !== b.score) return b.score - a.score;
      return a.texte.localeCompare(b.texte);
    });
}

// Top N suggestions à proposer au démarrage d'un service.
export async function getPropositionsDemarrageService(limite = 8) {
  const suggestions = await listerSuggestionsRecurrentes();
  return suggestions.slice(0, limite);
}

// Toggle d'épinglage d'une tâche (manipulée depuis le bloc service, par texte).
export async function basculerEpinglage(texteTache) {
  const t = (texteTache || '').trim();
  if (!t) return null;
  const toutes = await listerTachesRecurrentes();
  const existante = toutes.find(x => x.texte === t);
  const cible = !(existante && existante.epinglee);
  return await setEpinglageTacheRecurrenteParTexte(t, cible);
}

// Vrai si une tâche (par texte) est épinglée dans la bibliothèque.
export async function estTacheEpinglee(texteTache) {
  const t = (texteTache || '').trim();
  if (!t) return false;
  const toutes = await listerTachesRecurrentes();
  const existante = toutes.find(x => x.texte === t);
  return !!(existante && existante.epinglee);
}

// Expose estTacheCochee pour bloc-service.js
export { estTacheCochee };

// === Marquage "vu" du bandeau "Reprendre tâches récurrentes" ===

const KEY_BANDEAU_VU = 'rapports-chuv-bandeau-recurrentes-vu';

export function marquerBandeauVu(serviceId) {
  try {
    const arr = JSON.parse(sessionStorage.getItem(KEY_BANDEAU_VU) || '[]');
    if (!arr.includes(serviceId)) {
      arr.push(serviceId);
      sessionStorage.setItem(KEY_BANDEAU_VU, JSON.stringify(arr));
    }
  } catch { /* silencieux */ }
}

export function bandeauDejaVu(serviceId) {
  try {
    const arr = JSON.parse(sessionStorage.getItem(KEY_BANDEAU_VU) || '[]');
    return arr.includes(serviceId);
  } catch { return false; }
}
