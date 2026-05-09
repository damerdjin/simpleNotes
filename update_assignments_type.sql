-- 1. Ajouter la colonne type à la table assignments
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'devoir';

-- 2. Mettre à jour la fonction RPC get_student_visible_grades pour inclure la colonne type
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
