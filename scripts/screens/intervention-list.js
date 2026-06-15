// Écran Édition d'intervention — saisie, templates workflow Surveillance,
// fil chronologique, copies vers OnSphere, aide-mémoire.

import {
  getIntervention, majIntervention, supprimerIntervention, terminerIntervention,
  ajouterEntree, majEntree, supprimerEntree, listerEntreesIntervention
} from '../db.js';
import {
  STATUTS_REFERENCE, FONCTIONS_MEDICALES, CATEGORIES, POSTES,
  formatReference, formatRisques
} from '../../data/referentiels.js';
import {
  phraseEngagement, phraseSurPlace, phraseRisques, phraseTransmissionCDS,
  phraseTransfert, phraseReleveBrigade, phraseReleveSP,
  phraseFinMedical, phraseTransfertAmbulance
} from '../templates.js';
import { setEcran, setInterventionCourante, s } from '../state.js';
import { getSuggestionsLieux, togglePinLieu, estEpingle } from '../lieux-store.js';
import {
  escapeHtml, formatHeure, formatHeureInput, formatDuree, copierDansPressePapier,
  confirmer, demander
} from '../ui.js';

// État local de l'écran (résumé pour ne pas re-fetch à chaque interaction)
let etat = {
  intervention: null,
  entrees: [],
  container: null,
  suggestionsLieux: []  // pour datalist
};

export async function renderInterventionEdit(container) {
  etat.container = container;
  const id = s().interventionCouranteId;
  if (!id) {
    setEcran('list');
    return;
  }

  etat.intervention = await getIntervention(id);
  if (!etat.intervention) {
    setEcran('list');
    return;
  }
  etat.entrees = await listerEntreesIntervention(id);
  etat.suggestionsLieux = await getSuggestionsLieux();

  const i = etat.intervention;
  const demarre = i.debut !== null;
  const termine = i.fin !== null;
  const posteMoi = (s().serviceCourant && s().serviceCourant.poste) || 'S?';

  container.innerHTML = `
    <header class="app-header app-header-interv">
      <div class="app-header-top">
        <button type="button" class="btn-retour" data-action="retour" aria-label="Retour à la liste">← Retour</button>
        <div class="selecteur-theme" role="radiogroup" aria-label="Thème de l'application">
          <button type="button" data-theme-set="clair"  aria-label="Mode clair" title="Mode clair">☀</button>
          <button type="button" data-theme-set="auto"   aria-label="Mode automatique" title="Mode automatique">⌗</button>
          <button type="button" data-theme-set="sombre" aria-label="Mode sombre" title="Mode sombre">☾</button>
        </div>
      </div>
      <div class="header-meta">
        <span class="header-statut ${termine ? 'statut-termine' : 'statut-cours'}">${termine ? 'Terminée' : 'En cours'}</span>
        <div class="header-horaires">
          <label class="horaire-mini">
            <span class="horaire-label">Début</span>
            <input type="time" id="horaire-debut" value="${escapeHtml(formatHeureInput(i.debut))}" />
          </label>
          ${termine ? `
            <span class="horaire-sep">→</span>
            <label class="horaire-mini">
              <span class="horaire-label">Fin</span>
              <input type="time" id="horaire-fin" value="${escapeHtml(formatHeureInput(i.fin))}" />
            </label>
            <span class="horaire-duree" id="horaire-duree">${escapeHtml(formatDuree(i.debut, i.fin))}</span>
          ` : ''}
        </div>
        <span class="header-poste">${escapeHtml(posteMoi)}</span>
      </div>
    </header>

    <main class="ecran-edit">
      ${renderEnTete(i)}
      ${renderRisques(i)}
      ${!termine ? renderActions(i, posteMoi) : ''}
      ${renderFilChrono(etat.entrees)}
      ${renderAideMemoire(i)}
      ${renderCopies(i, etat.entrees, posteMoi)}
      ${renderActionsBas(i, termine)}
    </main>

    <datalist id="datalist-lieux">
      ${etat.suggestionsLieux.map(s => `<option value="${escapeHtml(s.lieu)}"></option>`).join('')}
    </datalist>
  `;

  bindHoraires();
  bindEnTete();
  bindRisques();
  if (!termine) bindActions(posteMoi);
  bindFilChrono();
  bindCopies(posteMoi);
  bindActionsBas();

  container.querySelector('[data-action="retour"]').addEventListener('click', () => setEcran('list'));
}

