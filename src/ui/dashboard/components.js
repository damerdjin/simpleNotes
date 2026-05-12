function renderKPICard(icon, label, value, textColor, bgColor, subtitle, extraContent, animDelay = 0) {
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

export { renderKPICard, renderDonutLegend, getTypeBadgeClass };
