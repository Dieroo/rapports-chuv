// Couche d'accès IndexedDB via Dexie.
// Trois stores : services, interventions, entrees.

const Dexie = window.Dexie;

if (!Dexie) {
  throw new Error('Dexie non chargé — vérifier que scripts/lib/dexie.min.js est inclus avant scripts/db.js');
}

export const db = new Dexie('RapportsCHUV');

db.version(1).stores({
  services:      '++id, poste, debut, fin',
  interventions: '++id, serviceId, debut, fin, lieu, referenceStatut',
  entrees:       '++id, interventionId, heure'
});

// Version 2 — Slice 4 : bloc service (transmission + notes + tâches) + bibliothèque tâches récurrentes
db.version(2).stores({
  services:             '++id, poste, debut, fin',
  interventions:        '++id, serviceId, debut, fin, lieu, referenceStatut',
  entrees:              '++id, interventionId, heure',
  tachesRecurrentes:    '++id, &texte, compteur, derniereUtilisation, epinglee'
}).upgrade(async (tx) => {
  await tx.table('services').toCollection().modify(s => {
    if (s.transmissionRecue == null)  s.transmissionRecue  = '';
    if (s.notesService    == null)    s.notesService        = '';
    if (!Array.isArray(s.taches))     s.taches              = [];
  });
});

// Version 3 — Slice 5 : champ renforts sur interventions
db.version(3).stores({
  services:             '++id, poste, debut, fin',
  interventions:        '++id, serviceId, debut, fin, lieu, referenceStatut',
  entrees:              '++id, interventionId, heure',
  tachesRecurrentes:    '++id, &texte, compteur, derniereUtilisation, epinglee'
}).upgrade(async (tx) => {
  await tx.table('interventions').toCollection().modify(i => {
    if (!Array.isArray(i.renforts)) i.renforts = [];
  });
});

// Version 4 — Tableau gardes + heures prise/fin de service + transinfo relève
db.version(4).stores({
  services:             '++id, poste, debut, fin',
  interventions:        '++id, serviceId, debut, fin, lieu, referenceStatut',
  entrees:              '++id, interventionId, heure',
  tachesRecurrentes:    '++id, &texte, compteur, derniereUtilisation, epinglee'
}).upgrade(async (tx) => {
  await tx.table('services').toCollection().modify(s => {
    if (!Array.isArray(s.gardes))          s.gardes             = [];
    if (s.heureDebutService   == null)     s.heureDebutService   = null;
    if (s.heureFinService     == null)     s.heureFinService     = null;
    if (s.transitionRecepte   == null)     s.transmissionRecue   = s.transmissionRecue || '';
    if (s.transinfoReleve     == null)     s.transinfoReleve     = '';
  });
});

// Version 5 — Champs rapport feu sur intervention
db.version(5).stores({
  services:             '++id, poste, debut, fin',
  interventions:        '++id, serviceId, debut, fin, lieu, referenceStatut',
  entrees:              '++id, interventionId, heure',
  tachesRecurrentes:    '++id, &texte, compteur, derniereUtilisation, epinglee'
}).upgrade(async (tx) => {
  await tx.table('interventions').toCollection().modify(i => {
    if (!i.rapportFeu) i.rapportFeu = null;
  });
});

// Version 6 — Champ horsRapport sur les entrées (transferts pour examen)
db.version(6).stores({
  services:             '++id, poste, debut, fin',
  interventions:        '++id, serviceId, debut, fin, lieu, referenceStatut',
  entrees:              '++id, interventionId, heure',
  tachesRecurrentes:    '++id, &texte, compteur, derniereUtilisation, epinglee'
}).upgrade(async (tx) => {
  await tx.table('entrees').toCollection().modify(e => {
    if (e.horsRapport == null) e.horsRapport = false;
  });
});

// === Services ===

export async function getServiceOuvert() {
  return await db.services
    .filter(s => s.fin == null)
    .reverse()
    .sortBy('debut')
    .then(arr => arr[0] || null);
}

export async function ouvrirService(poste, heureDebut = null) {
  const maintenant = new Date();

  // Ferme implicitement tout service ouvert précédent
  await db.services
    .filter(s => s.fin == null)
    .modify({ fin: maintenant });

  const id = await db.services.add({
    poste,
    debut:             maintenant,
    fin:               null,
    heureDebutService: heureDebut || maintenant,
    heureFinService:   null,
    transmissionRecue: '',
    notesService:      '',
    transinfoReleve:   '',
    taches:            [],
    gardes:            []
  });

  return await db.services.get(id);
}

export async function terminerServiceCourant(heureFin = null) {
  const maintenant = heureFin || new Date();
  return await db.services
    .filter(s => s.fin == null)
    .modify({ fin: maintenant, heureFinService: maintenant });
}

// Met à jour un service (champs partiels).
export async function majService(id, patch) {
  await db.services.update(id, patch);
  return await db.services.get(id);
}

export async function getService(id) {
  return await db.services.get(id);
}

// Liste tous les services triés du plus récent au plus ancien
export async function listerServices() {
  return await db.services.orderBy('debut').reverse().toArray();
}

// === Tâches récurrentes ===

