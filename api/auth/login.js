import bcrypt from 'bcryptjs';
import { supabase, allowCors } from '../_lib/supabase.js';
import { signToken, setAuthCookie } from '../_lib/utils.js';
import { generateCsrfToken, setCsrfCookie } from '../_lib/csrf.js';
import { asyncHandler, validateRequired, validateEmail } from '../_lib/errorHandler.js';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  // Validate input
  validateRequired({ email, password }, ['email', 'password']);
  validateEmail(email);

  // Find user
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, password_hash, token_version')
    .eq('email', email)
    .single();

  if (error || !user) {
    console.log(`Login failed: user not found for email ${email.replace(/(.{2})(.*)(@.*)/, '$1***$3')}`);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Check password
  const isValid = await bcrypt.compare(password, user.password_hash);

  if (!isValid) {
    console.log(`Login failed: invalid password for email ${email.replace(/(.{2})(.*)(@.*)/, '$1***$3')}`);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Generate auth token
  const token = signToken({ id: user.id, email: user.email, token_version: user.token_version });

  // Set auth cookie
  setAuthCookie(res, token);

  // Generate and set CSRF token
  const csrfToken = generateCsrfToken();
  setCsrfCookie(res, csrfToken);
  res.setHeader('X-CSRF-Token', csrfToken);

  return res.status(200).json({ user: { id: user.id, email: user.email } });
};

export default allowCors(asyncHandler(handler));
