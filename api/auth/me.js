import { supabase, allowCors } from '../_lib/supabase.js';
import { getUserIdFromRequest } from '../_lib/utils.js';
import { asyncHandler } from '../_lib/errorHandler.js';

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

export default allowCors(asyncHandler(handler));

