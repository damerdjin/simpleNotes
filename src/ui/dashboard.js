import { DashboardEngine } from './dashboard/engine.js';
import { Charts, Icons } from './dashboard/charts.js';
import { triggerDashboardAnimations } from './dashboard/animations.js';
import { renderKPICard, renderDonutLegend, getTypeBadgeClass } from './dashboard/components.js';

window.DashboardEngine = DashboardEngine;
window.DashboardCharts = Charts;

window._dashActiveView = 'overview';

function setDashView(view) {
    window._dashActiveView = view;
    document.querySelectorAll('#dashboard-nav .dash-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    document.querySelectorAll('[data-dash-view]').forEach(section => {
        const views = section.dataset.dashView.split(',');
        section.classList.toggle('hidden', !views.includes(view));
    });
}

window.initDashboard = function() {
    console.log('[Dashboard] Initialized');
};

window.invalidateDashboardCache = function() {
    if (DashboardEngine) {
        DashboardEngine._gradeConfigsCache = null;
        DashboardEngine._gradeConfigsCacheKey = null;
    }
};

window.renderDashboard = async function() {
    const container = document.getElementById('dashboard-content');
    if (!container) return;

    await DashboardEngine.loadGradeConfigs();

    const classes = DashboardEngine.getClasses();
    const genderStats = DashboardEngine.getGenderStats();
    const typeDist = DashboardEngine.getAssignmentTypeDistribution();
    const anomalies = DashboardEngine.getAnomalies();
    const classStats = DashboardEngine.getClassDetailedStats();
    const gradeDist = DashboardEngine.getGradeDistribution();
    const progression = DashboardEngine.getTrimesterProgression('all');
    const progressionDev = DashboardEngine.getTrimesterProgression('dev');
    const progressionComp = DashboardEngine.getTrimesterProgression('comp');
    const totalAssignments = Object.values(typeDist).reduce((a, b) => a + b, 0);
    const globalCompletion = classes.length > 0
        ? Math.round(classStats.reduce((s, c) => s + c.completionRate, 0) / classes.length)
        : 0;
    const avgRanking = DashboardEngine.getClassAveragesRanking();
    const bestClass = avgRanking.best;
    const worstClass = avgRanking.worst;

    const completionColor = globalCompletion >= 80 ? '#22c55e' : globalCompletion >= 50 ? '#eab308' : '#ef4444';
    const { year, trimester } = DashboardEngine._getFilters();
    const periodLabel = `T${trimester || '?'} ${year || ''}`;

    // Update alert badge in nav
    const alertBadge = document.getElementById('dash-alert-badge');
    if (alertBadge) {
        const criticalCount = anomalies.filter(a => a.type === 'critical').length;
        if (criticalCount > 0) {
            alertBadge.textContent = criticalCount;
            alertBadge.classList.remove('hidden');
        } else if (anomalies.length > 0) {
            alertBadge.textContent = anomalies.length;
            alertBadge.classList.remove('hidden');
        } else {
            alertBadge.classList.add('hidden');
        }
    }

    // Bind nav buttons
    document.querySelectorAll('#dashboard-nav .dash-nav-btn').forEach(btn => {
        btn.onclick = () => setDashView(btn.dataset.view);
    });

    // ============================================================
    // ALERT CENTER HTML (moved to top!)
    // ============================================================
    const alertCenterHtml = anomalies.length > 0 ? `
        <div class="space-y-2.5 max-h-[320px] overflow-y-auto custom-scrollbar">
            ${anomalies.map((a, ai) => `
                <div class="dash-anomaly flex items-start gap-3 p-3 rounded-xl border ${a.type === 'critical' ? 'bg-red-50/50 border-red-100' : a.type === 'warning' ? 'bg-amber-50/50 border-amber-100' : 'bg-blue-50/50 border-blue-100'} transition-all hover:shadow-sm" style="animation-delay:${ai * 0.04 + 0.1}s">
                    <div class="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${a.type === 'critical' ? 'bg-red-100 text-red-600' : a.type === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}">
                        ${a.type === 'critical' ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>' : a.type === 'warning' ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' : '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="font-bold text-sm ${a.type === 'critical' ? 'text-red-800' : a.type === 'warning' ? 'text-amber-800' : 'text-blue-800'}">${a.title}</div>
                        <div class="text-xs ${a.type === 'critical' ? 'text-red-600' : a.type === 'warning' ? 'text-amber-600' : 'text-blue-600'} mt-0.5">${a.message}</div>
                    </div>
                    ${a.className ? `<button onclick="window.invalidateDashboardCache(); switchTab('export'); setTimeout(() => { const sel = document.getElementById('select-class-export'); if(sel) { sel.value='${a.className.replace(/'/g, "\\'")}'; sel.dispatchEvent(new Event('change')); } }, 300)" class="shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg bg-white/80 border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-colors">Voir</button>` : ''}
                </div>
            `).join('')}
        </div>
    ` : `
        <div class="text-center py-8">
            <div class="w-14 h-14 mx-auto mb-2 rounded-full bg-emerald-50 flex items-center justify-center">
                <svg class="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <div class="font-bold text-emerald-700">Tout est en ordre</div>
            <div class="text-sm text-emerald-500 mt-1">Aucune anomalie d\u00e9tect\u00e9e</div>
        </div>
    `;

    container.innerHTML = `
        <!-- ALERT CENTER — REMONTÉ EN HAUT -->
        <div data-dash-view="alerts" class="dash-section bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 mb-6 ${anomalies.length === 0 ? 'border-emerald-100' : ''}" style="animation-delay:0ms">
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center ${anomalies.length > 0 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}">
                        ${Icons.alert}
                    </div>
                    <div>
                        <h3 class="text-sm font-bold text-slate-800">Alertes & Anomalies</h3>
                        <p class="text-[10px] text-slate-400 font-medium">Ce qui n\u00e9cessite votre attention</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    ${anomalies.filter(a => a.type === 'critical').length > 0 ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">${anomalies.filter(a => a.type === 'critical').length} critique${anomalies.filter(a => a.type === 'critical').length > 1 ? 's' : ''}</span>` : ''}
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-lg ${anomalies.length > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}">${anomalies.length}</span>
                </div>
            </div>
            ${alertCenterHtml}
        </div>

        <!-- PERIOD INDICATOR -->
        <div data-dash-view="overview,classes">
            <div class="flex items-center gap-2 mb-4 px-1">
                <div class="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    <span class="text-sm font-bold text-indigo-700">${periodLabel}</span>
                </div>
                <span class="text-xs text-slate-400 font-medium">Donn\u00e9es du trimestre s\u00e9lectionn\u00e9</span>
            </div>
        </div>

        <!-- KPI CARDS -->
        <div data-dash-view="classes">
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                ${renderKPICard(Icons.users, 'El\u00e8ves', genderStats.total, 'text-blue-600', 'bg-blue-50', `${classes.length} classes`, null, 0)}
                ${renderKPICard(Icons.clipboard, 'Devoirs', totalAssignments, 'text-violet-600', 'bg-violet-50', `${typeDist.comp} Comp / ${typeDist.tp || 0} TP / ${typeDist.cc || 0} CC`, null, 80)}
                ${renderKPICard(Icons.check, 'Compl\u00e9tion', globalCompletion + '%', 'text-emerald-600', 'bg-emerald-50', '', Charts.progressRing(globalCompletion, 52, 6, completionColor), 160)}
                ${renderKPICard(Icons.chart, 'Moyenne', bestClass ? bestClass.average.toFixed(1) + '/20' : '--', bestClass && bestClass.average >= 10 ? 'text-emerald-600' : bestClass ? 'text-red-600' : 'text-slate-400', bestClass && bestClass.average >= 10 ? 'bg-emerald-50' : bestClass ? 'bg-red-50' : 'bg-slate-50', bestClass ? `${bestClass.name} (meilleure)` : 'Aucune note', null, 240)}
            </div>
        </div>

        <!-- CHARTS ROW: Progression + Type Distribution -->
        <div data-dash-view="progression">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
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
                                Object.entries(levelMap).sort(([a],[b]) => a.localeCompare(b)).forEach(([level, classList]) => {
                                    classList.forEach(cls => {
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
        </div>

        <!-- CLASS TABLE + GRADE DISTRIBUTION -->
        <div data-dash-view="classes">
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
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
        </div>

        <!-- TOP STUDENTS + BOTTOM ALERTS -->
        <div data-dash-view="overview">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
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
                    <div class="flex flex-wrap gap-1.5 mb-3" id="top-type-buttons">
                        <button onclick="window._onTopTypeChange('')" data-type="" class="top-type-btn active text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer">Moy. G\u00e9n.</button>
                        <button onclick="window._onTopTypeChange('devoir')" data-type="devoir" class="top-type-btn text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer">Devoirs</button>
                        <button onclick="window._onTopTypeChange('cc')" data-type="cc" class="top-type-btn text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer">CC</button>
                        ${DashboardEngine.getAvailableGradeTypes().has('tp') ? '<button onclick="window._onTopTypeChange(\'tp\')" data-type="tp" class="top-type-btn text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer">TP</button>' : ''}
                        <button onclick="window._onTopTypeChange('comp')" data-type="comp" class="top-type-btn text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer">Compo</button>
                    </div>
                    <div class="flex flex-wrap items-center gap-2 mb-4">
                        <select id="top-filter-class" onchange="window._onTopClassChange()" class="text-xs font-medium rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-600 focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none cursor-pointer hover:border-slate-300 transition-colors">
                            <option value="">\u2b50 Toutes les classes</option>
                            ${classes.map(c => `<option value="${c}">${c}</option>`).join('')}
                        </select>
                        <select id="top-filter-level" onchange="window._onTopLevelChange()" class="text-xs font-medium rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-600 focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none cursor-pointer hover:border-slate-300 transition-colors">
                            <option value="">\ud83c\udfc6 Tous les niveaux</option>
                            ${DashboardEngine.getLevels().map(([val, label]) => `<option value="${val}">${label}</option>`).join('')}
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

                <!-- Bottom alert summary -->
                <div class="dash-section bg-white rounded-2xl border border-slate-100 shadow-sm p-5" style="animation-delay:900ms">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-2">
                            ${Icons.chart}
                            <h3 class="text-base font-bold text-slate-800">Synth\u00e8se Rapide</h3>
                        </div>
                    </div>
                    <div class="space-y-4">
                        <div class="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-transparent rounded-xl">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">${Icons.users}</div>
                                <div>
                                    <div class="text-sm font-bold text-slate-800">${genderStats.total} \u00c9l\u00e8ves</div>
                                    <div class="text-[10px] text-slate-400">R\u00e9partis dans ${classes.length} classes</div>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="text-xs font-bold text-blue-600">${genderStats.boys} gar\u00e7ons</div>
                                <div class="text-xs font-bold text-pink-600">${genderStats.girls} filles</div>
                            </div>
                        </div>
                        <div class="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-50 to-transparent rounded-xl">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">${Icons.check}</div>
                                <div>
                                    <div class="text-sm font-bold text-slate-800">Compl\u00e9tion globale</div>
                                    <div class="text-[10px] text-slate-400">Taux de saisie des notes</div>
                                </div>
                            </div>
                            <div class="text-2xl font-black ${globalCompletion >= 80 ? 'text-emerald-600' : globalCompletion >= 50 ? 'text-amber-600' : 'text-red-600'}">${globalCompletion}%</div>
                        </div>
                        ${bestClass ? `
                        <div class="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-transparent rounded-xl">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">${Icons.trophy}</div>
                                <div>
                                    <div class="text-sm font-bold text-slate-800">Meilleure classe</div>
                                    <div class="text-[10px] text-slate-400">${bestClass.name}</div>
                                </div>
                            </div>
                            <div class="text-2xl font-black text-amber-600">${bestClass.average.toFixed(1)}</div>
                        </div>
                        ` : ''}
                        ${anomalies.length > 0 ? `
                        <div class="flex items-center justify-between p-3 bg-gradient-to-r from-red-50 to-transparent rounded-xl">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">${Icons.alert}</div>
                                <div>
                                    <div class="text-sm font-bold text-slate-800">Anomalies</div>
                                    <div class="text-[10px] text-slate-400">${anomalies.filter(a => a.type === 'critical').length} critiques, ${anomalies.length} total</div>
                                </div>
                            </div>
                            <div class="flex items-center gap-1.5">
                                <span class="w-2 h-2 rounded-full ${anomalies.filter(a => a.type === 'critical').length > 0 ? 'bg-red-500' : 'bg-amber-400'}"></span>
                                <span class="text-xs font-bold text-slate-500">Action requise</span>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Trigger animations
    requestAnimationFrame(() => {
        triggerDashboardAnimations();
    });

    // Set initial nav state
    setDashView(window._dashActiveView);

    // Lazy load Top 5
    const topList = document.getElementById('top-students-list');
    if (topList && !topList.dataset.lazyLoaded) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    topList.dataset.lazyLoaded = '1';
                    observer.disconnect();
                    setTimeout(() => {
                        window._renderTopStudents();
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

window._topGradeType = '';

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

window._renderTopStudents = function() {
    const filterClass = document.getElementById('top-filter-class')?.value || '';
    const filterLevel = document.getElementById('top-filter-level')?.value || '';
    const gradeType = window._topGradeType;
    const topStudents = DashboardEngine.getTopStudents(5, filterClass, filterLevel, gradeType);
    const container = document.getElementById('top-students-list');
    if (!container) return;

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

window._onTopTypeChange = function(type) {
    window._topGradeType = type;
    window._renderTopStudents();
};

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

window._onTopLevelChange = function() {
    const selClass = document.getElementById('top-filter-class');
    const selLevel = document.getElementById('top-filter-level');
    if (!selClass || !selLevel) return;
    const chosenLevel = selLevel.value;
    const allClasses = DashboardEngine.getClasses();
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

window._resetTopFilters = function() {
    const selClass = document.getElementById('top-filter-class');
    const selLevel = document.getElementById('top-filter-level');
    if (!selClass || !selLevel) return;

    window._topGradeType = '';

    selClass.innerHTML = '<option value="">\u2b50 Toutes les classes</option>' +
        DashboardEngine.getClasses().map(c => `<option value="${c}">${c}</option>`).join('');
    selClass.value = '';

    selLevel.innerHTML = '<option value="">\ud83c\udfc6 Tous les niveaux</option>' +
        DashboardEngine.getLevels().map(([val, label]) => `<option value="${val}">${label}</option>`).join('');
    selLevel.value = '';

    window._renderTopStudents();
};

window._updateTopResetBtn = function() {
    const btn = document.getElementById('top-filter-reset');
    const selClass = document.getElementById('top-filter-class');
    const selLevel = document.getElementById('top-filter-level');
    if (!btn || !selClass || !selLevel) return;
    const hasFilter = window._topGradeType !== '' || selClass.value !== '' || selLevel.value !== '';
    btn.classList.toggle('hidden', !hasFilter);
    btn.classList.toggle('flex', hasFilter);
};

console.log('[Dashboard] Module loaded');
