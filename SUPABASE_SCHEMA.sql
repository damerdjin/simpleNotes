-- ==============================================================================
-- SCHEMA SUPABASE COMPLET POUR L'APPLICATION (Mise à jour Mars 2026)
-- Ce fichier contient TOUTES les tables, les politiques de sécurité (RLS)
-- et les fonctions (RPC) nécessaires au bon fonctionnement de l'application.
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
-- 3. TABLES RELATIONNELLES (POUR INTERFACE ÉLÈVE & COLLABORATION)
-- ==============================================================================

-- TABLE CLASSES
create table if not exists public.classes (
  id uuid not null default gen_random_uuid() primary key,
  school_id uuid not null, -- Le lycée auquel appartient la classe
  academic_year text not null,
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (school_id, academic_year, name)
);

alter table public.classes enable row level security;

-- TABLE TEACHER_CLASSES (Abonnements aux classes partagées)
create table if not exists public.teacher_classes (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, class_id)
);

alter table public.teacher_classes enable row level security;


-- TABLE ÉLÈVES
create table if not exists public.students (
  id text not null primary key, -- ID généré par le JS (ex: "5x8j9k2l")
  user_id uuid not null references auth.users(id) on delete cascade,
  school_id uuid, -- Ajouté pour la collaboration
  academic_year text not null,
  
  first_name text,
  last_name text,
  nin text,
  reg_number text,
  birthdate text,
  class_name text not null,
  sex text check (sex in ('M', 'F')),
  status text default 'active' check (status in ('active', 'archived')), -- Ajout statut pour soft-delete
  is_official boolean default false, -- Distingue les élèves importés (Excel) des manuels
  custom_password text, -- Ajout pour permettre aux élèves de changer de mot de passe
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.students enable row level security;


-- TABLE DEVOIRS (ASSIGNMENTS)
create table if not exists public.assignments (
  id text not null primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  academic_year text not null,
  
  name text not null,
  class_name text not null,
  trimester text,
  subject text,
  is_visible boolean default false,
  
  config jsonb not null default '{}'::jsonb, -- Détails (questions, barème)
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.assignments enable row level security;


-- TABLE NOTES (GRADES)
create table if not exists public.grades (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  
  student_id text not null references public.students(id) on delete cascade,
  assignment_id text not null references public.assignments(id) on delete cascade,
  
  score_final numeric,
  score_max numeric,
  score_details jsonb,
  comments text,
  
  updated_at timestamptz default now(),
  
  unique (student_id, assignment_id) -- Un seul set de notes par élève/devoir
);

alter table public.grades enable row level security;

-- Index de performance
create index if not exists idx_students_user_year on public.students(user_id, academic_year);
create index if not exists idx_assignments_user_year on public.assignments(user_id, academic_year);
create index if not exists idx_grades_lookup on public.grades(student_id, assignment_id);


-- ==============================================================================
-- 4. POLITIQUES DE SÉCURITÉ (RLS) - DÉFINITIVES
-- ==============================================================================

-- Classes: Les profs peuvent créer/lire les classes de leur propre lycée
CREATE POLICY "Users can create classes in their school"
  ON public.classes FOR INSERT
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid = school_id);

CREATE POLICY "Users can view classes in their school"
  ON public.classes FOR SELECT
  USING ((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid = school_id);

-- Abonnements Professeurs/Classes
CREATE POLICY "Users can manage their own class subscriptions"
  ON public.teacher_classes FOR ALL
  USING (auth.uid() = user_id);

-- Élèves: Les profs gèrent les élèves de leur lycée
CREATE POLICY "Users can manage students of their school"
  ON public.students FOR ALL
  USING ((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid = school_id);

-- Devoirs: Les profs gèrent leurs propres devoirs
CREATE POLICY "Users can manage their own assignments"
  ON public.assignments FOR ALL
  USING (auth.uid() = user_id);

-- Notes: Les profs gèrent leurs propres notes
CREATE POLICY "Users can manage their own grades"
  ON public.grades FOR ALL
  USING (auth.uid() = user_id);


-- ==============================================================================
-- 5. FONCTIONS SÉCURISÉES POUR L'API ÉLÈVES (RPC / SECURITY DEFINER)
-- ==============================================================================

-- A. Fonction pour vérifier le login d'un élève (Bypass RLS)
-- MISE A JOUR: On retourne aussi le custom_password s'il existe
DROP FUNCTION IF EXISTS public.check_student_login(text);
CREATE OR REPLACE FUNCTION public.check_student_login(p_nin TEXT)
RETURNS TABLE(
  id TEXT, 
  first_name TEXT, 
  last_name TEXT, 
  class_name TEXT, 
  academic_year TEXT, 
  birthdate TEXT, 
  school_id UUID,
  custom_password TEXT
) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY 
  SELECT 
    s.id, 
    s.first_name, 
    s.last_name, 
    s.class_name, 
    s.academic_year, 
    s.birthdate, 
    s.school_id,
    s.custom_password
  FROM public.students s
  WHERE s.nin = p_nin 
    AND s.school_id IS NOT NULL
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;


-- B. Fonction pour récupérer les notes visibles d'un élève (Bypass RLS)
CREATE OR REPLACE FUNCTION public.get_student_visible_grades(p_student_id TEXT)
RETURNS TABLE(
  id UUID, 
  score_final NUMERIC, 
  score_max NUMERIC, 
  updated_at TIMESTAMPTZ, 
  assignment_id TEXT,
  assignment_name TEXT,
  assignment_subject TEXT,
  assignment_trimester TEXT,
  academic_year TEXT
) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY 
  SELECT 
    g.id,
    g.score_final,
    g.score_max,
    g.updated_at,
    a.id as assignment_id,
    a.name as assignment_name,
    a.subject as assignment_subject,
    a.trimester as assignment_trimester,
    a.academic_year as academic_year
  FROM public.grades g
  INNER JOIN public.assignments a ON g.assignment_id = a.id
  WHERE g.student_id = p_student_id
    AND a.is_visible = true
  ORDER BY g.updated_at DESC;
END;
$$ LANGUAGE plpgsql;


-- C. Fonction pour mettre à jour le mot de passe personnalisé d'un élève
CREATE OR REPLACE FUNCTION public.update_student_password(p_student_id TEXT, p_new_password TEXT)
RETURNS VOID
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.students
  SET custom_password = p_new_password,
      updated_at = now()
  WHERE id = p_student_id;
END;
$$ LANGUAGE plpgsql;


-- D. Fonction pour récupérer les infos d'authentification par ID (pour changement de mot de passe)
CREATE OR REPLACE FUNCTION public.get_student_auth_info(p_student_id TEXT)
RETURNS TABLE(
  id TEXT,
  birthdate TEXT,
  custom_password TEXT
)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.birthdate, s.custom_password
  FROM public.students s
  WHERE s.id = p_student_id;
END;
$$ LANGUAGE plpgsql;

UPDATE public.students SET custom_password = NULL WHERE nin = 'LE_NIN_DE_LELEVE';