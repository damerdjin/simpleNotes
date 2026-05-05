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

        // Check if we need final grades or regular grades
        const url = new URL(req.url, `http://${req.headers.host}`);
        const isFinalGrades = url.searchParams.get('type') === 'final';

        if (isFinalGrades) {
            return await handleFinalGrades(studentId, res);
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

    const formattedGrades = (rawGrades || []).map(g => ({
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
            is_visible: true
        }
    }));

    console.log(`[Student Grades] Trouvé ${formattedGrades.length} notes VISIBLES pour cet élève.`);

    return res.status(200).json({
        success: true,
        grades: formattedGrades
    });
}

async function handleFinalGrades(studentId, res) {
    console.log(`[Student Final Grades] Récupération des moyennes pour studentId: ${studentId}`);

    const { data: finalGrades, error } = await supabase
        .rpc('get_student_final_grades_for_dashboard', { p_student_id: studentId });

    if (error) {
        console.error('[Student Final Grades] RPC error:', error);
        return res.status(500).json({ error: 'Erreur lors de la récupération des notes finales.' });
    }

    return res.status(200).json({
        success: true,
        finalGrades: finalGrades || []
    });
}

export default allowCors(handler);