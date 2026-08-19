import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req?.nextUrl ?? ({} as any);
        if (
          pathname?.startsWith('/login') ||
          pathname?.startsWith('/signup') ||
          pathname?.startsWith('/api/auth') ||
          pathname?.startsWith('/api/signup') ||
          pathname?.startsWith('/api/meta-webhook') ||
          // callback OAuth precisa entrar mesmo se cookie atrasar; valida session no handler
          pathname?.startsWith('/api/meta-api/oauth/callback') ||
          pathname?.startsWith('/s/') ||
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
  matcher: [
    '/((?!_next/static|_next/image|favicon.svg|og-image.png|api/auth|api/signup|api/meta-webhook|api/meta-api/oauth/callback|s/).*)',
  ],
};
