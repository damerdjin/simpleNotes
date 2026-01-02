const { supabase, allowCors } = require('../_lib/supabase');
const { asyncHandler } = require('../_lib/errorHandler');

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

module.exports = allowCors(asyncHandler(handler));
