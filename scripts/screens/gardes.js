// Tableau des gardes en cours — Slice 5
// Logique lieux centralisée dans referentiels.js

import { majService } from '../db.js';
import { escapeHtml } from '../ui.js';
import {
  BATIMENTS_LISTE, STATUTS_GARDE, LIEUX_PAR_BATIMENT, composerLieu
} from '../../data/referentiels.js';

// ─── Options natel SP1–SP20 ──────────────────────────────────────────────────

const OPTIONS_NATEL = ['', ...Array.from({ length: 20 }, (_, i) => `SP${i + 1}`)];
const OPTIONS_RISQUES_GARDE = ['', 'Auto', 'Hétéro', 'Fugue', 'Auto+Hétéro', 'Tous'];

// ─── Génération options lieu ─────────────────────────────────────────────────

function genererOptionsLieu(batiment, lieuActuel = '') {
  const cfg = LIEUX_PAR_BATIMENT[batiment];
  let html = `<option value="">— Lieu —</option>`;

  if (!cfg) {
    html += `<option value="__libre__"${lieuActuel === '__libre__' ? ' selected' : ''}>Saisie libre…</option>`;
    return html;
  }

  if (cfg.prioritaires) {
    cfg.prioritaires.forEach(p => {
      const sel = lieuActuel === p.valeur ? ' selected' : '';
      html += `<option value="${p.valeur}"${sel}>${escapeHtml(p.label)}</option>`;
    });
  }

  if (cfg.etages) {
    cfg.etages.forEach(e => {
      const sel = lieuActuel === e.valeur ? ' selected' : '';
      html += `<option value="${e.valeur}"${sel}>${escapeHtml(e.label)}</option>`;
    });
  }

  html += `<option value="__libre__"${lieuActuel === '__libre__' ? ' selected' : ''}>Autre (saisie libre)</option>`;
  return html;
}

// ─── Suffixe contextuel ──────────────────────────────────────────────────────

