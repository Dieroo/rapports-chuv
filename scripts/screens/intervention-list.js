// Écran Liste des interventions — accueil par défaut.
// Affiche le service en cours en tête, puis les interventions des 7 derniers jours
// regroupées par date.

import { listerInterventionsRecentes, creerIntervention, getIntervention } from '../db.js';
import { setEcran, setInterventionCourante, s } from '../state.js';
import { STATUTS_REFERENCE, formatReference } from '../../data/referentiels.js';
import { escapeHtml, formatHeure, formatDateRelative, confirmer } from '../ui.js';
import { renderBlocService } from './bloc-service.js';

export async function renderInterventionList(container) {
  const serviceActuel = s().serviceCourant;
  const interventions = await listerInterventionsRecentes(7);

  // Indicateur de la Référence affichée dans une carte
  const refDisplay = (interv) => {
    const r = formatReference(interv.referenceStatut, interv.referenceNom);
    return r || '—';
  };

  // Indicateur de risques
  const risqueLabels = { auto: 'Auto', hetero: 'Hétéro', fugue: 'Fugue' };
  const risquesChips = (interv) => {
    if (!interv.risques || interv.risques.length === 0) return '';
    return `<span class="carte-chips">${interv.risques.map(r =>
      `<span class="chip-mini">${escapeHtml(risqueLabels[r] || r)}</span>`
    ).join('')}</span>`;
  };

  // Regroupement par date (clé = YYYY-MM-DD)
  const groupes = new Map();
  interventions.forEach(i => {
    const d = new Date(i.debut);
    const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!groupes.has(cle)) groupes.set(cle, { date: d, items: [] });
    groupes.get(cle).items.push(i);
  });
  const groupesTris = Array.from(groupes.values()).sort((a, b) => b.date - a.date);

  const carteHTML = (interv) => {
    const heureDeb = formatHeure(interv.debut);
    const heureFin = interv.fin ? formatHeure(interv.fin) : null;
    const statutLabel = interv.fin ? 'Terminée' : 'En cours';
    const statutClass = interv.fin ? 'statut-termine' : 'statut-cours';
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
          <div class="carte-ref">${escapeHtml(refDisplay(interv))}</div>
          ${risquesChips(interv)}
        </div>
      </article>
    `;
  };

  const enteteService = serviceActuel ? `
    <div class="bandeau-service">
      <div>
        <span class="bandeau-label">Service en cours</span>
        <strong class="bandeau-poste">${escapeHtml(serviceActuel.poste)}</strong>
        <span class="bandeau-depuis">depuis ${formatHeure(serviceActuel.debut)}</span>
      </div>
      <button type="button" class="btn-tertiaire" data-action="changer-poste">Changer</button>
    </div>
  ` : `
    <div class="bandeau-service bandeau-service-vide">
      <div>
        <span class="bandeau-label">Aucun service en cours</span>
      </div>
      <button type="button" class="btn-primaire" data-action="changer-poste">Choisir un poste</button>
    </div>
  `;

  const contenuListe = groupesTris.length === 0 ? `
    <div class="vide">
      <p>Aucune intervention sur les 7 derniers jours.</p>
      ${serviceActuel ? `<p class="vide-aide">Crée ta première intervention avec le bouton ci-dessus.</p>` : ''}
    </div>
  ` : groupesTris.map(groupe => `
    <section class="groupe-jour">
      <h3 class="groupe-titre">${escapeHtml(formatDateRelative(groupe.date))}</h3>
      <div class="groupe-items">
        ${groupe.items.map(carteHTML).join('')}
      </div>
    </section>
  `).join('');

  container.innerHTML = `
    <header class="app-header">
      <div class="app-header-top">
        <h1>Rapports CHUV</h1>
        <div class="selecteur-theme" role="radiogroup" aria-label="Thème de l'application">
          <button type="button" data-theme-set="clair"  aria-label="Mode clair" title="Mode clair">☀</button>
          <button type="button" data-theme-set="auto"   aria-label="Mode automatique" title="Mode automatique">⌗</button>
          <button type="button" data-theme-set="sombre" aria-label="Mode sombre" title="Mode sombre">☾</button>
        </div>
      </div>
    </header>

    <main class="ecran-liste">
      ${enteteService}

      ${serviceActuel ? `<div id="bloc-service-container"></div>` : ''}

      ${serviceActuel ? `
        <button type="button" class="btn-primaire btn-bloc" data-action="nouvelle-intervention">
          + Nouvelle intervention
        </button>
      ` : ''}

      <section class="liste-interventions">
        ${contenuListe}
      </section>
    </main>
  `;

  // Bind : changer de poste
  container.querySelector('[data-action="changer-poste"]')?.addEventListener('click', () => {
    setEcran('poste-selector');
  });

  // Slice 4 : monte le bloc service (transmission + notes + tâches) si un service est en cours.
  // On NE rappelle PAS setServiceCourant (qui déclencherait un rerender complet et tuerait
  // le focus dans les textareas). Le bloc-service gère son propre rerender local ; on se
  // contente de mettre à jour silencieusement l'objet service en mémoire pour que les autres
  // écrans (édition d'intervention) voient une donnée fraîche s'ils y reviennent.
  if (serviceActuel) {
    const blocContainer = container.querySelector('#bloc-service-container');
    if (blocContainer) {
      await renderBlocService(blocContainer, serviceActuel, (serviceMaj) => {
        // Mutation silencieuse : on remplace les champs dans l'objet en place
        Object.assign(serviceActuel, serviceMaj);
        s().serviceCourant = serviceActuel;
      });
    }
  }

  // Bind : nouvelle intervention
  container.querySelector('[data-action="nouvelle-intervention"]')?.addEventListener('click', async () => {
    if (!serviceActuel) return;
    const nouvelle = await creerIntervention({
      serviceId: serviceActuel.id,
      debut: new Date()
    });
    setInterventionCourante(nouvelle.id);
    setEcran('intervention-edit');
  });

  // Bind : clic sur une carte d'intervention
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
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        ouvrir();
      }
    });
  });
}
