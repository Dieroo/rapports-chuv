// Tableau des gardes en cours — Slice 5 V4
// Cascade lieu : selects inline → chip une fois complet
// Boutons : 🚨 Intervention, 🔄 Transfert, 📝 Notes, ✅ Terminée, ⏸ Suspendue, 🗑 Supprimer

import { majService } from '../db.js';
import { creerIntervention, ajouterEntree } from '../db.js';
import { escapeHtml } from '../ui.js';
import { setInterventionCourante, setEcran, s } from '../state.js';
import {
  BATIMENTS_LISTE, STATUTS_GARDE, LIEUX_PAR_BATIMENT,
  composerLieu, lieuEstComplet
} from '../../data/referentiels.js';

const OPTIONS_NATEL   = ['', ...Array.from({ length: 20 }, (_, i) => `SP${i + 1}`)];
const OPTIONS_RISQUES = ['', 'Auto', 'Hétéro', 'Fugue', 'Auto+Hétéro', 'Tous'];

// Services d'urgences (pour déterminer "box" vs "chambre" au retour)
const SERVICES_URGENCES = ['URGC', 'URGA', 'URGO', 'UAPC'];

function estServiceUrgences(garde) {
  const v = garde.lieuVal || '';
  return SERVICES_URGENCES.some(u => v.startsWith(u));
}

// Mot-clé adapté au statut
function motStatut(statut) {
  if (statut === 'Détenu')  return 'détenu';
  if (statut === 'Prévenu') return 'prévenu';
  if (statut === 'Body packer') return 'body packer';
  return 'patient';
}

function estDetenuOuPrevenu(statut) {
  return statut === 'Détenu' || statut === 'Prévenu';
}

// Poste courant (ex: S257)
function getPosteCourant() {
  return s().serviceCourant?.poste || 'S???';
}

// ─── Helpers options col2 (étage/service, labels courts) ────────────────────

function optionsCol2(batiment, lieuActuel = '') {
  const cfg = LIEUX_PAR_BATIMENT[batiment];
  let html = `<option value="">—</option>`;
  if (!cfg) return html + `<option value="__libre__">Saisie libre…</option>`;
  if (cfg.prioritaires) {
    cfg.prioritaires.forEach(p => {
      html += `<option value="${p.valeur}"${lieuActuel === p.valeur ? ' selected' : ''}>${escapeHtml(p.label)}</option>`;
    });
  }
  if (cfg.etages) {
    cfg.etages.forEach(e => {
      html += `<option value="${e.valeur}"${lieuActuel === e.valeur ? ' selected' : ''}>${escapeHtml(e.numero)}</option>`;
    });
  }
  html += `<option value="__libre__"${lieuActuel === '__libre__' ? ' selected' : ''}>Saisie libre…</option>`;
  return html;
}

// ─── Col 3 : HTML du(des) champ(s) suffixe ──────────────────────────────────

