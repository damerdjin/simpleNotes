// UI logic for Grades tab: selectors, entry rendering, updates, totals
// Depends on window.data, window.grades, translations

export function loadGradeSelectors() {
  const t = translations[window.currentLanguage];
  const assignmentSelect = document.getElementById('select-assignment');
  const studentSelect = document.getElementById('select-student');
  const classSelect = document.getElementById('select-class-grades');
  const selectedClass = classSelect.value;
  if (!selectedClass) {
    assignmentSelect.innerHTML = `<option value="">-- ${t.selectClassFirst} --</option>`;
    studentSelect.innerHTML = `<option value="">-- ${t.selectClassFirst} --</option>`;
    document.getElementById('grade-entry').innerHTML = `<p class="text-gray-500 text-center py-8">${t.selectClassToStart}</p>`;
    return;
  }
  const filteredAssignments = window.data.assignments.filter(a => a.className === selectedClass);
  assignmentSelect.innerHTML = `<option value="">-- ${t.selectAssignment} --</option>` +
    filteredAssignments.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
  const filteredStudents = window.data.students.filter(s => s.className === selectedClass);
  studentSelect.innerHTML = `<option value="">-- ${t.selectStudent} --</option>` +
    filteredStudents.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  document.getElementById('grade-entry').innerHTML = `<p class="text-gray-500 text-center py-8">${t.selectAssignmentAndStudentToGrade}</p>`;
}

function getQuestionMaxPoints(q) {
  if (q.subQuestions && q.subQuestions.length > 0) {
    return q.subQuestions.reduce((sum, sq) => sum + (sq.maxPoints || 0), 0);
  }
  return q.maxPoints || 0;
}

export function renderGradeQuestion(q, studentId, assignmentId, exId, partId = null) {
  const studentGrades = window.data.grades[studentId]?.[assignmentId]?.[exId] || {};
  const partKey = partId || 'direct';
  if (!studentGrades[partKey]) studentGrades[partKey] = {};
  const qGrades = studentGrades[partKey][q.id] || {};
  const mode = studentGrades.mode || ((studentGrades['final']?.['final']?.['final'] || '') !== '' ? 'global' : 'detail');
  let qHtml = `<div class="grade-question-card">
    <div class="question-header">
      <span class="question-title">${getQuestionDisplayName(assignmentId, exId, q.id, partId)}</span>
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
          <span>${getSubQuestionLetter(q, sq.id)})</span>
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
}

export function getQuestionDisplayName(assignmentId, exId, qId, partId) {
  const t = translations[window.currentLanguage];
  const assignment = window.data.assignments.find(a => a.id === assignmentId);
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
}

export function getSubQuestionLetter(q, sqId) {
  const t = translations[window.currentLanguage];
  const letters = (t.subQuestionLetters || '').split('');
  const idx = Math.max(0, (q.subQuestions || []).findIndex(s => s.id === sqId));
  return letters[idx] || letters[0] || '?';
}

export function loadGradeEntry() {
  const t = translations[window.currentLanguage];
  const assignmentId = document.getElementById('select-assignment').value;
  const studentId = document.getElementById('select-student').value;
  const container = document.getElementById('grade-entry');
  if (!assignmentId || !studentId) {
    container.innerHTML = `<p class="text-gray-500 text-center py-8">${t.selectAssignmentAndStudentToGrade}</p>`;
    return;
  }
  const assignment = window.data.assignments.find(a => a.id === assignmentId);
  const student = window.data.students.find(s => s.id === studentId);
  if (!window.data.grades[studentId]) window.data.grades[studentId] = {};
  if (!window.data.grades[studentId][assignmentId]) window.data.grades[studentId][assignmentId] = {};
  let html = `<div class="bg-blue-50 p-4 rounded-lg mb-4">
    <h3 class="font-bold text-xl">${student.name} - ${assignment.name}</h3>
    <p class="text-2xl font-bold text-blue-600 mt-2">${t.total}: <span id="grade-total">0</span> / ${window.grades.getAssignmentMaxPoints(assignment)}</p>
  </div>`;
  html += assignment.exercises.map((ex, exIndex) => {
    if (!window.data.grades[studentId][assignmentId][ex.id]) {
      window.data.grades[studentId][assignmentId][ex.id] = {};
    }
    const directQuestions = ex.questions || [];
    const parts = ex.parts || [];
    const hasQuestions = directQuestions.length > 0 || parts.length > 0;
    const exGradesCur = window.data.grades[studentId][assignmentId][ex.id] || {};
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
          <span class="text-blue-700 font-bold bg-white px-3 py-1 rounded-full shadow-sm text-sm" id="ex-total-${ex.id}">0 / ${window.grades.getExerciseMaxPoints(ex)}</span>
        </div>
        <div id="accordion-${accordionId}" class="accordion-content">
          <div class="p-4 space-y-4 border-t">
            <div class="flex items-center gap-3">
              <div class="inline-flex border rounded overflow-hidden text-sm">
                <button type="button" class="px-3 py-1 ${modeCur === 'detail' ? 'bg-blue-600 text-white' : 'bg-white'}" onclick="setExerciseMode('${studentId}','${assignmentId}','${ex.id}','detail')">Σ ${translations[window.currentLanguage].detailMode}</button>
                <button type="button" class="px-3 py-1 ${modeCur === 'global' ? 'bg-yellow-500 text-white' : 'bg-white'}" onclick="setExerciseMode('${studentId}','${assignmentId}','${ex.id}','global')">★ ${translations[window.currentLanguage].globalMode}</button>
              </div>
            </div>`;
    if (hasQuestions) {
      const finalGrade = window.data.grades[studentId][assignmentId][ex.id]?.['final']?.['final']?.['final'] || '';
      exHtml += `
        <div class="flex items-center gap-3 mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
          <span class="text-sm font-semibold text-yellow-800">${t.globalGrade}</span>
          <input type="number" min="0" max="${window.grades.getExerciseMaxPoints(ex)}" step="0.25" value="${finalGrade}"
            ${modeCur === 'detail' ? 'disabled' : ''}
            title="La note globale désactive la saisie détaillée"
            onchange="updateGrade('${studentId}','${assignmentId}','${ex.id}','final','final','final',this.value)"
            class="grade-input w-20 p-2 border rounded text-center font-bold bg-white ${modeCur === 'detail' ? 'opacity-50' : ''}" onclick="event.stopPropagation()">
          <span class="text-xs text-yellow-600 italic">${t.ignoresDetails}</span>
        </div>`;
    }
    if (directQuestions.length === 0 && parts.length === 0) {
      const val = window.data.grades[studentId][assignmentId][ex.id]?.['direct']?.['direct']?.['direct'] || '';
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
        exHtml += `<div class="grade-question-grid">` + directQuestions.map(q => renderGradeQuestion(q, studentId, assignmentId, ex.id, null)).join('') + `</div>`;
      }
      if (parts.length > 0) {
        exHtml += parts.map(part => {
          return `
            <div class="mt-4 pt-4 border-t">
              <h4 class="font-bold text-purple-700 mb-3 flex itemscenter gap-2">
                <span class="w-2 h-2 bg-purple-400 rounded-full"></span> ${part.name}
              </h4>
              <div class="grade-question-grid">
                ${(part.questions || []).map(q => renderGradeQuestion(q, studentId, assignmentId, ex.id, part.id)).join('')}
              </div>
            </div>`;
        }).join('');
      }
    }
    exHtml += `</div></div></div>`;
    return exHtml;
  }).join('');
  container.innerHTML = html;
  window.store?.save?.(window.data);
  recalculateTotals(assignmentId, studentId);
  window.applyLanguage?.();
}

