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
        overlay.className = 'modal fixed inset-0 items-center justify-center z-50 overflow-y-auto py-8';
        overlay.style.display = 'flex';
        overlay.style.background = 'rgba(0,0,0,.5)';
        overlay.innerHTML = `
      <div class="bg-white rounded-xl p-6 w-full max-w-5xl mx-4 my-auto">
        <h3 id="assignment-modal-title" class="text-xl font-bold mb-4">${t.createAssignmentTitle || 'Créer un Devoir'}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input type="text" id="assignment-name" placeholder="${t.assignmentName}" class="w-full p-3 border rounded-lg">
          <select id="assignment-class" class="w-full p-3 border rounded-lg">
            <option value="" data-translate="selectClass">${t.selectClass || '-- Sélectionner une classe --'}</option>
          </select>
        </div>
        <div class="mb-4 flex items-center gap-2">
          <input type="checkbox" id="assignment-global-only" class="w-4 h-4" onchange="toggleGlobalAssignmentMode(this.checked)">
          <label for="assignment-global-only" class="text-sm text-gray-700">${t.globalOnlyLabel || 'Note globale uniquement (sans exercices détaillés)'}</label>
        </div>
        <div id="global-maxpoints-container" class="mb-4 hidden">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">${t.globalMaxLabel || 'Note maximale du devoir'}</label>
              <input type="number" id="assignment-global-maxpoints" class="w-full p-2 border rounded" min="0" step="0.25" value="20">
            </div>
            <div id="global-default-grade-container" class="${editingAssignmentId ? 'hidden' : ''}">
              <label class="block text-sm font-medium text-gray-700 mb-1">${t.defaultGrade}</label>
              <input type="number" id="assignment-global-defaultgrade" class="w-full p-2 border rounded bg-amber-50" min="0" step="0.25" value="">
            </div>
          </div>
        </div>
        <div id="exercises-builder" class="space-y-4 mb-4 max-h-[60vh] overflow-y-auto pr-2"></div>
        
        <div id="copy-grades-container" class="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg hidden">
            <label class="block text-sm font-medium text-amber-800 mb-2">${t.copyGrades}</label>
            <select id="copy-grades-source" class="w-full p-2 border border-amber-300 rounded bg-white text-sm">
                <option value="">${t.noCopyGrades}</option>
            </select>
            <p class="text-xs text-amber-600 mt-1 italic">${t.copyGradesWarning}</p>
        </div>

        <button id="add-exercise-btn" onclick="addExercise()" class="w-full p-3 border-2 border-dashed border-blue-400 text-blue-600 rounded-lg hover:bg-blue-50 mb-4" data-translate="addExercise">${t.addExercise || 'Ajouter un exercice'}</button>
        <div class="flex gap-3 justify-end">
          <button onclick="closeAssignmentModal()" class="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400" data-translate="cancel">${t.cancel || 'Annuler'}</button>
          <button onclick="saveAssignment()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700" data-translate="save">${t.save || 'Enregistrer'}</button>
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
    };

    window.toggleGlobalAssignmentMode = function (checked) {
        isGlobalAssignment = checked;
        const builder = document.getElementById('exercises-builder');
        const btn = document.getElementById('add-exercise-btn');
        const globalContainer = document.getElementById('global-maxpoints-container');

        if (checked) {
            builder.classList.add('hidden');
            btn.classList.add('hidden');
            globalContainer.classList.remove('hidden');
        } else {
            builder.classList.remove('hidden');
            btn.classList.remove('hidden');
            globalContainer.classList.add('hidden');
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
        <div class="border border-green-200 rounded p-3 bg-green-50">
            <div class="flex items-center gap-2 mb-2 flex-wrap">
                <input type="text" placeholder="${t.questionPrefix || 'Q'}1, ${t.questionPrefix || 'Q'}2..." value="${q.name || ''}"
                    onchange="${basePath}.name = this.value"
                    class="w-20 p-1 border rounded text-sm font-semibold text-green-700 bg-white">
                
                ${!hasSubQuestions ? `
                    <div class="flex items-center gap-1">
                        <input type="number" placeholder="${t.points}" value="${q.maxPoints || ''}" min="0" step="0.25"
                            onchange="${basePath}.maxPoints = parseFloat(this.value); window.renderExercisesBuilder()"
                            class="w-16 p-1 border rounded text-sm" title="${t.questionPoints}">
                        ${!editingAssignmentId ? `
                            <span class="text-xs text-gray-400">/</span>
                            <input type="number" placeholder="Def" value="${q.defaultGrade || ''}" min="0" step="0.25"
                                onchange="${basePath}.defaultGrade = this.value === '' ? '' : parseFloat(this.value)"
                                class="w-14 p-1 border rounded text-sm bg-amber-50" title="${t.defaultGrade}">
                        ` : ''}
                    </div>
                ` : `
                    <span class="text-xs text-gray-500 px-2">${t.totalPoints}: ${getQuestionMaxPoints(q)} ${t.points}</span>
                `}
                
                <button onclick="${addSubCall}" class="text-blue-500 hover:text-blue-700 text-sm px-2 py-1 bg-blue-50 rounded">+a,b,c</button>
                <button onclick="${removeCall}" class="text-red-500 hover:text-red-700 ml-auto" title="${t.delete}">✕</button>
            </div>
            
            ${hasSubQuestions ? `
                <div class="flex flex-wrap gap-2 ml-4">
                    ${(q.subQuestions || []).map((sq, sqIdx) => `
                        <div class="flex items-center gap-1 bg-white px-2 py-1 rounded border">
                            <input type="text" value="${sq.name || ''}" 
                                onchange="${basePath}.subQuestions[${sqIdx}].name = this.value"
                                class="w-8 p-0 border-0 text-orange-600 font-medium text-center text-sm">
                            <span class="text-orange-400">)</span>
                            <input type="number" placeholder="Pts" value="${sq.maxPoints || ''}" min="0" step="0.25"
                                onchange="${basePath}.subQuestions[${sqIdx}].maxPoints = parseFloat(this.value); window.renderExercisesBuilder()"
                                class="w-14 p-1 border rounded text-sm">
                            ${!editingAssignmentId ? `
                                <span class="text-xs text-gray-400">/</span>
                                <input type="number" placeholder="Def" value="${sq.defaultGrade || ''}" min="0" step="0.25"
                                    onchange="${basePath}.subQuestions[${sqIdx}].defaultGrade = this.value === '' ? '' : parseFloat(this.value)"
                                    class="w-12 p-1 border rounded text-sm bg-amber-50" title="${t.defaultGrade}">
                            ` : ''}
                            <button onclick="${basePath}.subQuestions.splice(${sqIdx}, 1); window.renderExercisesBuilder()" class="text-red-400 hover:text-red-600 text-xs">✕</button>
                        </div>
                    `).join('')}
                </div>
                <div class="text-xs text-gray-500 mt-2 ml-4">
                    ${t.autoTotalPoints || 'Total auto'}: ${getQuestionMaxPoints(q)} ${t.points} (${t.sumSubQuestions || 'somme'})
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
             container.innerHTML = `<p class="text-gray-500 text-center py-4">${t.noExercises || 'Aucun exercice'}. ${t.clickAddExercise || 'Cliquez sur Ajouter'}.</p>`;
             return;
        }

        container.innerHTML = window.tempExercises.map((ex, i) => {
            ex.parts = ex.parts || [];
            ex.questions = ex.questions || [];
            const exerciseTotal = getExerciseMaxPoints(ex);

            return `
            <div class="border-2 border-blue-200 rounded-lg p-4 bg-blue-50 relative mb-4">
              <div class="flex items-center gap-2 mb-3 flex-wrap">
                <span class="font-bold text-blue-700 text-lg">${t.exercise} ${i + 1}</span>
                <input type="text" 
                       placeholder="${t.exerciseName}" 
                       value="${ex.name || ''}" 
                       onchange="window.tempExercises[${i}].name = this.value"
                       class="flex-1 min-w-32 p-2 border rounded text-sm bg-white">
                
                ${!editingAssignmentId ? `
                    <div class="flex items-center gap-1">
                        <input type="number" placeholder="Def" value="${ex.defaultGrade || ''}" min="0" step="0.25"
                            onchange="window.tempExercises[${i}].defaultGrade = this.value === '' ? '' : parseFloat(this.value)"
                            class="w-14 p-2 border rounded text-sm bg-amber-50" title="${t.defaultGrade}">
                    </div>
                ` : ''}

                <div class="flex items-center gap-2">
                    <span class="text-sm font-semibold text-blue-600 px-2">${t.totalPoints || 'Total'}: ${exerciseTotal} ${t.points}</span>
                </div>
                <button onclick="window.removeExercise(${i})" class="text-red-500 hover:text-red-700 text-lg" title="${t.delete}">✕</button>
              </div>

              <div class="text-xs text-gray-500 mb-3">
                  ${ex.questions.length === 0 && ex.parts.length === 0 ?
                      (t.noQuestions || 'Sans questions') + ' - ' + (t.directPointsOnly || 'points directs') :
                      (t.autoTotalPoints || 'Total auto') + ': ' + exerciseTotal + ' ' + t.points}
              </div>

              ${ex.questions.length > 0 || ex.parts.length === 0 ? `
                  <div class="space-y-2 ml-4 mb-3">
                      ${ex.questions.map((q, qIdx) => renderQuestionBuilder(q, i, qIdx, null)).join('')}
                  </div>
                  <button onclick="window.addQuestion(${i})" class="ml-4 text-sm text-green-600 hover:text-green-800 px-3 py-1 bg-green-100 rounded">
                       ${t.addQuestion}
                  </button>
              ` : ''}

              ${ex.parts.length > 0 ? `
                  <div class="space-y-3 mt-4">
                      ${ex.parts.map((part, pIdx) => `
                          <div class="border-2 border-purple-200 rounded-lg p-3 bg-purple-50 ml-2">
                              <div class="flex items-center gap-2 mb-2">
                                  <input type="text" value="${part.name || ''}" 
                                      onchange="window.tempExercises[${i}].parts[${pIdx}].name = this.value"
                                      class="font-semibold text-purple-700 p-1 border rounded bg-white">
                                  <button onclick="window.removePart(${i}, ${pIdx})" class="text-red-500 hover:text-red-700 ml-auto">✕</button>
                              </div>
                              
                              <div class="space-y-2 ml-4">
                                  ${(part.questions || []).map((q, qIdx) => renderQuestionBuilder(q, i, qIdx, pIdx)).join('')}
                              </div>
                              
                              <button onclick="window.addQuestion(${i}, ${pIdx})" class="mt-2 ml-4 text-sm text-green-600 hover:text-green-800 px-3 py-1 bg-green-100 rounded">
                                   ${t.addQuestion}
                              </button>
                          </div>
                      `).join('')}
                  </div>
              ` : ''}

              <button onclick="window.addPart(${i})" class="mt-3 ml-4 text-sm text-purple-600 hover:text-purple-800 px-3 py-1 bg-purple-100 rounded">
                  + ${t.addPart}
              </button>

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
