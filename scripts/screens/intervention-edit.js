// Écran Édition d'intervention — saisie, templates workflow Surveillance,
// fil chronologique, copies vers OnSphere, aide-mémoire.

import {
  getIntervention, majIntervention, supprimerIntervention, terminerIntervention,
  ajouterEntree, majEntree, supprimerEntree, listerEntreesIntervention
} from '../db.js';
import {
  STATUTS_REFERENCE, FONCTIONS_MEDICALES, CATEGORIES, TYPES_PAR_CATEGORIE,
  CHAMPS_RAPPORT_FEU, POSTES, formatReference, formatRisques,
  BATIMENTS_LISTE, LIEUX_PAR_BATIMENT, composerLieu, lieuEstComplet
} from '../../data/referentiels.js';
import {
  phraseEngagement, phraseSurPlace, phraseRisques, phraseTransmissionCDS,
  phraseTransfert, phraseReleveBrigade, phraseReleveSP,
  phraseFinMedical, phraseTransfertAmbulance
} from '../templates.js';
import { setEcran, setInterventionCourante, s } from '../state.js';
import { getSuggestionsLieux, togglePinLieu, estEpingle } from '../lieux-store.js';
import {
  escapeHtml, formatHeure, formatHeureInput, formatDateEntree, formatDateInput,
  formatDuree, copierDansPressePapier,
  confirmer, demander, formatNom
} from '../ui.js';
import { exporterIntervention } from '../export-claude.js';

// État local de l'écran
let etat = {
  intervention: null,
  entrees: [],
  container: null,
  suggestionsLieux: []
};

export async function renderInterventionEdit(container) {
  etat.container = container;
  const id = s().interventionCouranteId;
  if (!id) { setEcran('list'); return; }

  etat.intervention = await getIntervention(id);
  if (!etat.intervention) { setEcran('list'); return; }

  etat.entrees        = await listerEntreesIntervention(id);
  etat.suggestionsLieux = await getSuggestionsLieux();

  const i        = etat.intervention;
  const termine  = i.fin !== null;
  const posteMoi = (s().serviceCourant && s().serviceCourant.poste) || 'S?';

  container.innerHTML = `
    <header class="app-header app-header-interv">
      <div class="app-header-top">
        <button type="button" class="btn-retour" data-action="retour" aria-label="Retour à la liste">← Retour</button>
        <div class="selecteur-theme" role="radiogroup" aria-label="Thème de l'application">
          <button type="button" data-theme-set="clair"  aria-label="Mode clair"       title="Mode clair">☀</button>
          <button type="button" data-theme-set="auto"   aria-label="Mode automatique" title="Mode automatique">⌗</button>
          <button type="button" data-theme-set="sombre" aria-label="Mode sombre"      title="Mode sombre">☾</button>
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
      ${i.categorie === 'Feu / inondation / sinistre' ? renderBlocFeu(i) : ''}
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

// === Rendu : En-tête ===

function renderEnTete(i) {
  const epingles = etat.suggestionsLieux.filter(l => l.epingle).slice(0, 5);
  // Décomposer i.lieu pour pré-remplir la cascade si possible
  const lieuCascade = i._lieuCascade || { batiment: '', lieuVal: '', etageOption: '', suffixe: '' };

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

      <!-- Cascade lieu : chip si complet, selects sinon -->
      <div class="champ">
        <span class="champ-label">Lieu</span>
        <div id="bloc-lieu-wrap">
          ${renderBlocLieu(i, lieuCascade)}
        </div>
      </div>

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
        <summary id="bloc-options-summary">${resumeSummary(i.categorie, i.type)}</summary>
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
          <div id="champ-type-wrap" class="champ">
            <span class="champ-label">Type</span>
            ${renderSelectType(i.categorie, i.type)}
          </div>
        </div>
        ${!estEngagementCDS(etat.entrees) ? `
        <label class="champ">
          <span class="champ-label">Description (si tu la copies dans OnSphere)</span>
          <textarea id="champ-description" rows="2" placeholder="Phrase d'ouverture posant le contexte de l'intervention">${escapeHtml(i.description || '')}</textarea>
        </label>
        ` : `
        <p class="dialog-hint" style="margin:.25rem 0">Description gérée par l'opérateur CDS dans OnSphere.</p>
        `}
      </details>
    </section>
  `;
}

// ─── Helpers cascade lieu ─────────────────────────────────────────────────────