// === Rendu : En-tête (lieu, référence, catégorie/type) ===

function renderEnTete(i) {
  const epingles = etat.suggestionsLieux.filter(l => l.epingle).slice(0, 5);
  return `
    <section class="bloc-entete">
      ${epingles.length > 0 ? `
        <div class="puces-lieux">
          ${epingles.map(l => `
            <button type="button" class="puce-lieu" data-lieu="${escapeHtml(l.lieu)}">
              ★ ${escapeHtml(l.lieu.trim())}
            </button>
          `).join('')}
        </div>
      ` : ''}

      <label class="champ">
        <span class="champ-label">Lieu</span>
        <div class="champ-lieu-row">
          <input
            type="text"
            id="champ-lieu"
            value="${escapeHtml(i.lieu || '')}"
            placeholder="ex: BU44/07/PLI"
            list="datalist-lieux"
            autocomplete="off"
            spellcheck="false"
          />
          <button
            type="button"
            class="btn-pin ${estEpingle(i.lieu || '') ? 'pin-actif' : ''}"
            data-action="pin-lieu"
            aria-label="Épingler ce lieu"
            title="Épingler ce lieu"
          >★</button>
        </div>
      </label>

      <div class="champ-paire">
        <label class="champ">
          <span class="champ-label">Statut</span>
          <select id="champ-statut">
            <option value="">— Aucun —</option>
            ${STATUTS_REFERENCE.map(s => `
              <option value="${s.id}" ${i.referenceStatut === s.id ? 'selected' : ''}>
                ${escapeHtml(s.label)}
              </option>
            `).join('')}
          </select>
        </label>

        <label class="champ ${!statutRequiresName(i.referenceStatut) ? 'champ-disabled' : ''}">
          <span class="champ-label">Nom</span>
          <input
            type="text"
            id="champ-nom"
            value="${escapeHtml(i.referenceNom || '')}"
            placeholder="Prénom NOM"
            ${!statutRequiresName(i.referenceStatut) ? 'disabled' : ''}
          />
        </label>
      </div>

      <details class="bloc-options">
        <summary>Catégorie / Type / Description (optionnel)</summary>
        <div class="champ-paire">
          <label class="champ">
            <span class="champ-label">Catégorie</span>
            <select id="champ-categorie">
              <option value="">— Aucune —</option>
              ${CATEGORIES.map(c => `
                <option value="${escapeHtml(c)}" ${i.categorie === c ? 'selected' : ''}>${escapeHtml(c)}</option>
              `).join('')}
            </select>
          </label>
          <label class="champ">
            <span class="champ-label">Type</span>
            <input type="text" id="champ-type" value="${escapeHtml(i.type || '')}" placeholder="ex: Surveillance par agent hors dispositif" />
          </label>
        </div>
        <label class="champ">
          <span class="champ-label">Description (si tu la copies dans OnSphere)</span>
          <textarea id="champ-description" rows="2" placeholder="Phrase d'ouverture posant le contexte de l'intervention">${escapeHtml(i.description || '')}</textarea>
        </label>
        <label class="champ">
          <span class="champ-label">N° fiche OnSphere (saisi a posteriori)</span>
          <input type="text" id="champ-numero" value="${escapeHtml(i.numeroOnsphere || '')}" placeholder="ex: 49819" inputmode="numeric" />
        </label>
      </details>
    </section>
  `;
}

function statutRequiresName(statutId) {
  if (!statutId) return true;
  const st = STATUTS_REFERENCE.find(s => s.id === statutId);
  return !st || st.requiresName;
}

