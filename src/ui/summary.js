
(function() {
    // State variables specific to Summary
    let currentSummaryMode = 'default';
    let summarySort = { key: 'name', direction: 'asc' };
    let summaryAssignmentFilter = new Set();
    let draggedAssignmentId = null;

    // Helper to access globals easily
    const getData = () => window.data;
    const getTranslations = () => window.translations;
    const getLang = () => window.currentLanguage;

    window.setSummaryMode = function(mode) {
        currentSummaryMode = mode;
        window.renderSummary();
    };

    window.renderSummary = function() {
        switch (currentSummaryMode) {
            case 'grouped':
                window.renderSummary2();
                break;
            case 'view1':
                window.renderSummary1();
                break;
            default:
                window.renderSummary0();
        }
    };

    window.renderSummary0 = function() {
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
        let searchMatches = data.students.slice();

        // Apply global academic year filter to students
        const globalAcademicYear = window.getGlobalAcademicYear();
        if (globalAcademicYear) {
            searchMatches = searchMatches.filter(s => (s.academicYear || '') === globalAcademicYear);
        }

        if (searchTerm) {
            searchMatches = searchMatches.filter(s => {
                const haystack = `${s.name || ''} ${s.firstName || ''} ${s.lastName || ''} ${s.className || ''}`.toLowerCase();
                return haystack.includes(searchTerm);
            });
        }

        const matchingClasses = Array.from(new Set(
            searchMatches
                .map(s => (s.className || '').trim())
                .filter(c => c.length > 0)
        )).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

        if (classSelect) {
            const previousValue = selectedClass;
            classSelect.innerHTML = `<option value="">-- ${t.selectClass} --</option>` +
                matchingClasses.map(c => `<option value="${c}" ${c === previousValue ? 'selected' : ''}>${c}</option>`).join('');

            let autoSelectedClass = '';
            if (searchMatches.length === 1 && searchMatches[0].className) {
                autoSelectedClass = searchMatches[0].className;
            } else if (matchingClasses.length === 1) {
                autoSelectedClass = matchingClasses[0];
            }

            if (autoSelectedClass) {
                classSelect.value = autoSelectedClass;
            } else if (matchingClasses.includes(previousValue)) {
                classSelect.value = previousValue;
            } else {
                classSelect.value = '';
            }

            selectedClass = classSelect.value;
        }

        let filteredStudents = searchMatches;
        if (selectedClass) {
            filteredStudents = filteredStudents.filter(s => s.className === selectedClass);
        }

        let filteredAssignments = data.assignments.slice();

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

        filteredStudents.sort((a, b) => {
            const classA = (a.className || '').toLowerCase();
            const classB = (b.className || '').toLowerCase();
            if (classA !== classB) {
                return classA.localeCompare(classB, 'fr', { sensitivity: 'base' });
            }
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

        let headers = `<th class="p-3 text-left bg-gray-100 sticky left-0 z-10 cursor-pointer select-none" onclick="toggleSummarySort('name')">${t.student}</th>`;

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
            tagContainer.className = "flex flex-wrap gap-2 mb-4 p-2 bg-gray-50 rounded-lg assignment-tag-container";
        }

        for (const a of filteredAssignments) {
            if (showDetails) {
                for (const ex of a.exercises) {
                    const exIndex = a.exercises.indexOf(ex) + 1;
                    headers += `<th class="p-2 text-center bg-blue-50 text-sm">Ex${exIndex}<br><span class="text-xs text-gray-500">/${window.getExerciseMaxPoints(ex)}</span></th>`;
                }
            }
            headers += `<th class="p-3 text-center bg-blue-100 font-bold cursor-pointer select-none" onclick="toggleSummarySort('assignment-${a.id}')">${a.name}<br><span class="text-xs">/${window.getAssignmentMaxPoints(a)}</span></th>`;
        }

        let currentClass = '';
        let rows = filteredStudents.map(s => {
            let classHeader = '';
            if (s.className !== currentClass) {
                currentClass = s.className;
                const colspan = 1 + (showDetails ? filteredAssignments.reduce((sum, a) => sum + (a.exercises || []).length, 0) : 0) + filteredAssignments.length;
                classHeader = `<tr class="bg-blue-600 text-white font-bold">
                    <td colspan="${colspan}" class="p-2 text-center text-lg">
                        ${s.className || '(Sans classe)'}
                    </td>
                </tr>`;
            }

            let row = `<td class="p-3 font-medium bg-gray-50 sticky left-0">${s.name}</td>`;

            for (const a of filteredAssignments) {
                const studentGrades = data.grades[s.id]?.[a.id] || {};
                const isCompatible = ((s.className || '').trim() === (a.className || '').trim());

                if (showDetails) {
                    for (const ex of a.exercises) {
                        if (isCompatible) {
                            const exTotal = window.getStudentExerciseTotal(studentGrades, ex);
                            const max = window.getExerciseMaxPoints(ex);
                            const existingFinal = studentGrades[ex.id]?.['final']?.['final']?.['final'];
                            const hasEx = window.hasAnyGradeForExercise(studentGrades, ex);
                            const val = existingFinal !== undefined && existingFinal !== '' ? existingFinal : (hasEx ? exTotal.toFixed(2) : '');
                            row += `<td class="px-2 py-1 text-center">
                                <input type="text" inputmode="decimal" pattern="[0-9]*[.,]?[0-9]*" value="${val}" oninput="sanitizeAndClamp(this, ${max})" onblur="commitSummaryInput('${s.id}','${a.id}','${ex.id}', ${max}, this.value)" onkeydown="handleSummaryInputKey(event, '${s.id}','${a.id}','${ex.id}', ${max})" onfocus="this.select()" id="sum-input-${s.id}-${a.id}-${ex.id}" name="sum-input-${s.id}-${a.id}-${ex.id}" aria-label="Note Ex${a.exercises.indexOf(ex) + 1} pour ${s.name} - ${a.name}" class="summary-grade-input">
                            </td>`;
                        } else {
                            row += `<td class="px-2 py-1 text-center text-gray-300 bg-gray-50">-</td>`;
                        }
                    }
                }

                if (isCompatible) {
                    const has = window.hasAnyGradeForAssignment(s.id, a.id);
                    if (has) {
                        const total = window.getStudentAssignmentTotal(s.id, a.id);
                        const max = window.getAssignmentMaxPoints(a);
                        const pct = max > 0 ? (total / max * 100) : 0;
                        const bgColor = pct >= 70 ? 'bg-green-100' : pct >= 50 ? 'bg-orange-100' : 'bg-red-100';
                        row += `<td class="p-3 text-center font-bold ${bgColor}" id="sum-total-${s.id}-${a.id}">${total.toFixed(2)}</td>`;
                    } else {
                        row += `<td class="p-3 text-center text-gray-400 bg-gray-50" id="sum-total-${s.id}-${a.id}"></td>`;
                    }
                } else {
                    row += `<td class="p-3 text-center text-gray-400 bg-gray-50">-</td>`;
                }
            }
            return classHeader + `<tr class="border-b hover:bg-gray-50">${row}</tr>`;
        }).join('');

        const colgroupHtml = (() => {
            let cols = '<col style="width:220px">';
            for (const a of filteredAssignments) {
                if (showDetails) {
                    const exCount = (a.exercises || []).length;
                    for (let i = 0; i < exCount; i++) cols += '<col style="width:70px">';
                }
                cols += '<col style="width:84px">';
            }
            return `<colgroup>${cols}</colgroup>`;
        })();

        container.innerHTML = `
            <table class="w-full table-fixed border-collapse">
                ${colgroupHtml}
                <thead><tr class="border-b-2">${headers}</tr></thead>
                <tbody>${rows}</tbody>
            </table>
        `;
        if (window.translatePage) window.translatePage();
    };

    window.exportSummaryToExcel = async function() {
        const t = getTranslations()[getLang()];
        const selectedClass = document.getElementById('select-class-summary')?.value || '';
        const searchTerm = (document.getElementById('summary-search')?.value || '').toLowerCase().trim();
        const data = getData();

        const matchingClasses = new Set();
        for (const s of data.students) {
            const n = (s.name || '').toLowerCase();
            const cn = (s.className || '').toLowerCase();
            if (!searchTerm || n.includes(searchTerm) || cn.includes(searchTerm)) {
                matchingClasses.add(s.className);
            }
        }

        let filteredStudents = data.students.filter(s => {
            const n = (s.name || '').toLowerCase();
            const cn = (s.className || '').toLowerCase();
            if (searchTerm && !(n.includes(searchTerm) || cn.includes(searchTerm))) return false;
            if (selectedClass && s.className !== selectedClass) return false;
            if (!selectedClass && searchTerm && !matchingClasses.has(s.className)) return false;
            // Filter by global academic year
            const globalAcademicYear = window.getGlobalAcademicYear();
            if (globalAcademicYear && (s.academicYear || '') !== globalAcademicYear) return false;
            return true;
        });

        filteredStudents.sort((a, b) => {
            const classA = (a.className || '').toLowerCase();
            const classB = (b.className || '').toLowerCase();

            if (classA !== classB) {
                return classA.localeCompare(classB, 'fr', { sensitivity: 'base' });
            }

            const nameA = `${a.lastName || ''} ${a.firstName || ''}`.toLowerCase();
            const nameB = `${b.lastName || ''} ${b.firstName || ''}`.toLowerCase();
            return nameA.localeCompare(nameB);
        });

        let filteredAssignments = data.assignments.slice();
        // Filter by user
        const userId = window.currentUser?.email || window.currentUser?.id || 'unknown';
        filteredAssignments = filteredAssignments.filter(a => (a.createdBy || 'unknown') === userId);
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

        for (const cls of sortedClasses) {
            const stu = studentsByClass.get(cls) || [];
            const assigns = filteredAssignments.filter(a =>
                (a.className || '').trim() === cls.trim() ||
                (cls === '(Sans classe)' && !(a.className || '').trim())
            );

            if (stu.length === 0) continue;

            const header = [...headerBase];
            if (assigns.length > 0) {
                header.push(...assigns.map(a => a.name));
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
                    const v = window.getStudentAssignmentTotal(s.id, a.id);
                    rowData.push(typeof v === 'number' ? v : '');
                }

                rows.push(rowData);
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



    window.renderSummary1 = function() {
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
        let searchMatches = data.students.slice();

        if (searchTerm) {
            searchMatches = searchMatches.filter(s => {
                const haystack = `${s.name || ''} ${s.firstName || ''} ${s.lastName || ''} ${s.className || ''}`.toLowerCase();
                return haystack.includes(searchTerm);
            });
        }

        const matchingClasses = Array.from(new Set(
            searchMatches
                .map(s => (s.className || '').trim())
                .filter(c => c.length > 0)
        )).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

        if (classSelect) {
            const previousValue = selectedClass;
            classSelect.innerHTML = `<option value="">-- ${t.selectClass} --</option>` +
                matchingClasses.map(c => `<option value="${c}" ${c === previousValue ? 'selected' : ''}>${c}</option>`).join('');

            let autoSelectedClass = '';
            if (searchMatches.length === 1 && searchMatches[0].className) {
                autoSelectedClass = searchMatches[0].className;
            } else if (matchingClasses.length === 1) {
                autoSelectedClass = matchingClasses[0];
            }

            if (autoSelectedClass) {
                classSelect.value = autoSelectedClass;
            } else if (matchingClasses.includes(previousValue)) {
                classSelect.value = previousValue;
            } else {
                classSelect.value = '';
            }

            selectedClass = classSelect.value;
        }

        let filteredStudents = searchMatches;
        if (selectedClass) {
            filteredStudents = filteredStudents.filter(s => s.className === selectedClass);
        }

        let filteredAssignments = data.assignments.slice();

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

        let classHeaderRow = `<th class="p-3 bg-gray-100 sticky left-0 z-10"></th>`;
        let assignmentHeaderRow = `<th class="p-3 text-left bg-gray-100 sticky left-0 z-10 cursor-pointer select-none" onclick="toggleSummarySort('name')">${t.student}</th>`;

        classesInOrder.forEach(className => {
            const classAssignments = assignmentsByClass[className] || [];
            if (classAssignments.length === 0) return;
            let colspan = 0;
            classAssignments.forEach(a => {
                if (showDetails) colspan += (a.exercises || []).length;
                colspan += 1;
            });
            const classIndex = classesInOrder.indexOf(className);
            const bgColor = classIndex % 2 === 0 ? 'bg-blue-600' : 'bg-indigo-600';
            classHeaderRow += `<th colspan="${colspan}" class="p-2 text-center text-white font-bold ${bgColor} border-l-2 border-white">${className}</th>`;
        });

        classesInOrder.forEach(className => {
            const classAssignments = assignmentsByClass[className] || [];
            const classIndex = classesInOrder.indexOf(className);
            const bgLight = classIndex % 2 === 0 ? 'bg-blue-50' : 'bg-indigo-50';
            const bgMedium = classIndex % 2 === 0 ? 'bg-blue-100' : 'bg-indigo-100';
            let isFirstInClass = true;

            classAssignments.forEach(a => {
                const borderClass = isFirstInClass ? 'border-l-2 border-gray-300' : '';
                isFirstInClass = false;
                if (showDetails) {
                    a.exercises.forEach((ex, exIdx) => {
                        const exBorder = exIdx === 0 ? borderClass : '';
                        assignmentHeaderRow += `<th class="p-2 text-center ${bgLight} text-sm ${exBorder}">Ex${exIdx + 1}<br><span class="text-xs text-gray-500">/${window.getExerciseMaxPoints(ex)}</span></th>`;
                    });
                }
                const totalBorder = showDetails ? '' : borderClass;
                assignmentHeaderRow += `<th class="p-3 text-center ${bgMedium} font-bold cursor-pointer select-none ${totalBorder}" onclick="toggleSummarySort('assignment-${a.id}')">${a.name}<br><span class="text-xs">/${window.getAssignmentMaxPoints(a)}</span></th>`;
            });
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
                                ${a.name} <span class="text-xs opacity-70">(${a.className || '?'})</span>
                            </button>
                        </div>`;
                });
                tagHtml += `</div>`;
            });
            tagContainer.innerHTML = tagHtml;
            tagContainer.className = "flex flex-wrap gap-2 mb-4 p-2 bg-gray-50 rounded-lg assignment-tag-container";
        }

        let currentClass = '';
        let rows = filteredStudents.map(s => {
            let classHeader = '';
            const studentClassName = (s.className || '').trim();
            if (studentClassName !== currentClass) {
                currentClass = studentClassName;
                const colspan = 1 + orderedAssignments.reduce((sum, a) => sum + (showDetails ? (a.exercises || []).length : 0) + 1, 0);
                classHeader = `<tr class="bg-gray-800 text-white font-bold">
                    <td colspan="${colspan}" class="p-2 text-center text-lg">
                        📚 ${studentClassName || '(Sans classe)'}
                    </td>
                </tr>`;
            }
            let row = `<td class="p-3 font-medium bg-gray-50 sticky left-0 z-5">${s.name}</td>`;
            
            classesInOrder.forEach(className => {
                const classAssignments = assignmentsByClass[className] || [];
                const classIndex = classesInOrder.indexOf(className);
                const isStudentClass = studentClassName === className;
                let isFirstInClass = true;
                const bgEmpty = classIndex % 2 === 0 ? 'bg-blue-50/30' : 'bg-indigo-50/30';

                classAssignments.forEach(a => {
                    const studentGrades = data.grades[s.id]?.[a.id] || {};
                    const borderClass = isFirstInClass ? 'border-l-2 border-gray-200' : '';
                    isFirstInClass = false;

                    if (showDetails) {
                        a.exercises.forEach((ex, exIdx) => {
                            const exBorder = exIdx === 0 ? borderClass : '';
                            if (isStudentClass) {
                                const exTotal = window.getStudentExerciseTotal(studentGrades, ex);
                                const max = window.getExerciseMaxPoints(ex);
                                const existingFinal = studentGrades[ex.id]?.['final']?.['final']?.['final'];
                                const hasEx = window.hasAnyGradeForExercise(studentGrades, ex);
                                const val = existingFinal !== undefined && existingFinal !== '' ? existingFinal : (hasEx ? exTotal.toFixed(2) : '');
                                row += `<td class="px-2 py-1 text-center ${exBorder}">
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
                            } else {
                                row += `<td class="px-2 py-1 text-center text-gray-300 ${bgEmpty} ${exBorder}">-</td>`;
                            }
                        });
                    }

                    const totalBorder = showDetails ? '' : borderClass;
                    if (isStudentClass) {
                        const has = window.hasAnyGradeForAssignment(s.id, a.id);
                        if (has) {
                            const total = window.getStudentAssignmentTotal(s.id, a.id);
                            const max = window.getAssignmentMaxPoints(a);
                            const pct = max > 0 ? (total / max * 100) : 0;
                            const bgColor = pct >= 70 ? 'bg-green-100' : pct >= 50 ? 'bg-orange-100' : 'bg-red-100';
                            row += `<td class="p-3 text-center font-bold ${bgColor} ${totalBorder}" id="sum-total-${s.id}-${a.id}">${total.toFixed(2)}</td>`;
                        } else {
                            row += `<td class="p-3 text-center text-gray-300 ${bgEmpty} ${totalBorder}" id="sum-total-${s.id}-${a.id}"></td>`;
                        }
                    } else {
                        row += `<td class="p-3 text-center text-gray-300 ${bgEmpty} ${totalBorder}">-</td>`;
                    }
                });
            });
            return classHeader + `<tr class="border-b hover:bg-gray-50">${row}</tr>`;
        }).join('');

        const colgroupHtml = (() => {
            let cols = '<col style="width:220px">';
            orderedAssignments.forEach(a => {
                if (showDetails) {
                    const exCount = (a.exercises || []).length;
                    for (let i = 0; i < exCount; i++) cols += '<col style="width:70px">';
                }
                cols += '<col style="width:84px">';
            });
            return `<colgroup>${cols}</colgroup>`;
        })();


        container.innerHTML = `
            <table class="w-full table-fixed border-collapse">
                ${colgroupHtml}
                <thead>
                    <tr class="border-b">${classHeaderRow}</tr>
                    <tr class="border-b-2">${assignmentHeaderRow}</tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
        window.translatePage();
    };

    window.renderSummary2 = function() {
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
        let searchMatches = data.students.slice();

        if (searchTerm) {
            searchMatches = searchMatches.filter(s => {
                const haystack = `${s.name || ''} ${s.firstName || ''} ${s.lastName || ''} ${s.className || ''}`.toLowerCase();
                return haystack.includes(searchTerm);
            });
        }

        const matchingClasses = Array.from(new Set(
            searchMatches
                .map(s => (s.className || '').trim())
                .filter(c => c.length > 0)
        )).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

        if (classSelect) {
            const previousValue = selectedClass;
            classSelect.innerHTML = `<option value="">-- ${t.selectClass} --</option>` +
                matchingClasses.map(c => `<option value="${c}" ${c === previousValue ? 'selected' : ''}>${c}</option>`).join('');

            let autoSelectedClass = '';
            if (searchMatches.length === 1 && searchMatches[0].className) {
                autoSelectedClass = searchMatches[0].className;
            } else if (matchingClasses.length === 1) {
                autoSelectedClass = matchingClasses[0];
            }

            if (autoSelectedClass) {
                classSelect.value = autoSelectedClass;
            } else if (matchingClasses.includes(previousValue)) {
                classSelect.value = previousValue;
            } else {
                classSelect.value = '';
            }

            selectedClass = classSelect.value;
        }

        let filteredStudents = searchMatches;
        if (selectedClass) {
            filteredStudents = filteredStudents.filter(s => s.className === selectedClass);
        }

        let filteredAssignments = data.assignments.slice();

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
                const isSorted = summarySort.key === `assignment-${a.id}`;
                html += `<th class="p-3 text-center bg-blue-100 font-bold cursor-pointer select-none hover:bg-blue-200 border-l border-gray-300" 
        onclick="toggleSummarySort('assignment-${a.id}')">
        ${a.name} ${isSorted ? (summarySort.direction === 'asc' ? '↑' : '↓') : ''}
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

                    const has = window.hasAnyGradeForAssignment(s.id, a.id);
                    if (has) {
                        const total = window.getStudentAssignmentTotal(s.id, a.id);
                        const max = window.getAssignmentMaxPoints(a);
                        const pct = max > 0 ? (total / max * 100) : 0;
                        const bgColor = pct >= 70 ? 'bg-green-100' : pct >= 50 ? 'bg-orange-100' : 'bg-red-100';
                        html += `<td class="p-3 text-center font-bold ${bgColor} border-l border-gray-300" id="sum-total-${s.id}-${a.id}">
            ${total.toFixed(2)}
        </td>`;
                    } else {
                        html += `<td class="p-3 text-center text-gray-300 border-l border-gray-300" id="sum-total-${s.id}-${a.id}"></td>`;
                    }
                }

                html += `</tr>`;
            }

            html += `<tr class="bg-gray-100 font-semibold border-t-2">`;
            html += `<td class="p-3 sticky left-0 border-r border-gray-200">Moyenne</td>`;
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

            html += `</tbody></table>`;
            html += `</div></div>`;
        }



        container.innerHTML = html;
        if (window.translatePage) window.translatePage();
    };

    window.setGlobalAssignmentGrade = function(studentId, assignmentId, value) {
        const data = getData();
        if (!data.grades[studentId]) data.grades[studentId] = {};
        if (!data.grades[studentId][assignmentId]) data.grades[studentId][assignmentId] = {};
        data.grades[studentId][assignmentId].global = value === '' ? '' : (parseFloat(value) || 0);
        window.saveData();
        window.renderSummary();
    };

    window.setExerciseFinalGrade = function(studentId, assignmentId, exId, max, value) {
        window.applyExerciseFinalGrade(studentId, assignmentId, exId, max, value, true);
    };

    window.applyExerciseFinalGrade = function(studentId, assignmentId, exId, max, value, rerender) {
        const data = getData();
        if (!data.grades[studentId]) data.grades[studentId] = {};
        if (!data.grades[studentId][assignmentId]) data.grades[studentId][assignmentId] = {};
        if (!data.grades[studentId][assignmentId][exId]) data.grades[studentId][assignmentId][exId] = {};
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
            window.renderSummary();
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