// Décide chip vs selects et retourne le HTML
function renderBlocLieu(i, lieuCascade) {
  const { batiment, lieuVal, etageOption, suffixe } = lieuCascade;
  const complet    = lieuEstComplet(batiment, lieuVal, etageOption, suffixe);
  const lieuCompose = composerLieu(batiment, lieuVal, etageOption, suffixe) || i.lieu || '';

  if (complet && lieuCompose) {
    // Mode chip
    const pince = estEpingle(lieuCompose);
    return `
      <div class="casc-chip-row">
        <div class="lieu-chip">
          <span class="lieu-chip-texte">${escapeHtml(lieuCompose)}</span>
          <button type="button" class="lieu-chip-reset" id="lieu-chip-reset"
            title="Modifier le lieu" aria-label="Effacer et reselectionner">×</button>
        </div>
        <button type="button" class="btn-pin ${pince ? 'pin-actif' : ''}" id="btn-pin-lieu"
          aria-label="Épingler ce lieu" title="Épingler ce lieu">★</button>
      </div>`;
  }

  // Mode selects
  const c3 = renderCascadeCol3(batiment, lieuVal, etageOption, suffixe);
  return `
    <div class="casc-inline">
      <select id="casc-batiment" class="lieu-col1">
        <option value="">Bât.</option>
        ${BATIMENTS_LISTE.map(b => `<option value="${b}"${batiment === b ? ' selected' : ''}>${b}</option>`).join('')}
        <option value="__libre__"${batiment === '__libre__' ? ' selected' : ''}>Saisie libre…</option>
      </select>
      ${batiment && batiment !== '__libre__' ? `
        <span class="lieu-sep">/</span>
        <select id="casc-lieu" class="lieu-col2">
          ${renderCascadeOptionsLieu(batiment, lieuVal)}
        </select>
      ` : ''}
      ${c3 ? `<span class="lieu-sep">/</span><span class="casc-col3-wrap">${c3}</span>` : ''}
      ${batiment === '__libre__' ? `
        <span class="lieu-sep">/</span>
        <input type="text" id="casc-libre" class="lieu-col3 lieu-col3-libre"
          placeholder="ex: BU44/07/PLI" value="${escapeHtml(i.lieu || '')}"
          list="datalist-lieux" autocomplete="off" spellcheck="false" />
        <datalist id="datalist-lieux">
          ${etat.suggestionsLieux.map(s => `<option value="${escapeHtml(s.lieu)}"></option>`).join('')}
        </datalist>
      ` : ''}
    </div>
    ${i.lieu ? `<div class="casc-resultat-row">
      <span class="casc-resultat">${escapeHtml(i.lieu)}</span>
      <button type="button" class="btn-pin ${estEpingle(i.lieu) ? 'pin-actif' : ''}" id="btn-pin-lieu"
        aria-label="Épingler ce lieu" title="Épingler ce lieu">★</button>
    </div>` : ''}
  `;
}

function renderCascadeOptionsLieu(batiment, lieuActuel = '') {
  const cfg = LIEUX_PAR_BATIMENT[batiment];
  if (!cfg) return '<option value="">— —</option>';
  let html = '<option value="">— Service / Étage —</option>';
  if (cfg.prioritaires) {
    cfg.prioritaires.forEach(p => {
      html += `<option value="${p.valeur}"${lieuActuel === p.valeur ? ' selected' : ''}>${escapeHtml(p.label)}</option>`;
    });
  }
  if (cfg.etages) {
    cfg.etages.forEach(e => {
      // Label court : numéro seul (pas "Étage 12")
      html += `<option value="${e.valeur}"${lieuActuel === e.valeur ? ' selected' : ''}>${escapeHtml(e.numero)}</option>`;
    });
  }
  return html;
}

// Col 3 unifiée — retourne le HTML inline (peut être select, input, ou dual pour BH étage)
function renderCascadeCol3(batiment, lieuVal, etageOption, suffixeActuel = '') {
  if (!batiment || !lieuVal || lieuVal === '__libre__') return '';
  const cfg = LIEUX_PAR_BATIMENT[batiment];
  if (!cfg) return '';

  // Prioritaire
  if (cfg.prioritaires) {
    const p = cfg.prioritaires.find(x => x.valeur === lieuVal);
    if (p) {
      if (p.type === 'fixe') return '';
      if (p.type === 'lettre') {
        const opts = (p.lettres || '').split('').map(l =>
          `<option value="${l}"${suffixeActuel === l ? ' selected' : ''}>${l}</option>`).join('');
        return `<select id="casc-suffixe" class="lieu-col3"><option value="">—</option>${opts}</select>`;
      }
      if (p.type === 'select') {
        const opts = p.options.map(o =>
          `<option value="${o}"${suffixeActuel === o ? ' selected' : ''}>${o}</option>`).join('');
        return `<select id="casc-suffixe" class="lieu-col3"><option value="">—</option>${opts}</select>`;
      }
      if (p.type === 'numero') {
        return `<input type="text" id="casc-suffixe" class="lieu-col3 lieu-col3-num" inputmode="numeric" placeholder="N°" value="${escapeHtml(suffixeActuel)}" />`;
      }
    }
  }

  // Étage — BH : type select (Ch./S.int) + suffixe ; autres : input direct
  if (lieuVal.startsWith('etage-') && cfg.etageOptions) {
    if (cfg.etageOptions.length > 1) {
      // BH : micro-select type + suffixe
      const typeOpts = cfg.etageOptions.map(o =>
        `<option value="${o.valeur}"${etageOption === o.valeur ? ' selected' : ''}>${o.valeur === 'chambre' ? 'Ch.' : 'S.int'}</option>`).join('');
      const selectType = `<select id="casc-etage-opt" class="lieu-col3-type"><option value="">—</option>${typeOpts}</select>`;
      if (!etageOption) return selectType;
      const optDef = cfg.etageOptions.find(o => o.valeur === etageOption);
      if (optDef && optDef.type === 'numero') {
        return `${selectType}<input type="text" id="casc-suffixe" class="lieu-col3 lieu-col3-num" inputmode="numeric" placeholder="N°" value="${escapeHtml(suffixeActuel)}" />`;
      }
      if (optDef && optDef.type === 'select') {
        const litOpts = optDef.options.map(o => `<option value="${o}"${suffixeActuel === o ? ' selected' : ''}>${o}</option>`).join('');
        return `${selectType}<select id="casc-suffixe" class="lieu-col3"><option value="">—</option>${litOpts}</select>`;
      }
      return selectType;
    }
    // Étage simple : input numérique direct
    return `<input type="text" id="casc-suffixe" class="lieu-col3 lieu-col3-num" inputmode="numeric" placeholder="N°" value="${escapeHtml(suffixeActuel)}" />`;
  }
  return '';
}

