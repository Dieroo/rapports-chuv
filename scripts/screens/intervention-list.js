// Écran Liste des interventions — accueil par défaut.
// Contient : bandeau service + bouton nouvelle intervention,
//            tableau gardes en cours, transinfo reçue,
//            notes du service, transinfo relève,
//            liste des interventions des 7 derniers jours,
//            historique des services.

import {
  listerInterventionsRecentes, creerIntervention, getIntervention,
  majService, ouvrirService, terminerServiceCourant, listerServices,
  listerInterventionsDuService
} from '../db.js';
import { setEcran, setInterventionCourante, setServiceCourant, s } from '../state.js';
import { STATUTS_REFERENCE, formatReference } from '../../data/referentiels.js';
import { escapeHtml, formatHeure, formatHeureInput, formatDateRelative } from '../ui.js';
import { renderBlocService } from './bloc-service.js';
import { renderTableauGardes } from './gardes.js';
import { exporterService } from '../export-claude.js';

// ─── Heures standard par poste ───────────────────────────────────────────────
// Format : [HH, MM] début, [HH, MM] fin
const HEURES_SERVICES = {
  S255: { debut: [5,  45], fin: [15,  0] },
  S256: { debut: [14, 30], fin: [23, 30] },
  S257: { debut: [22, 45], fin: [7,  30] },  // nuit : fin lendemain
  S250: { debut: [7,   0], fin: [19,  0] },
};

function heureStandardDebut(poste) {
  const cfg = HEURES_SERVICES[poste];
  if (!cfg) return null;
  return cfg.debut; // [h, m]
}

function heureStandardFin(poste) {
  const cfg = HEURES_SERVICES[poste];
  if (!cfg) return null;
  return cfg.fin; // [h, m]
}

// Formate [h, m] → "HH:MM"
function hmToString([h, m]) {
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

// Construit un objet Date pour aujourd'hui (ou demain si service de nuit)
// à partir de [h, m] et d'une référence de départ.
function buildDate(hm, dateRef = new Date()) {
  const d = new Date(dateRef);
  d.setHours(hm[0], hm[1], 0, 0);
  return d;
}

// Calcule le BAC (dépassement) en minutes entre heureFinTheorique et heureSaisie
function calcBac(heureSaisieStr, poste) {
  const std = heureStandardFin(poste);
  if (!std || !heureSaisieStr) return null;
  const [hs, ms] = heureSaisieStr.split(':').map(Number);
  const [ht, mt] = std;
  const saisieMin = hs * 60 + ms;
  const theorMin  = ht * 60 + mt;
  const diff = saisieMin - theorMin;
  // Gestion passage minuit (service de nuit comme S257 fin à 07h30)
  // Si diff < -12h → on ajoute 24h (la fin est le lendemain)
  const diffAdj = diff < -720 ? diff + 1440 : diff;
  return diffAdj;
}

function formatBac(diffMin) {
  if (diffMin === null) return '';
  if (diffMin <= 0) return '';
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  if (h > 0) return `BAC +${h}h${m > 0 ? String(m).padStart(2,'0') : ''}`;
  return `BAC +${m} min`;
}

// ─── Dialog prise de service ─────────────────────────────────────────────────

function ouvrirDialogPriseDeService(poste, onConfirmer) {
  const hm    = heureStandardDebut(poste);
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
        ${hm ? `<p class="dialog-hint">Heure standard : ${hmToString(hm)}. Modifie si différent.</p>` : ''}
      </div>
      <div class="dialog-actions">
        <button type="button" class="btn-secondaire" data-dialog="annuler">Annuler</button>
        <button type="button" class="btn-primaire" data-dialog="confirmer">Confirmer la prise</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const fermer = () => overlay.remove();
  overlay.querySelector('[data-dialog="annuler"]').addEventListener('click', fermer);
  overlay.querySelector('[data-dialog="confirmer"]').addEventListener('click', () => {
    const valHeure = overlay.querySelector('#d-prise-heure').value;
    fermer();
    onConfirmer(valHeure);
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) fermer(); });
  setTimeout(() => overlay.querySelector('input')?.focus(), 50);
}

// ─── Dialog fin de service ────────────────────────────────────────────────────