function htmlCol3(batiment, lieuVal, suffixeActuel = '', etageOption = '') {
  if (!lieuVal || lieuVal === '__libre__') {
    return `<input type="text" class="lieu-col3 lieu-col3-libre" placeholder="…" value="${escapeHtml(suffixeActuel)}" />`;
  }
  const cfg = LIEUX_PAR_BATIMENT[batiment];
  if (!cfg) return `<input type="text" class="lieu-col3 lieu-col3-libre" placeholder="…" value="${escapeHtml(suffixeActuel)}" />`;

  if (cfg.prioritaires) {
    const p = cfg.prioritaires.find(x => x.valeur === lieuVal);
    if (p) {
      if (p.type === 'fixe') return '';
      if (p.type === 'lettre') {
        const opts = (p.lettres || '').split('').map(l =>
          `<option value="${l}"${suffixeActuel === l ? ' selected' : ''}>${l}</option>`).join('');
        return `<select class="lieu-col3"><option value="">—</option>${opts}</select>`;
      }
      if (p.type === 'select') {
        const opts = p.options.map(o =>
          `<option value="${o}"${suffixeActuel === o ? ' selected' : ''}>${o}</option>`).join('');
        return `<select class="lieu-col3"><option value="">—</option>${opts}</select>`;
      }
      if (p.type === 'numero') {
        return `<input type="text" class="lieu-col3 lieu-col3-num" inputmode="numeric" placeholder="N°" value="${escapeHtml(suffixeActuel)}" />`;
      }
    }
  }

  if (lieuVal.startsWith('etage-') && cfg.etageOptions) {
    if (cfg.etageOptions.length > 1) {
      const typeOpts = cfg.etageOptions.map(o =>
        `<option value="${o.valeur}"${etageOption === o.valeur ? ' selected' : ''}>${o.valeur === 'chambre' ? 'Ch.' : 'S.int'}</option>`).join('');
      const selectType = `<select class="lieu-col3-type"><option value="">—</option>${typeOpts}</select>`;
      const optDef = cfg.etageOptions.find(o => o.valeur === etageOption);
      if (!optDef) return selectType;
      if (optDef.type === 'numero') {
        return `${selectType}<input type="text" class="lieu-col3 lieu-col3-num" inputmode="numeric" placeholder="N°" value="${escapeHtml(suffixeActuel)}" />`;
      }
      if (optDef.type === 'select') {
        const litOpts = optDef.options.map(o => `<option value="${o}"${suffixeActuel === o ? ' selected' : ''}>${o}</option>`).join('');
        return `${selectType}<select class="lieu-col3"><option value="">—</option>${litOpts}</select>`;
      }
      return selectType;
    }
    return `<input type="text" class="lieu-col3 lieu-col3-num" inputmode="numeric" placeholder="N°" value="${escapeHtml(suffixeActuel)}" />`;
  }
  return '';
}

// ─── Render de la cellule lieu selon l'état ──────────────────────────────────

function renderCelleLieu(g) {
  const { batiment, lieuVal, etageOption, lieuSuffixe: suffixe } = g;
  const complet = lieuEstComplet(batiment, lieuVal, etageOption, suffixe);
  const lieuCompose = composerLieu(batiment, lieuVal, etageOption, suffixe);

  if (complet && lieuCompose) {
    return `<div class="lieu-chip">
      <span class="lieu-chip-texte">${escapeHtml(lieuCompose)}</span>
      <button type="button" class="lieu-chip-reset" title="Modifier le lieu" aria-label="Effacer et reselectionner">×</button>
    </div>`;
  }

  const c3 = htmlCol3(batiment, lieuVal, suffixe, etageOption);
  return `<div class="lieu-selects">
    <div class="lieu-inline">
      <select class="lieu-col1" data-champ="batiment">
        <option value="">Bât.</option>
        ${BATIMENTS_LISTE.map(b => `<option value="${b}"${batiment === b ? ' selected' : ''}>${b}</option>`).join('')}
        <option value="__libre__"${batiment === '__libre__' ? ' selected' : ''}>Saisie libre…</option>
      </select>
      ${batiment && batiment !== '__libre__' ? `
        <span class="lieu-sep">/</span>
        <select class="lieu-col2" data-champ="lieuVal">
          ${optionsCol2(batiment, lieuVal)}
        </select>
      ` : ''}
      ${c3 ? `<span class="lieu-sep">/</span><span class="lieu-col3-wrap">${c3}</span>` : ''}
    </div>
    ${batiment === '__libre__' ? `
      <input type="text" class="lieu-libre-input" placeholder="ex: BU44/07/PLI" value="${escapeHtml(suffixe || '')}" />
    ` : ''}
  </div>`;
}

// ─── Rendu du mini-select lieu dans un dialog ────────────────────────────────

