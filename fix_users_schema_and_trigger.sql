-- Ce fichier corrige le problème des champs NULL lors de l'inscription.
-- À exécuter dans l'éditeur SQL de Supabase.

-- 1. Ajouter la colonne full_name si elle n'existe pas (car elle est envoyée par le frontend)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name TEXT;

-- 2. Mettre à jour la fonction du trigger pour inclure password_hash et full_name
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    id, 
    email, 
    wilaya, 
    city, 
    school_id, 
    password_hash, -- On récupère le hash géré par Supabase Auth
    full_name,     -- On récupère le nom complet
    created_at
  )
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'wilaya',
    new.raw_user_meta_data->>'city', 
    -- Gestion sécurisée de l'ID de l'école (NULL si vide)
    NULLIF(new.raw_user_meta_data->>'school_id', '')::uuid,
    new.encrypted_password, -- C'est ici que le mot de passe est récupéré
    new.raw_user_meta_data->>'full_name',
    new.created_at
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. S'assurer que le trigger est bien actif
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Note sur school_id :
-- Si l'utilisateur choisit "Créer une nouvelle école", school_id sera initialement NULL 
-- car l'école n'existe pas encore au moment de l'inscription.
-- Elle est créée juste après par l'application, qui mettra à jour l'utilisateur.
