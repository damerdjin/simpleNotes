
(function () {
    // Helper to access globals
    const getTranslations = () => window.translations;
    const getLang = () => window.currentLanguage;
    const genId = () => window.genId();
    
    // Default data structure
    if (!window.data) {
        window.data = {
            students: [],
            assignments: [],
            grades: {} // { studentId: { assignmentId: { exerciseId: { partId: { qId: { sqId: score } } } } } }
        };
    }

    // Load from localStorage
    window.loadData = function() {
        const loaded = (window.store && typeof window.store.load === 'function') ? window.store.load() : null;
        if (loaded) {
            window.data = loaded;
        } else {
            // Try localStorage directly if store not available
            try {
                const stored = localStorage.getItem('corrections-data');
                if (stored) {
                    window.data = JSON.parse(stored);
                }
            } catch (e) {
                console.warn('Failed to load data from localStorage', e);
            }
        }
    };

    // Save to localStorage
    window.saveData = function() {
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
        const fname = `simpleNotes-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;

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
            console.log("Messages Perso exportés:", teacherMessages);
        } catch (e) {
            console.warn("Erreur export messages Perso:", e);
        }

        const payload = {
            data: window.data,              // tes données existantes
            exportPrepConfig: window.exportPrepConfig,  // config export existante
            teacherMessages    // ⭐ NOUVEAU : messages Perso !
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

    window.handleJsonImportData = function(event) {
        const t = getTranslations()[getLang()];
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const importedRaw = JSON.parse(e.target.result);
                const importedData = importedRaw.data || importedRaw;
                const data = window.data;

                console.log("📦 importedRaw:", importedRaw);
                console.log("📦 importedData:", importedData);

                // Fonction pour nettoyer
                const clean = (val) => String(val || '').trim();

                let added = 0;
                let updated = 0;

                // ========== FUSION DES ÉLÈVES ==========
                if (importedData.students && Array.isArray(importedData.students)) {
                    importedData.students.forEach(importedStudent => {
                        const nin = clean(importedStudent.nin);

                        // Recherche par NIN
                        let existing = null;
                        if (nin) {
                            existing = data.students.find(s => clean(s.nin) === nin);
                        }

                        if (existing) {
                            // Garder l'ancien ID, mettre à jour le reste
                            const oldId = existing.id;
                            Object.assign(existing, importedStudent);
                            existing.id = oldId; // Conserver l'ID original !
                            updated++;

                            // Si l'ID importé est différent, transférer les notes
                            if (importedStudent.id !== oldId && importedData.grades && importedData.grades[importedStudent.id]) {
                                if (!data.grades[oldId]) {
                                    data.grades[oldId] = {};
                                }
                                // Fusionner les notes
                                Object.assign(data.grades[oldId], importedData.grades[importedStudent.id]);
                            }
                        } else {
                            // Nouvel élève
                            data.students.push(importedStudent);
                            added++;

                            // Copier ses notes aussi
                            if (importedData.grades && importedData.grades[importedStudent.id]) {
                                data.grades[importedStudent.id] = importedData.grades[importedStudent.id];
                            }
                        }
                    });
                }

                // ⭐ IMPORT MESSAGES PERSO (vraies clés)
                const teacherData = importedRaw.teacherMessages || importedData.teacherMessages;
                if (teacherData) {
                    console.log("✅ teacherMessages TROUVÉ:", teacherData);

                    Object.entries(teacherData).forEach(([scope, msgs]) => {
                        if (Array.isArray(msgs) && msgs.length > 0) {
                            // 1) window.REMARKS_MESSAGES
                            // On s'assure que addTeacherMessage fonctionnera
                            if (window.addTeacherMessage) {
                                msgs.forEach(m => window.addTeacherMessage(scope, m));
                            }
                            console.log(`✅ ${scope} importé dans la bibliothèque locale`);
                        }
                    });
                    if (window.renderExportPrep) window.renderExportPrep();
                }
                else {
                    console.warn("❌ Pas de teacherMessages");
                }

                // ========== FUSION DES DEVOIRS ==========
                if (importedData.assignments && Array.isArray(importedData.assignments)) {
                    importedData.assignments.forEach(importedAssignment => {
                        const existingAssignment = data.assignments.find(a => a.id === importedAssignment.id);
                        if (!existingAssignment) {
                            data.assignments.push(importedAssignment);
                        }
                    });
                }

                // ========== FUSION CONFIG EXPORT ==========
                const importedCfg = importedRaw.exportPrepConfig;
                if (importedCfg) {
                    // On fusionne intelligemment ou on remplace ?
                    // Ici on remplace si inexistant ou fusionne
                    if (!window.exportPrepConfig) window.exportPrepConfig = { byClass: {} };
                    
                    if (importedCfg.byClass) {
                        Object.assign(window.exportPrepConfig.byClass, importedCfg.byClass);
                    }
                    if (window.saveExportPrepConfig) window.saveExportPrepConfig();
                }

                window.saveData();
                if (window.renderStudents) window.renderStudents();
                if (window.renderAssignments) window.renderAssignments();
                if (window.loadClassSelectors) window.loadClassSelectors();
                
                alert(`${t.importSuccess}\nAjoutés: ${added}\nMis à jour: ${updated}`);
                event.target.value = '';

            } catch (ex) {
                console.error("Erreur import JSON:", ex);
                alert(t.importError || "Erreur lors de l'importation");
            }
        };
        reader.readAsText(file); // JSON is text
    };

})();
