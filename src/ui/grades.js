
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

    window.navigateStudent = function(direction) {
        const studentSelect = document.getElementById('select-student');
        if (!studentSelect || studentSelect.options.length <= 1) return;
        
        let newIndex = studentSelect.selectedIndex + direction;
        
        // Loop back if at ends
        if (newIndex < 1) newIndex = studentSelect.options.length - 1;
        if (newIndex >= studentSelect.options.length) newIndex = 1;
        
        studentSelect.selectedIndex = newIndex;
        window.loadGradeEntry();
    };

    window.loadGradeSelectors = function() {
        const t = getTranslations()[getLang()];
        const assignmentSelect = document.getElementById('select-assignment');
        const studentSelect = document.getElementById('select-student');
        const classSelect = document.getElementById('select-class-grades');
        const selectedClass = classSelect ? classSelect.value : '';

        const containerAssignment = document.getElementById('container-select-assignment');
        const containerStudent = document.getElementById('container-select-student');

        if (!assignmentSelect || !studentSelect) return;

        // Sauvegarder les valeurs actuelles pour essayer de les restaurer
        const currentAssignmentId = assignmentSelect.value;
        const currentStudentId = studentSelect.value;

        if (!selectedClass) {
            if (containerAssignment) containerAssignment.classList.add('hidden');
            if (containerStudent) containerStudent.classList.add('hidden');
            assignmentSelect.innerHTML = `<option value="">-- ${t.selectClassFirst || 'Sélectionnez une classe'} --</option>`;
            studentSelect.innerHTML = `<option value="">-- ${t.selectClassFirst || 'Sélectionnez une classe'} --</option>`;
            window.loadGradeEntry();
            return;
        }

        // Show assignment container when class is selected
        if (containerAssignment) containerAssignment.classList.remove('hidden');

        const data = getData();
        const userId = window.currentUser?.email || window.currentUser?.id || 'unknown';
        const globalAcademicYear = window.getGlobalAcademicYear();
        const globalTrimester = window.getGlobalTrimester();
        
        // Mise à jour de la liste des devoirs
        const filteredAssignments = data.assignments.filter(a => {
            const matchClass = a.className === selectedClass;
            const matchUser = (a.createdBy || 'unknown') === userId;
            const matchAcademicYear = globalAcademicYear ? (a.academicYear || '') === globalAcademicYear : false;
            const matchTrimester = globalTrimester ? (a.trimester || '') === globalTrimester : false;
            return matchClass && matchUser && matchAcademicYear && matchTrimester;
        });
        assignmentSelect.innerHTML = `<option value="">-- ${t.selectAssignment || 'Sélectionner un devoir'} --</option>` +
            filteredAssignments.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

        // Mise à jour de la liste des élèves
        const filteredStudents = data.students.filter(s => s.className === selectedClass && (s.importedBy || 'unknown') === userId && (s.academicYear || '') === globalAcademicYear);
        studentSelect.innerHTML = `<option value="">-- ${t.selectStudent || 'Sélectionner un élève'} --</option>` +
            filteredStudents.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

        // Tenter de restaurer les sélections si elles sont toujours valides
        if (currentAssignmentId && filteredAssignments.some(a => a.id === currentAssignmentId)) {
            assignmentSelect.value = currentAssignmentId;
        }
        if (currentStudentId && filteredStudents.some(s => s.id === currentStudentId)) {
            studentSelect.value = currentStudentId;
        }

        // Recharger l'interface de saisie (gère aussi la visibilité du sélecteur d'élève)
        window.loadGradeEntry();
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
        
        const q = list.find(x => x.id === qId);
        if (q && q.name && q.name.trim() !== '') {
            return q.name;
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
        const maxPts = getQuestionMaxPoints(q);
        
        let qHtml = `
        <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3 transition-all hover:border-blue-300 hover:bg-blue-50/30 group">
            <div class="flex items-center justify-between">
                <span class="text-sm font-bold text-slate-700">${window.getQuestionDisplayName(assignmentId, exId, q.id, partId)}</span>
                <span class="text-[10px] font-bold px-2 py-0.5 bg-white border border-slate-200 rounded-full text-slate-500 group-hover:border-blue-200 group-hover:text-blue-600 transition-colors" id="q-total-${q.id}">0 / ${maxPts}</span>
            </div>`;
        
        if (!q.subQuestions || q.subQuestions.length === 0) {
            const val = qGrades['direct'] || '';
            qHtml += `
            <div class="relative ${mode === 'global' ? 'opacity-40 grayscale pointer-events-none' : ''}">
                <input type="number" min="0" max="${q.maxPoints}" step="0.25" value="${val}"
                    ${mode === 'global' ? 'disabled' : ''}
                    onchange="updateGrade('${studentId}','${assignmentId}','${exId}','${partKey}','${q.id}','direct',this.value)"
                    class="w-full p-2.5 bg-white border-2 border-slate-200 rounded-lg text-center font-bold text-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" 
                    placeholder="0">
                <div class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">/ ${q.maxPoints}</div>
            </div>`;
        } else {
            qHtml += `<div class="grid grid-cols-2 gap-2">`;
            qHtml += q.subQuestions.map(sq => {
                const val = qGrades[sq.id] || '';
                return `
                <div class="space-y-1 ${mode === 'global' ? 'opacity-40 grayscale pointer-events-none' : ''}">
                    <div class="flex justify-between px-1">
                        <span class="text-[10px] font-bold text-slate-500 uppercase">${window.getSubQuestionLetter(q, sq.id)})</span>
                        <span class="text-[10px] font-bold text-slate-400">/${sq.maxPoints}</span>
                    </div>
                    <input type="number" min="0" max="${sq.maxPoints}" step="0.25" value="${val}"
                        ${mode === 'global' ? 'disabled' : ''}
                        onchange="updateGrade('${studentId}','${assignmentId}','${exId}','${partKey}','${q.id}','${sq.id}',this.value)"
                        class="w-full p-2 bg-white border-2 border-slate-200 rounded-lg text-center font-bold text-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-xs"
                        placeholder="0">
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

        const isOpen = content.style.maxHeight !== '0px' && content.style.maxHeight !== '';

        if (isOpen) {
            content.style.maxHeight = '0px';
            content.style.opacity = '0';
            content.style.visibility = 'hidden';
            if (icon) icon.classList.remove('rotate-180');
        } else {
            content.style.maxHeight = '2000px';
            content.style.opacity = '1';
            content.style.visibility = 'visible';
            if (icon) icon.classList.add('rotate-180');
        }
    };

    window.loadGradeEntry = function() {
        const t = getTranslations()[getLang()];
        const assignmentId = document.getElementById('select-assignment').value;
        const studentId = document.getElementById('select-student').value;
        const container = document.getElementById('grade-entry');
        const containerStudent = document.getElementById('container-select-student');
        
        // Gérer la visibilité du conteneur d'élève
        if (assignmentId && containerStudent) {
            containerStudent.classList.remove('hidden');
        } else if (containerStudent) {
            containerStudent.classList.add('hidden');
        }

        if (!assignmentId || !studentId) {
            const selectClass = document.getElementById('select-class-grades').value;
            if (!selectClass) {
                container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 text-slate-400">
                    <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                    </div>
                    <p class="font-medium text-slate-500">${t.selectClassToStart || 'Sélectionnez une classe pour commencer'}</p>
                </div>`;
            } else {
                container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 text-slate-400">
                    <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                    </div>
                    <p class="font-medium text-slate-500">${t.selectAssignmentAndStudentToGrade || 'Sélectionnez un devoir et un élève'}</p>
                </div>`;
            }
            return;
        }

        const data = getData();
        const assignment = data.assignments.find(a => a.id === assignmentId);
        const student = data.students.find(s => s.id === studentId);
        
        if (!data.grades[studentId]) data.grades[studentId] = {};
        if (!data.grades[studentId][assignmentId]) data.grades[studentId][assignmentId] = {};

        const svc = gradesSvc();
        const maxAssignmentPoints = svc.getAssignmentMaxPoints(assignment);

        // Student Header Card (Reduced size & Responsive)
        let html = `
        <div class="bg-blue-600 rounded-xl p-4 mb-4 sm:mb-6 text-white shadow-md relative overflow-hidden">
            <div class="absolute top-0 right-0 p-4 opacity-5">
                <svg class="w-16 h-16 sm:w-20 sm:h-20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
            </div>
            <div class="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div class="flex items-center gap-3 w-full sm:w-auto">
                    <div class="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-lg sm:text-xl font-black border border-white/30 shrink-0">
                        ${student.name.charAt(0).toUpperCase()}
                    </div>
                    <div class="min-w-0 flex-1">
                        <h3 class="text-base sm:text-lg font-black tracking-tight leading-tight truncate">${student.name}</h3>
                        <div class="flex items-center gap-2 mt-0.5 opacity-90 overflow-hidden">
                            <span class="text-xs font-medium opacity-80 truncate">${assignment.name}</span>
                        </div>
                    </div>
                </div>
                <div class="bg-white/10 backdrop-blur-md rounded-xl px-3 py-1.5 sm:px-4 sm:py-2 border border-white/20 flex flex-row sm:flex-col items-center justify-between sm:justify-center w-full sm:w-auto min-w-[100px]">
                    <span class="text-[9px] font-bold uppercase tracking-wider opacity-70 sm:mb-0.5">${t.total || 'Total'}</span>
                    <div class="flex items-baseline gap-1">
                        <span id="grade-total" class="text-xl sm:text-2xl font-black">0</span>
                        <span class="text-[10px] sm:text-sm font-bold opacity-60">/ ${maxAssignmentPoints}</span>
                    </div>
                </div>
            </div>
        </div>`;

        // Check if the assignment is "simple" (1 exercise, and either 1 question without subquestions OR 0 questions/global note)
        const isSimpleAssignment = assignment.exercises.length === 1 && (() => {
            const ex = assignment.exercises[0];
            const directQuestions = ex.questions || [];
            const parts = ex.parts || [];
            const totalQuestions = directQuestions.length + parts.reduce((acc, p) => acc + (p.questions ? p.questions.length : 0), 0);
            
            if (totalQuestions === 0) return true; // Global note case
            if (totalQuestions === 1) {
                const singleQ = directQuestions[0] || parts[0]?.questions[0];
                return !(singleQ?.subQuestions && singleQ.subQuestions.length > 0);
            }
            return false;
        })();

        if (isSimpleAssignment) {
            const ex = assignment.exercises[0];
            const directQuestions = ex.questions || [];
            const parts = ex.parts || [];
            const totalQuestions = directQuestions.length + parts.reduce((acc, p) => acc + (p.questions ? p.questions.length : 0), 0);
            
            let val, maxPts, qId, partKey, displayName, displaySubName;

            if (totalQuestions === 1) {
                const q = directQuestions[0] || parts[0]?.questions[0];
                partKey = directQuestions[0] ? 'direct' : ex.parts[0].id;
                qId = q.id;
                
                const detailVal = data.grades[studentId][assignmentId][ex.id]?.[partKey]?.[qId]?.['direct'];
                const globalVal = data.grades[studentId][assignmentId][ex.id]?.['final']?.['final']?.['final'];
                val = (detailVal !== undefined && detailVal !== '') ? detailVal : (globalVal !== undefined && globalVal !== '' ? globalVal : '');
                
                maxPts = q.maxPoints;
                displayName = ex.name || (t.exercise + ' 1');
                displaySubName = window.getQuestionDisplayName(assignmentId, ex.id, qId, directQuestions[0] ? null : ex.parts[0].id);
            } else {
                // Global note case (0 questions)
                partKey = 'direct';
                qId = 'direct';
                
                const directVal = data.grades[studentId][assignmentId][ex.id]?.[partKey]?.[qId]?.['direct'];
                const globalVal = data.grades[studentId][assignmentId][ex.id]?.['final']?.['final']?.['final'];
                val = (directVal !== undefined && directVal !== '') ? directVal : (globalVal !== undefined && globalVal !== '' ? globalVal : '');
                
                maxPts = ex.maxPoints;
                displayName = ex.name || (t.exercise + ' 1');
                displaySubName = t.globalGrade || 'Note globale';
            }

            html += `
            <div class="col-span-full">
                <div class="bg-white border-2 border-blue-100 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 transition-all hover:border-blue-300">
                    <div class="flex items-center gap-4 w-full sm:w-auto">
                        <div class="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-2xl flex items-center justify-center text-xl sm:text-2xl font-black shadow-lg shadow-blue-200 shrink-0">
                            <svg class="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        </div>
                        <div class="min-w-0">
                            <h3 class="text-lg sm:text-xl font-black text-slate-800 tracking-tight truncate">${displayName}</h3>
                            <p class="text-[10px] sm:text-sm text-slate-500 font-bold uppercase tracking-wider truncate">${displaySubName}</p>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-4 w-full sm:w-auto">
                        <div class="relative flex-1 sm:w-56">
                            <input type="number" inputmode="decimal" min="0" max="${maxPts}" step="0.25" value="${val}"
                                onchange="updateGrade('${studentId}','${assignmentId}','${ex.id}','${partKey}','${qId}','direct',this.value)"
                                class="w-full p-3 sm:p-5 bg-blue-50/50 border-2 border-blue-200 rounded-2xl text-center font-black text-blue-900 text-2xl sm:text-3xl focus:border-blue-500 focus:bg-white focus:ring-8 focus:ring-blue-500/10 outline-none transition-all shadow-inner" 
                                placeholder="0">
                            <div class="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 text-xs sm:text-sm font-black text-blue-400">/ ${maxPts}</div>
                        </div>
                    </div>
                </div>
            </div>`;
        } else {
            html += `<div class="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">`;
            html += assignment.exercises.map((ex, exIndex) => {
                if (!data.grades[studentId][assignmentId][ex.id]) {
                    data.grades[studentId][assignmentId][ex.id] = {};
                }
                const directQuestions = ex.questions || [];
                const parts = ex.parts || [];
                const hasQuestions = directQuestions.length > 0 || parts.length > 0;
                const exGradesCur = data.grades[studentId][assignmentId][ex.id] || {};
                const finalGradeCur = exGradesCur['final']?.['final']?.['final'] || '';
                
                // Priority: 
                // 1. If we have a stored mode, use it.
                // 2. If no stored mode but we have a global grade, it's 'global'.
                // 3. Otherwise default to 'detail'.
                const modeCur = exGradesCur.mode || (finalGradeCur !== '' ? 'global' : 'detail');
                const accordionId = `grade-ex-${ex.id}`;
                const maxExPoints = svc.getExerciseMaxPoints(ex);
                
                // Always show switcher for exercises with questions/parts
                const totalQuestions = directQuestions.length + parts.reduce((acc, p) => acc + (p.questions ? p.questions.length : 0), 0);
                const showSwitcher = totalQuestions > 0;
                
                // Exercise Card
                let exHtml = `
                <div class="group border border-slate-200 rounded-2xl overflow-hidden bg-white hover:shadow-xl hover:border-blue-200 transition-all duration-300 mb-4">
                    <!-- Header Section -->
                    <div class="p-4 sm:p-5 flex items-center justify-between cursor-pointer select-none bg-gradient-to-r from-white to-slate-50/50" onclick="window.toggleAccordion('${accordionId}')">
                        <div class="flex items-center gap-3 sm:gap-4 min-w-0">
                            <div class="w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center font-black shadow-lg shadow-blue-200 group-hover:scale-110 transition-transform duration-300 shrink-0">
                                ${exIndex + 1}
                            </div>
                            <div class="min-w-0">
                                <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                    <h3 class="font-black text-slate-800 tracking-tight truncate text-sm sm:text-base">${ex.name ? (ex.name === 'Global' ? t.globalMode : ex.name) : (t.exercise || 'Exercice') + ' ' + (exIndex + 1)}</h3>
                                    <span class="inline-flex w-fit px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] sm:text-[10px] font-black rounded-full border border-blue-100 uppercase tracking-wider">${maxExPoints} ${t.pointsAbbr || 'pts'}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="flex items-center gap-2 sm:gap-3">
                            <span id="ex-total-${ex.id}" class="px-2 sm:px-4 py-1 sm:py-1.5 bg-blue-50 text-blue-700 font-black rounded-lg sm:rounded-xl text-[10px] sm:text-sm border border-blue-100 shadow-sm whitespace-nowrap">
                                0 / ${maxExPoints}
                            </span>
                            <div id="icon-${accordionId}" class="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all duration-500 shadow-sm shrink-0">
                                <svg class="w-4 h-4 sm:w-5 sm:h-5 transform transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7"></path>
                                </svg>
                            </div>
                        </div>
                    </div>
    
                    <!-- Content Section -->
                    <div id="accordion-${accordionId}" class="accordion-content border-t border-slate-100 bg-white" style="max-height: 0; opacity: 0; visibility: hidden;">
                        <div class="p-6 space-y-6">`;
    
                if (showSwitcher) {
                    exHtml += `
                            <!-- Mode Switcher & Global Grade (Same line) -->
                            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                                    </div>
                                    <div class="inline-flex bg-slate-200 p-0.5 rounded-lg shadow-inner">
                                        <button type="button" 
                                            class="px-3 py-1 rounded-md text-[10px] font-bold transition-all ${modeCur === 'detail' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}" 
                                            onclick="event.stopPropagation(); setExerciseMode('${studentId}','${assignmentId}','${ex.id}','detail')">
                                            ${t.detailMode || 'Détaillé'}
                                        </button>
                                        <button type="button" 
                                            class="px-3 py-1 rounded-md text-[10px] font-bold transition-all ${modeCur === 'global' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}" 
                                            onclick="event.stopPropagation(); setExerciseMode('${studentId}','${assignmentId}','${ex.id}','global')">
                                            ${t.globalMode || 'Global'}
                                        </button>
                                    </div>
                                </div>
    
                                <!-- Global Grade Input -->
                                <div class="flex items-center gap-3 ${modeCur === 'detail' ? 'opacity-40 grayscale pointer-events-none' : ''}">
                                    <span class="text-xs font-bold text-slate-500 uppercase tracking-tight">${t.globalGrade || 'Note globale'} :</span>
                                    <div class="relative">
                                        <input type="number" min="0" max="${maxExPoints}" step="0.25" value="${finalGradeCur}"
                                            ${modeCur === 'detail' ? 'disabled' : ''}
                                            onchange="updateGrade('${studentId}','${assignmentId}','${ex.id}','final','final','final',this.value)"
                                            class="w-20 p-1.5 bg-white border-2 border-amber-200 rounded-lg text-center font-black text-slate-700 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all text-sm" 
                                            placeholder="0" onclick="event.stopPropagation()">
                                        <div class="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400">/ ${maxExPoints}</div>
                                    </div>
                                </div>
                            </div>`;
                }
                
                if (directQuestions.length === 0 && parts.length === 0) {
                    const val = data.grades[studentId][assignmentId][ex.id]?.['direct']?.['direct']?.['direct'] || '';
                    exHtml += `
                            <div class="flex items-center gap-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
                                <div class="flex items-center gap-3 shrink-0">
                                    <div class="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    </div>
                                    <span class="text-xs font-bold text-blue-900">${t.grade || 'Note'}</span>
                                </div>
                                <div class="flex items-center gap-3 ml-auto">
                                    <div class="relative w-28">
                                        <input type="number" min="0" max="${ex.maxPoints}" step="0.25" value="${val}"
                                            onchange="updateGrade('${studentId}','${assignmentId}','${ex.id}','direct','direct','direct',this.value)"
                                            class="w-full p-2 bg-white border-2 border-blue-200 rounded-lg text-center font-black text-blue-900 focus:border-blue-500 outline-none transition-all shadow-sm text-sm" 
                                            placeholder="0">
                                        <div class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-blue-400">/ ${ex.maxPoints}</div>
                                    </div>
                                </div>
                            </div>`;
                } else {
                    // Wrap detailed questions in a container that can be hidden
                    exHtml += `<div class="${modeCur === 'global' ? 'hidden' : ''}">`;
                    
                    if (directQuestions.length > 0) {
                        exHtml += `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">` + directQuestions.map(q => window.renderGradeQuestion(q, studentId, assignmentId, ex.id, null)).join('') + `</div>`;
                    }
                    if (parts.length > 0) {
                        exHtml += parts.map((part, pIdx) => {
                            const showBorder = showSwitcher || pIdx > 0 || directQuestions.length > 0;
                            return `
                            <div class="${showBorder ? 'mt-6 pt-6 border-t border-slate-100' : ''}">
                                <div class="flex items-center gap-3 mb-3">
                                    <div class="w-7 h-7 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg>
                                    </div>
                                    <h4 class="font-black text-slate-700 text-[11px] uppercase tracking-wider">${part.name}</h4>
                                </div>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    ${(part.questions || []).map(q => window.renderGradeQuestion(q, studentId, assignmentId, ex.id, part.id)).join('')}
                                </div>
                            </div>`;
                        }).join('');
                    }
                    
                    exHtml += `</div>`;
                }
                exHtml += `</div></div></div>`;
                return exHtml;
            }).join('');
            html += `</div>`;
        }
        
        container.innerHTML = html;
        saveData();
        window.recalculateTotals(assignmentId, studentId);
    };

    window.updateGrade = function(studentId, assignmentId, exId, partKey, qId, sqId, value) {
        const data = getData();
        if (!data.grades[studentId]) data.grades[studentId] = {};
        if (!data.grades[studentId][assignmentId]) data.grades[studentId][assignmentId] = {};
        if (!data.grades[studentId][assignmentId][exId]) data.grades[studentId][assignmentId][exId] = {};
        if (!data.grades[studentId][assignmentId][exId][partKey]) data.grades[studentId][assignmentId][exId][partKey] = {};
        if (!data.grades[studentId][assignmentId][exId][partKey][qId]) data.grades[studentId][assignmentId][exId][partKey][qId] = {};
        
        const val = parseFloat(value) || 0;
        data.grades[studentId][assignmentId][exId][partKey][qId][sqId] = val;
        
        const exGrades = data.grades[studentId][assignmentId][exId];
        const assignment = data.assignments.find(a => a.id === assignmentId);
        const ex = assignment?.exercises.find(e => e.id === exId);
        
        // Detect simple exercise (1 question OR 0 questions/global note)
        const directQuestions = ex?.questions || [];
        const parts = ex?.parts || [];
        const totalQuestions = directQuestions.length + parts.reduce((acc, p) => acc + (p.questions ? p.questions.length : 0), 0);
        
        let isSimple = false;
        let singleQ = null;
        let singlePartKey = 'direct';
        
        if (totalQuestions === 0) {
            isSimple = true;
        } else if (totalQuestions === 1) {
            singleQ = directQuestions[0] || parts[0]?.questions[0];
            singlePartKey = directQuestions[0] ? 'direct' : parts[0].id;
            if (!(singleQ?.subQuestions && singleQ.subQuestions.length > 0)) {
                isSimple = true;
            }
        }

        if (partKey === 'final' && qId === 'final' && sqId === 'final') {
            exGrades.mode = 'global';
            // Sync to question or direct if simple
            if (isSimple) {
                if (singleQ) {
                    if (!exGrades[singlePartKey]) exGrades[singlePartKey] = {};
                    if (!exGrades[singlePartKey][singleQ.id]) exGrades[singlePartKey][singleQ.id] = {};
                    exGrades[singlePartKey][singleQ.id]['direct'] = val;
                } else if (totalQuestions === 0) {
                    if (!exGrades['direct']) exGrades['direct'] = {};
                    if (!exGrades['direct']['direct']) exGrades['direct']['direct'] = {};
                    exGrades['direct']['direct']['direct'] = val;
                }
            }
        } else {
            exGrades.mode = 'detail';
            // Sync to global if simple
            if (isSimple) {
                if (!exGrades.final) exGrades.final = {};
                if (!exGrades.final.final) exGrades.final.final = {};
                exGrades.final.final.final = val;
            } else if (!isSimple) {
                // Clear global if NOT simple
                if (exGrades.final && exGrades.final.final && typeof exGrades.final.final.final !== 'undefined') {
                    exGrades.final.final.final = '';
                }
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
        
        // Only clear global grade if NOT a simple exercise
        if (mode === 'detail') {
            const assignment = data.assignments.find(a => a.id === assignmentId);
            const ex = assignment?.exercises.find(e => e.id === exId);
            const directQuestions = ex?.questions || [];
            const parts = ex?.parts || [];
            const totalQuestions = directQuestions.length + parts.reduce((acc, p) => acc + (p.questions ? p.questions.length : 0), 0);
            
            let isSimple = false;
            if (totalQuestions === 0) {
                isSimple = true;
            } else if (totalQuestions === 1) {
                const singleQ = directQuestions[0] || parts[0]?.questions[0];
                if (!(singleQ?.subQuestions && singleQ.subQuestions.length > 0)) {
                    isSimple = true;
                }
            }

            if (!isSimple) {
                if (!exGrades.final) exGrades.final = {};
                if (!exGrades.final.final) exGrades.final.final = {};
                exGrades.final.final.final = '';
            }
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
