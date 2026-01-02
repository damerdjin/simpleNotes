const { supabase, allowCors } = require('../_lib/supabase');
const { getUserIdFromRequest } = require('../_lib/utils');
const { asyncHandler } = require('../_lib/errorHandler');

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await getUserIdFromRequest(req);

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, created_at')
    .eq('id', userId)
    .single();

  if (error || !user) {
    return res.status(401).json({ error: 'User not found' });
  }

  return res.status(200).json({ user });
};

module.exports = allowCors(asyncHandler(handler));
