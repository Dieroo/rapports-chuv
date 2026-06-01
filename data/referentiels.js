// Référentiels statiques de l'app — V1
// À enrichir en Slice 2 (autocomplétion lieux) et Slice 3 (templates)

// Les 14 postes de la brigade. Pas de doublures (Dieroo ne les fait pas).
export const POSTES = [
  'S250', 'S255', 'S256', 'S257', 'S258', 'S259', 'S260',
  'S261', 'S262', 'S268', 'S270', 'S279', 'S280', 'CH1'
];

// Statuts du champ Référence — détermine le préfixe collé dans OnSphere.
// `requiresName: true`  → format `${prefixe} ${nom}` (ex: "Pat. Marie DUPONT")
// `requiresName: false` → valeur littérale, ignore le nom (ex: "Inconnu")
export const STATUTS_REFERENCE = [
  { id: 'pat',         label: 'Patient',           prefixe: 'Pat.',         requiresName: true  },
  { id: 'det',         label: 'Détenu',            prefixe: 'Dét.',         requiresName: true  },
  { id: 'prev',        label: 'Prévenu',           prefixe: 'Prév.',        requiresName: true  },
  { id: 'visiteur',    label: 'Visiteur',          prefixe: 'Visiteur',     requiresName: true  },
  { id: 'garde-tech',  label: 'Garde technique',   prefixe: 'Garde tech.',  requiresName: true  },
  { id: 'emp',         label: 'Employé CHUV',      prefixe: 'Emp.',         requiresName: true  },
  { id: 'inconnu',     label: 'Inconnu (homme)',   literal: 'Inconnu',      requiresName: false },
  { id: 'inconnue',    label: 'Inconnue (femme)',  literal: 'Inconnue',     requiresName: false }
];

// Lieux pré-chargés en V1 — base de départ pour l'autocomplétion (Slice 2).
// Les espaces de fin sont volontaires : les suffixes variables (box A-M, lit 1-8…)
// se complètent à la saisie.
export const LIEUX_PRECHARGES = [
  'BU44/07/PLI',
  'BH/05/URGC Box ',
  'BH/05/URGA Box ',
  'BH/05/URGO I1',
  'BH/05/URGO I2',
  'BH/05/URGO I3',
  'BH/05/URGO I4',
  'BU44/05/ADMD',
  'BH/05/ADMC',
  'BH/05/UAPC ',
  'NES/02/UHPA',
  'BH/05/SIA EST ',
  'BH/05/SIA OUEST ',
  'BH/05/SIA SUD '
];

// Format final de la Référence pour le bouton "Copier la Référence".
// Si pas de statut sélectionné, retourne le nom brut (ou vide).
export function formatReference(statutId, nom) {
  const statut = STATUTS_REFERENCE.find(s => s.id === statutId);
  if (!statut) return (nom || '').trim();
  if (!statut.requiresName) return statut.literal;
  const nomPropre = (nom || '').trim();
  if (!nomPropre) return statut.prefixe;
  return `${statut.prefixe} ${nomPropre}`;
}
