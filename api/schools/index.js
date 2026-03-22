import { supabase, allowCors } from '../_lib/supabase.js';
import { asyncHandler } from '../_lib/errorHandler.js';

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { commune_id } = req.query;

  let query = supabase
    .from('schools')
    .select('id, name, commune_id, approved')
    .eq('approved', true)
    .order('name');

  if (commune_id) {
    query = query.eq('commune_id', commune_id);
  }

  const { data: schools, error } = await query;

  if (error) {
    console.error(error);
    throw new Error('Error fetching schools');
  }

  return res.status(200).json({ schools });
};

export default allowCors(asyncHandler(handler));

