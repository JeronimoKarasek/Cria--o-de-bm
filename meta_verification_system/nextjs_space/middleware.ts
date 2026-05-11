import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req?.nextUrl ?? {};
        if (
          pathname?.startsWith('/login') ||
          pathname?.startsWith('/signup') ||
          pathname?.startsWith('/api/auth') ||
          pathname?.startsWith('/api/signup') ||
          pathname === '/'
        ) {
          return true;
        }
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.svg|og-image.png|api/auth|api/signup).*)'],
};
