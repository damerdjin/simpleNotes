
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

    window.navigateStudent = async function(direction) {
        const studentSelect = document.getElementById('select-student');
        if (!studentSelect || studentSelect.options.length <= 1) return;
        
        let newIndex = studentSelect.selectedIndex + direction;
        
        // Loop back if at ends
        if (newIndex < 1) newIndex = studentSelect.options.length - 1;
        if (newIndex >= studentSelect.options.length) newIndex = 1;
        
        studentSelect.selectedIndex = newIndex;
        window.updateCustomStudentSelectorTrigger();
        await window.loadGradeEntry();
    };

    window.loadGradeSelectors = async function() {
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
            await window.loadGradeEntry();
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

        // Mise à jour de la liste des élèves (Combiner locaux + partagés)
        let localStudents = data.students.filter(s => s.className === selectedClass && (s.importedBy || 'unknown') === userId && (s.academicYear || '') === globalAcademicYear);
        
        // Récupération des élèves partagés depuis Supabase
        let sharedStudents = [];
        if (window.store && typeof window.store.getSharedStudents === 'function') {
            sharedStudents = await window.store.getSharedStudents(selectedClass);
            console.log(`[Grades] Found ${sharedStudents.length} shared students for class ${selectedClass}`);
        }

        // Fusionner les élèves (éviter les doublons par ID ou par Matricule/RegNumber)
        const studentMap = new Map();
        localStudents.forEach(s => studentMap.set(s.id, s));
        sharedStudents.forEach(s => {
            // Un élève est considéré comme le même s'il a le même ID ou le même Matricule
            const existing = Array.from(studentMap.values()).find(ls => ls.id === s.id || (ls.regNumber && ls.regNumber === s.regNumber));
            if (!existing) {
                studentMap.set(s.id, s);
            }
        });
        
        let filteredStudents = Array.from(studentMap.values());
        
        // Filtrer les élèves archivés pour la saisie des notes
        filteredStudents = filteredStudents.filter(s => s.status !== 'archived');
        
        // Store current class students for other functions (like loadGradeEntry)
        window.currentClassStudents = filteredStudents;
        
        // Sort by Last Name then First Name
        filteredStudents.sort((a, b) => {
            const nameA = (a.lastName || a.name || '').toLowerCase();
            const nameB = (b.lastName || b.name || '').toLowerCase();
            
            if (nameA.localeCompare(nameB) !== 0) {
                return nameA.localeCompare(nameB);
            }
            
            const firstA = (a.firstName || '').toLowerCase();
            const firstB = (b.firstName || '').toLowerCase();
            return firstA.localeCompare(firstB);
        });

        studentSelect.innerHTML = `<option value="">-- ${t.selectStudent || 'Sélectionner un élève'} --</option>` +
            filteredStudents.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

        // Tenter de restaurer les sélections si elles sont toujours valides
        if (currentAssignmentId && filteredAssignments.some(a => a.id === currentAssignmentId)) {
            assignmentSelect.value = currentAssignmentId;
        }
        if (currentStudentId && filteredStudents.some(s => s.id === currentStudentId)) {
            studentSelect.value = currentStudentId;
        }

        // Mettre à jour le trigger du sélecteur personnalisé
        window.updateCustomStudentSelectorTrigger();

        // Recharger l'interface de saisie (gère aussi la visibilité du sélecteur d'élève)
        await window.loadGradeEntry();
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
        const color = window.currentClassColor || '#3b82f6';
        
        let qHtml = `
        <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3 transition-all hover:border-[color:var(--theme-color)] hover:bg-[color:var(--theme-color)]/5 group" style="--theme-color: ${color}">
            <div class="flex items-center justify-between">
                <span class="text-sm font-bold text-slate-700">${window.getQuestionDisplayName(assignmentId, exId, q.id, partId)}</span>
                <span class="text-[10px] font-bold px-2 py-0.5 bg-white border border-slate-200 rounded-full text-slate-500 group-hover:border-[color:var(--theme-color)] group-hover:text-[color:var(--theme-color)] transition-colors" id="q-total-${q.id}">0 / ${maxPts}</span>
            </div>`;
        
        if (!q.subQuestions || q.subQuestions.length === 0) {
            const val = qGrades['direct'] || '';
            const isBlocked = window.isTrimesterBlocked(assignment?.trimester, assignment?.academicYear);
            qHtml += `
            <div class="relative ${(mode === 'global' || isBlocked) ? 'opacity-40 grayscale pointer-events-none' : ''}">
                <input type="number" id="grade-direct-${q.id}" name="grade-direct-${q.id}" min="0" max="${q.maxPoints}" step="0.25" value="${val}"
                    ${(mode === 'global' || isBlocked) ? 'disabled' : ''}
                    onchange="updateGrade('${studentId}','${assignmentId}','${exId}','${partKey}','${q.id}','direct',this.value)"
                    onkeydown="if(event.key==='Enter'){ event.stopImmediatePropagation(); this.blur(); window.handleGradeEnter('${exId}'); }"
                    dir="ltr" class="w-full min-w-[80px] p-2.5 bg-white border-2 border-slate-200 rounded-lg text-center font-bold text-slate-700 focus:border-[color:var(--theme-color)] focus:ring-4 focus:ring-[color:var(--theme-color)]/10 outline-none transition-all ${isBlocked ? 'cursor-not-allowed' : ''}" 
                    placeholder="0">
                <div class="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-300 pointer-events-none">/ ${q.maxPoints}</div>
            </div>`;
        } else {
            const isBlocked = window.isTrimesterBlocked(assignment?.trimester, assignment?.academicYear);
            qHtml += `<div class="grid grid-cols-2 gap-2">`;
            qHtml += q.subQuestions.map(sq => {
                const val = qGrades[sq.id] || '';
                return `
                <div class="space-y-1 ${(mode === 'global' || isBlocked) ? 'opacity-40 grayscale pointer-events-none' : ''}">
                    <div class="flex justify-between px-1">
                        <span class="text-[10px] font-bold text-slate-500 uppercase">${window.getSubQuestionLetter(q, sq.id)})</span>
                        <span class="text-[10px] font-bold text-slate-400">/${sq.maxPoints}</span>
                    </div>
                    <input type="number" id="grade-sq-${sq.id}" name="grade-sq-${sq.id}" min="0" max="${sq.maxPoints}" step="0.25" value="${val}"
                        ${(mode === 'global' || isBlocked) ? 'disabled' : ''}
                        onchange="updateGrade('${studentId}','${assignmentId}','${exId}','${partKey}','${q.id}','${sq.id}',this.value)"
                        onkeydown="if(event.key==='Enter'){ event.stopImmediatePropagation(); this.blur(); window.handleGradeEnter('${exId}'); }"
                        dir="ltr" class="w-full p-2 bg-white border-2 border-slate-200 rounded-lg text-center font-bold text-slate-700 focus:border-[color:var(--theme-color)] focus:ring-4 focus:ring-[color:var(--theme-color)]/10 outline-none transition-all text-xs ${isBlocked ? 'cursor-not-allowed' : ''}"
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

            // Focus student selector to allow arrow key navigation
            const studentSelect = document.getElementById('select-student');
            if (studentSelect) {
                studentSelect.focus();
            }
        } else {
            content.style.maxHeight = '2000px';
            content.style.opacity = '1';
            content.style.visibility = 'visible';
            if (icon) icon.classList.add('rotate-180');

            // Focus first input
            setTimeout(() => {
                const firstInput = content.querySelector('input:not([disabled])');
                if (firstInput) {
                    firstInput.focus();
                    firstInput.select(); // Select content for easier editing
                }
            }, 350); // Wait for transition
        }
    };

    window.loadGradeEntry = async function() {
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
        
        // Find student in current class list (merged local + shared)
        const student = (window.currentClassStudents || []).find(s => s.id === studentId) || data.students.find(s => s.id === studentId);
        
        if (!student) {
            console.error('[Grades] Student not found:', studentId);
            return;
        }
        
        if (!data.grades[studentId]) data.grades[studentId] = {};
        if (!data.grades[studentId][assignmentId]) data.grades[studentId][assignmentId] = {};

        const svc = gradesSvc();
        const maxAssignmentPoints = svc.getAssignmentMaxPoints(assignment);
        const color = window.currentClassColor || '#3b82f6';
        const isAr = getLang() === 'ar';
        const bgIconPos = isAr ? 'left-0' : 'right-0';

        // On vérifie l'historique pour afficher ou non le bouton Undo
        const hasHistory = await window.historyService?.hasHistory(studentId, assignmentId);

        // Student Header Card (Optimized for Mobile & RTL)
        let html = `
        <div class="rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 text-white shadow-lg relative overflow-hidden" style="background-color: ${color}">
            <div class="absolute top-0 ${bgIconPos} p-2 sm:p-4 opacity-10">
                <svg class="w-16 h-16 sm:w-20 sm:h-20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
            </div>
            <div class="relative z-10 flex flex-col gap-4">
                <div class="flex flex-col gap-2 w-full text-center sm:text-start">
                    <h3 class="text-xl sm:text-3xl font-black leading-tight break-words" title="${student.name}">${student.name}</h3>
                    <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2 opacity-90">
                        <span class="text-xs sm:text-sm font-bold bg-black/10 px-3 py-1 rounded-full break-words max-w-full">${assignment.name}</span>
                        ${hasHistory ? `
                            <button onclick="undoLastGrade('${studentId}', '${assignmentId}')" class="p-1 px-3 bg-white/20 hover:bg-white/40 rounded-lg transition-all flex items-center gap-1.5 text-[10px] sm:text-xs font-bold shadow-sm" title="${t.undo || 'Annuler'}">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                                ${t.undo || 'Annuler'}
                            </button>
                        ` : ''}
                    </div>
                </div>
                <div class="bg-white/15 backdrop-blur-md rounded-xl px-4 py-3 border border-white/25 flex items-center justify-between w-full shadow-inner">
                    <span class="text-[10px] sm:text-xs font-black uppercase tracking-widest opacity-80 whitespace-nowrap">${t.total || 'Total'}</span>
                    <div class="flex items-baseline gap-1" dir="ltr">
                        <span id="grade-total" class="text-3xl sm:text-4xl font-black text-white">0</span>
                        <span class="text-sm sm:text-base font-bold text-white/70">/ ${maxAssignmentPoints}</span>
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
                <div class="bg-white border-2 border-slate-100 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 transition-all hover:border-[color:var(--theme-color)] group overflow-hidden" style="--theme-color: ${color}">
                    <div class="flex items-center gap-4 w-full">
                        <div class="w-12 h-12 sm:w-16 sm:h-16 bg-[color:var(--theme-color)] text-white rounded-xl sm:rounded-2xl flex items-center justify-center text-xl sm:text-3xl font-black shadow-md shrink-0">
                            <svg class="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        </div>
                        <div class="min-w-0 flex-1">
                            <h3 class="text-lg sm:text-2xl font-black text-slate-800 tracking-tight leading-tight truncate sm:whitespace-normal">${displayName}</h3>
                            <p class="text-[10px] sm:text-sm text-slate-500 font-bold uppercase tracking-wide line-clamp-2">${displaySubName}</p>
                        </div>
                    </div>
                    
                    <div class="w-full md:w-64 shrink-0 mt-2 md:mt-0">
                        <div class="relative w-full">
                            <input type="number" id="grade-simple-${qId}" name="grade-simple-${qId}" inputmode="decimal" min="0" max="${maxPts}" step="0.25" value="${val}"
                                ${window.isTrimesterBlocked(assignment.trimester, assignment.academicYear) ? 'disabled' : ''}
                                onchange="updateGrade('${studentId}','${assignmentId}','${ex.id}','${partKey}','${qId}','direct',this.value)"
                                onkeydown="if(event.key==='Enter'){ event.stopImmediatePropagation(); this.blur(); window.handleGradeEnter('${ex.id}'); }"
                                dir="ltr" class="w-full py-3 sm:py-5 bg-slate-50 border-2 border-slate-200 rounded-xl sm:rounded-2xl text-center font-black text-slate-800 text-3xl sm:text-4xl focus:border-[color:var(--theme-color)] focus:bg-white focus:ring-4 focus:ring-[color:var(--theme-color)]/10 outline-none transition-all shadow-inner ${window.isTrimesterBlocked(assignment.trimester, assignment.academicYear) ? 'cursor-not-allowed' : ''}" 
                                placeholder="0">
                            <div class="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 text-xs sm:text-lg font-black text-slate-300 pointer-events-none">/ ${maxPts}</div>
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
                
                const totalQuestions = directQuestions.length + parts.reduce((acc, p) => acc + (p.questions ? p.questions.length : 0), 0);
                
                // Detect Single Simple Question
                let isSingleSimpleQuestion = false;
                let singleSimpleQVal = '';
                if (totalQuestions === 1) {
                    const singleQ = directQuestions[0] || parts[0]?.questions[0];
                    if (singleQ && (!singleQ.subQuestions || singleQ.subQuestions.length === 0)) {
                        isSingleSimpleQuestion = true;
                        // Get value if final is empty
                        if (finalGradeCur === '') {
                             const pKey = directQuestions[0] ? 'direct' : parts[0].id;
                             singleSimpleQVal = exGradesCur[pKey]?.[singleQ.id]?.['direct'] || '';
                        }
                    }
                }

                // Show switcher only if >0 questions AND not a single simple question
                const showSwitcher = totalQuestions > 0 && !isSingleSimpleQuestion;
                
                // Exercise Card
                let exHtml = `
                <div class="group border border-slate-200 rounded-2xl overflow-hidden bg-white hover:shadow-xl hover:border-[color:var(--theme-color)] transition-all duration-300 mb-4" style="--theme-color: ${color}">
                    <!-- Header Section -->
                    <div class="p-4 sm:p-5 flex items-center justify-between cursor-pointer select-none bg-gradient-to-r from-white to-slate-50/50" onclick="window.toggleAccordion('${accordionId}')">
                        <div class="flex items-center gap-3 sm:gap-4 min-w-0">
                            <div class="w-8 h-8 sm:w-10 sm:h-10 bg-[color:var(--theme-color)] text-white rounded-xl flex items-center justify-center font-black shadow-lg shadow-[color:var(--theme-color)]/30 group-hover:scale-110 transition-transform duration-300 shrink-0">
                                ${exIndex + 1}
                            </div>
                            <div class="min-w-0">
                                <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                    <h3 class="font-black text-slate-800 tracking-tight truncate text-sm sm:text-base">${ex.name ? (ex.name === 'Global' ? t.globalMode : ex.name) : (t.exercise || 'Exercice') + ' ' + (exIndex + 1)}</h3>
                                    <span class="inline-flex w-fit px-2 py-0.5 bg-[color:var(--theme-color)]/10 text-[color:var(--theme-color)] text-[9px] sm:text-[10px] font-black rounded-full border border-[color:var(--theme-color)]/20 uppercase tracking-wider">${maxExPoints} ${t.pointsAbbr || 'pts'}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="flex items-center gap-2 sm:gap-3">
                            <span id="ex-total-${ex.id}" class="px-2 sm:px-4 py-1 sm:py-1.5 bg-[color:var(--theme-color)]/10 text-[color:var(--theme-color)] font-black rounded-lg sm:rounded-xl text-[10px] sm:text-sm border border-[color:var(--theme-color)]/20 shadow-sm whitespace-nowrap">
                                0
                            </span>
                            <div id="icon-${accordionId}" class="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-[color:var(--theme-color)] group-hover:text-white group-hover:border-[color:var(--theme-color)] transition-all duration-500 shadow-sm shrink-0">
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
                                <div class="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto border-t border-slate-200 sm:border-0 pt-3 sm:pt-0 mt-1 sm:mt-0 flex-1 min-w-0 ${modeCur === 'detail' ? 'opacity-40 grayscale pointer-events-none' : ''}">
                                    <span class="text-[11px] font-bold text-slate-500 uppercase tracking-tight truncate mr-2 sm:mr-0 flex-1 min-w-0">${t.globalGrade || 'Note globale'} :</span>
                                    <div class="shrink-0">
                                        <input type="number" id="grade-global-${ex.id}" name="grade-global-${ex.id}" min="0" max="${maxExExPoints}" step="0.25" value="${finalGradeCur}"
                                            ${(modeCur === 'detail' || window.isTrimesterBlocked(assignment.trimester, assignment.academicYear)) ? 'disabled' : ''}
                                            onchange="updateGrade('${studentId}','${assignmentId}','${ex.id}','final','final','final',this.value)"
                                            onkeydown="if(event.key==='Enter'){ event.stopImmediatePropagation(); this.blur(); window.handleGradeEnter('${ex.id}'); }"
                                            dir="ltr" class="w-28 min-w-[110px] p-2 bg-white border-2 border-amber-200 rounded-xl text-center font-black text-slate-700 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all text-sm ${(modeCur === 'detail' || window.isTrimesterBlocked(assignment.trimester, assignment.academicYear)) ? 'cursor-not-allowed' : ''}" 
                                            placeholder="0" onclick="event.stopPropagation()">
                                    </div>
                                </div>
                            </div>`;
                } else if (isSingleSimpleQuestion) {
                     // Single Simple Question - Simplified Global View
                     const displayVal = finalGradeCur !== '' ? finalGradeCur : singleSimpleQVal;
                     exHtml += `
                            <div class="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
                                <div class="flex items-center gap-3 w-full sm:w-auto flex-1 min-w-0">
                                     <div class="w-8 h-8 shrink-0 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                                         <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                     </div>
                                     <span class="text-xs font-bold text-blue-900 break-words">${t.globalGrade || 'Note globale'}</span>
                                </div>
                                <div class="flex items-center gap-3 w-full sm:w-auto shrink-0">
                                    <div class="w-full sm:w-32">
                                        <input type="number" id="grade-single-simple-${ex.id}" name="grade-single-simple-${ex.id}" min="0" max="${maxExPoints}" step="0.25" value="${displayVal}"
                                            ${window.isTrimesterBlocked(assignment.trimester, assignment.academicYear) ? 'disabled' : ''}
                                            onchange="updateGrade('${studentId}','${assignmentId}','${ex.id}','final','final','final',this.value)"
                                            onkeydown="if(event.key==='Enter'){ event.stopImmediatePropagation(); this.blur(); window.handleGradeEnter('${ex.id}'); }"
                                            dir="ltr" class="w-full p-2.5 bg-white border-2 border-blue-200 rounded-xl text-center font-black text-blue-900 focus:border-blue-500 outline-none transition-all shadow-sm text-sm ${window.isTrimesterBlocked(assignment.trimester, assignment.academicYear) ? 'cursor-not-allowed' : ''}" 
                                            placeholder="0">
                                    </div>
                                </div>
                            </div>`;
                }
                
                if (directQuestions.length === 0 && parts.length === 0) {
                    const val = data.grades[studentId][assignmentId][ex.id]?.['direct']?.['direct']?.['direct'] || '';
                    exHtml += `
                            <div class="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
                                <div class="flex items-center gap-3 w-full sm:w-auto flex-1 min-w-0">
                                    <div class="w-8 h-8 shrink-0 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    </div>
                                    <span class="text-xs font-bold text-blue-900 break-words">${t.grade || 'Note'}</span>
                                </div>
                                <div class="flex items-center gap-3 w-full sm:w-auto shrink-0">
                                    <div class="w-full sm:w-32">
                                        <input type="number" id="grade-no-q-${ex.id}" name="grade-no-q-${ex.id}" min="0" max="${ex.maxPoints}" step="0.25" value="${val}"
                                            ${window.isTrimesterBlocked(assignment.trimester, assignment.academicYear) ? 'disabled' : ''}
                                            onchange="updateGrade('${studentId}','${assignmentId}','${ex.id}','direct','direct','direct',this.value)"
                                            onkeydown="if(event.key==='Enter'){ event.stopImmediatePropagation(); this.blur(); window.handleGradeEnter('${ex.id}'); }"
                                            dir="ltr" class="w-full p-2.5 bg-white border-2 border-blue-200 rounded-xl text-center font-black text-blue-900 focus:border-blue-500 outline-none transition-all shadow-sm text-sm ${window.isTrimesterBlocked(assignment.trimester, assignment.academicYear) ? 'cursor-not-allowed' : ''}" 
                                            placeholder="0">
                                    </div>
                                </div>
                            </div>`;
                } else if (!isSingleSimpleQuestion) {
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

        // Auto-focus sur le premier champ de saisie
        const firstInput = container.querySelector('input:not([disabled])');
        if (firstInput) {
            firstInput.focus();
            firstInput.select();
        }
    };

    window.undoLastGrade = async function(studentId, assignmentId) {
        if (!window.historyService) return;
        
        const data = getData();
        const assignment = data.assignments.find(a => a.id === assignmentId);
        if (window.isTrimesterBlocked(assignment?.trimester, assignment?.academicYear)) {
            const t = getTranslations()[getLang()];
            if (window.showToast) window.showToast(t.trimesterLockedAlert, 'error');
            return;
        }

        const prevState = await window.historyService.popState(studentId, assignmentId);
        if (prevState) {
            const data = getData();
            data.grades[studentId][assignmentId] = prevState;
            saveData();
            await window.loadGradeEntry();
            
            // Notification
            const t = getTranslations()[getLang()];
            if (window.showToast) {
                window.showToast(t.gradeUndone || 'Saisie annulée !', 'success');
            }
        }
    };

    window.updateGrade = function(studentId, assignmentId, exId, partKey, qId, sqId, value) {
        const data = getData();
        const assignment = data.assignments.find(a => a.id === assignmentId);

        // Security check
        if (window.isTrimesterBlocked(assignment?.trimester, assignment?.academicYear)) {
            const t = getTranslations()[getLang()];
            if (window.showToast) window.showToast(t.trimesterLockedAlert, 'error');
            return;
        }
        
        // --- History Support ---
        if (window.historyService) {
            const currentGrades = data.grades[studentId]?.[assignmentId];
            if (currentGrades) {
                window.historyService.pushState(studentId, assignmentId, currentGrades);
            }
        }
        
        if (!data.grades[studentId]) data.grades[studentId] = {};
        if (!data.grades[studentId][assignmentId]) data.grades[studentId][assignmentId] = {};
        if (!data.grades[studentId][assignmentId][exId]) data.grades[studentId][assignmentId][exId] = {};
        if (!data.grades[studentId][assignmentId][exId][partKey]) data.grades[studentId][assignmentId][exId][partKey] = {};
        if (!data.grades[studentId][assignmentId][exId][partKey][qId]) data.grades[studentId][assignmentId][exId][partKey][qId] = {};
        
        if (value === '' || value === null || value === undefined) {
            data.grades[studentId][assignmentId][exId][partKey][qId][sqId] = '';
        } else {
            data.grades[studentId][assignmentId][exId][partKey][qId][sqId] = parseFloat(value);
        }
        
        const val = data.grades[studentId][assignmentId][exId][partKey][qId][sqId];
        
        const exGrades = data.grades[studentId][assignmentId][exId];
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
        window.updateCustomStudentSelectorTrigger();
    };

    window.setExerciseMode = async function(studentId, assignmentId, exId, mode) {
        const data = getData();
        const assignment = data.assignments.find(a => a.id === assignmentId);
        
        // Security check
        if (window.isTrimesterBlocked(assignment?.trimester, assignment?.academicYear)) {
            const t = getTranslations()[getLang()];
            if (window.showToast) window.showToast(t.trimesterLockedAlert, 'error');
            return;
        }

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
        await window.loadGradeEntry();
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
            
            // Check if exercise has NO grades at all (truly empty)
            let isTrulyEmpty = true;
            if (finalGrade !== undefined && finalGrade !== '') {
                isTrulyEmpty = false;
                exTotal = parseFloat(finalGrade) || 0;
            } else if (directQuestions.length === 0 && parts.length === 0) {
                const directVal = exGrades['direct']?.['direct']?.['direct'];
                if (directVal !== undefined && directVal !== '') {
                    isTrulyEmpty = false;
                    exTotal = parseFloat(directVal) || 0;
                }
            } else {
                // Check detailed grades
                for (const q of directQuestions) {
                    let qTotal = 0;
                    const qGrades = exGrades['direct']?.[q.id] || {};
                    if (!q.subQuestions || q.subQuestions.length === 0) {
                        const qVal = qGrades['direct'];
                        if (qVal !== undefined && qVal !== '') {
                            isTrulyEmpty = false;
                            qTotal = parseFloat(qVal) || 0;
                        }
                    } else {
                        for (const sq of q.subQuestions) {
                            const sqVal = qGrades[sq.id];
                            if (sqVal !== undefined && sqVal !== '') {
                                isTrulyEmpty = false;
                                qTotal += parseFloat(sqVal) || 0;
                            }
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
                            const qVal = qGrades['direct'];
                            if (qVal !== undefined && qVal !== '') {
                                isTrulyEmpty = false;
                                qTotal = parseFloat(qVal) || 0;
                            }
                        } else {
                            for (const sq of q.subQuestions) {
                                const sqVal = qGrades[sq.id];
                                if (sqVal !== undefined && sqVal !== '') {
                                    isTrulyEmpty = false;
                                    qTotal += parseFloat(sqVal) || 0;
                                }
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
                if (isTrulyEmpty) {
                    exEl.textContent = '--';
                    exEl.className = `text-slate-400 font-medium bg-slate-50 px-3 py-1 rounded-full border border-dashed border-slate-200 text-sm`;
                } else {
                    exEl.textContent = exTotal;
                    const isGlobal = finalGrade !== undefined && finalGrade !== '';
                    exEl.className = `text-blue-700 font-bold ${isGlobal ? 'bg-yellow-100' : 'bg-white'} px-3 py-1 rounded-full shadow-sm text-sm`;
                }
            }
            if (!isTrulyEmpty) grandTotal += exTotal;
        }
        
        const totalEl = document.getElementById('grade-total');
        if (totalEl) {
            // Priority: if no exercise has a grade, use the global assignment grade if it exists
            let finalDisplayTotal = grandTotal;
            if (grandTotal === 0 && studentGrades.global !== undefined && studentGrades.global !== '') {
                finalDisplayTotal = parseFloat(studentGrades.global) || 0;
            }
            totalEl.textContent = finalDisplayTotal;
        }
        
        // If we have any exercise grades, update the global assignment total
        // but ONLY if there are exercises defined.
        if (assignment.exercises && assignment.exercises.length > 0) {
            let hasAnyGrade = false;
            for (const ex of assignment.exercises) {
                if (window.hasAnyGradeForExercise(studentGrades, ex)) {
                    hasAnyGrade = true;
                    break;
                }
            }
            if (hasAnyGrade) {
                studentGrades.global = grandTotal;
            }
        }
    };

    // Proxies for compatibility with other modules (e.g. summary.js)
    window.getExerciseMaxPoints = (ex) => gradesSvc().getExerciseMaxPoints(ex);
    window.getAssignmentMaxPoints = (assignment) => gradesSvc().getAssignmentMaxPoints(assignment);
    window.hasAnyGradeForExercise = (studentGrades, ex) => gradesSvc().hasAnyGradeForExercise(studentGrades, ex);
    window.hasAnyGradeForAssignment = (studentId, assignmentId) => gradesSvc().hasAnyGradeForAssignment(getData(), studentId, assignmentId);
    window.getStudentAssignmentTotal = (studentId, assignmentId) => gradesSvc().getStudentAssignmentTotal(getData(), studentId, assignmentId);
    window.getStudentExerciseTotal = (studentGrades, ex) => gradesSvc().getStudentExerciseTotal(studentGrades, ex);
    window.isExerciseFullyGraded = (studentGrades, ex) => gradesSvc().isExerciseFullyGraded(studentGrades, ex);

    // --- Exercise Total Confirmation Dialog ---

    window.handleGradeEnter = function(exId) {
        const studentId = document.getElementById('select-student').value;
        const assignmentId = document.getElementById('select-assignment').value;
        const data = getData();
        const assignment = data.assignments.find(a => a.id === assignmentId);

        if (!assignment || !exId) {
            window.openStudentSelector();
            return;
        }

        const studentGrades = data.grades[studentId]?.[assignmentId] || {};
        const isMultiExercise = assignment.exercises.length > 1;

        if (isMultiExercise) {
            const allExercisesGraded = assignment.exercises.every(ex => {
                return window.isExerciseFullyGraded(studentGrades, ex);
            });

            if (allExercisesGraded) {
                window.showAssignmentTotalConfirm(studentId, assignmentId);
                return;
            }
        }

        window.openStudentSelector();
    };

    window.showAssignmentTotalConfirm = function(studentId, assignmentId) {
        const data = getData();
        const t = getTranslations()[getLang()];
        const student = (window.currentClassStudents || []).find(s => s.id === studentId);
        const assignment = data.assignments.find(a => a.id === assignmentId);
        const svc = gradesSvc();
        const maxPts = svc.getAssignmentMaxPoints(assignment);
        const calculatedTotal = svc.getStudentAssignmentTotal(data, studentId, assignmentId);
        const color = window.currentClassColor || '#3b82f6';

        const modal = document.getElementById('exercise-total-modal');
        if (!modal) return;

        const content = modal.querySelector('.modal-content');
        if (!content) return;

        // Store the current studentId and assignmentId for keyboard handlers
        modal.dataset.studentId = studentId;
        modal.dataset.assignmentId = assignmentId;

        content.innerHTML = `
            <div class="p-6 sm:p-8">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg shrink-0" style="background-color: ${color}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
                    </div>
                    <div class="min-w-0">
                        <h3 class="font-black text-slate-800 text-base sm:text-lg truncate">${assignment.name}</h3>
                        <p class="text-xs text-slate-500 font-bold truncate">${student ? student.name : ''}</p>
                    </div>
                </div>

                <div class="bg-slate-50 rounded-2xl p-5 border border-slate-200 text-center mb-6">
                    <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">${t.assignmentTotal || 'Total du devoir'}</div>
                    <div class="flex items-baseline justify-center gap-2" dir="ltr">
                        <span class="text-5xl sm:text-6xl font-black text-slate-800">${calculatedTotal}</span>
                        <span class="text-xl sm:text-2xl font-bold text-slate-400">/ ${maxPts}</span>
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    <button onclick="window.closeExerciseTotalConfirm()" class="flex-1 py-3.5 rounded-2xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all text-sm">
                        ${t.skip || 'Revenir'}
                    </button>
                    <button onclick="window.confirmAssignmentTotal('${studentId}','${assignmentId}')" class="flex-1 py-3.5 rounded-2xl font-bold text-white transition-all text-sm shadow-lg" style="background-color: ${color}">
                        ${t.confirm || 'Confirmer'}
                    </button>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    };

    window.confirmAssignmentTotal = function(studentId, assignmentId) {
        const data = getData();
        const svc = gradesSvc();
        const calculatedTotal = svc.getStudentAssignmentTotal(data, studentId, assignmentId);

        if (!data.grades[studentId]) data.grades[studentId] = {};
        if (!data.grades[studentId][assignmentId]) data.grades[studentId][assignmentId] = {};

        data.grades[studentId][assignmentId].global = calculatedTotal;
        saveData();
        window.recalculateTotals(assignmentId, studentId);

        window.closeExerciseTotalConfirm();
        window.openStudentSelector();
    };

    window.closeExerciseTotalConfirm = function() {
        const modal = document.getElementById('exercise-total-modal');
        if (modal) modal.classList.add('hidden');
        document.body.style.overflow = '';
    };

    // --- New 3-Step Flow Logic ---

    window.goToGradeStep = async function(step) {
        window.currentGradeStep = step;
        
        // Determine theme color
        let themeColor = '#2563eb'; // Default blue-600
        if (step > 1 && window.currentClassColor) {
            themeColor = window.currentClassColor;
        }

        // Update Stepper UI
        for (let i = 1; i <= 3; i++) {
            const ind = document.getElementById('step-indicator-' + i);
            const label = document.getElementById('step-label-' + i);
            const btn = document.getElementById('step-btn-' + i); 
            
            if (!ind || !label) continue;

            // Reset inline styles
            ind.style.backgroundColor = '';
            ind.style.color = '';
            label.style.color = '';

            if (i < step) {
                // Completed
                ind.classList.remove('bg-white', 'text-slate-400', 'border-2', 'border-slate-200', 'bg-blue-600');
                ind.classList.add('text-white');
                ind.style.backgroundColor = themeColor;
                
                ind.innerHTML = '✓';
                
                label.classList.remove('text-blue-600');
                label.style.color = themeColor;
                
                if (btn) btn.classList.remove('pointer-events-none', 'opacity-50');
            } else if (i === step) {
                // Current
                ind.classList.remove('bg-white', 'text-slate-400', 'border-2', 'border-slate-200', 'bg-blue-600');
                ind.classList.add('text-white');
                ind.style.backgroundColor = themeColor;
                
                ind.innerHTML = i;
                
                label.classList.remove('text-blue-600');
                label.style.color = themeColor;
                
                if (btn) btn.classList.remove('pointer-events-none', 'opacity-50');
            } else {
                // Future
                ind.classList.add('bg-white', 'text-slate-400', 'border-2', 'border-slate-200');
                ind.classList.remove('bg-blue-600', 'text-white');
                ind.style.backgroundColor = '';
                
                ind.innerHTML = i;
                label.classList.remove('text-blue-600');
                
                if (btn) btn.classList.add('pointer-events-none', 'opacity-50');
            }
        }
        
        // Update Connectors
        const c1 = document.getElementById('step-connector-1');
        const c2 = document.getElementById('step-connector-2');
        if (c1) {
            c1.style.backgroundColor = themeColor;
            // Use width for RTL compatibility
            if (step >= 2) c1.style.width = '100%';
            else c1.style.width = '0%';
        }
        if (c2) {
            c2.style.backgroundColor = themeColor;
            // Use width for RTL compatibility
            if (step >= 3) c2.style.width = '100%';
            else c2.style.width = '0%';
        }

        // Show/Hide Content
        document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));
        const target = document.getElementById('grade-step-' + step);
        if (target) target.classList.remove('hidden');

        // Update Back Buttons Dynamic Hover
        const btnBack2 = document.getElementById('btn-back-step-2');
        if (btnBack2) {
            const iconDiv = btnBack2.querySelector('div');
            const lightColor = themeColor + '15'; 
            
            // Remove old event listeners by cloning (simple trick) or just reassigning on* props
            btnBack2.onmouseover = () => {
                btnBack2.style.color = themeColor;
                if(iconDiv) iconDiv.style.backgroundColor = lightColor;
            };
            btnBack2.onmouseout = () => {
                btnBack2.style.color = '';
                if(iconDiv) iconDiv.style.backgroundColor = '';
            };
        }

        const btnBack3 = document.getElementById('btn-back-step-3');
        if (btnBack3) {
            const lightColor = themeColor + '15';
            const borderColor = themeColor + '30';
             btnBack3.onmouseover = () => {
                btnBack3.style.color = themeColor;
                btnBack3.style.backgroundColor = lightColor;
                btnBack3.style.borderColor = borderColor;
            };
            btnBack3.onmouseout = () => {
                btnBack3.style.color = '';
                btnBack3.style.backgroundColor = '';
                btnBack3.style.borderColor = '';
            };
        }

        // Load content if needed
        if (step === 1) await window.renderGradesClassList();
        if (step === 2) {
            const classSelect = document.getElementById('select-class-grades');
            if (classSelect && classSelect.value) {
                window.renderGradesAssignmentList(classSelect.value);
            }
        }
        if (step === 3) await window.loadGradeEntry();
    };

    window.renderGradesClassList = async function() {
        const t = getTranslations()[getLang()];
        const isAr = getLang() === 'ar';
        const container = document.getElementById('grades-class-list');
        if (!container) return;

        const globalAcademicYear = window.getGlobalAcademicYear();
        if (!globalAcademicYear) {
            container.innerHTML = `<div class="col-span-full text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <p class="text-slate-500 font-medium">${t.selectAcademicYear}</p>
            </div>`;
            return;
        }

        const classes = window.getClasses ? await window.getClasses() : [];
        const userId = window.currentUser?.email || window.currentUser?.id || 'unknown';

        // 1. Get Shared Class Stats
        let sharedStats = {};
        if (window.store && typeof window.store.getSharedClassStats === 'function') {
            sharedStats = await window.store.getSharedClassStats();
        }

        if (classes.length === 0) {
             container.innerHTML = `<div class="col-span-full text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <p class="text-slate-500 font-medium">${t.noClassesAutoCreated}</p>
            </div>`;
            return;
        }

        const rows = classes.map(c => {
            // Count local students
            const localStudents = getData().students.filter(s => s.className === c && (s.importedBy || 'unknown') === userId && (s.academicYear || '') === globalAcademicYear);
            
            // Total students = Max of Local or Shared
            const sharedStatValue = sharedStats[c];
            const sharedTotal = typeof sharedStatValue === 'number'
                ? sharedStatValue
                : (sharedStatValue && typeof sharedStatValue.total === 'number' ? sharedStatValue.total : 0);
            const count = Math.max(localStudents.length, sharedTotal);
            
            const color = typeof window.getClassColor === 'function' ? window.getClassColor(c) : '#3b82f6';
            const colorAlpha = color + '44'; 
            
            // Use shared helpers for level icon (1, 2, 3) and clean name
            const levelIcon = typeof window.levelFromClass === 'function' ? window.levelFromClass(c) : c.substring(0, 1).toUpperCase();
            const displayName = typeof window.cleanClassName === 'function' ? window.cleanClassName(c) : c;

            // Arabic Pluralization
            let countTextDesktop = `${count} ${t.studentsCountLabel || 'élèves'}`;
            if (isAr) {
                if (count === 0) countTextDesktop = 'لا يوجد طلاب';
                else if (count === 1) countTextDesktop = 'طالب واحد';
                else if (count === 2) countTextDesktop = 'طالبان';
                else if (count <= 10) countTextDesktop = `${count} طلاب`;
                else countTextDesktop = `${count} طالباً`;
            }
            const countLabel = `<span class="sm:hidden font-black text-xs">${count}</span><span class="hidden sm:inline">${countTextDesktop}</span>`;

            // LOGIQUE DE TAILLE DE POLICE DYNAMIQUE
            const cleanedName = typeof window.cleanClassName === 'function' ? window.cleanClassName(c) : c;
            let fontSizeClass = isAr ? 'text-[13px] sm:text-2xl' : 'text-sm sm:text-2xl';
            if (cleanedName.length > 25) fontSizeClass = 'text-[10px] sm:text-lg leading-tight';
            else if (cleanedName.length > 15) fontSizeClass = 'text-xs sm:text-xl leading-snug';

            const titleClass = isAr ? `${fontSizeClass} font-bold leading-normal` : `${fontSizeClass} font-black leading-tight tracking-tight`;
            const flexColFix = 'display: flex !important; flex-direction: column !important;';
            const flexRowFix = 'display: flex !important; flex-direction: row !important;';

            // Count assignments for this class in current trimester/year
            const classAssignments = getData().assignments.filter(a => 
                a.className === c && 
                (a.createdBy || 'unknown') === userId && 
                (a.academicYear || '') === globalAcademicYear &&
                (a.trimester || '') === window.getGlobalTrimester()
            );
            const hasAssignments = classAssignments.length > 0;

            return `
                <div onclick="${hasAssignments ? `selectGradeClass('${c}', '${color}')` : `window.openAssignmentModal(null, '${c}')`}" 
                    class="class-card-modern group relative bg-white p-3 sm:p-6 rounded-2xl sm:rounded-[2rem] border-2 transition-all duration-500 cursor-pointer overflow-hidden flex flex-col h-full hover:-translate-y-2 hover:shadow-xl hover:border-[color:var(--card-color)]"
                    style="--card-color: ${color}; --card-color-alpha: ${colorAlpha};">
                    
                    <!-- Decorative background blob -->
                    <div class="absolute -start-8 -top-8 w-32 h-32 rounded-full opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-700 group-hover:scale-150" style="background: ${color}"></div>
                    
                    <div class="relative z-10 flex flex-col h-full" style="${flexColFix}">
                        <div class="flex items-start justify-between mb-2 sm:mb-6" style="${flexRowFix}">
                            <div class="flex flex-col gap-1.5">
                                <span class="inline-flex items-center px-2 py-0.5 sm:px-3 sm:py-1 bg-slate-50 text-slate-500 rounded-full text-[9px] sm:text-[10px] font-bold border border-slate-100 group-hover:bg-[var(--card-color)] group-hover:text-white group-hover:border-transparent transition-all duration-300">
                                    ${countLabel}
                                </span>
                                <!-- Année scolaire (PC uniquement) -->
                                <span class="hidden sm:inline-flex items-center px-3 py-1 bg-blue-50/50 text-blue-600/70 rounded-full text-[10px] font-bold border border-blue-100/30 group-hover:bg-white/20 group-hover:text-white group-hover:border-transparent transition-all duration-300">
                                    ${globalAcademicYear}
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
                            
                            ${!hasAssignments ? `
                            <div class="mt-4 sm:mt-6">
                                <div class="w-full py-2 sm:py-3.5 bg-[color:var(--card-color)] text-white font-black rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-[color:var(--card-color)]/30 group-hover:scale-105 active:scale-95 transition-all duration-300 text-xs sm:text-sm">
                                    <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
                                    ${t.createAssignmentTitle || 'Créer un Devoir'}
                                </div>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = rows;
    };

    window.selectGradeClass = async function(className, color) {
        // Store color for next steps
        window.currentClassColor = color || '#3b82f6';

        const classSelect = document.getElementById('select-class-grades');
        if (classSelect) {
            let found = false;
            for(let i=0; i<classSelect.options.length; i++) {
                if(classSelect.options[i].value === className) {
                    classSelect.selectedIndex = i;
                    found = true;
                    break;
                }
            }
            if(!found) {
                const opt = document.createElement('option');
                opt.value = className;
                opt.textContent = className;
                classSelect.appendChild(opt);
                classSelect.value = className;
            }
        }

        // Trigger loading and move to step 2
        await window.loadGradeSelectors();
        await window.goToGradeStep(2);
    };

    window.renderGradesAssignmentList = function(className) {
        const t = getTranslations()[getLang()];
        const container = document.getElementById('grades-assignment-list');
        const data = getData();
        const userId = window.currentUser?.email || window.currentUser?.id || 'unknown';
        const globalAcademicYear = window.getGlobalAcademicYear();
        const globalTrimester = window.getGlobalTrimester();
        
        const color = window.currentClassColor || '#3b82f6';
        const colorLight = color + '15'; // Low opacity for backgrounds

        const assignments = data.assignments.filter(a => {
            const matchClass = a.className === className;
            const matchUser = (a.createdBy || 'unknown') === userId;
            const matchAcademicYear = globalAcademicYear ? (a.academicYear || '') === globalAcademicYear : false;
            const matchTrimester = globalTrimester ? (a.trimester || '') === globalTrimester : false;
            return matchClass && matchUser && matchAcademicYear && matchTrimester;
        });

        if (assignments.length === 0) {
             container.innerHTML = `<div class="col-span-full text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <p class="text-slate-500 font-medium">${t.noAssignmentsFound || 'Aucun devoir trouvé'}</p>
            </div>`;
            return;
        }


        container.innerHTML = assignments.map(a => {
            const dateStr = a.gradeDate ? new Date(a.gradeDate).toLocaleDateString(getLang() === 'ar' ? 'ar-u-nu-latn' : 'fr-FR') : '';
            const exerciseCount = a.exercises.length;
            const totalPoints = gradesSvc().getAssignmentMaxPoints(a);

            // Dynamic font size based on name length to fit on one line
            let nameFontClass = 'text-sm sm:text-xl';
            if (a.name.length > 20) nameFontClass = 'text-[11px] sm:text-sm';
            else if (a.name.length > 12) nameFontClass = 'text-xs sm:text-base';

            return `
            <div onclick="selectGradeAssignment('${a.id}')" 
                class="group relative bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] border border-slate-200 hover:border-[color:var(--theme-color)] transition-all duration-300 cursor-pointer overflow-hidden hover:shadow-xl hover:-translate-y-1 flex flex-col"
                style="--theme-color: ${color}">
                
                <!-- Accent top bar - always visible -->
                <div class="absolute top-0 inset-x-0 h-1.5" style="background: ${color}"></div>

                <!-- Assignment name - first line -->
                <h3 class="${nameFontClass} font-black text-slate-800 mb-2 truncate group-hover:text-[color:var(--theme-color)] transition-colors" title="${a.name}">${a.name}</h3>
                
                <!-- Date - second line -->
                <div class="mb-3">
                    <span class="px-2 sm:px-3 py-1 rounded-full text-[10px] font-bold border bg-slate-50 text-slate-500 border-slate-100 group-hover:bg-[color:var(--theme-color)] group-hover:text-white group-hover:border-transparent transition-colors">
                        ${dateStr || '&mdash;&mdash;&mdash;'}
                    </span>
                </div>
                
                <div class="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-slate-500 font-medium mb-3 sm:mb-4">
                    <span class="hidden sm:flex items-center gap-1">
                        <svg class="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 group-hover:text-[color:var(--theme-color)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                        ${exerciseCount} ${t.exerciseAbbr || 'Ex'}
                    </span>
                    <span class="flex items-center gap-1">
                        <svg class="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 group-hover:text-[color:var(--theme-color)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        ${totalPoints} ${t.pointsAbbr || 'pts'}
                    </span>
                </div>

                <div class="mt-auto w-full py-2 sm:py-2.5 rounded-xl bg-slate-50 text-slate-600 font-bold text-center text-xs sm:text-sm group-hover:bg-[color:var(--theme-color)] group-hover:text-white transition-all duration-300">
                    ${t.gradeAction || 'Noter'}
                </div>
            </div>`;
        }).join('');
    };

    window.selectGradeAssignment = function(id) {
        const assignmentSelect = document.getElementById('select-assignment');
        if (assignmentSelect) {
             assignmentSelect.value = id;
             assignmentSelect.dispatchEvent(new Event('change'));
             window.goToGradeStep(3);
        }
    };
    
    // --- CUSTOM STUDENT SELECTOR LOGIC ---
    let studentSelectorFilter = 'all'; // 'all' or 'remaining'
    let exerciseFocusFilter = null; // ID of focused exercise

    window.openStudentSelector = function() {
        const modal = document.getElementById('student-selector-modal');
        if (!modal) return;
        
        const t = getTranslations()[getLang()];
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Prevent scroll
        
        // Reset search & Focus Fix labels
        const searchInput = document.getElementById('student-selector-search');
        if (searchInput) {
            searchInput.value = ''; // RECENT CHANGE: Clear search on return/open
            searchInput.placeholder = t.searchStudent || 'Rechercher un élève...';
            
            // Add Enter/Escape key listener if not already added
            if (!searchInput.dataset.hasListener) {
                searchInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        const items = document.querySelectorAll('#student-selector-list .student-item');
                        if (items.length === 1) {
                            items[0].click(); // Trigger selection if only one remains
                        }
                    } else if (e.key === 'Escape') {
                        e.stopPropagation(); // Prevent global listener from closing immediately
                        if (searchInput.value.length > 0) {
                            searchInput.value = ''; // Clear search
                            window.renderStudentListInSelector(); // Refresh list
                        } else {
                            window.closeStudentSelector(); // Close if already empty
                        }
                    }
                });
                searchInput.dataset.hasListener = 'true';
            }
        }
        
        // PERSISTENCE: We don't reset studentSelectorFilter or exerciseFocusFilter here
        // Manually update the button styles to match the persisted state
        const btnAll = document.getElementById('filter-all-students');
        const btnRem = document.getElementById('filter-remaining-students');
        if (btnAll && btnRem) {
            if (studentSelectorFilter === 'all') {
                btnAll.className = 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-blue-600 text-white shadow-md shadow-blue-500/20';
                btnRem.className = 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-slate-100 text-slate-600 hover:bg-slate-200';
            } else {
                btnRem.className = 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-blue-600 text-white shadow-md shadow-blue-500/20';
                btnAll.className = 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-slate-100 text-slate-600 hover:bg-slate-200';
            }
        }
        
        window.renderStudentListInSelector();
        
        // Focus search
        setTimeout(() => searchInput?.focus(), 100);
    };

    window.closeStudentSelector = function() {
        const modal = document.getElementById('student-selector-modal');
        if (modal) modal.classList.add('hidden');
        document.body.style.overflow = '';
    };

    window.setStudentSelectorFilter = function(filter) {
        studentSelectorFilter = filter;
        
        // Update UI buttons
        const btnAll = document.getElementById('filter-all-students');
        const btnRem = document.getElementById('filter-remaining-students');
        const t = getTranslations()[getLang()];
        
        if (btnAll && btnRem) {
            if (filter === 'all') {
                btnAll.textContent = t.allStudents || 'Tous';
                btnAll.className = 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-blue-600 text-white shadow-md shadow-blue-500/20';
                btnRem.className = 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-slate-100 text-slate-600 hover:bg-slate-200';
            } else {
                btnRem.textContent = t.remainingToGrade || 'À corriger';
                btnRem.className = 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-blue-600 text-white shadow-md shadow-blue-500/20';
                btnAll.className = 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-slate-100 text-slate-600 hover:bg-slate-200';
            }
        }
        
        window.renderStudentListInSelector();
    };

    window.setExerciseFocusFilter = function(exId) {
        // Toggle focus
        exerciseFocusFilter = (exerciseFocusFilter === exId) ? null : exId;
        window.renderStudentListInSelector();
    };

    function getStudentGradingProgress(studentId, assignmentId) {
        const data = getData();
        const assignment = data.assignments.find(a => a.id === assignmentId);
        if (!assignment) return { count: 0, total: 0, scores: [], status: 'none' };

        const studentGrades = data.grades[studentId]?.[assignmentId] || {};
        const exercises = assignment.exercises || [];
        const total = exercises.length;
        let count = 0;
        const scores = [];

        exercises.forEach(ex => {
            const hasGrade = window.grades.hasAnyGradeForExercise(studentGrades, ex);
            if (hasGrade) {
                count++;
                const totalEx = window.grades.getStudentExerciseTotal(studentGrades, ex);
                scores.push(totalEx);
            } else {
                scores.push('-');
            }
        });

        let status = 'none';
        if (count === total && total > 0) status = 'completed';
        else if (count > 0) status = 'partial';

        return { count, total, scores, status };
    }

    window.updateCustomStudentSelectorTrigger = function() {
        const studentSelect = document.getElementById('select-student');
        const assignmentSelect = document.getElementById('select-assignment');
        const nameSpan = document.getElementById('custom-student-name');
        const dot = document.getElementById('custom-student-status-dot');
        
        if (!studentSelect || !nameSpan || !dot) return;
        
        const studentId = studentSelect.value;
        const assignmentId = assignmentSelect ? assignmentSelect.value : '';
        
        if (!studentId) {
            nameSpan.textContent = getTranslations()[getLang()].selectStudent || '-- Sélectionner --';
            dot.className = 'status-dot none';
            return;
        }

        const student = (window.currentClassStudents || []).find(s => s.id === studentId);
        nameSpan.textContent = student ? student.name : '--';
        
        if (assignmentId) {
            const prog = getStudentGradingProgress(studentId, assignmentId);
            dot.className = `status-dot ${prog.status}`;
        } else {
            dot.className = 'status-dot none';
        }
    };

    window.renderStudentListInSelector = function() {
        const listContainer = document.getElementById('student-selector-list');
        const countLabel = document.getElementById('student-selector-count');
        const searchInput = document.getElementById('student-selector-search');
        const exFiltersContainer = document.getElementById('student-selector-exercise-filters');
        const studentSelect = document.getElementById('select-student');
        const assignmentSelect = document.getElementById('select-assignment');
        const t = getTranslations()[getLang()];
        
        if (!listContainer || !studentSelect) return;
        
        const assignmentId = assignmentSelect ? assignmentSelect.value : '';
        const assignment = getData().assignments.find(a => a.id === assignmentId);
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const students = window.currentClassStudents || [];
        const currentStudentId = studentSelect.value;

        // --- Render Exercise Tags ---
        if (exFiltersContainer && assignment) {
            const exercises = assignment.exercises || [];
            // Only show tags if there's more than 1 exercise
            if (exercises.length > 1) {
                exFiltersContainer.innerHTML = exercises.map((ex, idx) => {
                    const isActive = exerciseFocusFilter === ex.id;
                    return `
                        <button onclick="setExerciseFocusFilter('${ex.id}')" 
                            class="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight border-2 transition-all
                            ${isActive ? 'bg-amber-100 border-amber-400 text-amber-700 shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-white hover:border-slate-200'}">
                            ${ex.name || (t.exerciseAbbr || 'Ex') + (idx + 1)}
                        </button>
                    `;
                }).join('');
                exFiltersContainer.classList.remove('hidden');
            } else {
                exFiltersContainer.innerHTML = '';
                exFiltersContainer.classList.add('hidden');
            }
        }

        // --- Filter and calculate info ---
        let items = students.map(s => {
            const prog = assignmentId ? getStudentGradingProgress(s.id, assignmentId) : { count: 0, total: 0, scores: [], status: 'none' };
            return { student: s, progress: prog };
        }).filter(item => {
            const nameMatch = item.student.name.toLowerCase().includes(searchTerm);
            
            if (studentSelectorFilter === 'remaining') {
                return nameMatch && item.progress.status !== 'completed';
            }
            return nameMatch;
        });

        // --- Smart Sorting ---
        items.sort((a, b) => {
            // 1. If focused on an exercise, put those without grade for it first
            if (exerciseFocusFilter && assignment) {
                const exIdx = assignment.exercises.findIndex(ex => ex.id === exerciseFocusFilter);
                if (exIdx !== -1) {
                    const aGraded = a.progress.scores[exIdx] !== '-';
                    const bGraded = b.progress.scores[exIdx] !== '-';
                    if (!aGraded && bGraded) return -1;
                    if (aGraded && !bGraded) return 1;
                }
            }

            // 2. If 'remaining' filter, sort by completion progress (less graded first)
            if (studentSelectorFilter === 'remaining') {
                if (a.progress.count !== b.progress.count) {
                    return a.progress.count - b.progress.count;
                }
            }

            // 3. Current student always shows high up if possible? No, alphabetical usually best as fallback
            return a.student.name.localeCompare(b.student.name);
        });

        countLabel.textContent = `${items.length} ${t.students || 'élèves'}`;

        if (items.length === 0) {
            listContainer.innerHTML = `<div class="py-10 text-center text-slate-400 font-bold">${t.noResults || 'Aucun résultat'}</div>`;
            return;
        }

        listContainer.innerHTML = items.map(item => {
            const s = item.student;
            const p = item.progress;
            const isActive = s.id === currentStudentId;
            
            // Format scores list
            const scoresHtml = p.scores.map((score, idx) => {
                const isFocused = assignment && assignment.exercises[idx]?.id === exerciseFocusFilter;
                const baseClass = score === '-' ? 'empty' : 'filled';
                const focusClass = isFocused ? 'ring-2 ring-amber-400 ring-offset-1' : '';
                return `<span class="grade-pill ${baseClass} ${focusClass}">${score}</span>`;
            }).join('');

            return `
                <div onclick="selectStudentFromCustomList('${s.id}')" 
                    class="student-item flex items-center justify-between p-3 rounded-2xl cursor-pointer ${isActive ? 'active' : 'bg-white'}">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="status-dot ${p.status} shrink-0"></div>
                        <div class="min-w-0">
                            <p class="font-black text-slate-800 text-sm sm:text-base truncate">${s.name}</p>
                            <div class="flex items-center gap-1.5">
                                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                    ${p.count}/${p.total} ${t.graded || 'notés'}
                                </span>
                                ${p.status === 'completed' ? '✅' : ''}
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-1 overflow-x-auto no-scrollbar ms-2">
                        ${scoresHtml}
                    </div>
                </div>
            `;
        }).join('');
    };

    window.selectStudentFromCustomList = function(id) {
        const studentSelect = document.getElementById('select-student');
        if (studentSelect) {
            studentSelect.value = id;
            // Native select change doesn't always trigger onchange via JS, so call it
            window.loadGradeEntry();
            window.updateCustomStudentSelectorTrigger();
            window.closeStudentSelector();
        }
    };

    // Global Escape listener for student selector
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('student-selector-modal');
            if (modal && !modal.classList.contains('hidden')) {
                const searchInput = document.getElementById('student-selector-search');
                // If focus is not on search or search is empty, close it
                if (document.activeElement !== searchInput || (searchInput && searchInput.value.length === 0)) {
                    window.closeStudentSelector();
                }
            }
        }
    });

    // Close modal on click outside
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('student-selector-modal');
        const container = modal?.querySelector('.modal-container');
        if (e.target === container) {
            window.closeStudentSelector();
        }
    });

    // Global Escape listener for exercise total modal
    window.addEventListener('keydown', (e) => {
        const modal = document.getElementById('exercise-total-modal');
        if (!modal || modal.classList.contains('hidden')) return;

        if (e.key === 'Enter') {
            const studentId = modal.dataset.studentId;
            const assignmentId = modal.dataset.assignmentId;
            if (studentId && assignmentId) {
                window.confirmAssignmentTotal(studentId, assignmentId);
            }
        } else if (e.key === 'Escape') {
            window.closeExerciseTotalConfirm();
        }
    });

    // Close exercise total modal on click outside
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('exercise-total-modal');
        const container = modal?.querySelector('.modal-container');
        if (e.target === container) {
            window.closeExerciseTotalConfirm();
        }
    });

    // Initial setup function to be called after data load
    window.initGradesUI = function() {
        window.goToGradeStep(1);
    };

})();
