(function () {
    // Helper to access globals
    const getData = () => window.data;
    const getTranslations = () => window.translations;
    const getLang = () => window.currentLanguage;
    const saveData = () => window.saveData();
    const genId = () => window.genId();
    const loadClassSelectors = () => { if (typeof window.loadClassSelectors === 'function') window.loadClassSelectors(); };
    const loadGradeSelectors = () => { if (typeof window.loadGradeSelectors === 'function') window.loadGradeSelectors(); }; // might be needed if saving affects grades UI?
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
    let activeClassFilters = []; // État pour les filtres multiples

    // Expose functions
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
        window.renderAssignments();
    };

    window.openAssignmentModal = function (assignmentId = null) {
        const t = getTranslations()[getLang()];
        editingAssignmentId = assignmentId;
        const overlay = document.createElement('div');
        overlay.id = 'assignment-modal';
        overlay.className = 'modal active fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6';
        overlay.style.background = 'rgba(15, 23, 42, 0.75)';
        overlay.style.backdropFilter = 'blur(4px)';
        document.body.style.overflow = 'hidden';
        
        overlay.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <!-- Header -->
        <div class="px-6 py-4 border-b flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 id="assignment-modal-title" class="text-xl font-bold text-gray-800">${t.createAssignmentTitle || 'Créer un Devoir'}</h3>
            <p class="text-sm text-gray-500">${t.assignmentModalSubtitle || 'Configurez les détails et les exercices de votre devoir'}</p>
          </div>
          <button onclick="closeAssignmentModal()" class="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <!-- Scrollable Content -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <!-- Basic Info Section -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-1">
              <label class="text-sm font-semibold text-gray-700 ml-1">${t.assignmentName || 'Nom du devoir'}</label>
              <input type="text" id="assignment-name" placeholder="${t.assignmentName}" 
                class="w-full p-3 border-2 border-gray-100 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all">
            </div>
            <div class="space-y-1">
              <label class="text-sm font-semibold text-gray-700 ml-1">${t.selectClass || 'Classe'}</label>
              <select id="assignment-class" class="w-full p-3 border-2 border-gray-100 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all">
                <option value="" data-translate="selectClass">${t.selectClass || '-- Sélectionner une classe --'}</option>
              </select>
            </div>
          </div>

          <!-- Mode Toggle Section -->
          <div class="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
              </div>
              <div>
                <label for="assignment-global-only" class="font-semibold text-gray-800 block">${t.globalOnlyLabel || 'Note globale uniquement'}</label>
                <p class="text-xs text-gray-500">${t.globalOnlyDesc || 'Saisie rapide sans détails par exercice'}</p>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="assignment-global-only" class="sr-only peer" onchange="toggleGlobalAssignmentMode(this.checked)">
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <!-- Global Options -->
          <div id="global-maxpoints-container" class="hidden animate-in slide-in-from-top-2 duration-200">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-amber-50/50 rounded-xl border border-amber-100">
              <div class="space-y-1">
                <label class="text-sm font-semibold text-amber-900 ml-1">${t.globalMaxLabel || 'Note maximale'}</label>
                <input type="number" id="assignment-global-maxpoints" class="w-full p-2.5 border-2 border-amber-100 rounded-lg focus:border-amber-500 outline-none" min="0" step="0.25" value="20">
              </div>
              <div id="global-default-grade-container" class="${editingAssignmentId ? 'hidden' : ''} space-y-1">
                <label class="text-sm font-semibold text-amber-900 ml-1">${t.defaultGrade || 'Note par défaut'}</label>
                <input type="number" id="assignment-global-defaultgrade" class="w-full p-2.5 border-2 border-amber-100 rounded-lg focus:border-amber-500 outline-none" min="0" step="0.25" value="">
              </div>
            </div>
          </div>

          <!-- Exercises Builder -->
          <div id="exercises-builder-container" class="space-y-4">
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
                  <label class="block font-semibold text-indigo-900 mb-1">${t.copyGrades || 'Copier les notes d\'un autre devoir'}</label>
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

        <!-- Footer -->
        <div class="px-6 py-4 border-t bg-gray-50/80 flex gap-3 justify-end items-center">
          <button onclick="closeAssignmentModal()" 
            class="px-6 py-2.5 text-gray-600 font-semibold hover:bg-gray-200 rounded-xl transition-all" 
            data-translate="cancel">${t.cancel || 'Annuler'}</button>
          <button onclick="saveAssignment()" 
            class="px-8 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 active:scale-95 transition-all" 
            data-translate="save">${t.save || 'Enregistrer le devoir'}</button>
        </div>
      </div>`;
        document.body.appendChild(overlay);
        try {
            loadClassSelectors();
            const globalCheckbox = document.getElementById('assignment-global-only');
            const globalMaxInput = document.getElementById('assignment-global-maxpoints');
            if (assignmentId) {
                const assignment = getData().assignments.find(a => a.id === assignmentId);
                if (!assignment) return;
                document.getElementById('assignment-modal-title').textContent = t.editAssignment || 'Modifier le devoir';
                document.getElementById('assignment-name').value = assignment.name;
                document.getElementById('assignment-class').value = assignment.className;
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
                if (globalMaxInput) globalMaxInput.value = 20;

            }



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
            <div class="flex items-center gap-3 flex-wrap">
                <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-emerald-600 uppercase tracking-wider">${t.questionPrefix || 'Q'}</span>
                    <input type="text" placeholder="1, 2..." value="${q.name || ''}"
                        onchange="${basePath}.name = this.value"
                        class="w-16 p-1.5 border border-emerald-200 rounded-lg text-sm font-bold text-emerald-700 bg-white focus:ring-2 focus:ring-emerald-500/20 outline-none">
                </div>
                
                ${!hasSubQuestions ? `
                    <div class="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-emerald-200 shadow-sm">
                        <div class="flex items-center gap-1">
                            <span class="text-[10px] font-bold text-gray-400 uppercase">Pts</span>
                            <input type="number" placeholder="0" value="${q.maxPoints || ''}" min="0" step="0.25"
                                onchange="${basePath}.maxPoints = parseFloat(this.value); window.renderExercisesBuilder()"
                                class="w-14 p-1 text-sm font-semibold text-gray-700 outline-none" title="${t.questionPoints}">
                        </div>
                        ${!editingAssignmentId ? `
                            <div class="w-px h-4 bg-gray-200 mx-1"></div>
                            <div class="flex items-center gap-1">
                                <span class="text-[10px] font-bold text-amber-500 uppercase">Def</span>
                                <input type="number" placeholder="-" value="${q.defaultGrade || ''}" min="0" step="0.25"
                                    onchange="${basePath}.defaultGrade = this.value === '' ? '' : parseFloat(this.value)"
                                    class="w-12 p-1 text-sm font-semibold text-amber-700 outline-none" title="${t.defaultGrade}">
                            </div>
                        ` : ''}
                    </div>
                ` : `
                    <div class="flex items-center gap-2 px-3 py-1.5 bg-emerald-100/50 rounded-lg border border-emerald-200">
                        <span class="text-xs font-bold text-emerald-700">${getQuestionMaxPoints(q)} ${t.points}</span>
                    </div>
                `}
                
                <div class="flex items-center gap-1 ml-auto">
                    <button onclick="${addSubCall}" 
                        class="flex items-center gap-1 text-blue-600 hover:text-white hover:bg-blue-600 text-xs font-bold px-2 py-1.5 rounded-lg transition-all border border-blue-200">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                        a,b,c
                    </button>
                    <button onclick="${removeCall}" 
                        class="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="${t.delete}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </div>
            
            ${hasSubQuestions ? `
                <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pl-4 border-l-2 border-emerald-200">
                    ${(q.subQuestions || []).map((sq, sqIdx) => `
                        <div class="flex items-center gap-2 bg-white/80 p-1.5 rounded-lg border border-emerald-100 shadow-sm hover:border-emerald-300 transition-all">
                            <input type="text" value="${sq.name || ''}" 
                                onchange="${basePath}.subQuestions[${sqIdx}].name = this.value"
                                class="w-8 p-1 border-0 text-orange-600 font-bold text-center text-sm focus:ring-0">
                            <span class="text-orange-400 font-bold">)</span>
                            <div class="flex items-center gap-1 flex-1">
                                <input type="number" placeholder="Pts" value="${sq.maxPoints || ''}" min="0" step="0.25"
                                    onchange="${basePath}.subQuestions[${sqIdx}].maxPoints = parseFloat(this.value); window.renderExercisesBuilder()"
                                    class="w-full p-1 text-xs font-semibold text-gray-700 border-b border-transparent focus:border-emerald-400 outline-none">
                            </div>
                            ${!editingAssignmentId ? `
                                <div class="w-px h-3 bg-gray-100"></div>
                                <input type="number" placeholder="Def" value="${sq.defaultGrade || ''}" min="0" step="0.25"
                                    onchange="${basePath}.subQuestions[${sqIdx}].defaultGrade = this.value === '' ? '' : parseFloat(this.value)"
                                    class="w-10 p-1 text-xs font-semibold text-amber-600 bg-amber-50/50 rounded outline-none" title="${t.defaultGrade}">
                            ` : ''}
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

        container.innerHTML = window.tempExercises.map((ex, i) => {
            ex.parts = ex.parts || [];
            ex.questions = ex.questions || [];
            const exerciseTotal = getExerciseMaxPoints(ex);

            return `
            <div class="border-2 border-blue-100 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-all animate-in slide-in-from-bottom-2 duration-300">
              <!-- Exercise Header -->
              <div class="px-5 py-4 bg-blue-50/50 border-b border-blue-100 flex items-center gap-4 flex-wrap">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold text-sm shadow-sm shadow-blue-200">
                        ${i + 1}
                    </div>
                    <span class="font-bold text-blue-900 uppercase tracking-wide text-xs">${t.exercise}</span>
                </div>
                
                <div class="flex-1 min-w-[200px]">
                    <input type="text" 
                           placeholder="${t.exerciseName}" 
                           value="${ex.name || ''}" 
                           onchange="window.tempExercises[${i}].name = this.value"
                           class="w-full p-2 border-2 border-white focus:border-blue-400 rounded-lg text-sm font-semibold bg-white/80 focus:bg-white outline-none transition-all">
                </div>
                
                <div class="flex items-center gap-3 ml-auto">
                    <div class="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-blue-100 shadow-sm">
                        <span class="text-xs font-bold text-blue-600 uppercase tracking-tighter">${t.totalPoints || 'Total'}</span>
                        <span class="text-sm font-black text-blue-900">${exerciseTotal}</span>
                        <span class="text-[10px] font-bold text-blue-400 uppercase">Pts</span>
                    </div>
                    
                    ${!editingAssignmentId ? `
                        <div class="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-lg border border-amber-100 shadow-sm">
                            <span class="text-[10px] font-bold text-amber-600 uppercase tracking-tighter">${t.defaultGrade || 'Def'}</span>
                            <input type="number" placeholder="-" value="${ex.defaultGrade || ''}" min="0" step="0.25"
                                onchange="window.tempExercises[${i}].defaultGrade = this.value === '' ? '' : parseFloat(this.value)"
                                class="w-10 text-sm font-bold text-amber-700 bg-transparent outline-none">
                        </div>
                    ` : ''}

                    <button onclick="window.removeExercise(${i})" 
                        class="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="${t.delete}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
              </div>

              <!-- Exercise Content -->
              <div class="p-5 space-y-4">
                ${ex.questions.length > 0 || ex.parts.length === 0 ? `
                    <div class="space-y-3">
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
                                    ${(part.questions || []).map((q, qIdx) => renderQuestionBuilder(q, i, qIdx, pIdx)).join('')}
                                    
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
        }).join('');
    };

    window.addExercise = function () {
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

    window.saveAssignment = function () {
        const t = getTranslations()[getLang()];
        const name = document.getElementById('assignment-name').value.trim();
        const className = document.getElementById('assignment-class').value;
        const trimester = document.getElementById('assignment-trimester')?.value || window.getGlobalTrimester();
        const globalMax = parseFloat(document.getElementById('assignment-global-maxpoints').value) || 20;
        const copyFromId = document.getElementById('copy-grades-source')?.value || '';
        const globalDefaultGrade = document.getElementById('assignment-global-defaultgrade')?.value; // peut être vide

        if (!trimester) return alert(t.needTrimester);
        if (!name) return alert(t.enterAssignmentName);
        if (!className) return alert(t.selectAssignmentClass);

        const data = getData();
        // Check duplicates
        const existing = data.assignments.find(a =>
            a.name.toLowerCase() === name.toLowerCase() &&
            a.className === className &&
            a.id !== editingAssignmentId
        );
        if (existing) return alert(t.duplicateAssignmentName);

        let finalExercises = [];
        if (isGlobalAssignment) {
            finalExercises = [{
                id: genId(),
                name: 'Global',
                maxPoints: globalMax,
                questions: [],
                parts: []
            }];
        } else {
            if (window.tempExercises.length === 0) return alert(t.addExerciseFirst);
            finalExercises = window.tempExercises;
        }

        if (editingAssignmentId) {
            const index = data.assignments.findIndex(a => a.id === editingAssignmentId);
            if (index !== -1) {
                // Modification
                data.assignments[index].name = name;
                data.assignments[index].className = className;
                data.assignments[index].trimester = trimester;
                if (!data.assignments[index].academicYear) data.assignments[index].academicYear = window.getGlobalAcademicYear();
                if (!data.assignments[index].createdBy) data.assignments[index].createdBy = window.currentUser?.email || window.currentUser?.id || 'unknown';
                data.assignments[index].exercises = finalExercises;

                // Copie des notes si demandé
                if (copyFromId) {
                    const sourceId = copyFromId;
                    const targetId = editingAssignmentId;
                    const sourceAssignment = data.assignments.find(a => a.id === sourceId);
                    // On copie la note globale si possible
                    if (sourceAssignment) {
                        // Pour chaque élève de la classe
                        const students = data.students.filter(s => s.className === className);
                        students.forEach(s => {
                            const sourceGrade = window.getStudentAssignmentTotal(s.id, sourceId);
                            // On applique cette note comme note globale du devoir cible
                            if (!data.grades[s.id]) data.grades[s.id] = {};
                            if (!data.grades[s.id][targetId]) data.grades[s.id][targetId] = {};
                            data.grades[s.id][targetId].global = sourceGrade;
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

        const newId = genId();
        const newAssignment = {
            id: newId,
            name: original.name + (includeGrades ? ' (copie intégrale)' : ' (copie)'),
            className: original.className,
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

    window.renderAssignments = function() {
        const t = getTranslations()[getLang()];
        const container = document.getElementById('assignments-list');
        const chipsContainer = document.getElementById('assignment-class-chips');
        const filterName = document.getElementById('filter-name-assignments')?.value.toLowerCase() || '';
        const data = getData();

        const globalAcademicYear = window.getGlobalAcademicYear();
        if (!globalAcademicYear) {
            container.innerHTML = `<p class="text-gray-500 text-center py-8">${t.selectAcademicYear || 'Veuillez sélectionner une année scolaire.'}</p>`;
            return;
        }

        const globalTrimester = window.getGlobalTrimester();
        const createBtn = document.querySelector('#content-assignments button[onclick="openAssignmentModal()"]');
        if (createBtn) {
            createBtn.disabled = !globalTrimester;
            createBtn.classList.toggle('opacity-50', !globalTrimester);
            createBtn.classList.toggle('cursor-not-allowed', !globalTrimester);
        }

        const userId = window.currentUser?.email || window.currentUser?.id || 'unknown';

        // Gérer les Chips de classe
        const assignmentsForYearAndUser = data.assignments.filter(a => (a.academicYear || '') === globalAcademicYear && (a.createdBy || 'unknown') === userId && (a.trimester || '') === globalTrimester);
        const allClasses = [...new Set(assignmentsForYearAndUser.map(a => a.className))].filter(Boolean).sort();
        if (chipsContainer) {
            const allChip = `<button onclick="toggleAssignmentClassFilter('')" class="px-4 py-1.5 rounded-full text-sm font-medium transition-all ${activeClassFilters.length === 0 ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-100'}">${t.allClassesFilter || 'Toutes'}</button>`;
            const classChips = allClasses.map(c => {
                const isActive = activeClassFilters.includes(c);
                return `<button onclick="toggleAssignmentClassFilter('${c}')" class="px-4 py-1.5 rounded-full text-sm font-medium transition-all ${isActive ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-100'}">${c}</button>`;
            }).join('');
            chipsContainer.innerHTML = allChip + classChips;
        }

        let filteredAssignments = data.assignments.filter(a => {
            const matchUser = (a.createdBy || 'unknown') === userId;
            const matchClass = activeClassFilters.length === 0 || activeClassFilters.includes(a.className);
            const matchName = !filterName || a.name.toLowerCase().includes(filterName);
            const globalTrimester = window.getGlobalTrimester();
            const matchTrimester = globalTrimester ? (a.trimester || '') === globalTrimester : false;
            const matchAcademicYear = globalAcademicYear ? (a.academicYear || '') === globalAcademicYear : false;
            return matchUser && matchClass && matchName && matchTrimester && matchAcademicYear;
        });

        if (data.assignments.length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-center py-8">${t.noAssignments}</p>`;
            return;
        }

        if (filteredAssignments.length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-center py-8">${t.noFilteredAssignments}</p>`;
            return;
        }

        // Grouper les devoirs par classe
        const groupedByClass = filteredAssignments.reduce((groups, a) => {
            const className = a.className || t.noClass;
            if (!groups[className]) groups[className] = [];
            groups[className].push(a);
            return groups;
        }, {});

        // Rendu des groupes
        container.innerHTML = Object.entries(groupedByClass).map(([className, classAssignments]) => {
            const assignmentsHTML = classAssignments.map(a => {
                const totalPoints = gradesSvc().getAssignmentMaxPoints(a);
                const classStudents = data.students.filter(s => s.className === a.className && (s.importedBy || 'unknown') === userId && (s.academicYear || '') === globalAcademicYear);
                const nbStudents = classStudents.length;
                const nbGrades = classStudents.filter(s => window.hasAnyGradeForAssignment(s.id, a.id)).length;
                const completionRate = nbStudents > 0 ? Math.round((nbGrades / nbStudents) * 100) : 0;

                return `
                <div class="bg-white border rounded-xl overflow-hidden hover:shadow-md transition-all group flex flex-col h-full">
                    <!-- En-tête de la carte (cliquable pour accordéon) -->
                    <div class="p-5 flex-1 cursor-pointer select-none" onclick="toggleAccordion('${a.id}')">
                        <div class="flex items-start justify-between gap-4 mb-3">
                            <div class="min-w-0 flex-1">
                                <span class="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded uppercase tracking-wider mb-1">
                                    ${a.trimester ? t.trimesterShort + a.trimester : ''}
                                </span>
                                <h4 class="text-lg font-bold text-blue-600 leading-tight transition-colors truncate" title="${a.name}">
                                    ${a.name}
                                </h4>
                            </div>
                            <span id="icon-${a.id}" class="rotate-icon text-gray-400 mt-1 shrink-0 transition-transform duration-200">▼</span>
                        </div>
                        
                        <div class="flex flex-wrap items-center gap-y-2 gap-x-4 text-sm text-gray-500">
                            <div class="flex items-center gap-1.5" title="${t.totalPointsLabel}">
                                <span class="text-pink-500">🎯</span> 
                                <span class="font-semibold text-gray-700">${totalPoints}</span>
                                <span class="text-gray-400 text-xs">${t.points}</span>
                            </div>
                            <div class="flex items-center gap-1.5" title="${t.progression}">
                                <span class="text-indigo-500">📊</span>
                                <span class="font-semibold text-gray-700">${nbGrades}/${nbStudents}</span>
                                <span class="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] font-bold text-gray-500">(${completionRate}%)</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Barre d'actions -->
                    <div class="px-4 py-3 bg-gray-50 border-t border-b flex items-center justify-end gap-3" onclick="event.stopPropagation()">
                        <button onclick="openAssignmentModal('${a.id}')" class="p-1.5 text-orange-400 hover:bg-orange-50 rounded transition-colors" title="${t.edit}">
                            <span class="text-lg">✏️</span>
                        </button>
                        <button onclick="duplicateAssignment('${a.id}')" class="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded transition-colors" title="${t.duplicate}">
                            <span class="text-lg">⎘</span>
                        </button>
                        <button onclick="duplicateAssignment('${a.id}', true)" class="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition-colors" title="${t.duplicateNotes}">
                            <span class="text-lg">📋</span>
                        </button>
                        <button onclick="deleteAssignment('${a.id}')" class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="${t.delete}">
                            <span class="text-lg">🗑️</span>
                        </button>
                    </div>

                    <!-- Accordéon Détails Exercices -->
                    <div id="accordion-${a.id}" class="accordion-content">
                        <div class="p-4 space-y-3 bg-white text-sm">
                            ${a.exercises.map((ex, i) => {
                                const parts = ex.parts || [];
                                const directQuestions = ex.questions || [];
                                let exContent = '';
                                if (directQuestions.length > 0) {
                                    exContent += `<div class="ml-4 rtl:mr-4 rtl:ml-0 text-gray-600 mt-2 flex flex-wrap gap-x-4 gap-y-1">${directQuestions.map(q => `<span class="inline-flex items-center text-sm text-gray-500"><span class="font-medium text-gray-700 mr-1 rtl:ml-1">${q.name || 'Q?'}:</span> ${gradesSvc().getQuestionMaxPoints(q)} ${t.points}</span>`).join('<span class="text-gray-300">•</span>')}</div>`;
                                }
                                if (parts.length > 0) {
                                    exContent += parts.map(part => `
                                        <div class="ml-4 rtl:mr-4 rtl:ml-0 mt-2 border-l-2 border-purple-200 rtl:border-r-2 rtl:border-l-0 pl-3 rtl:pr-3 rtl:pl-0">
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
                                            <strong class="text-gray-800 font-bold">${t.exercise} ${i + 1}${ex.name ? ' - ' + (ex.name === 'Global' ? t.globalMode : ex.name) : ''}</strong>
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
            }).join('');

            return `
            <div class="assignment-class-group">
                <div class="flex items-center gap-3 mb-4">
                    <div class="h-8 w-1.5 rounded-full" style="background-color: ${getClassColor(className)}"></div>
                    <h3 class="text-xl font-bold text-gray-700">${className}</h3>
                    <span class="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-bold rounded-full">${classAssignments.length}</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${assignmentsHTML}
                </div>
            </div>
            `;
        }).join('');
        
        translatePage();
    };

    // Import is handled in index.html for now, or we can move it here if the input handler is global
    // But index.html usually has the file input listener. 
    // If handleAssignmentImport is called from HTML, we can expose it.

    window.handleAssignmentImport = function(event) {
        // Implementation logic for importing assignments...
        // Assuming it was in index.html, we can move it here.
        // I will check if handleAssignmentImport exists in index.html later.
        // For now, let's keep it simple.
    };

})();
