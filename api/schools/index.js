const { supabase, allowCors } = require('../_lib/supabase');
const { asyncHandler } = require('../_lib/errorHandler');

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { city, wilaya } = req.query;

  let query = supabase
    .from('schools')
    .select('id, name, city, wilaya, approved')
    .eq('approved', true)
    .order('name');

  if (city) {
    query = query.ilike('city', `%${city}%`);
  }

  if (wilaya) {
    query = query.ilike('wilaya', `%${wilaya}%`);
  }

  const { data: schools, error } = await query;

  if (error) {
    console.error(error);
    throw new Error('Error fetching schools');
  }

  return res.status(200).json({ schools });
};

module.exports = allowCors(asyncHandler(handler));
