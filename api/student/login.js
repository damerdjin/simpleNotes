import { supabase, allowCors } from '../_lib/supabase.js';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';

const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'default-secret-key-for-students';

async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { nin, password } = req.body;

        if (!nin || !password) {
            return res.status(400).json({ error: 'NIN et mot de passe (date de naissance) requis.' });
        }

        // Le mot de passe attendu est YYYYMMDD, on le transforme en DD/MM/YYYY pour la recherche
        if (password.length !== 8 || isNaN(Number(password))) {
            return res.status(400).json({ error: 'Format du mot de passe invalide. Utilisez AAAAMMJJ.' });
        }

        const year = password.substring(0, 4);
        const month = password.substring(4, 6);
        const day = password.substring(6, 8);
        const formattedBirthdate = `${day}/${month}/${year}`;

        console.log(`[Student Login] Tentative connexion pour NIN: ${nin}`);
        
        // Recherche de l'élève via la fonction RPC sécurisée (qui bypass le RLS)
        // L'utilisation de supabase (avec la clé anon) fonctionnera car la fonction est SECURITY DEFINER
        const { data: students, error } = await supabase
            .rpc('check_student_login', { p_nin: nin });

        if (error) {
            console.error('[Student Login] Erreur RPC:', error.message);
            return res.status(500).json({ error: 'Erreur lors de la recherche des identifiants.' });
        }

        if (!students || students.length === 0) {
             console.log('[Student Login] Aucun élève trouvé pour ce NIN.');
             return res.status(401).json({ error: 'Identifiants incorrects.' });
        }

        const student = students[0];

        console.log(`[Student Login] Élève trouvé en base: ${student.first_name} ${student.last_name}, Date de naissance en base: ${student.birthdate}`);

        // Comparaison souple de la date de naissance (au cas où il y a des zéros manquants)
        // La date en base pourrait être "3/5/2000" au lieu de "03/05/2000"
        let isDateMatch = student.birthdate === formattedBirthdate;
        
        if (!isDateMatch && student.birthdate) {
            const parts = student.birthdate.split('/');
            if (parts.length === 3) {
                const dbDay = String(parts[0]).padStart(2, '0');
                const dbMonth = String(parts[1]).padStart(2, '0');
                const dbYear = parts[2];
                const normalizedDbDate = `${dbDay}/${dbMonth}/${dbYear}`;
                isDateMatch = normalizedDbDate === formattedBirthdate;
                console.log(`[Student Login] Comparaison normalisée: Base(${normalizedDbDate}) vs Saisi(${formattedBirthdate}) -> Match: ${isDateMatch}`);
            }
        }

        if (!isDateMatch) {
            console.log('[Student Login] Le mot de passe (date de naissance) ne correspond pas.');
            return res.status(401).json({ error: 'Identifiants incorrects (Date de naissance).' });
        }

        console.log('[Student Login] Authentification réussie !');

        // Créer un token
        const token = jwt.sign(
            { 
                id: student.id, 
                role: 'student',
                name: `${student.last_name} ${student.first_name}`,
                class_name: student.class_name
            },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        // Définir un cookie HTTP-only pour plus de sécurité (optionnel, mais recommandé)
        res.setHeader('Set-Cookie', cookie.serialize('student_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24 * 30, // 30 days
            path: '/',
            sameSite: 'lax'
        }));

        return res.status(200).json({ 
            success: true, 
            student: {
                id: student.id,
                name: `${student.last_name} ${student.first_name}`,
                className: student.class_name,
                academicYear: student.academic_year
            },
            token // Retourné pour usage localStorage au cas où
        });

    } catch (err) {
        console.error('Student login error:', err);
        return res.status(500).json({ error: 'Erreur interne du serveur.' });
    }
}

export default allowCors(handler);