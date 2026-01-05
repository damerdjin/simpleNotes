
(function () {
    // Helper to access globals
    const getData = () => window.data;
    const getTranslations = () => window.translations;
    const getLang = () => window.currentLanguage;
    const saveData = () => window.saveData();
    const renderSummary = () => { if (typeof window.renderSummary === 'function') window.renderSummary(); };
    const renderAssignments = () => { if (typeof window.renderAssignments === 'function') window.renderAssignments(); };
    const renderExportPrep = () => { if (typeof window.renderExportPrep === 'function') window.renderExportPrep(); };
    const loadClassSelectorsForExport = () => { if (typeof window.loadClassSelectorsForExport === 'function') window.loadClassSelectorsForExport(); };
    const translatePage = () => { if (typeof window.translatePage === 'function') window.translatePage(); };
    const genId = () => window.genId();

    const studentsUiState = window.studentsUiState || { selectedClass: '', page: 1, pageSize: 12 };
    window.studentsUiState = studentsUiState;

    // ===== CLASSES =====
    window.getClasses = function() {
        const classes = new Set();
        const globalAcademicYear = window.getGlobalAcademicYear();
        const userId = window.currentUser?.email || window.currentUser?.id || 'unknown';
        (getData().students || []).forEach(s => {
            if ((s.importedBy || 'unknown') === userId && s.className && globalAcademicYear && s.academicYear === globalAcademicYear) {
                classes.add(s.className);
            }
        });
        return Array.from(classes).sort();
    };

    window.getAcademicYears = function() {
        const years = new Set();
        (getData().students || []).forEach(s => {
            if (s.academicYear) years.add(s.academicYear);
        });
        return Array.from(years).sort();
    };

    window.loadClassSelectors = function() {
        const classes = window.getClasses();
        const academicYears = window.getAcademicYears();
        const t = getTranslations()[getLang()];

        // For grades tab
        const gradesSelect = document.getElementById('select-class-grades');
        if (gradesSelect) {
            const currentValue = gradesSelect.value;
            gradesSelect.innerHTML = '<option value="">-- ' + t.selectClass + ' --</option>' +
                classes.map(c => `<option value="${c}" ${c === currentValue ? 'selected' : ''}>${c}</option>`).join('');
        }

        // For summary tab
        const summarySelect = document.getElementById('select-class-summary');
        if (summarySelect) {
            const currentValue = summarySelect.value;
            summarySelect.innerHTML = '<option value="">-- ' + t.selectClass + ' --</option>' +
                classes.map(c => `<option value="${c}" ${c === currentValue ? 'selected' : ''}>${c}</option>`).join('');
        }

        // For assignment modal
        const assignmentSelect = document.getElementById('assignment-class');
        if (assignmentSelect) {
            const currentValue = assignmentSelect.value;
            assignmentSelect.innerHTML = `<option value="">${t.selectClass}</option>` +
                classes.map(c => `<option value="${c}" ${c === currentValue ? 'selected' : ''}>${c}</option>`).join('');
        }

        const filterStudentsSelect = document.getElementById('filter-class-students');
        if (filterStudentsSelect) {
            const currentValue = filterStudentsSelect.value || studentsUiState.selectedClass || '';
            filterStudentsSelect.innerHTML = '<option value="">' + (t.allClasses || '-- Toutes les classes --') + '</option>' +
                classes.map(c => `<option value="${c}" ${c === currentValue ? 'selected' : ''}>${c}</option>`).join('');
            studentsUiState.selectedClass = filterStudentsSelect.value;
        }
    };

    window.loadClassSelectorsForAssignments = function() {
        const classes = window.getClasses();
        const t = getTranslations()[getLang()]; // Although unused in original code for this function, might be useful

        // For assignments filter
        const filterSelect = document.getElementById('filter-class-assignments');
        if (filterSelect) {
            const currentValue = filterSelect.value;
            filterSelect.innerHTML = '<option value="">-- ' + (t.allClasses || 'Toutes les classes') + ' --</option>' +
                classes.map(c => `<option value="${c}" ${c === currentValue ? 'selected' : ''}>${c}</option>`).join('');
        }
    };

    window.renderClassList = function() {
        const t = getTranslations()[getLang()];
        const container = document.getElementById('students-class-list') || document.getElementById('class-list');
        if (!container) return;

        const globalAcademicYear = window.getGlobalAcademicYear();
        if (!globalAcademicYear) {
            container.innerHTML = `<p class="text-gray-500 text-sm">${t.selectAcademicYear}</p>`;
            return;
        }

        const search = (document.getElementById('students-class-search')?.value || '').toLowerCase();
        const classes = window.getClasses().filter(c => c.toLowerCase().includes(search));
        const selected = studentsUiState.selectedClass || '';

        if (classes.length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-sm">${t.noClassesAutoCreated}</p>`;
            return;
        }

        const userId = window.currentUser?.email || window.currentUser?.id || 'unknown';
        const allCount = (getData().students || []).filter(s => (s.importedBy || 'unknown') === userId && (s.academicYear || '') === globalAcademicYear).length;
        const allLabel = t.allClassesFilter;
        const allActive = !selected;
        const allBtn = `
            <button onclick="setStudentsSelectedClass('')" class="class-list-item ${allActive ? 'active' : ''}">
                <div class="class-list-item-name">${allLabel}</div>
                <span class="class-list-item-count">${allCount}</span>
            </button>
        `;

        const rows = classes.map(c => {
            const count = getData().students.filter(s => s.className === c && (s.importedBy || 'unknown') === userId && (s.academicYear || '') === globalAcademicYear).length;
            const active = c === selected;
            const color = typeof window.getClassColor === 'function' ? window.getClassColor(c) : '#3b82f6';
            return `
                <div class="class-list-item-wrapper group relative">
                    <button onclick="setStudentsSelectedClass('${c}')" class="class-list-item ${active ? 'active' : ''}" title="${c}">
                        <div class="flex items-center gap-2 min-w-0 flex-1">
                            <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${color}"></span>
                            <div class="class-list-item-name">${c}</div>
                        </div>
                        <span class="class-list-item-count">${count}</span>
                    </button>
                    <button onclick="event.stopPropagation(); deleteClassSafely('${c}')" 
                        class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 z-10"
                        title="${t.delete}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            `;
        }).join('');

        container.innerHTML = allBtn + rows;
    };

    window.setStudentsSelectedClass = function(className = '') {
        studentsUiState.selectedClass = className || '';
        studentsUiState.page = 1;
        window.renderStudents();
        window.renderClassList();
    };

    window.clearStudentsFilters = function() {
        studentsUiState.selectedClass = '';
        studentsUiState.page = 1;
        const search = document.getElementById('student-search');
        if (search) search.value = '';
        window.renderStudents();
        window.renderClassList();
    };

    window.setStudentsPageSize = function(value) {
        const n = Number(value);
        studentsUiState.pageSize = Number.isFinite(n) && n > 0 ? n : 48;
        studentsUiState.page = 1;
        window.renderStudents();
    };

    window.goStudentsPage = function(page) {
        const p = Number(page);
        studentsUiState.page = Number.isFinite(p) && p > 0 ? p : 1;
        window.renderStudents();
    };

    window.deleteClassSafely = function(className) {
        const t = getTranslations()[getLang()];
        const typed = prompt(`${t.deleteClassConfirm} "${className}"\n\n${getLang() === 'ar' ? 'للتأكيد أكتب : نعم' : getLang() === 'en' ? 'To confirm, type: Yes' : 'Pour confirmer, tapez : OUI'}`);
        if (typed !== (getLang() === 'ar' ? 'نعم' : getLang() === 'en' ? 'Yes' : 'OUI')) return;
        window.deleteClass(className);
        window.loadClassSelectors();
        window.renderClassList();
    };

    window.deleteClass = function(className) {
        const t = getTranslations()[getLang()];
        const data = getData();
        const userId = window.currentUser?.email || window.currentUser?.id || 'unknown';
        const count = data.students.filter(s => s.className === className && (s.importedBy || 'unknown') === userId).length;
        
        // Confirmation plus détaillée
        let detailMsg = t.deleteClassConfirmDetails;
        detailMsg = detailMsg.replace('${count}', count);
        
        if (!confirm(`${t.deleteClassConfirm} "${className}" ?\n\n${detailMsg}`)) return;

        // Remove students from this class
        const studentIds = data.students.filter(s => s.className === className && (s.importedBy || 'unknown') === userId).map(s => s.id);
        data.students = data.students.filter(s => !(s.className === className && (s.importedBy || 'unknown') === userId));

        // Remove their grades
        studentIds.forEach(id => {
            if (data.grades) delete data.grades[id];
        });

        // Remove assignments for this class
        if (data.assignments) {
            data.assignments = data.assignments.filter(a => a.className !== className);
        }

        // Clean up export config and overrides for this class
        if (typeof window.deleteClassDataFromExport === 'function') {
            window.deleteClassDataFromExport(className);
        }

        saveData();
        window.renderStudents();
        window.renderClassList();
        window.loadClassSelectors();
        window.loadClassSelectorsForAssignments();
        renderSummary();
        renderAssignments();
    };

    // ===== STUDENTS =====
    let editingStudentId = null;
    let studentErrorTimeout = null;

    window.showStudentError = function(message) {
        const errorZone = document.getElementById('student-modal-error');
        const errorText = document.getElementById('student-modal-error-text');
        if (errorZone && errorText) {
            if (studentErrorTimeout) clearTimeout(studentErrorTimeout);
            
            errorText.textContent = message;
            errorZone.classList.remove('hidden');
            
            // Scroll to top of modal
            errorZone.closest('.overflow-y-auto').scrollTo({ top: 0, behavior: 'smooth' });

            studentErrorTimeout = setTimeout(() => {
                errorZone.classList.add('hidden');
                studentErrorTimeout = null;
            }, 5000);
        }
    };

    window.openStudentModal = function(studentId = null) {
        const modal = document.getElementById('student-modal');
        const header = document.getElementById('app-header');
        const t = getTranslations()[getLang()];
        
        // Hide header
        if (header) {
            header.style.setProperty('display', 'none', 'important');
        }
        
        // Reset error zone
        const errorZone = document.getElementById('student-modal-error');
        if (errorZone) errorZone.classList.add('hidden');
        if (studentErrorTimeout) clearTimeout(studentErrorTimeout);

        if (modal) {
            modal.classList.add('active');
            modal.classList.remove('pointer-events-none', 'opacity-0');
            modal.classList.add('opacity-100');
            modal.querySelector('div').classList.remove('scale-95');
            modal.querySelector('div').classList.add('scale-100');
        }
        
        // Find elements
        const titleEl = modal.querySelector('h3');
        const btnAdd = modal.querySelector('button[onclick="addStudent()"]');
        const lastNameInput = document.getElementById('student-lastname');
        const firstNameInput = document.getElementById('student-firstname');
        const ninInput = document.getElementById('student-nin');
        const classSelect = document.getElementById('student-class-select');
        const newClassInput = document.getElementById('student-class-new');
        const newClassContainer = document.getElementById('student-class-new-container');
        
        // Load classes into select
        if (classSelect) {
            const classes = window.getClasses ? window.getClasses() : [];
            let html = `<option value="">-- ${t.classNameOption || '--'} --</option>`;
            classes.forEach(c => {
                html += `<option value="${c}">${c}</option>`;
            });
            html += `<option value="__new__" class="font-bold text-blue-600">+ ${t.newClass}</option>`;
            classSelect.innerHTML = html;
        }

        if (studentId) {
            // EDIT MODE
            editingStudentId = studentId;
            const data = getData();
            const student = data.students.find(s => s.id === studentId);
            
            if (student) {
                if (titleEl) titleEl.textContent = t.editStudentTitle || 'Modifier l\'élève';
                if (btnAdd) btnAdd.textContent = t.save || 'Enregistrer';

                // Fill inputs
                const nameParts = student.name.split(' ');
                if (lastNameInput) lastNameInput.value = nameParts[0] || '';
                if (firstNameInput) firstNameInput.value = nameParts.slice(1).join(' ') || '';
                if (ninInput) ninInput.value = student.nin || '';

                // Handle Class Select
                if (classSelect) {
                    const optionExists = Array.from(classSelect.options).some(opt => opt.value === student.className);
                    if (optionExists) {
                        classSelect.value = student.className;
                        if (newClassContainer) newClassContainer.classList.add('hidden');
                    } else {
                        classSelect.value = '__new__';
                        if (newClassContainer) {
                            newClassContainer.classList.remove('hidden');
                            if (newClassInput) newClassInput.value = student.className || '';
                        }
                    }
                }
            }
        } else {
            // ADD MODE
            editingStudentId = null;
            if (titleEl) titleEl.textContent = t.addStudentTitle;
            if (btnAdd) btnAdd.textContent = t.add;

            // Reset inputs
            const inputs = ['student-lastname', 'student-firstname', 'student-class-new', 'student-nin'];
            inputs.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });

            // Auto-generate NIN as a long number
            if (ninInput) ninInput.value = (1000 + Date.now()).toString();

            if (newClassContainer) newClassContainer.classList.add('hidden');
            if (classSelect) classSelect.value = '';

            // Pre-fill academic year with global value
            const globalAcademicYear = window.getGlobalAcademicYear();
            const academicYearSelect = document.getElementById('student-academic-year');
            if (academicYearSelect) academicYearSelect.value = globalAcademicYear;
        }

        if (lastNameInput) lastNameInput.focus();
    };

    window.closeStudentModal = function() {
        const modal = document.getElementById('student-modal');
        const header = document.getElementById('app-header');
        
        if (header) {
            header.style.removeProperty('display');
        }

        if (modal) {
            modal.classList.remove('active');
            modal.classList.add('pointer-events-none', 'opacity-0');
            modal.classList.remove('opacity-100');
            modal.querySelector('div').classList.add('scale-95');
            modal.querySelector('div').classList.remove('scale-100');
        }
        editingStudentId = null;
    };

    window.addStudent = function() {
        const t = getTranslations()[getLang()];
        const data = getData();
        const lastName = document.getElementById('student-lastname').value.trim();
        const firstName = document.getElementById('student-firstname').value.trim();
        
        // Hide error zone first
        const errorZone = document.getElementById('student-modal-error');
        if (errorZone) errorZone.classList.add('hidden');

        // Handle Class Selection
        const classSelect = document.getElementById('student-class-select');
        let className = classSelect.value;
        if (className === '__new__') {
            className = document.getElementById('student-class-new').value.trim();
        }

        const academicYear = document.getElementById('student-academic-year').value.trim() || window.getGlobalAcademicYear();
        const nin = document.getElementById('student-nin').value.trim();

        if (!lastName && !firstName) return window.showStudentError(t.enterName);
        if (!className) return window.showStudentError(t.enterClass);

        const name = (lastName + ' ' + firstName).trim();

        // Check for duplicate student in the same class, for the current user and academic year
        const currentUserId = window.currentUser?.email || window.currentUser?.id || 'unknown';
        const duplicate = data.students.find(s => 
            s.name.toLowerCase() === name.toLowerCase() && 
            s.className === className && 
            s.academicYear === academicYear &&
            (s.importedBy || 'unknown') === currentUserId &&
            s.id !== editingStudentId
        );

        if (duplicate) return window.showStudentError(t.duplicateStudent || 'Cet élève existe déjà dans cette classe.');

        if (editingStudentId) {
            // UPDATE
            const student = data.students.find(s => s.id === editingStudentId);
            if (student) {
                student.lastName = lastName;
                student.firstName = firstName;
                student.name = name;
                student.className = className;
                student.academicYear = academicYear;
                // Preserve importedBy
                if (nin) student.nin = nin; // Only update if provided
                // Preserve other fields like grades (linked by ID), sex, birthDate, etc.
            }
        } else {
            // CREATE
            data.students.push({ id: genId(), name, className, academicYear, nin: nin || genId(), firstName, lastName, importedBy: window.currentUser?.email || window.currentUser?.id || 'unknown' });
        }

        saveData();
        
        // After adding/updating, help user find the student
        const searchInput = document.getElementById('student-search');
        if (searchInput) {
            searchInput.value = name;
        }

        // Also reset class filter to "All" to make sure the student is visible
        const filterSelect = document.getElementById('filter-class-students');
        if (filterSelect) {
            filterSelect.value = "";
            studentsUiState.selectedClass = "";
        }

        window.renderStudents();
        window.closeStudentModal();
        
        // Show success confirmation
        if (!editingStudentId && window.showToast) {
            window.showToast(t.studentAddedSuccess || "L'élève a été ajouté avec succès !");
        }

        // Refresh class lists if a new class was created or changed
        window.renderClassList();
        window.loadClassSelectors();
    };

    window.deleteStudent = function(id) {
        const t = getTranslations()[getLang()];
        const data = getData();
        if (!confirm(t.deleteStudent)) return;
        data.students = data.students.filter(s => s.id !== id);
        delete data.grades[id];
        saveData();
        window.renderStudents();
        window.renderClassList();
        window.loadClassSelectors();
    };

    window.viewStudentGrades = function(studentId) {
        const data = getData();
        const student = data.students.find(s => s.id === studentId);
        if (!student) return;

        // 1. Switch to summary tab FIRST with keepFilters
        if (window.tabs && typeof window.tabs.activateTab === 'function') {
            window.tabs.activateTab('summary', { keepFilters: true });
        }

        // 2. Set filters AFTER tab switch (to ensure elements are in the right state)
        const summarySearchInput = document.getElementById('summary-search');
        const summaryClassSelect = document.getElementById('select-class-summary');

        if (summarySearchInput) {
            summarySearchInput.value = student.name || `${student.lastName} ${student.firstName}`;
        }
        
        if (summaryClassSelect) {
            summaryClassSelect.value = student.className;
        }
        
        // 3. Trigger render
        if (typeof window.renderSummary === 'function') {
            window.renderSummary();
        }
    };

    window.renderStudents = function() {
        const t = getTranslations()[getLang()];
        const container = document.getElementById('students-list');
        const searchTerm = document.getElementById('student-search')?.value.trim().toLowerCase() || '';
        const filterSelect = document.getElementById('filter-class-students');
        const selectedClass = filterSelect ? filterSelect.value : (studentsUiState.selectedClass || '');
        const data = getData();

        const globalUserId = window.currentUser?.email || window.currentUser?.id || 'unknown';
        const globalAcademicYear = window.getGlobalAcademicYear();
        if (!globalAcademicYear) {
            container.innerHTML = `<p class="text-gray-500 text-center py-8">${t.selectAcademicYear}</p>`;
            const pagination = document.getElementById('students-pagination');
            if (pagination) pagination.innerHTML = '';
            return;
        }

        let filteredStudents = data.students.slice();
        // Filter by user and global academic year
        filteredStudents = filteredStudents.filter(s => (s.importedBy || 'unknown') === globalUserId && (s.academicYear || '') === globalAcademicYear);
        if (selectedClass) {
            filteredStudents = filteredStudents.filter(s => (s.className || '') === selectedClass);
        }
        if (searchTerm) {
            filteredStudents = filteredStudents.filter(s => {
                const haystack = `${s.name || ''} ${s.firstName || ''} ${s.lastName || ''} ${s.className || ''}`.toLowerCase();
                return haystack.includes(searchTerm);
            });
        }



        if (data.students.length === 0) {
            container.className = '';
            container.innerHTML = `<p class="text-gray-500 text-center py-8">${t.noStudentsAddFirst}</p>`;
            const pagination = document.getElementById('students-pagination');
            if (pagination) pagination.innerHTML = '';
            return;
        }

        container.className = 'student-grid';

        const pageSize = studentsUiState.pageSize || 12;
        studentsUiState.pageSize = pageSize;
        studentsUiState.selectedClass = selectedClass;

        const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
        if (studentsUiState.page > totalPages) studentsUiState.page = totalPages;
        if (studentsUiState.page < 1) studentsUiState.page = 1;
        const start = (studentsUiState.page - 1) * pageSize;
        const pageStudents = filteredStudents.slice(start, start + pageSize);

        const levelFromClass = (className = '') => {
            const first = className.trim().split(/\s+/)[0] || '';
            const map = {
                'أولى': 1, 'اولى': 1, '1ere': 1, '1ère': 1, '1': 1,
                'ثانية': 2, '2nde': 2, '2': 2,
                'ثالثة': 3, '3eme': 3, '3ème': 3, '3': 3,
                'رابعة': 4, '4eme': 4, '4ème': 4, '4': 4,
                'خامسة': 5, '5eme': 5, '5ème': 5, '5': 5,
                'سادسة': 6, '6eme': 6, '6ème': 6, '6': 6
            };
            const key = first.toLowerCase();
            return map[key] || '?';
        };

        const cleanClassName = (className = '') => {
            let parts = className.trim().split(/\s+/);
            if (parts.length === 0) return '';
            
            const first = parts[0].toLowerCase();
            const levels = [
                'أولى', 'اولى', '1ere', '1ère', '1',
                'ثانية', '2nde', '2',
                'ثالثة', '3eme', '3ème', '3',
                'رابعة', '4eme', '4ème', '4',
                'خامسة', '5eme', '5ème', '5',
                'سادسة', '6eme', '6ème', '6'
            ];
            
            if (levels.includes(first)) {
                parts.shift();
                if (parts.length > 0) {
                    const second = parts[0].toLowerCase();
                    if (['ثانوي', 'secondary', 'année', 'annee'].includes(second)) {
                        parts.shift();
                    }
                }
            }
            return parts.join(' ');
        };

        if (filteredStudents.length === 0) {
            container.className = '';
            container.innerHTML = `<p class="text-gray-500 text-center py-8">${t.noResults}</p>`;
        } else {
            const items = pageStudents.map((s, i) => {
            const first = (s.firstName || '').trim();
            const last = (s.lastName || '').trim();
            const displayName = (s.name || `${last} ${first}`).trim();
            const level = levelFromClass(s.className || '');
            const sex = (s.sex || '').toLowerCase();
            const levelClass = sex.startsWith('f') || sex.includes('أنث') || sex.includes('fille') ? 'girl'
                : sex.startsWith('m') || sex.includes('ذكر') || sex.includes('garçon') ? 'boy'
                    : 'neutral';
            
            // Use global helpers for date
            const birth = window.formatDate ? window.formatDate(window.parseDateMaybeExcel(s.birthDate || '')) : '';

            return `
    <div class="student-item">
        <div class="student-level ${levelClass}" title="Niveau">${level}</div>
        <div class="student-info">
            <div class="student-name">${displayName}</div>
            <div class="student-meta">
                ${s.className ? `<span class="student-chip class" title="${s.className}">🏷️ ${cleanClassName(s.className)}</span>` : ''}
                ${birth ? `<span class="student-chip birth">🎂 ${birth}</span>` : ''}
            </div>
            <button onclick="viewStudentGrades('${s.id}')" class="view-grades-btn">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                <span>${t.viewGrades || 'Visualiser les notes'}</span>
            </button>
        </div>
        <div class="student-actions">
            <button onclick="openStudentModal('${s.id}')" class="btn-edit" title="${t.edit}">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 00-2 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
            </button>
            <button onclick="deleteStudent('${s.id}')" class="btn-delete" title="${t.delete}">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        </div>
    </div>`;
            }).join('');

            container.className = 'student-grid';
            container.innerHTML = items;
        }

        const pagination = document.getElementById('students-pagination');
        if (pagination) {
            const currentPage = studentsUiState.page;
            
            let html = `
                <div class="pagination-container mt-8 flex flex-wrap items-center justify-between gap-6 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <div class="flex items-center gap-4">
                        <div class="pagination-info text-sm text-slate-500">
                            ${t.showing} <span class="font-bold text-slate-900">${filteredStudents.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> 
                            ${t.to} <span class="font-bold text-slate-900">${Math.min(currentPage * pageSize, filteredStudents.length)}</span> 
                            ${t.of} <span class="font-bold text-slate-900">${filteredStudents.length}</span>
                        </div>
                        <div class="h-4 w-px bg-slate-200"></div>
                        <div class="flex items-center gap-2">
                            <select id="students-page-size" onchange="setStudentsPageSize(this.value)"
                                class="modern-select !py-1.5 !px-3 !text-sm !w-20 !bg-slate-50 border-transparent hover:border-slate-200 transition-all">
                                <option value="12" ${pageSize === 12 ? 'selected' : ''}>12</option>
                                <option value="18" ${pageSize === 18 ? 'selected' : ''}>18</option>
                                <option value="50" ${pageSize === 50 ? 'selected' : ''}>50</option>
                                <option value="100" ${pageSize === 100 ? 'selected' : ''}>100</option>
                            </select>
                            <span class="text-xs text-slate-400 font-medium">/ page</span>
                        </div>
                    </div>
            `;

            if (totalPages > 1) {
                html += `
                    <div class="flex items-center gap-1">
                        <button onclick="goStudentsPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} class="pagination-btn">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                        </button>
                `;

                // Logic for page numbers
                const startPage = Math.max(1, currentPage - 2);
                const endPage = Math.min(totalPages, startPage + 4);
                
                for (let i = startPage; i <= endPage; i++) {
                    html += `
                        <button onclick="goStudentsPage(${i})" class="pagination-btn ${i === currentPage ? 'active' : ''}">
                            ${i}
                        </button>
                    `;
                }

                html += `
                        <button onclick="goStudentsPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} class="pagination-btn">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                        </button>
                    </div>
                `;
            }

            html += `</div>`;
            pagination.innerHTML = html;
        }
    };

    window.handleStudentImport = function(event) {
        const t = getTranslations()[getLang()];
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            const dataBinary = new Uint8Array(e.target.result);
            const workbook = XLSX.read(dataBinary, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            if (json.length < 2) {
                alert(t.emptyFile);
                return;
            }

            const headers = json[1];
            const rows = json.slice(2); // à partir de la 3ème ligne

            // Fonction utilitaire pour nettoyer les chaines (enlever les espaces inutiles)
            const cleanStr = (val) => (val || '').toString().trim();

            const getIndex = (label) => headers.findIndex(h => cleanStr(h) === label);

            // Index des colonnes d'identification
            const idxNIN = getIndex('رقم التعريف');
            const idxNom = getIndex('اللقب');
            const idxPrenom = getIndex('الاسم');
            const idxClasse = getIndex('الفوج التربوي');
            const idxSexe = getIndex('الجنس');
            const idxBirth = getIndex('تاريخ الميلاد');
            const idxReg = getIndex('رقم التسجيل');

            // Liste des index connus (infos élèves) pour identifier les colonnes de NOTES
            const knownIndices = [idxNIN, idxNom, idxPrenom, idxClasse, idxSexe, idxBirth, idxReg];

            // Extract unique classes from Excel for the wizard
            const excelClasses = [...new Set(rows.map(r => idxClasse >= 0 ? cleanStr(r[idxClasse]) : '').filter(c => c))];

            // Pre-parse rows for the wizard to avoid duplicating logic
            const parsedRows = rows.map((row, index) => {
                if (!row || row.length === 0) return null;
                return {
                    originalIndex: index,
                    nin: idxNIN >= 0 ? cleanStr(row[idxNIN]) : '',
                    lastName: idxNom >= 0 ? cleanStr(row[idxNom]) : '',
                    firstName: idxPrenom >= 0 ? cleanStr(row[idxPrenom]) : '',
                    className: idxClasse >= 0 ? cleanStr(row[idxClasse]) : '',
                    sex: idxSexe >= 0 ? cleanStr(row[idxSexe]) : '',
                    birthDate: idxBirth >= 0 ? cleanStr(row[idxBirth]) : '',
                    regNumber: idxReg >= 0 ? cleanStr(row[idxReg]) : ''
                };
            }).filter(r => r !== null);

            const runImport = (studentMapping = {}) => {
                let added = 0;
                let updated = 0;
                const data = getData();

                rows.forEach((row, index) => {
                    if (!row || row.length === 0) return;

                    // Extraction des données de base
                    const nin = idxNIN >= 0 ? cleanStr(row[idxNIN]) : '';
                    const lastName = idxNom >= 0 ? cleanStr(row[idxNom]) : '';
                    const firstName = idxPrenom >= 0 ? cleanStr(row[idxPrenom]) : '';
                    const className = idxClasse >= 0 ? cleanStr(row[idxClasse]) : '';
                    const sex = idxSexe >= 0 ? cleanStr(row[idxSexe]) : '';
                    const birthDate = idxBirth >= 0 ? cleanStr(row[idxBirth]) : '';
                    const regNumber = idxReg >= 0 ? cleanStr(row[idxReg]) : '';

                    if (!lastName && !firstName) return;
                    const name = (lastName + ' ' + firstName).trim();

                    // --- CORRECTION 1 : LOGIQUE DE RECHERCHE AMÉLIORÉE ---
                    const currentUserId = window.currentUser?.email || window.currentUser?.id || 'unknown';
                    const currentAcademicYear = window.getGlobalAcademicYear();
                    const userStudents = data.students.filter(s => (s.importedBy || 'unknown') === currentUserId && (s.academicYear || '') === currentAcademicYear);
                    let existing = null;

                    // 0. Priorité absolue : Mapping manuel du Wizard
                    if (studentMapping && studentMapping[index]) {
                        existing = data.students.find(s => s.id === studentMapping[index]);
                    }

                    // A. Essayer par Numéro d'Inscription ET Classe (le plus fiable)
                    if (!existing && regNumber && className) {
                        existing = userStudents.find(s =>
                            s.regNumber == regNumber &&
                            s.className.trim() === className.trim()
                        );
                    }
                    // B. Si pas trouvé, essayer par NIN
                    if (!existing && nin) {
                        existing = userStudents.find(s => s.nin == nin);
                    }
                    // C. Si pas trouvé, essayer Nom + Prénom + Classe (Comparaison stricte sans espaces)
                    if (!existing) {
                        existing = userStudents.find(s =>
                            s.name.trim() === name &&
                            s.className.trim() === className
                        );
                    }

                    // Objet contenant les données à sauvegarder
                const studentData = {
                    name,
                    className,
                    academicYear: window.getGlobalAcademicYear(),
                    nin,
                    firstName,
                    lastName,
                    sex,
                    birthDate,
                    regNumber
                };

                // --- CORRECTION 2 : IMPORTATION DES NOTES (Colonnes supplémentaires) ---
                // On initialise un objet 'grades' s'il n'existe pas
                const importedGrades = {};
                headers.forEach((header, index) => {
                    // Si la colonne n'est pas une info élève et qu'elle a un titre
                    if (!knownIndices.includes(index) && header && row[index] !== undefined) {
                        // On enregistre la note associée au nom de la colonne (ex: "Devoir 1")
                        importedGrades[cleanStr(header)] = row[index];
                    }
                });

                if (existing) {
                    // MISE A JOUR de l'élève existant
                    Object.assign(existing, studentData); // Met à jour infos perso
                    
                    // Note: Les notes importées via ce fichier Excel (type Rakmana) ne sont pas compatibles 
                    // avec la structure data.grades[studentId][assignmentId].
                    // Pour l'instant, on ignore l'importation des notes brutes ici car elles nécessitent 
                    // d'abord la création de Devoirs correspondants dans l'application.
                    
                    updated++;
                } else {
                    // CRÉATION d'un nouvel élève
                    data.students.push({
                        id: genId(),
                        academicYear: window.getGlobalAcademicYear(),
                     importedBy: window.currentUser?.email || window.currentUser?.id || 'unknown',
                        ...studentData
                    });
                    added++;
                }
            });

            saveData();
            window.renderStudents();
            window.renderClassList();
            window.loadClassSelectors();

            // Recharger les sélecteurs et le récapitulatif si nécessaire
            if (typeof window.renderSummary === 'function') window.renderSummary();
            if (typeof window.loadGradeSelectors === 'function') window.loadGradeSelectors();
            
            try {
                if (window.showTab) window.showTab('students');
                if (window.renderAssignments) window.renderAssignments();
                if (window.loadClassSelectors) window.loadClassSelectors();
                if (window.loadClassSelectorsForExport) window.loadClassSelectorsForExport();
                if (window.renderExportPrep) window.renderExportPrep();
                if (window.applyLanguage) window.applyLanguage();
                // softResetUI?.(); // Removed or check existence
                console.log("✅ APP RAFFRAICHIE !");
            } catch (e) {
                console.warn("Refresh:", e);
            }
            
            alert(`${t.importSuccess}\nAjoutés: ${added}\nMis à jour: ${updated}`);
            event.target.value = '';
        };

        if (window.startImportWizard) {
            window.startImportWizard(parsedRows, excelClasses, runImport);
        } else {
            runImport();
        }
    };
        reader.readAsArrayBuffer(file);
    };

})();
