// Tableau des gardes en cours — Slice 5 V2
// Cascade lieu : 3 champs inline compacts [Bât] / [Étage/Service] / [Précision]

import { majService } from '../db.js';
import { escapeHtml } from '../ui.js';
import {
  BATIMENTS_LISTE, STATUTS_GARDE, LIEUX_PAR_BATIMENT, composerLieu
} from '../../data/referentiels.js';

const OPTIONS_NATEL   = ['', ...Array.from({ length: 20 }, (_, i) => `SP${i + 1}`)];
const OPTIONS_RISQUES = ['', 'Auto', 'Hétéro', 'Fugue', 'Auto+Hétéro', 'Tous'];

// ─── Helpers options courtes ─────────────────────────────────────────────────

// Col 2 : étage/service — labels courts (numéro seul ou code service)
function optionsCol2(batiment, lieuActuel = '') {
  const cfg = LIEUX_PAR_BATIMENT[batiment];
  let html = `<option value="">—</option>`;
  if (!cfg) return html;
  // Prioritaires (unités spéciales BH/05, NES/UHPA, BU44/PLI…)
  if (cfg.prioritaires) {
    cfg.prioritaires.forEach(p => {
      html += `<option value="${p.valeur}"${lieuActuel === p.valeur ? ' selected' : ''}>${escapeHtml(p.label)}</option>`;
    });
  }
  // Étages — label court = numéro seulement
  if (cfg.etages) {
    cfg.etages.forEach(e => {
      html += `<option value="${e.valeur}"${lieuActuel === e.valeur ? ' selected' : ''}>${escapeHtml(e.numero)}</option>`;
    });
  }
  html += `<option value="__libre__"${lieuActuel === '__libre__' ? ' selected' : ''}>…</option>`;
  return html;
}

