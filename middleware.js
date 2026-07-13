// middleware.js
// Runs on Vercel's Edge network before ANY matched request is served -
// including the static public/codequest.html file. Nobody without a valid
// session cookie ever receives the homepage HTML at all.
import { NextResponse } from 'next/server';
import { COOKIE_NAME, verifySessionToken } from './lib/session';

export const config = {
  matcher: ['/', '/codequest.html'],
};

export async function middleware(req) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const isLoggedIn = !!session;
  const path = req.nextUrl.pathname;

  if (path === '/') {
    const dest = isLoggedIn ? '/codequest.html' : '/login';
    return NextResponse.redirect(new URL(dest, req.url));
  }

  if (path === '/codequest.html' && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}
