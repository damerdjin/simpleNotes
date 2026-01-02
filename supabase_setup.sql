-- Active l'extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Nettoie les tables existantes pour repartir sur une base propre (ATTENTION : supprime les données)
DROP TABLE IF EXISTS public.schools CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Création de la table users
CREATE TABLE public.users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  school_id UUID,
  city TEXT,
  wilaya TEXT,
  token_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Création de la table schools
CREATE TABLE public.schools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  wilaya TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id),
  approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ajout de la contrainte de clé étrangère
ALTER TABLE public.users ADD CONSTRAINT fk_users_school FOREIGN KEY (school_id) REFERENCES public.schools(id);

-- Index pour la performance
CREATE INDEX users_email_idx ON public.users (email);
CREATE INDEX schools_approved_idx ON public.schools (approved);