import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_TOKEN_COOKIE_ALIASES, AUTH_TOKEN_COOKIE_NAME } from './lib/auth/constants';

/**
 * Route gating mirrors the backend `API_AUTH_MODE`:
 * production always gates, development gates only when
 * NEXT_PUBLIC_AUTH_MODE=enforce (keeps the open dev loop working).
 */
function authGateEnabled(): boolean {
  const mode = process.env.NEXT_PUBLIC_AUTH_MODE?.trim().toLowerCase();
  if (mode === 'enforce') return true;
  if (mode === 'anonymous') return false;
  return process.env.NODE_ENV === 'production';
}

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/logout', '/share'];

function isPublicPath(pathname: string): boolean {
  if (pathname === '/' || pathname === '/health' || pathname.startsWith('/health/') || pathname.startsWith('/api/')) {
    return true;
  }
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function hasSession(request: NextRequest): boolean {
  if (request.cookies.get(AUTH_TOKEN_COOKIE_NAME)?.value) return true;
  return AUTH_TOKEN_COOKIE_ALIASES.some((name) => Boolean(request.cookies.get(name)?.value));
}

export function middleware(request: NextRequest) {
  if (!authGateEnabled()) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname) || hasSession(request)) return NextResponse.next();

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|health(?:/|$)|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff2?|ttf|eot|webmanifest)$).*)',
  ],
};
