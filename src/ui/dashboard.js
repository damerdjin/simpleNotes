/**
 * Dashboard Administratif - SimpleNotes
 * Module complet de visualisation et statistiques
 */
(function() {
    'use strict';

    const getData = () => window.data;
    const getTranslations = () => window.translations;
    const getLang = () => window.currentLanguage;

    // ============================================================
    // DATA AGGREGATION ENGINE
    // ============================================================

    const DashboardEngine = {
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
            let totalScore = 0, count = 0;
            assignments.forEach(a => {
                if (data.grades && data.grades[studentId] && data.grades[studentId][a.id]) {
                    const score = window.grades ? window.grades.getStudentAssignmentTotal(data, studentId, a.id) : 0;
                    const maxPts = window.grades ? window.grades.getAssignmentMaxPoints(a) : 20;
                    if (score > 0 && maxPts > 0) {
                        totalScore += (score / maxPts) * 20;
                        count++;
                    }
                }
            });
            return count > 0 ? totalScore / count : null;
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
            if (students.length === 0 || assignments.length === 0) return { total: 0, filled: 0, rate: 0 };
            let total = 0, filled = 0;
            const data = getData();
            students.forEach(s => {
                assignments.forEach(a => {
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

        // Global average = weighted by number of students who have grades
        getGlobalAverage() {
            const data = getData();
            const classes = this.getClasses();
            let totalSum = 0, totalCount = 0;
            classes.forEach(cls => {
                const students = this.getStudentsByClass(cls);
                const assignments = this.getAssignmentsByClass(cls);
                students.forEach(s => {
                    const avg = this._getStudentAverage(data, s.id, assignments);
                    if (avg !== null) {
                        totalSum += avg;
                        totalCount++;
                    }
                });
            });
            return totalCount > 0 ? (totalSum / totalCount).toFixed(2) : null;
        },

        getAssignmentTypeDistribution() {
            const data = getData();
            const dist = { devoir: 0, cc: 0, tp: 0, comp: 0 };
            (data.assignments || []).forEach(a => {
                if (this._isAssignmentInPeriod(a)) {
                    const type = a.type || 'devoir';
                    if (dist[type] !== undefined) dist[type]++;
                }
            });
            return dist;
        },

        // Trimester progression: compare T1, T2, T3 for the CURRENT year
        getTrimesterProgression() {
            const data = getData();
            const { year } = this._getFilters();
            const classes = this.getClasses();
            const progression = {};
            ['1', '2', '3'].forEach(tri => {
                const triAvgs = [];
                classes.forEach(cls => {
                    const students = this.getStudentsByClass(cls);
                    const assignments = (data.assignments || []).filter(a =>
                        (a.className || '').trim() === (cls || '').trim() &&
                        (!a.academicYear || a.academicYear === year) &&
                        (a.trimester === tri || a.trimester === 'T' + tri)
                    );
                    if (assignments.length === 0) return;
                    students.forEach(s => {
                        const avg = this._getStudentAverage(data, s.id, assignments);
                        if (avg !== null) triAvgs.push(avg);
                    });
                });
                progression[tri] = triAvgs.length > 0
                    ? (triAvgs.reduce((a, b) => a + b, 0) / triAvgs.length).toFixed(2)
                    : null;
            });
            return progression;
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

            // A4: Config export incomplete
            if (window.exportPrepConfig) {
                const cfg = window.exportPrepConfig;
                Object.keys(cfg.byClass || {}).forEach(key => {
                    const c = cfg.byClass[key];
                    if (c && !c.ccAssignmentId && !c.compAssignmentId && (c.devoir1 || c.devoir2)) {
                        anomalies.push({
                            type: 'warning',
                            icon: 'cog',
                            title: 'Config incomplète',
                            message: `Configuration export incomplète pour ${key}`,
                            className: key.split('|')[1] || ''
                        });
                    }
                });
            }

            return anomalies;
        },

        // Gender stats filtered by current year
        getGenderStats() {
            const data = getData();
            const stats = { total: 0, boys: 0, girls: 0, unknown: 0 };
            (data.students || []).filter(s => s.status !== 'archived' && this._isStudentInYear(s)).forEach(s => {
                stats.total++;
                const sex = (s.sex || '').toLowerCase().trim();
                if (sex === 'm' || sex === 'male') stats.boys++;
                else if (sex === 'f' || sex === 'female') stats.girls++;
                else stats.unknown++;
            });
            return stats;
        },

        getClassDetailedStats() {
            const classes = this.getClasses();
            return classes.map(cls => {
                const students = this.getStudentsByClass(cls);
                const assignments = this.getAssignmentsByClass(cls);
                const completion = this.getGradeCompletionRate(cls);
                const avg = this.getClassAverage(cls);
                const boys = students.filter(s => (s.sex || '').toLowerCase().trim() === 'm' || (s.sex || '').toLowerCase().trim() === 'male').length;
                const girls = students.filter(s => (s.sex || '').toLowerCase().trim() === 'f' || (s.sex || '').toLowerCase().trim() === 'female').length;
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
                    average: avg ? parseFloat(avg) : null
                };
            }).sort((a, b) => (b.average || 0) - (a.average || 0));
        },

        // Top students for current trimester
        getTopStudents(limit = 10) {
            const data = getData();
            const studentAvgs = [];

            (data.students || []).filter(s => s.status !== 'archived' && this._isStudentInYear(s)).forEach(s => {
                const assignments = (data.assignments || []).filter(a =>
                    (a.className || '').trim() === (s.className || '').trim() &&
                    this._isAssignmentInPeriod(a)
                );
                const avg = this._getStudentAverage(data, s.id, assignments);
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
                bars += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4" fill="${color}" opacity="0.85">
                    <animate attributeName="height" from="0" to="${barH}" dur="0.6s" fill="freeze"/>
                    <animate attributeName="y" from="${chartHeight + 10}" to="${y}" dur="0.6s" fill="freeze"/>
                </rect>`;
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
                bars += `<rect x="80" y="${y}" width="${barW}" height="${barHeight}" rx="4" fill="${color}" opacity="0.85">
                    <animate attributeName="width" from="0" to="${barW}" dur="0.5s" fill="freeze"/>
                </rect>`;
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

            let paths = '';
            let startAngle = -Math.PI / 2;
            segments.forEach((seg, i) => {
                const angle = (seg.value / total) * Math.PI * 2;
                const endAngle = startAngle + angle;
                const largeArc = angle > Math.PI ? 1 : 0;
                const x1 = cx + r * Math.cos(startAngle);
                const y1 = cy + r * Math.sin(startAngle);
                const x2 = cx + r * Math.cos(endAngle);
                const y2 = cy + r * Math.sin(endAngle);
                const ix1 = cx + innerR * Math.cos(endAngle);
                const iy1 = cy + innerR * Math.sin(endAngle);
                const ix2 = cx + innerR * Math.cos(startAngle);
                const iy2 = cy + innerR * Math.sin(startAngle);

                paths += `<path d="M${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} L${ix1},${iy1} A${innerR},${innerR} 0 ${largeArc} 0 ${ix2},${iy2} Z" fill="${seg.color}" opacity="0.9">
                    <animate attributeName="opacity" from="0" to="0.9" dur="0.4s" fill="freeze"/>
                </path>`;
                startAngle = endAngle;
            });

            const centerText = `<text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="22" font-weight="800" fill="#1e293b">${total}</text>
                <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="10" fill="#94a3b8" font-weight="500">total</text>`;

            return `<svg viewBox="0 0 ${width} ${height}" class="w-full" style="max-height:${height}px">${paths}${centerText}</svg>`;
        },

        line(dataPoints, width = 400, height = 180) {
            if (!dataPoints || dataPoints.length === 0) return '<p class="text-slate-400 text-sm text-center py-8">Aucune donn\u00e9e</p>';
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
                points += `<circle cx="${x}" cy="${y}" r="5" fill="#6366f1" stroke="white" stroke-width="2.5"/>`;
                points += `<text x="${x}" y="${y - 10}" text-anchor="middle" font-size="10" font-weight="700" fill="#4f46e5">${p.value}</text>`;
                if (!linePath) { linePath = `M${x},${y}`; areaPath = `M${x},${10 + chartH} L${x},${y}`; }
                else { linePath += ` L${x},${y}`; areaPath += ` L${x},${y}`; }
            });
            areaPath += ` L${40 + (dataPoints.length - 1) * step},${10 + chartH} Z`;

            let labels = '';
            dataPoints.forEach((p, i) => {
                const x = 40 + i * step;
                labels += `<text x="${x}" y="${height - 5}" text-anchor="middle" font-size="10" fill="#64748b" font-weight="500">${p.label}</text>`;
            });

            return `<svg viewBox="0 0 ${width} ${height}" class="w-full" style="max-height:${height}px">${grid}<path d="${areaPath}" fill="url(#areaGrad)" opacity="0.15"/><defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#6366f1" stop-opacity="0"/></linearGradient></defs><path d="${linePath}" fill="none" stroke="#6366f1" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${points}${labels}</svg>`;
        },

        progressRing(pct, size = 80, strokeWidth = 8, color = '#22c55e') {
            const r = (size - strokeWidth) / 2;
            const circ = 2 * Math.PI * r;
            const offset = circ - (pct / 100) * circ;
            return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
                <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="${strokeWidth}"/>
                <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="${strokeWidth}"
                    stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round"
                    transform="rotate(-90 ${size/2} ${size/2})" style="transition: stroke-dashoffset 0.8s ease"/>
                <text x="${size/2}" y="${size/2 - 4}" text-anchor="middle" font-size="${size * 0.22}" font-weight="800" fill="#1e293b">${pct}%</text>
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
    // MAIN RENDER
    // ============================================================

    window.renderDashboard = function() {
        const container = document.getElementById('dashboard-content');
        if (!container) return;

        const engine = DashboardEngine;
        const classes = engine.getClasses();
        const genderStats = engine.getGenderStats();
        const typeDist = engine.getAssignmentTypeDistribution();
        const anomalies = engine.getAnomalies();
        const classStats = engine.getClassDetailedStats();
        const topStudents = engine.getTopStudents(10);
        const gradeDist = engine.getGradeDistribution();
        const progression = engine.getTrimesterProgression();
        const totalAssignments = Object.values(typeDist).reduce((a, b) => a + b, 0);
        const globalCompletion = classes.length > 0
            ? Math.round(classStats.reduce((s, c) => s + c.completionRate, 0) / classes.length)
            : 0;
        // Use weighted global average (by student, not by class average)
        const globalAvg = engine.getGlobalAverage();
        const globalAvgDisplay = globalAvg !== null ? globalAvg : '--';

        const completionColor = globalCompletion >= 80 ? '#22c55e' : globalCompletion >= 50 ? '#eab308' : '#ef4444';
        const avgColor = globalAvg !== null ? (parseFloat(globalAvg) >= 10 ? '#22c55e' : '#ef4444') : '#94a3b8';

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
                ${renderKPICard(Icons.users, 'El\u00e8ves', genderStats.total, 'text-blue-600', 'bg-blue-50', `${classes.length} classes`)}
                ${renderKPICard(Icons.clipboard, 'Devoirs', totalAssignments, 'text-violet-600', 'bg-violet-50', `${typeDist.cc} CC / ${typeDist.comp} Comp`)}
                ${renderKPICard(Icons.check, 'Compl\u00e9tion', globalCompletion + '%', 'text-emerald-600', 'bg-emerald-50', '', Charts.progressRing(globalCompletion, 52, 6, completionColor))}
                ${renderKPICard(Icons.chart, 'Moyenne', globalAvgDisplay + '/20', globalAvg !== null && parseFloat(globalAvg) >= 10 ? 'text-emerald-600' : globalAvg !== null ? 'text-red-600' : 'text-slate-400', globalAvg !== null && parseFloat(globalAvg) >= 10 ? 'bg-emerald-50' : globalAvg !== null ? 'bg-red-50' : 'bg-slate-50', globalAvg !== null ? (parseFloat(globalAvg) >= 10 ? 'Au-dessus de la moyenne' : 'En dessous de la moyenne') : 'Aucune note')}
                ${renderKPICard(Icons.alert, 'Alertes', anomalies.length, anomalies.length > 0 ? 'text-amber-600' : 'text-slate-400', anomalies.length > 0 ? 'bg-amber-50' : 'bg-slate-50', anomalies.filter(a => a.type === 'critical').length + ' critiques')}
            </div>

            <!-- MAIN CHARTS ROW -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
                <!-- Trimester Progression -->
                <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-base font-bold text-slate-800">Progression des Moyennes</h3>
                        <span class="text-xs font-medium text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg">Par Trimestre</span>
                    </div>
                    <div class="min-h-[180px]">
                        ${Charts.line([
                            { label: 'T1', value: progression['1'] ? parseFloat(progression['1']) : null },
                            { label: 'T2', value: progression['2'] ? parseFloat(progression['2']) : null },
                            { label: 'T3', value: progression['3'] ? parseFloat(progression['3']) : null }
                        ], 400, 180)}
                    </div>
                </div>

                <!-- Assignment Type Distribution -->
                <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-base font-bold text-slate-800">R\u00e9partition par Type</h3>
                        <span class="text-xs font-medium text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg">${totalAssignments} devoirs</span>
                    </div>
                    <div class="flex items-center gap-6">
                        <div class="flex-shrink-0 w-[160px]">
                            ${Charts.donut([
                                { value: typeDist.devoir, color: '#3b82f6', label: 'Devoir' },
                                { value: typeDist.cc, color: '#8b5cf6', label: 'CC' },
                                { value: typeDist.tp, color: '#f59e0b', label: 'TP' },
                                { value: typeDist.comp, color: '#ef4444', label: 'Comp' }
                            ], 160, 160)}
                        </div>
                        <div class="flex-1 space-y-2.5">
                            ${renderDonutLegend('Devoir', typeDist.devoir, '#3b82f6', totalAssignments)}
                            ${renderDonutLegend('CC', typeDist.cc, '#8b5cf6', totalAssignments)}
                            ${renderDonutLegend('TP', typeDist.tp, '#f59e0b', totalAssignments)}
                            ${renderDonutLegend('Composition', typeDist.comp, '#ef4444', totalAssignments)}
                        </div>
                    </div>
                </div>
            </div>

            <!-- CLASS STATS + GRADE DISTRIBUTION ROW -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
                <!-- Class Detailed Table -->
                <div class="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 overflow-hidden">
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
                                    <tr class="border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${i < 3 && cs.average !== null ? 'bg-gradient-to-r from-amber-50/30 to-transparent' : ''}">
                                        <td class="py-2.5 px-3">
                                            <div class="flex items-center gap-2">
                                                ${i < 3 && cs.average !== null ? '<span class="text-amber-500">' + Icons.trophy + '</span>' : '<span class="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400">' + (i+1) + '</span>'}
                                                <span class="font-semibold text-slate-800">${cs.name}</span>
                                            </div>
                                        </td>
                                        <td class="text-center py-2.5 px-2 font-bold text-slate-700">${cs.studentCount}</td>
                                        <td class="text-center py-2.5 px-2">
                                            <span class="text-blue-600 font-medium">${cs.boys}</span><span class="text-slate-300 mx-0.5">/</span><span class="text-pink-600 font-medium">${cs.girls}</span>
                                        </td>
                                        <td class="text-center py-2.5 px-2">
                                            <div class="flex items-center justify-center gap-1">
                                                ${Object.entries(cs.typeDist).map(([t, c]) => c > 0 ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${getTypeBadgeClass(t)}">${c}</span>` : '').join('')}
                                            </div>
                                        </td>
                                        <td class="text-center py-2.5 px-2">
                                            <div class="flex items-center justify-center gap-1.5">
                                                <div class="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div class="h-full rounded-full transition-all duration-700" style="width:${cs.completionRate}%; background:${cs.completionRate >= 80 ? '#22c55e' : cs.completionRate >= 50 ? '#eab308' : '#ef4444'}"></div>
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
                <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
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
                            <div class="flex-1 bg-blue-50 rounded-xl p-3 text-center">
                                <div class="text-xl font-black text-blue-600">${genderStats.boys}</div>
                                <div class="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Gar\u00e7ons</div>
                            </div>
                            <div class="flex-1 bg-pink-50 rounded-xl p-3 text-center">
                                <div class="text-xl font-black text-pink-600">${genderStats.girls}</div>
                                <div class="text-[10px] font-bold text-pink-400 uppercase tracking-wider">Filles</div>
                            </div>
                            ${genderStats.unknown > 0 ? `<div class="flex-1 bg-slate-50 rounded-xl p-3 text-center">
                                <div class="text-xl font-black text-slate-500">${genderStats.unknown}</div>
                                <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Non d\u00e9fini</div>
                            </div>` : ''}
                        </div>
                    </div>
                </div>
            </div>

            <!-- TOP STUDENTS + ANOMALIES ROW -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <!-- Top Students -->
                <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-2">
                            ${Icons.trophy}
                            <h3 class="text-base font-bold text-slate-800">Top 10 El\u00e8ves</h3>
                        </div>
                        <span class="text-xs font-medium text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg">Moyenne g\u00e9n\u00e9rale</span>
                    </div>
                    ${topStudents.length > 0 ? `
                        <div class="space-y-2">
                            ${topStudents.map((s, i) => `
                                <div class="flex items-center gap-3 p-2 rounded-xl ${i === 0 ? 'bg-gradient-to-r from-amber-50 to-amber-50/30 border border-amber-100' : i === 1 ? 'bg-gradient-to-r from-slate-50 to-slate-50/30 border border-slate-100' : i === 2 ? 'bg-gradient-to-r from-orange-50 to-orange-50/30 border border-orange-100' : 'hover:bg-slate-50/50'} transition-colors">
                                    <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-white' : i === 2 ? 'bg-orange-400 text-white' : 'bg-slate-100 text-slate-500'}">${i + 1}</div>
                                    <div class="flex-1 min-w-0">
                                        <div class="font-semibold text-slate-800 text-sm truncate">${s.name}</div>
                                        <div class="text-[10px] font-medium text-slate-400">${s.className}</div>
                                    </div>
                                    <div class="flex items-center gap-1.5">
                                        <div class="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div class="h-full rounded-full" style="width:${(s.average / 20) * 100}%; background:${s.average >= 15 ? '#0ea5e9' : s.average >= 12 ? '#22c55e' : s.average >= 10 ? '#84cc16' : '#ef4444'}"></div>
                                        </div>
                                        <span class="font-bold text-sm ${s.average >= 10 ? 'text-emerald-600' : 'text-red-500'} min-w-[48px] text-right">${s.average.toFixed(2)}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<div class="text-center py-8 text-slate-400 text-sm">Aucune donn\u00e9e de note disponible</div>'}
                </div>

                <!-- Anomalies & Alerts -->
                <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-2">
                            ${Icons.alert}
                            <h3 class="text-base font-bold text-slate-800">Alertes & Anomalies</h3>
                        </div>
                        <span class="text-xs font-bold px-2.5 py-1 rounded-lg ${anomalies.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}">${anomalies.length}</span>
                    </div>
                    ${anomalies.length > 0 ? `
                        <div class="space-y-2.5 max-h-[400px] overflow-y-auto custom-scrollbar">
                            ${anomalies.map(a => `
                                <div class="flex items-start gap-3 p-3 rounded-xl border ${a.type === 'critical' ? 'bg-red-50/50 border-red-100' : a.type === 'warning' ? 'bg-amber-50/50 border-amber-100' : 'bg-blue-50/50 border-blue-100'} transition-all hover:shadow-sm">
                                    <div class="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${a.type === 'critical' ? 'bg-red-100 text-red-600' : a.type === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}">
                                        ${a.type === 'critical' ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>' : a.type === 'warning' ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' : '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'}
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div class="font-bold text-sm ${a.type === 'critical' ? 'text-red-800' : a.type === 'warning' ? 'text-amber-800' : 'text-blue-800'}">${a.title}</div>
                                        <div class="text-xs ${a.type === 'critical' ? 'text-red-600' : a.type === 'warning' ? 'text-amber-600' : 'text-blue-600'} mt-0.5">${a.message}</div>
                                    </div>
                                    ${a.className ? `<button onclick="switchTab('grades')" class="shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg bg-white/80 border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-colors">Voir</button>` : ''}
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
    };

    // ============================================================
    // HELPER RENDERERS
    // ============================================================

    function renderKPICard(icon, label, value, textColor, bgColor, subtitle, extraContent) {
        return `
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow">
                <div class="flex items-start justify-between mb-3">
                    <div class="w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center ${textColor}">${icon}</div>
                    ${extraContent ? extraContent : ''}
                </div>
                <div class="text-2xl sm:text-3xl font-black ${textColor} tracking-tight">${value}</div>
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

    // Expose engine for external use
    window.DashboardEngine = DashboardEngine;
    window.DashboardCharts = Charts;

    console.log('[Dashboard] Module loaded');
})();
