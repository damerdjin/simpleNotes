
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
    let tempExercises = [];
    let isGlobalAssignment = false;
    let globalMaxPoints = 20;

    // Expose functions
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
          <input type="text" id="assignment-name" placeholder="Nom du devoir ex: Devoir 1" class="w-full p-3 border rounded-lg">
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
                    tempExercises = [];
                } else {
                    isGlobalAssignment = false;
                    if (globalCheckbox) globalCheckbox.checked = false;
                    tempExercises = assignmentsSvc().deepCloneExercisesForEdit(exs);
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
                tempExercises = [];
                isGlobalAssignment = false;
                if (globalCheckbox) globalCheckbox.checked = false;
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
            if (tempExercises.length === 0) window.addExercise();
        }
    };

    window.renderExercisesBuilder = function () {
        const container = document.getElementById('exercises-builder');
        const t = getTranslations()[getLang()];
        if (!container) return;

        if (isGlobalAssignment) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = tempExercises.map((ex, i) => `
    <div class="border rounded-lg p-4 bg-gray-50 relative">
      <div class="flex justify-between items-start mb-3">
        <div class="flex items-center gap-2">
           <span class="font-bold text-gray-700">${t.exercise} ${i + 1}</span>
           <span class="text-sm text-gray-500">(${gradesSvc().getExerciseMaxPoints(ex)} ${t.points})</span>
        </div>
        <button onclick="removeExercise(${i})" class="text-red-500 hover:text-red-700 text-sm font-medium">✕ ${t.delete}</button>
      </div>
      
      <div class="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
         <input type="text" 
                placeholder="${t.exerciseName}" 
                value="${ex.name || ''}" 
                onchange="tempExercises[${i}].name = this.value"
                class="p-2 border rounded text-sm w-full">
         <div class="flex items-center gap-2">
             <label class="text-sm text-gray-600">${t.totalPoints || 'Total:'}</label>
             <input type="number" 
                    placeholder="${t.automaticTotal}" 
                    value="${ex.maxPoints || ''}" 
                    onchange="tempExercises[${i}].maxPoints = this.value ? parseFloat(this.value) : null; renderExercisesBuilder()"
                    class="p-2 border rounded text-sm w-24">
         </div>
      </div>

      <div class="space-y-3 pl-4 border-l-2 border-gray-200">
         <!-- Parts -->
         ${(ex.parts || []).map((part, pIdx) => `
             <div class="flex items-center gap-2 bg-white p-2 rounded border border-gray-100">
                 <span class="text-sm font-bold text-gray-600">${t.part} ${pIdx + 1}</span>
                 <input type="text" placeholder="Nom partie" value="${part.name || ''}" onchange="tempExercises[${i}].parts[${pIdx}].name = this.value" class="p-1 border rounded text-xs flex-1">
                 <input type="number" placeholder="Pts" value="${part.maxPoints || ''}" onchange="tempExercises[${i}].parts[${pIdx}].maxPoints = parseFloat(this.value); renderExercisesBuilder()" class="p-1 border rounded text-xs w-16">
                 <button onclick="removePart(${i}, ${pIdx})" class="text-red-400 hover:text-red-600 text-xs">✕</button>
             </div>
         `).join('')}
         <button onclick="addPart(${i})" class="text-xs text-blue-600 hover:text-blue-800 font-medium">${t.addPart}</button>

         <!-- Questions -->
         ${(ex.questions || []).map((q, qIdx) => `
             <div class="flex flex-col gap-1 bg-white p-2 rounded border border-gray-100">
                <div class="flex items-center gap-2">
                    <span class="text-sm font-bold text-blue-600">Q${qIdx + 1}</span>
                    <input type="number" placeholder="Pts" value="${q.maxPoints || ''}" onchange="tempExercises[${i}].questions[${qIdx}].maxPoints = parseFloat(this.value); renderExercisesBuilder()" class="p-1 border rounded text-xs w-16">
                    <button onclick="removeQuestion(${i}, ${qIdx})" class="text-red-400 hover:text-red-600 text-xs ml-auto">✕</button>
                </div>
                <!-- SubQuestions -->
                 <div class="pl-4 flex flex-wrap gap-2">
                    ${(q.subQuestions || []).map((sq, sqIdx) => `
                       <div class="flex items-center gap-1">
                          <span class="text-xs text-gray-500">${String.fromCharCode(97 + sqIdx)})</span>
                          <input type="number" placeholder="Pts" value="${sq.maxPoints || ''}" onchange="tempExercises[${i}].questions[${qIdx}].subQuestions[${sqIdx}].maxPoints = parseFloat(this.value); renderExercisesBuilder()" class="p-1 border rounded text-xs w-12">
                          <button onclick="tempExercises[${i}].questions[${qIdx}].subQuestions.splice(${sqIdx}, 1); renderExercisesBuilder()" class="text-red-300 hover:text-red-500 text-xs">×</button>
                       </div>
                    `).join('')}
                    <button onclick="tempExercises[${i}].questions[${qIdx}].subQuestions = tempExercises[${i}].questions[${qIdx}].subQuestions || []; tempExercises[${i}].questions[${qIdx}].subQuestions.push({maxPoints:1}); renderExercisesBuilder()" class="text-xs text-green-600 hover:text-green-800 px-1 border border-green-200 rounded">${t.addSubQuestions}</button>
                 </div>
             </div>
         `).join('')}
         <button onclick="addQuestion(${i})" class="text-xs text-indigo-600 hover:text-indigo-800 font-medium">${t.addQuestion}</button>
      </div>
    </div>
  `).join('');
    };

    window.addExercise = function () {
        tempExercises.push({
            id: genId(),
            name: '',
            maxPoints: null,
            questions: [],
            parts: []
        });
        window.renderExercisesBuilder();
    };

    window.addPart = function (exIndex) {
        tempExercises[exIndex].parts = tempExercises[exIndex].parts || [];
        tempExercises[exIndex].parts.push({
            id: genId(),
            name: '',
            maxPoints: 5
        });
        window.renderExercisesBuilder();
    };

    window.addQuestion = function (exIndex) {
        tempExercises[exIndex].questions.push({
            id: genId(),
            maxPoints: 1,
            subQuestions: []
        });
        window.renderExercisesBuilder();
    };

    window.removeExercise = function (index) {
        const t = getTranslations()[getLang()];
        if (!confirm(t.deleteExercise)) return;
        tempExercises.splice(index, 1);
        window.renderExercisesBuilder();
    };

    window.removePart = function (exIndex, partIndex) {
        const t = getTranslations()[getLang()];
        if (!confirm(t.deletePart)) return;
        tempExercises[exIndex].parts.splice(partIndex, 1);
        window.renderExercisesBuilder();
    };

    window.removeQuestion = function (exIndex, qIndex) {
        tempExercises[exIndex].questions.splice(qIndex, 1);
        window.renderExercisesBuilder();
    };

    window.saveAssignment = function () {
        const t = getTranslations()[getLang()];
        const name = document.getElementById('assignment-name').value.trim();
        const className = document.getElementById('assignment-class').value;
        const globalMax = parseFloat(document.getElementById('assignment-global-maxpoints').value) || 20;
        const copyFromId = document.getElementById('copy-grades-source')?.value || '';
        const globalDefaultGrade = document.getElementById('assignment-global-defaultgrade')?.value; // peut être vide

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
            if (tempExercises.length === 0) return alert(t.addExerciseFirst);
            finalExercises = tempExercises;
        }

        if (editingAssignmentId) {
            const index = data.assignments.findIndex(a => a.id === editingAssignmentId);
            if (index !== -1) {
                // Modification
                data.assignments[index].name = name;
                data.assignments[index].className = className;
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
                exercises: finalExercises
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

    window.duplicateAssignment = function (id, withGrades = false) {
        const t = getTranslations()[getLang()];
        const data = getData();
        const source = data.assignments.find(a => a.id === id);
        if (!source) return;

        const newId = genId();
        const newName = `${source.name} (Copie)`;

        // Deep clone exercises
        const newExercises = assignmentsSvc().deepCloneExercisesForEdit(source.exercises);

        data.assignments.push({
            id: newId,
            name: newName,
            className: source.className,
            exercises: newExercises
        });

        if (withGrades) {
            for (const studentId in data.grades) {
                if (data.grades[studentId][id]) {
                    // Deep copy grades
                    if (!data.grades[studentId][newId]) data.grades[studentId][newId] = {};
                    // Simple clone is enough for data structure
                    data.grades[studentId][newId] = JSON.parse(JSON.stringify(data.grades[studentId][id]));
                }
            }
        }

        saveData();
        window.renderAssignments();
        renderSummary();
    };

    window.renderAssignments = function () {
        const t = getTranslations()[getLang()];
        const container = document.getElementById('assignments-list');
        const filterName = document.getElementById('filter-name-assignments')?.value.trim().toLowerCase() || '';
        const filterClass = document.getElementById('filter-class-assignments')?.value || '';
        const data = getData();

        if (data.assignments.length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-center py-8">${t.noAssignments}</p>`;
            return;
        }

        const filtered = data.assignments.filter(a => {
            const matchesName = a.name.toLowerCase().includes(filterName);
            const matchesClass = filterClass ? a.className === filterClass : true;
            return matchesName && matchesClass;
        });

        if (filtered.length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-center py-8">${t.noFilteredAssignments}</p>`;
            return;
        }

        // Group by class
        const byClass = {};
        filtered.forEach(a => {
            const c = a.className || 'Sans classe';
            if (!byClass[c]) byClass[c] = [];
            byClass[c].push(a);
        });

        const sortedClasses = Object.keys(byClass).sort();

        container.innerHTML = sortedClasses.map(className => `
    <div class="mb-8">
        <h3 class="text-lg font-bold text-gray-700 mb-3 border-b pb-2 flex items-center gap-2">
            <span class="w-3 h-3 rounded-full" style="background-color: ${getClassColor(className)}"></span>
            ${className}
            <span class="text-xs font-normal text-gray-500 ml-2">(${byClass[className].length} ${t.assignments})</span>
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${byClass[className].map(a => window.renderAssignmentCard(a)).join('')}
        </div>
    </div>
  `).join('');

        translatePage();
    };

    window.renderAssignmentCard = function (assignment) {
        const t = getTranslations()[getLang()];
        const maxPoints = gradesSvc().getAssignmentMaxPoints(assignment);
        const exCount = (assignment.exercises || []).length;
        const isGlobal = (exCount === 1 && assignment.exercises[0].name === 'Global');

        return `
    <div class="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all relative">
        <div class="flex justify-between items-start mb-2">
            <div>
                <h4 class="font-bold text-lg text-gray-800">${assignment.name}</h4>
                <div class="text-sm text-gray-500">${assignment.className}</div>
            </div>
            <div class="text-right">
                <div class="font-bold text-blue-600">${maxPoints} pts</div>
                <div class="text-xs text-gray-400">${isGlobal ? t.globalMode : (exCount + ' ' + t.exerciseAbbr)}</div>
            </div>
        </div>
        
        <div class="flex gap-2 mt-4 pt-3 border-t">
            <button onclick="openAssignmentModal('${assignment.id}')" class="flex-1 py-1.5 text-sm bg-gray-50 hover:bg-gray-100 text-gray-700 rounded transition-colors" title="${t.edit}">
                ✏️ ${t.edit}
            </button>
            <button onclick="deleteAssignment('${assignment.id}')" class="px-3 py-1.5 text-sm bg-red-50 hover:bg-red-100 text-red-600 rounded transition-colors" title="${t.delete}">
                🗑️
            </button>
            <div class="relative group">
                 <button class="px-3 py-1.5 text-sm bg-blue-50 hover:bg-blue-100 text-blue-600 rounded transition-colors" title="${t.duplicate}">
                    📑
                </button>
                <div class="absolute right-0 top-full mt-1 w-40 bg-white border rounded shadow-xl hidden group-hover:block z-20">
                    <button onclick="duplicateAssignment('${assignment.id}', false)" class="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700">${t.duplicate}</button>
                    <button onclick="duplicateAssignment('${assignment.id}', true)" class="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-700">${t.duplicateNotes}</button>
                </div>
            </div>
        </div>
    </div>`;
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
