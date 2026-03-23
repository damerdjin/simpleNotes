<think>
**Preparing documentation files**

I need to create three deliverable documents: a user README, a technical README, and an FAQ/troubleshooting section. All these should be in markdown format with clear sections. I won't be making any future promises, and I'll aim to keep each document within 2000 tokens while ensuring they contain sufficient information.

The user README will cover version, installation, browser storage, backups, workflows, and limitations. The technical README will include architecture, data schema, functions, conventions, persistence, internationalization, import/export, known issues, and roadmap suggestions. I’ll also provide a changelog placeholder. Let's get started!
</think>Ci‑dessous, je te fournis 3 “livrables” prêts à copier/coller dans ton repo (format Markdown) :

- `README-UTILISATEUR.md`
- `README-TECHNIQUE.md`
- `FAQ-DEPANNAGE.md`

---

```markdown
<!-- =========================
     README-UTILISATEUR.md
========================= -->

# Gestion des Corrections — Guide Utilisateur

## 1) Objectif
**Gestion des Corrections** est une application web (utilisable dans un simple navigateur) qui permet de :
- gérer une liste d’élèves par classes,
- créer des devoirs (barème détaillé ou note globale),
- saisir des notes,
- consulter un récapitulatif,
- exporter le récap en Excel,
- sauvegarder/restaurer les données via JSON.

> Fonctionnement “hors ligne” : l’application stocke vos données dans le navigateur (localStorage).  
> Pour sécuriser vos données, exportez régulièrement un fichier JSON.

---

## 2) Démarrage rapide
1. Ouvrez le fichier `index.html` dans votre navigateur (Chrome/Edge recommandé).
2. Ajoutez des élèves (onglet **Élèves**).
3. Créez un devoir (onglet **Devoirs**).
4. Saisissez les notes (onglet **Notes**) ou directement dans le **Récapitulatif** (si détails activés).
5. Exportez :
   - **JSON** pour sauvegarde complète
   - **Excel** pour partage du récap

---

## 3) Langues (FR / EN / AR)
En haut de page :
- Cliquez sur **FR**, **EN** ou **AR**.
- En **AR**, l’interface passe en **RTL** (droite → gauche).
- La langue est mémorisée automatiquement.

---

## 4) Onglet 👥 Élèves

### 4.1 Ajouter un élève
1. Cliquez sur **+ Ajouter un élève**
2. Renseignez :
   - **Nom** et/ou **Prénom** (au moins un)
   - **Classe**
   - **NIN** (optionnel)
3. Cliquez sur **Ajouter**

### 4.2 Rechercher
Le champ de recherche filtre en direct sur : **nom, prénom, classe**.

### 4.3 Importer une liste d’élèves (Excel .xlsx/.xls)
1. Cliquez sur **Importer (.xlsx)**
2. Sélectionnez le fichier Excel

- L’import lit la première feuille.
- Il s’appuie sur des en-têtes (souvent en arabe) : NIN, nom, prénom, classe, etc.
- Les élèves sont **ajoutés** ou **mis à jour** si déjà existants (selon identifiants disponibles).

> Remarque : l’import peut détecter des colonnes “notes” dans le fichier, mais **ces notes ne sont pas automatiquement intégrées** au module Notes/Récapitulatif dans la version actuelle.

### 4.4 Importer / Exporter JSON
- **Exporter JSON** : télécharge une sauvegarde complète (élèves + devoirs + notes).
- **Importer (.json)** : fusionne des données depuis un fichier JSON.

**Conseil :** faites un export JSON après une grosse séance de saisie.

### 4.5 Gestion des classes
Les classes sont créées automatiquement à partir du champ **Classe** des élèves.

- Vous pouvez supprimer une classe via ✕.

⚠️ Attention : supprimer une classe supprime aussi :
- tous les élèves de cette classe,
- leurs notes enregistrées.

---

## 5) Onglet 📋 Devoirs

### 5.1 Créer un devoir
1. Cliquez sur **+ Créer un devoir**
2. Indiquez :
   - **Nom du devoir**
   - **Classe**
3. Choisissez le mode :
   - **Note globale uniquement** (sans exercices détaillés)
   - ou **mode détaillé** (exercices / questions / sous-questions)

### 5.2 Mode “Note globale uniquement”
- Activez **Note globale uniquement**
- Indiquez la **note maximale** (ex : 20)
- Enregistrez

Ce mode est idéal pour des évaluations simples (une seule note finale).

### 5.3 Mode détaillé (barème)
- Ajoutez un ou plusieurs **exercices**
- Dans chaque exercice :
  - ajoutez des **questions** directement
  - et/ou créez des **parties** contenant des questions
- Une question peut avoir :
  - soit des **points directs**
  - soit des **sous-questions** a), b), c) avec points (le total se calcule automatiquement)

### 5.4 Modifier / Dupliquer / Supprimer
Sur chaque devoir :
- ✏️ modifier
- ⎘ dupliquer
- 🗑️ supprimer

---

## 6) Onglet 🎯 Notes (saisie)

### 6.1 Étapes
1. Sélectionnez une **classe**
2. Sélectionnez un **devoir**
3. Sélectionnez un **élève**

### 6.2 Deux modes de saisie par exercice
Pour chaque exercice :
- **Mode détail (Σ)** : saisie question/sous-question
- **Mode global (★)** : saisie d’une **note finale** pour l’exercice

Règles :
- si une note globale d’exercice est saisie, la saisie détaillée est ignorée/désactivée,
- si vous ressaisissez des détails, la note globale est effacée (retour au mode détail).

---

## 7) Onglet 📊 Récapitulatif

### 7.1 Les 3 vues
- **Vue par défaut**
- **Vue 1**
- **Vue 2**

Ces vues présentent les mêmes données, avec des organisations/entêtes différentes.

### 7.2 Filtres
- Recherche (nom / classe)
- Filtre par classe
- Tags de devoirs (afficher uniquement certains devoirs)
- Option **Afficher les détails (exercices)**

### 7.3 Saisie rapide (quand “détails” est activé)
- Une colonne apparaît pour chaque exercice (Ex1, Ex2, …).
- Vous pouvez saisir une note directement dans le tableau.
- Appuyer sur **Entrée** valide et passe au champ suivant.

### 7.4 Export Excel
Bouton **Exporter Excel** :
- génère un fichier `.xlsx`
- crée une feuille par classe
- inclut les totaux par devoir

---

## 8) Données & sauvegarde (important)
- Vos données sont stockées dans votre navigateur.
- Si vous effacez les données du navigateur, vous pouvez perdre votre travail.
- Utilisez **Exporter JSON** comme sauvegarde.
```

