import { supabase, allowCors } from '../_lib/supabase.js';
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

    } catch (err) {
        console.error('Student final grades fetch error:', err);
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Session expirée ou invalide.' });
        }
        return res.status(500).json({ error: 'Erreur interne du serveur.' });
    }
}

export default allowCors(handler);
