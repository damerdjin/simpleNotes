-- Trigger pour lier auth.users et public.users
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Fonction qui sera exécutée lors de la création d'un utilisateur
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, wilaya, city, school_id, created_at)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'wilaya',
    new.raw_user_meta_data->>'city', -- ou commune
    (new.raw_user_meta_data->>'school_id')::uuid,
    new.created_at
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Le Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Rendre la colonne password_hash optionnelle car Supabase gère le mot de passe
ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;

-- 4. Activer RLS sur public.users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 5. Créer des politiques de sécurité (RLS)
-- Permettre à l'utilisateur de voir son propre profil
CREATE POLICY "Users can view own profile" 
ON public.users FOR SELECT 
USING (auth.uid() = id);

-- Permettre à l'utilisateur de modifier son propre profil
CREATE POLICY "Users can update own profile" 
ON public.users FOR UPDATE 
USING (auth.uid() = id);

-- (Optionnel) Permettre la lecture publique des écoles si nécessaire pour l'inscription
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Schools are viewable by everyone" 
ON public.schools FOR SELECT 
USING (true);

-- Permettre la création d'écoles par les utilisateurs authentifiés
CREATE POLICY "Authenticated users can insert schools" 
ON public.schools FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');
