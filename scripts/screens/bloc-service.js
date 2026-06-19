// Slice 4 — Bloc "Mon service"
// 3 sections repliables : transmission reçue, notes du service, tâches.
// Bandeau optionnel : "Reprendre vos tâches récurrentes ?" si applicable.
//
// Depuis slice C : support des répétitions par tâche.
//   Tâche avec repetitions > 1 → affichage "Ronde X — 1/3 ✅ 14h22 · 2/3 ☐ · 3/3 ☐"
//   Coche → horodatage auto. Tap sur l'heure → input type="time" inline.

import { majService, getService } from '../db.js';
import {
  ajouterTacheAuService, ajouterPlusieursTachesAuService,
  toggleOccurrenceTache, majHeureOccurrence,
  supprimerTacheService,
  getPropositionsDemarrageService, basculerEpinglage, estTacheEpinglee,
  marquerBandeauVu, bandeauDejaVu, estTacheCochee
} from '../service-store.js';
import { escapeHtml, formatHeure } from '../ui.js';

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

function sectionOuverte(section, contenuVide) {
  const replis = getReplis();
  if (Object.prototype.hasOwnProperty.call(replis, section)) {
    return replis[section];
  }
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

function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// Formate une heure ISO en "14h22" — null retourne chaîne vide.
function heureDepuisISO(iso) {
  if (!iso) return '';
  try { return formatHeure(new Date(iso)); } catch { return ''; }
}

// Construit le HTML d'une occurrence individuelle (puce cliquable).
// occIdx : index dans le tableau occurrences.
function gabaritOccurrence(occ, occIdx, tacheId, total) {
  const cochee = occ.heure !== null;
  const heure  = cochee ? heureDepuisISO(occ.heure) : '';
  const label  = total > 1 ? `${occIdx + 1}/${total}` : '';

  if (cochee) {
    // Puce cochée : affiche l'heure, cliquable pour modifier
    return '<span class="occ-cochee">'
      + '<input type="checkbox" class="occ-check" data-tache-id="' + escapeHtml(tacheId) + '" data-occ-idx="' + occIdx + '" checked aria-label="Occurrence ' + (occIdx + 1) + ' cochée" />'
      + (label ? '<span class="occ-label">' + escapeHtml(label) + '</span>' : '')
      + ' <button type="button" class="occ-heure" data-tache-id="' + escapeHtml(tacheId) + '" data-occ-idx="' + occIdx + '" title="Modifier l\'heure" aria-label="Heure : ' + escapeHtml(heure) + ', cliquer pour modifier">'
      + escapeHtml(heure)
      + '</button>'
      + '</span>';
  } else {
    // Puce non cochée
    return '<span class="occ-vide">'
      + '<input type="checkbox" class="occ-check" data-tache-id="' + escapeHtml(tacheId) + '" data-occ-idx="' + occIdx + '" aria-label="Occurrence ' + (occIdx + 1) + ' non cochée" />'
      + (label ? '<span class="occ-label">' + escapeHtml(label) + '</span>' : '')
      + '</span>';
  }
}

// Construit le HTML d'une tâche complète.
function gabaritTache(t, epingleeBibliotheque) {
  const cochee = estTacheCochee(t);

  // Normalize occurrences (rétrocompat tâches sans occurrences)
  const occs = Array.isArray(t.occurrences) && t.occurrences.length > 0
    ? t.occurrences
    : [{ heure: t.cochee ? (t.horodatageCompletion || null) : null }];
  const total = occs.length;

  const occsHTML = occs.map((o, idx) => gabaritOccurrence(o, idx, t.id, total)).join(' · ');

  return '<li class="tache" data-id="' + escapeHtml(t.id) + '">'
    + '<div class="tache-ligne">'
    + '<span class="tache-texte ' + (cochee ? 'tache-cochee' : '') + '">' + escapeHtml(t.texte) + '</span>'
    + '<div class="tache-occurrences">' + occsHTML + '</div>'
    + '</div>'
    + '<div class="tache-actions">'
    + '<button type="button" class="btn-mini ' + (epingleeBibliotheque ? 'btn-epingle-actif' : '') + '"'
    + ' data-action="toggle-epingle" data-texte="' + escapeHtml(t.texte) + '"'
    + ' aria-label="' + (epingleeBibliotheque ? 'Désépingler' : 'Épingler comme récurrente') + '"'
    + ' title="' + (epingleeBibliotheque ? 'Désépingler de la bibliothèque' : 'Épingler comme récurrente') + '">📌</button>'
    + '<button type="button" class="btn-mini btn-danger" data-action="supprimer-tache"'
    + ' aria-label="Supprimer la tâche" title="Supprimer">×</button>'
    + '</div>'
    + '</li>';
}

function gabaritBandeauRecurrentes(propositions) {
  if (!propositions || propositions.length === 0) return '';
  return '<div class="bandeau-recurrentes" data-zone="bandeau-recurrentes">'
    + '<div class="bandeau-recurrentes-tete">'
    + '<span class="bandeau-recurrentes-titre">📌 Reprendre vos tâches récurrentes ?</span>'
    + '<button type="button" class="btn-mini" data-action="fermer-bandeau" aria-label="Plus tard">×</button>'
    + '</div>'
    + '<div class="bandeau-recurrentes-liste">'
    + propositions.map(p =>
        '<label class="prop-recurrente">'
        + '<input type="checkbox" data-prop-texte="' + escapeHtml(p.texte) + '" ' + (p.epinglee ? 'checked' : '') + ' />'
        + '<span class="prop-texte">' + escapeHtml(p.texte) + '</span>'
        + (p.epinglee ? '<span class="prop-badge" title="Épinglée">📌</span>' : '')
        + (p.compteur ? '<span class="prop-compteur" title="' + p.compteur + ' utilisation' + (p.compteur > 1 ? 's' : '') + '">×' + p.compteur + '</span>' : '')
        + (p.repetitions && p.repetitions > 1 ? '<span class="prop-compteur" title="' + p.repetitions + ' répétitions">×' + p.repetitions + '</span>' : '')
        + '</label>'
      ).join('')
    + '</div>'
    + '<div class="bandeau-recurrentes-actions">'
    + '<button type="button" class="btn-tertiaire" data-action="fermer-bandeau">Plus tard</button>'
    + '<button type="button" class="btn-primaire" data-action="reprendre-selection">Ajouter la sélection</button>'
    + '</div>'
    + '</div>';
}

async function gabaritBlocService(service, propositions, epingles) {
  const transmissionVide = !(service.transmissionRecue && service.transmissionRecue.trim());
  const notesVide = !(service.notesService && service.notesService.trim());
  const taches = Array.isArray(service.taches) ? service.taches : [];
  const tachesVide = taches.length === 0;
  const cochees = taches.filter(t => estTacheCochee(t)).length;

  const motsNotes = compterMots(service.notesService);
  const transmTronq = tronquer(service.transmissionRecue, 50);
  const notesTronq = tronquer(service.notesService, 50);

  const resTransmission = transmissionVide
    ? '<span class="bloc-resume-vide">vide</span>'
    : '<span class="bloc-resume">' + escapeHtml(transmTronq) + '</span>';
  const resNotes = notesVide
    ? '<span class="bloc-resume-vide">vide</span>'
    : '<span class="bloc-resume">' + escapeHtml(notesTronq) + (motsNotes > 10 ? ' (' + motsNotes + ' mots)' : '') + '</span>';
  const resTaches = tachesVide
    ? '<span class="bloc-resume-vide">vide</span>'
    : '<span class="bloc-resume">' + cochees + '/' + taches.length + ' cochée' + (taches.length > 1 ? 's' : '') + '</span>';

  const tachesHTML = taches.map(t => gabaritTache(t, epingles.has(t.texte)));

  return '<section class="bloc-service" data-zone="bloc-service">'
    + '<h2 class="bloc-service-titre">Mon service</h2>'

    + (propositions.length > 0 ? gabaritBandeauRecurrentes(propositions) : '')

    + '<details class="bloc-section" data-section="transmission" ' + (sectionOuverte('transmission', transmissionVide) ? 'open' : '') + '>'
    + '<summary>'
    + '<span class="bloc-section-titre">Transmission reçue</span>'
    + resTransmission
    + '</summary>'
    + '<div class="bloc-section-corps">'
    + '<textarea class="bloc-textarea" data-champ="transmissionRecue" rows="4"'
    + ' placeholder="Collez ici la transmission (Recorder, prise de service…) ou tapez librement.">'
    + escapeHtml(service.transmissionRecue || '')
    + '</textarea>'
    + '</div>'
    + '</details>'

    + '<details class="bloc-section" data-section="notes" ' + (sectionOuverte('notes', notesVide) ? 'open' : '') + '>'
    + '<summary>'
    + '<span class="bloc-section-titre">Notes du service</span>'
    + resNotes
    + '</summary>'
    + '<div class="bloc-section-corps">'
    + '<textarea class="bloc-textarea" data-champ="notesService" rows="4"'
    + ' placeholder="Mémo libre — choses à ne pas oublier, contexte, observations…">'
    + escapeHtml(service.notesService || '')
    + '</textarea>'
    + '</div>'
    + '</details>'

    + '<details class="bloc-section" data-section="taches" ' + (sectionOuverte('taches', tachesVide) ? 'open' : '') + '>'
    + '<summary>'
    + '<span class="bloc-section-titre">Tâches</span>'
    + resTaches
    + '</summary>'
    + '<div class="bloc-section-corps">'
    + '<ul class="taches-liste">'
    + tachesHTML.join('')
    + '</ul>'
    + '<div class="tache-ajout">'
    + '<input type="text" class="tache-ajout-input" placeholder="Ajouter une tâche…"'
    + ' aria-label="Nouvelle tâche" maxlength="200" />'
    + '<div class="tache-ajout-repetitions">'
    + '<label for="tache-rep-input" class="tache-rep-label">× </label>'
    + '<input type="number" id="tache-rep-input" class="tache-rep-input" min="1" max="99" value="1"'
    + ' aria-label="Nombre de répétitions" title="Nombre de répétitions" />'
    + '</div>'
    + '<button type="button" class="btn-secondaire btn-tache-ajouter" data-action="ajouter-tache">+ Ajouter</button>'
    + '</div>'
    + '</div>'
    + '</details>'

    + '</section>';
}

// === Rendu et binding ===

export async function renderBlocService(containerExt, service, onServiceChange) {
  if (!service) {
    containerExt.innerHTML = '';
    return;
  }

  const tachesActuelles = (service.taches || []).map(t => t.texte);
  let propositions = [];
  if (!bandeauDejaVu(service.id)) {
    const candidatesAll = await getPropositionsDemarrageService(8);
    propositions = candidatesAll.filter(p => !tachesActuelles.includes(p.texte));
  }

  const epingles = new Set();
  for (const t of (service.taches || [])) {
    if (await estTacheEpinglee(t.texte)) epingles.add(t.texte);
  }

  containerExt.innerHTML = await gabaritBlocService(service, propositions, epingles);

  // Helper : rerender du bloc seul après mutation
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
      const cochees = Array.from(bandeau.querySelectorAll('input[type="checkbox"]:checked'));
      const textes = cochees.map(c => c.dataset.propTexte).filter(Boolean);
      if (textes.length > 0) {
        await ajouterPlusieursTachesAuService(service.id, textes);
      }
      marquerBandeauVu(service.id);
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

  // === Auto-save textareas ===
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

  // === Tâches : occurrences (cocher / décocher) ===
  containerExt.querySelectorAll('.occ-check').forEach(chk => {
    chk.addEventListener('change', async () => {
      const tacheId = chk.dataset.tacheId;
      const idx = parseInt(chk.dataset.occIdx, 10);
      await toggleOccurrenceTache(service.id, tacheId, idx);
      await rerenderBloc();
    });
  });

  // === Tâches : tap sur l'heure → input time inline ===
  containerExt.querySelectorAll('.occ-heure').forEach(btn => {
    btn.addEventListener('click', () => {
      const tacheId = btn.dataset.tacheId;
      const occIdx  = parseInt(btn.dataset.occIdx, 10);
      const heureActuelle = btn.textContent.trim(); // "14h22"

      // Convertit "14h22" → "14:22" pour input type="time"
      const [hh, mm] = heureActuelle.split('h');
      const valInput = (hh && mm) ? hh.padStart(2,'0') + ':' + mm.padStart(2,'0') : '';

      // Remplace le bouton par un input inline
      const input = document.createElement('input');
      input.type = 'time';
      input.value = valInput;
      input.className = 'occ-heure-input';
      input.setAttribute('aria-label', 'Modifier l\'heure');
      btn.replaceWith(input);
      input.focus();

      const valider = async () => {
        const [h, m] = (input.value || '').split(':').map(Number);
        if (!isNaN(h) && !isNaN(m)) {
          // Reconstruit une date ISO à partir du jour de début d'intervention
          const base = new Date();
          base.setHours(h, m, 0, 0);
          await majHeureOccurrence(service.id, tacheId, occIdx, base.toISOString());
        }
        await rerenderBloc();
      };

      input.addEventListener('change', valider);
      input.addEventListener('blur', valider);
    });
  });

  // === Tâches : épinglage et suppression ===
  containerExt.querySelectorAll('.tache').forEach(li => {
    const id = li.dataset.id;

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

  // === Ajout d'une tâche avec répétitions ===
  const inputAjout = containerExt.querySelector('.tache-ajout-input');
  const inputRep   = containerExt.querySelector('.tache-rep-input');
  const btnAjout   = containerExt.querySelector('[data-action="ajouter-tache"]');

  const ajouterCourant = async () => {
    if (!inputAjout) return;
    const valeur = inputAjout.value.trim();
    if (!valeur) return;
    const repetitions = parseInt(inputRep?.value || '1', 10) || 1;
    await ajouterTacheAuService(service.id, valeur, repetitions);
    inputAjout.value = '';
    if (inputRep) inputRep.value = '1';
    setRepli('taches', true);
    await rerenderBloc();
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
