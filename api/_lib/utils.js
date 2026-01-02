const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const { supabase } = require('./supabase');

const SECRET = process.env.JWT_SECRET || 'default-secret-change-me';

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch (e) {
    return null;
  }
}

async function verifyTokenAndVersion(token) {
  try {
    const decoded = jwt.verify(token, SECRET);
    if (!decoded || !decoded.id) {
      return null;
    }
    
    // Check token version in database
    const { data: user, error } = await supabase
      .from('users')
      .select('token_version')
      .eq('id', decoded.id)
      .single();
    
    if (error || !user) {
      return null;
    }
    
    // Verify token version matches
    if (decoded.token_version !== user.token_version) {
      return null;
    }
    
    return decoded;
  } catch (e) {
    return null;
  }
}

function setAuthCookie(res, token) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  console.log(`Setting auth cookie. Env: ${process.env.NODE_ENV}, Secure: ${isProduction}`);
  
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: '/',
  };
  
  // Only set SameSite in production or if needed. 
  // In dev, omitting it (defaults to Lax) is often safer for localhost.
  if (isProduction) {
    cookieOptions.sameSite = 'strict';
  } else {
    cookieOptions.sameSite = 'lax';
  }

  const serialized = cookie.serialize('auth_token', token, cookieOptions);
  console.log('Set-Cookie Header Value:', serialized);
  
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

function clearAuthCookie(res) {
    const isProduction = process.env.NODE_ENV === 'production';
    const serialized = cookie.serialize('auth_token', '', {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'strict' : 'lax',
        maxAge: -1,
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

async function getUserIdFromRequest(req) {
    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies.auth_token;
    if (!token) return null;
    const decoded = await verifyTokenAndVersion(token);
    return decoded ? decoded.id : null;
}

module.exports = {
  signToken,
  verifyToken,
  verifyTokenAndVersion,
  setAuthCookie,
  clearAuthCookie,
  getUserIdFromRequest
};
