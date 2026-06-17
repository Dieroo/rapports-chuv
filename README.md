# Rapports CHUV

App perso de pré-remplissage des rapports d'intervention pour Dieroo
(Securitas CHUV). PWA installable sur Android, données 100% locales (IndexedDB),
aucun backend, aucun cloud.

> **Statut : V1 test terrain (slices 1+2+3+4)**
> Voir `STATUS.md` du projet Claude pour la roadmap complète.

---

## Mettre en ligne via GitHub Pages

1. Sur github.com, repo `rapports-chuv` (public si plan gratuit).
2. Uploader le contenu de ce dossier (drag & drop dans "Add file → Upload files").
3. Settings → Pages → Source : `Deploy from a branch` → branche `main` (root) → Save.
4. Attendre ~1 min. URL publique : `https://dieroo.github.io/rapports-chuv/`.

## Tester en local

```bash
cd rapports-chuv
python3 -m http.server 8080
# Puis ouvrir http://localhost:8080 dans Chrome
```

## Structure

```
rapports-chuv/
├── index.html                  Page d'entrée + script anti-FOUC inline
├── manifest.webmanifest        PWA manifest
├── sw.js                       Service Worker (cache offline)
├── README.md
│
├── assets/icons/               192, 512, maskable
│
├── styles/
│   ├── base.css                Tokens, thèmes, reset
│   └── components.css          Tous les composants UI
│
├── scripts/
│   ├── app.js                  Entry point + routing
│   ├── db.js                   Schéma Dexie + helpers CRUD
│   ├── theme.js                Gestion thèmes (clair/auto/sombre)
│   ├── state.js                État global + observers
│   ├── ui.js                   Helpers DOM, formatage, presse-papier
│   ├── lieux-store.js          Autocomplétion lieux (épinglés + fréquence)
│   ├── service-store.js        Tâches du service + bibliothèque récurrentes (Slice 4)
│   ├── templates.js            Phrases workflow Surveillance
│   ├── screens/
│   │   ├── poste-selector.js   Écran sélection du poste
│   │   ├── intervention-list.js Écran liste des interventions
│   │   ├── intervention-edit.js Écran édition (le gros morceau)
│   │   └── bloc-service.js     Bloc "Mon service" : 3 sections + checklist (Slice 4)
│   └── lib/
│       └── dexie.min.js        Wrapper IndexedDB embarqué local
│
└── data/
    └── referentiels.js         Postes, statuts, fonctions, lieux pré-chargés
```

## Fonctionnalités V1 test terrain

### Slice 1 (squelette ergonomique)
- Sélecteur de poste (14 postes, déclenche un Service)
- Liste des interventions des 7 derniers jours, regroupée par date
- Création / édition / suppression d'intervention
- Fil chronologique avec heure + texte par entrée
- 3 boutons de copie : Référence / Description / Rapport entier
- Aide-mémoire OnSphere (panneau récap)

### Slice 2 (référentiels & autocomplétion)
- Pré-chargement de 14 lieux
- Autocomplétion par récurrence (apprentissage)
- Épinglage manuel (jusqu'à 5 lieux en accès rapide)
- Sélecteurs structurés : Statut Référence (8), Fonctions médicales (14), Catégories (10)

### Slice 3 (templates workflow Surveillance)
- 10 boutons d'action workflow : Engagement, Sur place, Risques, Transmission CDS,
  Transfert, Note libre, Relève brigade, Relève SP, Fin médical, Transfert ambulance
- Chaque action ouvre un mini-dialog paramétré et insère une entrée horodatée

### Slice 4 (bloc "Mon service")
- Bloc visible en tête de la liste, après le bandeau de service en cours
- 3 sections repliables :
  - **Transmission reçue** : collage de la prise de service ou saisie libre
  - **Notes du service** : mémo libre, observations, contexte
  - **Tâches** : checklist cochable avec horodatage de complétion
- Bibliothèque de tâches récurrentes : apprentissage par usage, suggestion au démarrage d'un nouveau service
- Épinglage manuel d'une tâche pour qu'elle apparaisse pré-cochée dans les propositions
- Auto-save 400 ms après chaque frappe + sauvegarde au blur

### Bonus : système 3 thèmes
- Clair (par défaut) / Auto (suit le système) / Sombre
- Sélecteur ☀ / ⌗ / ☾ en haut à droite, persisté en localStorage

## Pas dans cette V1 (à venir)

- Slice 5 : export "Partager pour Claude" via Web Share API (inclut transmission + notes du bloc service)
- Slice 6 : archive 3 mois avec containers Service, photo de référence, filtres archive
- Slice 7 : polish (typo IBM Plex, accessibilité avancée, etc.)

## Test rapide après installation

1. Au premier lancement → sélecteur de poste, choisir un poste (ex S257).
2. Sur la liste vide, cliquer "+ Nouvelle intervention".
3. Remplir lieu (autocomplétion → choisir BU44/07/PLI par exemple), statut + nom.
4. Cocher des risques (Auto, Hétéro, Fugue) + toggle physique forte.
5. Cliquer "Engagement" → dialog → "CDS" → "demande de surveillance..." → Insérer.
6. Cliquer "Sur place" → fonction + nom → Insérer.
7. Vérifier que les entrées apparaissent dans le fil chronologique.
8. Cliquer 📋 sur "Référence" → coller dans un éditeur de texte → vérifier `Pat. ...`.
9. Cliquer 📋 sur une entrée → coller → vérifier le texte.
10. Tester le sélecteur de thème ☀ / ⌗ / ☾.
11. Cliquer "Terminer l'intervention".
12. Fermer l'app, la rouvrir → l'intervention doit toujours être là.
