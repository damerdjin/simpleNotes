import { supabase } from './supabase-client.js';

(function() {
    // Access global data and helpers
    const getData = () => window.data;
    const getTranslations = () => window.translations;
    const getLang = () => window.currentLanguage;
    const getClasses = async () => await window.getClasses ? window.getClasses() : [];
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

    function getExportClassConfig(className, subject = '') {
        if (!className) return null;
        const trimester = window.getGlobalTrimester() || 'T1';
        const key = `${trimester}|${className}|${subject}`;

        if (!exportPrepConfig.byClass[key]) {
            exportPrepConfig.byClass[key] = {
                ccAssignmentId: '',
                compAssignmentId: '',
                tpAssignmentId: '',
                subject: subject,
                devoir1: { assignmentIds: [], combine: 'sum', normalize: true, targetMax: 20 },
                devoir2: { assignmentIds: [], combine: 'sum', normalize: true, targetMax: 20 },
                outMax: 20
            };
        }
        const cfg = exportPrepConfig.byClass[key];

        // --- TYPE AUTO-MAPPING (filtered by subject) ---
        if (typeof getAssignmentsForClass === 'function') {
            const allAssigns = getAssignmentsForClass(className).filter(a => !subject || (a.subject || a.assignment_subject) === subject);
            if (!cfg.ccAssignmentId) cfg.ccAssignmentId = allAssigns.find(a => a.type === 'cc')?.id || '';
            if (!cfg.tpAssignmentId) cfg.tpAssignmentId = allAssigns.find(a => a.type === 'tp')?.id || '';
            if (!cfg.compAssignmentId) cfg.compAssignmentId = allAssigns.find(a => a.type === 'comp')?.id || '';
        }

        return cfg;
    }
    window.getExportClassConfig = getExportClassConfig;

    window.deleteClassDataFromExport = function(className) {
        if (!className) return;
        const trimester = window.getGlobalTrimester() || 'T1';
        
        // Remove all keys for this class across all subjects
        Object.keys(exportPrepConfig.byClass).forEach(key => {
            const parts = key.split('|');
            if (parts[1] === className) {
                delete exportPrepConfig.byClass[key];
            }
        });
        window.saveExportPrepConfig();

        if (remarksOverrides && remarksOverrides[className]) {
            delete remarksOverrides[className];
            saveRemarksOverrides(remarksOverrides);
        }
    };

    function getAssignmentsForClass(className) {
        const globalTrimester = String(window.getGlobalTrimester() || '');
        const userId = window.currentUser?.email || window.currentUser?.id || 'unknown';
        const allAssignments = getData().assignments || [];
        
        const filtered = allAssignments.filter(a => {
            // Match class (trimmed)
            const matchClass = (a.className || '').trim() === (className || '').trim();
            
            // Flexible trimester match (handle both "1" and "T1")
            const aTri = String(a.trimester || '').replace('T', '');
            const gTri = globalTrimester.replace('T', '');
            const matchTrimester = (aTri === gTri);
            
            // Match user (be flexible if createdBy is missing)
            const aUser = a.createdBy || a.user_id || 'unknown';
            const matchUser = (aUser === 'unknown' || aUser === userId);

            return matchClass && matchTrimester && matchUser;
        });

        console.log(`[Export Prep] Assignments found for ${className} (Trimester ${globalTrimester}):`, filtered.length);
        return filtered;
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

        const assignmentsGlob = getData().assignments;
        const currentTrimester = window.getGlobalTrimester();

        const assigns = ids
            .map(id => assignmentsGlob.find(a => a.id === id))
            .filter(a => {
                if (!a) return false;
                const matchClass = (a.className || '').trim() === (className || '').trim();
                const matchTrimester = (a.trimester || '') === currentTrimester;
                return matchClass && matchTrimester;
            });

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
    window.computeDevoirFinal = computeDevoirFinal;

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
    window.calcScaledScore = calcScaledScore;

    window.loadClassSelectorsForExport = async function() {
        const classes = window.getClasses ? await window.getClasses() : [];
        const select = document.getElementById('select-class-export');
        const t = getTranslations()[getLang()];
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = `<option value="">-- ${t.selectClass} --</option>` +
            classes.map(c => `<option value="${c}" ${c === currentValue ? 'selected' : ''}>${c}</option>`).join('');
    };

    window.onExportClassChange = function() {
        window.renderExportPrep();
        window.installRakmanaColorAutoUpdate();
        window.updateExportClassCardColor();
    };

    window.onExportSubjectChange = function() {
        window.renderExportPrep();
    };

    window.resetExportConfig = function() {
        const className = document.getElementById('select-class-export')?.value || '';
        if (!className) return;
        const subject = document.getElementById('select-subject-export')?.value || '';
        const trimester = window.getGlobalTrimester() || 'T1';
        const key = `${trimester}|${className}|${subject}`;

        delete exportPrepConfig.byClass[key];
        window.saveExportPrepConfig();
        const scopeKey = getRemarksScopeKey(className);
        if (remarksOverrides[className]) {
            delete remarksOverrides[className];
            saveRemarksOverrides(remarksOverrides);
        }
        window.renderExportPrep();
    };

    window.renderExportPrep = async function() {
        if (!getTranslations() || !getLang() || !getTranslations()[getLang()]) return;
        const t = getTranslations()[getLang()];
        const className = document.getElementById('select-class-export')?.value || '';
        const subjectSelector = document.getElementById('select-subject-export');
        const subject = subjectSelector?.value || '';
        
        const container = document.getElementById('export-config');
        const preview = document.getElementById('export-preview-table');
        const meta = document.getElementById('export-preview-meta');

        if (!container || !preview || !meta) return;

        if (!className) {
            container.innerHTML = '';
            preview.innerHTML = '';
            meta.textContent = '';
            document.getElementById('export-preview-section')?.classList.add('hidden');
            if (subjectSelector) subjectSelector.innerHTML = '<option value="">-- Matière --</option>';
            return;
        }

        const allAssignsForClass = getAssignmentsForClass(className);
        const subjectsList = [...new Set(allAssignsForClass.map(a => a.subject || a.assignment_subject).filter(Boolean))];
        
        if (subjectSelector && (subjectSelector.dataset.lastClass !== className)) {
            subjectSelector.dataset.lastClass = className;
            subjectSelector.innerHTML = `<option value="">-- ${t.selectSubject || 'Matière'} --</option>` + 
                subjectsList.map(sid => {
                    const sObj = (window.subjects || []).find(s => s.id === sid);
                    const label = sObj ? (sObj[getLang()] || sObj.fr || sid) : sid;
                    return `<option value="${sid}">${label}</option>`;
                }).join('');
            // If there's only one subject, select it automatically
            if (subjectsList.length === 1) {
                subjectSelector.value = subjectsList[0];
            } else {
                subjectSelector.value = "";
            }
        }
        
        // Refresh subject value after possible auto-select
        const currentSubject = subjectSelector?.value || '';

        const cfg = getExportClassConfig(className, currentSubject);
        const allAssigns = allAssignsForClass.filter(a => !currentSubject || (a.subject || a.assignment_subject) === currentSubject);
        const assigns = allAssigns.filter(a => !a.type || a.type === 'devoir');

        // Try to load saved config from Supabase (if available)
        try {
            const savedConfig = await window.loadExportPrepFromSupabase();
            if (savedConfig) {
                let changed = false;
                if (savedConfig.cc_assignment_id && savedConfig.cc_assignment_id !== cfg.ccAssignmentId) {
                    cfg.ccAssignmentId = savedConfig.cc_assignment_id;
                    changed = true;
                }
                if (savedConfig.comp_assignment_id && savedConfig.comp_assignment_id !== cfg.compAssignmentId) {
                    cfg.compAssignmentId = savedConfig.comp_assignment_id;
                    changed = true;
                }
                if (savedConfig.tp_assignment_id && savedConfig.tp_assignment_id !== cfg.tpAssignmentId) {
                    cfg.tpAssignmentId = savedConfig.tp_assignment_id;
                    changed = true;
                }
                if (savedConfig.devoir1_config) {
                    const d1 = typeof savedConfig.devoir1_config === 'string' ? JSON.parse(savedConfig.devoir1_config) : savedConfig.devoir1_config;
                    if (JSON.stringify(d1) !== JSON.stringify(cfg.devoir1)) {
                        cfg.devoir1 = d1;
                        changed = true;
                    }
                }
                if (savedConfig.devoir2_config) {
                    const d2 = typeof savedConfig.devoir2_config === 'string' ? JSON.parse(savedConfig.devoir2_config) : savedConfig.devoir2_config;
                    if (JSON.stringify(d2) !== JSON.stringify(cfg.devoir2)) {
                        cfg.devoir2 = d2;
                        changed = true;
                    }
                }
                if (savedConfig.is_published !== undefined && savedConfig.is_published !== cfg.isPublished) {
                    cfg.isPublished = savedConfig.is_published;
                    changed = true;
                }
                if (changed) {
                    window.saveExportPrepConfig();
                }
            }
        } catch (e) {}

        if (assigns.length === 1 && (!cfg.devoir1.assignmentIds || cfg.devoir1.assignmentIds.length === 0) && (!cfg.devoir2.assignmentIds || cfg.devoir2.assignmentIds.length === 0)) {
            cfg.devoir1.assignmentIds = [assigns[0].id];
            window.saveExportPrepConfig();
        }

        const renderStatusBadge = (found, title) => {
            if (found) {
                return `
                    <div class="p-4 border-2 border-emerald-200 rounded-2xl bg-emerald-50/50 flex flex-col justify-center">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm shrink-0">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                            </div>
                            <div class="min-w-0">
                                <h3 class="font-bold text-gray-800 text-sm sm:text-base">${title}</h3>
                                <div class="flex items-center gap-2 mt-0.5">
                                    <p class="text-xs font-bold text-emerald-700 truncate">${found.name}</p>
                                    <span class="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-200 text-emerald-800 rounded" dir="ltr">/${getAssignmentMaxPoints(found)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="p-4 border-2 border-gray-100 border-dashed rounded-2xl bg-gray-50 flex items-center gap-3 opacity-80 grayscale-[0.5]">
                        <div class="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-500 shadow-sm shrink-0">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </div>
                        <div class="min-w-0">
                            <h3 class="font-bold text-gray-700 text-sm sm:text-base">${title}</h3>
                        </div>
                    </div>
                `;
            }
        };

        const renderMultiPick = (groupKey) => {
            const g = cfg[groupKey];
            const selected = new Set((g.assignmentIds || []).map(id => String(id)));
            const used = collectUsedAssignmentIds(cfg);
            const rows = assigns.map(a => {
                const aId = String(a.id);
                const isSelected = selected.has(aId);
                const isUsedElsewhere = used.has(aId) && !isSelected;
                const disabledAttr = isUsedElsewhere ? 'disabled' : '';
                const opacityClass = isUsedElsewhere ? 'opacity-50 cursor-not-allowed' : '';
                return `
                    <label class="flex items-center gap-2 p-2 border rounded-lg bg-white hover:bg-slate-50 transition cursor-pointer ${opacityClass}">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} ${disabledAttr}
                        onchange="toggleExportGroupAssignment('${groupKey}','${aId}',this.checked)" class="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500">
                        <span class="flex-1 min-w-0 truncate font-medium text-slate-800 text-sm sm:text-base">${a.name}</span>
                        <span class="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded shadow-sm" dir="ltr">/${getAssignmentMaxPoints(a)}</span>
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
                    ${assigns.length > 1 ? `<div class="flex flex-wrap gap-2 items-center">${chips}</div>` : ''}
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2">${rows}</div>
                </div>
            `;
        };

        const outMaxVal = parseFloat(cfg.outMax || 20);
        const d1Group = cfg.devoir1;
        const d1Assignments = (d1Group.assignmentIds || []).map(id => assigns.find(a => a.id === id)).filter(Boolean);
        const d1Count = d1Assignments.length;
        const d1IsOn20 = d1Count === 1 && getAssignmentMaxPoints(d1Assignments[0]) === outMaxVal;

        const d2Group = cfg.devoir2;
        const d2Assignments = (d2Group.assignmentIds || []).map(id => assigns.find(a => a.id === id)).filter(Boolean);
        const d2Count = d2Assignments.length;
        const d2IsOn20 = d2Count === 1 && getAssignmentMaxPoints(d2Assignments[0]) === outMaxVal;

        const d1MaxShown = getGroupDisplayedMax(className, cfg, 'devoir1');
        const d2MaxShown = getGroupDisplayedMax(className, cfg, 'devoir2');
        const d1Issue = groupHasExportScaleIssue(className, cfg, 'devoir1');
        const d2Issue = groupHasExportScaleIssue(className, cfg, 'devoir2');

        container.innerHTML = `
            <div class="grid grid-cols-1 ${assigns.length === 0 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'} gap-4 mb-6">
                ${renderStatusBadge(allAssigns.find(a => a.type === 'cc'), t.ccLabel || 'CC')}
                ${renderStatusBadge(allAssigns.find(a => a.type === 'tp'), t.tpLabel || 'TP')}
                ${renderStatusBadge(allAssigns.find(a => a.type === 'comp'), t.compLabel || 'Composition')}
                ${assigns.length === 0 ? renderStatusBadge(null, t.devoirLabel || 'Devoir') : ''}
            </div>
            
            ${assigns.length === 0 ? '' : `
            <div class="mt-6 p-4 md:p-6 border-2 border-blue-100/50 rounded-2xl bg-blue-50/30">
                <div class="mb-6 pb-4 border-b border-blue-100">
                    <!-- Bloc 1: Titre (Garanti en haut) -->
                    <div class="flex items-center gap-3 mb-4">
                        <div class="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0 shadow-sm">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        </div>
                        <div class="min-w-0">
                            <h3 class="font-bold text-gray-800 text-lg" data-translate="devoirLabel">${t.devoirLabel || 'Devoir'}</h3>
                            ${assigns.length > 1 ? `<p class="text-xs font-normal text-gray-500 mt-0.5">(${t.average || 'Moyenne'} ${t.devoirShort || 'Dev'} 1 &amp; 2)</p>` : ''}
                        </div>
                    </div>
                    
                    <!-- Bloc 2: Réglage d'échelle (Garanti en bas, Order Swapped for AR) -->
                    <div class="flex items-center justify-between gap-3 bg-white px-4 py-2 rounded-xl shadow-sm border border-blue-100">
                        ${getLang() === 'ar' ? `
                            <div class="flex items-center gap-2">
                                <input type="number" id="export-out-max" name="export-out-max" min="1" step="1" value="${cfg.outMax}" class="w-12 p-1 border-0 bg-transparent font-bold text-blue-700 text-center outline-none focus:ring-0" onchange="setExportOutMax(this.value)">
                                <div class="w-px h-4 bg-slate-200 mx-1"></div>
                            </div>
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight" data-translate="gradeGeneratedOn">${t.gradeGeneratedOn || 'Note générée sur'}</span>
                        ` : `
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight" data-translate="gradeGeneratedOn">${t.gradeGeneratedOn || 'Note générée sur'}</span>
                            <div class="flex items-center gap-2">
                                <div class="w-px h-4 bg-slate-200 mx-1"></div>
                                <input type="number" id="export-out-max" name="export-out-max" min="1" step="1" value="${cfg.outMax}" class="w-12 p-1 border-0 bg-transparent font-bold text-blue-700 text-center outline-none focus:ring-0" onchange="setExportOutMax(this.value)">
                            </div>
                        `}
                    </div>
                </div>

                <div class="grid grid-cols-1 ${assigns.length === 1 ? '' : 'lg:grid-cols-2'} gap-4 md:gap-6">
                    <div class="border-2 rounded-xl p-4 md:p-5 ${d1Issue ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200 shadow-sm'}">
                        <div class="flex items-center gap-2 mb-3">
                            <h4 class="font-bold text-blue-800 text-base" data-translate="devoir1Label">Devoir 1</h4>
                            <span class="text-xs font-bold px-2 py-1 rounded-full shrink-0 ${d1Issue ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800 border border-blue-200'}" dir="ltr">/ ${round2(d1MaxShown || 0)}</span>
                            ${d1Issue ? `<span class="bg-white rounded-full p-1 shadow-sm text-sm shrink-0" title="${t.exportNotOn20 || ''}">⚠️</span>` : ''}
                        </div>
                        <div class="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 mb-3">
                            <div class="${d1Count <= 1 ? 'hidden' : 'contents'}">
                                <select id="export-d1-combine" name="export-d1-combine" class="px-2 py-1.5 border-0 bg-transparent text-sm font-semibold text-slate-700 focus:ring-0 cursor-pointer" onchange="setExportGroupField('devoir1','combine',this.value)">
                                    <option value="sum" ${cfg.devoir1.combine === 'sum' ? 'selected' : ''}>${t.sum}</option>
                                    <option value="avg" ${cfg.devoir1.combine === 'avg' ? 'selected' : ''}>${t.average}</option>
                                    <option value="max" ${cfg.devoir1.combine === 'max' ? 'selected' : ''}>${t.max}</option>
                                </select>
                                <div class="w-px h-5 bg-slate-300"></div>
                            </div>
                            <div class="${d1IsOn20 ? 'hidden' : 'contents'}">
                                <label class="px-2 py-1.5 text-sm flex items-center gap-2 cursor-pointer font-medium text-slate-700 hover:text-blue-600 transition-colors">
                                    <input type="checkbox" id="export-d1-normalize" name="export-d1-normalize" class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" ${cfg.devoir1.normalize ? 'checked' : ''} onchange="setExportGroupField('devoir1','normalize',this.checked)"> 
                                    <span data-translate="normalize">${t.normalize}</span>
                                </label>
                                <div class="flex items-center gap-1.5 px-2 border-s border-slate-300" dir="ltr">
                                    <span class="text-xs font-bold text-slate-400">/</span>
                                    <input type="number" id="export-d1-target" name="export-d1-target" min="1" step="1" value="${cfg.devoir1.targetMax ?? 20}" class="w-12 p-1 border-b-2 border-transparent bg-transparent outline-none text-sm font-bold text-center appearance-none focus:border-blue-500" title="${t.targetMax}" onchange="setExportGroupField('devoir1','targetMax',this.value)">
                                </div>
                            </div>
                            ${ (d1Count <= 1 && d1IsOn20) ? `<div class="px-2.5 py-1 text-xs font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 rounded-lg border border-emerald-100"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg><span data-translate="scaleOk" class="whitespace-nowrap">${t.scaleOk || 'Scale OK'}</span></div>` : '' }
                        </div>
                        ${renderMultiPick('devoir1')}
                    </div>
                
                    ${assigns.length === 1 ? '' : `
                    <div class="border-2 rounded-xl p-4 md:p-5 ${d2Issue ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200 shadow-sm'}">
                        <div class="flex items-center gap-2 mb-3">
                            <h4 class="font-bold text-blue-800 text-base" data-translate="devoir2Label">Devoir 2</h4>
                            <span class="text-xs font-bold px-2 py-1 rounded-full shrink-0 ${d2Issue ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800 border border-blue-200'}" dir="ltr">/ ${round2(d2MaxShown || 0)}</span>
                            ${d2Issue ? `<span class="bg-white rounded-full p-1 shadow-sm text-sm shrink-0" title="${t.exportNotOn20 || ''}">⚠️</span>` : ''}
                        </div>
                        <div class="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 mb-3">
                            <div class="${d2Count <= 1 ? 'hidden' : 'contents'}">
                                <select id="export-d2-combine" name="export-d2-combine" class="px-2 py-1.5 border-0 bg-transparent text-sm font-semibold text-slate-700 focus:ring-0 cursor-pointer" onchange="setExportGroupField('devoir2','combine',this.value)">
                                    <option value="sum" ${cfg.devoir2.combine === 'sum' ? 'selected' : ''}>${t.sum}</option>
                                    <option value="avg" ${cfg.devoir2.combine === 'avg' ? 'selected' : ''}>${t.average}</option>
                                    <option value="max" ${cfg.devoir2.combine === 'max' ? 'selected' : ''}>${t.max}</option>
                                </select>
                                <div class="w-px h-5 bg-slate-300"></div>
                            </div>
                            <div class="${d2IsOn20 ? 'hidden' : 'contents'}">
                                <label class="px-2 py-1.5 text-sm flex items-center gap-2 cursor-pointer font-medium text-slate-700 hover:text-blue-600 transition-colors">
                                    <input type="checkbox" id="export-d2-normalize" name="export-d2-normalize" class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" ${cfg.devoir2.normalize ? 'checked' : ''} onchange="setExportGroupField('devoir2','normalize',this.checked)"> 
                                    <span data-translate="normalize">${t.normalize}</span>
                                </label>
                                <div class="flex items-center gap-1.5 px-2 border-s border-slate-300" dir="ltr">
                                    <span class="text-xs font-bold text-slate-400">/</span>
                                    <input type="number" id="export-d2-target" name="export-d2-target" min="1" step="1" value="${cfg.devoir2.targetMax ?? 20}" class="w-12 p-1 border-b-2 border-transparent bg-transparent outline-none text-sm font-bold text-center appearance-none focus:border-blue-500" title="${t.targetMax}" onchange="setExportGroupField('devoir2','targetMax',this.value)">
                                </div>
                            </div>
                            ${ (d2Count <= 1 && d2IsOn20) ? `<div class="px-2.5 py-1 text-xs font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 rounded-lg border border-emerald-100"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg><span data-translate="scaleOk" class="whitespace-nowrap">${t.scaleOk || 'Scale OK'}</span></div>` : '' }
                        </div>
                        ${renderMultiPick('devoir2')}
                    </div>
                    `}
                </div>
                ${assigns.length > 1 ? '<div class="mt-4 text-xs font-semibold text-blue-600/70"><span class="mr-1">\ud83d\udca1</span> <span class="font-bold uppercase" data-translate="informationLabel">' + (t.informationLabel || 'Information') + ':</span> <span data-translate="devoirRule">' + (t.devoirRule || 'La note Devoir globale est la moyenne du Devoir 1 et Devoir 2. Si l\'un des deux manque, l\'autre note sera utilisée.') + '</span></div>' : ''}
            </div>
            `}
        `;

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
        
        let students = Array.from(studentMap.values()).filter(s => s.status !== 'archived');
        meta.textContent = `${students.length} ${t.students}`;

        await renderExportPreviewTable(className, cfg);
        window.saveCurrentConfigToSupabase();
        window.translatePage();
    };

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
        window.saveExportPrepConfig();
        window.closeRemarksModal();
        window.renderExportPrep();
    };

    window.setExportSingle = function(field, assignmentId) {
        const className = document.getElementById('select-class-export')?.value || '';
        const subject = document.getElementById('select-subject-export')?.value || '';
        const cfg = getExportClassConfig(className, subject);
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
        const subject = document.getElementById('select-subject-export')?.value || '';
        const cfg = getExportClassConfig(className, subject);
        const n = parseInt(val, 10);
        cfg.outMax = Number.isFinite(n) && n > 0 ? n : 20;
        if (!cfg.devoir1.targetMax) cfg.devoir1.targetMax = cfg.outMax;
        if (!cfg.devoir2.targetMax) cfg.devoir2.targetMax = cfg.outMax;
        window.saveExportPrepConfig();
        window.renderExportPrep();
    };

    window.setExportGroupField = function(groupKey, field, value) {
        const className = document.getElementById('select-class-export')?.value || '';
        const subject = document.getElementById('select-subject-export')?.value || '';
        const cfg = getExportClassConfig(className, subject);
        cfg[groupKey][field] = value;
        window.saveExportPrepConfig();
        window.renderExportPrep();
        window.updateExportClassCardColor();
    };

    window.toggleExportGroupAssignment = function(groupKey, assignmentId, checked) {
        const className = document.getElementById('select-class-export')?.value || '';
        const subject = document.getElementById('select-subject-export')?.value || '';
        const cfg = getExportClassConfig(className, subject);
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

        let students = Array.from(studentMap.values()).filter(s => s.status !== 'archived');
        students.sort((a, b) => (a.name || '').localeCompare((b.name || ''), 'fr', { sensitivity: 'base' }));

        const ccA = cfg.ccAssignmentId ? getData().assignments.find(a => a.id === cfg.ccAssignmentId) : null;
        const tpA = cfg.tpAssignmentId ? getData().assignments.find(a => a.id === cfg.tpAssignmentId) : null;
        const compA = cfg.compAssignmentId ? getData().assignments.find(a => a.id === cfg.compAssignmentId) : null;
        const hasTP = !!tpA;

        const hasAnyDevoirIds = (cfg.devoir1.assignmentIds?.length > 0) || (cfg.devoir2.assignmentIds?.length > 0);
        const hasAnyConfig = ccA || tpA || compA || hasAnyDevoirIds;
        
        if (!hasAnyConfig) {
            preview.innerHTML = '';
            document.getElementById('export-preview-section')?.classList.add('hidden');
            return;
        }

        document.getElementById('export-preview-section')?.classList.remove('hidden');

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
        const btnRakamna = document.getElementById('btn-rakamna');
        if (btnRakamna) {
            if (hasAnyMoyenne) btnRakamna.classList.remove('hidden');
            else btnRakamna.classList.add('hidden');
        }
        // (boutons Sauvegarder/Annuler supprimés — calcul à la volée)
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
                <tr class="border-b hover:bg-slate-50 transition-colors" data-student-id="${s.id}">
                    <td class="p-2 sm:p-3 bg-white/90 backdrop-blur-md sticky start-0 z-10 font-bold text-slate-800 border-e border-slate-200 shadow-[1px_0_4px_rgba(0,0,0,0.02)] whitespace-nowrap">${s.name}</td>
                    <td class="p-3 text-center ${ccClass}">${fmt(cc)}</td>
                    <td class="p-3 text-center font-bold ${devoirClass}">${fmt(devoir)}</td>
                    ${hasTP ? `<td class="p-3 text-center ${tpClass}">${fmt(tp)}</td>` : ``}
                    <td class="p-3 text-center ${compClass}">${fmt(comp)}</td>
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

        let colCount = 3 + (hasTP ? 1 : 0) + (hasAnyMoyenne ? 3 : 0);

        preview.innerHTML = `
            <div class="rounded-xl border border-slate-200 overflow-x-auto bg-white shadow-sm">
                <table class="w-full text-xs sm:text-sm border-collapse min-w-max">
                <thead>
                    <tr class="bg-slate-100 border-b border-slate-200"><th colspan="${colCount}" class="p-3 sm:p-4 text-center text-sm sm:text-lg font-bold uppercase tracking-wide text-slate-700">${className}</th></tr>
                    <tr class="border-b-2 border-slate-200 bg-white">
                        <th class="p-2 sm:p-3 text-start bg-slate-50/90 backdrop-blur-md sticky start-0 z-10 font-bold tracking-tight text-slate-800 border-e border-slate-200 shadow-[1px_0_4px_rgba(0,0,0,0.02)] whitespace-nowrap">${t.student}</th>
                        <th class="p-2 sm:p-3 text-center bg-slate-50 whitespace-nowrap text-slate-600 font-semibold" data-translate="ccShort">${t.ccShort || 'CC'}</th>
                        <th class="p-2 sm:p-3 text-center whitespace-nowrap font-bold ${devoirScaleIssue ? 'bg-amber-100 text-amber-900 border-x border-amber-200' : 'bg-blue-50 text-blue-900 border-x border-blue-100'}" title="${devoirScaleIssue ? (t.exportDevoirWarning || '') : (t.exportDevoirOk || '')}"><span data-translate="devoirShort">${t.devoirShort || 'Devoir'}</span><span class="ms-1">${devoirScaleIssue ? '⚠️' : ''}</span></th>
                        ${hasTP ? `<th class="p-2 sm:p-3 text-center bg-slate-50 whitespace-nowrap text-slate-600 font-semibold" data-translate="tpShort">${t.tpShort || 'TP'}</th>` : ``}
                        <th class="p-2 sm:p-3 text-center bg-slate-50 whitespace-nowrap text-slate-600 font-semibold" data-translate="compositionShort">${t.compositionShort || 'Composition'}</th>
                        ${hasAnyMoyenne ? `
                        <th class="p-2 sm:p-3 text-center bg-emerald-50 whitespace-nowrap text-emerald-800 font-bold border-s border-emerald-100" data-translate="avgShort">${t.avgShort || 'Moyenne'}</th>
                        <th class="p-2 sm:p-3 text-center bg-slate-50 whitespace-nowrap border-s border-slate-200" data-translate="observationShort">${t.observationShort || 'Observation'}</th>
                        <th class="p-2 sm:p-3 text-center bg-slate-50 whitespace-nowrap border-s border-slate-200" data-translate="adviceShort">${t.adviceShort || 'Conseil'}</th>
                        ` : ``}
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
                </table>
            </div>
        `;
        
        // --- GESTION DU BOUTON PUBLIER (Près de Rakmana) ---
        const btnPublish = document.getElementById('btn-publish');
        if (btnPublish) {
            if (hasAnyMoyenne) {
                btnPublish.classList.remove('hidden');
                btnPublish.classList.add('flex');
                
                // Style et contenu
                if (cfg.isPublished) {
                    btnPublish.className = "flex items-center justify-center p-2 sm:px-4 sm:py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl font-bold shadow-sm transition active:scale-95";
                    btnPublish.innerHTML = `<svg class="w-4 h-4 sm:me-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> <span class="hidden sm:inline">Retirer la publication</span>`;
                } else {
                    btnPublish.className = "flex items-center justify-center p-2 sm:px-4 sm:py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-sm transition active:scale-95";
                    btnPublish.innerHTML = `<svg class="w-4 h-4 sm:me-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg> <span class="hidden sm:inline">Publier les moyennes</span>`;
                }
            } else {
                btnPublish.classList.add('hidden');
                btnPublish.classList.remove('flex');
            }
        }

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
        const obsCandidates = (typeof window.getObsCandidatesForRow === "function") ? (window.getObsCandidatesForRow(avgNum) || []) : [];
        const consCandidates = (typeof window.getConsCandidatesForRow === "function") ? (window.getConsCandidatesForRow(avgNum) || []) : [];

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
            
            let studentsForClass = Array.from(studentMap.values()).filter(s => s.status !== 'archived');

            studentsForClass.forEach(s => {
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
        
        const parser = new DOMParser();
        const wbDoc = parser.parseFromString(workbookXml || "", "text/xml");
        const relsDoc = parser.parseFromString(workbookRelsXml || "", "text/xml");
        const sheetsNodes = Array.from(wbDoc.getElementsByTagName("sheet"));
        
        for (const sheetNode of sheetsNodes) {
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

    /**
     * Charge la configuration depuis Supabase pour la classe/trimestre actuel
     * Charge la configuration depuis Supabase pour la classe/trimestre actuel
     * Retourne l'objet config ou null si aucune config sauvegardée
     */
    window.loadExportPrepFromSupabase = async function() {
        const className = document.getElementById('select-class-export')?.value;
        if (!className) return null;

        const subject = document.getElementById('select-subject-export')?.value || '';
        const trimester = (window.getGlobalTrimester && window.getGlobalTrimester()) || 'T1';
        const academicYear = (window.getGlobalAcademicYear && window.getGlobalAcademicYear()) || '';
        if (!academicYear) return null;

        try {
            const { data, error } = await supabase.rpc('get_grade_calculation_config', {
                p_class_name: className,
                p_subject: subject,
                p_trimester: trimester,
                p_academic_year: academicYear
            });

            if (error) throw error;
            return data && data.length > 0 ? data[0] : null;
        } catch (err) {
            return null;
        }
    };

    window.toggleExportPublish = function() {
        const className = document.getElementById('select-class-export')?.value;
        const subject = document.getElementById('select-subject-export')?.value || '';
        if (!className) return;

        const cfg = getExportClassConfig(className, subject);
        cfg.isPublished = !cfg.isPublished;
        
        window.saveExportPrepConfig();
        window.renderExportPrep();
        window.saveCurrentConfigToSupabase();
    };

    /**
     * Sauvegarde la configuration actuelle dans Supabase (grade_calculation_configs)
     * pour que l'API élève puisse calculer les moyennes à la volée.
     * Appelée automatiquement après chaque modification de la config.
     */
    window.saveCurrentConfigToSupabase = async function() {
        const className = document.getElementById('select-class-export')?.value;
        if (!className) return;

        const trimester = (window.getGlobalTrimester && window.getGlobalTrimester()) || 'T1';
        const academicYear = (window.getGlobalAcademicYear && window.getGlobalAcademicYear()) || '';
        if (!academicYear) return;

        const subject = document.getElementById('select-subject-export')?.value || '';
        const cfg = getExportClassConfig(className, subject);
        if (!cfg) return;

        // Ne sauvegarder que si au moins CC + Comp + 1 devoir sont configurés
        const hasCC = !!cfg.ccAssignmentId;
        const hasComp = !!cfg.compAssignmentId;
        const hasDevoir = (cfg.devoir1?.assignmentIds?.length > 0) || (cfg.devoir2?.assignmentIds?.length > 0);
        if (!hasCC || !hasComp || !hasDevoir) return;

        try {
            const { error } = await supabase.rpc('save_grade_calculation_config', {
                p_class_name: className,
                p_subject: subject,
                p_trimester: trimester,
                p_academic_year: academicYear,
                p_cc_assignment_id: String(cfg.ccAssignmentId || ''),
                p_comp_assignment_id: String(cfg.compAssignmentId || ''),
                p_tp_assignment_id: String(cfg.tpAssignmentId || ''),
                p_devoir1_config: cfg.devoir1 || { assignmentIds: [], combine: 'sum', normalize: true, targetMax: 20 },
                p_devoir2_config: cfg.devoir2 || { assignmentIds: [], combine: 'sum', normalize: true, targetMax: 20 },
                p_out_max: Number(cfg.outMax || 20),
                p_is_published: !!cfg.isPublished
            });

            if (error) throw error;
        } catch (err) {
            console.warn('⚠️ Impossible de sauvegarder la configuration dans Supabase:', err);
        }
    };

})();