function renderDialogLieu(prefixId, valeurs = {}) {
  const bat = valeurs.batiment || '';
  const lv  = valeurs.lieuVal || '';
  const eo  = valeurs.etageOption || '';
  const suf = valeurs.lieuSuffixe || '';
  const c3  = htmlCol3(bat, lv, suf, eo);

  return `<div class="dialog-lieu-cascade" data-prefix="${prefixId}">
    <div class="lieu-inline">
      <select class="dlieu-col1">
        <option value="">Bât.</option>
        ${BATIMENTS_LISTE.map(b => `<option value="${b}"${bat === b ? ' selected' : ''}>${b}</option>`).join('')}
        <option value="__libre__"${bat === '__libre__' ? ' selected' : ''}>Saisie libre…</option>
      </select>
      ${bat && bat !== '__libre__' ? `
        <span class="lieu-sep">/</span>
        <select class="dlieu-col2">${optionsCol2(bat, lv)}</select>
      ` : ''}
      ${c3 ? `<span class="lieu-sep">/</span><span class="dlieu-col3-wrap">${c3}</span>` : ''}
    </div>
    ${bat === '__libre__' ? `
      <input type="text" class="dlieu-libre" placeholder="ex: BU44/07/PLI" value="${escapeHtml(suf || '')}" />
    ` : ''}
  </div>`;
}

// Lire les valeurs du dialog lieu
function lireDialogLieu(container) {
  const bat = container.querySelector('.dlieu-col1')?.value || '';
  const lv  = container.querySelector('.dlieu-col2')?.value || '';
  const eo  = container.querySelector('.lieu-col3-type')?.value || '';
  const col3El = container.querySelector('.lieu-col3');
  const libre  = container.querySelector('.dlieu-libre');
  let suf = '';
  if (libre) {
    suf = libre.value.trim();
  } else if (col3El) {
    suf = col3El.value;
  }
  return { batiment: bat, lieuVal: lv, etageOption: eo, lieuSuffixe: suf };
}

// Binder les événements cascade dans un dialog lieu
function bindDialogLieu(container, onUpdate) {
  const wrap = container.querySelector('.dialog-lieu-cascade');
  if (!wrap) return;

  wrap.querySelector('.dlieu-col1')?.addEventListener('change', () => {
    if (onUpdate) onUpdate();
  });
  wrap.querySelector('.dlieu-col2')?.addEventListener('change', () => {
    if (onUpdate) onUpdate();
  });
  wrap.querySelector('.lieu-col3-type')?.addEventListener('change', () => {
    if (onUpdate) onUpdate();
  });
  // col3 select/input
  const col3El = wrap.querySelector('.lieu-col3');
  if (col3El) {
    col3El.addEventListener(col3El.tagName === 'SELECT' ? 'change' : 'blur', () => {
      if (onUpdate) onUpdate();
    });
  }
}

// Re-render le contenu du dialog lieu (après changement de col1 ou col2)
function rerenderDialogLieu(container, vals) {
  const wrap = container.querySelector('.dialog-lieu-cascade');
  if (!wrap) return;
  wrap.outerHTML = renderDialogLieu(wrap.dataset.prefix, vals);
  bindDialogLieu(container, () => {
    const newVals = lireDialogLieu(container);
    rerenderDialogLieu(container, newVals);
  });
}


// ═══════════════════════════════════════════════════════════════════════════════
// DIALOG TRANSFERT
// ═══════════════════════════════════════════════════════════════════════════════

