
import { settingsAdapter } from '../storage/settings.adapter.js';
import { supabase } from './supabase-client.js';

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

        // Try parsing DD/MM/YYYY explicitly
        const dmy = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dmy) {
            const d = new Date(dmy[3], dmy[2] - 1, dmy[1]);
            return isNaN(d) ? null : d;
        }

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
    
    window.initHistory = function() {
        // État initial : on s'assure d'avoir un état même au premier chargement
        // On utilise replaceState pour ne pas polluer l'historique mais avoir un état de base
        const currentTab = (window.tabs && window.tabs.activeTab) ? window.tabs.activeTab : 'dashboard';
        const initialState = { tab: currentTab, subView: null };
        
        if (!history.state || !history.state.tab) {
            history.replaceState(initialState, '');
        }

        window.addEventListener('popstate', (event) => {
            const state = event.state;
            
            // Sur smartphone, si on revient au tout début, l'état peut être null
            // ou ne pas contenir les informations nécessaires
            if (!state || !state.tab) {
                // On force le retour à l'onglet par défaut (Élèves) et vue liste des classes
                if (window.tabs && window.tabs.activeTab !== 'dashboard') {
                    window.tabs.activateTab('dashboard', { skipHistory: true });
                }
                
                // Si l'état était null, on le remplace par l'état initial pour les prochains retours
                if (!state) {
                    history.replaceState(initialState, '');
                }
                
                // Fermer la sidebar mobile
                const sidebar = document.getElementById('app-sidebar');
                if (sidebar) sidebar.classList.remove('mobile-visible');
                return;
            }

            if (state.tab) {
                // Si on change de tab
                if (window.tabs && window.tabs.activeTab !== state.tab) {
                    window.tabs.activateTab(state.tab, { skipHistory: true });
                }

                // Gestion spécifique pour l'onglet Élèves
                if (state.tab === 'students') {
                    if (window.setStudentsSelectedClass) {
                        window.setStudentsSelectedClass(state.className || '', { skipHistory: true, force: true });
                    }
                }
                
                // On ferme la sidebar mobile au cas où
                const sidebar = document.getElementById('app-sidebar');
                if (sidebar) sidebar.classList.remove('mobile-visible');
            }
        });
    };

    window.initTabs = function() {
        if (!window.tabs) {
            console.error("Tabs controller not loaded");
            return;
        }

        const t = getTranslations() && getTranslations()[getLang()] ? getTranslations()[getLang()] : {};

        // 1. Register Dashboard Tab (Home page)
        window.tabs.registerTab('dashboard', {
            label: t.dashboardTitle || 'Dashboard',
            icon: '📈',
            onShow: () => {
                if (window.renderDashboard) window.renderDashboard();
            }
        });

        // 2. Register Students Tab
        window.tabs.registerTab('students', {
            label: t.studentsTab || 'Élèves',
            icon: '👥',
            onShow: async () => {
                if (window.loadClassSelectors) await window.loadClassSelectors();
                if (window.renderClassList) await window.renderClassList();
                if (window.renderStudents) await window.renderStudents();
            }
        });

        // 3. Register Assignments Tab
        window.tabs.registerTab('assignments', {
            label: t.assignmentsTab || 'Devoirs',
            icon: '📝',
            onShow: () => {
                if (window.loadClassSelectorsForAssignments) window.loadClassSelectorsForAssignments();
                if (window.renderAssignments) window.renderAssignments();
            }
        });

        // 4. Register Grades Tab
        window.tabs.registerTab('grades', {
            label: t.gradesTab || 'Notes',
            icon: '📊',
            onShow: async () => {
                if (window.loadClassSelectors) await window.loadClassSelectors();
                if (window.loadGradeSelectors) await window.loadGradeSelectors();
            }
        });

        // 5. Register Summary Tab
        window.tabs.registerTab('summary', {
            label: t.summaryTab || 'Récapitulatif',
            icon: '📋',
            onShow: async (options = {}) => {
                // Si on n'est pas en train de forcer une vue spécifique (ex: via Visualiser les notes)
                if (!options.keepFilters && window.resetSummaryFilters) {
                    window.resetSummaryFilters();
                }
                
                if (window.loadClassSelectors) await window.loadClassSelectors();
                if (window.renderSummary) window.renderSummary();
            }
        });

        // 6. Register Export Tab
        window.tabs.registerTab('export', {
            label: t.exportPrepTitle || 'Export',
            icon: '📦',
            onShow: async () => {
                if (window.loadClassSelectorsForExport) await window.loadClassSelectorsForExport();
                if (window.renderExportPrep) window.renderExportPrep();
            }
        });

        // 7. Register Config Tab
        window.tabs.registerTab('config', {
            label: t.configTitle || 'Configuration',
            icon: '⚙️',
            hideNav: true,
            onShow: () => {
                // Future config logic
            }
        });
        
        // Initial translation update to ensure correct labels
        window.translateTabs();
    };

    window.showTab = async function(tabId, options = {}) {
        if (window.tabs) {
            const isAlreadyActive = window.tabs.activeTab === tabId;
            const success = await window.tabs.activateTab(tabId, options);
            
            // Highlight active tab in mobile bottom nav
            document.querySelectorAll('.mobile-nav-item').forEach(item => {
                item.classList.toggle('active', item.dataset.tab === tabId);
            });

            // Si on clique sur l'onglet déjà actif, on reset sa vue interne
            if (isAlreadyActive && !options.skipHistory) {
                if (tabId === 'students' && window.setStudentsSelectedClass) {
                    window.setStudentsSelectedClass('', { skipHistory: false });
                }
                return true;
            }

            // Gérer l'historique si ce n'est pas un retour en arrière
            if (success && !options.skipHistory) {
                history.pushState({ tab: tabId, subView: null }, '');
            }
            
            // Si on change d'onglet, on s'assure que la vue interne est cohérente
            if (success && tabId === 'students' && window.setStudentsSelectedClass) {
                // Par défaut, quand on clique sur l'onglet Élèves, on veut la liste des classes
                window.setStudentsSelectedClass('', { skipHistory: true });
            }

            // Render dashboard when switching to it (invalidate cache first for fresh data)
            if (success && tabId === 'dashboard' && window.renderDashboard) {
                if (window.invalidateDashboardCache) window.invalidateDashboardCache();
                window.renderDashboard();
            }

            // On mobile, close sidebar after selection
            const sidebar = document.getElementById('app-sidebar');
            if (sidebar && window.innerWidth <= 768) {
                sidebar.classList.remove('mobile-visible');
            }
        } else {
            console.error("Tabs system not ready");
            // Fallback legacy
            document.querySelectorAll('.tab-content, .view-section').forEach(el => el.classList.add('hidden'));
            const content = document.getElementById('content-' + tabId);
            if (content) content.classList.remove('hidden');
        }
    };

    window.switchTab = window.showTab;

    // --- Layout & Mobile ---

    window.initMobileMenu = function() {
        const hamburger = document.getElementById('hamburger-menu');
        const sidebar = document.getElementById('app-sidebar');
        
        if (hamburger && sidebar) {
            hamburger.addEventListener('click', (e) => {
                e.stopPropagation();
                sidebar.classList.toggle('mobile-visible');
            });

            // Close sidebar when clicking outside
            document.addEventListener('click', (e) => {
                if (sidebar.classList.contains('mobile-visible') && 
                    !sidebar.contains(e.target) && 
                    !hamburger.contains(e.target)) {
                    sidebar.classList.remove('mobile-visible');
                }
            });
        }
    };

    window.initSidebarCollapse = function() {
        const toggleBtn = document.getElementById('sidebar-toggle');
        const body = document.body;
        
        // Restore state
        const stored = localStorage.getItem('sidebar-collapsed');
        if (stored === 'true') {
            body.classList.add('sidebar-collapsed');
        }

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                body.classList.toggle('sidebar-collapsed');
                const isCollapsed = body.classList.contains('sidebar-collapsed');
                localStorage.setItem('sidebar-collapsed', isCollapsed);
            });
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
        window.tabs.updateTab('config', { label: t.configTitle || 'Configuration' });
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
        settingsAdapter.saveSettings({ language: lang });
        window.applyLanguage();
    };

    window.applyLanguage = async function() {
        window.isRTL = window.currentLanguage === 'ar';

        // Appliquer la direction
        document.body.dir = window.isRTL ? 'rtl' : 'ltr';

        // Scroll listener for sticky headers
        window.addEventListener('scroll', () => {
            const threshold = 100;
            if (window.scrollY > threshold) {
                document.body.classList.add('scrolled');
            } else {
                document.body.classList.remove('scrolled');
            }
        });
        document.body.className = window.isRTL ? 'rtl-layout' : 'ltr-layout';

        // Traduire tous les éléments
        await window.translatePage();

        // Re-rendre les composants dynamiques
        if (typeof window.renderStudents === 'function') await window.renderStudents();
        if (typeof window.renderClassList === 'function') await window.renderClassList();
        if (typeof window.renderAssignments === 'function') window.renderAssignments();
        if (typeof window.renderSummary === 'function') window.renderSummary();
        if (typeof window.loadGradeSelectors === 'function') await window.loadGradeSelectors();
        if (typeof window.renderExportPrep === 'function') window.renderExportPrep();
        if (typeof window.loadClassSelectorsForExport === 'function') await window.loadClassSelectorsForExport();
    };

    window.translatePage = async function() {
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
        // window.setTextContent('#content-students h2', t.studentsList); // Redondant avec data-translate
        // window.setTextContent('#student-import + span', t.importExcel); // Redondant avec data-translate
        // window.setTextContent('button[onclick="openStudentModal()"]', t.addStudent); // Risque d'effacer l'icône SVG
        // window.setTextContent('#content-students h3', t.classManagement); // BUG: Écrase le nom de la première classe

        // Modal étudiant
        // window.setTextContent('#student-modal h3', t.addStudentTitle); // Géré par data-translate et openStudentModal
        window.setAttribute('#student-lastname', 'placeholder', t.lastName);
        window.setAttribute('#student-firstname', 'placeholder', t.firstName);
        window.setAttribute('#student-class', 'placeholder', t.className);
        window.setAttribute('#student-nin', 'placeholder', t.nin);
        // window.setTextContent('.modal button:first-child', t.cancel); // Trop générique, géré par data-translate
        // window.setTextContent('.modal button:last-child', t.add); // Trop générique, géré par data-translate

        // Onglet Devoirs
        // window.setTextContent('#content-assignments h2', t.assignmentsManagement); // Redondant
        // window.setTextContent('button[onclick="openAssignmentModal()"]', t.createAssignment); // Redondant

        // Labels des filtres
        const chipsContainer = document.querySelector('#assignment-class-chips');
        // if (chipsContainer && chipsContainer.previousElementSibling) {
        //     chipsContainer.previousElementSibling.textContent = t.filterByClass; // Redondant
        // }

        window.setAttribute('#filter-name-assignments', 'placeholder', t.searchAssignment);
        
        // Update dynamic texts
        window.updateDynamicTexts();

        // Rafraîchir les sélecteurs de classe
        if (typeof window.loadClassSelectors === 'function') await window.loadClassSelectors();
        if (typeof window.loadGradeSelectors === 'function') await window.loadGradeSelectors();
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
        const sm = document.getElementById('student-modal'); 
        if (sm) { 
            sm.classList.remove('active'); 
            sm.classList.add('hidden'); 
        }
        const header = document.getElementById('app-header');
        if (header) {
            header.style.removeProperty('display');
        }
        
        document.body.style.pointerEvents = '';
        document.body.style.overflow = '';
        
        const tabs = Array.from(document.querySelectorAll('.tab-content, .view-section'));
        const active = tabs.find(t => t.classList.contains('active'));
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
            const t = getTranslations()[getLang()];
        b.innerHTML = `<span id="ui-error-text"></span><button onclick="softResetUI()" class="px-2 py-1 bg-white text-red-600 rounded">${t.reset}</button>`;
            document.body.appendChild(b);
        }
        const s = document.getElementById('ui-error-text');
        const t = getTranslations()[getLang()];
        if (s) s.textContent = msg || t.unexpectedError;
        b.style.display = 'flex';
    };

    window.setupGlobalUiGuard = function() {
        window.addEventListener('error', (e) => {
            const t = getTranslations()[getLang()];
            const m = (e.error && e.error.message) || e.message || t.error;
            window.showUiErrorBanner(m);
        });
        window.addEventListener('unhandledrejection', (e) => {
            const t = getTranslations()[getLang()];
            const m = (e && e.reason && (e.reason.message || e.reason)) || t.asyncError;
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

    const CACHE_KEY_ACADEMIC_YEARS = 'corrections-cached-academic-years';
    const CACHE_KEY_TRIMESTERS = 'corrections-cached-trimesters';

    // In-memory lists initialized with cached data or safe defaults
    window.academicYearsList = (() => {
        try {
            const cached = localStorage.getItem(CACHE_KEY_ACADEMIC_YEARS);
            return cached ? JSON.parse(cached) : [
                { id: 4, year: '2026/2027', is_active: true },
                { id: 2, year: '2025/2026', is_active: true }
            ];
        } catch (_) {
            return [
                { id: 4, year: '2026/2027', is_active: true },
                { id: 2, year: '2025/2026', is_active: true }
            ];
        }
    })();

    window.trimestersList = (() => {
        try {
            const cached = localStorage.getItem(CACHE_KEY_TRIMESTERS);
            return cached ? JSON.parse(cached) : [];
        } catch (_) {
            return [];
        }
    })();

    /**
     * Fetches active academic years (is_active = true) and trimesters from Supabase
     */
    window.fetchAcademicSessions = async function() {
        try {
            const { data: years, error: yErr } = await supabase
                .from('academic_years')
                .select('*')
                .eq('is_active', true)
                .order('year', { ascending: false });

            if (!yErr && years && years.length > 0) {
                window.academicYearsList = years;
                try {
                    localStorage.setItem(CACHE_KEY_ACADEMIC_YEARS, JSON.stringify(years));
                } catch (_) {}
            }

            const { data: trimesters, error: tErr } = await supabase
                .from('trimesters')
                .select('*')
                .order('name', { ascending: true });

            if (!tErr && trimesters) {
                window.trimestersList = trimesters;
                try {
                    localStorage.setItem(CACHE_KEY_TRIMESTERS, JSON.stringify(trimesters));
                } catch (_) {}
            }
        } catch (e) {
            console.warn('[Session] Failed to fetch academic sessions from Supabase:', e);
        }

        if (window.renderSessionSelectors) {
            window.renderSessionSelectors();
        }
    };

    /**
     * Renders trimester buttons and options according to the selected academic year
     */
    window.renderTrimesterSelectors = function(year, currentTri) {
        const yearObj = window.academicYearsList?.find(y => y.year === year);
        let trimestersForYear = [];
        if (yearObj) {
            trimestersForYear = window.trimestersList?.filter(t => t.academic_year_id === yearObj.id) || [];
        }
        
        let triNames = trimestersForYear.map(t => String(t.name || t.number));
        if (triNames.length === 0) {
            // Default trimesters if none yet configured for this year
            triNames = ['1', '2', '3'];
        }

        const lang = window.getLang ? window.getLang() : (localStorage.getItem('corrections-language') || 'fr');
        const trans = window.translations ? (window.translations[lang] || window.translations['fr']) : {};

        // 1. Session Dropdown Trimester Buttons (#session-trimester-buttons)
        const triContainer = document.getElementById('session-trimester-buttons');
        if (triContainer) {
            triContainer.innerHTML = triNames.map(tNum => {
                const isBlocked = window.isTrimesterBlocked && window.isTrimesterBlocked(tNum, year);
                const tLabel = trans[`t${tNum}`] || `T${tNum}`;
                const label = isBlocked ? `🔒 ${tLabel}` : tLabel;
                const isSelected = String(currentTri) === String(tNum);
                const classes = isSelected
                    ? 'flex-1 py-2 rounded-lg text-xs font-bold border transition-all bg-blue-600 text-white border-blue-600'
                    : 'flex-1 py-2 rounded-lg text-xs font-bold border transition-all hover:bg-blue-50 border-gray-100 text-gray-600';
                return `<button onclick="updateTrimester('${tNum}')" id="btn-tri${tNum}" class="${classes}">${label}</button>`;
            }).join('');
        }

        // 2. Hidden Select (#global-trimester)
        const hiddenTriSelect = document.getElementById('global-trimester');
        if (hiddenTriSelect) {
            hiddenTriSelect.innerHTML = triNames.map(tNum => `<option value="${tNum}">${tNum}</option>`).join('');
            if (currentTri && triNames.includes(String(currentTri))) {
                hiddenTriSelect.value = currentTri;
            } else if (triNames.length > 0) {
                hiddenTriSelect.value = triNames[0];
            }
        }

        // 3. Mobile Trimester Buttons (#mobile-trimester-buttons)
        const mobileTriContainer = document.getElementById('mobile-trimester-buttons');
        if (mobileTriContainer) {
            mobileTriContainer.innerHTML = triNames.map(tNum => {
                const isSelected = String(currentTri) === String(tNum);
                const classes = isSelected
                    ? 'flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-all bg-blue-600 text-white border-blue-600'
                    : 'flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-all border-gray-100 text-gray-600 hover:bg-blue-50';
                return `<button onclick="updateTrimester('${tNum}')" data-mobile-tri="${tNum}" class="${classes}">T${tNum}</button>`;
            }).join('');
        }

        return triNames;
    };

    /**
     * Renders academic year options across desktop, mobile and form dropdowns
     */
    window.renderSessionSelectors = function() {
        // Filter strictly by is_active !== false (active years)
        const activeYears = (window.academicYearsList && window.academicYearsList.length > 0)
            ? window.academicYearsList.filter(y => y.is_active !== false)
            : [{ year: '2026/2027' }, { year: '2025/2026' }];

        const activeYearStrings = activeYears.map(y => y.year);
        let currentYear = window.getGlobalAcademicYear ? window.getGlobalAcademicYear() : localStorage.getItem('corrections-global-academic-year');
        
        // Auto-select valid active year if current is missing or inactive
        if (!currentYear || !activeYearStrings.includes(currentYear)) {
            const autoYear = window.getAutoAcademicYear ? window.getAutoAcademicYear() : null;
            if (autoYear && activeYearStrings.includes(autoYear)) {
                currentYear = autoYear;
            } else {
                currentYear = activeYearStrings[0] || '2026/2027';
            }
            localStorage.setItem('corrections-global-academic-year', currentYear);
        }

        let currentTri = window.getGlobalTrimester ? window.getGlobalTrimester() : (localStorage.getItem('corrections-global-trimester') || '1');

        // 1. Session Dropdown Years List (#session-years-list)
        const yearsListEl = document.getElementById('session-years-list');
        if (yearsListEl) {
            yearsListEl.innerHTML = activeYears.map(y => {
                const yStr = y.year;
                const yearShort = yStr.substring(0, 4);
                const formatted = yStr.includes('/') ? yStr.replace('/', ' / ') : yStr;
                const isYearBlocked = window.isTrimesterBlocked && window.isTrimesterBlocked(1, yStr);
                const displayLabel = isYearBlocked ? `🔒 ${formatted}` : formatted;
                return `
                    <div class="year-option px-4 py-2 hover:bg-blue-50 text-sm font-bold text-gray-600 hover:text-blue-700 cursor-pointer transition-colors flex items-center justify-between" data-year="${yStr}" onclick="updateYear('${yStr}')">
                        <span>${displayLabel}</span>
                        <div class="w-1.5 h-1.5 rounded-full bg-blue-500 hidden" id="check-${yearShort}"></div>
                    </div>
                `;
            }).join('');
        }

        // 2. Hidden Academic Year Select (#global-academic-year)
        const hiddenYearSelect = document.getElementById('global-academic-year');
        if (hiddenYearSelect) {
            hiddenYearSelect.innerHTML = activeYears.map(y => `<option value="${y.year}">${y.year}</option>`).join('');
            hiddenYearSelect.value = currentYear;
        }

        // 3. Student Academic Year Select (#student-academic-year)
        const studentYearSelect = document.getElementById('student-academic-year');
        if (studentYearSelect) {
            const prompt = (window.translations && window.currentLanguage && window.translations[window.currentLanguage]?.academicYearOption) || '-- Sélectionner --';
            studentYearSelect.innerHTML = `
                <option value="">${prompt}</option>
                ${activeYears.map(y => `<option value="${y.year}">${y.year}</option>`).join('')}
            `;
            studentYearSelect.value = currentYear;
        }

        // 4. Mobile Year Buttons (#mobile-year-buttons)
        const mobileYearContainer = document.getElementById('mobile-year-buttons');
        if (mobileYearContainer) {
            mobileYearContainer.innerHTML = activeYears.map(y => `
                <button onclick="updateYear('${y.year}')" data-mobile-year="${y.year}" class="flex-1 min-w-[70px] py-1.5 rounded-lg text-[11px] font-bold border border-gray-100 text-gray-600 hover:bg-blue-50 transition-all">${y.year}</button>
            `).join('');
        }

        // 5. Render trimesters according to selected year
        const availableTris = window.renderTrimesterSelectors(currentYear, currentTri);
        if (!availableTris.includes(String(currentTri))) {
            currentTri = availableTris[0] || '1';
            localStorage.setItem('corrections-global-trimester', currentTri);
        }

        // 6. Sync visual display
        if (window.syncGlobalUI) window.syncGlobalUI();
    };

    window.loadGlobalFilters = function() {
        if (window.renderSessionSelectors) window.renderSessionSelectors();

        let academicYear = localStorage.getItem('corrections-global-academic-year');
        let trimester = localStorage.getItem('corrections-global-trimester');

        const activeYears = (window.academicYearsList && window.academicYearsList.length > 0)
            ? window.academicYearsList.filter(y => y.is_active !== false)
            : [];
        const activeYearStrings = activeYears.map(y => y.year);

        // Ensure selected year is among active years
        if (!academicYear || (activeYearStrings.length > 0 && !activeYearStrings.includes(academicYear))) {
            const autoYear = window.getAutoAcademicYear ? window.getAutoAcademicYear() : null;
            if (autoYear && activeYearStrings.includes(autoYear)) {
                academicYear = autoYear;
            } else {
                academicYear = activeYearStrings[0] || "2026/2027";
            }
            localStorage.setItem('corrections-global-academic-year', academicYear);
        }

        if (!trimester) {
            trimester = "1";
            localStorage.setItem('corrections-global-trimester', trimester);
        }

        const academicSelect = document.getElementById('global-academic-year');
        const trimesterSelect = document.getElementById('global-trimester');

        if (academicSelect) academicSelect.value = academicYear;
        if (trimesterSelect) {
            trimesterSelect.value = trimester;
            trimesterSelect.disabled = !academicYear;
        }

        // Sync visual UI
        if (window.syncGlobalUI) window.syncGlobalUI();

        // Disable import buttons and labels if no trimester selected
        const importButtons = [
            'json-import'
        ];
        const importLabels = [
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
        settingsAdapter.saveSettings({ current_academic_year: value });
        // If no academic year, clear trimester
        if (!value) {
            localStorage.removeItem('corrections-global-trimester');
        }
        
        // Update hidden select if it exists (for compatibility)
        const hiddenSelect = document.getElementById('global-academic-year');
        if (hiddenSelect) hiddenSelect.value = value;

        // Sync visual UI (only text and checks, no recursion)
        if (window.syncGlobalUI) window.syncGlobalUI();

        // Re-render all data-dependent views
        console.log("Global State Change: Refreshing all views for year", value);
        
        // Use a small delay to ensure localStorage is settled and avoid race conditions
        setTimeout(async () => {
            if (window.loadClassSelectors) await window.loadClassSelectors();
            if (window.loadClassSelectorsForAssignments) window.loadClassSelectorsForAssignments();
            if (window.loadClassSelectorsForExport) await window.loadClassSelectorsForExport();
            if (window.renderClassList) await window.renderClassList();
            if (window.renderStudents) await window.renderStudents();
            if (window.renderAssignments) window.renderAssignments();
            if (window.renderSummary) window.renderSummary();
            if (window.loadGradeSelectors) await window.loadGradeSelectors();
            if (window.renderExportPrep) window.renderExportPrep();
            
            // Also update any other global state indicators
            const disabled = !value || !localStorage.getItem('corrections-global-trimester');
            const importButtons = ['json-import'];
            const importLabels = ['json-import-label'];
            
            importButtons.forEach(id => {
                const btn = document.getElementById(id);
                if (btn) btn.disabled = disabled;
            });
            importLabels.forEach(id => {
                const label = document.getElementById(id);
                if (label) {
                    if (disabled) label.classList.add('opacity-50', 'cursor-not-allowed');
                    else label.classList.remove('opacity-50', 'cursor-not-allowed');
                }
            });
        }, 0);
    };

    window.setGlobalTrimester = function(value) {
        localStorage.setItem('corrections-global-trimester', value);
        settingsAdapter.saveSettings({ current_trimester: value });
        
        // Sync visual UI (radios and labels)
        if (window.syncGlobalUI) window.syncGlobalUI();

        console.log("Global State Change: Refreshing all views for trimester", value);

        // Re-render all data-dependent views
        setTimeout(async () => {
            if (window.renderStudents) await window.renderStudents();
            if (window.renderAssignments) renderAssignments();
            if (window.renderSummary) renderSummary();
            if (window.loadGradeSelectors) await window.loadGradeSelectors();
            if (window.renderExportPrep) window.renderExportPrep();
            if (window.invalidateDashboardCache) window.invalidateDashboardCache();
            if (window.renderDashboard) window.renderDashboard();
            
            // Update import buttons status
            const academicYear = localStorage.getItem('corrections-global-academic-year');
            const disabled = !academicYear || !value;
            const importButtons = ['json-import'];
            const importLabels = ['json-import-label'];
            
            importButtons.forEach(id => {
                const btn = document.getElementById(id);
                if (btn) btn.disabled = disabled;
            });
            importLabels.forEach(id => {
                const label = document.getElementById(id);
                if (label) {
                    if (disabled) label.classList.add('opacity-50', 'cursor-not-allowed');
                    else label.classList.remove('opacity-50', 'cursor-not-allowed');
                }
            });
        }, 0);
    };

    window.getGlobalAcademicYear = function() {
        return localStorage.getItem('corrections-global-academic-year') || '';
    };

    window.getGlobalTrimester = function() {
        return localStorage.getItem('corrections-global-trimester') || '';
    };

    /**
     * Determines the recommended trimester based on current date.
     * Rule: 01/01-31/03 (T2), 01/04-30/06 (T3), 01/07-31/08 (T3 - Summer), Else (T1)
     */
    window.getAutoTrimester = function() {
        const now = new Date();
        const month = now.getMonth() + 1;
        if (month >= 1 && month <= 3) return "2";
        if (month >= 4 && month <= 6) return "3";
        if (month >= 7 && month <= 8) return "3"; // Vacation period: default to T3
        return "1"; // September to December
    };

    /**
     * Determines the recommended academic year based on current date.
     * Cycle: Sept currentYear to Aug nextYear.
     */
    window.getAutoAcademicYear = function() {
        const now = new Date();
        const month = now.getMonth() + 1;
        const yearNum = now.getFullYear();
        if (month >= 9) {
            return `${yearNum}/${yearNum + 1}`;
        } else {
            return `${yearNum - 1}/${yearNum}`;
        }
    };

    /**
     * Checks if a trimester/year combination is blocked based on the CURRENT DATE.
     * Returns true if the target is in the past AND modification is NOT authorized.
     */
    window.isTrimesterBlocked = function(trimester, year) {
        // If user manually allowed edits for this session, nothing is blocked
        if (window.allowPreviousTrimestersEdit) return false;

        const now = new Date();
        const curMonth = now.getMonth() + 1; // 1-12

        // 1. Determine "Real" current trimester level for blocking
        // (For blocking, we use 4 for July-August to block T1, T2, T3)
        let rtNum = parseInt(window.getAutoTrimester());
        if (curMonth >= 7 && curMonth <= 8) rtNum = 4;

        // 2. Determine "Real" academic year
        const realAcademicYear = window.getAutoAcademicYear();

        if (!trimester || !year) return false;

        // --- BLOCKING LOGIC ---
        // Block if target year is older than real year
        if (year < realAcademicYear) return true;
        
        // If future year, don't block
        if (year > realAcademicYear) return false;

        // Same year: Block if target trimester is older than real trimester
        const tNum = parseInt(trimester);

        return tNum < rtNum;
    };

    // Auto-setup guard
    window.setupGlobalUiGuard();

    // Listen for language changes to sync UI
    window.addEventListener('languageChanged', () => {
        if (window.renderSessionSelectors) window.renderSessionSelectors();
        if (window.syncGlobalUI) window.syncGlobalUI();
    });

    // Initial fetch of academic sessions from Supabase
    if (window.fetchAcademicSessions) {
        window.fetchAcademicSessions().catch(e => console.warn('[UI] fetchAcademicSessions error:', e));
    }

})();
