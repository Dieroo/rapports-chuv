// État global de l'app et routing interne minimal.
// Pas de framework, juste un objet + observers.

const ECRANS = ['poste-selector', 'list', 'intervention-edit'];

const state = {
  ecranCourant:          'list',   // 'poste-selector' | 'list' | 'intervention-edit'
  serviceCourant:        null,     // objet Service ou null
  interventionCouranteId: null,    // id de l'intervention en édition
  gardesAConserver:      null,     // gardes à reporter sur le prochain service (changement de poste)
  observers:             []
};

export function s() {
  return state;
}

export function setEcran(nom, options = {}) {
  if (!ECRANS.includes(nom)) {
    throw new Error(`Écran inconnu : ${nom}`);
  }
  state.ecranCourant = nom;

  if (options.interventionId !== undefined) {
    state.interventionCouranteId = options.interventionId;
  }
  if (options.gardesAConserver !== undefined) {
    state.gardesAConserver = options.gardesAConserver;
  }

  notifier();
}

export function setServiceCourant(service) {
  state.serviceCourant = service;
  notifier();
}

export function setInterventionCourante(id) {
  state.interventionCouranteId = id;
  notifier();
}

export function subscribe(fn) {
  state.observers.push(fn);
  return () => {
    state.observers = state.observers.filter(o => o !== fn);
  };
}

function notifier() {
  state.observers.forEach(fn => {
    try { fn(state); } catch (e) { console.error('[State] Observer error:', e); }
  });
}
