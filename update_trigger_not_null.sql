-- Script à exécuter dans l'éditeur SQL Supabase
-- 1. Ajouter la colonne full_name si elle n'existe pas
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name TEXT;

-- 2. S'assurer que password_hash est bien optionnel
ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;

-- 3. Mettre à jour le trigger pour inclure full_name
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, wilaya, city, school_id, full_name, created_at)
  VALUES (
    new.id, 
    new.email, 
    NULLIF(TRIM(new.raw_user_meta_data->>'wilaya'), ''),
    NULLIF(TRIM(new.raw_user_meta_data->>'city'), ''),
    (new.raw_user_meta_data->>'school_id')::uuid,
    NULLIF(TRIM(new.raw_user_meta_data->>'full_name'), ''),
    new.created_at
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Recréer le trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. NOT NULL sur school_id (si pas déjà fait)
ALTER TABLE public.users ALTER COLUMN school_id SET NOT NULL;
