-- ==============================================================================
-- MIGRATION : Ajout des colonnes statistiques a grade_calculation_configs
-- ==============================================================================

-- 1. Ajouter les nouvelles colonnes
ALTER TABLE public.grade_calculation_configs
  ADD COLUMN IF NOT EXISTS average_all  NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS average_comp NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS average_cc   NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS average_dev  NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS average_tp   NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS min_all      NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS max_all      NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS min_comp     NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS max_comp     NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS min_dev      NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS max_dev      NUMERIC(5,2);


-- 2. Mettre a jour la fonction RPC save_grade_calculation_config
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


-- 3. Mettre a jour la fonction RPC get_grade_calculation_config
-- Il faut DROP d'abord car le type de retour a change
DROP FUNCTION IF EXISTS public.get_grade_calculation_config(TEXT, TEXT, TEXT, TEXT);

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
