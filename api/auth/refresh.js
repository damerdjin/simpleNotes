const { supabase, allowCors } = require('../_lib/supabase');
const { verifyTokenAndVersion, signToken, setAuthCookie } = require('../_lib/utils');
const { verifyCsrfToken } = require('../_lib/csrf');
const { asyncHandler } = require('../_lib/errorHandler');

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify CSRF token
  if (!verifyCsrfToken(req)) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  // Get token from cookie
  const cookies = require('cookie').parse(req.headers.cookie || '');
  const token = cookies.auth_token;

  if (!token) {
    return res.status(401).json({ error: 'No authentication token' });
  }

  // Verify current token and check version
  const decoded = await verifyTokenAndVersion(token);
  
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Increment token version in database
  const { data: user, error: updateError } = await supabase
    .from('users')
    .update({ token_version: decoded.token_version + 1 })
    .eq('id', decoded.id)
    .select('id, email, token_version')
    .single();

  if (updateError || !user) {
    console.error('Token version update error:', updateError);
    throw new Error('Failed to refresh token');
  }

  // Generate new token with updated version
  const newToken = signToken({ 
    id: user.id, 
    email: user.email, 
    token_version: user.token_version 
  });

  // Set new cookie
  setAuthCookie(res, newToken);

  return res.status(200).json({ 
    message: 'Token refreshed',
    user: { id: user.id, email: user.email }
  });
};

module.exports = allowCors(asyncHandler(handler));