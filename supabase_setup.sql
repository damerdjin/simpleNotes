-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop tables if they exist to ensure clean state for setup
DROP TABLE IF EXISTS public.schools CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Create users table
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

-- Create schools table
CREATE TABLE public.schools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  wilaya TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id),
  approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add FK to users
ALTER TABLE public.users ADD CONSTRAINT fk_users_school FOREIGN KEY (school_id) REFERENCES public.schools(id);

-- Indexes
CREATE INDEX users_email_idx ON public.users (email);
CREATE INDEX schools_approved_idx ON public.schools (approved);
