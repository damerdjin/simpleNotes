# Documentation Complete - SimpleNotes

> Analyse architecturale, cartographie des donnees et proposition de dashboard administratif
> Derniere mise a jour : Juin 2025

---

## Table des Matieres

1. [Vue d'ensemble de l'application](#1-vue-densemble-de-lapplication)
2. [Architecture technique](#2-architecture-technique)
3. [Cartographie des donnees](#3-cartographie-des-donnees)
4. [Relations entre entites](#4-relations-entre-entites)
5. [Workflows metiers](#5-workflows-metiers)
6. [Types de devoirs et parametres](#6-types-de-devoirs-et-parametres)
7. [Modele de donnees local (JSON Blob)](#7-modele-de-donnees-local-json-blob)
8. [Synchronisation et stockage](#8-synchronisation-et-stockage)
9. [Fonctions RPC Supabase](#9-fonctions-rpc-supabase)
10. [Securite et politiques RLS](#10-securite-et-politiques-rls)
11. [Anomalies et risques identifies](#11-anomalies-et-risques-identifies)
12. [Proposition de Dashboard Administratif](#12-proposition-de-dashboard-administratif)
13. [Annexes techniques](#13-annexes-techniques)

---

## 1. Vue d'ensemble de l'application

**SimpleNotes** est une application de gestion de notes scolaire destinee aux enseignants algeriens. Elle permet :

- La selection de classes parmi une liste disponible (par ecole/lycee)
- La creation de differents types de devoirs (Devoir, CC, TP, Composition) avec des parametres specifiques selon le type
- La saisie de notes par eleve, par exercice/question ou note globale
- Le calcul automatique des moyennes une fois que toutes les notes sont saisies
- L'export des resultats (format Excel/bulletin)
- La publication des moyennes pour les eleves (dashboard eleve)
- La collaboration entre enseignants d'un meme lycee (classes partagees)

**Stack technique :**
- **Frontend :** HTML/CSS/JS vanilla (pas de framework), TailwindCSS, Vite
- **Backend :** Serverless (Vercel), API Node.js
- **Base de donnees :** Supabase (PostgreSQL + Auth + RLS)
- **Stockage :** Hybride (LocalStorage + Supabase JSON Blob + Tables relationnelles)
- **Internationalisation :** Francais / Arabe (RTL supporte)

---

## 2. Architecture technique

```
+-------------------------------------------------------------------+
|                    ARCHITECTURE SIMPLENOTES                         |
+-------------------------------------------------------------------+
|                                                                     |
|  +---------------+     +---------------+     +------------------+   |
|  |  index.html   |     | login.html    |     | student-         |   |
|  |  (App princi) |     | (Auth)        |     | dashboard.html   |   |
|  +------+--------+     +------+--------+     +--------+---------+   |
|         |                     |                        |             |
|  +------+----------------------------------------------+---------+   |
|  |                    COUCHE UI (src/ui/)                          |   |
|  |  assignments.js | grades.js | summary.js | export.js           |   |
|  |  students.js    | auth.js   | data-mgmt  | i18n.js            |   |
|  |  student-import-wizard.js  |  ui.js  |  config.js             |   |
|  +------------------------------+--------------------------------+   |
|                                  |                                   |
|  +-------------------------------+--------------------------------+   |
|  |                 COUCHE SERVICES (src/services/)                |   |
|  |  assignments.service.js | grades.service.js                   |   |
|  |  history.service.js     | relational-sync.service.js          |   |
|  +-------------------------------+--------------------------------+   |
|                                   |                                 |
|  +--------------------------------+--------------------------------+  |
|  |                COUCHE STOCKAGE (src/storage/)                  |  |
|  |  store.js (orchestrateur)                                       |  |
|  |    +-- localStorage.adapter.js  (cache local)                  |  |
|  |    +-- supabase.adapter.js      (blob JSON + collaboration)    |  |
|  |    +-- settings.adapter.js      (preferences utilisateur)      |  |
|  +--------------------------------+--------------------------------+  |
|                                    |                                 |
|  +---------------------------------+-------------------------------+  |
|  |                   API VERCEL (api/)                             |  |
|  |  auth/ (login, register, refresh, logout, me)                  |  |
|  |  student/ (grades, login, logout, change-password)             |  |
|  |  schools/ | communes/ | wilayas/                               |  |
|  |  _lib/ (csrf, errorHandler, supabase, utils)                   |  |
|  +--------------------------------+--------------------------------+  |
|                                    |                                 |
|  +---------------------------------+-------------------------------+  |
|  |                     SUPABASE (PostgreSQL)                       |  |
|  |  Auth | RLS | RPC | Realtime | Storage                        |  |
|  +----------------------------------------------------------------+  |
+-------------------------------------------------------------------+
```

### Fichiers principaux et leur role

| Fichier | Lignes | Role |
|---------|--------|------|
| `index.html` | ~158KB | Application principale (tous les onglets enseignant) |
| `src/ui/assignments.js` | ~1727 | Gestion des devoirs (CRUD, modal, exercices) |
| `src/ui/grades.js` | ~958 | Saisie des notes par eleve/devoir |
| `src/ui/summary.js` | ~2128 | Recapitulatif et tableau de notes |
| `src/ui/export.js` | ~1954 | Preparation export, calcul moyennes, config |
| `src/ui/students.js` | ~940 | Gestion des eleves |
| `src/ui/data-management.js` | ~383 | Import/export de donnees |
| `src/ui/student-import-wizard.js` | ~219 | Import eleves depuis Excel |
| `src/ui/auth.js` | ~70 | Authentification |
| `src/ui/i18n.js` | ~26 | Internationalisation |
| `translations.js` | ~69KB | Traductions FR/AR |
| `remarks.engine.js` | ~4.7KB | Moteur d'observations/conseils automatiques |
| `remarks.messages.js` | ~46.5KB | Messages d'observations/conseils |
| `student-dashboard.html` | ~74KB | Interface eleve |

---

## 3. Cartographie des donnees

### 3.1 Entites principales (Tables Supabase)

#### `auth.users` (Fourni par Supabase)
- **Cle primaire :** `id` (uuid)
- **Metadonnees :** `email`, `user_metadata.school_id`, `user_metadata.full_name`
- **Role :** Authentification et identification des enseignants

#### `corrections_data` -- Stockage Blob JSON
```sql
user_id       uuid    NOT NULL  REFERENCES auth.users(id)
academic_year text    NOT NULL
data          jsonb   NOT NULL  DEFAULT '{}'
updated_at    timestamptz
PRIMARY KEY (user_id, academic_year)
```
- **Role :** Stockage principal des donnees applicatives (students, assignments, grades) sous forme de blob JSON
- **Un enregistrement =** toutes les donnees d'un enseignant pour une annee scolaire

#### `user_settings` -- Preferences utilisateur
```sql
user_id               uuid    NOT NULL  PRIMARY KEY
language              text    DEFAULT 'fr'
current_academic_year text
current_trimester     text
updated_at            timestamptz
```

#### `classes` -- Classes du lycee
```sql
id            uuid    DEFAULT gen_random_uuid()  PRIMARY KEY
school_id     uuid    NOT NULL
academic_year text    NOT NULL
name          text    NOT NULL
created_at    timestamptz
updated_at    timestamptz
UNIQUE (school_id, academic_year, name)
```

#### `teacher_classes` -- Abonnements enseignants aux classes
```sql
id         uuid    DEFAULT gen_random_uuid()  PRIMARY KEY
user_id    uuid    NOT NULL  REFERENCES auth.users(id)
class_id   uuid    NOT NULL  REFERENCES classes(id)
created_at timestamptz
UNIQUE (user_id, class_id)
```

#### `students` -- Eleves
```sql
id                  text    NOT NULL  PRIMARY KEY  -- Genere par le JS (ex: "5x8j9k2l")
user_id             uuid    NOT NULL  REFERENCES auth.users(id)
school_id           uuid
academic_year       text    NOT NULL
first_name          text
last_name           text
nin                 text                          -- Numero d'identification national
reg_number          text                          -- Numero de matricule
birthdate           text
class_name          text    NOT NULL
sex                 text    CHECK (sex IN ('M', 'F'))
status              text    DEFAULT 'active'  CHECK (status IN ('active', 'archived'))
is_official         boolean DEFAULT false           -- Importe (Excel) vs manuel
custom_password     text                          -- Mot de passe personnalise eleve
created_at          timestamptz
updated_at          timestamptz
```

#### `assignments` -- Devoirs
```sql
id            text    NOT NULL  PRIMARY KEY
user_id       uuid    NOT NULL  REFERENCES auth.users(id)
academic_year text    NOT NULL
name          text    NOT NULL
class_name    text    NOT NULL
trimester     text
subject       text
type          text    DEFAULT 'devoir'            -- devoir | cc | tp | comp
grade_date    timestamptz
is_visible    boolean DEFAULT false                -- Visible par les eleves
config        jsonb   NOT NULL DEFAULT '{}'        -- Exercices, questions, bareme
created_at    timestamptz
updated_at    timestamptz
```

**Structure du champ `config` (JSONB) :**
```json
{
  "exercises": [
    {
      "id": "ex1",
      "name": "Exercice 1",
      "maxPoints": 20,
      "defaultGrade": "",
      "questions": [
        {
          "id": "q1",
          "maxPoints": 5,
          "subQuestions": [
            { "id": "sq1", "maxPoints": 2 },
            { "id": "sq2", "maxPoints": 3 }
          ]
        }
      ],
      "parts": [
        {
          "id": "part1",
          "name": "Partie A",
          "questions": [
            { "id": "pq1", "maxPoints": 4 }
          ]
        }
      ]
    }
  ]
}
```

#### `grades` -- Notes
```sql
id            uuid    DEFAULT gen_random_uuid()  PRIMARY KEY
user_id       uuid    NOT NULL  REFERENCES auth.users(id)
student_id    text    NOT NULL  REFERENCES students(id)
assignment_id text    NOT NULL  REFERENCES assignments(id)
score_final   numeric                          -- Score total calcule
score_max     numeric                          -- Score maximum possible
score_details jsonb                             -- Details bruts de la saisie
comments      text
updated_at    timestamptz
UNIQUE (student_id, assignment_id)
```

**Structure du champ `score_details` (JSONB) :**
```json
{
  "global": 15.5,
  "ex1": {
    "direct": {
      "q1": { "direct": 4 },
      "q2": { "sq1": 2, "sq2": 3 }
    },
    "part1": {
      "pq1": { "direct": 5 }
    },
    "final": { "final": { "final": 14 } }
  }
}
```

#### `grade_calculation_configs` -- Configurations de calcul des moyennes
```sql
id                 uuid    DEFAULT gen_random_uuid()  PRIMARY KEY
user_id            uuid    NOT NULL  REFERENCES auth.users(id)
academic_year      text    NOT NULL
trimester          text    NOT NULL
class_name         text    NOT NULL
subject            text    NOT NULL DEFAULT ''
cc_assignment_id   text    NOT NULL DEFAULT ''
comp_assignment_id text    NOT NULL DEFAULT ''
tp_assignment_id   text    NOT NULL DEFAULT ''
devoir1_config     jsonb   NOT NULL DEFAULT '{"assignmentIds":[],"combine":"sum","normalize":true,"targetMax":20}'
devoir2_config     jsonb   NOT NULL DEFAULT '{"assignmentIds":[],"combine":"sum","normalize":true,"targetMax":20}'
out_max            numeric NOT NULL DEFAULT 20
is_published       boolean NOT NULL DEFAULT false
created_at         timestamptz
updated_at         timestamptz
CONSTRAINT grade_calculation_configs_unique_key 
  UNIQUE (user_id, academic_year, trimester, class_name, subject)
```

**Structure des champs `devoir1_config` / `devoir2_config` (JSONB) :**
```json
{
  "assignmentIds": ["id1", "id2"],
  "combine": "sum",
  "normalize": true,
  "targetMax": 20
}
```
- `combine` : mode de combinaison (`sum` | `avg` | `max`)
- `normalize` : ramener sur targetMax (proportionnel)
- `targetMax` : bareme cible (defaut 20)

#### `student_final_grades` -- Moyennes calculees par eleve
```sql
id            uuid    DEFAULT gen_random_uuid()  PRIMARY KEY
user_id       uuid    NOT NULL  REFERENCES auth.users(id)
academic_year text    NOT NULL
trimester     text    NOT NULL
class_name    text    NOT NULL
subject       text    NOT NULL DEFAULT ''
student_id    text    NOT NULL  REFERENCES students(id)
cc_score      numeric
tp_score      numeric
comp_score    numeric
devoir_score  numeric
moyenne       numeric
observation   text    DEFAULT ''
advice        text    DEFAULT ''
created_at    timestamptz
updated_at    timestamptz
CONSTRAINT student_final_grades_unique_key 
  UNIQUE (user_id, academic_year, trimester, class_name, subject, student_id)
```

### 3.2 Entites secondaires

#### `grades_history` -- Historique pour annulation (Undo)
```sql
id            uuid    PRIMARY KEY
user_id       uuid    REFERENCES auth.users(id)
academic_year text
student_id    text
assignment_id text
snapshot      jsonb   -- Instantane de l'etat des notes
created_at    timestamptz
```

#### Referentiels geographiques (API)
- `wilayas` -- Wilayas d'Algerie
- `communes` -- Communes par wilaya
- `schools` -- Etablissements scolaires

---

## 4. Relations entre entites

```
auth.users (1:N) --> corrections_data
auth.users (1:1) --> user_settings
auth.users (1:N) --> assignments
auth.users (1:N) --> grades
auth.users (1:N) --> grade_calculation_configs
auth.users (1:N) --> student_final_grades
auth.users (1:N) --> teacher_classes

schools (1:N) --> classes.school_id
classes  (1:N) --> teacher_classes.class_id
classes  (1:N) --> students.class_name  (logique, pas FK)
classes  (1:N) --> assignments.class_name  (logique, pas FK)

students     (1:N) --> grades.student_id
assignments  (1:N) --> grades.assignment_id

grade_calculation_configs --> assignments
  via cc_assignment_id   (1 assignment CC)
  via comp_assignment_id (1 assignment Composition)
  via tp_assignment_id   (1 assignment TP)
  via devoir1_config.assignmentIds (N assignments Devoir groupe 1)
  via devoir2_config.assignmentIds (N assignments Devoir groupe 2)

student_final_grades --> students (via student_id)

students (self) : is_official = true si importe via Excel
```

### Diagramme relationnel simplifie

```
+-------------+     +---------------+     +------------+
| auth.users  |---->| user_settings |     |  schools   |
+------+------+     +---------------+     +-----+------+
       |                                        |
       | 1:N                                    | 1:N
       v                                        v
+------+------+                          +------+------+
| assignments |                          |   classes   |
+------+------+                          +------+------+
       |                                        |
       | 1:N                               +----+----+
       v                                    |         |
+------+------+                    +-------+-+-+   +--+--------+
|    grades     |<---+             | teacher_  |   | students  |
+------+------+    |             |  classes  |   +-----+------+
       |           |             +-----------+         |
       |           |                                   | 1:N
       +-----------+-----------------------------------+
        (student_id, assignment_id)

+-------------------+          +---------------------+
| grade_calculation |--------->| student_final_grades|
|    _configs       |          +---------------------+
+-------------------+                    |
        |                               | student_id
        +---> assignments (via config)  +---> students
```

---

## 5. Workflows metiers

### 5.1 Workflow de Creation de Devoir

```
Selection Classe --> Choix Type (devoir|cc|tp|comp) --> Choix Matiere --> Choix Trimestre
     |
     v
Auto-suggestion du nom :
  - Devoir  : "Devoir N T{x}" (increment auto)
  - CC      : "CC T{x}"
  - TP      : "TP T{x}"
  - Comp    : "Composition T{x}"
     |
     v
Configuration avancee (optionnel) :
  - Exercices avec questions/sous-questions et bareme
  - Points globaux ou detailles
  - Date du devoir
  - Visibilite pour les eleves
     |
     v
Sauvegarde --> Sync Supabase (blob + relationnel)
```

### 5.2 Workflow de Saisie des Notes

```
Selection Devoir --> Selection Eleve
     |
     v
Saisie par exercice/question ou note globale
     |
     v
Calcul automatique du total (getStudentAssignmentTotal) :
  - Somme des sous-questions --> question --> exercice --> total
  - Ou note globale si pas d'exercices
     |
     v
Historique Undo (historyService --> pile locale + Supabase)
     |
     v
Sauvegarde --> Sync Supabase (grades + score_final/score_max calcules)
```

### 5.3 Workflow de Calcul des Moyennes (Preparation Export)

```
Selection Classe + Matiere + Trimester
     |
     v
Configuration du calcul (grade_calculation_config) :
  - CC   --> 1 assignment (note ramenee sur out_max)
  - TP   --> 1 assignment (optionnel)
  - Comp --> 1 assignment (coefficient x2 dans la moyenne)
  - Devoir1 & Devoir2 --> groupes d'assignments
     |
     v
Parametres par groupe :
  - combine : sum | avg | max
  - normalize : true/false (ramener sur targetMax)
  - targetMax : valeur cible (defaut 20)
  - assignmentIds : liste des IDs du groupe
     |
     v
Calcul de la moyenne :
  devoir = moyenne(devoir1, devoir2)  (si les deux existent)
  moyenne = (devoir + cc + tp + 2*comp) / 5  (avec TP)
  moyenne = (devoir + cc + 2*comp) / 4        (sans TP)
     |
     v
Generation observations/conseils automatiques (remarks.engine.js)
     |
     v
Publication (is_published) --> visible par les eleves
     |
     v
Sauvegarde config --> Supabase RPC (save_grade_calculation_config)
```

### 5.4 Workflow de Collaboration

```
Prof A cree des classes/eleves --> Sync vers tables relationnelles
     |
     v
Prof B rejoint la classe (subscribeToClass)
     |
     v
Prof B voit les eleves partages (getSharedStudents)
     |
     v
Chaque prof gere ses propres devoirs/notes
     |
     v
Stats partagees par classe (getSharedClassStats --> total, boys, girls)
```

### 5.5 Workflow Eleve

```
Login via NIN (numero identification national) + date de naissance
     |
     v
Recuperation des notes visibles (get_student_visible_grades)
  - Seuls les devoirs avec is_visible = true sont affiches
  - Stats de classe incluses (moy, min, max)
     |
     v
Changement de mot de passe possible (update_student_password)
```

---

## 6. Types de devoirs et parametres

| Type | Code | Nom Auto-suggere | Role dans la Moyenne | Coefficient |
|------|------|-------------------|----------------------|-------------|
| **Devoir** | `devoir` | Devoir N T{x} | Groupe (devoir1/devoir2, combinable) | 1 |
| **CC** (Controle Continu) | `cc` | CC T{x} | Note unique ramenee sur /20 | 1 |
| **TP** (Travaux Pratiques) | `tp` | TP T{x} | Note unique ramenee sur /20 | 1 |
| **Composition** | `comp` | Composition T{x} | Note unique ramenee sur /20 | **2** |

### Modes de combinaison des groupes Devoir

| Mode | Code | Description |
|------|------|-------------|
| Somme | `sum` | Somme brute ou normalisee des notes du groupe |
| Moyenne | `avg` | Moyenne des pourcentages ou moyennes brutes |
| Maximum | `max` | Meilleure note du groupe |

### Formules de calcul

**Calcul du score d'un groupe (computeGroupScore) :**
```
combine=sum, normalize=false : somme brute des notes
combine=sum, normalize=true  : (somme / somme_max) * targetMax
combine=avg, normalize=false : moyenne brute des notes
combine=avg, normalize=true  : moyenne des pourcentages * targetMax
combine=max, normalize=false : max des notes brutes
combine=max, normalize=true  : max des pourcentages * targetMax
```

**Calcul du devoir final (computeDevoirFinal) :**
```
devoir = (devoir1 + devoir2) / 2  si les deux existent
devoir = devoir1                   si seul devoir1 existe
devoir = devoir2                   si seul devoir2 existe
devoir = null                      si aucun n'existe
```

**Calcul de la moyenne generale :**
```
Avec TP    : moyenne = (devoir + cc + tp + 2 * comp) / 5
Sans TP    : moyenne = (devoir + cc + 2 * comp) / 4
Condition  : toutes les notes requises doivent etre non-null
```

**Calcul du score ramene (calcScaledScore) :**
```
scaled = (total / max) * outMax
```

---

## 7. Modele de donnees local (JSON Blob)

L'application utilise un blob JSON principal (`corrections_data`) qui est la source de verite cote client :

```javascript
window.data = {
  students: [
    {
      id: "5x8j9k2l",           // ID genere par genId()
      firstName: "Ahmed",
      lastName: "BENALI",
      className: "1M1",
      nin: "0123456789012",      // Numero identification national
      birthDate: "15/03/2008",
      sex: "M",                  // M ou F
      academicYear: "2025/2026",
      status: "active",          // active ou archived
      isOfficial: true,          // true si importe via Excel
      regNumber: "2025-001",     // Matricule
      importedBy: "user@email.com",
      belongsToUser: true
    }
  ],

  assignments: [
    {
      id: "abc123",
      name: "Devoir 1 T1",
      className: "1M1",
      trimester: "1",
      subject: "mathematiques",
      type: "devoir",            // devoir | cc | tp | comp
      gradeDate: "2025-03-15",
      isVisible: false,
      academicYear: "2025/2026",
      createdBy: "user@email.com",
      exercises: [
        {
          id: "ex1",
          name: "Exercice 1",
          maxPoints: 20,
          defaultGrade: "",
          questions: [
            {
              id: "q1",
              maxPoints: 5,
              subQuestions: [
                { id: "sq1", maxPoints: 2 },
                { id: "sq2", maxPoints: 3 }
              ]
            }
          ],
          parts: [
            {
              id: "part1",
              name: "Partie A",
              questions: [
                { id: "pq1", maxPoints: 4 }
              ]
            }
          ]
        }
      ]
    }
  ],

  grades: {
    "studentId1": {
      "assignmentId1": {
        global: 15.5,            // Note globale (si pas d'exercices)
        "ex1": {                 // Notes par exercice
          "direct": {
            "q1": { "direct": 4 },
            "q2": { "sq1": 2, "sq2": 3 }
          },
          "part1": {
            "pq1": { "direct": 5 }
          },
          "final": { "final": { "final": 14 } }  // Note finale exercice
        }
      }
    }
  }
}
```

### Hierarchie de saisie des notes

```
Assignment
  +-- Exercice
       +-- Questions directes
       |    +-- Sous-questions
       +-- Parties (Parts)
            +-- Questions
                 +-- Sous-questions
  +-- Note globale (si pas d'exercices)
```

---

## 8. Synchronisation et stockage

### 8.1 Architecture hybride

L'application utilise une **strategie hybride** avec 3 niveaux de stockage :

```
+-------------------+     +-------------------+     +-------------------+
|  LocalStorage     |     |  Supabase Blob    |     |  Tables           |
|  (Cache local)    |<--->|  (corrections_    |     |  Relationnelles   |
|                   |     |   data)           |     |  (students,       |
|  corrections-data |     |  Source de verite |     |   assignments,    |
|  corrections-     |     |  principale       |     |   grades, etc.)   |
|  global-*         |     |                   |     |                   |
+-------------------+     +-------------------+     +-------------------+
         ^                         ^                          ^
         |                         |                          |
         +------- store.js --------+                          |
                                   |                          |
                                   +-- relational-sync.service.js (fire & forget)
```

### 8.2 Flux de donnees

**Chargement :**
1. `store.load()` tente d'abord le chargement distant (Supabase blob)
2. Si le distant reussit et differe du local, on met a jour le local
3. Si le distant echoue, on fallback sur le local
4. Structure par defaut : `{ students: [], assignments: [], grades: {} }`

**Sauvegarde :**
1. `store.save(payload)` sauvegarde en local (synchrone)
2. Puis sauvegarde sur Supabase blob (asynchrone, non-bloquant)
3. Declenche `relationalSyncService.sync()` en arriere-plan (fire & forget)

**Sync relationnelle (relational-sync.service.js) :**
1. Upsert des eleves vers la table `students`
2. Upsert des devoirs vers la table `assignments`
3. Suppression des devoirs supprimes localement (et leurs notes)
4. Upsert des classes et abonnements enseignant
5. Upsert des notes vers la table `grades` (avec score_final/score_max calcules)
6. Nettoyage des notes orphelines

### 8.3 Variables localStorage

| Cle | Description |
|-----|-------------|
| `corrections-data` | Donnees principales (blob JSON) |
| `corrections-global-academic-year` | Annee scolaire active |
| `corrections-global-trimester` | Trimestre actif |
| `corrections-language` | Langue selectionnee (fr/ar) |

---

## 9. Fonctions RPC Supabase

### 9.1 Fonctions pour l'API Eleve

| Fonction | Role | Securite |
|----------|------|----------|
| `check_student_login(p_nin)` | Authentification eleve via NIN | SECURITY DEFINER |
| `get_student_visible_grades(p_student_id)` | Notes visibles + stats classe | SECURITY DEFINER |
| `update_student_password(p_student_id, p_new_password)` | Changement mot de passe eleve | SECURITY DEFINER |
| `get_student_auth_info(p_student_id)` | Infos auth eleve (birthdate, custom_password) | SECURITY DEFINER |

### 9.2 Fonctions pour la configuration des moyennes

| Fonction | Role | Securite |
|----------|------|----------|
| `save_grade_calculation_config(...)` | Upsert config calcul moyennes | SECURITY DEFINER |
| `get_grade_calculation_config(...)` | Lecture config par classe/trim/matiere | SECURITY DEFINER |

### 9.3 Detail de `get_student_visible_grades`

Retourne pour chaque note visible :
- `id`, `score_final`, `score_max`, `updated_at`, `comments`
- `grade_date`, `assignment_id`, `assignment_name`, `assignment_subject`
- `assignment_trimester`, `assignment_type`, `academic_year`
- `class_avg`, `class_max`, `class_min` (stats de classe calculees)

---

## 10. Securite et politiques RLS

### 10.1 Politiques par table

| Table | Politique | Regle |
|-------|-----------|-------|
| `corrections_data` | ALL | `auth.uid() = user_id` |
| `user_settings` | ALL | `auth.uid() = user_id` |
| `classes` | INSERT | `jwt.school_id = school_id` |
| `classes` | SELECT | `jwt.school_id = school_id` |
| `teacher_classes` | ALL | `auth.uid() = user_id` |
| `students` | ALL | `jwt.school_id = school_id` |
| `assignments` | ALL | `auth.uid() = user_id` |
| `grades` | ALL | `auth.uid() = user_id` |
| `grade_calculation_configs` | ALL | `auth.uid() = user_id` |
| `student_final_grades` | ALL | `auth.uid() = user_id` |

### 10.2 Index de performance

```sql
idx_students_user_year       ON students(user_id, academic_year)
idx_assignments_user_year    ON assignments(user_id, academic_year)
idx_grades_lookup            ON grades(student_id, assignment_id)
idx_grade_calc_configs_lookup ON grade_calculation_configs(user_id, academic_year, trimester, class_name)
```

---

## 11. Anomalies et risques identifies

### 11.1 Anomalies critiques

| # | Anomalie | Description | Gravite |
|---|----------|-------------|---------|
| A1 | **Notes manquantes** | Eleve sans note pour un devoir inclus dans le calcul --> moyenne = null | CRITIQUE |
| A2 | **School_id manquant** | Prof sans school_id dans user_metadata --> RLS bloque les insertions classes/eleves | CRITIQUE |

### 11.2 Anomalies importantes

| # | Anomalie | Description | Gravite |
|---|----------|-------------|---------|
| A3 | **Bareme incoherent** | Total du bareme != out_max (20) sans normalisation (detecte par `groupHasExportScaleIssue`) | IMPORTANT |
| A4 | **Devoirs orphelins** | Assignments sans notes saisies mais inclus dans la config de calcul | IMPORTANT |
| A5 | **Config incomplete** | CC ou Comp manquants dans la config alors que d'autres types sont configures | IMPORTANT |
| A6 | **Desynchronisation** | Donnees locales != donnees Supabase (blob vs relationnel) | IMPORTANT |

### 11.3 Anomalies moderees

| # | Anomalie | Description | Gravite |
|---|----------|-------------|---------|
| A7 | **Trimestre verrouille** | Tentative de modification sur un trimestre bloque (`isTrimesterBlocked`) | MODERE |
| A8 | **Eleves archives** | Eleves archives encore presents dans les calculs de stats | MODERE |
| A9 | **Doublon de nom** | Deux devoirs du meme nom dans la meme classe/trimestre | MODERE |

---

## 12. Proposition de Dashboard Administratif

### 12.1 Architecture du Dashboard

```
+----------------------------------------------------------------------+
|                    TABLEAU DE BORD ENSEIGNANT                         |
+----------------------------------------------------------------------+
|                                                                       |
|  +---------------------------------------------------------------+   |
|  |  BARRE DE FILTRE GLOBALE                                      |   |
|  |  [Annee Scolaire v] [Trimestre v] [Classe v] [Matiere v]     |   |
|  +---------------------------------------------------------------+   |
|                                                                       |
|  +----------+ +----------+ +----------+ +----------+ +----------+    |
|  | Eleves   | | Devoirs  | | Notes    | | Moyennes | | Alertes  |    |
|  |   142    | |    28    | |   87%    | |   12.4   | |    5     |    |
|  | +3 sem.  | | 4 types  | | complet. | |  /20     | | anomalies|    |
|  +----------+ +----------+ +----------+ +----------+ +----------+    |
|                                                                       |
|  +-----------------------------+ +---------------------------------+  |
|  | PROGRESSION DES MOYENNES    | | STATS PAR CLASSE               |  |
|  |                             | |                                 |  |
|  | 16|     *---*              | |  Classe    | Elv |Moy |Compl|   |  |
|  | 14|  *-/     \--*         | |  1M1       | 35  |13.2| 92% |   |  |
|  | 12| /                     | |  1M2       | 32  |11.8| 78% |   |  |
|  | 10|/                       | |  2SC1      | 38  |14.5| 95% |   |  |
|  |  8|                        | |  2SC2      | 37  |10.3| 65% |   |  |
|  |   --T1--T2--T3             | |                                 |  |
|  | (Moyenne generale/trim.)   | |  [Voir details ->]             |  |
|  +-----------------------------+ +---------------------------------+  |
|                                                                       |
|  +-----------------------------+ +---------------------------------+  |
|  | REPARTITION PAR TYPE        | | COMPLETION DES NOTES            |  |
|  |                             | |                                 |  |
|  | Devoir ######## 40%        | |  1M1 - T1:                     |  |
|  | CC     #####    25%        | |  D1 ############  87%          |  |
|  | Comp   ####     20%        | |  D2 ##########    72%          |  |
|  | TP     ###      15%        | |  CC ################ 100%      |  |
|  |                             | |  Comp ########      60%        |  |
|  +-----------------------------+ +---------------------------------+  |
|                                                                       |
|  +-----------------------------+ +---------------------------------+  |
|  | DISTRIBUTION DES NOTES      | | ALERTES & ANOMALIES             |  |
|  |                             | |                                 |  |
|  |  8|                        | |  [!] 3 eleves sans note CC      |  |
|  |  6|   **                   | |      dans 1M2 - T1              |  |
|  |  4|  *  *                  | |  [!] Bareme incoherent D2       |  |
|  |  2| *    *                 | |      1M1 (total:18 != 20)       |  |
|  |  0|___________             | |  [!] Config incomplete 2SC2     |  |
|  |   0  5  10 15 20          | |      (CC manquant)              |  |
|  | (Histogramme des moyennes) | |  [!] 2 devoirs orphelins        |  |
|  +-----------------------------+ +---------------------------------+  |
|                                                                       |
|  +---------------------------------------------------------------+   |
|  | DETAIL PAR CLASSE (expandable)                                |   |
|  | +---------+--------+------+------+------+------+------+-----+  |   |
|  | | Classe  | Eleves | Devo |  CC  |  TP  | Comp | Moy  | Com |  |   |
|  | +---------+--------+------+------+------+------+------+-----+  |   |
|  | | 1M1     |   35   |  4   |  1   |  1   |  1   | 13.2 | 92% |  |   |
|  | | 1M2     |   32   |  3   |  1   |  0   |  1   | 11.8 | 78% |  |   |
|  | | 2SC1    |   38   |  4   |  1   |  1   |  1   | 14.5 | 95% |  |   |
|  | +---------+--------+------+------+------+------+------+-----+  |   |
|  +---------------------------------------------------------------+   |
+----------------------------------------------------------------------+
```

### 12.2 KPIs principaux (Cartes en haut)

| KPI | Source de donnees | Calcul |
|-----|-------------------|--------|
| **Nombre d'eleves** | `students` (filtré par année, status=active) | `COUNT(*)` |
| **Nombre de devoirs** | `assignments` (filtré par année, trimestre, classe) | `COUNT(*)` par type |
| **Taux de completion** | `grades` / `assignments` | `COUNT(grades avec score) / (eleves * devoirs)` |
| **Moyenne generale** | `student_final_grades.moyenne` | `AVG(moyenne)` |
| **Nombre d'alertes** | Calcul à la volée | Somme des anomalies détectées |

### 12.3 Graphiques proposes

#### A. Progression des moyennes par trimestre
- **Type :** Line chart
- **Axes :** X = Trimestre (T1, T2, T3), Y = Moyenne /20
- **Series :** Une ligne par classe (ou moyenne globale)
- **Donnees :** `AVG(student_final_grades.moyenne)` GROUP BY trimester, class_name
- **Interet :** Voir l'evolution des resultats au fil de l'annee

#### B. Statistiques par classe
- **Type :** Tableau + Bar chart horizontal
- **Colonnes :** Classe, Nb eleves, Moyenne, Taux completion, Min, Max
- **Donnees :** Aggregation sur `grades` et `student_final_grades`
- **Interet :** Comparer les classes entre elles

#### C. Repartition par type de devoir
- **Type :** Donut chart / Pie chart
- **Segments :** Devoir, CC, TP, Composition
- **Donnees :** `COUNT(assignments) GROUP BY type`
- **Interet :** Verifier l'equilibre des evaluations

#### D. Completion des notes (par classe/trimestre)
- **Type :** Stacked bar chart ou progress bars
- **Donnees :** Pour chaque devoir : `COUNT(grades avec score) / COUNT(students actifs)`
- **Interet :** Identifier les devoirs non corriges

#### E. Distribution des notes (Histogramme)
- **Type :** Histogram (bar chart)
- **Axes :** X = Tranches de notes [0-5, 5-10, 10-15, 15-20], Y = Nombre d'eleves
- **Donnees :** Distribution de `student_final_grades.moyenne`
- **Interet :** Voir la repartition des niveaux

#### F. Alertes et anomalies
- **Type :** Liste avec badges de gravite
- **Sources :**
  - Notes manquantes : eleves sans grade pour un assignment configure
  - Bareme incoherent : `groupHasExportScaleIssue` 
  - Config incomplete : CC/Comp manquants
  - Devoirs orphelins : assignments sans grades
  - Eleves archives encore dans les calculs
- **Interet :** Action corrective rapide

### 12.4 Specifications techniques du Dashboard

#### Composant : DashboardService

```javascript
// Service a creer : src/services/dashboard.service.js

export const dashboardService = {

  // 1. Statistiques globales
  async getGlobalStats(academicYear, trimester) {
    // Retourne : { totalStudents, totalAssignments, completionRate, 
    //              globalAverage, alertsCount }
  },

  // 2. Stats par classe
  async getClassStats(academicYear, trimester) {
    // Retourne : [{ className, studentCount, avgMoyenne, 
    //               completionRate, minMoyenne, maxMoyenne }]
  },

  // 3. Progression des moyennes
  async getMoyenneProgression(academicYear, className) {
    // Retourne : [{ trimester, moyenne }] pour graphique ligne
  },

  // 4. Repartition par type
  async getTypeDistribution(academicYear, trimester, className) {
    // Retourne : [{ type, count }] pour donut chart
  },

  // 5. Completion des notes
  async getGradeCompletion(academicYear, trimester, className) {
    // Retourne : [{ assignmentName, assignmentType, 
    //               totalStudents, gradedStudents, completionRate }]
  },

  // 6. Distribution des notes
  async getGradeDistribution(academicYear, trimester, className) {
    // Retourne : [{ range, count }] ex: [{range:"0-5",count:3}, ...]
  },

  // 7. Detection des anomalies
  async detectAnomalies(academicYear, trimester) {
    // Retourne : [{ type, severity, className, description, affectedCount }]
  }
};
```

#### Requetes Supabase pour le Dashboard

```sql
-- Moyenne generale par classe/trimestre
SELECT class_name, trimester, 
       ROUND(AVG(moyenne), 2) as avg_moyenne,
       MIN(moyenne) as min_moyenne,
       MAX(moyenne) as max_moyenne,
       COUNT(*) as student_count
FROM student_final_grades
WHERE user_id = auth.uid() 
  AND academic_year = '2025/2026'
GROUP BY class_name, trimester;

-- Taux de completion par devoir
SELECT a.class_name, a.name, a.type,
       COUNT(g.id) as graded_count,
       (SELECT COUNT(*) FROM students s 
        WHERE s.class_name = a.class_name 
        AND s.academic_year = a.academic_year 
        AND s.status = 'active') as total_students
FROM assignments a
LEFT JOIN grades g ON g.assignment_id = a.id AND g.score_final IS NOT NULL
WHERE a.user_id = auth.uid() AND a.academic_year = '2025/2026'
GROUP BY a.id, a.class_name, a.name, a.type, a.academic_year;

-- Distribution des moyennes
SELECT 
  CASE 
    WHEN moyenne >= 0 AND moyenne < 5 THEN '0-5'
    WHEN moyenne >= 5 AND moyenne < 10 THEN '5-10'
    WHEN moyenne >= 10 AND moyenne < 15 THEN '10-15'
    WHEN moyenne >= 15 AND moyenne <= 20 THEN '15-20'
  END as range,
  COUNT(*) as count
FROM student_final_grades
WHERE user_id = auth.uid() AND academic_year = '2025/2026'
  AND moyenne IS NOT NULL
GROUP BY range ORDER BY range;

-- Notes manquantes (anomalie)
SELECT a.class_name, a.name, a.type, COUNT(s.id) as missing_count
FROM assignments a
CROSS JOIN students s
LEFT JOIN grades g ON g.student_id = s.id AND g.assignment_id = a.id
WHERE a.user_id = auth.uid() 
  AND a.academic_year = '2025/2026'
  AND s.class_name = a.class_name
  AND s.status = 'active'
  AND g.id IS NULL
GROUP BY a.class_name, a.name, a.type;
```

### 12.5 Integration dans l'application

Le dashboard sera integre comme un nouvel onglet dans l'interface principale :

```
Onglets existants :  Eleves | Devoirs | Notes | Recapitulatif | Export
Nouvel onglet    :  Eleves | Devoirs | Notes | Recapitulatif | Export | DASHBOARD
```

**Bibliotheques graphiques recommandees :**
- **Chart.js** (leger, pas de dependances, compatible vanilla JS)
- Ou **ApexCharts** (plus de fonctionnalites, animations)

**Fichiers a creer :**
- `src/ui/dashboard.js` -- Logique du dashboard
- `src/services/dashboard.service.js` -- Service de donnees
- Integration dans `index.html` -- Onglet + conteneur

---

## 13. Annexes techniques

### 13.1 Variables globales (window.*)

| Variable | Type | Description |
|----------|------|-------------|
| `window.data` | Object | Donnees principales (students, assignments, grades) |
| `window.currentUser` | Object | Utilisateur connecte (Supabase auth) |
| `window.currentLanguage` | String | Langue active (fr/ar) |
| `window.translations` | Object | Traductions chargees |
| `window.subjects` | Array | Liste des matieres disponibles |
| `window.assignmentsUiState` | Object | Etat UI des assignments |
| `window.tempExercises` | Array | Exercices temporaires en cours d'edition |

### 13.2 Fonctions globales exposees

| Fonction | Module | Description |
|----------|--------|-------------|
| `window.renderAssignments()` | assignments.js | Rendu de la liste des devoirs |
| `window.openAssignmentModal()` | assignments.js | Ouvrir modal creation/edition devoir |
| `window.renderSummary()` | summary.js | Rendu du recapitulatif |
| `window.renderExportPrep()` | export.js | Rendu de la preparation export |
| `window.computeDevoirFinal()` | export.js | Calcul de la note devoir finale |
| `window.calcScaledScore()` | export.js | Calcul note ramenee |
| `window.saveData()` | global | Sauvegarde des donnees |
| `window.loadData()` | global | Chargement des donnees |
| `window.getClasses()` | global | Liste des classes disponibles |
| `window.getGlobalAcademicYear()` | global | Annee scolaire active |
| `window.getGlobalTrimester()` | global | Trimestre actif |
| `window.isTrimesterBlocked()` | global | Verifie si trimestre verrouille |
| `window.genId()` | global | Generation d'ID unique |
| `window.computeFinalObsCons()` | remarks | Calcul observations/conseils |

### 13.3 Structure du modele de notes (grades)

La structure des notes est hierarchique et recursive :

```
grades[studentId][assignmentId] = {
    global: number,                    // Note globale (alternative)
    [exerciseId]: {
        [questionId]: {
            direct: value,             // Valeur directe de la question
            [subQuestionId]: value     // Valeur de la sous-question
        },
        [partId]: {
            [questionId]: {
                direct: value,
                [subQuestionId]: value
            }
        },
        'final': {
            'final': {
                'final': value         // Note finale forcee pour l'exercice
            }
        }
    }
}
```

**Priorite de calcul :**
1. Si `final.final.final` existe --> utilise cette valeur
2. Sinon, somme des questions/sous-questions
3. Si pas d'exercices --> utilise `global`

### 13.4 Format d'export Excel

L'export genere un fichier Excel avec :
- **En-tete :** Etablissement, Annee scolaire, Classe, Matiere, Trimestre
- **Colonnes :** N, Nom & Prenom, Devoir, CC, TP (si applicable), Composition, Moyenne, Observation, Conseil
- **Lignes :** Une par eleve
- **Ligne pied :** Moyennes de classe, Min, Max
- **Couleurs :** Vert (>=10), Rouge (<10), Jaune (manquant)

### 13.5 Systeme d'observations/conseils automatiques

Le moteur `remarks.engine.js` genere automatiquement des observations et conseils bases sur la moyenne :

| Tranche | Observation | Conseil |
|---------|-------------|---------|
| 0-5 | Tres insuffisant | Doit redoubler d'efforts |
| 5-8 | Insuffisant | Des progres sont necessaires |
| 8-10 | Moyen | Peut mieux faire |
| 10-12 | Assez bien | Continuez ainsi |
| 12-16 | Bien | Bon travail |
| 16-20 | Tres bien | Excellent travail |

Les enseignants peuvent personnaliser ces messages via `remarks.messages.js`.

---

*Document genere automatiquement a partir de l'analyse du code source de SimpleNotes.*
*Pour toute question ou mise a jour, consulter le depot du projet.*
