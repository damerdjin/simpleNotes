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

        let grid = '';
        for (let i = 0; i <= 4; i++) {
            const val = Math.round((maxVal / 4) * i);
            const y = chartHeight - (i / 4) * chartHeight + 10;
            grid += `<line x1="15" y1="${y}" x2="${width - 15}" y2="${y}" stroke="#e2e8f0" stroke-width="0.5"/>`;
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
        const isOldFormat = seriesOrPoints[0] && seriesOrPoints[0].value !== undefined;
        if (isOldFormat) {
            return this._renderSingleLine(seriesOrPoints, width, height, '#6366f1');
        }
        const series = seriesOrPoints;
        const allValues = series.flatMap(s => s.data.map(p => p.value)).filter(v => v !== null);
        if (allValues.length === 0) return '<p class="text-slate-400 text-sm text-center py-8">Aucune donn\u00e9e</p>';
        const maxVal = Math.max(...allValues, 20);
        const minVal = 0;
        const chartH = height - 40;
        const chartW = width - 60;
        const maxPoints = Math.max(...series.map(s => s.data.filter(p => p.value !== null).length));
        const step = maxPoints > 1 ? chartW / (maxPoints - 1) : chartW;

        let grid = '';
        for (let i = 0; i <= 4; i++) {
            const val = Math.round((maxVal / 4) * i);
            const y = 10 + ((maxVal - val) / (maxVal - minVal)) * chartH;
            if (isFinite(y)) {
                grid += `<line x1="35" y1="${y}" x2="${width - 10}" y2="${y}" stroke="#e2e8f0" stroke-width="0.5" stroke-dasharray="3,3"/>`;
                grid += `<text x="33" y="${y + 3.5}" text-anchor="end" font-size="9" fill="#94a3b8">${val}</text>`;
            }
        }

        let linesSvg = '', endLabelsSvg = '', valLabelsSvg = '', labelsSvg = '', hoverSvg = '';

        const bestSeries = series.reduce((best, s) => {
            const avg = s.data.filter(p => p.value !== null).reduce((sum, p) => sum + p.value, 0) / s.data.filter(p => p.value !== null).length || 0;
            return avg > (best?.avg || -1) ? { ...s, avg } : best;
        }, null);

        const worstSeries = series.reduce((worst, s) => {
            const avg = s.data.filter(p => p.value !== null).reduce((sum, p) => sum + p.value, 0) / s.data.filter(p => p.value !== null).length || Infinity;
            return avg < (worst?.avg || Infinity) ? { ...s, avg } : worst;
        }, null);

        series.forEach((s, si) => {
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
            if (lastVal2 !== null && (isBest || isWorst)) {
                const labelColor = isBest ? '#059669' : '#dc2626';
                const icon = isBest ? '\u25B2' : '\u25BC';
                endLabelsSvg += '<text x="' + (lastX + 6) + '" y="' + (lastY + 4) + '" font-size="10" font-weight="800" fill="' + labelColor + '" class="prog-endlabel">' + icon + ' ' + lastVal2.toFixed(1) + '</text>';
            }

            s.data.forEach((p, i) => {
                if (p.value === null) return;
                const x = 40 + i * step;
                const y = 10 + ((maxVal - p.value) / (maxVal - minVal)) * chartH;
                valLabelsSvg += '<text x="' + x + '" y="' + (y - 8) + '" text-anchor="middle" font-size="9" font-weight="700" fill="' + color + '" class="prog-vlabel prog-vlabel-' + si + '" style="opacity:0;transition:opacity 0.15s;pointer-events:none">' + p.value.toFixed(1) + '</text>';
            });
            if (linePath) {
                hoverSvg += '<path d="' + linePath + '" fill="none" stroke="transparent" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" style="cursor:pointer" onmouseenter="window._progHover(this,' + si + ',true)" onmouseleave="window._progHover(this,' + si + ',false)"/>';
            }
        });

        const labels = series[0]?.data.map((p, i) => {
            const x = 40 + i * step;
            const label = p.label || '';
            return `<text x="${x}" y="${height - 5}" text-anchor="middle" font-size="9" fill="#94a3b8" font-weight="500">${label}</text>`;
        }).join('') || '';

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
            const val = Math.round((maxVal / 4) * i);
            const y = 10 + ((maxVal - val) / (maxVal - minVal)) * chartH;
            if (isFinite(y)) {
                grid += `<line x1="35" y1="${y}" x2="${width - 10}" y2="${y}" stroke="#e2e8f0" stroke-width="0.5" stroke-dasharray="3,3"/>`;
                grid += `<text x="33" y="${y + 3.5}" text-anchor="end" font-size="9" fill="#94a3b8">${val}</text>`;
            }
        }
        let linePath = '', areaPath = '', points = '', labels = '';
        dataPoints.forEach((p, i) => {
            if (p.value === null) return;
            const x = 40 + i * step;
            const y = 10 + ((maxVal - p.value) / (maxVal - minVal)) * chartH;
            if (!linePath) {
                linePath = 'M' + x + ',' + y;
                areaPath = 'M' + x + ',' + (height - 20);
            } else {
                linePath += ' L' + x + ',' + y;
            }
            areaPath += ' L' + x + ',' + y;
            points += '<circle cx="' + x + '" cy="' + y + '" r="4" fill="' + color + '" stroke="white" stroke-width="2" class="dash-line-dot"/>';
            if (labels && labels[i]) {
                labels += '<text x="' + x + '" y="' + (height - 5) + '" text-anchor="middle" font-size="9" fill="#94a3b8">' + labels[i] + '</text>';
            }
        });
        if (areaPath) areaPath += ' L' + (40 + (dataPoints.length - 1) * step) + ',' + (height - 20) + ' Z';
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

export { Charts, Icons };
