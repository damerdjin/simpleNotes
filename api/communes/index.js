const { supabase, allowCors } = require('../_lib/supabase');
const { asyncHandler } = require('../_lib/errorHandler');

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let query = supabase.from('communes').select('id, wilaya_id, name_fr').order('name_fr');

  if (req.query.wilaya_id) {
    query = query.eq('wilaya_id', req.query.wilaya_id);
  }

  const { data: communes, error } = await query;

  if (error) {
    console.error(error);
    throw new Error('Error fetching communes');
  }

  return res.status(200).json({ communes });
};

module.exports = allowCors(asyncHandler(handler));