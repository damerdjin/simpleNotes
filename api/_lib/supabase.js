const { createClient } = require('@supabase/supabase-js');

// Helper to handle CORS locally if needed, though Vercel handles it via vercel.json usually.
// But for safety:
const allowCors = (fn) => async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  // Reflect origin for credentials support
  const origin = req.headers.origin || req.headers.host;
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  return await fn(req, res);
};

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  // Warn but don't crash immediately, to allow build if envs are missing
  console.warn('Missing Supabase environment variables');
}

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

module.exports = { supabase, allowCors };
