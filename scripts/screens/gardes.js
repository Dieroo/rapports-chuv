// Tableau des gardes en cours — Slice 4 CHUV
// Gère la saisie, persistance et affichage des gardes actives pendant un service.

import { majService } from '../db.js';
import { escapeHtml } from '../ui.js';

// ─── Référentiels lieux par bâtiment ────────────────────────────────────────

const LIEUX_PAR_BATIMENT = {
  BH: {
    prioritaires: [
      { valeur: 'URGC', type: 'lettre', lettres: 'ABCDEFGHIJKLM', label: 'URGC –' },
      { valeur: 'URGA', type: 'lettre', lettres: 'NOPQRSTUVWXYZ', label: 'URGA –' },
      { valeur: 'URGO-I', type: 'select', options: ['I1', 'I2', 'I3', 'I4'], label: 'URGO –' },
      { valeur: 'URGO-LIT', type: 'lettre', lettres: 'ABCDEFGH', label: 'URGO – Lit' },
      { valeur: 'UAPC', type: 'fixe', label: 'UAPC' },
      { valeur: 'SIAEST', type: 'numero', label: 'SIA EST – Lit' },
      { valeur: 'SIAOUEST', type: 'numero', label: 'SIA OUEST – Lit' },
      { valeur: 'SIASUD', type: 'numero', label: 'SIA SUD – Lit' },
      { valeur: 'SIPI', type: 'numero', label: 'SIPI – Box' },
    ],
    etages: Array.from({ length: 9 }, (_, i) => String(11 + i)) // 11 à 19
  },
  NES: {
    prioritaires: [
      { valeur: 'UHPA', type: 'fixe', label: 'UHPA' },
    ],
    avecEtage: true
  },
  BU44: {
    prioritaires: [
      { valeur: 'PLI', type: 'fixe', label: 'PLI' },
    ],
    avecEtage: false
  },
  MAT: { avecEtage: true },
  HO:  { avecEtage: true },
  HE:  { avecEtage: true },
  BT:  { avecEtage: true },
};

const BATIMENTS = ['BH', 'BU44', 'MAT', 'HO', 'HE', 'NES', 'BT'];
const STATUTS_GARDE = ['Détenu', 'Prévenu', 'Patient'];

// ─── Génération du select lieu contextuel ───────────────────────────────────

function genererOptionsLieu(batiment, lieuActuel = '') {
  const cfg = LIEUX_PAR_BATIMENT[batiment];
  let html = `<option value="">— Lieu —</option>`;

  if (!cfg) {
    // Bâtiment saisi manuellement → saisie libre uniquement
    html += `<option value="__libre__"${lieuActuel === '__libre__' ? ' selected' : ''}>Saisie libre…</option>`;
    return html;
  }

  // Options prioritaires
  if (cfg.prioritaires) {
    cfg.prioritaires.forEach(p => {
      const sel = lieuActuel === p.valeur ? ' selected' : '';
      html += `<option value="${p.valeur}"${sel}>${escapeHtml(p.label)}</option>`;
    });
  }

  // Étages
  if (cfg.etages) {
    cfg.etages.forEach(e => {
      const val = `etage-${e}`;
      const sel = lieuActuel === val ? ' selected' : '';
      html += `<option value="${val}"${sel}>Étage ${e} – chambre…</option>`;
    });
  } else if (cfg.avecEtage) {
    html += `<option value="etage-libre"${lieuActuel === 'etage-libre' ? ' selected' : ''}>Étage / chambre…</option>`;
  }

  // Saisie libre toujours disponible en dernier
  html += `<option value="__libre__"${lieuActuel === '__libre__' ? ' selected' : ''}>Autre (saisie libre)</option>`;
  return html;
}

