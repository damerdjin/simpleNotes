// Secure error handling to prevent information leaks
export function handleError(res, error, context = '') {
  console.error(`Error${context ? ` in ${context}` : ''}:`, error);
  
  // Determine appropriate status code
  let statusCode = 500;
  let message = 'Internal server error';
  
  // Map known error types to appropriate responses
  if (error.message && error.message.includes('credentials')) {
    statusCode = 401;
    message = 'Invalid credentials';
  } else if (error.message && error.message.includes('not found')) {
    statusCode = 404;
    message = 'Resource not found';
  } else if (error.message && error.message.includes('validation') || error.message && error.message.includes('required')) {
    statusCode = 400;
    message = 'Validation error';
  } else if (error.message && error.message.includes('unauthorized') || error.message && error.message.includes('permission')) {
    statusCode = 403;
    message = 'Access denied';
  } else if (error.message && error.message.includes('duplicate') || error.message && error.message.includes('unique')) {
    statusCode = 409;
    message = 'Resource already exists';
  }
  
  // In production, never expose internal error details
  if (process.env.NODE_ENV === 'production') {
    return res.status(statusCode).json({ error: message });
  }
  
  // In development, include safe details
  const safeError = {
    error: message,
    type: error.name || 'Error',
    details: error.message && !error.message.includes('password') && !error.message.includes('secret') 
      ? error.message 
      : 'See server logs for details'
  };
  
  return res.status(statusCode).json(safeError);
}

// Wrapper for async handlers
export function asyncHandler(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      handleError(res, error, handler.name);
    }
  };
}

// Validation utilities
export function validateRequired(body, fields) {
  const missing = fields.filter(field => !body[field]);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}

export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }
}

export function validatePassword(password, minLength = 6) {
  if (password.length < minLength) {
    throw new Error(`Password must be at least ${minLength} characters`);
  }
}

// Rate limiting simulation (for API routes)
const rateLimitStore = new Map();

export function rateLimit(req, limit = 5, windowMs = 15 * 60 * 1000) {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const key = `${ip}:${req.url}`;
  const now = Date.now();
  
  const requests = rateLimitStore.get(key) || [];
  const windowStart = now - windowMs;
  
  // Clean old requests
  const validRequests = requests.filter(time => time > windowStart);
  
  if (validRequests.length >= limit) {
    throw new Error('Too many requests');
  }
  
  validRequests.push(now);
  rateLimitStore.set(key, validRequests);
  
  // Cleanup old entries periodically (simplified)
  if (Math.random() < 0.01) { // 1% chance to cleanup
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.every(time => time < now - windowMs)) {
        rateLimitStore.delete(k);
      }
    }
  }
}
