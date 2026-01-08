import { supabase } from '../ui/supabase-client.js';

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

            // 1. Synchroniser les Élèves (Students)
            if (data.students && Array.isArray(data.students)) {
                const studentsPayload = data.students
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
                            academic_year: academicYear,
                            first_name: s.firstName || null,
                            last_name: s.lastName || null,
                            nin: s.nin || null,
                            reg_number: s.regNumber || null,
                            birthdate: normalizeBirthDate(s.birthDate),
                            class_name: s.className || 'Sans classe',
                            sex: sex,
                            updated_at: new Date().toISOString()
                        };
                    });

                console.log(`[RelationalSync] Found ${studentsPayload.length} students to sync (out of ${data.students.length})`);
                
                if (studentsPayload.length > 0) {
                    // 1a. Upsert des élèves présents
                    const { error: upsertError } = await supabase
                        .from('students')
                        .upsert(studentsPayload, { onConflict: 'id' });
                    
                    if (upsertError) {
                        console.error('[RelationalSync] Students upsert error:', upsertError);
                    }

                    // 1b. Suppression des élèves qui ne sont plus dans le payload local pour cette année/prof
                    const studentIds = studentsPayload.map(s => s.id);
                    const { error: deleteError } = await supabase
                        .from('students')
                        .delete()
                        .eq('user_id', userId)
                        .eq('academic_year', academicYear)
                        .not('id', 'in', `(${studentIds.join(',')})`);

                    if (deleteError) {
                        console.error('[RelationalSync] Students deletion sync error:', deleteError);
                    }

                    if (!upsertError && !deleteError) {
                        console.log('[RelationalSync] Students synced successfully (including deletions)');
                    }
                } else {
                    // Si le payload est vide, on supprime tout pour cette année/prof
                    await supabase
                        .from('students')
                        .delete()
                        .eq('user_id', userId)
                        .eq('academic_year', academicYear);
                }
            }

            // 2. Synchroniser les Devoirs (Assignments)
            if (data.assignments && Array.isArray(data.assignments)) {
                const assignmentsPayload = data.assignments
                    .filter(a => {
                        const belongsToUser = !a.createdBy || a.createdBy === userId || a.createdBy === userEmail;
                        const isCorrectYear = !a.academicYear || a.academicYear === academicYear;
                        return belongsToUser && isCorrectYear;
                    })
                    .map(a => ({
                        id: a.id, // TEXT
                        user_id: userId,
                        academic_year: academicYear,
                        name: a.name,
                        class_name: a.className,
                        subject: a.subject || null,
                        config: {
                            maxPoints: a.maxPoints,
                            questions: a.questions,
                            parts: a.parts,
                            defaultGrade: a.defaultGrade
                        },
                        updated_at: new Date().toISOString()
                    }));

                if (assignmentsPayload.length > 0) {
                    const { error } = await supabase
                        .from('assignments')
                        .upsert(assignmentsPayload, { onConflict: 'id' });

                    if (error) console.error('[RelationalSync] Assignments sync error:', error);
                }
            }

            // 3. Synchroniser les Notes (Grades)
            // Structure JSON: grades[studentId][assignmentId] = { ... }
            if (data.grades) {
                const gradesPayload = [];
                
                // On parcourt les élèves
                Object.entries(data.grades).forEach(([studentId, studentGrades]) => {
                    // Vérifier si l'élève existe dans nos données filtrées (optionnel mais plus sûr)
                    // Pour simplifier, on prend tout ce qui est lié à des élèves/devoirs qu'on vient potentiellement de sync
                    
                    Object.entries(studentGrades).forEach(([assignmentId, gradeData]) => {
                        // gradeData contient { final: number, ...détails } ou juste détails
                        // La structure exacte dépend de data-management.js
                        // D'après data-management.js L18: grades: { studentId: { assignmentId: { exerciseId: ... } } }
                        // Et grades.service.js calcule le final.
                        // Ici on stocke le raw JSON dans score_details, et on essaie d'extraire le final s'il est pré-calculé ou stocké.
                        // Dans le système actuel, 'final' n'est pas toujours stocké, il est calculé à la volée.
                        // Mais pour l'affichage élève, on veut le final.
                        // Si le final n'est pas stocké, on devrait le recalculer ici ou le stocker null.
                        // Pour l'instant, stockons le JSON brut.
                        
                        // Petite tentative de récupération de 'final' si présent (parfois stocké pour cache)
                        let finalScore = null;
                        if (typeof gradeData.final === 'number') finalScore = gradeData.final;
                        
                        gradesPayload.push({
                            user_id: userId,
                            student_id: studentId,
                            assignment_id: assignmentId,
                            score_final: finalScore,
                            score_details: gradeData,
                            updated_at: new Date().toISOString()
                        });
                    });
                });

                if (gradesPayload.length > 0) {
                    // Upsert grades. Clé unique (student_id, assignment_id).
                    // Mais on n'a pas mis d'ID explicite dans le payload car c'est auto-généré.
                    // Upsert a besoin de la contrainte unique pour savoir quoi mettre à jour.
                    // On doit spécifier onConflict.
                    const { error } = await supabase
                        .from('grades')
                        .upsert(gradesPayload, { 
                            onConflict: 'student_id,assignment_id',
                            ignoreDuplicates: false 
                        });

                    if (error) console.error('[RelationalSync] Grades sync error:', error);
                }
            }

            console.log('[RelationalSync] Sync completed.');

        } catch (err) {
            console.error('[RelationalSync] Critical error:', err);
        }
    }
};
