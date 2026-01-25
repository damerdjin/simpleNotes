import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

if (SUPABASE_URL === 'YOUR_SUPABASE_URL') {
    console.error('Veuillez configurer SUPABASE_URL et SUPABASE_ANON_KEY dans src/ui/config.js');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