// Met à jour i.lieu + i._lieuCascade et sauvegarde
async function majLieuCascade(cascade) {
  const lieu = composerLieu(cascade.batiment, cascade.lieuVal, cascade.etageOption, cascade.suffixe);
  etat.intervention._lieuCascade = cascade;
  etat.intervention.lieu = lieu || '';
  await majIntervention(etat.intervention.id, { lieu: lieu || '', _lieuCascade: cascade });
  // Re-render partiel du bloc lieu
  rerenderBlocLieu();
}

// Re-render du seul div#bloc-lieu-wrap (sans rerender toute la page)
function rerenderBlocLieu() {
  const wrap = etat.container.querySelector('#bloc-lieu-wrap');
  if (!wrap) return;
  const lc = etat.intervention._lieuCascade || { batiment: '', lieuVal: '', etageOption: '', suffixe: '' };
  wrap.innerHTML = renderBlocLieu(etat.intervention, lc);
  bindBlocLieu();
}

// Tous les listeners du bloc lieu (chip + selects)
function bindBlocLieu() {
  const c  = etat.container;
  const wrap = c.querySelector('#bloc-lieu-wrap');
  if (!wrap) return;

  function getCascade() {
    return { ...(etat.intervention._lieuCascade || { batiment: '', lieuVal: '', etageOption: '', suffixe: '' }) };
  }

  // Chip : croix reset → repasser en mode selects
  wrap.querySelector('#lieu-chip-reset')?.addEventListener('click', async () => {
    const cascade = { batiment: '', lieuVal: '', etageOption: '', suffixe: '' };
    etat.intervention._lieuCascade = cascade;
    etat.intervention.lieu = '';
    await majIntervention(etat.intervention.id, { lieu: '', _lieuCascade: cascade });
    rerenderBlocLieu();
  });

  // Épingle (chip mode ou résultat intermédiaire)
  wrap.querySelector('#btn-pin-lieu')?.addEventListener('click', () => {
    const v = etat.intervention.lieu || '';
    if (!v) return;
    togglePinLieu(v);
    rerenderBlocLieu();
  });

  // Col 1 : bâtiment
  wrap.querySelector('#casc-batiment')?.addEventListener('change', async (e) => {
    const cascade = { batiment: e.target.value, lieuVal: '', etageOption: '', suffixe: '' };
    await majLieuCascade(cascade);
  });

  // Col 2 : service/étage
  wrap.querySelector('#casc-lieu')?.addEventListener('change', async (e) => {
    const cascade = { ...getCascade(), lieuVal: e.target.value, etageOption: '', suffixe: '' };
    await majLieuCascade(cascade);
  });

  // Col 3 type (Ch. / S.int)
  wrap.querySelector('#casc-etage-opt')?.addEventListener('change', async (e) => {
    const cascade = { ...getCascade(), etageOption: e.target.value, suffixe: '' };
    await majLieuCascade(cascade);
  });

  // Col 3 suffixe
  const suffixeEl = wrap.querySelector('#casc-suffixe');
  if (suffixeEl) {
    const evt = suffixeEl.tagName === 'SELECT' ? 'change' : 'blur';
    suffixeEl.addEventListener(evt, async () => {
      const cascade = { ...getCascade(), suffixe: suffixeEl.value };
      await majLieuCascade(cascade);
    });
  }

  // Saisie libre
  wrap.querySelector('#casc-libre')?.addEventListener('blur', async (e) => {
    const v = e.target.value.trim();
    const cascade = { batiment: '__libre__', lieuVal: '__libre__', etageOption: '', suffixe: v };
    etat.intervention.lieu = v;
    etat.intervention._lieuCascade = cascade;
    await majIntervention(etat.intervention.id, { lieu: v, _lieuCascade: cascade });
    // Pas de rerenderBlocLieu ici pour ne pas perdre le focus
    const res = wrap.querySelector('.casc-resultat');
    if (res) res.textContent = v;
  });
}

function statutRequiresName(statutId) {
  if (!statutId) return true;
  const st = STATUTS_REFERENCE.find(s => s.id === statutId);
  return !st || st.requiresName;
}

// Retourne true si la première entrée engagement est via l'opérateur CDS
// (dans ce cas, c'est lui qui ouvre OnSphere et saisit la Description)
function estEngagementCDS(entrees) {
  const engagement = entrees.find(e => e.template === 'engagement');
  if (!engagement) return false; // pas encore d'engagement → on affiche la description par défaut
  return engagement.texte.includes('opérateur CDS');
}

// === Binding horaires ===

