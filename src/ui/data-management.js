import { settingsAdapter } from '../storage/settings.adapter.js';
import { logout } from './auth.js';
import { supabase } from './supabase-client.js';
import { relationalSyncService } from '../services/relational-sync.service.js';

(function () {
    // Helper to access globals
    const getTranslations = () => window.translations;
    const getLang = () => window.currentLanguage;
    const genId = () => window.genId();
    
    // Expose genId if needed elsewhere, but ideally it should be here
    window.genId = function(length = 16) {
        // Utilisation de l'API Crypto pour une génération robuste et sécurisée
        const charset = 'abcdefghijklmnopqrstuvwxyz0123456789';
        const randomValues = new Uint32Array(length);
        window.crypto.getRandomValues(randomValues);
        let result = '';
        for (let i = 0; i < length; i++) {
            result += charset[randomValues[i] % charset.length];
        }
        return result;
    };

    // Default data structure
    if (!window.data) {
        window.data = {
            students: [],
            assignments: [],
            grades: {} // { studentId: { assignmentId: { exerciseId: { partId: { qId: { sqId: score } } } } } }
        };
    }

    // Flag to prevent saving before loading is complete
    window.isDataLoaded = false;

    // Load from localStorage or Store
    window.loadData = async function() {
        console.log('[DataManagement] Loading data...');
        try {
            const loaded = (window.store && typeof window.store.load === 'function') ? await window.store.load() : null;
            if (loaded) {
                window.data = loaded;
                window.isDataLoaded = true;
                console.log('[DataManagement] Data loaded from store');
            } else {
                // Try localStorage directly if store not available
                const stored = localStorage.getItem('corrections-data');
                if (stored) {
                    window.data = JSON.parse(stored);
                    window.isDataLoaded = true;
                    console.log('[DataManagement] Data loaded from localStorage');
                } else {
                    console.log('[DataManagement] No data found, using defaults');
                    window.isDataLoaded = true; // Still marked as loaded (empty state is valid)
                }
            }
        } catch (e) {
            console.error('[DataManagement] Failed to load data', e);
            // In case of error, we don't set isDataLoaded to true to prevent overwriting Supabase with defaults
        }
    };

    // Save to localStorage or Store
    window.saveData = function() {
        if (!window.isDataLoaded) {
            console.warn('[DataManagement] Save skipped: data not yet loaded');
            return;
        }

        const data = window.data;
        if (window.store && typeof window.store.save === 'function') {
            window.store.save(data);
        } else {
            localStorage.setItem('corrections-data', JSON.stringify(data));
        }
    };

    window.handleJsonExportData = async function() {
        const t = getTranslations()[getLang()];
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        
        const userId = window.currentUser?.email || window.currentUser?.id || 'unknown';
        const userUuid = window.currentUser?.id || null;
        const globalAcademicYear = window.getGlobalAcademicYear();
        
        const filteredStudents = window.data.students.filter(s => 
            ((s.importedBy || 'unknown') === userId || (userUuid && (s.importedBy || 'unknown') === userUuid)) && 
            (s.academicYear || '') === globalAcademicYear
        );
        
        const filteredAssignments = window.data.assignments.filter(a => 
            ((a.createdBy || 'unknown') === userId || (userUuid && (a.createdBy || 'unknown') === userUuid)) && 
            (a.academicYear || '') === globalAcademicYear
        );
        
        // Filtrer les notes pour n'inclure que celles des élèves exportés
        const studentIds = new Set(filteredStudents.map(s => s.id));
        const filteredGrades = {};
        for (const sid of studentIds) {
            if (window.data.grades[sid]) {
                filteredGrades[sid] = window.data.grades[sid];
            }
        }

        const filteredData = {
            students: filteredStudents,
            assignments: filteredAssignments,
            grades: filteredGrades
        };

        const safeUser = userId.split('@')[0].replace(/[^a-z0-9]/gi, '_');
        const safeYear = globalAcademicYear.replace(/[^a-z0-9]/gi, '_');
        const fname = `simpleNotes-backup-${safeUser}-${safeYear}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;

        const teacherMessages = {};
        try {
            const scopes = [];
            for (let band = -1; band <= 10; band++) {
                scopes.push(`obs@${band}`);
                scopes.push(`cons@${band}`);
            }
            scopes.push("obs");
            scopes.push("cons");

            scopes.forEach(scope => {
                const msgs = window.getTeacherMessages ? window.getTeacherMessages(scope) : [];
                if (msgs && msgs.length > 0) {
                    teacherMessages[scope] = msgs;
                }
            });
        } catch (e) {
            console.warn("Erreur export messages Perso:", e);
        }

        const exportPrepConfig = window.exportPrepConfig || (() => {
            try {
                return JSON.parse(localStorage.getItem('corrections-export-config-v1') || '{"byClass":{}}');
            } catch (_) {
                return { byClass: {} };
            }
        })();

        const localSettings = {
            language: localStorage.getItem('corrections-language') || 'fr',
            globalAcademicYear: localStorage.getItem('corrections-global-academic-year') || globalAcademicYear || '',
            globalTrimester: localStorage.getItem('corrections-global-trimester') || '',
            exportPrepConfigRaw: localStorage.getItem('corrections-export-config-v1') || '',
            remarksOverridesRaw: localStorage.getItem('corrections-remarks-overrides-v1') || '',
            teacherLibraryRaw: localStorage.getItem('corrections-teacher-remarks-library-v1') || ''
        };

        let correctionsDataRecords = [];
        if (userUuid) {
            try {
                const { data: rows, error } = await supabase
                    .from('corrections_data')
                    .select('academic_year, data, updated_at')
                    .eq('user_id', userUuid)
                    .order('academic_year', { ascending: true });
                if (!error && Array.isArray(rows)) {
                    correctionsDataRecords = rows.map(r => ({
                        academicYear: r.academic_year,
                        data: r.data || { students: [], assignments: [], grades: {} },
                        updatedAt: r.updated_at || null
                    }));
                }
            } catch (_) {}
        }

        if (correctionsDataRecords.length === 0) {
            correctionsDataRecords = [{
                academicYear: globalAcademicYear,
                data: filteredData,
                updatedAt: now.toISOString()
            }];
        }

        const payload = {
            formatVersion: 2,
            backupType: 'full-teacher-backup',
            data: filteredData,
            currentYearData: filteredData,
            correctionsDataRecords,
            exportPrepConfig,
            teacherMessages,
            localSettings,
            metadata: {
                exportedBy: userId,
                exportedByUuid: userUuid,
                academicYear: globalAcademicYear,
                exportedAt: now.toISOString()
            }
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fname;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    window.handleLanguageChange = async function(newLang) {
        if (!newLang) return;
        console.log('[DataManagement] Changing language to:', newLang);
        
        try {
            // 1. Mettre à jour dans Supabase via settingsAdapter
            if (settingsAdapter && settingsAdapter.saveSettings) {
                await settingsAdapter.saveSettings({ language: newLang });
                console.log('[DataManagement] Language saved to Supabase');
            }
            
            // 2. Mettre à jour en local pour la session actuelle
            localStorage.setItem('corrections-language', newLang);
            
            // 3. Déconnexion (ceci redirigera vers login.html via logout())
            if (typeof logout === 'function') {
                await logout();
            } else {
                window.location.href = '/login.html';
            }
        } catch (error) {
            console.error('Error changing language:', error);
            alert('Erreur lors du changement de langue. Veuillez réessayer.');
        }
    };

    // Attach event listeners when DOM is ready
     const initEventListeners = () => {
         const langSelect = document.getElementById('config-language-select');
         if (langSelect) {
             console.log('[DataManagement] Attaching listener to config-language-select');
             langSelect.addEventListener('change', (e) => {
                 window.handleLanguageChange(e.target.value);
             });
         }

         const importInput = document.getElementById('json-import');
         if (importInput) {
             console.log('[DataManagement] Attaching listener to json-import');
             importInput.addEventListener('change', (e) => {
                 window.handleJsonImportData(e);
             });
         }

         const exportBtn = document.getElementById('btn-export-json');
         if (exportBtn) {
             console.log('[DataManagement] Attaching listener to btn-export-json');
             exportBtn.addEventListener('click', () => {
                 window.handleJsonExportData();
             });
         }
     };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEventListeners);
    } else {
        initEventListeners();
    }

    window.handleJsonImportData = function(event) {
        const t = getTranslations()[getLang()];
        const file = event.target.files[0];
        if (!file) return;

        const userId = window.currentUser?.email || window.currentUser?.id || 'unknown';
        const userUuid = window.currentUser?.id || null;
        const globalAcademicYear = window.getGlobalAcademicYear();

        const reader = new FileReader();
        reader.onload = async function (e) {
            try {
                const importedRaw = JSON.parse(e.target.result);
                const importedData = importedRaw.data || importedRaw;
                const metadata = importedRaw.metadata || {};
                const data = window.data;

                const exportedBy = metadata.exportedBy || null;
                const exportedByUuid = metadata.exportedByUuid || null;
                const sameByEmail = exportedBy && exportedBy === userId;
                const sameByUuid = exportedByUuid && userUuid && exportedByUuid === userUuid;
                const hasIdentity = !!(exportedBy || exportedByUuid);
                const isSameTeacher = sameByEmail || sameByUuid;
                if (hasIdentity && !isSameTeacher) {
                    alert(t.importWrongUserWarning || `Import refusé : ce fichier appartient à un autre professeur (${exportedBy || exportedByUuid}).`);
                    event.target.value = '';
                    return;
                }

                if (importedRaw.formatVersion >= 2 && Array.isArray(importedRaw.correctionsDataRecords)) {
                    const records = importedRaw.correctionsDataRecords
                        .filter(r => r && r.academicYear && r.data)
                        .map(r => ({
                            academicYear: String(r.academicYear),
                            data: {
                                students: Array.isArray(r.data.students) ? r.data.students : [],
                                assignments: Array.isArray(r.data.assignments) ? r.data.assignments : [],
                                grades: r.data.grades && typeof r.data.grades === 'object' ? r.data.grades : {}
                            }
                        }));

                    if (records.length === 0) {
                        throw new Error('Aucune donnée valide dans le backup.');
                    }

                    if (importedRaw.localSettings) {
                        const ls = importedRaw.localSettings;
                        if (ls.language) localStorage.setItem('corrections-language', ls.language);
                        if (ls.globalAcademicYear) localStorage.setItem('corrections-global-academic-year', ls.globalAcademicYear);
                        if (ls.globalTrimester) localStorage.setItem('corrections-global-trimester', ls.globalTrimester);
                        if (typeof ls.exportPrepConfigRaw === 'string' && ls.exportPrepConfigRaw) localStorage.setItem('corrections-export-config-v1', ls.exportPrepConfigRaw);
                        if (typeof ls.remarksOverridesRaw === 'string' && ls.remarksOverridesRaw) localStorage.setItem('corrections-remarks-overrides-v1', ls.remarksOverridesRaw);
                        if (typeof ls.teacherLibraryRaw === 'string' && ls.teacherLibraryRaw) localStorage.setItem('corrections-teacher-remarks-library-v1', ls.teacherLibraryRaw);
                    }

                    if (importedRaw.exportPrepConfig) {
                        window.exportPrepConfig = importedRaw.exportPrepConfig;
                        localStorage.setItem('corrections-export-config-v1', JSON.stringify(importedRaw.exportPrepConfig));
                    }

                    const teacherData = importedRaw.teacherMessages || {};
                    Object.entries(teacherData).forEach(([scope, msgs]) => {
                        if (Array.isArray(msgs) && msgs.length > 0 && window.addTeacherMessage) {
                            msgs.forEach(m => window.addTeacherMessage(scope, m));
                        }
                    });

                    let syncedRows = 0;
                    let failedRows = 0;
                    let relationalSyncedRows = 0;
                    if (userUuid) {
                        for (const rec of records) {
                            try {
                                const { error } = await supabase
                                    .from('corrections_data')
                                    .upsert(
                                        {
                                            user_id: userUuid,
                                            academic_year: rec.academicYear,
                                            data: rec.data,
                                            updated_at: new Date().toISOString()
                                        },
                                        { onConflict: 'user_id,academic_year' }
                                    );
                                if (error) {
                                    failedRows++;
                                } else {
                                    syncedRows++;
                                    try {
                                        await relationalSyncService.sync(rec.data, rec.academicYear);
                                        relationalSyncedRows++;
                                    } catch (_) {}
                                }
                            } catch (_) {
                                failedRows++;
                            }
                        }
                    }

                    const targetYear = globalAcademicYear || metadata.academicYear || records[0].academicYear;
                    const currentRecord = records.find(r => r.academicYear === targetYear) || records[0];
                    window.data = currentRecord.data;
                    window.isDataLoaded = true;
                    window.saveData();

                    let report = `${t.importSuccess || 'Importation terminée'} :\n`;
                    report += `- ${records.length} année(s) restaurée(s)\n`;
                    if (userUuid) {
                        report += `- ${syncedRows} année(s) synchronisée(s) vers la base`;
                        report += `\n- ${relationalSyncedRows} année(s) propagée(s) vers les tables classes/élèves/devoirs/notes`;
                        if (failedRows > 0) report += `\n- ${failedRows} année(s) en échec de synchronisation`;
                    } else {
                        report += `- Restauration locale uniquement`;
                    }
                    alert(report);
                    if (window.softResetUI) window.softResetUI();
                    event.target.value = '';
                    return;
                }

                const clean = (val) => String(val || '').trim();
                const normalizeBirthDate = (val) => {
                    if (val === undefined || val === null) return '';
                    const str = clean(val);
                    if (!str) return '';

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

                let addedStudents = 0;
                let updatedStudents = 0;
                let addedAssignments = 0;
                let ignoredStudents = 0;
                let ignoredAssignments = 0;

                // ========== FUSION DES ÉLÈVES AVEC FILTRAGE STRICT ==========
                if (importedData.students && Array.isArray(importedData.students)) {
                    importedData.students.forEach(importedStudent => {
                        // On n'importe que si l'élève appartient au prof et à l'année scolaire du JSON
                        // OU si le JSON n'a pas ces infos, on vérifie si on veut les "forcer"
                        const studentUser = importedStudent.importedBy || metadata.exportedBy || userId;
                        const studentYear = importedStudent.academicYear || metadata.academicYear || globalAcademicYear;

                        // FILTRE STRICT : On ignore si ça ne correspond pas au prof et à l'année ACTUELS
                        if (studentUser !== userId || studentYear !== globalAcademicYear) {
                            ignoredStudents++;
                            return;
                        }

                        const rawBirthDate = importedStudent.birthDate ?? importedStudent.birthdate ?? importedStudent.birth_date;
                        const normalizedBirthDate = normalizeBirthDate(rawBirthDate);
                        if (normalizedBirthDate) importedStudent.birthDate = normalizedBirthDate;
                        if (importedStudent.birthdate !== undefined) delete importedStudent.birthdate;
                        if (importedStudent.birth_date !== undefined) delete importedStudent.birth_date;

                        const nin = clean(importedStudent.nin);
                        let existing = null;
                        if (nin) {
                            existing = data.students.find(s => 
                                clean(s.nin) === nin && 
                                (s.importedBy || 'unknown') === userId && 
                                (s.academicYear || '') === globalAcademicYear
                            );
                        }

                        if (existing) {
                            const oldId = existing.id;
                            Object.assign(existing, importedStudent);
                            existing.id = oldId;
                            updatedStudents++;

                            if (importedStudent.id !== oldId && importedData.grades && importedData.grades[importedStudent.id]) {
                                if (!data.grades[oldId]) data.grades[oldId] = {};
                                Object.assign(data.grades[oldId], importedData.grades[importedStudent.id]);
                            }
                        } else {
                            data.students.push(importedStudent);
                            addedStudents++;

                            if (importedData.grades && importedData.grades[importedStudent.id]) {
                                data.grades[importedStudent.id] = importedData.grades[importedStudent.id];
                            }
                        }
                    });
                }

                // ========== FUSION DES DEVOIRS AVEC FILTRAGE STRICT ==========
                if (importedData.assignments && Array.isArray(importedData.assignments)) {
                    importedData.assignments.forEach(importedAssignment => {
                        const assignmentUser = importedAssignment.createdBy || metadata.exportedBy || userId;
                        const assignmentYear = importedAssignment.academicYear || metadata.academicYear || globalAcademicYear;

                        // FILTRE STRICT
                        if (assignmentUser !== userId || assignmentYear !== globalAcademicYear) {
                            ignoredAssignments++;
                            return;
                        }

                        const existingAssignment = data.assignments.find(a => 
                            (a.id === importedAssignment.id) || 
                            (a.name === importedAssignment.name && a.className === importedAssignment.className && a.academicYear === globalAcademicYear && a.createdBy === userId)
                        );
                        
                        if (!existingAssignment) {
                            data.assignments.push(importedAssignment);
                            addedAssignments++;
                        } else {
                            Object.assign(existingAssignment, importedAssignment);
                        }
                    });
                }

                // ⭐ IMPORT MESSAGES PERSO (On les importe car ils sont liés à la bibliothèque du prof)
                const teacherData = importedRaw.teacherMessages || importedData.teacherMessages;
                if (teacherData) {
                    Object.entries(teacherData).forEach(([scope, msgs]) => {
                        if (Array.isArray(msgs) && msgs.length > 0) {
                            if (window.addTeacherMessage) {
                                msgs.forEach(m => window.addTeacherMessage(scope, m));
                            }
                        }
                    });
                }

                // ========== FUSION CONFIG EXPORT ==========
                const importedCfg = importedRaw.exportPrepConfig;
                if (importedCfg) {
                    if (!window.exportPrepConfig) window.exportPrepConfig = { byClass: {} };
                    if (importedCfg.byClass) {
                        Object.assign(window.exportPrepConfig.byClass, importedCfg.byClass);
                    }
                }

                window.saveData();
                
                let report = `${t.importSuccess || 'Importation terminée'} :\n`;
                report += `- ${addedStudents} ${t.studentsAdded || 'élèves ajoutés'}\n`;
                report += `- ${updatedStudents} ${t.studentsUpdated || 'élèves mis à jour'}\n`;
                report += `- ${addedAssignments} ${t.assignmentsAdded || 'devoirs ajoutés'}\n`;
                if (ignoredStudents > 0 || ignoredAssignments > 0) {
                    report += `\n⚠️ ${ignoredStudents} élèves et ${ignoredAssignments} devoirs ont été ignorés car ils ne correspondent pas à votre compte (${userId}) ou à l'année (${globalAcademicYear}).`;
                }
                
                alert(report);
                if (window.softResetUI) window.softResetUI();
                
            } catch (err) {
                console.error("Erreur d'importation JSON:", err);
                alert(t.importError || "Erreur lors de l'importation du fichier.");
            }
            event.target.value = ''; // Reset input
        };
        reader.readAsText(file);
    };

})();
