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

    // Helper: Calculate token overlap score (0 to 1)
    function calculateTokenOverlap(str1, str2) {
        const tokens1 = normalize(str1).split(' ').filter(t => t.length > 0);
        const tokens2 = normalize(str2).split(' ').filter(t => t.length > 0);

        if (tokens1.length === 0 || tokens2.length === 0) return 0;

        const set1 = new Set(tokens1);
        const set2 = new Set(tokens2);

        let matchCount = 0;
        set1.forEach(t => { if (set2.has(t)) matchCount++; });

        // Score based on how much of the SHORTER name is present in the LONGER name
        // Example: "Nourine Taha Abdelmalek" (4) vs "Nourine Abdelmalek" (3)
        // Intersection: 3. MinLength: 3. Score: 1.0 (Perfect subset)
        
        const minLen = Math.min(tokens1.length, tokens2.length);
        return matchCount / minLen;
    }

    // --- Entry Point ---
    window.startImportWizard = async function(excelRows, excelClasses, onComplete) {
        console.log("Starting Import Wizard...");
        wizardState.excelRows = excelRows;
        wizardState.excelClasses = excelClasses;
        wizardState.onComplete = onComplete;
        
        await checkClassMapping();
    };

    // --- Step 1: Check Class Mapping ---
    async function checkClassMapping() {
        const appClasses = window.getClasses ? await window.getClasses() : [];
        const excelClasses = wizardState.excelClasses;

        // 1. Identify Orphans: Classes in App that are NOT strictly in Excel
        const orphans = appClasses.filter(ac => !excelClasses.includes(ac));

        console.log("App Classes:", appClasses);
        console.log("Excel Classes:", excelClasses);
        console.log("Orphans detected:", orphans);

        if (orphans.length === 0) {
            console.log("No orphans found. Proceeding strictly.");
            checkStudentMatching();
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

    // --- Step 2: Check Student Matching ---
    function checkStudentMatching() {
        const { excelRows, excelClasses } = wizardState;
        const appStudents = window.data.students || [];
        const studentMatches = []; // [{ excelIndex, appStudentId, excelName, appName, score }]
        
        // Build map of app students by class (normalized)
        const appStudentsByClass = {};
        appStudents.forEach(s => {
            const c = normalize(s.className);
            if (!appStudentsByClass[c]) appStudentsByClass[c] = [];
            appStudentsByClass[c].push(s);
        });

        excelRows.forEach((row, index) => {
            // Skip empty rows
            if (!row || (!row.lastName && !row.firstName)) return;

            const excelName = (row.lastName + ' ' + row.firstName).trim();
            const excelClass = row.className;
            const normExcelClass = normalize(excelClass);

            // Determine Target Class (App Class)
            // Note: If class was renamed in Step 1, it's already updated in App Data.
            // But excelClass is from the file.
            // So we look for App Students in 'excelClass' (since we renamed them to match Excel)
            
            // Wait! If we renamed "2M1 (old)" to "2M1 (Excel)", then app students are now in "2M1 (Excel)".
            // So we can look directly in appStudentsByClass[normExcelClass].
            
            const candidates = appStudentsByClass[normExcelClass] || [];
            
            // 1. Check Exact Match (RegNum, NIN) - Standard Logic would handle this, but we want to exclude them from "Proposals"
            const exactMatch = candidates.find(s => 
                (row.regNumber && s.regNumber == row.regNumber) || 
                (row.nin && s.nin == row.nin) ||
                (normalize(s.name) === normalize(excelName))
            );

            if (exactMatch) return; // Already perfectly matched

            // 2. Check Fuzzy/Partial Match
            const normExcelLast = normalize(row.lastName);
            
            const potentials = candidates.filter(s => {
                // Method A: Legacy First Name Check (if LastName strictly matches)
                const normAppLast = normalize(s.lastName);
                if (normAppLast === normExcelLast) {
                    const appFirst = normalize(s.firstName);
                    const excelFirst = normalize(row.firstName);
                    if (!appFirst) return true;
                    if (excelFirst.startsWith(appFirst) || appFirst.startsWith(excelFirst)) return true;
                }

                // Method B: Full Name Token Overlap (Handles "Nourine Taha Abdelmalek" vs "Nourine Abdelmalek")
                const appFullName = s.name || (s.lastName + ' ' + s.firstName);
                const overlapScore = calculateTokenOverlap(appFullName, excelName);
                
                // If the shorter name is FULLY contained in the longer name (score === 1), it's a very strong match.
                // We also accept 0.75+ to account for minor typos if names are long enough.
                if (overlapScore >= 0.8) return true;

                return false;
            });

            if (potentials.length === 1) {
                // Single candidate found!
                const match = potentials[0];
                studentMatches.push({
                    excelIndex: row.originalIndex,
                    appStudent: match,
                    excelRow: row,
                    confidence: !match.firstName ? 'high' : 'medium'
                });
            }
            // If multiple potentials, it's ambiguous -> Skip or Show?
            // For now, let's only handle the "Single Candidate" case to be safe and simple.
        });

        if (studentMatches.length === 0) {
            finishWizard();
            return;
        }

        wizardState.studentMatches = studentMatches;
        renderStudentMatchingModal();
    }

    function renderStudentMatchingModal() {
        const { studentMatches } = wizardState;

        const modalHtml = `
            <div id="import-wizard-modal-student" class="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" style="backdrop-filter: blur(2px);">
                <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
                    
                    <!-- Header -->
                    <div class="p-6 border-b bg-gray-50 rounded-t-xl">
                        <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <span>👥</span> Harmonisation des Élèves
                        </h2>
                        <p class="text-gray-600 text-sm mt-1">
                            Nous avons détecté des élèves existants qui semblent correspondre à ceux du fichier Excel.
                            Confirmez-vous qu'il s'agit des mêmes personnes ?
                        </p>
                    </div>
                    
                    <!-- Content -->
                    <div class="p-0 overflow-y-auto">
                        <table class="w-full text-sm border-separate border-spacing-0">
                            <thead class="bg-gray-100 text-gray-700 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th class="p-3 text-left font-semibold border-b pl-6">Élève Existant (App)</th>
                                    <th class="p-3 text-center border-b w-8"></th>
                                    <th class="p-3 text-left font-semibold border-b">Élève Importé (Excel)</th>
                                    <th class="p-3 text-center border-b w-24">Action</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-100">
                                ${studentMatches.map((match, idx) => `
                                    <tr class="hover:bg-blue-50 transition-colors group">
                                        <td class="p-4 pl-6">
                                            <div class="font-bold text-gray-800">${match.appStudent.name}</div>
                                            <div class="text-xs text-gray-500">
                                                Classe: ${match.appStudent.className} 
                                                ${match.appStudent.nin ? `| NIN: ${match.appStudent.nin}` : ''}
                                            </div>
                                        </td>
                                        <td class="p-4 text-center text-blue-400 font-bold">➜</td>
                                        <td class="p-4">
                                            <div class="font-bold text-blue-700">
                                                ${match.excelRow.lastName} ${match.excelRow.firstName}
                                            </div>
                                            <div class="text-xs text-blue-600/70">
                                                Classe: ${match.excelRow.className}
                                                ${match.excelRow.nin ? `| NIN: ${match.excelRow.nin}` : ''}
                                                ${match.excelRow.birthDate ? `| Né(e): ${match.excelRow.birthDate}` : ''}
                                            </div>
                                        </td>
                                        <td class="p-4 text-center">
                                            <label class="inline-flex items-center cursor-pointer">
                                                <input type="checkbox" class="student-match-checkbox w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 transition-all" 
                                                    data-index="${idx}" checked>
                                            </label>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- Footer -->
                    <div class="p-4 border-t bg-gray-50 rounded-b-xl flex justify-between items-center">
                        <div class="text-xs text-gray-500 italic">
                            Décochez les lignes qui ne correspondent PAS à la même personne.
                        </div>
                        <div class="flex gap-3">
                            <button id="wiz-student-cancel" class="px-4 py-2 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors">
                                Ignorer Tout
                            </button>
                            <button id="wiz-student-confirm" class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2">
                                Valider les Correspondances
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const old = document.getElementById('import-wizard-modal-student');
        if (old) old.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('wiz-student-cancel').onclick = () => {
            closeStudentModal();
            finishWizard();
        };
        document.getElementById('wiz-student-confirm').onclick = submitStudentMatching;
    }

    function closeStudentModal() {
        const el = document.getElementById('import-wizard-modal-student');
        if (el) el.remove();
    }

    function submitStudentMatching() {
        const checkboxes = document.querySelectorAll('.student-match-checkbox');
        const finalMapping = {}; // excelIndex -> appStudentId

        checkboxes.forEach(cb => {
            if (cb.checked) {
                const idx = parseInt(cb.getAttribute('data-index'));
                const match = wizardState.studentMatches[idx];
                finalMapping[match.excelIndex] = match.appStudent.id;
            }
        });

        console.log("Confirmed Student Matches:", finalMapping);
        closeStudentModal();
        finishWizard(finalMapping);
    }

    function finishWizard(studentMapping = {}) {
        if (wizardState.onComplete) wizardState.onComplete(studentMapping);
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
        
        // Proceed to Step 2: Student Matching
        checkStudentMatching();
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