// Col 3 : suffixe selon le type du service sélectionné
// Retourne { tag: 'select'|'input'|'none', html: string }
function col3(batiment, lieuVal, suffixeActuel = '', etageOption = '') {
  if (!lieuVal || lieuVal === '__libre__') {
    return { tag: 'input', html: `<input type="text" class="lieu-col3 lieu-col3-libre" placeholder="…" value="${escapeHtml(suffixeActuel)}" />` };
  }
  const cfg = LIEUX_PAR_BATIMENT[batiment];
  if (!cfg) return { tag: 'none', html: '' };

  // Prioritaire
  if (cfg.prioritaires) {
    const p = cfg.prioritaires.find(x => x.valeur === lieuVal);
    if (p) {
      if (p.type === 'fixe') return { tag: 'none', html: '' };
      if (p.type === 'lettre') {
        const opts = (p.lettres || '').split('').map(l =>
          `<option value="${l}"${suffixeActuel === l ? ' selected' : ''}>${l}</option>`).join('');
        return { tag: 'select', html: `<select class="lieu-col3"><option value="">—</option>${opts}</select>` };
      }
      if (p.type === 'select') {
        const opts = p.options.map(o =>
          `<option value="${o}"${suffixeActuel === o ? ' selected' : ''}>${o}</option>`).join('');
        return { tag: 'select', html: `<select class="lieu-col3"><option value="">—</option>${opts}</select>` };
      }
      if (p.type === 'numero') {
        return { tag: 'input', html: `<input type="text" class="lieu-col3 lieu-col3-num" inputmode="numeric" placeholder="N°" value="${escapeHtml(suffixeActuel)}" />` };
      }
    }
  }

  // Étage — BH a deux sous-types (chambre / soins interm.)
  if (lieuVal.startsWith('etage-') && cfg.etageOptions) {
    // Si BH (plusieurs etageOptions), on affiche d'abord un micro-select [ch/SI] puis le suffixe
    if (cfg.etageOptions.length > 1) {
      const optSel = cfg.etageOptions.find(o => o.valeur === etageOption);
      const typeOpts = cfg.etageOptions.map(o =>
        `<option value="${o.valeur}"${etageOption === o.valeur ? ' selected' : ''}>${o.valeur === 'chambre' ? 'Ch.' : 'S.int'}</option>`).join('');
      const selectType = `<select class="lieu-col3-type"><option value="">—</option>${typeOpts}</select>`;
      if (!optSel) return { tag: 'dual', html: selectType };
      if (optSel.type === 'numero') {
        return { tag: 'dual', html: `${selectType}<input type="text" class="lieu-col3 lieu-col3-num" inputmode="numeric" placeholder="N°" value="${escapeHtml(suffixeActuel)}" />` };
      }
      if (optSel.type === 'select') {
        const litOpts = optSel.options.map(o => `<option value="${o}"${suffixeActuel === o ? ' selected' : ''}>${o}</option>`).join('');
        return { tag: 'dual', html: `${selectType}<select class="lieu-col3"><option value="">—</option>${litOpts}</select>` };
      }
    }
    // Étage simple (chambre seule)
    return { tag: 'input', html: `<input type="text" class="lieu-col3 lieu-col3-num" inputmode="numeric" placeholder="N°" value="${escapeHtml(suffixeActuel)}" />` };
  }

  return { tag: 'none', html: '' };
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
                <th>Nom</th><th>Statut</th><th>Bât.</th><th>Lieu</th><th>Natel</th><th>Risques</th>
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
  const statut      = g.statut      || '';
  const batiment    = g.batiment    || '';
  const lieuVal     = g.lieuVal     || '';
  const etageOption = g.etageOption || '';
  const suffixe     = g.lieuSuffixe || '';
  const natel       = g.natel       || '';
  const risques     = g.risques     || '';
  const terminee    = g.terminee    === true;
  const suspendue   = g.suspendue   === true;
  const notesOuvertes = g.notesOuvertes === true;

  let classeRow = 'garde-row';
  if (terminee)        classeRow += ' garde-terminee';
  else if (suspendue)  classeRow += ' garde-suspendue';

  const c3 = col3(batiment, lieuVal, suffixe, etageOption);

  // Lieu résultat composé (affiché en titre de colonne si rempli)
  const lieuCompose = composerLieu(batiment, lieuVal, etageOption, suffixe);

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
      <td>
        <select class="garde-select garde-batiment" data-champ="batiment" data-idx="${idx}">
          <option value="">–</option>
          ${BATIMENTS_LISTE.map(b => `<option value="${b}"${batiment === b ? ' selected' : ''}>${b}</option>`).join('')}
          <option value="__autre__"${!BATIMENTS_LISTE.includes(batiment) && batiment ? ' selected' : ''}>…</option>
        </select>
        ${!BATIMENTS_LISTE.includes(batiment) && batiment
          ? `<input type="text" class="garde-input garde-batiment-libre" placeholder="Bât."
               value="${escapeHtml(batiment)}" data-champ="batiment-libre" data-idx="${idx}" />`
          : ''}
      </td>
      <td class="garde-lieu-cell">
        ${lieuCompose ? `<div class="lieu-compose">${escapeHtml(lieuCompose)}</div>` : ''}
        <div class="lieu-inline">
          <!-- Col 2 : étage/service -->
          ${batiment && BATIMENTS_LISTE.includes(batiment) ? `
            <select class="lieu-col2" data-champ="lieuVal" data-idx="${idx}">
              ${optionsCol2(batiment, lieuVal)}
            </select>
          ` : ''}
          <!-- Col 3 : suffixe -->
          ${c3.html ? `<span class="lieu-sep">/</span><span class="lieu-col3-wrap" data-idx="${idx}">${c3.html}</span>` : ''}
        </div>
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
      <td colspan="6" class="garde-icones-cell">
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
      <td colspan="6">
        <textarea class="garde-notes-texte" placeholder="Notes transmises, observations…"
          data-champ="notes" data-idx="${idx}">${escapeHtml(g.notes || '')}</textarea>
      </td>
    </tr>` : ''}
  `;
}

