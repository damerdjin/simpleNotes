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
     * - src (static assets)
     * - dist (built assets)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|login.html|register.html|src|dist).*)',
  ],
};

export default function middleware(req) {
  const url = new URL(req.url);
  const { pathname } = url;
  
  // Skip authentication check for public paths
  if (pathname.startsWith('/api/') ||
      pathname === '/login.html' ||
      pathname === '/register.html' ||
      pathname.startsWith('/src/') ||
      pathname.startsWith('/dist/') ||
      pathname === '/favicon.ico') {
    return;
  }
  
  // Parse auth token cookie
  let authToken = null;
  // Try using req.cookies.get (Edge Middleware API)
  if (req.cookies && req.cookies.get) {
    authToken = req.cookies.get('auth_token');
    // If it returns an object { name, value }, extract value
    if (authToken && typeof authToken === 'object') {
      authToken = authToken.value;
    }
  } else {
    // Fallback to manual parsing
    const cookieHeader = req.headers.get('cookie');
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce((acc, curr) => {
        const [key, val] = curr.trim().split('=');
        acc[key] = val;
        return acc;
      }, {});
      authToken = cookies['auth_token'];
    }
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