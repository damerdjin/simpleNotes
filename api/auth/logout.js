const { clearAuthCookie } = require('../_lib/utils');
const { allowCors: allowCorsSupabase } = require('../_lib/supabase');
const { asyncHandler } = require('../_lib/errorHandler');

const handler = async (req, res) => {
    clearAuthCookie(res);
    return res.status(200).json({ message: 'Logged out' });
};

module.exports = allowCorsSupabase(asyncHandler(handler));
