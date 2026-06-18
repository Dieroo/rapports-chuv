// Écran Sélection du poste — prise de service avec heure standard + conservation gardes.

import { POSTES } from '../../data/referentiels.js';
import { ouvrirService, majService } from '../db.js';
import { setEcran, setServiceCourant, s } from '../state.js';
import { escapeHtml, formatHeureInput } from '../ui.js';

// Heures standard par poste (même constante que dans intervention-list.js)
const HEURES_SERVICES = {
  S255: { debut: [5,  45], fin: [15,  0] },
  S256: { debut: [14, 30], fin: [23, 30] },
  S257: { debut: [22, 45], fin: [7,  30] },
  S250: { debut: [7,   0], fin: [19,  0] },
};

function hmToString([h, m]) {
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function heureStandardDebut(poste) {
  return HEURES_SERVICES[poste]?.debut || null;
}

// Dialog prise de service avec confirmation et heure pré-remplie
function ouvrirDialogPrise(poste, onConfirmer) {
  const hm     = heureStandardDebut(poste);
  const valDef = hm ? hmToString(hm) : formatHeureInput(new Date());

  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.innerHTML = `
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-prise-titre">
      <div class="dialog-titre" id="dialog-prise-titre">Prise de service — ${escapeHtml(poste)}</div>
      <div class="dialog-contenu">
        <label class="champ">
          <span class="champ-label">Heure de prise de service</span>
          <input type="time" id="d-prise-heure" value="${valDef}" />
        </label>
        ${hm
          ? `<p class="dialog-hint">Heure standard : ${hmToString(hm)}. Modifie si différent.</p>`
          : `<p class="dialog-hint">Aucune heure standard pour ce poste. Saisis l'heure manuellement.</p>`
        }
      </div>
      <div class="dialog-actions">
        <button type="button" class="btn-secondaire" data-dialog="annuler">Annuler</button>
        <button type="button" class="btn-primaire"   data-dialog="confirmer">Confirmer la prise</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const fermer = () => overlay.remove();

  overlay.querySelector('[data-dialog="annuler"]').addEventListener('click', fermer);
  overlay.querySelector('[data-dialog="confirmer"]').addEventListener('click', () => {
    const heureStr = overlay.querySelector('#d-prise-heure').value;
    fermer();
    onConfirmer(heureStr);
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) fermer(); });
  setTimeout(() => overlay.querySelector('input')?.focus(), 50);
}

export function renderPosteSelector(container) {
  const serviceActuel  = s().serviceCourant;
  const aDejaService   = !!serviceActuel;
  // gardesAConserver : passé via options lors d'un changement de poste avec conservation
  const gardesAConserver = s().gardesAConserver || null;

  container.innerHTML = `
    <header class="app-header">
      <div class="app-header-top">
        <h1>Rapports CHUV</h1>
        <div class="selecteur-theme" role="radiogroup" aria-label="Thème de l'application">
          <button type="button" data-theme-set="clair"  aria-label="Mode clair"        title="Mode clair">☀</button>
          <button type="button" data-theme-set="auto"   aria-label="Mode automatique"  title="Mode automatique">⌗</button>
          <button type="button" data-theme-set="sombre" aria-label="Mode sombre"       title="Mode sombre">☾</button>
        </div>
      </div>
    </header>

    <main class="ecran-poste">
      <h2>${aDejaService ? 'Changer de poste' : 'Mon poste pour ce service'}</h2>
      <p class="ecran-poste-aide">
        ${aDejaService
          ? `Sélectionner un nouveau poste terminera le service actuel (${escapeHtml(serviceActuel.poste)}).`
          : 'Choisis le poste que tu occupes pour ce service.'}
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

  // Clic sur un poste → dialog prise de service → ouvrirService
  container.querySelectorAll('.bouton-poste').forEach(btn => {
    btn.addEventListener('click', () => {
      const poste = btn.dataset.poste;
      ouvrirDialogPrise(poste, async (heureStr) => {
        // Construit l'objet Date pour l'heure de prise
        const [h, m] = heureStr.split(':').map(Number);
        const heureDebut = new Date();
        heureDebut.setHours(h, m, 0, 0);

        // Crée le nouveau service
        const nouveau = await ouvrirService(poste, heureDebut);

        // Si des gardes sont à conserver, on les patch tout de suite
        if (gardesAConserver && gardesAConserver.length > 0) {
          await majService(nouveau.id, { gardes: gardesAConserver });
          nouveau.gardes = gardesAConserver;
        }

        // Nettoie gardesAConserver de l'état
        s().gardesAConserver = null;

        setServiceCourant(nouveau);
        setEcran('list');
      });
    });
  });

  // Annuler
  container.querySelector('[data-action="annuler"]')?.addEventListener('click', () => {
    s().gardesAConserver = null;
    setEcran('list');
  });
}
