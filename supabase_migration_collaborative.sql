-- ==============================================================================
-- MIGRATION : MODÈLE COLLABORATIF (ÉCOLES, CLASSES ET ÉLÈVES PARTAGÉS)
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

-- Tout le monde peut lire les écoles (pour s'inscrire/chercher)
create policy "Schools are readable by everyone"
  on public.schools for select
  using (true);

-- Seuls les admins ou créateurs peuvent modifier (à affiner)
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

-- Un prof voit les classes de son école
create policy "Users can see classes of their school"
  on public.classes for select
  using (
    exists (
      select 1 from auth.users
      where auth.uid() = id
      and (raw_user_meta_data->>'school_id')::uuid = school_id
    )
  );

create policy "Users can create classes in their school"
  on public.classes for insert
  with check (
    exists (
      select 1 from auth.users
      where auth.uid() = id
      and (raw_user_meta_data->>'school_id')::uuid = school_id
    )
  );


-- 3. MISE À JOUR DE LA TABLE ÉLÈVES (STUDENTS)
-- On ajoute school_id et on modifie les politiques RLS
alter table public.students add column if not exists school_id uuid references public.schools(id);
alter table public.students add column if not exists registration_number text; -- Matricule unique lycée

-- Index pour recherche rapide et unicité au sein du lycée
create index if not exists idx_students_school_lookup on public.students(school_id, registration_number);

-- Nouvelles politiques RLS pour le partage
drop policy if exists "Users can manage their own students" on public.students;

create policy "Users can see students of their school"
  on public.students for select
  using (
    exists (
      select 1 from auth.users
      where auth.uid() = id
      and (raw_user_meta_data->>'school_id')::uuid = school_id
    )
  );

create policy "Users can manage students of their school"
  on public.students for all
  using (
    exists (
      select 1 from auth.users
      where auth.uid() = id
      and (raw_user_meta_data->>'school_id')::uuid = school_id
    )
  );


-- 4. TABLE DE LIAISON PROF-CLASSE (Optionnel mais recommandé pour filtres)
create table if not exists public.teacher_classes (
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  primary key (user_id, class_id)
);

alter table public.teacher_classes enable row level security;

create policy "Teachers can manage their class subscriptions"
  on public.teacher_classes for all
  using (auth.uid() = user_id);
