const { supabase, allowCors } = require('../_lib/supabase');
const { asyncHandler } = require('../_lib/errorHandler');

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { data: schools, error } = await supabase
    .from('schools')
    .select('id, name, city, wilaya, approved')
    .eq('approved', true) // Only show approved schools
    .order('name');

  if (error) {
    console.error(error);
    throw new Error('Error fetching schools');
  }

  return res.status(200).json({ schools });
};

module.exports = allowCors(asyncHandler(handler));
