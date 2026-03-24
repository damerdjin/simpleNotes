export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login.html (login page)
     * - register.html (register page)
     * - student-dashboard.html (student page)
     * - src (static assets)
     * - dist (built assets)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|login.html|register.html|student-dashboard.html|src|dist).*)',
  ],
};

export default function middleware(req) {
  const url = new URL(req.url);
  const { pathname } = url;
  
  // Skip authentication check for public paths
  if (pathname.startsWith('/api/') ||
      pathname === '/login.html' ||
      pathname === '/register.html' ||
      pathname === '/student-dashboard.html' ||
      pathname.startsWith('/src/') ||
      pathname.startsWith('/dist/') ||
      pathname === '/favicon.ico') {
    return;
  }
  
  // Parse auth token cookie
  let authToken = null;
  
  // Log raw cookie header for debugging
  const rawCookieHeader = req.headers.get('cookie');
  console.log(`Middleware: Path=${pathname}`);
  
  if (rawCookieHeader) {
      // Log full cookie header to see everything
      console.log('Middleware: Full Cookie Header:', rawCookieHeader);
  } else {
      console.log('Middleware: No cookie header received');
  }

  // Try using req.cookies.get (Edge Middleware API)
  if (req.cookies && typeof req.cookies.get === 'function') {
    const cookieObj = req.cookies.get('auth_token');
    if (cookieObj && typeof cookieObj === 'object') {
      authToken = cookieObj.value;
    } else if (typeof cookieObj === 'string') {
        authToken = cookieObj;
    }
  } 
  
  if (!authToken && rawCookieHeader) {
    // Fallback to manual parsing
    const cookies = rawCookieHeader.split(';').reduce((acc, curr) => {
      const parts = curr.trim().split('=');
      const key = parts[0];
      const val = parts.slice(1).join('='); // Handle values with =
      acc[key] = val;
      return acc;
    }, {});
    
    console.log('Middleware: Parsed cookies keys:', Object.keys(cookies));
    authToken = cookies['auth_token'];
  }
  
  console.log('Middleware: pathname', pathname, 'authToken present?', !!authToken);
  
  // If no auth token and trying to access protected page, redirect to login
  if (!authToken && (pathname === '/' || pathname === '/index.html')) {
    console.log('Redirecting to login');
    url.pathname = '/login.html';
    return Response.redirect(url);
  }
  
  // If we return nothing (undefined), the request continues to the origin
}