# Plan d'Harmonisation des Panneaux (Page Panels)

> **Objectif** : Uniformiser le style du panneau blanc (conteneur principal) sur toutes les pages de l'application, et centraliser son style CSS pour permettre des changements globaux en une seule modification.

---

## 1. Problème

Actuellement, chaque page de l'application a un panneau blanc (le conteneur principal qui encadre le contenu) avec un style **différent** :

| Page | Largeur max | Border radius | Shadow | Border | Padding |
|------|-------------|---------------|--------|--------|---------|
| Élèves | `max-w-7xl` | `rounded-2xl` | `shadow-sm` | `border-slate-200` | `p-4 sm:p-8` |
| Devoirs | `max-w-7xl` | `rounded-2xl` | `shadow-sm` | `border-slate-200` | `p-4 sm:p-8` |
| Notes | `max-w-7xl` | `rounded-2xl sm:rounded-3xl` | `sm:shadow-sm` | `sm:border` | `p-4 sm:p-8` |
| Récapitulatif | `aucun` | `rounded-2xl sm:rounded-xl` | `sm:shadow-lg` | `sm:border-0` | `p-4 sm:p-6` |
| Export | `max-w-6xl` | `rounded-2xl sm:rounded-xl` | `sm:shadow-lg` | `sm:border-0` | `p-4 sm:p-6` |
| **Dashboard** | `max-w-7xl` | **AUCUN PANEL** | — | — | — |
| Configuration | `max-w-4xl` | `rounded-xl` | `shadow-lg` | `aucune` | `p-8` |

On voit clairement que :
- Le Dashboard **n'a même pas de panneau blanc** — le contenu flotte directement dans le container.
- Notes, Récapitulatif, Export ont des variants `sm:rounded-3xl`, `sm:rounded-xl`, `sm:shadow-lg`, `sm:border-0` qui diffèrent.
- Config a un `max-w-4xl` plus étroit, pas de responsive padding, pas de border.
- Le style est **dupliqué en dur** dans chaque `class="..."` HTML — aucun moyen de tout changer d'un coup.

---

## 2. Solution

Créer **deux classes CSS centralisées** dans le bloc `<style>` de `index.html` :

- **`.page-panel`** — le panneau blanc (fond, border-radius, shadow, border, padding responsive)
- **`.page-container`** — l'enveloppe externe qui centre et limite la largeur

Ces classes seront appliquées sur **toutes** les pages. Pour changer le style global, il suffira de modifier ces deux définitions CSS.

---

## 3. Code CSS à ajouter

### 3.1 Emplacement

