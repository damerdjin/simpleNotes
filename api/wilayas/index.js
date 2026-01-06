import { supabase, allowCors } from '../_lib/supabase.js';
import { asyncHandler } from '../_lib/errorHandler.js';

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { data: wilayas, error } = await supabase
    .from('wilayas')
    .select('id, code, name_fr')
    .order('code');

  if (error) {
    console.error(error);
    throw new Error('Error fetching wilayas');
  }

  return res.status(200).json({ wilayas });
};

export default allowCors(asyncHandler(handler));
