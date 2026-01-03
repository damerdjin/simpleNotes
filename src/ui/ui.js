
(function () {
    // Helper to access globals
    const getData = () => window.data;
    const getTranslations = () => window.translations;
    const getLang = () => window.currentLanguage;

    // --- Date Helpers ---
    window.parseDateMaybeExcel = function(value) {
        if (value === undefined || value === null) return null;
        if (value instanceof Date && !isNaN(value)) return value;

        const v = String(value).trim();
        if (!v) return null;

        const num = Number(v);
        if (!isNaN(num) && num > 10000) {
            const excelEpoch = new Date(Date.UTC(1899, 11, 30));
            return new Date(excelEpoch.getTime() + num * 86400 * 1000);
        }

        const d = new Date(v);
        return isNaN(d) ? null : d;
    };

    window.formatDate = function(d) {
        if (!d) return '';
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    };

    // --- UI Helpers ---

    window.setTextContent = function(selector, text) {
        const element = document.querySelector(selector);
        if (element) element.textContent = text;
    };

    window.setAttribute = function(selector, attr, value) {
        const element = document.querySelector(selector);
        if (element) element.setAttribute(attr, value);
    };

    // --- Color Management ---
    const classColorsMap = {};
    const availableClassColors = [
        '#3b82f6', // blue-500
        '#10b981', // emerald-500
        '#f97316', // orange-500
        '#ef4444', // red-500
        '#8b5cf6', // violet-500
        '#ec4899', // pink-500
        '#06b6d4', // cyan-500
        '#14b8a6', // teal-500
        '#6366f1', // indigo-500
        '#f59e0b', // amber-500
    ];

    window.getClassColor = function(className) {
        if (!className) return '#6b7280'; // gray-500
        const trimmed = className.trim();
        if (classColorsMap[trimmed]) return classColorsMap[trimmed];

        let hash = 0;
        for (let i = 0; i < trimmed.length; i++) {
            hash = trimmed.charCodeAt(i) + ((hash << 5) - hash);
        }
        const colorIndex = Math.abs(hash) % availableClassColors.length;
        classColorsMap[trimmed] = availableClassColors[colorIndex];
        return classColorsMap[trimmed];
    };

    // --- Tab Navigation (New System) ---

    window.initTabs = function() {
        if (!window.tabs) {
            console.error("Tabs controller not loaded");
            return;
        }

        const t = getTranslations() && getTranslations()[getLang()] ? getTranslations()[getLang()] : {};

        // 1. Register Students Tab
        window.tabs.registerTab('students', {
            label: t.studentsTab || 'Élèves',
            icon: '',
            onShow: () => {
                if (window.loadClassSelectors) window.loadClassSelectors();
                if (window.renderClassList) window.renderClassList();
                if (window.renderStudents) window.renderStudents();
            }
        });

        // 2. Register Assignments Tab
        window.tabs.registerTab('assignments', {
            label: t.assignmentsTab || 'Devoirs',
            icon: '',
            onShow: () => {
                if (window.loadClassSelectorsForAssignments) window.loadClassSelectorsForAssignments();
                if (window.renderAssignments) window.renderAssignments();
            }
        });

        // 3. Register Grades Tab
        window.tabs.registerTab('grades', {
            label: t.gradesTab || 'Notes',
            icon: '',
            onShow: () => {
                if (window.loadClassSelectors) window.loadClassSelectors();
                if (window.loadGradeSelectors) window.loadGradeSelectors();
            }
        });

        // 4. Register Summary Tab
        window.tabs.registerTab('summary', {
            label: t.summaryTab || 'Récapitulatif',
            icon: '',
            onShow: () => {
                if (window.loadClassSelectors) window.loadClassSelectors();
                if (window.renderSummary) window.renderSummary();
            }
        });

        // 5. Register Export Tab
        window.tabs.registerTab('export', {
            label: 'Export', // Simple fallback
            icon: '',
            onShow: () => {
                if (window.loadClassSelectorsForExport) window.loadClassSelectorsForExport();
                if (window.renderExportPrep) window.renderExportPrep();
            }
        });
        
        // Initial translation update to ensure correct labels
        window.translateTabs();
    };

    window.showTab = function(tabId) {
        if (window.tabs) {
            window.tabs.activateTab(tabId);
        } else {
            console.error("Tabs system not ready");
            // Fallback legacy
            document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
            const content = document.getElementById('content-' + tabId);
            if (content) content.classList.remove('hidden');
        }
    };

    window.translateTabs = function() {
        const t = getTranslations()[getLang()];
        if (!t || !window.tabs) return;

        window.tabs.updateTab('students', { label: t.studentsTab || 'Élèves' });
        window.tabs.updateTab('assignments', { label: t.assignmentsTab || 'Devoirs' });
        window.tabs.updateTab('grades', { label: t.gradesTab || 'Notes' });
        window.tabs.updateTab('summary', { label: t.summaryTab || 'Récapitulatif' });
        window.tabs.updateTab('export', { label: t.exportPrepTitle || 'Préparation Export' });
    };

    // --- Language & Translation ---

    window.initLanguage = function() {
        const stored = localStorage.getItem('corrections-language');
        if (stored) {
            window.currentLanguage = stored;
        } else {
            // Détection automatique
            const browserLang = navigator.language || navigator.userLanguage;
            if (browserLang.startsWith('ar')) {
                window.currentLanguage = 'ar';
            } else if (browserLang.startsWith('en')) {
                window.currentLanguage = 'en';
            } else {
                window.currentLanguage = 'fr';
            }
        }
        // Delay to ensure modules are loaded
        setTimeout(() => window.applyLanguage(), 0);
    };

    window.changeLanguage = function(lang) {
        window.currentLanguage = lang;
        localStorage.setItem('corrections-language', lang);
        window.applyLanguage();
    };

    window.applyLanguage = function() {
        window.isRTL = window.currentLanguage === 'ar';

        // Appliquer la direction
        document.body.dir = window.isRTL ? 'rtl' : 'ltr';
        document.body.className = window.isRTL ? 'rtl-layout' : 'ltr-layout';

        // Traduire tous les éléments
        window.translatePage();

        // Re-rendre les composants dynamiques
        if (typeof window.renderStudents === 'function') window.renderStudents();
        if (typeof window.renderClassList === 'function') window.renderClassList();
        if (typeof window.renderAssignments === 'function') window.renderAssignments();
        if (typeof window.renderSummary === 'function') window.renderSummary();
        if (typeof window.loadGradeSelectors === 'function') window.loadGradeSelectors();
        if (typeof window.renderExportPrep === 'function') window.renderExportPrep();
        if (typeof window.loadClassSelectorsForExport === 'function') window.loadClassSelectorsForExport();
    };

    window.translatePage = function() {
        const lang = getLang();
        const t = getTranslations()[lang];
        if (!t) return;

        // Traduire les éléments avec data-translate
        document.querySelectorAll('[data-translate]').forEach(element => {
            const key = element.getAttribute('data-translate');
            if (t[key]) {
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    element.value = t[key];
                } else {
                    element.textContent = t[key];
                }
            }
        });

        // Traduire les placeholders avec data-translate-placeholder
        document.querySelectorAll('[data-translate-placeholder]').forEach(element => {
            const key = element.getAttribute('data-translate-placeholder');
            if (t[key]) {
                element.placeholder = t[key];
            }
        });

        // Mettre à jour le placeholder du champ de recherche
        const searchInput = document.getElementById('student-search');
        if (searchInput && t.search) {
            searchInput.placeholder = t.search;
        }

        // Titre et sous-titre
        window.setTextContent('h1', t.appTitle);
        window.setTextContent('header p', t.appSubtitle);

        // Update Tabs
        window.translateTabs();

        // Onglet Étudiants
        window.setTextContent('#content-students h2', t.studentsList);
        window.setTextContent('#student-import + span', t.importExcel);
        window.setTextContent('button[onclick="openStudentModal()"]', t.addStudent);
        window.setTextContent('#content-students h3', t.classManagement);

        // Modal étudiant
        window.setTextContent('#student-modal h3', t.addStudentTitle);
        window.setAttribute('#student-lastname', 'placeholder', t.lastName);
        window.setAttribute('#student-firstname', 'placeholder', t.firstName);
        window.setAttribute('#student-class', 'placeholder', t.className);
        window.setAttribute('#student-nin', 'placeholder', t.nin);
        window.setTextContent('.modal button:first-child', t.cancel);
        window.setTextContent('.modal button:last-child', t.add);

        // Onglet Devoirs
        window.setTextContent('#content-assignments h2', t.assignmentsManagement);
        window.setTextContent('button[onclick="openAssignmentModal()"]', t.createAssignment);

        // Labels des filtres
        const chipsContainer = document.querySelector('#assignment-class-chips');
        if (chipsContainer && chipsContainer.previousElementSibling) {
            chipsContainer.previousElementSibling.textContent = t.filterByClass;
        }

        window.setAttribute('#filter-name-assignments', 'placeholder', t.searchAssignment);
        
        // Update dynamic texts
        window.updateDynamicTexts();

        // Rafraîchir les sélecteurs de classe
        if (typeof window.loadClassSelectors === 'function') window.loadClassSelectors();
        if (typeof window.loadGradeSelectors === 'function') window.loadGradeSelectors();
    };

    window.updateDynamicTexts = function() {
        const t = getTranslations()[getLang()];

        // Mettre à jour les tooltips simples
        document.querySelectorAll('button[onclick*="openAssignmentModal"]').forEach(btn => btn.title = t.edit);
        document.querySelectorAll('button[onclick*="deleteAssignment"]').forEach(btn => btn.title = t.delete);

        // Ne pas écraser les tooltips spécifiques de duplication s'ils sont déjà précis
        document.querySelectorAll('button[onclick*="duplicateAssignment"]').forEach(btn => {
            if (!btn.title || btn.title === t.duplicate) {
                btn.title = t.duplicate;
            }
        });

        const exportBtn = document.querySelector('#btn-export-json');
        if (exportBtn) exportBtn.textContent = t.exportJson;

        const exportExcelBtn = document.querySelector('#btn-export-excel');
        if (exportExcelBtn) exportExcelBtn.textContent = t.exportExcel;
    };

    // --- UI Guard & Reset ---

    window.softResetUI = function() {
        try { if(window.closeRemarksModal) window.closeRemarksModal(); } catch (e) { }
        try { if(window.closeAssignmentModal) window.closeAssignmentModal(); } catch (e) { }
        const rm = document.getElementById('remarks-modal'); if (rm) rm.remove();
        const am = document.getElementById('assignment-modal'); if (am) am.remove();
        const sm = document.getElementById('student-modal'); if (sm) { sm.classList.remove('active'); sm.classList.add('hidden'); }
        document.body.style.pointerEvents = '';
        document.body.style.overflow = '';
        
        const tabs = Array.from(document.querySelectorAll('.tab-content'));
        const active = tabs.find(t => !t.classList.contains('hidden'));
        if (active) {
            const id = active.id;
            if (id === 'content-summary') {
                if (typeof window.renderSummary === 'function') window.renderSummary();
            }
            else if (id === 'content-assignments' && window.renderAssignments) window.renderAssignments();
            else if (id === 'content-export' && window.renderExportPrep) window.renderExportPrep();
            else if (id === 'content-grades' && window.loadGradeEntry) window.loadGradeEntry();
        }
        const b = document.getElementById('ui-error-banner'); if (b) b.style.display = 'none';
    };

    window.showUiErrorBanner = function(msg) {
        let b = document.getElementById('ui-error-banner');
        if (!b) {
            b = document.createElement('div');
            b.id = 'ui-error-banner';
            b.className = 'fixed top-2 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded shadow flex items-center gap-2 z-50';
            b.innerHTML = '<span id="ui-error-text"></span><button onclick="softResetUI()" class="px-2 py-1 bg-white text-red-600 rounded">Réinitialiser</button>';
            document.body.appendChild(b);
        }
        const s = document.getElementById('ui-error-text');
        if (s) s.textContent = msg || 'Erreur inattendue';
        b.style.display = 'flex';
    };

    window.setupGlobalUiGuard = function() {
        window.addEventListener('error', (e) => {
            const m = (e.error && e.error.message) || e.message || 'Erreur';
            window.showUiErrorBanner(m);
        });
        window.addEventListener('unhandledrejection', (e) => {
            const m = (e && e.reason && (e.reason.message || e.reason)) || 'Erreur asynchrone';
            window.showUiErrorBanner(m);
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                try { if(window.closeRemarksModal) window.closeRemarksModal(); } catch (_) { }
                try { if(window.closeAssignmentModal) window.closeAssignmentModal(); } catch (_) { }
                const rm = document.getElementById('remarks-modal'); if (rm) rm.remove();
                const am = document.getElementById('assignment-modal'); if (am) am.remove();
            }
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'r') {
                window.softResetUI();
            }
        });
    };
    
    // --- Global Filters (Academic Year & Trimester) ---

    window.loadGlobalFilters = function() {
        const academicYear = localStorage.getItem('corrections-global-academic-year') || '';
        const trimester = localStorage.getItem('corrections-global-trimester') || '';

        const academicSelect = document.getElementById('global-academic-year');
        const trimesterSelect = document.getElementById('global-trimester');

        if (academicSelect) academicSelect.value = academicYear;
        if (trimesterSelect) {
            trimesterSelect.value = trimester;
            trimesterSelect.disabled = !academicYear;
        }

        // Disable import buttons and labels if no trimester selected
        const importButtons = [
            'student-import',
            'json-import'
        ];
        const importLabels = [
            'student-import-label',
            'json-import-label'
        ];
        const disabled = !academicYear || !trimester;
        importButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.disabled = disabled;
        });
        importLabels.forEach(id => {
            const label = document.getElementById(id);
            if (label) {
                if (disabled) {
                    label.classList.add('opacity-50', 'cursor-not-allowed');
                } else {
                    label.classList.remove('opacity-50', 'cursor-not-allowed');
                }
            }
        });
    };

    window.setGlobalAcademicYear = function(value) {
        localStorage.setItem('corrections-global-academic-year', value);
        // If no academic year, clear trimester
        if (!value) {
            localStorage.removeItem('corrections-global-trimester');
        }
        // Update UI states
        const trimesterSelect = document.getElementById('global-trimester');
        if (trimesterSelect) {
            trimesterSelect.disabled = !value;
            if (!value) trimesterSelect.value = '';
        }
        // Update import buttons and labels
        const importButtons = [
            'student-import',
            'json-import'
        ];
        const importLabels = [
            'student-import-label',
            'json-import-label'
        ];
        const disabled = !value || !localStorage.getItem('corrections-global-trimester');
        importButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.disabled = disabled;
        });
        importLabels.forEach(id => {
            const label = document.getElementById(id);
            if (label) {
                if (disabled) {
                    label.classList.add('opacity-50', 'cursor-not-allowed');
                } else {
                    label.classList.remove('opacity-50', 'cursor-not-allowed');
                }
            }
        });
        // Update classes and re-render all tabs
        if (window.loadClassSelectors) window.loadClassSelectors();
        if (window.loadClassSelectorsForAssignments) window.loadClassSelectorsForAssignments();
        if (window.renderClassList) window.renderClassList();
        if (window.renderStudents) window.renderStudents();
        if (window.renderAssignments) window.renderAssignments();
        if (window.renderSummary) window.renderSummary();
        if (window.loadGradeSelectors) window.loadGradeSelectors();
        if (window.renderExportPrep) window.renderExportPrep();
    };

    window.setGlobalTrimester = function(value) {
        localStorage.setItem('corrections-global-trimester', value);
        // Update import buttons and labels
        const importButtons = [
            'student-import',
            'json-import'
        ];
        const importLabels = [
            'student-import-label',
            'json-import-label'
        ];
        const academicYear = localStorage.getItem('corrections-global-academic-year');
        const disabled = !academicYear || !value;
        importButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.disabled = disabled;
        });
        importLabels.forEach(id => {
            const label = document.getElementById(id);
            if (label) {
                if (disabled) {
                    label.classList.add('opacity-50', 'cursor-not-allowed');
                } else {
                    label.classList.remove('opacity-50', 'cursor-not-allowed');
                }
            }
        });
        // Re-render all tabs to apply the filter
        if (window.renderStudents) window.renderStudents();
        if (window.renderAssignments) window.renderAssignments();
        if (window.renderSummary) window.renderSummary();
        if (window.loadGradeSelectors) window.loadGradeSelectors();
        if (window.renderExportPrep) window.renderExportPrep();
    };

    window.getGlobalAcademicYear = function() {
        return localStorage.getItem('corrections-global-academic-year') || '';
    };

    window.getGlobalTrimester = function() {
        return localStorage.getItem('corrections-global-trimester') || '';
    };

    // Auto-setup guard
    window.setupGlobalUiGuard();

})();
