// Slice 4 — Gestion du bloc service côté logique.
// Couvre :
//   - Mutations des tâches d'un service (ajout, toggle, suppression)
//   - Suggestions de tâches récurrentes à reprendre au démarrage d'un service
//   - Toggle d'épinglage d'une tâche en cours dans la bibliothèque
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

// === Tâches d'un service ===

export async function ajouterTacheAuService(serviceId, texte) {
  const t = (texte || '').trim();
  if (!t) return null;
  const service = await getService(serviceId);
  if (!service) return null;
  const taches = Array.isArray(service.taches) ? service.taches.slice() : [];
  // Pas de doublon exact à l'intérieur d'un même service
  if (taches.some(x => x.texte.toLowerCase() === t.toLowerCase())) {
    return await getService(serviceId);
  }
  taches.push({
    id: idTache(),
    texte: t,
    cochee: false,
    horodatageCompletion: null
  });
  await majService(serviceId, { taches });
  // Enrichit la bibliothèque (compteur d'usage)
  await enregistrerTacheRecurrente(t);
  return await getService(serviceId);
}

export async function ajouterPlusieursTachesAuService(serviceId, textes) {
  const service = await getService(serviceId);
  if (!service) return null;
  const taches = Array.isArray(service.taches) ? service.taches.slice() : [];
  const existants = new Set(taches.map(x => x.texte.toLowerCase()));
  let modif = false;
  for (const brut of textes) {
    const t = (brut || '').trim();
    if (!t || existants.has(t.toLowerCase())) continue;
    taches.push({
      id: idTache(),
      texte: t,
      cochee: false,
      horodatageCompletion: null
    });
    existants.add(t.toLowerCase());
    await enregistrerTacheRecurrente(t);
    modif = true;
  }
  if (modif) await majService(serviceId, { taches });
  return await getService(serviceId);
}

export async function toggleTacheService(serviceId, tacheId) {
  const service = await getService(serviceId);
  if (!service) return null;
  const taches = (service.taches || []).map(t => {
    if (t.id !== tacheId) return t;
    const cochee = !t.cochee;
    return {
      ...t,
      cochee,
      horodatageCompletion: cochee ? new Date().toISOString() : null
    };
  });
  await majService(serviceId, { taches });
  return await getService(serviceId);
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

// Top N suggestions à proposer au démarrage d'un service (mix épinglées + populaires).
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

// === Marquage "vu" du bandeau "Reprendre tâches récurrentes" ===
//
// Stocké en sessionStorage par serviceId : le bandeau ne réapparaît pas si
// l'utilisateur l'a écarté pour ce service. Disparaît aussi au prochain
// rechargement complet du navigateur (acceptable : le service est "neuf").

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