function ouvrirDialogFinDeService(poste, onConfirmer) {
  const hm    = heureStandardFin(poste);
  const valDef = hm ? hmToString(hm) : formatHeureInput(new Date());

  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.innerHTML = `
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-fin-titre">
      <div class="dialog-titre" id="dialog-fin-titre">Fin de service — ${escapeHtml(poste)}</div>
      <div class="dialog-contenu">
        <label class="champ">
          <span class="champ-label">Heure de fin de service</span>
          <input type="time" id="d-fin-heure" value="${valDef}" />
        </label>
        ${hm ? `<p class="dialog-hint">Fin théorique : ${hmToString(hm)}.</p>` : ''}
        <p class="dialog-hint" style="color:var(--rouge);margin-top:.5rem">
          ⚠ Cette action clôturera le service en cours.
        </p>
      </div>
      <div class="dialog-actions">
        <button type="button" class="btn-secondaire" data-dialog="annuler">Annuler</button>
        <button type="button" class="btn-danger"     data-dialog="confirmer">Terminer le service</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const fermer = () => overlay.remove();
  overlay.querySelector('[data-dialog="annuler"]').addEventListener('click', fermer);
  overlay.querySelector('[data-dialog="confirmer"]').addEventListener('click', () => {
    const valHeure = overlay.querySelector('#d-fin-heure').value;
    fermer();
    onConfirmer(valHeure);
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) fermer(); });
  setTimeout(() => overlay.querySelector('input')?.focus(), 50);
}

// ─── Dialog changement de service (propose conservation des gardes) ───────────

function ouvrirDialogChangementService(posteActuel, onConfirmer) {
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.innerHTML = `
    <div class="dialog" role="dialog" aria-modal="true">
      <div class="dialog-titre">Changer de service</div>
      <div class="dialog-contenu">
        <p>Service actuel : <strong>${escapeHtml(posteActuel)}</strong></p>
        <p class="dialog-hint">Le tableau des gardes sera-t-il conservé sur le nouveau service ?</p>
        <div class="dialog-choix-gardes">
          <label><input type="radio" name="gardes-action" value="conserver" checked /> Conserver les gardes</label>
          <label><input type="radio" name="gardes-action" value="reinit" /> Réinitialiser les gardes</label>
        </div>
      </div>
      <div class="dialog-actions">
        <button type="button" class="btn-secondaire" data-dialog="annuler">Annuler</button>
        <button type="button" class="btn-primaire"   data-dialog="confirmer">Changer de poste</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const fermer = () => overlay.remove();
  overlay.querySelector('[data-dialog="annuler"]').addEventListener('click', fermer);
  overlay.querySelector('[data-dialog="confirmer"]').addEventListener('click', () => {
    const action = overlay.querySelector('[name="gardes-action"]:checked').value;
    fermer();
    onConfirmer(action); // 'conserver' | 'reinit'
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) fermer(); });
}

// ─── Rendu principal ──────────────────────────────────────────────────────────

