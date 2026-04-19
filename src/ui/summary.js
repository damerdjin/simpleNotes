
import * as gradesSvc from '../services/grades.service.js';

(function() {
    // State variables specific to Summary
    let currentSummaryMode = 'default';
    let summarySort = { key: 'name', direction: 'asc' };
    let summaryAssignmentFilter = new Set();
    let draggedAssignmentId = null;
    let expandedAssignments = new Set(); // Track expanded details in mobile view

    // Helper to access globals easily
    const getData = () => window.data;
    const getTranslations = () => window.translations;
    const getLang = () => window.currentLanguage;

    // Helper to truncate student names for mobile: "LASTNAME Fir."
    // UPDATE: User requested full name (Nom Prénom).
    const truncateStudentName = (s) => {
        return `${s.lastName || ''} ${s.firstName || ''}`.trim() || s.name || '';
    };

    const calculateMedian = (values) => {
        if (!values || values.length === 0) return null;
        const sorted = [...values].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0) {
            return (sorted[middle - 1] + sorted[middle]) / 2;
        }
        return sorted[middle];
    };

    console.log('Summary Module v1.4 Loaded');

    window.setSummaryMode = function(mode) {
        currentSummaryMode = mode;
        window.renderSummary();
    };

    const syncSummaryModeVisibility = () => {
        const isMobile = window.innerWidth < 768;
        const firstModeInput = document.querySelector('input[name="summaryMode"]');
        const modeContainer = firstModeInput ? firstModeInput.closest('div') : null;
        const detailsCheckbox = document.getElementById('show-details');
        const detailsContainer = detailsCheckbox ? detailsCheckbox.closest('label') : null;
        const exportExcelBtn = document.getElementById('btn-export-excel');
        if (modeContainer) {
            modeContainer.style.display = isMobile ? 'none' : '';
        }
        if (detailsContainer) {
            detailsContainer.style.display = isMobile ? 'none' : '';
        }
        if (exportExcelBtn) {
            exportExcelBtn.style.display = isMobile ? 'none' : '';
        }
    };

    window.resetSummaryFilters = function() {
        const searchInput = document.getElementById('summary-search');
        const classSelect = document.getElementById('select-class-summary');
        
        if (searchInput) searchInput.value = '';
        if (classSelect) classSelect.value = '';
        
        // On peut aussi réinitialiser d'autres filtres si nécessaire
        summaryAssignmentFilter.clear();
    };

    window.renderSummary = async function() {
        const isMobile = window.innerWidth < 768;
        syncSummaryModeVisibility();
        
        if (isMobile) {
            await window.renderSummaryMobile();
            return;
        }

        switch (currentSummaryMode) {
            case 'grouped':
                await window.renderSummary2();
                break;
            case 'view1':
                await window.renderSummary1();
                break;
            default:
                await window.renderSummary0();
        }
    };

    window.toggleMobileAssignmentDetails = function(studentId, assignmentId) {
        const key = `${studentId}-${assignmentId}`;
        if (expandedAssignments.has(key)) {
            expandedAssignments.delete(key);
        } else {
            expandedAssignments.add(key);
        }
        window.renderSummaryMobile();
    };

    // Listen for window resize to switch between mobile and desktop views
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(async () => {
            syncSummaryModeVisibility();
            if (window.currentTab === 'summary') {
                await window.renderSummary();
            }
        }, 250);
    });

    window.renderSummaryMobile = async function() {
        if (!getTranslations() || !getLang() || !getTranslations()[getLang()]) return;
        const t = getTranslations()[getLang()];
        const container = document.getElementById('summary-table');
        if (!container) return;

        const detailsCheckbox = document.getElementById('show-details');
        const showDetails = detailsCheckbox ? detailsCheckbox.checked : false;
        const classSelect = document.getElementById('select-class-summary');
        const searchInput = document.getElementById('summary-search');
        const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const data = getData();

        let selectedClass = classSelect ? classSelect.value : '';
        
        // --- MODÈLE COLLABORATIF : Récupération des classes ---
        let sharedClasses = [];
        if (window.store && typeof window.store.getSharedClasses === 'function') {
            sharedClasses = await window.store.getSharedClasses(true); // true = seulement mes classes
        }

        let localClasses = new Set();
        const globalUserId = window.currentUser?.email || window.currentUser?.id || 'unknown';
        const globalAcademicYear = window.getGlobalAcademicYear();
        
        data.students.forEach(s => {
            if ((s.importedBy || 'unknown') === globalUserId && (s.academicYear || '') === globalAcademicYear) {
                if (s.className) localClasses.add(s.className);
            }
        });

        const matchingClasses = Array.from(new Set([...localClasses, ...sharedClasses]))
            .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

        if (classSelect) {
            const previousValue = selectedClass;
            classSelect.innerHTML = `<option value="">-- ${t.selectClass} --</option>` +
                matchingClasses.map(c => `<option value="${c}" ${c === previousValue ? 'selected' : ''}>${c}</option>`).join('');
            selectedClass = classSelect.value;
        }

        // --- Récupération des élèves fusionnés ---
        let filteredStudents = [];
        if (selectedClass) {
            let localStudents = data.students.filter(s => 
                s.className === selectedClass && 
                (s.importedBy || 'unknown') === globalUserId && 
                (s.academicYear || '') === globalAcademicYear
            );
            
            let sharedStudents = [];
            if (window.store && typeof window.store.getSharedStudents === 'function') {
                sharedStudents = await window.store.getSharedStudents(selectedClass);
            }

            const studentMap = new Map();
            localStudents.forEach(s => studentMap.set(s.id, s));
            sharedStudents.forEach(s => {
                const existing = Array.from(studentMap.values()).find(ls => ls.id === s.id || (ls.regNumber && ls.regNumber === s.regNumber));
                if (!existing) studentMap.set(s.id, s);
            });
            filteredStudents = Array.from(studentMap.values());
        } else {
            // All students for all matching classes
            const studentMap = new Map();
            
            // Local
            data.students.forEach(s => {
                if ((s.importedBy || 'unknown') === globalUserId && (s.academicYear || '') === globalAcademicYear && matchingClasses.includes(s.className)) {
                    studentMap.set(s.id, s);
                }
            });
            
            // Shared (one by one for each matching class)
            for (const c of sharedClasses) {
                if (window.store && typeof window.store.getSharedStudents === 'function') {
                    const shared = await window.store.getSharedStudents(c);
                    shared.forEach(s => {
                        const existing = Array.from(studentMap.values()).find(ls => ls.id === s.id || (ls.regNumber && ls.regNumber === s.regNumber));
                        if (!existing) studentMap.set(s.id, s);
                    });
                }
            }
            filteredStudents = Array.from(studentMap.values());
        }

        // Masquer les élèves archivés
        filteredStudents = filteredStudents.filter(s => s.status !== 'archived');

        if (searchTerm) {
            filteredStudents = filteredStudents.filter(s => {
                const haystack = `${s.name || ''} ${s.firstName || ''} ${s.lastName || ''} ${s.className || ''}`.toLowerCase();
                return haystack.includes(searchTerm);
            });
        }

        let filteredAssignments = data.assignments.slice();
        filteredAssignments = filteredAssignments.filter(a => (a.createdBy || 'unknown') === globalUserId);

        if (globalAcademicYear) {
            filteredAssignments = filteredAssignments.filter(a => (a.academicYear || '') === globalAcademicYear);
        } else {
            filteredAssignments = [];
        }

        const globalTrimester = window.getGlobalTrimester();
        if (globalTrimester) {
            filteredAssignments = filteredAssignments.filter(a => (a.trimester || '') === globalTrimester);
        } else {
            filteredAssignments = [];
        }

        if (selectedClass) {
            filteredAssignments = filteredAssignments.filter(a => a.className === selectedClass);
        } else {
            const classFilterSet = new Set(matchingClasses);
            filteredAssignments = filteredAssignments.filter(a => classFilterSet.has(a.className));
        }

        if (summaryAssignmentFilter && summaryAssignmentFilter.size > 0) {
            filteredAssignments = filteredAssignments.filter(a => summaryAssignmentFilter.has(a.id));
        }

        if (summaryAssignmentFilter && summaryAssignmentFilter.size > 0 && !selectedClass) {
            const allowedClasses = new Set(filteredAssignments.map(a => (a.className || '').trim()).filter(c => c.length > 0));
            filteredStudents = filteredStudents.filter(s => allowedClasses.has((s.className || '').trim()));
        }

        const allRelevantAssignments = [...filteredAssignments];

        const tagContainer = document.getElementById('summary-assignment-tags');
        if (tagContainer) {
            const tags = allRelevantAssignments.map(a => {
                const selected = summaryAssignmentFilter.has(a.id);
                const classColor = window.getClassColor ? window.getClassColor(a.className || '') : '#3b82f6';
                return `<button class="assignment-tag ${selected ? 'selected' : ''} shrink-0"
                        onclick="toggleSummaryAssignmentTag('${a.id}')"
                        style="${selected ? `background-color:${classColor};border-color:${classColor};color:#fff;` : `border-color:${classColor};color:${classColor};`}">
                        ${a.name}
                    </button>`;
            }).join('');
            tagContainer.innerHTML = `<div class="flex gap-2 overflow-x-auto pb-1">${tags}</div>`;
            tagContainer.className = "mb-3 p-2 bg-gray-50 rounded-lg assignment-tag-container";
        }

        if (detailsCheckbox) {
            detailsCheckbox.checked = false;
            detailsCheckbox.disabled = true;
        }

        if (!selectedClass) {
            const tagContainer = document.getElementById('summary-assignment-tags');
            if (tagContainer) tagContainer.innerHTML = '';
            container.innerHTML = `<p class="text-gray-500 text-center py-12">${t.selectClassToSeeSummary || 'Veuillez sélectionner une classe pour afficher le récapitulatif.'}</p>`;
            return;
        }

        if (filteredStudents.length === 0 || filteredAssignments.length === 0) {
            let emptyMessage = searchTerm ? t.noResultForSearch : t.addStudentsAndAssignmentsToSeeSummary;
            container.innerHTML = `<p class="text-gray-500 text-center py-8">${emptyMessage}</p>`;
            return;
        }

        // Sort students
        filteredStudents.sort((a, b) => {
            const classA = (a.className || '').toLowerCase();
            const classB = (b.className || '').toLowerCase();
            if (classA !== classB) {
                return classA.localeCompare(classB, 'fr', { sensitivity: 'base' });
            }

            const nameA = (a.lastName || a.name || '').toLowerCase();
            const nameB = (b.lastName || b.name || '').toLowerCase();
            if (nameA.localeCompare(nameB) !== 0) return nameA.localeCompare(nameB);

            const firstA = (a.firstName || '').toLowerCase();
            const firstB = (b.firstName || '').toLowerCase();
            return firstA.localeCompare(firstB);
        });

        const totalCells = filteredStudents.length * filteredAssignments.length;
        const gradedCells = filteredStudents.reduce((acc, s) => {
            return acc + filteredAssignments.filter(a => gradesSvc.hasAnyGradeForAssignment(data, s.id, a.id)).length;
        }, 0);
        const completionPct = totalCells > 0 ? Math.round((gradedCells / totalCells) * 100) : 0;

        let html = `
            <div class="grid grid-cols-3 gap-2 mb-3">
                <div class="bg-white border border-slate-200 rounded-xl p-2 text-center">
                    <div class="text-[10px] text-slate-500">${t.students || 'Élèves'}</div>
                    <div class="text-lg font-bold text-slate-800">${filteredStudents.length}</div>
                </div>
                <div class="bg-white border border-slate-200 rounded-xl p-2 text-center">
                    <div class="text-[10px] text-slate-500">${t.assignments || 'Devoirs'}</div>
                    <div class="text-lg font-bold text-slate-800">${filteredAssignments.length}</div>
                </div>
                <div class="bg-white border border-slate-200 rounded-xl p-2 text-center">
                    <div class="text-[10px] text-slate-500">${t.progression || 'Progression'}</div>
                    <div class="text-lg font-bold text-slate-800">${completionPct}%</div>
                </div>
            </div>
            <div class="space-y-3">
        `;

        filteredStudents.forEach(s => {
            const displayName = truncateStudentName(s);
            const studentClass = (s.className || '').trim();
            let gradesHtml = '';

            filteredAssignments.forEach(a => {
                const isStudentClass = studentClass === ((a.className || '').trim());
                if (!isStudentClass) return;

                const total = gradesSvc.getStudentAssignmentTotal(data, s.id, a.id);
                const max = gradesSvc.getAssignmentMaxPoints(a);
                const hasGrade = gradesSvc.hasAnyGradeForAssignment(data, s.id, a.id);
                const pct = max > 0 ? (total / max * 100) : 0;
                const badgeClass = !hasGrade ? 'bg-slate-100 text-slate-400 border-slate-200'
                    : pct >= 70 ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                    : pct >= 50 ? 'bg-amber-100 text-amber-700 border-amber-200'
                    : 'bg-rose-100 text-rose-700 border-rose-200';

                const assignmentId = a.id;
                const isBlocked = window.isTrimesterBlocked(a.trimester, a.academicYear);

                gradesHtml += `
                    <div class="flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-100">
                        <div class="min-w-0">
                            <div class="text-xs font-semibold text-slate-700 truncate">${a.name}</div>
                            <div class="text-[10px] text-slate-400">${a.className || ''}</div>
                        </div>
                        <button class="px-2 py-1 rounded-md border text-xs font-bold ${badgeClass} ${isBlocked ? 'cursor-default' : ''}"
                                ${isBlocked ? '' : `ondblclick="window.makeTotalEditable(this, '${s.id}', '${a.id}', ${max})"`}
                                id="sum-total-${s.id}-${a.id}">
                            ${hasGrade ? (Math.round(total * 10) / 10) : '-'}
                        </button>
                    </div>
                `;
            });

            html += `
                <div class="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                    <div class="flex items-center justify-between mb-2">
                        <div class="font-bold text-slate-800 truncate">${displayName}</div>
                        <div class="text-[10px] px-2 py-1 rounded-md bg-slate-100 text-slate-500">${studentClass || '-'}</div>
                    </div>
                    <div class="space-y-2">${gradesHtml || `<div class="text-xs text-slate-400">${t.noResultForSearch || 'Aucun résultat'}</div>`}</div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
        if (window.translatePage) window.translatePage();
    };

    window.renderSummary0 = async function() {
        if (!getTranslations() || !getLang() || !getTranslations()[getLang()]) return;
        const t = getTranslations()[getLang()];
        const container = document.getElementById('summary-table');
        if (!container) return;
        const detailsCheckbox = document.getElementById('show-details');
        let showDetails = detailsCheckbox ? detailsCheckbox.checked : false;
        const classSelect = document.getElementById('select-class-summary');
        const searchInput = document.getElementById('summary-search');
        const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const data = getData();

        let selectedClass = classSelect ? classSelect.value : '';
        
        // --- MODÈLE COLLABORATIF : Récupération des classes ---
        let sharedClasses = [];
        if (window.store && typeof window.store.getSharedClasses === 'function') {
            sharedClasses = await window.store.getSharedClasses(true);
        }

        let localClasses = new Set();
        const globalUserId = window.currentUser?.email || window.currentUser?.id || 'unknown';
        const globalAcademicYear = window.getGlobalAcademicYear();
        
        data.students.forEach(s => {
            if ((s.importedBy || 'unknown') === globalUserId && (s.academicYear || '') === globalAcademicYear) {
                if (s.className) localClasses.add(s.className);
            }
        });

        const matchingClasses = Array.from(new Set([...localClasses, ...sharedClasses]))
            .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

        if (classSelect) {
            const previousValue = selectedClass;
            classSelect.innerHTML = `<option value="">-- ${t.selectClass} --</option>` +
                matchingClasses.map(c => `<option value="${c}" ${c === previousValue ? 'selected' : ''}>${c}</option>`).join('');

            if (matchingClasses.includes(previousValue)) {
                classSelect.value = previousValue;
            } else if (matchingClasses.length === 1) {
                classSelect.value = matchingClasses[0];
            } else {
                classSelect.value = '';
            }
            selectedClass = classSelect.value;
        }

        // --- Récupération des élèves fusionnés ---
        let filteredStudents = [];
        if (selectedClass) {
            let localStudents = data.students.filter(s => 
                s.className === selectedClass && 
                (s.importedBy || 'unknown') === globalUserId && 
                (s.academicYear || '') === globalAcademicYear
            );
            
            let sharedStudents = [];
            if (window.store && typeof window.store.getSharedStudents === 'function') {
                sharedStudents = await window.store.getSharedStudents(selectedClass);
            }

            const studentMap = new Map();
            localStudents.forEach(s => studentMap.set(s.id, s));
            sharedStudents.forEach(s => {
                const existing = Array.from(studentMap.values()).find(ls => ls.id === s.id || (ls.regNumber && ls.regNumber === s.regNumber));
                if (!existing) studentMap.set(s.id, s);
            });
            filteredStudents = Array.from(studentMap.values());
        } else {
            // All students for all matching classes
            const studentMap = new Map();
            
            // Local
            data.students.forEach(s => {
                if ((s.importedBy || 'unknown') === globalUserId && (s.academicYear || '') === globalAcademicYear && matchingClasses.includes(s.className)) {
                    studentMap.set(s.id, s);
                }
            });
            
            // Shared (one by one for each matching class)
            for (const c of sharedClasses) {
                if (window.store && typeof window.store.getSharedStudents === 'function') {
                    const shared = await window.store.getSharedStudents(c);
                    shared.forEach(s => {
                        const existing = Array.from(studentMap.values()).find(ls => ls.id === s.id || (ls.regNumber && ls.regNumber === s.regNumber));
                        if (!existing) studentMap.set(s.id, s);
                    });
                }
            }
            filteredStudents = Array.from(studentMap.values());
        }

        // Masquer les élèves archivés
        filteredStudents = filteredStudents.filter(s => s.status !== 'archived');

        if (searchTerm) {
            filteredStudents = filteredStudents.filter(s => {
                const haystack = `${s.name || ''} ${s.firstName || ''} ${s.lastName || ''} ${s.className || ''}`.toLowerCase();
                return haystack.includes(searchTerm);
            });
        }

        let filteredAssignments = data.assignments.slice();
        filteredAssignments = filteredAssignments.filter(a => (a.createdBy || 'unknown') === globalUserId);

        if (globalAcademicYear) {
            filteredAssignments = filteredAssignments.filter(a => (a.academicYear || '') === globalAcademicYear);
        } else {
            filteredAssignments = [];
        }

        const globalTrimester = window.getGlobalTrimester();
        if (globalTrimester) {
            filteredAssignments = filteredAssignments.filter(a => (a.trimester || '') === globalTrimester);
        } else {
            filteredAssignments = [];
        }

        if (selectedClass) {
            filteredAssignments = filteredAssignments.filter(a => a.className === selectedClass);
        } else {
            const classFilterSet = new Set(matchingClasses);
            filteredAssignments = filteredAssignments.filter(a => classFilterSet.has(a.className));
        }

        const allRelevantAssignments = [...filteredAssignments];

        const sortAssignments = (arr) => {
            arr.sort((a, b) => {
                const oa = window.summaryAssignmentOrder.indexOf(a.id);
                const ob = window.summaryAssignmentOrder.indexOf(b.id);
                if (oa === -1 && ob === -1) return 0;
                if (oa === -1) return 1;
                if (ob === -1) return -1;
                return oa - ob;
            });
        };

        if (summaryAssignmentFilter && summaryAssignmentFilter.size > 0) {
            filteredAssignments = filteredAssignments.filter(a => summaryAssignmentFilter.has(a.id));
        }

        if (summaryAssignmentFilter && summaryAssignmentFilter.size > 0 && !selectedClass) {
            const allowedClasses = new Set(filteredAssignments.map(a => (a.className || '').trim()).filter(c => c.length > 0));
            filteredStudents = filteredStudents.filter(s => allowedClasses.has((s.className || '').trim()));
        }

        if (!window.summaryAssignmentOrder) {
            try {
                window.summaryAssignmentOrder = JSON.parse(localStorage.getItem('summary-assignment-order') || '[]');
            } catch (e) { window.summaryAssignmentOrder = []; }
        }
        const ensureOrderIds = () => {
            const ids = allRelevantAssignments.map(a => a.id);
            const set = new Set(window.summaryAssignmentOrder);
            ids.forEach(id => { if (!set.has(id)) window.summaryAssignmentOrder.push(id); });
        };
        ensureOrderIds();
        sortAssignments(filteredAssignments);
        sortAssignments(allRelevantAssignments);

        const isAllStudents = !selectedClass && !searchTerm && filteredStudents.length === data.students.length;
        const assignmentsFiltered = (summaryAssignmentFilter && summaryAssignmentFilter.size > 0) || filteredAssignments.length < data.assignments.length;
        if (detailsCheckbox) {
            const shouldDisableDetails = isAllStudents && !assignmentsFiltered;
            if (shouldDisableDetails) {
                detailsCheckbox.checked = false;
                detailsCheckbox.disabled = true;
            } else {
                detailsCheckbox.disabled = false;
            }
            showDetails = detailsCheckbox.checked;
        }

        if (!selectedClass) {
            const tagContainer = document.getElementById('summary-assignment-tags');
            if (tagContainer) tagContainer.innerHTML = '';
            container.innerHTML = `<p class="text-gray-500 text-center py-12">${t.selectClassToSeeSummary || 'Veuillez sélectionner une classe pour afficher le récapitulatif.'}</p>`;
            return;
        }

        if (filteredStudents.length === 0 || filteredAssignments.length === 0) {
            let emptyMessage = selectedClass ? `${t.noStudentOrAssignmentForClass} "${selectedClass}".` : (searchTerm ? t.noResultForSearch : t.addStudentsAndAssignmentsToSeeSummary);
            container.innerHTML = `<p class="text-gray-500 text-center py-8">${emptyMessage}</p>`;
            return;
        }

        filteredStudents.sort((a, b) => {
            const classA = (a.className || '').toLowerCase();
            const classB = (b.className || '').toLowerCase();
            if (classA !== classB) {
                return classA.localeCompare(classB, 'fr', { sensitivity: 'base' });
            }

            if (summarySort.key === 'name') {
                const nameA = (a.lastName || a.name || '').toLowerCase();
                const nameB = (b.lastName || b.name || '').toLowerCase();
                if (nameA.localeCompare(nameB) !== 0) {
                     return summarySort.direction === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
                }
                const firstA = (a.firstName || '').toLowerCase();
                const firstB = (b.firstName || '').toLowerCase();
                return summarySort.direction === 'asc' ? firstA.localeCompare(firstB) : firstB.localeCompare(firstA);
            } else if (summarySort.key.startsWith('assignment-')) {
                const assignmentId = summarySort.key.split('assignment-')[1];
                const ta = window.getStudentAssignmentTotal(a.id, assignmentId);
                const tb = window.getStudentAssignmentTotal(b.id, assignmentId);
                if (ta < tb) return summarySort.direction === 'asc' ? -1 : 1;
                if (ta > tb) return summarySort.direction === 'asc' ? 1 : -1;
                return 0;
            }
            return 0;
        });

        const tagContainer = document.getElementById('summary-assignment-tags');
        if (tagContainer) {
            const tagHtml = allRelevantAssignments.map(a => {
                const selected = summaryAssignmentFilter.has(a.id);
                const classColor = window.getClassColor(a.className);
                return `
                    <div class="assignment-tag-wrapper flex items-center gap-1" 
                         draggable="true" 
                         ondragstart="handleAssignmentDragStart(event, '${a.id}')"
                         ondragend="handleAssignmentDragEnd(event)"
                         ondragover="handleAssignmentDragOver(event, '${a.id}')"
                         onmouseleave="handleAssignmentDragLeave(event)"
                         ondragleave="handleAssignmentDragLeave(event)"
                         ondrop="handleAssignmentDrop(event, '${a.id}')">
                        <button class="assignment-tag ${selected ? 'selected' : ''}" 
                                onclick="toggleSummaryAssignmentTag('${a.id}')"
                                style="${selected ? `background-color: ${classColor}; border-color: ${classColor}; color: white;` : `border-color: ${classColor}; color: ${classColor};`}"
                                title="${t.dragToReorder || 'Glisser pour réorganiser'}">
                            ${a.name}
                        </button>
                    </div>`;
            }).join('');
            tagContainer.innerHTML = tagHtml;
            tagContainer.className = "flex flex-wrap gap-2 mb-4 p-2 bg-gray-50 rounded-lg assignment-tag-container max-w-full overflow-x-auto";
        }

        const assignmentsByClass = {};
        filteredAssignments.forEach(a => {
            const c = (a.className || '').trim() || '(Sans classe)';
            if (!assignmentsByClass[c]) assignmentsByClass[c] = [];
            assignmentsByClass[c].push(a);
        });
        Object.keys(assignmentsByClass).forEach(c => sortAssignments(assignmentsByClass[c]));
        const classOrder = Object.keys(assignmentsByClass).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
        const orderedAssignments = classOrder.flatMap(c => assignmentsByClass[c] || []);

        if (orderedAssignments.length === 0) {
            const emptyMessage = selectedClass ? `${t.noStudentOrAssignmentForClass} "${selectedClass}".` : (searchTerm ? t.noResultForSearch : t.addStudentsAndAssignmentsToSeeSummary);
            container.innerHTML = `<p class="text-gray-500 text-center py-8">${emptyMessage}</p>`;
            return;
        }

        let classHeaderRow = `<th class="p-2 bg-slate-100 sticky left-0 z-20 border-r border-slate-200"></th>`;
        let assignmentHeaderRow = `<th class="p-3 text-left bg-slate-100 sticky left-0 z-20 cursor-pointer select-none border-r border-slate-200" onclick="toggleSummarySort('name')">${t.student}</th>`;

        classOrder.forEach((className, idx) => {
            const classAssignments = assignmentsByClass[className] || [];
            let colspan = 0;
            classAssignments.forEach(a => {
                if (showDetails) colspan += (a.exercises || []).length;
                colspan += 1;
            });
            const bgClass = idx % 2 === 0 ? 'bg-blue-600' : 'bg-indigo-600';
            classHeaderRow += `<th colspan="${colspan}" class="p-2 text-center text-white font-bold text-sm ${bgClass} border-l border-white/30">${className}</th>`;
        });

        orderedAssignments.forEach(a => {
            if (showDetails) {
                (a.exercises || []).forEach((ex, i) => {
                    const exLabel = ex.name && ex.name !== 'Global' ? ex.name : `Ex${i + 1}`;
                    assignmentHeaderRow += `<th class="p-2 text-center bg-slate-50 text-xs font-semibold border-l border-slate-200">${exLabel}<br><span class="text-[10px] text-slate-500">/${window.getExerciseMaxPoints(ex)}</span></th>`;
                });
            }
            assignmentHeaderRow += `<th class="p-3 text-center bg-slate-100 font-bold cursor-pointer select-none border-l border-slate-200" onclick="toggleSummarySort('assignment-${a.id}')">${a.name}<br><span class="text-xs text-slate-500">/${window.getAssignmentMaxPoints(a)}</span></th>`;
        });

        let rows = filteredStudents.map(s => {
            const displayName = truncateStudentName(s);
            const studentClassName = (s.className || '').trim();
            let row = `<td class="p-3 font-medium bg-slate-50 sticky left-0 z-10 border-r border-slate-200" title="${s.name}">${displayName}</td>`;
            for (const a of orderedAssignments) {
                const studentGrades = data.grades[s.id]?.[a.id] || {};
                const isStudentClass = studentClassName === ((a.className || '').trim());
                if (showDetails) {
                    for (const ex of a.exercises) {
                        if (isStudentClass) {
                            const exTotal = window.getStudentExerciseTotal(studentGrades, ex);
                            const max = window.getExerciseMaxPoints(ex);
                            const existingFinal = studentGrades[ex.id]?.['final']?.['final']?.['final'];
                            const hasEx = window.hasAnyGradeForExercise(studentGrades, ex);
                            const val = existingFinal !== undefined && existingFinal !== '' ? existingFinal : (hasEx ? exTotal.toFixed(2) : '');
                            const isBlocked = window.isTrimesterBlocked(a.trimester, a.academicYear);
                            if (isBlocked) {
                                row += `<td class="px-2 py-1 text-center border-l border-slate-200">
                                    <input type="text" value="${val}" disabled class="summary-grade-input opacity-50 cursor-not-allowed">
                                </td>`;
                            } else {
                                row += `<td class="px-2 py-1 text-center border-l border-slate-200">
                                    <input type="text" inputmode="decimal" pattern="[0-9]*[.,]?[0-9]*" value="${val}" oninput="sanitizeAndClamp(this, ${max})" onblur="commitSummaryInput('${s.id}','${a.id}','${ex.id}', ${max}, this.value)" onkeydown="handleSummaryInputKey(event, '${s.id}','${a.id}','${ex.id}', ${max})" class="summary-grade-input">
                                </td>`;
                            }
                        } else {
                            row += `<td class="px-2 py-1 text-center text-slate-300 bg-slate-50/70 border-l border-slate-200">-</td>`;
                        }
                    }
                }
                if (isStudentClass) {
                    const has = window.hasAnyGradeForAssignment(s.id, a.id);
                    const max = window.getAssignmentMaxPoints(a);
                    const isBlocked = window.isTrimesterBlocked(a.trimester, a.academicYear);
                    if (has) {
                        const total = window.getStudentAssignmentTotal(s.id, a.id);
                        const pct = max > 0 ? (total / max * 100) : 0;
                        const bgColor = pct >= 70 ? 'bg-emerald-100' : pct >= 50 ? 'bg-amber-100' : 'bg-rose-100';
                        row += `<td class="p-3 text-center font-bold ${bgColor} ${isBlocked ? 'cursor-default' : 'cursor-pointer select-none'} border-l border-slate-200" 
                                    ${isBlocked ? '' : `ondblclick="window.makeTotalEditable(this, '${s.id}', '${a.id}', ${max})"`} 
                                    id="sum-total-${s.id}-${a.id}">${total.toFixed(2)}</td>`;
                    } else {
                        row += `<td class="p-3 text-center text-gray-400 bg-slate-50 ${isBlocked ? 'cursor-default' : 'cursor-pointer select-none'} border-l border-slate-200" 
                                    ${isBlocked ? '' : `ondblclick="window.makeTotalEditable(this, '${s.id}', '${a.id}', ${max})"`} 
                                    id="sum-total-${s.id}-${a.id}"></td>`;
                    }
                } else {
                    row += `<td class="p-3 text-center text-slate-300 bg-slate-50/70 border-l border-slate-200">-</td>`;
                }
            }
            return `<tr class="border-b border-slate-100 hover:bg-slate-50">${row}</tr>`;
        }).join('');

        const colgroupHtml = (() => {
            let cols = '<col style="width:240px">';
            for (const a of orderedAssignments) {
                if (showDetails) for (let i = 0; i < (a.exercises || []).length; i++) cols += '<col style="width:70px">';
                cols += '<col style="width:96px">';
            }
            return `<colgroup>${cols}</colgroup>`;
        })();

        container.innerHTML = `<div class="rounded-xl border border-slate-200 overflow-x-auto bg-white shadow-sm"><table class="w-full table-fixed border-collapse">${colgroupHtml}<thead><tr class="border-b border-slate-200">${classHeaderRow}</tr><tr class="border-b-2 border-slate-200">${assignmentHeaderRow}</tr></thead><tbody>${rows}</tbody></table></div>`;
        if (window.translatePage) window.translatePage();
    };

    window.exportSummaryToExcel = async function() {
        const t = getTranslations()[getLang()];
        const selectedClass = document.getElementById('select-class-summary')?.value || '';
        const searchTerm = (document.getElementById('summary-search')?.value || '').toLowerCase().trim();
        const data = getData();

        const userEmail = window.currentUser?.email || null;
        const userUuid = window.currentUser?.id || null;
        const ownerMatch = (owner) => {
            const v = owner || 'unknown';
            return (userEmail && v === userEmail) || (userUuid && v === userUuid);
        };
        const globalAcademicYear = window.getGlobalAcademicYear();

        let sharedClasses = [];
        if (window.store && typeof window.store.getSharedClasses === 'function') {
            sharedClasses = await window.store.getSharedClasses(true);
        }

        const localClasses = new Set();
        data.students.forEach(s => {
            if (ownerMatch(s.importedBy) && (!globalAcademicYear || (s.academicYear || '') === globalAcademicYear) && s.className) {
                localClasses.add(s.className);
            }
        });
        const allClasses = Array.from(new Set([...localClasses, ...sharedClasses]));

        const studentMap = new Map();
        const includeStudent = (s) => {
            if (!s) return false;
            const n = (s.name || '').toLowerCase();
            const cn = (s.className || '').toLowerCase();
            if (searchTerm && !(n.includes(searchTerm) || cn.includes(searchTerm))) return false;
            if (selectedClass && (s.className || '') !== selectedClass) return false;
            if (globalAcademicYear && (s.academicYear || '') !== globalAcademicYear) return false;
            return true;
        };
        const addStudent = (s) => {
            if (!includeStudent(s)) return;
            const reg = (s.regNumber || '').toString().trim();
            const key = s.id || (reg ? `reg:${reg}` : `${s.className || ''}:${s.name || ''}`);
            if (!studentMap.has(key)) studentMap.set(key, s);
        };

        data.students.forEach(s => {
            if (!ownerMatch(s.importedBy)) return;
            addStudent(s);
        });

        const classesToFetch = selectedClass ? [selectedClass] : allClasses;
        if (window.store && typeof window.store.getSharedStudents === 'function') {
            for (const c of classesToFetch) {
                const shared = await window.store.getSharedStudents(c);
                shared.forEach(s => addStudent(s));
            }
        }

        let filteredStudents = Array.from(studentMap.values());

        // Masquer les élèves archivés de l'export Excel
        filteredStudents = filteredStudents.filter(s => s.status !== 'archived');

        filteredStudents.sort((a, b) => {
            const classA = (a.className || '').toLowerCase();
            const classB = (b.className || '').toLowerCase();

            if (classA !== classB) {
                return classA.localeCompare(classB, 'fr', { sensitivity: 'base' });
            }

            const nameA = (a.lastName || a.name || '').toLowerCase();
            const nameB = (b.lastName || b.name || '').toLowerCase();
            
            if (nameA.localeCompare(nameB) !== 0) {
                 return nameA.localeCompare(nameB);
            }
            
            const firstA = (a.firstName || '').toLowerCase();
            const firstB = (b.firstName || '').toLowerCase();
            return firstA.localeCompare(firstB);
        });

        let filteredAssignments = data.assignments.slice();
        filteredAssignments = filteredAssignments.filter(a => ownerMatch(a.createdBy));
        // Filter by global academic year
        const currentGlobalAcademicYear = globalAcademicYear;
        if (currentGlobalAcademicYear) {
            filteredAssignments = filteredAssignments.filter(a => (a.academicYear || '') === currentGlobalAcademicYear);
        }

        // Filter by global trimester
        const currentGlobalTrimester = window.getGlobalTrimester();
        if (currentGlobalTrimester) {
            filteredAssignments = filteredAssignments.filter(a => (a.trimester || '') === currentGlobalTrimester);
        }
        if (selectedClass) {
            filteredAssignments = filteredAssignments.filter(a => a.className === selectedClass);
        } else {
            const classFilterSet = new Set(filteredStudents.map(s => (s.className || '').trim()).filter(Boolean));
            filteredAssignments = filteredAssignments.filter(a => classFilterSet.has(a.className));
        }
        if (summaryAssignmentFilter && summaryAssignmentFilter.size > 0) {
            filteredAssignments = filteredAssignments.filter(a => summaryAssignmentFilter.has(a.id));
        }
        if (summaryAssignmentFilter && summaryAssignmentFilter.size > 0 && !selectedClass) {
            const allowedClasses = new Set(filteredAssignments.map(a => (a.className || '').trim()).filter(c => c.length > 0));
            filteredStudents = filteredStudents.filter(s => allowedClasses.has((s.className || '').trim()));
        }

        if (filteredStudents.length === 0 || filteredAssignments.length === 0) {
            alert(t.noResultForSearch || 'Aucun résultat');
            return;
        }

        if (!window.summaryAssignmentOrder) {
            try {
                window.summaryAssignmentOrder = JSON.parse(localStorage.getItem('summary-assignment-order') || '[]');
            } catch (e) { window.summaryAssignmentOrder = []; }
        }
        const ids = filteredAssignments.map(a => a.id);
        const set = new Set(window.summaryAssignmentOrder);
        ids.forEach(id => { if (!set.has(id)) window.summaryAssignmentOrder.push(id); });
        filteredAssignments = filteredAssignments.slice().sort((a, b) => {
            const oa = window.summaryAssignmentOrder.indexOf(a.id);
            const ob = window.summaryAssignmentOrder.indexOf(b.id);
            if (oa === -1 && ob === -1) return 0;
            if (oa === -1) return 1;
            if (ob === -1) return -1;
            return oa - ob;
        });

        const wb = window.XLSX.utils.book_new();

        const usedSheetNames = new Set();
        const sanitizeSheetName = (name) => {
            let sanitized = (name || '').toString().trim();
            const replacements = {
                'أولى ثانوي': '1',
                'اولى ثانوي': '1',
                'ثانية  ثانوي': '2',
                'ثالثة  ثانوي': '3',
            };
            for (const [key, value] of Object.entries(replacements)) {
                const regex = new RegExp(key, 'gi');
                sanitized = sanitized.replace(regex, value);
            }
            sanitized = sanitized.replace(/[\\\/\?\*\[\]:]/g, '');
            sanitized = sanitized.replace(/\s+/g, ' ').trim();
            if (sanitized.length > 31) {
                sanitized = sanitized.substring(0, 31).trim();
            }
            if (!sanitized) {
                sanitized = 'Feuille';
            }
            let finalName = sanitized;
            let counter = 1;
            while (usedSheetNames.has(finalName)) {
                const suffix = `_${counter}`;
                const maxLength = 31 - suffix.length;
                finalName = sanitized.substring(0, maxLength).trim() + suffix;
                counter++;
            }
            usedSheetNames.add(finalName);
            return finalName;
        };

        const studentsByClass = new Map();
        for (const s of filteredStudents) {
            const className = (s.className || '').trim() || '(Sans classe)';
            if (!studentsByClass.has(className)) {
                studentsByClass.set(className, []);
            }
            studentsByClass.get(className).push(s);
        }

        const sortedClasses = Array.from(studentsByClass.keys()).sort((a, b) =>
            a.localeCompare(b, 'fr', { sensitivity: 'base' })
        );

        const headerBase = ['رقم التعريف', 'اللقب', 'الاسم', 'تاريخ الميلاد'];
        const showDetails = document.getElementById('show-details')?.checked || false;

        for (const cls of sortedClasses) {
            const stu = studentsByClass.get(cls) || [];
            const assigns = filteredAssignments.filter(a =>
                (a.className || '').trim() === cls.trim() ||
                (cls === '(Sans classe)' && !(a.className || '').trim())
            );

            if (stu.length === 0) continue;

            const header = [...headerBase];
            if (assigns.length > 0) {
                for (const a of assigns) {
                    if (showDetails && a.exercises) {
                        for (let i = 0; i < a.exercises.length; i++) {
                            const ex = a.exercises[i];
                            const exLabel = ex.name && ex.name !== 'Global' ? ex.name : `Ex${i + 1}`;
                            header.push(`${a.name} - ${exLabel}`);
                        }
                    }
                    header.push(showDetails ? `${a.name} (Total)` : a.name);
                }
            }

            const rows = [header];

            for (const s of stu) {
                const birthDate = window.formatDate ? window.formatDate(window.parseDateMaybeExcel(s.birthDate || '')) : (s.birthDate || '');
                const rowData = [
                    s.nin || '',
                    s.lastName || '',
                    s.firstName || '',
                    birthDate
                ];

                for (const a of assigns) {
                    if (showDetails && a.exercises) {
                        const studentGrades = data.grades?.[s.id]?.[a.id] || {};
                        for (const ex of a.exercises) {
                            if (gradesSvc.hasAnyGradeForExercise(studentGrades, ex)) {
                                const ev = gradesSvc.getStudentExerciseTotal(studentGrades, ex);
                                rowData.push(typeof ev === 'number' ? ev : '');
                            } else {
                                rowData.push('');
                            }
                        }
                    }
                    const v = window.getStudentAssignmentTotal(s.id, a.id);
                    rowData.push(typeof v === 'number' ? v : '');
                }

                rows.push(rowData);
            }

            // Add Averages and Medians Row
            if (stu.length > 0 && assigns.length > 0) {
                const avgRow = ['', t.average || 'Moyenne', '', ''];
                const medianRow = ['', t.median || 'Médiane', '', ''];
                
                const firstGradeColIndex = 4;
                const totalCols = header.length;
                
                for (let colIndex = firstGradeColIndex; colIndex < totalCols; colIndex++) {
                    let sum = 0;
                    let values = [];
                    
                    for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
                        const val = rows[rowIndex][colIndex];
                        if (typeof val === 'number') {
                            sum += val;
                            values.push(val);
                        }
                    }
                    
                    if (values.length > 0) {
                        // Average
                        avgRow.push(Math.round((sum / values.length) * 100) / 100);
                        
                        // Median
                        values.sort((a, b) => a - b);
                        const mid = Math.floor(values.length / 2);
                        const median = values.length % 2 !== 0 
                            ? values[mid] 
                            : (values[mid - 1] + values[mid]) / 2;
                        medianRow.push(Math.round(median * 100) / 100);
                    } else {
                        avgRow.push('');
                        medianRow.push('');
                    }
                }
                rows.push(avgRow);
                rows.push(medianRow);
            }

            const ws = window.XLSX.utils.aoa_to_sheet(rows);
            const sheetName = sanitizeSheetName(cls);
            window.XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }

        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const fname = `recap-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.xlsx`;

        window.XLSX.writeFile(wb, fname);
    };



    window.renderSummary1 = async function() {
        if (!getTranslations() || !getLang() || !getTranslations()[getLang()]) return;
        const t = getTranslations()[getLang()];
        const container = document.getElementById('summary-table');
        if (!container) return;
        const detailsCheckbox = document.getElementById('show-details');
        let showDetails = detailsCheckbox ? detailsCheckbox.checked : false;
        const classSelect = document.getElementById('select-class-summary');
        const searchInput = document.getElementById('summary-search');
        const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const data = getData();

        let selectedClass = classSelect ? classSelect.value : '';
        
        // --- MODÈLE COLLABORATIF : Récupération des classes ---
        let sharedClasses = [];
        if (window.store && typeof window.store.getSharedClasses === 'function') {
            sharedClasses = await window.store.getSharedClasses(true);
        }

        let localClasses = new Set();
        const globalUserId = window.currentUser?.email || window.currentUser?.id || 'unknown';
        const globalAcademicYear = window.getGlobalAcademicYear();
        
        data.students.forEach(s => {
            if ((s.importedBy || 'unknown') === globalUserId && (s.academicYear || '') === globalAcademicYear) {
                if (s.className) localClasses.add(s.className);
            }
        });

        const matchingClasses = Array.from(new Set([...localClasses, ...sharedClasses]))
            .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

        if (classSelect) {
            const previousValue = selectedClass;
            classSelect.innerHTML = `<option value="">-- ${t.selectClass} --</option>` +
                matchingClasses.map(c => `<option value="${c}" ${c === previousValue ? 'selected' : ''}>${c}</option>`).join('');

            if (matchingClasses.includes(previousValue)) {
                classSelect.value = previousValue;
            } else {
                classSelect.value = '';
            }
            selectedClass = classSelect.value;
        }

        // --- Récupération des élèves fusionnés ---
        let filteredStudents = [];
        if (selectedClass) {
            let localStudents = data.students.filter(s => 
                s.className === selectedClass && 
                (s.importedBy || 'unknown') === globalUserId && 
                (s.academicYear || '') === globalAcademicYear
            );
            
            let sharedStudents = [];
            if (window.store && typeof window.store.getSharedStudents === 'function') {
                sharedStudents = await window.store.getSharedStudents(selectedClass);
            }

            const studentMap = new Map();
            localStudents.forEach(s => studentMap.set(s.id, s));
            sharedStudents.forEach(s => {
                const existing = Array.from(studentMap.values()).find(ls => ls.id === s.id || (ls.regNumber && ls.regNumber === s.regNumber));
                if (!existing) studentMap.set(s.id, s);
            });
            filteredStudents = Array.from(studentMap.values());
        } else {
            // All students for all matching classes
            const studentMap = new Map();
            
            // Local
            data.students.forEach(s => {
                if ((s.importedBy || 'unknown') === globalUserId && (s.academicYear || '') === globalAcademicYear && matchingClasses.includes(s.className)) {
                    studentMap.set(s.id, s);
                }
            });
            
            // Shared (one by one for each matching class)
            for (const c of sharedClasses) {
                if (window.store && typeof window.store.getSharedStudents === 'function') {
                    const shared = await window.store.getSharedStudents(c);
                    shared.forEach(s => {
                        const existing = Array.from(studentMap.values()).find(ls => ls.id === s.id || (ls.regNumber && ls.regNumber === s.regNumber));
                        if (!existing) studentMap.set(s.id, s);
                    });
                }
            }
            filteredStudents = Array.from(studentMap.values());
        }

        // Masquer les élèves archivés
        filteredStudents = filteredStudents.filter(s => s.status !== 'archived');

        if (searchTerm) {
            filteredStudents = filteredStudents.filter(s => {
                const haystack = `${s.name || ''} ${s.firstName || ''} ${s.lastName || ''} ${s.className || ''}`.toLowerCase();
                return haystack.includes(searchTerm);
            });
        }

        let filteredAssignments = data.assignments.slice();

        // Filter by user
        filteredAssignments = filteredAssignments.filter(a => (a.createdBy || 'unknown') === globalUserId);

        // Apply global academic year filter
        if (globalAcademicYear) {
            filteredAssignments = filteredAssignments.filter(a => (a.academicYear || '') === globalAcademicYear);
        } else {
            // If no academic year selected, hide all assignments
            filteredAssignments = [];
        }

        // Apply global trimester filter
        const globalTrimester = window.getGlobalTrimester();
        if (globalTrimester) {
            filteredAssignments = filteredAssignments.filter(a => (a.trimester || '') === globalTrimester);
        } else {
            // If no trimester selected, hide all assignments
            filteredAssignments = [];
        }

        if (selectedClass) {
            filteredAssignments = filteredAssignments.filter(a => a.className === selectedClass);
        } else {
            const classFilterSet = new Set(matchingClasses);
            filteredAssignments = filteredAssignments.filter(a => classFilterSet.has(a.className));
        }

        const allRelevantAssignments = [...filteredAssignments];

        const sortAssignments = (arr) => {
            arr.sort((a, b) => {
                const oa = window.summaryAssignmentOrder.indexOf(a.id);
                const ob = window.summaryAssignmentOrder.indexOf(b.id);
                if (oa === -1 && ob === -1) return 0;
                if (oa === -1) return 1;
                if (ob === -1) return -1;
                return oa - ob;
            });
        };

        if (summaryAssignmentFilter && summaryAssignmentFilter.size > 0) {
            filteredAssignments = filteredAssignments.filter(a => summaryAssignmentFilter.has(a.id));
        }

        if (summaryAssignmentFilter && summaryAssignmentFilter.size > 0 && !selectedClass) {
            const allowedClasses = new Set(filteredAssignments.map(a => (a.className || '').trim()).filter(c => c.length > 0));
            filteredStudents = filteredStudents.filter(s => allowedClasses.has((s.className || '').trim()));
        }

        if (!window.summaryAssignmentOrder) {
            try {
                window.summaryAssignmentOrder = JSON.parse(localStorage.getItem('summary-assignment-order') || '[]');
            } catch (e) { window.summaryAssignmentOrder = []; }
        }
        const ensureOrderIds = () => {
            const ids = allRelevantAssignments.map(a => a.id);
            const set = new Set(window.summaryAssignmentOrder);
            ids.forEach(id => { if (!set.has(id)) window.summaryAssignmentOrder.push(id); });
        };
        ensureOrderIds();

        const classesInOrder = Array.from(new Set(
            filteredStudents.map(s => (s.className || '').trim())
        )).filter(c => c.length > 0).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

        const assignmentsByClass = {};
        const allRelevantAssignmentsByClass = {};

        classesInOrder.forEach(className => {
            const trimmedClass = className.trim();
            assignmentsByClass[trimmedClass] = filteredAssignments
                .filter(a => (a.className || '').trim() === trimmedClass)
                .sort((a, b) => {
                    const oa = window.summaryAssignmentOrder.indexOf(a.id);
                    const ob = window.summaryAssignmentOrder.indexOf(b.id);
                    if (oa === -1 && ob === -1) return 0;
                    if (oa === -1) return 1;
                    if (ob === -1) return -1;
                    return oa - ob;
                });
            allRelevantAssignmentsByClass[trimmedClass] = allRelevantAssignments
                .filter(a => (a.className || '').trim() === trimmedClass)
                .sort((a, b) => {
                    const oa = window.summaryAssignmentOrder.indexOf(a.id);
                    const ob = window.summaryAssignmentOrder.indexOf(b.id);
                    if (oa === -1 && ob === -1) return 0;
                    if (oa === -1) return 1;
                    if (ob === -1) return -1;
                    return oa - ob;
                });
        });

        const orderedAssignments = [];
        classesInOrder.forEach(className => {
            orderedAssignments.push(...(assignmentsByClass[className] || []));
        });

        const isAllStudents = !selectedClass && !searchTerm && filteredStudents.length === data.students.length;
        const assignmentsFiltered = (summaryAssignmentFilter && summaryAssignmentFilter.size > 0) || filteredAssignments.length < data.assignments.length;
        if (detailsCheckbox) {
            const shouldDisableDetails = isAllStudents && !assignmentsFiltered;
            if (shouldDisableDetails) {
                detailsCheckbox.checked = false;
                detailsCheckbox.disabled = true;
            } else {
                detailsCheckbox.disabled = false;
            }
            showDetails = detailsCheckbox.checked;
        }

        if (filteredStudents.length === 0 || orderedAssignments.length === 0) {
            let emptyMessage = '';
            if (selectedClass) {
                emptyMessage = `${t.noStudentOrAssignmentForClass} "${selectedClass}".`;
            } else if (searchTerm) {
                emptyMessage = t.noResultForSearch;
            } else {
                emptyMessage = t.addStudentsAndAssignmentsToSeeSummary;
            }
            container.innerHTML = `<p class="text-gray-500 text-center py-8">${emptyMessage}</p>`;
            return;
        }

        filteredStudents.sort((a, b) => {
            const classA = (a.className || '').toLowerCase();
            const classB = (b.className || '').toLowerCase();
            if (classA !== classB) {
                return classA.localeCompare(classB, 'fr', { sensitivity: 'base' });
            }
            if (summarySort.key === 'name') {
                const nameA = (a.lastName || a.name || '').toLowerCase();
                const nameB = (b.lastName || b.name || '').toLowerCase();
                
                if (nameA.localeCompare(nameB) !== 0) {
                     return summarySort.direction === 'asc' 
                        ? nameA.localeCompare(nameB) 
                        : nameB.localeCompare(nameA);
                }
                
                const firstA = (a.firstName || '').toLowerCase();
                const firstB = (b.firstName || '').toLowerCase();
                return summarySort.direction === 'asc'
                    ? firstA.localeCompare(firstB)
                    : firstB.localeCompare(firstA);
            } else if (summarySort.key.startsWith('assignment-')) {
                const assignmentId = summarySort.key.split('assignment-')[1];
                const ta = window.getStudentAssignmentTotal(a.id, assignmentId);
                const tb = window.getStudentAssignmentTotal(b.id, assignmentId);
                if (ta < tb) return summarySort.direction === 'asc' ? -1 : 1;
                if (ta > tb) return summarySort.direction === 'asc' ? 1 : -1;
                return 0;
            }
            return 0;
        });

        const tagContainer = document.getElementById('summary-assignment-tags');
        if (tagContainer) {
            let tagHtml = '';
            classesInOrder.forEach(className => {
                const classAssignments = allRelevantAssignmentsByClass[className.trim()] || [];
                if (classAssignments.length === 0) return;
                const classColor = window.getClassColor(className);
                tagHtml += `<div class="flex flex-wrap items-center gap-1 p-2 bg-gray-100 rounded mb-2">
                    <span class="font-bold text-sm mr-2" style="color: ${classColor}">${className}:</span>`;
                classAssignments.forEach(a => {
                    const selected = summaryAssignmentFilter.has(a.id);
                    tagHtml += `
                        <div class="assignment-tag-wrapper flex items-center gap-1" 
                             draggable="true" 
                             ondragstart="handleAssignmentDragStart(event, '${a.id}')"
                             ondragend="handleAssignmentDragEnd(event)"
                             ondragover="handleAssignmentDragOver(event, '${a.id}')"
                             onmouseleave="handleAssignmentDragLeave(event)"
                             ondragleave="handleAssignmentDragLeave(event)"
                             ondrop="handleAssignmentDrop(event, '${a.id}')">
                            <button class="assignment-tag ${selected ? 'selected' : ''}" 
                                    onclick="toggleSummaryAssignmentTag('${a.id}')"
                                    style="${selected ? `background-color: ${classColor}; border-color: ${classColor}; color: white;` : `border-color: ${classColor}; color: ${classColor};`}"
                                    title="${t.dragToReorder || 'Glisser pour réorganiser'}">
                                ${a.name}
                            </button>
                        </div>`;
                });
                tagHtml += `</div>`;
            });
            tagContainer.innerHTML = tagHtml;
            tagContainer.className = "flex flex-wrap gap-2 mb-4 p-2 bg-gray-50 rounded-lg assignment-tag-container";
        }
        let html = '';

        for (const className of classesInOrder) {
            const classStudents = filteredStudents.filter(s => (s.className || '').trim() === className);
            const classAssignments = assignmentsByClass[className] || [];
            if (classStudents.length === 0) continue;

            const classColor = window.getClassColor ? window.getClassColor(className) : '#2563eb';

            html += `<div class="mb-8 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">`;
            html += `<div class="px-4 py-3 text-white font-bold flex items-center justify-between" style="background:${classColor}">
                <span>📚 ${className}</span>
                <span class="text-xs sm:text-sm font-semibold opacity-90">${classStudents.length} ${t.students} • ${classAssignments.length} ${t.assignments}</span>
            </div>`;

            if (classAssignments.length === 0) {
                html += `<div class="p-6 text-center text-slate-500">${t.noAssignments || 'Aucun devoir'}</div>`;
                html += `</div>`;
                continue;
            }

            const colgroup = (() => {
                let cols = '<col style="width:230px">';
                for (const a of classAssignments) {
                    if (showDetails) {
                        const exCount = (a.exercises || []).length;
                        for (let i = 0; i < exCount; i++) cols += '<col style="width:88px">';
                    }
                    cols += '<col style="width:110px">';
                }
                return `<colgroup>${cols}</colgroup>`;
            })();

            let assignmentHeaderRow = `<th class="p-3 text-left bg-slate-100 sticky left-0 z-10 cursor-pointer select-none border-r border-slate-200" onclick="toggleSummarySort('name')">${t.student}</th>`;
            classAssignments.forEach(a => {
                if (showDetails) {
                    a.exercises.forEach((ex, exIdx) => {
                        assignmentHeaderRow += `<th class="p-2 text-center bg-slate-50 text-xs font-semibold border-l border-slate-200">Ex${exIdx + 1}<br><span class="text-[10px] text-slate-500">/${window.getExerciseMaxPoints(ex)}</span></th>`;
                    });
                }
                const isBlocked = window.isTrimesterBlocked && window.isTrimesterBlocked(a.trimester, a.academicYear);
                const assignmentLabel = isBlocked ? `🔒 ${a.name}` : a.name;
                assignmentHeaderRow += `<th class="p-3 text-center bg-slate-100 font-bold cursor-pointer select-none border-l border-slate-200" onclick="toggleSummarySort('assignment-${a.id}')">${assignmentLabel}<br><span class="text-xs text-slate-500">/${window.getAssignmentMaxPoints(a)}</span></th>`;
            });

            const rows = classStudents.map(s => {
                let row = `<td class="p-3 font-medium bg-slate-50 sticky left-0 z-5 border-r border-slate-200">${truncateStudentName(s)}</td>`;
                classAssignments.forEach(a => {
                    const studentGrades = data.grades[s.id]?.[a.id] || {};
                    if (showDetails) {
                        a.exercises.forEach((ex, exIdx) => {
                            const exTotal = window.getStudentExerciseTotal(studentGrades, ex);
                            const max = window.getExerciseMaxPoints(ex);
                            const existingFinal = studentGrades[ex.id]?.['final']?.['final']?.['final'];
                            const hasEx = window.hasAnyGradeForExercise(studentGrades, ex);
                            const val = existingFinal !== undefined && existingFinal !== '' ? existingFinal : (hasEx ? exTotal.toFixed(2) : '');
                            const isBlocked = window.isTrimesterBlocked(a.trimester, a.academicYear);
                            if (isBlocked) {
                                row += `<td class="px-2 py-1 text-center border-l border-slate-200">
                                    <input type="text" value="${val}" disabled class="summary-grade-input opacity-50 cursor-not-allowed">
                                </td>`;
                            } else {
                                row += `<td class="px-2 py-1 text-center border-l border-slate-200">
                                    <input type="text" inputmode="decimal" pattern="[0-9]*[.,]?[0-9]*" 
                                        value="${val}" 
                                        oninput="sanitizeAndClamp(this, ${max})" 
                                        onblur="commitSummaryInput('${s.id}','${a.id}','${ex.id}', ${max}, this.value)" 
                                        onkeydown="handleSummaryInputKey(event, '${s.id}','${a.id}','${ex.id}', ${max})" 
                                        onfocus="this.select()" 
                                        id="sum-input-${s.id}-${a.id}-${ex.id}" 
                                        name="sum-input-${s.id}-${a.id}-${ex.id}" 
                                        aria-label="Note Ex${exIdx + 1} pour ${s.name} - ${a.name}" 
                                        class="summary-grade-input">
                                </td>`;
                            }
                        });
                    }

                    const isBlocked = window.isTrimesterBlocked(a.trimester, a.academicYear);
                    if (has) {
                        const total = window.getStudentAssignmentTotal(s.id, a.id);
                        const pct = max > 0 ? (total / max * 100) : 0;
                        const bgColor = pct >= 70 ? 'bg-emerald-100' : pct >= 50 ? 'bg-amber-100' : 'bg-rose-100';
                        row += `<td class="p-3 text-center font-bold ${bgColor} border-l border-slate-200 ${isBlocked ? 'cursor-default' : 'cursor-pointer select-none'}" 
                                    ${isBlocked ? '' : `ondblclick="window.makeTotalEditable(this, '${s.id}', '${a.id}', ${max})"`} 
                                    id="sum-total-${s.id}-${a.id}">${total.toFixed(2)}</td>`;
                    } else {
                        row += `<td class="p-3 text-center text-slate-300 border-l border-slate-200 ${isBlocked ? 'cursor-default' : 'cursor-pointer select-none'}" 
                                    ${isBlocked ? '' : `ondblclick="window.makeTotalEditable(this, '${s.id}', '${a.id}', ${max})"`} 
                                    id="sum-total-${s.id}-${a.id}"></td>`;
                    }
                });
                return `<tr class="border-b border-slate-100 hover:bg-slate-50">${row}</tr>`;
            }).join('');

            html += `<div class="overflow-x-auto"><table class="w-full table-fixed border-collapse">${colgroup}<thead><tr class="border-b-2 border-slate-200">${assignmentHeaderRow}</tr></thead><tbody>${rows}</tbody></table></div>`;
            html += `</div>`;
        }

        container.innerHTML = html;
        window.translatePage();
    };

    window.renderSummary2 = async function() {
        if (!getTranslations() || !getLang() || !getTranslations()[getLang()]) return;
        const t = getTranslations()[getLang()];
        const container = document.getElementById('summary-table');
        if (!container) return;
        const detailsCheckbox = document.getElementById('show-details');
        let showDetails = detailsCheckbox ? detailsCheckbox.checked : false;
        const classSelect = document.getElementById('select-class-summary');
        const searchInput = document.getElementById('summary-search');
        const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const data = getData();

        let selectedClass = classSelect ? classSelect.value : '';
        
        // --- MODÈLE COLLABORATIF : Récupération des classes ---
        let sharedClasses = [];
        if (window.store && typeof window.store.getSharedClasses === 'function') {
            sharedClasses = await window.store.getSharedClasses(true);
        }

        let localClasses = new Set();
        const globalUserId = window.currentUser?.email || window.currentUser?.id || 'unknown';
        const globalAcademicYear = window.getGlobalAcademicYear();
        
        data.students.forEach(s => {
            if ((s.importedBy || 'unknown') === globalUserId && (s.academicYear || '') === globalAcademicYear) {
                if (s.className) localClasses.add(s.className);
            }
        });

        const matchingClasses = Array.from(new Set([...localClasses, ...sharedClasses]))
            .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

        if (classSelect) {
            const previousValue = selectedClass;
            classSelect.innerHTML = `<option value="">-- ${t.selectClass} --</option>` +
                matchingClasses.map(c => `<option value="${c}" ${c === previousValue ? 'selected' : ''}>${c}</option>`).join('');

            if (matchingClasses.includes(previousValue)) {
                classSelect.value = previousValue;
            } else {
                classSelect.value = '';
            }
            selectedClass = classSelect.value;
        }

        // --- Récupération des élèves fusionnés ---
        let filteredStudents = [];
        if (selectedClass) {
            let localStudents = data.students.filter(s => 
                s.className === selectedClass && 
                (s.importedBy || 'unknown') === globalUserId && 
                (s.academicYear || '') === globalAcademicYear
            );
            
            let sharedStudents = [];
            if (window.store && typeof window.store.getSharedStudents === 'function') {
                sharedStudents = await window.store.getSharedStudents(selectedClass);
            }

            const studentMap = new Map();
            localStudents.forEach(s => studentMap.set(s.id, s));
            sharedStudents.forEach(s => {
                const existing = Array.from(studentMap.values()).find(ls => ls.id === s.id || (ls.regNumber && ls.regNumber === s.regNumber));
                if (!existing) studentMap.set(s.id, s);
            });
            filteredStudents = Array.from(studentMap.values());
        } else {
            // All students for all matching classes
            const studentMap = new Map();
            
            // Local
            data.students.forEach(s => {
                if ((s.importedBy || 'unknown') === globalUserId && (s.academicYear || '') === globalAcademicYear && matchingClasses.includes(s.className)) {
                    studentMap.set(s.id, s);
                }
            });
            
            // Shared (one by one for each matching class)
            for (const c of sharedClasses) {
                if (window.store && typeof window.store.getSharedStudents === 'function') {
                    const shared = await window.store.getSharedStudents(c);
                    shared.forEach(s => {
                        const existing = Array.from(studentMap.values()).find(ls => ls.id === s.id || (ls.regNumber && ls.regNumber === s.regNumber));
                        if (!existing) studentMap.set(s.id, s);
                    });
                }
            }
            filteredStudents = Array.from(studentMap.values());
        }

        // Masquer les élèves archivés
        filteredStudents = filteredStudents.filter(s => s.status !== 'archived');

        if (searchTerm) {
            filteredStudents = filteredStudents.filter(s => {
                const haystack = `${s.name || ''} ${s.firstName || ''} ${s.lastName || ''} ${s.className || ''}`.toLowerCase();
                return haystack.includes(searchTerm);
            });
        }

        let filteredAssignments = data.assignments.slice();

        // Filter by user
        filteredAssignments = filteredAssignments.filter(a => (a.createdBy || 'unknown') === globalUserId);

        // Apply global academic year filter
        if (globalAcademicYear) {
            filteredAssignments = filteredAssignments.filter(a => (a.academicYear || '') === globalAcademicYear);
        } else {
            // If no academic year selected, hide all assignments
            filteredAssignments = [];
        }

        // Apply global trimester filter
        const globalTrimester = window.getGlobalTrimester();
        if (globalTrimester) {
            filteredAssignments = filteredAssignments.filter(a => (a.trimester || '') === globalTrimester);
        } else {
            // If no trimester selected, hide all assignments
            filteredAssignments = [];
        }

        if (selectedClass) {
            filteredAssignments = filteredAssignments.filter(a => a.className === selectedClass);
        } else {
            const classFilterSet = new Set(matchingClasses);
            filteredAssignments = filteredAssignments.filter(a => classFilterSet.has(a.className));
        }

        const allRelevantAssignments = [...filteredAssignments];

        const sortAssignments = (arr) => {
            arr.sort((a, b) => {
                const oa = window.summaryAssignmentOrder.indexOf(a.id);
                const ob = window.summaryAssignmentOrder.indexOf(b.id);
                if (oa === -1 && ob === -1) return 0;
                if (oa === -1) return 1;
                if (ob === -1) return -1;
                return oa - ob;
            });
        };

        if (summaryAssignmentFilter && summaryAssignmentFilter.size > 0) {
            filteredAssignments = filteredAssignments.filter(a => summaryAssignmentFilter.has(a.id));
        }

        if (summaryAssignmentFilter && summaryAssignmentFilter.size > 0 && !selectedClass) {
            const allowedClasses = new Set(filteredAssignments.map(a => (a.className || '').trim()).filter(c => c.length > 0));
            filteredStudents = filteredStudents.filter(s => allowedClasses.has((s.className || '').trim()));
        }

        if (!window.summaryAssignmentOrder) {
            try {
                window.summaryAssignmentOrder = JSON.parse(localStorage.getItem('summary-assignment-order') || '[]');
            } catch (e) { window.summaryAssignmentOrder = []; }
        }
        const ensureOrderIds = () => {
            const ids = allRelevantAssignments.map(a => a.id);
            const set = new Set(window.summaryAssignmentOrder);
            ids.forEach(id => { if (!set.has(id)) window.summaryAssignmentOrder.push(id); });
        };
        ensureOrderIds();
        sortAssignments(filteredAssignments);
        sortAssignments(allRelevantAssignments);

        const isAllStudents = !selectedClass && !searchTerm && filteredStudents.length === data.students.length;
        const assignmentsFiltered = (summaryAssignmentFilter && summaryAssignmentFilter.size > 0) || filteredAssignments.length < data.assignments.length;
        if (detailsCheckbox) {
            const shouldDisableDetails = isAllStudents && !assignmentsFiltered;
            if (shouldDisableDetails) {
                detailsCheckbox.checked = false;
                detailsCheckbox.disabled = true;
            } else {
                detailsCheckbox.disabled = false;
            }
            showDetails = detailsCheckbox.checked;
        }

        if (filteredStudents.length === 0 || filteredAssignments.length === 0) {
            let emptyMessage = '';
            if (selectedClass) {
                emptyMessage = `${t.noStudentOrAssignmentForClass} "${selectedClass}".`;
            } else if (searchTerm) {
                emptyMessage = t.noResultForSearch;
            } else {
                emptyMessage = t.addStudentsAndAssignmentsToSeeSummary;
            }
            container.innerHTML = `<p class="text-gray-500 text-center py-8">${emptyMessage}</p>`;
            return;
        }

        const studentsByClass = {};
        for (const student of filteredStudents) {
            const className = (student.className || '').trim() || '(Sans classe)';
            if (!studentsByClass[className]) {
                studentsByClass[className] = [];
            }
            studentsByClass[className].push(student);
        }

        const assignmentsByClass = {};
        for (const assignment of filteredAssignments) {
            const className = (assignment.className || '').trim() || '(Sans classe)';
            if (!assignmentsByClass[className]) {
                assignmentsByClass[className] = [];
            }
            assignmentsByClass[className].push(assignment);
        }

        const orderedClasses = Object.keys(studentsByClass).sort((a, b) =>
            a.localeCompare(b, 'fr', { sensitivity: 'base' })
        );

        for (const className of orderedClasses) {
            studentsByClass[className].sort((a, b) => {
                if (summarySort.key === 'name') {
                    const na = (a.name || '').toLowerCase();
                    const nb = (b.name || '').toLowerCase();
                    if (na < nb) return summarySort.direction === 'asc' ? -1 : 1;
                    if (na > nb) return summarySort.direction === 'asc' ? 1 : -1;
                    return 0;
                } else if (summarySort.key.startsWith('assignment-')) {
                    const assignmentId = summarySort.key.split('assignment-')[1];
                    const ta = window.getStudentAssignmentTotal(a.id, assignmentId);
                    const tb = window.getStudentAssignmentTotal(b.id, assignmentId);
                    if (ta < tb) return summarySort.direction === 'asc' ? -1 : 1;
                    if (ta > tb) return summarySort.direction === 'asc' ? 1 : -1;
                    return 0;
                }
                return 0;
            });
        }

        const tagContainer = document.getElementById('summary-assignment-tags');
        if (tagContainer) {
            const tagHtml = allRelevantAssignments.map(a => {
                const selected = summaryAssignmentFilter.has(a.id);
                const classColor = window.getClassColor(a.className);
                return `
                    <div class="assignment-tag-wrapper flex items-center gap-1" 
                         draggable="true" 
                         ondragstart="handleAssignmentDragStart(event, '${a.id}')"
                         ondragend="handleAssignmentDragEnd(event)"
                         ondragover="handleAssignmentDragOver(event, '${a.id}')"
                         onmouseleave="handleAssignmentDragLeave(event)"
                         ondragleave="handleAssignmentDragLeave(event)"
                         ondrop="handleAssignmentDrop(event, '${a.id}')">
                        <button class="assignment-tag ${selected ? 'selected' : ''}" 
                                onclick="toggleSummaryAssignmentTag('${a.id}')"
                                style="${selected ? `background-color: ${classColor}; border-color: ${classColor}; color: white;` : `border-color: ${classColor}; color: ${classColor};`}"
                                title="${t.dragToReorder || 'Glisser pour réorganiser'}">
                            ${a.name} <span class="text-xs opacity-70">(${a.className || '?'})</span>
                        </button>
                    </div>`;
            }).join('');
            tagContainer.innerHTML = tagHtml;
            tagContainer.className = "flex flex-wrap gap-2 mb-4 p-2 bg-gray-50 rounded-lg assignment-tag-container";
        }

        let html = '';

        for (const className of orderedClasses) {
            const classStudents = studentsByClass[className] || [];
            const classAssignments = assignmentsByClass[className] || [];

            if (classStudents.length === 0) continue;

            html += `<div class="mb-8">`;
            html += `<div class="bg-blue-600 text-white font-bold p-3 text-lg rounded-t-lg flex items-center justify-between">
                    <span>📚 ${className}</span>
                    <span class="text-sm font-normal opacity-80">${classStudents.length} ${t.students} </span>
                </div>`;

            if (classAssignments.length === 0) {
                html += `<div class="bg-gray-50 border border-t-0 border-gray-200 p-4 text-center text-gray-500 rounded-b-lg">
        Aucun devoir pour cette classe
    </div>`;
                html += `</div>`;
                continue;
            }

            const colgroup = (() => {
                let cols = '<col style="width:200px">';
                for (const a of classAssignments) {
                    if (showDetails) {
                        const exCount = (a.exercises || []).length;
                        for (let i = 0; i < exCount; i++) cols += '<col style="width:70px">';
                    }
                    cols += '<col style="width:90px">';
                }
                return `<colgroup>${cols}</colgroup>`;
            })();
    

            html += `<div class="overflow-x-auto border border-t-0 border-gray-200 rounded-b-lg">`;
            html += `<table class="w-full table-fixed border-collapse">`;
            html += colgroup;

            html += `<thead><tr class="border-b-2 bg-gray-50">`;
            html += `<th class="p-3 text-left bg-gray-100 sticky left-0 z-10 cursor-pointer select-none hover:bg-gray-200" onclick="toggleSummarySort('name')">
    ${t.student} ${summarySort.key === 'name' ? (summarySort.direction === 'asc' ? '↑' : '↓') : ''}
</th>`;

            for (const a of classAssignments) {
                if (showDetails) {
                    for (let i = 0; i < a.exercises.length; i++) {
                        const ex = a.exercises[i];
                        html += `<th class="p-2 text-center bg-blue-50 text-sm border-l border-gray-200">
                Ex${i + 1}<br><span class="text-xs text-gray-500">/${window.getExerciseMaxPoints(ex)}</span>
            </th>`;
                    }
                }
                const isBlocked = window.isTrimesterBlocked && window.isTrimesterBlocked(a.trimester, a.academicYear);
                const assignmentLabel = isBlocked ? `🔒 ${a.name}` : a.name;
                const isSorted = summarySort.key === `assignment-${a.id}`;
                html += `<th class="p-3 text-center bg-blue-100 font-bold cursor-pointer select-none hover:bg-blue-200 border-l border-gray-300" 
        onclick="toggleSummarySort('assignment-${a.id}')">
        ${assignmentLabel} ${isSorted ? (summarySort.direction === 'asc' ? '↑' : '↓') : ''}
        <br><span class="text-xs font-normal">/${window.getAssignmentMaxPoints(a)}</span>
    </th>`;
            }
            html += `</tr></thead>`;

            html += `<tbody>`;
            for (const s of classStudents) {
                html += `<tr class="border-b hover:bg-gray-50">`;
                html += `<td class="p-3 font-medium bg-gray-50 sticky left-0 border-r border-gray-200">${s.name}</td>`;

                for (const a of classAssignments) {
                    const studentGrades = data.grades[s.id]?.[a.id] || {};

                    if (showDetails) {
                        for (let i = 0; i < a.exercises.length; i++) {
                            const ex = a.exercises[i];
                            const exTotal = window.getStudentExerciseTotal(studentGrades, ex);
                            const max = window.getExerciseMaxPoints(ex);
                            const existingFinal = studentGrades[ex.id]?.['final']?.['final']?.['final'];
                            const hasEx = window.hasAnyGradeForExercise(studentGrades, ex);
                            const val = existingFinal !== undefined && existingFinal !== '' ? existingFinal : (hasEx ? exTotal.toFixed(2) : '');
                            const isBlocked = window.isTrimesterBlocked(a.trimester, a.academicYear);
                            if (isBlocked) {
                                html += `<td class="px-2 py-1 text-center border-l border-gray-100">
                                    <input type="text" value="${val}" disabled class="summary-grade-input opacity-50 cursor-not-allowed">
                                </td>`;
                            } else {
                                html += `<td class="px-2 py-1 text-center border-l border-gray-100">
                                    <input type="text" 
                                        inputmode="decimal" 
                                        pattern="[0-9]*[.,]?[0-9]*" 
                                        value="${val}" 
                                        oninput="sanitizeAndClamp(this, ${max})" 
                                        onblur="commitSummaryInput('${s.id}','${a.id}','${ex.id}', ${max}, this.value)" 
                                        onkeydown="handleSummaryInputKey(event, '${s.id}','${a.id}','${ex.id}', ${max})" 
                                        onfocus="this.select()" 
                                        id="sum-input-${s.id}-${a.id}-${ex.id}" 
                                        name="sum-input-${s.id}-${a.id}-${ex.id}" 
                                        aria-label="Note Ex${i + 1} pour ${s.name} - ${a.name}" 
                                        class="summary-grade-input">
                                </td>`;
                            }
                        }
                    }

                    const isBlocked = window.isTrimesterBlocked(a.trimester, a.academicYear);
                    if (has) {
                        const total = window.getStudentAssignmentTotal(s.id, a.id);
                        const pct = max > 0 ? (total / max * 100) : 0;
                        const bgColor = pct >= 70 ? 'bg-green-100' : pct >= 50 ? 'bg-orange-100' : 'bg-red-100';
                        html += `<td class="p-3 text-center font-bold ${bgColor} border-l border-gray-300 ${isBlocked ? 'cursor-default' : 'cursor-pointer select-none'}" 
                                    ${isBlocked ? '' : `ondblclick="window.makeTotalEditable(this, '${s.id}', '${a.id}', ${max})"`} 
                                    id="sum-total-${s.id}-${a.id}">${total.toFixed(2)}</td>`;
                    } else {
                        html += `<td class="p-3 text-center text-gray-300 border-l border-gray-300 ${isBlocked ? 'cursor-default' : 'cursor-pointer select-none'}" 
                                    ${isBlocked ? '' : `ondblclick="window.makeTotalEditable(this, '${s.id}', '${a.id}', ${max})"`} 
                                    id="sum-total-${s.id}-${a.id}"></td>`;
                    }
                }

                html += `</tr>`;
            }

            // Average row
            html += `<tr class="bg-gray-100 font-semibold border-t-2">`;
            html += `<td class="p-3 sticky left-0 border-r border-gray-200">${t.average || 'Moyenne'}</td>`;
            for (const a of classAssignments) {
                if (showDetails) {
                    for (let i = 0; i < a.exercises.length; i++) {
                        html += `<td class="border-l border-gray-200"></td>`;
                    }
                }
                let sumTot = 0;
                let ct = 0;
                for (const s of classStudents) {
                    if (window.hasAnyGradeForAssignment(s.id, a.id)) {
                        sumTot += window.getStudentAssignmentTotal(s.id, a.id);
                        ct++;
                    }
                }
                const avgTotal = ct > 0 ? (sumTot / ct) : null;
                const max = window.getAssignmentMaxPoints(a);
                const pct = avgTotal !== null && max > 0 ? (avgTotal / max * 100) : 0;
                const bgColor = avgTotal === null ? 'bg-gray-100' : (pct >= 70 ? 'bg-green-200' : pct >= 50 ? 'bg-orange-200' : 'bg-red-200');
                html += `<td class="p-3 text-center font-bold ${bgColor} border-l border-gray-300">${avgTotal === null ? '' : avgTotal.toFixed(2)}</td>`;
            }
            html += `</tr>`;

            // Median row
            html += `<tr class="bg-gray-100 font-semibold border-t">`;
            html += `<td class="p-3 sticky left-0 border-r border-gray-200">${t.median || 'Médiane'}</td>`;
            for (const a of classAssignments) {
                if (showDetails) {
                    for (let i = 0; i < a.exercises.length; i++) {
                        html += `<td class="border-l border-gray-200"></td>`;
                    }
                }
                let grades = [];
                for (const s of classStudents) {
                    if (window.hasAnyGradeForAssignment(s.id, a.id)) {
                        grades.push(window.getStudentAssignmentTotal(s.id, a.id));
                    }
                }
                const medTotal = calculateMedian(grades);
                const max = window.getAssignmentMaxPoints(a);
                const pct = medTotal !== null && max > 0 ? (medTotal / max * 100) : 0;
                const bgColor = medTotal === null ? 'bg-gray-100' : (pct >= 70 ? 'bg-green-200' : pct >= 50 ? 'bg-orange-200' : 'bg-red-200');
                html += `<td class="p-3 text-center font-bold ${bgColor} border-l border-gray-300">${medTotal === null ? '' : medTotal.toFixed(2)}</td>`;
            }
            html += `</tr>`;

            html += `</tbody></table>`;
            html += `</div></div>`;
        }



        container.innerHTML = html;
        if (window.translatePage) window.translatePage();
    };

    window.setGlobalAssignmentGrade = async function(studentId, assignmentId, value, originalText) {
        const newValueStr = value.toString().replace(',', '.').trim();
        const originalValueStr = originalText ? originalText.toString().replace(',', '.').trim() : "";
        
        // Security check: if the value hasn't changed, don't do anything (avoids clearing exercises by mistake)
        const isSameValue = newValueStr === originalValueStr || 
                           (newValueStr !== "" && originalValueStr !== "" && parseFloat(newValueStr) === parseFloat(originalValueStr));
        
        if (isSameValue) {
             // Just re-render to close the input without saving
             await window.renderSummary();
             return;
         }

         const data = getData();
         if (!data.grades[studentId]) data.grades[studentId] = {};
         
         // When setting a total grade directly, we clear all exercise details
         // and set the global grade for this assignment.
         const assignment = (data.assignments || []).find(a => a.id === assignmentId);
         if (assignment && window.isTrimesterBlocked(assignment.trimester, assignment.academicYear)) {
             alert(window.translations[window.currentLanguage].trimesterLockedAlert || "Ce trimestre est verrouillé.");
             await window.renderSummary();
             return;
         }
         const exercises = assignment ? (assignment.exercises || []) : [];
         
         const newGrade = {
             global: value === '' ? '' : (parseFloat(newValueStr) || 0)
         };
         
         // Completely remove exercise keys to ensure hasAnyGradeForExercise returns false
         // and the global grade is used as the only source of truth.
         data.grades[studentId][assignmentId] = newGrade;
         
         window.saveData();
         await window.renderSummary();
     };

    window.makeTotalEditable = function(td, studentId, assignmentId, maxPoints) {
        if (td.querySelector('input')) return;
        
        const assignment = (window.data.assignments || []).find(a => a.id === assignmentId);
        if (assignment && window.isTrimesterBlocked(assignment.trimester, assignment.academicYear)) {
            return;
        }
        
        // Get current value
        let currentVal = td.innerText.trim();
        
        td.innerHTML = `
            <input type="text" 
                   value="${currentVal}" 
                   class="w-16 p-1 text-center border rounded shadow-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                   style="font-size: 0.9em;"
                   onblur="window.setGlobalAssignmentGrade('${studentId}', '${assignmentId}', this.value, '${currentVal}')"
                   onkeydown="if(event.key==='Enter') this.blur()"
            >
        `;
        
        const input = td.querySelector('input');
        input.focus();
        input.select();
        
        // Prevent event propagation
        input.addEventListener('dblclick', (e) => e.stopPropagation());
    };

    window.setExerciseFinalGrade = async function(studentId, assignmentId, exId, max, value) {
        await window.applyExerciseFinalGrade(studentId, assignmentId, exId, max, value, true);
    };

    window.applyExerciseFinalGrade = async function(studentId, assignmentId, exId, max, value, rerender) {
        const data = getData();
        if (!data.grades[studentId]) data.grades[studentId] = {};
        if (!data.grades[studentId][assignmentId]) data.grades[studentId][assignmentId] = {};
        if (!data.grades[studentId][assignmentId][exId]) data.grades[studentId][assignmentId][exId] = {};
        
        const assignment = (data.assignments || []).find(a => a.id === assignmentId);
        if (assignment && window.isTrimesterBlocked(assignment.trimester, assignment.academicYear)) {
            console.warn("Attempted to edit locked trimester grade");
            return;
        }
        
        // Force 'global' mode when modified from summary
        data.grades[studentId][assignmentId][exId].mode = 'global';
        
        if (!data.grades[studentId][assignmentId][exId]['final']) data.grades[studentId][assignmentId][exId]['final'] = {};
        if (!data.grades[studentId][assignmentId][exId]['final']['final']) data.grades[studentId][assignmentId][exId]['final']['final'] = {};
        let v = value === '' ? '' : (parseFloat(value) || 0);
        if (v !== '' && v > max) v = max;
        if (v !== '' && v < 0) v = 0;
        data.grades[studentId][assignmentId][exId]['final']['final']['final'] = v;

        if (data.grades[studentId][assignmentId].global !== undefined && data.grades[studentId][assignmentId].global !== '') {
            data.grades[studentId][assignmentId].global = window.getStudentAssignmentTotal(studentId, assignmentId);
        }

        window.saveData();
        if (rerender) {
            await window.renderSummary();
        } else {
            window.updateSummaryTotalsInline(studentId, assignmentId);
        }
    };

    window.clampExerciseInput = function(el, max) {
        if (el.value === '') return;
        const str = el.value.toString();
        if (str.endsWith('.')) return;
        let v = parseFloat(str);
        if (isNaN(v)) return;
        if (v < 0) v = 0;
        if (v > max) v = max;
        el.value = v;
    };

    window.sanitizeAndClamp = function(el, max) {
        let val = (el.value || '').toString();
        val = val.replace(',', '.');
        val = val.replace(/[٫٬]/g, '.');
        val = val.replace(/[^0-9.]/g, '');
        const parts = val.split('.');
        if (parts.length > 2) {
            val = parts[0] + '.' + parts.slice(1).join('');
        }
        el.value = val;
        if (!val.endsWith('.')) window.clampExerciseInput(el, max);
    };

    window.commitSummaryInput = function(studentId, assignmentId, exId, max, value) {
        window.applyExerciseFinalGrade(studentId, assignmentId, exId, max, value, false);
    };

    window.handleSummaryInputKey = function(e, studentId, assignmentId, exId, max) {
        if (e.key === 'Enter') {
            e.preventDefault();
            window.commitSummaryInput(studentId, assignmentId, exId, max, e.target.value);
            const inputs = Array.from(document.querySelectorAll('.summary-grade-input'));
            const idx = inputs.indexOf(e.target);
            const nextIdx = idx + 1;
            if (nextIdx >= 0 && nextIdx < inputs.length) {
                inputs[nextIdx].focus();
                inputs[nextIdx].select?.();
            }
            return;
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            let v = parseFloat((e.target.value || '0').toString().replace(',', '.'));
            if (isNaN(v)) v = 0;
            const step = 0.25;
            v = e.key === 'ArrowUp' ? v + step : v - step;
            if (v < 0) v = 0;
            if (v > max) v = max;
            e.target.value = v.toFixed(2).replace(/\.00$/, '.0');
            window.commitSummaryInput(studentId, assignmentId, exId, max, e.target.value);
        }
    };

    window.updateSummaryTotalsInline = function(studentId, assignmentId) {
        const totalCell = document.getElementById(`sum-total-${studentId}-${assignmentId}`);
        if (!totalCell) return;
        const has = window.hasAnyGradeForAssignment(studentId, assignmentId);
        if (!has) {
            totalCell.textContent = '';
            totalCell.className = 'p-3 text-center text-gray-300';
            return;
        }
        const total = window.getStudentAssignmentTotal(studentId, assignmentId);
        const assignment = getData().assignments.find(a => a.id === assignmentId);
        const max = assignment ? window.getAssignmentMaxPoints(assignment) : 0;
        const pct = max > 0 ? (total / max * 100) : 0;
        let bgColor = 'bg-red-100';
        if (pct >= 70) bgColor = 'bg-green-100'; else if (pct >= 50) bgColor = 'bg-orange-100';
        totalCell.textContent = total.toFixed(2);
        totalCell.className = `p-3 text-center font-bold ${bgColor}`;
    };

    window.toggleSummarySort = function(key) {
        if (summarySort.key === key) {
            summarySort.direction = summarySort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            summarySort.key = key;
            summarySort.direction = key === 'name' ? 'asc' : 'desc';
        }
        window.renderSummary();
    };

    window.toggleSummaryAssignmentTag = function(assignmentId) {
        if (summaryAssignmentFilter.has(assignmentId)) {
            summaryAssignmentFilter.delete(assignmentId);
        } else {
            summaryAssignmentFilter.add(assignmentId);
        }
        window.renderSummary();
    };

    // Drag & Drop
    window.handleAssignmentDragStart = function(e, id) {
        draggedAssignmentId = id;
        e.target.closest('.assignment-tag-wrapper').classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
    };

    window.handleAssignmentDragEnd = function(e) {
        const draggingEl = document.querySelector('.assignment-tag-wrapper.dragging');
        if (draggingEl) draggingEl.classList.remove('dragging');
        document.querySelectorAll('.assignment-tag-wrapper').forEach(el => {
            el.classList.remove('drag-over-left', 'drag-over-right');
        });
    };

    window.handleAssignmentDragOver = function(e, id) {
        e.preventDefault();
        if (draggedAssignmentId === id) return;
        const target = e.target.closest('.assignment-tag-wrapper');
        const rect = target.getBoundingClientRect();
        const midpoint = rect.left + rect.width / 2;
        target.classList.remove('drag-over-left', 'drag-over-right');
        if (e.clientX < midpoint) {
            target.classList.add('drag-over-left');
        } else {
            target.classList.add('drag-over-right');
        }
        e.dataTransfer.dropEffect = 'move';
    };

    window.handleAssignmentDragLeave = function(e) {
        const target = e.target.closest('.assignment-tag-wrapper');
        if (target) {
            target.classList.remove('drag-over-left', 'drag-over-right');
        }
    };

    window.handleAssignmentDrop = function(e, targetId) {
        e.preventDefault();
        if (!draggedAssignmentId || draggedAssignmentId === targetId) return;
        const target = e.target.closest('.assignment-tag-wrapper');
        const rect = target.getBoundingClientRect();
        const midpoint = rect.left + rect.width / 2;
        const dropAfter = e.clientX >= midpoint;

        const arr = window.summaryAssignmentOrder || [];
        const fromIndex = arr.indexOf(draggedAssignmentId);
        let toIndex = arr.indexOf(targetId);

        if (fromIndex === -1 || toIndex === -1) return;
        arr.splice(fromIndex, 1);
        toIndex = arr.indexOf(targetId);
        if (dropAfter) toIndex++;
        arr.splice(toIndex, 0, draggedAssignmentId);

        localStorage.setItem('summary-assignment-order', JSON.stringify(arr));
        window.renderSummary();
    };

})();
