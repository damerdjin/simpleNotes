import { clearAuthCookie } from '../_lib/utils.js';
import { allowCors as allowCorsSupabase } from '../_lib/supabase.js';
import { asyncHandler } from '../_lib/errorHandler.js';

const handler = async (req, res) => {
    clearAuthCookie(res);
    return res.status(200).json({ message: 'Logged out' });
};

export default allowCorsSupabase(asyncHandler(handler));

