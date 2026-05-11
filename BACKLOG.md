# BACKLOG — SimpleNotes

## Prochaines améliorations (à prioriser)

### Base de données

- [ ] **Contrainte NOT NULL sur `users.school_id`** — Actuellement le champ peut être NULL en base, ce qui n'a plus de sens après la validation côté client. Ajouter une contrainte `ALTER TABLE users ALTER COLUMN school_id SET NOT NULL;` pour garantir l'intégrité des données au niveau base.
