import { supabase, allowCors } from '../_lib/supabase.js';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'default-secret-key-for-students';

async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const authHeader = req.headers.authorization;
        let token = '';

        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        } else if (req.cookies && req.cookies.student_token) {
            token = req.cookies.student_token;
        }

        if (!token) {
            return res.status(401).json({ error: 'Non autorisé.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        if (decoded.role !== 'student') {
            return res.status(403).json({ error: 'Accès refusé.' });
        }

        const studentId = decoded.id;
        const className = decoded.class_name;

        // Check if we need final grades or regular grades
        const url = new URL(req.url, `http://${req.headers.host}`);
        const isFinalGrades = url.searchParams.get('type') === 'final';
        const academicYear = url.searchParams.get('academicYear') || '';

        if (isFinalGrades) {
            return await handleFinalGrades(studentId, className, academicYear, res);
        }

        return await handleRegularGrades(studentId, res);

    } catch (err) {
        console.error('Student grades fetch error:', err);
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Session expirée ou invalide.' });
        }
        return res.status(500).json({ error: 'Erreur interne du serveur.' });
    }
}

async function handleRegularGrades(studentId, res) {
    console.log(`[Student Grades] Récupération des notes via RPC pour studentId: ${studentId}`);

    const { data: rawGrades, error } = await supabase
        .rpc('get_student_visible_grades', { p_student_id: studentId });

    if (error) {
        console.error('[Student Grades] RPC query error:', error);
        return res.status(500).json({ error: 'Erreur lors de la récupération des notes.' });
    }

    console.log(`[Student Grades] Trouvé ${rawGrades?.length || 0} notes VISIBLES pour cet élève.`);
    if (rawGrades && rawGrades.length > 0) {
        console.log(`[Student Grades] IDs des notes de l'élève:`, rawGrades.map(g => `${g.assignment_subject}: ${g.assignment_id}`).join(', '));
    }

    const formattedGrades = (rawGrades || []).map(g => {
        // Inferrer le type depuis le nom si nécessaire
        let type = 'Devoir';
        const name = (g.assignment_name || '').toLowerCase();
        if (name.includes('cc') || name.includes('continu')) type = 'CC';
        else if (name.includes('tp') || name.includes('travaux')) type = 'TP';
        else if (name.includes('comp') || name.includes('compo')) type = 'Composition';

        return {
            id: g.id,
            score_final: g.score_final,
            score_max: g.score_max,
            updated_at: g.updated_at,
            grade_date: g.grade_date,
            comments: g.comments,
            class_avg: g.class_avg,
            class_max: g.class_max,
            class_min: g.class_min,
            assignments: {
                id: g.assignment_id,
                name: g.assignment_name,
                subject: g.assignment_subject,
                trimester: g.assignment_trimester,
                academic_year: g.academic_year,
                type: type,
                is_visible: true
            }
        };
    });

    console.log(`[Student Grades] Trouvé ${formattedGrades.length} notes VISIBLES pour cet élève.`);

    return res.status(200).json({
        success: true,
        grades: formattedGrades
    });
}

function computeDevoirGroup(cfg, gradeMap, assignMap, groupKey) {
    const group = cfg[groupKey];
    if (!group || !group.assignmentIds || group.assignmentIds.length === 0) return null;

    const outMax = cfg.out_max || 20;
    const normalize = group.normalize !== false;
    const targetMax = group.targetMax || outMax;
    const combine = group.combine || 'sum';

    const ids = group.assignmentIds.filter(Boolean);
    if (ids.length === 0) return null;

    const entries = ids.map(id => {
        const grade = gradeMap[id];
        if (!grade || grade.score_final == null || grade.score_max == null || grade.score_max <= 0) return null;
        return { score: grade.score_final, max: grade.score_max };
    }).filter(e => e !== null);

    if (entries.length === 0) return null;

    if (combine === 'avg') {
        if (normalize) {
            const percents = entries.map(e => e.score / e.max);
            const avgP = percents.reduce((s, p) => s + p, 0) / percents.length;
            return avgP * targetMax;
        }
        return entries.reduce((s, e) => s + e.score, 0) / entries.length;
    }

    if (combine === 'max') {
        if (normalize) {
            const percents = entries.map(e => e.score / e.max);
            const maxP = Math.max(...percents);
            return maxP * targetMax;
        }
        return Math.max(...entries.map(e => e.score));
    }

    // sum (default)
    const sumScore = entries.reduce((s, e) => s + e.score, 0);
    const sumMax = entries.reduce((s, e) => s + e.max, 0);
    if (normalize && sumMax > 0) return (sumScore / sumMax) * targetMax;
    return sumScore;
}