function bindHoraires() {
  const c = etat.container;
  const majDateHeure = async (champ, nouveauTime) => {
    const [h, m] = nouveauTime.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return;
    const dateActuelle = etat.intervention[champ];
    if (!dateActuelle) return;
    const nouvelleDate = new Date(dateActuelle);
    nouvelleDate.setHours(h, m, 0, 0);
    await majIntervention(etat.intervention.id, { [champ]: nouvelleDate });
    etat.intervention[champ] = nouvelleDate;
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

// === Binding en-tête ===

function bindEnTete() {
  const c = etat.container;

  // ── Cascade lieu ──────────────────────────────────────────────────────────
  bindBlocLieu();

  // Puces lieux épinglés → saisie libre avec chip direct
  c.querySelectorAll('.puce-lieu').forEach(btn => {
    btn.addEventListener('click', async () => {
      const v = btn.dataset.lieu;
      const cascade = { batiment: '__libre__', lieuVal: '__libre__', etageOption: '', suffixe: v };
      await majIntervention(etat.intervention.id, { lieu: v, _lieuCascade: cascade });
      etat.intervention.lieu = v;
      etat.intervention._lieuCascade = cascade;
      rerenderBlocLieu();
    });
  });

  // ── Statut / Nom ─────────────────────────────────────────────────────────
  c.querySelector('#champ-statut').addEventListener('change', async (e) => {
    const v = e.target.value || null;
    await majIntervention(etat.intervention.id, { referenceStatut: v });
    etat.intervention.referenceStatut = v;
    const inputNom     = c.querySelector('#champ-nom');
    const requiresName = statutRequiresName(v);
    inputNom.disabled  = !requiresName;
    inputNom.parentElement.classList.toggle('champ-disabled', !requiresName);
  });

  c.querySelector('#champ-nom').addEventListener('blur', async (e) => {
    const v = formatNom(e.target.value);
    e.target.value = v;
    await majIntervention(etat.intervention.id, { referenceNom: v });
    etat.intervention.referenceNom = v;
  });

  // ── Catégorie / Type ──────────────────────────────────────────────────────
  c.querySelector('#champ-categorie').addEventListener('change', async (e) => {
    const v = e.target.value || null;
    await majIntervention(etat.intervention.id, { categorie: v, type: '' });
    etat.intervention.categorie = v;
    etat.intervention.type = '';
    rafraichirAideMemoire();
    rafraichirSummary();
    // Re-render partiel du seul select type — conserve le <details> ouvert
    const wrap = c.querySelector('#champ-type-wrap');
    if (wrap) {
      wrap.innerHTML = '<span class="champ-label">Type</span>' + renderSelectType(v, '');
      bindListenersType();
    }
    // Si catégorie change → le bloc feu peut apparaître/disparaître : rerender complet seulement si nécessaire
    const estFeu = v === 'Feu / inondation / sinistre';
    const blocFeuActuel = !!c.querySelector('.bloc-rapport-feu');
    if (estFeu !== blocFeuActuel) {
      await renderInterventionEdit(etat.container);
    }
  });

  function bindListenersType() {
    c.querySelector('#champ-type-select')?.addEventListener('change', async (e) => {
      const val        = e.target.value;
      const inputLibre = c.querySelector('#champ-type');
      if (val === '__libre__') {
        if (inputLibre) inputLibre.style.display = '';
        inputLibre?.focus();
      } else {
        if (inputLibre) { inputLibre.style.display = 'none'; inputLibre.value = val; }
        await majIntervention(etat.intervention.id, { type: val });
        etat.intervention.type = val;
        rafraichirAideMemoire();
        rafraichirSummary();
        if (val === 'Objet dangereux') await insererEntreeObjetDangereux();
      }
    });
    c.querySelector('#champ-type')?.addEventListener('blur', async (e) => {
      await majIntervention(etat.intervention.id, { type: e.target.value.trim() });
      etat.intervention.type = e.target.value.trim();
      rafraichirAideMemoire();
      rafraichirSummary();
    });
  }

  // Initialiser les listeners type au chargement
  bindListenersType();

  // ── Champs feu ────────────────────────────────────────────────────────────
  c.querySelectorAll('.champ-feu-input').forEach(input => {
    input.addEventListener('blur', async () => {
      const champId = input.dataset.champFeu;
      const feu = { ...(etat.intervention.rapportFeu || {}) };
      feu[champId] = input.value.trim();
      await majIntervention(etat.intervention.id, { rapportFeu: feu });
      etat.intervention.rapportFeu = feu;
    });
  });

  c.querySelector('#champ-description')?.addEventListener('blur', async (e) => {
    await majIntervention(etat.intervention.id, { description: e.target.value.trim() });
    etat.intervention.description = e.target.value.trim();
  });
}

// Texte du <summary> du bloc catégorie/type : résumé si rempli, libellé par défaut sinon
function resumeSummary(categorie, type) {
  if (!categorie && !type) return 'Catégorie / Type / Description (optionnel)';
  const parties = [categorie, type].filter(x => x && x.trim());
  return parties.join(' — ');
}

function rafraichirSummary() {
  const el = etat.container.querySelector('#bloc-options-summary');
  if (el) el.textContent = resumeSummary(etat.intervention.categorie, etat.intervention.type);
}

function rafraichirAideMemoire() {
  const am = etat.container.querySelector('.aide-memoire-contenu');
  if (am) am.innerHTML = aideMemoireHTML(etat.intervention);
}

// === Helper : Select Type contextuel ===

function renderSelectType(categorie, typeActuel) {
  const types = categorie && TYPES_PAR_CATEGORIE[categorie];
  if (!types || types.length === 0) {
    return '<input type="text" id="champ-type" value="' + escapeHtml(typeActuel || '') + '" placeholder="Saisie libre…" />';
  }
  const libreSelected = !!(typeActuel && !types.includes(typeActuel));
  const optionsHTML = types.map(t => {
    const sel = typeActuel === t ? ' selected' : '';
    return '<option value="' + escapeHtml(t) + '"' + sel + '>' + escapeHtml(t) + '</option>';
  }).join('');
  const inputLibre = libreSelected
    ? '<input type="text" id="champ-type" value="' + escapeHtml(typeActuel || '') + '" placeholder="Saisie libre…" style="margin-top:var(--sp-1)" />'
    : '<input type="text" id="champ-type" value="" style="display:none" />';
  return '<select id="champ-type-select">'
    + '<option value="">— Choisir —</option>'
    + optionsHTML
    + '<option value="__libre__"' + (libreSelected ? ' selected' : '') + '>Autre (saisie libre)…</option>'
    + '</select>'
    + inputLibre;
}

// === Rendu : Bloc rapport feu ===

function renderBlocFeu(i) {
  const feu = i.rapportFeu || {};
  return `
    <section class="bloc-rapport-feu">
      <div class="bloc-titre">Rapport feu</div>
      <div class="champs-feu">
        ${CHAMPS_RAPPORT_FEU.map(champ => `
          <label class="champ">
            <span class="champ-label">${escapeHtml(champ.label)}</span>
            <input type="text" class="champ-feu-input" data-champ-feu="${champ.id}"
              value="${escapeHtml(feu[champ.id] || '')}"
              placeholder="${escapeHtml(champ.label)}…" />
          </label>
        `).join('')}
      </div>
    </section>
  `;
}

// === Rendu : Risques ===

function renderRisques(i) {
  const risques = i.risques || [];
  const cle     = ['auto', 'hetero', 'fugue'];
  const labels  = { auto: 'Auto-agressif', hetero: 'Hétéro-agressif', fugue: 'Fugue' };
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
      const r    = btn.dataset.risque;
      const cur  = etat.intervention.risques || [];
      const idx  = cur.indexOf(r);
      const nouveau = idx >= 0 ? cur.filter(x => x !== r) : [...cur, r];
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

// === Rendu : Actions workflow ===

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
        <button type="button" class="btn-action" data-template="renfortArrivee">Renfort arrivée</button>
        <button type="button" class="btn-action" data-template="renfortDepart">Départ renfort</button>
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
  etat.container.querySelectorAll('[data-template]').forEach(btn => {
    btn.addEventListener('click', () => declencherTemplate(btn.dataset.template, posteMoi));
  });
}

// === Templates ===

async function declencherTemplate(nom, posteMoi) {
  switch (nom) {
    case 'engagement':       return ouvrirDialogEngagement(posteMoi);
    case 'surPlace':         return ouvrirDialogSurPlace(posteMoi);
    case 'risques':          return ajouterRisquesAuSurPlace();
    case 'transmissionCDS':  return inserer(phraseTransmissionCDS({ posteMoi }), 'transmissionCDS');
    case 'transfert':        return ouvrirDialogTransfert();
    case 'noteLibre':        return ouvrirDialogNoteLibre();
    case 'renfortArrivee':   return ouvrirDialogRenfortArrivee(posteMoi);
    case 'renfortDepart':    return ouvrirDialogRenfortDepart();
    case 'releveBrigade':    return ouvrirDialogReleveBrigade(posteMoi);
    case 'releveSP':         return ouvrirDialogReleveSP(posteMoi);
    case 'finMedical':       return ouvrirDialogFinMedical();
    case 'transfertAmbulance': return ouvrirDialogTransfertAmbulance();
  }
}

// Extrait le nom du contact depuis la dernière entrée "Sur place" de l'intervention
function extraireDernierContactSurPlace() {
  const derniere = [...etat.entrees].reverse().find(e => e.template === 'surPlace');
  if (!derniere) return '';
  // Format attendu : "S255 sur place. Contact établi avec Infirmier(ère) soraya SELMANI."
  // On extrait tout ce qui suit "avec "
  const match = derniere.texte.match(/avec\s+(.+?)\.?\s*$/i);
  if (!match) return '';
  // Retire la fonction médicale si elle précède le nom
  let reste = match[1].trim();
  for (const f of FONCTIONS_MEDICALES) {
    if (reste.startsWith(f)) {
      reste = reste.slice(f.length).trim();
      break;
    }
  }
  return reste;
}

// Construit la phrase de risques à appender : "qui m'informe que le patient présente les risques : …"
function phraseRisquesAppend() {
  const risques        = etat.intervention.risques || [];
  const physiqueForte  = etat.intervention.physiqueForteAutorisee;
  const statutId       = etat.intervention.referenceStatut;

  // Label du sujet selon le statut
  const labelsStatut = {
    'pat':         'le patient',
    'det':         'le détenu',
    'prev':        'le prévenu',
    'body-packer': 'le patient (body packer)',
    'visiteur':    'le visiteur',
    'garde-tech':  'la personne',
    'chef-interv': 'la personne',
    'emp':         'la personne',
    'inconnu':     'l\'individu',
    'inconnue':    'l\'individu',
  };
  const sujet = labelsStatut[statutId] || 'le patient';

  // Labels risques
  const labelsRisques = { auto: 'auto-agressif', hetero: 'hétéro-agressif', fugue: 'fugue' };

  if (!risques.length && !physiqueForte) {
    return `qui m'informe qu'aucun risque particulier n'est signalé.`;
  }

  const listeRisques = risques.map(r => labelsRisques[r]).filter(Boolean);
  let phrase = `qui m'informe que ${sujet} présente`;

  if (listeRisques.length === 1) {
    phrase += ` un risque ${listeRisques[0]}`;
  } else if (listeRisques.length > 1) {
    const dernierRisque = listeRisques.pop();
    phrase += ` des risques ${listeRisques.join(', ')} et ${dernierRisque}`;
  }

  if (physiqueForte) {
    phrase += listeRisques.length ? '. Physique forte autorisée' : 'un risque. Physique forte autorisée';
  }

  return phrase + '.';
}

// Appende les risques à la dernière entrée "Sur place", ou crée une entrée séparée si absente
async function ajouterRisquesAuSurPlace() {
  const dernierSurPlace = [...etat.entrees].reverse().find(e => e.template === 'surPlace');

  if (!dernierSurPlace) {
    // Pas de surPlace → comportement de secours : entrée risques séparée
    const texteRisques = phraseRisques({ risques: etat.intervention.risques, physiqueForte: etat.intervention.physiqueForteAutorisee });
    return inserer(texteRisques || 'Aucun risque particulier signalé.', 'risques');
  }

  // Retirer le point final du surPlace s'il y en a un, puis appender
  const texteActuel  = dernierSurPlace.texte.trimEnd().replace(/\.$/, '');
  const append       = phraseRisquesAppend();
  const nouveauTexte = `${texteActuel} ${append}`;

  // Mutation silencieuse : pas de rerender complet, juste màj base + textarea visible
  await majEntree(dernierSurPlace.id, { texte: nouveauTexte });
  dernierSurPlace.texte = nouveauTexte;

  // Mettre à jour le textarea visible sans rerender toute la page
  const ta = etat.container.querySelector(`.entree-texte[data-id="${dernierSurPlace.id}"]`);
  if (ta) {
    ta.value = nouveauTexte;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  } else {
    // Fallback si le textarea n'est pas visible
    await renderInterventionEdit(etat.container);
  }
}
async function insererEntreeObjetDangereux() {
  const demandeur = extraireDernierContactSurPlace();
  const dateSaisie = formatHeureInput(etat.intervention.debut);
  const texte = 'Demandeur : ' + (demandeur || '')
    + '\nType d\'objet dangereux : '
    + '\nDescription : '
    + '\nDate de la saisie : ' + dateSaisie
    + '\n\nCopie de la quittance remise dans le dossier du patient. Informations archivées au cahier de suivi selon procédure.';
  await ajouterEntree(etat.intervention.id, texte, 'objetDangereux', etat.intervention.debut);
  await renderInterventionEdit(etat.container);
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
        <button type="button" class="btn-primaire"   data-dialog="confirmer">Insérer</button>
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
    } catch (e) { console.error('[Dialog] Erreur:', e); }
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fermer(); });
  setTimeout(() => { overlay.querySelector('input, textarea, select')?.focus(); }, 50);
}

