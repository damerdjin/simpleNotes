import { supabase } from '../ui/supabase-client.js';
import { relationalSyncService } from '../services/relational-sync.service.js';

function getCurrentUserId() {
  const user = window.currentUser;
  if (!user) return null;
  // Log metadata to debug RLS issues
  if (user.user_metadata?.school_id) {
    // console.log('[SupabaseAdapter] User has school_id:', user.user_metadata.school_id);
  } else {
    // console.warn('[SupabaseAdapter] User is missing school_id in metadata');
  }
  return user.id || null;
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
    async saveHistory(studentId, assignmentId, snapshot) {
      try {
        const userId = getCurrentUserId();
        const academicYear = getAcademicYear();
        if (userId && academicYear && studentId && assignmentId) {
          const { error } = await supabase
            .from('grades_history')
            .insert({
              user_id: userId,
              academic_year: academicYear,
              student_id: studentId,
              assignment_id: assignmentId,
              snapshot: snapshot
            });
          if (error) throw error;
        }
      } catch (err) {
        console.warn('[SupabaseAdapter] Save history error:', err);
      }
    },
    async getLatestHistory(studentId, assignmentId) {
      try {
        const userId = getCurrentUserId();
        const academicYear = getAcademicYear();
        if (userId && academicYear && studentId && assignmentId) {
          const { data, error } = await supabase
            .from('grades_history')
            .select('id, snapshot')
            .eq('user_id', userId)
            .eq('academic_year', academicYear)
            .eq('student_id', studentId)
            .eq('assignment_id', assignmentId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (error) throw error;
          return data;
        }
      } catch (err) {
        console.warn('[SupabaseAdapter] Get history error:', err);
      }
      return null;
    },
    async deleteHistory(historyId) {
      try {
        const { error } = await supabase
          .from('grades_history')
          .delete()
          .eq('id', historyId);
        if (error) throw error;
      } catch (err) {
        console.warn('[SupabaseAdapter] Delete history error:', err);
      }
    },
    async getSharedClasses(onlyMine = false) {
      try {
        const academicYear = getAcademicYear();
        const userId = getCurrentUserId();
        if (!userId) return [];

        let query = supabase
          .from('classes')
          .select('name')
          .eq('academic_year', academicYear);

        if (onlyMine) {
          // Join with teacher_classes to get only subscriptions
          const { data: tcData, error: tcError } = await supabase
            .from('teacher_classes')
            .select('class_id')
            .eq('user_id', userId);
          
          if (tcError) throw tcError;
          if (!tcData || tcData.length === 0) return [];
          
          const classIds = tcData.map(tc => tc.class_id);
          query = query.in('id', classIds);
        }

        const { data, error } = await query.order('name');
        
        if (error) return [];
        return data ? data.map(c => c.name) : [];
      } catch (err) {
        // console.warn('[SupabaseAdapter] Get shared classes error:', err);
      }
      return [];
    },
    async getSharedClassStats() {
      try {
        const academicYear = getAcademicYear();
        const { data, error } = await supabase
          .from('students')
          .select('className:class_name')
          .eq('academic_year', academicYear);
        
        if (error) return {};
        
        const stats = {};
        data.forEach(s => {
          stats[s.className] = (stats[s.className] || 0) + 1;
        });
        return stats;
      } catch (err) {
        return {};
      }
    },

    async getSharedStudents(className) {
      try {
        const academicYear = getAcademicYear();
        const userId = getCurrentUserId();
        if (!userId) return [];

        const { data, error, status } = await supabase
          .from('students')
          .select('*')
          .eq('academic_year', academicYear)
          .eq('class_name', className)
          .order('last_name', { ascending: true });
        
        if (error) {
          // Silent failure for shared data to avoid UI noise if SQL not yet applied
          return [];
        }
        // Map back to JS structure
        return data ? data.map(s => ({
          id: s.id,
          name: `${s.last_name || ''} ${s.first_name || ''}`.trim(),
          firstName: s.first_name,
          lastName: s.last_name,
          className: s.class_name,
          birthDate: s.birthdate,
          nin: s.nin,
          regNumber: s.registration_number,
          sex: s.sex,
          academicYear: s.academic_year,
          importedBy: s.user_id
        })) : [];
      } catch (err) {
        // console.warn('[SupabaseAdapter] Get shared students error:', err);
      }
      return [];
    },

    async unsubscribeFromClass(className) {
      try {
        const userId = getCurrentUserId();
        const academicYear = getAcademicYear();
        if (!userId || !academicYear || !className) return;

        // Find the class ID first
        const { data: cls, error: clsError } = await supabase
          .from('classes')
          .select('id')
          .eq('academic_year', academicYear)
          .eq('name', className)
          .maybeSingle();

        if (clsError || !cls) return;

        // Delete the subscription
        const { error } = await supabase
          .from('teacher_classes')
          .delete()
          .eq('user_id', userId)
          .eq('class_id', cls.id);

        if (error) throw error;
      } catch (err) {
        console.warn('[SupabaseAdapter] Unsubscribe error:', err);
      }
    },

    async subscribeToClass(className) {
      try {
        const userId = getCurrentUserId();
        const academicYear = getAcademicYear();
        if (!userId || !academicYear || !className) return;

        // 1. Find the class ID in this school and academic year
        const { data: cls, error: clsError } = await supabase
          .from('classes')
          .select('id')
          .eq('academic_year', academicYear)
          .eq('name', className)
          .maybeSingle();

        if (clsError || !cls) {
          // If class doesn't exist, it will be created via standard student add flow later, 
          // or we could create it here. Let's assume for "Join" it must exist.
          return;
        }

        // 2. Add the subscription
        const { error } = await supabase
          .from('teacher_classes')
          .upsert({
            user_id: userId,
            class_id: cls.id
          }, { onConflict: 'user_id,class_id' });

        if (error) throw error;
      } catch (err) {
        console.warn('[SupabaseAdapter] Subscribe error:', err);
      }
    },

    async deleteSharedClassData(className) {
      try {
        const userId = getCurrentUserId();
        const academicYear = getAcademicYear();
        if (!userId || !academicYear || !className) return;

        // 1. Delete grades for my assignments in this class
        // First get my assignment IDs for this class
        const { data: myAssigns, error: assignError } = await supabase
          .from('assignments')
          .select('id')
          .eq('user_id', userId)
          .eq('academic_year', academicYear)
          .eq('class_name', className);
        
        if (assignError) throw assignError;

        if (myAssigns && myAssigns.length > 0) {
          const assignIds = myAssigns.map(a => a.id);
          
          // Delete my grades for these assignments
          const { error: gradeError } = await supabase
            .from('grades')
            .delete()
            .eq('user_id', userId)
            .in('assignment_id', assignIds);
          
          if (gradeError) throw gradeError;

          // Delete my assignments
          const { error: deleteAssignError } = await supabase
            .from('assignments')
            .delete()
            .eq('user_id', userId)
            .in('id', assignIds);
          
          if (deleteAssignError) throw deleteAssignError;
        }

        console.log(`[SupabaseAdapter] Cleaned up assignments and grades for class ${className}`);
      } catch (err) {
        console.warn('[SupabaseAdapter] deleteSharedClassData error:', err);
      }
    },

    get(key) {
      return localStorage.getItem(key);
    },
    set(key, value) {
      localStorage.setItem(key, value);
    }
  };
}
