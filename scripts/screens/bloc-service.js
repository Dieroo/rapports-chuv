// Slice 4 — Bloc "Mon service"
// 3 sections repliables : transmission reçue, notes du service, tâches.
// Bandeau optionnel : "Reprendre vos tâches récurrentes ?" si applicable.
//
// Le composant gère son propre rerender local sans recharger toute la liste
// d'interventions (sinon perte du focus dans les textareas).

import { majService, getService } from '../db.js';
import {
  ajouterTacheAuService, ajouterPlusieursTachesAuService,
  toggleTacheService, supprimerTacheService,
  getPropositionsDemarrageService, basculerEpinglage, estTacheEpinglee,
  marquerBandeauVu, bandeauDejaVu
} from '../service-store.js';
import { escapeHtml } from '../ui.js';

// === Persistance locale de l'état d'ouverture des sections ===

const KEY_REPLIS = 'rapports-chuv-bloc-service-replis';

function getReplis() {
  try {
    const j = localStorage.getItem(KEY_REPLIS);
    if (!j) return {};
    return JSON.parse(j) || {};
  } catch { return {}; }
}

function setRepli(section, ouverte) {
  try {
    const replis = getReplis();
    replis[section] = ouverte;
    localStorage.setItem(KEY_REPLIS, JSON.stringify(replis));
  } catch { /* silencieux */ }
}

// Décide si une section doit être ouverte au rendu.
// Règle : on respecte la préférence utilisateur si elle existe ; sinon, ouverte si vide.
function sectionOuverte(section, contenuVide) {
  const replis = getReplis();
  if (Object.prototype.hasOwnProperty.call(replis, section)) {
    return replis[section];
  }
  // Par défaut : section ouverte si vide (incite à remplir), repliée sinon
  return contenuVide;
}

// === Helpers ===

function compterMots(texte) {
  if (!texte) return 0;
  return texte.trim().split(/\s+/).filter(Boolean).length;
}

function tronquer(texte, max = 60) {
  if (!texte) return '';
  const t = texte.trim().replace(/\s+/g, ' ');
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + '…';
}

// Debounce simple pour les sauvegardes textarea
function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// === Rendu HTML ===

function gabaritBandeauRecurrentes(propositions) {
  if (!propositions || propositions.length === 0) return '';
  return `
    <div class="bandeau-recurrentes" data-zone="bandeau-recurrentes">
      <div class="bandeau-recurrentes-tete">
        <span class="bandeau-recurrentes-titre">📌 Reprendre vos tâches récurrentes ?</span>
        <button type="button" class="btn-mini" data-action="fermer-bandeau" aria-label="Plus tard">×</button>
      </div>
      <div class="bandeau-recurrentes-liste">
        ${propositions.map((p, i) => `
          <label class="prop-recurrente">
            <input type="checkbox" data-prop-texte="${escapeHtml(p.texte)}" ${p.epinglee ? 'checked' : ''} />
            <span class="prop-texte">${escapeHtml(p.texte)}</span>
            ${p.epinglee ? '<span class="prop-badge" title="Épinglée">📌</span>' : ''}
            ${p.compteur ? `<span class="prop-compteur" title="${p.compteur} utilisation${p.compteur > 1 ? 's' : ''}">×${p.compteur}</span>` : ''}
          </label>
        `).join('')}
      </div>
      <div class="bandeau-recurrentes-actions">
        <button type="button" class="btn-tertiaire" data-action="fermer-bandeau">Plus tard</button>
        <button type="button" class="btn-primaire" data-action="reprendre-selection">Ajouter la sélection</button>
      </div>
    </div>
  `;
}

function gabaritTache(t, epingleeBibliotheque) {
  return `
    <li class="tache" data-id="${t.id}">
      <label class="tache-cocher">
        <input type="checkbox" data-action="toggle-tache" ${t.cochee ? 'checked' : ''} aria-label="Cocher la tâche" />
        <span class="tache-texte ${t.cochee ? 'tache-cochee' : ''}">${escapeHtml(t.texte)}</span>
      </label>
      <div class="tache-actions">
        <button type="button" class="btn-mini ${epingleeBibliotheque ? 'btn-epingle-actif' : ''}"
                data-action="toggle-epingle" data-texte="${escapeHtml(t.texte)}"
                aria-label="${epingleeBibliotheque ? 'Désépingler' : 'Épingler comme récurrente'}"
                title="${epingleeBibliotheque ? 'Désépingler de la bibliothèque' : 'Épingler comme récurrente'}">📌</button>
        <button type="button" class="btn-mini btn-danger" data-action="supprimer-tache"
                aria-label="Supprimer la tâche" title="Supprimer">×</button>
      </div>
    </li>
  `;
}

