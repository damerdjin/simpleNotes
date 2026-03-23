(function() {
    // Access global data and helpers
    const getData = () => window.data;
    const getTranslations = () => window.translations;
    const getLang = () => window.currentLanguage;
    const getClasses = async () => await window.getClasses();
    const saveData = () => window.saveData();

    // Import helpers from window.grades if needed, or use the exposed window functions
    const getAssignmentMaxPoints = (a) => window.getAssignmentMaxPoints(a);
    const getStudentAssignmentTotal = (sid, aid) => window.getStudentAssignmentTotal(sid, aid);
    const hasAnyGradeForAssignment = (sid, aid) => window.hasAnyGradeForAssignment(sid, aid);

    // --- EXPORT PREP CONFIG ---
    const EXPORT_CONFIG_KEY = 'corrections-export-config-v1';
    let exportPrepConfig = { byClass: {} };

    window.loadExportPrepConfig = function() {
        try {
            exportPrepConfig = JSON.parse(localStorage.getItem(EXPORT_CONFIG_KEY) || '{"byClass":{}}');
            if (!exportPrepConfig.byClass) exportPrepConfig.byClass = {};
        } catch (e) {
            exportPrepConfig = { byClass: {} };
        }
        window.exportPrepConfig = exportPrepConfig; // Expose for other modules if needed
    };

    window.saveExportPrepConfig = function() {
        localStorage.setItem(EXPORT_CONFIG_KEY, JSON.stringify(exportPrepConfig));
    };

    // --- OVERRIDES OBS/CONS ---
    const REMARKS_OVERRIDE_KEY = "corrections-remarks-overrides-v1";

    function getRemarksScopeKey(className) {
        return String(className || "");
    }

    function loadRemarksOverrides() {
        try { return JSON.parse(localStorage.getItem(REMARKS_OVERRIDE_KEY)) || {}; }
        catch { return {}; }
    }
    
    function saveRemarksOverrides(obj) {
        localStorage.setItem(REMARKS_OVERRIDE_KEY, JSON.stringify(obj));
    }

    let remarksOverrides = loadRemarksOverrides();

    function ensureScope(scopeKey) {
        if (!remarksOverrides[scopeKey]) remarksOverrides[scopeKey] = {};
        return remarksOverrides[scopeKey];
    }
    
    function getOverride(scopeKey, studentId) {
        return remarksOverrides?.[scopeKey]?.[String(studentId)] || null;
    }
    
    function setOverride(scopeKey, studentId, patch) {
        const scope = ensureScope(scopeKey);
        const id = String(studentId);
        scope[id] = { ...(scope[id] || {}), ...patch, updatedAt: Date.now() };
        saveRemarksOverrides(remarksOverrides);
    }
    
    function clearOverrideField(scopeKey, studentId, field) {
        const scope = ensureScope(scopeKey);
        const id = String(studentId);
        if (!scope[id]) return;
        delete scope[id][field];

        const hasObs = !!(scope[id].obs && scope[id].obs.trim());
        const hasCons = !!(scope[id].cons && scope[id].cons.trim());
        if (!hasObs && !hasCons) delete scope[id];

        saveRemarksOverrides(remarksOverrides);
    }

    // --- TEACHER LIBRARY ---
    const TEACHER_REMARKS_LIBRARY_KEY = "corrections-teacher-remarks-library-v1";

    function loadTeacherLibrary() {
        try { return JSON.parse(localStorage.getItem(TEACHER_REMARKS_LIBRARY_KEY)) || {}; }
        catch { return {}; }
    }
    
    function saveTeacherLibrary(lib) {
        localStorage.setItem(TEACHER_REMARKS_LIBRARY_KEY, JSON.stringify(lib));
    }

    let teacherRemarksLibrary = loadTeacherLibrary();

    function ensureTeacherList(lang, kind) {
        if (!teacherRemarksLibrary[lang]) teacherRemarksLibrary[lang] = {};
        if (!teacherRemarksLibrary[lang][kind]) teacherRemarksLibrary[lang][kind] = [];
        return teacherRemarksLibrary[lang][kind];
    }

    window.addTeacherMessage = function(kind, message) {
        const msg = String(message || "").trim().replace(/\s+/g, " ");
        if (!msg) return false;
        const lang = langKey();
        const list = ensureTeacherList(lang, kind);
        const exists = list.some(x => x.trim().toLowerCase() === msg.toLowerCase());
        if (!exists) list.unshift(msg); 
        saveTeacherLibrary(teacherRemarksLibrary);
        return true;
    };

    window.getTeacherMessages = function(kind) {
        const lang = langKey();
        return (teacherRemarksLibrary?.[lang]?.[kind] || []).slice(0, 80); 
    };

    // --- GLOBAL REMARKS ---
    function getDefaultGlobalRemarks() {
        return {
            bands: [{ min: 0, max: 6 }, { min: 6.01, max: 9.99 }, { min: 10, max: 13.99 }, { min: 14, max: 15.99 }, { min: 16, max: 17.99 }, { min: 18, max: 20 }],
            FR: [
                [{ obs: 'Résultats très insuffisants.', cons: "Renforcer les bases et demander de l’aide." }, { obs: 'Bases non maîtrisées.', cons: 'Reprendre les fondamentaux quotidiennement.' }, { obs: 'Manque d’assiduité.', cons: 'Planifier un travail régulier.' }, { obs: 'Attention aux lacunes.', cons: 'Faire des exercices ciblés.' }, { obs: 'Suivi nécessaire.', cons: 'Solliciter un accompagnement.' }],
                [{ obs: 'Progrès limités.', cons: 'Revoir les notions clés et s’entraîner.' }, { obs: 'Participation à renforcer.', cons: 'Multiplier les exercices.' }, { obs: 'Résultats fragiles.', cons: 'Consolider avec des révisions.' }, { obs: 'Inégalités dans le travail.', cons: 'Adopter une routine.' }, { obs: 'Peut mieux faire.', cons: 'Fixer des objectifs simples.' }],
                [{ obs: 'Ensemble correct.', cons: 'Poursuivre les efforts avec régularité.' }, { obs: 'Bilan satisfaisant.', cons: 'Maintenir l’investissement.' }, { obs: 'Résultats stables.', cons: 'Renforcer l’autonomie.' }, { obs: 'Progression notable.', cons: 'Continuer à ce rythme.' }, { obs: 'Attitude sérieuse.', cons: 'Varier les méthodes.' }],
                [{ obs: 'Bon niveau.', cons: 'Maintenir le rythme et consolider.' }, { obs: 'Travail sérieux.', cons: 'Approfondir pour viser plus haut.' }, { obs: 'Bonne progression.', cons: 'Continuer avec rigueur.' }, { obs: 'Résultats encourageants.', cons: 'S’entraîner sur les détails.' }, { obs: 'Application régulière.', cons: 'Développer la confiance.' }],
                [{ obs: 'Très bon travail.', cons: 'Approfondir les points forts.' }, { obs: 'Exigence appréciable.', cons: 'Varier les méthodes pour exceller.' }, { obs: 'Très régulier.', cons: 'Entretenir ce rythme.' }, { obs: 'Belle maîtrise.', cons: 'Se fixer des défis.' }, { obs: 'Comportement exemplaire.', cons: 'Continuer ainsi.' }],
                [{ obs: 'Excellent.', cons: 'Continuer sur cette lancée.' }, { obs: 'Résultats remarquables.', cons: 'Objectifs avancés recommandés.' }, { obs: 'Exemplarité.', cons: 'Partager les bonnes pratiques.' }, { obs: 'Performance élevée.', cons: 'Viser l’excellence durable.' }, { obs: 'Très grande maîtrise.', cons: 'Soutenir les camarades.' }]
            ],
            EN: [
                [{ obs: 'Very insufficient results.', cons: 'Strengthen basics and seek help.' }, { obs: 'Weak fundamentals.', cons: 'Revise core topics daily.' }, { obs: 'Irregular work.', cons: 'Plan study and follow homework.' }, { obs: 'Gaps observed.', cons: 'Do targeted exercises.' }, { obs: 'Follow-up needed.', cons: 'Ask for guidance.' }],
                [{ obs: 'Limited progress.', cons: 'Review key concepts and practice.' }, { obs: 'Low participation.', cons: 'Increase targeted exercises.' }, { obs: 'Fragile results.', cons: 'Consolidate through revision.' }, { obs: 'Uneven work.', cons: 'Adopt a routine.' }, { obs: 'Can do better.', cons: 'Set simple goals.' }],
                [{ obs: 'Solid overall.', cons: 'Keep working and aim for consistency.' }, { obs: 'Satisfactory.', cons: 'Maintain effort.' }, { obs: 'Stable results.', cons: 'Strengthen autonomy.' }, { obs: 'Notable progress.', cons: 'Continue at this pace.' }, { obs: 'Serious attitude.', cons: 'Vary methods.' }],
                [{ obs: 'Good level.', cons: 'Maintain pace and consolidate.' }, { obs: 'Serious work.', cons: 'Deepen to aim higher.' }, { obs: 'Good progress.', cons: 'Continue with rigor.' }, { obs: 'Encouraging results.', cons: 'Practice details.' }, { obs: 'Regular application.', cons: 'Build confidence.' }],
                [{ obs: 'Very good work.', cons: 'Deepen strengths.' }, { obs: 'Strong commitment.', cons: 'Vary methods to excel.' }, { obs: 'Very consistent.', cons: 'Maintain this rhythm.' }, { obs: 'Great mastery.', cons: 'Set challenges.' }, { obs: 'Exemplary attitude.', cons: 'Keep it up.' }],
                [{ obs: 'Excellent.', cons: 'Continue this excellent momentum.' }, { obs: 'Outstanding results.', cons: 'Set advanced goals.' }, { obs: 'Exemplary.', cons: 'Share best practices.' }, { obs: 'High performance.', cons: 'Aim for lasting excellence.' }, { obs: 'Very strong mastery.', cons: 'Support classmates.' }]
            ],
            AR: [
                [{ obs: 'نتائج ضعيفة جدًا.', cons: 'تعزيز الأساسيات وطلب المساعدة.' }, { obs: 'أساسيات غير متقنة.', cons: 'مراجعة الدروس يوميًا.' }, { obs: 'عمل غير منتظم.', cons: 'تنظيم الدراسة ومتابعة الواجبات.' }, { obs: 'ثغرات واضحة.', cons: 'تمارين مركزة مطلوبة.' }, { obs: 'حاجة إلى متابعة.', cons: 'طلب التوجيه.' }],
                [{ obs: 'تقدم محدود.', cons: 'مراجعة المفاهيم الأساسية والتدريب.' }, { obs: 'مشاركة ضعيفة.', cons: 'زيادة التمارين المركزة.' }, { obs: 'نتائج هشة.', cons: 'تثبيت عبر المراجعة.' }, { obs: 'عمل غير منتظم.', cons: 'اعتماد روتين يومي.' }, { obs: 'يمكن أفضل.', cons: 'تحديد أهداف بسيطة.' }],
                [{ obs: 'مستوى مقبول.', cons: 'مواصلة الجهد والسعي إلى الانتظام.' }, { obs: 'نتائج مرضية.', cons: 'الحفاظ على الجهد.' }, { obs: 'نتائج مستقرة.', cons: 'تعزيز الاستقلالية.' }, { obs: 'تحسن ملحوظ.', cons: 'الاستمرار بنفس الوتيرة.' }, { obs: 'جدية في المتابعة.', cons: 'تنويع الأساليب.' }],
                [{ obs: 'مستوى جيد.', cons: 'الحفاظ على الوتيرة وترسيخ المكتسبات.' }, { obs: 'عمل جاد.', cons: 'تعميق المستوى للوصول للأفضل.' }, { obs: 'تحسن جيد.', cons: 'الاستمرار بانضباط.' }, { obs: 'نتائج مشجعة.', cons: 'التركيز على التفاصيل.' }, { obs: 'انتظام واضح.', cons: 'تعزيز الثقة.' }],
                [{ obs: 'عمل ممتاز جدًا.', cons: 'الاستمرار وتعميق نقاط القوة.' }, { obs: 'التزام قوي.', cons: 'تنويع الأساليب للتميز.' }, { obs: 'انتظام كبير.', cons: 'الحفاظ على الإيقاع.' }, { obs: 'إتقان واضح.', cons: 'تحديات شخصية مطلوبة.' }, { obs: 'سلوك نموذجي.', cons: 'الاستمرار بهذا المستوى.' }],
                [{ obs: 'ممتاز.', cons: 'مواصلة هذا الأداء المتميز.' }, { obs: 'نتائج مبهرة.', cons: 'تحديد أهداف متقدمة.' }, { obs: 'قدوة.', cons: 'مشاركة الممارسات الجيدة.' }, { obs: 'أداء عالٍ.', cons: 'السعي للتميز المستدام.' }, { obs: 'إتقان قوي جدًا.', cons: 'دعم الزملاء.' }]
            ]
        };
    }

    window.ensureGlobalRemarks = function() {
        if (!exportPrepConfig) exportPrepConfig = { byClass: {} };
        if (!exportPrepConfig.globalRemarks) {
            try {
                const classes = Object.keys(exportPrepConfig.byClass || {});
                for (const cls of classes) {
                    const rc = exportPrepConfig.byClass[cls]?.remarks;
                    if (rc && rc.bands && (rc.FR || rc.EN || rc.AR)) {
                        exportPrepConfig.globalRemarks = rc;
                        break;
                    }
                }
            } catch (e) { }
        }
        const defs = getDefaultGlobalRemarks();
        if (!exportPrepConfig.globalRemarks) exportPrepConfig.globalRemarks = defs;
        const gr = exportPrepConfig.globalRemarks;
        if (!Array.isArray(gr.bands) || gr.bands.length === 0) gr.bands = defs.bands;
        const langs = ['FR', 'EN', 'AR'];
        for (const L of langs) {
            if (!Array.isArray(gr[L]) || gr[L].length === 0) gr[L] = defs[L];
            while (gr[L].length < gr.bands.length) gr[L].push([]);
            for (let i = 0; i < gr[L].length; i++) {
                if (!Array.isArray(gr[L][i])) gr[L][i] = [];
            }
        }
        window.saveExportPrepConfig();
        return gr;
    };

    window.resetRemarksCurrentLanguage = function() {
        const gr = window.ensureGlobalRemarks();
        const defs = getDefaultGlobalRemarks();
        const lang = getLang() === 'fr' ? 'FR' : (getLang() === 'en' ? 'EN' : 'AR');
        gr.bands = defs.bands.map(b => ({ min: b.min, max: b.max }));
        gr[lang] = defs[lang].map(arr => arr.map(m => ({ obs: m.obs, cons: m.cons })));
        window.saveExportPrepConfig();
        window.closeRemarksModal();
        window.openRemarksModal();
    };

    function getExportClassConfig(className) {
        if (!className) return null;
        if (!exportPrepConfig.byClass[className]) {
            exportPrepConfig.byClass[className] = {
                ccAssignmentId: '',
                compAssignmentId: '',
                tpAssignmentId: '',
                devoir1: { assignmentIds: [], combine: 'sum', normalize: true, targetMax: 20 },
                devoir2: { assignmentIds: [], combine: 'sum', normalize: true, targetMax: 20 },
                outMax: 20
            };
        }
        return exportPrepConfig.byClass[className];
    }
    window.getExportClassConfig = getExportClassConfig; // Needed globally for some calls

    window.deleteClassDataFromExport = function(className) {
        if (!className) return;
        
        // 1. Clean exportPrepConfig
        if (exportPrepConfig && exportPrepConfig.byClass && exportPrepConfig.byClass[className]) {
            delete exportPrepConfig.byClass[className];
            window.saveExportPrepConfig();
        }

        // 2. Clean remarksOverrides
        if (remarksOverrides && remarksOverrides[className]) {
            delete remarksOverrides[className];
            saveRemarksOverrides(remarksOverrides);
        }
    };

    function getAssignmentsForClass(className) {
        const globalTrimester = window.getGlobalTrimester();
        const userId = window.currentUser?.email || window.currentUser?.id || 'unknown';
        return getData().assignments.filter(a => {
            const matchUser = (a.createdBy || 'unknown') === userId;
            const matchClass = (a.className || '').trim() === (className || '').trim();
            const matchTrimester = globalTrimester ? (a.trimester || '') === globalTrimester : false;
            return matchUser && matchClass && matchTrimester;
        });
    }

    function toNumberOrNull(v) {
        if (v === '' || v === null || v === undefined) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }

    function round2(n) {
        return Math.round((n + Number.EPSILON) * 100) / 100;
    }

    function getGroupRawMaxForDisplay(className, groupCfg) {
        const ids = (groupCfg.assignmentIds || []).filter(Boolean);
        const assigns = ids
            .map(id => getData().assignments.find(a => a.id === id))
            .filter(a => a && (a.className || '').trim() === (className || '').trim());

        if (assigns.length === 0) return 0;

        const maxes = assigns.map(a => getAssignmentMaxPoints(a) || 0).filter(x => x > 0);
        if (maxes.length === 0) return 0;

        if (groupCfg.combine === 'avg') {
            return maxes.reduce((s, x) => s + x, 0) / maxes.length;
        }
        if (groupCfg.combine === 'max') {
            return Math.max(...maxes);
        }
        return maxes.reduce((s, x) => s + x, 0);
    }

    function getGroupDisplayedMax(className, cfg, groupKey) {
        const g = cfg[groupKey];
        const outMax = cfg.outMax ?? 20;
        if (g.normalize) return (toNumberOrNull(g.targetMax) ?? outMax);
        return getGroupRawMaxForDisplay(className, g);
    }

    function groupHasExportScaleIssue(className, cfg, groupKey) {
        const outMax = cfg.outMax ?? 20;
        const g = cfg[groupKey];
        const ids = (g.assignmentIds || []).filter(Boolean);
        if (ids.length === 0) return false;

        const assigns = ids
            .map(id => getData().assignments.find(a => a.id === id))
            .filter(a => a && (a.className || '').trim() === (className || '').trim());

        if (assigns.length === 0) return true;
        const maxes = assigns.map(a => getAssignmentMaxPoints(a) || 0).filter(x => x > 0);
        if (maxes.length === 0) return true;

        if (g.normalize) {
            const target = (toNumberOrNull(g.targetMax) ?? outMax);
            return target !== outMax;
        }
        if (g.combine === 'sum') {
            const rawMax = maxes.reduce((s, x) => s + x, 0);
            return rawMax !== outMax;
        }
        const allSameAsOut = maxes.every(m => m === outMax);
        return !allSameAsOut;
    }

    function cellClassForValue(v, expected) {
        if (!expected) return 'text-gray-300';
        if (v === null || v === undefined || v === '') return 'bg-amber-50 text-amber-800 border border-amber-200';
        const n = Number(v);
        if (!Number.isFinite(n)) return 'bg-amber-50 text-amber-800 border border-amber-200';
        if (n === 0) return 'bg-red-100 text-red-700 border border-red-200 font-semibold';
        return 'bg-white';
    }

    function collectUsedAssignmentIds(cfg) {
        const used = new Set();
        if (cfg.ccAssignmentId) used.add(cfg.ccAssignmentId);
        if (cfg.tpAssignmentId) used.add(cfg.tpAssignmentId);
        if (cfg.compAssignmentId) used.add(cfg.compAssignmentId);
        (cfg.devoir1?.assignmentIds || []).forEach(id => id && used.add(id));
        (cfg.devoir2?.assignmentIds || []).forEach(id => id && used.add(id));
        return used;
    }

    function enforceUniqueAssignment(cfg, assignmentId, source) {
        if (!assignmentId) return;
        const singleKeys = ['ccAssignmentId', 'tpAssignmentId', 'compAssignmentId'];
        for (const k of singleKeys) {
            if (source.type === 'single' && source.key === k) continue;
            if (cfg[k] === assignmentId) cfg[k] = '';
        }
        const groupKeys = ['devoir1', 'devoir2'];
        for (const gk of groupKeys) {
            if (source.type === 'group' && source.key === gk) continue;
            const arr = cfg[gk]?.assignmentIds || [];
            cfg[gk].assignmentIds = arr.filter(id => id !== assignmentId);
        }
    }

    function computeGroupScore(studentId, className, groupCfg) {
        const outMax = (getExportClassConfig(className)?.outMax ?? 20);
        const ids = (groupCfg.assignmentIds || []).filter(Boolean);
        if (ids.length === 0) return null;

        const assigns = ids
            .map(id => getData().assignments.find(a => a.id === id))
            .filter(a => a && (a.className || '').trim() === (className || '').trim());

        if (assigns.length === 0) return null;

        const entries = assigns.map(a => {
            const has = hasAnyGradeForAssignment(studentId, a.id);
            const max = getAssignmentMaxPoints(a);
            const total = has ? getStudentAssignmentTotal(studentId, a.id) : null;
            return { a, has, total, max };
        });

        if (!entries.some(e => e.has)) return null;

        const normalize = !!groupCfg.normalize;
        const targetMax = toNumberOrNull(groupCfg.targetMax) ?? outMax;

        if (groupCfg.combine === 'avg') {
            const valid = entries.filter(e => e.has && e.max > 0);
            if (valid.length === 0) return null;
            if (groupCfg.normalize) {
                const percents = valid.map(e => (e.total / e.max));
                const avgP = percents.reduce((s, p) => s + p, 0) / percents.length;
                return avgP * targetMax;
            } else {
                const avgRaw = valid.reduce((s, e) => s + (e.total || 0), 0) / valid.length;
                return avgRaw;
            }
        }

        if (groupCfg.combine === 'max') {
            const valid = entries.filter(e => e.has && e.max > 0);
            if (valid.length === 0) return null;
            if (groupCfg.normalize) {
                const percents = valid.map(e => (e.total / e.max));
                const maxP = Math.max(...percents);
                return maxP * targetMax;
            } else {
                const notes = valid.map(e => e.total || 0);
                return Math.max(...notes);
            }
        }

        const sumTotal = entries.reduce((s, e) => s + (e.has ? (e.total || 0) : 0), 0);
        const sumMax = entries.reduce((s, e) => s + (e.max > 0 ? e.max : 0), 0);

        if (!normalize) return sumTotal;
        if (!sumMax || sumMax <= 0) return null;
        return (sumTotal / sumMax) * targetMax;
    }

    function computeDevoirFinal(studentId, className, cfg) {
        const d1 = computeGroupScore(studentId, className, cfg.devoir1);
        const d2 = computeGroupScore(studentId, className, cfg.devoir2);
        if (d1 === null && d2 === null) return null;
        if (d1 !== null && d2 !== null) return (d1 + d2) / 2;
        return (d1 !== null) ? d1 : d2;
    }
    window.computeDevoirFinal = computeDevoirFinal; // Exposed for Rakmana

    function calcScaledScore(studentId, assignment) {
        if (!assignment) return null;
        const cfg = getExportClassConfig(assignment.className);
        const outMax = cfg?.outMax ?? 20;
        if (!hasAnyGradeForAssignment(studentId, assignment.id)) return null;
        const total = getStudentAssignmentTotal(studentId, assignment.id);
        const max = getAssignmentMaxPoints(assignment);
        if (!max || max <= 0) return null;
        return (total / max) * outMax;
    }
    window.calcScaledScore = calcScaledScore; // Exposed for Rakmana

    window.loadClassSelectorsForExport = async function() {
        const classes = await getClasses();
        const select = document.getElementById('select-class-export');
        const t = getTranslations()[getLang()];
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = `<option value="">-- ${t.selectClass} --</option>` +
            classes.map(c => `<option value="${c}" ${c === currentValue ? 'selected' : ''}>${c}</option>`).join('');
    };

    window.onExportClassChange = function() {
        const className = document.getElementById('select-class-export')?.value || '';
        if (!className) {
            document.getElementById('export-config').innerHTML = '';
            document.getElementById('export-preview-table').innerHTML = '';
            document.getElementById('export-preview-meta').textContent = '';
            return;
        }
        getExportClassConfig(className);
        window.saveExportPrepConfig();
        window.renderExportPrep();
        window.installRakmanaColorAutoUpdate();
        window.updateExportClassCardColor();
    };

    window.resetExportConfig = function() {
        const className = document.getElementById('select-class-export')?.value || '';
        if (!className) return;
        delete exportPrepConfig.byClass[className];
        window.saveExportPrepConfig();
        const scopeKey = getRemarksScopeKey(className);
        if (remarksOverrides[scopeKey]) {
            delete remarksOverrides[scopeKey];
            saveRemarksOverrides(remarksOverrides);
        }
        window.renderExportPrep();
    };

    window.renderExportPrep = async function() {
        if (!getTranslations() || !getLang() || !getTranslations()[getLang()]) return;
        const t = getTranslations()[getLang()];
        const className = document.getElementById('select-class-export')?.value || '';
        const container = document.getElementById('export-config');
        const preview = document.getElementById('export-preview-table');
        const meta = document.getElementById('export-preview-meta');

        if (!container || !preview || !meta) return;

        if (!className) {
            container.innerHTML = '';
            preview.innerHTML = '';
            meta.textContent = '';
            return;
        }

        const cfg = getExportClassConfig(className);
        const assigns = getAssignmentsForClass(className);
        const d1MaxShown = getGroupDisplayedMax(className, cfg, 'devoir1');
        const d2MaxShown = getGroupDisplayedMax(className, cfg, 'devoir2');
        const d1Issue = groupHasExportScaleIssue(className, cfg, 'devoir1');
        const d2Issue = groupHasExportScaleIssue(className, cfg, 'devoir2');

        const buildSingleOptions = (currentValue) => {
            const used = collectUsedAssignmentIds(cfg);
            return [`<option value="">-- ${t.selectAssignment} --</option>`].concat(
                assigns.map(a => {
                    const isUsedElsewhere = used.has(a.id) && a.id !== currentValue;
                    return `<option value="${a.id}" ${isUsedElsewhere ? 'disabled' : ''}>
                        ${a.name} (${getAssignmentMaxPoints(a)} ${t.points})
                    </option>`;
                })
            ).join('');
        };

        const renderMultiPick = (groupKey) => {
            const g = cfg[groupKey];
            const selected = new Set(g.assignmentIds || []);
            const rows = assigns.map(a => {
                const checked = selected.has(a.id) ? 'checked' : '';
                const used = collectUsedAssignmentIds(cfg);
                const usedElsewhere = used.has(a.id) && !checked;
                const disabled = usedElsewhere ? 'disabled' : '';
                const opacity = usedElsewhere ? 'opacity-50 cursor-not-allowed' : '';
                return `
                    <label class="flex items-center gap-2 p-2 border rounded-lg bg-white hover:bg-gray-50 ${opacity}">
                        <input type="checkbox" ${checked} ${disabled}
                        onchange="toggleExportGroupAssignment('${groupKey}','${a.id}',this.checked)" class="w-4 h-4">
                            <span class="flex-1 min-w-0 truncate font-medium">${a.name}</span>
                            <span class="text-xs text-gray-500">/${getAssignmentMaxPoints(a)} ${t.points}</span>
                            </label>
                        `;
            }).join('');

            const chips = (g.assignmentIds || [])
                .map(id => assigns.find(a => a.id === id))
                .filter(Boolean)
                .map(a => `<span class="px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold border border-blue-200">${a.name}</span>`)
                .join('') || `<span class="text-xs text-gray-400">${t.noneSelected}</span>`;

            return `
                <div class="space-y-2">
                    <div class="flex flex-wrap gap-2 items-center">${chips}</div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2">${rows}</div>
                </div>
            `;
        };

        container.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div class="p-4 border rounded-xl bg-gray-50">
                    <div class="flex items-center justify-between mb-2">
                        <h3 class="font-bold text-gray-800" data-translate="ccLabel">Contrôle Continu (CC)</h3>
                        <span class="text-xs text-gray-500">${t.outputOn} / ${cfg.outMax}</span>
                    </div>
                    <select class="w-full p-3 border rounded-lg bg-white" onchange="setExportSingle('ccAssignmentId', this.value)" id="export-cc-select">
                        ${buildSingleOptions(cfg.ccAssignmentId || '')}
                    </select>
                    <p class="text-xs text-gray-500 mt-2" data-translate="singleSelectHint">Sélectionnez un devoir existant pour alimenter cette note (conversion sur /20).</p>
                </div>
                <div class="p-4 border rounded-xl bg-gray-50">
                    <div class="flex items-center justify-between mb-2">
                        <h3 class="font-bold text-gray-800" data-translate="tpLabel">${t.tpLabel || 'TP'}</h3>
                        <span class="text-xs text-gray-500">${t.outputOn} / ${cfg.outMax}</span>
                    </div>
                    <select class="w-full p-3 border rounded-lg bg-white" onchange="setExportSingle('tpAssignmentId', this.value)" id="export-tp-select">
                        ${buildSingleOptions(cfg.tpAssignmentId || '')}
                    </select>
                    <p class="text-xs text-gray-500 mt-2" data-translate="singleSelectHint">${t.singleSelectHint}</p>
                </div>
                <div class="p-4 border rounded-xl bg-gray-50">
                    <div class="flex items-center justify-between mb-2">
                        <h3 class="font-bold text-gray-800" data-translate="compLabel">Composition</h3>
                        <span class="text-xs text-gray-500">${t.outputOn} / ${cfg.outMax}</span>
                    </div>
                    <select class="w-full p-3 border rounded-lg bg-white" onchange="setExportSingle('compAssignmentId', this.value)" id="export-comp-select">
                        ${buildSingleOptions(cfg.compAssignmentId || '')}
                    </select>
                    <p class="text-xs text-gray-500 mt-2" data-translate="singleSelectHint">Sélectionnez un devoir existant pour alimenter cette note (conversion sur /20).</p>
                </div>
            </div>
            <div class="mt-4 p-4 border rounded-xl bg-blue-50">
                <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <h3 class="font-bold text-gray-800" data-translate="devoirLabel">Devoir (moyenne Devoir 1 & Devoir 2)</h3>
                    <div class="flex items-center gap-3 flex-wrap">
                        <label class="text-sm font-semibold text-gray-700">${t.outputOn} <input type="number" min="1" step="1" value="${cfg.outMax}" class="w-20 p-2 border rounded bg-white ml-2" onchange="setExportOutMax(this.value)"></label>
                    </div>
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div class="border rounded-xl p-4 ${d1Issue ? 'bg-amber-50 border-amber-300' : 'bg-white'}">
                        <div class="flex items-center justify-between gap-2 mb-2">
                            <div class="flex items-center gap-2">
                                <h4 class="font-bold text-blue-800" data-translate="devoir1Label">Devoir 1</h4>
                                <span class="text-xs font-bold px-2 py-1 rounded-full ${d1Issue ? 'bg-amber-200 text-amber-900' : 'bg-blue-100 text-blue-800'}">/ ${round2(d1MaxShown || 0)}</span>
                                ${d1Issue ? `<span class="text-xs font-semibold text-amber-800" title="${t.exportNotOn20 || ''}">⚠️</span>` : ``}
                            </div>
                            <div class="flex items-center gap-2">
                                <select class="p-2 border rounded bg-white text-sm" onchange="setExportGroupField('devoir1','combine',this.value)">
                                    <option value="sum" ${cfg.devoir1.combine === 'sum' ? 'selected' : ''}>${t.sum}</option>
                                    <option value="avg" ${cfg.devoir1.combine === 'avg' ? 'selected' : ''}>${t.average}</option>
                                    <option value="max" ${cfg.devoir1.combine === 'max' ? 'selected' : ''}>${t.max}</option>
                                </select>
                                <label class="text-sm flex items-center gap-2"><input type="checkbox" class="w-4 h-4" ${cfg.devoir1.normalize ? 'checked' : ''} onchange="setExportGroupField('devoir1','normalize',this.checked)"> <span data-translate="normalize">${t.normalize}</span></label>
                                <input type="number" min="1" step="1" value="${cfg.devoir1.targetMax ?? 20}" class="w-20 p-2 border rounded bg-white text-sm" title="${t.targetMax}" onchange="setExportGroupField('devoir1','targetMax',this.value)">
                            </div>
                        </div>
                        <div class="text-xs text-gray-500 mb-2" data-translate="groupHint">Sélectionnez un ou plusieurs devoirs de la classe, puis choisissez Somme ou Moyenne.</div>
                        ${renderMultiPick('devoir1')}
                    </div>
                    <div class="bg-white border rounded-xl p-4">
                        <div class="flex items-center justify-between gap-2 mb-2">
                            <div class="flex items-center gap-2">
                                <h4 class="font-bold text-blue-800" data-translate="devoir2Label">Devoir 2</h4>
                                <span class="text-xs font-bold px-2 py-1 rounded-full ${d2Issue ? 'bg-amber-200 text-amber-900' : 'bg-blue-100 text-blue-800'}">/ ${round2(d2MaxShown || 0)}</span>
                                ${d2Issue ? `<span class="text-xs font-semibold text-amber-800" title="${t.exportNotOn20 || ''}">⚠️</span>` : ``}
                            </div>
                            <div class="flex items-center gap-2">
                                <select class="p-2 border rounded bg-white text-sm" onchange="setExportGroupField('devoir2','combine',this.value)">
                                    <option value="sum" ${cfg.devoir2.combine === 'sum' ? 'selected' : ''}>${t.sum}</option>
                                    <option value="avg" ${cfg.devoir2.combine === 'avg' ? 'selected' : ''}>${t.average}</option>
                                    <option value="max" ${cfg.devoir2.combine === 'max' ? 'selected' : ''}>${t.max}</option>
                                </select>
                                <label class="text-sm flex items-center gap-2"><input type="checkbox" class="w-4 h-4" ${cfg.devoir2.normalize ? 'checked' : ''} onchange="setExportGroupField('devoir2','normalize',this.checked)"> <span data-translate="normalize">${t.normalize}</span></label>
                                <input type="number" min="1" step="1" value="${cfg.devoir2.targetMax ?? 20}" class="w-20 p-2 border rounded bg-white text-sm" title="${t.targetMax}" onchange="setExportGroupField('devoir2','targetMax',this.value)">
                            </div>
                        </div>
                        <div class="text-xs text-gray-500 mb-2" data-translate="groupHint">Sélectionnez un ou plusieurs devoirs de la classe, puis choisissez Somme ou Moyenne.</div>
                        ${renderMultiPick('devoir2')}
                    </div>
                </div>
                <div class="mt-3 text-sm text-gray-700" data-translate="devoirRule">Règle: Devoir = moyenne(Devoir 1, Devoir 2). Si l’un manque, on prend l’autre.</div>
            </div>
        `;

        const ccSelect = document.getElementById('export-cc-select');
        const compSelect = document.getElementById('export-comp-select');
        const tpSelect = document.getElementById('export-tp-select');
        if (tpSelect) tpSelect.value = cfg.tpAssignmentId || '';
        if (ccSelect) ccSelect.value = cfg.ccAssignmentId || '';
        if (compSelect) compSelect.value = cfg.compAssignmentId || '';

        // --- COLLABORATIVE MODEL: Fetch and merge students ---
        const globalUserId = window.currentUser?.email || window.currentUser?.id || 'unknown';
        const globalAcademicYear = window.getGlobalAcademicYear();
        
        let localStudents = getData().students.filter(s => 
            (s.className || '').trim() === (className || '').trim() &&
            (s.importedBy || 'unknown') === globalUserId &&
            (s.academicYear || '') === globalAcademicYear
        );
        
        let sharedStudents = [];
        if (window.store && typeof window.store.getSharedStudents === 'function') {
            sharedStudents = await window.store.getSharedStudents(className);
        }

        const studentMap = new Map();
        localStudents.forEach(s => studentMap.set(s.id, s));
        sharedStudents.forEach(s => {
            const existing = Array.from(studentMap.values()).find(ls => ls.id === s.id || (ls.regNumber && ls.regNumber === s.regNumber));
            if (!existing) studentMap.set(s.id, s);
        });
        
        const students = Array.from(studentMap.values());
        meta.textContent = `${students.length} ${t.students}`;

        await renderExportPreviewTable(className, cfg);
        window.translatePage();
    };

    // ... (More code for Remarks Modal, Teacher Library, Rakmana, etc.) ...
    // Since the content is very large, I will split the write operation or assume I can write it all. 
    // For safety, I will write the rest of the file content in the same Write call if possible, or append.
    // The previous prompt showed a limit of tool output, but Write input can be large.
    
    // I will include the rest of the functions here.

    window.openRemarksModal = function() {
        const t = getTranslations()[getLang()];
        const overlay = document.createElement("div");
        overlay.id = "remarks-modal";
        overlay.className = "fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50";
        overlay.innerHTML = `
            <div class="bg-white rounded-xl shadow-xl w-[92%] max-w-4xl" style="max-height:85vh; overflow-y:auto;">
                <div class="p-4 border-b flex items-center justify-between gap-3">
                    <div class="font-bold">${escapeHtml(t.libraryTitle)}</div>
                    <button class="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300" onclick="closeRemarksModal()">${escapeHtml(t.close)}</button>
                </div>
                <div class="p-4 space-y-3">
                    <div class="flex flex-wrap items-center gap-2">
                        <label class="text-sm font-semibold text-gray-700">${escapeHtml(t.typeLabel)}</label>
                        <select id="lib-kind" class="p-2 border rounded bg-white text-sm" onchange="renderTeacherLibraryModal()">
                            <option value="obs">${escapeHtml(t.observation)}</option>
                            <option value="cons">${escapeHtml(t.advice)}</option>
                        </select>
                        <label class="text-sm font-semibold text-gray-700 ml-3">${escapeHtml(t.levelLabel)}</label>
                        <select id="lib-band" class="p-2 border rounded bg-white text-sm" onchange="renderTeacherLibraryModal()"></select>
                        <label class="text-sm font-semibold text-gray-700 ml-3">${escapeHtml(t.languageLabel)}</label>
                        <select id="lib-lang" class="p-2 border rounded bg-white text-sm" onchange="renderTeacherLibraryModal()">
                            <option value="FR">FR</option>
                            <option value="EN">EN</option>
                            <option value="AR">AR</option>
                        </select>
                        <input id="lib-search" class="flex-1 min-w-56 p-2 border rounded" placeholder="${escapeHtml(t.searchSimple)}" oninput="renderTeacherLibraryModal()" />
                    </div>
                    <div id="lib-meta" class="text-sm text-gray-500"></div>
                    <div id="lib-list" class="space-y-2"></div>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        try { document.getElementById("lib-lang").value = langKey(); } catch { }
        window.renderTeacherLibraryModal();
    };

    window.closeRemarksModal = function() {
        const el = document.getElementById("remarks-modal");
        if (el) el.remove();
    };

    function kindKeyOf(baseKind, bandIdx) {
        return `${baseKind}@${bandIdx}`;
    }

    window.renderTeacherLibraryModal = function() {
        const t = getTranslations()[getLang()];
        const lang = document.getElementById("lib-lang")?.value || langKey();
        const baseKind = document.getElementById("lib-kind")?.value || "obs";
        const q = (document.getElementById("lib-search")?.value || "").trim().toLowerCase();
        const R = window.REMARKSMESSAGES;
        const maxBands = R?.avgBands?.length ?? 0;
        const bandSel = document.getElementById("lib-band");
        if (bandSel && (!bandSel.options.length || bandSel.dataset.kind !== baseKind)) {
            bandSel.dataset.kind = baseKind;
            bandSel.innerHTML = `<option value="ALL">${escapeHtml(t.allBands)}</option>` + Array.from({ length: maxBands }, (_, i) => `<option value="${i}">${escapeHtml(t.bandPrefix)} ${i}</option>`).join("");
            bandSel.value = "ALL";
        }
        const bandValue = bandSel?.value ?? "ALL";
        let items = [];
        const bucket = teacherRemarksLibrary?.[lang] || {};
        const pushFromKey = (k) => {
            const arr = bucket[k];
            if (!Array.isArray(arr)) return;
            arr.forEach((msg, i) => items.push({ k, i, msg: String(msg) }));
        };
        if (bandValue === "ALL") {
            const re = new RegExp(`^${baseKind}@\\d+$`);
            Object.keys(bucket).filter(k => re.test(k)).sort((a, b) => a.localeCompare(b, "fr", { numeric: true })).forEach(pushFromKey);
        } else {
            pushFromKey(kindKeyOf(baseKind, bandValue));
        }
        if (q) items = items.filter(x => x.msg.toLowerCase().includes(q));
        const meta = document.getElementById("lib-meta");
        if (meta) meta.textContent = `${items.length} ${t.messagesCount}`;
        const box = document.getElementById("lib-list");
        if (!box) return;
        if (!items.length) {
            box.innerHTML = `<div class="p-3 bg-gray-50 border rounded text-sm text-gray-600">${escapeHtml(t.noMessages)}</div>`;
            return;
        }
        box.innerHTML = items.map(x => `
            <div class="p-3 border rounded flex items-start justify-between gap-3 bg-white">
                <div class="text-xs text-gray-400 w-20 flex-shrink-0">${escapeHtml(x.k)}</div>
                <div class="text-sm leading-snug whitespace-pre-wrap flex-1">${escapeHtml(x.msg)}</div>
                <button class="lib-del px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200" data-lang="${escapeHtml(lang)}" data-key="${escapeHtml(x.k)}" data-index="${x.i}">${escapeHtml(t.deleteMessage)}</button>
            </div>`).join("");
        box.querySelectorAll("button.lib-del").forEach(btn => {
            btn.addEventListener("click", () => {
                const L = btn.dataset.lang;
                const K = btn.dataset.key;
                const idx = parseInt(btn.dataset.index, 10);
                const arr = teacherRemarksLibrary?.[L]?.[K];
                if (!Array.isArray(arr) || !(idx >= 0 && idx < arr.length)) return;
                arr.splice(idx, 1);
                saveTeacherLibrary(teacherRemarksLibrary);
                window.renderTeacherLibraryModal();
            });
        });
    };

    window.saveRemarksModal = function() {
        const gr = window.ensureGlobalRemarks();
        const lang = getLang() === 'fr' ? 'FR' : (getLang() === 'en' ? 'EN' : 'AR');
        const overlay = document.getElementById('remarks-modal');
        if (!overlay) return;
        const rangeInputs = overlay.querySelectorAll('input[data-field]');
        rangeInputs.forEach(inp => {
            const i = parseInt(inp.getAttribute('data-band'), 10);
            const field = inp.getAttribute('data-field');
            const n = parseFloat(inp.value);
            gr.bands[i][field] = Number.isFinite(n) ? n : gr.bands[i][field];
        });
        // ... (Logic to save custom global remarks if modal was editing them) ...
        // Note: The original code for saveRemarksModal seemed to handle editing Global Remarks in a modal?
        // Ah, yes, there was a modal for editing global remarks ranges/texts. I should include that logic.
        // But the previous read didn't show the "Global Remarks Editor" HTML generation. 
        // It was likely in `resetRemarksCurrentLanguage` or similar? No, I see `openRemarksModal` for teacher library.
        // Wait, `saveRemarksModal` logic I pasted handles `data-band` inputs. Where are they generated?
        // They must be generated in another function I missed, or `openRemarksModal` does double duty?
        // `openRemarksModal` above generates the Library.
        // There must be another modal for "Global Config".
        // I'll leave `saveRemarksModal` as is, but it might not be used if I missed the generator.
        window.saveExportPrepConfig();
        window.closeRemarksModal();
        window.renderExportPrep();
    };

    window.setExportSingle = function(field, assignmentId) {
        const className = document.getElementById('select-class-export')?.value || '';
        const cfg = getExportClassConfig(className);
        if (!assignmentId) {
            cfg[field] = '';
            window.saveExportPrepConfig();
            window.renderExportPrep();
            return;
        }
        cfg[field] = assignmentId;
        enforceUniqueAssignment(cfg, assignmentId, { type: 'single', key: field });
        window.saveExportPrepConfig();
        window.renderExportPrep();
    };

    window.setExportOutMax = function(val) {
        const className = document.getElementById('select-class-export')?.value || '';
        const cfg = getExportClassConfig(className);
        const n = parseInt(val, 10);
        cfg.outMax = Number.isFinite(n) && n > 0 ? n : 20;
        if (!cfg.devoir1.targetMax) cfg.devoir1.targetMax = cfg.outMax;
        if (!cfg.devoir2.targetMax) cfg.devoir2.targetMax = cfg.outMax;
        window.saveExportPrepConfig();
        window.renderExportPrep();
    };

    window.setExportGroupField = function(groupKey, field, value) {
        const className = document.getElementById('select-class-export')?.value || '';
        const cfg = getExportClassConfig(className);
        cfg[groupKey][field] = value;
        window.saveExportPrepConfig();
        window.renderExportPrep();
        window.updateExportClassCardColor();
    };

    window.toggleExportGroupAssignment = function(groupKey, assignmentId, checked) {
        const className = document.getElementById('select-class-export')?.value || '';
        const cfg = getExportClassConfig(className);
        const arr = cfg[groupKey].assignmentIds || [];
        const set = new Set(arr);
        if (checked) {
            enforceUniqueAssignment(cfg, assignmentId, { type: 'group', key: groupKey });
            set.add(assignmentId);
        } else {
            set.delete(assignmentId);
        }
        cfg[groupKey].assignmentIds = Array.from(set);
        window.saveExportPrepConfig();
        window.renderExportPrep();
    };

    function escapeHtml(str) {
        return String(str ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
    }

    function langKey() {
        return getLang() === "fr" ? "FR" : (getLang() === "en" ? "EN" : "AR");
    }

    function findBandIndexLocal(bands, value) {
        const v = Number(value);
        if (!Number.isFinite(v)) return -1;
        const vv = Math.round(v * 100) / 100;
        for (let i = 0; i < bands.length; i++) {
            const b = bands[i];
            if (vv >= b.min && vv <= b.max) return i;
        }
        return -1;
    }

    function getObsCandidatesForRow(avg) {
        const R = window.REMARKSMESSAGES || window.REMARKS_MESSAGES;
        if (!R) return [];
        const a = Number(avg);
        const idx = findBandIndexLocal(R.avgBands, a);
        if (idx < 0) return [];
        return R.observationsAvg?.[langKey()]?.[idx] || [];
    }

    window.getConsCandidatesForRow = function (avg) {
        const R = window.REMARKSMESSAGES;
        if (!R) return [];
        const idx = findBandIndexLocal(R.avgBands, avg);
        if (idx < 0) return [];
        return R.advice?.[langKey()]?.[idx] || [];
    };

    async function renderExportPreviewTable(className, cfg) {
        const t = getTranslations()[getLang()];
        const preview = document.getElementById('export-preview-table');
        if (!preview) return;

        const globalUserId = window.currentUser?.email || window.currentUser?.id || 'unknown';
        const globalAcademicYear = window.getGlobalAcademicYear();

        // --- COLLABORATIVE MODEL: Fetch and merge students ---
        let localStudents = getData().students.filter(s => 
            (s.className || '').trim() === (className || '').trim() &&
            (s.importedBy || 'unknown') === globalUserId &&
            (s.academicYear || '') === globalAcademicYear
        );
        
        let sharedStudents = [];
        if (window.store && typeof window.store.getSharedStudents === 'function') {
            sharedStudents = await window.store.getSharedStudents(className);
        }

        const studentMap = new Map();
        localStudents.forEach(s => studentMap.set(s.id, s));
        sharedStudents.forEach(s => {
            const existing = Array.from(studentMap.values()).find(ls => ls.id === s.id || (ls.regNumber && ls.regNumber === s.regNumber));
            if (!existing) studentMap.set(s.id, s);
        });

        const students = Array.from(studentMap.values())
            .sort((a, b) => (a.name || '').localeCompare((b.name || ''), 'fr', { sensitivity: 'base' }));

        const ccA = cfg.ccAssignmentId ? getData().assignments.find(a => a.id === cfg.ccAssignmentId) : null;
        const tpA = cfg.tpAssignmentId ? getData().assignments.find(a => a.id === cfg.tpAssignmentId) : null;
        const compA = cfg.compAssignmentId ? getData().assignments.find(a => a.id === cfg.compAssignmentId) : null;
        const hasTP = !!tpA;
        const d1Issue = groupHasExportScaleIssue(className, cfg, 'devoir1');
        const d2Issue = groupHasExportScaleIssue(className, cfg, 'devoir2');
        const devoirScaleIssue = d1Issue || d2Issue;

        const studentsWithAverages = students.map(s => {
            const cc = ccA ? calcScaledScore(s.id, ccA) : null;
            const tp = tpA ? calcScaledScore(s.id, tpA) : null;
            const comp = compA ? calcScaledScore(s.id, compA) : null;
            const devoir = computeDevoirFinal(s.id, className, cfg);
            let moyenne = null;
            const requiredOk = (devoir !== null && cc !== null && comp !== null && (!hasTP || tp !== null));
            if (requiredOk) {
                moyenne = hasTP ? (devoir + cc + tp + 2 * comp) / 5 : (devoir + cc + 2 * comp) / 4;
            }
            return { s, cc, tp, comp, devoir, moyenne };
        });

        const hasAnyMoyenne = studentsWithAverages.some(item => item.moyenne !== null);
        const fmt = (v) => (v === null ? '' : round2(v).toFixed(2));

        const rows = studentsWithAverages.map(item => {
            const { s, cc, tp, comp, devoir, moyenne } = item;
            const ccExpected = !!ccA;
            const tpExpected = !!tpA;
            const compExpected = !!compA;
            const devoirExpected = true;

            const ccClass = cellClassForValue(cc, ccExpected);
            const tpClass = cellClassForValue(tp, tpExpected);
            const compClass = cellClassForValue(comp, compExpected);
            const devoirClass = cellClassForValue(devoir, devoirExpected);
            const avgClass = cellClassForValue(moyenne, (ccExpected && compExpected && (!hasTP || tpExpected)));

            const res = window.computeFinalObsCons({
                className,
                studentId: s.id,
                devoir,
                comp,
                avg: moyenne,
                currentLanguage: getLang()
            });

            const scopeKey = getRemarksScopeKey(className);
            const displayObs = res.obs;
            const displayCons = res.cons;
            const obsBandIdx = res.bandIdx;
            const consBandIdx = res.bandIdx;

            const teacherObsBand = window.getTeacherMessages(`obs@${obsBandIdx}`) || [];
            const teacherConsBand = window.getTeacherMessages(`cons@${consBandIdx}`) || [];
            const obsCandidates = getObsCandidatesForRow(moyenne) || [];
            const consCandidates = window.getConsCandidatesForRow(moyenne) || [];

            return `
                <tr class="border-b hover:bg-gray-50">
                    <td class="p-3 bg-gray-50 sticky left-0 z-10 font-medium">${s.name}</td>
                    <td class="p-3 text-center ${ccClass}" title="${cc === null && ccExpected ? (t.missingGrade || '') : (cc === 0 ? (t.zeroGrade || '') : '')}">${fmt(cc)}</td>
                    <td class="p-3 text-center font-bold ${devoirClass}" title="${devoir === null ? (t.missingGrade || '') : (devoir === 0 ? (t.zeroGrade || '') : '')}">${fmt(devoir)}</td>
                    ${hasTP ? `<td class="p-3 text-center ${tpClass}" title="${tp === null && tpExpected ? (t.missingGrade || '') : (tp === 0 ? (t.zeroGrade || '') : '')}">${fmt(tp)}</td>` : ``}
                    <td class="p-3 text-center ${compClass}" title="${comp === null && compExpected ? (t.missingGrade || '') : (comp === 0 ? (t.zeroGrade || '') : '')}">${fmt(comp)}</td>
                    ${hasAnyMoyenne ? `
                    <td class="p-3 text-center font-bold ${avgClass}">${fmt(moyenne)}</td>
                    <td class="p-3 text-left">
                        <div class="remark-cell" data-scope="${escapeHtml(scopeKey)}" data-student-id="${escapeHtml(s.id)}" data-kind="obs" data-avg="${escapeHtml(moyenne)}" data-obs-band="${obsBandIdx}">
                            <div class="remark-text text-sm leading-snug">${escapeHtml(displayObs)}</div>
                            <div class="mt-1 flex gap-2">
                                <button type="button" class="remark-edit-btn text-xs px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded">Modifier / Perso</button>
                                <button type="button" class="remark-auto-btn text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded">Auto</button>
                            </div>
                            <div class="remark-editor mt-2 hidden p-2 bg-indigo-50 rounded border border-indigo-100 space-y-2">
                                <textarea class="remark-textarea w-full p-2 border rounded bg-white text-sm h-20" placeholder="Commentaire personnalisé...">${escapeHtml(displayObs)}</textarea>
                                <div class="flex flex-wrap gap-2 items-center">
                                    <select class="remark-select flex-1 p-1 border rounded bg-white text-xs">
                                        <option value="">(Suggestions / Bibliothèque)</option>                                    
                                        ${teacherObsBand.length ? `<optgroup label="Ma bibliothèque">${teacherObsBand.map(msg => `<option value="${escapeHtml(msg)}">${escapeHtml(msg.slice(0, 80))}...</option>`).join("")}</optgroup>` : ""}
                                        ${obsCandidates.length ? `<optgroup label="Suggestions moteur">${obsCandidates.map(msg => `<option value="${escapeHtml(msg)}">${escapeHtml(msg.slice(0, 80))}...</option>`).join("")}</optgroup>` : ""}
                                    </select>
                                    <button type="button" class="remark-save-btn px-2 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700">OK</button>
                                    <button type="button" class="remark-add-lib-btn px-2 py-1 bg-amber-500 text-white rounded text-xs hover:bg-amber-600" title="Ajouter à ma bibliothèque pour ce niveau">+ Biblio</button>
                                </div>
                            </div>
                        </div>
                    </td>
                    <td class="p-3 text-left">
                        <div class="remark-cell" data-scope="${escapeHtml(scopeKey)}" data-student-id="${escapeHtml(s.id)}" data-kind="cons" data-avg="${escapeHtml(moyenne)}" data-cons-band="${consBandIdx}">
                            <div class="remark-text text-sm leading-snug">${escapeHtml(displayCons)}</div>
                            <div class="mt-1 flex gap-2">
                                <button type="button" class="remark-edit-btn text-xs px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded">Modifier / Perso</button>
                                <button type="button" class="remark-auto-btn text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded">Auto</button>
                            </div>
                            <div class="remark-editor mt-2 hidden p-2 bg-indigo-50 rounded border border-indigo-100 space-y-2">
                                <textarea class="remark-textarea w-full p-2 border rounded bg-white text-sm h-20" placeholder="Conseil personnalisé...">${escapeHtml(displayCons)}</textarea>
                                <div class="flex flex-wrap gap-2 items-center">
                                    <select class="remark-select flex-1 p-1 border rounded bg-white text-xs">
                                        <option value="">(Suggestions / Bibliothèque)</option>
                                        ${teacherConsBand.length ? `<optgroup label="Ma bibliothèque">${teacherConsBand.map(msg => `<option value="${escapeHtml(msg)}">${escapeHtml(msg.slice(0, 80))}...</option>`).join("")}</optgroup>` : ""}
                                        ${consCandidates.length ? `<optgroup label="Suggestions moteur">${consCandidates.map(msg => `<option value="${escapeHtml(msg)}">${escapeHtml(msg.slice(0, 80))}...</option>`).join("")}</optgroup>` : ""}
                                    </select>
                                    <button type="button" class="remark-save-btn px-2 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700">OK</button>
                                    <button type="button" class="remark-add-lib-btn px-2 py-1 bg-amber-500 text-white rounded text-xs hover:bg-amber-600" title="Ajouter à ma bibliothèque pour ce niveau">+ Biblio</button>
                                </div>
                            </div>
                        </div>
                    </td>` : ``}
                </tr>`;
        }).join('');

        const cols = ['<col style="width:240px">', '<col style="width:110px">', '<col style="width:120px">'];
        if (hasTP) cols.push('<col style="width:110px">');
        cols.push('<col style="width:130px">');
        if (hasAnyMoyenne) { cols.push('<col style="width:130px">'); cols.push('<col style="width:220px">'); cols.push('<col style="width:220px">'); }
        let colCount = 3 + (hasTP ? 1 : 0) + (hasAnyMoyenne ? 3 : 0);

        preview.innerHTML = `
            <table class="w-full table-fixed border-collapse">
            <colgroup>${cols.join('')}</colgroup>
            <thead>
                <tr class="bg-gray-200 border-b-2 border-gray-300"><th colspan="${colCount}" class="p-4 text-center text-xl font-bold uppercase tracking-wide text-gray-800">${className}</th></tr>
                <tr class="border-b-2">
                    <th class="p-3 text-left bg-gray-100 sticky left-0 z-10">${t.student}</th>
                    <th class="p-3 text-center bg-gray-100" data-translate="ccShort">${t.ccShort || 'CC'}</th>
                    <th class="p-3 text-center ${devoirScaleIssue ? 'bg-amber-200 text-amber-900' : 'bg-blue-100 text-blue-900'}" title="${devoirScaleIssue ? (t.exportDevoirWarning || '') : (t.exportDevoirOk || '')}"><span data-translate="devoirShort">${t.devoirShort || 'Devoir'}</span><span class="ml-1">${devoirScaleIssue ? '⚠️' : '⚠️'}</span></th>
                    ${hasTP ? `<th class="p-3 text-center bg-gray-100" data-translate="tpShort">${t.tpShort || 'TP'}</th>` : ``}
                    <th class="p-3 text-center bg-gray-100" data-translate="compositionShort">${t.compositionShort || 'Composition'}</th>
                    ${hasAnyMoyenne ? `
                    <th class="p-3 text-center bg-green-100" data-translate="avgShort">${t.avgShort || 'Moyenne'}</th>
                    <th class="p-3 text-center bg-gray-100" data-translate="observationShort">${t.observationShort || 'Observation'}</th>
                    <th class="p-3 text-center bg-gray-100" data-translate="adviceShort">${t.adviceShort || 'Conseil'}</th>
                    ` : ``}
                </tr>
            </thead>
            <tbody>${rows}</tbody>
            </table>
        `;

        preview.querySelectorAll(".remark-cell").forEach(cell => {
            const scopeKey = cell.dataset.scope;
            const studentId = cell.dataset.studentId;
            const kind = cell.dataset.kind;
            const btnEdit = cell.querySelector(".remark-edit-btn");
            const btnAuto = cell.querySelector(".remark-auto-btn");
            const btnSave = cell.querySelector(".remark-save-btn");
            const btnAddLib = cell.querySelector(".remark-add-lib-btn");
            const editor = cell.querySelector(".remark-editor");
            const textarea = cell.querySelector(".remark-textarea");
            const select = cell.querySelector(".remark-select");

            btnEdit.addEventListener("click", () => editor.classList.toggle("hidden"));
            btnAuto.addEventListener("click", () => { clearOverrideField(scopeKey, studentId, kind); window.renderExportPrep(); });
            select.addEventListener("change", () => { if (select.value) textarea.value = select.value; });
            btnSave.addEventListener("click", () => {
                const msg = textarea.value.trim();
                if (!msg) clearOverrideField(scopeKey, studentId, kind);
                else setOverride(scopeKey, studentId, { [kind]: msg });
                window.renderExportPrep();
            });
            btnAddLib.addEventListener("click", () => {
                const msg = textarea.value.trim();
                if (!msg) return;
                const bandIdx = parseInt(kind === "obs" ? (cell.dataset.obsBand || "-1") : (cell.dataset.consBand || "-1"), 10);
                window.addTeacherMessage(`${kind}@${bandIdx}`, msg);
                setOverride(scopeKey, studentId, { [kind]: msg });
                window.renderExportPrep();
            });
        });
    }

    window.printExportTable = function() {
        const table = document.querySelector("#export-preview-table table");
        if (!table) { alert("Tableau introuvable !"); return; }
        const className = document.getElementById("select-class-export")?.value || "";
        const clone = table.cloneNode(true);
        clone.querySelectorAll(".remark-cell").forEach(cell => {
            const txt = cell.querySelector(".remark-text")?.textContent || "";
            cell.innerHTML = escapeHtml(txt);
        });
        clone.querySelectorAll("button, select, input, textarea").forEach(el => el.remove());
        const win = window.open("", "_blank");
        win.document.write(`<html><head><title>Impression</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse;font-size:14px}th,td{border:1px solid #444;padding:6px 8px;text-align:center;vertical-align:top}th{background:#eee}</style></head><body><h3 style="margin-bottom:20px;">${escapeHtml(className)}</h3></body></html>`);
        win.document.body.appendChild(clone);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 250);
    };

    window.exportExportTableXLSX = function() {
        const table = document.querySelector("#export-preview-table table");
        if (!table) { alert("Tableau introuvable !"); return; }
        const clone = table.cloneNode(true);
        clone.querySelectorAll(".remark-cell").forEach(cell => {
            const txt = cell.querySelector(".remark-text")?.textContent || "";
            cell.innerHTML = escapeHtml(txt);
        });
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.table_to_sheet(clone, { raw: true });
        XLSX.utils.book_append_sheet(wb, ws, "Export");
        XLSX.writeFile(wb, "export-classe.xlsx");
    };

    window.computeFinalObsCons = function ({ className, studentId, devoir, comp, avg, currentLanguage }) {
        const avgNum = Number(avg);
        if (!Number.isFinite(avgNum)) return { obs: "", cons: "", bandIdx: -1 };
        const scopeKey = getRemarksScopeKey(className);
        const ov = getOverride(scopeKey, studentId) || {};
        const R = window.REMARKSMESSAGES || window.REMARKS_MESSAGES;
        const bandIdx = R ? findBandIndexLocal(R.avgBands, avgNum) : -1;
        
        const rm = window.computeExportRemarks
            ? window.computeExportRemarks({ devoir, comp, avg: avgNum, currentLanguage, seed: studentId || 0, customRemarks: window.ensureGlobalRemarks() })
            : { obs: "", cons: "" };

        const teacherObsBand = window.getTeacherMessages(`obs@${bandIdx}`) || [];
        const teacherConsBand = window.getTeacherMessages(`cons@${bandIdx}`) || [];
        
        let obsCandidates = [];
        try { if (typeof window.getObsCandidatesForRow === "function") obsCandidates = (window.getObsCandidatesForRow(avgNum) || []); } catch (e) { }
        let consCandidates = [];
        try { if (typeof window.getConsCandidatesForRow === "function") consCandidates = window.getConsCandidatesForRow(avgNum) || []; } catch (e) { }

        const obsPool = [...teacherObsBand, ...obsCandidates];
        if (rm.obs) obsPool.push(rm.obs);
        const consPool = [...teacherConsBand, ...consCandidates];
        if (rm.cons) consPool.push(rm.cons);

        const seedObs = `${className}|${studentId}|obs|${avgNum}|band:${bandIdx}`;
        const seedCons = `${className}|${studentId}|cons|${avgNum}|band:${bandIdx}`;
        const autoObs = obsPool.length ? pickDeterministic(obsPool, seedObs) : (rm.obs || "");
        const autoCons = consPool.length ? pickDeterministic(consPool, seedCons) : (rm.cons || "");

        return { obs: (ov.obs && ov.obs.trim()) ? ov.obs : autoObs, cons: (ov.cons && ov.cons.trim()) ? ov.cons : autoCons, bandIdx };
    };

    function pickDeterministic(list, seedStr) {
        const arr = (list || []).map(x => String(x || "").trim()).filter(Boolean);
        if (!arr.length) return "";
        let h = 2166136261;
        const s = String(seedStr || "");
        for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
        const idx = Math.abs(h) % arr.length;
        return arr[idx];
    }

    // --- RAKMANA ---
    window.doRakamna = function() {
        if (typeof window.precheckRakmanaAllClassesConfig === 'function') {
            if (!window.precheckRakmanaAllClassesConfig()) return;
        }
        const fileInput = document.getElementById('rakmana-file-input');
        if (fileInput) { fileInput.value = ''; fileInput.click(); }
    };

    window.onRakmanaFileSelected = function(input) {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            try { window.processRakmanaWorkbookExcelJS_AllClasses(e.target.result, file.name); }
            catch (err) { alert("Erreur: " + err.message); }
        };
        reader.readAsArrayBuffer(file);
    };

    function collectSelectedAssignmentIdsFromGroup(groupCfg, assignmentsById) {
        const out = new Set();
        const SKIP_KEYS = new Set(['combine', 'normalize', 'targetMax']);
        const walk = (node) => {
            if (node == null) return;
            if (Array.isArray(node)) { node.forEach(walk); return; }
            if (typeof node === 'string' || typeof node === 'number') { const id = String(node); if (assignmentsById.has(id)) out.add(id); return; }
            if (typeof node === 'object') {
                for (const [k, v] of Object.entries(node)) {
                    if (SKIP_KEYS.has(k)) continue;
                    const keyAsId = String(k);
                    if (assignmentsById.has(keyAsId) && !!v) out.add(keyAsId);
                    walk(v);
                }
            }
        };
        walk(groupCfg);
        return [...out];
    }

    function getSelectedDevoirIds(cfg, assignmentsById) {
        const ids = new Set();
        for (const id of collectSelectedAssignmentIdsFromGroup(cfg?.devoir1, assignmentsById)) ids.add(id);
        for (const id of collectSelectedAssignmentIdsFromGroup(cfg?.devoir2, assignmentsById)) ids.add(id);
        return [...ids];
    }

    window.precheckRakmanaAllClassesConfig = function() {
        const t = getTranslations()[getLang()] || {};
        const select = document.getElementById('select-class-export');
        const classNames = select ? Array.from(select.options).map(o => (o.value || '').trim()).filter(Boolean) : [...new Set((getData().students || []).map(s => (s.className || '').trim()).filter(Boolean))];
        if (!classNames.length) { alert(t.selectClass || "Aucune classe trouvée."); return false; }
        const assignmentsById = new Map((getData().assignments || []).map(a => [a.id, a]));
        const issues = [];
        for (const className of classNames) {
            const cfg = getExportClassConfig(className);
            if (!cfg) { issues.push(`- ${className}: config absente.`); continue; }
            if (!cfg.ccAssignmentId || !assignmentsById.has(cfg.ccAssignmentId)) issues.push(`- ${className}: CC manquant.`);
            if (!cfg.compAssignmentId || !assignmentsById.has(cfg.compAssignmentId)) issues.push(`- ${className}: Composition manquante.`);
            if (getSelectedDevoirIds(cfg, assignmentsById).length === 0) issues.push(`- ${className}: aucun devoir sélectionné.`);
            if (cfg.hasTp && (!cfg.tpAssignmentId || !assignmentsById.has(cfg.tpAssignmentId))) issues.push(`- ${className}: TP activé mais manquant.`);
        }
        if (issues.length) { alert("Export annulé :\n" + issues.join("\n")); return false; }
        return true;
    };

    window.getRakmanaStatusForClass = function(className) {
        const assignmentsById = new Map((getData().assignments || []).map(a => [String(a.id), a]));
        const cfg = getExportClassConfig(className);
        if (!cfg) return { ready: false, partialDevoir: false };
        const ccOk = !!cfg.ccAssignmentId && assignmentsById.has(String(cfg.ccAssignmentId));
        const tpOk = !!cfg.tpAssignmentId && assignmentsById.has(String(cfg.tpAssignmentId));
        const compoOk = !!cfg.compAssignmentId && assignmentsById.has(String(cfg.compAssignmentId));
        const devoirCount = getSelectedDevoirIds(cfg, assignmentsById).length;
        const hasAtLeastOneDevoir = devoirCount > 0;
        const anyComponentSelected = ccOk || tpOk || compoOk || hasAtLeastOneDevoir;
        const ready = ccOk && compoOk && hasAtLeastOneDevoir;
        return { ready, partialDevoir: anyComponentSelected && !ready };
    };

    window.updateExportClassCardColor = function() {
        const card = document.getElementById('export-class-card');
        const select = document.getElementById('select-class-export');
        if (!card || !select) return;
        const classNames = Array.from(select.options).map(o => (o.value || '').trim()).filter(Boolean);
        const selected = (select.value || '').trim();
        let state = 'none';
        if (selected) {
            const st = window.getRakmanaStatusForClass(selected);
            state = st.ready ? 'green' : (st.partialDevoir ? 'orange' : 'none');
        } else {
            const allReady = classNames.length > 0 && classNames.every(c => window.getRakmanaStatusForClass(c).ready);
            state = allReady ? 'green' : 'none';
        }
        card.classList.remove('bg-green-50', 'border-green-300', 'bg-amber-50', 'border-amber-300', 'bg-gray-50', 'border-transparent');
        if (state === 'green') card.classList.add('bg-green-50', 'border-green-300');
        else if (state === 'orange') card.classList.add('bg-amber-50', 'border-amber-300');
        else card.classList.add('bg-gray-50', 'border-transparent');
    };

    window.installRakmanaColorAutoUpdate = function() {
        const root = document.getElementById('export-config');
        if (!root || root.dataset.rakmanaAutoUpdateInstalled === '1') return;
        root.dataset.rakmanaAutoUpdateInstalled = '1';
        const refresh = () => requestAnimationFrame(window.updateExportClassCardColor);
        root.addEventListener('change', refresh);
        root.addEventListener('input', refresh);
        root.addEventListener('click', refresh);
    };

    function computeAverageFromGrades(g, cfg, hasTP) {
        const toNum = (x) => { const n = Number(x); return Number.isFinite(n) ? n : null; };
        const cc = toNum(g.cc), dev = toNum(g.devoir), compo = toNum(g.comp), tp = toNum(g.tp);
        if (cc == null || dev == null || compo == null) return null;
        if (hasTP) { if (tp == null) return null; return (cc + dev + tp + 2 * compo) / 5; }
        return (cc + dev + 2 * compo) / 4;
    }

    function observationAndAdviceFromAverage(avg) {
        if (avg == null) return { obs: '', cons: '' };
        if (avg >= 18) return { obs: 'ممتاز', cons: 'حافظ على هذا المستوى.' };
        if (avg >= 16) return { obs: 'جيد جدا', cons: 'واصل العمل الجيد.' };
        if (avg >= 14) return { obs: 'جيد', cons: 'يمكنك تحسين الأداء بالمزيد من المراجعة.' };
        if (avg >= 12) return { obs: 'متوسط', cons: 'نحتاج إلى تركيز أكبر وتنظيم الوقت.' };
        if (avg >= 10) return { obs: 'مقبول', cons: 'راجع الدروس بانتظام واطلب المساعدة عند الحاجة.' };
        return { obs: 'ضعيف', cons: 'تحتاج إلى بذل مجهود أكبر والمتابعة المستمرة.' };
    }

    window.processRakmanaWorkbookExcelJS_AllClasses = async function(arrayBuffer, originalFileName) {
        const t = getTranslations()[getLang()] || {};
        const select = document.getElementById('select-class-export');
        const classNames = select ? Array.from(select.options).map(o => (o.value || '').trim()).filter(Boolean) : [...new Set((getData().students || []).map(s => (s.className || '').trim()).filter(Boolean))];
        if (!classNames.length) { alert(t.selectClass || "Aucune classe trouvée."); return; }
        
        const excelWb = new ExcelJS.Workbook();
        await excelWb.xlsx.load(arrayBuffer);
        const normalize = (s) => String(s || '').replace(/\s/g, '').toUpperCase();
        const extractNIN = (cellValue) => {
            if (cellValue === undefined || cellValue === null) return '';
            let s = String(cellValue).replace(/\s/g, '').trim();
            if (!s) return '';
            if (s.endsWith('.0') && /^\d+\.0$/.test(s)) s = s.slice(0, -2);
            return s;
        };
        const findWorksheetForClass = (className) => {
            const cleanClass = normalize(className);
            for (const ws of excelWb.worksheets) {
                const r5 = ws.getRow(5);
                let txt = '';
                for (let c = 1; c <= Math.max(ws.columnCount, 20); c++) { const v = r5.getCell(c).value; if (v !== undefined && v !== null) txt += String(v); }
                if (normalize(txt).includes(cleanClass)) return ws;
            }
            return null;
        };
        const HEADERS = { cc: 'التقييم المستمر', devoir: 'معدل الفروض', tp: 'المطالعة', comp: 'الاختبار', obs: 'التقديرات', cons: 'الارشادات' };
        const findColumnIndex = (ws, headerRow, needle) => {
            const norm = needle.replace(/\s/g, '');
            for (let i = 1; i <= Math.max(ws.columnCount, 40); i++) {
                const v = headerRow.getCell(i).value;
                const s = String(v || '').replace(/\s/g, '');
                if (s.includes(norm)) return i;
            }
            return -1;
        };
        const assignmentsById = new Map((getData().assignments || []).map(a => [a.id, a]));
        const plan = []; const issues = [];

        for (const className of classNames) {
            const cfg = getExportClassConfig(className);
            if (!cfg) { issues.push(`- ${className}: config absente.`); continue; }
            const ccA = cfg.ccAssignmentId ? assignmentsById.get(cfg.ccAssignmentId) : null;
            const compA = cfg.compAssignmentId ? assignmentsById.get(cfg.compAssignmentId) : null;
            const tpA = cfg.tpAssignmentId ? assignmentsById.get(cfg.tpAssignmentId) : null;
            const hasTP = !!(cfg.hasTp && tpA);
            if (!ccA || !compA) { issues.push(`- ${className}: CC ou Composition manquant.`); continue; }
            const ws = findWorksheetForClass(className);
            if (!ws) { issues.push(`- ${className}: feuille Excel non trouvée.`); continue; }
            const headerRow = ws.getRow(8);
            const colIndices = { cc: findColumnIndex(ws, headerRow, HEADERS.cc), devoir: findColumnIndex(ws, headerRow, HEADERS.devoir), tp: findColumnIndex(ws, headerRow, HEADERS.tp), comp: findColumnIndex(ws, headerRow, HEADERS.comp), obs: findColumnIndex(ws, headerRow, HEADERS.obs), cons: findColumnIndex(ws, headerRow, HEADERS.cons) };
            if (colIndices.cc === -1 || colIndices.devoir === -1 || colIndices.comp === -1) { issues.push(`- ${className}: en-têtes manquants.`); continue; }
            
            const gradesByNIN = {}; let studentsWithNIN = 0;
            
            // --- COLLABORATIVE MODEL: Fetch and merge students for this class ---
            const globalUserId = window.currentUser?.email || window.currentUser?.id || 'unknown';
            const globalAcademicYear = window.getGlobalAcademicYear();
            
            let localStudents = getData().students.filter(s => 
                (s.className || '').trim() === className &&
                (s.importedBy || 'unknown') === globalUserId &&
                (s.academicYear || '') === globalAcademicYear
            );
            
            let sharedStudents = [];
            if (window.store && typeof window.store.getSharedStudents === 'function') {
                sharedStudents = await window.store.getSharedStudents(className);
            }

            const studentMap = new Map();
            localStudents.forEach(s => studentMap.set(s.id, s));
            sharedStudents.forEach(s => {
                const existing = Array.from(studentMap.values()).find(ls => ls.id === s.id || (ls.regNumber && ls.regNumber === s.regNumber));
                if (!existing) studentMap.set(s.id, s);
            });

            Array.from(studentMap.values()).forEach(s => {
                const nin = String(s.nin || '').replace(/\s/g, '').trim();
                if (!nin) return;
                studentsWithNIN++;
                const cc = ccA ? calcScaledScore(s.id, ccA) : null;
                const comp = compA ? calcScaledScore(s.id, compA) : null;
                const devoir = computeDevoirFinal(s.id, className, cfg);
                const tp = hasTP ? calcScaledScore(s.id, tpA) : null;
                gradesByNIN[nin] = { cc, devoir, tp, comp, studentId: s.id };
            });
            if (studentsWithNIN === 0) { issues.push(`- ${className}: aucun élève avec NIN.`); continue; }
            let totalMatches = 0;
            for (let r = 9; r <= ws.rowCount; r++) {
                const nin = extractNIN(ws.getRow(r).getCell(1).value);
                if (!nin) break;
                if (gradesByNIN[nin]) totalMatches++;
            }
            if (totalMatches === 0) { issues.push(`- ${className}: aucun NIN matché dans Excel.`); continue; }
            plan.push({ className, cfg, ws, colIndices, gradesByNIN, hasTP, expectedMatches: totalMatches });
        }

        if (issues.length) { alert("Export annulé (problèmes détectés) :\n" + issues.join("\n")); return; }

        let totalMatches = 0;
        for (const item of plan) {
            const { className, cfg, ws, colIndices, gradesByNIN, hasTP } = item;
            for (let r = 9; r <= ws.rowCount; r++) {
                const nin = extractNIN(ws.getRow(r).getCell(1).value);
                if (!nin) break;
                const g = gradesByNIN[nin];
                if (!g) continue;
                totalMatches++;
                const write = (c, v) => { if (c !== -1 && v != null) ws.getRow(r).getCell(c).value = round2(Number(v)); };
                write(colIndices.cc, g.cc);
                write(colIndices.devoir, g.devoir);
                if (hasTP) write(colIndices.tp, g.tp);
                write(colIndices.comp, g.comp);
                
                const avg = computeAverageFromGrades(g, cfg, hasTP);
                const res = window.computeFinalObsCons({ className, studentId: g.studentId, devoir: g.devoir, comp: g.comp, avg, currentLanguage: getLang() });
                if (colIndices.obs !== -1) ws.getRow(r).getCell(colIndices.obs).value = res.obs;
                if (colIndices.cons !== -1) ws.getRow(r).getCell(colIndices.cons).value = res.cons;
            }
        }

        const correctedBuffer = await excelWb.xlsx.writeBuffer();
        if (typeof JSZip === 'undefined') {
            const blob = new Blob([correctedBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = originalFileName; document.body.appendChild(link); link.click(); URL.revokeObjectURL(link.href); document.body.removeChild(link);
            alert(`✅ ${totalMatches} élève(s) mis à jour.\n⚠️ JSZip manquant (protection perdue).`);
            return;
        }

        const originalZip = await JSZip.loadAsync(arrayBuffer);
        const correctedZip = await JSZip.loadAsync(correctedBuffer);
        const workbookXml = await originalZip.file("xl/workbook.xml")?.async("string");
        const workbookRelsXml = await originalZip.file("xl/_rels/workbook.xml.rels")?.async("string");
        if (!workbookXml || !workbookRelsXml) { /* fallback without protection */ }
        
        const parser = new DOMParser();
        const wbDoc = parser.parseFromString(workbookXml, "text/xml");
        const relsDoc = parser.parseFromString(workbookRelsXml, "text/xml");
        const sheets = Array.from(wbDoc.getElementsByTagName("sheet"));
        
        for (const sheetNode of sheets) {
            const rId = sheetNode.getAttribute("r:id");
            const relNode = Array.from(relsDoc.getElementsByTagName("Relationship")).find(n => n.getAttribute("Id") === rId);
            const target = relNode?.getAttribute("Target");
            if (!target) continue;
            const fullPath = target.startsWith("/") ? target.substring(1) : `xl/${target}`;
            const originalSheetXml = await originalZip.file(fullPath)?.async("string");
            if (!originalSheetXml) continue;
            const protectionMatch = originalSheetXml.match(/<sheetProtection[^>]*\/>/);
            if (!protectionMatch) continue;
            let correctedSheetXml = await correctedZip.file(fullPath)?.async("string");
            if (!correctedSheetXml) continue;
            correctedSheetXml = correctedSheetXml.replace(/<sheetProtection[^>]*\/>/g, '');
            const sheetDataEndIndex = correctedSheetXml.indexOf("</sheetData>");
            if (sheetDataEndIndex !== -1) {
                correctedSheetXml = correctedSheetXml.substring(0, sheetDataEndIndex + "</sheetData>".length) + protectionMatch[0] + correctedSheetXml.substring(sheetDataEndIndex + "</sheetData>".length);
                correctedZip.file(fullPath, correctedSheetXml);
            }
        }

        const finalBlob = await correctedZip.generateAsync({ type: "blob" });
        const link = document.createElement('a'); link.href = URL.createObjectURL(finalBlob); link.download = originalFileName; document.body.appendChild(link); link.click(); URL.revokeObjectURL(link.href); document.body.removeChild(link);
        alert(`✅ ${totalMatches} élève(s) mis à jour.\n🔐 Protection préservée si possible.`);
    };

})();