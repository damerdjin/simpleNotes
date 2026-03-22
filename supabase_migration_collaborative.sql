-- ==============================================================================
-- MIGRATION : MODÈLE COLLABORATIF (ÉCOLES, CLASSES ET ÉLÈVES PARTAGÉS)
-- VERSION : JWT CLAIMS (FIX PERMISSION DENIED ON AUTH.USERS)
-- ==============================================================================

-- 1. TABLE DES ÉTABLISSEMENTS (SCHOOLS)
create table if not exists public.schools (
  id uuid not null default gen_random_uuid() primary key,
  name text not null,
  commune_id text, -- Optionnel: pour filtrage par ville
  created_by uuid references auth.users(id),
  approved boolean default false, -- Pour modération si besoin
  created_at timestamptz default now()
);

alter table public.schools enable row level security;

-- Nettoyage et création des politiques pour schools
drop policy if exists "Schools are readable by everyone" on public.schools;
create policy "Schools are readable by everyone"
  on public.schools for select
  using (true);

drop policy if exists "Users can create schools" on public.schools;
create policy "Users can create schools"
  on public.schools for insert
  with check (auth.uid() is not null);


-- 2. TABLE DES CLASSES (CLASSES) - Partagée au sein d'une école
create table if not exists public.classes (
  id uuid not null default gen_random_uuid() primary key,
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null, -- ex: "2M1"
  level text, -- ex: "2nde"
  academic_year text not null,
  created_at timestamptz default now(),
  unique (school_id, academic_year, name)
);

alter table public.classes enable row level security;

-- Nettoyage et création des politiques pour classes (UTILISATION DES JWT CLAIMS + LECTURE PUBLIQUE POUR INSCRIPTION)
drop policy if exists "Users can see classes of their school" on public.classes;
create policy "Users can see classes of their school"
  on public.classes for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid = school_id
    or 
    auth.uid() is null -- Autoriser la lecture anonyme pour la page d'inscription
  );

drop policy if exists "Users can create classes in their school" on public.classes;
create policy "Users can create classes in their school"
  on public.classes for insert
  with check (
    (auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid = school_id
  );


-- 3. MISE À JOUR DE LA TABLE ÉLÈVES (STUDENTS)
-- On ajoute school_id et on modifie les politiques RLS
alter table public.students add column if not exists school_id uuid references public.schools(id);
alter table public.students add column if not exists registration_number text; -- Matricule unique lycée

-- Index pour recherche rapide et unicité au sein du lycée
create index if not exists idx_students_school_lookup on public.students(school_id, registration_number);

-- Nettoyage et création des politiques pour students (UTILISATION DES JWT CLAIMS)
drop policy if exists "Users can manage their own students" on public.students;
drop policy if exists "Users can see students of their school" on public.students;
drop policy if exists "Users can manage students of their school" on public.students;

create policy "Users can see students of their school"
  on public.students for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid = school_id
  );

create policy "Users can manage students of their school"
  on public.students for all
  using (
    (auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid = school_id
  );


-- 4. TABLE DE LIAISON PROF-CLASSE (Optionnel mais recommandé pour filtres)
create table if not exists public.teacher_classes (
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  primary key (user_id, class_id)
);

alter table public.teacher_classes enable row level security;

drop policy if exists "Teachers can manage their class subscriptions" on public.teacher_classes;
create policy "Teachers can manage their class subscriptions"
  on public.teacher_classes for all
  using (auth.uid() = user_id);