async function gabaritBlocService(service, propositions, epingles) {
  const transmissionVide = !(service.transmissionRecue && service.transmissionRecue.trim());
  const notesVide = !(service.notesService && service.notesService.trim());
  const taches = Array.isArray(service.taches) ? service.taches : [];
  const tachesVide = taches.length === 0;
  const cochees = taches.filter(t => t.cochee).length;

  const motsNotes = compterMots(service.notesService);

  const transmTronq = tronquer(service.transmissionRecue, 50);
  const notesTronq = tronquer(service.notesService, 50);

  // Résumés dans les summary (visibles quand replié)
  const resTransmission = transmissionVide
    ? '<span class="bloc-resume-vide">vide</span>'
    : `<span class="bloc-resume">${escapeHtml(transmTronq)}</span>`;
  const resNotes = notesVide
    ? '<span class="bloc-resume-vide">vide</span>'
    : `<span class="bloc-resume">${escapeHtml(notesTronq)}${motsNotes > 10 ? ` (${motsNotes} mots)` : ''}</span>`;
  const resTaches = tachesVide
    ? '<span class="bloc-resume-vide">vide</span>'
    : `<span class="bloc-resume">${cochees}/${taches.length} cochée${taches.length > 1 ? 's' : ''}</span>`;

  const tachesHTML = await Promise.all(
    taches.map(async t => gabaritTache(t, epingles.has(t.texte)))
  );

  return `
    <section class="bloc-service" data-zone="bloc-service">
      <h2 class="bloc-service-titre">Mon service</h2>

      ${propositions.length > 0 ? gabaritBandeauRecurrentes(propositions) : ''}

      <details class="bloc-section" data-section="transmission" ${sectionOuverte('transmission', transmissionVide) ? 'open' : ''}>
        <summary>
          <span class="bloc-section-titre">Transmission reçue</span>
          ${resTransmission}
        </summary>
        <div class="bloc-section-corps">
          <textarea class="bloc-textarea" data-champ="transmissionRecue" rows="4"
                    placeholder="Collez ici la transmission (Recorder, prise de service…) ou tapez librement.">${escapeHtml(service.transmissionRecue || '')}</textarea>
        </div>
      </details>

      <details class="bloc-section" data-section="notes" ${sectionOuverte('notes', notesVide) ? 'open' : ''}>
        <summary>
          <span class="bloc-section-titre">Notes du service</span>
          ${resNotes}
        </summary>
        <div class="bloc-section-corps">
          <textarea class="bloc-textarea" data-champ="notesService" rows="4"
                    placeholder="Mémo libre — choses à ne pas oublier, contexte, observations…">${escapeHtml(service.notesService || '')}</textarea>
        </div>
      </details>

      <details class="bloc-section" data-section="taches" ${sectionOuverte('taches', tachesVide) ? 'open' : ''}>
        <summary>
          <span class="bloc-section-titre">Tâches</span>
          ${resTaches}
        </summary>
        <div class="bloc-section-corps">
          <ul class="taches-liste">
            ${tachesHTML.join('')}
          </ul>
          <div class="tache-ajout">
            <input type="text" class="tache-ajout-input" placeholder="Ajouter une tâche…"
                   aria-label="Nouvelle tâche" maxlength="200" />
            <button type="button" class="btn-secondaire btn-tache-ajouter" data-action="ajouter-tache">+ Ajouter</button>
          </div>
        </div>
      </details>
    </section>
  `;
}

// === Rendu et binding ===

