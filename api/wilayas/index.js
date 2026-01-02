const { supabase, allowCors } = require('../_lib/supabase');
const { asyncHandler } = require('../_lib/errorHandler');

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

module.exports = allowCors(asyncHandler(handler));