function ouvrirDialogTransfert(garde, idx, service, onMaj) {
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.innerHTML = `
    <div class="dialog" role="dialog" aria-modal="true">
      <div class="dialog-titre">Transfert — ${escapeHtml(garde.nom || 'Garde')}</div>
      <div class="dialog-contenu">
        <p class="dialog-hint">Quel type de transfert ?</p>
        <div class="dialog-actions-choix">
          <button type="button" class="btn-primaire btn-sm" data-choix="service">Transfert de service</button>
          <button type="button" class="btn-secondaire btn-sm" data-choix="examen">Transfert pour examen</button>
        </div>
      </div>
      <div class="dialog-actions">
        <button type="button" class="btn-secondaire" data-dialog="annuler">Annuler</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const fermer = () => overlay.remove();
  overlay.querySelector('[data-dialog="annuler"]').addEventListener('click', fermer);
  overlay.addEventListener('click', e => { if (e.target === overlay) fermer(); });

  overlay.querySelector('[data-choix="service"]').addEventListener('click', () => {
    fermer();
    ouvrirDialogTransfertService(garde, idx, service, onMaj);
  });
  overlay.querySelector('[data-choix="examen"]').addEventListener('click', () => {
    fermer();
    ouvrirDialogTransfertExamen(garde, idx, service, onMaj);
  });
}

// ─── Dialog Transfert de service ─────────────────────────────────────────────

function ouvrirDialogTransfertService(garde, idx, service, onMaj) {
  const detenu = estDetenuOuPrevenu(garde.statut);

  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.innerHTML = `
    <div class="dialog dialog-transfert" role="dialog" aria-modal="true">
      <div class="dialog-titre">Transfert de service</div>
      <div class="dialog-contenu">
        <div class="champ">
          <span class="champ-label">Destination</span>
          ${renderDialogLieu('ts', {})}
        </div>
        ${detenu ? `
          <div class="champ" style="margin-top:var(--sp-3)">
            <span class="champ-label">Entraves de chevilles</span>
            <div class="dialog-choix-gardes">
              <label><input type="radio" name="entraves" value="retirées" checked /> Retirées</label>
              <label><input type="radio" name="entraves" value="maintenues" /> Maintenues</label>
            </div>
          </div>
        ` : ''}
      </div>
      <div class="dialog-actions">
        <button type="button" class="btn-secondaire" data-dialog="annuler">Annuler</button>
        <button type="button" class="btn-primaire" data-dialog="confirmer">Insérer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const fermer = () => overlay.remove();
  overlay.querySelector('[data-dialog="annuler"]').addEventListener('click', fermer);
  overlay.addEventListener('click', e => { if (e.target === overlay) fermer(); });

  // Bind cascade lieu dans le dialog
  bindDialogLieu(overlay, () => {
    const vals = lireDialogLieu(overlay);
    rerenderDialogLieu(overlay, vals);
  });

  overlay.querySelector('[data-dialog="confirmer"]').addEventListener('click', async () => {
    const vals = lireDialogLieu(overlay);
    const lieuStr = composerLieu(vals.batiment, vals.lieuVal, vals.etageOption, vals.lieuSuffixe);
    if (!lieuStr) { alert('Sélectionne un lieu de destination.'); return; }

    const mot = motStatut(garde.statut);
    const poste = getPosteCourant();
    let texte = `Transfert du ${mot} au ${lieuStr} effectué par ${poste}.`;

    if (detenu) {
      const entraves = overlay.querySelector('[name="entraves"]:checked')?.value || 'retirées';
      texte += ` Mise en place de l'agent SP et sécurisation de la chambre. Entraves de chevilles ${entraves}.`;
    }

    // Assurer l'intervention existe
    const intId = await assurerIntervention(garde, idx, service, onMaj);

    // Ajouter l'entrée chrono
    await ajouterEntree(intId, texte, 'transfert-service');

    // Mettre à jour le lieu dans le tableau des gardes
    const gardes = [...(service.gardes || [])];
    gardes[idx] = {
      ...gardes[idx],
      batiment: vals.batiment,
      lieuVal: vals.lieuVal,
      etageOption: vals.etageOption,
      lieuSuffixe: vals.lieuSuffixe
    };
    service.gardes = gardes;
    await majService(service.id, { gardes });
    if (onMaj) onMaj(service);

    fermer();

    // Re-render le tableau
    const blocGardes = document.querySelector('#bloc-gardes-container');
    if (blocGardes) renderTableauGardes(blocGardes, service, onMaj);
  });
}

// ─── Dialog Transfert pour examen ────────────────────────────────────────────

const TYPES_EXAMEN = ['Radiologie', 'Scanner', 'IRM', 'Salle de plâtre'];
const LIEUX_EXAMEN = [
  { label: 'Urgences du BH05', valeur: 'urgences du BH05' },
  { label: 'BH07',             valeur: 'du BH07' },
  { label: 'BH08',             valeur: 'du BH08' },
];

