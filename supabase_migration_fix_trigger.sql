-- Trigger correction for linking auth.users and public.users
-- Fixes issues with empty strings and ensures robustness

-- 1. Create a more robust function
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  v_school_id UUID;
  v_wilaya TEXT;
  v_city TEXT;
BEGIN
  -- Handle empty strings by converting them to NULL
  v_wilaya := NULLIF(TRIM(new.raw_user_meta_data->>'wilaya'), '');
  v_city := NULLIF(TRIM(new.raw_user_meta_data->>'city'), '');
  
  -- Handle school_id safely
  BEGIN
    v_school_id := NULLIF(TRIM(new.raw_user_meta_data->>'school_id'), '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_school_id := NULL; -- If invalid UUID, set to NULL
  END;

  INSERT INTO public.users (id, email, wilaya, city, school_id, created_at)
  VALUES (
    new.id, 
    new.email, 
    v_wilaya,
    v_city, 
    v_school_id,
    new.created_at
  )
  ON CONFLICT (id) DO NOTHING; -- Prevent errors if user already exists
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Recreate the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Ensure permissions are correct (just in case)
GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

GRANT ALL ON TABLE public.users TO postgres;
GRANT ALL ON TABLE public.users TO service_role;
-- Anon and Authenticated access is controlled by RLS, but they need basic access
GRANT SELECT, INSERT, UPDATE ON TABLE public.users TO anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.users TO authenticated;
