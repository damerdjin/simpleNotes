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

function animateCounter(element, target, duration = 800, isDecimal = false, suffix = '') {
    if (!element) return;
    element.textContent = '0' + suffix;
    const start = 0;
    const startTime = performance.now();
    const adjustedDuration = Math.min(duration + target * 8, 2000);

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / adjustedDuration, 1);
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

function triggerDashboardAnimations() {
    document.querySelectorAll('.dash-counter[data-target]').forEach(el => {
        const target = parseFloat(el.dataset.target);
        const isDecimal = el.dataset.decimal === 'true';
        const suffix = el.dataset.suffix || '';
        animateCounter(el, target, 800, isDecimal, suffix);
    });

    document.querySelectorAll('.dash-animated-ring[data-target-offset]').forEach(ring => {
        const targetOffset = parseFloat(ring.dataset.targetOffset);
        const fullOffset = parseFloat(ring.dataset.fullOffset || targetOffset * 2);
        ring.style.strokeDashoffset = fullOffset;
        ring.getBoundingClientRect();
        ring.style.strokeDashoffset = targetOffset;
    });

    document.querySelectorAll('.dash-line-path').forEach(path => {
        const length = path.getTotalLength ? path.getTotalLength() : 500;
        path.style.opacity = '1';
        path.style.strokeDasharray = length;
        path.style.strokeDashoffset = length;
        path.getBoundingClientRect();
        path.style.transition = 'stroke-dashoffset 2.5s cubic-bezier(0.16, 1, 0.3, 1)';
        path.style.strokeDashoffset = '0';
    });

    document.querySelectorAll('.dash-donut-segment[data-target-offset]').forEach((circle, i) => {
        const targetOffset = parseFloat(circle.dataset.targetOffset);
        const circ = parseFloat(circle.dataset.circ || circle.getAttribute('stroke-dasharray'));
        circle.style.strokeDashoffset = circ;
        circle.getBoundingClientRect();
        circle.style.transition = `stroke-dashoffset 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.15}s`;
        circle.style.strokeDashoffset = targetOffset;
        setTimeout(() => circle.classList.add('animated'), i * 150 + 50);
    });

    document.querySelectorAll('.dash-bar-rect').forEach((rect, i) => {
        rect.style.animationDelay = (i * 0.08) + 's';
    });

    document.querySelectorAll('.dash-table-row').forEach((row, i) => {
        row.style.animationDelay = (i * 0.04 + 0.2) + 's';
    });

    document.querySelectorAll('.dash-top-student').forEach((item, i) => {
        item.style.animationDelay = (i * 0.08 + 0.3) + 's';
    });

    document.querySelectorAll('.dash-anomaly').forEach((item, i) => {
        item.style.animationDelay = (i * 0.06 + 0.2) + 's';
    });

    document.querySelectorAll('.dash-gender-card').forEach((card, i) => {
        card.style.animationDelay = (i * 0.1 + 0.4) + 's';
    });
}

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

export { animateCounter, triggerDashboardAnimations };
