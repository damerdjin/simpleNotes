import { supabase, allowCors } from '../_lib/supabase.js';
import { asyncHandler } from '../_lib/errorHandler.js';

const handler = async (req, res) => {
  if (req.method === 'POST') {
    const { name, commune_id } = req.body || {};
    if (!name || !commune_id) {
      return res.status(400).json({ error: 'name and commune_id are required' });
    }

    const { data: school, error } = await supabase
      .from('schools')
      .insert([{ name, commune_id, approved: false }])
      .select('id, name')
      .single();

    if (error) {
      console.error('Create school error:', error);
      return res.status(500).json({ error: 'Error creating school' });
    }

    return res.status(201).json({ school });
  }

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

