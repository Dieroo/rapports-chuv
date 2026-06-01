// Écran Sélection du poste — apparaît à chaque démarrage d'un nouveau service.

import { POSTES } from '../../data/referentiels.js';
import { ouvrirService } from '../db.js';
import { setEcran, setServiceCourant, s } from '../state.js';
import { escapeHtml } from '../ui.js';

export function renderPosteSelector(container) {
  const serviceActuel = s().serviceCourant;
  const aDejaService = !!serviceActuel;

  container.innerHTML = `
    <header class="app-header">
      <div class="app-header-top">
        <h1>Rapports CHUV</h1>
        <div class="selecteur-theme" role="radiogroup" aria-label="Thème de l'application">
          <button type="button" data-theme-set="clair"  aria-label="Mode clair" title="Mode clair">☀</button>
          <button type="button" data-theme-set="auto"   aria-label="Mode automatique" title="Mode automatique">⌗</button>
          <button type="button" data-theme-set="sombre" aria-label="Mode sombre" title="Mode sombre">☾</button>
        </div>
      </div>
    </header>

    <main class="ecran-poste">
      <h2>${aDejaService ? 'Changer de poste' : 'Mon poste pour ce service'}</h2>
      <p class="ecran-poste-aide">
        ${aDejaService
          ? `Sélectionner un nouveau poste terminera le service actuel (${escapeHtml(serviceActuel.poste)}).`
          : 'Choisis le poste que tu occupes ce soir. Tu pourras le changer plus tard.'}
      </p>

      <div class="grille-postes" role="listbox" aria-label="Postes disponibles">
        ${POSTES.map(p => `
          <button type="button" class="bouton-poste" data-poste="${escapeHtml(p)}">
            <span class="poste-code">${escapeHtml(p)}</span>
          </button>
        `).join('')}
      </div>

      ${aDejaService ? `
        <div class="ecran-poste-actions">
          <button type="button" class="btn-secondaire" data-action="annuler">Annuler</button>
        </div>
      ` : ''}
    </main>
  `;

  // Bind clics
  container.querySelectorAll('.bouton-poste').forEach(btn => {
    btn.addEventListener('click', async () => {
      const poste = btn.dataset.poste;
      const nouveau = await ouvrirService(poste);
      setServiceCourant(nouveau);
      setEcran('list');
    });
  });

  const btnAnnuler = container.querySelector('[data-action="annuler"]');
  if (btnAnnuler) {
    btnAnnuler.addEventListener('click', () => setEcran('list'));
  }
}
