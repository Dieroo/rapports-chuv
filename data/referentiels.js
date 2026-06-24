// Référentiels statiques de l'app.
// V2 : catégories + types par catégorie, nouveaux statuts référence.

// Les 14 postes de la brigade
export const POSTES = [
  'S250', 'S255', 'S256', 'S257', 'S258', 'S259', 'S260',
  'S261', 'S262', 'S268', 'S270', 'S279', 'S280', 'CH1'
];

// Statuts du champ Référence
export const STATUTS_REFERENCE = [
  { id: 'pat',            label: 'Patient',            prefixe: 'Pat.',          requiresName: true  },
  { id: 'det',            label: 'Détenu',             prefixe: 'Dét.',          requiresName: true  },
  { id: 'prev',           label: 'Prévenu',            prefixe: 'Prév.',         requiresName: true  },
  { id: 'body-packer',    label: 'Body packer',        prefixe: 'Body pack.',    requiresName: true  },
  { id: 'visiteur',       label: 'Visiteur',           prefixe: 'Visiteur',      requiresName: true  },
  { id: 'garde-tech',     label: 'Garde technique',    prefixe: 'Garde tech.',   requiresName: true  },
  { id: 'chef-interv',    label: 'Chef d\'intervention', prefixe: 'Chef interv.', requiresName: true },
  { id: 'emp',            label: 'Employé CHUV',       prefixe: 'Emp.',          requiresName: true  },
  { id: 'inconnu',        label: 'Inconnu (homme)',    literal: 'Inconnu',       requiresName: false },
  { id: 'inconnue',       label: 'Inconnue (femme)',   literal: 'Inconnue',      requiresName: false }
];

// Fonctions médicales
export const FONCTIONS_MEDICALES = [
  'Admissionniste',
  'IDL',
  'Aides en soins',
  'ASSC',
  'Infirmier(ère)',
  'Étud. en médecine',
  'Médecin assistant(e)',
  'Médecin',
  'CDC Adj',
  'CDC',
  'MCU',
  'CDS',
  'ICUS',
  'ICS',
  'Employé(e)'
];

// Catégories OnSphere retenues
export const CATEGORIES = [
  'Assistance',
  'Chantier',
  'Circulation',
  'Divers',
  'Détenu',
  'Exploitation',
  'Feu / inondation / sinistre',
  'Gardiennage',
  'Identité / signalement',
  'Malveillance',
  'Saisie / Confiscation / Remise',
  'Technique',
  'Transmission d\'informations'
];