function ouvrirDialogTransfertExamen(garde, idx, service, onMaj) {
  const now = new Date();
  const heureDefaut = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.innerHTML = `
    <div class="dialog" role="dialog" aria-modal="true">
      <div class="dialog-titre">Transfert pour examen</div>
      <div class="dialog-contenu">
        <div class="champ">
          <span class="champ-label">Type d'examen</span>
          <select id="d-type-examen">
            ${TYPES_EXAMEN.map(t => `<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>
        <div class="champ">
          <span class="champ-label">Lieu</span>
          <select id="d-lieu-examen">
            ${LIEUX_EXAMEN.map(l => `<option value="${l.valeur}">${l.label}</option>`).join('')}
          </select>
        </div>
        <div class="champ">
          <span class="champ-label">Heure de transfert</span>
          <input type="time" id="d-heure-examen" value="${heureDefaut}" />
        </div>
      </div>
      <div class="dialog-actions">
        <button type="button" class="btn-secondaire" data-dialog="annuler">Annuler</button>
        <button type="button" class="btn-primaire" data-dialog="confirmer">Insérer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const fermer = () => overlay.remove();
  overlay.querySelector('[data-dialog="annuler"]').addEventListener('click', fermer);
  overlay.addEventListener('click', e => { if (e.target === overlay) fermer(); });

  overlay.querySelector('[data-dialog="confirmer"]').addEventListener('click', async () => {
    const typeExamen = overlay.querySelector('#d-type-examen').value;
    const lieuExamen = overlay.querySelector('#d-lieu-examen').value;
    const heureStr   = overlay.querySelector('#d-heure-examen').value;

    // Construire heure
    const [h, m] = heureStr.split(':').map(Number);
    const heure = new Date();
    heure.setHours(h, m, 0, 0);

    const mot = motStatut(garde.statut);
    const serviceExamen = typeExamen.toLowerCase();
    const texte = `Transfert du ${mot} dans le service ${serviceExamen} des ${lieuExamen}.`;

    // Assurer l'intervention existe
    const intId = await assurerIntervention(garde, idx, service, onMaj);

    // Ajouter entrée HORS RAPPORT
    await ajouterEntree(intId, texte, 'transfert-examen', heure);
    // Marquer l'entrée comme horsRapport
    const { listerEntreesIntervention, majEntree: majE } = await import('../db.js');
    const entrees = await listerEntreesIntervention(intId);
    const derniere = entrees[entrees.length - 1];
    if (derniere) await majE(derniere.id, { horsRapport: true });

    // Marquer la garde comme "en examen" pour afficher le bouton retour
    const gardes = [...(service.gardes || [])];
    gardes[idx] = {
      ...gardes[idx],
      enExamen: true,
      typeExamen,
      lieuExamen
    };
    service.gardes = gardes;
    await majService(service.id, { gardes });
    if (onMaj) onMaj(service);

    fermer();

    const blocGardes = document.querySelector('#bloc-gardes-container');
    if (blocGardes) renderTableauGardes(blocGardes, service, onMaj);
  });
}

// ─── Retour d'examen ─────────────────────────────────────────────────────────

async function retourExamen(garde, idx, service, onMaj) {
  const mot = motStatut(garde.statut);
  const enUrgences = estServiceUrgences(garde);
  const lieuRetour = enUrgences ? 'en box' : 'en chambre';
  const texte = `Retour du ${mot} ${lieuRetour}.`;

  const intId = await assurerIntervention(garde, idx, service, onMaj);
  await ajouterEntree(intId, texte, 'retour-examen');

  // Retirer le flag enExamen
  const gardes = [...(service.gardes || [])];
  gardes[idx] = {
    ...gardes[idx],
    enExamen: false,
    typeExamen: null,
    lieuExamen: null
  };
  service.gardes = gardes;
  await majService(service.id, { gardes });
  if (onMaj) onMaj(service);

  const blocGardes = document.querySelector('#bloc-gardes-container');
  if (blocGardes) renderTableauGardes(blocGardes, service, onMaj);
}


// ═══════════════════════════════════════════════════════════════════════════════
// ASSURER INTERVENTION (créer ou réutiliser)
// ═══════════════════════════════════════════════════════════════════════════════

