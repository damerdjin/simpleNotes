
(function () {
    // Helper to access globals
    const getData = () => window.data;
    const getTranslations = () => window.translations;
    const getLang = () => window.currentLanguage;
    const saveData = () => window.saveData();
    const gradesSvc = () => window.grades; // Service module

    // Internal helper
    function getQuestionMaxPoints(q) {
        if (q.subQuestions && q.subQuestions.length > 0) {
            return q.subQuestions.reduce((sum, sq) => sum + (sq.maxPoints || 0), 0);
        }
        return q.maxPoints || 0;
    }

    window.loadGradeSelectors = function() {
        const t = getTranslations()[getLang()];
        const assignmentSelect = document.getElementById('select-assignment');
        const studentSelect = document.getElementById('select-student');
        const classSelect = document.getElementById('select-class-grades');
        const selectedClass = classSelect ? classSelect.value : '';

        if (!assignmentSelect || !studentSelect) return;

        if (!selectedClass) {
            assignmentSelect.innerHTML = `<option value="">-- ${t.selectClassFirst} --</option>`;
            studentSelect.innerHTML = `<option value="">-- ${t.selectClassFirst} --</option>`;
            const entry = document.getElementById('grade-entry');
            if (entry) entry.innerHTML = `<p class="text-gray-500 text-center py-8">${t.selectClassToStart}</p>`;
            return;
        }

        const data = getData();
        const globalTrimester = window.getGlobalTrimester();
        const filteredAssignments = data.assignments.filter(a => {
            const matchClass = a.className === selectedClass;
            const matchTrimester = !globalTrimester || (a.trimester || '') === globalTrimester;
            return matchClass && matchTrimester;
        });
        assignmentSelect.innerHTML = `<option value="">-- ${t.selectAssignment} --</option>` +
            filteredAssignments.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

        const filteredStudents = data.students.filter(s => s.className === selectedClass);
        studentSelect.innerHTML = `<option value="">-- ${t.selectStudent} --</option>` +
            filteredStudents.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

        const entry = document.getElementById('grade-entry');
        if (entry) entry.innerHTML = `<p class="text-gray-500 text-center py-8">${t.selectAssignmentAndStudentToGrade}</p>`;
    };

    window.getQuestionDisplayName = function(assignmentId, exId, qId, partId) {
        const t = getTranslations()[getLang()];
        const assignment = getData().assignments.find(a => a.id === assignmentId);
        if (!assignment) return `${t.questionPrefix}?`;
        const ex = assignment.exercises.find(e => e.id === exId);
        if (!ex) return `${t.questionPrefix}?`;
        let list = [];
        if (partId) {
            const part = (ex.parts || []).find(p => p.id === partId);
            list = part ? (part.questions || []) : [];
        } else {
            list = ex.questions || [];
        }
        const idx = Math.max(0, list.findIndex(x => x.id === qId));
        return `${t.questionPrefix}${idx + 1}`;
    };

    window.getSubQuestionLetter = function(q, sqId) {
        const t = getTranslations()[getLang()];
        const letters = (t.subQuestionLetters || '').split('');
        const idx = Math.max(0, (q.subQuestions || []).findIndex(s => s.id === sqId));
        return letters[idx] || letters[0] || '?';
    };

    window.renderGradeQuestion = function(q, studentId, assignmentId, exId, partId = null) {
        const data = getData();
        const studentGrades = data.grades[studentId]?.[assignmentId]?.[exId] || {};
        const partKey = partId || 'direct';
        if (!studentGrades[partKey]) studentGrades[partKey] = {};
        const qGrades = studentGrades[partKey][q.id] || {};
        const mode = studentGrades.mode || ((studentGrades['final']?.['final']?.['final'] || '') !== '' ? 'global' : 'detail');
        
        let qHtml = `<div class="grade-question-card">
        <div class="question-header">
            <span class="question-title">${window.getQuestionDisplayName(assignmentId, exId, q.id, partId)}</span>
            <span class="question-score" id="q-total-${q.id}">0 / ${getQuestionMaxPoints(q)}</span>
        </div>`;
        
        if (!q.subQuestions || q.subQuestions.length === 0) {
            const val = qGrades['direct'] || '';
            qHtml += `<div class="question-direct-entry ${mode === 'global' ? 'opacity-50 pointer-events-none' : ''}">
            <input type="number" min="0" max="${q.maxPoints}" step="0.25" value="${val}"
                ${mode === 'global' ? 'disabled' : ''}
                onchange="updateGrade('${studentId}','${assignmentId}','${exId}','${partKey}','${q.id}','direct',this.value)"
                class="grade-input p-2 border rounded text-center font-semibold" title="La note globale désactive la saisie détaillée">
            <span class="question-max">/ ${q.maxPoints}</span>
        </div>`;
        } else {
            qHtml += `<div class="subquestion-grid">`;
            qHtml += q.subQuestions.map(sq => {
                const val = qGrades[sq.id] || '';
                return `<div class="subquestion-chip ${mode === 'global' ? 'opacity-50 pointer-events-none' : ''}">
                <div class="subquestion-chip-header">
                    <span>${window.getSubQuestionLetter(q, sq.id)})</span>
                    <span class="text-xs text-gray-500">/${sq.maxPoints}</span>
                </div>
                <input type="number" min="0" max="${sq.maxPoints}" step="0.25" value="${val}"
                    ${mode === 'global' ? 'disabled' : ''}
                    onchange="updateGrade('${studentId}','${assignmentId}','${exId}','${partKey}','${q.id}','${sq.id}',this.value)"
                    class="grade-input p-2 border rounded text-center font-semibold" title="La note globale désactive la saisie détaillée">
            </div>`;
            }).join('');
            qHtml += `</div>`;
        }
        qHtml += `</div>`;
        return qHtml;
    };

    window.toggleAccordion = function(id) {
        const content = document.getElementById('accordion-' + id);
        const icon = document.getElementById('icon-' + id);
        if (!content) return;
        const willOpen = !content.classList.contains('open');
        content.classList.toggle('open');
        content.style.display = willOpen ? 'block' : 'none';
        if (icon) {
            icon.classList.toggle('open');
            icon.style.transform = icon.classList.contains('open') ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    };

    window.loadGradeEntry = function() {
        const t = getTranslations()[getLang()];
        const assignmentId = document.getElementById('select-assignment').value;
        const studentId = document.getElementById('select-student').value;
        const container = document.getElementById('grade-entry');
        
        if (!assignmentId || !studentId) {
            container.innerHTML = `<p class="text-gray-500 text-center py-8">${t.selectAssignmentAndStudentToGrade}</p>`;
            return;
        }

        const data = getData();
        const assignment = data.assignments.find(a => a.id === assignmentId);
        const student = data.students.find(s => s.id === studentId);
        
        if (!data.grades[studentId]) data.grades[studentId] = {};
        if (!data.grades[studentId][assignmentId]) data.grades[studentId][assignmentId] = {};

        const svc = gradesSvc();

        let html = `<div class="bg-blue-50 p-4 rounded-lg mb-4">
        <h3 class="font-bold text-xl">${student.name} - ${assignment.name}</h3>
        <p class="text-2xl font-bold text-blue-600 mt-2">${t.total}: <span id="grade-total">0</span> / ${svc.getAssignmentMaxPoints(assignment)}</p>
    </div>`;

        html += assignment.exercises.map((ex, exIndex) => {
            if (!data.grades[studentId][assignmentId][ex.id]) {
                data.grades[studentId][assignmentId][ex.id] = {};
            }
            const directQuestions = ex.questions || [];
            const parts = ex.parts || [];
            const hasQuestions = directQuestions.length > 0 || parts.length > 0;
            const exGradesCur = data.grades[studentId][assignmentId][ex.id] || {};
            const finalGradeCur = exGradesCur['final']?.['final']?.['final'] || '';
            const modeCur = exGradesCur.mode || (finalGradeCur !== '' ? 'global' : 'detail');
            const accordionId = `grade-ex-${ex.id}`;
            
            let exHtml = `
<div class="border rounded-lg overflow-hidden bg-white mb-3">
    <div class="bg-gray-100 p-4 flex justify-between items-center cursor-pointer hover:bg-gray-200 transition-colors" 
         onclick="toggleAccordion('${accordionId}')">
        <div class="flex items-center gap-3">
            <span id="icon-${accordionId}" class="rotate-icon text-gray-400">▼</span>
            <span class="font-bold">${t.exercise} ${exIndex + 1}${ex.name ? ' - ' + ex.name : ''}</span>
        </div>
        <span class="text-blue-700 font-bold bg-white px-3 py-1 rounded-full shadow-sm text-sm" id="ex-total-${ex.id}">0 / ${svc.getExerciseMaxPoints(ex)}</span>
    </div>
    <div id="accordion-${accordionId}" class="accordion-content">
        <div class="p-4 space-y-4 border-t">
            <div class="flex items-center gap-3">
                <div class="inline-flex border rounded overflow-hidden text-sm">
                    <button type="button" class="px-3 py-1 ${modeCur === 'detail' ? 'bg-blue-600 text-white' : 'bg-white'}" onclick="setExerciseMode('${studentId}','${assignmentId}','${ex.id}','detail')">Σ ${t.detailMode}</button>
                    <button type="button" class="px-3 py-1 ${modeCur === 'global' ? 'bg-yellow-500 text-white' : 'bg-white'}" onclick="setExerciseMode('${studentId}','${assignmentId}','${ex.id}','global')">★ ${t.globalMode}</button>
                </div>
            </div>`;
            
            if (hasQuestions) {
                const finalGrade = data.grades[studentId][assignmentId][ex.id]?.['final']?.['final']?.['final'] || '';
                exHtml += `
        <div class="flex items-center gap-3 mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
            <span class="text-sm font-semibold text-yellow-800">${t.globalGrade}</span>
            <input type="number" min="0" max="${svc.getExerciseMaxPoints(ex)}" step="0.25" value="${finalGrade}"
                ${modeCur === 'detail' ? 'disabled' : ''}
                title="La note globale désactive la saisie détaillée"
                onchange="updateGrade('${studentId}','${assignmentId}','${ex.id}','final','final','final',this.value)"
                class="grade-input w-20 p-2 border rounded text-center font-bold bg-white ${modeCur === 'detail' ? 'opacity-50' : ''}" onclick="event.stopPropagation()">
            <span class="text-xs text-yellow-600 italic">${t.ignoresDetails}</span>
        </div>`;
            }
            
            if (directQuestions.length === 0 && parts.length === 0) {
                const val = data.grades[studentId][assignmentId][ex.id]?.['direct']?.['direct']?.['direct'] || '';
                exHtml += `
        <div class="flex items-center gap-4 bg-blue-50 p-4 rounded-lg">
            <span class="font-semibold">${t.grade}</span>
            <input type="number" min="0" max="${ex.maxPoints}" step="0.25" value="${val}"
                onchange="updateGrade('${studentId}','${assignmentId}','${ex.id}','direct','direct','direct',this.value)"
                class="grade-input w-24 p-2 border rounded text-center font-bold text-lg" onclick="event.stopPropagation()">
            <span class="text-gray-500 text-lg">/ ${ex.maxPoints}</span>
        </div>`;
            } else {
                if (directQuestions.length > 0) {
                    exHtml += `<div class="grade-question-grid">` + directQuestions.map(q => window.renderGradeQuestion(q, studentId, assignmentId, ex.id, null)).join('') + `</div>`;
                }
                if (parts.length > 0) {
                    exHtml += parts.map(part => {
                        return `
            <div class="mt-4 pt-4 border-t">
                <h4 class="font-bold text-purple-700 mb-3 flex itemscenter gap-2">
                    <span class="w-2 h-2 bg-purple-400 rounded-full"></span> ${part.name}
                </h4>
                <div class="grade-question-grid">
                    ${(part.questions || []).map(q => window.renderGradeQuestion(q, studentId, assignmentId, ex.id, part.id)).join('')}
                </div>
            </div>`;
                    }).join('');
                }
            }
            exHtml += `</div></div></div>`;
            return exHtml;
        }).join('');
        
        container.innerHTML = html;
        saveData();
        window.recalculateTotals(assignmentId, studentId);
        if (window.translatePage) window.translatePage();
    };

    window.updateGrade = function(studentId, assignmentId, exId, partKey, qId, sqId, value) {
        const data = getData();
        if (!data.grades[studentId]) data.grades[studentId] = {};
        if (!data.grades[studentId][assignmentId]) data.grades[studentId][assignmentId] = {};
        if (!data.grades[studentId][assignmentId][exId]) data.grades[studentId][assignmentId][exId] = {};
        if (!data.grades[studentId][assignmentId][exId][partKey]) data.grades[studentId][assignmentId][exId][partKey] = {};
        if (!data.grades[studentId][assignmentId][exId][partKey][qId]) data.grades[studentId][assignmentId][exId][partKey][qId] = {};
        
        data.grades[studentId][assignmentId][exId][partKey][qId][sqId] = parseFloat(value) || 0;
        
        if (!(partKey === 'final' && qId === 'final' && sqId === 'final')) {
            const exGrades = data.grades[studentId][assignmentId][exId];
            exGrades.mode = 'detail';
            if (exGrades && exGrades.final && exGrades.final.final && typeof exGrades.final.final.final !== 'undefined') {
                exGrades.final.final.final = '';
            }
        }
        saveData();
        window.recalculateTotals(assignmentId, studentId);
    };

    window.setExerciseMode = function(studentId, assignmentId, exId, mode) {
        const data = getData();
        if (!data.grades[studentId]) data.grades[studentId] = {};
        if (!data.grades[studentId][assignmentId]) data.grades[studentId][assignmentId] = {};
        if (!data.grades[studentId][assignmentId][exId]) data.grades[studentId][assignmentId][exId] = {};
        
        const exGrades = data.grades[studentId][assignmentId][exId];
        exGrades.mode = mode;
        if (mode === 'detail') {
            if (!exGrades.final) exGrades.final = {};
            if (!exGrades.final.final) exGrades.final.final = {};
            exGrades.final.final.final = '';
        }
        saveData();
        window.recalculateTotals(assignmentId, studentId);
        window.loadGradeEntry();
    };

    window.recalculateTotals = function(assignmentId, studentId) {
        const data = getData();
        const svc = gradesSvc();
        const assignment = data.assignments.find(a => a.id === assignmentId);
        const studentGrades = data.grades[studentId]?.[assignmentId] || {};
        let grandTotal = 0;
        
        for (const ex of assignment.exercises) {
            let exTotal = 0;
            const exGrades = studentGrades[ex.id] || {};
            const directQuestions = ex.questions || [];
            const parts = ex.parts || [];
            const finalGrade = exGrades['final']?.['final']?.['final'];
            
            if (finalGrade !== undefined && finalGrade !== '') {
                exTotal = parseFloat(finalGrade) || 0;
            } else if (directQuestions.length === 0 && parts.length === 0) {
                exTotal = exGrades['direct']?.['direct']?.['direct'] || 0;
            } else {
                for (const q of directQuestions) {
                    let qTotal = 0;
                    const qGrades = exGrades['direct']?.[q.id] || {};
                    if (!q.subQuestions || q.subQuestions.length === 0) {
                        qTotal = qGrades['direct'] || 0;
                    } else {
                        for (const sq of q.subQuestions) {
                            qTotal += qGrades[sq.id] || 0;
                        }
                    }
                    const qEl = document.getElementById('q-total-' + q.id);
                    if (qEl) qEl.textContent = qTotal + ' / ' + getQuestionMaxPoints(q);
                    exTotal += qTotal;
                }
                for (const part of parts) {
                    for (const q of (part.questions || [])) {
                        let qTotal = 0;
                        const qGrades = exGrades[part.id]?.[q.id] || {};
                        if (!q.subQuestions || q.subQuestions.length === 0) {
                            qTotal = qGrades['direct'] || 0;
                        } else {
                            for (const sq of q.subQuestions) {
                                qTotal += qGrades[sq.id] || 0;
                            }
                        }
                        const qEl = document.getElementById('q-total-' + q.id);
                        if (qEl) qEl.textContent = qTotal + ' / ' + getQuestionMaxPoints(q);
                        exTotal += qTotal;
                    }
                }
            }
            
            const exEl = document.getElementById('ex-total-' + ex.id);
            if (exEl) {
                exEl.textContent = exTotal + ' / ' + svc.getExerciseMaxPoints(ex);
                const isGlobal = finalGrade !== undefined && finalGrade !== '';
                exEl.className = `text-blue-700 font-bold ${isGlobal ? 'bg-yellow-100' : 'bg-white'} px-3 py-1 rounded-full shadow-sm text-sm`;
            }
            grandTotal += exTotal;
        }
        
        const totalEl = document.getElementById('grade-total');
        if (totalEl) totalEl.textContent = grandTotal;
        if (studentGrades.global !== undefined && studentGrades.global !== '') {
            studentGrades.global = grandTotal;
        }
    };

    // Proxies for compatibility with other modules (e.g. summary.js)
    window.getExerciseMaxPoints = (ex) => gradesSvc().getExerciseMaxPoints(ex);
    window.getAssignmentMaxPoints = (assignment) => gradesSvc().getAssignmentMaxPoints(assignment);
    window.hasAnyGradeForExercise = (studentId, assignmentId, exId) => gradesSvc().hasAnyGradeForExercise(getData(), studentId, assignmentId, exId);
    window.hasAnyGradeForAssignment = (studentId, assignmentId) => gradesSvc().hasAnyGradeForAssignment(getData(), studentId, assignmentId);
    window.getStudentAssignmentTotal = (studentId, assignmentId) => gradesSvc().getStudentAssignmentTotal(getData(), studentId, assignmentId);
    window.getStudentExerciseTotal = (studentId, assignmentId, exId) => gradesSvc().getStudentExerciseTotal(getData(), studentId, assignmentId, exId);

})();