export function updateGrade(studentId, assignmentId, exId, partKey, qId, sqId, value) {
  if (!window.data.grades[studentId]) window.data.grades[studentId] = {};
  if (!window.data.grades[studentId][assignmentId]) window.data.grades[studentId][assignmentId] = {};
  if (!window.data.grades[studentId][assignmentId][exId]) window.data.grades[studentId][assignmentId][exId] = {};
  if (!window.data.grades[studentId][assignmentId][exId][partKey]) window.data.grades[studentId][assignmentId][exId][partKey] = {};
  if (!window.data.grades[studentId][assignmentId][exId][partKey][qId]) window.data.grades[studentId][assignmentId][exId][partKey][qId] = {};
  window.data.grades[studentId][assignmentId][exId][partKey][qId][sqId] = parseFloat(value) || 0;
  if (!(partKey === 'final' && qId === 'final' && sqId === 'final')) {
    const exGrades = window.data.grades[studentId][assignmentId][exId];
    exGrades.mode = 'detail';
    if (exGrades && exGrades.final && exGrades.final.final && typeof exGrades.final.final.final !== 'undefined') {
      exGrades.final.final.final = '';
    }
  }
  window.store?.save?.(window.data);
  recalculateTotals(assignmentId, studentId);
}

export function setExerciseMode(studentId, assignmentId, exId, mode) {
  if (!window.data.grades[studentId]) window.data.grades[studentId] = {};
  if (!window.data.grades[studentId][assignmentId]) window.data.grades[studentId][assignmentId] = {};
  if (!window.data.grades[studentId][assignmentId][exId]) window.data.grades[studentId][assignmentId][exId] = {};
  const exGrades = window.data.grades[studentId][assignmentId][exId];
  exGrades.mode = mode;
  if (mode === 'detail') {
    if (!exGrades.final) exGrades.final = {};
    if (!exGrades.final.final) exGrades.final.final = {};
    exGrades.final.final.final = '';
  }
  window.store?.save?.(window.data);
  recalculateTotals(assignmentId, studentId);
  loadGradeEntry();
}

export function recalculateTotals(assignmentId, studentId) {
  const assignment = window.data.assignments.find(a => a.id === assignmentId);
  const studentGrades = window.data.grades[studentId]?.[assignmentId] || {};
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
      exEl.textContent = exTotal + ' / ' + window.grades.getExerciseMaxPoints(ex);
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
}

// Attach to window for inline handlers
window.UIGrades = {
  loadGradeSelectors,
  renderGradeQuestion,
  getQuestionDisplayName,
  getSubQuestionLetter,
  loadGradeEntry,
  updateGrade,
  setExerciseMode,
  recalculateTotals
};