// ─── Binding ──────────────────────────────────────────────────────────────────

function bindTableauGardes(container, service, onMaj) {

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
      const idx   = parseInt(input.dataset.idx, 10);
      const champ = input.dataset.champ;
      const gardes = [...(service.gardes || [])];
      if (!gardes[idx]) return;
      gardes[idx] = { ...gardes[idx], [champ]: input.value };
      await sauvegarderEtRerender(container, service, gardes, onMaj);
    });
  });

  // Bâtiment libre
  container.querySelectorAll('[data-champ="batiment-libre"]').forEach(input => {
    input.addEventListener('blur', async () => {
      const idx    = parseInt(input.dataset.idx, 10);
      const gardes = [...(service.gardes || [])];
      if (!gardes[idx]) return;
      gardes[idx]  = { ...gardes[idx], batiment: input.value.trim() };
      await sauvegarderEtRerender(container, service, gardes, onMaj);
    });
  });

  // Selects principaux (statut, batiment, natel, risques)
  container.querySelectorAll('.garde-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const idx   = parseInt(sel.dataset.idx, 10);
      const champ = sel.dataset.champ;
      const gardes = [...(service.gardes || [])];
      if (!gardes[idx]) return;
      if (champ === 'batiment') {
        const val = sel.value;
        gardes[idx] = { ...gardes[idx], batiment: val === '__autre__' ? '' : val, lieuVal: '', etageOption: '', lieuSuffixe: '' };
      } else {
        gardes[idx] = { ...gardes[idx], [champ]: sel.value };
      }
      await sauvegarderEtRerender(container, service, gardes, onMaj);
    });
  });

  // Col 2 : étage/service
  container.querySelectorAll('.lieu-col2').forEach(sel => {
    sel.addEventListener('change', async () => {
      const idx    = parseInt(sel.dataset.idx, 10);
      const gardes = [...(service.gardes || [])];
      if (!gardes[idx]) return;
      gardes[idx] = { ...gardes[idx], lieuVal: sel.value, etageOption: '', lieuSuffixe: '' };
      await sauvegarderEtRerender(container, service, gardes, onMaj);
    });
  });

  // Col 3 type (Ch. / S.int pour BH étage)
  container.querySelectorAll('.lieu-col3-type').forEach(sel => {
    sel.addEventListener('change', async () => {
      const wrap = sel.closest('[data-idx]') || sel.closest('tr');
      const idx  = parseInt(wrap?.dataset?.idx, 10);
      if (isNaN(idx)) return;
      const gardes = [...(service.gardes || [])];
      if (!gardes[idx]) return;
      gardes[idx] = { ...gardes[idx], etageOption: sel.value, lieuSuffixe: '' };
      await sauvegarderEtRerender(container, service, gardes, onMaj);
    });
  });

  // Col 3 suffixe (select lettre/I1-I4/lit ou input numérique)
  container.querySelectorAll('.lieu-col3').forEach(el => {
    const evt = el.tagName === 'SELECT' ? 'change' : 'blur';
    el.addEventListener(evt, async () => {
      const wrap = el.closest('[data-idx]') || el.closest('tr');
      const idx  = parseInt(wrap?.dataset?.idx, 10);
      if (isNaN(idx)) return;
      const gardes = [...(service.gardes || [])];
      if (!gardes[idx]) return;
      gardes[idx] = { ...gardes[idx], lieuSuffixe: el.value };
      service.gardes = gardes;
      const serviceMaj = await majService(service.id, { gardes });
      if (onMaj) onMaj(serviceMaj || service);
      // Mettre à jour uniquement le lieu-compose sans rerender complet
      const tr = el.closest('tr.garde-row');
      const lcEl = tr?.querySelector('.lieu-compose');
      if (lcEl) {
        const g = gardes[idx];
        const lc = composerLieu(g.batiment, g.lieuVal, g.etageOption, el.value);
        lcEl.textContent = lc;
      }
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
