// Tableau des gardes en cours — Slice 5 V3
// Cascade lieu : selects inline → chip une fois complet

import { majService } from '../db.js';
import { escapeHtml } from '../ui.js';
import {
  BATIMENTS_LISTE, STATUTS_GARDE, LIEUX_PAR_BATIMENT,
  composerLieu, lieuEstComplet
} from '../../data/referentiels.js';

const OPTIONS_NATEL   = ['', ...Array.from({ length: 20 }, (_, i) => `SP${i + 1}`)];
const OPTIONS_RISQUES = ['', 'Auto', 'Hétéro', 'Fugue', 'Auto+Hétéro', 'Tous'];

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
    // Mode chip : résultat + croix reset
    return `<div class="lieu-chip">
      <span class="lieu-chip-texte">${escapeHtml(lieuCompose)}</span>
      <button type="button" class="lieu-chip-reset" title="Modifier le lieu" aria-label="Effacer et reselectionner">×</button>
    </div>`;
  }

  // Mode sélection : selects inline
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

// ─── Rendu principal ─────────────────────────────────────────────────────────

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
    // Re-render juste la cellule lieu
    const td = container.querySelector(`td.garde-lieu-cell[data-idx="${idx}"]`);
    if (td) {
      td.innerHTML = renderCelleLieu(gardes[idx]);
      bindCelleLieu(td, idx, gardes, service, onMaj);
    }
  }

  // Binder une cellule lieu (chip ou selects)
  function bindCelleLieu(td, idx, gardes, service, onMaj) {
    const g = gardes[idx];

    // Chip → croix reset
    td.querySelector('.lieu-chip-reset')?.addEventListener('click', async () => {
      await majLieu(idx, { lieuVal: '', etageOption: '', lieuSuffixe: '' });
    });

    // Col 1 bâtiment
    td.querySelector('.lieu-col1')?.addEventListener('change', async (e) => {
      const batiment = e.target.value;
      await majLieu(idx, { batiment: batiment === '__libre__' ? '__libre__' : batiment, lieuVal: '', etageOption: '', lieuSuffixe: '' });
    });

    // Col 2 service/étage
    td.querySelector('.lieu-col2')?.addEventListener('change', async (e) => {
      await majLieu(idx, { lieuVal: e.target.value, etageOption: '', lieuSuffixe: '' });
    });

    // Col 3 type étage (Ch./S.int pour BH)
    td.querySelector('.lieu-col3-type')?.addEventListener('change', async (e) => {
      await majLieu(idx, { etageOption: e.target.value, lieuSuffixe: '' });
    });

    // Col 3 suffixe (select lettre ou input numérique)
    const col3El = td.querySelector('.lieu-col3');
    if (col3El) {
      const evt = col3El.tagName === 'SELECT' ? 'change' : 'blur';
      col3El.addEventListener(evt, async () => {
        await majLieu(idx, { lieuSuffixe: col3El.value });
      });
    }

    // Saisie libre
    td.querySelector('.lieu-libre-input')?.addEventListener('blur', async (e) => {
      const v = e.target.value.trim();
      // En mode saisie libre, lieuSuffixe porte la valeur, batiment reste '__libre__'
      await majLieu(idx, { batiment: '__libre__', lieuVal: '__libre__', lieuSuffixe: v });
    });
  }

  // Initialiser tous les binds de cellules lieu
  container.querySelectorAll('td.garde-lieu-cell[data-idx]').forEach(td => {
    const idx    = parseInt(td.dataset.idx, 10);
    const gardes = service.gardes || [];
    bindCelleLieu(td, idx, gardes, service, onMaj);
  });

  // Ajouter garde
  container.querySelector('[data-action="ajouter-garde"]')?.addEventListener('click', async () => {
    const gardes = [...(service.gardes || [])];
    gardes.push({ nom: '', statut: '', batiment: '', lieuVal: '', etageOption: '', lieuSuffixe: '',
                  natel: '', risques: '', notes: '', terminee: false, suspendue: false, notesOuvertes: false });
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
    if (!['notes', 'terminer', 'suspendre', 'supprimer'].includes(action)) return;
    btn.addEventListener('click', async () => {
      const idx    = parseInt(btn.dataset.idx, 10);
      const gardes = [...(service.gardes || [])];
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