function renderSuffixe(batiment, lieuVal, suffixeActuel = '', etageOption = '', suffixe2 = '') {
  if (!lieuVal) return '';
  if (lieuVal === '__libre__') {
    return `<input type="text" class="garde-lieu-libre" placeholder="Lieu libre…" value="${escapeHtml(suffixeActuel)}" />`;
  }

  const cfg = LIEUX_PAR_BATIMENT[batiment];
  if (!cfg) {
    return `<input type="text" class="garde-lieu-libre" placeholder="Précision…" value="${escapeHtml(suffixeActuel)}" />`;
  }

  // Prioritaire fixe sans suffixe
  if (cfg.prioritaires) {
    const p = cfg.prioritaires.find(x => x.valeur === lieuVal);
    if (p) {
      if (p.type === 'fixe') return '';
      if (p.type === 'lettre') {
        const lettres = (p.lettres || '').split('');
        return `<select class="garde-lieu-suffixe">
          <option value="">–</option>
          ${lettres.map(l => `<option value="${l}"${suffixeActuel === l ? ' selected' : ''}>${l}</option>`).join('')}
        </select>`;
      }
      if (p.type === 'select') {
        return `<select class="garde-lieu-suffixe">
          <option value="">–</option>
          ${p.options.map(o => `<option value="${o}"${suffixeActuel === o ? ' selected' : ''}>${o}</option>`).join('')}
        </select>`;
      }
      if (p.type === 'numero') {
        return `<input type="text" class="garde-lieu-suffixe" inputmode="numeric" placeholder="N°" value="${escapeHtml(suffixeActuel)}" style="width:5rem" />`;
      }
    }
  }

  // Étage — afficher select option (chambre / soins interm.) puis suffixe
  if (lieuVal.startsWith('etage-') && cfg.etageOptions) {
    const optsHtml = cfg.etageOptions.map(o =>
      `<option value="${o.valeur}"${etageOption === o.valeur ? ' selected' : ''}>${escapeHtml(o.label)}</option>`
    ).join('');
    let suffixeHtml = '';
    const optSel = cfg.etageOptions.find(o => o.valeur === etageOption);
    if (optSel) {
      if (optSel.type === 'numero') {
        suffixeHtml = `<input type="text" class="garde-lieu-suffixe2" inputmode="numeric" placeholder="N°" value="${escapeHtml(suffixeActuel)}" style="width:5rem" />`;
      } else if (optSel.type === 'select') {
        suffixeHtml = `<select class="garde-lieu-suffixe2">
          <option value="">–</option>
          ${optSel.options.map(o => `<option value="${o}"${suffixeActuel === o ? ' selected' : ''}>${o}</option>`).join('')}
        </select>`;
      }
    }
    return `<select class="garde-lieu-etage-option">
      <option value="">— Type —</option>
      ${optsHtml}
    </select>${suffixeHtml}`;
  }

  return '';
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
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Statut</th>
                  <th>Bât.</th>
                  <th>Lieu</th>
                  <th>Natel</th>
                  <th>Risques</th>
                </tr>
              </thead>
              <tbody>
                ${gardes.map((g, idx) => renderLigneGarde(g, idx)).join('')}
              </tbody>
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
  if (terminee)  classeRow += ' garde-terminee';
  else if (suspendue) classeRow += ' garde-suspendue';

  const suffixeHtml  = renderSuffixe(batiment, lieuVal, suffixe, etageOption);
  const optionsLieu  = genererOptionsLieu(batiment, lieuVal);

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
          <option value="__autre__"${!BATIMENTS_LISTE.includes(batiment) && batiment ? ' selected' : ''}>Autre…</option>
        </select>
        ${!BATIMENTS_LISTE.includes(batiment) && batiment
          ? `<input type="text" class="garde-input garde-batiment-libre" placeholder="Bât."
               value="${escapeHtml(batiment)}" data-champ="batiment-libre" data-idx="${idx}" />`
          : ''}
      </td>
      <td class="garde-lieu-cell">
        <div class="garde-lieu-wrap">
          <select class="garde-select garde-lieu-select" data-champ="lieuVal" data-idx="${idx}">
            ${optionsLieu}
          </select>
          <span class="garde-lieu-suffixe-wrap" data-idx="${idx}">
            ${suffixeHtml}
          </span>
        </div>
      </td>
      <td>
        <select class="garde-select garde-natel" data-champ="natel" data-idx="${idx}">
          ${OPTIONS_NATEL.map(n => `<option value="${n}"${natel === n ? ' selected' : ''}>${n || '–'}</option>`).join('')}
        </select>
      </td>
      <td>
        <select class="garde-select garde-risques-select" data-champ="risques" data-idx="${idx}">
          ${OPTIONS_RISQUES_GARDE.map(r => `<option value="${r}"${risques === r ? ' selected' : ''}>${r || '–'}</option>`).join('')}
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
  container.querySelector('[data-action="ajouter-garde"]')?.addEventListener('click', async () => {
    const gardes = [...(service.gardes || [])];
    gardes.push({
      nom: '', statut: '', batiment: '', lieuVal: '', etageOption: '', lieuSuffixe: '',
      natel: '', risques: '', notes: '', terminee: false, suspendue: false, notesOuvertes: false
    });
    await sauvegarderEtRerender(container, service, gardes, onMaj);
  });

  // Inputs texte (nom + batiment-libre)
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

  container.querySelectorAll('[data-champ="batiment-libre"]').forEach(input => {
    input.addEventListener('blur', async () => {
      const idx = parseInt(input.dataset.idx, 10);
      const gardes = [...(service.gardes || [])];
      if (!gardes[idx]) return;
      gardes[idx] = { ...gardes[idx], batiment: input.value.trim() };
      await sauvegarderEtRerender(container, service, gardes, onMaj);
    });
  });

  // Selects principaux
  container.querySelectorAll('.garde-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const idx   = parseInt(sel.dataset.idx, 10);
      const champ = sel.dataset.champ;
      const gardes = [...(service.gardes || [])];
      if (!gardes[idx]) return;

      if (champ === 'batiment') {
        const val = sel.value;
        gardes[idx] = { ...gardes[idx], batiment: val === '__autre__' ? '' : val, lieuVal: '', etageOption: '', lieuSuffixe: '' };
      } else if (champ === 'lieuVal') {
        gardes[idx] = { ...gardes[idx], lieuVal: sel.value, etageOption: '', lieuSuffixe: '' };
      } else {
        gardes[idx] = { ...gardes[idx], [champ]: sel.value };
      }
      await sauvegarderEtRerender(container, service, gardes, onMaj);
    });
  });

  // Select option étage (chambre / soins interm.)
  container.querySelectorAll('.garde-lieu-etage-option').forEach(sel => {
    sel.addEventListener('change', async () => {
      const wrap  = sel.closest('[data-idx]') || sel.closest('tr');
      const idx   = parseInt(wrap?.dataset?.idx, 10);
      if (isNaN(idx)) return;
      const gardes = [...(service.gardes || [])];
      if (!gardes[idx]) return;
      gardes[idx] = { ...gardes[idx], etageOption: sel.value, lieuSuffixe: '' };
      await sauvegarderEtRerender(container, service, gardes, onMaj);
    });
  });

  // Suffixes (select lettre/I1-I4, input numérique, saisie libre, suffixe2)
  container.querySelectorAll('.garde-lieu-suffixe, .garde-lieu-libre, .garde-lieu-suffixe2').forEach(el => {
    const evt = el.tagName === 'SELECT' ? 'change' : 'blur';
    el.addEventListener(evt, async () => {
      const wrap = el.closest('tr[data-idx]') || el.closest('[data-idx]');
      const idx  = parseInt(wrap?.dataset?.idx, 10);
      if (isNaN(idx)) return;
      const gardes = [...(service.gardes || [])];
      if (!gardes[idx]) return;
      gardes[idx] = { ...gardes[idx], lieuSuffixe: el.value };
      service.gardes = gardes;
      const serviceMaj = await majService(service.id, { gardes });
      if (onMaj) onMaj(serviceMaj || service);
    });
  });

  // Notes textarea
  container.querySelectorAll('.garde-notes-texte').forEach(ta => {
    ta.addEventListener('blur', async () => {
      const idx = parseInt(ta.dataset.idx, 10);
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