---

```markdown
<!-- =========================
     README-TECHNIQUE.md
========================= -->

# Gestion des Corrections — Documentation Technique

## 1) Vue d’ensemble
Application web **vanilla JS** (sans backend) avec persistance via **localStorage**.

### Dépendances
- Tailwind (CDN) : UI / layout
- `xlsx` (CDN) : import/export Excel
- `exceljs` (CDN) : chargé (mais peu/pas utilisé dans le code actuel)
- `translations.js` : dictionnaire de traduction

---

## 2) Exécution
- Ouvrir `index.html` dans un navigateur moderne.
- Aucune compilation requise.

**Stockage :**
- `localStorage['corrections-data']` : store complet
- `localStorage['corrections-language']` : langue
- `localStorage['summary-assignment-order']` : ordre des devoirs dans le récap

---

## 3) Store & schéma de données

### 3.1 Store racine
```js
data = {
  students: [],
  assignments: [],
  grades: {}
}
```

### 3.2 Students
Exemple :
```json
{
  "id": "kz9...xyz",
  "name": "DUPONT Ali",
  "firstName": "Ali",
  "lastName": "DUPONT",
  "className": "3eme A",
  "nin": "123456",
  "sex": "M",
  "birthDate": "2008-05-02",
  "regNumber": "2024-001"
}
```

### 3.3 Assignments (devoirs)
```json
{
  "id": "a1",
  "name": "Devoir 1",
  "className": "3eme A",
  "exercises": [ /* exercise */ ]
}
```

**Exercise (exercice)**
- Deux cas :
  1) **Sans questions/parties** : note directe via `ex.maxPoints`
  2) **Structuré** : `questions[]` et/ou `parts[]`

```json
{
  "id": "ex1",
  "name": "Géométrie",
  "maxPoints": 0,
  "questions": [ /* question */ ],
  "parts": [ /* part */ ]
}
```

**Part**
```json
{ "id": "p1", "name": "Partie 1", "questions": [ /* question */ ] }
```

**Question**
- points directs OU sous-questions
```json
{
  "id": "q1",
  "name": "Q1",
  "maxPoints": 2,
  "subQuestions": [
    { "id": "sq1", "name": "a", "maxPoints": 1 },
    { "id": "sq2", "name": "b", "maxPoints": 1 }
  ]
}
```

### 3.4 Grades (notes)
Stockage imbriqué :
```js
data.grades[studentId][assignmentId][exId][partKey][qId][sqId] = number
```

Conventions clés :
- `partKey = 'direct'` → questions directes (hors parties)
- `partKey = part.id` → questions dans une partie
- Exercice sans questions/parties : `['direct']['direct']['direct']`
- Note finale d’exercice (mode global) : `['final']['final']['final']`
- `exGrades.mode = 'detail'|'global'` au niveau `data.grades[studentId][assignmentId][exId]`

---

## 4) Calculs de barèmes
Fonctions :
- `getQuestionMaxPoints(q)`
  - si sous-questions : somme de `sq.maxPoints`
  - sinon : `q.maxPoints`
- `getExerciseMaxPoints(ex)`
  - si aucune question/partie : `ex.maxPoints`
  - sinon : somme des questions directes + questions des parties
- `getAssignmentMaxPoints(assignment)` : somme des exercices

---

## 5) Modules UI (fonctions principales)

### 5.1 Navigation
- `showTab(tab)` : affiche l’onglet + déclenche rendu/chargements nécessaires

### 5.2 Élèves
- `renderStudents()` : affichage + recherche + refresh classes
- `renderClassList()` : classes dérivées de `students.className`
- `deleteClass(className)` : supprime élèves + notes associées

### 5.3 Devoirs
- `openAssignmentModal(assignmentId?)` : création/édition
- `saveAssignment()` : sauvegarde en mode global ou détaillé
- `renderAssignments()` : liste groupée par classe + accordéons

### 5.4 Notes
- `loadGradeSelectors()` : filtre devoirs/élèves selon classe sélectionnée
- `loadGradeEntry()` : construit l’UI d’un élève + devoir
- `updateGrade()` : écrit en store, gère le mode detail/global
- `setExerciseMode()` : bascule et efface/active la note finale
- `recalculateTotals()` : calcule et met à jour totaux UI

### 5.5 Récapitulatif
- `renderSummary()` → `renderSummary0/1/2()` selon `currentSummaryMode`
- `toggleSummarySort(key)` : tri
- `summaryAssignmentFilter` : Set des devoirs affichés
- ordre colonnes devoirs : `window.summaryAssignmentOrder`

Saisie rapide :
- `sanitizeAndClamp()` normalise les entrées
- `commitSummaryInput()` enregistre note finale d’exercice
- `updateSummaryTotalsInline()` met à jour la cellule total du devoir

---

## 6) i18n / RTL
- langue : `currentLanguage`
- RTL si `currentLanguage === 'ar'`
- `applyLanguage()` applique `dir` + classe CSS + traduction + re-render
- `translatePage()` :
  - traduit `[data-translate]`
  - + traduction via sélecteurs ciblés

⚠️ Dette technique connue :
- certaines traductions ciblent `.modal button:first-child` → risque de viser la mauvaise modale si plusieurs sont présentes.
- CSS RTL contient des règles redondantes/contradictoires (ordre + `!important`).

---

## 7) Import / Export

### 7.1 Export JSON
- dump complet du store `data`.

### 7.2 Import JSON (fusion)
- fusion élèves principalement via NIN
- transfert notes si ID importé différent
- ajoute devoirs inconnus

### 7.3 Import Excel élèves
- lit première feuille, headers sur une ligne fixe (actuellement ligne 2)
- cherche des colonnes arabes
- peut capturer des “colonnes notes” → stockées dans `student.grades`

⚠️ Point important :
- le moteur de notes (UI Notes / Récap) exploite `data.grades`, pas `student.grades`.  
  Donc les “notes” importées depuis Excel ne sont pas visibles tant qu’une conversion n’est pas implémentée.

### 7.4 Export Excel récap
- 1 feuille par classe
- colonnes base (arabe) + devoirs
- notes via `getStudentAssignmentTotal(studentId, assignmentId)`

---

## 8) Limitations connues (à considérer avant refactor)
- Persistance : localStorage (pas multi-poste, pas multi-user)
- Volumétrie : gros récap peut devenir lourd (DOM string + re-renders)
- Traduction : sélecteurs CSS trop génériques
- RTL : surcharges multiples, fragiles
- Import Excel : structure “notes” non intégrée au store principal `data.grades`

---

## 9) Recommandations de maintenance (sans changer les features)
- Ajouter `data.schemaVersion` + migrations à l’import JSON
- Centraliser la construction des clés/paths de notes (helpers)
- Réduire le couplage rendu ↔ traduction (IDs stables)
- Normaliser le RTL (moins de règles globales sur `.flex`, privilégier des classes ciblées)
```