// Types par catégorie — select contextuel
export const TYPES_PAR_CATEGORIE = {
  'Assistance': [
    'Accompagnement',
    'Accompagnement "cigarette"',
    'Alarme agression intempestive',
    'Alarme agression réelle',
    'Alarme agression test',
    'Assistance autre',
    'Assistance / service d\'ordre',
    'Code Blanc',
    'Défenestration',
    'Fouille',
    'Patient longue durée',
    'Prêt d\'entraves',
    'Recherche de patient',
    'Surveillance par agent hors dispositif',
    'Transfert véhicule',
    'Introduction clandestine',
    'Personne toxicodépendante',
    'PTI Levée de doute'
  ],
  'Chantier': [
    'Chantier autre',
    'Contrôle chantier',
    'Contrôle chantier à feu ouvert',
    'Contrôle chantier listé',
    'Contrôle des chantiers DI hors service',
    'Feu ouvert annoncé / règles non respectés',
    'Non respect des règles / directives',
    'Nuisances'
  ],
  'Circulation': [
    'Accident véhicule(s)',
    'Autre',
    'Embouteillage',
    'Régulation du trafic'
  ],
  'Divers': [
    'Contrôle(s) ordonné(s)',
    'Divers autre',
    'Objet suspect/Colis suspect',
    'Objet trouvé',
    'Prévention vol',
    'Sécurisation "transfert ambulance"',
    'Transport courrier'
  ],
  'Détenu': [
    'Agent mobile',
    'Détenu autre',
    'Garde de détenu',
    'Garde de détenu "body-packers"',
    'Intervention sur détenu non gardé',
    'Service d\'ordre détenu'
  ],
  'Exploitation': [
    'Accompagnement de personne',
    'Accompagnement héliport',
    'Exploitation autre',
    'Procédure isolette',
    'Transport analyses',
    'Transport appareils',
    'Transport autre',
    'Transport chimiothérapie',
    'Transport de fonds'
  ],
  'Feu / inondation / sinistre': [
    'Asservissement',
    'Autre sinistre',
    'Dérangement DI',
    'Essais feu',
    'Feu autre',
    'Fuite de gaz',
    'Fuite hydrocarbure',
    'Fuite produit chimique',
    'Fuite produit radioactif',
    'Grande alarme feu "avec sinistre"',
    'Grande alarme feu "intempestive"',
    'Inondation',
    'Odeur suspecte',
    'Permis feu',
    'Petite alarme feu "avec sinistre"',
    'Petite alarme feu "intempestive"',
    'Risque d\'incendie'
  ],
  'Gardiennage': [
    'Autre',
    'Fermé fenêtre',
    'Fermeture sur demande',
    'Ouverture sur demande',
    'Animaux'
  ],
  'Identité / signalement': [
    'Contrôle(s) d\'identité',
    'Identité / Signalement autre',
    'Signalement'
  ],
  'Malveillance': [
    'Alarme contrôle d\'accès',
    'Alarme effraction',
    'Appel police',
    'Déclaration vol',
    'Déprédation / vandalisme / Tag',
    'Effraction / tentative (hors alarme)',
    'Malveillance autre'
  ],
  'Saisie / Confiscation / Remise': [
    'Alcool',
    'Argent',
    'Arme',
    'Autre',
    'Cannabis légal',
    'Drogue douce',
    'Objet dangereux',
    'Drogue dure'
  ],
  'Technique': [
    'Autre défectuosité',
    'Bon de réparation',
    'Centrale feu / détection',
    'Coulage / fuite',
    'Eclairage défectueux',
    'Fenêtre défectueuse',
    'Inondation',
    'Panne ascenseur',
    'Porte défectueuse'
  ],
  'Transmission d\'informations': [
    'Agent CERY',
    'Agent CPNVD',
    'Agent de surveillance',
    'Agent itinérant',
    'Agent Prangins',
    'Agent SP',
    'Agent Teamleader',
    'Agent URG',
    'CDC',
    'CDS',
    'Securitas encadrement',
    'Securité CHUV',
    'Transmission d\'informations'
  ]
};

// Champs spécifiques au rapport feu — apparaissent si catégorie = 'Feu / inondation / sinistre'
export const CHAMPS_RAPPORT_FEU = [
  { id: 'localAffectation',          label: 'Local affectation' },
  { id: 'contactCDC',                label: 'Contact établi CDC' },
  { id: 'auteur',                    label: 'Auteur' },
  { id: 'cause',                     label: 'Cause' },
  { id: 'degats',                    label: 'Dégâts' },
  { id: 'permisTravauxFeuOuvert',    label: 'Permis de travail feu ouvert' },
  { id: 'consignesSecuriteRespectees', label: 'Consignes de sécurité respectées' },
  { id: 'intervention',              label: 'Intervention' },
  { id: 'remarque',                  label: 'Remarque' }
];

// ─── Cascade lieux (partagée gardes + intervention-edit) ────────────────────

export const BATIMENTS_LISTE = ['BH', 'BU44', 'MAT', 'HO', 'HE', 'NES', 'BT'];

// Statuts utilisés dans le tableau des gardes
export const STATUTS_GARDE = ['Body packer', 'Détenu', 'Patient', 'Prévenu'];

