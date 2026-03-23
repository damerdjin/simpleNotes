import { allowCors } from '../_lib/supabase.js';
import cookie from 'cookie';

async function handler(req, res) {
    // Nettoyer le cookie de session élève
    res.setHeader('Set-Cookie', cookie.serialize('student_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        expires: new Date(0), // Fait expirer le cookie immédiatement
        path: '/',
        sameSite: 'lax'
    }));

    return res.status(200).json({ success: true, message: 'Déconnecté' });
}

export default allowCors(handler);