async function assurerIntervention(garde, idx, service, onMaj) {
  // Si la garde a déjà une intervention liée, on la réutilise
  if (garde.interventionId) return garde.interventionId;

  // Sinon, créer une nouvelle intervention pré-remplie
  const lieuStr = composerLieu(garde.batiment, garde.lieuVal, garde.etageOption, garde.lieuSuffixe);
  const nouvelle = await creerIntervention({
    serviceId:       service.id,
    lieu:            lieuStr || '',
    referenceStatut: garde.statut || null,
    referenceNom:    garde.nom || '',
    debut:           new Date()
  });

  // Stocker l'interventionId sur la garde
  const gardes = [...(service.gardes || [])];
  gardes[idx] = { ...gardes[idx], interventionId: nouvelle.id };
  service.gardes = gardes;
  await majService(service.id, { gardes });
  if (onMaj) onMaj(service);

  return nouvelle.id;
}


// ═══════════════════════════════════════════════════════════════════════════════
// RENDU PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export function renderTableauGardes(container, service, onMaj) {
  const gardes = Array.isArray(service.gardes) ? service.gardes : [];

  container.innerHTML = `
    <section class="bloc-gardes">
      <div class="bloc-gardes-titre">
        <span class="bloc-titre">Gardes en cours</span>
        <button type="button" class="btn-ajouter-garde" data-action="ajouter-garde">+ Garde</button>
      </div>
      <div class="gardes-table-wrap">
        ${gardes.length === 0
          ? `<p class="gardes-vide">Aucune garde en cours. Ajoute une garde avec le bouton ci-dessus.</p>`
          : `<table class="gardes-table">
              <thead><tr>
                <th>Nom</th><th>Statut</th><th>Lieu</th><th>Natel</th><th>Risques</th>
              </tr></thead>
              <tbody>${gardes.map((g, idx) => renderLigneGarde(g, idx)).join('')}</tbody>
            </table>`
        }
      </div>
    </section>
  `;

  bindTableauGardes(container, service, onMaj);
}

function renderLigneGarde(g, idx) {
  const statut     = g.statut || '';
  const natel      = g.natel  || '';
  const risques    = g.risques || '';
  const terminee   = g.terminee   === true;
  const suspendue  = g.suspendue  === true;
  const notesOuvertes = g.notesOuvertes === true;
  const enExamen   = g.enExamen === true;

  let classeRow = 'garde-row';
  if (terminee)       classeRow += ' garde-terminee';
  else if (suspendue) classeRow += ' garde-suspendue';

  return `
    <tr class="${classeRow}" data-idx="${idx}">
      <td>
        <input type="text" class="garde-input garde-nom" placeholder="NOM Prénom"
          value="${escapeHtml(g.nom || '')}" data-champ="nom" data-idx="${idx}" />
      </td>
      <td>
        <select class="garde-select garde-statut" data-champ="statut" data-idx="${idx}">
          <option value="">–</option>
          ${STATUTS_GARDE.map(s => `<option value="${s}"${statut === s ? ' selected' : ''}>${s}</option>`).join('')}
        </select>
      </td>
      <td class="garde-lieu-cell" data-idx="${idx}">
        ${renderCelleLieu(g)}
      </td>
      <td>
        <select class="garde-select garde-natel" data-champ="natel" data-idx="${idx}">
          ${OPTIONS_NATEL.map(n => `<option value="${n}"${natel === n ? ' selected' : ''}>${n || '–'}</option>`).join('')}
        </select>
      </td>
      <td>
        <select class="garde-select garde-risques-select" data-champ="risques" data-idx="${idx}">
          ${OPTIONS_RISQUES.map(r => `<option value="${r}"${risques === r ? ' selected' : ''}>${r || '–'}</option>`).join('')}
        </select>
      </td>
    </tr>
    <tr class="garde-icones-row${terminee ? ' garde-terminee' : suspendue ? ' garde-suspendue' : ''}" data-idx="${idx}">
      <td colspan="5" class="garde-icones-cell">
        <div class="garde-icones">
          <button type="button" class="icone-garde icone-intervention" data-action="intervention" data-idx="${idx}" title="Intervention" aria-label="Intervention">🚨</button>
          ${enExamen
            ? `<button type="button" class="icone-garde icone-retour" data-action="retour-examen" data-idx="${idx}" title="Retour d'examen" aria-label="Retour d'examen">↩</button>`
            : `<button type="button" class="icone-garde icone-transfert" data-action="transfert" data-idx="${idx}" title="Transfert" aria-label="Transfert">🔄</button>`
          }
          <button type="button" class="icone-garde" data-action="notes" data-idx="${idx}" title="Notes" aria-label="Notes">📝</button>
          <button type="button" class="icone-garde ${terminee ? 'icone-actif-termine' : ''}" data-action="terminer" data-idx="${idx}" title="Terminée" aria-label="Terminée">✅</button>
          <button type="button" class="icone-garde ${suspendue ? 'icone-actif-suspend' : ''}" data-action="suspendre" data-idx="${idx}" title="Suspendue" aria-label="Suspendue">⏸</button>
          <button type="button" class="icone-garde icone-suppr" data-action="supprimer" data-idx="${idx}" title="Supprimer" aria-label="Supprimer">🗑</button>
        </div>
      </td>
    </tr>
    ${notesOuvertes ? `
    <tr class="garde-notes-row" data-notes-idx="${idx}">
      <td colspan="5">
        <textarea class="garde-notes-texte" placeholder="Notes transmises, observations…"
          data-champ="notes" data-idx="${idx}">${escapeHtml(g.notes || '')}</textarea>
      </td>
    </tr>` : ''}
  `;
}

