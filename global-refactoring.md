# Documentation de la Refactorisation Globale (Monolithique → Modulaire)

## 1. Contexte Initial (L'ancien `index.html`)
Au départ, votre application était une **Single Page Application (SPA) monolithique**.
Tout le code résidait dans un seul fichier géant `index.html` (ou presque) :
*   **HTML** : Structure de la page.
*   **CSS** : Styles dans des balises `<style>`.
*   **JavaScript** : Toute la logique (gestion des élèves, devoirs, notes, export, navigation) mélangée dans des balises `<script>`.

**Problèmes** : Fichier énorme, difficile à lire, risque élevé de casser une fonctionnalité en modifiant une autre, navigation dans le code pénible.

## 2. La Nouvelle Architecture Modulaire

Nous avons éclaté ce monolithe en plusieurs **modules spécialisés** (fichiers séparés), organisés par responsabilité métier.

### Structure des Dossiers

```
C:\Users\HomePC\Documents\DEV\simpleNotes\
├── index.html                      (Point d'entrée : Structure squelette + Imports)
├── translations.js                 (Dictionnaire de langues : FR, EN, AR)
└── src\
    ├── services\                   (Logique Métier pure - Pas d'interface graphique)
    │   ├── grades.service.js       (Calculs de notes, gestion des barèmes)
    │   └── assignments.service.js  (Logique des devoirs)
    │
    ├── storage\                    (Persistance des données)
    │   └── store.js                (Gestion centralisée du localStorage : save/load)
    │
    └── ui\                         (Interface Utilisateur - Interaction avec le DOM)
        ├── ui.js                   (Chef d'orchestre global : init, langue, navigation)
        ├── students.js             (Gestion de l'onglet Élèves : liste, ajout, modif)
        ├── assignments.js          (Gestion de l'onglet Devoirs : création, tags)
        ├── grades.js               (Gestion de l'onglet Notes : saisie, grilles)
        ├── summary.js              (Gestion de l'onglet Récapitulatif : tableaux)
        ├── export.js               (Gestion de l'onglet Export : préparation, impression)
        ├── data-management.js      (Import/Export de sauvegardes JSON/Excel)
        │
        └── tabs\                   (Nouveau module Onglets v2)
            ├── tabs.controller.js  (Logique de navigation)
            └── tabs.styles.css     (Styles spécifiques aux onglets)
```

## 3. Rôle de Chaque Fichier (Détail)

### A. Le Squelette (`index.html`)
Il ne contient plus que :
*   La structure HTML statique (les `<div>` vides qui servent de conteneurs).
*   Les liens vers les bibliothèques externes (Tailwind, ExcelJS).
*   Les balises `<script type="module">` qui importent nos nouveaux fichiers JS.

### B. Le Cœur (`src/ui/ui.js`)
C'est le fichier principal qui initialise l'application.
*   Il lance le chargement des données.
*   Il gère le changement de langue.
*   Il appelle les fonctions d'initialisation des autres modules (ex: `initTabs()`).

### C. Les Modules UI (Interface)
Chaque onglet a désormais son propre fichier JS.
*   **`students.js`** : Gère l'ajout/suppression d'élèves, l'affichage de la liste (avatars, niveaux).
*   **`assignments.js`** : Gère la création de devoirs, les types (CC, Devoir, Compo), les tags.
*   **`grades.js`** : Gère l'interface de saisie des notes, les accordéons par classe.
*   **`summary.js`** : Gère le grand tableau récapitulatif (calcul des moyennes, tris).
*   **`export.js`** : Gère la page de préparation à l'exportation et la génération des fichiers Excel finaux.

### D. Les Services (`src/services/`)
Ce sont des fichiers "invisibles" qui font les calculs.
*   Ils ne touchent jamais au HTML.
*   Exemple : `grades.service.js` contient la formule pour calculer une moyenne pondérée. `grades.js` (UI) l'utilise pour afficher le résultat.

### E. Le Stockage (`src/storage/store.js`)
*   Centralise tout ce qui touche à `localStorage`.
*   Si demain vous voulez passer à une base de données, c'est le seul fichier à changer.

## 4. Avantages de cette structure
1.  **Clarté** : Si vous voulez modifier le comportement des "Devoirs", vous allez directement dans `assignments.js`. Pas besoin de chercher la ligne 4500 d'un fichier géant.
2.  **Travail d'équipe** : Plusieurs développeurs peuvent travailler sur des fichiers différents sans se gêner.
3.  **Réutilisabilité** : La logique de calcul (`services`) est séparée de l'affichage (`ui`), on peut donc réutiliser les calculs ailleurs (ex: dans l'export Excel) sans dupliquer le code.

C'est une architecture professionnelle standard pour des applications JavaScript modernes (sans Framework lourd comme React ou Vue).
