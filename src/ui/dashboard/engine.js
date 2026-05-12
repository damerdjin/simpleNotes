import { supabase } from '../supabase-client.js';

const getData = () => window.data;
const getTranslations = () => window.translations;
const getLang = () => window.currentLanguage;

const DashboardEngine = {
    _gradeConfigsCache: null,
    _gradeConfigsCacheKey: '',

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

    _getFilters() {
        return {
            year: window.getGlobalAcademicYear ? window.getGlobalAcademicYear() : '',
            trimester: window.getGlobalTrimester ? window.getGlobalTrimester() : ''
        };
    },

    _isStudentInYear(s) {
        return !s.academicYear || s.academicYear === this._getFilters().year;
    },

    _isAssignmentInPeriod(a) {
        const { year, trimester } = this._getFilters();
        return (!a.academicYear || a.academicYear === year) &&
               (!a.trimester || a.trimester === trimester || a.trimester === 'T' + trimester);
    },

    _getStudentAverage(data, studentId, assignments) {
        const configs = this._gradeConfigsCache || [];
        const student = (data.students || []).find(s => s.id === studentId);
        if (!student) return null;
        const className = student.className;
        const { trimester } = this._getFilters();

        const cfg = configs.find(c => c.class_name === className && c.trimester === trimester);
        if (!cfg) return null;

        const hasCC = !!cfg.cc_assignment_id;
        const hasComp = !!cfg.comp_assignment_id;
        const d1Ids = (cfg.devoir1_config?.assignmentIds || []).filter(Boolean);
        const d2Ids = (cfg.devoir2_config?.assignmentIds || []).filter(Boolean);
        const hasDevoir = d1Ids.length > 0 || d2Ids.length > 0;
        if (!hasCC || !hasComp || !hasDevoir) return null;

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

        return hasTP ? (devoir + cc + tp + 2 * comp) / 5 : (devoir + cc + 2 * comp) / 4;
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

    getClassAveragesRanking() {
        const { trimester } = this._getFilters();
        const configs = this._gradeConfigsCache || [];
        const classMap = {};
        configs.filter(c => c.average_all !== null && c.trimester === trimester).forEach(c => {
            if (!classMap[c.class_name]) {
                classMap[c.class_name] = { sums: {}, counts: {}, min: {}, max: {} };
            }
            const entry = classMap[c.class_name];
            entry.sums.average_all = (entry.sums.average_all || 0) + parseFloat(c.average_all);
            entry.counts.average_all = (entry.counts.average_all || 0) + 1;
            const val = parseFloat(c.average_all);
            entry.min.average_all = entry.min.average_all !== undefined ? Math.min(entry.min.average_all, val) : val;
            entry.max.average_all = entry.max.average_all !== undefined ? Math.max(entry.max.average_all, val) : val;
            ['average_comp', 'average_cc', 'average_dev', 'average_tp'].forEach(field => {
                if (c[field] !== null) {
                    entry.sums[field] = (entry.sums[field] || 0) + parseFloat(c[field]);
                    entry.counts[field] = (entry.counts[field] || 0) + 1;
                }
            });
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

    getTrimesterProgression(type = 'all') {
        const configs = this._gradeConfigsCache || [];
        const avgField = type === 'dev' ? 'average_dev' : type === 'comp' ? 'average_comp' : type === 'cc' ? 'average_cc' : 'average_all';
        const classProgression = {};
        const classNames = [...new Set(configs.filter(c => c[avgField] !== null).map(c => c.class_name))];
        classNames.forEach(cls => {
            classProgression[cls] = {};
            ['1', '2', '3'].forEach(tri => {
                const triConfigs = configs.filter(c =>
                    c.class_name === cls &&
                    c[avgField] !== null &&
                    (c.trimester === tri || c.trimester === 'T' + tri)
                );
                if (triConfigs.length > 0) {
                    const avg = triConfigs.reduce((s, c) => s + parseFloat(c[avgField]), 0) / triConfigs.length;
                    classProgression[cls][tri] = parseFloat(avg.toFixed(2));
                } else {
                    classProgression[cls][tri] = null;
                }
            });
        });
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

            if (completion.total > 0 && completion.rate < 50 && assignments.length > 0) {
                anomalies.push({
                    type: 'critical',
                    icon: 'exclamation-triangle',
                    title: 'Notes manquantes',
                    message: `${cls}: seulement ${completion.rate}% de complétion (${completion.filled}/${completion.total})`,
                    className: cls
                });
            }

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

        const configs = this._gradeConfigsCache || [];
        const { trimester } = this._getFilters();
        const classConfigs = configs.filter(c => c.trimester === trimester);
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

    getGenderStats() {
        const data = getData();
        const stats = { total: 0, boys: 0, girls: 0, unknown: 0 };
        (data.students || []).filter(s => s.status !== 'archived' && this._isStudentInYear(s)).forEach(s => {
            stats.total++;
            const sex = (s.sex || '').toLowerCase().trim();
            if (sex === 'm' || sex === 'male' || sex === 'garçon' || sex === 'homme' || sex === 'boy' || sex.includes('ذكر')) stats.boys++;
            else if (sex === 'f' || sex === 'female' || sex === 'fille' || sex === 'femme' || sex === 'girl' || sex.includes('أثنى') || sex.includes('انثى')) stats.girls++;
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
            const { trimester } = this._getFilters();
            const classConfigs = configs.filter(c => c.class_name === cls && c.average_all !== null && c.trimester === trimester);
            const allClassConfigs = configs.filter(c => c.class_name === cls && c.trimester === trimester);
            const avg = classConfigs.length > 0
                ? parseFloat((classConfigs.reduce((s, c) => s + parseFloat(c.average_all), 0) / classConfigs.length).toFixed(2))
                : null;
            const minAll = classConfigs.length > 0 ? Math.min(...classConfigs.map(c => parseFloat(c.min_all)).filter(v => !isNaN(v))) : null;
            const maxAll = classConfigs.length > 0 ? Math.max(...classConfigs.map(c => parseFloat(c.max_all)).filter(v => !isNaN(v))) : null;
            const isPublished = allClassConfigs.length > 0 ? allClassConfigs.every(c => c.is_published) : null;
            const boys = students.filter(s => { const sex = (s.sex || '').toLowerCase().trim(); return sex === 'm' || sex === 'male' || sex === 'garçon' || sex === 'homme' || sex === 'boy' || sex.includes('ذكر'); }).length;
            const girls = students.filter(s => { const sex = (s.sex || '').toLowerCase().trim(); return sex === 'f' || sex === 'female' || sex === 'fille' || sex === 'femme' || sex === 'girl' || sex.includes('أثنى') || sex.includes('انثى'); }).length;
            const typeDist = {};
            assignments.forEach(a => {
                const type = a.type || 'devoir';
                typeDist[type] = (typeDist[type] || 0) + 1;
            });
            return {
                name: cls,
                studentCount: students.length,
                boys, girls,
                assignmentCount: assignments.length,
                typeDist,
                completionRate: completion.rate,
                completionFilled: completion.filled,
                completionTotal: completion.total,
                average: avg,
                minAll: minAll !== null && isFinite(minAll) ? minAll : null,
                maxAll: maxAll !== null && isFinite(maxAll) ? maxAll : null,
                isPublished
            };
        }).sort((a, b) => (b.average || 0) - (a.average || 0));
    },

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

        const cc = calcScaled(cfg.cc_assignment_id);
        const comp = calcScaled(cfg.comp_assignment_id);
        const tp = calcScaled(cfg.tp_assignment_id);
        const d1 = computeGroupScore(cfg.devoir1_config);
        const d2 = computeGroupScore(cfg.devoir2_config);
        let devoir = null;
        if (d1 !== null && d2 !== null) devoir = (d1 + d2) / 2;
        else if (d1 !== null) devoir = d1;
        else if (d2 !== null) devoir = d2;

        if (gradeType === 'devoir') return devoir;
        if (gradeType === 'cc') return cc;
        if (gradeType === 'comp') return comp;
        if (gradeType === 'tp') return tp;

        const hasTP = !!cfg.tp_assignment_id;
        const requiredOk = (devoir !== null && cc !== null && comp !== null && (!hasTP || tp !== null));
        if (!requiredOk) return null;
        return hasTP ? (devoir + cc + tp + 2 * comp) / 5 : (devoir + cc + 2 * comp) / 4;
    },

    getTopStudents(limit = 5, filterClass = '', filterLevel = '', gradeType = '') {
        const data = getData();
        const studentAvgs = [];

        (data.students || []).filter(s => s.status !== 'archived' && this._isStudentInYear(s)).forEach(s => {
            if (filterClass && s.className !== filterClass) return;
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

export { DashboardEngine };
