// export-claude.js — Génération du texte pivot pour export vers projet Claude "Rapport"
//
// Règles d'anonymisation :
//   - Patients, détenus, prévenus → statut + initiales (ex: "le détenu J.D.")
//   - Noms du personnel soignant → conservés intégralement
//   - Visiteurs, inconnus → "le visiteur", "la personne non identifiée"

import { listerEntreesIntervention, listerInterventionsDuService } from './db.js';
import { formatReference } from '../data/referentiels.js';
import { copierDansPressePapier } from './ui.js';

// ─── Anonymisation ────────────────────────────────────────────────────────────

const STATUTS_ANONYMISES = {
  'pat':      'le patient',
  'det':      'le détenu',
  'prev':     'le prévenu',
  'visiteur': 'le visiteur',
  'inconnu':  'la personne non identifiée',
  'inconnue': 'la personne non identifiée',
};

// Génère les initiales depuis "Prénom NOM" → "P.N."
function extraireInitiales(nom) {
  if (!nom || !nom.trim()) return '';
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return '';
  // Prend la première lettre de chaque mot significatif (ignore les particules)
  const particules = ['de', 'du', 'le', 'la', 'les', 'van', 'von', 'di'];
  const initiales = mots
    .filter(m => !particules.includes(m.toLowerCase()))
    .map(m => m[0].toUpperCase())
    .join('.');
  return initiales ? initiales + '.' : '';
}

function anonymiserReference(statut, nom) {
  if (!statut) return null;

  const statutLower = statut.toLowerCase();
  const labelAnon = STATUTS_ANONYMISES[statutLower];

  if (!labelAnon) {
    // Employé, garde tech → conserve tel quel (pas de données patient)
    return formatReference(statut, nom) || null;
  }

  // Visiteur ou inconnu → pas d'initiales
  if (statutLower === 'visiteur' || statutLower === 'inconnu' || statutLower === 'inconnue') {
    return labelAnon;
  }

  // Patient / détenu / prévenu → statut + initiales
  const initiales = extraireInitiales(nom);
  return initiales ? `${labelAnon} ${initiales}` : labelAnon;
}

// ─── Formatage date/heure ─────────────────────────────────────────────────────

function fmtHeure(date) {
  if (!date) return '?';
  const d = new Date(date);
  return `${String(d.getHours()).padStart(2,'0')}h${String(d.getMinutes()).padStart(2,'0')}`;
}

