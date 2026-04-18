# Documentation : Verrouillage Automatique des Trimestres (Trimester Lock)

## 🎯 Objectif de la fonctionnalité
Empêcher automatiquement la modification des notes et des devoirs appartenant à des trimestres antérieurs, en se basant sur la date système (horloge du navigateur).

## 🧠 Fonctionnement (La Logique Temporelle)
Le système déduit le "trimestre actuel officiel" selon la date du jour :
- **T2 :** du 01 Janvier au 31 Mars
- **T3 :** du 01 Avril au 30 Juin
- **Période de Vacances (01 Juillet - 31 Août) :** TOUS les trimestres sont bloqués par défaut.
- **T1 :** du 01 Septembre au 31 Décembre

Tout devoir (ou note liée à ce devoir) dont le trimestre est **inférieur** au trimestre déduit ci-dessus, ou dont l'année scolaire est **antérieure** à l'année scolaire actuelle, est considéré comme **Vérrouillé**.

---

## 🚨 LA SOLUTION D'URGENCE (Le "Kill Switch")
Si cette fonctionnalité crée des bugs bloquants dans le futur et que vous n'avez pas le temps de les corriger, **NE FAITES PAS de "git revert"** (vous perdriez vos autres travaux). 

Il suffit de désactiver le cerveau de cette fonctionnalité en **1 seule ligne de code**.

Ouvrez le fichier `src/ui/ui.js`, trouvez la fonction `window.isTrimesterBlocked` (vers la ligne 610) et modifiez-la comme ceci :

```javascript
window.isTrimesterBlocked = function(trimester, year) {
    // 🔴 KILL SWITCH : Décommenter la ligne ci-dessous pour TOUT débloquer
    return false; 

    // ... le reste du code reste intact en dessous ...
    if (window.allowPreviousTrimestersEdit) return false;
    // ...
};
```
*En forçant la fonction à retourner `false`, le système croira que rien n'est jamais bloqué. Le reste de l'UI (boutons grisés, etc.) se réactivera automatiquement.*

---

## 📂 Détail des modifications par fichier

Au cas où vous ayez besoin d'intervenir sur une partie spécifique, voici l'inventaire exact de ce qui a été modifié :

### 1. Le Cerveau : `src/ui/ui.js`
- **`window.isTrimesterBlocked`** : Modifiée pour intégrer la logique basée sur la date stricte (remplace l'ancien système de "Peak Session").
- **`setGlobalAcademicYear` & `setGlobalTrimester`** : Nettoyées du code concernant l'ancien "Peak Session".

### 2. Saisie des Notes : `src/ui/grades.js`
- **`window.updateGrade`** : Ajout d'une vérification : si `isTrimesterBlocked` est VRAI, la fonction s'arrête (`return`) et n'enregistre rien.

### 3. Création/Modification des Devoirs : `src/ui/assignments.js`
- **Interface UI** : Ajout d'un menu déroulant `<select id="assignment-trimester">` dans la modale de devoir pour forcer l'attribution d'un trimestre.
- **`window.openAssignmentModal`** : 
    - Calcul de la variable `isBlocked`.
    - Si `isBlocked` est VRAI : le bouton "Enregistrer" est grisé (`disabled`) et une alerte "Trimestre verrouillé" apparaît dans la modale.
- **`window.saveAssignment`** : Vérification de sécurité lors de la sauvegarde (bloque la sauvegarde si le trimestre devient un trimestre passé).

### 4. L'onglet Récapitulatif : `src/ui/summary.js`
- **Saisie des exercices (`<input>`)** : Ajout de l'attribut `disabled` et d'une opacité (`opacity-50`) lors de la génération du tableau (`renderSummary0`, `1`, `2`, `Mobile`) si le devoir est bloqué.
- **Totaux des devoirs** : Conditionnement de l'attribut `ondblclick`. Le double-clic n'est ajouté que si le devoir n'est PAS bloqué.
- **Sécurité serveur/sauvegarde** : Ajout de la vérification `isTrimesterBlocked` au début des fonctions `window.makeTotalEditable`, `window.setGlobalAssignmentGrade`, et `window.applyExerciseFinalGrade`.

### 5. Logique des Paramètres : `src/ui/data-management.js`
- **`window.handleAllowPreviousTrimestersChange`** : Ajout de cette fonction pour gérer le basculement du mode "Déblocage temporaire". Elle met à jour la variable globale et force le rafraîchissement des vues (Devoirs et Notes) pour appliquer le changement immédiatement.
- **Synchronisation initiale** : Ajout d'un écouteur pour s'assurer que la case à cocher dans l'onglet Configuration reflète bien l'état de la variable au chargement.

### 6. Configuration (Bouton Bypass) : `index.html`
- **Suppression** : Du bouton "Réinitialiser le verrouillage" (devenu obsolète grâce à la logique de date).
- **Ajout** : Toggle "Autoriser temporairement les modifications".
- **Comportement** : La variable `window.allowPreviousTrimestersEdit` est liée à la session navigateur. Elle redevient `false` à chaque rechargement de page (`F5`).

### 7. Textes & Traductions : `translations.js`
- Ajout des clés : `allowPreviousTrimestersEdit`, `allowPreviousTrimestersEditDesc`, `assignmentTrimesterLabel`, `lockedLabel`, `trimesterLockedAlert`.
- Suppression des clés liées au Peak Session (`resetTrimesterPeak`, etc.).

---

## 💡 Que faire en cas de problème ciblé ?

1. **Un bouton reste grisé alors qu'il ne devrait pas ?**
   C'est sûrement lié à la date du système ou à la déduction T1/T2/T3. Le Kill Switch (`ui.js -> isTrimesterBlocked return false`) résoudra le blocage immédiatement.

2. **Les notes peuvent-elles être modifiées dans le Récapitulatif ?**
   - [x] Bloquer les modifications dans l'onglet Récapitulatif
    - [x] Mettre à jour `renderSummary0`, `renderSummary1`, `renderSummary2`
    - [x] Mettre à jour `renderSummaryMobile`
    - [x] Sécuriser `makeTotalEditable` et les fonctions de sauvegarde
   - [x] Ajouter des cadenas (🔒) sur les éléments bloqués
    - [x] Sélecteur de session (Trimesters et Années)
    - [x] En-têtes du Récapitulatif
    - [x] Liste des devoirs
   - [x] Mettre à jour la logique de dates (T3 finit le 30/06)
   - [x] Vérifier le bon fonctionnement global
   Vérifiez `src/ui/summary.js`. Cherchez `isBlocked` dans les fonctions `renderSummary` pour voir si la logique d'injection du `disabled` sur l'input HTML n'a pas été effacée par mégarde.

3. **L'override temporaire ("Autoriser...") ne marche plus ?**
   Assurez-vous que l'input dans `index.html` (id: `config-allow-prev-trimesters`) appelle bien la fonction `window.handleAllowPreviousTrimestersChange` et que celle-ci bascule la variable globale `window.allowPreviousTrimestersEdit`.
