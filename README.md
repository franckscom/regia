# Regia

App personnelle de Franck : tâches, planning (Gantt et rétroplanning), notes dictées à Claude, réunions et comptes-rendus, calendrier éditorial, interactions LinkedIn et exercices de langue. Installable sur téléphone et ordinateur, utilisable hors ligne.

## Fonctionnement

- Les données sont enregistrées sur chaque appareil : l'app s'ouvre et fonctionne sans réseau.
- Le bouton « Synchroniser » envoie les changements vers un Google Sheet privé, par l'intermédiaire d'un script Google Apps Script (`synchro/Code.gs`), et récupère ceux des autres appareils. Pour une même fiche, la modification la plus récente l'emporte.
- Le script crée aussi dans Google Agenda les événements validés dans l'app et renvoie les prochains rendez-vous.
- Claude peut écrire dans le même classeur (notes dictées, exercices, corrections) : tout arrive dans l'app à la synchro suivante.
- Ce dépôt ne contient aucune donnée personnelle : l'adresse du script n'est enregistrée que sur les appareils.

## Installer

- iPhone ou iPad : ouvrir l'adresse de l'app dans Safari, Partager, « Sur l'écran d'accueil ».
- Android : Chrome, menu ⋮, « Installer l'application ».
- Ordinateur : Chrome ou Edge, icône d'installation dans la barre d'adresse.

Ensuite, dans l'app : Réglages, Synchronisation, coller l'adresse du script (elle se termine par `/exec`), « Enregistrer et synchroniser ».

## Organisation du code

- `index.html` : la coquille (en-tête, navigation, zones d'affichage).
- `js/main.js` : démarrage, navigation, événements.
- `js/core/` : socle commun. `config.js` (libellés et listes), `db.js` (stockage sur l'appareil), `store.js` (données en mémoire, écritures), `sync.js` (synchronisation), `ui.js` (vues, actions, feuilles d'édition), `dates.js`, `util.js`, `files.js` (export Excel, sauvegarde).
- `js/tabs/` : un fichier par onglet (aujourdhui, notes, taches, contenus, planning, reunions, exercices, candidatures, reglages).
- `css/base.css` (socle visuel) et `css/views.css` (styles des onglets).
- `sw.js` : fonctionnement hors ligne et mises à jour. `manifest.webmanifest`, `icons/` : installation.
- `fonts/`, `vendor/` : polices (licence SIL OFL) et bibliothèque SheetJS (licence Apache 2.0), embarquées pour le hors ligne.

## Mettre à jour l'app

Modifier les fichiers, puis lancer `python3 outils/maj_sw.py` : la liste des fichiers en cache et `VERSION` sont mises à jour dans `sw.js`. Chaque appareil propose alors « Mettre à jour » à l'ouverture suivante. Les données restent sur l'appareil.
