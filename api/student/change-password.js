import { supabase, allowCors } from '../_lib/supabase.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'default-secret-key-for-students';

async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 1. Vérifier le token
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

        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ error: 'Session expirée ou invalide.' });
        }
        
        if (decoded.role !== 'student') {
            return res.status(403).json({ error: 'Accès refusé.' });
        }

        const studentId = decoded.id;
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({ error: 'L\'ancien et le nouveau mot de passe sont requis.' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Le nouveau mot de passe doit faire au moins 6 caractères.' });
        }

        // 2. Récupérer les infos de l'élève
        const { data: students, error: fetchError } = await supabase
            .rpc('get_student_auth_info', { p_student_id: studentId });

        if (fetchError || !students || students.length === 0) {
            return res.status(500).json({ error: 'Erreur lors de la récupération du profil.' });
        }

        const student = students[0];
        let isOldPasswordValid = false;

        // 3. Vérifier l'ancien mot de passe
        if (student.custom_password) {
            isOldPasswordValid = await bcrypt.compare(oldPassword, student.custom_password);
        } else {
            // S'il n'avait pas de mot de passe personnalisé, on vérifie avec la date de naissance (AAAAMMJJ)
            if (oldPassword.length === 8 && !isNaN(Number(oldPassword))) {
                const year = oldPassword.substring(0, 4);
                const month = oldPassword.substring(4, 6);
                const day = oldPassword.substring(6, 8);
                const formattedBirthdate = `${day}/${month}/${year}`;

                isOldPasswordValid = student.birthdate === formattedBirthdate;
                
                if (!isOldPasswordValid && student.birthdate) {
                    const parts = student.birthdate.split('/');
                    if (parts.length === 3) {
                        const dbDay = String(parts[0]).padStart(2, '0');
                        const dbMonth = String(parts[1]).padStart(2, '0');
                        const dbYear = parts[2];
                        const normalizedDbDate = `${dbDay}/${dbMonth}/${dbYear}`;
                        isOldPasswordValid = normalizedDbDate === formattedBirthdate;
                    }
                }
            }
        }

        if (!isOldPasswordValid) {
            return res.status(401).json({ error: 'L\'ancien mot de passe est incorrect.' });
        }

        // 4. Hasher le nouveau mot de passe et l'enregistrer
        const salt = await bcrypt.genSalt(10);
        const hashedNewPassword = await bcrypt.hash(newPassword, salt);

        const { error: updateError } = await supabase
            .rpc('update_student_password', { 
                p_student_id: studentId, 
                p_new_password: hashedNewPassword 
            });

        if (updateError) {
            console.error('[Change Password] Update error:', updateError);
            return res.status(500).json({ error: 'Erreur lors de la mise à jour du mot de passe.' });
        }

        return res.status(200).json({ success: true, message: 'Mot de passe modifié avec succès.' });

    } catch (err) {
        console.error('Change password error:', err);
        return res.status(500).json({ error: 'Erreur interne du serveur.' });
    }
}

export default allowCors(handler);