function computeDevoirFinal(cfg, gradeMap, assignMap) {
    const d1 = computeDevoirGroup(cfg, gradeMap, assignMap, 'devoir1_config');
    const d2 = computeDevoirGroup(cfg, gradeMap, assignMap, 'devoir2_config');
    if (d1 === null && d2 === null) return null;
    if (d1 !== null && d2 !== null) return (d1 + d2) / 2;
    return d1 !== null ? d1 : d2;
}

function normalizeScore(grade, outMax) {
    if (!grade || grade.score_final == null || grade.score_max == null || grade.score_max <= 0) return null;
    return (grade.score_final / grade.score_max) * (outMax || 20);
}

async function handleFinalGrades(studentId, className, academicYear, res) {
    console.log(`[Student Final Grades] Calcul à la volée pour studentId: ${studentId}, class: ${className}, year: ${academicYear}`);

    if (!academicYear) {
        // Try to get academicYear from the student record
        const { data: student } = await supabase
            .from('students')
            .select('academic_year')
            .eq('id', studentId)
            .single();
        academicYear = student?.academic_year || '';
    }

    // Normalisation du nom de la classe (gestion des doubles espaces fréquents)
    const normalizedClassName = className ? className.trim().replace(/\s+/g, ' ') : '';
    const normalizedYear = academicYear ? academicYear.trim() : '';

    console.log(`[Student Final Grades] Recherche configs pour: "${normalizedClassName}" (${normalizedYear})`);

    if (!normalizedClassName || !normalizedYear) {
        console.log('[Student Final Grades] Nom de classe ou année manquante.');
        return res.status(200).json({ success: true, finalGrades: [] });
    }

    // 1. Get ALL configs without any filter to see what's in there
    let { data: allConfigs, error: configsError } = await supabase
        .from('grade_calculation_configs')
        .select('*');

    if (configsError) {
        console.error('[Student Final Grades] Configs error:', configsError);
        return res.status(500).json({ error: 'Erreur lors de la récupération des configurations.' });
    }

    console.log(`[Student Final Grades] TOTAL lignes dans la table: ${allConfigs?.length || 0}`);

    // Filtrage manuel ultra-souple (ignore tous les espaces)
    const simplify = (str) => str ? str.replace(/\s+/g, '').trim() : '';
    const targetSimple = simplify(className);
    const targetYear = normalizedYear;

    let configs = (allConfigs || []).filter(c =>
        simplify(c.class_name) === targetSimple &&
        simplify(c.academic_year) === simplify(targetYear) &&
        c.is_published === true
    );

    if (!configs || configs.length === 0) {
        console.log(`[Student Final Grades] AUCUNE CONFIG TROUVÉE après filtrage manuel.`);
        return res.status(200).json({ success: true, finalGrades: [] });
    }

    console.log(`[Student Final Grades] ${configs.length} config(s) trouvée(s).`);

    // 2. Collect all assignment IDs from all configs
    const allAssignmentIds = new Set();
    configs.forEach(cfg => {
        if (cfg.cc_assignment_id) allAssignmentIds.add(cfg.cc_assignment_id);
        if (cfg.tp_assignment_id) allAssignmentIds.add(cfg.tp_assignment_id);
        if (cfg.comp_assignment_id) allAssignmentIds.add(cfg.comp_assignment_id);

        const d1 = cfg.devoir1_config;
        if (d1 && d1.assignmentIds) d1.assignmentIds.forEach(id => allAssignmentIds.add(id));

        const d2 = cfg.devoir2_config;
        if (d2 && d2.assignmentIds) d2.assignmentIds.forEach(id => allAssignmentIds.add(id));
    });

    const assignmentIds = [...allAssignmentIds].filter(Boolean);
    if (assignmentIds.length === 0) {
        return res.status(200).json({ success: true, finalGrades: [] });
    }
    console.log('[Student Final Grades] Searching for assignmentIds:', JSON.stringify(assignmentIds));

    // Sample check: what's in the assignments table?
    const { data: sampleAssigns } = await supabase.from('assignments').select('id').limit(3);
    console.log('[Student Final Grades] Sample assignments IDs from DB:', JSON.stringify(sampleAssigns?.map(a => a.id)));

    // 3. Get assignments details (subject)
    const { data: assignments, error: assignErr } = await supabase
        .from('assignments')
        .select('id, subject')
        .in('id', assignmentIds);

    if (assignErr) console.error('[Student Final Grades] Error fetching assignments:', assignErr);
    console.log(`[Student Final Grades] Assignments found in DB: ${assignments?.length || 0} for ${assignmentIds.length} requested IDs`);

    const assignMap = {};
    (assignments || []).forEach(a => {
        assignMap[a.id] = a;
    });

    // 4. Get the student's grades for these assignments
    const { data: grades, error: gradesErr } = await supabase
        .from('grades')
        .select('assignment_id, score_final, score_max')
        .eq('student_id', studentId)
        .in('assignment_id', assignmentIds);

    if (gradesErr) console.error('[Student Final Grades] Error fetching grades:', gradesErr);
    console.log(`[Student Final Grades] Student grades found in DB: ${grades?.length || 0} (StudentId: ${studentId})`);

    const gradeMap = {};
    (grades || []).forEach(g => {
        gradeMap[g.assignment_id] = g;
    });
    console.log(`[Student Final Grades] GradeMap keys:`, Object.keys(gradeMap).join(', '));

    // 5. Calculate averages for each config (one per subject per teacher)
    const results = configs.map(cfg => {
        const outMax = cfg.out_max || 20;

        const ccScore = normalizeScore(gradeMap[cfg.cc_assignment_id], outMax);
        const tpScore = cfg.tp_assignment_id ? normalizeScore(gradeMap[cfg.tp_assignment_id], outMax) : null;
        const compScore = normalizeScore(gradeMap[cfg.comp_assignment_id], outMax);
        const devoirScore = computeDevoirFinal(cfg, gradeMap, assignMap);

        // Use subject from config or fallback to assignment subject
        let subject = cfg.subject || '';
        if (!subject) {
            const subjectAssign = assignMap[cfg.comp_assignment_id] || assignMap[cfg.cc_assignment_id] || assignMap[cfg.tp_assignment_id] || null;
            subject = subjectAssign?.subject || '';
        }

        // Calculate moyenne
        let moyenne = null;
        const hasTP = !!cfg.tp_assignment_id;
        if (ccScore !== null && devoirScore !== null && compScore !== null && (!hasTP || tpScore !== null)) {
            if (hasTP) {
                moyenne = (devoirScore + ccScore + tpScore + 2 * compScore) / 5;
            } else {
                moyenne = (devoirScore + ccScore + 2 * compScore) / 4;
            }
        }

        const resObj = {
            trimester: cfg.trimester || 'T1',
            class_name: className,
            subject: subject,
            academic_year: academicYear,
            cc_score: ccScore !== null ? Math.round(ccScore * 100) / 100 : null,
            tp_score: tpScore !== null ? Math.round(tpScore * 100) / 100 : null,
            comp_score: compScore !== null ? Math.round(compScore * 100) / 100 : null,
            devoir_score: devoirScore !== null ? Math.round(devoirScore * 100) / 100 : null,
            moyenne: moyenne !== null ? Math.round(moyenne * 100) / 100 : null,
            observation: '',
            advice: '',
            updated_at: new Date().toISOString()
        };

        console.log(`[Student Final Grades] Result for ${subject}:`, JSON.stringify(resObj, null, 2));
        return resObj;
    }).filter(r => {
        const hasData = r.cc_score !== null || r.devoir_score !== null || r.comp_score !== null;
        if (!hasData) console.log(`[Student Final Grades] Skipping ${r.subject} because no grades found.`);
        return hasData;
    });

    console.log(`[Student Final Grades] ${results.length} moyennes calculées pour ${configs.length} config(s)`);

    return res.status(200).json({
        success: true,
        finalGrades: results
    });
}

export default allowCors(handler);