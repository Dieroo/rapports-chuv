# Rapports CHUV

App perso de pré-remplissage des rapports d'intervention pour Dieroo
(Securitas CHUV). PWA installable sur Android, données 100% locales (IndexedDB),
aucun backend, aucun cloud.

> **Statut actuel : Slice 1.a — Setup minimal**
> Voir `STATUS.md` du projet Claude pour la roadmap complète.

---

## Mettre en ligne via GitHub Pages

1. Sur github.com, créer le repo `rapports-chuv` (public ou privé peu importe).
2. Uploader le contenu de ce dossier (drag & drop dans "Add file → Upload files").
3. Settings → Pages → Source : `Deploy from a branch` → branch `main` (root) → Save.
4. Attendre ~1 minute. L'URL publique sera `https://dieroo.github.io/rapports-chuv/`.

## Tester en local (optionnel)

Un serveur HTTP simple suffit (les Service Workers exigent HTTPS ou localhost) :

```bash
cd rapports-chuv
python3 -m http.server 8080
# Puis ouvrir http://localhost:8080 dans Chrome
```

## Structure

```
rapports-chuv/
├── index.html              Page d'entrée
├── manifest.webmanifest    PWA manifest
├── sw.js                   Service Worker (cache offline)
├── README.md
│
├── assets/
│   └── icons/              Icônes PWA (192, 512, maskable)
│
├── styles/
│   └── base.css            Variables CSS, reset, layout
│
├── scripts/
│   ├── app.js              Entry point (ES module)
│   ├── db.js               Schéma Dexie + helpers d'accès
│   ├── screens/            (Slice 1.b et suivantes)
│   └── lib/
│       └── dexie.min.js    Wrapper IndexedDB (embarqué local)
│
└── data/
    └── referentiels.js     Postes brigade, statuts Référence, lieux pré-chargés
```

## Stack

- HTML/CSS/JS vanilla, ES modules
- IndexedDB via [Dexie](https://dexie.org/) (embarqué local, ~94 ko)
- Service Worker écrit à la main (~30 lignes, cache-first sur assets)
- Zéro build, zéro framework, zéro dépendance runtime externe

## Tester la Slice 1.a

Une fois l'app ouverte dans Chrome Android :

1. Tu dois voir un écran "Prêt à démarrer" avec deux encarts de diagnostic
   (base de données + référentiels).
2. Le menu Chrome doit proposer "Installer l'application" ou
   "Ajouter à l'écran d'accueil".
3. Dans DevTools (sur PC) :
   - `Application > Service Workers` : `sw.js` doit être "activated and running".
   - `Application > IndexedDB > RapportsCHUV` : 3 stores créés
     (`services`, `interventions`, `entrees`), vides.
   - Console : pas d'erreur, message `[SW] Enregistré` et `[App] Initialisée`.

## Suite

- **Slice 1.b** : sélecteur "Mon poste pour ce service" + écran Liste vide
- **Slice 1.c** : création d'intervention (lieu + référence + démarrage)
- **Slice 1.d** : entrées chronologiques + 3 boutons de copie + aide-mémoire OnSphere
