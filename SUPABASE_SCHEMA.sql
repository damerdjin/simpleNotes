-- ==============================================================================
-- SCHEMA SUPABASE COMPLET POUR L'APPLICATION (Mise à jour Juin 2025)
-- Ce fichier contient TOUTES les tables, les politiques de sécurité (RLS)
-- et les fonctions (RPC) nécessaires au bon fonctionnement de l'application.
-- ==============================================================================

-- ==============================================================================
-- 0. TRIGGER : SYNC auth.users → public.users
-- ==============================================================================

-- Ajouter la contrainte NOT NULL sur school_id (décommenter après migration des anciens users)
-- ALTER TABLE public.users ALTER COLUMN school_id SET NOT NULL;
-- Note : La contrainte est appliquée côté application. En base, on garde NULL autorisé
-- pour permettre au trigger de créer l'utilisateur avant que l'école soit créée.

-- Rendre password_hash optionnel (Supabase gère le mot de passe)
ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;

-- Fonction déclenchée à la création d'un utilisateur dans auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, wilaya, city, school_id, created_at)
  VALUES (
    new.id, 
    new.email, 
    NULLIF(TRIM(new.raw_user_meta_data->>'wilaya'), ''),
    NULLIF(TRIM(new.raw_user_meta_data->>'city'), ''),
    NULLIF((new.raw_user_meta_data->>'school_id')::uuid::text, '')::uuid,
    new.created_at
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Politiques RLS pour la table users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

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
  type text default 'devoir',
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
   assignment_type TEXT,
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
    a.type as assignment_type,
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
  subject TEXT NOT NULL DEFAULT '',

  -- IDs des assignments sélectionnés
  cc_assignment_id TEXT NOT NULL DEFAULT '',
  comp_assignment_id TEXT NOT NULL DEFAULT '',
  tp_assignment_id TEXT NOT NULL DEFAULT '',

  -- Configuration des devoirs (format JSONB: {assignmentIds, combine, normalize, targetMax})
  devoir1_config JSONB NOT NULL DEFAULT '{"assignmentIds":[],"combine":"sum","normalize":true,"targetMax":20}'::jsonb,
  devoir2_config JSONB NOT NULL DEFAULT '{"assignmentIds":[],"combine":"sum","normalize":true,"targetMax":20}'::jsonb,

  -- Barème de sortie (sur 20 par défaut)
  out_max NUMERIC NOT NULL DEFAULT 20,

  -- Statistiques calculées lors de la sauvegarde de la config
  average_all  NUMERIC(5,2),  -- moyenne générale de la classe
  average_comp NUMERIC(5,2),  -- moyenne des compositions
  average_cc   NUMERIC(5,2),  -- moyenne des CC
  average_dev  NUMERIC(5,2),  -- moyenne des devoirs
  average_tp   NUMERIC(5,2),  -- moyenne des TP
  min_all      NUMERIC(5,2),  -- note minimale (moyenne générale)
  max_all      NUMERIC(5,2),  -- note maximale (moyenne générale)
  min_comp     NUMERIC(5,2),  -- note minimale composition
  max_comp     NUMERIC(5,2),  -- note maximale composition
  min_dev      NUMERIC(5,2),  -- note minimale devoir
  max_dev      NUMERIC(5,2),  -- note maximale devoir

  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Unicité : un prof ne peut avoir qu'une seule config par classe/trimestre/matière
  CONSTRAINT grade_calculation_configs_unique_key UNIQUE (user_id, academic_year, trimester, class_name, subject)
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
  subject TEXT NOT NULL DEFAULT '',

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

  CONSTRAINT student_final_grades_unique_key UNIQUE (user_id, academic_year, trimester, class_name, subject, student_id)
);

ALTER TABLE public.student_final_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own student final grades"
  ON public.student_final_grades FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- Indexes
CREATE INDEX IF NOT EXISTS idx_grade_calc_configs_lookup
  ON public.grade_calculation_configs(user_id, academic_year, trimester, class_name);

-- (indexes student_final_grades supprimés avec la table)


-- ==============================================================================
-- 7. FONCTIONS RPC POUR LA GESTION DES CONFIGURATIONS DE CALCUL ET NOTES FINALES
-- ==============================================================================

