# BACKLOG — SimpleNotes

## Prochaines améliorations (à prioriser)

### Base de données

- [x] **Contrainte NOT NULL sur `users.school_id`** — ✅ Déjà fait via `ALTER TABLE users ALTER COLUMN school_id SET NOT NULL;`. La création de compte est maintenant corrigée pour passer le `school_id` avant l'inscription (création de l'école en premier).