export const LIEUX_PAR_BATIMENT = {
  BH: {
    // Unités spéciales au 05
    prioritaires: [
      { valeur: 'URGC',     type: 'lettre',  lettres: 'ABCDEFGHIJKLM',        label: 'URGC',  prefixe: 'BH/05/URGC-' },
      { valeur: 'URGA',     type: 'lettre',  lettres: 'NOPQRSTUVWXYZ',        label: 'URGA',  prefixe: 'BH/05/URGA-' },
      { valeur: 'URGO',     type: 'select',  options: ['I1','I2','I3','I4'],   label: 'URGO',  prefixe: 'BH/05/URGO-' },
      { valeur: 'UAPC',     type: 'fixe',                                      label: 'UAPC',  prefixe: 'BH/05/UAPC'  },
      { valeur: 'ADMC',     type: 'fixe',                                      label: 'ADMC',  prefixe: 'BH/05/ADMC'  },
      { valeur: 'SIAEST',   type: 'numero',                                    label: 'SIA EST',   prefixe: 'BH/05/SIA EST-'   },
      { valeur: 'SIAOUEST', type: 'numero',                                    label: 'SIA OUEST', prefixe: 'BH/05/SIA OUEST-' },
      { valeur: 'SIASUD',   type: 'numero',                                    label: 'SIA SUD',   prefixe: 'BH/05/SIA SUD-'   },
      { valeur: 'SIPI',     type: 'numero',                                    label: 'SIPI',      prefixe: 'BH/05/SIPI-'      },
    ],
    // Étages 11–19 : chambre libre OU soins intermédiaires (lit 1–20)
    etages: Array.from({ length: 9 }, (_, i) => ({
      valeur: `etage-${11 + i}`,
      label:  `Étage ${11 + i}`,
      numero: String(11 + i),
    })),
    etageOptions: [
      { valeur: 'chambre', label: 'Chambre (n°)', type: 'numero' },
      { valeur: 'sint',    label: 'Soins interm.', type: 'select',
        options: Array.from({ length: 20 }, (_, i) => String(i + 1)) },
    ],
  },
  BU44: {
    prioritaires: [
      { valeur: 'PLI',     type: 'fixe',  label: 'PLI',     prefixe: 'BU44/07/PLI'     },
      { valeur: 'dialyse', type: 'fixe',  label: 'Dialyse', prefixe: 'BU44/07/Dialyse' },
    ],
    etages: Array.from({ length: 6 }, (_, i) => ({
      valeur: `etage-${String(i + 3).padStart(2,'0')}`,
      label:  `Étage ${String(i + 3).padStart(2,'0')}`,
      numero: String(i + 3).padStart(2,'0'),
    })),
    etageOptions: [
      { valeur: 'chambre', label: 'Chambre (n°)', type: 'numero' },
    ],
  },
  NES: {
    prioritaires: [
      { valeur: 'UHPA', type: 'fixe', label: 'UHPA', prefixe: 'NES/UHPA' },
    ],
    etages: Array.from({ length: 10 }, (_, i) => ({
      valeur: `etage-${String(i + 1).padStart(2,'0')}`,
      label:  `Étage ${String(i + 1).padStart(2,'0')}`,
      numero: String(i + 1).padStart(2,'0'),
    })),
    etageOptions: [
      { valeur: 'chambre', label: 'Chambre (n°)', type: 'numero' },
    ],
  },
  MAT: {
    etages: Array.from({ length: 10 }, (_, i) => ({
      valeur: `etage-${String(i + 1).padStart(2,'0')}`,
      label:  `Étage ${String(i + 1).padStart(2,'0')}`,
      numero: String(i + 1).padStart(2,'0'),
    })),
    etageOptions: [
      { valeur: 'chambre', label: 'Chambre (n°)', type: 'numero' },
    ],
  },
  HO: {
    etages: Array.from({ length: 10 }, (_, i) => ({
      valeur: `etage-${String(i + 1).padStart(2,'0')}`,
      label:  `Étage ${String(i + 1).padStart(2,'0')}`,
      numero: String(i + 1).padStart(2,'0'),
    })),
    etageOptions: [
      { valeur: 'chambre', label: 'Chambre (n°)', type: 'numero' },
    ],
  },
  HE: {
    etages: Array.from({ length: 10 }, (_, i) => ({
      valeur: `etage-${String(i + 1).padStart(2,'0')}`,
      label:  `Étage ${String(i + 1).padStart(2,'0')}`,
      numero: String(i + 1).padStart(2,'0'),
    })),
    etageOptions: [
      { valeur: 'chambre', label: 'Chambre (n°)', type: 'numero' },
    ],
  },
  BT: {
    etages: Array.from({ length: 10 }, (_, i) => ({
      valeur: `etage-${String(i + 1).padStart(2,'0')}`,
      label:  `Étage ${String(i + 1).padStart(2,'0')}`,
      numero: String(i + 1).padStart(2,'0'),
    })),
    etageOptions: [
      { valeur: 'chambre', label: 'Chambre (n°)', type: 'numero' },
    ],
  },
};

