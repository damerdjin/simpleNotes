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
  grade_date timestamptz, -- Ajout de la date au niveau du devoir
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
DROP FUNCTION IF EXISTS public.get_student_visible_grades(TEXT);
CREATE OR REPLACE FUNCTION public.get_student_visible_grades(p_student_id TEXT)
RETURNS TABLE(
   id UUID,
   score_final NUMERIC,
   score_max NUMERIC,
   updated_at TIMESTAMPTZ,
   comments TEXT,
   grade_date TIMESTAMPTZ,
   assignment_id TEXT,
   assignment_name TEXT,
   assignment_subject TEXT,
   assignment_trimester TEXT,
   academic_year TEXT,
   class_avg NUMERIC,
   class_max NUMERIC,
   class_min NUMERIC
)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY 
  WITH class_stats AS (
    SELECT 
      g_inner.assignment_id,
      ROUND(AVG(g_inner.score_final), 2) as class_avg,
      MAX(g_inner.score_final) as class_max,
      MIN(g_inner.score_final) as class_min
    FROM public.grades g_inner
    WHERE g_inner.score_final IS NOT NULL
    GROUP BY g_inner.assignment_id
  )
  SELECT 
    g.id,
    g.score_final,
    g.score_max,
    g.updated_at,
    g.comments,
    a.grade_date,
    a.id as assignment_id,
    a.name as assignment_name,
    a.subject as assignment_subject,
    a.trimester as assignment_trimester,
    a.academic_year as academic_year,
    cs.class_avg,
    cs.class_max,
    cs.class_min
  FROM public.grades g
  INNER JOIN public.assignments a ON g.assignment_id = a.id
  LEFT JOIN class_stats cs ON cs.assignment_id = a.id
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


-- ==============================================================================
-- 6. CONFIGURATIONS DE CALCUL DE MOYENNES (PRÉPARATION DES NOTES)
-- ==============================================================================

-- TABLE grade_calculation_configs
-- Stocke la configuration de calcul des moyennes par classe/trimestre
-- pour la page "Préparation Export/Notes"
CREATE TABLE IF NOT EXISTS public.grade_calculation_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,
  trimester TEXT NOT NULL,
  class_name TEXT NOT NULL,

  -- IDs des assignments sélectionnés
  cc_assignment_id TEXT NOT NULL DEFAULT '',
  comp_assignment_id TEXT NOT NULL DEFAULT '',
  tp_assignment_id TEXT NOT NULL DEFAULT '',

  -- Configuration des devoirs (format JSONB: {assignmentIds, combine, normalize, targetMax})
  devoir1_config JSONB NOT NULL DEFAULT '{"assignmentIds":[],"combine":"sum","normalize":true,"targetMax":20}'::jsonb,
  devoir2_config JSONB NOT NULL DEFAULT '{"assignmentIds":[],"combine":"sum","normalize":true,"targetMax":20}'::jsonb,

  -- Barème de sortie (sur 20 par défaut)
  out_max NUMERIC NOT NULL DEFAULT 20,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (user_id, academic_year, trimester, class_name)
);

ALTER TABLE public.grade_calculation_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own grade calculation configs"
  ON public.grade_calculation_configs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- TABLE student_final_grades
-- Stocke les moyennes calculées, observations et conseils par élève
CREATE TABLE IF NOT EXISTS public.student_final_grades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,
  trimester TEXT NOT NULL,
  class_name TEXT NOT NULL,

  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,

  cc_score NUMERIC,
  tp_score NUMERIC,
  comp_score NUMERIC,
  devoir_score NUMERIC,
  moyenne NUMERIC,

  observation TEXT DEFAULT '',
  advice TEXT DEFAULT '',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (user_id, academic_year, trimester, class_name, student_id)
);

ALTER TABLE public.student_final_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own student final grades"
  ON public.student_final_grades FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- Indexes
CREATE INDEX IF NOT EXISTS idx_grade_calc_configs_lookup
  ON public.grade_calculation_configs(user_id, academic_year, trimester, class_name);

CREATE INDEX IF NOT EXISTS idx_student_final_grades_lookup
  ON public.student_final_grades(user_id, academic_year, trimester, class_name);

CREATE INDEX IF NOT EXISTS idx_student_final_grades_student
  ON public.student_final_grades(student_id);


-- ==============================================================================
-- 7. FONCTIONS RPC POUR LA GESTION DES CONFIGURATIONS DE CALCUL ET NOTES FINALES
-- ==============================================================================

-- A. Sauvegarder la configuration de calcul d'une classe (Upsert)
CREATE OR REPLACE FUNCTION public.save_grade_calculation_config(
  p_class_name TEXT,
  p_trimester TEXT,
  p_academic_year TEXT,
  p_cc_assignment_id TEXT DEFAULT '',
  p_comp_assignment_id TEXT DEFAULT '',
  p_tp_assignment_id TEXT DEFAULT '',
  p_devoir1_config JSONB DEFAULT '{"assignmentIds":[],"combine":"sum","normalize":true,"targetMax":20}'::jsonb,
  p_devoir2_config JSONB DEFAULT '{"assignmentIds":[],"combine":"sum","normalize":true,"targetMax":20}'::jsonb,
  p_out_max NUMERIC DEFAULT 20
)
RETURNS UUID
SECURITY DEFINER
AS $$
DECLARE
  v_config_id UUID;
