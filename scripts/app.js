// Entry point — Slice 1+2+3 V1 test terrain.
// Routing minimal entre les 3 écrans (poste-selector / list / intervention-edit).

import { db, getServiceOuvert, purgerAncienne } from './db.js';
import { setEcran, setServiceCourant, subscribe, s } from './state.js';
import { initThemeSelector } from './theme.js';
import { renderPosteSelector } from './screens/poste-selector.js';
import { renderInterventionList } from './screens/intervention-list.js';
import { renderInterventionEdit } from './screens/intervention-edit.js';

// --- Service Worker pour l'installabilité PWA + offline ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[SW] Enregistré, scope:', reg.scope))
      .catch(err => console.warn('[SW] Échec enregistrement:', err));
  });
}

// --- Routing : rendre l'écran courant ---
async function rendreEcranCourant() {
  const racine = document.getElementById('app');
  const ecran = s().ecranCourant;
  try {
    if (ecran === 'poste-selector') {
      renderPosteSelector(racine);
    } else if (ecran === 'list') {
      await renderInterventionList(racine);
    } else if (ecran === 'intervention-edit') {
      await renderInterventionEdit(racine);
    }
    // Re-bind les boutons de thème après chaque rendu
    initThemeSelector();
  } catch (err) {
    console.error('[App] Erreur rendu:', err);
    racine.innerHTML = `
      <main class="erreur">
        <h2>Erreur d'affichage</h2>
        <pre>${String(err)}</pre>
        <button class="btn-primaire" onclick="location.reload()">Recharger</button>
      </main>
    `;
  }
}

// Observer : à chaque changement d'état, on rerendre l'écran courant
subscribe(rendreEcranCourant);

// --- Initialisation ---
async function init() {
  try {
    await db.open();

    // Purge des données >3 mois (silencieux, en arrière-plan)
    purgerAncienne().catch(e => console.warn('[Purge] échec:', e));

    // Détecte s'il y a un service ouvert
    const service = await getServiceOuvert();
    if (service) {
      setServiceCourant(service);
      setEcran('list');
    } else {
      setEcran('poste-selector');
    }

    console.log('[App] Initialisée. Service ouvert:', service ? service.poste : 'aucun');
  } catch (err) {
    console.error('[App] Échec init:', err);
    document.getElementById('app').innerHTML = `
      <main class="erreur">
        <h2>Erreur d'initialisation</h2>
        <pre>${String(err)}</pre>
      </main>
    `;
  }
}

init();