Dans le bloc `<style>` principal de [index.html](file:///c:/Users/HomePC/Documents/DEV/simpleNotes/index.html), **juste après les variables `:root`** (après la ligne ~1070), ou dans la section `/* ===== MODALES & UI ===== */` (vers la ligne ~1720), ajouter :

```css
/* ===== PAGE PANEL — Style de conteneur unifié pour toutes les pages ===== */

/* Conteneur externe : centre et limite la largeur */
.page-container {
    width: 100%;
    max-width: 80rem;            /* max-w-7xl = 1280px */
    margin-left: auto;
    margin-right: auto;
    padding-left: 1rem;          /* px-4 */
    padding-right: 1rem;
}

/* Conteneur externe étroit (Config, éventuelles pages futures) */
.page-container-sm {
    width: 100%;
    max-width: 56rem;            /* max-w-4xl = 896px */
    margin-left: auto;
    margin-right: auto;
    padding-left: 1rem;
    padding-right: 1rem;
}

/* Panneau blanc principal */
.page-panel {
    background: white;
    border-radius: 1.5rem;       /* rounded-2xl */
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);  /* shadow-sm */
    border: 1px solid #e2e8f0;   /* border-slate-200 */
    padding: 1rem;               /* p-4 */
}

@media (min-width: 640px) {
    .page-panel {
        padding: 2rem;           /* sm:p-8 */
    }
}

/* Dark mode */
[data-theme="dark"] .page-panel {
    background-color: var(--bg-card);
    border-color: #334155;
}

[data-theme="dark"] .page-panel .text-slate-800,
[data-theme="dark"] .page-panel .text-gray-800,
[data-theme="dark"] .page-panel .text-slate-700 {
    color: #f1f5f9;
}
```

---

## 4. Walkthrough — Modifications page par page

### 4.1 Page Dashboard ([index.html#L2790](file:///c:/Users/HomePC/Documents/DEV/simpleNotes/index.html#L2790))

**Problème** : Aucun panneau blanc, le contenu commence directement dans le `<div class="container ...">`.

**Correction** : Ajouter un `<div class="page-panel">` autour du contenu.

```
AVANT (ligne ~2790) :
<div id="content-dashboard" class="tab-content view-section">
    <div class="container mx-auto px-4 max-w-7xl">
        <!-- Dashboard Header -->
        <div class="flex flex-col sm:flex-row ...">
        ...
        </div>
    </div>
    <style>...</style>
</div>

APRÈS :
<div id="content-dashboard" class="tab-content view-section">
    <div class="page-container">
        <div class="page-panel">
            <!-- Dashboard Header -->
            <div class="flex flex-col sm:flex-row ...">
            ...
            </div>
        </div>
    </div>
    <style>...</style>
</div>
```

> ⚠️ Le `<style>` interne de Dashboard contient des sélecteurs `#content-dashboard .bg-white` (lignes 2872-2876) et `#content-dashboard .container` (ligne 2853) — à vérifier après modification.

---

### 4.2 Page Élèves / Students ([index.html#L2270](file:///c:/Users/HomePC/Documents/DEV/simpleNotes/index.html#L2270))

Deux vues à corriger :

**Vue 1 — Classes (ligne ~2272)** :
```
AVANT :  <div id="students-view-classes" class="container mx-auto max-w-7xl ...">
             <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-8">
APRÈS :  <div id="students-view-classes" class="page-container ...">
             <div class="page-panel">
```

**Vue 2 — Liste élèves (ligne ~2315)** :
```
AVANT :  <div id="students-view-list" class="hidden container mx-auto max-w-7xl ...">
             <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-8">
APRÈS :  <div id="students-view-list" class="hidden page-container ...">
             <div class="page-panel">
```

---

### 4.3 Page Devoirs / Assignments ([index.html#L2384](file:///c:/Users/HomePC/Documents/DEV/simpleNotes/index.html#L2384))

Deux vues à corriger :

**Vue 1 — Classes (ligne ~2387)** :
```
AVANT :  <div id="assignments-view-classes" class="container mx-auto max-w-7xl ...">
             <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-8">
APRÈS :  <div id="assignments-view-classes" class="page-container ...">
             <div class="page-panel">
```

**Vue 2 — Liste devoirs (ligne ~2425)** :
```
AVANT :  <div id="assignments-view-list" class="hidden container mx-auto max-w-7xl ...">
             <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-8">
APRÈS :  <div id="assignments-view-list" class="hidden page-container ...">
             <div class="page-panel">
```

---

### 4.4 Page Notes / Grades ([index.html#L2461](file:///c:/Users/HomePC/Documents/DEV/simpleNotes/index.html#L2461))

**Problème** : Pas de conteneur externe, le panneau a des classes différentes (`sm:rounded-3xl sm:border`).

**Correction** :

```
AVANT (ligne ~2462) :
<div id="content-grades" class="tab-content view-section">
    <div class="max-w-7xl mx-auto">
        <div class="space-y-6 sm:space-y-8 bg-white sm:p-8 p-4 rounded-2xl sm:rounded-3xl sm:border border-slate-200 sm:shadow-sm">

APRÈS :
<div id="content-grades" class="tab-content view-section">
    <div class="page-container">
        <div class="space-y-6 sm:space-y-8 page-panel">
```

---

### 4.5 Page Récapitulatif / Summary ([index.html#L2572](file:///c:/Users/HomePC/Documents/DEV/simpleNotes/index.html#L2572))

**Problème** : Pas de conteneur externe, classes différentes (`sm:rounded-xl sm:shadow-lg sm:border-0 sm:p-6`).

**Correction** :

```
AVANT (ligne ~2573) :
<div id="content-summary" class="tab-content view-section min-w-0">
    <div class="bg-white rounded-2xl sm:rounded-xl shadow-sm sm:shadow-lg border sm:border-0 border-slate-200 p-4 sm:p-6 min-w-0">

APRÈS :
<div id="content-summary" class="tab-content view-section min-w-0">
    <div class="page-container">
        <div class="page-panel min-w-0">
```

> ⚠️ Conserver `min-w-0` sur le panel pour éviter les débordements de tableaux.

> ⚠️ Le `<style>` après Summary (lignes 2631-2632) référence `#content-summary > .bg-white` — à adapter.

---

### 4.6 Page Export ([index.html#L2699](file:///c:/Users/HomePC/Documents/DEV/simpleNotes/index.html#L2699))

**Problème** : Largeur `max-w-6xl` plus étroite que les autres, classes différentes.

**Correction** :

```
AVANT (ligne ~2700) :
<div id="content-export" class="tab-content view-section">
    <div class="container mx-auto px-4 max-w-6xl">
        <div class="bg-white rounded-2xl sm:rounded-xl shadow-sm sm:shadow-lg border sm:border-0 border-slate-200 p-4 sm:p-6 min-w-0">

APRÈS :
<div id="content-export" class="tab-content view-section">
    <div class="page-container">
        <div class="page-panel min-w-0">
```

---

### 4.7 Page Configuration ([index.html#L2933](file:///c:/Users/HomePC/Documents/DEV/simpleNotes/index.html#L2933))

**Problème** : Largeur `max-w-4xl` plus étroite, pas de border, `p-8` non responsive.

**Correction** :

```
AVANT (ligne ~2934) :
<div id="content-config" class="tab-content view-section">
    <div class="container mx-auto px-4 max-w-4xl">
        <div class="bg-white rounded-xl shadow-lg p-8">

APRÈS :
<div id="content-config" class="tab-content view-section">
    <div class="page-container-sm">
        <div class="page-panel">
```

> On utilise `page-container-sm` (max-w-4xl = 896px) pour garder la page Config volontairement plus étroite.

---

## 5. Checklist des tâches

### Phase A — Ajout du CSS centralisé

- [ ] **A1.** Ajouter les classes `.page-container`, `.page-container-sm`, `.page-panel` dans le `<style>` de [index.html](file:///c:/Users/HomePC/Documents/DEV/simpleNotes/index.html) (insérer après les `:root` variables, vers la ligne 1070)

### Phase B — Remplacement sur chaque page

- [ ] **B1.** [Dashboard L2790-L2929](file:///c:/Users/HomePC/Documents/DEV/simpleNotes/index.html#L2790) : Ajouter `.page-panel` + `.page-container`, vérifier les sélecteurs `#content-dashboard .bg-white` dans le `<style>` interne
- [ ] **B2.** [Students L2270-L2382](file:///c:/Users/HomePC/Documents/DEV/simpleNotes/index.html#L2270) : `container mx-auto max-w-7xl` → `page-container`, `bg-white rounded-2xl ...` → `page-panel` (×2 vues)
- [ ] **B3.** [Assignments L2384-L2459](file:///c:/Users/HomePC/Documents/DEV/simpleNotes/index.html#L2384) : Même chose (×2 vues)
- [ ] **B4.** [Grades L2461-L2570](file:///c:/Users/HomePC/Documents/DEV/simpleNotes/index.html#L2461) : Ajouter `.page-container`, remplacer les classes du panneau par `page-panel`
- [ ] **B5.** [Summary L2572-L2698](file:///c:/Users/HomePC/Documents/DEV/simpleNotes/index.html#L2572) : Ajouter `.page-container`, remplacer les classes du panneau, adapter le `<style>` interne
- [ ] **B6.** [Export L2699-L2788](file:///c:/Users/HomePC/Documents/DEV/simpleNotes/index.html#L2699) : Remplacer `container mx-auto px-4 max-w-6xl` → `page-container`, remplacer les classes du panneau
- [ ] **B7.** [Config L2933-L2999](file:///c:/Users/HomePC/Documents/DEV/simpleNotes/index.html#L2933) : Remplacer `container mx-auto px-4 max-w-4xl` → `page-container-sm`, remplacer les classes du panneau

### Phase C — Vérification

- [ ] **C1.** Vérifier le dark mode : basculer le thème et inspecter toutes les pages
- [ ] **C2.** Vérifier le RTL (arabe) : basculer la langue en arabe et inspecter toutes les pages
- [ ] **C3.** Vérifier le responsive mobile : inspecter toutes les pages en largeur 375px et 768px
- [ ] **C4.** Vérifier les `<style>` internes qui référencent les anciennes classes (Dashboard, Summary)
- [ ] **C5.** Nettoyer les classes Tailwind inutilisées qui traînent (optionnel — build final)

---

## 6. Notes importantes

1. **Ne pas modifier le `padding: 24px` de `.view-section`** — il reste nécessaire pour l'espacement global des onglets.
2. **Conserver `min-w-0`** sur les pages Summary et Export — il empêche les tableaux de déborder.
3. **Les `<style>` internes** de Dashboard (lignes 2843-2929) et Summary (lignes 2625-2698) contiennent des références à `#content-dashboard .bg-white` et `#content-summary > .bg-white` qui devront être adaptées après le changement de classes.
4. **Préserver les classes d'animation** (`animate-in fade-in`, `slide-in-from-right`) sur les conteneurs de vue — elles ne sont pas liées au style du panneau.
5. **Les animations/keyframes** restent dans leurs `<style>` respectifs, on ne les déplace pas.

---

## 7. Résultat après implémentation

Toutes les pages auront :
- Un **conteneur externe** `.page-container` (ou `.page-container-sm` pour Config) qui centre et limite la largeur
- Un **panneau blanc** `.page-panel` identique partout : même `border-radius`, même `shadow`, même `border`, même `padding` responsive
- **Un seul endroit à modifier** (la définition de `.page-panel`) pour changer le style de tous les panneaux simultanément