// === Binding : modification des horaires début/fin ===

function bindHoraires() {
  const c = etat.container;

  // Helper : applique HH:MM à la date existante (préserve l'année/mois/jour)
  const majDateHeure = async (champ, nouveauTime) => {
    const [h, m] = nouveauTime.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return;
    const dateActuelle = etat.intervention[champ];
    if (!dateActuelle) return;
    const nouvelleDate = new Date(dateActuelle);
    nouvelleDate.setHours(h, m, 0, 0);
    const patch = { [champ]: nouvelleDate };
    await majIntervention(etat.intervention.id, patch);
    etat.intervention[champ] = nouvelleDate;
    // Rafraîchir l'affichage de durée si fin présente
    const dureeEl = c.querySelector('#horaire-duree');
    if (dureeEl && etat.intervention.fin) {
      dureeEl.textContent = formatDuree(etat.intervention.debut, etat.intervention.fin);
    }
  };

  c.querySelector('#horaire-debut')?.addEventListener('change', async (e) => {
    await majDateHeure('debut', e.target.value);
  });

  c.querySelector('#horaire-fin')?.addEventListener('change', async (e) => {
    await majDateHeure('fin', e.target.value);
  });
}

function bindEnTete() {
  const c = etat.container;

  // Champ Lieu — sauvegarde au blur + sync de l'état pin
  const inputLieu = c.querySelector('#champ-lieu');
  inputLieu.addEventListener('blur', async () => {
    const v = inputLieu.value.trim();
    if (v !== etat.intervention.lieu) {
      await majIntervention(etat.intervention.id, { lieu: v });
      etat.intervention.lieu = v;
      // Refresh le bouton pin
      const btnPin = c.querySelector('[data-action="pin-lieu"]');
      btnPin?.classList.toggle('pin-actif', estEpingle(v));
    }
  });

  // Bouton pin lieu
  c.querySelector('[data-action="pin-lieu"]').addEventListener('click', () => {
    const v = inputLieu.value.trim();
    if (!v) return;
    togglePinLieu(v);
    renderInterventionEdit(c); // rerender pour refléter les épinglés
  });

  // Puces de lieux épinglés — clic remplit le champ
  c.querySelectorAll('.puce-lieu').forEach(btn => {
    btn.addEventListener('click', () => {
      inputLieu.value = btn.dataset.lieu;
      inputLieu.focus();
      // Place le curseur en fin (utile si le lieu finit par un espace pour le suffixe)
      inputLieu.setSelectionRange(inputLieu.value.length, inputLieu.value.length);
      inputLieu.dispatchEvent(new Event('blur'));
    });
  });

  // Statut Référence
  c.querySelector('#champ-statut').addEventListener('change', async (e) => {
    const v = e.target.value || null;
    await majIntervention(etat.intervention.id, { referenceStatut: v });
    etat.intervention.referenceStatut = v;
    // Active/désactive le champ Nom selon le statut
    const inputNom = c.querySelector('#champ-nom');
    const requiresName = statutRequiresName(v);
    inputNom.disabled = !requiresName;
    inputNom.parentElement.classList.toggle('champ-disabled', !requiresName);
  });

  // Nom
  c.querySelector('#champ-nom').addEventListener('blur', async (e) => {
    const v = e.target.value.trim();
    await majIntervention(etat.intervention.id, { referenceNom: v });
    etat.intervention.referenceNom = v;
  });

  // Catégorie / Type / Description / N°
  c.querySelector('#champ-categorie').addEventListener('change', async (e) => {
    await majIntervention(etat.intervention.id, { categorie: e.target.value || null });
    etat.intervention.categorie = e.target.value || null;
    // Rafraîchit l'aide-mémoire OnSphere
    rafraichirAideMemoire();
  });
  c.querySelector('#champ-type').addEventListener('blur', async (e) => {
    await majIntervention(etat.intervention.id, { type: e.target.value.trim() });
    etat.intervention.type = e.target.value.trim();
    rafraichirAideMemoire();
  });
  c.querySelector('#champ-description').addEventListener('blur', async (e) => {
    await majIntervention(etat.intervention.id, { description: e.target.value.trim() });
    etat.intervention.description = e.target.value.trim();
  });
  c.querySelector('#champ-numero').addEventListener('blur', async (e) => {
    await majIntervention(etat.intervention.id, { numeroOnsphere: e.target.value.trim() });
    etat.intervention.numeroOnsphere = e.target.value.trim();
  });
}