// Calcule le texte affiché final d'un lieu à partir de sa valeur interne + suffixe
function labelLieu(batiment, lieuVal, suffixe) {
  if (!lieuVal || lieuVal === '__libre__') return suffixe || '';
  const cfg = LIEUX_PAR_BATIMENT[batiment];
  if (!cfg) return [lieuVal, suffixe].filter(Boolean).join(' ');

  if (cfg.prioritaires) {
    const p = cfg.prioritaires.find(x => x.valeur === lieuVal);
    if (p) {
      if (p.type === 'fixe') return p.label;
      return [p.label, suffixe].filter(Boolean).join(' ');
    }
  }
  if (lieuVal.startsWith('etage-')) {
    const etage = lieuVal.replace('etage-', '');
    const prefixe = etage === 'libre' ? '' : `${batiment} ${etage}`;
    return [prefixe, suffixe].filter(Boolean).join(' / ');
  }
  return [lieuVal, suffixe].filter(Boolean).join(' ');
}

// ─── Rendu du suffixe contextuel (lettre, select I1-I4, numéro, chambre) ────

function renderSuffixe(batiment, lieuVal, suffixeActuel = '') {
  if (!lieuVal || lieuVal === 'UAPC' || lieuVal === 'PLI' || lieuVal === 'UHPA') return '';
  if (lieuVal === '__libre__') {
    return `<input type="text" class="garde-lieu-libre" placeholder="Lieu libre…" value="${escapeHtml(suffixeActuel)}" />`;
  }

  const cfg = LIEUX_PAR_BATIMENT[batiment];
  if (!cfg) {
    return `<input type="text" class="garde-lieu-libre" placeholder="Précision…" value="${escapeHtml(suffixeActuel)}" />`;
  }

  if (cfg.prioritaires) {
    const p = cfg.prioritaires.find(x => x.valeur === lieuVal);
    if (p) {
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

  // Étage → chambre
  if (lieuVal.startsWith('etage-')) {
    return `<input type="text" class="garde-lieu-suffixe" placeholder="Chambre" value="${escapeHtml(suffixeActuel)}" style="width:7rem" />`;
  }

  return '';
}

// ─── Rendu principal du tableau ──────────────────────────────────────────────

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
  const statut = g.statut || '';
  const batiment = g.batiment || '';
  const lieuVal = g.lieuVal || '';
  const suffixe = g.lieuSuffixe || '';
  const terminee = g.terminee === true;
  const suspendue = g.suspendue === true;
  const notesOuvertes = g.notesOuvertes === true;

  let classeRow = 'garde-row';
  if (terminee) classeRow += ' garde-terminee';
  else if (suspendue) classeRow += ' garde-suspendue';

  const suffixeHtml = renderSuffixe(batiment, lieuVal, suffixe);
  const optionsLieu = genererOptionsLieu(batiment, lieuVal);

  return `
    <tr class="${classeRow}" data-idx="${idx}">
      <td>
        <input type="text" class="garde-input garde-nom" placeholder="NOM Prénom" value="${escapeHtml(g.nom || '')}" data-champ="nom" data-idx="${idx}" />
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
          ${BATIMENTS.map(b => `<option value="${b}"${batiment === b ? ' selected' : ''}>${b}</option>`).join('')}
          <option value="__autre__"${!BATIMENTS.includes(batiment) && batiment ? ' selected' : ''}>Autre…</option>
        </select>
        ${!BATIMENTS.includes(batiment) && batiment
          ? `<input type="text" class="garde-input garde-batiment-libre" placeholder="Bât." value="${escapeHtml(batiment)}" data-champ="batiment-libre" data-idx="${idx}" />`
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
        <input type="text" class="garde-input garde-natel" placeholder="SP1…" value="${escapeHtml(g.natel || '')}" data-champ="natel" data-idx="${idx}" />
      </td>
      <td>
        <input type="text" class="garde-input garde-risques" placeholder="Risques" value="${escapeHtml(g.risques || '')}" data-champ="risques" data-idx="${idx}" />
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
        <textarea class="garde-notes-texte" placeholder="Notes transmises, observations…" data-champ="notes" data-idx="${idx}">${escapeHtml(g.notes || '')}</textarea>
      </td>
    </tr>` : ''}
  `;
}

// ─── Binding ─────────────────────────────────────────────────────────────────

function bindTableauGardes(container, service, onMaj) {
  // Ajouter une garde
  container.querySelector('[data-action="ajouter-garde"]')?.addEventListener('click', async () => {
    const gardes = [...(service.gardes || [])];
    gardes.push({
      nom: '', statut: '', batiment: '', lieuVal: '', lieuSuffixe: '',
      natel: '', risques: '', notes: '', terminee: false, suspendue: false, notesOuvertes: false
    });
    await sauvegarderEtRerender(container, service, gardes, onMaj);
  });

  // Inputs texte (nom, natel, risques)
  container.querySelectorAll('.garde-input[data-champ]').forEach(input => {
    input.addEventListener('blur', async () => {
      const idx = parseInt(input.dataset.idx, 10);
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
      const idx = parseInt(input.dataset.idx, 10);
      const gardes = [...(service.gardes || [])];
      if (!gardes[idx]) return;
      gardes[idx] = { ...gardes[idx], batiment: input.value.trim() };
      await sauvegarderEtRerender(container, service, gardes, onMaj);
    });
  });

  // Selects (statut, batiment, lieuVal)
  container.querySelectorAll('.garde-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const idx = parseInt(sel.dataset.idx, 10);
      const champ = sel.dataset.champ;
      const gardes = [...(service.gardes || [])];
      if (!gardes[idx]) return;

      if (champ === 'batiment') {
        const val = sel.value;
        if (val === '__autre__') {
          // Affiche un input libre, rerender
          gardes[idx] = { ...gardes[idx], batiment: '', lieuVal: '', lieuSuffixe: '' };
        } else {
          gardes[idx] = { ...gardes[idx], batiment: val, lieuVal: '', lieuSuffixe: '' };
        }
      } else if (champ === 'lieuVal') {
        gardes[idx] = { ...gardes[idx], lieuVal: sel.value, lieuSuffixe: '' };
      } else {
        gardes[idx] = { ...gardes[idx], [champ]: sel.value };
      }
      await sauvegarderEtRerender(container, service, gardes, onMaj);
    });
  });

  // Suffixe (select ou input)
  container.querySelectorAll('.garde-lieu-suffixe, .garde-lieu-libre').forEach(el => {
    const evt = el.tagName === 'SELECT' ? 'change' : 'blur';
    el.addEventListener(evt, async () => {
      const wrap = el.closest('[data-idx]') || el.parentElement?.closest('[data-idx]') || el.closest('td')?.closest('tr');
      const idx = parseInt(wrap?.dataset?.idx ?? el.closest('tr')?.dataset?.idx, 10);
      if (isNaN(idx)) return;
      const gardes = [...(service.gardes || [])];
      if (!gardes[idx]) return;
      gardes[idx] = { ...gardes[idx], lieuSuffixe: el.value };
      // Pas de rerender complet pour éviter de perdre le focus — juste sauvegarder
      service.gardes = gardes;
      const serviceMaj = await majService(service.id, { gardes });
      if (onMaj) onMaj(serviceMaj || service);
    });
  });

  // Notes (textarea)
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
    // Auto-resize
    const adj = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
    ta.addEventListener('input', adj);
    setTimeout(adj, 0);
  });

  // Icônes : notes toggle, terminer, suspendre, supprimer
  container.querySelectorAll('[data-action]').forEach(btn => {
    const action = btn.dataset.action;
    if (!['notes', 'terminer', 'suspendre', 'supprimer'].includes(action)) return;

    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.idx, 10);
      const gardes = [...(service.gardes || [])];
      if (!gardes[idx] && action !== 'supprimer') return;

      if (action === 'notes') {
        gardes[idx] = { ...gardes[idx], notesOuvertes: !gardes[idx].notesOuvertes };
      } else if (action === 'terminer') {
        // Toggle : si déjà terminée, on remet en actif
        const etaitTerminee = gardes[idx].terminee;
        gardes[idx] = { ...gardes[idx], terminee: !etaitTerminee, suspendue: false };
      } else if (action === 'suspendre') {
        const etaitSuspendue = gardes[idx].suspendue;
        gardes[idx] = { ...gardes[idx], suspendue: !etaitSuspendue, terminee: false };
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