BEGIN
  INSERT INTO public.grade_calculation_configs
    (user_id, academic_year, trimester, class_name,
     cc_assignment_id, comp_assignment_id, tp_assignment_id,
     devoir1_config, devoir2_config, out_max)
  VALUES
    (auth.uid(), p_academic_year, p_trimester, p_class_name,
     p_cc_assignment_id, p_comp_assignment_id, p_tp_assignment_id,
     p_devoir1_config, p_devoir2_config, p_out_max)
  ON CONFLICT (user_id, academic_year, trimester, class_name)
  DO UPDATE SET
    cc_assignment_id = EXCLUDED.cc_assignment_id,
    comp_assignment_id = EXCLUDED.comp_assignment_id,
    tp_assignment_id = EXCLUDED.tp_assignment_id,
    devoir1_config = EXCLUDED.devoir1_config,
    devoir2_config = EXCLUDED.devoir2_config,
    out_max = EXCLUDED.out_max,
    updated_at = now()
  RETURNING id INTO v_config_id;

  RETURN v_config_id;
END;
$$ LANGUAGE plpgsql;


-- B. Récupérer la configuration de calcul d'une classe
CREATE OR REPLACE FUNCTION public.get_grade_calculation_config(
  p_class_name TEXT,
  p_trimester TEXT,
  p_academic_year TEXT
)
RETURNS TABLE(
  id UUID,
  cc_assignment_id TEXT,
  comp_assignment_id TEXT,
  tp_assignment_id TEXT,
  devoir1_config JSONB,
  devoir2_config JSONB,
  out_max NUMERIC,
  updated_at TIMESTAMPTZ
)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    gcc.id,
    gcc.cc_assignment_id,
    gcc.comp_assignment_id,
    gcc.tp_assignment_id,
    gcc.devoir1_config,
    gcc.devoir2_config,
    gcc.out_max,
    gcc.updated_at
  FROM public.grade_calculation_configs gcc
  WHERE gcc.user_id = auth.uid()
    AND gcc.academic_year = p_academic_year
    AND gcc.trimester = p_trimester
    AND gcc.class_name = p_class_name
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;


-- C. Sauvegarder les notes finales calculées d'une classe (batch upsert)
CREATE OR REPLACE FUNCTION public.save_student_final_grades(
  p_class_name TEXT,
  p_trimester TEXT,
  p_academic_year TEXT,
  p_grades JSONB -- Tableau d'objets: [{student_id, cc_score, tp_score, comp_score, devoir_score, moyenne, observation, advice}]
)
RETURNS VOID
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_item JSONB;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_grades)
  LOOP
    INSERT INTO public.student_final_grades
      (user_id, academic_year, trimester, class_name,
       student_id, cc_score, tp_score, comp_score, devoir_score,
       moyenne, observation, advice)
    VALUES
      (v_user_id, p_academic_year, p_trimester, p_class_name,
       (v_item->>'student_id')::TEXT,
       (v_item->>'cc_score')::NUMERIC,
       (v_item->>'tp_score')::NUMERIC,
       (v_item->>'comp_score')::NUMERIC,
       (v_item->>'devoir_score')::NUMERIC,
       (v_item->>'moyenne')::NUMERIC,
       (v_item->>'observation')::TEXT,
       (v_item->>'advice')::TEXT)
    ON CONFLICT (user_id, academic_year, trimester, class_name, student_id)
    DO UPDATE SET
      cc_score = EXCLUDED.cc_score,
      tp_score = EXCLUDED.tp_score,
      comp_score = EXCLUDED.comp_score,
      devoir_score = EXCLUDED.devoir_score,
      moyenne = EXCLUDED.moyenne,
      observation = EXCLUDED.observation,
      advice = EXCLUDED.advice,
      updated_at = now();
  END LOOP;
END;
$$ LANGUAGE plpgsql;


-- D. Récupérer les notes finales d'une classe (pour le professeur)
CREATE OR REPLACE FUNCTION public.get_teacher_student_final_grades(
  p_class_name TEXT,
  p_trimester TEXT,
  p_academic_year TEXT
)
RETURNS TABLE(
  student_id TEXT,
  cc_score NUMERIC,
  tp_score NUMERIC,
  comp_score NUMERIC,
  devoir_score NUMERIC,
  moyenne NUMERIC,
  observation TEXT,
  advice TEXT,
  updated_at TIMESTAMPTZ
)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sfg.student_id,
    sfg.cc_score,
    sfg.tp_score,
    sfg.comp_score,
    sfg.devoir_score,
    sfg.moyenne,
    sfg.observation,
    sfg.advice,
    sfg.updated_at
  FROM public.student_final_grades sfg
  WHERE sfg.user_id = auth.uid()
    AND sfg.academic_year = p_academic_year
    AND sfg.trimester = p_trimester
    AND sfg.class_name = p_class_name
  ORDER BY sfg.student_id;
END;
$$ LANGUAGE plpgsql;


-- E. Récupérer les notes finales d'un élève (pour le dashboard élève)
-- SECURITY DEFINER: l'élève n'a pas de compte auth, on cherche par student_id
CREATE OR REPLACE FUNCTION public.get_student_final_grades_for_dashboard(p_student_id TEXT)
RETURNS TABLE(
  trimester TEXT,
  class_name TEXT,
  academic_year TEXT,
  cc_score NUMERIC,
  tp_score NUMERIC,
  comp_score NUMERIC,
  devoir_score NUMERIC,
  moyenne NUMERIC,
  observation TEXT,
  advice TEXT,
  updated_at TIMESTAMPTZ
)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sfg.trimester,
    sfg.class_name,
    sfg.academic_year,
    sfg.cc_score,
    sfg.tp_score,
    sfg.comp_score,
    sfg.devoir_score,
    sfg.moyenne,
    sfg.observation,
    sfg.advice,
    sfg.updated_at
  FROM public.student_final_grades sfg
  WHERE sfg.student_id = p_student_id
  ORDER BY sfg.trimester;
END;
$$ LANGUAGE plpgsql;