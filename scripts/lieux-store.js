// Gestion des lieux pour l'autocomplétion.
// - Pré-chargés : depuis data/referentiels.js
// - Épinglés : stockés en localStorage (liste de lieux choisis par l'utilisateur)
// - Historique : agrégé à la volée depuis db.js (compteurs d'usage + récence)

import { LIEUX_PRECHARGES } from '../data/referentiels.js';
import { listerLieuxUtilises } from './db.js';

const STORAGE_KEY_PINS = 'rapports-chuv-lieux-epingles';

export function getLieuxEpingles() {
  try {
    const json = localStorage.getItem(STORAGE_KEY_PINS);
    if (!json) return [];
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function setLieuxEpingles(lieux) {
  try {
    localStorage.setItem(STORAGE_KEY_PINS, JSON.stringify(lieux));
  } catch (e) {
    console.warn('[Lieux] localStorage échec:', e);
  }
}

export function estEpingle(lieu) {
  return getLieuxEpingles().includes(lieu);
}

export function togglePinLieu(lieu) {
  const epingles = getLieuxEpingles();
  const idx = epingles.indexOf(lieu);
  if (idx >= 0) {
    epingles.splice(idx, 1);
  } else {
    if (epingles.length >= 5) {
      // Maximum 5 épinglés — on retire le plus ancien
      epingles.shift();
    }
    epingles.push(lieu);
  }
  setLieuxEpingles(epingles);
  return epingles;
}

// Renvoie une liste ordonnée de suggestions pour l'autocomplétion :
// 1. Épinglés (selon ordre utilisateur)
// 2. Récemment utilisés et fréquents (depuis l'historique DB)
// 3. Pré-chargés non encore utilisés (en dernier)
// Si `filtre` est fourni, ne garde que les lieux contenant ce texte (case-insensitive).
export async function getSuggestionsLieux(filtre = '') {
  const filtreLower = (filtre || '').toLowerCase().trim();
  const epingles = getLieuxEpingles();
  const historique = await listerLieuxUtilises();

  // Map pour dédupliquer et calculer scores
  const scores = new Map();

  // Pré-chargés : score de base
  LIEUX_PRECHARGES.forEach(lieu => {
    scores.set(lieu, { lieu, count: 0, lastUsed: null, source: 'preload' });
  });

  // Historique : ajouter ou enrichir
  historique.forEach(h => {
    const existant = scores.get(h.lieu);
    if (existant) {
      existant.count = h.count;
      existant.lastUsed = h.lastUsed;
      existant.source = 'history';
    } else {
      scores.set(h.lieu, { lieu: h.lieu, count: h.count, lastUsed: h.lastUsed, source: 'history' });
    }
  });

  // Filtrage texte (si fourni)
  let liste = Array.from(scores.values());
  if (filtreLower) {
    liste = liste.filter(item => item.lieu.toLowerCase().includes(filtreLower));
  }

  // Tri : épinglés d'abord, puis par fréquence × récence
  const maintenant = Date.now();
  liste.sort((a, b) => {
    const aPinned = epingles.includes(a.lieu);
    const bPinned = epingles.includes(b.lieu);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    if (aPinned && bPinned) {
      // Entre épinglés, ordre d'épinglage (le plus récent d'abord)
      return epingles.indexOf(b.lieu) - epingles.indexOf(a.lieu);
    }
    // Score combiné fréquence + récence
    const recA = a.lastUsed ? Math.max(1, 1 / (1 + (maintenant - new Date(a.lastUsed)) / (1000 * 60 * 60 * 24))) : 0;
    const recB = b.lastUsed ? Math.max(1, 1 / (1 + (maintenant - new Date(b.lastUsed)) / (1000 * 60 * 60 * 24))) : 0;
    const scoreA = a.count * 2 + recA * 3;
    const scoreB = b.count * 2 + recB * 3;
    if (scoreA !== scoreB) return scoreB - scoreA;
    return a.lieu.localeCompare(b.lieu);
  });

  return liste.map(item => ({
    lieu: item.lieu,
    epingle: epingles.includes(item.lieu),
    count: item.count
  }));
}