-- A. Sauvegarder la configuration de calcul d'une classe (Upsert)
CREATE OR REPLACE FUNCTION public.save_grade_calculation_config(
  p_class_name TEXT,
  p_subject TEXT,
  p_trimester TEXT,
  p_academic_year TEXT,
  p_cc_assignment_id TEXT DEFAULT '',
  p_comp_assignment_id TEXT DEFAULT '',
  p_tp_assignment_id TEXT DEFAULT '',
  p_devoir1_config JSONB DEFAULT '{"assignmentIds":[],"combine":"sum","normalize":true,"targetMax":20}'::jsonb,
  p_devoir2_config JSONB DEFAULT '{"assignmentIds":[],"combine":"sum","normalize":true,"targetMax":20}'::jsonb,
  p_out_max NUMERIC DEFAULT 20,
  p_is_published BOOLEAN DEFAULT FALSE,
  p_average_all NUMERIC DEFAULT NULL,
  p_average_comp NUMERIC DEFAULT NULL,
  p_average_cc NUMERIC DEFAULT NULL,
  p_average_dev NUMERIC DEFAULT NULL,
  p_average_tp NUMERIC DEFAULT NULL,
  p_min_all NUMERIC DEFAULT NULL,
  p_max_all NUMERIC DEFAULT NULL,
  p_min_comp NUMERIC DEFAULT NULL,
  p_max_comp NUMERIC DEFAULT NULL,
  p_min_dev NUMERIC DEFAULT NULL,
  p_max_dev NUMERIC DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
AS $$
DECLARE
  v_config_id UUID;
BEGIN
  INSERT INTO public.grade_calculation_configs
    (user_id, academic_year, trimester, class_name, subject,
     cc_assignment_id, comp_assignment_id, tp_assignment_id,
     devoir1_config, devoir2_config, out_max, is_published,
     average_all, average_comp, average_cc, average_dev, average_tp,
     min_all, max_all, min_comp, max_comp, min_dev, max_dev)
  VALUES
    (auth.uid(), p_academic_year, p_trimester, p_class_name, p_subject,
     p_cc_assignment_id, p_comp_assignment_id, p_tp_assignment_id,
     p_devoir1_config, p_devoir2_config, p_out_max, p_is_published,
     p_average_all, p_average_comp, p_average_cc, p_average_dev, p_average_tp,
     p_min_all, p_max_all, p_min_comp, p_max_comp, p_min_dev, p_max_dev)
  ON CONFLICT (user_id, academic_year, trimester, class_name, subject)
  DO UPDATE SET
    cc_assignment_id = EXCLUDED.cc_assignment_id,
    comp_assignment_id = EXCLUDED.comp_assignment_id,
    tp_assignment_id = EXCLUDED.tp_assignment_id,
    devoir1_config = EXCLUDED.devoir1_config,
    devoir2_config = EXCLUDED.devoir2_config,
    out_max = EXCLUDED.out_max,
    is_published = EXCLUDED.is_published,
    average_all = EXCLUDED.average_all,
    average_comp = EXCLUDED.average_comp,
    average_cc = EXCLUDED.average_cc,
    average_dev = EXCLUDED.average_dev,
    average_tp = EXCLUDED.average_tp,
    min_all = EXCLUDED.min_all,
    max_all = EXCLUDED.max_all,
    min_comp = EXCLUDED.min_comp,
    max_comp = EXCLUDED.max_comp,
    min_dev = EXCLUDED.min_dev,
    max_dev = EXCLUDED.max_dev,
    updated_at = now()
  RETURNING id INTO v_config_id;

  RETURN v_config_id;
END;
$$ LANGUAGE plpgsql;


-- B. Récupérer la configuration de calcul d'une classe
CREATE OR REPLACE FUNCTION public.get_grade_calculation_config(
  p_class_name TEXT,
  p_subject TEXT,
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
  is_published BOOLEAN,
  average_all NUMERIC,
  average_comp NUMERIC,
  average_cc NUMERIC,
  average_dev NUMERIC,
  average_tp NUMERIC,
  min_all NUMERIC,
  max_all NUMERIC,
  min_comp NUMERIC,
  max_comp NUMERIC,
  min_dev NUMERIC,
  max_dev NUMERIC,
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
    gcc.is_published,
    gcc.average_all,
    gcc.average_comp,
    gcc.average_cc,
    gcc.average_dev,
    gcc.average_tp,
    gcc.min_all,
    gcc.max_all,
    gcc.min_comp,
    gcc.max_comp,
    gcc.min_dev,
    gcc.max_dev,
    gcc.updated_at
  FROM public.grade_calculation_configs gcc
  WHERE gcc.user_id = auth.uid()
    AND gcc.academic_year = p_academic_year
    AND gcc.trimester = p_trimester
    AND gcc.class_name = p_class_name
    AND gcc.subject = p_subject
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;


-- (save_student_final_grades, get_teacher_student_final_grades,
--  delete_student_final_grades, get_student_final_grades_for_dashboard
--  supprimées — calcul des moyennes à la volée côté API)


-- ==============================================================================
-- 7. TABLE subject_teachers (Assignation prof ↔ matière/classe/trimestre)
-- Empêche deux enseignants de créer des devoirs pour la même matière
-- dans la même classe sur un même trimestre.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.subject_teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL,
    user_id UUID NOT NULL,
    class_name TEXT NOT NULL,
    subject TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    trimester TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Un seul enseignant par (école, classe, matière, année, trimestre)
    CONSTRAINT unique_class_subject_trimester UNIQUE (school_id, class_name, subject, academic_year, trimester)
);

CREATE INDEX IF NOT EXISTS idx_subject_teachers_school ON public.subject_teachers (school_id);
CREATE INDEX IF NOT EXISTS idx_subject_teachers_class ON public.subject_teachers (class_name, academic_year, trimester);
CREATE INDEX IF NOT EXISTS idx_subject_teachers_user ON public.subject_teachers (user_id);

ALTER TABLE public.subject_teachers ENABLE ROW LEVEL SECURITY;

-- Lecture : tous les enseignants de l'école voient les assignations
CREATE POLICY "read_subject_teachers" ON public.subject_teachers
    FOR SELECT
    USING (
        school_id IN (
            SELECT school_id FROM public.users WHERE id = auth.uid()
        )
    );

-- Insertion : seul l'enseignant concerné peut s'assigner une matière
CREATE POLICY "insert_subject_teachers" ON public.subject_teachers
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Mise à jour : seul l'enseignant concerné peut modifier
CREATE POLICY "update_subject_teachers" ON public.subject_teachers
    FOR UPDATE
    USING (user_id = auth.uid());

-- Suppression : seul l'enseignant concerné peut supprimer
CREATE POLICY "delete_subject_teachers" ON public.subject_teachers
    FOR DELETE
    USING (user_id = auth.uid());