// Retourne true quand la sélection est complète (→ on peut afficher le chip)
export function lieuEstComplet(batiment, lieuVal, etageOption, suffixe) {
  if (!batiment || !lieuVal) return false;
  if (batiment === '__libre__') return !!(suffixe && suffixe.trim());
  const cfg = LIEUX_PAR_BATIMENT[batiment];
  if (!cfg) return !!(suffixe && suffixe.trim());
  // Prioritaire fixe : complet dès la col2
  if (cfg.prioritaires) {
    const p = cfg.prioritaires.find(x => x.valeur === lieuVal);
    if (p) {
      if (p.type === 'fixe') return true;
      return !!(suffixe && suffixe.trim()); // lettre, select, numero
    }
  }
  // Étage : faut au moins un suffixe (chambre ou lit)
  if (lieuVal.startsWith('etage-')) {
    if (cfg.etageOptions && cfg.etageOptions.length > 1) {
      // BH : faut etageOption + suffixe
      return !!(etageOption && suffixe && suffixe.trim());
    }
    return !!(suffixe && suffixe.trim());
  }
  return false;
}

// Calcule la chaîne lieu finale (ex: "BH/05/URGO-I2", "BH/11/Soins interm./3")
export function composerLieu(batiment, lieuVal, etageOption, suffixe) {
  if (!batiment) return '';
  if (lieuVal === '__libre__') return suffixe || '';
  const cfg = LIEUX_PAR_BATIMENT[batiment];
  if (!cfg) return [batiment, suffixe].filter(Boolean).join('/');

  // Prioritaire (unité spéciale)
  if (cfg.prioritaires) {
    const p = cfg.prioritaires.find(x => x.valeur === lieuVal);
    if (p) {
      if (p.type === 'fixe') return p.prefixe;
      return suffixe ? `${p.prefixe}${suffixe}` : p.prefixe;
    }
  }

  // Étage
  if (lieuVal && lieuVal.startsWith('etage-')) {
    const etageObj = (cfg.etages || []).find(e => e.valeur === lieuVal);
    const etageNum = etageObj ? etageObj.numero : lieuVal.replace('etage-','');
    const etageLabel = etageNum.padStart(2,'0');
    if (!etageOption) return `${batiment}/${etageLabel}`;
    if (etageOption === 'sint') {
      return suffixe ? `${batiment}/${etageLabel}/S.int/${suffixe}` : `${batiment}/${etageLabel}/S.int`;
    }
    // chambre
    return suffixe ? `${batiment}/${etageLabel}/${suffixe}` : `${batiment}/${etageLabel}`;
  }

  return batiment;
}

// Lieux pré-chargés au premier lancement
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

// Format final de la Référence pour le bouton "Copier la Référence"
export function formatReference(statutId, nom) {
  const statut = STATUTS_REFERENCE.find(s => s.id === statutId);
  if (!statut) return (nom || '').trim();
  if (!statut.requiresName) return statut.literal;
  const nomPropre = (nom || '').trim();
  if (!nomPropre) return statut.prefixe;
  return `${statut.prefixe} ${nomPropre}`;
}

// Formate la liste des risques cochés
export function formatRisques(risques, physiqueForte) {
  const labels = {
    'auto':   'auto-agressif',
    'hetero': 'hétéro-agressif',
    'fugue':  'fugue'
  };
  if (!risques || risques.length === 0) {
    return physiqueForte ? 'Physique forte autorisée.' : '';
  }
  const liste = risques.map(r => labels[r]).filter(Boolean).join(', ');
  let phrase = `Risques identifiés : ${liste}.`;
  if (physiqueForte) phrase += ' Physique forte autorisée.';
  return phrase;
}