function fmtDate(date) {
  if (!date) return '?';
  const d = new Date(date);
  return d.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDuree(debut, fin) {
  if (!debut || !fin) return null;
  const diffMs  = new Date(fin) - new Date(debut);
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return `${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return m > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${h}h`;
}

// ─── Génération texte pivot — une intervention ────────────────────────────────

export async function genererPivotIntervention(intervention) {
  const entrees = await listerEntreesIntervention(intervention.id);

  const refAnon = anonymiserReference(intervention.referenceStatut, intervention.referenceNom);
  const duree   = fmtDuree(intervention.debut, intervention.fin);

  const lignes = [];

  lignes.push(`[INTERVENTION]`);
  lignes.push(`Date : ${fmtDate(intervention.debut)}`);
  lignes.push(`Début : ${fmtHeure(intervention.debut)}${intervention.fin ? ` | Fin : ${fmtHeure(intervention.fin)}` : ' | En cours'}${duree ? ` | Durée : ${duree}` : ''}`);
  lignes.push(`Lieu : ${intervention.lieu || '—'}`);

  if (refAnon) {
    lignes.push(`Personne concernée : ${refAnon}`);
  }

  if (intervention.risques && intervention.risques.length > 0) {
    const labelsRisques = {
      auto:   'auto-agressif',
      hetero: 'hétéro-agressif',
      fugue:  'fugue'
    };
    const risquesStr = intervention.risques.map(r => labelsRisques[r] || r).join(', ');
    lignes.push(`Risques identifiés : ${risquesStr}${intervention.physiqueForteAutorisee ? ' — physique forte autorisée' : ''}`);
  }

  if (intervention.categorie || intervention.type) {
    const cat = [intervention.categorie, intervention.type].filter(Boolean).join(' / ');
    lignes.push(`Catégorie : ${cat}`);
  }

  if (intervention.description) {
    lignes.push(`Contexte : ${intervention.description}`);
  }

  lignes.push('');
  lignes.push(`[CHRONOLOGIE]`);

  if (entrees.length === 0) {
    lignes.push('(aucune entrée chronologique)');
  } else {
    entrees.forEach(e => {
      lignes.push(`${fmtHeure(e.heure)} — ${e.texte || ''}`);
    });
  }

  return lignes.join('\n');
}

// ─── Génération texte pivot — service complet ─────────────────────────────────

export async function genererPivotService(service) {
  const interventions = await listerInterventionsDuService(service.id);

  const lignes = [];

  // En-tête service
  lignes.push(`═══════════════════════════════════════`);
  lignes.push(`SERVICE : ${service.poste}`);
  lignes.push(`Date : ${fmtDate(service.debut)}`);
  lignes.push(`Prise de service : ${fmtHeure(service.heureDebutService || service.debut)}`);
  if (service.heureFinService) {
    lignes.push(`Fin de service : ${fmtHeure(service.heureFinService)}`);
  }
  lignes.push(`═══════════════════════════════════════`);

  // Transinfo reçue
  if (service.transmissionRecue && service.transmissionRecue.trim()) {
    lignes.push('');
    lignes.push(`[TRANSINFO REÇUE]`);
    lignes.push(service.transmissionRecue.trim());
  }

  // Gardes en cours au moment du service (pour contexte)
  if (Array.isArray(service.gardes) && service.gardes.length > 0) {
    const gardesActives = service.gardes.filter(g => !g.terminee);
    if (gardesActives.length > 0) {
      lignes.push('');
      lignes.push(`[GARDES EN COURS]`);
      gardesActives.forEach(g => {
        const parts = [g.statut, g.lieu ? `${g.batiment || ''} ${g.lieuVal || ''} ${g.lieuSuffixe || ''}`.trim() : null, g.risques].filter(Boolean);
        lignes.push(`• ${parts.join(' | ')}`);
        // Les noms des gardés sont volontairement omis
      });
    }
  }

  // Interventions
  if (interventions.length === 0) {
    lignes.push('');
    lignes.push('(aucune intervention enregistrée sur ce service)');
  } else {
    for (let i = 0; i < interventions.length; i++) {
      lignes.push('');
      lignes.push(`───────────────────────────────────────`);
      lignes.push(`INTERVENTION ${i + 1} / ${interventions.length}`);
      lignes.push(`───────────────────────────────────────`);
      const pivot = await genererPivotIntervention(interventions[i]);
      lignes.push(pivot);
    }
  }

  // Transinfo relève
  if (service.transinfoReleve && service.transinfoReleve.trim()) {
    lignes.push('');
    lignes.push(`[TRANSINFO RELÈVE]`);
    lignes.push(service.transinfoReleve.trim());
  }

  return lignes.join('\n');
}

// ─── Actions de copie ─────────────────────────────────────────────────────────

export async function exporterIntervention(intervention, btnEl = null) {
  try {
    const texte = await genererPivotIntervention(intervention);
    const ok = await copierDansPressePapier(texte, btnEl);
    if (!ok) alert('Échec de la copie. Réessaie.');
    return ok;
  } catch (e) {
    console.error('[Export] Erreur export intervention:', e);
    alert('Erreur lors de la génération de l\'export.');
    return false;
  }
}

export async function exporterService(service, btnEl = null) {
  try {
    const texte = await genererPivotService(service);
    const ok = await copierDansPressePapier(texte, btnEl);
    if (!ok) alert('Échec de la copie. Réessaie.');
    return ok;
  } catch (e) {
    console.error('[Export] Erreur export service:', e);
    alert('Erreur lors de la génération de l\'export.');
    return false;
  }
}