// ─── Binding ──────────────────────────────────────────────────────────────────

function bindTableauGardes(container, service, onMaj) {

  // Re-render partiel d'une cellule lieu sans rerender tout le tableau
  async function majLieu(idx, champs) {
    const gardes = [...(service.gardes || [])];
    if (!gardes[idx]) return;
    gardes[idx] = { ...gardes[idx], ...champs };
    service.gardes = gardes;
    const serviceMaj = await majService(service.id, { gardes });
    if (onMaj) onMaj(serviceMaj || service);
    const td = container.querySelector(`td.garde-lieu-cell[data-idx="${idx}"]`);
    if (td) {
      td.innerHTML = renderCelleLieu(gardes[idx]);
      bindCelleLieu(td, idx, gardes, service, onMaj);
    }
  }

  function bindCelleLieu(td, idx, gardes, service, onMaj) {
    td.querySelector('.lieu-chip-reset')?.addEventListener('click', async () => {
      await majLieu(idx, { lieuVal: '', etageOption: '', lieuSuffixe: '' });
    });
    td.querySelector('.lieu-col1')?.addEventListener('change', async (e) => {
      const batiment = e.target.value;
      await majLieu(idx, { batiment: batiment === '__libre__' ? '__libre__' : batiment, lieuVal: '', etageOption: '', lieuSuffixe: '' });
    });
    td.querySelector('.lieu-col2')?.addEventListener('change', async (e) => {
      await majLieu(idx, { lieuVal: e.target.value, etageOption: '', lieuSuffixe: '' });
    });
    td.querySelector('.lieu-col3-type')?.addEventListener('change', async (e) => {
      await majLieu(idx, { etageOption: e.target.value, lieuSuffixe: '' });
    });
    const col3El = td.querySelector('.lieu-col3');
    if (col3El) {
      const evt = col3El.tagName === 'SELECT' ? 'change' : 'blur';
      col3El.addEventListener(evt, async () => {
        await majLieu(idx, { lieuSuffixe: col3El.value });
      });
    }
    td.querySelector('.lieu-libre-input')?.addEventListener('blur', async (e) => {
      const v = e.target.value.trim();
      await majLieu(idx, { batiment: '__libre__', lieuVal: '__libre__', lieuSuffixe: v });
    });
  }

  // Initialiser tous les binds de cellules lieu
  container.querySelectorAll('td.garde-lieu-cell[data-idx]').forEach(td => {
    const idx = parseInt(td.dataset.idx, 10);
    const gardes = service.gardes || [];
    bindCelleLieu(td, idx, gardes, service, onMaj);
  });

  // Ajouter garde
  container.querySelector('[data-action="ajouter-garde"]')?.addEventListener('click', async () => {
    const gardes = [...(service.gardes || [])];
    gardes.push({ nom: '', statut: '', batiment: '', lieuVal: '', etageOption: '', lieuSuffixe: '',
                  natel: '', risques: '', notes: '', terminee: false, suspendue: false, notesOuvertes: false,
                  interventionId: null, enExamen: false, typeExamen: null, lieuExamen: null });
    await sauvegarderEtRerender(container, service, gardes, onMaj);
  });

  // Inputs texte (nom)
  container.querySelectorAll('.garde-input[data-champ]').forEach(input => {
    input.addEventListener('blur', async () => {
      const idx    = parseInt(input.dataset.idx, 10);
      const gardes = [...(service.gardes || [])];
      if (!gardes[idx]) return;
      gardes[idx] = { ...gardes[idx], [input.dataset.champ]: input.value };
      await sauvegarderEtRerender(container, service, gardes, onMaj);
    });
  });

  // Selects principaux (statut, natel, risques)
  container.querySelectorAll('.garde-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const idx    = parseInt(sel.dataset.idx, 10);
      const gardes = [...(service.gardes || [])];
      if (!gardes[idx]) return;
      gardes[idx] = { ...gardes[idx], [sel.dataset.champ]: sel.value };
      await sauvegarderEtRerender(container, service, gardes, onMaj);
    });
  });

  // Notes textarea
  container.querySelectorAll('.garde-notes-texte').forEach(ta => {
    ta.addEventListener('blur', async () => {
      const idx    = parseInt(ta.dataset.idx, 10);
      const gardes = [...(service.gardes || [])];
      if (!gardes[idx]) return;
      gardes[idx] = { ...gardes[idx], notes: ta.value };
      service.gardes = gardes;
      await majService(service.id, { gardes });
      if (onMaj) onMaj(service);
    });
    const adj = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
    ta.addEventListener('input', adj);
    setTimeout(adj, 0);
  });

  // Icônes
  container.querySelectorAll('[data-action]').forEach(btn => {
    const action = btn.dataset.action;
    if (!['notes', 'terminer', 'suspendre', 'supprimer', 'intervention', 'transfert', 'retour-examen'].includes(action)) return;

    btn.addEventListener('click', async () => {
      const idx    = parseInt(btn.dataset.idx, 10);
      const gardes = [...(service.gardes || [])];

      if (action === 'intervention') {
        // Créer ou ouvrir l'intervention liée à cette garde
        const g = gardes[idx];
        if (!g) return;
        const intId = await assurerIntervention(g, idx, service, onMaj);
        // Mettre à jour la garde si l'interventionId vient d'être créé
        if (!g.interventionId) {
          gardes[idx] = { ...g, interventionId: intId };
          service.gardes = gardes;
          // Pas besoin de re-save, assurerIntervention l'a déjà fait
        }
        setInterventionCourante(intId);
        setEcran('intervention-edit');
        return;
      }

      if (action === 'transfert') {
        const g = gardes[idx];
        if (!g) return;
        ouvrirDialogTransfert(g, idx, service, onMaj);
        return;
      }

      if (action === 'retour-examen') {
        const g = gardes[idx];
        if (!g) return;
        await retourExamen(g, idx, service, onMaj);
        return;
      }

      if (!gardes[idx] && action !== 'supprimer') return;
      if (action === 'notes') {
        gardes[idx] = { ...gardes[idx], notesOuvertes: !gardes[idx].notesOuvertes };
      } else if (action === 'terminer') {
        gardes[idx] = { ...gardes[idx], terminee: !gardes[idx].terminee, suspendue: false };
      } else if (action === 'suspendre') {
        gardes[idx] = { ...gardes[idx], suspendue: !gardes[idx].suspendue, terminee: false };
      } else if (action === 'supprimer') {
        gardes.splice(idx, 1);
      }
      await sauvegarderEtRerender(container, service, gardes, onMaj);
    });
  });
}

async function sauvegarderEtRerender(container, service, gardes, onMaj) {
  service.gardes = gardes;
  const serviceMaj = await majService(service.id, { gardes });
  if (onMaj) onMaj(serviceMaj || service);
  renderTableauGardes(container, service, onMaj);
}
