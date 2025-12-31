(function() {
    // State to hold the import context
    let wizardState = {
        excelRows: [],
        excelClasses: [],
        onComplete: null,
        orphans: [],
        mapping: {} // appClass -> excelClass
    };

    // Helper: Levenshtein distance for fuzzy matching
    function levenshtein(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;

        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    }

    // Helper: Normalize string for comparison
    function normalize(str) {
        return String(str || '').trim().toLowerCase().replace(/\s+/g, ' ');
    }

    // --- Entry Point ---
    window.startImportWizard = function(excelRows, excelClasses, onComplete) {
        console.log("Starting Import Wizard...");
        wizardState.excelRows = excelRows;
        wizardState.excelClasses = excelClasses;
        wizardState.onComplete = onComplete;
        
        checkClassMapping();
    };

    // --- Step 1: Check Class Mapping ---
    function checkClassMapping() {
        const appClasses = window.getClasses ? window.getClasses() : [];
        const excelClasses = wizardState.excelClasses;

        // 1. Identify Orphans: Classes in App that are NOT strictly in Excel
        const orphans = appClasses.filter(ac => !excelClasses.includes(ac));

        console.log("App Classes:", appClasses);
        console.log("Excel Classes:", excelClasses);
        console.log("Orphans detected:", orphans);

        if (orphans.length === 0) {
            console.log("No orphans found. Proceeding strictly.");
            if (wizardState.onComplete) wizardState.onComplete();
            return;
        }

        // 2. Prepare Mapping & Auto-Suggestions
        wizardState.orphans = orphans;
        wizardState.mapping = {};

        orphans.forEach(ac => {
            // Try to find a suggestion
            let bestMatch = '';
            let bestDist = 999;
            const normAc = normalize(ac);

            for (const ec of excelClasses) {
                const normEc = normalize(ec);
                
                // Exact normalized match (e.g. "2M1" vs "2M1 ")
                if (normEc === normAc) {
                    bestMatch = ec;
                    bestDist = 0;
                    break;
                }

                // Fuzzy match
                const dist = levenshtein(normAc, normEc);
                if (dist < bestDist && dist < 4) { // Tolerance
                    bestDist = dist;
                    bestMatch = ec;
                }
            }
            
            if (bestMatch) {
                wizardState.mapping[ac] = bestMatch;
            }
        });

        renderMappingModal();
    }

    // --- UI: Render Modal ---
    function renderMappingModal() {
        const { orphans, mapping, excelClasses } = wizardState;

        const modalHtml = `
            <div id="import-wizard-modal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" style="backdrop-filter: blur(2px);">
                <div class="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
                    
                    <!-- Header -->
                    <div class="p-6 border-b bg-gray-50 rounded-t-xl">
                        <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <span>📋</span> Harmonisation des Classes
                        </h2>
                        <p class="text-gray-600 text-sm mt-1">
                            Certaines classes de l'application ne correspondent pas exactement au fichier Excel.
                            Veuillez les faire correspondre pour éviter les doublons.
                        </p>
                    </div>
                    
                    <!-- Content -->
                    <div class="p-6 overflow-y-auto">
                        <table class="w-full text-sm border-separate border-spacing-0 rounded-lg border overflow-hidden">
                            <thead class="bg-gray-100 text-gray-700">
                                <tr>
                                    <th class="p-3 text-left font-semibold border-b">Classe App (Orpheline)</th>
                                    <th class="p-3 text-center border-b w-8"></th>
                                    <th class="p-3 text-left font-semibold border-b">Correspondance Excel</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white">
                                ${orphans.map(ac => {
                                    const suggestion = mapping[ac] || '';
                                    return `
                                    <tr class="hover:bg-blue-50 transition-colors group">
                                        <td class="p-3 border-b font-medium text-red-600 bg-red-50/50 border-r border-r-transparent group-hover:border-r-blue-200">
                                            ${ac}
                                        </td>
                                        <td class="p-3 border-b text-center text-gray-400">➜</td>
                                        <td class="p-3 border-b">
                                            <select class="w-full p-2 border rounded-md shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none class-mapping-select transition-all" 
                                                data-app-class="${ac}"
                                                style="${suggestion ? 'border-color: #93c5fd; background-color: #eff6ff;' : ''}">
                                                
                                                <option value="">-- Conserver "${ac}" (Aucun changement) --</option>
                                                ${excelClasses.map(ec => `
                                                    <option value="${ec}" ${ec === suggestion ? 'selected' : ''}>
                                                        ${ec}
                                                    </option>
                                                `).join('')}
                                            </select>
                                        </td>
                                    </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                        <div class="mt-4 p-3 bg-blue-50 text-blue-800 text-xs rounded border border-blue-100 flex items-start gap-2">
                            <span>💡</span>
                            <div>
                                <strong>Conseil :</strong> Si une correspondance est suggérée (en bleu), vérifiez-la. 
                                Sinon, choisissez la classe Excel correspondante dans la liste. 
                                Si vous laissez "Conserver", la classe de l'application restera telle quelle.
                            </div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end gap-3">
                        <button id="wiz-btn-cancel" class="px-4 py-2 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors">
                            Annuler
                        </button>
                        <button id="wiz-btn-confirm" class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2">
                            Valider et Continuer
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Remove old if exists
        const old = document.getElementById('import-wizard-modal');
        if (old) old.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('wiz-btn-cancel').onclick = closeWizard;
        document.getElementById('wiz-btn-confirm').onclick = submitMapping;
    }

    function closeWizard() {
        const el = document.getElementById('import-wizard-modal');
        if (el) el.remove();
    }

    function submitMapping() {
        const selects = document.querySelectorAll('.class-mapping-select');
        const renames = [];

        selects.forEach(sel => {
            const appClass = sel.getAttribute('data-app-class');
            const target = sel.value;
            if (target && target !== appClass) {
                renames.push({ from: appClass, to: target });
            }
        });

        if (renames.length > 0) {
            applyRenames(renames);
        }

        closeWizard();
        if (wizardState.onComplete) wizardState.onComplete();
    }

    function applyRenames(renames) {
        const data = window.data;
        let count = 0;
        
        renames.forEach(({ from, to }) => {
            // Rename in Students
            data.students.forEach(s => {
                if (s.className === from) {
                    s.className = to;
                    count++;
                }
            });
            // Rename in Assignments
            if (data.assignments) {
                data.assignments.forEach(a => {
                    if (a.className === from) {
                        a.className = to;
                    }
                });
            }
        });

        console.log(`Renamed ${renames.length} classes affecting ${count} students.`);
        if (window.saveData) window.saveData();
        if (window.renderClassList) window.renderClassList();
    }

})();
