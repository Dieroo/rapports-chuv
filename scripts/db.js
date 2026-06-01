// Couche d'accès IndexedDB via Dexie.
// Trois stores : services, interventions, entrees.
// Schéma versionné dès la V1 pour pouvoir migrer plus tard.

// Dexie est exposé en global par /scripts/lib/dexie.min.js (chargé avant ce fichier en non-module).
// Pour la V1 on utilise ES modules + import dynamique du global.
const Dexie = window.Dexie;

if (!Dexie) {
  throw new Error('Dexie non chargé — vérifier que scripts/lib/dexie.min.js est inclus avant scripts/db.js');
}

export const db = new Dexie('RapportsCHUV');

// V1 du schéma — ne pas modifier rétroactivement, créer une v2 si besoin.
// Les champs listés sont des INDEX (pour requêtes rapides). Les autres champs
// existent dans l'objet stocké sans être indexés.
db.version(1).stores({
  // ++id = clé auto-incrémentée
  // poste, debut, fin = index secondaires utiles pour filtrer/trier
  services:       '++id, poste, debut, fin',
  interventions:  '++id, serviceId, debut, fin, lieu, referenceStatut',
  entrees:        '++id, interventionId, heure'
});

// Helpers d'accès — toutes les fonctions retournent des Promises.

export async function getServiceOuvert() {
  // Le service "ouvert" est celui dont fin est null.
  // S'il y en a plusieurs (anomalie), retourne le plus récent.
  return await db.services
    .filter(s => s.fin == null)
    .reverse()
    .sortBy('debut')
    .then(arr => arr[0] || null);
}

export async function ouvrirService(poste) {
  // Ferme implicitement tout service ouvert précédent (mécanique 3 du cadrage)
  // puis crée le nouveau service.
  const maintenant = new Date();

  await db.services
    .filter(s => s.fin == null)
    .modify({ fin: maintenant });

  const id = await db.services.add({
    poste,
    debut: maintenant,
    fin: null,
    transmissionRecue: ''
  });
  return await db.services.get(id);
}

export async function listerServicesRecents(limite = 50) {
  return await db.services
    .orderBy('debut')
    .reverse()
    .limit(limite)
    .toArray();
}

export async function creerIntervention(donnees) {
  const id = await db.interventions.add({
    serviceId: donnees.serviceId,
    lieu: donnees.lieu || '',
    referenceStatut: donnees.referenceStatut || null,
    referenceNom: donnees.referenceNom || '',
    categorie: donnees.categorie || null,
    type: donnees.type || null,
    description: donnees.description || '',
    numeroOnsphere: donnees.numeroOnsphere || '',
    debut: donnees.debut || new Date(),
    fin: null,
    risques: donnees.risques || [],
    physiqueForteAutorisee: donnees.physiqueForteAutorisee || false
  });
  return await db.interventions.get(id);
}

export async function listerInterventionsDuService(serviceId) {
  return await db.interventions
    .where('serviceId').equals(serviceId)
    .reverse()
    .sortBy('debut');
}

export async function ajouterEntree(interventionId, texte) {
  const id = await db.entrees.add({
    interventionId,
    heure: new Date(),
    texte: texte || '',
    template: null
  });
  return await db.entrees.get(id);
}

export async function listerEntreesIntervention(interventionId) {
  return await db.entrees
    .where('interventionId').equals(interventionId)
    .sortBy('heure');
}

// Diagnostic pour la 1.a — à retirer plus tard.
export async function diagnostic() {
  return {
    nomBase: db.name,
    version: db.verno,
    stores: db.tables.map(t => t.name),
    nbServices: await db.services.count(),
    nbInterventions: await db.interventions.count(),
    nbEntrees: await db.entrees.count()
  };
}
