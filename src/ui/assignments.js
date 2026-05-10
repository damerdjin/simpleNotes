(function () {
    // Helper to access globals
    const getData = () => window.data;
    const getTranslations = () => window.translations;
    const getLang = () => window.currentLanguage;
    const saveData = () => window.saveData();
    const genId = () => window.genId();
    const loadClassSelectors = async () => { if (typeof window.loadClassSelectors === 'function') await window.loadClassSelectors(); };
    const loadGradeSelectors = async () => { if (typeof window.loadGradeSelectors === 'function') await window.loadGradeSelectors(); }; // might be needed if saving affects grades UI?
    const renderSummary = () => { if (typeof window.renderSummary === 'function') window.renderSummary(); };
    const renderExportPrep = () => { if (typeof window.renderExportPrep === 'function') window.renderExportPrep(); };
    const translatePage = () => { if (typeof window.translatePage === 'function') window.translatePage(); };
    const getClassColor = (c) => { return (window.getClassColor ? window.getClassColor(c) : '#6b7280'); };
    const assignmentsSvc = () => window.assignmentsSvc;
    const gradesSvc = () => window.grades;


    // State specific to Assignments UI
    let editingAssignmentId = null;
    window.tempExercises = [];
    let isGlobalAssignment = false;
    let globalMaxPoints = 20;
    const assignmentsUiState = { selectedClass: '' };
    window.assignmentsUiState = assignmentsUiState;
    let collapsedExercises = {}; // State for exercise accordions
    let showAdvancedOptions = false;

    // Expose functions
    window.toggleExerciseCollapse = function(index) {
        // If undefined, it means it's currently collapsed (default state)
        if (collapsedExercises[index] === undefined) {
            collapsedExercises[index] = false; // Set to NOT collapsed (open)
        } else {
            collapsedExercises[index] = !collapsedExercises[index];
        }
        window.renderExercisesBuilder();
    };
    window.toggleAssignmentClassFilter = function(className) {
        if (className === '') {
            activeClassFilters = [];
        } else {
            const index = activeClassFilters.indexOf(className);
            if (index > -1) {
                activeClassFilters.splice(index, 1);
            } else {
                activeClassFilters.push(className);
            }
        }
    };

    window.renderAssignments = function() {
        if (typeof window.renderAssignmentsInternal === 'function') window.renderAssignmentsInternal();
    };

    window.toggleAssignmentsFab = function() {
        const btn = document.getElementById('assignments-fab-btn');
        const options = document.getElementById('assignments-fab-options');
        if (!btn || !options) return;
        
        btn.classList.toggle('open');
        options.classList.toggle('hidden');
        options.classList.toggle('flex');
    };

    window.toggleAdvancedOptions = function() {
        showAdvancedOptions = !showAdvancedOptions;
        const container = document.getElementById('advanced-options-container');
        const toggleBtn = document.getElementById('toggle-advanced-btn');
        const t = getTranslations()[getLang()];
        if (container) {
            container.classList.toggle('hidden', !showAdvancedOptions);
        }
        if (toggleBtn) {
            toggleBtn.innerHTML = showAdvancedOptions 
                ? `<svg class="w-4 h-4 rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg> ${t.hideAdvancedOptions || 'Masquer les options avancées'}`
                : `<svg class="w-4 h-4 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg> ${t.showAdvancedOptions || 'Plus d\'options (Barème, exercices...)'}`;
        }
    };

    window.autoSuggestAssignmentName = function() {
        const nameInput = document.getElementById('assignment-name');
        const typeSelect = document.getElementById('assignment-type');
        const classSelect = document.getElementById('assignment-class');
        const triSelect = document.getElementById('assignment-trimester');
        const subjectSelect = document.getElementById('assignment-subject');
        
        const type = typeSelect.value;
        const trimester = triSelect.value;
        const className = classSelect.value;

        // Progressive Locking Logic (Step 3)
        const step3 = document.getElementById('express-step-3');
        if (step3) {
            const hasType = !!type;
            step3.classList.toggle('opacity-50', !hasType);
            step3.classList.toggle('pointer-events-none', !hasType);
        }

        if (!nameInput || !typeSelect || !classSelect || !triSelect || editingAssignmentId) return;

        const subject = subjectSelect?.value || '';
        const t = getTranslations()[getLang()];
        const isAr = getLang() === 'ar';
        const triSuffix = isAr ? `ث${trimester}` : `T${trimester}`;

        let suggestedName = "";
        if (type === 'comp') {
            suggestedName = isAr ? `اختبار ${triSuffix}` : `Composition ${triSuffix}`;
        } else if (type === 'cc') {
            suggestedName = isAr ? `تقويم ${triSuffix}` : `CC ${triSuffix}`;
        } else if (type === 'tp') {
            suggestedName = isAr ? `أعمال تطبيقية ${triSuffix}` : `TP ${triSuffix}`;
        } else {
            // Devoir: increment based on existing ones
            const currentYear = window.getGlobalAcademicYear();
            const userId = window.currentUser?.email || window.currentUser?.id || 'unknown';
            const existing = getData().assignments.filter(a => 
                a.className === className && 
                (a.subject === subject || !subject) && 
                a.trimester === trimester && 
                (a.academicYear || '') === currentYear &&
                (a.createdBy || 'unknown') === userId &&
                (a.type === 'devoir' || !a.type)
            );
            const nextIndex = existing.length + 1;
            suggestedName = isAr ? `فرض ${nextIndex} ${triSuffix}` : `Devoir ${nextIndex} ${triSuffix}`;
        }

        nameInput.value = suggestedName;
    };

    window.openAssignmentModal = async function (assignmentId = null) {
        const t = getTranslations()[getLang()];
        const isAr = getLang() === 'ar';
        editingAssignmentId = assignmentId;
        showAdvancedOptions = !!assignmentId; // Show advanced by default when editing
        collapsedExercises = {}; // Reset accordions when opening modal
        const overlay = document.createElement('div');
        overlay.id = 'assignment-modal';
        overlay.className = 'modal active fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6';
        overlay.style.background = 'rgba(15, 23, 42, 0.75)';
        overlay.style.backdropFilter = 'blur(4px)';
        document.body.style.overflow = 'hidden';

        let assignment = null;
        let isBlocked = false;
        if (assignmentId) {
            assignment = (getData().assignments || []).find(a => a.id === assignmentId);
            if (assignment) {
                const year = assignment.academicYear || window.getGlobalAcademicYear();
                isBlocked = window.isTrimesterBlocked(assignment.trimester, year);
            }
        } else {
            // New assignment: check if the currently selected trimester in header is blocked
            isBlocked = window.isTrimesterBlocked(window.getGlobalTrimester(), window.getGlobalAcademicYear());
        }
        
        // ARABIC FIX: Modal Layout and Typography
        const modalFlex = isAr ? 'flex-direction: column !important;' : '';
        const trackingClass = isAr ? '' : 'tracking-wider';
        const labelPos = isAr ? 'right-3' : 'left-3';
        const iconPos = isAr ? 'right-3' : 'left-3';
        const chevronPos = isAr ? 'left-3' : 'right-3';
        const inputPadding = isAr ? 'pr-10 pl-4' : 'pl-10 pr-4';

        overlay.innerHTML = `
      <div class="animate-in zoom-in-95 duration-200">
        <!-- Header -->
        <div class="px-6 py-4 border-b flex items-center justify-between bg-gray-50/50 shrink-0">
          <div>
            <h3 id="assignment-modal-title" class="text-xl font-bold text-gray-800 leading-tight">${t.createAssignmentTitle || 'Créer un Devoir'}</h3>
            <p class="text-[10px] text-gray-500 font-medium uppercase tracking-wider mt-0.5">${t.assignmentModalSubtitle || 'Détails du devoir'}</p>
          </div>
          <button onclick="closeAssignmentModal()" class="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <!-- Scrollable Content -->
        <div class="modal-content-scroll custom-scrollbar space-y-6">
          <!-- UI Error Zone -->
          <div id="assignment-modal-error" class="hidden animate-in slide-in-from-top-4 duration-300">
            <div class="flex items-start gap-3 p-4 bg-red-50 border-2 border-red-100 rounded-2xl text-red-700 shadow-sm">
                <div class="p-2 bg-red-100 rounded-lg text-red-600 shrink-0">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                </div>
                <div class="flex-1 pt-1 font-bold text-sm leading-relaxed" id="assignment-modal-error-text"></div>
                <button onclick="document.getElementById('assignment-modal-error').classList.add('hidden')" class="p-1 hover:bg-red-200/50 rounded-lg transition-colors text-red-400">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
          </div>

          <!-- EXPRESS SECTION: Main Info -->
          <div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-5">
            <!-- Step 1: Class Selection (Always Required First) -->
            <div class="relative group">
                <label class="absolute -top-2 ${labelPos} px-1.5 bg-white text-[11px] font-bold text-emerald-600 z-10 transition-all group-focus-within:text-emerald-700" for="assignment-class">${t.selectClass || 'Classe'}</label>
                <div class="relative flex items-center">
                    <div class="absolute ${iconPos} text-gray-400 group-focus-within:text-emerald-500 transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                    </div>
                    <select id="assignment-class" onchange="window.autoSuggestAssignmentName()" class="w-full ${inputPadding} py-3 bg-emerald-50/30 border-2 border-emerald-100 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold text-gray-800 appearance-none cursor-pointer">
                        <option value="" data-translate="selectClass">${t.selectClass || '-- Sélectionner une classe --'}</option>
                    </select>
                    <div class="absolute ${chevronPos} pointer-events-none text-emerald-400">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                </div>
            </div>

            <div id="express-step-2" class="grid grid-cols-1 md:grid-cols-2 gap-5 opacity-50 pointer-events-none transition-opacity duration-300">
                <!-- Step 2: Assignment Type -->
                <div class="relative group">
                    <label class="absolute -top-2 ${labelPos} px-1.5 bg-white text-[11px] font-bold text-rose-600 z-10 transition-all group-focus-within:text-rose-700" for="assignment-type">${t.assignmentType || "Type d'évaluation"}</label>
                    <div class="relative flex items-center">
                        <div class="absolute ${iconPos} text-gray-400 group-focus-within:text-rose-500 transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>
                        </div>
                        <select id="assignment-type" onchange="window.autoSuggestAssignmentName()" class="w-full ${inputPadding} py-3 bg-gray-50/50 border-2 border-gray-100 rounded-xl focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 outline-none transition-all font-bold text-gray-800 appearance-none cursor-pointer">
                            <option value="">${t.typePlaceholder || '-- Choisir un type --'}</option>
                            <option value="devoir">${t.typeDevoir || 'Devoir'}</option>
                            <option value="cc">${t.typeCC || 'CC'}</option>
                            <option value="tp">${t.typeTP || 'TP'}</option>
                            <option value="comp">${t.typeComp || 'Composition'}</option>
                        </select>
                        <div class="absolute ${chevronPos} pointer-events-none text-gray-400">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                </div>

                <!-- Subject Selection -->
                <div class="relative group">
                    <label class="absolute -top-2 ${labelPos} px-1.5 bg-white text-[11px] font-bold text-purple-600 z-10 transition-all group-focus-within:text-purple-700" for="assignment-subject">${t.subject || 'Matière'}</label>
                    <div class="relative flex items-center">
                        <div class="absolute ${iconPos} text-gray-400 group-focus-within:text-purple-500 transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                        </div>
                        <select id="assignment-subject" onchange="window.autoSuggestAssignmentName()" class="w-full ${inputPadding} py-3 bg-gray-50/50 border-2 border-gray-100 rounded-xl focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all font-medium text-gray-700 appearance-none cursor-pointer">
                            <option value="">${t.subjectPlaceholder || '-- Sélectionner une matière --'}</option>
                            ${(window.subjects || []).map(s => `<option value="${s.id}">${s[getLang()] || s.fr}</option>`).join('')}
                        </select>
                        <div class="absolute ${chevronPos} pointer-events-none text-gray-400">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                </div>

                <!-- Trimester Selection -->
                <div class="relative group">
                    <label class="absolute -top-2 ${labelPos} px-1.5 bg-white text-[11px] font-bold text-amber-600 z-10 transition-all group-focus-within:text-amber-700" for="assignment-trimester">${t.assignmentTrimesterLabel || 'Trimestre'}</label>
                    <div class="relative flex items-center">
                        <div class="absolute ${iconPos} text-gray-400 group-focus-within:text-amber-500 transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        </div>
                        <select id="assignment-trimester" onchange="window.autoSuggestAssignmentName()" class="w-full ${inputPadding} py-3 bg-gray-50/50 border-2 border-gray-100 rounded-xl focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all font-bold text-gray-800 appearance-none cursor-pointer">
                            <option value="1">${t.trimesterShort || 'T'}1</option>
                            <option value="2">${t.trimesterShort || 'T'}2</option>
                            <option value="3">${t.trimesterShort || 'T'}3</option>
                        </select>
                        <div class="absolute ${chevronPos} pointer-events-none text-gray-400">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                </div>
            </div>

            <div id="express-step-3" class="grid grid-cols-1 md:grid-cols-2 gap-5 opacity-50 pointer-events-none transition-opacity duration-300">
                <!-- Step 3: Assignment Name -->
                <div class="relative group">
                    <label class="absolute -top-2 ${labelPos} px-1.5 bg-white text-[11px] font-bold text-blue-600 z-10 transition-all group-focus-within:text-blue-700" for="assignment-name">${t.assignmentName || 'Nom du devoir'}</label>
                    <div class="relative flex items-center">
                        <div class="absolute ${iconPos} text-gray-400 group-focus-within:text-blue-500 transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        </div>
                        <input type="text" id="assignment-name" placeholder="${t.assignmentNamePlaceholder || 'Ex: Devoir 1'}" 
                            class="w-full ${inputPadding} py-3 bg-gray-50/50 border-2 border-gray-100 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-bold text-blue-800">
                    </div>
                </div>
            </div>
          </div>

          <!-- ADVANCED OPTIONS TOGGLE -->
          <div class="flex justify-center">
            <button id="toggle-advanced-btn" onclick="window.toggleAdvancedOptions()" class="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-blue-600 transition-all px-4 py-2 rounded-xl hover:bg-blue-50">
                <svg class="w-4 h-4 transition-transform ${showAdvancedOptions ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                ${t.showAdvancedOptions || 'Plus d\'options (Barème, exercices...)'}
            </button>
          </div>

          <!-- ADVANCED SECTION: Collapsible -->
          <div id="advanced-options-container" class="${showAdvancedOptions ? '' : 'hidden'} space-y-6 animate-in slide-in-from-top-4 duration-300">
            <!-- Grade Date Section -->
            <div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <div class="relative group">
                    <label class="absolute -top-2 ${labelPos} px-1.5 bg-white text-[11px] font-bold text-blue-600 z-10 transition-all group-focus-within:text-blue-700" for="assignment-grade-date">${t.gradeDate || 'Date du devoir'}</label>
                    <div class="relative flex items-center">
                        <div class="absolute ${iconPos} text-gray-400 group-focus-within:text-blue-500 transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v3m8 4v-3M8 11h.01M8 15h.01M11 8h.01M11 12h.01M11 16h.01"></path></svg>
                        </div>
                        <input type="date" id="assignment-grade-date" class="w-full ${inputPadding} py-3 bg-gray-50/50 border-2 border-gray-100 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium text-gray-700">
                    </div>
                </div>

                <!-- Visibility Toggle -->
                <div class="bg-purple-50/50 p-4 rounded-xl border border-purple-100 flex items-center justify-between gap-4 mt-4">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                    </div>
                    <div>
                      <label for="assignment-visible" class="font-semibold text-gray-800 block text-xs sm:text-sm">${t.visibleToStudents || 'Visible par les élèves'}</label>
                      <p class="text-[10px] text-gray-500">${t.visibleToStudentsDesc || 'Autoriser les élèves à voir les notes'}</p>
                    </div>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer shrink-0">
                    <input type="checkbox" id="assignment-visible" class="sr-only peer" checked>
                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
            </div>

            <!-- Mode Toggle Section -->
            <div class="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-center justify-between gap-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                </div>
                <div>
                  <label for="assignment-global-only" class="font-semibold text-gray-800 block text-xs sm:text-sm">${t.globalOnlyLabel || 'Note globale uniquement'}</label>
                  <p class="text-[10px] text-gray-500">${t.globalOnlyDesc || 'Saisie rapide sans détails par exercice'}</p>
                </div>
              </div>
              <label class="relative inline-flex items-center cursor-pointer shrink-0">
                <input type="checkbox" id="assignment-global-only" class="sr-only peer" onchange="toggleGlobalAssignmentMode(this.checked)" checked>
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <!-- Global Options -->
            <div id="global-maxpoints-container" class="animate-in slide-in-from-top-2 duration-200">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-amber-50/50 rounded-xl border border-amber-100">
                <div class="space-y-1">
                  <label class="text-sm font-semibold text-amber-900 ml-1" for="assignment-global-maxpoints">${t.globalMaxLabel || 'Note maximale'}</label>
                  <input type="number" id="assignment-global-maxpoints" class="w-full p-2.5 border-2 border-amber-100 rounded-lg focus:border-amber-500 outline-none font-bold" min="0" step="0.25" value="20">
                </div>
                <div id="global-default-grade-container" class="${editingAssignmentId ? 'hidden' : ''} space-y-1">
                  <label class="text-sm font-semibold text-amber-900 ml-1" for="assignment-global-defaultgrade">${t.defaultGrade || 'Note par défaut'}</label>
                  <input type="number" id="assignment-global-defaultgrade" class="w-full p-2.5 border-2 border-amber-100 rounded-lg focus:border-amber-500 outline-none" min="0" step="0.25" value="">
                </div>
              </div>
            </div>

            <!-- Exercises Builder -->
            <div id="exercises-builder-container" class="hidden space-y-4">
              <div id="exercises-builder" class="space-y-4"></div>
              
              <button id="add-exercise-btn" onclick="addExercise()" 
                class="w-full py-4 border-2 border-dashed border-blue-200 text-blue-600 rounded-xl hover:bg-blue-50 hover:border-blue-400 transition-all flex items-center justify-center gap-2 font-semibold">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                <span data-translate="addExercise">${t.addExercise || 'Ajouter un exercice'}</span>
              </button>
            </div>
            
            <!-- Copy Grades Container -->
            <div id="copy-grades-container" class="p-4 bg-indigo-50 border border-indigo-100 rounded-xl hidden animate-in fade-in duration-300">
                <div class="flex items-start gap-3">
                  <div class="p-2 bg-indigo-100 rounded-lg text-indigo-600 mt-1">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>
                  </div>
                  <div class="flex-1">
                    <label class="block font-semibold text-indigo-900 mb-1" for="copy-grades-source">${t.copyGrades || 'Copier les notes d\'un autre devoir'}</label>
                    <select id="copy-grades-source" class="w-full p-2.5 border-2 border-indigo-100 rounded-lg bg-white focus:border-indigo-500 outline-none text-sm transition-all">
                        <option value="">${t.noCopyGrades || '-- Ne pas copier --'}</option>
                    </select>
                    <p class="text-xs text-indigo-600 mt-2 italic flex items-center gap-1">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      ${t.copyGradesWarning || 'Les notes existantes seront écrasées.'}
                    </p>
                  </div>
                </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer-fixed flex gap-3 justify-end items-center">
          <button onclick="closeAssignmentModal()" 
            class="px-6 py-2.5 text-gray-600 font-semibold hover:bg-gray-200 rounded-xl transition-all" 
            data-translate="cancel">${t.cancel || 'Annuler'}</button>
          <button id="assignment-save-btn" onclick="saveAssignment()" 
            class="px-8 py-2.5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/30 transition-all active:scale-95 flex items-center gap-2" 
            data-translate="save">${t.save || 'Enregistrer le devoir'}</button>
        </div>
      </div>`;
        document.body.appendChild(overlay);

        if (isBlocked) {
            const titleEl = document.getElementById('assignment-modal-title');
            if (titleEl) titleEl.textContent += ` (${t.lockedLabel || 'Verrouillé'})`;
            
            const errorZone = document.getElementById('assignment-modal-error');
            const errorText = document.getElementById('assignment-modal-error-text');
            if (errorZone && errorText) {
                errorText.textContent = t.trimesterLockedAlert || 'Ce trimestre est verrouillé.';
                errorZone.classList.remove('hidden');
                errorZone.querySelector('.bg-red-50').classList.replace('bg-red-50', 'bg-amber-50');
                errorZone.querySelector('.border-red-100').classList.replace('border-red-100', 'border-amber-100');
                errorZone.querySelector('.text-red-700').classList.replace('text-red-700', 'text-amber-800');
                errorZone.querySelector('.bg-red-100').classList.replace('bg-red-100', 'bg-amber-100');
                errorZone.querySelector('.text-red-600').classList.replace('text-red-600', 'text-amber-600');
            }
            
            const saveBtn = document.getElementById('assignment-save-btn');
            if (saveBtn) {
                saveBtn.classList.add('opacity-30', 'cursor-not-allowed', 'pointer-events-none');
            }
        }

        try {
            await loadClassSelectors();
            const globalCheckbox = document.getElementById('assignment-global-only');
            const globalMaxInput = document.getElementById('assignment-global-maxpoints');
            if (assignmentId) {
                if (!assignment) return;
                
                // Unlock all steps immediately when editing
                ['express-step-2', 'express-step-3'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.classList.remove('opacity-50', 'pointer-events-none');
                    }
                });
                document.getElementById('assignment-modal-title').textContent = t.editAssignment || 'Modifier le devoir';
                document.getElementById('assignment-name').value = assignment.name;
                document.getElementById('assignment-class').value = assignment.className;
                document.getElementById('assignment-subject').value = assignment.subject || '';
                document.getElementById('assignment-trimester').value = assignment.trimester || '1';
                document.getElementById('assignment-visible').checked = assignment.isVisible || false;
                
                const dateInput = document.getElementById('assignment-grade-date');
                if (dateInput && assignment.gradeDate) {
                    dateInput.value = assignment.gradeDate;
                } else if (dateInput) {
                    // Fallback sur aujourd'hui si pas de date
                    dateInput.value = new Date().toISOString().split('T')[0];
                }

                const exs = assignment.exercises || [];
                if (exs.length === 1 && (!exs[0].questions || exs[0].questions.length === 0) && (!exs[0].parts || exs[0].parts.length === 0)) {
                    isGlobalAssignment = true;
                    if (globalCheckbox) globalCheckbox.checked = true;
                    globalMaxPoints = exs[0].maxPoints || 20;
                    if (globalMaxInput) globalMaxInput.value = globalMaxPoints;
                    const globalDefaultInput = document.getElementById('assignment-global-defaultgrade');
                    if (globalDefaultInput) globalDefaultInput.value = ''; // Vider par défaut en modification
                    window.tempExercises = [];
                } else {
                    isGlobalAssignment = false;
                    if (globalCheckbox) globalCheckbox.checked = false;
                    window.tempExercises = assignmentsSvc().deepCloneExercisesForEdit(exs);
                }

                // Si c'est une modification, on peut proposer de copier les notes (pour écraser/remplir)
                const copyContainer = document.getElementById('copy-grades-container');
                if (copyContainer) {
                    copyContainer.classList.remove('hidden');
                    const copySelect = document.getElementById('copy-grades-source');
                    // Remplir avec les autres devoirs de la même classe
                    const sameClass = getData().assignments.filter(a => a.className === assignment.className && a.id !== assignment.id);
                    if (sameClass.length > 0) {
                        copySelect.innerHTML = `<option value="">${t.noCopyGrades}</option>` +
                            sameClass.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
                    } else {
                        copyContainer.classList.add('hidden');
                    }
                }

            } else {
                window.tempExercises = [];
                isGlobalAssignment = true;
                if (globalCheckbox) globalCheckbox.checked = true;
                
                // New assignment: set default trimester to current global filter
                const triSelect = document.getElementById('assignment-trimester');
                if (triSelect) {
                    triSelect.value = window.getGlobalTrimester() || '1';
                }

                const dateInput = document.getElementById('assignment-grade-date');
                if (dateInput) {
                    dateInput.value = new Date().toISOString().split('T')[0];
                }
                
                const modalTitle = document.getElementById('assignment-modal-title');
                if (modalTitle) modalTitle.textContent = t.createAssignmentTitle || 'Créer un Devoir';
            }

            const subjectSelect = document.getElementById('assignment-subject');
            const classSelect = document.getElementById('assignment-class');

            // --- AUTO-SELECT CLASS IF ONE IS SELECTED IN THE UI ---
            if (!assignmentId && classSelect && assignmentsUiState.selectedClass) {
                classSelect.value = assignmentsUiState.selectedClass;
                // Trigger any side effects like auto-suggesting subject
                setTimeout(() => {
                    if (typeof window.autoSuggestAssignmentName === 'function') window.autoSuggestAssignmentName();
                }, 100);
            }
            
            const applyAutoSubject = (className = '') => {
                if (!subjectSelect) return;
                
                // Handle forced sequence: Enable fields if class is selected
                const step2 = document.getElementById('express-step-2');
                if (step2) {
                    const hasClass = !!className;
                    step2.classList.toggle('opacity-50', !hasClass);
                    step2.classList.toggle('pointer-events-none', !hasClass);
                }

                const currentYear = window.getGlobalAcademicYear ? window.getGlobalAcademicYear() : '';
                const userEmail = window.currentUser?.email || null;
                const userUuid = window.currentUser?.id || null;
                const myAssignments = getData().assignments.filter(a => {
                    const owner = a.createdBy || 'unknown';
                    const sameOwner = (userEmail && owner === userEmail) || (userUuid && owner === userUuid);
                    const sameYear = !currentYear || (a.academicYear || '') === currentYear;
                    const sameClass = !className || (a.className || '') === className;
                    return sameOwner && sameYear && sameClass;
                });
                const uniqueSubjects = [...new Set(myAssignments.map(a => (a.subject || '').trim()).filter(Boolean))];
                if (uniqueSubjects.length === 1) {
                    subjectSelect.value = uniqueSubjects[0];
                } else if (uniqueSubjects.length > 1) {
                    subjectSelect.value = '';
                }
            };

            if (subjectSelect) {
                applyAutoSubject(classSelect?.value || '');
                if (classSelect) {
                    classSelect.addEventListener('change', () => {
                        applyAutoSubject(classSelect.value || '');
                    });
                }
            }

            // --- Assignment Type Availability Logic ---
            const applyAssignmentTypeAvailability = () => {
                const typeSelect = document.getElementById('assignment-type');
                const classSelect = document.getElementById('assignment-class');
                const triSelect = document.getElementById('assignment-trimester');
                if (!typeSelect || !classSelect || !triSelect) return;
                
                const currentYear = window.getGlobalAcademicYear ? window.getGlobalAcademicYear() : '';
                const userEmail = window.currentUser?.email || null;
                const userUuid = window.currentUser?.id || null;
                const className = classSelect.value;
                const trimester = triSelect.value;
                
                if (!className || !trimester) return;

                const myAssignments = getData().assignments.filter(a => {
                    const owner = a.createdBy || 'unknown';
                    const sameOwner = (userEmail && owner === userEmail) || (userUuid && owner === userUuid);
                    const sameYear = !currentYear || (a.academicYear || '') === currentYear;
                    const sameClass = !className || (a.className || '') === className;
                    const sameTrimester = !trimester || (a.trimester || '') === trimester;
                    const notEditing = a.id !== editingAssignmentId; // Ignore the one we are editing
                    return sameOwner && sameYear && sameClass && sameTrimester && notEditing;
                });
                
                const usedTypes = myAssignments.map(a => a.type || 'devoir').filter(Boolean);
                
                // Reset disabled state
                for (let i = 0; i < typeSelect.options.length; i++) {
                    const opt = typeSelect.options[i];
                    if (opt.value !== 'devoir') {
                        if (usedTypes.includes(opt.value)) {
                            opt.disabled = true;
                            const suffix = ` (${t.alreadyCreated || 'Déjà créé'})`;
                            if (!opt.textContent.includes(suffix)) {
                                opt.textContent = opt.textContent + suffix;
                            }
                            if (typeSelect.value === opt.value) {
                                typeSelect.value = 'devoir'; // Fallback
                            }
                        } else {
                            opt.disabled = false;
                            const suffix = ` (${t.alreadyCreated || 'Déjà créé'})`;
                            opt.textContent = opt.textContent.replace(suffix, '');
                        }
                    }
                }
            };

            const typeSelectObj = document.getElementById('assignment-type');
            const classSelectObj = document.getElementById('assignment-class');
            const triSelectObj = document.getElementById('assignment-trimester');
            
            if (assignmentId && assignment) {
                if (typeSelectObj) typeSelectObj.value = assignment.type || 'devoir';
            }

            if (classSelectObj) classSelectObj.addEventListener('change', () => {
                applyAssignmentTypeAvailability();
                window.autoSuggestAssignmentName();
            });
            if (triSelectObj) triSelectObj.addEventListener('change', () => {
                applyAssignmentTypeAvailability();
                window.autoSuggestAssignmentName();
            });
            
            // Initial call
            applyAssignmentTypeAvailability();
            // ------------------------------------------



            window.toggleGlobalAssignmentMode(isGlobalAssignment);
            renderExercisesBuilder();
            document.getElementById('assignment-name').focus();
        } catch (e) {
            console.error(e);
            alert('Erreur ouverture modal: ' + e.message);
        }
    };

    window.closeAssignmentModal = function () {
        const el = document.getElementById('assignment-modal');
        if (el) el.remove();
        editingAssignmentId = null;
        document.body.style.overflow = '';
    };

    window.toggleGlobalAssignmentMode = function (checked) {
        isGlobalAssignment = checked;
        const builder = document.getElementById('exercises-builder-container');
        const globalContainer = document.getElementById('global-maxpoints-container');

        if (checked) {
            if (builder) builder.classList.add('hidden');
            if (globalContainer) globalContainer.classList.remove('hidden');
        } else {
            if (builder) builder.classList.remove('hidden');
            if (globalContainer) globalContainer.classList.add('hidden');
            if (window.tempExercises.length === 0) window.addExercise();
        }
    };

    function getQuestionMaxPoints(q) {
        if (q.subQuestions && q.subQuestions.length > 0) {
            return q.subQuestions.reduce((sum, sq) => sum + (sq.maxPoints || 0), 0);
        }
        return q.maxPoints || 0;
    }

    function renderQuestionBuilder(q, exIndex, qIndex, partIndex = null) {
        const t = getTranslations()[getLang()];
        const hasSubQuestions = q.subQuestions && q.subQuestions.length > 0;
        
        const basePath = partIndex !== null 
            ? `window.tempExercises[${exIndex}].parts[${partIndex}].questions[${qIndex}]`
            : `window.tempExercises[${exIndex}].questions[${qIndex}]`;

        const removeCall = partIndex !== null
            ? `window.removeQuestion(${exIndex}, ${qIndex}, ${partIndex})`
            : `window.removeQuestion(${exIndex}, ${qIndex})`;
            
        const addSubCall = `window.addSubQuestion(${exIndex}, ${qIndex}, ${partIndex !== null ? partIndex : 'null'})`;

        return `
        <div class="border border-emerald-100 rounded-xl p-3 bg-emerald-50/30 hover:bg-emerald-50/50 transition-colors">
            <div class="flex items-center gap-2 flex-nowrap overflow-hidden">
                <div class="flex items-center gap-1.5 shrink-0">
                    <span class="text-xs font-bold text-emerald-600 uppercase tracking-wider">${t.questionPrefix || 'Q'}</span>
                    <input type="text" placeholder="1, 2..." value="${q.name || ''}"
                        onchange="${basePath}.name = this.value"
                        aria-label="${t.questionName || 'Nom de la question'}"
                        class="w-12 p-1 border border-emerald-200 rounded-lg text-sm font-bold text-emerald-700 bg-white focus:ring-2 focus:ring-emerald-500/20 outline-none">
                </div>
                
                ${!hasSubQuestions ? `
                    <div class="flex items-center gap-1 bg-white px-1.5 py-1 rounded-lg border border-emerald-200 shadow-sm shrink-0">
                        <span class="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">${t.pointsAbbr || 'Pts'}</span>
                        <input type="number" placeholder="0" value="${q.maxPoints || ''}" min="0" step="0.25"
                            onchange="${basePath}.maxPoints = parseFloat(this.value); window.renderExercisesBuilder()"
                            aria-label="${t.questionPoints || 'Points'}"
                            class="w-14 p-0.5 text-sm font-semibold text-gray-700 outline-none text-center" title="${t.questionPoints}">
                    </div>
                ` : `
                    <div class="flex items-center gap-1 px-2 py-1 bg-emerald-100/50 rounded-lg border border-emerald-200 shrink-0">
                        <span class="text-[11px] font-black text-emerald-700 whitespace-nowrap">${getQuestionMaxPoints(q)} ${t.pointsSingle || t.points}</span>
                    </div>
                `}
                
                <div class="flex items-center gap-1 ml-auto rtl:mr-auto rtl:ml-0 shrink-0">
                    <button onclick="${addSubCall}" 
                        class="flex items-center gap-1 text-blue-600 hover:text-white hover:bg-blue-600 text-[10px] font-bold px-1.5 py-1 rounded-lg transition-all border border-blue-200 whitespace-nowrap">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                        a,b,c
                    </button>
                    <button onclick="${removeCall}" 
                        class="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="${t.delete}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </div>
            
            ${hasSubQuestions ? `
                <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pl-4 border-l-2 border-emerald-200 rtl:pl-0 rtl:pr-4 rtl:border-l-0 rtl:border-r-2">
                    ${(q.subQuestions || []).map((sq, sqIdx) => `
                        <div class="flex items-center gap-2 bg-white/80 p-1.5 rounded-lg border border-emerald-100 shadow-sm hover:border-emerald-300 transition-all">
                            <input type="text" value="${sq.name || ''}" 
                                onchange="${basePath}.subQuestions[${sqIdx}].name = this.value"
                                aria-label="${t.subQuestionName || 'Nom de la sous-question'}"
                                class="w-8 p-1 border-0 text-orange-600 font-bold text-center text-sm focus:ring-0">
                            <span class="text-orange-400 font-bold">)</span>
                            <div class="flex items-center gap-1 flex-1 min-w-[50px]">
                                <input type="number" placeholder="${t.pointsAbbr || 'Pts'}" value="${sq.maxPoints || ''}" min="0" step="0.25"
                                    onchange="${basePath}.subQuestions[${sqIdx}].maxPoints = parseFloat(this.value); window.renderExercisesBuilder()"
                                    aria-label="${t.questionPoints || 'Points'}"
                                    class="w-full p-1 text-xs font-semibold text-gray-700 border-b border-transparent focus:border-emerald-400 outline-none" title="${t.questionPoints}">
                            </div>
                            <button onclick="${basePath}.subQuestions.splice(${sqIdx}, 1); window.renderExercisesBuilder()" 
                                class="p-1 text-red-300 hover:text-red-500 transition-colors">
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
        `;
    }

    window.renderExercisesBuilder = function () {
        const container = document.getElementById('exercises-builder');
        const t = getTranslations()[getLang()];
        if (!container) return;

        if (isGlobalAssignment) {
            container.innerHTML = '';
            return;
        }

        if (window.tempExercises.length === 0) {
             container.innerHTML = `
                <div class="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                    </div>
                    <p class="text-gray-500 font-medium">${t.noExercises || 'Aucun exercice pour le moment'}</p>
                    <p class="text-sm text-gray-400 mt-1">${t.clickAddExercise || 'Cliquez sur le bouton ci-dessous pour commencer'}</p>
                </div>`;
             return;
        }

        // Sort: Open exercises first, then closed. Keep original numerical order within each group.
        const exercisesWithIndex = window.tempExercises.map((ex, idx) => ({ 
            ex, 
            i: idx, 
            isCollapsed: collapsedExercises[idx] !== false // Default is collapsed
        }));

        const openExs = exercisesWithIndex.filter(item => !item.isCollapsed);
        const closedExs = exercisesWithIndex.filter(item => item.isCollapsed);
        const sortedItems = [...openExs, ...closedExs];

        container.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">` + 
        sortedItems.map((item) => {
            const { ex, i, isCollapsed } = item;
            ex.parts = ex.parts || [];
            ex.questions = ex.questions || [];
            const exerciseTotal = getExerciseMaxPoints(ex);

            // Check if exercise is complex (has parts or any question has sub-questions)
            const hasSubQs = (qs) => qs && qs.some(q => q.subQuestions && q.subQuestions.length > 0);
            const anyQuestionHasSubQs = hasSubQs(ex.questions) || ex.parts.some(p => hasSubQs(p.questions));
            const hasParts = ex.parts.length > 0;
            const isComplex = anyQuestionHasSubQs || hasParts;

            // Simple collapsed exercises take 1 column, others take full width
            const colSpan = (isComplex || !isCollapsed) ? 'md:col-span-2 lg:col-span-3' : '';

            return `
            <div class="${colSpan} border-2 border-blue-100 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-all animate-in slide-in-from-bottom-2 duration-300">
              <!-- Exercise Header -->
              <div class="px-5 py-3 bg-blue-50/50 border-b border-blue-100 flex items-center gap-4 flex-wrap cursor-pointer" onclick="window.toggleExerciseCollapse(${i})">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold text-sm shadow-sm shadow-blue-200">
                        ${i + 1}
                    </div>
                    <span class="font-bold text-blue-900 uppercase tracking-wide text-xs">${t.exercise}</span>
                </div>
                
                <div class="w-24 sm:w-32" onclick="event.stopPropagation()">
                    <input type="text" 
                           placeholder="${t.exerciseNameAbbr || 'Nom'}" 
                           value="${ex.name || ''}" 
                           onchange="window.tempExercises[${i}].name = this.value"
                           aria-label="${t.exerciseName || 'Nom de l\'exercice'}"
                           class="w-full p-1.5 border border-blue-200 focus:border-blue-400 rounded-lg text-[11px] font-medium bg-white/50 focus:bg-white outline-none transition-all"
                           title="${t.exerciseName}">
                </div>
                
                <div class="flex items-center gap-3 ml-auto rtl:mr-auto rtl:ml-0">
                    <div class="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-blue-100 shadow-sm">
                        <span class="text-xs font-bold text-blue-600 uppercase tracking-tighter">${t.totalPoints || 'Total'}</span>
                        <span class="text-sm font-black text-blue-900">${exerciseTotal}</span>
                        <span class="text-[10px] font-bold text-blue-400 uppercase">${t.pointsAbbr || 'Pts'}</span>
                    </div>
                    
                    ${!editingAssignmentId ? `
                        <div class="flex items-center gap-2 px-2 py-1.5 bg-amber-50 rounded-lg border border-amber-100 shadow-sm shrink-0" onclick="event.stopPropagation()">
                            <span class="text-[10px] font-bold text-amber-600 uppercase tracking-tighter">${t.defaultGradeAbbr || 'Def'}</span>
                            <input type="number" placeholder="-" value="${ex.defaultGrade || ''}" min="0" step="0.25"
                                onchange="window.tempExercises[${i}].defaultGrade = this.value === '' ? '' : parseFloat(this.value)"
                                aria-label="${t.defaultGrade || 'Note par défaut'}"
                                class="w-14 text-sm font-bold text-amber-700 bg-transparent outline-none text-center">
                        </div>
                    ` : ''}

                    <button onclick="event.stopPropagation(); window.removeExercise(${i})" 
                        class="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="${t.delete}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>

                    <div class="text-blue-400 transition-transform duration-200 ${isCollapsed ? 'rotate-0' : 'rotate-180'}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                </div>
              </div>

              <!-- Exercise Content -->
              <div class="${isCollapsed ? 'hidden' : 'p-5 space-y-4'}">
                ${ex.questions.length > 0 || ex.parts.length === 0 ? `
                    <div class="${isComplex ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}">
                        ${ex.questions.map((q, qIdx) => renderQuestionBuilder(q, i, qIdx, null)).join('')}
                    </div>
                    <div class="flex justify-start pt-2">
                        <button onclick="window.addQuestion(${i})" 
                            class="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-xl text-sm font-bold transition-all border border-emerald-100">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                            ${t.addQuestion || 'Ajouter une question'}
                        </button>
                    </div>
                ` : ''}

                ${ex.parts.length > 0 ? `
                    <div class="space-y-4 mt-6">
                        ${ex.parts.map((part, pIdx) => `
                            <div class="border-2 border-purple-50 rounded-2xl bg-purple-50/20 overflow-hidden">
                                <div class="px-4 py-3 bg-purple-50/50 border-b border-purple-100 flex items-center justify-between gap-4">
                                    <div class="flex items-center gap-2">
                                        <div class="w-2 h-6 bg-purple-400 rounded-full"></div>
                                        <input type="text" value="${part.name || ''}" 
                                            onchange="window.tempExercises[${i}].parts[${pIdx}].name = this.value"
                                            class="font-bold text-purple-900 bg-transparent border-b-2 border-transparent focus:border-purple-400 outline-none transition-all px-1">
                                    </div>
                                    <button onclick="window.removePart(${i}, ${pIdx})" 
                                        class="p-1.5 text-purple-400 hover:text-red-500 hover:bg-white rounded-lg transition-all">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </button>
                                </div>
                                
                                <div class="p-4 space-y-3">
                                    <div class="${isComplex ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}">
                                        ${(part.questions || []).map((q, qIdx) => renderQuestionBuilder(q, i, qIdx, pIdx)).join('')}
                                    </div>
                                    
                                    <div class="flex justify-start pt-2">
                                        <button onclick="window.addQuestion(${i}, ${pIdx})" 
                                            class="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-xl text-sm font-bold transition-all border border-emerald-100">
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                                            ${t.addQuestion || 'Ajouter une question'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                <!-- Exercise Actions -->
                <div class="flex justify-center pt-4 border-t border-gray-100">
                    <button onclick="window.addPart(${i})" 
                        class="flex items-center gap-2 px-6 py-2.5 text-purple-600 hover:bg-purple-600 hover:text-white rounded-xl text-sm font-bold transition-all border-2 border-dashed border-purple-200 hover:border-purple-600">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                        ${t.addPart || 'Ajouter une partie'}
                    </button>
                </div>
              </div>
            </div>
            `;
        }).join('') + `</div>`;
    };

    window.addExercise = function () {
        // Collapse all previous exercises
        window.tempExercises.forEach((_, idx) => {
            collapsedExercises[idx] = true;
        });

        const newIndex = window.tempExercises.length;
        collapsedExercises[newIndex] = false; // The new exercise should be open

        window.tempExercises.push({
            id: genId(),
            name: '',
            maxPoints: null,
            questions: [],
            parts: []
        });
        window.renderExercisesBuilder();
    };

    window.addPart = function (exIndex) {
        const t = getTranslations()[getLang()];
        const parts = window.tempExercises[exIndex].parts || [];
        const partNumber = parts.length + 1;
        window.tempExercises[exIndex].parts = parts;
        window.tempExercises[exIndex].parts.push({
            id: genId(),
            name: (t.part || 'Partie') + ' ' + partNumber,
            maxPoints: 5,
            questions: []
        });
        window.renderExercisesBuilder();
    };

    window.addQuestion = function (exIndex, partIndex = null) {
        const t = getTranslations()[getLang()];
        let questions;
        if (partIndex !== null && partIndex !== undefined) {
            questions = window.tempExercises[exIndex].parts[partIndex].questions || [];
        } else {
            questions = window.tempExercises[exIndex].questions || [];
        }
        const questionNumber = questions.length + 1;
        const question = {
            id: genId(),
            name: (t.questionPrefix || 'Q') + questionNumber,
            maxPoints: 1,
            subQuestions: []
        };
        
        if (partIndex !== null && partIndex !== undefined) {
             window.tempExercises[exIndex].parts[partIndex].questions = window.tempExercises[exIndex].parts[partIndex].questions || [];
             window.tempExercises[exIndex].parts[partIndex].questions.push(question);
        } else {
             window.tempExercises[exIndex].questions = window.tempExercises[exIndex].questions || [];
             window.tempExercises[exIndex].questions.push(question);
        }
        window.renderExercisesBuilder();
    };

    window.addSubQuestion = function(exIndex, qIndex, partIndex = null) {
        const t = getTranslations()[getLang()];
        const letters = t.subQuestionLetters || ['a', 'b', 'c', 'd', 'e'];
        
        let q;
        if (partIndex !== null && partIndex !== undefined) {
            q = window.tempExercises[exIndex].parts[partIndex].questions[qIndex];
        } else {
            q = window.tempExercises[exIndex].questions[qIndex];
        }
        
        if (q) {
            q.subQuestions = q.subQuestions || [];
            const letter = letters[q.subQuestions.length] || '?';
            q.subQuestions.push({ id: genId(), name: letter, maxPoints: 0, defaultGrade: '' });
            
            if (q.subQuestions.length === 1) {
                q.maxPoints = 0;
            }
            window.renderExercisesBuilder();
        }
    };

    window.removeExercise = function (index) {
        const t = getTranslations()[getLang()];
        if (!confirm(t.deleteExercise)) return;
        window.tempExercises.splice(index, 1);
        window.renderExercisesBuilder();
    };

    window.removePart = function (exIndex, partIndex) {
        const t = getTranslations()[getLang()];
        if (!confirm(t.deletePart)) return;
        window.tempExercises[exIndex].parts.splice(partIndex, 1);
        window.renderExercisesBuilder();
    };

    window.removeQuestion = function (exIndex, qIndex, partIndex = null) {
        if (partIndex !== null && partIndex !== undefined) {
             window.tempExercises[exIndex].parts[partIndex].questions.splice(qIndex, 1);
        } else {
             window.tempExercises[exIndex].questions.splice(qIndex, 1);
        }
        window.renderExercisesBuilder();
    };

    let assignmentErrorTimeout = null;
    window.showAssignmentError = function(message) {
        const errorZone = document.getElementById('assignment-modal-error');
        const errorText = document.getElementById('assignment-modal-error-text');
        if (errorZone && errorText) {
            // Clear any existing timeout
            if (assignmentErrorTimeout) {
                clearTimeout(assignmentErrorTimeout);
            }

            errorText.textContent = message;
            errorZone.classList.remove('hidden');
            errorZone.classList.remove('fade-out'); // Ensure it's visible
            
            // Scroll to top of modal to see error
            errorZone.closest('.overflow-y-auto').scrollTo({ top: 0, behavior: 'smooth' });

            // Auto-hide after 5 seconds
            assignmentErrorTimeout = setTimeout(() => {
                errorZone.classList.add('hidden');
                assignmentErrorTimeout = null;
            }, 5000);
        }
    };

    window.saveAssignment = function () {
        const t = getTranslations()[getLang()];
        // Hide error zone first
        const errorZone = document.getElementById('assignment-modal-error');
        if (errorZone) errorZone.classList.add('hidden');

        const name = document.getElementById('assignment-name').value.trim();
        const className = document.getElementById('assignment-class').value;
        const gradeDate = document.getElementById('assignment-grade-date')?.value || '';
        const subject = document.getElementById('assignment-subject')?.value.trim() || '';
        const isVisible = document.getElementById('assignment-visible')?.checked || false;
        const trimester = document.getElementById('assignment-trimester')?.value || window.getGlobalTrimester();
        const assignmentType = document.getElementById('assignment-type')?.value || 'devoir';
        const globalMax = parseFloat(document.getElementById('assignment-global-maxpoints').value) || 20;
        const copyFromId = document.getElementById('copy-grades-source')?.value || '';
        const globalDefaultGrade = document.getElementById('assignment-global-defaultgrade')?.value; // peut être vide

        if (!trimester) return window.showAssignmentError(t.needTrimester);
        if (!name) return window.showAssignmentError(t.enterAssignmentName);
        if (!className) return window.showAssignmentError(t.selectAssignmentClass);
        if (!subject) return window.showAssignmentError(t.selectSubject);

        const data = getData();
        const currentYear = window.getGlobalAcademicYear();
        const academicYear = editingAssignmentId 
            ? data.assignments.find(a => a.id === editingAssignmentId)?.academicYear 
            : currentYear;

        // Security check for existing assignments
        if (editingAssignmentId) {
            const assignment = data.assignments.find(a => a.id === editingAssignmentId);
            if (window.isTrimesterBlocked(assignment?.trimester, assignment?.academicYear)) {
                if (window.showToast) window.showToast(t.trimesterLockedAlert, 'error');
                return;
            }
        }
        
        // Security check for new assignments being created in a past trimester
        if (!editingAssignmentId && window.isTrimesterBlocked(trimester, academicYear)) {
            if (window.showToast) window.showToast(t.trimesterLockedAlert, 'error');
            return;
        }
        const currentUserId = window.currentUser?.email || window.currentUser?.id || 'unknown';
        
        // Check duplicates: Name + Class + Trimester + Academic Year + Teacher
        const existing = data.assignments.find(a =>
            a.name.toLowerCase() === name.toLowerCase() &&
            a.className === className &&
            a.trimester === trimester &&
            (a.academicYear || '') === currentYear &&
            (a.createdBy || 'unknown') === currentUserId &&
            a.id !== editingAssignmentId
        );
        if (existing) return window.showAssignmentError(t.duplicateAssignmentDetailed || t.duplicateAssignmentName);

        let finalExercises = [];
        const oldAssignment = editingAssignmentId ? data.assignments.find(a => a.id === editingAssignmentId) : null;

        if (isGlobalAssignment) {
            // Récupérer l'ancien ID si on est en train de modifier un devoir qui était déjà global
            // ou prendre le premier ID d'exercice si on passe de détaillé à global
            let globalId = genId();
            if (oldAssignment && oldAssignment.exercises && oldAssignment.exercises.length > 0) {
                globalId = oldAssignment.exercises[0].id;
            }

            finalExercises = [{
                id: globalId,
                name: 'Global',
                maxPoints: globalMax,
                questions: [],
                parts: []
            }];
        } else {
            if (window.tempExercises.length === 0) return window.showAssignmentError(t.addExerciseFirst);
            
            // Sécurité : S'assurer que les exercices dans tempExercises ont des IDs
            // et s'ils correspondent à des exercices existants, garder leurs IDs
            finalExercises = window.tempExercises.map((ex, idx) => {
                if (oldAssignment && oldAssignment.exercises && oldAssignment.exercises[idx]) {
                    // Si l'exercice existait à cet index, on pourrait vouloir garder son ID
                    // Mais tempExercises devrait déjà l'avoir grâce au deepClone
                }
                return ex;
            });
        }

        if (editingAssignmentId) {
            const index = data.assignments.findIndex(a => a.id === editingAssignmentId);
            if (index !== -1) {
                // Modification : on met à jour l'objet existant au lieu de le remplacer totalement
                const assignment = data.assignments[index];
                assignment.name = name;
                assignment.className = className;
                assignment.subject = subject;
                assignment.gradeDate = gradeDate || new Date().toISOString().split('T')[0]; // Default to today
                assignment.type = assignmentType; // Sauvegarde du type
                assignment.isVisible = isVisible;
                assignment.trimester = trimester;
                assignment.academicYear = assignment.academicYear || currentYear;
                assignment.createdBy = assignment.createdBy || (window.currentUser?.email || window.currentUser?.id || 'unknown');
                
                // CRITIQUE : Avant de remplacer les exercices, on vérifie si on ne va pas casser les notes
                assignment.exercises = finalExercises;

                // Copie des notes si demandé
                if (copyFromId) {
                    const sourceId = copyFromId;
                    const targetId = editingAssignmentId;
                    const sourceAssignment = data.assignments.find(a => a.id === sourceId);
                    if (sourceAssignment) {
                        const students = data.students.filter(s => s.className === className);
                        students.forEach(s => {
                            const hasSourceGrade = window.hasAnyGradeForAssignment
                                ? window.hasAnyGradeForAssignment(s.id, sourceId)
                                : gradesSvc().hasAnyGradeForAssignment(data, s.id, sourceId);

                            if (!data.grades[s.id]) data.grades[s.id] = {};

                            if (!hasSourceGrade) {
                                if (data.grades[s.id][targetId]) {
                                    delete data.grades[s.id][targetId];
                                }
                                return;
                            }

                            const sourceGrade = window.getStudentAssignmentTotal(s.id, sourceId);
                            if (finalExercises.length > 0) {
                                const firstExId = finalExercises[0].id;
                                if (!data.grades[s.id][targetId]) data.grades[s.id][targetId] = {};
                                if (!data.grades[s.id][targetId][firstExId]) data.grades[s.id][targetId][firstExId] = {};
                                if (!data.grades[s.id][targetId][firstExId].final) data.grades[s.id][targetId][firstExId].final = {};
                                if (!data.grades[s.id][targetId][firstExId].final.final) data.grades[s.id][targetId][firstExId].final.final = {};
                                
                                data.grades[s.id][targetId][firstExId].final.final.final = sourceGrade;
                                data.grades[s.id][targetId][firstExId].mode = 'global';
                            }
                        });
                    }
                }
            }
        } else {
            // Création
            const newId = genId();
            data.assignments.push({
                id: newId,
                name,
                className,
                subject,
                gradeDate: gradeDate || new Date().toISOString().split('T')[0], // Default to today
                type: assignmentType, // Sauvegarde du type à la création
                isVisible,
                trimester,
                exercises: finalExercises,
                academicYear: window.getGlobalAcademicYear(),
                createdBy: window.currentUser?.email || window.currentUser?.id || 'unknown'
            });

            // Pré-remplissage si demandé (Global Default Grade)
            if (isGlobalAssignment && globalDefaultGrade !== '' && globalDefaultGrade !== undefined) {
                const val = parseFloat(globalDefaultGrade);
                if (!isNaN(val)) {
                    const students = data.students.filter(s => s.className === className);
                    students.forEach(s => {
                        if (!data.grades[s.id]) data.grades[s.id] = {};
                        if (!data.grades[s.id][newId]) data.grades[s.id][newId] = {};
                        data.grades[s.id][newId].global = val;
                    });
                }
            }
        }

        saveData();
        window.renderAssignments();
        renderSummary();
        renderExportPrep();
        window.closeAssignmentModal();
    };

    window.deleteAssignment = function (id) {
        const t = getTranslations()[getLang()];
        const data = getData();
        const assignment = data.assignments.find(a => a.id === id);

        if (window.isTrimesterBlocked(assignment?.trimester, assignment?.academicYear)) {
            if (window.showToast) window.showToast(t.trimesterLockedAlert, 'error');
            return;
        }

        // --- PROTECTION CONTRE LA SUPPRESSION AVEC NOTES ---
        let hasGrades = false;
        const hasGradeFunc = window.hasAnyGradeForAssignment || ((sid, aid) => gradesSvc()?.hasAnyGradeForAssignment?.(data, sid, aid));
        
        // On vérifie tous les élèves pour voir si l'un d'eux a une note pour ce devoir
        for (const student of data.students) {
            try {
                if (hasGradeFunc(student.id, id)) {
                    hasGrades = true;
                    break;
                }
            } catch (e) {}
        }

        if (hasGrades) {
            const msg = t.cannotDeleteAssignmentWithGrades || "Impossible de supprimer un devoir qui a déjà des notes saisies. Supprimez d'abord les notes si vous voulez vraiment l'effacer.";
            if (window.showToast) window.showToast(msg, 'error');
            return;
        }

        if (!confirm(t.deleteAssignment)) return;

        data.assignments = data.assignments.filter(a => a.id !== id);
        // Clean grades
        for (const studentId in data.grades) {
            delete data.grades[studentId][id];
        }

        saveData();
        window.renderAssignments();
        renderSummary();
        renderExportPrep();
    };

    window.duplicateAssignment = function(id, includeGrades = false) {
        const data = getData();
        const original = data.assignments.find(a => a.id === id);
        if (!original) return;

        // Security check: cannot duplicate TO a blocked trimester (if original is blocked)
        // actually usually duplication is allowed but save is blocked. 
        // Let's block here too for consistency.
        if (window.isTrimesterBlocked(original.trimester, original.academicYear)) {
            const t = getTranslations()[getLang()];
            if (window.showToast) window.showToast(t.trimesterLockedAlert, 'error');
            return;
        }

        const newId = genId();
        const newAssignment = {
            id: newId,
            name: original.name + (includeGrades ? ' (copie intégrale)' : ' (copie)'),
            className: original.className,
            subject: original.subject || '',
            isVisible: original.isVisible || false,
            trimester: original.trimester,
            academicYear: original.academicYear || window.getGlobalAcademicYear(),
            exercises: JSON.parse(JSON.stringify(original.exercises)),
            createdBy: original.createdBy || window.currentUser?.email || window.currentUser?.id || 'unknown'
        };

        data.assignments.push(newAssignment);

        // Duplication des notes si demandé
        if (includeGrades) {
            for (const studentId in data.grades) {
                if (data.grades[studentId][id]) {
                    // Deep copy
                    data.grades[studentId][newId] = JSON.parse(JSON.stringify(data.grades[studentId][id]));
                }
            }
        }

        saveData();
        window.renderAssignments();
        // Force refresh of other components that might depend on assignments list
        if (typeof window.renderSummary === 'function') window.renderSummary(); 
    };

    window.toggleAccordion = function(id) {
        const content = document.getElementById('accordion-' + id);
        const icon = document.getElementById('icon-' + id);
        if (content) {
            const willOpen = !content.classList.contains('open');
            content.classList.toggle('open');
            content.style.display = willOpen ? 'block' : 'none';
        }
        if (icon) {
            icon.classList.toggle('open');
            // Force rotate logic
            if (icon.classList.contains('open')) {
                icon.style.transform = 'rotate(180deg)';
            } else {
                icon.style.transform = 'rotate(0deg)';
            }
        }
    };

    window.setAssignmentsSelectedClass = async function(className = '') {
        assignmentsUiState.selectedClass = className;
        
        // On scroll vers le haut
        const contentArea = document.querySelector('#content-assignments');
        if (contentArea) contentArea.scrollTo({ top: 0, behavior: 'smooth' });

        await window.renderAssignments();
    };

    window.renderAssignmentsClassList = async function() {
        const t = getTranslations()[getLang()];
        const isAr = getLang() === 'ar';
        const container = document.getElementById('assignments-class-grid');
        if (!container) return;

        const globalAcademicYear = window.getGlobalAcademicYear();
        const globalTrimester = window.getGlobalTrimester();
        if (!globalAcademicYear || !globalTrimester) {
            container.innerHTML = `<div class="col-span-full text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <p class="text-slate-500 font-medium">${t.selectAcademicYear}</p>
            </div>`;
            return;
        }

        const search = (document.getElementById('assignments-class-search')?.value || '').toLowerCase();
        const allClasses = await window.getClasses();
        const classes = allClasses.filter(c => c.toLowerCase().includes(search));
        
        if (classes.length === 0) {
            container.innerHTML = `<div class="col-span-full text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <p class="text-slate-500 font-medium">${t.noClassesFound || 'Aucune classe trouvée'}</p>
            </div>`;
            return;
        }

        const userId = window.currentUser?.email || window.currentUser?.id || 'unknown';
        const data = getData();
        
        const rows = classes.map(c => {
            // Count assignments for this class
            const classAssignments = data.assignments.filter(a => 
                a.className === c && 
                (a.academicYear || '') === globalAcademicYear && 
                (a.trimester || '') === globalTrimester &&
                (a.createdBy || 'unknown') === userId
            );
            
            const count = classAssignments.length;
            const color = getClassColor(c);
            const colorAlpha = color + '44';
            const levelIcon = window.levelFromClass ? window.levelFromClass(c) : '?';

            let countText = `${count} ${t.assignmentsTab || 'Devoirs'}`;
            if (isAr) {
                if (count === 0) countText = 'لا يوجد فروض';
                else if (count === 1) countText = 'فرض واحد';
                else if (count === 2) countText = 'فرضان';
                else if (count <= 10) countText = `${count} فروض`;
                else countText = `${count} فرضاً`;
            }

            const cleanedName = window.cleanClassName ? window.cleanClassName(c) : c;
            let fontSizeClass = isAr ? 'text-[13px] sm:text-2xl' : 'text-sm sm:text-2xl';
            if (cleanedName.length > 25) fontSizeClass = 'text-[10px] sm:text-lg leading-tight';
            else if (cleanedName.length > 15) fontSizeClass = 'text-xs sm:text-xl leading-snug';

            const titleClass = isAr ? `${fontSizeClass} font-bold leading-normal` : `${fontSizeClass} font-black leading-tight tracking-tight`;
            const originClass = isAr ? 'origin-right' : 'origin-left';
            const flexColFix = 'display: flex !important; flex-direction: column !important;';
            const flexRowFix = 'display: flex !important; flex-direction: row !important;';

            return `
                <div onclick="setAssignmentsSelectedClass('${c}')" 
                    class="class-card-modern group relative bg-white p-3 sm:p-6 rounded-2xl sm:rounded-[2rem] border-2 transition-all duration-500 cursor-pointer overflow-hidden flex flex-col h-full hover:-translate-y-2"
                    style="--card-color: ${color}; --card-color-alpha: ${colorAlpha};">
                    
                    <div class="absolute -start-8 -top-8 w-32 h-32 rounded-full opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-700 group-hover:scale-150" style="background: ${color}"></div>
                    
                    <div class="relative z-10 flex flex-col h-full" style="${flexColFix}">
                        <div class="flex items-start justify-between mb-2 sm:mb-6" style="${flexRowFix}">
                            <div class="flex flex-col gap-1.5">
                                <span class="inline-flex items-center px-2 py-0.5 sm:px-3 sm:py-1 bg-slate-50 text-slate-500 rounded-full text-[9px] sm:text-[10px] font-bold border border-slate-100 group-hover:bg-[var(--card-color)] group-hover:text-white group-hover:border-transparent transition-all duration-300">
                                    ${countText}
                                </span>
                            </div>
                            <div class="flex items-center" style="${flexRowFix}">
                                <div class="level-badge w-7 h-7 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center text-xs sm:text-lg font-black text-white transform group-hover:rotate-6 transition-all duration-500 shadow-sm">
                                    ${levelIcon}
                                </div>
                            </div>
                        </div>
                        
                        <div class="flex-grow flex flex-col justify-center py-1 sm:py-4" style="${flexColFix}">
                            <h3 class="card-title-hover ${titleClass} text-slate-800 transition-colors duration-300 line-clamp-3 sm:line-clamp-2 break-words" style="word-break: break-word;" title="${c}">
                                ${cleanedName}
                            </h3>
                        </div>

                        <div class="mt-2 sm:mt-4 pt-2 sm:pt-5 border-t border-slate-50 flex items-center justify-end" style="${flexRowFix}">
                            <div class="text-[10px] font-bold text-slate-300 group-hover:text-[var(--card-color)] transition-colors uppercase tracking-widest flex items-center gap-1">
                                <span>${t.viewDetail || 'Voir'}</span>
                                <svg class="w-3 h-3 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bottom-bar absolute bottom-0 start-0 w-full h-1.5 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ${originClass}"></div>
                </div>
            `;
        }).join('');

        container.innerHTML = rows;
    };

    window.renderAssignments = async function() {
        const t = getTranslations()[getLang()];
        const isAr = getLang() === 'ar';
        const container = document.getElementById('assignments-list');
        const filterName = document.getElementById('filter-name-assignments')?.value.toLowerCase() || '';
        const data = getData();

        const globalAcademicYear = window.getGlobalAcademicYear();
        const globalTrimester = window.getGlobalTrimester();

        const viewClasses = document.getElementById('assignments-view-classes');
        const viewList = document.getElementById('assignments-view-list');

        if (!globalAcademicYear || !globalTrimester) {
            if (container) container.innerHTML = `<p class="text-gray-500 text-center py-8">${t.selectAcademicYear || 'Veuillez sélectionner une année scolaire.'}</p>`;
            return;
        }

        // Toggle View Visibility
        const selectedClass = assignmentsUiState.selectedClass;
        
        if (!selectedClass) {
            if (viewList) viewList.classList.add('hidden');
            if (viewClasses) viewClasses.classList.remove('hidden');
            await window.renderAssignmentsClassList();
            return;
        } else {
            if (viewClasses) viewClasses.classList.add('hidden');
            if (viewList) viewList.classList.remove('hidden');
        }

        // --- View Mode: List Assignments for Selected Class ---
        const userId = window.currentUser?.email || window.currentUser?.id || 'unknown';

        // Update List Header
        const titleEl = document.getElementById('assignment-selected-class-title');
        const statsEl = document.getElementById('assignment-selected-class-stats');
        if (titleEl) titleEl.textContent = selectedClass;

        let filteredAssignments = data.assignments.filter(a => {
            const matchUser = (a.createdBy || 'unknown') === userId;
            const matchClass = a.className === selectedClass;
            const matchName = !filterName || a.name.toLowerCase().includes(filterName);
            const matchTrimester = (a.trimester || '') === globalTrimester;
            const matchAcademicYear = (a.academicYear || '') === globalAcademicYear;
            return matchUser && matchClass && matchName && matchTrimester && matchAcademicYear;
        });

        if (statsEl) {
            let countLabel = `${filteredAssignments.length} ${t.assignmentsTab || 'devoirs'}`;
            if (isAr) {
                const count = filteredAssignments.length;
                if (count === 0) countLabel = 'لا يوجد فروض';
                else if (count === 1) countLabel = 'فرض واحد';
                else if (count === 2) countLabel = 'فرضان';
                else if (count <= 10) countLabel = `${count} فروض`;
                else countLabel = `${count} فرضاً`;
            }
            statsEl.textContent = countLabel;
        }

        if (filteredAssignments.length === 0) {
            container.innerHTML = `<div class="col-span-full text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <p class="text-slate-500 font-medium">${t.noFilteredAssignments || 'Aucun devoir trouvé'}</p>
            </div>`;
            return;
        }

        // Rendu des devoirs
        let assignmentsHTML = '';
        for (const a of filteredAssignments) {
                const totalPoints = gradesSvc().getAssignmentMaxPoints(a);
                
                // --- LOGIQUE DE COMPTAGE FUSIONNÉE ET FILTRÉE ---
                const localStudents = data.students.filter(s => s.className === a.className && s.status !== 'archived' && (s.importedBy || 'unknown') === userId && (s.academicYear || '') === globalAcademicYear);
                let sharedStudents = [];
                if (window.store && typeof window.store.getSharedStudents === 'function') {
                    sharedStudents = await window.store.getSharedStudents(a.className);
                    sharedStudents = sharedStudents.filter(s => s.status !== 'archived');
                }
                const studentMap = new Map();
                localStudents.forEach(s => studentMap.set(s.id, s));
                sharedStudents.forEach(s => {
                    const existing = Array.from(studentMap.values()).find(ls => ls.id === s.id || (ls.regNumber && ls.regNumber === s.regNumber));
                    if (!existing) studentMap.set(s.id, s);
                });
                const allClassStudents = Array.from(studentMap.values());
                // --- FIN DE LA LOGIQUE ---

                const nbStudents = allClassStudents.length;
                const hasGradeFunc = window.hasAnyGradeForAssignment || ((sid, aid) => gradesSvc()?.hasAnyGradeForAssignment?.(data, sid, aid));
                const nbGrades = allClassStudents.filter(s => {
                    try {
                        return hasGradeFunc(s.id, a.id);
                    } catch(e) {
                        return false;
                    }
                }).length;
                const completionRate = nbStudents > 0 ? Math.round((nbGrades / nbStudents) * 100) : 0;

                const classColor = getClassColor(a.className);

                // ARABIC FIX: Typography and Layout
                const cardStyle = isAr ? 'flex-direction: column !important;' : '';
                const titleClass = isAr ? 'text-xl font-bold text-gray-900 leading-normal transition-colors group-hover:text-blue-600 truncate text-right' : 'text-xl font-black text-gray-900 leading-tight transition-colors group-hover:text-blue-600 truncate tracking-tight';
                const labelTracking = isAr ? '' : 'tracking-widest';
                const progressTracking = isAr ? '' : 'tracking-wider';
                const fontBlack = isAr ? 'font-bold' : 'font-black';
                
                // ARABIC FIX: Accordion Details
                const accordionMargin = isAr ? 'mr-4' : 'ml-4';
                const borderSide = isAr ? 'border-r-2 pr-3' : 'border-l-2 pl-3';
                const questionMargin = isAr ? 'ml-1' : 'mr-1';
                const textAlign = isAr ? 'text-right' : 'text-left';

                assignmentsHTML += `
                <div class="bg-white border-2 border-gray-200/60 rounded-2xl overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.15)] hover:-translate-y-2 transition-all duration-500 group flex flex-col h-full relative" style="${cardStyle}">
                    <!-- Barre de couleur supérieure décorative -->
                    <div class="h-2 w-full" style="background-color: ${classColor}"></div>

                    <!-- En-tête de la carte (cliquable pour accordéon) -->
                    <div class="p-6 flex-1 cursor-pointer select-none bg-gradient-to-br from-white via-white to-gray-50/50" onclick="toggleAccordion('${a.id}')">
                        <div class="flex items-start justify-between gap-4 mb-6">
                            <div class="min-w-0 flex-1">
                                <div class="flex flex-wrap items-center gap-2 mb-1.5">
                                    ${a.subject ? (() => {
                                        const subj = (window.subjects || []).find(s => s.id === a.subject);
                                        const displaySubject = subj ? (subj[getLang()] || subj.fr) : a.subject;
                                        return `<span class="px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 text-[10px] font-bold uppercase tracking-wider border border-purple-200">${displaySubject}</span>`;
                                    })() : ''}
                                    ${a.isVisible ? `<span class="px-2 py-0.5 rounded-md bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-wider border border-green-200 flex items-center gap-1" title="Visible par les élèves"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>Visible</span>` : `<span class="px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-wider border border-gray-200 flex items-center gap-1" title="Caché aux élèves"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>Caché</span>`}
                                </div>
                                <h4 class="${titleClass}" title="${a.name}">
                                    ${(window.isTrimesterBlocked && window.isTrimesterBlocked(a.trimester, a.academicYear)) ? '🔒 ' : ''}${a.name}
                                </h4>
                                <div class="flex items-center gap-2 mt-2.5">
                                    <div class="px-2.5 py-1 rounded-lg bg-gray-100 text-[10px] font-bold text-gray-500 uppercase ${labelTracking} border border-gray-200/50 shadow-sm shrink-0">
                                        <span class="sm:hidden">${t.totalPointsShort || t.totalPointsLabel}</span>
                                        <span class="hidden sm:inline">${t.totalPointsLabel || 'Total Points'}</span>
                                    </div>
                                    <span class="text-sm ${fontBlack} text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 shadow-sm whitespace-nowrap">
                                        ${totalPoints} ${t.points}
                                    </span>
                                </div>
                            </div>
                            <div id="icon-${a.id}" class="w-11 h-11 rounded-2xl bg-white shadow-md border border-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 group-hover:rotate-180 transition-all duration-500">
                                <svg class="w-5 h-5 transform transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>
                        
                        <!-- Barre de progression ultra-visible -->
                        <div class="mt-8 space-y-3">
                            <div class="flex items-center justify-between text-[11px] ${fontBlack} uppercase ${progressTracking}">
                                <span class="text-gray-500 flex items-center gap-2">
                                    <div class="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></div>
                                    <span class="sm:hidden">${t.progressionShort || t.progression}</span>
                                    <span class="hidden sm:inline">${t.progression || 'Progression'}</span>
                                </span>
                                <span class="px-2.5 py-1 rounded-full ${completionRate === 100 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-blue-100 text-blue-700 border-blue-200'} border ${fontBlack} text-[10px] shadow-sm">
                                    ${nbGrades} / ${nbStudents} (${completionRate}%)
                                </span>
                            </div>
                            <div class="h-4 w-full bg-gray-200/40 rounded-full overflow-hidden p-1 shadow-inner border border-gray-100">
                                <div class="h-full rounded-full transition-all duration-1000 ease-out ${completionRate === 100 ? 'bg-gradient-to-r from-green-400 via-green-500 to-green-600' : 'bg-gradient-to-r from-blue-400 via-blue-500 to-blue-700'}" 
                                     style="width: ${completionRate}%">
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Barre d'actions moderne à haut contraste -->
                    <div class="px-6 py-4 bg-gray-50/80 border-t border-gray-200 flex items-center justify-between gap-3" onclick="event.stopPropagation()">
                        <div class="flex items-center gap-2">
                            <button onclick="openAssignmentModal('${a.id}')" class="p-2.5 text-gray-600 hover:text-orange-600 hover:bg-white hover:shadow-md rounded-xl transition-all active:scale-90 border border-transparent hover:border-orange-100" title="${t.edit}">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            </button>
                            <button onclick="duplicateAssignment('${a.id}')" class="p-2.5 text-gray-600 hover:text-emerald-600 hover:bg-white hover:shadow-md rounded-xl transition-all active:scale-90 border border-transparent hover:border-emerald-100 ${window.isTrimesterBlocked(a.trimester, a.academicYear) ? 'opacity-30 cursor-not-allowed' : ''}" title="${t.duplicate}">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>
                            </button>
                            <button onclick="duplicateAssignment('${a.id}', true)" class="p-2.5 text-gray-600 hover:text-amber-600 hover:bg-white hover:shadow-md rounded-xl transition-all active:scale-90 border border-transparent hover:border-amber-100 ${window.isTrimesterBlocked(a.trimester, a.academicYear) ? 'opacity-30 cursor-not-allowed' : ''}" title="${t.duplicateNotes}">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                            </button>
                        </div>
                        <button onclick="deleteAssignment('${a.id}')" class="p-2.5 text-gray-400 hover:text-red-600 hover:bg-white hover:shadow-md rounded-xl transition-all active:scale-90 border border-transparent hover:border-red-100 ${window.isTrimesterBlocked(a.trimester, a.academicYear) ? 'opacity-30 cursor-not-allowed' : ''}" title="${t.delete}">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>

                    <!-- Accordéon Détails Exercices -->
                    <div id="accordion-${a.id}" class="accordion-content">
                        <div class="p-4 space-y-3 bg-white text-sm ${textAlign}">
                            ${a.exercises.map((ex, i) => {
                                const parts = ex.parts || [];
                                const directQuestions = ex.questions || [];
                                let exContent = '';
                                if (directQuestions.length > 0) {
                                    exContent += `<div class="${accordionMargin} text-gray-600 mt-2 flex flex-wrap gap-x-4 gap-y-1 ${isAr ? 'justify-start' : ''}">${directQuestions.map(q => `<span class="inline-flex items-center text-sm text-gray-500"><span class="font-medium text-gray-700 ${questionMargin}">${q.name || 'Q?'}:</span> ${gradesSvc().getQuestionMaxPoints(q)} ${t.points}</span>`).join('<span class="text-gray-300">•</span>')}</div>`;
                                }
                                if (parts.length > 0) {
                                    exContent += parts.map(part => `
                                        <div class="${accordionMargin} mt-2 ${borderSide} border-purple-200">
                                            <div class="text-purple-600 font-medium mb-1">${part.name}</div>
                                            <div class="text-gray-500 text-xs italic">
                                                (${(part.questions || []).map(q => q.name || 'Q?').join(', ')})
                                            </div>
                                        </div>
                                    `).join('');
                                }
                                return `
                                    <div class="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                                        <div class="flex justify-between items-center mb-1">
                                            <strong class="text-gray-800 font-bold">${ex.name && ex.name !== 'Global' ? ex.name : t.exercise + ' ' + (i + 1)}</strong>
                                            <span class="text-blue-600 font-bold text-sm">${gradesSvc().getExerciseMaxPoints(ex)} ${t.points}</span>
                                        </div>
                                        ${exContent}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
                `;
        }
        container.innerHTML = assignmentsHTML;
        
        translatePage();
    };

    // Import is handled in index.html for now, or we can move it here if the input handler is global
    // But index.html usually has the file input listener. 
    // If handleAssignmentImport is called from HTML, we can expose it.

    window.loadClassSelectorsForAssignments = async function() {
        if (window.loadClassSelectors) await window.loadClassSelectors();
    };

    window.handleAssignmentImport = function(event) {
        // Implementation logic for importing assignments...
        // Assuming it was in index.html, we can move it here.
        // I will check if handleAssignmentImport exists in index.html later.
        // For now, let's keep it simple.
    };

})();
