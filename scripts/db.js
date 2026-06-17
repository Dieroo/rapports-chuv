// Couche d'accès IndexedDB via Dexie.
// Trois stores : services, interventions, entrees.

const Dexie = window.Dexie;

if (!Dexie) {
  throw new Error('Dexie non chargé — vérifier que scripts/lib/dexie.min.js est inclus avant scripts/db.js');
}

export const db = new Dexie('RapportsCHUV');

db.version(1).stores({
  services:       '++id, poste, debut, fin',
  interventions:  '++id, serviceId, debut, fin, lieu, referenceStatut',
  entrees:        '++id, interventionId, heure'
});

// Version 2 — Slice 4 : bloc service (transmission + notes + tâches) + bibliothèque tâches récurrentes
db.version(2).stores({
  services:           '++id, poste, debut, fin',
  interventions:      '++id, serviceId, debut, fin, lieu, referenceStatut',
  entrees:            '++id, interventionId, heure',
  tachesRecurrentes:  '++id, &texte, compteur, derniereUtilisation, epinglee'
}).upgrade(async (tx) => {
  // Initialise les champs nouveaux sur tous les services existants
  await tx.table('services').toCollection().modify(s => {
    if (s.transmissionRecue == null) s.transmissionRecue = '';
    if (s.notesService == null) s.notesService = '';
    if (!Array.isArray(s.taches)) s.taches = [];
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

export async function ouvrirService(poste) {
  const maintenant = new Date();
  // Ferme implicitement tout service ouvert précédent (mécanique 3 du cadrage)
  await db.services
    .filter(s => s.fin == null)
    .modify({ fin: maintenant });
  const id = await db.services.add({
    poste,
    debut: maintenant,
    fin: null,
    transmissionRecue: '',
    notesService: '',
    taches: []
  });
  return await db.services.get(id);
}

export async function terminerServiceCourant() {
  const maintenant = new Date();
  return await db.services
    .filter(s => s.fin == null)
    .modify({ fin: maintenant });
}

// Met à jour un service (champs partiels).
export async function majService(id, patch) {
  await db.services.update(id, patch);
  return await db.services.get(id);
}

export async function getService(id) {
  return await db.services.get(id);
}

// === Tâches récurrentes (Slice 4b) ===
//
// Bibliothèque alimentée à chaque AJOUT d'une tâche dans un service.
// Texte unique (index `&texte`). Si une tâche du même libellé est créée à
// nouveau, le compteur s'incrémente et la dernière utilisation est mise à jour.

export async function enregistrerTacheRecurrente(texte) {
  const t = (texte || '').trim();
  if (!t) return null;
  const existante = await db.tachesRecurrentes.where('texte').equals(t).first();
  if (existante) {
    await db.tachesRecurrentes.update(existante.id, {
      compteur: (existante.compteur || 0) + 1,
      derniereUtilisation: new Date()
    });
    return await db.tachesRecurrentes.get(existante.id);
  } else {
    const id = await db.tachesRecurrentes.add({
      texte: t,
      compteur: 1,
      derniereUtilisation: new Date(),
      epinglee: 0     // 0/1 en base (les booleans Dexie indexés sont mal supportés)
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
    // Créée à la volée (cas où l'utilisateur épingle une tâche encore sans historique)
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
    serviceId: donnees.serviceId,
    lieu: donnees.lieu || '',
    referenceStatut: donnees.referenceStatut || null,
    referenceNom: donnees.referenceNom || '',
    categorie: donnees.categorie || null,
    type: donnees.type || '',
    description: donnees.description || '',
    numeroOnsphere: donnees.numeroOnsphere || '',
    debut: donnees.debut || new Date(),
    fin: null,
    risques: donnees.risques || [],
    physiqueForteAutorisee: donnees.physiqueForteAutorisee || false
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
  // Cascade : supprime aussi les entrées chronologiques liées
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

// Liste des interventions des N derniers jours, toutes confondues, triées du plus récent au plus ancien.
export async function listerInterventionsRecentes(jours = 7) {
  const depuis = new Date(Date.now() - jours * 24 * 60 * 60 * 1000);
  return await db.interventions
    .where('debut').above(depuis)
    .reverse()
    .sortBy('debut');
}

// Liste tous les lieux historiquement utilisés (avec compteurs).
// Utilisé par lieux-store.js pour l'autocomplétion par récurrence.
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

// Purge automatique au-delà de 3 mois.
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
    heure: heure || new Date(),
    texte: texte || '',
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

// === Diagnostic (utilisé seulement en dev) ===

export async function diagnostic() {
  return {
    nomBase: db.name,
    version: db.verno,
    stores: db.tables.map(t => t.name),
    nbServices: await db.services.count(),
    nbInterventions: await db.interventions.count(),
    nbEntrees: await db.entrees.count(),
    nbTachesRecurrentes: await db.tachesRecurrentes.count()
  };
}
