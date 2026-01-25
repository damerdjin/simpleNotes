import { supabase } from '../ui/supabase-client.js';
import { relationalSyncService } from '../services/relational-sync.service.js';

function getCurrentUserId() {
  return window.currentUser?.id || null;
}

function getAcademicYear() {
  const v = window.getGlobalAcademicYear ? window.getGlobalAcademicYear() : null;
  if (v) return v;
  const ls = localStorage.getItem('corrections-global-academic-year');
  return ls || '';
}

export function supabaseAdapter() {
  return {
    async load() {
      const userId = getCurrentUserId();
      const academicYear = getAcademicYear();
      console.log('[SupabaseAdapter] Loading data for', userId, academicYear);
      
      try {
        if (!userId || !academicYear) throw new Error('noctx');
        
        // Utilisation de maybeSingle() pour éviter l'erreur 406/PGRST116 si aucun enregistrement n'existe
        const { data, error, status } = await supabase
          .from('corrections_data')
          .select('data')
          .eq('user_id', userId)
          .eq('academic_year', academicYear)
          .maybeSingle();
        
        if (error) {
          console.error('[SupabaseAdapter] Load error:', error, 'Status:', status);
          throw error;
        }
        
        if (data?.data) {
          console.log('[SupabaseAdapter] Data loaded from Supabase');
          return data.data;
        } else {
          console.log('[SupabaseAdapter] No data found in Supabase for this user/year');
        }
      } catch (err) {
        console.warn('[SupabaseAdapter] Remote load failed, falling back to local storage:', err.message);
      }
      try {
        const s = localStorage.getItem('corrections-data');
        if (s) return JSON.parse(s);
      } catch (_) {}
      return { students: [], assignments: [], grades: {} };
    },
    async save(payload) {
      try {
        const userId = getCurrentUserId();
        const academicYear = getAcademicYear();
        if (userId && academicYear) {
          const { error } = await supabase
            .from('corrections_data')
            .upsert(
              {
                user_id: userId,
                academic_year: academicYear,
                data: payload,
                updated_at: new Date().toISOString()
              },
              { onConflict: 'user_id,academic_year' }
            );
          if (error) throw error;

          // Trigger Relational Sync (Non-blocking)
          relationalSyncService.sync(payload, academicYear).catch(e => console.error('[SupabaseAdapter] Relational sync failed', e));
        }
      } catch (err) {
        console.warn('[SupabaseAdapter] Save error:', err);
      }
      try {
        localStorage.setItem('corrections-data', JSON.stringify(payload));
      } catch (_) {}
    },
    get(key) {
      return localStorage.getItem(key);
    },
    set(key, value) {
      localStorage.setItem(key, value);
    }
  };
}