export async function renderBlocService(containerExt, service, onServiceChange) {
  if (!service) {
    containerExt.innerHTML = '';
    return;
  }

  // Charge les données nécessaires
  const tachesActuelles = (service.taches || []).map(t => t.texte);
  let propositions = [];
  if (!bandeauDejaVu(service.id)) {
    const candidatesAll = await getPropositionsDemarrageService(8);
    // Exclut celles déjà présentes dans le service en cours
    propositions = candidatesAll.filter(p => !tachesActuelles.includes(p.texte));
  }

  // Précalcule les épinglages des tâches actuelles
  const epingles = new Set();
  for (const t of (service.taches || [])) {
    if (await estTacheEpinglee(t.texte)) epingles.add(t.texte);
  }

  containerExt.innerHTML = await gabaritBlocService(service, propositions, epingles);

  // Helper : rerender du bloc seul après une mutation
  const rerenderBloc = async () => {
    const frais = await getService(service.id);
    if (onServiceChange) onServiceChange(frais);
    await renderBlocService(containerExt, frais, onServiceChange);
  };

  // === Bandeau récurrentes ===
  const bandeau = containerExt.querySelector('[data-zone="bandeau-recurrentes"]');
  if (bandeau) {
    bandeau.querySelectorAll('[data-action="fermer-bandeau"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        marquerBandeauVu(service.id);
        await rerenderBloc();
      });
    });
    bandeau.querySelector('[data-action="reprendre-selection"]')?.addEventListener('click', async () => {
      const cocheees = Array.from(bandeau.querySelectorAll('input[type="checkbox"]:checked'));
      const textes = cocheees.map(c => c.dataset.propTexte).filter(Boolean);
      if (textes.length > 0) {
        await ajouterPlusieursTachesAuService(service.id, textes);
      }
      marquerBandeauVu(service.id);
      // Si on a ajouté, ouvre la section tâches
      if (textes.length > 0) setRepli('taches', true);
      await rerenderBloc();
    });
  }

  // === Mémoriser l'état d'ouverture des sections ===
  containerExt.querySelectorAll('.bloc-section').forEach(det => {
    const nom = det.dataset.section;
    det.addEventListener('toggle', () => {
      setRepli(nom, det.open);
    });
  });

  // === Auto-save textareas (debounce 400ms + sauvegarde finale au blur) ===
  const sauvegardeChamp = async (champ, valeur) => {
    await majService(service.id, { [champ]: valeur });
    if (onServiceChange) onServiceChange(await getService(service.id));
  };
  const sauvegardeDeb = debounce(sauvegardeChamp, 400);

  containerExt.querySelectorAll('textarea[data-champ]').forEach(ta => {
    const champ = ta.dataset.champ;
    ta.addEventListener('input', () => sauvegardeDeb(champ, ta.value));
    ta.addEventListener('blur', () => sauvegardeChamp(champ, ta.value));
  });

  // === Tâches : toggle, suppression, épinglage, ajout ===

  containerExt.querySelectorAll('.tache').forEach(li => {
    const id = li.dataset.id;

    li.querySelector('[data-action="toggle-tache"]')?.addEventListener('change', async () => {
      await toggleTacheService(service.id, id);
      await rerenderBloc();
    });

    li.querySelector('[data-action="supprimer-tache"]')?.addEventListener('click', async () => {
      await supprimerTacheService(service.id, id);
      await rerenderBloc();
    });

    li.querySelector('[data-action="toggle-epingle"]')?.addEventListener('click', async (e) => {
      const texte = e.currentTarget.dataset.texte;
      await basculerEpinglage(texte);
      await rerenderBloc();
    });
  });

  // Ajout d'une tâche : bouton + ou Entrée dans l'input
  const inputAjout = containerExt.querySelector('.tache-ajout-input');
  const btnAjout = containerExt.querySelector('[data-action="ajouter-tache"]');
  const ajouterCourant = async () => {
    if (!inputAjout) return;
    const valeur = inputAjout.value.trim();
    if (!valeur) return;
    await ajouterTacheAuService(service.id, valeur);
    inputAjout.value = '';
    setRepli('taches', true);
    await rerenderBloc();
    // Re-focus pour saisie multiple rapide
    const nouvelInput = containerExt.querySelector('.tache-ajout-input');
    nouvelInput?.focus();
  };
  btnAjout?.addEventListener('click', ajouterCourant);
  inputAjout?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      ajouterCourant();
    }
  });
}
