// Générateurs de phrases pour le workflow Surveillance patient.
// Chaque fonction retourne le texte à insérer comme entrée chronologique.
// Le poste {S[moi]} est passé en paramètre depuis le service courant.

import { formatRisques } from '../data/referentiels.js';

export const TEMPLATES = {
  engagement: {
    label: 'Engagement',
    description: 'Engagement par CDS ou médical en direct'
  },
  surPlace: {
    label: 'Sur place',
    description: 'Contact établi avec le personnel médical'
  },
  risques: {
    label: 'Risques',
    description: 'Risques identifiés + physique forte'
  },
  transmissionCDS: {
    label: 'Transmission CDS',
    description: 'Transmission radio au CDS'
  },
  transfert: {
    label: 'Transfert',
    description: 'Transfert du patient vers un autre lieu'
  },
  noteLibre: {
    label: 'Note libre',
    description: 'Entrée chronologique libre'
  },
  releveBrigade: {
    label: 'Relève brigade',
    description: 'Relevé par un agent de brigade'
  },
  releveSP: {
    label: 'Relève SP',
    description: 'Relevé par un agent de surveillance patient'
  },
  finMedical: {
    label: 'Fin par médical',
    description: 'Le médical met fin à la surveillance'
  },
  transfertAmbulance: {
    label: 'Transfert ambulance',
    description: 'Transfert vers un autre hôpital par ambulance'
  }
};

// Engagement par CDS ou médical
export function phraseEngagement({ source, motif }) {
  // source = 'cds' | 'medical'
  const par = source === 'medical' ? 'le médical en direct' : "l'opérateur CDS";
  const sufMotif = motif && motif.trim() ? `, ${motif.trim()}` : '';
  return `Engagement par ${par}${sufMotif}.`;
}

// Sur place / contact établi
export function phraseSurPlace({ posteMoi, fonction, nom }) {
  let phrase = `${posteMoi} sur place. Contact établi`;
  if (fonction || nom) {
    const personne = [fonction, nom].filter(x => x && x.trim()).join(' ').trim();
    phrase += ` avec ${personne}`;
  }
  phrase += '.';
  return phrase;
}

// Risques identifiés
export function phraseRisques({ risques, physiqueForte }) {
  const r = formatRisques(risques, physiqueForte);
  return r || 'Aucun risque particulier signalé.';
}

// Transmission radio au CDS
export function phraseTransmissionCDS({ posteMoi }) {
  return `${posteMoi} : transmission radio au CDS effectuée.`;
}

// Transfert du patient vers un nouveau lieu
export function phraseTransfert({ nouveauLieu }) {
  return `Transfert du patient vers ${nouveauLieu}.`;
}

// Relève par un agent de brigade
export function phraseReleveBrigade({ posteMoi, posteRelevant }) {
  return `${posteMoi} relevé par ${posteRelevant}.`;
}

// Relève par un agent de surveillance patient (SP)
export function phraseReleveSP({ posteMoi, matriculeSP }) {
  return `${posteMoi} relevé par agent SP matricule ${matriculeSP}. Mise en place et sécurisation de l'environnement effectuées selon procédure.`;
}

// Fin par médical
export function phraseFinMedical({ fonction, nom }) {
  const personne = [fonction, nom].filter(x => x && x.trim()).join(' ').trim();
  if (!personne) {
    return `Le médical annonce la fin de la surveillance et me libère. Fin d'intervention.`;
  }
  const article = /^[aeiouhAEIOUH]/.test(personne) ? "L'" : 'Le ';
  return `${article}${personne} annonce la fin de la surveillance et me libère. Fin d'intervention.`;
}

// Transfert ambulance (sécurisé / non sécurisé)
export function phraseTransfertAmbulance({ securise, destination }) {
  const type = securise ? 'sécurisé' : 'non sécurisé';
  const dest = destination && destination.trim() ? destination.trim() : 'un autre établissement';
  return `Arrivée des ambulanciers. Transfert ${type} du patient vers ${dest}.`;
}