export async function renderInterventionList(container) {
  const serviceActuel = s().serviceCourant;
  const interventions = await listerInterventionsRecentes(7);

  // Affichage heure prise de service
  const heureDebut = serviceActuel
    ? (serviceActuel.heureDebutService
        ? formatHeure(serviceActuel.heureDebutService)
        : formatHeure(serviceActuel.debut))
    : '';

  // Regroupement par date
  const groupes = new Map();
  interventions.forEach(i => {
    const d = new Date(i.debut);
    const cle = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (!groupes.has(cle)) groupes.set(cle, { date: d, items: [] });
    groupes.get(cle).items.push(i);
  });
  const groupesTris = Array.from(groupes.values()).sort((a,b) => b.date - a.date);

  const risqueLabels = { auto: 'Auto', hetero: 'Hétéro', fugue: 'Fugue' };
  const risquesChips = (interv) => {
    if (!interv.risques || interv.risques.length === 0) return '';
    return `<span class="carte-chips">${interv.risques.map(r =>
      `<span class="chip-mini">${escapeHtml(risqueLabels[r] || r)}</span>`
    ).join('')}</span>`;
  };

  const carteHTML = (interv) => {
    const heureDeb  = formatHeure(interv.debut);
    const heureFin  = interv.fin ? formatHeure(interv.fin) : null;
    const statutClass = interv.fin ? 'statut-termine' : 'statut-cours';
    const statutLabel = interv.fin ? 'Terminée' : 'En cours';
    const ref = formatReference(interv.referenceStatut, interv.referenceNom) || '—';
    return `
      <article class="carte-intervention" data-id="${interv.id}" tabindex="0">
        <div class="carte-tete">
          <div class="carte-heures">
            <span class="heure-deb">${heureDeb}</span>
            ${heureFin ? `<span class="heure-sep">→</span><span class="heure-fin">${heureFin}</span>` : ''}
          </div>
          <span class="carte-statut ${statutClass}">${statutLabel}</span>
        </div>
        <div class="carte-corps">
          <div class="carte-lieu">${escapeHtml(interv.lieu || '—')}</div>
          <div class="carte-ref">${escapeHtml(ref)}</div>
          ${risquesChips(interv)}
        </div>
      </article>
    `;
  };

  // ── Bandeau service ──
  const bandeauService = serviceActuel ? `
    <div class="bandeau-service">
      <div class="bandeau-service-info">
        <span class="bandeau-label">Service en cours</span>
        <strong class="bandeau-poste">${escapeHtml(serviceActuel.poste)}</strong>
        <span class="bandeau-depuis">Prise : ${heureDebut}</span>
      </div>
      <div class="bandeau-service-actions">
        <button type="button" class="btn-primaire btn-sm" data-action="nouvelle-intervention">+ Intervention</button>
        <button type="button" class="btn-claude   btn-sm" data-action="export-service">🤖 Exporter</button>
        <button type="button" class="btn-danger   btn-sm" data-action="fin-service">Fin de service</button>
        <button type="button" class="btn-tertiaire btn-sm" data-action="changer-poste">Changer</button>
      </div>
    </div>
  ` : `
    <div class="bandeau-service bandeau-service-vide">
      <span class="bandeau-label">Aucun service en cours</span>
      <button type="button" class="btn-primaire" data-action="changer-poste">Prendre un service</button>
    </div>
  `;

  // ── Liste des interventions ──
  const contenuListe = groupesTris.length === 0 ? `
    <div class="vide">
      <p>Aucune intervention sur les 7 derniers jours.</p>
    </div>
  ` : groupesTris.map(groupe => `
    <section class="groupe-jour">
      <h3 class="groupe-titre">${escapeHtml(formatDateRelative(groupe.date))}</h3>
      <div class="groupe-items">
        ${groupe.items.map(carteHTML).join('')}
      </div>
    </section>
  `).join('');

  // ── Historique des services ──
  const tousServices = await listerServices();
  const servicesTermines = tousServices.filter(sv => sv.fin != null);

  const historiqueHTML = servicesTermines.length === 0 ? `
    <p class="vide">Aucun service terminé dans l'historique.</p>
  ` : servicesTermines.slice(0, 10).map(sv => {
    const debStr  = formatHeure(sv.heureDebutService || sv.debut);
    const finStr  = sv.heureFinService ? formatHeure(sv.heureFinService) : '—';
    const dateStr = formatDateRelative(new Date(sv.debut));
    const bac     = sv.heureFinService
      ? (() => {
          const finH = formatHeureInput(sv.heureFinService);
          const diff  = calcBac(finH, sv.poste);
          return diff ? formatBac(diff) : '';
        })()
      : '';
    return `
      <details class="historique-service">
        <summary>
          <span class="hist-poste">${escapeHtml(sv.poste)}</span>
          <span class="hist-date">${escapeHtml(dateStr)}</span>
          <span class="hist-heures">${debStr} → ${finStr}</span>
          ${bac ? `<span class="hist-bac">${escapeHtml(bac)}</span>` : ''}
        </summary>
        <div class="hist-interventions" data-service-id="${sv.id}">
          <em>Chargement…</em>
        </div>
      </details>
    `;
  }).join('');

  // ── Assemblage HTML complet ──
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

    <main class="ecran-liste">

      ${bandeauService}

      ${serviceActuel ? `
        <!-- Tableau gardes -->
        <div id="bloc-gardes-container"></div>

        <!-- Bloc service (transinfo reçue + notes) -->
        <div id="bloc-service-container"></div>

        <!-- Transinfo relève -->
        <section class="bloc-transinfo-releve">
          <div class="bloc-titre">Transinfo relève</div>
          <textarea
            id="transinfo-releve"
            class="bloc-textarea"
            rows="3"
            placeholder="Notes à transmettre à la relève…"
          >${escapeHtml(serviceActuel.transinfoReleve || '')}</textarea>
        </section>
      ` : ''}

      <!-- Interventions récentes -->
      <section class="liste-interventions">
        <h2 class="section-titre">Interventions — 7 derniers jours</h2>
        ${contenuListe}
      </section>

      <!-- Historique des services -->
      <section class="section-historique">
        <h2 class="section-titre">Historique des services</h2>
        ${historiqueHTML}
      </section>

    </main>
  `;

  // ── Bindings ──

  // Sélecteur de thème
  // (géré par initThemeSelector dans app.js après chaque rendu)

  // Export service pour Claude
  container.querySelector('[data-action="export-service"]')?.addEventListener('click', async (e) => {
    if (!serviceActuel) return;
    await exporterService(serviceActuel, e.currentTarget);
  });

  // Nouvelle intervention
  container.querySelector('[data-action="nouvelle-intervention"]')?.addEventListener('click', async () => {
    if (!serviceActuel) return;
    const nouvelle = await creerIntervention({ serviceId: serviceActuel.id, debut: new Date() });
    setInterventionCourante(nouvelle.id);
    setEcran('intervention-edit');
  });

  // Prendre / changer de poste
  container.querySelector('[data-action="changer-poste"]')?.addEventListener('click', () => {
    if (serviceActuel) {
      // Dialog : conserver ou réinit les gardes ?
      ouvrirDialogChangementService(serviceActuel.poste, async (actionGardes) => {
        const gardesAConserver = actionGardes === 'conserver'
          ? (serviceActuel.gardes || [])
          : [];
        setEcran('poste-selector', { gardesAConserver });
      });
    } else {
      setEcran('poste-selector');
    }
  });

  // Fin de service
  container.querySelector('[data-action="fin-service"]')?.addEventListener('click', () => {
    if (!serviceActuel) return;
    ouvrirDialogFinDeService(serviceActuel.poste, async (heureStr) => {
      const [h, m] = heureStr.split(':').map(Number);
      const now = new Date();
      now.setHours(h, m, 0, 0);

      // Calcul et affichage BAC
      const diff  = calcBac(heureStr, serviceActuel.poste);
      const bac   = formatBac(diff);
      const std   = heureStandardFin(serviceActuel.poste);
      const stdStr = std ? hmToString(std) : null;

      const msg = stdStr
        ? `Fin enregistrée : ${heureStr}\nFin théorique : ${stdStr}${bac ? `\n${bac}` : ''}\n\nConfirmer ?`
        : `Fin enregistrée : ${heureStr}\n\nConfirmer ?`;

      if (!confirm(msg)) return;

      await majService(serviceActuel.id, { heureFinService: now, fin: now });
      setServiceCourant(null);
      setEcran('list');
    });
  });

  // Tableau gardes
  if (serviceActuel) {
    const blocGardes = container.querySelector('#bloc-gardes-container');
    if (blocGardes) {
      renderTableauGardes(blocGardes, serviceActuel, (serviceMaj) => {
        Object.assign(serviceActuel, serviceMaj);
        s().serviceCourant = serviceActuel;
      });
    }
  }

  // Bloc service (transinfo reçue + notes du service) — géré par renderBlocService existant
  if (serviceActuel) {
    const blocContainer = container.querySelector('#bloc-service-container');
    if (blocContainer) {
      await renderBlocService(blocContainer, serviceActuel, (serviceMaj) => {
        Object.assign(serviceActuel, serviceMaj);
        s().serviceCourant = serviceActuel;
      });
    }
  }

  // Transinfo relève
  const txtReleve = container.querySelector('#transinfo-releve');
  if (txtReleve && serviceActuel) {
    txtReleve.addEventListener('blur', async () => {
      const val = txtReleve.value;
      await majService(serviceActuel.id, { transinfoReleve: val });
      serviceActuel.transinfoReleve = val;
      s().serviceCourant = serviceActuel;
    });
  }

  // Clic sur une carte d'intervention
  container.querySelectorAll('.carte-intervention').forEach(carte => {
    const ouvrir = async () => {
      const id = parseInt(carte.dataset.id, 10);
      const interv = await getIntervention(id);
      if (!interv) return;
      setInterventionCourante(id);
      setEcran('intervention-edit');
    };
    carte.addEventListener('click', ouvrir);
    carte.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrir(); }
    });
  });

  // Historique : chargement lazy des interventions par service
  container.querySelectorAll('.historique-service').forEach(details => {
    details.addEventListener('toggle', async () => {
      if (!details.open) return;
      const div = details.querySelector('.hist-interventions');
      if (!div || div.dataset.loaded) return;
      div.dataset.loaded = '1';
      const serviceId = parseInt(div.dataset.serviceId, 10);
      const { listerInterventionsDuService: liDuS } = await import('../db.js');
      const intervs = await liDuS(serviceId);
      if (intervs.length === 0) {
        div.innerHTML = '<em class="vide-petit">Aucune intervention enregistrée.</em>';
        return;
      }
      div.innerHTML = intervs.map(i => {
        const ref = formatReference(i.referenceStatut, i.referenceNom) || '—';
        return `<div class="hist-interv-ligne">
          <span class="hist-interv-heure">${formatHeure(i.debut)}</span>
          <span class="hist-interv-lieu">${escapeHtml(i.lieu || '—')}</span>
          <span class="hist-interv-ref">${escapeHtml(ref)}</span>
        </div>`;
      }).join('');
    });
  });
}