export async function enregistrerTacheRecurrente(texte, repetitions = 1) {
  const t = (texte || '').trim();
  if (!t) return null;
  const n = Math.max(1, Math.min(99, parseInt(repetitions, 10) || 1));

  const existante = await db.tachesRecurrentes.where('texte').equals(t).first();
  if (existante) {
    await db.tachesRecurrentes.update(existante.id, {
      compteur: (existante.compteur || 0) + 1,
      derniereUtilisation: new Date(),
      repetitions: n   // met à jour si l'utilisateur a changé le nombre
    });
    return await db.tachesRecurrentes.get(existante.id);
  } else {
    const id = await db.tachesRecurrentes.add({
      texte: t,
      compteur: 1,
      derniereUtilisation: new Date(),
      epinglee: 0,
      repetitions: n
    });
    return await db.tachesRecurrentes.get(id);
  }
}

export async function listerTachesRecurrentes() {
  return await db.tachesRecurrentes.toArray();
}

export async function setEpinglageTacheRecurrente(id, epingle) {
  await db.tachesRecurrentes.update(id, { epinglee: epingle ? 1 : 0 });
  return await db.tachesRecurrentes.get(id);
}

export async function setEpinglageTacheRecurrenteParTexte(texte, epingle) {
  const t = (texte || '').trim();
  if (!t) return null;
  let existante = await db.tachesRecurrentes.where('texte').equals(t).first();
  if (!existante) {
    const id = await db.tachesRecurrentes.add({
      texte: t, compteur: 0, derniereUtilisation: new Date(),
      epinglee: epingle ? 1 : 0
    });
    existante = await db.tachesRecurrentes.get(id);
  } else {
    await db.tachesRecurrentes.update(existante.id, { epinglee: epingle ? 1 : 0 });
    existante = await db.tachesRecurrentes.get(existante.id);
  }
  return existante;
}

export async function supprimerTacheRecurrente(id) {
  await db.tachesRecurrentes.delete(id);
}

// === Interventions ===

export async function creerIntervention(donnees) {
  const id = await db.interventions.add({
    serviceId:               donnees.serviceId,
    lieu:                    donnees.lieu || '',
    referenceStatut:         donnees.referenceStatut || null,
    referenceNom:            donnees.referenceNom || '',
    categorie:               donnees.categorie || null,
    type:                    donnees.type || '',
    description:             donnees.description || '',
    debut:                   donnees.debut || new Date(),
    fin:                     null,
    risques:                 donnees.risques || [],
    physiqueForteAutorisee:  donnees.physiqueForteAutorisee || false
  });
  return await db.interventions.get(id);
}

export async function majIntervention(id, patch) {
  await db.interventions.update(id, patch);
  return await db.interventions.get(id);
}

export async function terminerIntervention(id) {
  await db.interventions.update(id, { fin: new Date() });
  return await db.interventions.get(id);
}

export async function supprimerIntervention(id) {
  await db.transaction('rw', db.interventions, db.entrees, async () => {
    await db.entrees.where('interventionId').equals(id).delete();
    await db.interventions.delete(id);
  });
}

export async function getIntervention(id) {
  return await db.interventions.get(id);
}

export async function listerInterventionsDuService(serviceId) {
  return await db.interventions
    .where('serviceId').equals(serviceId)
    .reverse()
    .sortBy('debut');
}

export async function listerInterventionsRecentes(jours = 7) {
  const depuis = new Date(Date.now() - jours * 24 * 60 * 60 * 1000);
  return await db.interventions
    .where('debut').above(depuis)
    .reverse()
    .sortBy('debut');
}

export async function listerLieuxUtilises() {
  const tous = await db.interventions.toArray();
  const compteurs = new Map();
  tous.forEach(i => {
    const lieu = (i.lieu || '').trim();
    if (!lieu) return;
    const existant = compteurs.get(lieu);
    if (!existant) {
      compteurs.set(lieu, { lieu, count: 1, lastUsed: i.debut });
    } else {
      existant.count++;
      if (i.debut > existant.lastUsed) existant.lastUsed = i.debut;
    }
  });
  return Array.from(compteurs.values());
}

export async function purgerAncienne() {
  const limite = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  await db.transaction('rw', db.interventions, db.entrees, db.services, async () => {
    const interventionsAnciennes = await db.interventions
      .where('debut').below(limite).toArray();
    for (const inter of interventionsAnciennes) {
      await db.entrees.where('interventionId').equals(inter.id).delete();
      await db.interventions.delete(inter.id);
    }
    await db.services.where('debut').below(limite).delete();
  });
}

// === Entrées chronologiques ===

export async function ajouterEntree(interventionId, texte, template = null, heure = null) {
  const id = await db.entrees.add({
    interventionId,
    heure:    heure || new Date(),
    texte:    texte || '',
    template
  });
  return await db.entrees.get(id);
}

export async function majEntree(id, patch) {
  await db.entrees.update(id, patch);
  return await db.entrees.get(id);
}

export async function supprimerEntree(id) {
  await db.entrees.delete(id);
}

export async function listerEntreesIntervention(interventionId) {
  return await db.entrees
    .where('interventionId').equals(interventionId)
    .sortBy('heure');
}

// === Diagnostic (dev) ===

export async function diagnostic() {
  return {
    nomBase:              db.name,
    version:              db.verno,
    stores:               db.tables.map(t => t.name),
    nbServices:           await db.services.count(),
    nbInterventions:      await db.interventions.count(),
    nbEntrees:            await db.entrees.count(),
    nbTachesRecurrentes:  await db.tachesRecurrentes.count()
  };
}