function ouvrirDialogEngagement(posteMoi) {
  const autresPostes = POSTES.filter(p => p !== posteMoi);

  ouvrirDialog('Engagement', `
    <label class="champ">
      <span class="champ-label">Engagement par</span>
      <select id="d-engagement-source">
        <optgroup label="Opérateur">
          <option value="cds">Opérateur CDS</option>
        </optgroup>
        <optgroup label="Médical">
          <option value="medical">Médical en direct</option>
        </optgroup>
        <optgroup label="Agent">
          <option value="agent-brigade">Agent brigade (poste)</option>
          <option value="agent-sp">Agent SP</option>
        </optgroup>
        <optgroup label="Autre">
          <option value="visiteur">Visiteur</option>
          <option value="accompagnant">Accompagnant</option>
          <option value="admissionniste">Admissionniste</option>
          <option value="employe-chuv">Employé CHUV</option>
          <option value="garde-technique">Garde Technique</option>
          <option value="personne-exterieure">Personne extérieure</option>
          <option value="patient">Patient</option>
        </optgroup>
      </select>
    </label>

    <!-- Champ poste brigade — visible si agent-brigade -->
    <label class="champ" id="d-engagement-poste-wrap" style="display:none">
      <span class="champ-label">Poste</span>
      <select id="d-engagement-poste">
        <option value="">— Choisir —</option>
        ${autresPostes.map(p => `<option value="${p}">${p}</option>`).join('')}
        <option value="SP">SP</option>
      </select>
    </label>

    <!-- Champ matricule SP — visible si agent-sp -->
    <label class="champ" id="d-engagement-matricule-wrap" style="display:none">
      <span class="champ-label">Matricule SP</span>
      <input type="text" id="d-engagement-matricule" inputmode="numeric" placeholder="ex: 555190" />
    </label>

    <label class="champ">
      <span class="champ-label">Motif court (optionnel)</span>
      <input type="text" id="d-engagement-motif" placeholder="ex: demande de surveillance patient à risque auto-agressif" />
    </label>
  `, async (overlay) => {
    const source    = overlay.querySelector('#d-engagement-source').value;
    const motif     = overlay.querySelector('#d-engagement-motif').value;
    const poste     = overlay.querySelector('#d-engagement-poste')?.value || '';
    const matricule = overlay.querySelector('#d-engagement-matricule')?.value || '';
    await inserer(phraseEngagement({ source, motif, poste, matricule }), 'engagement');
    // Après insertion, si ce n'est pas CDS on rerend pour afficher le champ Description
    await renderInterventionEdit(etat.container);
  });

  // Show/hide champs contextuels selon la source choisie
  setTimeout(() => {
    const sel = document.querySelector('#d-engagement-source');
    const posteWrap = document.querySelector('#d-engagement-poste-wrap');
    const matriculeWrap = document.querySelector('#d-engagement-matricule-wrap');
    if (!sel) return;
    const majVisibilite = () => {
      posteWrap.style.display     = sel.value === 'agent-brigade' ? '' : 'none';
      matriculeWrap.style.display = sel.value === 'agent-sp'      ? '' : 'none';
    };
    sel.addEventListener('change', majVisibilite);
    majVisibilite();
  }, 50);
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
      <input type="text" id="d-surplace-nom" placeholder="ex: soraya SELMANI" />
    </label>
  `, async (overlay) => {
    const fonction = overlay.querySelector('#d-surplace-fonction').value;
    const nomBrut  = overlay.querySelector('#d-surplace-nom').value;
    const nom      = formatNom(nomBrut);
    await inserer(phraseSurPlace({ posteMoi, fonction, nom }), 'surPlace');
  });

  // Formatage au blur sur le champ nom du dialog
  setTimeout(() => {
    const inputNom = document.querySelector('#d-surplace-nom');
    if (inputNom) {
      inputNom.addEventListener('blur', () => {
        inputNom.value = formatNom(inputNom.value);
      });
    }
  }, 50);
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

// === Renforts ===

function idRenfort() {
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

function ouvrirDialogRenfortArrivee(posteMoi) {
  const autresPostes = POSTES.filter(p => p !== posteMoi);
  ouvrirDialog('Renfort — arrivée', `
    <p class="dialog-hint" style="margin-bottom:var(--sp-3)">Sélectionne un poste <strong>ou</strong> saisis un agent en champ libre.</p>
    <label class="champ">
      <span class="champ-label">Poste brigade</span>
      <select id="d-renfort-poste">
        <option value="">— Choisir un poste —</option>
        ${autresPostes.map(p => `<option value="${p}">${p}</option>`).join('')}
      </select>
    </label>
    <label class="champ">
      <span class="champ-label">Ou agent / fonction (champ libre)</span>
      <input type="text" id="d-renfort-libre" placeholder="ex: Médecin de garde, Agent SP…" />
    </label>
  `, async (overlay) => {
    const poste = overlay.querySelector('#d-renfort-poste').value;
    const libre = overlay.querySelector('#d-renfort-libre').value.trim();
    const label = libre || poste;
    if (!label) return false;
    const renforts = Array.isArray(etat.intervention.renforts) ? etat.intervention.renforts.slice() : [];
    renforts.push({ id: idRenfort(), label, heureArrivee: new Date().toISOString(), heureFin: null });
    await majIntervention(etat.intervention.id, { renforts });
    etat.intervention.renforts = renforts;
    await inserer(`Arrivée du ${label} sur place.`, 'renfortArrivee');
  });
}

function ouvrirDialogRenfortDepart() {
  const renforts = (etat.intervention.renforts || []).filter(r => !r.heureFin);
  if (renforts.length === 0) {
    ouvrirDialog('Départ renfort', `
      <p style="color:var(--texte-faible);text-align:center;padding:var(--sp-4) 0">
        Aucun renfort actif sur cette intervention.
      </p>
    `, async () => {});
    return;
  }
  ouvrirDialog('Départ renfort', `
    <p class="dialog-hint" style="margin-bottom:var(--sp-3)">Sélectionne l'agent qui se désengage.</p>
    <div class="liste-renforts-actifs">
      ${renforts.map(r => {
        const arrivee = r.heureArrivee ? formatHeure(new Date(r.heureArrivee)) : '?';
        return `
          <div class="renfort-actif" data-renfort-id="${r.id}">
            <div class="renfort-actif-info">
              <span class="renfort-actif-label">${escapeHtml(r.label)}</span>
              <span class="renfort-actif-depuis">depuis ${arrivee}</span>
            </div>
            <button type="button" class="btn-secondaire btn-renfort-depart" data-renfort-id="${r.id}">
              Enregistrer départ
            </button>
          </div>
        `;
      }).join('')}
    </div>
  `, async () => {});

  setTimeout(() => {
    document.querySelectorAll('.btn-renfort-depart').forEach(btn => {
      btn.addEventListener('click', async () => {
        const renfortId = btn.dataset.renfortId;
        const renfort   = renforts.find(r => r.id === renfortId);
        if (!renfort) return;
        const maintenant = new Date();
        const renforts2  = (etat.intervention.renforts || []).map(r =>
          r.id === renfortId ? { ...r, heureFin: maintenant.toISOString() } : r
        );
        await majIntervention(etat.intervention.id, { renforts: renforts2 });
        etat.intervention.renforts = renforts2;
        await inserer(`${renfort.label} quitte l'intervention.`, 'renfortDepart');
        document.querySelector('.dialog-overlay')?.remove();
      });
    });
  }, 0);
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
  // Pré-remplissage depuis la dernière entrée "Sur place" de cette intervention
  const dernierSurPlace = [...etat.entrees].reverse().find(e => e.template === 'surPlace');

  let fonctionPre = '';
  let nomPre = '';
  if (dernierSurPlace) {
    const fonctionTrouvee = FONCTIONS_MEDICALES.find(f => dernierSurPlace.texte.includes(f));
    if (fonctionTrouvee) {
      fonctionPre = fonctionTrouvee;
      const apres = dernierSurPlace.texte.split(fonctionTrouvee)[1] || '';
      nomPre = apres.replace(/^\s+/, '').replace(/\.$/, '').split('.')[0].trim();
    }
  }

  ouvrirDialog('Fin par médical', `
    <label class="champ">
      <span class="champ-label">Fonction</span>
      <select id="d-finmed-fonction">
        <option value="">— Aucune —</option>
        ${FONCTIONS_MEDICALES.map(f => `<option value="${escapeHtml(f)}" ${fonctionPre === f ? 'selected' : ''}>${escapeHtml(f)}</option>`).join('')}
      </select>
    </label>
    <label class="champ">
      <span class="champ-label">Prénom et nom</span>
      <input type="text" id="d-finmed-nom" value="${escapeHtml(nomPre)}" placeholder="ex: anne marie KOUDRY" />
    </label>
    ${dernierSurPlace ? `<p class="dialog-hint">Pré-rempli depuis le contact "Sur place". Modifie si différent.</p>` : ''}
  `, async (overlay) => {
    const fonction = overlay.querySelector('#d-finmed-fonction').value;
    const nomBrut  = overlay.querySelector('#d-finmed-nom').value;
    const nom      = formatNom(nomBrut);
    await inserer(phraseFinMedical({ fonction, nom }), 'finMedical');
  });

  // Formatage au blur sur le champ nom du dialog
  setTimeout(() => {
    const inputNom = document.querySelector('#d-finmed-nom');
    if (inputNom) {
      inputNom.addEventListener('blur', () => {
        inputNom.value = formatNom(inputNom.value);
      });
    }
  }, 50);
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
    const securise    = overlay.querySelector('#d-amb-type').value === 'securise';
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
          <li class="entree${e.horsRapport ? ' entree-hors-rapport' : ''}" data-id="${e.id}">
            <div class="entree-tete">
              <div class="entree-datetime">
                <span class="entree-date-label">${escapeHtml(formatDateEntree(e.heure))}</span>
                <div class="entree-inputs-dt">
                  <input type="date" class="entree-date" value="${escapeHtml(formatDateInput(e.heure))}" data-id="${e.id}" aria-label="Date de l'entrée" />
                  <input type="time" class="entree-heure" value="${escapeHtml(formatHeureInput(e.heure))}" data-id="${e.id}" aria-label="Heure de l'entrée" />
                </div>
              </div>
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

  // Modification de la DATE d'une entrée
  c.querySelectorAll('.entree-date').forEach(input => {
    input.addEventListener('change', async () => {
      const id     = parseInt(input.dataset.id, 10);
      const entree = etat.entrees.find(e => e.id === id);
      if (!entree) return;
      const parts = input.value.split('-').map(Number); // [YYYY, MM, DD]
      if (parts.length !== 3 || parts.some(Number.isNaN)) return;
      const d = new Date(entree.heure);
      d.setFullYear(parts[0], parts[1] - 1, parts[2]);
      await majEntree(id, { heure: d });
      entree.heure = d;
      // Mettre à jour le label JJ/MM affiché sans rerender toute la page
      const li    = input.closest('.entree');
      const label = li?.querySelector('.entree-date-label');
      if (label) label.textContent = formatDateEntree(d);
    });
  });

  // Modification de l'HEURE d'une entrée
  c.querySelectorAll('.entree-heure').forEach(input => {
    input.addEventListener('change', async () => {
      const id   = parseInt(input.dataset.id, 10);
      const [h, m] = input.value.split(':').map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return;
      const entree = etat.entrees.find(e => e.id === id);
      if (!entree) return;
      const d = new Date(entree.heure);
      d.setHours(h, m, 0, 0);
      await majEntree(id, { heure: d });
      entree.heure = d;
    });
  });

  c.querySelectorAll('.entree-texte').forEach(ta => {
    ta.addEventListener('blur', async () => {
      const id = parseInt(ta.dataset.id, 10);
      const v  = ta.value.trim();
      await majEntree(id, { texte: v });
      const e = etat.entrees.find(x => x.id === id);
      if (e) e.texte = v;
    });
    const adjust = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
    ta.addEventListener('input', adjust);
    setTimeout(adjust, 0);
  });

  c.querySelectorAll('[data-copy-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.copyId, 10);
      const e  = etat.entrees.find(x => x.id === id);
      if (!e) return;
      const ok = await copierDansPressePapier(e.texte, btn);
      if (!ok) alert('Échec de la copie. Sélectionne le texte manuellement.');
    });
  });

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
    { label: 'Lieu',      val: i.lieu },
    { label: 'Catégorie', val: i.categorie },
    { label: 'Type',      val: i.type },
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
  const refTxt      = formatReference(i.referenceStatut, i.referenceNom);
  const descTxt     = (i.description || '').trim();
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

        <button type="button" class="btn-copie btn-copie-claude" data-copy="export-claude" ${entrees.length > 0 ? '' : 'disabled'}>
          🤖 Exporter pour Claude
          <span class="btn-copie-preview">Copie le rapport anonymisé — colle dans ton projet Claude "Rapport"</span>
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
      const i    = etat.intervention;

      // Export Claude — module dédié gère la copie
      if (type === 'export-claude') {
        await exporterIntervention(i, btn);
        return;
      }

      let texte = '';
      if (type === 'reference') {
        texte = formatReference(i.referenceStatut, i.referenceNom);
      } else if (type === 'description') {
        texte = i.description || '';
      } else if (type === 'rapport') {
        texte = etat.entrees.filter(e => !e.horsRapport).map(e => `${formatHeure(e.heure)} — ${e.texte}`).join('\n');
      }

      if (!texte) return;
      const ok = await copierDansPressePapier(texte, btn);
      if (!ok) alert('Échec de la copie. Sélectionne le texte manuellement.');
    });
  });
}

// === Rendu : Actions du bas ===

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
