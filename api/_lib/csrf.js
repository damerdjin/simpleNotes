const crypto = require('crypto');

// Generate a random CSRF token
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Set CSRF token cookie (not httpOnly so client JS can read it)
function setCsrfCookie(res, token) {
  const cookie = require('cookie');
  const serialized = cookie.serialize('csrf_token', token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24, // 1 day
    path: '/',
  });
  
  // Safely add cookie without overwriting existing Set-Cookie headers
  let prev = res.getHeader('Set-Cookie');
  if (prev) {
      if (!Array.isArray(prev)) {
          prev = [prev];
      }
      prev.push(serialized);
      res.setHeader('Set-Cookie', prev);
  } else {
      res.setHeader('Set-Cookie', serialized);
  }
}

// Verify CSRF token from request
function verifyCsrfToken(req) {
  // Get token from cookie
  const cookies = require('cookie').parse(req.headers.cookie || '');
  const cookieToken = cookies.csrf_token;
  
  // Get token from header (X-CSRF-Token)
  const headerToken = req.headers['x-csrf-token'];
  
  // Both must be present and match
  if (!cookieToken || !headerToken) {
    return false;
  }
  
  // Use timing-safe comparison
  return crypto.timingSafeEqual(
    Buffer.from(cookieToken),
    Buffer.from(headerToken)
  );
}

// Middleware to add CSRF protection to routes
function csrfProtection(req, res, next) {
  // Skip CSRF check for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Skip CSRF check for login and register (they set initial CSRF token)
  const path = req.url;
  if (path.includes('/api/auth/login') || path.includes('/api/auth/register')) {
    return next();
  }
  
  if (!verifyCsrfToken(req)) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  next();
}

// Middleware to set CSRF token on first request
function setCsrfOnResponse(req, res, next) {
  // Check if CSRF cookie already exists
  const cookies = require('cookie').parse(req.headers.cookie || '');
  if (!cookies.csrf_token) {
    const token = generateCsrfToken();
    setCsrfCookie(res, token);
  }
  
  // Also set header for client to read
  res.setHeader('X-CSRF-Token', cookies.csrf_token || generateCsrfToken());
  
  next();
}

module.exports = {
  generateCsrfToken,
  setCsrfCookie,
  verifyCsrfToken,
  csrfProtection,
  setCsrfOnResponse
};