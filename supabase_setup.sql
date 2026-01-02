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

-- =============================================
-- 1. NETTOYAGE ET CRÉATION DES TABLES
-- =============================================

DROP TABLE IF EXISTS communes CASCADE;
DROP TABLE IF EXISTS wilayas CASCADE;

-- TABLE : WILAYAS
CREATE TABLE wilayas (
    id VARCHAR(2) PRIMARY KEY, -- Code "01", "02"...
    code VARCHAR(2) NOT NULL UNIQUE, -- Redondant avec ID mais gardé selon ta demande
    name_fr VARCHAR(100) NOT NULL,
    name_ar VARCHAR(100) NOT NULL,
    nb_communes INTEGER NOT NULL CHECK (nb_communes > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wilayas_code ON wilayas(code);

-- TABLE : COMMUNES
CREATE TABLE communes (
    id SERIAL PRIMARY KEY,
    wilaya_id VARCHAR(2) NOT NULL REFERENCES wilayas(id) ON DELETE CASCADE,
    name_fr VARCHAR(150) NOT NULL,
    name_ar VARCHAR(150) NOT NULL, -- On remplira avec le nom FR temporairement si l'AR est manquant
    code_postal VARCHAR(5),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_communes_wilaya_id ON communes(wilaya_id);
CREATE INDEX idx_communes_name_fr ON communes(name_fr);
