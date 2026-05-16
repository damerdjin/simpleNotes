-- ============================================================
-- subject_teachers : Assigne UN enseignant par (classe, matière, trimestre)
-- Garantit qu'un seul enseignant peut créer des devoirs
-- pour une matière donnée dans une classe sur un trimestre donné.
-- Utile quand les profs changent entre T1, T2, T3.
-- ============================================================

-- 1. Création de la table
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

-- Index pour requêtes rapides
CREATE INDEX IF NOT EXISTS idx_subject_teachers_school ON public.subject_teachers (school_id);
CREATE INDEX IF NOT EXISTS idx_subject_teachers_class ON public.subject_teachers (class_name, academic_year, trimester);
CREATE INDEX IF NOT EXISTS idx_subject_teachers_user ON public.subject_teachers (user_id);

-- 2. Row Level Security
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
