
(function () {
    // Helper to access globals
    const getData = () => window.data;
    const getTranslations = () => window.translations;
    const getLang = () => window.currentLanguage;
    const saveData = () => window.saveData();
    const renderSummary = () => { if (typeof window.renderSummary === 'function') window.renderSummary(); };
    const renderAssignments = () => { if (typeof window.renderAssignments === 'function') window.renderAssignments(); };
    const renderExportPrep = () => { if (typeof window.renderExportPrep === 'function') window.renderExportPrep(); };
    const loadClassSelectorsForExport = async () => { if (typeof window.loadClassSelectorsForExport === 'function') await window.loadClassSelectorsForExport(); };
    const translatePage = () => { if (typeof window.translatePage === 'function') window.translatePage(); };
    const genId = () => window.genId();

    // Utility helpers for class names and levels
    window.levelFromClass = (className = '') => {
        const first = className.trim().split(/\s+/)[0] || '';
        const map = {
            'أولى': 1, 'اولى': 1, '1ere': 1, '1ère': 1, '1': 1,
            'ثانية': 2, '2nde': 2, '2': 2,
            'ثالثة': 3, '3eme': 3, '3ème': 3, '3': 3,
            'رابعة': 4, '4eme': 4, '4ème': 4, '4': 4,
            'خامسة': 5, '5eme': 5, '5ème': 5, '5': 5,
            'سادسة': 6, '6eme': 6, '6ème': 6, '6': 6
        };
        const key = first.toLowerCase();
        return map[key] || '?';
    };

    window.cleanClassName = (className = '') => {
        let parts = className.trim().split(/\s+/);
        if (parts.length === 0) return '';
        
        const first = parts[0].toLowerCase();
        const levels = [
            'أولى', 'اولى', '1ere', '1ère', '1',
            'ثانية', '2nde', '2',
            'ثالثة', '3eme', '3ème', '3',
            'رابعة', '4eme', '4ème', '4',
            'خامسة', '5eme', '5ème', '5',
            'سادسة', '6eme', '6ème', '6'
        ];
        
        if (levels.includes(first)) {
            parts.shift();
            if (parts.length > 0) {
                const second = parts[0].toLowerCase();
                if (['ثانوي', 'secondary', 'année', 'annee'].includes(second)) {
                    parts.shift();
                }
            }
        }
        return parts.join(' ');
    };

    // Internal references for backward compatibility within this file
    const levelFromClass = window.levelFromClass;
    const cleanClassName = window.cleanClassName;

    const studentsUiState = window.studentsUiState || { selectedClass: '', page: 1, pageSize: 12 };
    window.studentsUiState = studentsUiState;

    // ===== CLASSES =====
    window.getClasses = async function() {
        // On combine les classes locales du JSON et les classes auxquelles le prof est abonné
        const localClasses = new Set();
        const globalAcademicYear = window.getGlobalAcademicYear();
        const userId = window.currentUser?.email || window.currentUser?.id || 'unknown';
        
        (getData().students || []).forEach(s => {
            // On s'assure que la classe appartient bien à CE professeur en regardant qui l'a importée
            if ((s.importedBy || 'unknown') === userId && s.className && globalAcademicYear && s.academicYear === globalAcademicYear) {
                localClasses.add(s.className);
            }
        });

        // Récupération des classes partagées auxquelles le prof est EXPLICITEMENT abonné
        let sharedClasses = [];
        if (window.store && typeof window.store.getSharedClasses === 'function') {
            // true pour ne récupérer que les classes de l'enseignant (via teacher_classes)
            sharedClasses = await window.store.getSharedClasses(true);
        }

        const allClasses = new Set([...localClasses, ...sharedClasses]);
        return Array.from(allClasses).sort();
    };

    window.getAcademicYears = function() {
        const years = new Set();
        (getData().students || []).forEach(s => {
            if (s.academicYear) years.add(s.academicYear);
        });
        return Array.from(years).sort();
    };

    window.loadClassSelectors = async function() {
        const classes = await window.getClasses();
        const academicYears = window.getAcademicYears();
        const t = getTranslations()[getLang()];

        // For grades tab
        const gradesSelect = document.getElementById('select-class-grades');
        if (gradesSelect) {
            const currentValue = gradesSelect.value;
            gradesSelect.innerHTML = '<option value="">-- ' + t.selectClass + ' --</option>' +
                classes.map(c => `<option value="${c}" ${c === currentValue ? 'selected' : ''}>${c}</option>`).join('');
        }

        // For summary tab
        const summarySelect = document.getElementById('select-class-summary');
        if (summarySelect) {
            const currentValue = summarySelect.value;
            summarySelect.innerHTML = '<option value="">-- ' + t.selectClass + ' --</option>' +
                classes.map(c => `<option value="${c}" ${c === currentValue ? 'selected' : ''}>${c}</option>`).join('');
        }

        // For assignment modal
        const assignmentSelect = document.getElementById('assignment-class');
        if (assignmentSelect) {
            const currentValue = assignmentSelect.value;
            assignmentSelect.innerHTML = `<option value="">${t.selectClass}</option>` +
                classes.map(c => `<option value="${c}" ${c === currentValue ? 'selected' : ''}>${c}</option>`).join('');
        }

        const filterStudentsSelect = document.getElementById('filter-class-students');
        if (filterStudentsSelect) {
            const currentValue = filterStudentsSelect.value || studentsUiState.selectedClass || '';
            filterStudentsSelect.innerHTML = '<option value="">' + (t.allClasses || '-- Toutes les classes --') + '</option>' +
                classes.map(c => `<option value="${c}" ${c === currentValue ? 'selected' : ''}>${c}</option>`).join('');
            studentsUiState.selectedClass = filterStudentsSelect.value;
        }
    };

    window.loadClassSelectorsForAssignments = async function() {
        const classes = await window.getClasses();
        const t = getTranslations()[getLang()]; 

        // For assignments filter
        const filterSelect = document.getElementById('filter-class-assignments');
        if (filterSelect) {
            const currentValue = filterSelect.value;
            filterSelect.innerHTML = '<option value="">-- ' + (t.allClasses || 'Toutes les classes') + ' --</option>' +
                classes.map(c => `<option value="${c}" ${c === currentValue ? 'selected' : ''}>${c}</option>`).join('');
        }
    };

    window.renderClassList = async function() {
        const t = getTranslations()[getLang()];
        const isAr = getLang() === 'ar';
        const container = document.getElementById('students-class-list');
        if (!container) return;

        const globalAcademicYear = window.getGlobalAcademicYear();
        if (!globalAcademicYear) {
            container.innerHTML = `<div class="col-span-full text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <p class="text-slate-500 font-medium">${t.selectAcademicYear}</p>
            </div>`;
            return;
        }

        const search = (document.getElementById('students-class-search')?.value || '').toLowerCase();
        const allClasses = await window.getClasses();
        const classes = allClasses.filter(c => c.toLowerCase().includes(search));
        
        // 1. Get Shared Class Stats
        let sharedStats = {};
        if (window.store && typeof window.store.getSharedClassStats === 'function') {
            sharedStats = await window.store.getSharedClassStats();
        }

        if (classes.length === 0) {
            container.innerHTML = `<div class="col-span-full text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                </div>
                <p class="text-slate-500 font-medium">${t.noClassesAutoCreated}</p>
                <button onclick="openStudentModal()" class="mt-4 text-blue-600 font-bold hover:underline">
                    + ${t.addStudent}
                </button>
            </div>`;
            return;
        }

        const userId = window.currentUser?.email || window.currentUser?.id || 'unknown';
        
        const rows = classes.map(c => {
            // Count local students (excluding archived)
            const localStudents = getData().students.filter(s => s.className === c && s.status !== 'archived' && (s.importedBy || 'unknown') === userId && (s.academicYear || '') === globalAcademicYear);
            
            // Shared Stats now contains { total, boys, girls } (already filtered from archived in adapter)
            const sharedStat = sharedStats[c] || { total: 0, boys: 0, girls: 0 };
            
            // Si on n'a pas d'élèves locaux, on prend les stats partagées (cloud)
            // Sinon on prend les locaux (on suppose qu'ils sont synchronisés)
            const count = Math.max(localStudents.length, sharedStat.total);
            
            let boys = 0;
            let girls = 0;

            if (localStudents.length > 0) {
                // Calcul local
                boys = localStudents.filter(s => {
                    const sex = (s.sex || '').toLowerCase().trim();
                    return sex === 'm' || sex === 'male' || sex === 'garçon' || sex === 'homme' || sex === 'boy' || sex.includes('ذكر');
                }).length;
                
                girls = localStudents.filter(s => {
                    const sex = (s.sex || '').toLowerCase().trim();
                    return sex === 'f' || sex === 'female' || sex === 'fille' || sex === 'femme' || sex === 'girl' || sex.includes('أنثى') || sex.includes('انثى');
                }).length;
            } else {
                // Calcul basé sur les stats du cloud
                boys = sharedStat.boys;
                girls = sharedStat.girls;
            }

            const color = typeof window.getClassColor === 'function' ? window.getClassColor(c) : '#3b82f6';
            const colorAlpha = color + '44'; // 25% opacity for shadow
            
            // Get level for icon instead of first 2 chars
            const levelIcon = levelFromClass(c);

            // Arabic Pluralization & Styling
            let countTextDesktop = `${count} ${t.studentsCountLabel || 'élèves'}`;
            if (isAr) {
                if (count === 0) countTextDesktop = 'لا يوجد طلاب';
                else if (count === 1) countTextDesktop = 'طالب واحد';
                else if (count === 2) countTextDesktop = 'طالبان';
                else if (count <= 10) countTextDesktop = `${count} طلاب`;
                else countTextDesktop = `${count} طالباً`;
            }
            const countLabel = `<span class="sm:hidden font-black text-xs">${count}</span><span class="hidden sm:inline">${countTextDesktop}</span>`;

            const originClass = isAr ? 'origin-right' : 'origin-left';
            
            // LOGIQUE DE TAILLE DE POLICE DYNAMIQUE
            const cleanedName = cleanClassName(c);
            let fontSizeClass = isAr ? 'text-[13px] sm:text-2xl' : 'text-sm sm:text-2xl';
            if (cleanedName.length > 25) fontSizeClass = 'text-[10px] sm:text-lg leading-tight';
            else if (cleanedName.length > 15) fontSizeClass = 'text-xs sm:text-xl leading-snug';

            const titleClass = isAr ? `${fontSizeClass} font-bold leading-normal` : `${fontSizeClass} font-black leading-tight tracking-tight`;
            
            // Fix RTL Animations
            const translateClass = isAr ? 'sm:-translate-x-4' : 'sm:translate-x-4';
            
            // CRITICAL FIX: The global CSS .rtl-layout .flex { flex-direction: row-reverse } breaks everything.
            // We must force the correct direction with !important to override it.
            const flexColFix = 'display: flex !important; flex-direction: column !important;';
            const flexRowFix = 'display: flex !important; flex-direction: row !important;';

            return `
                <div onclick="setStudentsSelectedClass('${c}')" 
                    class="class-card-modern group relative bg-white p-3 sm:p-6 rounded-2xl sm:rounded-[2rem] border-2 transition-all duration-500 cursor-pointer overflow-hidden flex flex-col h-full hover:-translate-y-2"
                    style="--card-color: ${color}; --card-color-alpha: ${colorAlpha};">
                    
                    <!-- Decorative background blob -->
                    <div class="absolute -start-8 -top-8 w-32 h-32 rounded-full opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-700 group-hover:scale-150" style="background: ${color}"></div>
                    
                    <div class="relative z-10 flex flex-col h-full" style="${flexColFix}">
                        <div class="flex items-start justify-between mb-2 sm:mb-6" style="${flexRowFix}">
                            <div class="flex flex-col gap-1">
                                <span class="inline-flex items-center px-2 py-0.5 sm:px-3 sm:py-1 bg-slate-50 text-slate-500 rounded-full text-[9px] sm:text-[10px] font-bold border border-slate-100 group-hover:bg-[var(--card-color)] group-hover:text-white group-hover:border-transparent transition-all duration-300">
                                    ${countLabel}
                                </span>
                            </div>
                            
                            <div class="flex items-center gap-1 sm:gap-2" style="${flexRowFix}">
                                <button onclick="event.stopPropagation(); deleteClassSafely('${c}')" 
                                    class="p-1 sm:p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-lg sm:rounded-xl transition-all duration-300 sm:opacity-0 sm:group-hover:opacity-100 transform ${translateClass} sm:group-hover:translate-x-0"
                                    title="${t.delete}">
                                    <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                                <div class="level-badge w-8 h-8 sm:w-14 sm:h-14 rounded-lg sm:rounded-2xl flex items-center justify-center text-sm sm:text-2xl font-black text-white transform group-hover:rotate-6 transition-all duration-500 shadow-sm sm:shadow-md">
                                    ${levelIcon}
                                </div>
                            </div>
                        </div>
                        
                        <div class="flex-grow flex flex-col justify-center py-1 sm:py-4" style="${flexColFix}">
                            <h3 class="card-title-hover ${titleClass} text-slate-800 transition-colors duration-300 line-clamp-3 sm:line-clamp-2 break-words" style="word-break: break-word;" title="${c}">
                                ${cleanClassName(c)}
                            </h3>
                        </div>

                        <div class="mt-2 sm:mt-4 pt-2 sm:pt-5 border-t border-slate-50 flex items-center justify-between gap-1" style="${flexRowFix}">
                            <div class="flex items-center gap-1 text-slate-400 font-bold text-[8px] sm:text-[10px] uppercase tracking-wider" style="${flexRowFix}">
                                <svg class="hidden sm:block w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                ${globalAcademicYear}
                            </div>
                            <div class="flex items-center gap-1.5 sm:gap-2" style="${flexRowFix}">
                                <span class="flex items-center gap-0.5 sm:gap-1.5 text-blue-500 font-black text-[9px] sm:text-[10px]" style="${flexRowFix}">
                                    <span class="text-[10px] sm:text-xs">♂️</span>${boys}
                                </span>
                                <span class="flex items-center gap-0.5 sm:gap-1.5 text-pink-500 font-black text-[9px] sm:text-[10px]" style="${flexRowFix}">
                                    <span class="text-[10px] sm:text-xs">♀️</span>${girls}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Bottom accent bar -->
                    <div class="bottom-bar absolute bottom-0 start-0 w-full h-1.5 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ${originClass}"></div>
                </div>
            `;
        }).join('');

        container.innerHTML = rows;
    };

    window.setStudentsSelectedClass = async function(className = '', options = {}) {
        const prevClass = studentsUiState.selectedClass || '';
        const newClass = className || '';

        // Éviter les appels redondants
        if (newClass === prevClass && !options.force) {
            return;
        }

        studentsUiState.selectedClass = newClass;
        studentsUiState.page = 1;
        
        const viewClasses = document.getElementById('students-view-classes');
        const viewList = document.getElementById('students-view-list');
        
        if (newClass) {
            // Gérer l'historique si ce n'est pas un retour en arrière
            if (!options.skipHistory) {
                history.pushState({ tab: 'students', subView: 'class-list', className: newClass }, '');
            }

            // Show List View
            if (viewClasses) viewClasses.classList.add('hidden');
            if (viewList) viewList.classList.remove('hidden');
            
            // Update Header
            const titleEl = document.getElementById('selected-class-title');
            const titleCompactEl = document.getElementById('selected-class-title-compact');
            const statsEl = document.getElementById('selected-class-stats');
            
            if (titleEl) {
                titleEl.textContent = newClass;
                if (titleCompactEl) titleCompactEl.textContent = newClass;
                
                // Ajuster la police si le nom est trop long
                if (newClass.length > 25) {
                    titleEl.classList.remove('text-xl', 'sm:text-2xl');
                    titleEl.classList.add('text-base', 'sm:text-lg');
                } else if (newClass.length > 15) {
                    titleEl.classList.remove('text-xl', 'sm:text-2xl');
                    titleEl.classList.add('text-lg', 'sm:text-xl');
                } else {
                    titleEl.classList.add('text-xl', 'sm:text-2xl');
                }
            }
            if (statsEl) {
                     const userId = window.currentUser?.email || window.currentUser?.id || 'unknown';
                     const globalAcademicYear = window.getGlobalAcademicYear();
                     
                     // Get Local Students
                     const localStudents = getData().students.filter(s => s.className === newClass && (s.importedBy || 'unknown') === userId && (s.academicYear || '') === globalAcademicYear);

                     // Merge with Shared Students to get the accurate total count for the header
                     const studentMap = new Map();
                     localStudents.forEach(s => studentMap.set(s.id, s));

                     if (window.store && typeof window.store.getSharedStudents === 'function') {
                         const sharedStudents = await window.store.getSharedStudents(newClass);
                         sharedStudents.forEach(s => {
                             const existing = Array.from(studentMap.values()).find(ls => ls.id === s.id || (ls.regNumber && ls.regNumber === s.regNumber));
                             if (!existing) studentMap.set(s.id, s);
                         });
                     }

                     const allStudents = Array.from(studentMap.values());
                     const activeStudentsCount = allStudents.filter(s => s.status !== 'archived').length;
                     const archivedStudentsCount = allStudents.length - activeStudentsCount;
                     
                     const t = getTranslations()[getLang()];
                     let countLabel = `${activeStudentsCount} ${t.studentsCountLabel || 'élèves'}`;
                     if (getLang() === 'ar') {
                         if (activeStudentsCount === 0) countLabel = 'لا يوجد طلاب';
                         else if (activeStudentsCount === 1) countLabel = 'طالب واحد';
                         else if (activeStudentsCount === 2) countLabel = 'طالبان';
                         else if (activeStudentsCount <= 10) countLabel = `${activeStudentsCount} طلاب`;
                         else countLabel = `${activeStudentsCount} طالباً`;
                     }

                     // Add the archived mention in the title if there are any
                     if (archivedStudentsCount > 0) {
                         const archivedMention = (t.archivedCount || '(dont ${count} archivés)').replace('${count}', archivedStudentsCount);
                         countLabel += ` <span class="text-amber-500 lowercase font-medium ml-1">${archivedMention}</span>`;
                     }

                     statsEl.innerHTML = countLabel;
                 }
            
            await window.renderStudents();
        } else {
            // Si on demande la liste des classes (className vide)
            // On pousse un état si on vient d'une classe et qu'on n'est pas en train de faire un retour
            if (!options.skipHistory && prevClass !== '') {
                history.pushState({ tab: 'students', subView: null }, '');
            }
            
            // Show Classes View
            if (viewList) viewList.classList.add('hidden');
            if (viewClasses) viewClasses.classList.remove('hidden');
            await window.renderClassList();
        }
    };

    window.toggleStudentsFab = function() {
        const btn = document.getElementById('students-fab-btn');
        const options = document.getElementById('students-fab-options');
        if (!btn || !options) return;
        
        btn.classList.toggle('open');
        options.classList.toggle('hidden');
        options.classList.toggle('flex');
    };

    window.clearStudentsFilters = async function() {
        if (studentsUiState.selectedClass) {
            // Sur mobile, history.back() est le comportement attendu pour rester synchrone
            // avec le bouton retour du système.
            history.back();
            
            // Fallback au cas où history.back() ne déclencherait pas popstate immédiatement
            // ou si on est à la fin de la pile d'historique de l'app
            setTimeout(async () => {
                if (studentsUiState.selectedClass) {
                    await window.setStudentsSelectedClass('', { skipHistory: true });
                }
            }, 100);
            return;
        }
        
        studentsUiState.selectedClass = '';
        studentsUiState.page = 1;
        const search = document.getElementById('student-search');
        if (search) search.value = '';
        
        // Return to dashboard
        await window.setStudentsSelectedClass('', { skipHistory: true });
    };

    window.setStudentsPageSize = async function(value) {
        const n = Number(value);
        studentsUiState.pageSize = Number.isFinite(n) && n > 0 ? n : 48;
        studentsUiState.page = 1;
        await window.renderStudents();
    };

    window.goStudentsPage = async function(page) {
        const p = Number(page);
        studentsUiState.page = Number.isFinite(p) && p > 0 ? p : 1;
        await window.renderStudents();
    };

    window.deleteClassSafely = async function(className) {
        const t = getTranslations()[getLang()];
        const promptText = `${t.deleteClassConfirm} "${className}"\n\n${t.confirmActionPrompt || 'Pour confirmer, tapez : '}${t.confirmActionWord || 'OUI'}`;
        const typed = prompt(promptText);
        if (typed && typed.toUpperCase() !== (t.confirmActionWord || 'OUI').toUpperCase()) return;
        if (!typed) return;
        window.deleteClass(className);
        await window.loadClassSelectors();
        await window.renderClassList();
    };

    window.deleteClass = async function(className) {
        const t = getTranslations()[getLang()];
        const data = getData();
        const userId = window.currentUser?.email || window.currentUser?.id || 'unknown';
        
        // On vérifie si le prof a des élèves importés localement dans cette classe
        const localCount = data.students.filter(s => s.className === className && (s.importedBy || 'unknown') === userId).length;
        
        if (!confirm(`${t.deleteClassConfirm} "${className}" ?`)) return;

        // --- MODÈLE COLLABORATIF ---
        // On ne supprime plus les élèves du JSON local systématiquement car ils sont partagés.
        // On se contente de se désabonner de la classe dans Supabase.
        
        if (window.store && typeof window.store.unsubscribeFromClass === 'function') {
            await window.store.unsubscribeFromClass(className);
        }

        // Nettoyage Cloud : Supprimer les devoirs et notes du prof pour cette classe
        if (window.store && typeof window.store.deleteSharedClassData === 'function') {
            await window.store.deleteSharedClassData(className);
        }

        // --- NETTOYAGE LOCAL (JSON) ---
        
        // 1. Supprimer TOUS les élèves de cette classe de mon JSON local
        // (Qu'ils m'appartiennent ou qu'ils aient été injectés via un Smart Merge depuis un autre prof)
        data.students = data.students.filter(s => s.className !== className);

        // 2. Supprimer mes devoirs pour cette classe
        const myAssignmentIds = (data.assignments || [])
            .filter(a => a.className === className && (a.createdBy || 'unknown') === userId)
            .map(a => a.id);
        
        if (data.assignments) {
            data.assignments = data.assignments.filter(a => !myAssignmentIds.includes(a.id));
        }

        // 3. Supprimer les notes associées à ces devoirs (dans le JSON)
        if (data.grades) {
            Object.keys(data.grades).forEach(studentId => {
                myAssignmentIds.forEach(assignId => {
                    if (data.grades[studentId][assignId]) {
                        delete data.grades[studentId][assignId];
                    }
                });
                // Si l'élève n'a plus aucune note du tout, on pourrait nettoyer l'entrée, 
                // mais on reste prudent pour l'instant.
            });
        }

        // 4. Nettoyer la configuration d'export (Rakmana)
        if (typeof window.deleteClassDataFromExport === 'function') {
            window.deleteClassDataFromExport(className);
        }

        saveData();

        await window.renderStudents();
        await window.renderClassList();
        await window.loadClassSelectors();
        await window.loadClassSelectorsForAssignments();
        renderSummary();
        renderAssignments();
    };

    // ===== JOIN CLASS (COLLABORATIVE) =====

    window.openJoinClassModal = async function() {
        const modal = document.getElementById('join-class-modal');
        if (modal) {
            modal.classList.add('active');
            modal.classList.remove('pointer-events-none', 'opacity-0');
            modal.classList.add('opacity-100');
            modal.querySelector('div').classList.remove('scale-95');
            modal.querySelector('div').classList.add('scale-100');
            
            // Clear search
            const search = document.getElementById('join-class-search');
            if (search) search.value = '';
            
            await window.renderJoinClassList();
        }
    };

    window.closeJoinClassModal = function() {
        const modal = document.getElementById('join-class-modal');
        if (modal) {
            modal.classList.remove('active');
            modal.classList.add('pointer-events-none', 'opacity-0');
            modal.classList.remove('opacity-100');
            modal.querySelector('div').classList.add('scale-95');
            modal.querySelector('div').classList.remove('scale-100');
        }
    };

    window.renderJoinClassList = async function() {
        const container = document.getElementById('join-class-list');
        const t = getTranslations()[getLang()];
        if (!container) return;

        container.innerHTML = `<div class="col-span-full flex items-center justify-center py-12">
            <div class="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>`;

        try {
            // 1. Get ALL classes of the school
            const allSchoolClasses = await window.store.getSharedClasses(false);
            // 2. Get MY classes (already joined)
            const myClasses = await window.store.getSharedClasses(true);
            const myClassesSet = new Set(myClasses);

            const searchTerm = document.getElementById('join-class-search')?.value.trim().toLowerCase() || '';
            const filteredClasses = allSchoolClasses.filter(c => c.toLowerCase().includes(searchTerm));

            if (filteredClasses.length === 0) {
                container.innerHTML = `<div class="col-span-full text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <p class="text-slate-500 font-medium">${t.noClassesFound || 'Aucune classe trouvée'}</p>
                </div>`;
                return;
            }

            container.innerHTML = filteredClasses.map(className => {
                const isJoined = myClassesSet.has(className);
                const color = typeof window.getClassColor === 'function' ? window.getClassColor(className) : '#3b82f6';
                
                return `
                    <div class="p-4 rounded-2xl border-2 ${isJoined ? 'border-slate-100 bg-slate-50 opacity-75' : 'border-slate-100 hover:border-blue-200 hover:bg-blue-50/30'} transition-all group flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-sm" style="background-color: ${color}">
                                ${className.substring(0, 2).toUpperCase()}
                            </div>
                            <span class="font-bold text-slate-700">${className}</span>
                        </div>
                        ${isJoined ? `
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-200 px-2 py-1 rounded-lg">${t.alreadyJoined}</span>
                        ` : `
                            <button onclick="joinClass('${className}')" class="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md shadow-blue-500/20 transition-all hover:scale-110 active:scale-90">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                            </button>
                        `}
                    </div>
                `;
            }).join('');
        } catch (err) {
            container.innerHTML = `<p class="col-span-full text-center text-red-500 py-8">${t.errorLoadingData || 'Erreur lors du chargement'}</p>`;
        }
    };

    window.joinClass = async function(className) {
        if (window.store && typeof window.store.subscribeToClass === 'function') {
            try {
                await window.store.subscribeToClass(className);
                
                // Refresh UI
                await window.renderClassList();
                await window.loadClassSelectors();
                
                // Show success toast
                if (window.showToast) {
                    const t = getTranslations()[getLang()];
                    window.showToast(`${t.classJoinedSuccess || 'Vous avez rejoint la classe'} ${className}`);
                }
                
                // Close modal
                window.closeJoinClassModal();
            } catch (err) {
                console.error('Join class error:', err);
            }
        }
    };

    // ===== STUDENTS =====
    let editingStudentId = null;
    let studentErrorTimeout = null;

    window.showStudentError = function(message) {
        const errorZone = document.getElementById('student-modal-error');
        const errorText = document.getElementById('student-modal-error-text');
        if (errorZone && errorText) {
            if (studentErrorTimeout) clearTimeout(studentErrorTimeout);
            
            errorText.textContent = message;
            errorZone.classList.remove('hidden');
            
            // Scroll to top of modal
            errorZone.closest('.overflow-y-auto').scrollTo({ top: 0, behavior: 'smooth' });

            studentErrorTimeout = setTimeout(() => {
                errorZone.classList.add('hidden');
                studentErrorTimeout = null;
            }, 5000);
        }
    };

    window.openStudentModal = async function(studentId = null) {
        const modal = document.getElementById('student-modal');
        const header = document.getElementById('app-header');
        const t = getTranslations()[getLang()];
        const isAr = getLang() === 'ar';

        // ARABIC FIX: Override global RTL flex-row-reverse rule which breaks the modal layout
        if (modal) {
            // Fix Flex Layouts
            const flexElements = modal.querySelectorAll('.flex');
            flexElements.forEach(el => {
                if (isAr) {
                    if (el.classList.contains('flex-col')) {
                        el.style.setProperty('flex-direction', 'column', 'important');
                    } else {
                        el.style.setProperty('flex-direction', 'row', 'important');
                    }
                } else {
                    el.style.removeProperty('flex-direction');
                }
            });

            // Fix Typography (Remove letter-spacing which breaks Arabic script)
            const trackingElements = modal.querySelectorAll('[class*="tracking-"]');
            trackingElements.forEach(el => {
                if (isAr) {
                    el.style.setProperty('letter-spacing', 'normal', 'important');
                } else {
                    el.style.removeProperty('letter-spacing');
                }
            });

            // Fix Absolute Positioning (Labels)
            const left3Elements = modal.querySelectorAll('.left-3');
            left3Elements.forEach(el => {
                if (isAr) {
                    el.style.setProperty('left', 'auto', 'important');
                    el.style.setProperty('right', '0.75rem', 'important');
                } else {
                    el.style.removeProperty('left');
                    el.style.removeProperty('right');
                }
            });

            // Fix Padding (Icons)
            const plElements = modal.querySelectorAll('.pl-3\\.5');
            plElements.forEach(el => {
                if (isAr) {
                    el.style.setProperty('padding-left', '0', 'important');
                    el.style.setProperty('padding-right', '0.875rem', 'important');
                } else {
                    el.style.removeProperty('padding-left');
                    el.style.removeProperty('padding-right');
                }
            });
            
            const prElements = modal.querySelectorAll('.pr-3\\.5');
            prElements.forEach(el => {
                if (isAr) {
                    el.style.setProperty('padding-right', '0', 'important');
                    el.style.setProperty('padding-left', '0.875rem', 'important');
                } else {
                    el.style.removeProperty('padding-right');
                    el.style.removeProperty('padding-left');
                }
            });
        }
        
        // Hide header
        if (header) {
            header.style.setProperty('display', 'none', 'important');
        }
        
        // Reset error zone
        const errorZone = document.getElementById('student-modal-error');
        if (errorZone) errorZone.classList.add('hidden');
        if (studentErrorTimeout) clearTimeout(studentErrorTimeout);

        // Reset to single mode by default, and hide selector if editing
        const selector = document.getElementById('student-modal-mode-selector');
        if (studentId) {
            if (selector) selector.classList.add('hidden');
            window.setStudentModalMode('single');
        } else {
            if (selector) selector.classList.remove('hidden');
            window.setStudentModalMode('single');
        }

        if (modal) {
            modal.classList.add('active');
            modal.classList.remove('pointer-events-none', 'opacity-0');
            modal.classList.add('opacity-100');
            modal.querySelector('div').classList.remove('scale-95');
            modal.querySelector('div').classList.add('scale-100');
        }

        // Update academic year display in bulk import section
        const currentYearDisplay = document.getElementById('current-academic-year-display');
        if (currentYearDisplay) {
            const globalYear = window.getGlobalAcademicYear();
            currentYearDisplay.textContent = globalYear || 'Non définie';
        }
        
        // Find elements
        const titleEl = modal.querySelector('h3');
        const btnAdd = modal.querySelector('button[onclick="addStudent()"]');
        const lastNameInput = document.getElementById('student-lastname');
        const firstNameInput = document.getElementById('student-firstname');
        const ninInput = document.getElementById('student-nin');
        const classSelect = document.getElementById('student-class-select');
        const newClassInput = document.getElementById('student-class-new');
        const newClassContainer = document.getElementById('student-class-new-container');
        
        // Load classes into select and THEN populate student data if editing
        if (classSelect) {
            window.getClasses().then(async classes => {
                let html = `<option value="">-- ${t.classNameOption || '--'} --</option>`;
                classes.forEach(c => {
                    html += `<option value="${c}">${c}</option>`;
                });
                html += `<option value="__new__" class="font-bold text-blue-600">+ ${t.newClass}</option>`;
                classSelect.innerHTML = html;

                // Move selection logic inside the promise to ensure options exist
                if (studentId) {
                    const data = getData();
                    let student = data.students.find(s => s.id === studentId);
                    
                    // Si l'élève n'est pas trouvé localement, essayer de le récupérer depuis la base de données
                    if (!student && window.store && typeof window.store.getStudentById === 'function') {
                        try {
                            student = await window.store.getStudentById(studentId);
                            if (student) {
                                // Ajouter l'élève récupéré aux données locales
                                data.students.push(student);
                            }
                        } catch (err) {
                            console.warn("Erreur lors de la récupération de l'élève depuis la base de données", err);
                        }
                    }
                    if (student) {
                        const optionExists = Array.from(classSelect.options).some(opt => opt.value === student.className);
                        if (optionExists) {
                            classSelect.value = student.className;
                            if (newClassContainer) newClassContainer.classList.add('hidden');
                        } else {
                            classSelect.value = '__new__';
                            if (newClassContainer) {
                                newClassContainer.classList.remove('hidden');
                                if (newClassInput) newClassInput.value = student.className || '';
                            }
                        }
                    }
                }
            });
        }

        if (studentId) {
            // EDIT MODE
            editingStudentId = studentId;
            const data = getData();
            let student = data.students.find(s => s.id === studentId);

            // Si l'élève n'est pas trouvé localement, essayer de le récupérer depuis la base de données
            if (!student && window.store && typeof window.store.getStudentById === 'function') {
                try {
                    student = await window.store.getStudentById(studentId);
                    if (student) {
                        // Ajouter l'élève récupéré aux données locales
                        data.students.push(student);
                    }
                } catch (err) {
                    console.warn("Erreur lors de la récupération de l'élève depuis la base de données", err);
                }
            }
            
            if (student) {
                // Vérifier si l'élève est officiel (importé via Excel)
                const isOfficial = student.importedBy && student.importedBy.includes('@');
                
                if (isOfficial) {
                    // Élève officiel : désactiver le formulaire
                    if (titleEl) titleEl.textContent = t.viewStudentTitle || 'Voir l\'élève (Officiel)';
                    if (btnAdd) {
                        btnAdd.textContent = t.locked || 'Verrouillé';
                        btnAdd.disabled = true;
                    }
                    
                    // Désactiver tous les champs de saisie
                    const formInputs = modal.querySelectorAll('input, select');
                    formInputs.forEach(input => {
                        input.disabled = true;
                    });
                } else {
                    // Élève manuel : permettre la modification
                    if (titleEl) titleEl.textContent = t.editStudentTitle || 'Modifier l\'élève';
                    if (btnAdd) {
                        btnAdd.textContent = t.save || 'Enregistrer';
                        btnAdd.disabled = false;
                    }
                    
                    // Réactiver tous les champs de saisie
                    const formInputs = modal.querySelectorAll('input, select');
                    formInputs.forEach(input => {
                        input.disabled = false;
                    });
                }

                // Fill inputs
                if (lastNameInput) lastNameInput.value = student.lastName || '';
                if (firstNameInput) firstNameInput.value = student.firstName || '';
                if (ninInput) {
                    ninInput.value = student.nin || '';
                    ninInput.readOnly = true; // Protect NIN in edit mode
                }

                // Fill Academic Year
                const academicYearSelect = document.getElementById('student-academic-year');
                if (academicYearSelect) academicYearSelect.value = student.academicYear || '';
            }
        } else {
            // ADD MODE
            editingStudentId = null;
            if (titleEl) titleEl.textContent = t.addStudentTitle;
            if (btnAdd) btnAdd.textContent = t.add;

            // Réactiver tous les champs de saisie (au cas où ils étaient désactivés)
            const formInputs = modal.querySelectorAll('input, select');
            formInputs.forEach(input => {
                input.disabled = false;
            });

            // Reset inputs
            const inputs = ['student-lastname', 'student-firstname', 'student-class-new', 'student-nin'];
            inputs.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });

            // Auto-generate NIN as a long number
            if (ninInput) {
                ninInput.value = (1000 + Date.now()).toString();
                ninInput.readOnly = false; // Allow editing in add mode
            }

            if (newClassContainer) newClassContainer.classList.add('hidden');
            if (classSelect) classSelect.value = '';

            // Pre-fill academic year with global value
            const globalAcademicYear = window.getGlobalAcademicYear();
            const academicYearSelect = document.getElementById('student-academic-year');
            if (academicYearSelect) academicYearSelect.value = globalAcademicYear;
        }

        if (lastNameInput) lastNameInput.focus();
    };

    window.closeStudentModal = function() {
        const modal = document.getElementById('student-modal');
        const header = document.getElementById('app-header');
        
        if (header) {
            header.style.removeProperty('display');
        }

        if (modal) {
            modal.classList.remove('active');
            modal.classList.add('pointer-events-none', 'opacity-0');
            modal.classList.remove('opacity-100');
            modal.querySelector('div').classList.add('scale-95');
            modal.querySelector('div').classList.remove('scale-100');
        }
        editingStudentId = null;
    };

    window.setStudentModalMode = function(mode) {
        const singleContent = document.getElementById('student-modal-content-single');
        const bulkContent = document.getElementById('student-modal-content-bulk');
        const footer = document.getElementById('student-modal-footer');
        const btnSingle = document.getElementById('btn-mode-single');
        const btnBulk = document.getElementById('btn-mode-bulk');

        if (mode === 'single') {
            if (singleContent) singleContent.classList.remove('hidden');
            if (bulkContent) bulkContent.classList.add('hidden');
            if (footer) footer.classList.remove('hidden');
            
            if (btnSingle) btnSingle.className = "flex-1 py-2 rounded-xl text-xs font-bold transition-all border bg-white border-blue-200 text-blue-600 shadow-sm";
            if (btnBulk) btnBulk.className = "flex-1 py-2 rounded-xl text-xs font-bold transition-all border border-gray-200 text-gray-500 hover:bg-gray-100";
        } else {
            if (singleContent) singleContent.classList.add('hidden');
            if (bulkContent) bulkContent.classList.remove('hidden');
            if (footer) footer.classList.add('hidden'); // No standard footer for bulk import as it has its own button

            if (btnSingle) btnSingle.className = "flex-1 py-2 rounded-xl text-xs font-bold transition-all border border-gray-200 text-gray-500 hover:bg-gray-100";
            if (btnBulk) btnBulk.className = "flex-1 py-2 rounded-xl text-xs font-bold transition-all border bg-white border-blue-200 text-blue-600 shadow-sm";
        }
    };

    window.addStudent = async function() {
        const t = getTranslations()[getLang()];
        const data = getData();
        const lastName = document.getElementById('student-lastname').value.trim();
        const firstName = document.getElementById('student-firstname').value.trim();
        
        // Hide error zone first
        const errorZone = document.getElementById('student-modal-error');
        if (errorZone) errorZone.classList.add('hidden');

        // Handle Class Selection
        const classSelect = document.getElementById('student-class-select');
        let className = classSelect.value;
        if (className === '__new__') {
            className = document.getElementById('student-class-new').value.trim();
        }

        const academicYear = document.getElementById('student-academic-year').value.trim() || window.getGlobalAcademicYear();
        const nin = document.getElementById('student-nin').value.trim();

        if (!lastName && !firstName) return window.showStudentError(t.enterName);
        if (!className) return window.showStudentError(t.enterClass);

        const name = (lastName + ' ' + firstName).trim();

        // Check for duplicate student in the same class, for the current user and academic year
        const currentUserId = window.currentUser?.email || window.currentUser?.id || 'unknown';
        const duplicate = data.students.find(s => 
            s.name.toLowerCase() === name.toLowerCase() && 
            s.className === className && 
            s.academicYear === academicYear &&
            (s.importedBy || 'unknown') === currentUserId &&
            s.id !== editingStudentId &&
            // Ne vérifier que les élèves manuels pour éviter les faux doublons avec les élèves officiels
            (!s.isOfficial || (s.importedBy || 'unknown') === currentUserId)
        );

        if (duplicate) return window.showStudentError(t.duplicateStudent || 'Cet élève existe déjà dans cette classe.');

        if (editingStudentId) {
            // UPDATE
            const student = data.students.find(s => s.id === editingStudentId);
            if (student) {
                // Vérifier si l'élève est officiel (importé via Excel)
                if (student.isOfficial) {
                    return window.showStudentError(t.officialStudentLocked || 'Cet élève provient du fichier officiel et ne peut pas être modifié.');
                }
                student.lastName = lastName;
                student.firstName = firstName;
                student.name = name;
                student.className = className;
                student.academicYear = academicYear;
                // Preserve importedBy
                if (nin) student.nin = nin; // Only update if provided
                // Preserve other fields like grades (linked by ID), sex, birthDate, etc.
            }
        } else {
            // CREATE - Marquer comme manuel avec l'UUID du prof actuel
            const currentUserId = window.currentUser?.id || window.currentUser?.email || genId();
            
            // Vérifier si un élève avec le même nom, classe et année existe déjà dans la base de données
            let existingStudent = null;
            
            // Chercher dans les élèves locaux
            existingStudent = data.students.find(s => 
                s.name.toLowerCase() === name.toLowerCase() &&
                s.className === className &&
                s.academicYear === academicYear
            );
            
            // Si non trouvé localement, chercher dans la base de données
            if (!existingStudent && window.store && typeof window.store.getSharedStudents === 'function') {
                try {
                    // Récupérer toutes les classes partagées
                    const sharedClasses = await window.store.getSharedClasses();
                    
                    // Chercher l'élève dans chaque classe partagée
                    for (const className of sharedClasses) {
                        const sharedStudents = await window.store.getSharedStudents(className);
                        const found = sharedStudents.find(s => 
                            s.name.toLowerCase() === name.toLowerCase() &&
                            s.className === className &&
                            s.academicYear === academicYear
                        );
                        
                        if (found) {
                            existingStudent = found;
                            break;
                        }
                    }
                } catch (err) {
                    console.warn("Erreur lors de la recherche de l'élève dans la base de données", err);
                }
            }
            
            // Si un élève existe déjà, afficher une erreur
            if (existingStudent) {
                return window.showStudentError(t.duplicateStudent || 'Cet élève existe déjà dans cette classe.');
            }
            
            // Sinon, créer le nouvel élève
            data.students.push({ 
                id: genId(), 
                name, 
                className, 
                academicYear, 
                nin: nin || genId(), 
                firstName, 
                lastName, 
                importedBy: currentUserId,
                isOfficial: false // Manuel
            });
        }

        saveData();
        
        // After adding/updating, help user find the student
        const searchInput = document.getElementById('student-search');
        if (searchInput) {
            searchInput.value = name;
        }

        // Also reset class filter to "All" to make sure the student is visible
        const filterSelect = document.getElementById('filter-class-students');
        if (filterSelect) {
            filterSelect.value = "";
            studentsUiState.selectedClass = "";
        }

        await window.renderStudents();
        window.closeStudentModal();
        
        // Show success confirmation
        if (!editingStudentId && window.showToast) {
            window.showToast(t.studentAddedSuccess || "L'élève a été ajouté avec succès !");
        }

        // Refresh class lists if a new class was created or changed
        await window.renderClassList();
        await window.loadClassSelectors();
    };

    window.deleteStudent = async function(id) {
        const t = getTranslations()[getLang()];
        const data = getData();
        let student = data.students.find(s => s.id === id);
        
        // Si l'élève n'est pas trouvé en local, on tente de le récupérer via le store
        if (!student && window.store && typeof window.store.getStudentById === 'function') {
            student = await window.store.getStudentById(id);
            if (student) {
                // On l'ajoute temporairement à data.students pour que saveData() le prenne en compte
                data.students.push(student);
            }
        }
        
        if (!student) return;

        // Vérifier si l'élève est officiel (importé via Excel)
        if (student.isOfficial) {
            return alert(t.officialStudentLocked || 'Cet élève provient du fichier officiel et ne peut pas être supprimé.');
        }
        
        if (!confirm(t.deleteStudent)) return;
        
        // 1. Mise à jour locale (Archivage)
        student.status = 'archived';
        saveData();

        // 2. Mise à jour directe dans Supabase (Source de vérité)
        if (window.store && typeof window.store.archiveStudent === 'function') {
            await window.store.archiveStudent(id);
        }
        
        await window.renderStudents();
        await window.renderClassList();
        await window.loadClassSelectors();
    };

    window.viewStudentGrades = function(studentId) {
        const data = getData();
        const student = data.students.find(s => s.id === studentId);
        if (!student) return;

        // 1. Switch to summary tab FIRST with keepFilters
        if (window.tabs && typeof window.tabs.activateTab === 'function') {
            window.tabs.activateTab('summary', { keepFilters: true });
        }

        // 2. Set filters AFTER tab switch (to ensure elements are in the right state)
        const summarySearchInput = document.getElementById('summary-search');
        const summaryClassSelect = document.getElementById('select-class-summary');

        if (summarySearchInput) {
            summarySearchInput.value = student.name || `${student.lastName} ${student.firstName}`;
        }
        
        if (summaryClassSelect) {
            summaryClassSelect.value = student.className;
        }
        
        // 3. Trigger render
        if (typeof window.renderSummary === 'function') {
            window.renderSummary();
        }
    };

    window.renderStudents = async function() {
        const t = getTranslations()[getLang()];
        const container = document.getElementById('students-list');
        const searchTerm = document.getElementById('student-search')?.value.trim().toLowerCase() || '';
        const filterSelect = document.getElementById('filter-class-students');
        const selectedClass = filterSelect ? filterSelect.value : (studentsUiState.selectedClass || '');
        const data = getData();

        const globalUserId = window.currentUser?.email || window.currentUser?.id || 'unknown';
        const globalAcademicYear = window.getGlobalAcademicYear();
        if (!globalAcademicYear) {
            container.innerHTML = `<p class="text-gray-500 text-center py-8">${t.selectAcademicYear}</p>`;
            const pagination = document.getElementById('students-pagination');
            if (pagination) pagination.innerHTML = '';
            return;
        }

        // 1. Get Local Students
        let localStudents = data.students.filter(s => 
            (s.importedBy || 'unknown') === globalUserId && 
            (s.academicYear || '') === globalAcademicYear
        );

        // 2. Get Shared Students (if a class is selected)
        let sharedStudents = [];
        if (selectedClass && window.store && typeof window.store.getSharedStudents === 'function') {
            sharedStudents = await window.store.getSharedStudents(selectedClass);
        }

        // 3. Merge and Filter
        // SYNC DOWN : Mettre à jour le statut local si le cloud a un statut différent
        const studentMap = new Map();
        localStudents.forEach(s => studentMap.set(s.id, s));
        
        let needsLocalSave = false;
        sharedStudents.forEach(s => {
            const localS = studentMap.get(s.id);
            if (localS) {
                // Si divergence, privilégier 'archived' pour éviter le rebond visuel
                if (localS.status !== s.status) {
                    localS.status = (localS.status === 'archived' || s.status === 'archived') ? 'archived' : s.status;
                    needsLocalSave = true;
                }
            } else {
                studentMap.set(s.id, s);
            }
        });

        if (needsLocalSave) {
            window.saveData(); // Sauvegarde silencieuse pour garder la cohérence
        }

        let filteredStudents = Array.from(studentMap.values());

        // Compter les élèves archivés avant de les masquer
        let archivedCount = 0;
        if (selectedClass) {
            const classStudentsBeforeFilter = filteredStudents.filter(s => (s.className || '') === selectedClass);
            archivedCount = classStudentsBeforeFilter.filter(s => s.status === 'archived').length;
        }

        // Masquer les élèves archivés par défaut
        filteredStudents = filteredStudents.filter(s => s.status !== 'archived');

        // Apply filters
        if (selectedClass) {
            filteredStudents = filteredStudents.filter(s => (s.className || '') === selectedClass);
        }
        if (searchTerm) {
            filteredStudents = filteredStudents.filter(s => {
                const haystack = `${s.name || ''} ${s.firstName || ''} ${s.lastName || ''} ${s.className || ''}`.toLowerCase();
                return haystack.includes(searchTerm);
            });
        }

        if (filteredStudents.length === 0 && data.students.length === 0) {
            container.className = '';
            container.innerHTML = `<p class="text-gray-500 text-center py-8">${t.noStudentsAddFirst}</p>`;
            const pagination = document.getElementById('students-pagination');
            if (pagination) pagination.innerHTML = '';
            return;
        }

        container.className = 'student-grid';

        const pageSize = studentsUiState.pageSize || 12;
        studentsUiState.pageSize = pageSize;
        studentsUiState.selectedClass = selectedClass;

        const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
        if (studentsUiState.page > totalPages) studentsUiState.page = totalPages;
        if (studentsUiState.page < 1) studentsUiState.page = 1;
        const start = (studentsUiState.page - 1) * pageSize;
        const pageStudents = filteredStudents.slice(start, start + pageSize);

        if (filteredStudents.length === 0) {
            container.className = '';
            container.innerHTML = `<p class="text-gray-500 text-center py-8">${t.noResults}</p>`;
        } else {
            const items = pageStudents.map((s, i) => {
            const first = (s.firstName || '').trim();
            const last = (s.lastName || '').trim();
            const displayName = (s.name || `${last} ${first}`).trim();
            const level = levelFromClass(s.className || '');
            const sex = (s.sex || '').toLowerCase();
            const levelClass = sex.startsWith('f') || sex.includes('أنث') || sex.includes('fille') ? 'girl'
                : sex.startsWith('m') || sex.includes('ذكر') || sex.includes('garçon') ? 'boy'
                    : 'neutral';
            
            // Use global helpers for date
            const birth = window.formatDate ? window.formatDate(window.parseDateMaybeExcel(s.birthDate || '')) : '';

            // Template de la carte élève (Nom en haut, actions en bas pour éviter les coupures)
            return `
            <div class="student-item group ${levelClass} ${s.isOfficial ? 'official-student' : ''} bg-white p-3 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col gap-2 relative overflow-hidden">
                <!-- Overlay subtil au hover -->
                <div class="absolute inset-0 bg-slate-50/0 group-hover:bg-slate-50/30 transition-colors pointer-events-none"></div>
                
                <!-- Badge officiel (uniquement pour les élèves importés via Excel) -->
                ${s.isOfficial ? `<div class="absolute top-2 ${getLang() === 'ar' ? 'left-2' : 'right-2'} z-20 inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500 text-white rounded text-[10px] font-bold shadow-sm">
                    🔒 ${t.official || 'Officiel'}
                </div>` : ''}

                <!-- Ligne 1: Nom (Pleine largeur) -->
                <div class="student-name text-base font-bold text-slate-700 z-10 leading-tight" title="${displayName}">
                    ${displayName}
                </div>

                <!-- Ligne 2: Meta (Date de naissance) -->
                <div class="student-meta flex items-center gap-1.5 z-10">
                    ${birth ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-500 rounded text-[10px] font-bold border border-slate-100 tracking-tight">🎂 ${birth}</span>` : ''}
                </div>

                <!-- Ligne 3: Actions (En bas) -->
                <div class="flex items-center justify-between gap-2 mt-1 z-10">
                    <div class="flex items-center gap-1.5">
                        <!-- Bouton Notes (Discret) -->
                        <button onclick="viewStudentGrades('${s.id}')" 
                            class="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition-all whitespace-nowrap border border-blue-100">
                            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                            <span class="leading-none">${t.viewGradesShort || 'Notes'}</span>
                        </button>
                    </div>
                    
                    <div class="flex items-center gap-1.5">
                        <!-- Bouton Modifier -->
                        <button onclick="${s.isOfficial ? '': `openStudentModal('${s.id}')`}" 
                            class="w-8 h-8 flex items-center justify-center bg-slate-50 ${s.isOfficial ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-blue-600 hover:bg-white'} rounded-lg ${s.isOfficial ? '' : 'active:scale-90'} transition-all border border-slate-100"
                            title="${t.edit}">
                            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        </button>

                        <!-- Bouton Supprimer -->
                        <button onclick="${s.isOfficial ? '': `deleteStudent('${s.id}')`}" 
                            class="w-8 h-8 flex items-center justify-center bg-slate-50 ${s.isOfficial ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-red-600 hover:bg-white'} rounded-lg ${s.isOfficial ? '' : 'active:scale-90'} transition-all border border-slate-100"
                            title="${t.delete}">
                            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </div>
            </div>`;
            }).join('');

            container.className = 'student-grid';
            container.innerHTML = items;
        }

        const pagination = document.getElementById('students-pagination');
        if (pagination) {
            const currentPage = studentsUiState.page;
            
            let html = `
                <div class="pagination-container mt-8 flex flex-wrap items-center justify-between gap-6 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <div class="flex items-center gap-4">
                        <div class="pagination-info text-sm text-slate-500">
                            ${t.showing} <span class="font-bold text-slate-900">${filteredStudents.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> 
                            ${t.to} <span class="font-bold text-slate-900">${Math.min(currentPage * pageSize, filteredStudents.length)}</span> 
                            ${t.of} <span class="font-bold text-slate-900">${filteredStudents.length}</span>
                        </div>
                        <div class="h-4 w-px bg-slate-200"></div>
                        <div class="flex items-center gap-2">
                            <select id="students-page-size" onchange="setStudentsPageSize(this.value)"
                                class="modern-select !py-1.5 !px-3 !text-sm !w-20 !bg-slate-50 border-transparent hover:border-slate-200 transition-all">
                                <option value="12" ${pageSize === 12 ? 'selected' : ''}>12</option>
                                <option value="18" ${pageSize === 18 ? 'selected' : ''}>18</option>
                                <option value="50" ${pageSize === 50 ? 'selected' : ''}>50</option>
                                <option value="100" ${pageSize === 100 ? 'selected' : ''}>100</option>
                            </select>
                            <span class="text-xs text-slate-400 font-medium">${t.perPage || '/ page'}</span>
                        </div>
                    </div>
            `;

            if (totalPages > 1) {
                html += `
                    <div class="flex items-center gap-1">
                        <button onclick="goStudentsPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} class="pagination-btn">
                            <svg class="w-5 h-5 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                        </button>
                `;

                // Logic for page numbers
                const startPage = Math.max(1, currentPage - 2);
                const endPage = Math.min(totalPages, startPage + 4);
                
                for (let i = startPage; i <= endPage; i++) {
                    html += `
                        <button onclick="goStudentsPage(${i})" class="pagination-btn ${i === currentPage ? 'active' : ''}">
                            ${i}
                        </button>
                    `;
                }

                html += `
                        <button onclick="goStudentsPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} class="pagination-btn">
                            <svg class="w-5 h-5 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                        </button>
                    </div>
                `;
            }

            html += `</div>`;
            pagination.innerHTML = html;
        }
    };

    window.handleStudentImport = function(event) {
        const t = getTranslations()[getLang()];
        const file = event.target.files[0];
        if (!file) return;

        // Close the student modal immediately to avoid overlapping with wizard/other modals
        if (typeof window.closeStudentModal === 'function') {
            window.closeStudentModal();
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            const dataBinary = new Uint8Array(e.target.result);
            // On réactive cellDates pour avoir des objets Date propres
            const workbook = XLSX.read(dataBinary, { type: 'array', cellDates: true });
            const firstSheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[firstSheetName];
            // On repasse en raw: true pour avoir les objets Date ou les nombres bruts
            const json = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

            if (json.length < 2) {
                alert(t.emptyFile);
                return;
            }

            const headers = json[1];
            const rows = json.slice(2); // à partir de la 3ème ligne

            const cleanStr = (val) => (val || '').toString().trim();

            const normalizeBirthDate = (val) => {
                if (val === undefined || val === null) return '';
                
                let d = null;

                // CAS 1 : C'est déjà un objet Date (le plus fréquent avec cellDates: true)
                if (val instanceof Date && !isNaN(val)) {
                    // CRITIQUE : On arrondit au jour le plus proche pour compenser les décalages (ex: 22:59:39 -> J+1)
                    const ms = val.getTime();
                    d = new Date(Math.round(ms / 86400000) * 86400000);
                } 
                // CAS 2 : C'est un nombre de série Excel (ex: 38962)
                else if (typeof val === 'number' && val > 10000) {
                    const ms = (Math.round(val) - 25569) * 86400 * 1000;
                    d = new Date(ms);
                }
                // CAS 3 : C'est une chaîne de caractères
                else {
                    const str = cleanStr(val);
                    if (!str) return '';
                    const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                    if (m) return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`;
                    return str;
                }

                if (d) {
                    const dd = String(d.getUTCDate()).padStart(2, '0');
                    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
                    const yyyy = d.getUTCFullYear();
                    return `${dd}/${mm}/${yyyy}`;
                }

                return cleanStr(val);
            };

            const getIndex = (label) => headers.findIndex(h => cleanStr(h) === label);

            // Index des colonnes d'identification
            const idxNIN = getIndex('رقم التعريف');
            const idxNom = getIndex('اللقب');
            const idxPrenom = getIndex('الاسم');
            const idxClasse = getIndex('الفوج التربوي');
            const idxSexe = getIndex('الجنس');
            const idxBirth = getIndex('تاريخ الميلاد');
            const idxReg = getIndex('رقم التسجيل');

            // Liste des index connus (infos élèves) pour identifier les colonnes de NOTES
            const knownIndices = [idxNIN, idxNom, idxPrenom, idxClasse, idxSexe, idxBirth, idxReg];

            // Extract unique classes from Excel for the wizard
            const excelClasses = [...new Set(rows.map(r => idxClasse >= 0 ? cleanStr(r[idxClasse]) : '').filter(c => c))];

            // Pre-parse rows for the wizard to avoid duplicating logic
            const parsedRows = rows.map((row, index) => {
                if (!row || row.length === 0) return null;
                return {
                    originalIndex: index,
                    nin: idxNIN >= 0 ? cleanStr(row[idxNIN]) : '',
                    lastName: idxNom >= 0 ? cleanStr(row[idxNom]) : '',
                    firstName: idxPrenom >= 0 ? cleanStr(row[idxPrenom]) : '',
                    className: idxClasse >= 0 ? cleanStr(row[idxClasse]) : '',
                    sex: idxSexe >= 0 ? cleanStr(row[idxSexe]) : '',
                    birthDate: idxBirth >= 0 ? normalizeBirthDate(row[idxBirth]) : '',
                    regNumber: idxReg >= 0 ? cleanStr(row[idxReg]) : ''
                };
            }).filter(r => r !== null);

            const runImport = async (studentMapping = {}) => {
                let added = 0;
                let updated = 0;
                let archived = 0;
                const data = getData();
                const currentAcademicYear = window.getGlobalAcademicYear();

                // Collect all unique classes present in the Excel file
                const importedClasses = new Set();
                rows.forEach((row) => {
                    if (!row || row.length === 0) return;
                    const className = idxClasse >= 0 ? cleanStr(row[idxClasse]) : '';
                    if (className) importedClasses.add(className);
                });

                // --- ÉTAPE 0 : Auto-Abonnement et Récupération des données partagées ---
                // Pour que le Prof B puisse mettre à jour et archiver correctement,
                // il doit être abonné à ces classes et avoir les élèves en local.
                if (window.store && typeof window.store.subscribeToClass === 'function') {
                    for (const className of importedClasses) {
                        try {
                            // S'abonner à la classe
                            await window.store.subscribeToClass(className);
                            // Récupérer les élèves partagés existants pour cette classe
                            const sharedStudents = await window.store.getSharedStudents(className);
                            
                            // Fusionner les élèves partagés dans le data.students local
                            // pour que la logique de Smart Merge et d'Archivage les trouve.
                            sharedStudents.forEach(sharedStudent => {
                                const existsLocally = data.students.find(s => s.id === sharedStudent.id);
                                if (!existsLocally) {
                                    data.students.push(sharedStudent);
                                }
                            });
                        } catch (err) {
                            console.warn(`Erreur lors de l'abonnement automatique à la classe ${className}`, err);
                        }
                    }
                }

                // Set to keep track of students found in Excel
                const processedExcelStudents = new Set();

                rows.forEach((row, index) => {
                    if (!row || row.length === 0) return;

                    // Extraction des données de base
                    const nin = idxNIN >= 0 ? cleanStr(row[idxNIN]) : '';
                    const lastName = idxNom >= 0 ? cleanStr(row[idxNom]) : '';
                    const firstName = idxPrenom >= 0 ? cleanStr(row[idxPrenom]) : '';
                    const className = idxClasse >= 0 ? cleanStr(row[idxClasse]) : '';
                    const sex = idxSexe >= 0 ? cleanStr(row[idxSexe]) : '';
                    const birthDate = idxBirth >= 0 ? normalizeBirthDate(row[idxBirth]) : '';
                    const regNumber = idxReg >= 0 ? cleanStr(row[idxReg]) : '';

                    if (!lastName && !firstName) return;
                    const name = (lastName + ' ' + firstName).trim();

                    // Track students in the excel file for deletion logic later
                    processedExcelStudents.add(regNumber ? `${className}_${regNumber}` : `${className}_${name}`);

                    // --- CORRECTION 1 : LOGIQUE DE RECHERCHE AMÉLIORÉE ---
                    const currentUserId = window.currentUser?.email || window.currentUser?.id || 'unknown';
                    const currentAcademicYear = window.getGlobalAcademicYear();
                    
                    // --- SMART MERGE : Recherche dans les élèves partagés ---
                    // Au lieu de chercher uniquement dans les élèves "importés par moi",
                    // on cherche dans TOUS les élèves (y compris les partagés de Supabase) 
                    // qui appartiennent à la classe qu'on est en train d'importer.
                    const userStudents = data.students.filter(s => (s.academicYear || '') === currentAcademicYear);
                    let existing = null;

                    // 0. Priorité absolue : Mapping manuel du Wizard
                    if (studentMapping && studentMapping[index]) {
                        existing = data.students.find(s => s.id === studentMapping[index]);
                    }

                    // A. Essayer par Numéro d'Inscription ET Classe (le plus fiable)
                    if (!existing && regNumber && className) {
                        existing = userStudents.find(s =>
                            s.regNumber == regNumber &&
                            s.className.trim() === className.trim()
                        );
                    }
                    // B. Si pas trouvé, essayer par NIN
                    if (!existing && nin) {
                        existing = userStudents.find(s => s.nin == nin);
                    }
                    // C. Si pas trouvé, essayer Nom + Prénom + Classe (Comparaison stricte sans espaces)
                    if (!existing) {
                        existing = userStudents.find(s =>
                            s.name.trim() === name &&
                            s.className.trim() === className
                        );
                    }

                    // Objet contenant les données à sauvegarder
                const studentData = {
                    name,
                    className,
                    academicYear: window.getGlobalAcademicYear(),
                    nin,
                    firstName,
                    lastName,
                    sex,
                    birthDate,
                    regNumber,
                    isOfficial: true // Marqué comme officiel lors de l'import Excel
                };

                // --- CORRECTION 2 : IMPORTATION DES NOTES (Colonnes supplémentaires) ---
                // On initialise un objet 'grades' s'il n'existe pas
                const importedGrades = {};
                headers.forEach((header, index) => {
                    // Si la colonne n'est pas une info élève et qu'elle a un titre
                    if (!knownIndices.includes(index) && header && row[index] !== undefined) {
                        // On enregistre la note associée au nom de la colonne (ex: "Devoir 1")
                        importedGrades[cleanStr(header)] = row[index];
                    }
                });

                if (existing) {
                    // MISE A JOUR de l'élève existant (Smart Merge)
                    
                    // S'il était archivé, on le compte comme "restauré"
                    if (existing.status === 'archived') {
                        console.log(`[Smart Merge] Élève restauré : ${existing.name}`);
                    }
                    
                    // Important : On préserve le champ `importedBy` de l'élève existant
                    // Si l'élève a déjà un importedBy (email), on le garde
                    // Sinon, on le marque avec l'email/ID du prof qui importe
                    const currentUserId = window.currentUser?.email || window.currentUser?.id || 'unknown';
                    Object.assign(existing, {
                        ...studentData,
                        // Assurer que le statut est actif s'il revient
                        status: 'active',
                        // Préserver importedBy s'il existe (email), sinon utiliser le currentUserId
                        importedBy: existing.importedBy && existing.importedBy.includes('@') ? existing.importedBy : currentUserId
                    }); 
                    
                    // Note: Les notes importées via ce fichier Excel (type Rakmana) ne sont pas compatibles 
                    // avec la structure data.grades[studentId][assignmentId].
                    // Pour l'instant, on ignore l'importation des notes brutes ici car elles nécessitent 
                    // d'abord la création de Devoirs correspondants dans l'application.
                    
                    updated++;
                } else {
                    // CRÉATION d'un nouvel élève
                    const currentUserId = window.currentUser?.email || window.currentUser?.id || 'unknown';
                    data.students.push({
                        id: genId(),
                        academicYear: window.getGlobalAcademicYear(),
                        // Marquer comme officiel (importé via Excel) avec l'email du prof
                        importedBy: currentUserId,
                        status: 'active', // Nouvel élève = actif
                        ...studentData
                    });
                    added++;
                }
            });

            // --- ARCHIVAGE DES ÉLÈVES DISPARUS ---
            // On vérifie les élèves existants dans les classes importées
            data.students.forEach(s => {
                // Si l'élève appartient à une classe qui vient d'être importée, 
                // qu'il est de cette année scolaire, 
                // et qu'il n'était pas dans le fichier Excel...
                if (
                    importedClasses.has(s.className) && 
                    (s.academicYear || '') === currentAcademicYear &&
                    s.status !== 'archived' // Déjà archivé, on l'ignore
                ) {
                    // Normalize pour éviter les faux positifs d'espaces
                    const cleanName = s.name ? s.name.replace(/\s+/g, ' ').trim() : '';
                    const studentKeyReg = s.regNumber ? `${s.className}_${s.regNumber}` : null;
                    const studentKeyName = `${s.className}_${cleanName}`;
                    
                    // S'il n'a pas été trouvé dans le fichier Excel
                    // On vérifie de manière plus robuste dans processedExcelStudents
                    let foundInExcel = false;
                    for (const excelKey of processedExcelStudents) {
                        if (excelKey === studentKeyReg || excelKey === studentKeyName || 
                           (cleanName && excelKey.includes(cleanName))) {
                            foundInExcel = true;
                            break;
                        }
                    }

                    if (!foundInExcel) {
                        // On le marque comme archivé au lieu de le supprimer
                        s.status = 'archived';
                        archived++;
                        console.log(`[Smart Merge] Élève archivé car absent du fichier Excel : ${s.name} (${s.className})`);
                    }
                }
            });

            saveData();
            await window.renderStudents();
            await window.renderClassList();
            await window.loadClassSelectors();

            // Recharger les sélecteurs et le récapitulatif si nécessaire
            if (typeof window.renderSummary === 'function') window.renderSummary();
            if (typeof window.loadGradeSelectors === 'function') window.loadGradeSelectors();
            
            try {
                if (window.showTab) window.showTab('students');
                if (window.renderAssignments) window.renderAssignments();
                if (window.loadClassSelectors) window.loadClassSelectors();
                if (window.loadClassSelectorsForExport) window.loadClassSelectorsForExport();
                if (window.renderExportPrep) window.renderExportPrep();
                if (window.applyLanguage) window.applyLanguage();
                // softResetUI?.(); // Removed or check existence
                console.log("✅ APP RAFFRAICHIE !");
            } catch (e) {
                console.warn("Refresh:", e);
            }
            
            let message = `${t.importSuccess}\nAjoutés: ${added}\nMis à jour: ${updated}`;
            if (archived > 0) message += `\nArchivés (disparus du fichier): ${archived}`;
            alert(message);
            event.target.value = '';
        };

        if (window.startImportWizard) {
            window.startImportWizard(parsedRows, excelClasses, runImport);
        } else {
            runImport();
        }
    };
        reader.readAsArrayBuffer(file);
    };

})();
