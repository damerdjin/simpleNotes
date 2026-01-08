-- ==============================================================================
-- SCHEMA SUPABASE POUR GESTION DES CORRECTIONS (CORRIGÉ V2)
-- Correction: Utilisation de TEXT pour les IDs au lieu de UUID pour compatibilité
-- avec les IDs existants de l'application JS (Math.random().toString(36)).
-- ==============================================================================

-- 1. TABLE DE STOCKAGE "BLOB" (MIGRATION PROGRESSIVE)
create table if not exists public.corrections_data (
  user_id uuid not null references auth.users(id) on delete cascade,
  academic_year text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, academic_year)
);

alter table public.corrections_data enable row level security;

create policy "Users can manage their own data blobs"
  on public.corrections_data
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- 2. TABLE DES PRÉFÉRENCES UTILISATEUR
create table if not exists public.user_settings (
  user_id uuid not null primary key references auth.users(id) on delete cascade,
  language text default 'fr',
  current_academic_year text,
  current_trimester text,
  updated_at timestamptz default now()
);

alter table public.user_settings enable row level security;

create policy "Users can manage their own settings"
  on public.user_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ==============================================================================
-- 3. TABLES RELATIONNELLES (POUR INTERFACE ÉLÈVE)
-- IDs en TEXT pour matcher window.genId()
-- ==============================================================================

-- TABLE ÉLÈVES
create table if not exists public.students (
  id text not null primary key, -- ID généré par le JS (ex: "5x8j9k2l")
  user_id uuid not null references auth.users(id) on delete cascade,
  academic_year text not null,
  
  first_name text,
  last_name text,
  nin text,
  reg_number text,
  birthdate text,
  class_name text not null,
  sex text check (sex in ('M', 'F')),
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.students enable row level security;

create policy "Users can manage their own students"
  on public.students
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Politique de lecture publique (ou restreinte) pour les élèves à venir
-- create policy "Students can read own data" ... (à faire plus tard)


-- TABLE DEVOIRS (ASSIGNMENTS)
create table if not exists public.assignments (
  id text not null primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  academic_year text not null,
  
  name text not null,
  class_name text not null,
  trimester text,
  subject text,
  
  config jsonb not null default '{}'::jsonb, -- Détails (questions, barème)
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.assignments enable row level security;

create policy "Users can manage their own assignments"
  on public.assignments
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- TABLE NOTES (GRADES)
create table if not exists public.grades (
  id uuid not null default gen_random_uuid() primary key, -- Ici UUID c'est ok car on génère une nouvelle entrée relationnelle, ou on peut utiliser un composite
  user_id uuid not null references auth.users(id) on delete cascade,
  
  student_id text not null references public.students(id) on delete cascade,
  assignment_id text not null references public.assignments(id) on delete cascade,
  
  score_final numeric,
  score_details jsonb,
  comments text,
  
  updated_at timestamptz default now(),
  
  unique (student_id, assignment_id) -- Un seul set de notes par élève/devoir
);

alter table public.grades enable row level security;

create policy "Users can manage their own grades"
  on public.grades
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index
create index if not exists idx_students_user_year on public.students(user_id, academic_year);
create index if not exists idx_assignments_user_year on public.assignments(user_id, academic_year);
create index if not exists idx_grades_lookup on public.grades(student_id, assignment_id);