function rafraichirAideMemoire() {
  const i = etat.intervention;
  const am = etat.container.querySelector('.aide-memoire-contenu');
  if (am) am.innerHTML = aideMemoireHTML(i);
}

// === Rendu : Risques ===

function renderRisques(i) {
  const risques = i.risques || [];
  const cle = ['auto', 'hetero', 'fugue'];
  const labels = { auto: 'Auto-agressif', hetero: 'Hétéro-agressif', fugue: 'Fugue' };
  return `
    <section class="bloc-risques">
      <div class="bloc-titre">Risques</div>
      <div class="chips-risques">
        ${cle.map(r => `
          <button type="button"
                  class="chip ${risques.includes(r) ? 'chip-actif' : ''}"
                  data-risque="${r}">
            ${escapeHtml(labels[r])}
          </button>
        `).join('')}
      </div>
      <label class="toggle">
        <input type="checkbox" id="toggle-physique" ${i.physiqueForteAutorisee ? 'checked' : ''} />
        <span>Physique forte autorisée</span>
      </label>
    </section>
  `;
}

function bindRisques() {
  const c = etat.container;
  c.querySelectorAll('[data-risque]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const r = btn.dataset.risque;
      const cur = etat.intervention.risques || [];
      const idx = cur.indexOf(r);
      const nouveau = idx >= 0
        ? cur.filter(x => x !== r)
        : [...cur, r];
      await majIntervention(etat.intervention.id, { risques: nouveau });
      etat.intervention.risques = nouveau;
      btn.classList.toggle('chip-actif', nouveau.includes(r));
    });
  });
  c.querySelector('#toggle-physique').addEventListener('change', async (e) => {
    const v = e.target.checked;
    await majIntervention(etat.intervention.id, { physiqueForteAutorisee: v });
    etat.intervention.physiqueForteAutorisee = v;
  });
}

// === Rendu : Actions (boutons workflow Surveillance) ===

function renderActions(i, posteMoi) {
  return `
    <section class="bloc-actions">
      <div class="bloc-titre">Workflow surveillance</div>
      <div class="grille-actions">
        <button type="button" class="btn-action" data-template="engagement">Engagement</button>
        <button type="button" class="btn-action" data-template="surPlace">Sur place</button>
        <button type="button" class="btn-action" data-template="risques">Risques</button>
        <button type="button" class="btn-action" data-template="transmissionCDS">Transmission CDS</button>
        <button type="button" class="btn-action" data-template="transfert">Transfert</button>
        <button type="button" class="btn-action" data-template="noteLibre">Note libre</button>
      </div>
      <div class="bloc-titre bloc-titre-secondaire">Clôture</div>
      <div class="grille-actions">
        <button type="button" class="btn-action btn-action-fin" data-template="releveBrigade">Relève brigade</button>
        <button type="button" class="btn-action btn-action-fin" data-template="releveSP">Relève SP</button>
        <button type="button" class="btn-action btn-action-fin" data-template="finMedical">Fin médical</button>
        <button type="button" class="btn-action btn-action-fin" data-template="transfertAmbulance">Transfert ambulance</button>
      </div>
    </section>
  `;
}

function bindActions(posteMoi) {
  const c = etat.container;
  c.querySelectorAll('[data-template]').forEach(btn => {
    btn.addEventListener('click', () => declencherTemplate(btn.dataset.template, posteMoi));
  });
}

// === Templates : ouverture des mini-dialogs ===

