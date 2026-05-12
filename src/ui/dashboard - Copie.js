/**
 * Dashboard Administratif - SimpleNotes
 * Module complet de visualisation et statistiques
 */
import { supabase } from './supabase-client.js';

(function() {
    'use strict';

    const getData = () => window.data;
    const getTranslations = () => window.translations;
    const getLang = () => window.currentLanguage;

    // ============================================================
    // DATA AGGREGATION ENGINE
    // ============================================================

    const DashboardEngine = {
        // Cache for grade_calculation_configs loaded from Supabase
        _gradeConfigsCache: null,
        _gradeConfigsCacheKey: '',

        // Load grade configs from Supabase for current year (all trimesters)
        async loadGradeConfigs() {
            const { year } = this._getFilters();
            const cacheKey = `${year}_all`;
            if (this._gradeConfigsCache && this._gradeConfigsCacheKey === cacheKey) {
                return this._gradeConfigsCache;
            }
            try {
                const { data, error } = await supabase
                    .from('grade_calculation_configs')
                    .select('class_name, subject, trimester, average_all, average_comp, average_cc, average_dev, average_tp, min_all, max_all, min_comp, max_comp, min_dev, max_dev, is_published, cc_assignment_id, comp_assignment_id, tp_assignment_id, devoir1_config, devoir2_config, out_max')
                    .eq('academic_year', year);
                if (error) throw error;
                this._gradeConfigsCache = data || [];
                this._gradeConfigsCacheKey = cacheKey;
            } catch (err) {
                this._gradeConfigsCache = [];
            }
            return this._gradeConfigsCache;
        },

        // Get current filters (year + trimester)
        _getFilters() {
            return {
                year: window.getGlobalAcademicYear ? window.getGlobalAcademicYear() : '',
                trimester: window.getGlobalTrimester ? window.getGlobalTrimester() : ''
            };
        },

        // Check if a student belongs to the current academic year
        _isStudentInYear(s) {
            return !s.academicYear || s.academicYear === this._getFilters().year;
        },

        // Check if an assignment belongs to current year + trimester
        _isAssignmentInPeriod(a) {
            const { year, trimester } = this._getFilters();
            return (!a.academicYear || a.academicYear === year) &&
                   (!a.trimester || a.trimester === trimester || a.trimester === 'T' + trimester);
        },

        // Get student average for specific assignments (normalized to /20)
        _getStudentAverage(data, studentId, assignments) {
            const configs = this._gradeConfigsCache || [];
            const student = (data.students || []).find(s => s.id === studentId);
            if (!student) return null;
            const className = student.className;
            const { trimester } = this._getFilters();
            const triLabel = trimester ? 'T' + trimester : null;

            // Find the config for this student's class and current trimester
            const cfg = configs.find(c => c.class_name === className && c.trimester === trimester);
            if (!cfg) {
                console.log(`[Dashboard] No config for class="${className}" tri="${trimester}" — available:`, configs.map(c => `${c.class_name}/tri=${c.trimester}`));
                return null;
            }

            // Check if config has the required assignment IDs
            const hasCC = !!cfg.cc_assignment_id;
            const hasComp = !!cfg.comp_assignment_id;
            const d1Ids = (cfg.devoir1_config?.assignmentIds || []).filter(Boolean);
            const d2Ids = (cfg.devoir2_config?.assignmentIds || []).filter(Boolean);
            const hasDevoir = d1Ids.length > 0 || d2Ids.length > 0;
            if (!hasCC || !hasComp || !hasDevoir) {
                console.log(`[Dashboard] Incomplete config for class="${className}" — hasCC=${hasCC} hasComp=${hasComp} hasDevoir=${hasDevoir}`);
                return null;
            }

            const outMax = cfg.out_max || 20;
            const allAssignments = data.assignments || [];

            // Helper: compute scaled score for a single assignment
            const calcScaled = (assignmentId) => {
                if (!assignmentId) return null;
                const a = allAssignments.find(x => x.id === assignmentId);
                if (!a) return null;
                if (!window.hasAnyGradeForAssignment || !window.getStudentAssignmentTotal || !window.getAssignmentMaxPoints) return null;
                if (!window.hasAnyGradeForAssignment(studentId, a.id)) return null;
                const total = window.getStudentAssignmentTotal(studentId, a.id);
                const max = window.getAssignmentMaxPoints(a);
                if (!max || max <= 0) return null;
                return (total / max) * outMax;
            };

            // Helper: compute group score (devoir1 or devoir2)
            const computeGroupScore = (groupCfgRaw) => {
                if (!groupCfgRaw) return null;
                const groupCfg = typeof groupCfgRaw === 'string' ? JSON.parse(groupCfgRaw) : groupCfgRaw;
                const ids = (groupCfg.assignmentIds || []).filter(Boolean);
                if (ids.length === 0) return null;
                const assigns = ids
                    .map(id => allAssignments.find(a => a.id === id))
                    .filter(a => a && (a.className || '').trim() === (className || '').trim()
                        && (!a.trimester || a.trimester === trimester || a.trimester === 'T' + trimester));
                if (assigns.length === 0) return null;
                const entries = assigns.map(a => {
                    const has = window.hasAnyGradeForAssignment(studentId, a.id);
                    const max = window.getAssignmentMaxPoints(a);
                    const total = has ? window.getStudentAssignmentTotal(studentId, a.id) : null;
                    return { has, total, max };
                });
                if (!entries.some(e => e.has)) return null;
                const normalize = !!groupCfg.normalize;
                const targetMax = groupCfg.targetMax != null ? Number(groupCfg.targetMax) : outMax;
                if (groupCfg.combine === 'avg') {
                    const valid = entries.filter(e => e.has && e.max > 0);
                    if (valid.length === 0) return null;
                    if (normalize) {
                        const percents = valid.map(e => (e.total / e.max));
                        return (percents.reduce((s, p) => s + p, 0) / percents.length) * targetMax;
                    }
                    return valid.reduce((s, e) => s + (e.total || 0), 0) / valid.length;
                }
                if (groupCfg.combine === 'max') {
                    const valid = entries.filter(e => e.has && e.max > 0);
                    if (valid.length === 0) return null;
                    if (normalize) {
                        const percents = valid.map(e => (e.total / e.max));
                        return Math.max(...percents) * targetMax;
                    }
                    return Math.max(...valid.map(e => e.total || 0));
                }
                // default: sum
                const sumTotal = entries.reduce((s, e) => s + (e.has ? (e.total || 0) : 0), 0);
                const sumMax = entries.reduce((s, e) => s + (e.max > 0 ? e.max : 0), 0);
                if (!normalize) return sumTotal;
                if (!sumMax || sumMax <= 0) return null;
                return (sumTotal / sumMax) * targetMax;
            };

            // Compute each component
            const cc = calcScaled(cfg.cc_assignment_id);
            const comp = calcScaled(cfg.comp_assignment_id);
            const tp = calcScaled(cfg.tp_assignment_id);
            const d1 = computeGroupScore(cfg.devoir1_config);
            const d2 = computeGroupScore(cfg.devoir2_config);
            let devoir = null;
            if (d1 !== null && d2 !== null) devoir = (d1 + d2) / 2;
            else if (d1 !== null) devoir = d1;
            else if (d2 !== null) devoir = d2;

            const hasTP = !!cfg.tp_assignment_id;
            const requiredOk = (devoir !== null && cc !== null && comp !== null && (!hasTP || tp !== null));
            if (!requiredOk) return null;

            // Same formula as export.js
            const avg = hasTP ? (devoir + cc + tp + 2 * comp) / 5 : (devoir + cc + 2 * comp) / 4;
            console.log(`[Dashboard] avg ${student.lastName || ''} (${className}): dev=${devoir?.toFixed(2)} cc=${cc?.toFixed(2)} comp=${comp?.toFixed(2)} tp=${tp?.toFixed(2)} => ${avg.toFixed(2)}`);
            return avg;
        },

        getClasses() {
            const data = getData();
            if (!data || !data.students) return [];
            const { year } = this._getFilters();
            const classes = new Set();
            (data.students || []).forEach(s => {
                if (s.className && s.status !== 'archived' && this._isStudentInYear(s)) classes.add(s.className);
            });
            return [...classes].sort();
        },

        getStudentsByClass(className) {
            const data = getData();
            return (data.students || []).filter(s =>
                s.className === className && s.status !== 'archived' && this._isStudentInYear(s)
            );
        },

        getAssignmentsByClass(className) {
            const data = getData();
            return (data.assignments || []).filter(a => {
                const matchClass = (a.className || '').trim() === (className || '').trim();
                return matchClass && this._isAssignmentInPeriod(a);
            });
        },

        getGradeCompletionRate(className) {
            const students = this.getStudentsByClass(className);
            const assignments = this.getAssignmentsByClass(className);
            // Exclude assignments with maxPoints < 10 (e.g. short quizzes on /3)
            const significantAssignments = assignments.filter(a => {
                const maxPts = window.grades ? window.grades.getAssignmentMaxPoints(a) : 20;
                return maxPts >= 10;
            });
            if (students.length === 0 || significantAssignments.length === 0) return { total: 0, filled: 0, rate: 0 };
            let total = 0, filled = 0;
            const data = getData();
            students.forEach(s => {
                significantAssignments.forEach(a => {
                    total++;
                    if (data.grades && data.grades[s.id] && data.grades[s.id][a.id]) {
                        const g = data.grades[s.id][a.id];
                        if (g.global !== undefined && g.global !== '' && g.global !== null) filled++;
                        else if (window.grades && window.grades.hasAnyGradeForAssignment) {
                            if (window.grades.hasAnyGradeForAssignment(data, s.id, a.id)) filled++;
                        }
                    }
                });
            });
            return { total, filled, rate: total > 0 ? Math.round((filled / total) * 100) : 0 };
        },

        // Class average = weighted average of ALL student averages in that class
        getClassAverage(className) {
            const students = this.getStudentsByClass(className);
            const assignments = this.getAssignmentsByClass(className);
            if (students.length === 0 || assignments.length === 0) return null;
            const data = getData();
            const avgs = [];
            students.forEach(s => {
                const avg = this._getStudentAverage(data, s.id, assignments);
                if (avg !== null) avgs.push(avg);
            });
            if (avgs.length === 0) return null;
            return (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(2);
        },

        // Class averages ranking - uses grade_calculation_configs from Supabase
        getClassAveragesRanking() {
            const { trimester } = this._getFilters();
            const triLabel = trimester ? 'T' + trimester : null;
            const configs = this._gradeConfigsCache || [];
            // Group by class_name: if multiple subjects, take the average of published configs for current trimester
            const classMap = {};
            configs.filter(c => c.average_all !== null && (c.trimester === trimester || c.trimester === triLabel)).forEach(c => {
                if (!classMap[c.class_name]) {
                    classMap[c.class_name] = { sums: {}, counts: {}, min: {}, max: {} };
                }
                const entry = classMap[c.class_name];
                // average_all
                entry.sums.average_all = (entry.sums.average_all || 0) + parseFloat(c.average_all);
                entry.counts.average_all = (entry.counts.average_all || 0) + 1;
                // min/max
                const val = parseFloat(c.average_all);
                entry.min.average_all = entry.min.average_all !== undefined ? Math.min(entry.min.average_all, val) : val;
                entry.max.average_all = entry.max.average_all !== undefined ? Math.max(entry.max.average_all, val) : val;
                // Per-type averages
                ['average_comp', 'average_cc', 'average_dev', 'average_tp'].forEach(field => {
                    if (c[field] !== null) {
                        entry.sums[field] = (entry.sums[field] || 0) + parseFloat(c[field]);
                        entry.counts[field] = (entry.counts[field] || 0) + 1;
                    }
                });
                // Per-type min/max
                ['min_all', 'max_all', 'min_comp', 'max_comp', 'min_dev', 'max_dev'].forEach(field => {
                    if (c[field] !== null) {
                        entry[field] = entry[field] !== undefined && entry[field] !== null
                            ? (field.startsWith('min') ? Math.min(entry[field], parseFloat(c[field])) : Math.max(entry[field], parseFloat(c[field])))
                            : parseFloat(c[field]);
                    }
                });
            });

            const rankings = Object.entries(classMap).map(([name, entry]) => {
                const avgAll = entry.counts.average_all > 0 ? entry.sums.average_all / entry.counts.average_all : null;
                return {
                    name,
                    average: avgAll !== null ? parseFloat(avgAll.toFixed(2)) : null,
                    average_comp: entry.counts.average_comp > 0 ? parseFloat((entry.sums.average_comp / entry.counts.average_comp).toFixed(2)) : null,
                    average_cc: entry.counts.average_cc > 0 ? parseFloat((entry.sums.average_cc / entry.counts.average_cc).toFixed(2)) : null,
                    average_dev: entry.counts.average_dev > 0 ? parseFloat((entry.sums.average_dev / entry.counts.average_dev).toFixed(2)) : null,
                    average_tp: entry.counts.average_tp > 0 ? parseFloat((entry.sums.average_tp / entry.counts.average_tp).toFixed(2)) : null,
                    min_all: entry.min.average_all ?? null,
                    max_all: entry.max.average_all ?? null,
                    min_comp: entry.min_comp ?? null,
                    max_comp: entry.max_comp ?? null,
                    min_dev: entry.min_dev ?? null,
                    max_dev: entry.max_dev ?? null
                };
            }).filter(r => r.average !== null).sort((a, b) => b.average - a.average);

            return {
                rankings,
                best: rankings.length > 0 ? rankings[0] : null,
                worst: rankings.length > 0 ? rankings[rankings.length - 1] : null,
                count: rankings.length
            };
        },

        // Assignment type distribution - includes all types (devoir, comp, tp, cc)
        getAssignmentTypeDistribution() {
            const data = getData();
            const dist = { devoir: 0, tp: 0, comp: 0, cc: 0 };
            (data.assignments || []).forEach(a => {
                if (this._isAssignmentInPeriod(a)) {
                    const type = a.type || 'devoir';
                    if (dist[type] !== undefined) dist[type]++;
                }
            });
            return dist;
        },

        // Trimester progression: compare T1, T2, T3 per class using grade_calculation_configs
        // type: 'all' (default), 'dev', 'comp', 'cc'
        getTrimesterProgression(type = 'all') {
            const configs = this._gradeConfigsCache || [];
            const avgField = type === 'dev' ? 'average_dev' : type === 'comp' ? 'average_comp' : type === 'cc' ? 'average_cc' : 'average_all';
            const classProgression = {};
            // Get all class names from configs that have data for this type
            const classNames = [...new Set(configs.filter(c => c[avgField] !== null).map(c => c.class_name))];
            classNames.forEach(cls => {
                classProgression[cls] = {};
                ['1', '2', '3'].forEach(tri => {
                    const triLabel = 'T' + tri;
                    const triConfigs = configs.filter(c =>
                        c.class_name === cls &&
                        c[avgField] !== null &&
                        (c.trimester === tri || c.trimester === triLabel)
                    );
                    if (triConfigs.length > 0) {
                        const avg = triConfigs.reduce((s, c) => s + parseFloat(c[avgField]), 0) / triConfigs.length;
                        classProgression[cls][tri] = parseFloat(avg.toFixed(2));
                    } else {
                        classProgression[cls][tri] = null;
                    }
                });
            });
            // Determine which trimesters have any data across all classes
            const activeTrimesters = ['1', '2', '3'].filter(tri =>
                Object.values(classProgression).some(cls => cls[tri] !== null)
            );
            return { data: classProgression, activeTrimesters };
        },

        getAnomalies() {
            const anomalies = [];
            const data = getData();
            const classes = this.getClasses();

            classes.forEach(cls => {
                const students = this.getStudentsByClass(cls);
                const assignments = this.getAssignmentsByClass(cls);
                const completion = this.getGradeCompletionRate(cls);

                // A1: Notes manquantes significatives
                if (completion.total > 0 && completion.rate < 50 && assignments.length > 0) {
                    anomalies.push({
                        type: 'critical',
                        icon: 'exclamation-triangle',
                        title: 'Notes manquantes',
                        message: `${cls}: seulement ${completion.rate}% de complétion (${completion.filled}/${completion.total})`,
                        className: cls
                    });
                }

                // A3: Devoirs sans aucune note
                assignments.forEach(a => {
                    let hasAnyGrade = false;
                    students.forEach(s => {
                        if (data.grades && data.grades[s.id] && data.grades[s.id][a.id]) {
                            if (window.grades && window.grades.hasAnyGradeForAssignment) {
                                if (window.grades.hasAnyGradeForAssignment(data, s.id, a.id)) hasAnyGrade = true;
                            }
                        }
                    });
                    if (!hasAnyGrade) {
                        anomalies.push({
                            type: 'warning',
                            icon: 'clipboard',
                            title: 'Devoir sans notes',
                            message: `"${a.name}" dans ${cls} n'a aucune note saisie`,
                            className: cls
                        });
                    }
                });

                // A2: Bareme incoherent
                assignments.forEach(a => {
                    const maxPts = window.grades ? window.grades.getAssignmentMaxPoints(a) : 0;
                    if (maxPts > 0 && maxPts !== 20 && a.type !== 'devoir') {
                        anomalies.push({
                            type: 'info',
                            icon: 'scale',
                            title: 'Barème non standard',
                            message: `"${a.name}" (${cls}): barème sur ${maxPts} au lieu de 20`,
                            className: cls
                        });
                    }
                });
            });

            // A4: Config checks based on Supabase grade_calculation_configs
            const configs = this._gradeConfigsCache || [];
            const { trimester } = this._getFilters();
            const triLabel = trimester ? 'T' + trimester : null;
            const classConfigs = configs.filter(c => c.trimester === trimester || c.trimester === triLabel);
            const classConfigMap = {};
            classConfigs.forEach(c => {
                if (!classConfigMap[c.class_name]) classConfigMap[c.class_name] = [];
                classConfigMap[c.class_name].push(c);
            });
            Object.entries(classConfigMap).forEach(([className, cfgs]) => {
                const hasNullAverage = cfgs.some(c => c.average_all === null);
                const allPublished = cfgs.every(c => c.is_published);
                if (hasNullAverage) {
                    anomalies.push({
                        type: 'warning',
                        icon: 'calculator',
                        title: 'Calcul moyenne pas prêt',
                        message: `${className}: moyenne non calculée`,
                        className
                    });
                } else if (!allPublished) {
                    anomalies.push({
                        type: 'info',
                        icon: 'eye-off',
                        title: 'Non publiée',
                        message: `${className}: notes non publiées`,
                        className
                    });
                }
            });

            return anomalies;
        },

        // Gender stats filtered by current year
        getGenderStats() {
            const data = getData();
            const stats = { total: 0, boys: 0, girls: 0, unknown: 0 };
            (data.students || []).filter(s => s.status !== 'archived' && this._isStudentInYear(s)).forEach(s => {
                stats.total++;
                const sex = (s.sex || '').toLowerCase().trim();
                if (sex === 'm' || sex === 'male' || sex === 'gar\u00e7on' || sex === 'homme' || sex === 'boy' || sex.includes('\u0630\u0643\u0631')) stats.boys++;
                else if (sex === 'f' || sex === 'female' || sex === 'fille' || sex === 'femme' || sex === 'girl' || sex.includes('\u0623\u0646\u062b\u0649') || sex.includes('\u0627\u0646\u062b\u0649')) stats.girls++;
                else stats.unknown++;
            });
            return stats;
        },

        getClassDetailedStats() {
            const classes = this.getClasses();
            const configs = this._gradeConfigsCache || [];
            return classes.map(cls => {
                const students = this.getStudentsByClass(cls);
                const assignments = this.getAssignmentsByClass(cls);
                const completion = this.getGradeCompletionRate(cls);
                // Get average from grade_calculation_configs (published only, current trimester)
                const { trimester } = this._getFilters();
                const triLabel = trimester ? 'T' + trimester : null;
                const classConfigs = configs.filter(c => c.class_name === cls && c.average_all !== null && (c.trimester === trimester || c.trimester === triLabel));
                const allClassConfigs = configs.filter(c => c.class_name === cls && (c.trimester === trimester || c.trimester === triLabel));
                const avg = classConfigs.length > 0
                    ? parseFloat((classConfigs.reduce((s, c) => s + parseFloat(c.average_all), 0) / classConfigs.length).toFixed(2))
                    : null;
                const minAll = classConfigs.length > 0 ? Math.min(...classConfigs.map(c => parseFloat(c.min_all)).filter(v => !isNaN(v))) : null;
                const maxAll = classConfigs.length > 0 ? Math.max(...classConfigs.map(c => parseFloat(c.max_all)).filter(v => !isNaN(v))) : null;
                const isPublished = allClassConfigs.length > 0 ? allClassConfigs.every(c => c.is_published) : null;
                const boys = students.filter(s => { const sex = (s.sex || '').toLowerCase().trim(); return sex === 'm' || sex === 'male' || sex === 'gar\u00e7on' || sex === 'homme' || sex === 'boy' || sex.includes('\u0630\u0643\u0631'); }).length;
                const girls = students.filter(s => { const sex = (s.sex || '').toLowerCase().trim(); return sex === 'f' || sex === 'female' || sex === 'fille' || sex === 'femme' || sex === 'girl' || sex.includes('\u0623\u0646\u062b\u0649') || sex.includes('\u0627\u0646\u062b\u0649'); }).length;
                const typeDist = {};
                assignments.forEach(a => {
                    const type = a.type || 'devoir';
                    typeDist[type] = (typeDist[type] || 0) + 1;
                });
                return {
                    name: cls,
                    studentCount: students.length,
                    boys,
                    girls,
                    assignmentCount: assignments.length,
                    typeDist,
                    completionRate: completion.rate,
                    completionFilled: completion.filled,
                    completionTotal: completion.total,
                    average: avg,
                    minAll: minAll !== null && isFinite(minAll) ? minAll : null,
                    maxAll: maxAll !== null && isFinite(maxAll) ? maxAll : null,
                    isPublished: isPublished
                };
            }).sort((a, b) => (b.average || 0) - (a.average || 0));
        },

        // Get a single component score for a student (devoir, cc, comp, tp) or full average
        _getStudentScoreByType(data, studentId, gradeType) {
            const configs = this._gradeConfigsCache || [];
            const student = (data.students || []).find(s => s.id === studentId);
            if (!student) return null;
            const className = student.className;
            const { trimester } = this._getFilters();

            const cfg = configs.find(c => c.class_name === className && c.trimester === trimester);
            if (!cfg) return null;

            const outMax = cfg.out_max || 20;
            const allAssignments = data.assignments || [];

            const calcScaled = (assignmentId) => {
                if (!assignmentId) return null;
                const a = allAssignments.find(x => x.id === assignmentId);
                if (!a) return null;
                if (!window.hasAnyGradeForAssignment || !window.getStudentAssignmentTotal || !window.getAssignmentMaxPoints) return null;
                if (!window.hasAnyGradeForAssignment(studentId, a.id)) return null;
                const total = window.getStudentAssignmentTotal(studentId, a.id);
                const max = window.getAssignmentMaxPoints(a);
                if (!max || max <= 0) return null;
                return (total / max) * outMax;
            };

            const computeGroupScore = (groupCfgRaw) => {
                if (!groupCfgRaw) return null;
                const groupCfg = typeof groupCfgRaw === 'string' ? JSON.parse(groupCfgRaw) : groupCfgRaw;
                const ids = (groupCfg.assignmentIds || []).filter(Boolean);
                if (ids.length === 0) return null;
                const assigns = ids
                    .map(id => allAssignments.find(a => a.id === id))
                    .filter(a => a && (a.className || '').trim() === (className || '').trim()
                        && (!a.trimester || a.trimester === trimester || a.trimester === 'T' + trimester));
                if (assigns.length === 0) return null;
                const entries = assigns.map(a => {
                    const has = window.hasAnyGradeForAssignment(studentId, a.id);
                    const max = window.getAssignmentMaxPoints(a);
                    const total = has ? window.getStudentAssignmentTotal(studentId, a.id) : null;
                    return { has, total, max };
                });
                if (!entries.some(e => e.has)) return null;
                const normalize = !!groupCfg.normalize;
                const targetMax = groupCfg.targetMax != null ? Number(groupCfg.targetMax) : outMax;
                if (groupCfg.combine === 'avg') {
                    const valid = entries.filter(e => e.has && e.max > 0);
                    if (valid.length === 0) return null;
                    if (normalize) {
                        const percents = valid.map(e => (e.total / e.max));
                        return (percents.reduce((s, p) => s + p, 0) / percents.length) * targetMax;
                    }
                    return valid.reduce((s, e) => s + (e.total || 0), 0) / valid.length;
                }
                if (groupCfg.combine === 'max') {
                    const valid = entries.filter(e => e.has && e.max > 0);
                    if (valid.length === 0) return null;
                    if (normalize) {
                        const percents = valid.map(e => (e.total / e.max));
                        return Math.max(...percents) * targetMax;
                    }
                    return Math.max(...valid.map(e => e.total || 0));
                }
                const sumTotal = entries.reduce((s, e) => s + (e.has ? (e.total || 0) : 0), 0);
                const sumMax = entries.reduce((s, e) => s + (e.max > 0 ? e.max : 0), 0);
                if (!normalize) return sumTotal;
                if (!sumMax || sumMax <= 0) return null;
                return (sumTotal / sumMax) * targetMax;
            };

            // Compute each component
            const cc = calcScaled(cfg.cc_assignment_id);
            const comp = calcScaled(cfg.comp_assignment_id);
            const tp = calcScaled(cfg.tp_assignment_id);
            const d1 = computeGroupScore(cfg.devoir1_config);
            const d2 = computeGroupScore(cfg.devoir2_config);
            let devoir = null;
            if (d1 !== null && d2 !== null) devoir = (d1 + d2) / 2;
            else if (d1 !== null) devoir = d1;
            else if (d2 !== null) devoir = d2;

            // Return only the requested component
            if (gradeType === 'devoir') return devoir;
            if (gradeType === 'cc') return cc;
            if (gradeType === 'comp') return comp;
            if (gradeType === 'tp') return tp;

            // Default: full average (moyenne générale)
            const hasTP = !!cfg.tp_assignment_id;
            const requiredOk = (devoir !== null && cc !== null && comp !== null && (!hasTP || tp !== null));
            if (!requiredOk) return null;
            return hasTP ? (devoir + cc + tp + 2 * comp) / 5 : (devoir + cc + 2 * comp) / 4;
        },

        // Top students for current trimester
        getTopStudents(limit = 5, filterClass = '', filterLevel = '', gradeType = '') {
            const data = getData();
            const studentAvgs = [];

            (data.students || []).filter(s => s.status !== 'archived' && this._isStudentInYear(s)).forEach(s => {
                // Filter by class
                if (filterClass && s.className !== filterClass) return;
                // Filter by level
                if (filterLevel) {
                    const lvl = window.levelFromClass ? window.levelFromClass(s.className) : '?';
                    if (String(lvl) !== filterLevel) return;
                }
                const avg = this._getStudentScoreByType(data, s.id, gradeType);
                if (avg !== null) {
                    studentAvgs.push({
                        name: `${s.lastName || ''} ${s.firstName || ''}`.trim() || s.name || s.id,
                        className: s.className,
                        average: avg
                    });
                }
            });

            return studentAvgs.sort((a, b) => b.average - a.average).slice(0, limit);
        },

        // Get unique levels from current classes
        getLevels() {
            const levels = new Map();
            this.getClasses().forEach(cls => {
                const lvl = window.levelFromClass ? window.levelFromClass(cls) : '?';
                if (lvl !== '?') {
                    const labels = {1: 'أولى', 2: 'ثانية', 3: 'ثالثة', 4: 'رابعة', 5: 'خامسة', 6: 'سادسة'};
                    levels.set(String(lvl), labels[lvl] || `Niveau ${lvl}`);
                }
            });
            return [...levels.entries()].sort((a, b) => a[0] - b[0]);
        },

        // Check which grade types have configs (to show/hide TP button)
        getAvailableGradeTypes() {
            const configs = this._gradeConfigsCache || [];
            const { trimester } = this._getFilters();
            const types = new Set();
            configs.forEach(c => {
                if (c.trimester !== trimester) return;
                const d1Ids = (c.devoir1_config?.assignmentIds || []).filter(Boolean);
                const d2Ids = (c.devoir2_config?.assignmentIds || []).filter(Boolean);
                if (d1Ids.length > 0 || d2Ids.length > 0) types.add('devoir');
                if (c.cc_assignment_id) types.add('cc');
                if (c.comp_assignment_id) types.add('comp');
                if (c.tp_assignment_id) types.add('tp');
            });
            return types;
        },

        // Grade distribution for current trimester
        getGradeDistribution() {
            const data = getData();
            const ranges = [
                { label: '0-5', min: 0, max: 5, count: 0, color: '#ef4444' },
                { label: '5-8', min: 5, max: 8, count: 0, color: '#f97316' },
                { label: '8-10', min: 8, max: 10, count: 0, color: '#eab308' },
                { label: '10-12', min: 10, max: 12, count: 0, color: '#84cc16' },
                { label: '12-15', min: 12, max: 15, count: 0, color: '#22c55e' },
                { label: '15-20', min: 15, max: 20, count: 0, color: '#0ea5e9' }
            ];

            (data.students || []).filter(s => s.status !== 'archived' && this._isStudentInYear(s)).forEach(s => {
                const assignments = (data.assignments || []).filter(a =>
                    (a.className || '').trim() === (s.className || '').trim() &&
                    this._isAssignmentInPeriod(a)
                );
                const avg = this._getStudentAverage(data, s.id, assignments);
                if (avg !== null) {
                    for (const r of ranges) {
                        if (avg >= r.min && avg < r.max) { r.count++; break; }
                    }
                    if (avg >= 20) ranges[ranges.length - 1].count++;
                }
            });
            return ranges;
        }
    };

    // ============================================================
    // SVG CHART RENDERERS
    // ============================================================

    const Charts = {
        bar(values, labels, colors, width = 400, height = 200) {
            if (!values || values.length === 0) return '<p class="text-slate-400 text-sm text-center py-8">Aucune donn\u00e9e disponible</p>';
            const maxVal = Math.max(...values, 1);
            const barWidth = Math.max(20, Math.min(60, (width - 40) / values.length - 8));
            const chartHeight = height - 50;
            const gap = (width - 40 - barWidth * values.length) / (values.length + 1);

            let bars = '';
            values.forEach((v, i) => {
                const barH = Math.max(2, (v / maxVal) * chartHeight);
                const x = 20 + gap + i * (barWidth + gap);
                const y = chartHeight - barH + 10;
                const color = colors ? colors[i % colors.length] : '#3b82f6';
                bars += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4" fill="${color}" opacity="0.85" class="dash-bar-rect"/>`;
                bars += `<text x="${x + barWidth/2}" y="${y - 6}" text-anchor="middle" font-size="11" font-weight="700" fill="${color}">${v}</text>`;
                if (labels && labels[i]) {
                    bars += `<text x="${x + barWidth/2}" y="${height - 8}" text-anchor="middle" font-size="10" fill="#64748b" font-weight="500">${labels[i]}</text>`;
                }
            });

            // Grid lines
            let grid = '';
            for (let i = 0; i <= 4; i++) {
                const y = 10 + (chartHeight / 4) * i;
                const val = (maxVal - (maxVal / 4) * i).toFixed(0);
                grid += `<line x1="18" y1="${y}" x2="${width - 20}" y2="${y}" stroke="#e2e8f0" stroke-width="0.5" stroke-dasharray="4"/>`;
                grid += `<text x="14" y="${y + 4}" text-anchor="end" font-size="9" fill="#94a3b8">${val}</text>`;
            }

            return `<svg viewBox="0 0 ${width} ${height}" class="w-full" style="max-height:${height}px">${grid}${bars}</svg>`;
        },

        horizontalBar(values, labels, colors, width = 400, height = 200) {
            if (!values || values.length === 0) return '<p class="text-slate-400 text-sm text-center py-8">Aucune donn\u00e9e</p>';
            const maxVal = Math.max(...values, 1);
            const barHeight = Math.max(16, Math.min(32, (height - 20) / values.length - 6));
            const chartWidth = width - 120;

            let bars = '';
            values.forEach((v, i) => {
                const barW = Math.max(2, (v / maxVal) * chartWidth);
                const y = 10 + i * (barHeight + 6);
                const color = colors ? colors[i % colors.length] : '#3b82f6';
                bars += `<text x="0" y="${y + barHeight/2 + 4}" font-size="11" fill="#475569" font-weight="600">${labels ? labels[i] : ''}</text>`;
                bars += `<rect x="80" y="${y}" width="${barW}" height="${barHeight}" rx="4" fill="${color}" opacity="0.85" class="dash-bar-rect"/>`;
                bars += `<text x="${80 + barW + 6}" y="${y + barHeight/2 + 4}" font-size="11" fill="${color}" font-weight="700">${v}</text>`;
            });

            return `<svg viewBox="0 0 ${width} ${height}" class="w-full" style="max-height:${height}px">${bars}</svg>`;
        },

        donut(segments, width = 200, height = 200) {
            if (!segments || segments.length === 0) return '<p class="text-slate-400 text-sm text-center py-8">Aucune donn\u00e9e</p>';
            const total = segments.reduce((s, seg) => s + seg.value, 0);
            if (total === 0) return '<p class="text-slate-400 text-sm text-center py-8">Aucune donn\u00e9e</p>';
            const cx = width / 2, cy = height / 2, r = Math.min(width, height) / 2 - 15;
            const innerR = r * 0.6;
            const midR = (r + innerR) / 2;
            const circ = 2 * Math.PI * midR;
            const strokeW = r - innerR;

            let circles = '';
            let cumulativeAngle = -Math.PI / 2;
            segments.forEach((seg, i) => {
                const segAngle = (seg.value / total) * Math.PI * 2;
                const segLen = (seg.value / total) * circ;
                const targetOffset = circ - segLen;
                const deg = (cumulativeAngle * 180) / Math.PI;

                circles += `<circle cx="${cx}" cy="${cy}" r="${midR}" fill="none" stroke="${seg.color}" stroke-width="${strokeW}"
                    stroke-dasharray="${circ}" stroke-dashoffset="${circ}"
                    transform="rotate(${deg} ${cx} ${cy})"
                    class="dash-donut-segment"
                    data-target-offset="${targetOffset}"
                    data-circ="${circ}"/>`;

                cumulativeAngle += segAngle;
            });

            const centerText = `<text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="22" font-weight="800" fill="#1e293b">${total}</text>
                <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="10" fill="#94a3b8" font-weight="500">total</text>`;

            return `<svg viewBox="0 0 ${width} ${height}" class="w-full" style="max-height:${height}px">${circles}${centerText}</svg>`;
        },

        line(seriesOrPoints, width = 400, height = 180) {
            if (!seriesOrPoints || seriesOrPoints.length === 0) return '<p class="text-slate-400 text-sm text-center py-8">Aucune donn\u00e9e</p>';
            // Old format: [{label, value}] - single line
            const isOldFormat = seriesOrPoints[0] && seriesOrPoints[0].value !== undefined;
            if (isOldFormat) {
                return this._renderSingleLine(seriesOrPoints, width, height, '#6366f1');
            }
            // New format: [{name, color, data: [{label, value}]}]
            const series = seriesOrPoints;
            const allValues = series.flatMap(s => s.data.map(p => p.value)).filter(v => v !== null);
            if (allValues.length === 0) return '<p class="text-slate-400 text-sm text-center py-8">Aucune donn\u00e9e</p>';
            const maxVal = Math.max(...allValues, 20);
            const minVal = 0;
            const chartH = height - 40;
            const chartW = width - 80;
            const labels = series[0]?.data?.map(p => p.label) || ['T1', 'T2', 'T3'];
            const step = chartW / (labels.length - 1 || 1);

            let grid = '';
            for (let i = 0; i <= 4; i++) {
                const y = 10 + (chartH / 4) * i;
                const val = (maxVal - (maxVal / 4) * i).toFixed(1);
                grid += '<line x1="40" y1="' + y + '" x2="' + (width - 40) + '" y2="' + y + '" stroke="#e2e8f0" stroke-width="0.5" stroke-dasharray="4"/>';
                grid += '<text x="36" y="' + (y + 4) + '" text-anchor="end" font-size="9" fill="#94a3b8">' + val + '</text>';
            }

            // Find best and worst class by last non-null value
            let bestSeries = null, worstSeries = null, bestVal = -Infinity, worstVal = Infinity;
            series.forEach(s => {
                const lastVal = [...s.data].reverse().find(p => p.value !== null);
                if (lastVal && lastVal.value > bestVal) { bestVal = lastVal.value; bestSeries = s; }
                if (lastVal && lastVal.value < worstVal) { worstVal = lastVal.value; worstSeries = s; }
            });

            let linesSvg = '';
            let endLabelsSvg = '';
            const rightX = 40 + (labels.length - 1) * step;

            series.forEach((s, si) => {
                if (!s.data || s.data.length === 0) return;
                const color = s.color || '#6366f1';
                const isBest = s === bestSeries;
                const isWorst = s === worstSeries;
                let pts = '', linePath = '';
                let lastX = 0, lastY = 0, lastVal2 = null;
                s.data.forEach((p, i) => {
                    if (p.value === null) return;
                    const x = 40 + i * step;
                    const y = 10 + ((maxVal - p.value) / (maxVal - minVal)) * chartH;
                    pts += '<circle cx="' + x + '" cy="' + y + '" r="3.5" fill="' + color + '" stroke="white" stroke-width="1.5" class="prog-dot prog-dot-' + si + '" style="transition:opacity 0.2s"/>';
                    lastX = x; lastY = y; lastVal2 = p.value;
                    if (!linePath) linePath = 'M' + x + ',' + y;
                    else linePath += ' L' + x + ',' + y;
                });
                if (linePath) {
                    linesSvg += '<path d="' + linePath + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="dash-line-path prog-line prog-line-' + si + '" style="opacity:0.7;transition:opacity 0.2s,stroke-width 0.2s"/>';
                }
                linesSvg += pts;
                // End label: only for best and worst (just the value, no class name)
                if (lastVal2 !== null && (isBest || isWorst)) {
                    const labelY = isBest ? Math.min(lastY - 2, lastY - 6) : Math.max(lastY + 12, lastY + 10);
                    endLabelsSvg += '<text x="' + (rightX + 6) + '" y="' + labelY + '" text-anchor="start" font-size="9" font-weight="700" fill="' + color + '" class="prog-endlabel prog-endlabel-' + si + '">' + lastVal2.toFixed(1) + '</text>';
                }
            });

            let labelsSvg = '';
            labels.forEach((label, i) => {
                const x = 40 + i * step;
                labelsSvg += '<text x="' + x + '" y="' + (height - 5) + '" text-anchor="middle" font-size="10" fill="#64748b" font-weight="500">' + label + '</text>';
            });

            // Value labels (hidden by default, shown on hover)
            let valLabelsSvg = '';
            // Invisible hover areas for each series
            let hoverSvg = '';
            series.forEach((s, si) => {
                if (!s.data || s.data.length === 0) return;
                const color = s.color || '#6366f1';
                let hoverPath = '';
                s.data.forEach((p, i) => {
                    if (p.value === null) return;
                    const x = 40 + i * step;
                    const y = 10 + ((maxVal - p.value) / (maxVal - minVal)) * chartH;
                    if (!hoverPath) hoverPath = 'M' + x + ',' + y;
                    else hoverPath += ' L' + x + ',' + y;
                    valLabelsSvg += '<text x="' + x + '" y="' + (y - 8) + '" text-anchor="middle" font-size="9" font-weight="700" fill="' + color + '" class="prog-vlabel prog-vlabel-' + si + '" style="opacity:0;transition:opacity 0.15s;pointer-events:none">' + p.value.toFixed(1) + '</text>';
                });
                if (hoverPath) {
                    hoverSvg += '<path d="' + hoverPath + '" fill="none" stroke="transparent" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" style="cursor:pointer" onmouseenter="window._progHover(this,' + si + ',true)" onmouseleave="window._progHover(this,' + si + ',false)"/>';
                }
            });

            return '<svg viewBox="0 0 ' + width + ' ' + height + '" class="w-full" style="max-height:' + height + 'px">' + grid + linesSvg + endLabelsSvg + valLabelsSvg + labelsSvg + hoverSvg + '</svg>';
        },

        _renderSingleLine(dataPoints, width, height, color) {
            const values = dataPoints.map(p => p.value).filter(v => v !== null);
            if (values.length === 0) return '<p class="text-slate-400 text-sm text-center py-8">Aucune donn\u00e9e</p>';
            const maxVal = Math.max(...values, 20);
            const minVal = 0;
            const chartH = height - 40;
            const chartW = width - 60;
            const step = chartW / (dataPoints.length - 1 || 1);
            let grid = '';
            for (let i = 0; i <= 4; i++) {
                const y = 10 + (chartH / 4) * i;
                const val = (maxVal - (maxVal / 4) * i).toFixed(1);
                grid += `<line x1="40" y1="${y}" x2="${width - 10}" y2="${y}" stroke="#e2e8f0" stroke-width="0.5" stroke-dasharray="4"/>`;
                grid += `<text x="36" y="${y + 4}" text-anchor="end" font-size="9" fill="#94a3b8">${val}</text>`;
            }
            let points = '', linePath = '', areaPath = '';
            dataPoints.forEach((p, i) => {
                if (p.value === null) return;
                const x = 40 + i * step;
                const y = 10 + ((maxVal - p.value) / (maxVal - minVal)) * chartH;
                points += `<circle cx="${x}" cy="${y}" r="5" fill="${color}" stroke="white" stroke-width="2.5"/>`;
                points += `<text x="${x}" y="${y - 10}" text-anchor="middle" font-size="10" font-weight="700" fill="${color}">${p.value}</text>`;
                if (!linePath) { linePath = `M${x},${y}`; areaPath = `M${x},${10 + chartH} L${x},${y}`; }
                else { linePath += ` L${x},${y}`; areaPath += ` L${x},${y}`; }
            });
            areaPath += ` L${40 + (dataPoints.length - 1) * step},${10 + chartH} Z`;
            let labels = '';
            dataPoints.forEach((p, i) => {
                const x = 40 + i * step;
                labels += `<text x="${x}" y="${height - 5}" text-anchor="middle" font-size="10" fill="#64748b" font-weight="500">${p.label}</text>`;
            });
            return `<svg viewBox="0 0 ${width} ${height}" class="w-full" style="max-height:${height}px">${grid}<path d="${areaPath}" fill="url(#areaGrad)" opacity="0.15"/><defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${linePath}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="dash-line-path"/>${points}${labels}</svg>`;
        },

        progressRing(pct, size = 80, strokeWidth = 8, color = '#22c55e') {
            const r = (size - strokeWidth) / 2;
            const circ = 2 * Math.PI * r;
            const offset = circ - (pct / 100) * circ;
            return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
                <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="${strokeWidth}"/>
                <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="${strokeWidth}"
                    stroke-dasharray="${circ}" stroke-dashoffset="${circ}" stroke-linecap="round"
                    transform="rotate(-90 ${size/2} ${size/2})"
                    class="dash-animated-ring"
                    data-target-offset="${offset}"
                    data-full-offset="${circ}"/>
                <text x="${size/2}" y="${size/2 - 4}" text-anchor="middle" font-size="${size * 0.22}" font-weight="800" fill="#1e293b" class="dash-counter" data-target="${pct}" data-suffix="%"></text>
                <text x="${size/2}" y="${size/2 + 10}" text-anchor="middle" font-size="${size * 0.1}" fill="#94a3b8">compl\u00e9t\u00e9</text>
            </svg>`;
        }
    };

    // ============================================================
    // ICON HELPERS
    // ============================================================

    const Icons = {
        users: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>',
        clipboard: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>',
        check: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
        chart: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>',
        alert: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
        trophy: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>',
        trend: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>',
        gender: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>'
    };

    // ============================================================
    // ANIMATION ENGINE
    // ============================================================

    // Inject CSS keyframes for dashboard animations
    (function injectDashboardAnimationsCSS() {
        const style = document.createElement('style');
        style.id = 'dashboard-animations-css';
        if (document.getElementById('dashboard-animations-css')) return;
        style.textContent = `
            @keyframes dashSlideUp {
                from { opacity: 0; transform: translateY(24px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes dashFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes dashScaleIn {
                from { opacity: 0; transform: scale(0.85); }
                to { opacity: 1; transform: scale(1); }
            }
            @keyframes dashDrawLine {
                to { stroke-dashoffset: 0; }
            }
            @keyframes dashDonutSpin {
                from { opacity: 0; transform: rotate(-90deg); }
                to { opacity: 1; transform: rotate(0deg); }
            }
            @keyframes dashPulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
            }
            @keyframes dashLoaderDot {
                0%, 100% { transform: scale(1); opacity: 0.4; }
                50% { transform: scale(1.4); opacity: 1; }
            }
            @keyframes dashShimmer {
                0% { background-position: -200% center; }
                100% { background-position: 200% center; }
            }
            @keyframes dashGlow {
                0%, 100% { filter: drop-shadow(0 0 4px rgba(99,102,241,0.3)); }
                50% { filter: drop-shadow(0 0 12px rgba(99,102,241,0.5)); }
            }
            @keyframes dashProgressFill {
                from { width: 0 !important; }
            }
            .dash-kpi-card {
                opacity: 0;
                animation: dashSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            .dash-kpi-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(0,0,0,0.08);
            }
            .dash-section {
                opacity: 0;
                animation: dashSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .dash-section:hover {
                transform: translateY(-1px);
                box-shadow: 0 6px 20px rgba(0,0,0,0.06);
            }
            .dash-counter-value {
                display: inline-block;
                font-variant-numeric: tabular-nums;
            }
            .dash-animated-ring {
                transition: stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .dash-animated-ring:hover {
                animation: dashGlow 1.5s ease-in-out infinite;
            }
            .dash-donut-segment {
                opacity: 0;
                transition: opacity 0.3s, transform 0.3s;
            }
            .dash-donut-segment.animated {
                opacity: 1;
            }
            .dash-donut-segment:hover {
                opacity: 1 !important;
                transform: scale(1.02);
            }
            .dash-line-path {
                opacity: 0;
            }
            .dash-bar-rect {
                transform-origin: left center;
                animation: dashScaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                transition: opacity 0.3s;
            }
            .dash-bar-rect:hover {
                opacity: 1 !important;
            }
            .dash-table-row {
                opacity: 0;
                animation: dashSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            .dash-table-row:hover {
                background: rgba(99,102,241,0.03) !important;
            }
            .dash-top-student {
                opacity: 0;
                animation: dashSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                transition: transform 0.2s, box-shadow 0.2s;
            }
            .dash-top-student:hover {
                transform: translateX(3px);
                box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            }
            .dash-anomaly {
                opacity: 0;
                animation: dashSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                transition: transform 0.2s, box-shadow 0.2s;
            }
            .dash-anomaly:hover {
                transform: translateX(2px);
            }
            .dash-gender-card {
                opacity: 0;
                animation: dashScaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                transition: transform 0.2s, box-shadow 0.2s;
            }
            .dash-gender-card:hover {
                transform: scale(1.03);
                box-shadow: 0 4px 12px rgba(0,0,0,0.06);
            }
            .dash-progress-bar {
                transition: width 1s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .dash-table-progress {
                animation: dashProgressFill 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            .dash-section .prog-type-btn {
                transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .dash-section .prog-type-btn:hover {
                transform: translateY(-1px);
            }
        `;
        document.head.appendChild(style);
    })();

    // Animate a number from 0 to target value
    function animateCounter(element, target, duration = 800, isDecimal = false, suffix = '') {
        if (!element) return;
        element.textContent = '0' + suffix;
        const start = 0;
        const startTime = performance.now();
        // Adaptive step: bigger numbers get longer duration
        const adjustedDuration = Math.min(duration + target * 8, 2000);

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / adjustedDuration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = start + (target - start) * eased;
            if (isDecimal) {
                element.textContent = current.toFixed(1) + suffix;
            } else {
                element.textContent = Math.round(current) + suffix;
            }
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }
        requestAnimationFrame(update);
    }

    // Trigger all dashboard animations after render
    function triggerDashboardAnimations() {
        // Animate KPI counters
        document.querySelectorAll('.dash-counter[data-target]').forEach(el => {
            const target = parseFloat(el.dataset.target);
            const isDecimal = el.dataset.decimal === 'true';
            const suffix = el.dataset.suffix || '';
            animateCounter(el, target, 800, isDecimal, suffix);
        });

        // Animate progress rings (start from full offset, then transition to target)
        document.querySelectorAll('.dash-animated-ring[data-target-offset]').forEach(ring => {
            const targetOffset = parseFloat(ring.dataset.targetOffset);
            const fullOffset = parseFloat(ring.dataset.fullOffset || targetOffset * 2);
            ring.style.strokeDashoffset = fullOffset;
            // Force reflow
            ring.getBoundingClientRect();
            ring.style.strokeDashoffset = targetOffset;
        });

        // Animate line chart paths (set --dash-length for CSS animation)
        document.querySelectorAll('.dash-line-path').forEach(path => {
            const length = path.getTotalLength ? path.getTotalLength() : 500;
            path.style.opacity = '1';
            path.style.strokeDasharray = length;
            path.style.strokeDashoffset = length;
            path.getBoundingClientRect();
            path.style.transition = 'stroke-dashoffset 2.5s cubic-bezier(0.16, 1, 0.3, 1)';
            path.style.strokeDashoffset = '0';
        });

        // Animate donut segments with circular stroke-dashoffset animation
        document.querySelectorAll('.dash-donut-segment[data-target-offset]').forEach((circle, i) => {
            const targetOffset = parseFloat(circle.dataset.targetOffset);
            const circ = parseFloat(circle.dataset.circ || circle.getAttribute('stroke-dasharray'));
            circle.style.strokeDashoffset = circ;
            circle.getBoundingClientRect();
            circle.style.transition = `stroke-dashoffset 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.15}s`;
            circle.style.strokeDashoffset = targetOffset;
            // Make visible after animation starts
            setTimeout(() => circle.classList.add('animated'), i * 150 + 50);
        });

        // Animate horizontal bar rects with stagger
        document.querySelectorAll('.dash-bar-rect').forEach((rect, i) => {
            rect.style.animationDelay = (i * 0.08) + 's';
        });

        // Animate table rows with stagger
        document.querySelectorAll('.dash-table-row').forEach((row, i) => {
            row.style.animationDelay = (i * 0.04 + 0.2) + 's';
        });

        // Animate top students with stagger
        document.querySelectorAll('.dash-top-student').forEach((item, i) => {
            item.style.animationDelay = (i * 0.08 + 0.3) + 's';
        });

        // Animate anomalies with stagger
        document.querySelectorAll('.dash-anomaly').forEach((item, i) => {
            item.style.animationDelay = (i * 0.06 + 0.2) + 's';
        });

        // Animate gender cards
        document.querySelectorAll('.dash-gender-card').forEach((card, i) => {
            card.style.animationDelay = (i * 0.1 + 0.4) + 's';
        });
    }

    // ============================================================
    // HOVER INTERACTIVITY
    // ============================================================
    window._progHover = function(el, idx, enter) {
        const svg = el.closest('svg');
        if (!svg) return;
        if (enter) {
            svg.querySelectorAll('.prog-line').forEach(function(l) { l.style.opacity = '0.12'; });
            svg.querySelectorAll('.prog-dot').forEach(function(d) { d.style.opacity = '0.12'; });
            svg.querySelectorAll('.prog-endlabel').forEach(function(e) { e.style.opacity = '0'; });
            svg.querySelectorAll('.prog-vlabel').forEach(function(v) { v.style.opacity = '0'; });
            svg.querySelectorAll('.prog-line-' + idx).forEach(function(l) { l.style.opacity = '1'; l.style.strokeWidth = '3.5'; });
            svg.querySelectorAll('.prog-dot-' + idx).forEach(function(d) { d.style.opacity = '1'; });
            svg.querySelectorAll('.prog-vlabel-' + idx).forEach(function(v) { v.style.opacity = '1'; });
        } else {
            svg.querySelectorAll('.prog-line').forEach(function(l) { l.style.opacity = '0.7'; l.style.strokeWidth = '2'; });
            svg.querySelectorAll('.prog-dot').forEach(function(d) { d.style.opacity = '1'; });
            svg.querySelectorAll('.prog-endlabel').forEach(function(e) { e.style.opacity = '1'; });
            svg.querySelectorAll('.prog-vlabel').forEach(function(v) { v.style.opacity = '0'; });
        }
    };

    // ============================================================
    // MAIN RENDER
    // ============================================================

    window.renderDashboard = async function() {
        const container = document.getElementById('dashboard-content');
        if (!container) return;

        const engine = DashboardEngine;
        // Load grade configs from Supabase (cached)
        await engine.loadGradeConfigs();

        const classes = engine.getClasses();
        const genderStats = engine.getGenderStats();
        const typeDist = engine.getAssignmentTypeDistribution();
        const anomalies = engine.getAnomalies();
        const classStats = engine.getClassDetailedStats();
        const gradeDist = engine.getGradeDistribution();
        const progression = engine.getTrimesterProgression('all');
        const progressionDev = engine.getTrimesterProgression('dev');
        const progressionComp = engine.getTrimesterProgression('comp');
        const totalAssignments = Object.values(typeDist).reduce((a, b) => a + b, 0);
        const globalCompletion = classes.length > 0
            ? Math.round(classStats.reduce((s, c) => s + c.completionRate, 0) / classes.length)
            : 0;
        // Class averages ranking (no mixing between different class levels)
        const avgRanking = engine.getClassAveragesRanking();
        const bestClass = avgRanking.best;
        const worstClass = avgRanking.worst;

        const completionColor = globalCompletion >= 80 ? '#22c55e' : globalCompletion >= 50 ? '#eab308' : '#ef4444';

        // Current period label
        const { year, trimester } = engine._getFilters();
        const periodLabel = `T${trimester || '?'} ${year || ''}`;

        container.innerHTML = `
            <!-- Period Indicator -->
            <div class="flex items-center gap-2 mb-4 px-1">
                <div class="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    <span class="text-sm font-bold text-indigo-700">${periodLabel}</span>
                </div>
                <span class="text-xs text-slate-400 font-medium">Donn\u00e9es du trimestre s\u00e9lectionn\u00e9</span>
            </div>

            <!-- KPI CARDS ROW -->
            <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
                ${renderKPICard(Icons.users, 'El\u00e8ves', genderStats.total, 'text-blue-600', 'bg-blue-50', `${classes.length} classes`, null, 0)}
                ${renderKPICard(Icons.clipboard, 'Devoirs', totalAssignments, 'text-violet-600', 'bg-violet-50', `${typeDist.comp} Comp / ${typeDist.tp || 0} TP / ${typeDist.cc || 0} CC`, null, 80)}
                ${renderKPICard(Icons.check, 'Compl\u00e9tion', globalCompletion + '%', 'text-emerald-600', 'bg-emerald-50', '', Charts.progressRing(globalCompletion, 52, 6, completionColor), 160)}
                ${renderKPICard(Icons.chart, 'Moyenne', bestClass ? bestClass.average.toFixed(1) + '/20' : '--', bestClass && bestClass.average >= 10 ? 'text-emerald-600' : bestClass ? 'text-red-600' : 'text-slate-400', bestClass && bestClass.average >= 10 ? 'bg-emerald-50' : bestClass ? 'bg-red-50' : 'bg-slate-50', bestClass ? `${bestClass.name} (meilleure)` : 'Aucune note', null, 240)}
                ${renderKPICard(Icons.alert, 'Alertes', anomalies.length, anomalies.length > 0 ? 'text-amber-600' : 'text-slate-400', anomalies.length > 0 ? 'bg-amber-50' : 'bg-slate-50', anomalies.filter(a => a.type === 'critical').length + ' critiques', null, 320)}
            </div>

            <!-- MAIN CHARTS ROW -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
                <!-- Trimester Progression -->
                <div class="dash-section bg-white rounded-2xl border border-slate-100 shadow-sm p-5" style="animation-delay:400ms">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-base font-bold text-slate-800">Progression des Moyennes</h3>
                        <div class="flex items-center gap-1 bg-slate-50 rounded-lg p-0.5">
                            <button onclick="window._switchProgressionType('all')" id="prog-btn-all" class="prog-type-btn text-[11px] font-bold px-2.5 py-1 rounded-md transition-all bg-indigo-500 text-white">Moyenne</button>
                            <button onclick="window._switchProgressionType('dev')" id="prog-btn-dev" class="prog-type-btn text-[11px] font-bold px-2.5 py-1 rounded-md transition-all text-slate-500 hover:text-slate-700">Devoir</button>
                            <button onclick="window._switchProgressionType('comp')" id="prog-btn-comp" class="prog-type-btn text-[11px] font-bold px-2.5 py-1 rounded-md transition-all text-slate-500 hover:text-slate-700">Compo</button>
                        </div>
                    </div>
                    <div id="progression-chart-container" class="min-h-[200px]">
                        ${(() => {
                            window._progressionData = { all: progression, dev: progressionDev, comp: progressionComp };
                            window._switchProgressionType = function(type) {
                                document.querySelectorAll('.prog-type-btn').forEach(b => {
                                    b.classList.remove('bg-indigo-500', 'text-white');
                                    b.classList.add('text-slate-500');
                                });
                                const btn = document.getElementById('prog-btn-' + type);
                                if (btn) { btn.classList.add('bg-indigo-500', 'text-white'); btn.classList.remove('text-slate-500'); }
                                const container = document.getElementById('progression-chart-container');
                                if (container) {
                                    container.innerHTML = window._renderProgressionChart(type);
                                    requestAnimationFrame(() => {
                                        document.querySelectorAll('#progression-chart-container .dash-line-path').forEach(path => {
                                            const length = path.getTotalLength ? path.getTotalLength() : 500;
                                            path.style.opacity = '1';
                                            path.style.strokeDasharray = length;
                                            path.style.strokeDashoffset = length;
                                            path.getBoundingClientRect();
                                            path.style.transition = 'stroke-dashoffset 2.5s cubic-bezier(0.16, 1, 0.3, 1)';
                                            path.style.strokeDashoffset = '0';
                                        });
                                    });
                                }
                            };
                            window._renderProgressionChart = function(type) {
                                const prog = window._progressionData[type] || { data: {}, activeTrimesters: [] };
                                const data = prog.data || {};
                                const activeTri = prog.activeTrimesters || [];
                                if (activeTri.length === 0) return '<p class="text-slate-400 text-sm text-center py-8">Aucune donn\u00e9e</p>';
                                const palette = ['#3b82f6','#ef4444','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316','#14b8a6','#6366f1','#84cc16','#e11d48','#0ea5e9','#d946ef','#22c55e'];
                                const levelMap = {};
                                Object.keys(data).sort().forEach(cls => {
                                    const level = cls.replace(/[^0-9]/g, '').charAt(0) || '0';
                                    if (!levelMap[level]) levelMap[level] = [];
                                    levelMap[level].push(cls);
                                });
                                const chartSeries = [];
                                const legendItems = [];
                                let colorIdx = 0;
                                Object.entries(levelMap).sort(([a],[b]) => a.localeCompare(b)).forEach(([level, classes]) => {
                                    classes.forEach(cls => {
                                        const color = palette[colorIdx % palette.length];
                                        colorIdx++;
                                        chartSeries.push({
                                            name: cls,
                                            color: color,
                                            data: activeTri.map(tri => ({ label: 'T' + tri, value: data[cls][tri] }))
                                        });
                                        legendItems.push({ name: cls, color: color });
                                    });
                                });
                                if (chartSeries.length === 0) return '<p class="text-slate-400 text-sm text-center py-8">Aucune donn\u00e9e</p>';
                                return Charts.line(chartSeries, 400, 200) + '<div class="flex flex-wrap gap-x-4 gap-y-1 mt-3">' + legendItems.map(l => '<div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:' + l.color + '"></span><span class="text-[11px] font-medium text-slate-600">' + l.name + '</span></div>').join('') + '</div>';
                            };
                            return window._renderProgressionChart('all');
                        })()}
                    </div>
                </div>

                <!-- Assignment Type Distribution -->
                <div class="dash-section bg-white rounded-2xl border border-slate-100 shadow-sm p-5" style="animation-delay:500ms">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-base font-bold text-slate-800">R\u00e9partition par Type</h3>
                        <span class="text-xs font-medium text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg">${totalAssignments} devoirs</span>
                    </div>
                    <div class="flex items-center gap-6">
                        <div class="flex-shrink-0 w-[160px]">
                            ${Charts.donut([
                                { value: typeDist.devoir, color: '#3b82f6', label: 'Devoir' },
                                { value: typeDist.comp, color: '#ef4444', label: 'Comp' },
                                { value: typeDist.cc, color: '#8b5cf6', label: 'CC' },
                                { value: typeDist.tp, color: '#f59e0b', label: 'TP' }
                            ], 160, 160)}
                        </div>
                        <div class="flex-1 space-y-2.5">
                            ${renderDonutLegend('Devoir', typeDist.devoir, '#3b82f6', totalAssignments)}
                            ${renderDonutLegend('Composition', typeDist.comp, '#ef4444', totalAssignments)}
                            ${renderDonutLegend('CC', typeDist.cc, '#8b5cf6', totalAssignments)}
                            ${renderDonutLegend('TP', typeDist.tp, '#f59e0b', totalAssignments)}
                        </div>
                    </div>
                </div>
            </div>

            <!-- CLASS STATS + GRADE DISTRIBUTION ROW -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
                <!-- Class Detailed Table -->
                <div class="dash-section lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 overflow-hidden" style="animation-delay:600ms">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-base font-bold text-slate-800">Statistiques par Classe</h3>
                        <span class="text-xs font-medium text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg">${classes.length} classes</span>
                    </div>
                    <div class="overflow-x-auto custom-scrollbar -mx-5 px-5">
                        <table class="w-full text-sm">
                            <thead>
                                <tr class="border-b border-slate-100">
                                    <th class="text-left py-2.5 px-3 font-bold text-slate-500 text-xs uppercase tracking-wider">Classe</th>
                                    <th class="text-center py-2.5 px-2 font-bold text-slate-500 text-xs uppercase tracking-wider">El\u00e8ves</th>
                                    <th class="text-center py-2.5 px-2 font-bold text-slate-500 text-xs uppercase tracking-wider">H/F</th>
                                    <th class="text-center py-2.5 px-2 font-bold text-slate-500 text-xs uppercase tracking-wider">Devoirs</th>
                                    <th class="text-center py-2.5 px-2 font-bold text-slate-500 text-xs uppercase tracking-wider">Compl\u00e9tion</th>
                                    <th class="text-center py-2.5 px-2 font-bold text-slate-500 text-xs uppercase tracking-wider">Moyenne</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${classStats.map((cs, i) => `
                                    <tr class="dash-table-row border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${i < 3 && cs.average !== null ? 'bg-gradient-to-r from-amber-50/30 to-transparent' : ''}" style="animation-delay:${i * 0.04 + 0.2}s">
                                        <td class="py-2.5 px-3">
                                            <div class="flex items-center gap-2">
                                                ${i < 3 && cs.average !== null ? '<span class="text-amber-500">' + Icons.trophy + '</span>' : '<span class="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400">' + (i+1) + '</span>'}
                                                <span class="font-semibold text-slate-800">${cs.name}</span>
                                                ${cs.isPublished === true ? '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="Notes publiées"></span>' : cs.isPublished === false ? '<span class="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Notes non publiées"></span>' : ''}
                                            </div>
                                        </td>
                                        <td class="text-center py-2.5 px-2 font-bold text-slate-700">${cs.studentCount}</td>
                                        <td class="text-center py-2.5 px-2">
                                            <span class="text-blue-600 font-medium">${cs.boys}</span><span class="text-slate-300 mx-0.5">/</span><span class="text-pink-600 font-medium">${cs.girls}</span>
                                        </td>
                                        <td class="text-center py-2.5 px-2">
                                            <div class="flex items-center justify-center gap-1">
                                                ${['devoir','cc','tp','comp'].filter(t => (cs.typeDist[t] || 0) > 0).map(t => '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ' + getTypeBadgeClass(t) + '">' + cs.typeDist[t] + '</span>').join('')}
                                            </div>
                                        </td>
                                        <td class="text-center py-2.5 px-2">
                                            <div class="flex items-center justify-center gap-1.5">
                                                <div class="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div class="dash-table-progress h-full rounded-full" style="width:${cs.completionRate}%; background:${cs.completionRate >= 80 ? '#22c55e' : cs.completionRate >= 50 ? '#eab308' : '#ef4444'}"></div>
                                                </div>
                                                <span class="text-xs font-bold ${cs.completionRate >= 80 ? 'text-emerald-600' : cs.completionRate >= 50 ? 'text-amber-600' : 'text-red-600'}">${cs.completionRate}%</span>
                                            </div>
                                        </td>
                                        <td class="text-center py-2.5 px-2">
                                            ${cs.average !== null
                                                ? `<span class="font-bold text-lg ${cs.average >= 10 ? 'text-emerald-600' : 'text-red-500'}">${cs.average.toFixed(2)}</span><span class="text-slate-300 text-xs">/20</span>`
                                                : '<span class="text-slate-300 text-xs">--</span>'}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Grade Distribution -->
                <div class="dash-section bg-white rounded-2xl border border-slate-100 shadow-sm p-5" style="animation-delay:700ms">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-base font-bold text-slate-800">Distribution des Notes</h3>
                    </div>
                    <div class="min-h-[200px]">
                        ${Charts.horizontalBar(
                            gradeDist.map(r => r.count),
                            gradeDist.map(r => r.label),
                            gradeDist.map(r => r.color),
                            300, 200
                        )}
                    </div>
                    <!-- Gender Stats -->
                    <div class="mt-5 pt-4 border-t border-slate-100">
                        <div class="flex items-center gap-2 mb-3">
                            ${Icons.gender}
                            <span class="text-sm font-bold text-slate-700">R\u00e9partition par Sexe</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="dash-gender-card flex-1 bg-blue-50 rounded-xl p-3 text-center" style="animation-delay:0.4s">
                                <div class="text-xl font-black text-blue-600">${genderStats.boys}</div>
                                <div class="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Gar\u00e7ons</div>
                            </div>
                            <div class="dash-gender-card flex-1 bg-pink-50 rounded-xl p-3 text-center" style="animation-delay:0.5s">
                                <div class="text-xl font-black text-pink-600">${genderStats.girls}</div>
                                <div class="text-[10px] font-bold text-pink-400 uppercase tracking-wider">Filles</div>
                            </div>
                            ${genderStats.unknown > 0 ? `<div class="dash-gender-card flex-1 bg-slate-50 rounded-xl p-3 text-center" style="animation-delay:0.6s">
                                <div class="text-xl font-black text-slate-500">${genderStats.unknown}</div>
                                <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Non d\u00e9fini</div>
                            </div>` : ''}
                        </div>
                    </div>
                </div>
            </div>

            <!-- TOP STUDENTS + ANOMALIES ROW -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <!-- Top Students PRO -->
                <div class="dash-section bg-white rounded-2xl border border-slate-100 shadow-sm p-5" style="animation-delay:800ms">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-2">
                            ${Icons.trophy}
                            <h3 class="text-base font-bold text-slate-800">Top 5 \u00c9l\u00e8ves</h3>
                        </div>
                        <button onclick="window._resetTopFilters()" id="top-filter-reset" title="R\u00e9initialiser les filtres" class="hidden w-5 h-5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all cursor-pointer flex items-center justify-center">
                            <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"/></svg>
                        </button>
                    </div>
                    <!-- Grade type buttons -->
                    <div class="flex flex-wrap gap-1.5 mb-3" id="top-type-buttons">
                        <button onclick="window._onTopTypeChange('')" data-type="" class="top-type-btn active text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer">Moy. G\u00e9n.</button>
                        <button onclick="window._onTopTypeChange('devoir')" data-type="devoir" class="top-type-btn text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer">Devoirs</button>
                        <button onclick="window._onTopTypeChange('cc')" data-type="cc" class="top-type-btn text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer">CC</button>
                        ${engine.getAvailableGradeTypes().has('tp') ? '<button onclick="window._onTopTypeChange(\'tp\')" data-type="tp" class="top-type-btn text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer">TP</button>' : ''}
                        <button onclick="window._onTopTypeChange('comp')" data-type="comp" class="top-type-btn text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer">Compo</button>
                    </div>
                    <!-- Class & Level filters -->
                    <div class="flex flex-wrap items-center gap-2 mb-4">
                        <select id="top-filter-class" onchange="window._onTopClassChange()" class="text-xs font-medium rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-600 focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none cursor-pointer hover:border-slate-300 transition-colors">
                            <option value="">\u2b50 Toutes les classes</option>
                            ${classes.map(c => `<option value="${c}">${c}</option>`).join('')}
                        </select>
                        <select id="top-filter-level" onchange="window._onTopLevelChange()" class="text-xs font-medium rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-600 focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none cursor-pointer hover:border-slate-300 transition-colors">
                            <option value="">\ud83c\udfc6 Tous les niveaux</option>
                            ${engine.getLevels().map(([val, label]) => `<option value="${val}">${label}</option>`).join('')}
                        </select>
                    </div>
                    <div id="top-students-list">
                        <div class="flex flex-col items-center justify-center py-10 text-slate-400">
                            <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                                <svg class="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
                            </div>
                            <div class="flex items-center gap-1.5 mb-1">
                                <span class="w-1 h-1 rounded-full bg-slate-300" style="animation: dashLoaderDot 1s ease-in-out infinite"></span>
                                <span class="w-1 h-1 rounded-full bg-slate-400" style="animation: dashLoaderDot 1s ease-in-out 0.2s infinite"></span>
                                <span class="w-1 h-1 rounded-full bg-slate-500" style="animation: dashLoaderDot 1s ease-in-out 0.4s infinite"></span>
                            </div>
                            <span class="text-xs font-medium">D\u00e9filez pour voir le Top 5</span>
                        </div>
                    </div>
                </div>

                <!-- Anomalies & Alerts -->
                <div class="dash-section bg-white rounded-2xl border border-slate-100 shadow-sm p-5" style="animation-delay:900ms">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-2">
                            ${Icons.alert}
                            <h3 class="text-base font-bold text-slate-800">Alertes & Anomalies</h3>
                        </div>
                        <span class="text-xs font-bold px-2.5 py-1 rounded-lg ${anomalies.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}">${anomalies.length}</span>
                    </div>
                    ${anomalies.length > 0 ? `
                        <div class="space-y-2.5 max-h-[400px] overflow-y-auto custom-scrollbar">
                            ${anomalies.map((a, ai) => `
                                <div class="dash-anomaly flex items-start gap-3 p-3 rounded-xl border ${a.type === 'critical' ? 'bg-red-50/50 border-red-100' : a.type === 'warning' ? 'bg-amber-50/50 border-amber-100' : 'bg-blue-50/50 border-blue-100'} transition-all hover:shadow-sm" style="animation-delay:${ai * 0.06 + 0.2}s">
                                    <div class="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${a.type === 'critical' ? 'bg-red-100 text-red-600' : a.type === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}">
                                        ${a.type === 'critical' ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>' : a.type === 'warning' ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' : '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'}
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div class="font-bold text-sm ${a.type === 'critical' ? 'text-red-800' : a.type === 'warning' ? 'text-amber-800' : 'text-blue-800'}">${a.title}</div>
                                        <div class="text-xs ${a.type === 'critical' ? 'text-red-600' : a.type === 'warning' ? 'text-amber-600' : 'text-blue-600'} mt-0.5">${a.message}</div>
                                    </div>
                                    ${a.className ? `<button onclick="window.invalidateDashboardCache && window.invalidateDashboardCache(); switchTab('export'); setTimeout(() => { const sel = document.getElementById('select-class-export'); if(sel) { sel.value='${a.className.replace(/'/g, "\'")}'; sel.dispatchEvent(new Event('change')); } }, 300)" class="shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg bg-white/80 border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-colors">Voir</button>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="text-center py-12">
                            <div class="w-16 h-16 mx-auto mb-3 rounded-full bg-emerald-50 flex items-center justify-center">
                                <svg class="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            </div>
                            <div class="font-bold text-emerald-700">Tout est en ordre</div>
                            <div class="text-sm text-emerald-500 mt-1">Aucune anomalie d\u00e9tect\u00e9e</div>
                        </div>
                    `}
                </div>
            </div>
        `;

        // Trigger all animations after DOM is rendered
        requestAnimationFrame(() => {
            triggerDashboardAnimations();
        });

        // Lazy load Top 5 when scrolled into view
        const topList = document.getElementById('top-students-list');
        if (topList && !topList.dataset.lazyLoaded) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        topList.dataset.lazyLoaded = '1';
                        observer.disconnect();
                        // Tiny delay so the placeholder is visible momentarily
                        setTimeout(() => {
                            window._renderTopStudents();
                            // Re-trigger animations for top students
                            requestAnimationFrame(() => {
                                document.querySelectorAll('#top-students-list .dash-top-student').forEach((item, i) => {
                                    item.style.animationDelay = (i * 0.08 + 0.3) + 's';
                                    item.style.animation = 'none';
                                    item.getBoundingClientRect();
                                    item.style.animation = '';
                                });
                            });
                        }, 400);
                    }
                });
            }, { rootMargin: '100px' });
            observer.observe(topList);
        }
    };

    // ============================================================
    // HELPER RENDERERS
    // ============================================================

    function renderKPICard(icon, label, value, textColor, bgColor, subtitle, extraContent, animDelay = 0) {
        // Parse numeric value for animation
        const numericMatch = String(value).match(/^(\d+(?:\.\d+)?)(.*)/);
        const isNumeric = numericMatch && !isNaN(parseFloat(numericMatch[1]));
        const numericVal = isNumeric ? parseFloat(numericMatch[1]) : 0;
        const suffix = isNumeric ? numericMatch[2] : '';
        const isDecimal = isNumeric && String(value).includes('.');

        const valueHtml = isNumeric
            ? `<span class="dash-counter dash-counter-value" data-target="${numericVal}" data-decimal="${isDecimal}" data-suffix="${suffix}"></span>`
            : value;

        return `
            <div class="dash-kpi-card bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow" style="animation-delay:${animDelay}ms">
                <div class="flex items-start justify-between mb-3">
                    <div class="w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center ${textColor}">${icon}</div>
                    ${extraContent ? extraContent : ''}
                </div>
                <div class="text-2xl sm:text-3xl font-black ${textColor} tracking-tight">${valueHtml}</div>
                <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">${label}</div>
                ${subtitle ? `<div class="text-[10px] text-slate-400 mt-1 truncate">${subtitle}</div>` : ''}
            </div>
        `;
    }

    function renderDonutLegend(label, value, color, total) {
        const pct = total > 0 ? Math.round((value / total) * 100) : 0;
        return `
            <div class="flex items-center gap-2.5">
                <div class="w-3 h-3 rounded-sm shrink-0" style="background:${color}"></div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-semibold text-slate-700">${label}</span>
                        <span class="text-sm font-bold" style="color:${color}">${value}</span>
                    </div>
                    <div class="w-full h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                        <div class="h-full rounded-full transition-all duration-700" style="width:${pct}%; background:${color}"></div>
                    </div>
                </div>
            </div>
        `;
    }

    function getTypeBadgeClass(type) {
        switch(type) {
            case 'devoir': return 'bg-blue-100 text-blue-700';
            case 'cc': return 'bg-violet-100 text-violet-700';
            case 'tp': return 'bg-amber-100 text-amber-700';
            case 'comp': return 'bg-red-100 text-red-700';
            default: return 'bg-slate-100 text-slate-700';
        }
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================

    window.initDashboard = function() {
        console.log('[Dashboard] Initialized');
    };

    // Invalidate cache so next render fetches fresh data from Supabase
    window.invalidateDashboardCache = function() {
        const engine = DashboardEngine;
        if (engine) {
            engine._gradeConfigsCache = null;
            engine._gradeConfigsCacheKey = null;
        }
    };

    // ---- Top Students linked filters ----

    // Current grade type (stored in JS, not in a select)
    window._topGradeType = '';

    // Style for type buttons
    const _styleTopTypeBtns = () => {
        document.querySelectorAll('.top-type-btn').forEach(btn => {
            const t = btn.dataset.type || '';
            if (t === window._topGradeType) {
                btn.className = 'top-type-btn active text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-blue-400 bg-blue-500 text-white shadow-sm cursor-pointer transition-all';
            } else {
                btn.className = 'top-type-btn text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700 cursor-pointer transition-all';
            }
        });
    };

    // Render the top students list based on current filter values
    window._renderTopStudents = function() {
        const engine = DashboardEngine;
        const filterClass = document.getElementById('top-filter-class')?.value || '';
        const filterLevel = document.getElementById('top-filter-level')?.value || '';
        const gradeType = window._topGradeType;
        const topStudents = engine.getTopStudents(5, filterClass, filterLevel, gradeType);
        const container = document.getElementById('top-students-list');
        if (!container) return;

        // Mark as lazy loaded if observer was set up
        container.dataset.lazyLoaded = '1';

        _styleTopTypeBtns();

        if (topStudents.length > 0) {
            container.innerHTML = `<div class="space-y-2">
                ${topStudents.map((s, i) => `
                    <div class="dash-top-student flex items-center gap-3 p-2 rounded-xl ${i === 0 ? 'bg-gradient-to-r from-amber-50 to-amber-50/30 border border-amber-100' : i === 1 ? 'bg-gradient-to-r from-slate-50 to-slate-50/30 border border-slate-100' : i === 2 ? 'bg-gradient-to-r from-orange-50 to-orange-50/30 border border-orange-100' : 'hover:bg-slate-50/50'} transition-colors" style="animation-delay:${i * 0.08 + 0.3}s">
                        <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-white' : i === 2 ? 'bg-orange-400 text-white' : 'bg-slate-100 text-slate-500'}">${i + 1}</div>
                        <div class="flex-1 min-w-0">
                            <div class="font-semibold text-slate-800 text-sm truncate">${s.name}</div>
                            <div class="text-[10px] font-medium text-slate-400">${s.className}</div>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <div class="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div class="dash-progress-bar h-full rounded-full" style="width:${(s.average / 20) * 100}%; background:${s.average >= 15 ? '#0ea5e9' : s.average >= 12 ? '#22c55e' : s.average >= 10 ? '#84cc16' : '#ef4444'}"></div>
                            </div>
                            <span class="font-bold text-sm ${s.average >= 10 ? 'text-emerald-600' : 'text-red-500'} min-w-[48px] text-right">${s.average.toFixed(2)}</span>
                        </div>
                    </div>
                `).join('')}
            </div>`;
        } else {
            container.innerHTML = '<div class="text-center py-8 text-slate-400 text-sm">Aucune donn\u00e9e de note disponible</div>';
        }
        window._updateTopResetBtn();
    };

    // When grade type button is clicked
    window._onTopTypeChange = function(type) {
        window._topGradeType = type;
        window._renderTopStudents();
    };

    // When class changes → update level selector to match class level
    window._onTopClassChange = function() {
        const selClass = document.getElementById('top-filter-class');
        const selLevel = document.getElementById('top-filter-level');
        if (!selClass || !selLevel) return;
        const chosenClass = selClass.value;
        if (chosenClass && window.levelFromClass) {
            const lvl = String(window.levelFromClass(chosenClass));
            selLevel.value = (lvl !== '?') ? lvl : '';
        }
        window._renderTopStudents();
    };

    // When level changes → filter class selector to only show classes of that level
    window._onTopLevelChange = function() {
        const engine = DashboardEngine;
        const selClass = document.getElementById('top-filter-class');
        const selLevel = document.getElementById('top-filter-level');
        if (!selClass || !selLevel) return;
        const chosenLevel = selLevel.value;
        const allClasses = engine.getClasses();
        const currentClassVal = selClass.value;

        let filteredClasses = allClasses;
        if (chosenLevel && window.levelFromClass) {
            filteredClasses = allClasses.filter(c => String(window.levelFromClass(c)) === chosenLevel);
        }

        selClass.innerHTML = '<option value="">\u2b50 Toutes les classes</option>' +
            filteredClasses.map(c => `<option value="${c}">${c}</option>`).join('');

        if (currentClassVal && filteredClasses.includes(currentClassVal)) {
            selClass.value = currentClassVal;
        } else {
            selClass.value = '';
        }

        window._renderTopStudents();
    };

    // Reset all filters to default
    window._resetTopFilters = function() {
        const engine = DashboardEngine;
        const selClass = document.getElementById('top-filter-class');
        const selLevel = document.getElementById('top-filter-level');
        if (!selClass || !selLevel) return;

        window._topGradeType = '';

        selClass.innerHTML = '<option value="">\u2b50 Toutes les classes</option>' +
            engine.getClasses().map(c => `<option value="${c}">${c}</option>`).join('');
        selClass.value = '';

        selLevel.innerHTML = '<option value="">\ud83c\udfc6 Tous les niveaux</option>' +
            engine.getLevels().map(([val, label]) => `<option value="${val}">${label}</option>`).join('');
        selLevel.value = '';

        window._renderTopStudents();
    };

    // Show/hide reset button based on active filters
    window._updateTopResetBtn = function() {
        const btn = document.getElementById('top-filter-reset');
        const selClass = document.getElementById('top-filter-class');
        const selLevel = document.getElementById('top-filter-level');
        if (!btn || !selClass || !selLevel) return;
        const hasFilter = window._topGradeType !== '' || selClass.value !== '' || selLevel.value !== '';
        btn.classList.toggle('hidden', !hasFilter);
        btn.classList.toggle('flex', hasFilter);
    };

    // Expose engine for external use
    window.DashboardEngine = DashboardEngine;
    window.DashboardCharts = Charts;

    console.log('[Dashboard] Module loaded');
})();
