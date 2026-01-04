Date 04/01/2026 à 17:35
# Documentation Technique - simpleNotes

Ce document fournit une description technique complète de l'application **simpleNotes**, une plateforme de gestion des corrections et des notes pour les enseignants.

## 1. Architecture Globale

L'application suit une architecture **Client-Side Heavy** (majoritairement côté client) avec une couche de services serverless pour les fonctionnalités d'authentification et les données globales.

- **Frontend** : Application monopage (SPA) construite en Vanilla JavaScript et Tailwind CSS.
- **Backend** : Fonctions Serverless (Vercel Functions) en Node.js.
- **Base de données & Auth** : Supabase (PostgreSQL + Auth).
- **Stockage Local** : Utilisation intensive du `localStorage` pour les données de travail de l'enseignant.

## 2. Technologies Utilisées

### Front-end
- **Vanilla JavaScript (ES6+ Modules)** : Logique applicative découpée en modules fonctionnels.
- **Tailwind CSS v4** : Framework utilitaire pour le design et le responsive.
- **Bibliothèques tierces** :
  - `ExcelJS` & `XLSX` : Génération et lecture de fichiers Excel complexes.
  - `JSZip` : Manipulation de fichiers compressés.
  - `remarks.engine.js` : Moteur de génération de remarques automatiques.

### Back-end
- **Vercel Functions** : Hébergement des API serverless (`/api/*`).
- **Supabase JS SDK** : Interaction avec la base de données et le service d'authentification.
- **JSON Web Tokens (JWT)** : Sécurisation des échanges API.
- **Bcryptjs** : Hachage des mots de passe pour la couche API personnalisée.

## 3. Structure du Projet

```text
├── api/                  # Backend : Fonctions Serverless Vercel
│   ├── auth/             # Authentification (Login, Register, Me...)
│   ├── _lib/             # Bibliothèques partagées (Supabase, Utils, Erreurs)
│   └── ...               # Endpoints Wilayas, Communes, Schools
├── src/                  # Frontend : Code source
│   ├── services/         # Logique métier (Notes, Devoirs)
│   ├── storage/          # Adaptateurs de stockage (Store, LocalStorage)
│   └── ui/               # Composants et contrôleurs d'interface
│       ├── tabs/         # Gestionnaire d'onglets (Navigation)
│       └── ...           # Modules (Students, Assignments, Grades...)
├── index.html            # Point d'entrée principal (Layout & Injections)
├── translations.js       # Système d'internationalisation (FR, EN, AR)
├── vercel.json           # Configuration du déploiement Vercel
└── build.js              # Script de build (minification et packaging)
```

## 4. Flux de Données et État de l'Application

### Authentification
L'application utilise un système hybride :
1. **Client** : Utilise `supabase.auth` pour gérer la session utilisateur et le profil.
2. **API** : Utilise des cookies sécurisés (`auth_token`) et JWT pour valider les requêtes vers les fonctions serverless.
3. **Persistance** : Le token est stocké dans un cookie `SameSite=Lax; Secure`.

### Gestion des Données (Store)
L'état de l'application est centralisé dans un objet `window.data` et géré par un système de stockage local :
- **LocalStorage Adapter** : Les données (élèves, devoirs, notes) sont persistées dans `localStorage` sous la clé `corrections-data`.
- **Modèle de données** :
  - `students` : Array d'objets élèves (NIN, nom, classe, année scolaire).
  - `assignments` : Structure complexe incluant exercices, parties et questions.
  - `grades` : Objet imbriqué `{ studentId: { assignmentId: { exerciseId: { ...score } } } }`.

### Flux de Saisie des Notes
1. L'enseignant sélectionne une classe et un devoir.
2. Le module `grades.js` génère dynamiquement l'interface de saisie basée sur la structure du devoir.
3. Chaque note saisie est validée (`sanitizeAndClamp`) et sauvegardée immédiatement dans le store local.

## 5. Fonctionnalités Techniques Clés

### Moteur de Devoirs Dynamique
L'application permet de construire des devoirs avec une hiérarchie à 3 niveaux : **Exercice > Partie > Question > Sous-question**. 
Chaque niveau peut avoir ses propres points maximums, calculés récursivement par le `grades.service.js`.

### Système d'Exportation "Rakamna"
Un module spécialisé (`export.js`) prépare les données pour l'exportation vers les formats institutionnels (Excel, XLSX). Il inclut une logique de "matching" entre les devoirs de l'application et les colonnes cibles (CC, Devoir, Composition).

### Internationalisation (i18n)
Le système est entièrement traduisible via `translations.js`. Il supporte le **RTL (Right-To-Left)** pour l'arabe, avec des ajustements CSS spécifiques (`.rtl-layout`) pour inverser les marges, bordures et directions de flexbox.

## 6. Sécurité

- **Sécurité API** : Protection CSRF via des tokens et cookies dédiés.
- **Isolation des données** : Les données sont filtrées par `userId` et `academicYear` lors des imports/exports.
- **Vercel Headers** : En-têtes de sécurité configurés dans `vercel.json` (`X-Frame-Options`, `Content-Security-Policy` via headers de base).

## 7. Build et Déploiement

Le script `build.js` prépare le dossier `dist/` pour la production :
1. Vide le dossier `dist/`.
2. Minifie le HTML via `html-minifier-terser`.
3. Minifie le CSS (`styles.css`).
4. Copie récursivement le dossier `src/`.
5. Prépare les fichiers statiques (favicon, scripts externes).

Le déploiement est automatisé sur **Vercel** via la commande `vercel deploy`.

---
*Document généré le 04 Janvier 2026.*
