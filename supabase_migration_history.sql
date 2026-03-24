-- ==============================================================================
-- HISTORISATION DES NOTES (REBOBINAGE / UNDO)
-- ==============================================================================

create table if not exists public.grades_history (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  academic_year text not null,
  student_id text not null,
  assignment_id text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.grades_history enable row level security;

create policy "Users can manage their own grades history"
  on public.grades_history
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index pour performance lors du rewind
create index if not exists idx_grades_history_lookup on public.grades_history(user_id, student_id, assignment_id, created_at desc);

-- Nettoyage automatique : ne garder que les 5 derniers snapshots par élève/devoir
-- (Optionnel : peut être fait via une fonction cron ou un trigger si besoin)
