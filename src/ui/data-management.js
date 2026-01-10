import { settingsAdapter } from '../storage/settings.adapter.js';
import { logout } from './auth.js';

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

    window.handleJsonExportData = function() {
        const t = getTranslations()[getLang()];
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        
        // Récupérer les filtres globaux
        const userId = window.currentUser?.email || window.currentUser?.id || 'unknown';
        const globalAcademicYear = window.getGlobalAcademicYear();
        
        // Filtrer les données à exporter
        const filteredStudents = window.data.students.filter(s => 
            (s.importedBy || 'unknown') === userId && 
            (s.academicYear || '') === globalAcademicYear
        );
        
        const filteredAssignments = window.data.assignments.filter(a => 
            (a.createdBy || 'unknown') === userId && 
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

        // Adapter le nom du fichier avec l'année scolaire et le prof
        const safeUser = userId.split('@')[0].replace(/[^a-z0-9]/gi, '_');
        const safeYear = globalAcademicYear.replace(/[^a-z0-9]/gi, '_');
        const fname = `simpleNotes-${safeUser}-${safeYear}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;

        // === SAUVEGARDE DES MESSAGES PERSO ===
        const teacherMessages = {};
        try {
            // Récupère TOUS les messages Perso par scope/band
            const scopes = [];
            // On scanne tous les types de paliers possibles pour Obs et Cons
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

        // Filtrer l'exportPrepConfig pour n'inclure que les classes exportées
        const exportedClasses = new Set(filteredStudents.map(s => s.className));
        const filteredExportPrepConfig = { 
            globalRemarks: window.exportPrepConfig?.globalRemarks || {},
            byClass: {} 
        };
        
        if (window.exportPrepConfig?.byClass) {
            for (const cls of exportedClasses) {
                if (window.exportPrepConfig.byClass[cls]) {
                    filteredExportPrepConfig.byClass[cls] = window.exportPrepConfig.byClass[cls];
                }
            }
        }

        const payload = {
            data: filteredData,
            exportPrepConfig: filteredExportPrepConfig,
            teacherMessages,
            metadata: {
                exportedBy: userId,
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
        const globalAcademicYear = window.getGlobalAcademicYear();

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const importedRaw = JSON.parse(e.target.result);
                const importedData = importedRaw.data || importedRaw;
                const metadata = importedRaw.metadata || {};
                const data = window.data;

                // --- VALIDATION STRICTE ---
                // Si le fichier contient des métadonnées, on vérifie si elles correspondent au prof et à l'année
                if (metadata.exportedBy && metadata.exportedBy !== userId) {
                    const confirmMsg = t.importWrongUserWarning || `Attention: Ce fichier a été exporté par ${metadata.exportedBy}. Voulez-vous vraiment importer ces données pour votre compte (${userId}) ?`;
                    if (!confirm(confirmMsg)) return;
                }

                // Fonction pour nettoyer
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