---

```markdown
<!-- =========================
     FAQ-DEPANNAGE.md
========================= -->

# FAQ & Dépannage — Gestion des Corrections

## Données / sauvegarde

### J’ai perdu toutes mes données
Cause probable : suppression des données du navigateur (cache/stockage) ou utilisation d’un autre navigateur/PC.

✅ Solutions :
- Importez votre dernière sauvegarde via **Importer (.json)** si vous en avez une.
- À l’avenir : faites des exports JSON réguliers.

### Puis-je utiliser l’application sur plusieurs PC ?
Oui, mais il faut **Exporter JSON** sur le PC A puis **Importer JSON** sur le PC B.

---

## Import Excel

### L’import Excel n’ajoute rien
Vérifiez :
- vous avez sélectionné la bonne feuille (l’app prend la **première**),
- le fichier n’est pas vide,
- les en-têtes attendus existent (souvent en arabe),
- le fichier n’a pas de lignes “titre” supplémentaires qui décalent les en-têtes.

### J’ai des colonnes de notes dans l’Excel mais elles n’apparaissent pas dans le Récap
C’est une limite de la version actuelle :
- l’import Excel peut stocker des notes dans `student.grades`,
- mais l’application calcule/affiche les notes depuis `data.grades`.

➡️ Solution recommandée : saisir/importer les notes via JSON (ou implémenter une conversion `student.grades -> data.grades`).

---

## Notes / récapitulatif

### Je ne peux plus saisir les détails (questions), tout est grisé
Cause : vous êtes en **mode global (★)** sur l’exercice, avec une note finale saisie.

✅ Solution :
- repassez l’exercice en **mode détail (Σ)**, ou
- effacez la note globale de l’exercice.

### Les totaux ne correspondent pas
Vérifiez :
- si une **note globale d’exercice** est saisie, elle **remplace** tous les détails,
- si l’exercice n’a **aucune question/partie**, la note se fait via une entrée directe (exercice simple),
- les maxPoints des sous-questions définissent le total d’une question.

---

## Classes

### J’ai supprimé une classe et tout a disparu
C’est le comportement prévu :
- supprimer une classe supprime les élèves de la classe **et** leurs notes.

✅ Recommandation :
- faire un export JSON avant des suppressions massives.

---

## Export Excel

### Le fichier Excel est vide ou incomplet
Vérifiez :
- vous avez au moins 1 élève et 1 devoir dans les filtres actifs,
- les filtres (classe / recherche / tags) ne masquent pas tout.

---

## Langue / affichage

### L’arabe (RTL) casse certains alignements
Le RTL est supporté mais certaines zones peuvent être sensibles selon contenu/écran.
➡️ Remontée utile : capture + section concernée (Élèves / Devoirs / Notes / Récap).
```

---

Si tu veux, je peux aussi te fournir une **version “prête à imprimer”** (PDF-friendly) en restructurant ces docs avec une page de garde + sommaire, ou encore ajouter une section **“Procédures”** (ex : “workflow de correction recommandé”) adaptée à ton usage réel.