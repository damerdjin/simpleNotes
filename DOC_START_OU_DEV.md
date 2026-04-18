# Guide : Utiliser `pnpm dev` vs `pnpm start`

Dans ce projet, vous avez désormais deux façons de lancer l'application en local. Voici quand et comment utiliser chacune d'elles.

---

## ⚡ 1. `pnpm dev` (Développement Rapide)
C'est la commande que vous utiliserez **90% du temps**.

- **Outil utilisé** : [Vite](https://vitejs.dev/)
- **Avantage majeur** : **Hot Reload / Live Reload**. 
  - Dès que vous sauvegardez un fichier (HTML, JS, CSS), la page se met à jour instantanément dans votre navigateur. Plus besoin de couper (`Ctrl+C`) et de relancer.
- **Quand l'utiliser ?**
  - Pour créer de nouvelles fonctionnalités.
  - Pour corriger des bugs visuels (comme les cadenas).
  - Pour modifier vos textes ou vos styles CSS.
- **Comment ça marche ?** 
  - Vite sert directement les fichiers à la racine du projet. Il n'attend pas la fin d'un "build".

---

## 🛡️ 2. `pnpm start` (Test de Déploiement)
C'est la commande de **vérification finale**.

- **Outil utilisé** : `vercel dev` + votre script `build.js`
- **Avantage majeur** : **Fidélité au serveur de production (Vercel)**.
  - Elle permet de tester si vos **Middlewares**, vos **Edge Functions**, et l'obfuscation du code fonctionnent correctement.
- **Quand l'utiliser ?**
  - Juste avant de faire un `git push` ou de déployer sur Vercel.
  - Si vous soupçonnez un bug qui n'apparaît qu'en ligne (problème de connexion, de cookies ou de sécurité).
- **Inconvénient** : Pas de Hot Reload. Vous devez redémarrer à chaque modification car elle sert le dossier `/dist` qui doit être reconstruit.

---

## 💡 Résumé pour votre Workflow

1. **Phase de création** : Lancez `pnpm dev`. Codez, sauvegardez, voyez le résultat instantanément.
2. **Phase de validation** : Une fois que tout est prêt, coupez Vite, et lancez `pnpm start`. Si tout fonctionne ici, vous pouvez déployer sans crainte !

---

> [!TIP]
> Si vous voyez une erreur complexe dans le terminal avec `pnpm start` (comme un crash "Middleware"), ne paniquez pas. Souvent, ces erreurs sont dues à l'environnement local de Vercel. Si votre `pnpm dev` fonctionne bien, le problème est probablement lié à la configuration du serveur.
