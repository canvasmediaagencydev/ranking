import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { verifyAdminToken, COOKIE_NAME } from '@/lib/admin-token';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminPath = pathname.startsWith('/admin');
  const isAdminLogin = pathname === '/admin/login';

  // Admin routes: verify MongoDB-backed token
  if (isAdminPath && !isAdminLogin) {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    const payload = token ? await verifyAdminToken(token) : null;
    if (!payload) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin/login';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Non-admin routes: keep Supabase session for /me etc.
  const { response, user } = await updateSession(request);
  const isMePath = pathname.startsWith('/me');
  if (isMePath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo-white\\.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