async function declencherTemplate(nom, posteMoi) {
  switch (nom) {
    case 'engagement':
      return ouvrirDialogEngagement(posteMoi);
    case 'surPlace':
      return ouvrirDialogSurPlace(posteMoi);
    case 'risques':
      return inserer(phraseRisques({
        risques: etat.intervention.risques,
        physiqueForte: etat.intervention.physiqueForteAutorisee
      }), 'risques');
    case 'transmissionCDS':
      return inserer(phraseTransmissionCDS({ posteMoi }), 'transmissionCDS');
    case 'transfert':
      return ouvrirDialogTransfert();
    case 'noteLibre':
      return ouvrirDialogNoteLibre();
    case 'releveBrigade':
      return ouvrirDialogReleveBrigade(posteMoi);
    case 'releveSP':
      return ouvrirDialogReleveSP(posteMoi);
    case 'finMedical':
      return ouvrirDialogFinMedical();
    case 'transfertAmbulance':
      return ouvrirDialogTransfertAmbulance();
  }
}

async function inserer(texte, template = null) {
  await ajouterEntree(etat.intervention.id, texte, template);
  await renderInterventionEdit(etat.container);
}

// === Système de dialog modal ===

function ouvrirDialog(titre, contenuHTML, onConfirmer) {
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.innerHTML = `
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-titre">
      <div class="dialog-titre" id="dialog-titre">${escapeHtml(titre)}</div>
      <div class="dialog-contenu">${contenuHTML}</div>
      <div class="dialog-actions">
        <button type="button" class="btn-secondaire" data-dialog="annuler">Annuler</button>
        <button type="button" class="btn-primaire" data-dialog="confirmer">Insérer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const fermer = () => overlay.remove();
  overlay.querySelector('[data-dialog="annuler"]').addEventListener('click', fermer);
  overlay.querySelector('[data-dialog="confirmer"]').addEventListener('click', async () => {
    try {
      const ok = await onConfirmer(overlay);
      if (ok !== false) fermer();
    } catch (e) {
      console.error('[Dialog] Erreur confirmation:', e);
    }
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) fermer();
  });

  // Focus sur le premier champ texte
  setTimeout(() => {
    const focusable = overlay.querySelector('input, textarea, select');
    if (focusable) focusable.focus();
  }, 50);
}

function ouvrirDialogEngagement(posteMoi) {
  ouvrirDialog('Engagement', `
    <label class="champ">
      <span class="champ-label">Engagement par</span>
      <select id="d-engagement-source">
        <option value="cds">Opérateur CDS</option>
        <option value="medical">Médical en direct</option>
      </select>
    </label>
    <label class="champ">
      <span class="champ-label">Motif court (optionnel)</span>
      <input type="text" id="d-engagement-motif" placeholder="ex: demande de surveillance patient à risque auto-agressif" />
    </label>
  `, async (overlay) => {
    const source = overlay.querySelector('#d-engagement-source').value;
    const motif = overlay.querySelector('#d-engagement-motif').value;
    await inserer(phraseEngagement({ source, motif }), 'engagement');
  });
}

function ouvrirDialogSurPlace(posteMoi) {
  ouvrirDialog('Sur place / Contact établi', `
    <label class="champ">
      <span class="champ-label">Fonction du soignant</span>
      <select id="d-surplace-fonction">
        <option value="">— Aucune —</option>
        ${FONCTIONS_MEDICALES.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('')}
      </select>
    </label>
    <label class="champ">
      <span class="champ-label">Prénom et nom</span>
      <input type="text" id="d-surplace-nom" placeholder="ex: Soraya SELMANI" />
    </label>
  `, async (overlay) => {
    const fonction = overlay.querySelector('#d-surplace-fonction').value;
    const nom = overlay.querySelector('#d-surplace-nom').value;
    await inserer(phraseSurPlace({ posteMoi, fonction, nom }), 'surPlace');
  });
}

function ouvrirDialogTransfert() {
  const suggestions = etat.suggestionsLieux;
  ouvrirDialog('Transfert', `
    <label class="champ">
      <span class="champ-label">Nouveau lieu</span>
      <input type="text" id="d-transfert-lieu" list="datalist-lieux-dialog" placeholder="ex: BH/05/URGO I1" autocomplete="off" />
      <datalist id="datalist-lieux-dialog">
        ${suggestions.map(s => `<option value="${escapeHtml(s.lieu)}"></option>`).join('')}
      </datalist>
    </label>
    <p class="dialog-hint">Le lieu actif de l'intervention sera mis à jour.</p>
  `, async (overlay) => {
    const nouveau = overlay.querySelector('#d-transfert-lieu').value.trim();
    if (!nouveau) return false;
    await ajouterEntree(etat.intervention.id, phraseTransfert({ nouveauLieu: nouveau }), 'transfert');
    await majIntervention(etat.intervention.id, { lieu: nouveau });
    etat.intervention.lieu = nouveau;
    await renderInterventionEdit(etat.container);
  });
}

function ouvrirDialogNoteLibre() {
  ouvrirDialog('Note libre', `
    <label class="champ">
      <span class="champ-label">Texte de la note</span>
      <textarea id="d-note-texte" rows="4" placeholder="Saisis ton texte ici..."></textarea>
    </label>
  `, async (overlay) => {
    const texte = overlay.querySelector('#d-note-texte').value.trim();
    if (!texte) return false;
    await inserer(texte, 'noteLibre');
  });
}

function ouvrirDialogReleveBrigade(posteMoi) {
  const autres = POSTES.filter(p => p !== posteMoi);
  ouvrirDialog('Relève brigade', `
    <label class="champ">
      <span class="champ-label">Poste qui te relève</span>
      <select id="d-relevebrig-poste">
        ${autres.map(p => `<option value="${p}">${p}</option>`).join('')}
      </select>
    </label>
  `, async (overlay) => {
    const posteRelevant = overlay.querySelector('#d-relevebrig-poste').value;
    await inserer(phraseReleveBrigade({ posteMoi, posteRelevant }), 'releveBrigade');
  });
}

function ouvrirDialogReleveSP(posteMoi) {
  ouvrirDialog('Relève par agent SP', `
    <label class="champ">
      <span class="champ-label">Matricule de l'agent SP</span>
      <input type="text" id="d-relevesp-mat" inputmode="numeric" placeholder="ex: 555190" />
    </label>
  `, async (overlay) => {
    const matriculeSP = overlay.querySelector('#d-relevesp-mat').value.trim();
    if (!matriculeSP) return false;
    await inserer(phraseReleveSP({ posteMoi, matriculeSP }), 'releveSP');
  });
}

function ouvrirDialogFinMedical() {
  ouvrirDialog('Fin par médical', `
    <label class="champ">
      <span class="champ-label">Fonction</span>
      <select id="d-finmed-fonction">
        <option value="">— Aucune —</option>
        ${FONCTIONS_MEDICALES.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('')}
      </select>
    </label>
    <label class="champ">
      <span class="champ-label">Prénom et nom</span>
      <input type="text" id="d-finmed-nom" placeholder="ex: Anne Marie KOUDRY" />
    </label>
  `, async (overlay) => {
    const fonction = overlay.querySelector('#d-finmed-fonction').value;
    const nom = overlay.querySelector('#d-finmed-nom').value;
    await inserer(phraseFinMedical({ fonction, nom }), 'finMedical');
  });
}

function ouvrirDialogTransfertAmbulance() {
  ouvrirDialog('Transfert ambulance', `
    <label class="champ">
      <span class="champ-label">Type de transfert</span>
      <select id="d-amb-type">
        <option value="securise">Sécurisé</option>
        <option value="non">Non sécurisé</option>
      </select>
    </label>
    <label class="champ">
      <span class="champ-label">Destination</span>
      <input type="text" id="d-amb-dest" placeholder="ex: Cery, autre hôpital..." />
    </label>
  `, async (overlay) => {
    const securise = overlay.querySelector('#d-amb-type').value === 'securise';
    const destination = overlay.querySelector('#d-amb-dest').value;
    await inserer(phraseTransfertAmbulance({ securise, destination }), 'transfertAmbulance');
  });
}

// === Rendu : Fil chronologique ===

function renderFilChrono(entrees) {
  if (entrees.length === 0) {
    return `
      <section class="bloc-chrono">
        <div class="bloc-titre">Fil chronologique</div>
        <p class="vide-petit">Aucune entrée encore. Utilise les boutons workflow ci-dessus pour démarrer.</p>
      </section>
    `;
  }
  return `
    <section class="bloc-chrono">
      <div class="bloc-titre">Fil chronologique <span class="bloc-titre-aide">${entrees.length} entrée${entrees.length > 1 ? 's' : ''}</span></div>
      <ol class="entrees">
        ${entrees.map(e => `
          <li class="entree" data-id="${e.id}">
            <div class="entree-tete">
              <input type="time" class="entree-heure" value="${escapeHtml(formatHeureInput(e.heure))}" data-id="${e.id}" />
              <div class="entree-actions">
                <button type="button" class="btn-mini" data-copy-id="${e.id}">📋</button>
                <button type="button" class="btn-mini btn-danger" data-del-id="${e.id}" aria-label="Supprimer">×</button>
              </div>
            </div>
            <textarea class="entree-texte" rows="2" data-id="${e.id}">${escapeHtml(e.texte || '')}</textarea>
          </li>
        `).join('')}
      </ol>
    </section>
  `;
}

function bindFilChrono() {
  const c = etat.container;

  // Heure
  c.querySelectorAll('.entree-heure').forEach(input => {
    input.addEventListener('change', async () => {
      const id = parseInt(input.dataset.id, 10);
      const [h, m] = input.value.split(':').map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return;
      // On garde la même date, on change juste H:M
      const entree = etat.entrees.find(e => e.id === id);
      if (!entree) return;
      const d = new Date(entree.heure);
      d.setHours(h, m, 0, 0);
      await majEntree(id, { heure: d });
      entree.heure = d;
    });
  });

  // Texte
  c.querySelectorAll('.entree-texte').forEach(ta => {
    ta.addEventListener('blur', async () => {
      const id = parseInt(ta.dataset.id, 10);
      const v = ta.value.trim();
      await majEntree(id, { texte: v });
      const e = etat.entrees.find(x => x.id === id);
      if (e) e.texte = v;
    });
    // Auto-resize basique
    const adjust = () => {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    };
    ta.addEventListener('input', adjust);
    setTimeout(adjust, 0);
  });

  // Copier une entrée
  c.querySelectorAll('[data-copy-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.copyId, 10);
      const e = etat.entrees.find(x => x.id === id);
      if (!e) return;
      const ok = await copierDansPressePapier(e.texte, btn);
      if (!ok) alert('Échec de la copie. Sélectionne le texte manuellement.');
    });
  });

  // Supprimer une entrée
  c.querySelectorAll('[data-del-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirmer('Supprimer cette entrée chronologique ?')) return;
      const id = parseInt(btn.dataset.delId, 10);
      await supprimerEntree(id);
      etat.entrees = etat.entrees.filter(x => x.id !== id);
      await renderInterventionEdit(etat.container);
    });
  });
}

// === Rendu : Aide-mémoire OnSphere ===

function renderAideMemoire(i) {
  return `
    <section class="bloc-aide-memoire">
      <div class="bloc-titre">Aide-mémoire OnSphere <span class="bloc-titre-aide">À ressaisir manuellement dans OnSphere</span></div>
      <div class="aide-memoire-contenu">${aideMemoireHTML(i)}</div>
    </section>
  `;
}

function aideMemoireHTML(i) {
  const rows = [
    { label: 'Lieu', val: i.lieu },
    { label: 'Catégorie', val: i.categorie },
    { label: 'Type', val: i.type },
    { label: 'N° fiche OnSphere', val: i.numeroOnsphere }
  ];
  return `<dl class="aide-memoire-dl">
    ${rows.map(r => `
      <dt>${escapeHtml(r.label)}</dt>
      <dd>${r.val ? escapeHtml(r.val) : '<em>vide</em>'}</dd>
    `).join('')}
  </dl>`;
}

// === Rendu : Boutons de copie ===

function renderCopies(i, entrees, posteMoi) {
  const refTxt = formatReference(i.referenceStatut, i.referenceNom);
  const descTxt = (i.description || '').trim();
  const aDescription = descTxt.length > 0;
  return `
    <section class="bloc-copies">
      <div class="bloc-titre">Copier vers OnSphere</div>
      <div class="liste-copies">
        <button type="button" class="btn-copie" data-copy="reference" ${refTxt ? '' : 'disabled'}>
          📋 Référence
          <span class="btn-copie-preview">${escapeHtml(refTxt || '—')}</span>
        </button>
        <button type="button" class="btn-copie" data-copy="description" ${aDescription ? '' : 'disabled'}>
          📋 Description
          <span class="btn-copie-preview">${aDescription ? escapeHtml(descTxt.slice(0, 80) + (descTxt.length > 80 ? '…' : '')) : '<em>vide</em>'}</span>
        </button>
        <button type="button" class="btn-copie" data-copy="rapport" ${entrees.length > 0 ? '' : 'disabled'}>
          📋 Rapport entier (bloc)
          <span class="btn-copie-preview">${entrees.length} entrée${entrees.length > 1 ? 's' : ''}</span>
        </button>
      </div>
      <p class="copie-note">
        Pour OnSphere, copie le Rapport <strong>entrée par entrée</strong> avec les 📋 du fil chronologique (OnSphere écrase les sauts de ligne d'un collage en bloc).
      </p>
    </section>
  `;
}

function bindCopies(posteMoi) {
  const c = etat.container;
  c.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const type = btn.dataset.copy;
      const i = etat.intervention;
      let texte = '';
      if (type === 'reference') {
        texte = formatReference(i.referenceStatut, i.referenceNom);
      } else if (type === 'description') {
        texte = i.description || '';
      } else if (type === 'rapport') {
        texte = etat.entrees.map(e => `${formatHeure(e.heure)} — ${e.texte}`).join('\n');
      }
      if (!texte) return;
      const ok = await copierDansPressePapier(texte, btn);
      if (!ok) alert('Échec de la copie. Sélectionne le texte manuellement.');
    });
  });
}

// === Rendu : Actions du bas (terminer, supprimer) ===

function renderActionsBas(i, termine) {
  return `
    <section class="bloc-actions-bas">
      ${!termine ? `
        <button type="button" class="btn-primaire btn-bloc" data-action="terminer">
          Terminer l'intervention
        </button>
      ` : `
        <button type="button" class="btn-secondaire btn-bloc" data-action="rouvrir">
          Rouvrir l'intervention
        </button>
      `}
      <button type="button" class="btn-danger btn-bloc" data-action="supprimer">
        Supprimer l'intervention
      </button>
    </section>
  `;
}

function bindActionsBas() {
  const c = etat.container;
  c.querySelector('[data-action="terminer"]')?.addEventListener('click', async () => {
    if (!confirmer("Terminer cette intervention ? L'heure de fin sera enregistrée maintenant.")) return;
    await terminerIntervention(etat.intervention.id);
    await renderInterventionEdit(c);
  });
  c.querySelector('[data-action="rouvrir"]')?.addEventListener('click', async () => {
    if (!confirmer('Rouvrir cette intervention ?')) return;
    await majIntervention(etat.intervention.id, { fin: null });
    await renderInterventionEdit(c);
  });
  c.querySelector('[data-action="supprimer"]')?.addEventListener('click', async () => {
    if (!confirmer('Supprimer définitivement cette intervention et toutes ses entrées ?')) return;
    await supprimerIntervention(etat.intervention.id);
    setInterventionCourante(null);
    setEcran('list');
  });
}
