// Entry point — Slice 1.a
// Initialise la DB, enregistre le Service Worker, affiche un écran d'accueil minimal.

import { db, diagnostic } from './db.js';
import { POSTES, STATUTS_REFERENCE, LIEUX_PRECHARGES } from '../data/referentiels.js';

// --- Service Worker pour l'installabilité PWA ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[SW] Enregistré, scope:', reg.scope))
      .catch(err => console.warn('[SW] Échec enregistrement:', err));
  });
}

// --- Initialisation de la DB et affichage diagnostic ---
async function init() {
  const racine = document.getElementById('app');

  try {
    // Ouverture explicite de la DB pour s'assurer qu'elle est créée
    await db.open();
    const diag = await diagnostic();

    racine.innerHTML = `
      <header class="app-header">
        <h1>Rapports CHUV</h1>
        <p class="badge">Slice 1.a — Setup minimal</p>
      </header>

      <main class="hello">
        <h2>Prêt à démarrer</h2>
        <p>La base de données locale est initialisée.</p>

        <section class="diag">
          <h3>Diagnostic</h3>
          <dl>
            <dt>Base</dt><dd>${diag.nomBase}</dd>
            <dt>Version schéma</dt><dd>${diag.version}</dd>
            <dt>Stores</dt><dd>${diag.stores.join(', ')}</dd>
            <dt>Services en base</dt><dd>${diag.nbServices}</dd>
            <dt>Interventions en base</dt><dd>${diag.nbInterventions}</dd>
            <dt>Entrées en base</dt><dd>${diag.nbEntrees}</dd>
          </dl>
        </section>

        <section class="diag">
          <h3>Référentiels chargés</h3>
          <dl>
            <dt>Postes brigade</dt><dd>${POSTES.length} (${POSTES.join(', ')})</dd>
            <dt>Statuts Référence</dt><dd>${STATUTS_REFERENCE.length}</dd>
            <dt>Lieux pré-chargés</dt><dd>${LIEUX_PRECHARGES.length}</dd>
          </dl>
        </section>

        <p class="note">
          La suite (sélecteur de poste, écran liste, saisie d'intervention) arrive
          aux étapes 1.b → 1.d.
        </p>
      </main>
    `;

    console.log('[App] Initialisée', diag);
  } catch (err) {
    console.error('[App] Échec initialisation', err);
    racine.innerHTML = `
      <main class="erreur">
        <h2>Erreur d'initialisation</h2>
        <pre>${escapeHtml(String(err))}</pre>
      </main>
    `;
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

init();
