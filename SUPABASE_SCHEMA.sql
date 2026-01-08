-- ==============================================================================
-- SCHEMA SUPABASE POUR GESTION DES CORRECTIONS
-- ==============================================================================

-- 1. TABLE DE STOCKAGE "BLOB" (MIGRATION PROGRESSIVE)
-- Cette table stocke tout le JSON "data" par année, comme le localStorage.
-- C'est l'étape 1 du basculement (actuellement utilisée par l'application).
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
-- Pour synchroniser la langue, l'année active, le trimestre, etc.
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
-- 3. TABLES RELATIONNELLES (FUTUR : INTERFACE ÉLÈVE & GRANULARITÉ)
-- Ces tables ne sont pas encore utilisées par l'application JS actuelle.
-- Elles serviront pour la phase 3 (migration vers structure relationnelle).
-- ==============================================================================

-- TABLE ÉLÈVES
create table if not exists public.students (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade, -- Le prof
  academic_year text not null,
  
  full_name text not null,
  nin text, -- Numéro Identification National (optionnel)
  class_name text not null, -- Ex: "4AM1"
  sex text check (sex in ('M', 'F')),
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Contraintes pour éviter doublons stricts pour un même prof/année
  unique (user_id, academic_year, nin) 
  -- Note: Si nin est null, l'unicité n'est pas forcée par SQL standard, à gérer.
);

alter table public.students enable row level security;

create policy "Users can manage their own students"
  on public.students
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- TABLE DEVOIRS (ASSIGNMENTS)
create table if not exists public.assignments (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  academic_year text not null,
  
  name text not null, -- Ex: "Devoir 1"
  class_name text not null, -- Classe cible
  subject text, -- Matière (ex: "Maths")
  
  -- Configuration du devoir (structure, questions, barème)
  config jsonb not null default '{}'::jsonb, 
  
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
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade, -- Dénormalisé pour performance RLS
  
  student_id uuid not null references public.students(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  
  score_final numeric, -- Note finale (ex: 15.5)
  score_details jsonb, -- Détail par question { "ex1": 5, "ex2": 10.5 }
  comments text,
  
  updated_at timestamptz default now(),
  
  unique (student_id, assignment_id)
);

alter table public.grades enable row level security;

create policy "Users can manage their own grades"
  on public.grades
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index pour performances
create index if not exists idx_students_user_year on public.students(user_id, academic_year);
create index if not exists idx_assignments_user_year on public.assignments(user_id, academic_year);
create index if not exists idx_grades_assignment on public.grades(assignment_id);
create index if not exists idx_grades_student on public.grades(student_id);
