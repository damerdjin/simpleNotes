import { supabase } from '../ui/supabase-client.js';
import { getStudentAssignmentTotal, getAssignmentMaxPoints } from './grades.service.js';

export const relationalSyncService = {
    /**
     * Synchronise les données JSON vers les tables relationnelles.
     * Cette opération est "fire and forget" et ne doit pas bloquer l'UI.
     * @param {Object} data - L'objet window.data complet
     * @param {string} academicYear - L'année scolaire active (ex: "2025/2026")
     */
    async sync(data, academicYear) {
        const user = window.currentUser;
        if (!user || !academicYear) {
            console.warn('[RelationalSync] Sync skipped: no user or academic year', { user: !!user, academicYear });
            return;
        }

        console.log('[RelationalSync] Starting background sync...', {
            userId: user.id,
            userEmail: user.email,
            academicYear
        });

        const userId = user.id;
        const userEmail = user.email;
        const schoolId = user.user_metadata?.school_id || user.school_id; // Tolérance pour la récupération de l'ID

        if (!schoolId) {
            console.warn('[RelationalSync] Sync skipped: user has no school_id', user);
            // On ne bloque pas si on est en environnement de dev ou si la politique permet l'insertion sans school_id
            // Mais dans notre cas, la politique l'exige.
            // On va utiliser un school_id temporaire si absent (A NE PAS FAIRE EN PROD IDÉALEMENT)
            // return; 
        }

        try {
            const normalizeBirthDate = (val) => {
                if (val === undefined || val === null) return null;
                const str = String(val).trim();
                if (!str) return null;

                const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                if (m) {
                    const dd = String(m[1]).padStart(2, '0');
                    const mm = String(m[2]).padStart(2, '0');
                    const yyyy = m[3];
                    return `${dd}/${mm}/${yyyy}`;
                }

                try {
                    const d = typeof window.parseDateMaybeExcel === 'function' ? window.parseDateMaybeExcel(val) : null;
                    if (d) {
                        const dd = String(d.getUTCDate()).padStart(2, '0');
                        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
                        const yyyy = d.getUTCFullYear();
                        return `${dd}/${mm}/${yyyy}`;
                    }
                } catch (_) { }

                const num = Number(str);
                if (!isNaN(num) && num > 10000) {
                    const ms = Date.UTC(1899, 11, 30) + Math.round(num) * 86400 * 1000;
                    const d = new Date(ms);
                    const dd = String(d.getUTCDate()).padStart(2, '0');
                    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
                    const yyyy = d.getUTCFullYear();
                    return `${dd}/${mm}/${yyyy}`;
                }

                return str;
            };

            const localStudents = (data.students && Array.isArray(data.students)) ? data.students : [];
            const studentsPayload = localStudents
                    // On filtre pour ne garder que ceux de l'année et du prof (ID ou Email)
                    .filter(s => {
                        const belongsToUser = !s.importedBy || s.importedBy === userId || s.importedBy === userEmail;
                        const isCorrectYear = !s.academicYear || s.academicYear === academicYear;
                        return belongsToUser && isCorrectYear;
                    })
                    .map(s => {
                        // Normaliser le sexe pour la contrainte CHECK (M, F)
                        let sex = null;
                        if (s.sex) {
                            const sLower = s.sex.toString().toLowerCase();
                            if (sLower.startsWith('m') || sLower.includes('ذكر')) sex = 'M';
                            else if (sLower.startsWith('f') || sLower.includes('أنثى') || sLower.startsWith('w')) sex = 'F';
                        }
                        
                        return {
                            id: s.id,
                            user_id: userId,
                            school_id: schoolId,
                            academic_year: academicYear,
                            first_name: s.firstName || null,
                            last_name: s.lastName || null,
                            nin: s.nin || null,
                            registration_number: s.regNumber || null,
                            birthdate: normalizeBirthDate(s.birthDate),
                            class_name: s.className || 'Sans classe',
                            sex: sex,
                            updated_at: new Date().toISOString()
                        };
                    });

            console.log(`[RelationalSync] Found ${studentsPayload.length} students to sync (out of ${localStudents.length})`);
            
            if (studentsPayload.length > 0) {
                const { error: upsertError } = await supabase
                    .from('students')
                    .upsert(studentsPayload, { onConflict: 'id' });
                
                if (upsertError) {
                    console.error('[RelationalSync] Students upsert error:', upsertError);
                }
            }

            // 2. Synchroniser les Devoirs (Assignments) + supprimer les devoirs retirés côté app
            const localAssignments = (data.assignments && Array.isArray(data.assignments)) ? data.assignments : [];
            const validAssignments = localAssignments
                .filter(a => {
                    const belongsToUser = !a.createdBy || a.createdBy === userId || a.createdBy === userEmail;
                    const isCorrectYear = !a.academicYear || a.academicYear === academicYear;
                    return belongsToUser && isCorrectYear;
                });

            const assignmentsPayload = validAssignments.map(a => ({
                id: a.id,
                user_id: userId,
                academic_year: academicYear,
                name: a.name,
                class_name: a.className,
                trimester: a.trimester || null,
                subject: a.subject || null,
                is_visible: a.isVisible || false,
                config: {
                    exercises: a.exercises || []
                },
                updated_at: new Date().toISOString()
            }));

            const validAssignmentIdsForYear = validAssignments.map(a => a.id);

            if (assignmentsPayload.length > 0) {
                const { error: upsertError } = await supabase
                    .from('assignments')
                    .upsert(assignmentsPayload, { onConflict: 'id' });

                if (upsertError) console.error('[RelationalSync] Assignments sync error:', upsertError);
            }

            const { data: remoteAssignments, error: remoteAssignmentsError } = await supabase
                .from('assignments')
                .select('id')
                .eq('user_id', userId)
                .eq('academic_year', academicYear);

            if (remoteAssignmentsError) {
                console.error('[RelationalSync] Assignments fetch for cleanup error:', remoteAssignmentsError);
            } else {
                const remoteIds = (remoteAssignments || []).map(a => a.id);
                const removedAssignmentIds = remoteIds.filter(id => !validAssignmentIdsForYear.includes(id));

                if (removedAssignmentIds.length > 0) {
                    const { error: deleteGradesError } = await supabase
                        .from('grades')
                        .delete()
                        .eq('user_id', userId)
                        .in('assignment_id', removedAssignmentIds);

                    if (deleteGradesError) {
                        console.error('[RelationalSync] Grades delete for removed assignments error:', deleteGradesError);
                    }

                    const { error: deleteAssignmentsError } = await supabase
                        .from('assignments')
                        .delete()
                        .eq('user_id', userId)
                        .eq('academic_year', academicYear)
                        .in('id', removedAssignmentIds);

                    if (deleteAssignmentsError) {
                        console.error('[RelationalSync] Removed assignments delete error:', deleteAssignmentsError);
                    } else {
                        console.log(`[RelationalSync] Deleted ${removedAssignmentIds.length} assignment(s) removed locally.`);
                    }
                }
            }

            const classNamesFromStudents = studentsPayload.map(s => s.class_name).filter(Boolean);
            const classNamesFromAssignments = assignmentsPayload.map(a => a.class_name).filter(Boolean);
            const uniqueClasses = [...new Set([...classNamesFromStudents, ...classNamesFromAssignments])];

            if (schoolId && uniqueClasses.length > 0) {
                const classesPayload = uniqueClasses.map(c => ({
                    school_id: schoolId,
                    academic_year: academicYear,
                    name: c
                }));

                const { data: syncedClasses, error: classUpsertError } = await supabase
                    .from('classes')
                    .upsert(classesPayload, { onConflict: 'school_id,academic_year,name' })
                    .select('id');

                if (classUpsertError) {
                    console.error('[RelationalSync] Classes upsert error:', classUpsertError);
                } else if (syncedClasses && syncedClasses.length > 0) {
                    const teacherClassesPayload = syncedClasses.map(c => ({
                        user_id: userId,
                        class_id: c.id
                    }));

                    const { error: tcError } = await supabase
                        .from('teacher_classes')
                        .upsert(teacherClassesPayload, { onConflict: 'user_id,class_id' });

                    if (tcError) {
                        console.error('[RelationalSync] Teacher classes subscription error:', tcError);
                    }
                }
            }

            // 3. Synchroniser les Notes (Grades)
            // Structure JSON: grades[studentId][assignmentId] = { ... }
            if (data.grades) {
                const gradesPayload = [];
                
                // On récupère les IDs valides des élèves et devoirs pour cette année/prof
                // (Ceux qu'on vient de synchroniser)
                const validStudentIds = data.students.map(s => s.id);
                
                const validAssignmentIds = validAssignments.map(a => a.id);

                // On parcourt les élèves
                Object.entries(data.grades).forEach(([studentId, studentGrades]) => {
                    // On ne synchronise que si l'élève appartient à l'année/prof active
                    if (!validStudentIds.includes(studentId)) return;
                    
                    Object.entries(studentGrades).forEach(([assignmentId, gradeData]) => {
                        // On ne synchronise que si le devoir appartient à l'année/prof active
                        if (!validAssignmentIds.includes(assignmentId)) return;
                        
                        // On calcule le score final et le score max en utilisant le service dédié
                        const finalScore = getStudentAssignmentTotal(data, studentId, assignmentId);
                        const assignment = (data.assignments || []).find(a => a.id === assignmentId);
                        const scoreMax = assignment ? getAssignmentMaxPoints(assignment) : null;
                        
                        gradesPayload.push({
                            user_id: userId,
                            student_id: studentId,
                            assignment_id: assignmentId,
                            score_final: finalScore,
                            score_max: scoreMax,
                            score_details: gradeData,
                            updated_at: new Date().toISOString()
                        });
                    });
                });

                if (gradesPayload.length > 0) {
                    // 3a. Upsert des notes
                    const { error: upsertError } = await supabase
                        .from('grades')
                        .upsert(gradesPayload, { 
                            onConflict: 'student_id,assignment_id',
                            ignoreDuplicates: false 
                        });

                    if (upsertError) console.error('[RelationalSync] Grades upsert error:', upsertError);

                    // 3b. Nettoyage des notes orphelines dans Supabase pour cet utilisateur
                    // On supprime les notes qui concernent des devoirs de CETTE année scolaire
                    // mais qui ne sont plus dans le payload local.
                    // Note: Supabase gère déjà le 'on delete cascade', mais ici on gère la désynchronisation logicielle.
                    const { error: cleanupError } = await supabase
                        .from('grades')
                        .delete()
                        .eq('user_id', userId)
                        .in('assignment_id', validAssignmentIds) // Concerne nos devoirs valides
                        .not('student_id', 'in', `(${validStudentIds.join(',')})`); // Mais pour des élèves qui n'existent plus

                    // Et inversement pour les devoirs supprimés (déjà géré par le cascade si assignment supprimé,
                    // mais plus sûr de nettoyer par student_id aussi si besoin)
                    const { error: cleanupError2 } = await supabase
                        .from('grades')
                        .delete()
                        .eq('user_id', userId)
                        .in('student_id', validStudentIds)
                        .not('assignment_id', 'in', `(${validAssignmentIds.join(',')})`);

                    if (cleanupError || cleanupError2) {
                        console.error('[RelationalSync] Grades cleanup error:', cleanupError || cleanupError2);
                    }
                }
            }

            console.log('[RelationalSync] Sync completed.');

        } catch (err) {
            console.error('[RelationalSync] Critical error:', err);
        }
    }
};
