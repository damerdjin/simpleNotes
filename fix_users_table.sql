-- Ce script corrige l'erreur "Database error saving new user" lors de l'inscription.
-- À exécuter dans l'éditeur SQL de Supabase (SQL Editor -> New Query).

-- 1. Rendre la colonne password_hash optionnelle
-- Supabase Auth gère les mots de passe en interne, donc public.users n'a pas besoin de les stocker obligatoirement.
ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;

-- 2. Mettre à jour la fonction du trigger pour être plus robuste
-- Gère les chaînes vides et les erreurs de conversion UUID
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  v_school_id UUID;
  v_wilaya TEXT;
  v_city TEXT;
BEGIN
  -- Convertir les chaînes vides en NULL
  v_wilaya := NULLIF(TRIM(new.raw_user_meta_data->>'wilaya'), '');
  v_city := NULLIF(TRIM(new.raw_user_meta_data->>'city'), '');
  
  -- Gérer school_id de manière sécurisée (éviter erreur "invalid input syntax for type uuid")
  BEGIN
    v_school_id := NULLIF(TRIM(new.raw_user_meta_data->>'school_id'), '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_school_id := NULL;
  END;

  -- Insérer le nouvel utilisateur dans la table publique
  INSERT INTO public.users (id, email, wilaya, city, school_id, created_at)
  VALUES (
    new.id, 
    new.email, 
    v_wilaya,
    v_city, 
    v_school_id,
    new.created_at
  )
  ON CONFLICT (id) DO NOTHING; -- Éviter l'erreur si l'utilisateur existe déjà
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Récréer le trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Vérifier les permissions (au cas où)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON TABLE public.users TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.users TO anon, authenticated;
